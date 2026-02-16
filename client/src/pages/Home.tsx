import { useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { getQueryFn } from "@/lib/queryClient";
import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Users, Compass, Sparkles, Settings, LogOut, ChevronRight, Flame, Bell } from "lucide-react";
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

  const { data: allActiveWills, error: activeWillsError, isError: isActiveWillsError, failureCount, isLoading: willsLoading, isFetching: willsFetching, refetch: refetchWills, status: willsQueryStatus, fetchStatus: willsFetchStatus } = useQuery<Will[] | null>({
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
      data: allActiveWills === null ? 'NULL (auth failed?)' : allActiveWills === undefined ? 'UNDEFINED' : `Array(${allActiveWills.length})`,
      count: allActiveWills?.length,
      isLoading: willsLoading,
      isFetching: willsFetching,
      queryStatus: willsQueryStatus,
      fetchStatus: willsFetchStatus,
      hasError: isActiveWillsError,
      failureCount,
      willIds: allActiveWills?.map(w => w.id),
      willStatuses: allActiveWills?.map(w => `${w.id}:${w.status}:${w.mode}`),
      userId: user?.id,
      enabled: !!user && !!user.id,
    });
    if (isActiveWillsError) {
      console.error('[Home] Active wills query error:', activeWillsError);
    }
    if (allActiveWills === null) {
      console.warn('[Home] ⚠️ Wills query returned NULL - likely a 401 auth issue. Token may not be sent with request.');
    }
  }, [allActiveWills, isActiveWillsError, activeWillsError, willsLoading, willsFetching, willsQueryStatus, willsFetchStatus, failureCount, user]);

  const activeWills = allActiveWills?.filter(w => 
    w.status === 'active' || w.status === 'will_review' || w.status === 'scheduled' || w.status === 'pending' || w.status === 'paused'
  ) || [];

  const { data: notificationsData } = useQuery<{ notifications: any[]; count: number }>({
    queryKey: ['/api/notifications'],
    enabled: !!user,
    refetchInterval: 30000,
  });

  const handleCreateWill = () => {
    setLocation('/create-will');
  };

  const handleExplore = () => {
    setLocation('/explore');
  };

  const handleCircles = () => {
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
      <div className="pt-[calc(env(safe-area-inset-top)+4rem)] pb-[calc(env(safe-area-inset-bottom)+1.5rem)] min-h-screen flex flex-col">
        <div className={`max-w-sm mx-auto px-5 flex-1 flex flex-col ${activeWills.length > 0 ? 'justify-start' : 'justify-center'}`} style={activeWills.length > 0 ? undefined : { paddingTop: '10vh' }}>
          
          <div className="flex flex-col items-center">
            {/* Star Icon */}
            <div className="mb-3">
              <div className="relative">
                <div className="absolute -inset-2 bg-gradient-to-r from-emerald-400 via-teal-400 to-emerald-500 rounded-full blur-2xl opacity-30"></div>
                <div className="relative w-14 h-14 bg-gradient-to-br from-emerald-50 to-teal-50 rounded-full border-2 border-emerald-200 flex items-center justify-center shadow-lg">
                  <Sparkles className="w-7 h-7 text-emerald-600" />
                </div>
              </div>
            </div>

            {/* Greeting */}
            <h1 className="text-2xl font-semibold text-gray-900 mb-0.5" data-testid="text-welcome">
              Welcome back{user?.firstName ? `, ${user.firstName}` : ''}
            </h1>
            <p className="text-sm text-gray-400 mb-4">What will you commit to today?</p>

            {/* Create Will Button */}
            <button
              onClick={handleCreateWill}
              className="w-full max-w-sm mb-5 group"
              data-testid="button-create-will"
            >
              <div className="bg-gradient-to-r from-emerald-600 to-teal-600 rounded-2xl px-10 py-4 shadow-lg group-hover:shadow-xl transition-all duration-200 group-active:scale-[0.98]">
                <span className="text-white text-xl font-bold tracking-tight">Create a Will</span>
              </div>
            </button>

            {/* Active Wills Summary Card */}
            {willsLoading && user?.id && (
              <div className="w-full mb-4">
                <div className="flex items-center gap-2 justify-center py-3">
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-emerald-600"></div>
                  <span className="text-sm text-gray-400">Loading your wills...</span>
                </div>
              </div>
            )}
            {isActiveWillsError && (
              <div className="w-full mb-4">
                <div className="bg-red-50 border border-red-200 rounded-xl p-3 text-center">
                  <p className="text-sm text-red-600 mb-1">Could not load your wills</p>
                  <p className="text-xs text-red-400 mb-1 font-mono break-all">{activeWillsError?.message || 'Unknown error'}</p>
                  <button 
                    onClick={() => refetchWills()} 
                    className="text-xs text-red-500 underline"
                    data-testid="button-retry-wills"
                  >
                    Tap to retry
                  </button>
                </div>
              </div>
            )}
            {allActiveWills === null && !willsLoading && user?.id && (
              <div className="w-full mb-4">
                <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 text-center">
                  <p className="text-sm text-amber-600 mb-1">Session expired — please sign out and back in</p>
                  <button 
                    onClick={() => refetchWills()} 
                    className="text-xs text-amber-500 underline"
                    data-testid="button-retry-auth"
                  >
                    Tap to retry
                  </button>
                </div>
              </div>
            )}
            {!willsLoading && !isActiveWillsError && allActiveWills !== null && (
              <button
                onClick={() => setLocation('/wills')}
                className="w-full mb-4 group"
                data-testid="button-view-all-wills"
              >
                <Card className="bg-white border border-gray-200 shadow-sm group-hover:shadow-md group-hover:border-emerald-300 transition-all duration-200 group-active:scale-[0.98]">
                  <CardContent className="px-4 py-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Flame className={`w-4 h-4 ${activeWills.length > 0 ? 'text-emerald-600' : 'text-gray-400'}`} />
                        <h3 className="text-sm font-semibold text-gray-900">My Wills</h3>
                        <span className={`text-sm font-bold ${activeWills.length > 0 ? 'text-emerald-600' : 'text-gray-400'}`} data-testid="text-active-wills-label">{activeWills.length}</span>
                      </div>
                      <div className="flex items-center">
                        <ChevronRight className="w-4 h-4 text-gray-400 group-hover:text-emerald-500 ml-0.5" />
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </button>
            )}

            {/* Explore & Circles Cards */}
            <div className="grid grid-cols-2 gap-3 w-full mb-4">
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
                  <div className="p-4 flex flex-col items-center justify-center text-center">
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center mb-2 transition-colors duration-200 ${
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
                  <div className="p-4 flex flex-col items-center justify-center text-center">
                    <div className="relative">
                      <div className={`w-10 h-10 rounded-xl flex items-center justify-center mb-2 transition-colors duration-200 ${
                        activeCard === 'circles' ? 'bg-purple-100' : 'bg-purple-50'
                      }`}>
                        <Users className={`w-5 h-5 transition-colors duration-200 ${
                          activeCard === 'circles' ? 'text-purple-600' : 'text-purple-400'
                        }`} />
                      </div>
                      {(notificationsData?.count ?? 0) > 0 && (
                        <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center px-1" data-testid="badge-notification-count">
                          {notificationsData!.count}
                        </span>
                      )}
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
