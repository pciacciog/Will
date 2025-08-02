#!/bin/bash

echo "🚀 Starting WILL Development Server"
echo "=================================="

# Kill any existing servers
pkill -f "tsx\|node.*index" 2>/dev/null || true

echo "Starting server with APNs integration..."
NODE_ENV=development npx tsx server/index-standalone.ts