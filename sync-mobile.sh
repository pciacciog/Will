#!/bin/bash

# Quick Mobile Sync Script for WILL App
# This script syncs changes to iOS for rapid testing

echo "🚀 Syncing changes to iOS..."

# Sync with Capacitor (only syncs changed files)
npx cap sync ios

echo "✅ Sync complete!"
echo ""
echo "📱 Next steps:"
echo "1. Your iOS app should refresh automatically if it's running"
echo "2. If not, refresh the app manually"
echo "3. Changes should appear instantly!"
echo ""
echo "💡 For instant changes, just refresh your iPhone app - no need to rebuild in Xcode"