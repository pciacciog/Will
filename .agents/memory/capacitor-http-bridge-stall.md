---
name: Capacitor HTTP bridge stall on iOS (60s hang)
description: Why fetch() calls hang for ~60s on iOS and how to prevent it
---

**Root cause:** `capacitor.config.json` has `"CapacitorHttp": { "enabled": true }`. This patches ALL `fetch()` calls to route through the native iOS bridge (URLSession). The bridge is a message queue processed by the iOS main thread. When multiple concurrent bridge operations are in flight (Preferences.get() + polling fetch calls), new fetch requests get queued and can stall for ~60s until the screen locks/unlocks.

**Observed symptom:** Tapping any will from the My Wills list shows a spinner for ~60 seconds. The request never appears in server deployment logs. Data appears after the screen auto-locks.

**Why screen lock resolves it:** When iOS backgrounds the app (screen lock), it flushes the WKWebView bridge message queue, processing pending bridge calls. On foreground restore, the queued Preferences.get() or fetch() calls resolve.

**Fix 1 — SessionPersistence.ts (requires iOS binary rebuild):**
Save auth token to `localStorage` (synchronous, no bridge call) alongside `Capacitor.Preferences`. In `getToken()`, check `localStorage` FIRST. This eliminates the Preferences.get() bridge call from the hot path entirely. The constructor also pre-seeds `this.authToken` from `localStorage` synchronously at initialization.

**Fix 2 — WillPage.tsx (immediate, no iOS rebuild):**
Use `placeholderData` in the /meta useQuery to seed routing from the already-cached all-active query data. Any will in all-active means isMember=true. This renders the correct component (TeamWillHub/WillDetails) immediately with zero network wait — spinner never shows.

**Fix 3 — server/index.ts:**
Add `Cache-Control: no-store` middleware for all `/api` routes. Prevents iOS WKWebView from caching error responses (especially 500s from the kind-column period) that would be re-served with artificial delay.

**How to apply:** When adding any new page that needs a "routing" fetch before rendering, always seed it from an existing cache query using `placeholderData` to avoid showing a spinner that depends on a bridge call.
