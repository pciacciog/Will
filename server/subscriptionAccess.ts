import { db } from "./db";
import { sql, eq } from "drizzle-orm";
import { users, type User } from "@shared/schema";
import { probeRevenueCatEntitlement, type RcProbe } from "./revenueCatAccess";

export const TRIAL_DAYS = 28;

// During a Stripe-schema outage we honor a last-known 'active' status only if it
// was confirmed within this window. Beyond it, we refuse to over-grant access.
const OUTAGE_GRACE_HOURS = 72;

type SubProbe = "active" | "none" | "unknown";

/** Thrown when subscription state genuinely cannot be determined (no safe fallback). */
export class SubscriptionUnverifiableError extends Error {
  constructor() {
    super("subscription_unverifiable");
    this.name = "SubscriptionUnverifiableError";
  }
}

export interface SubscriptionStatus {
  hasAccess: boolean;
  isGrandfathered: boolean;
  isSubscribed: boolean;
  isTrialing: boolean;
  status: string | null;
  trialEndsAt: string | null;
  daysLeft: number | null;
}

/**
 * Probes the synced stripe schema for an active subscription tied to this customer.
 * Returns 'active'/'none' when the query succeeds, or 'unknown' if the stripe schema
 * is unavailable (so callers can fall back to last-known state instead of locking out).
 */
async function probeStripeSubscription(customerId: string | null | undefined): Promise<SubProbe> {
  if (!customerId) return "none";
  try {
    const result = await db.execute(
      sql`SELECT status FROM stripe.subscriptions
          WHERE customer = ${customerId} AND status IN ('active', 'trialing')
          LIMIT 1`
    );
    return result.rows.length > 0 ? "active" : "none";
  } catch {
    return "unknown";
  }
}

/**
 * Best-effort persistence of the last verified subscription state so the bounded
 * grace fallback has accurate data during future billing-source outages.
 * Writes the verification timestamp always; the status only when it changed.
 */
function persistStatus(user: User, nextStatus: "active" | "trialing" | "canceled"): void {
  const patch: Partial<typeof users.$inferInsert> = { subscriptionLastVerifiedAt: new Date() };
  if (nextStatus !== user.subscriptionStatus) patch.subscriptionStatus = nextStatus;
  void db.update(users).set(patch).where(eq(users.id, user.id)).catch(() => {
    // best-effort persistence; non-fatal
  });
}

/**
 * Computes a user's access state.
 * - Users with NULL trialStartedAt are grandfathered (created before subscriptions existed) → always have access.
 * - Otherwise access = within 28-day trial OR has an active Stripe subscription.
 */
export async function getSubscriptionStatus(user: User): Promise<SubscriptionStatus> {
  if (!user.trialStartedAt) {
    return {
      hasAccess: true,
      isGrandfathered: true,
      isSubscribed: false,
      isTrialing: false,
      status: user.subscriptionStatus ?? null,
      trialEndsAt: null,
      daysLeft: null,
    };
  }

  const trialStart = new Date(user.trialStartedAt);
  const trialEndsAt = new Date(trialStart.getTime() + TRIAL_DAYS * 24 * 60 * 60 * 1000);
  const now = new Date();
  const inTrial = now < trialEndsAt;
  const daysLeft = Math.max(0, Math.ceil((trialEndsAt.getTime() - now.getTime()) / (24 * 60 * 60 * 1000)));

  // Access can come from two billing sources: Stripe (web) or RevenueCat / Apple
  // In-App Purchase (iOS). A user is subscribed if EITHER source is active.
  const stripeProbe = await probeStripeSubscription(user.stripeCustomerId);
  const stripeActive = stripeProbe === "active";

  // Only probe RevenueCat when it can actually change the outcome: the user isn't
  // already granted by Stripe and isn't inside the free trial. This bounds external
  // calls to the post-trial, non-Stripe users for whom iOS purchase is the only
  // thing standing between them and a lockout.
  let rcProbe: RcProbe = "none";
  if (!stripeActive && !inTrial) {
    rcProbe = await probeRevenueCatEntitlement(user.id);
  }
  const rcActive = rcProbe === "active";

  const liveActive = stripeActive || rcActive;

  let isSubscribed: boolean;
  if (liveActive) {
    // At least one source definitively confirmed an active subscription.
    isSubscribed = true;
    persistStatus(user, "active");
  } else {
    const sourceUnavailable = stripeProbe === "unknown" || rcProbe === "unknown";
    if (sourceUnavailable) {
      // A billing source was unreachable. Honor a last-known 'active' status only
      // within a bounded grace window so a transient outage doesn't lock out a real
      // paying subscriber — but a stale/canceled status can't grant indefinite access.
      const verifiedAt = user.subscriptionLastVerifiedAt
        ? new Date(user.subscriptionLastVerifiedAt).getTime()
        : 0;
      const withinGrace = Date.now() - verifiedAt < OUTAGE_GRACE_HOURS * 60 * 60 * 1000;
      if (user.subscriptionStatus === "active" && withinGrace) {
        isSubscribed = true;
      } else if (inTrial) {
        // Still inside the trial window — access is granted regardless of billing state.
        isSubscribed = false;
      } else if (stripeProbe === "unknown") {
        // Stripe itself is unverifiable and there's no last-known active subscription.
        // Fail closed to a retry screen rather than over- or under-granting.
        throw new SubscriptionUnverifiableError();
      } else {
        // Only RevenueCat was unavailable and this user has no last-known active
        // subscription, so they aren't an iOS subscriber → show the paywall. Don't
        // persist (the read was inconclusive for that source).
        isSubscribed = false;
      }
    } else {
      // Every probed source definitively reported no active subscription.
      isSubscribed = false;
      persistStatus(user, inTrial ? "trialing" : "canceled");
    }
  }

  return {
    hasAccess: inTrial || isSubscribed,
    isGrandfathered: false,
    isSubscribed,
    isTrialing: inTrial && !isSubscribed,
    status: isSubscribed ? "active" : inTrial ? "trialing" : "expired",
    trialEndsAt: trialEndsAt.toISOString(),
    daysLeft: inTrial ? daysLeft : 0,
  };
}
