# 📱 iOS Simulator Setup for App Store Screenshots

## 🎯 GOAL: Get WILL app running on iPad and iPhone 14 Pro Max simulators for App Store screenshots

## 🔧 METHOD 1: Fix Current Build Issues

### Step 1: Run the Fix Script
```bash
# On your Mac, in the project directory:
./fix-ios-build.sh
```

### Step 2: Manual Xcode Fixes
1. **Open App.xcworkspace** (not .xcodeproj)
2. **In Project Navigator**: Click "App" project → App target
3. **Build Settings**: Search for "sandbox" → Set "Enable App Sandbox" to "No"
4. **Signing & Capabilities**: Remove "App Sandbox" capability if present
5. **Deployment Info**: Set iOS Deployment Target to 13.0

### Step 3: Select Simulators
- **For iPad screenshots**: iPad (10th generation) or iPad Pro (12.9-inch)
- **For 6.5" display**: iPhone 14 Pro Max or iPhone 15 Pro Max

## 🚀 METHOD 2: Alternative Approach (If Method 1 Fails)

### Option A: Use Device Instead of Simulator
- Connect physical iPhone/iPad
- Build directly to device (bypasses simulator sandbox issues)
- Take screenshots on actual device

### Option B: Create New iOS Project
```bash
# Start fresh with latest Capacitor
npx cap add ios --force
cd ios/App
pod install
```

### Option C: Use Web Version for Screenshots
- Open Safari on iOS simulator
- Navigate to: https://willbeta.replit.app
- Take screenshots of web version (Apple allows this for hybrid apps)

## 📸 SCREENSHOT REQUIREMENTS

### Required Sizes:
- **iPad**: 2048x2732 pixels (12.9" iPad Pro)
- **6.5" Display**: 1242x2688 pixels (iPhone 14 Pro Max)

### Key Screens to Capture:
1. **Landing/Auth page** - Shows app purpose
2. **Inner Circle Hub** - Main dashboard view
3. **Will Creation** - Core feature demonstration
4. **End Room** - Video calling feature
5. **Progress Tracking** - Accountability feature

## 🎯 FASTEST PATH TO SUBMISSION

Since you need screenshots urgently:

1. **Try Method 1** (fix current build)
2. **If that fails**: Use physical device or web version
3. **Continue App Store Connect** setup while fixing iOS issues
4. **Upload screenshots** from whichever method works first

The goal is getting quality screenshots quickly, not perfect simulator setup.