import UIKit
import Capacitor
import UserNotifications
import Network

@UIApplicationMain
class AppDelegate: UIResponder, UIApplicationDelegate {

    var window: UIWindow?
    private let pathMonitor = NWPathMonitor()
    private let monitorQueue = DispatchQueue(label: "NetworkMonitor")
    private var isConnected: Bool = false
    
    // Concurrency control for token registration
    private var isTokenRegistrationInFlight: Bool = false
    private var pendingRetryTimer: Timer?
    
    // Constants for token registration
    private struct TokenRegistration {
        static let userDefaultsKey = "device_token_registration"
        static let maxRetryAttempts = 5
        static let baseRetryDelay: TimeInterval = 2.0
        static let maxRetryDelay: TimeInterval = 120.0
        
        struct PendingToken: Codable {
            let token: String
            let timestamp: Date
            let attemptCount: Int
            let userId: String
            let nextAttemptAt: Date
            
            init(token: String, userId: String = "pending") {
                self.token = token
                self.timestamp = Date()
                self.attemptCount = 0
                self.userId = userId
                self.nextAttemptAt = Date() // First attempt can be immediate
            }
            
            // Create a new instance with incremented attempt count and updated timing
            func withIncrementedAttempt() -> PendingToken {
                let newAttemptCount = self.attemptCount + 1
                let delay = min(
                    TokenRegistration.baseRetryDelay * pow(2.0, Double(newAttemptCount - 1)),
                    TokenRegistration.maxRetryDelay
                )
                // Add jitter (±25% random variation)
                let jitter = delay * (Double.random(in: 0.75...1.25))
                let nextAttempt = Date().addingTimeInterval(jitter)
                
                return PendingToken(
                    token: self.token,
                    timestamp: self.timestamp,
                    attemptCount: newAttemptCount,
                    userId: self.userId,
                    nextAttemptAt: nextAttempt
                )
            }
            
            private init(token: String, timestamp: Date, attemptCount: Int, userId: String, nextAttemptAt: Date) {
                self.token = token
                self.timestamp = timestamp
                self.attemptCount = attemptCount
                self.userId = userId
                self.nextAttemptAt = nextAttemptAt
            }
        }
    }

    func application(_ application: UIApplication, didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]?) -> Bool {
        // Override point for customization after application launch.
        
        // Start network monitoring
        startNetworkMonitoring()
        
        // Register for remote notifications
        UNUserNotificationCenter.current().delegate = self
        application.registerForRemoteNotifications()
        
        // Process any pending token registrations
        processPendingTokenRegistrations()
        
        return true
    }

    func applicationWillResignActive(_ application: UIApplication) {
        // Sent when the application is about to move from active to inactive state.
    }

    func applicationDidEnterBackground(_ application: UIApplication) {
        // Use this method to release shared resources, save user data, etc.
    }

    func applicationWillEnterForeground(_ application: UIApplication) {
        // Called as part of the transition from the background to the active state
        // Retry any pending token registrations when coming back to foreground
        processPendingTokenRegistrations()
    }

    func applicationDidBecomeActive(_ application: UIApplication) {
        // Restart any tasks that were paused while the application was inactive
        // Retry any pending token registrations when becoming active
        processPendingTokenRegistrations()
    }

    func applicationWillTerminate(_ application: UIApplication) {
        // Called when the application is about to terminate.
        pathMonitor.cancel()
        pendingRetryTimer?.invalidate()
    }

    func application(_ app: UIApplication, open url: URL, options: [UIApplication.OpenURLOptionsKey: Any] = [:]) -> Bool {
        return ApplicationDelegateProxy.shared.application(app, open: url, options: options)
    }

    func application(_ application: UIApplication, continue userActivity: NSUserActivity, restorationHandler: @escaping ([UIUserActivityRestoring]?) -> Void) -> Bool {
        return ApplicationDelegateProxy.shared.application(application, continue: userActivity, restorationHandler: restorationHandler)
    }
    
    // MARK: - Network Monitoring
    
    private func startNetworkMonitoring() {
        pathMonitor.pathUpdateHandler = { [weak self] path in
            DispatchQueue.main.async {
                self?.isConnected = path.status == .satisfied
                print("🌐 Network status changed: \(self?.isConnected == true ? "Connected" : "Disconnected")")
                
                // When network becomes available, retry pending registrations
                if self?.isConnected == true {
                    self?.processPendingTokenRegistrations()
                }
            }
        }
        pathMonitor.start(queue: monitorQueue)
    }
    
    // MARK: - Push Notification Delegate Methods
    
    func application(_ application: UIApplication, didRegisterForRemoteNotificationsWithDeviceToken deviceToken: Data) {
        // Convert device token to string
        let tokenString = deviceToken.map { String(format: "%02x", $0) }.joined()
        let maskedToken = maskToken(tokenString)
        
        print("🔥 iOS: Device Token Successfully Registered")
        print("🔥 iOS: Masked Token: \(maskedToken)")
        print("🔥 iOS: Token length: \(tokenString.count)")
        print("🔥 iOS: Starting secure token registration with server...")
        
        // Store token and attempt registration
        let pendingToken = TokenRegistration.PendingToken(token: tokenString)
        savePendingToken(pendingToken)
        
        // Attempt immediate registration
        isTokenRegistrationInFlight = true
        registerTokenWithServer(pendingToken) { [weak self] success in
            DispatchQueue.main.async {
                self?.isTokenRegistrationInFlight = false
                
                if success {
                    print("🔥 iOS: ✅ Token registered successfully - removing from pending list")
                    self?.removePendingToken()
                } else {
                    print("🔥 iOS: ⚠️  Token registration failed - will retry later")
                    // Update retry state for future attempts
                    self?.updatePendingTokenAfterFailure(pendingToken)
                }
            }
        }
        
        // Keep Capacitor bridge methods for compatibility (but they may be broken)
        print("🔍 DEBUG: Also attempting Capacitor bridge methods for compatibility...")
        NotificationCenter.default.post(
            name: NSNotification.Name("CapacitorDeviceTokenReceived"),
            object: nil,
            userInfo: ["token": tokenString]
        )
        
        if let bridge = (window?.rootViewController as? CAPBridgeViewController)?.bridge {
            bridge.triggerJSEvent(eventName: "pushNotificationRegistration", target: "window", data: ["value": tokenString])
        }
    }
    
    func application(_ application: UIApplication, didFailToRegisterForRemoteNotificationsWithError error: Error) {
        print("🚨 iOS: Failed to register for remote notifications: \(error.localizedDescription)")
        
        // Notify Capacitor layer of failure
        NotificationCenter.default.post(
            name: NSNotification.Name("CapacitorDeviceTokenError"),
            object: nil,
            userInfo: ["error": error.localizedDescription]
        )
        
        // Also send error to PushNotifications plugin if available
        if let bridge = (window?.rootViewController as? CAPBridgeViewController)?.bridge {
            bridge.triggerJSEvent(eventName: "pushNotificationRegistrationError", target: "window", data: ["error": error.localizedDescription])
        }
    }
    
    // MARK: - Token Management and Persistence
    
    private func savePendingToken(_ pendingToken: TokenRegistration.PendingToken) {
        do {
            let data = try JSONEncoder().encode(pendingToken)
            UserDefaults.standard.set(data, forKey: TokenRegistration.userDefaultsKey)
            print("🔒 iOS: Token saved to UserDefaults for retry capability")
        } catch {
            print("🚨 iOS: Failed to save pending token: \(error.localizedDescription)")
        }
    }
    
    private func loadPendingToken() -> TokenRegistration.PendingToken? {
        guard let data = UserDefaults.standard.data(forKey: TokenRegistration.userDefaultsKey) else {
            return nil
        }
        
        do {
            let pendingToken = try JSONDecoder().decode(TokenRegistration.PendingToken.self, from: data)
            return pendingToken
        } catch {
            print("🚨 iOS: Failed to load pending token: \(error.localizedDescription)")
            // Remove corrupted data
            UserDefaults.standard.removeObject(forKey: TokenRegistration.userDefaultsKey)
            return nil
        }
    }
    
    private func removePendingToken() {
        UserDefaults.standard.removeObject(forKey: TokenRegistration.userDefaultsKey)
        print("🔒 iOS: Pending token removed from UserDefaults")
    }
    
    private func updatePendingTokenAfterFailure(_ pendingToken: TokenRegistration.PendingToken) {
        let updatedToken = pendingToken.withIncrementedAttempt()
        
        // Check if we've exceeded max retry attempts
        if updatedToken.attemptCount >= TokenRegistration.maxRetryAttempts {
            print("🚨 iOS: Max retry attempts reached (\(updatedToken.attemptCount)), giving up on token registration")
            removePendingToken()
            return
        }
        
        // Save the updated retry state
        savePendingToken(updatedToken)
        
        let maskedToken = maskToken(updatedToken.token)
        print("🔄 iOS: Updated retry state - attempt \(updatedToken.attemptCount)/\(TokenRegistration.maxRetryAttempts)")
        print("🔄 iOS: Next attempt scheduled for: \(updatedToken.nextAttemptAt)")
        print("🔄 iOS: Masked Token: \(maskedToken)")
        
        // Schedule the next retry attempt
        scheduleNextRetry(for: updatedToken)
    }
    
    private func processPendingTokenRegistrations() {
        // Prevent concurrent executions
        guard !isTokenRegistrationInFlight else {
            print("🔒 iOS: Token registration already in progress, skipping duplicate call")
            return
        }
        
        guard isConnected else {
            print("🌐 iOS: No network connection - skipping pending token registration")
            return
        }
        
        guard let pendingToken = loadPendingToken() else {
            print("🔒 iOS: No pending token registrations found")
            return
        }
        
        // Check if token is too old (older than 24 hours)
        let hoursSinceGenerated = Date().timeIntervalSince(pendingToken.timestamp) / 3600
        if hoursSinceGenerated > 24 {
            print("🕒 iOS: Pending token is too old (\(Int(hoursSinceGenerated)) hours), removing...")
            removePendingToken()
            return
        }
        
        // Check if we've exceeded max retry attempts
        if pendingToken.attemptCount >= TokenRegistration.maxRetryAttempts {
            print("🚨 iOS: Max retry attempts reached (\(pendingToken.attemptCount)), giving up on token registration")
            removePendingToken()
            return
        }
        
        // Check if it's too early to retry (timing control)
        let now = Date()
        if now < pendingToken.nextAttemptAt {
            let timeUntilNextAttempt = pendingToken.nextAttemptAt.timeIntervalSince(now)
            print("🕒 iOS: Too early for retry - waiting \(Int(timeUntilNextAttempt)) more seconds")
            
            // Schedule the retry for the correct time
            scheduleNextRetry(for: pendingToken)
            return
        }
        
        let maskedToken = maskToken(pendingToken.token)
        print("🔄 iOS: Processing pending token registration (attempt \(pendingToken.attemptCount + 1)/\(TokenRegistration.maxRetryAttempts))")
        print("🔄 iOS: Masked Token: \(maskedToken)")
        
        // Set in-flight flag to prevent concurrent requests
        isTokenRegistrationInFlight = true
        
        // Attempt registration immediately (timing was already checked)
        registerTokenWithServer(pendingToken) { [weak self] success in
            DispatchQueue.main.async {
                // Clear in-flight flag
                self?.isTokenRegistrationInFlight = false
                
                if success {
                    print("🔥 iOS: ✅ Token registered successfully!")
                    self?.removePendingToken()
                } else {
                    print("🔥 iOS: ❌ Token registration failed, updating retry state")
                    // Update attempt count and schedule next retry
                    self?.updatePendingTokenAfterFailure(pendingToken)
                }
            }
        }
    }
    
    private func scheduleNextRetry(for pendingToken: TokenRegistration.PendingToken) {
        // Cancel any existing retry timer
        pendingRetryTimer?.invalidate()
        
        let timeUntilNextAttempt = pendingToken.nextAttemptAt.timeIntervalSince(Date())
        
        // Don't schedule if time is negative or too far in the future
        guard timeUntilNextAttempt > 0 && timeUntilNextAttempt <= TokenRegistration.maxRetryDelay else {
            print("🕒 iOS: Invalid retry time calculated, will retry on next lifecycle event")
            return
        }
        
        print("🕒 iOS: Scheduling retry in \(Int(timeUntilNextAttempt)) seconds")
        
        pendingRetryTimer = Timer.scheduledTimer(withTimeInterval: timeUntilNextAttempt, repeats: false) { [weak self] _ in
            print("🕒 iOS: Retry timer fired, attempting token registration")
            self?.processPendingTokenRegistrations()
        }
    }
    
    // MARK: - Token Registration with Server
    
    private func registerTokenWithServer(_ pendingToken: TokenRegistration.PendingToken, completion: @escaping (Bool) -> Void) {
        guard isConnected else {
            print("🌐 iOS: No network connection for token registration")
            completion(false)
            return
        }
        
        // Get API base URL from Info.plist
        guard let apiBaseURL = getAPIBaseURL() else {
            print("🚨 iOS: Failed to get API base URL from Info.plist")
            completion(false)
            return
        }
        
        guard let apiURL = URL(string: "\(apiBaseURL)/api/device-token") else {
            print("🚨 iOS: Failed to construct API URL")
            completion(false)
            return
        }
        
        let maskedToken = maskToken(pendingToken.token)
        print("🔗 iOS: Registering token with server: \(apiURL.absoluteString)")
        print("🔗 iOS: Masked Token: \(maskedToken)")
        
        // Create the request with proper headers
        var request = URLRequest(url: apiURL)
        request.httpMethod = "POST"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.setValue("ios-app/1.0", forHTTPHeaderField: "User-Agent")
        request.timeoutInterval = 30.0
        
        // Create the payload
        let payload: [String: Any] = [
            "deviceToken": pendingToken.token,
            "userId": pendingToken.userId,
            "platform": "ios",
            "source": "direct_ios_api_v2",
            "timestamp": ISO8601DateFormatter().string(from: pendingToken.timestamp),
            "attemptCount": pendingToken.attemptCount + 1
        ]
        
        do {
            request.httpBody = try JSONSerialization.data(withJSONObject: payload, options: [])
            print("🔗 iOS: Request payload created successfully")
            
            // Make the API call
            let task = URLSession.shared.dataTask(with: request) { [weak self] data, response, error in
                DispatchQueue.main.async {
                    self?.handleTokenRegistrationResponse(
                        data: data,
                        response: response,
                        error: error,
                        maskedToken: maskedToken,
                        completion: completion
                    )
                }
            }
            
            task.resume()
            print("🔗 iOS: Token registration request sent at \(Date())")
            
        } catch {
            print("🚨 iOS: Failed to create request body: \(error.localizedDescription)")
            completion(false)
        }
    }
    
    private func handleTokenRegistrationResponse(
        data: Data?,
        response: URLResponse?,
        error: Error?,
        maskedToken: String,
        completion: @escaping (Bool) -> Void
    ) {
        // Handle network errors
        if let error = error {
            print("🚨 iOS: Network error during token registration: \(error.localizedDescription)")
            
            // Check if it's a network connectivity issue
            if (error as NSError).domain == NSURLErrorDomain {
                switch (error as NSError).code {
                case NSURLErrorNotConnectedToInternet, NSURLErrorNetworkConnectionLost:
                    print("🌐 iOS: Network connectivity issue - will retry when network is available")
                case NSURLErrorTimedOut:
                    print("🕒 iOS: Request timed out - will retry later")
                default:
                    print("🚨 iOS: Other network error: \(error.localizedDescription)")
                }
            }
            
            completion(false)
            return
        }
        
        guard let httpResponse = response as? HTTPURLResponse else {
            print("🚨 iOS: Invalid response type")
            completion(false)
            return
        }
        
        print("📡 iOS: Response received from server")
        print("📡 iOS: Status code: \(httpResponse.statusCode)")
        print("📡 iOS: Response headers: \(httpResponse.allHeaderFields)")
        
        // Handle response data
        var responseString = ""
        if let data = data {
            responseString = String(data: data, encoding: .utf8) ?? "Unable to decode response"
            print("📡 iOS: Response body: \(responseString)")
        }
        
        // Check for successful registration
        if httpResponse.statusCode >= 200 && httpResponse.statusCode < 300 {
            print("🎉 iOS: ✅ SUCCESS - Token registered with server!")
            print("🎉 iOS: Masked Token: \(maskedToken)")
            print("🎉 iOS: ✅ Direct API call bypassed JavaScript bridge successfully!")
            completion(true)
        } else {
            print("🚨 iOS: ❌ Server error - Status \(httpResponse.statusCode)")
            print("🚨 iOS: Error response: \(responseString)")
            
            // Handle specific error codes
            switch httpResponse.statusCode {
            case 400:
                print("🚨 iOS: Bad request - check payload format")
            case 401:
                print("🚨 iOS: Unauthorized - check API authentication")
            case 403:
                print("🚨 iOS: Forbidden - API key or permissions issue")
            case 404:
                print("🚨 iOS: API endpoint not found")
            case 500...599:
                print("🚨 iOS: Server error - will retry later")
            default:
                print("🚨 iOS: Unexpected error code: \(httpResponse.statusCode)")
            }
            
            completion(false)
        }
    }
    
    // MARK: - Helper Methods
    
    private func getAPIBaseURL() -> String? {
        guard let path = Bundle.main.path(forResource: "Info", ofType: "plist"),
              let plist = NSDictionary(contentsOfFile: path),
              let apiBaseURL = plist["API_BASE_URL"] as? String else {
            print("🚨 iOS: API_BASE_URL not found in Info.plist")
            return nil
        }
        
        print("🔗 iOS: Using API Base URL from Info.plist: \(apiBaseURL)")
        return apiBaseURL
    }
    
    private func maskToken(_ token: String) -> String {
        guard token.count > 8 else {
            return "***"
        }
        
        let prefixLength = min(4, token.count / 4)
        let suffixLength = min(4, token.count / 4)
        let prefix = String(token.prefix(prefixLength))
        let suffix = String(token.suffix(suffixLength))
        let maskedMiddle = String(repeating: "*", count: max(8, token.count - prefixLength - suffixLength))
        
        return "\(prefix)\(maskedMiddle)\(suffix)"
    }
}

// MARK: - UNUserNotificationCenterDelegate

extension AppDelegate: UNUserNotificationCenterDelegate {
    
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