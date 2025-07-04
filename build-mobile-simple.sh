#!/bin/bash

echo "Building Inner Circles for iOS (Simple Build)..."

# Create basic distribution directory
mkdir -p dist/public

# Copy the basic HTML file (redirect to main app)
echo "Copying mobile assets..."
cp -r client/public/* dist/public/ 2>/dev/null || echo "Using basic assets"

# Sync with Capacitor
echo "Syncing with Capacitor..."
npx cap sync ios

echo "✅ Mobile build completed!"
echo ""
echo "Next steps:"
echo "1. Open ios/App/App.xcodeproj in Xcode"
echo "2. Build and run on your device"
echo "3. The app will redirect to https://willbeta.replit.app"
echo ""
echo "Location: ios/App/App.xcodeproj"