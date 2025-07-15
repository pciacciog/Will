import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { useAuth } from "@/hooks/useAuth";
import { useEffect, useState } from "react";
import { notificationService } from "@/services/NotificationService";
import SplashScreen from "@/components/SplashScreen";
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
function Router() {
  const { isAuthenticated, isLoading } = useAuth();
  const [showSplash, setShowSplash] = useState(true);
  const [hasShownSplash, setHasShownSplash] = useState(false);

  // Show splash screen on app load if user is authenticated
  useEffect(() => {
    if (!isLoading && isAuthenticated && !hasShownSplash) {
      setHasShownSplash(true);
      // Don't show splash immediately, allow a moment for the auth check
      setTimeout(() => {
        setShowSplash(false);
      }, 100);
    } else if (!isLoading && !isAuthenticated) {
      setShowSplash(false);
    }
  }, [isLoading, isAuthenticated, hasShownSplash]);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  // Show splash screen for authenticated users on app load
  if (isAuthenticated && showSplash) {
    return <SplashScreen onComplete={() => setShowSplash(false)} />;
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Switch>
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
  useEffect(() => {
    // Initialize notification service when app starts
    notificationService.initialize();
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Router />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
