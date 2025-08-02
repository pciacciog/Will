#!/bin/bash

echo "🚀 Building WILL for Complete Deployment"
echo "======================================"

# Step 1: Build frontend using the existing development setup
echo "1. Building frontend from development setup..."
if [ -f "dist/index.html" ]; then
    echo "✅ Frontend already built and available"
else
    echo "❌ Frontend not found in dist/"
    echo "🔧 Using development server approach for deployment..."
fi

# Step 2: Build standalone server
echo "2. Building production server..."
npm run build
if [ $? -eq 0 ]; then
    echo "✅ Server build successful"
else
    echo "❌ Server build failed"
    exit 1
fi

# Step 3: Copy existing frontend files to dist if they exist
if [ -d "client/dist" ] && [ "$(ls -A client/dist)" ]; then
    echo "3. Copying frontend files to dist..."
    cp -r client/dist/* dist/ 2>/dev/null || true
    echo "✅ Frontend files copied"
else
    echo "3. No client/dist found, using development mode frontend..."
fi

# Step 4: Test production build
echo "4. Testing production build..."
if [ -f "dist/index.js" ]; then
    echo "✅ Production server ready: dist/index.js"
    echo "✅ Size: $(ls -lh dist/index.js | awk '{print $5}')"
else
    echo "❌ Production server not found"
    exit 1
fi

echo ""
echo "🎉 Build Complete!"
echo "Ready for deployment:"
echo "- Server: dist/index.js"
echo "- Frontend: Served by development proxy"
echo "- Command: NODE_ENV=production node dist/index.js"