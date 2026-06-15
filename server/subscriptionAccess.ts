import { db } from "./db";
import { sql, eq } from "drizzle-orm";
import { users, type User } from "@shared/schema";

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

  const probe = await probeStripeSubscription(user.stripeCustomerId);
  let isSubscribed: boolean;
  if (probe === "unknown") {
    // Stripe schema unavailable. Honor a last-known 'active' status only within a
    // bounded grace window so a transient outage doesn't lock out a real paying
    // subscriber — but a stale/canceled status can't grant indefinite access.
    const verifiedAt = user.subscriptionLastVerifiedAt
      ? new Date(user.subscriptionLastVerifiedAt).getTime()
      : 0;
    const withinGrace = Date.now() - verifiedAt < OUTAGE_GRACE_HOURS * 60 * 60 * 1000;
    if (user.subscriptionStatus === "active" && withinGrace) {
      isSubscribed = true;
    } else if (inTrial) {
      // Still inside the trial window — access is granted regardless of Stripe state.
      isSubscribed = false;
    } else {
      // No safe fallback: refuse to over-grant. Caller fails closed (retry screen).
      throw new SubscriptionUnverifiableError();
    }
  } else {
    isSubscribed = probe === "active";
    // Record a successful verification (timestamp always; status only on change) so
    // the bounded-grace fallback above has accurate data during future outages.
    const nextStatus = isSubscribed ? "active" : inTrial ? "trialing" : "canceled";
    try {
      const patch: Partial<typeof users.$inferInsert> = { subscriptionLastVerifiedAt: new Date() };
      if (nextStatus !== user.subscriptionStatus) patch.subscriptionStatus = nextStatus;
      await db.update(users).set(patch).where(eq(users.id, user.id));
    } catch {
      // best-effort persistence; non-fatal
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
