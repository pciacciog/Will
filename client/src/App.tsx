import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { useAuth } from "@/hooks/useAuth";
import { useEffect, useState } from "react";
import { notificationService } from "@/services/NotificationService";
import { sessionPersistence } from "@/services/SessionPersistence";
import { useLocation } from "wouter";
import { logBridge } from "@/lib/logBridge";
import { getApiUrl } from "@/config/api";
import { App as CapacitorApp } from '@capacitor/app';
import { PushNotifications } from '@capacitor/push-notifications';
import NotFound from "@/pages/not-found";
import Auth from "@/pages/Auth";
import Home from "@/pages/Home";
import InnerCircle from "@/pages/InnerCircle";
import InnerCircleHub from "@/pages/InnerCircleHub";
import Explore from "@/pages/Explore";
import JoinWill from "@/pages/JoinWill";
import WillHistory from "@/pages/WillHistory";
import StartWill from "@/pages/StartWill";
import WillDetails from "@/pages/WillDetails";
import SubmitCommitment from "@/pages/SubmitCommitment";
import EditWill from "@/pages/EditWill";
import EditCommitment from "@/pages/EditCommitment";
import AdminDashboard from "@/pages/AdminDashboard";
import Admin from "@/pages/Admin";
import NotificationTest from "@/pages/NotificationTest";
import IconGenerator from "@/pages/IconGenerator";
import CircleLobby from "@/pages/CircleLobby";
import ForgotPassword from "@/pages/ForgotPassword";
import ResetPassword from "@/pages/ResetPassword";
import MyWills from "@/pages/MyWills";

// Global debug helper for easy access
(window as any).getNotificationDebugInfo = () => {
  return notificationService.getDebugInfo();
};

// Log debug info every 10 seconds during development
if (import.meta.env.DEV) {
  setInterval(() => {
    console.log('🔍 PERIODIC DEBUG:', notificationService.getDebugInfo());
  }, 10000);
}

function LegacyHubRedirect() {
  const [, setLocation] = useLocation();
  useEffect(() => {
    setLocation('/circles');
  }, [setLocation]);
  return null;
}

function Router() {
  const { isAuthenticated, isLoading, user } = useAuth();
  const [location, setLocation] = useLocation();
  const [sessionRestored, setSessionRestored] = useState(false);

  // Debug logging
  console.log('Router debug:', { isAuthenticated, isLoading, user: user?.id, location });

  // Initialize API URL detection and log bridge immediately (works without authentication)
  useEffect(() => {
    const initializeApp = async () => {
      // Warm up the API URL cache by detecting environment
      const apiUrl = await getApiUrl();
      console.log('🌐 [App] API URL initialized:', apiUrl || '(relative URLs)');
      
      // Initialize log bridge
      logBridge.initialize();
    };
    
    initializeApp();
  }, []);

  // ISSUE #1 FIX: Restore session on app launch (runs once)
  useEffect(() => {
    const restoreSession = async () => {
      console.log('╔════════════════════════════════════════════════════════════╗');
      console.log('║ APP LAUNCH - SESSION RESTORATION                           ║');
      console.log('╚════════════════════════════════════════════════════════════╝');
      console.log('[App] 🚀 App launched at:', new Date().toISOString());
      console.log('[App] 🔄 Starting session restoration...');
      
      const startTime = Date.now();
      const restored = await sessionPersistence.restoreSession();
      const durationMs = Date.now() - startTime;
      
      setSessionRestored(true);
      
      console.log('[App] 📊 Session restoration completed in', durationMs, 'ms');
      
      if (restored) {
        console.log('[App] ✅ SESSION RESTORED SUCCESSFULLY');
        console.log('[App] ✅ User should remain logged in');
        console.log('[App] 🔄 Invalidating /api/user query to fetch fresh data...');
        // Force re-fetch user data with restored session
        queryClient.invalidateQueries({ queryKey: ['/api/user'] });
      } else {
        console.log('[App] ❌ SESSION NOT RESTORED');
        console.log('[App] ❌ User will be shown login screen');
      }
      console.log('════════════════════════════════════════════════════════════');
    };
    restoreSession();
    
    // BUG FIX: Always register with APNs on every app launch
    // This ensures push notifications work after app updates, even if user stays logged in
    console.log('[App] 🔔 Ensuring APNs registration on app launch...');
    notificationService.ensureApnsRegistration().catch((err) => {
      console.error('[App] ❌ APNs registration error:', err);
    });
  }, []);

  // JWT tokens are now saved directly in login/register handlers
  // No need to save session here anymore

  // Initialize notifications and refresh data AFTER authentication
  useEffect(() => {
    if (isAuthenticated && user) {
      console.log('User authenticated - initializing push notifications');
      notificationService.initialize().catch(console.error);
      console.log('✅ User authenticated - server handles token association automatically');
      
      console.log('[App] 🔄 Auth state changed to authenticated - invalidating wills queries');
      queryClient.invalidateQueries({ queryKey: ['/api/wills/all-active'] });
      queryClient.invalidateQueries({ queryKey: ['/api/wills/personal'] });
    }
  }, [isAuthenticated, user]);

  // DEEP LINK HANDLER: Handle push notification taps and navigate to the deep link
  useEffect(() => {
    let isMounted = true;
    let actionListenerHandle: any = null;
    let receivedListenerHandle: any = null;

    const setupDeepLinkHandlers = async () => {
      console.log('🔗 [DeepLink] Setting up push notification tap handlers...');

      // Handler for when user taps on a notification
      const actionHandle = await PushNotifications.addListener('pushNotificationActionPerformed', (notification) => {
        console.log('🔗 [DeepLink] ══════════════════════════════════════════');
        console.log('🔗 [DeepLink] PUSH NOTIFICATION TAPPED');
        console.log('🔗 [DeepLink] ══════════════════════════════════════════');
        console.log('🔗 [DeepLink] Full notification:', JSON.stringify(notification, null, 2));
        
        const data = notification.notification?.data;
        console.log('🔗 [DeepLink] Notification data:', JSON.stringify(data, null, 2));
        
        if (data?.deepLink && isMounted) {
          console.log('🔗 [DeepLink] Deep link found:', data.deepLink);
          
          // Map deep link paths to valid routes
          let targetPath = data.deepLink;
          
          // Handle /will/:id/review -> /will/:id (review is shown on will details page)
          // The WillDetails component shows the review UI based on Will status
          if (targetPath.includes('/review')) {
            targetPath = targetPath.replace('/review', '');
            console.log('🔗 [DeepLink] Mapped review link to:', targetPath);
          }
          
          // Handle /will/:id/commit -> /will/:id/commit (valid route)
          // Handle /circle/:id -> /hub (circle view is in hub)
          if (targetPath.startsWith('/circle/')) {
            targetPath = '/hub';
            console.log('🔗 [DeepLink] Mapped circle link to:', targetPath);
          }
          
          console.log('🔗 [DeepLink] Navigating to:', targetPath);
          setLocation(targetPath);
        } else {
          console.log('🔗 [DeepLink] No deep link in notification data, using fallback navigation');
          // Fallback navigation based on notification type and mode
          const type = data?.type;
          const isSoloMode = data?.isSoloMode === 'true';
          const willId = data?.willId;
          
          console.log('🔗 [DeepLink] Fallback info:', { type, isSoloMode, willId });
          
          // If we have a willId, navigate to the will details
          if (willId && isMounted) {
            setLocation(`/will/${willId}`);
          } else if (type === 'daily_reminder' || type === 'will_midpoint') {
            // Solo mode notifications without willId go to solo hub
            setLocation(isSoloMode ? '/solo/hub' : '/hub');
          } else if (type === 'will_started') {
            // Will started - use isSoloMode to determine destination
            setLocation(isSoloMode ? '/solo/hub' : '/hub');
          } else if (type === 'end_room_now' || type === 'end_room_15_minutes' || type === 'end_room_24_hours') {
            // End room notifications are circle-only
            setLocation('/hub');
          } else if (type === 'will_proposed' || type === 'circle_member_joined') {
            // Circle-only notifications
            setLocation('/hub');
          } else {
            // Default fallback
            setLocation('/');
          }
        }
      });

      // Handler for when notification is received while app is in foreground
      const receivedHandle = await PushNotifications.addListener('pushNotificationReceived', (notification) => {
        console.log('🔔 [DeepLink] Push notification received in foreground:', JSON.stringify(notification, null, 2));
        // Notification received but not tapped - no navigation needed
      });

      if (isMounted) {
        actionListenerHandle = actionHandle;
        receivedListenerHandle = receivedHandle;
        console.log('🔗 [DeepLink] ✅ Deep link handlers registered successfully');
      } else {
        actionHandle.remove();
        receivedHandle.remove();
      }
    };

    setupDeepLinkHandlers();

    return () => {
      isMounted = false;
      console.log('🔗 [DeepLink] Cleaning up deep link handlers');
      if (actionListenerHandle) actionListenerHandle.remove();
      if (receivedListenerHandle) receivedListenerHandle.remove();
    };
  }, [setLocation]);

  // APP LIFECYCLE: Monitor app state changes to detect background/foreground transitions
  useEffect(() => {
    let isMounted = true;
    let listenerHandle: any = null;
    let lastStateChangeTime = Date.now();
    let appLaunchTime = Date.now();

    const clearBadge = async () => {
      try {
        await (PushNotifications as any).setBadgeCount({ count: 0 });
        console.log('🔔 [App] Badge cleared to 0');
      } catch (error) {
        console.log('⚠️ [App] Badge clearing not available (web or permissions not granted):', error);
      }
    };

    console.log('╔════════════════════════════════════════════════════════════╗');
    console.log('║ APP LIFECYCLE MONITOR INITIALIZED                          ║');
    console.log('╚════════════════════════════════════════════════════════════╝');
    console.log(`📱 [App] App launch timestamp: ${new Date(appLaunchTime).toISOString()}`);
    console.log(`📱 [App] Setting up app state change listener...`);
    console.log('════════════════════════════════════════════════════════════');

    // Clear badge immediately on mount
    clearBadge();

    // Listen for app state changes (when app comes to foreground/background)
    const setupListener = async () => {
      const handle = await CapacitorApp.addListener('appStateChange', async (state) => {
        const now = Date.now();
        const timeSinceLastChange = Math.round((now - lastStateChangeTime) / 1000);
        const timeSinceLaunch = Math.round((now - appLaunchTime) / 1000);
        lastStateChangeTime = now;
        
        console.log('╔════════════════════════════════════════════════════════════╗');
        console.log('║ APP STATE CHANGED                                          ║');
        console.log('╚════════════════════════════════════════════════════════════╝');
        console.log(`📱 [App] New state: ${state.isActive ? '🟢 ACTIVE (Foreground)' : '🔴 INACTIVE (Background)'}`);
        console.log(`📱 [App] Change timestamp: ${new Date().toISOString()}`);
        console.log(`📱 [App] Time since last change: ${timeSinceLastChange} seconds`);
        console.log(`📱 [App] Time since app launch: ${timeSinceLaunch} seconds`);
        
        if (state.isActive) {
          console.log('🔄 [App] App RETURNING TO FOREGROUND');
          console.log('🔄 [App] This is when storage might have been cleared!');
          console.log('🔄 [App] Clearing badge...');
          clearBadge();
          
          // 🔥 CRITICAL: Check if token still exists after coming back from background
          console.log('🔍 [App] Checking if auth token survived background...');
          const token = await sessionPersistence.getToken();
          if (token) {
            console.log('✅ [App] Token SURVIVED background period');
            console.log(`✅ [App] Token preview: ${token.substring(0, 20)}...`);
          } else {
            console.log('❌ [App] TOKEN LOST DURING BACKGROUND!');
            console.log('❌ [App] This is the BUG - storage was cleared!');
            console.log(`❌ [App] Background duration: ${timeSinceLastChange} seconds (~${Math.round(timeSinceLastChange/60)} minutes)`);
          }
        } else {
          console.log('🔽 [App] App GOING TO BACKGROUND');
          console.log('🔽 [App] iOS may clear storage if backgrounded long enough');
          console.log('🔽 [App] Current auth token will be verified on return');
        }
        console.log('════════════════════════════════════════════════════════════');
      });
      
      console.log('✅ [App] App state change listener registered successfully');
      
      // Only store handle if component is still mounted
      if (isMounted) {
        listenerHandle = handle;
      } else {
        // Component unmounted while we were waiting - clean up immediately
        handle.remove();
      }
    };
    
    setupListener();

    return () => {
      isMounted = false;
      console.log('🔚 [App] App lifecycle monitor cleanup');
      if (listenerHandle) {
        listenerHandle.remove();
      }
    };
  }, []);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Switch>
        {/* Routes available without authentication */}
        <Route path="/notification-test" component={NotificationTest} />
        <Route path="/icon-generator" component={IconGenerator} />
        
        {/* Password reset routes - always accessible */}
        <Route path="/forgot-password" component={ForgotPassword} />
        <Route path="/reset-password" component={ResetPassword} />
        
        {!isAuthenticated ? (
          <>
            <Route path="/" component={Auth} />
            <Route path="/auth" component={Auth} />
          </>
        ) : (
          <>
            <Route path="/" component={Home} />
            <Route path="/inner-circle" component={InnerCircle} />
            <Route path="/circles" component={CircleLobby} />
            <Route path="/circles/:circleId">{(params) => <InnerCircleHub circleId={parseInt(params.circleId)} />}</Route>
            <Route path="/hub" component={LegacyHubRedirect} />
            <Route path="/solo/hub" component={Home} />
            <Route path="/wills" component={MyWills} />
            <Route path="/create-will">{() => <StartWill isSoloMode={true} />}</Route>
            <Route path="/explore" component={Explore} />
            <Route path="/explore/join/:willId" component={JoinWill} />
            <Route path="/solo/history">{() => <WillHistory mode="solo" />}</Route>
            <Route path="/personal/history">{() => <WillHistory mode="solo" />}</Route>
            <Route path="/circle/history">{() => <WillHistory mode="circle" />}</Route>
            <Route path="/public/history">{() => <WillHistory mode="public" />}</Route>
            <Route path="/circles/:circleId/start-will">{(params) => <StartWill circleId={parseInt(params.circleId)} />}</Route>
            <Route path="/start-will">{() => <StartWill />}</Route>
            <Route path="/solo/start-will">{() => <StartWill isSoloMode={true} />}</Route>
            <Route path="/will/:id" component={WillDetails} />
            <Route path="/will/:id/commit" component={SubmitCommitment} />
            <Route path="/will/:id/edit" component={EditWill} />
            <Route path="/will/:id/edit-commitment/:commitmentId" component={EditCommitment} />
            <Route path="/admin" component={Admin} />
            <Route path="/webadmin" component={AdminDashboard} />
          </>
        )}
        <Route component={NotFound} />
      </Switch>
    </div>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Router />
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
