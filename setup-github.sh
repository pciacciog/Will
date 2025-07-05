#!/bin/bash

# GitHub Setup Script for WILL iOS App
# Connecting to https://github.com/pciaccio/Will.git

echo "Setting up GitHub remote..."

# Add your GitHub repository as origin
git remote add origin https://github.com/pciaccio/Will.git

# Push your existing code to GitHub
git push -u origin main

echo "✅ GitHub setup complete!"
echo ""
echo "Your workflow is now:"
echo "1. Make changes in Replit"
echo "2. Git push from Replit will automatically sync to GitHub"
echo "3. On your local machine: git pull to get latest changes"
echo "4. Run: npx cap sync ios && npx cap open ios"