---
name: ESM bundle require() trap (production SPA catch-all 500s)
description: Why deployed deep-link routes 500 while "/" works — require() is undefined in the esbuild ESM bundle.
---

# require() is undefined in the production bundle

The server is bundled by esbuild into `dist/index.js` as an **ES module**. In that
output `require` does NOT exist. Any `require('...')` that survives into runtime
throws `require is not defined`, and inside an Express route handler that surfaces
as a bare **500 "Internal Server Error"** for that path.

**Symptom that points here:** the deployed app's `/` returns 200 but every other
route (`/auth`, `/reset-password`, deep links) returns 500. `/` works because
`express.static` serves `index.html` directly; all other paths fall through to the
SPA catch-all `app.get('*')`, which is where the bad `require` lived.

**Why:** dev runs via `tsx` (CommonJS-ish, `require` works), so the bug is invisible
locally and only appears in the deployed/bundled build. The dev branch of the same
code used `await import('fs')` and worked, masking the prod-only failure.

**How to apply:**
- Never use `require(...)` in server source — use top-level `import` (or
  `await import(...)`). Prefer a static top import for hot paths like the catch-all.
- This class of bug is **deploy-only**. After touching server startup / static
  serving, verify a NON-root route on the actual deployment (`curl` a deep link),
  not just `/` and not just localhost dev.
