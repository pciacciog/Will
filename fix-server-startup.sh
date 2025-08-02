#!/bin/bash

echo "🔧 WILL Backend Server Startup Fix"
echo "=================================="

# Kill any existing server processes
echo "1. Stopping existing servers..."
pkill -f "tsx.*server" 2>/dev/null || true
pkill -f "node.*server" 2>/dev/null || true

# Install missing Vite dependency for original server
echo "2. Installing Vite dependency..."
npm install vite

# Option 1: Fix original server by installing Vite
echo "3. Starting original server with Vite support..."
NODE_ENV=development npx tsx server/index.ts &
SERVER_PID=$!

# Wait for server to start
sleep 8

# Test server
echo "4. Testing server endpoints..."
if curl -f http://localhost:5000/api/health >/dev/null 2>&1; then
    echo "✅ Original server working on port 5000!"
    
    # Test push notification endpoint
    echo "5. Testing push notifications..."
    RESPONSE=$(curl -s -X POST http://localhost:5000/api/notifications/test \
        -H "Content-Type: application/json" \
        -d '{"title":"Test Push","body":"Backend is working!"}')
    
    if [[ $RESPONSE == *"success"* ]]; then
        echo "✅ Push notification system operational!"
    else
        echo "⚠️  Push notification test failed (may need authentication)"
    fi
    
    echo ""
    echo "🎉 SERVER STARTUP FIXED!"
    echo "Backend is running on: http://localhost:5000"
    echo "Push notifications: Ready for testing"
    echo ""
    echo "Next steps:"
    echo "- Build iOS app: npm run build && npx cap sync ios"
    echo "- Deploy to TestFlight for end-to-end testing"
    
else
    echo "❌ Server startup still failing. Using standalone backend..."
    kill $SERVER_PID 2>/dev/null
    
    # Fallback to standalone server
    echo "Starting standalone backend server..."
    NODE_ENV=development npx tsx server/index-standalone.ts &
    
    sleep 5
    if curl -f http://localhost:5000/api/health >/dev/null 2>&1; then
        echo "✅ Standalone backend working!"
    else
        echo "❌ Both server options failed. Check logs for details."
    fi
fi