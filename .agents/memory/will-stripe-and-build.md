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

## Subscription access policy (dual-source, bounded outage grace) — intentional decision
`getSubscriptionStatus` (server/subscriptionAccess.ts): access = within 28-day trial
OR an active subscription from EITHER billing source — Stripe (web, probed live from
the synced `stripe.subscriptions` schema) OR RevenueCat / Apple IAP (iOS, probed live).
RevenueCat is probed only when the user is NOT already Stripe-active and NOT in trial,
to bound external calls.

NOTE: permanent "grandfathering" was REMOVED. A NULL `trialStartedAt` (existing
pre-subscription accounts) no longer means free-forever — instead the 28-day trial is
stamped lazily on first access after the update (atomic `UPDATE ... WHERE id=? AND
trial_started_at IS NULL`), then those users convert to paying like everyone else.
**Why:** product decision — existing users should also go through the trial→pay flow.
If that lazy stamp can't be persisted, fail closed (`SubscriptionUnverifiableError`)
rather than synthesizing a fresh `now`, which would over-grant on every request during
a sustained DB outage.

Outage handling differs by source on purpose:
- A *source unavailable* result ('unknown' from either probe) falls back to the
  persisted `users.subscriptionStatus==='active'` ONLY within `OUTAGE_GRACE_HOURS`
  (72h of `subscriptionLastVerifiedAt`).
- If only RevenueCat is unavailable and there's no last-known-active subscription,
  treat as 'none' → show the paywall (do NOT 503). A RevenueCat outage must never
  block the paywall for non-subscribers.
- If Stripe itself is unavailable with no last-known-active and outside trial, throw
  → API 503 → client fails closed to a retry screen (preserves original behavior).

**Why:** Strict "lock out on any uncertainty" wrongly denies paying customers during a
transient outage; "grant on any uncertainty" lets canceled users bypass indefinitely.
The 72h bounded grace + per-source outage rules are the deliberate middle ground.

## Apple IAP IS implemented (iOS) via RevenueCat — Capacitor, not Expo
iOS charges through Apple In-App Purchase via RevenueCat (`@revenuecat/purchases-capacitor`).
The Replit `revenuecat` skill is Expo-only (`react-native-purchases`) — do NOT follow it
literally here. RevenueCat dashboard setup was done over the `@replit/connectors-sdk`
proxy (`connectors.proxy("revenuecat", "/v2/...")`), NOT `@replit/revenuecat-sdk`.
Client app_user_id === our `user.id` so the server's v2 `customers/{id}/active_entitlements`
probe matches the purchaser. The iOS publishable key (`appl_…`) lives in
`VITE_REVENUECAT_IOS_API_KEY` and is safe to embed.

**Why:** the web (Stripe) and iOS (Apple IAP) paths coexist — Apple forbids Stripe
checkout for digital goods inside the app, so the Paywall branches on `isIosNative()`.

## Capacitor plugin major-version pinning
This app is on `@capacitor/core` v7. RevenueCat `@revenuecat/purchases-capacitor` v12+
requires Capacitor >=8; v11 is the last line supporting Capacitor 7. Pin native
Capacitor plugins to a version whose peer matches the installed Capacitor major, or
npm install fails with ERESOLVE.

## Steps that must happen OUTSIDE this repo for iOS IAP to actually work
RevenueCat dashboard product/app/entitlement/offering are created, but the user must
still: add the App Store Connect in-app-purchase API key AND App-Specific Shared Secret
to RevenueCat (the app shows `app_store_connect_api_key_configured:false` /
`subscription_key_configured:false`); and rebuild + resubmit to TestFlight. IAP cannot
be tested in the Replit env (needs device + Apple sandbox).

## RevenueCat store_identifier must equal the App Store Connect Product ID exactly
The App Store Connect subscription Product ID is `com.porfirio.will.monthly`; the
RevenueCat product's `store_identifier` MUST match it character-for-character or
purchases won't validate. `store_identifier` is IMMUTABLE in RevenueCat (the v2 API
rejects it on update) — to change it you must create a new product, attach it to the
`premium` entitlement and the `$rc_monthly` package, detach+delete the old product, then
re-attach the new product to the package (a package rejects attaching while an
incompatible same-app product is still attached). App Store Connect IDs can't be reused
once created, so always adapt RevenueCat to Apple, never the reverse.

## Free trial: ONLY the App Store intro offer — no stacking
The app previously granted a 28-day in-app trial in `server/subscriptionAccess.ts`
(`TRIAL_DAYS`) BEFORE the paywall, separate from any store trial. That stacked with
Apple's "first month free" introductory offer (set in App Store Connect), giving new
iOS users ~2 free months. Decision: in-app trial is disabled (`TRIAL_DAYS = 0`) so the
only free period is Apple's store-side intro offer applied at purchase.
**Why:** user wants exactly one free month. **How to apply:** don't re-enable the in-app
trial for iOS; if web/Stripe ever needs a trial, configure it natively in Stripe.
Paywall copy must be eligibility-scoped ("new subscribers", "eligibility determined by
the App Store") because Apple intro offers are not granted to every Apple ID.
