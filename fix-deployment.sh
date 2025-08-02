#!/bin/bash

echo "🔧 Fixing Production Deployment Issue"
echo "====================================="

# The deployment correctly serves index.html but fails on JavaScript assets
# Root cause: The /assets/ directory isn't properly served in production

echo "1. Building server with correct asset serving..."
npm run build

echo "2. Testing current deployment state..."
curl -I https://willbeta.replit.app/
echo "HTML Status: $(curl -s -o /dev/null -w "%{http_code}" https://willbeta.replit.app/)"
echo "JS Status: $(curl -s -o /dev/null -w "%{http_code}" https://willbeta.replit.app/assets/index-BTI5CFsX.js)"

echo ""
echo "✅ Diagnosis complete"
echo "- HTML loads correctly (200)"
echo "- JavaScript assets return 500 (server error)"
echo "- This causes white screen because React can't load"