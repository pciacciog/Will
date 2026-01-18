import { useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Users, User, ArrowRight, Sparkles, Settings, LogOut } from "lucide-react";
import SplashScreen from "@/components/SplashScreen";
import AccountSettingsModal from "@/components/AccountSettingsModal";
import { queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { getApiPath } from "@/config/api";

export default function Home() {
  const [, setLocation] = useLocation();
  const [showSplash, setShowSplash] = useState(false);
  const [showAccountSettings, setShowAccountSettings] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    const shouldShowSplash = localStorage.getItem('showSplashOnHome');
    if (shouldShowSplash === 'true') {
      localStorage.removeItem('showSplashOnHome');
      setShowSplash(true);
    }
  }, []);

  const [isLoggingOut, setIsLoggingOut] = useState(false);

  const handleLogout = async () => {
    setIsLoggingOut(true);
    try {
      // Clear any pending device token so it doesn't link to next user
      const pendingToken = localStorage.getItem('pendingDeviceToken');
      if (pendingToken) {
        localStorage.removeItem('pendingDeviceToken');
      }
      
      // Clear persisted session
      const { sessionPersistence } = await import('@/services/SessionPersistence');
      await sessionPersistence.clearSession();
      
      // Clear query cache
      queryClient.clear();
      
      // Call logout endpoint
      await fetch(getApiPath('/api/logout'), { 
        method: 'POST',
        headers: {
          'X-Requested-With': 'XMLHttpRequest',
        }
      });
      
      // Full page reload to auth page
      window.location.href = '/auth';
    } catch (error) {
      console.error('Logout failed:', error);
      setIsLoggingOut(false);
      toast({
        title: "Error",
        description: "Failed to sign out. Please try again.",
        variant: "destructive",
      });
    }
  };
  
  const { data: user, isLoading: userLoading } = useQuery({
    queryKey: ['/api/user'],
  });

  const handleSoloMode = () => {
    setLocation('/solo/hub');
  };

  const handleCircleMode = () => {
    // Always go to My Circles lobby - users can have multiple circles now
    setLocation('/circles');
  };

  if (showSplash) {
    return <SplashScreen onComplete={() => setShowSplash(false)} />;
  }

  if (userLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen pt-[calc(env(safe-area-inset-top)+1.5rem)] pb-[calc(env(safe-area-inset-bottom)+1.5rem)]">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
          <div className="text-center mb-12">
            <h1 className="text-4xl font-bold text-gray-900 mb-4">Welcome</h1>
            <p className="text-gray-600 mb-8">Please log in to access your accountability journey.</p>
            <Button onClick={() => setLocation('/auth')} className="bg-primary hover:bg-blue-600">
              Sign In
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-emerald-50/30">
      <div className="pt-[calc(env(safe-area-inset-top)+2rem)] pb-[calc(env(safe-area-inset-bottom)+2rem)] min-h-screen flex flex-col">
        <div className="max-w-sm mx-auto px-5 flex-1 flex flex-col justify-center">
          
          {/* Header - Enhanced with stronger glow and better spacing */}
          <div className="text-center mb-10">
            <div className="inline-flex items-center justify-center mb-5">
              <div className="relative">
                {/* Outer glow ring - stronger and more visible */}
                <div className="absolute -inset-2 bg-gradient-to-r from-emerald-400 via-teal-400 to-emerald-500 rounded-full blur-2xl opacity-40 animate-pulse"></div>
                {/* Inner glow layer */}
                <div className="absolute inset-0 bg-gradient-to-r from-emerald-400 to-teal-500 rounded-full blur-lg opacity-25"></div>
                <div className="relative w-16 h-16 bg-gradient-to-br from-emerald-50 to-teal-50 rounded-full border-2 border-emerald-200 flex items-center justify-center shadow-xl">
                  <Sparkles className="w-8 h-8 text-emerald-600" />
                </div>
              </div>
            </div>
            <h1 className="text-2xl font-semibold text-gray-900 mb-3">
              Start Your Journey
            </h1>
            <p className="text-gray-500 text-sm">
              Choose your accountability path
            </p>
          </div>

          {/* Mode Selection Cards */}
          <div className="space-y-4">
            
            {/* Circle Mode Card - Enhanced contrast and tappable feel */}
            <button
              onClick={handleCircleMode}
              className="w-full text-left group"
              data-testid="button-circle-mode"
            >
              <div className="relative">
                {/* Glow effect: visible baseline (opacity-10) → emphasized on hover (opacity-30) */}
                <div className="absolute -inset-1 bg-gradient-to-r from-emerald-400 to-teal-500 rounded-2xl blur opacity-10 group-hover:opacity-30 transition-opacity duration-300"></div>
                <Card className="relative bg-white border-2 border-emerald-200 shadow-sm group-hover:border-emerald-400 rounded-2xl overflow-hidden transition-all duration-300 group-hover:shadow-xl group-hover:-translate-y-0.5">
                  <CardContent className="p-5">
                    <div className="flex items-start space-x-4">
                      {/* Icon */}
                      <div className="relative flex-shrink-0">
                        <div className="w-14 h-14 bg-gradient-to-br from-emerald-50 to-teal-50 rounded-xl border border-emerald-200 flex items-center justify-center shadow-sm group-hover:shadow-md transition-shadow">
                          <Users className="w-7 h-7 text-emerald-600" strokeWidth={1.5} />
                        </div>
                      </div>
                      
                      {/* Content */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between">
                          <h3 className="text-lg font-semibold text-gray-900">Circle Mode</h3>
                          <ArrowRight className="w-5 h-5 text-gray-400 group-hover:text-emerald-500 group-hover:translate-x-1 transition-all" />
                        </div>
                        {/* Tagline - italic with emphasized power word */}
                        <p className="text-emerald-600/90 text-sm font-medium italic mt-0.5 tracking-tight">
                          "Become more… <span className="text-emerald-700 font-semibold">together</span>."
                        </p>
                        {/* Unified description */}
                        <p className="text-gray-500 text-sm mt-2 leading-relaxed">
                          Shared accountability with the people you trust.
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </button>

            {/* Solo Mode Card - Enhanced contrast and tappable feel */}
            <button
              onClick={handleSoloMode}
              className="w-full text-left group"
              data-testid="button-solo-mode"
            >
              <div className="relative">
                {/* Glow effect: visible baseline (opacity-10) → emphasized on hover (opacity-30) */}
                <div className="absolute -inset-1 bg-gradient-to-r from-purple-400 to-indigo-500 rounded-2xl blur opacity-10 group-hover:opacity-30 transition-opacity duration-300"></div>
                <Card className="relative bg-white border-2 border-purple-200 shadow-sm group-hover:border-purple-400 rounded-2xl overflow-hidden transition-all duration-300 group-hover:shadow-xl group-hover:-translate-y-0.5">
                  <CardContent className="p-5">
                    <div className="flex items-start space-x-4">
                      {/* Icon */}
                      <div className="relative flex-shrink-0">
                        <div className="w-14 h-14 bg-gradient-to-br from-purple-50 to-indigo-50 rounded-xl border border-purple-200 flex items-center justify-center shadow-sm group-hover:shadow-md transition-shadow">
                          <User className="w-7 h-7 text-purple-600" strokeWidth={1.5} />
                        </div>
                      </div>
                      
                      {/* Content */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between">
                          <h3 className="text-lg font-semibold text-gray-900">Solo Mode</h3>
                          <ArrowRight className="w-5 h-5 text-gray-400 group-hover:text-purple-500 group-hover:translate-x-1 transition-all" />
                        </div>
                        {/* Tagline - italic with emphasized power word */}
                        <p className="text-purple-600/90 text-sm font-medium italic mt-0.5 tracking-tight">
                          "No one is watching… but <span className="text-purple-700 font-semibold">you</span>."
                        </p>
                        {/* Unified description */}
                        <p className="text-gray-500 text-sm mt-2 leading-relaxed">
                          Personal accountability for your own goals.
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </button>

          </div>

          {/* Account Actions - Settings & Sign Out */}
          <div className="mt-8 pt-6 border-t border-gray-200">
            <div className="flex items-center justify-center gap-6">
              {/* Settings Button */}
              <button
                onClick={() => setShowAccountSettings(true)}
                className="flex items-center gap-2 text-gray-500 hover:text-gray-700 transition-colors duration-200 px-3 py-2 rounded-lg hover:bg-gray-100"
                data-testid="button-settings"
              >
                <Settings className="w-5 h-5" />
                <span className="text-sm font-medium">Settings</span>
              </button>
              
              {/* Divider */}
              <div className="h-5 w-px bg-gray-300"></div>
              
              {/* Sign Out Button */}
              <button
                onClick={handleLogout}
                disabled={isLoggingOut}
                className="flex items-center gap-2 text-gray-500 hover:text-gray-700 transition-colors duration-200 px-3 py-2 rounded-lg hover:bg-gray-100 disabled:opacity-50"
                data-testid="button-sign-out"
              >
                <LogOut className="w-5 h-5" />
                <span className="text-sm font-medium">
                  {isLoggingOut ? "Signing out..." : "Sign Out"}
                </span>
              </button>
            </div>
          </div>

        </div>
      </div>

      {/* Account Settings Modal */}
      <AccountSettingsModal
        isOpen={showAccountSettings}
        onClose={() => setShowAccountSettings(false)}
      />
    </div>
  );
}
