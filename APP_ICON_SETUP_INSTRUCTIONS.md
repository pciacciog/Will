# WILL App - App Icon Setup Instructions

## Issue
Your TestFlight submission was rejected because the app icons appear to be placeholder icons (Guideline 2.3.8 - Performance - Accurate Metadata).

## Solution
I've created a professional WILL app icon design and updated the iOS configuration. Here's what you need to do:

## Step 1: Generate Icon Files
You have two options:

### Option A: Online Icon Generator (Recommended)
1. Open the `will_app_icon.svg` file I created in the root directory
2. Go to https://appicon.co/ or https://makeappicon.com/
3. Upload the SVG file
4. Download the generated icon pack
5. Extract and copy all PNG files to `ios/App/App/Assets.xcassets/AppIcon.appiconset/`

### Option B: Manual Creation
If you have design software (Photoshop, Sketch, etc.):
1. Use the `will_app_icon.svg` as reference
2. Create PNG files with these exact sizes:
   - AppIcon-20@2x.png (40x40px)
   - AppIcon-20@3x.png (60x60px)
   - AppIcon-29@2x.png (58x58px)
   - AppIcon-29@3x.png (87x87px)
   - AppIcon-40@2x.png (80x80px)
   - AppIcon-40@3x.png (120x120px)
   - AppIcon-60@2x.png (120x120px)
   - AppIcon-60@3x.png (180x180px)
   - AppIcon-1024.png (1024x1024px)

## Step 2: Replace Icon Files
1. Navigate to `ios/App/App/Assets.xcassets/AppIcon.appiconset/`
2. Delete the existing `AppIcon-512@2x.png`
3. Add all the new PNG files with the exact names listed above

## Step 3: Verify Configuration
The `Contents.json` file has been updated with the proper icon configuration. No additional changes needed.

## Step 4: Build and Test
```bash
npm run build
npx cap sync ios
```
Then rebuild in Xcode and check that all icon slots are filled in the AppIcon.appiconset.

## Icon Design Details
The WILL app icon features:
- **Brand Colors**: Emerald green gradient (#10B981 to #059669)
- **Symbol**: Hand gesture representing commitment/will
- **Typography**: Clean "WILL" branding
- **Style**: Modern, professional, iOS-compliant design
- **Rounded Corners**: Proper iOS icon specifications

## Verification
After implementing:
1. Open Xcode project
2. Navigate to App > Assets.xcassets > AppIcon
3. Verify all icon slots are filled (no missing icons)
4. Build and install on device to test
5. Check iOS home screen shows proper icon (not generic/placeholder)

## Resubmission
Once icons are properly implemented:
1. Archive new build in Xcode
2. Upload to App Store Connect
3. Submit for TestFlight review
4. The metadata rejection should be resolved

The new icon design aligns with the WILL brand identity and meets Apple's requirements for professional, non-placeholder app icons.