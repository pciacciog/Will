import { Capacitor } from "@capacitor/core";

// RevenueCat (Apple In-App Purchase) integration for the native iOS app.
// The web build uses Stripe instead; everything here is a no-op off-device.
//
// The iOS publishable SDK key is safe to embed in the client.
const IOS_API_KEY = import.meta.env.VITE_REVENUECAT_IOS_API_KEY as string | undefined;
const ENTITLEMENT_ID = "premium";

export function isIosNative(): boolean {
  return Capacitor.isNativePlatform() && Capacitor.getPlatform() === "ios";
}

let configuredForUser: string | null = null;
let configuring: Promise<void> | null = null;

/**
 * Configures RevenueCat with the logged-in user's id as the app_user_id so
 * purchases are tied to the same identity the server checks. Safe to call
 * repeatedly; only reconfigures when the user changes.
 */
export async function initRevenueCat(userId: string): Promise<boolean> {
  if (!isIosNative() || !IOS_API_KEY || !userId) return false;
  if (configuredForUser === userId) return true;
  if (configuring) {
    await configuring;
    if (configuredForUser === userId) return true;
  }

  configuring = (async () => {
    const { Purchases } = await import("@revenuecat/purchases-capacitor");
    await Purchases.configure({ apiKey: IOS_API_KEY, appUserID: userId });
    configuredForUser = userId;
  })();

  try {
    await configuring;
    return true;
  } catch (err) {
    console.error("[RevenueCat] configure failed", err);
    return false;
  } finally {
    configuring = null;
  }
}

/** Returns the monthly subscription package from the current offering, or null. */
export async function getMonthlyPackage() {
  if (!isIosNative()) return null;
  const { Purchases } = await import("@revenuecat/purchases-capacitor");
  const offerings = await Purchases.getOfferings();
  const current = offerings.current;
  if (!current) return null;
  return (
    current.monthly ??
    current.availablePackages?.find((p) => p.identifier === "$rc_monthly") ??
    current.availablePackages?.[0] ??
    null
  );
}

function hasActivePremium(customerInfo: { entitlements: { active: Record<string, unknown> } }): boolean {
  return Boolean(customerInfo?.entitlements?.active?.[ENTITLEMENT_ID]);
}

/** Triggers the Apple purchase sheet. Returns true if the premium entitlement is active afterward. */
export async function purchasePremium(): Promise<boolean> {
  if (!isIosNative()) return false;
  const { Purchases } = await import("@revenuecat/purchases-capacitor");
  const pkg = await getMonthlyPackage();
  if (!pkg) throw new Error("No subscription package available");
  const { customerInfo } = await Purchases.purchasePackage({ aPackage: pkg });
  return hasActivePremium(customerInfo);
}

/** Restores prior purchases. Returns true if the premium entitlement is active afterward. */
export async function restorePurchases(): Promise<boolean> {
  if (!isIosNative()) return false;
  const { Purchases } = await import("@revenuecat/purchases-capacitor");
  const { customerInfo } = await Purchases.restorePurchases();
  return hasActivePremium(customerInfo);
}

/** Thrown by the SDK when the user cancels the Apple purchase sheet. */
export function isUserCancelled(err: unknown): boolean {
  const e = err as { code?: string; userCancelled?: boolean } | undefined;
  return Boolean(e?.userCancelled) || e?.code === "1" || e?.code === "PURCHASE_CANCELLED";
}
