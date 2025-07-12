#!/bin/bash

echo "Building Inner Circles for iOS (Manual Setup)..."

# Step 1: Build the web assets
echo "Building web assets..."
npm run build

# Step 2: Copy web assets to iOS
echo "Copying web assets to iOS..."
npx cap copy ios

# Step 3: Create a simple iOS project structure without CocoaPods
echo "Setting up iOS project without CocoaPods..."

# Create a simple iOS project that directly links to web content
mkdir -p ios/App/App/public
cp -r dist/public/* ios/App/App/public/

# Create a direct web-based iOS app configuration
cat > ios/App/App/capacitor.config.json << 'EOF'
{
  "appId": "com.porfirio.will",
  "appName": "WILL",
  "webDir": "public",
  "server": {
    "url": "https://willbeta.replit.app",
    "cleartext": true
  }
}
EOF

echo "✅ Mobile build completed without CocoaPods!"
echo ""
echo "Alternative approach for iOS development:"
echo "1. Use the web version at https://willbeta.replit.app"
echo "2. Add to iPhone home screen (Safari → Share → Add to Home Screen)"
echo "3. This creates a native-like experience with all the safe area fixes"
echo ""
echo "For full native iOS development, you'll need:"
echo "- Xcode on macOS"
echo "- CocoaPods installed"
echo "- iOS Simulator or physical device"