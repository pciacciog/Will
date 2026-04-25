#!/bin/bash
set -e
npm install
# DISABLED: auto schema push — must be run manually & deliberately to avoid data loss.
# Run `npm run db:push` by hand after reviewing pending schema changes.
echo "[post-merge] Skipping auto db:push. Run 'npm run db:push' manually if schema changed."
