require_relative '../../node_modules/@capacitor/ios/scripts/pods_helpers'

platform :ios, '13.0'
use_frameworks!

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
end

post_install do |installer|
  assertDeploymentTarget(installer)
  
  installer.pods_project.targets.each do |target|
    target.build_configurations.each do |config|
      config.build_settings['ENABLE_APP_SANDBOX'] = 'NO'
      config.build_settings['IPHONEOS_DEPLOYMENT_TARGET'] = '13.0'
    end
  end
end
