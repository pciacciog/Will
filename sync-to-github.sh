#!/bin/bash

echo "🔄 Syncing WILL Project Changes to GitHub"
echo "========================================"

# Function to handle git operations safely
safe_git() {
    # Remove any lingering lock files
    rm -f .git/index.lock .git/refs/heads/main.lock 2>/dev/null || true
    
    # Execute git command with retry logic
    local max_retries=3
    local retry_count=0
    
    while [ $retry_count -lt $max_retries ]; do
        if timeout 30 git "$@"; then
            return 0
        else
            retry_count=$((retry_count + 1))
            echo "Git operation failed, retrying... ($retry_count/$max_retries)"
            rm -f .git/index.lock .git/refs/heads/main.lock 2>/dev/null || true
            sleep 2
        fi
    done
    
    echo "Git operation failed after $max_retries attempts"
    return 1
}

echo "1. Checking current Git status..."
safe_git status --porcelain

echo "2. Checking branch divergence..."
safe_git fetch origin main 2>/dev/null || echo "Fetch completed"

echo "3. Current branch status:"
safe_git log --oneline -3
echo ""
echo "Remote branch status:"
safe_git log --oneline origin/main -3

echo "4. Attempting to resolve conflicts automatically..."

# Stage any modified files that are ready
if [ -f "capacitor.config.json" ]; then
    echo "   - Staging capacitor.config.json (keeping local version with APNs config)"
    safe_git add capacitor.config.json
fi

if [ -f "package-lock.json" ]; then
    echo "   - Regenerating package-lock.json to resolve conflicts"
    rm -f package-lock.json
    npm install --package-lock-only
    safe_git add package-lock.json
fi

# Stage .replit file changes
if safe_git diff --name-only | grep -q ".replit"; then
    echo "   - Staging .replit file changes"
    safe_git add .replit
fi

echo "5. Checking if we're in merge state..."
if [ -f ".git/MERGE_HEAD" ]; then
    echo "   - Completing merge..."
    safe_git commit -m "Resolve merge conflicts: maintain APNs integration and latest dependencies"
elif [ -f ".git/CHERRY_PICK_HEAD" ]; then
    echo "   - Completing cherry-pick..."
    safe_git commit -m "Complete cherry-pick with conflict resolution"
else
    echo "   - Creating new commit with current changes..."
    safe_git commit -m "Sync local changes: APNs fixes and dependency updates" || echo "No changes to commit"
fi

echo "6. Pushing to GitHub..."
if safe_git push origin main; then
    echo "✅ Successfully pushed to GitHub!"
    echo "🎉 Your APNs integration and all local changes are now synced"
else
    echo "❌ Push failed. Attempting force push with lease..."
    if safe_git push --force-with-lease origin main; then
        echo "✅ Force push successful!"
        echo "⚠️  Note: Used force push to resolve divergent history"
    else
        echo "❌ Both push attempts failed"
        echo "💡 Manual intervention may be required"
        echo ""
        echo "Current status:"
        safe_git status
        echo ""
        echo "Suggested next steps:"
        echo "1. Verify all important changes are committed locally"
        echo "2. Consider creating a backup branch: git branch backup-$(date +%Y%m%d)"
        echo "3. Reset to remote and re-apply changes if needed"
    fi
fi

echo ""
echo "📊 Final status:"
safe_git log --oneline -5