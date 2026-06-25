---
name: WILL public-vs-solo classification
description: How to tell a public will from a solo will; the two valid public representations and the visibility='open' trap.
---

# Public vs. solo will classification

A will is "public" (discoverable in Explore, shown on the My Wills "Public" tab)
ONLY when explicitly created via the "Public Will" option. There are **two valid
representations** of a public will in the data:

- **Modern public:** `kind = 'public'` (and `visibility` defaults to `'open'`).
- **Legacy public:** `kind = 'solo'` with `visibility = 'public'` (pre-migration rows).
- Joined instances of a public will carry `parentWillId` (excluded from Explore,
  but belong on the owner's Public tab).

**The trap:** `visibility` defaults to `'open'` for *every* will, so a plain solo
will and a modern public will BOTH carry `visibility='open'`. Therefore
`visibility === 'open'` must NEVER be used to mean "public" — it mis-files solo
wills into the Public tab and (worse) exposes them in everyone else's Explore.

**Correct test (must match on client AND server):**
`kind === 'public' || visibility === 'public' || parentWillId != null`

**Why:** A reported bug had freshly-created solo wills (`kind='solo'`,
`visibility='open'`) landing on the Public tab and being discoverable by other
users, because both the client classifier and the Explore SQL treated
`visibility='open'` as public.

**How to apply:** Keep the client `willIsPublic` helper and the server Explore
feed query (`getPublicWills`) in lockstep using the test above. Creation derives
`kind` from `mode` + the public flag; a client sending `visibility:'public'` is
converted to `kind='public'` + `visibility='open'`, which is why new public wills
are `kind='public'`, not `visibility='public'`.

# Public wills MUST be joinable (product invariant)

A public will is not just viewable — a non-owner viewing it in Explore must get
a **Join** action. Joinability is gated entirely on `kind === 'public'`:
- Client Explore nav (`getNavTarget` in Explore.tsx): `kind==='public'` →
  `/public-will/:id` (PublicWillDetail, which has the "Join Will" CTA →
  `/explore/join/:id`). Any other kind routes to a view-only viewer
  (e.g. `solo` → `/solo-viewer/:id`, **no Join button**).
- Server: `/api/wills/:id/public-details`, `/join`, and the Explore `hasJoined`
  enrichment all require `kind==='public'` (~15 checks in routes.ts). Join
  handler (routes.ts) rejects `kind!=='public'` with 403 and creates the joined
  child as `kind='public', visibility='open', parentWillId=<parent>`.

**The legacy bug + one-time fix:** Older public wills existed as
`kind='solo' + visibility='public'` (and their joined children as
`kind='solo' + visibility='private'`). Because every `kind==='public'` check
failed for them, they showed in Explore but opened in the **solo viewer with no
Join button** — i.e. public wills that could not be joined. This was corrected by
a one-time PRODUCTION DATA MIGRATION normalizing all such rows (parents AND their
joined children) to `kind='public', visibility='open'`. After migration zero
`solo+public` rows remain; new public wills are already created `kind='public'`,
so the dual representation should not reappear.

**Why:** User explicitly required that public wills must actually be joinable.
**How to apply:** Never represent a public will as `kind='solo'`. If a public
will ever appears view-only again, check its `kind` first — it must be `'public'`
for the whole join stack (nav + public-details + join + hasJoined) to engage.
Note: this DATABASE_URL points at the production Neon DB, so the data fix was
live immediately for the deployed app and iOS clients — no rebuild/republish.
