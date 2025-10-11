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
import NotFound from "@/pages/not-found";
import Landing from "@/pages/Landing";
import Auth from "@/pages/Auth";
import Home from "@/pages/Home";
import InnerCircle from "@/pages/InnerCircle";
import InnerCircleHub from "@/pages/InnerCircleHub";
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

  // Initialize log bridge immediately (works without authentication)
  useEffect(() => {
    logBridge.initialize();
  }, []);

  // ISSUE #1 FIX: Restore session on app launch (runs once)
  useEffect(() => {
    const restoreSession = async () => {
      console.log('[App] Attempting to restore session from persistent storage...');
      const restored = await sessionPersistence.restoreSession();
      setSessionRestored(true);
      if (restored) {
        console.log('[App] ✅ Session restored - user should remain logged in');
        // Force re-fetch user data with restored session
        queryClient.invalidateQueries({ queryKey: ['/api/user'] });
      }
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
            <Route path="/start-will" component={StartWill} />
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
