#!/bin/bash

echo "🚀 Syncing Will app changes to GitHub..."

# Add all changes
git add .

# Commit with timestamp
git commit -m "iOS push notification fixes - $(date '+%Y-%m-%d %H:%M')"

# Push to GitHub
git push origin main

echo "✅ Code successfully pushed to GitHub!"
echo "📱 Now you can pull these changes on your Mac"