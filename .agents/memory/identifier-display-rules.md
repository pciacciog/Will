---
name: Identifier display rules (username / firstName / email)
description: How user identifiers must be surfaced across WILL contexts, and where enforcement lives.
---

# Identifier display rules

WILL has three distinct identifier-display contexts. Pick by context, not by convenience:

- **Social / discovery** (friend search, friends list, discover, friend profile, DMs,
  create-team-will picker): show `@username`. FriendsPage shows display name +
  `@username` as the secondary line (the user explicitly wanted name + handle, not
  handle-only). Never the proof feed's other identifiers here.
- **Accountability** (circle/will member cards, proof feed authorship): show
  `firstName` only. A bare first name, never a fabricated `@firstname` handle.
- **Email**: NEVER appears in any social or discovery API response or UI. This
  includes non-obvious leak spots like the proof-feed endpoint
  (`/api/wills/:willId/proofs`) which historically selected `users.email` as a
  name fallback — return `username` instead.

**Why:** username is the production discovery primitive (email search was removed
entirely; `@username` is the only way to find people). Email is PII and must not
leak through social surfaces even as a display fallback.

**How to apply:** when adding/auditing any endpoint or component that lists other
users, check the SELECT and the JSON shape for `email`. If it's a social/discovery
surface, drop email and use `username` (or `firstName` for accountability).

## Username enforcement (app-layer, schema unchanged)
- `username` column stays **nullable** in the DB; the unique index is the race guard.
- Validation is centralized in `shared/username.ts` (`validateUsername` /
  `normalizeUsername`, regex `^[a-z0-9_]{3,30}$`) — used by client + server so
  rules can't drift. No reserved/blocklist for v1.
- Uniqueness is enforced by catching Postgres `error.code === '23505'` → 409, on
  BOTH register and the username PATCH (pre-checks alone race).
- Existing authenticated users without a username hit a **non-dismissible**
  intercept that runs BEFORE the subscription/paywall gate in `App.tsx`
  (`isAuthenticated && user && !user.username`).
