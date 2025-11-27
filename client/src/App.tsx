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
import Landing from "@/pages/Landing";
import Auth from "@/pages/Auth";
import Home from "@/pages/Home";
import InnerCircle from "@/pages/InnerCircle";
import InnerCircleHub from "@/pages/InnerCircleHub";
import SoloHub from "@/pages/SoloHub";
import StartWill from "@/pages/StartWill";
import WillDetails from "@/pages/WillDetails";
import SubmitCommitment from "@/pages/SubmitCommitment";
import EditWill from "@/pages/EditWill";
import EditCommitment from "@/pages/EditCommitment";
import AdminDashboard from "@/pages/AdminDashboard";
import Admin from "@/pages/Admin";
import NotificationTest from "@/pages/NotificationTest";
import IconGenerator from "@/pages/IconGenerator";

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

function Router() {
  const { isAuthenticated, isLoading, user } = useAuth();
  const [location] = useLocation();
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
  }, []);

  // JWT tokens are now saved directly in login/register handlers
  // No need to save session here anymore

  // Initialize notifications AFTER authentication
  useEffect(() => {
    if (isAuthenticated && user) {
      console.log('User authenticated - initializing push notifications');
      notificationService.initialize().catch(console.error);
      // 🔥 DISABLED: Server now handles token association automatically during login
      // No need for frontend to also attempt token registration - this was causing conflicts
      console.log('✅ User authenticated - server handles token association automatically');
    }
  }, [isAuthenticated, user]);

  // APP LIFECYCLE: Monitor app state changes to detect background/foreground transitions
  useEffect(() => {
    let isMounted = true;
    let listenerHandle: any = null;
    let lastStateChangeTime = Date.now();
    let appLaunchTime = Date.now();

    const clearBadge = async () => {
      try {
        await PushNotifications.setBadgeCount({ count: 0 });
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
        
        {!isAuthenticated ? (
          <>
            <Route path="/" component={Landing} />
            <Route path="/auth" component={Auth} />
          </>
        ) : (
          <>
            <Route path="/" component={Home} />
            <Route path="/inner-circle" component={InnerCircle} />
            <Route path="/hub" component={InnerCircleHub} />
            <Route path="/solo/hub" component={SoloHub} />
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
