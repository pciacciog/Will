#!/bin/bash

echo "🔧 Fixing Server Startup Issues"
echo "==============================="

echo "1. Installing build dependencies globally as backup..."
npm install -g esbuild tsx vite 2>/dev/null || echo "Global install skipped (may require permissions)"

echo "2. Checking current tsx availability..."
which tsx || echo "tsx not found in PATH"
which vite || echo "vite not found in PATH" 
which esbuild || echo "esbuild not found in PATH"

echo "3. Testing build commands..."
echo "   - Testing tsx..."
npx tsx --version 2>/dev/null || echo "tsx not working via npx"

echo "   - Testing vite..."
npx vite --version 2>/dev/null || echo "vite not working via npx"

echo "   - Testing esbuild..."
npx esbuild --version 2>/dev/null || echo "esbuild not working via npx"

echo "4. Attempting to start server with standalone version..."
if [ -f "server/index-standalone.ts" ]; then
    echo "   - Using standalone server (bypass main dev script)..."
    NODE_ENV=development npx tsx server/index-standalone.ts &
    SERVER_PID=$!
    sleep 3
    
    if kill -0 $SERVER_PID 2>/dev/null; then
        echo "   ✅ Standalone server started successfully (PID: $SERVER_PID)"
        echo "   🌐 Server should be available on port 5000"
    else
        echo "   ❌ Standalone server failed to start"
    fi
else
    echo "   ⚠️  No standalone server found"
fi

echo "5. Alternative: Direct node execution if possible..."
if [ -f "dist/index.js" ]; then
    echo "   - Found pre-built server, testing..."
    NODE_ENV=production node dist/index.js &
    PROD_PID=$!
    sleep 2
    
    if kill -0 $PROD_PID 2>/dev/null; then
        echo "   ✅ Production server working (PID: $PROD_PID)"
    else
        echo "   ❌ Production server failed"
    fi
fi

echo ""
echo "📊 Summary:"
echo "   - Check if server is running on http://localhost:5000"
echo "   - If deployment still fails, dependencies need to be moved to production scope"
echo "   - APNs functionality should work once server is running"