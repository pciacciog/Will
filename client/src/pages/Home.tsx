import { useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Users, Compass, ArrowRight, Sparkles, Settings, LogOut, Plus, Target, ChevronRight } from "lucide-react";
import SplashScreen from "@/components/SplashScreen";
import AccountSettingsModal from "@/components/AccountSettingsModal";
import { queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { getApiPath } from "@/config/api";

type Will = {
  id: number;
  mode: string;
  visibility: string;
  status: string;
  startDate: string;
  endDate: string;
  commitments?: { id: number; userId: string; what: string; why: string }[];
};

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
      const pendingToken = localStorage.getItem('pendingDeviceToken');
      if (pendingToken) {
        localStorage.removeItem('pendingDeviceToken');
      }
      
      const { sessionPersistence } = await import('@/services/SessionPersistence');
      await sessionPersistence.clearSession();
      
      queryClient.clear();
      
      await fetch(getApiPath('/api/logout'), { 
        method: 'POST',
        headers: {
          'X-Requested-With': 'XMLHttpRequest',
        }
      });
      
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
  
  const { data: user, isLoading: userLoading } = useQuery<{ firstName?: string; id: string } | null>({
    queryKey: ['/api/user'],
  });

  const { data: personalWills } = useQuery<Will[]>({
    queryKey: ['/api/wills/personal'],
    enabled: !!user,
    staleTime: 0,
    refetchOnMount: 'always',
  });

  const activePersonalWills = personalWills?.filter(w => 
    w.status === 'active' || w.status === 'will_review' || w.status === 'scheduled' || w.status === 'pending'
  ) || [];

  const handleCreateWill = () => {
    setLocation('/create-will');
  };

  const handleExplore = () => {
    setLocation('/explore');
  };

  const handleCircles = () => {
    setLocation('/circles');
  };

  const handleViewWill = (willId: number) => {
    setLocation(`/will/${willId}`);
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
        <div className="max-w-sm mx-auto px-5 flex-1 flex flex-col">
          
          {/* Header */}
          <div className="text-center mb-6">
            <div className="inline-flex items-center justify-center mb-4">
              <div className="relative">
                <div className="absolute -inset-2 bg-gradient-to-r from-emerald-400 via-teal-400 to-emerald-500 rounded-full blur-2xl opacity-40 animate-pulse"></div>
                <div className="absolute inset-0 bg-gradient-to-r from-emerald-400 to-teal-500 rounded-full blur-lg opacity-25"></div>
                <div className="relative w-14 h-14 bg-gradient-to-br from-emerald-50 to-teal-50 rounded-full border-2 border-emerald-200 flex items-center justify-center shadow-xl">
                  <Sparkles className="w-7 h-7 text-emerald-600" />
                </div>
              </div>
            </div>
            <h1 className="text-2xl font-semibold text-gray-900 mb-1">
              Welcome back{user?.firstName ? `, ${user.firstName}` : ''}
            </h1>
            <p className="text-gray-500 text-sm">
              What will you commit to?
            </p>
          </div>

          {/* Hero: Create Will Button */}
          <button
            onClick={handleCreateWill}
            className="w-full mb-6 group"
            data-testid="button-create-will"
          >
            <div className="relative">
              <div className="absolute -inset-1 bg-gradient-to-r from-emerald-500 to-teal-500 rounded-2xl blur opacity-30 group-hover:opacity-50 transition-opacity duration-300"></div>
              <div className="relative bg-gradient-to-r from-emerald-500 to-teal-500 rounded-2xl p-5 shadow-lg group-hover:shadow-xl transition-all duration-300 group-hover:-translate-y-0.5">
                <div className="flex items-center justify-center gap-3 text-white">
                  <div className="w-12 h-12 bg-white/20 rounded-xl flex items-center justify-center">
                    <Plus className="w-7 h-7" strokeWidth={2.5} />
                  </div>
                  <div className="text-left">
                    <h2 className="text-lg font-semibold">Create a Will</h2>
                    <p className="text-emerald-100 text-sm">Make a commitment today</p>
                  </div>
                  <ArrowRight className="w-6 h-6 ml-auto group-hover:translate-x-1 transition-transform" />
                </div>
              </div>
            </div>
          </button>

          {/* Active Personal Wills */}
          {activePersonalWills.length > 0 && (
            <div className="mb-6">
              <h3 className="text-sm font-medium text-gray-500 uppercase tracking-wide mb-3">Your Active Wills</h3>
              <div className="space-y-3">
                {activePersonalWills.map((will) => {
                  const commitment = will.commitments?.[0];
                  const statusColors: Record<string, string> = {
                    active: 'bg-emerald-100 text-emerald-700',
                    will_review: 'bg-amber-100 text-amber-700',
                    scheduled: 'bg-blue-100 text-blue-700',
                    pending: 'bg-gray-100 text-gray-700',
                  };
                  
                  return (
                    <button
                      key={will.id}
                      onClick={() => handleViewWill(will.id)}
                      className="w-full text-left group"
                      data-testid={`card-will-${will.id}`}
                    >
                      <Card className="bg-white border border-gray-200 shadow-sm group-hover:border-emerald-300 group-hover:shadow-md transition-all duration-200">
                        <CardContent className="p-4">
                          <div className="flex items-start gap-3">
                            <div className="w-10 h-10 bg-emerald-50 rounded-lg flex items-center justify-center flex-shrink-0">
                              <Target className="w-5 h-5 text-emerald-600" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium text-gray-900 truncate">
                                {commitment?.what || 'Untitled commitment'}
                              </p>
                              <div className="flex items-center gap-2 mt-1">
                                <Badge className={`text-xs ${statusColors[will.status] || 'bg-gray-100 text-gray-700'}`}>
                                  {will.status === 'will_review' ? 'Review' : will.status}
                                </Badge>
                                {will.visibility === 'public' && (
                                  <Badge className="text-xs bg-blue-100 text-blue-700">Public</Badge>
                                )}
                              </div>
                            </div>
                            <ChevronRight className="w-5 h-5 text-gray-400 group-hover:text-emerald-500 flex-shrink-0" />
                          </div>
                        </CardContent>
                      </Card>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Secondary Actions: Explore & Circles */}
          <div className="grid grid-cols-2 gap-3 mb-6">
            {/* Explore Card */}
            <button
              onClick={handleExplore}
              className="text-left group"
              data-testid="button-explore"
            >
              <Card className="h-full bg-white border-2 border-blue-100 shadow-sm group-hover:border-blue-300 group-hover:shadow-md transition-all duration-200">
                <CardContent className="p-4">
                  <div className="w-10 h-10 bg-blue-50 rounded-lg flex items-center justify-center mb-3">
                    <Compass className="w-5 h-5 text-blue-600" />
                  </div>
                  <h3 className="text-sm font-semibold text-gray-900 mb-1">Explore</h3>
                  <p className="text-xs text-gray-500">Discover public commitments</p>
                </CardContent>
              </Card>
            </button>

            {/* Circles Card */}
            <button
              onClick={handleCircles}
              className="text-left group"
              data-testid="button-circles"
            >
              <Card className="h-full bg-white border-2 border-purple-100 shadow-sm group-hover:border-purple-300 group-hover:shadow-md transition-all duration-200">
                <CardContent className="p-4">
                  <div className="w-10 h-10 bg-purple-50 rounded-lg flex items-center justify-center mb-3">
                    <Users className="w-5 h-5 text-purple-600" />
                  </div>
                  <h3 className="text-sm font-semibold text-gray-900 mb-1">Circles</h3>
                  <p className="text-xs text-gray-500">Group accountability</p>
                </CardContent>
              </Card>
            </button>
          </div>

          {/* Spacer */}
          <div className="flex-1"></div>

          {/* Account Actions - Settings & Sign Out */}
          <div className="pt-4 border-t border-gray-200">
            <div className="flex items-center justify-center gap-6">
              <button
                onClick={() => setShowAccountSettings(true)}
                className="flex items-center gap-2 text-gray-500 hover:text-gray-700 transition-colors duration-200 px-3 py-2 rounded-lg hover:bg-gray-100"
                data-testid="button-settings"
              >
                <Settings className="w-5 h-5" />
                <span className="text-sm font-medium">Settings</span>
              </button>
              
              <div className="h-5 w-px bg-gray-300"></div>
              
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

      <AccountSettingsModal
        isOpen={showAccountSettings}
        onClose={() => setShowAccountSettings(false)}
      />
    </div>
  );
}
