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
