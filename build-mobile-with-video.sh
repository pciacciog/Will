#!/bin/bash

echo "Building mobile app with video room support..."

# Build the web assets
echo "Building web assets..."
npm run build

# Sync with iOS
echo "Syncing with Capacitor iOS..."
npx cap sync ios

echo "Adding iOS permissions for camera and microphone..."

# Add to Info.plist if not already present
INFO_PLIST="ios/App/App/Info.plist"

if ! grep -q "NSCameraUsageDescription" "$INFO_PLIST"; then
  echo "Adding camera permission to Info.plist..."
  # Create a temporary file with the additions
  cat >> temp_additions.xml << 'EOF'
	<key>NSCameraUsageDescription</key>
	<string>This app needs camera access to enable video calls during your Will End Room ceremonies.</string>
	<key>NSMicrophoneUsageDescription</key>
	<string>This app needs microphone access to enable video calls during your Will End Room ceremonies.</string>
EOF

  # Insert before the closing </dict> tag
  sed -i.bak '/<\/dict>/{
    i\
EOF
  cat temp_additions.xml >> temp_file
  echo '</dict>' >> temp_file
  } else {
    cat temp_file
  }' "$INFO_PLIST"
  
  rm -f temp_additions.xml temp_file
  rm -f "${INFO_PLIST}.bak"
fi

echo "Opening Xcode project..."
npx cap open ios

echo ""
echo "Mobile build complete! The iOS project is now open in Xcode."
echo ""
echo "Next steps:"
echo "1. In Xcode, build and run on your device"
echo "2. Grant camera and microphone permissions when prompted"
echo "3. Test the embedded video room functionality"
echo ""
echo "The video room will:"
echo "- Try to embed directly in the app first"
echo "- Fall back to native browser if needed"
echo "- Auto-disconnect after 30 minutes"