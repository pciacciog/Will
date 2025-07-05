#!/bin/bash

# Quick script to push changes to GitHub
# Usage: ./push-to-github.sh "Your commit message"

if [ -z "$1" ]; then
    echo "Usage: ./push-to-github.sh \"Your commit message\""
    exit 1
fi

echo "Adding all changes..."
git add .

echo "Committing changes..."
git commit -m "$1"

echo "Pushing to GitHub..."
git push

echo "✅ Successfully pushed to GitHub!"
echo ""
echo "On your local machine, run:"
echo "git pull"
echo "npx cap sync ios && npx cap open ios"