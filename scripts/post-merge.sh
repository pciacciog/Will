#!/bin/bash
set -e
npm install
APP_ENV=staging npm run db:push
