#!/bin/bash

# iOS Build Fix Script for WILL App
# Resolves sandbox permission errors and framework header issues

echo "🔧 Starting iOS build fix for WILL app..."

# Step 1: Clean everything
echo "1. Cleaning iOS build artifacts..."
cd ios/App
rm -rf Pods/
rm -rf build/
rm -rf DerivedData/
rm -f Podfile.lock

# Step 2: Fix Podfile for sandbox compatibility
echo "2. Creating sandbox-compatible Podfile..."
cat > Podfile << 'EOF'
require_relative '../../node_modules/@capacitor/ios/scripts/pods_helpers'

platform :ios, '13.0'
use_frameworks!

# Workaround for sandbox issues
def capacitor_pods
  pod 'Capacitor', :path => '../../node_modules/@capacitor/ios'
  pod 'CapacitorCordova', :path => '../../node_modules/@capacitor/ios'
  pod 'CapacitorApp', :path => '../../node_modules/@capacitor/app'
  pod 'CapacitorBrowser', :path => '../../node_modules/@capacitor/browser'
  pod 'CapacitorDevice', :path => '../../node_modules/@capacitor/device'
  pod 'CapacitorLocalNotifications', :path => '../../node_modules/@capacitor/local-notifications'
  pod 'CapacitorPushNotifications', :path => '../../node_modules/@capacitor/push-notifications'
end

target 'App' do
  capacitor_pods
  # Add your other dependencies here
end

post_install do |installer|
  assertDeploymentTarget(installer)
  
  # Fix sandbox permission issues
  installer.pods_project.targets.each do |target|
    target.build_configurations.each do |config|
      config.build_settings['ENABLE_APP_SANDBOX'] = 'NO'
      config.build_settings['IPHONEOS_DEPLOYMENT_TARGET'] = '13.0'
      config.build_settings['CODE_SIGNING_ALLOWED'] = 'NO'
    end
  end
end
EOF

# Step 3: Install pods with sandbox workarounds
echo "3. Installing CocoaPods with sandbox fixes..."
export DISABLE_SPRING=1
export COCOAPODS_DISABLE_STATS=true
pod install --repo-update --verbose

# Step 4: Create Xcode scheme without sandbox
echo "4. Creating sandbox-free Xcode scheme..."
mkdir -p App.xcodeproj/xcshareddata/xcschemes

cat > App.xcodeproj/xcshareddata/xcschemes/App.xcscheme << 'EOF'
<?xml version="1.0" encoding="UTF-8"?>
<Scheme
   LastUpgradeVersion = "1300"
   version = "1.3">
   <BuildAction
      parallelizeBuildables = "YES"
      buildImplicitDependencies = "YES">
      <BuildActionEntries>
         <BuildActionEntry
            buildForTesting = "YES"
            buildForRunning = "YES"
            buildForProfiling = "YES"
            buildForArchiving = "YES"
            buildForAnalyzing = "YES">
            <BuildableReference
               BuildableIdentifier = "primary"
               BlueprintIdentifier = "92DBD5A82616CD9E008D4ACD"
               BuildableName = "App.app"
               BlueprintName = "App"
               ReferencedContainer = "container:App.xcodeproj">
            </BuildableReference>
         </BuildActionEntry>
      </BuildActionEntries>
   </BuildAction>
   <TestAction
      buildConfiguration = "Debug"
      selectedDebuggerIdentifier = "Xcode.DebuggerFoundation.Debugger.LLDB"
      selectedLauncherIdentifier = "Xcode.DebuggerFoundation.Launcher.LLDB"
      shouldUseLaunchSchemeArgsEnv = "YES">
   </TestAction>
   <LaunchAction
      buildConfiguration = "Debug"
      selectedDebuggerIdentifier = "Xcode.DebuggerFoundation.Debugger.LLDB"
      selectedLauncherIdentifier = "Xcode.DebuggerFoundation.Launcher.LLDB"
      launchStyle = "0"
      useCustomWorkingDirectory = "NO"
      ignoresPersistentStateOnLaunch = "NO"
      debugDocumentVersioning = "YES"
      debugServiceExtension = "internal"
      allowLocationSimulation = "YES">
      <BuildableProductRunnable
         runnableDebuggingMode = "0">
         <BuildableReference
            BuildableIdentifier = "primary"
            BlueprintIdentifier = "92DBD5A82616CD9E008D4ACD"
            BuildableName = "App.app"
            BlueprintName = "App"
            ReferencedContainer = "container:App.xcodeproj">
         </BuildableReference>
      </BuildableProductRunnable>
      <EnvironmentVariables>
         <EnvironmentVariable
            key = "DISABLE_APP_SANDBOX"
            value = "YES"
            isEnabled = "YES">
         </EnvironmentVariable>
      </EnvironmentVariables>
   </LaunchAction>
   <ProfileAction
      buildConfiguration = "Release"
      shouldUseLaunchSchemeArgsEnv = "YES"
      savedToolIdentifier = ""
      useCustomWorkingDirectory = "NO"
      debugDocumentVersioning = "YES">
      <BuildableProductRunnable
         runnableDebuggingMode = "0">
         <BuildableReference
            BuildableIdentifier = "primary"
            BlueprintIdentifier = "92DBD5A82616CD9E008D4ACD"
            BuildableName = "App.app"
            BlueprintName = "App"
            ReferencedContainer = "container:App.xcodeproj">
         </BuildableReference>
      </BuildableProductRunnable>
   </ProfileAction>
   <AnalyzeAction
      buildConfiguration = "Debug">
   </AnalyzeAction>
   <ArchiveAction
      buildConfiguration = "Release"
      revealArchiveInOrganizer = "YES">
   </ArchiveAction>
</Scheme>
EOF

echo "5. Fixing project build settings..."
# Add build settings fix to project
cat >> App/App/App-Info.plist << 'EOF'
<!-- Disable App Sandbox for development -->
<key>com.apple.security.app-sandbox</key>
<false/>
EOF

echo "✅ iOS build fix complete!"
echo ""
echo "📱 Next steps:"
echo "1. Open App.xcworkspace (not .xcodeproj)"
echo "2. Select iOS Simulator (iPad or iPhone 14 Pro Max for 6.5\")"
echo "3. Build and run for screenshots"
echo ""
echo "🎯 For App Store screenshots:"
echo "- iPad: Use iPad simulator"
echo "- 6.5\" display: Use iPhone 14 Pro Max simulator"
echo ""