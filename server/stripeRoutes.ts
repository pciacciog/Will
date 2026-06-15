import type { Express } from "express";
import { db } from "./db";
import { users } from "@shared/schema";
import { eq, sql } from "drizzle-orm";
import { isAuthenticated } from "./auth";
import { getUncachableStripeClient } from "./stripeClient";
import { getSubscriptionStatus, SubscriptionUnverifiableError } from "./subscriptionAccess";
import { getDefaultOrigin } from "./config/environment";

function getBaseUrl(req: any): string {
  const origin = req.get("origin");
  if (origin && /^https?:\/\//.test(origin) && !origin.includes("capacitor")) {
    return origin;
  }
  return getDefaultOrigin();
}

async function getActiveRecurringPriceId(): Promise<string | null> {
  try {
    const result = await db.execute(
      sql`SELECT id FROM stripe.prices
          WHERE active = true AND recurring IS NOT NULL
          ORDER BY created DESC LIMIT 1`
    );
    return (result.rows[0] as any)?.id ?? null;
  } catch {
    return null;
  }
}

export function registerStripeRoutes(app: Express) {
  // Current user's subscription/trial state
  app.get("/api/subscription/status", isAuthenticated, async (req: any, res) => {
    try {
      const status = await getSubscriptionStatus(req.user);
      res.json(status);
    } catch (err: any) {
      if (err instanceof SubscriptionUnverifiableError) {
        // State genuinely undeterminable — fail closed; client shows a retry screen.
        return res.status(503).json({ message: "Subscription state unverifiable" });
      }
      console.error("[Stripe] subscription status error:", err?.message || err);
      res.status(500).json({ message: "Failed to get subscription status" });
    }
  });

  // Start a Stripe Checkout session for the $5.99/mo plan
  app.post("/api/stripe/create-checkout-session", isAuthenticated, async (req: any, res) => {
    try {
      const user = req.user;
      const stripe = await getUncachableStripeClient();

      let customerId: string | null = user.stripeCustomerId;
      if (!customerId) {
        const customer = await stripe.customers.create({
          email: user.email,
          name: `${user.firstName} ${user.lastName}`.trim(),
          metadata: { userId: user.id },
        });
        customerId = customer.id;
        await db.update(users).set({ stripeCustomerId: customerId }).where(eq(users.id, user.id));
      }

      const priceId = await getActiveRecurringPriceId();
      if (!priceId) {
        return res
          .status(503)
          .json({ message: "Subscription plan not configured yet. Please try again shortly." });
      }

      const baseUrl = getBaseUrl(req);
      const session = await stripe.checkout.sessions.create({
        customer: customerId,
        mode: "subscription",
        payment_method_types: ["card"],
        line_items: [{ price: priceId, quantity: 1 }],
        success_url: `${baseUrl}/?checkout=success`,
        cancel_url: `${baseUrl}/?checkout=cancel`,
        allow_promotion_codes: true,
      });

      res.json({ url: session.url });
    } catch (err: any) {
      console.error("[Stripe] create checkout session error:", err?.message || err);
      res.status(500).json({ message: "Failed to start checkout" });
    }
  });

  // Stripe Billing portal for managing/canceling an existing subscription
  app.post("/api/stripe/create-portal-session", isAuthenticated, async (req: any, res) => {
    try {
      const user = req.user;
      if (!user.stripeCustomerId) {
        return res.status(400).json({ message: "No subscription to manage" });
      }
      const stripe = await getUncachableStripeClient();
      const baseUrl = getBaseUrl(req);
      const session = await stripe.billingPortal.sessions.create({
        customer: user.stripeCustomerId,
        return_url: `${baseUrl}/`,
      });
      res.json({ url: session.url });
    } catch (err: any) {
      console.error("[Stripe] create portal session error:", err?.message || err);
      res.status(500).json({ message: "Failed to open billing portal" });
    }
  });
}
