import { ReplitConnectors } from "@replit/connectors-sdk";

// RevenueCat integration (Replit connector, proxy pattern). OAuth tokens are
// injected/refreshed automatically by the SDK. See the `integrations` skill.
const connectors = new ReplitConnectors();

const PROJECT_ID = process.env.REVENUECAT_PROJECT_ID;

export type RcProbe = "active" | "none" | "unknown";

/**
 * Probes RevenueCat for an active entitlement tied to this user (the app_user_id
 * the iOS client configures Purchases with === our user.id).
 *
 * Returns:
 *  - "active"  → customer has at least one active entitlement (this project has a
 *               single "premium" entitlement, so any active entitlement grants access)
 *  - "none"    → customer exists with no active entitlement, OR customer is unknown
 *               to RevenueCat (404 resource_missing — never purchased)
 *  - "unknown" → RevenueCat was unreachable / errored (caller falls back, never locks out)
 */
export async function probeRevenueCatEntitlement(appUserId: string): Promise<RcProbe> {
  // No user id → nothing to look up (definitive non-match, not an outage).
  if (!appUserId) return "none";
  // Misconfiguration is an availability problem, not proof of "no subscription":
  // return "unknown" so the outage-safe grace path protects real subscribers
  // instead of silently locking them out.
  if (!PROJECT_ID) {
    console.error("[RevenueCat] REVENUECAT_PROJECT_ID is not set — cannot verify entitlements");
    return "unknown";
  }
  try {
    const resp = await connectors.proxy(
      "revenuecat",
      `/v2/projects/${PROJECT_ID}/customers/${encodeURIComponent(appUserId)}/active_entitlements`,
      { method: "GET" },
    );

    if (resp.status === 404) {
      // Customer not found for this project → never purchased.
      return "none";
    }
    if (!resp.ok) {
      // 5xx / auth / gateway problems: don't lock out a possible subscriber.
      return "unknown";
    }

    const data = await resp.json().catch(() => null);
    const items = (data && Array.isArray(data.items)) ? data.items : [];
    return items.length > 0 ? "active" : "none";
  } catch {
    return "unknown";
  }
}
