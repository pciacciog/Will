import UIKit
import Capacitor
import Foundation

@UIApplicationMain
class AppDelegate: UIResponder, UIApplicationDelegate, UNUserNotificationCenterDelegate {

    var window: UIWindow?
    
    func application(_ application: UIApplication, didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]?) -> Bool {
        // Override point for customization after application launch.
        
        // 🔥 CRITICAL: Register for remote notifications IMMEDIATELY on app launch
        // This ensures tokens are generated BEFORE user login, fixing the timing issue
        UNUserNotificationCenter.current().delegate = self
        
        print("🔥 iOS DIRECT: App launched - requesting push notification permissions immediately")
        
        // Request permissions and register for notifications right away
        UNUserNotificationCenter.current().requestAuthorization(options: [.alert, .badge, .sound]) { granted, error in
            DispatchQueue.main.async {
                if granted {
                    print("🔥 iOS DIRECT: Push notification permissions granted - registering for remote notifications")
                    application.registerForRemoteNotifications()
                } else {
                    print("🚨 iOS DIRECT: Push notification permissions denied")
                    if let error = error {
                        print("🚨 iOS DIRECT: Permission error: \(error.localizedDescription)")
                    }
                }
            }
        }
        
        return true
    }
    
    func applicationWillResignActive(_ application: UIApplication) {
        // Sent when the application is about to move from active to inactive state.
    }

    func applicationDidEnterBackground(_ application: UIApplication) {
        // Use this method to release shared resources, save user data, etc.
    }

    func applicationWillEnterForeground(_ application: UIApplication) {
        // Called as part of the transition from the background to the active state.
    }

    func applicationDidBecomeActive(_ application: UIApplication) {
        // Clear badge number when app becomes active
        print("🔔 App became active - clearing badge number")
        UIApplication.shared.applicationIconBadgeNumber = 0
        
        // Also request to remove all delivered notifications from notification center
        UNUserNotificationCenter.current().removeAllDeliveredNotifications()
    }

    func applicationWillTerminate(_ application: UIApplication) {
        // Called when the application is about to terminate.
    }

    func application(_ app: UIApplication, open url: URL, options: [UIApplication.OpenURLOptionsKey: Any] = [:]) -> Bool {
        return ApplicationDelegateProxy.shared.application(app, open: url, options: options)
    }

    func application(_ application: UIApplication, continue userActivity: NSUserActivity, restorationHandler: @escaping ([UIUserActivityRestoring]?) -> Void) -> Bool {
        return ApplicationDelegateProxy.shared.application(application, continue: userActivity, restorationHandler: restorationHandler)
    }
    
    // CRITICAL: This is the method that was actually implemented
    func application(_ application: UIApplication, didRegisterForRemoteNotificationsWithDeviceToken deviceToken: Data) {
        let tokenString = deviceToken.map { String(format: "%02.2hhx", $0) }.joined()
        
        // NEW DIRECT API CALL IMPLEMENTATION
        print("🔥 iOS DIRECT: Device Token Generated: \(tokenString.prefix(20))...")
        print("🔥 iOS DIRECT: Starting DIRECT API call to bypass broken JavaScript bridge")
        
        // Call direct API method
        sendTokenDirectlyToServer(token: tokenString)
        
        // Keep old bridge method for comparison (but it's broken)
        print("🟢 Device Token Successfully Registered: \(tokenString)")
        NotificationCenter.default.post(
            name: NSNotification.Name("CapacitorDeviceTokenReceived"),
            object: nil,
            userInfo: ["token": tokenString]
        )
        
        // Also send directly to PushNotifications plugin if available
        if let bridge = (window?.rootViewController as? CAPBridgeViewController)?.bridge {
            // Convert dictionary to JSON string
            if let jsonData = try? JSONSerialization.data(withJSONObject: ["value": tokenString], options: []),
               let jsonString = String(data: jsonData, encoding: .utf8) {
                bridge.triggerJSEvent(eventName: "pushNotificationRegistration", target: "window", data: jsonString)
            }
        }
    }
    
    // NEW METHOD: Direct API call to server
    func sendTokenDirectlyToServer(token: String) {
        print("🔥 iOS DIRECT: sendTokenDirectlyToServer() method called")
        
        // API endpoint URL
        guard let url = URL(string: "https://willbeta.replit.app/api/device-token") else {
            print("🚨 iOS DIRECT: Invalid URL")
            return
        }
        
        print("🔥 iOS DIRECT: Server API URL: \(url.absoluteString)")
        
        // Prepare payload with REQUIRED bundle data for APNS certificate matching
        let buildScheme = getBuildScheme()
        let environment = (buildScheme == "Debug") ? "sandbox" : "production"
        
        let payload: [String: Any] = [
            "deviceToken": token,
            "userId": "pending",
            "platform": "ios",
            "environment": environment,
            "appVersion": Bundle.main.infoDictionary?["CFBundleShortVersionString"] as? String ?? "1.0.0",
            "deviceModel": UIDevice.current.model,
            "osVersion": UIDevice.current.systemVersion,
            "source": "direct_ios_api",
            
            // CRITICAL FIELDS FOR APNS CERTIFICATE MATCHING:
            "bundleId": Bundle.main.bundleIdentifier ?? "com.porfirio.will",
            "buildScheme": buildScheme,
            "provisioningProfile": getProvisioningProfile()
        ]
        
        print("🔥 iOS DIRECT: Payload prepared: \(payload.keys)")
        
        // Create request
        var request = URLRequest(url: url)
        request.httpMethod = "POST"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        
        // Serialize JSON
        do {
            request.httpBody = try JSONSerialization.data(withJSONObject: payload)
            print("🔥 iOS DIRECT: JSON serialization successful")
        } catch {
            print("🚨 iOS DIRECT: JSON serialization failed: \(error.localizedDescription)")
            return
        }
        
        print("🔥 iOS DIRECT: Making HTTP request at \(Date())")
        
        // Make API call
        URLSession.shared.dataTask(with: request) { data, response, error in
            DispatchQueue.main.async {
                if let error = error {
                    print("🚨 iOS DIRECT: Network error: \(error.localizedDescription)")
                    self.scheduleRetry(token: token, attempt: 1)
                } else if let httpResponse = response as? HTTPURLResponse {
                    print("🔥 iOS DIRECT: HTTP Response Status: \(httpResponse.statusCode)")
                    
                    if httpResponse.statusCode == 200 {
                        print("🔥 iOS DIRECT: ✅ SUCCESS - Token registered directly with server!")
                        print("🔥 iOS DIRECT: ✅ JavaScript bridge successfully bypassed!")
                        
                        // Store success info
                        UserDefaults.standard.set(token, forKey: "registered_device_token")
                        UserDefaults.standard.set(Date().timeIntervalSince1970, forKey: "token_registration_time")
                        UserDefaults.standard.set(true, forKey: "direct_api_success")
                        
                    } else {
                        print("🚨 iOS DIRECT: Server returned error status: \(httpResponse.statusCode)")
                        if let data = data, let responseString = String(data: data, encoding: .utf8) {
                            print("🚨 iOS DIRECT: Error response: \(responseString)")
                        }
                        self.scheduleRetry(token: token, attempt: 1)
                    }
                } else {
                    print("🚨 iOS DIRECT: Unknown response type")
                }
            }
        }.resume()
    }
    
    // Retry mechanism with exponential backoff
    func scheduleRetry(token: String, attempt: Int) {
        guard attempt <= 3 else {
            print("🚨 iOS DIRECT: Max retry attempts reached, giving up")
            return
        }
        
        let delay = pow(2.0, Double(attempt)) // 2, 4, 8 seconds
        print("🔥 iOS DIRECT: Scheduling retry attempt \(attempt) in \(delay) seconds")
        
        DispatchQueue.main.asyncAfter(deadline: .now() + delay) {
            print("🔥 iOS DIRECT: Retry attempt \(attempt) starting...")
            self.sendTokenDirectlyToServer(token: token)
        }
    }
    
    // Handle registration failure
    func application(_ application: UIApplication, didFailToRegisterForRemoteNotificationsWithError error: Error) {
        print("🚨 iOS DIRECT: Failed to register for remote notifications: \(error.localizedDescription)")
        
        // Notify Capacitor layer of failure
        NotificationCenter.default.post(
            name: NSNotification.Name("CapacitorDeviceTokenError"),
            object: nil,
            userInfo: ["error": error.localizedDescription]
        )
        
        // Also send error to PushNotifications plugin if available
        if let bridge = (window?.rootViewController as? CAPBridgeViewController)?.bridge {
            if let jsonData = try? JSONSerialization.data(withJSONObject: ["error": error.localizedDescription], options: []),
               let jsonString = String(data: jsonData, encoding: .utf8) {
                bridge.triggerJSEvent(eventName: "pushNotificationRegistrationError", target: "window", data: jsonString)
            }
        }
    }
    
    // HELPER METHODS for Bundle Data Detection
    
    func getBuildScheme() -> String {
        #if DEBUG
        return "Debug"
        #else
        return "Release"
        #endif
    }
    
    func getProvisioningProfile() -> String {
        #if DEBUG
        return "development"
        #else
        return "distribution"
        #endif
    }
}

// MARK: - UNUserNotificationCenterDelegate

extension AppDelegate {
    
    // Handle notification when app is in foreground
    func userNotificationCenter(_ center: UNUserNotificationCenter, willPresent notification: UNNotification, withCompletionHandler completionHandler: @escaping (UNNotificationPresentationOptions) -> Void) {
        print("📱 Received notification while in foreground: \(notification.request.content.title)")
        
        // Show notification even when app is in foreground
        completionHandler([.banner, .sound, .badge])
    }
    
    // Handle notification tap when app is in background/killed
    func userNotificationCenter(_ center: UNUserNotificationCenter, didReceive response: UNNotificationResponse, withCompletionHandler completionHandler: @escaping () -> Void) {
        print("🔔 User tapped notification: \(response.notification.request.content.title)")
        
        // Send notification data to Capacitor layer
        let userInfo = response.notification.request.content.userInfo
        NotificationCenter.default.post(
            name: NSNotification.Name("CapacitorPushNotificationTapped"),
            object: nil,
            userInfo: userInfo
        )
        
        completionHandler()
    }
}
