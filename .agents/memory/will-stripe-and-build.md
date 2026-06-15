---
name: WILL Stripe subscriptions & frontend build serving
description: Non-obvious facts about this app's frontend serving model, the Stripe connector secret shape, and the subscription access policy.
---

## Frontend is served from a PREBUILT bundle, not a Vite dev server
The dev workflow runs `npx tsx server/index-standalone.ts`, which serves the
frontend statically from `dist/public/` ("Development mode: Serving frontend from
dist/public/" in logs). There is **no Vite dev middleware** in this app.

**How to apply:** Any change under `client/src/**` will NOT appear in the preview
(or production) until you run `npm run build`. Editing + restarting the workflow is
not enough. This differs from the standard Replit fullstack template.

## Stripe connector secret field name
The Stripe connector's settings object exposes the secret key as `settings.secret`,
NOT `settings.secret_key`. Code uses `settings.secret ?? settings.secret_key` as a
defensive fallback.

## Subscription access policy (bounded outage grace) — intentional decision
`getSubscriptionStatus` (server/subscriptionAccess.ts): access = grandfathered
(trialStartedAt null) OR within 28-day trial OR active Stripe subscription (probed
live from the synced `stripe.subscriptions` schema).

When the stripe-schema probe throws ('unknown'), we fall back to the persisted
`users.subscriptionStatus==='active'` ONLY if `subscriptionLastVerifiedAt` is within
`OUTAGE_GRACE_HOURS` (72h); otherwise (outside trial) we throw and the API returns
503 so the client fails closed to a retry screen.

**Why:** Strict "always lock out on any uncertainty" would wrongly lock out genuine
paying customers during a transient Stripe outage. The 72h bounded grace is a
deliberate tradeoff — it closes the *indefinite* bypass a canceled user could
otherwise exploit while protecting real subscribers. Successful probes refresh
`subscriptionLastVerifiedAt` so the window always reflects the last real confirmation.

## Apple IAP risk (flagged, not enforced)
This is a Stripe WEB subscription that unlocks in-app digital content. On iOS via
Capacitor this can violate Apple's IAP policy. Product/business decision, not a code bug.
