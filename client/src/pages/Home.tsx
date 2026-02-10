import { useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { getQueryFn } from "@/lib/queryClient";
import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Users, Compass, Sparkles, Settings, LogOut, Target, ChevronRight } from "lucide-react";
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
  circleId?: number;
  circleName?: string;
  commitments?: { id: number; userId: string; what: string; why: string }[];
};

export default function Home() {
  const [, setLocation] = useLocation();
  const [showSplash, setShowSplash] = useState(false);
  const [showAccountSettings, setShowAccountSettings] = useState(false);
  const [activeCard, setActiveCard] = useState<'explore' | 'circles' | null>(null);
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
    queryFn: getQueryFn({ on401: "returnNull" }),
  });

  const { data: allActiveWills, error: activeWillsError, isError: isActiveWillsError, failureCount, isLoading: willsLoading, refetch: refetchWills } = useQuery<Will[] | null>({
    queryKey: ['/api/wills/all-active', user?.id],
    queryFn: getQueryFn({ on401: "returnNull" }),
    enabled: !!user && !!user.id,
    staleTime: 1000 * 60 * 5,
    refetchOnMount: 'always',
    refetchOnWindowFocus: true,
    refetchOnReconnect: true,
    retry: 3,
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 5000),
    refetchInterval: 30000,
  });

  useEffect(() => {
    if (user?.id) {
      console.log('[Home] 🔄 Auth state ready - triggering wills fetch for user:', user.id);
      refetchWills();
    }
  }, [user?.id, refetchWills]);

  useEffect(() => {
    console.log('[Home] Wills query state:', {
      count: allActiveWills?.length,
      isLoading: willsLoading,
      hasError: isActiveWillsError,
      failureCount,
      willIds: allActiveWills?.map(w => w.id),
      userId: user?.id,
      enabled: !!user && !!user.id,
    });
    if (isActiveWillsError) {
      console.error('[Home] Active wills query error:', activeWillsError);
    }
  }, [allActiveWills, isActiveWillsError, activeWillsError, willsLoading, failureCount, user]);

  const activeWills = allActiveWills?.filter(w => 
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

  const handleViewWill = (will: Will) => {
    sessionStorage.setItem('willBackUrl', '/');
    setLocation(`/will/${will.id}`);
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
      <div className="pt-[calc(env(safe-area-inset-top)+1rem)] pb-[calc(env(safe-area-inset-bottom)+2rem)] min-h-screen flex flex-col">
        <div className={`max-w-sm mx-auto px-5 flex-1 flex flex-col ${activeWills.length > 0 ? 'justify-start pt-8' : 'justify-center'}`} style={activeWills.length > 0 ? undefined : { paddingTop: '15vh' }}>
          
          <div className="flex flex-col items-center">
            {/* Star Icon */}
            <div className="mb-5">
              <div className="relative">
                <div className="absolute -inset-2 bg-gradient-to-r from-emerald-400 via-teal-400 to-emerald-500 rounded-full blur-2xl opacity-30"></div>
                <div className="relative w-16 h-16 bg-gradient-to-br from-emerald-50 to-teal-50 rounded-full border-2 border-emerald-200 flex items-center justify-center shadow-lg">
                  <Sparkles className="w-8 h-8 text-emerald-600" />
                </div>
              </div>
            </div>

            {/* Greeting */}
            <h1 className="text-2xl font-semibold text-gray-900 mb-1" data-testid="text-welcome">
              Welcome back{user?.firstName ? `, ${user.firstName}` : ''}
            </h1>
            <p className="text-sm text-gray-400 mb-3">What will you commit to today?</p>

            {/* Create Will Button */}
            <button
              onClick={handleCreateWill}
              className="w-full max-w-sm mb-8 group"
              data-testid="button-create-will"
            >
              <div className="bg-gradient-to-r from-emerald-600 to-teal-600 rounded-2xl px-10 py-5 shadow-lg group-hover:shadow-xl transition-all duration-200 group-active:scale-[0.98]">
                <span className="text-white text-2xl font-bold tracking-tight">Create a Will</span>
              </div>
            </button>

            {/* Active Wills (Personal + Circle) */}
            {activeWills.length > 0 && (
              <div className="w-full mb-8">
                <h3 className="text-sm font-medium text-gray-500 uppercase tracking-wide mb-3">Your Active Wills</h3>
                <div className="space-y-3">
                  {activeWills.map((will) => {
                    const commitment = will.commitments?.[0];
                    const isCircle = will.mode === 'circle';
                    const statusColors: Record<string, string> = {
                      active: 'bg-emerald-100 text-emerald-700',
                      will_review: 'bg-amber-100 text-amber-700',
                      scheduled: 'bg-blue-100 text-blue-700',
                      pending: 'bg-gray-100 text-gray-700',
                    };
                    
                    return (
                      <button
                        key={will.id}
                        onClick={() => handleViewWill(will)}
                        className="w-full text-left group"
                        data-testid={`card-will-${will.id}`}
                      >
                        <Card className={`bg-white border shadow-sm group-hover:shadow-md transition-all duration-200 ${
                          isCircle 
                            ? 'border-purple-200 group-hover:border-purple-300' 
                            : 'border-gray-200 group-hover:border-emerald-300'
                        }`}>
                          <CardContent className="p-4">
                            <div className="flex items-start gap-3">
                              <div className={`w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 ${
                                isCircle ? 'bg-purple-50' : 'bg-emerald-50'
                              }`}>
                                {isCircle 
                                  ? <Users className="w-5 h-5 text-purple-600" /> 
                                  : <Target className="w-5 h-5 text-emerald-600" />
                                }
                              </div>
                              <div className="flex-1 min-w-0">
                                <p className="text-sm font-medium text-gray-900 truncate">
                                  {commitment?.what || 'Untitled commitment'}
                                </p>
                                <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                                  <Badge className={`text-xs ${
                                    isCircle 
                                      ? 'bg-purple-100 text-purple-700' 
                                      : 'bg-emerald-100 text-emerald-700'
                                  }`}>
                                    {isCircle ? (will.circleName || 'Circle') : 'Personal'}
                                  </Badge>
                                  <Badge className={`text-xs ${statusColors[will.status] || 'bg-gray-100 text-gray-700'}`}>
                                    {will.status === 'will_review' ? 'Review' : will.status}
                                  </Badge>
                                </div>
                              </div>
                              <ChevronRight className={`w-5 h-5 flex-shrink-0 ${
                                isCircle 
                                  ? 'text-gray-400 group-hover:text-purple-500' 
                                  : 'text-gray-400 group-hover:text-emerald-500'
                              }`} />
                            </div>
                          </CardContent>
                        </Card>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Explore & Circles Cards */}
            <div className="grid grid-cols-2 gap-4 w-full mb-8">
              <button
                onClick={() => { setActiveCard('explore'); handleExplore(); }}
                onPointerDown={() => setActiveCard('explore')}
                className="group"
                data-testid="button-explore"
              >
                <div className={`h-full rounded-2xl transition-all duration-200 group-hover:-translate-y-0.5 ${
                  activeCard === 'explore'
                    ? 'bg-white border-2 border-blue-300 shadow-md shadow-blue-100/50'
                    : 'bg-white border border-gray-200 shadow-sm group-hover:shadow-md group-hover:border-blue-200'
                }`}>
                  <div className="p-5 flex flex-col items-center justify-center text-center">
                    <div className={`w-12 h-12 rounded-xl flex items-center justify-center mb-2.5 transition-colors duration-200 ${
                      activeCard === 'explore' ? 'bg-blue-100' : 'bg-blue-50'
                    }`}>
                      <Compass className={`w-5 h-5 transition-colors duration-200 ${
                        activeCard === 'explore' ? 'text-blue-600' : 'text-blue-400'
                      }`} />
                    </div>
                    <h3 className="text-sm font-semibold text-gray-900">Explore</h3>
                    <p className="text-[11px] text-gray-400 mt-0.5">Browse public Wills</p>
                  </div>
                </div>
              </button>

              <button
                onClick={() => { setActiveCard('circles'); handleCircles(); }}
                onPointerDown={() => setActiveCard('circles')}
                className="group"
                data-testid="button-circles"
              >
                <div className={`h-full rounded-2xl transition-all duration-200 group-hover:-translate-y-0.5 ${
                  activeCard === 'circles'
                    ? 'bg-white border-2 border-purple-300 shadow-md shadow-purple-100/50'
                    : 'bg-white border border-gray-200 shadow-sm group-hover:shadow-md group-hover:border-purple-200'
                }`}>
                  <div className="p-5 flex flex-col items-center justify-center text-center">
                    <div className={`w-12 h-12 rounded-xl flex items-center justify-center mb-2.5 transition-colors duration-200 ${
                      activeCard === 'circles' ? 'bg-purple-100' : 'bg-purple-50'
                    }`}>
                      <Users className={`w-5 h-5 transition-colors duration-200 ${
                        activeCard === 'circles' ? 'text-purple-600' : 'text-purple-400'
                      }`} />
                    </div>
                    <h3 className="text-sm font-semibold text-gray-900">Circles</h3>
                    <p className="text-[11px] text-gray-400 mt-0.5">Shared Accountability</p>
                  </div>
                </div>
              </button>
            </div>
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
