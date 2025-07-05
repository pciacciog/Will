# WILL iOS App - GitHub Workflow Setup

This guide will help you set up a seamless development workflow between Replit and your local iOS development environment.

## 🎯 Goal
- Make changes in Replit
- Automatically sync to GitHub
- Pull latest changes to your local ~/Will folder
- Run iOS builds without manual downloads

## 📋 Setup Steps

### 1. Create GitHub Repository
1. Go to https://github.com/new
2. Repository name: `will-ios-app` (or your preference)
3. Choose Public or Private
4. **Don't** initialize with README/gitignore (we have existing code)
5. Click "Create repository"

### 2. Connect Replit to GitHub
After creating the repo, GitHub will show you the repository URL. Run this in Replit:

```bash
# Replace YOUR_USERNAME and YOUR_REPO_NAME with your actual details
git remote add origin https://github.com/YOUR_USERNAME/YOUR_REPO_NAME.git
git push -u origin main
```

### 3. Set Up Local Development
On your local machine:

```bash
# Clone to your preferred location
cd ~
git clone https://github.com/YOUR_USERNAME/YOUR_REPO_NAME.git Will
cd Will

# Install dependencies
npm install

# Install Capacitor CLI globally if not already installed
npm install -g @capacitor/cli
```

## 🔄 Your New Workflow

### In Replit (when you make changes):
1. Code changes are automatically saved
2. Push to GitHub: `git add . && git commit -m "Updated mobile UI" && git push`

### On Your Local Machine:
1. Pull latest changes: `git pull`
2. Sync iOS project: `npx cap sync ios`
3. Open in Xcode: `npx cap open ios`
4. Build and test on your iPhone

## 🚀 Quick Commands

### Replit Commands:
```bash
# Push changes to GitHub
git add .
git commit -m "Your commit message"
git push

# Check status
git status
git log --oneline -5
```

### Local Commands:
```bash
# Get latest changes
git pull

# Full iOS rebuild
npx cap sync ios && npx cap open ios

# Just sync (if Xcode is already open)
npx cap sync ios
```

## 📱 iOS Build Process
1. `git pull` - Get latest from GitHub
2. `npx cap sync ios` - Sync web assets to iOS
3. `npx cap open ios` - Open Xcode
4. Build and run on your device

## 🛠️ Troubleshooting

### If git push fails:
```bash
git pull --rebase
git push
```

### If iOS build fails:
```bash
# Clean and rebuild
npx cap clean ios
npx cap sync ios
```

### If dependencies are missing:
```bash
npm install
```

## 📁 Project Structure
```
~/Will/
├── client/          # React frontend
├── server/          # Express backend
├── ios/             # iOS Capacitor project
├── shared/          # Shared types/schemas
└── README-GitHub-Workflow.md
```

## 🎉 Benefits of This Workflow
- ✅ No more manual ZIP downloads
- ✅ Version control for all changes
- ✅ Seamless sync between Replit and local
- ✅ Easy collaboration if needed
- ✅ Backup of all your work on GitHub
- ✅ Professional development workflow