#!/bin/bash

# Build mobile app script for Inner Circles iOS app
echo "Building Inner Circles for iOS..."

# Step 1: Build the web app
echo "Building web assets..."
NODE_ENV=production vite build

# Step 2: Sync with Capacitor
echo "Syncing with Capacitor..."
npx cap sync ios

# Step 3: Open Xcode project
echo "Opening Xcode project..."
npx cap open ios

echo "Mobile app build complete!"
echo "Next steps:"
echo "1. In Xcode, select your iOS device or simulator"
echo "2. Click the 'Play' button to run the app"
echo "3. For App Store submission, use 'Product > Archive'"