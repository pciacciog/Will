---
name: Home Alert Badge System
description: How the dynamic alert badges on the home screen work end-to-end
---

## Architecture
- **Backend**: `GET /api/home-alerts` (server/routes.ts) — queries will_review wills, pending team invites, pending friend requests. Returns array of `{ type, count, targetSection, willIds? }`.
- **Hook**: `useHomeAlerts` (client/src/hooks/useHomeAlerts.ts) — wraps /api/home-alerts with 30s polling. Exposes `getAlert(type)`, `totalForSection(section)`, `invalidate()`.
- **Central clearing**: Invalidating `['/api/home-alerts']` is how badges clear — call `queryClient.invalidateQueries({ queryKey: ['/api/home-alerts'] })` after any accept/decline/review action.

## Navigation flow
- Home → My Wills badge tap: if single willId → `/will/:id` (sets `sessionStorage.willAlertType`); if multiple → `/wills?alert=<type>`
- Home → Friends badge tap: → `/friends?highlight=requests`
- MyWills reads `?alert=` param, shows filtered amber banner, floats flagged wills to top
- FriendsPage reads `?highlight=requests`, auto-scrolls to requests section
- WillDetails reads `sessionStorage.willAlertType` on mount (and clears it), shows contextual amber banner

**Why:** Every alert must have a deterministic one-tap path from home badge → exact item → clear CTA. No dead ends.
