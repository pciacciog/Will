import { useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { getQueryFn } from "@/lib/queryClient";
import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Users, Compass, Settings, LogOut, ChevronRight, Flame, Sun } from "lucide-react";
import { WhoModal } from "@/components/WhoModal";
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
  const [showWhoModal, setShowWhoModal] = useState(false);
  const [activeCard, setActiveCard] = useState<'explore' | 'friends' | null>(null);
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

  const handleCreateWill = () => {
    setShowWhoModal(true);
  };

  const handleExplore = () => {
    setLocation('/explore');
  };

  const handleFriends = () => {
    setLocation('/friends');
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
      <div className="pt-[calc(env(safe-area-inset-top)+3.5rem)] pb-[calc(env(safe-area-inset-bottom)+0.75rem)] min-h-screen flex flex-col">
        <div className="max-w-sm mx-auto px-5 flex-1 flex flex-col">

          {/* Header — greeting only, no settings gear */}
          <div className="mb-6">
            <h1 className="text-[17px] font-bold text-gray-900 leading-tight" data-testid="text-welcome">
              Welcome back{user?.firstName ? `, ${user.firstName}` : ''}
            </h1>
            <p className="text-[13px] text-gray-400 leading-tight">What will you commit to?</p>
          </div>

          {/* Create Will Button */}
          <button
            onClick={handleCreateWill}
            className="w-full mb-3 group"
            data-testid="button-create-will"
          >
            <div className="bg-gradient-to-r from-emerald-600 to-teal-600 rounded-2xl px-10 py-4 shadow-lg group-hover:shadow-xl transition-all duration-200 group-active:scale-[0.98]">
              <span className="text-white text-xl font-bold tracking-tight">+ Create a Will</span>
            </div>
          </button>

          {/* My Wills — loading / error / data states */}
          {willsLoading && user?.id && (
            <div className="w-full mb-3">
              <div className="flex items-center gap-2 justify-center py-3">
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-emerald-600"></div>
                <span className="text-sm text-gray-400">Loading your wills...</span>
              </div>
            </div>
          )}
          {isActiveWillsError && (
            <div className="w-full mb-3">
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
            <div className="w-full mb-3">
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
              className="w-full mb-3 group"
              data-testid="button-view-all-wills"
            >
              <Card className="bg-white border-2 border-emerald-100 shadow-md group-hover:shadow-lg group-hover:border-emerald-300 transition-all duration-200 group-active:scale-[0.98]">
                <CardContent className="px-5 py-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-emerald-50 flex items-center justify-center flex-shrink-0">
                        <Flame className={`w-5 h-5 ${activeWills.length > 0 ? 'text-orange-500' : 'text-gray-400'}`} />
                      </div>
                      <div>
                        <h3 className="text-base font-bold text-gray-900 leading-tight">My Wills</h3>
                        {activeWills.length > 0 ? (
                          <span
                            className="text-[12px] text-emerald-600 font-medium"
                            data-testid="text-active-wills-label"
                          >
                            {activeWills.length} active
                          </span>
                        ) : (
                          <span className="text-[12px] text-gray-400" data-testid="text-active-wills-label">No active wills</span>
                        )}
                      </div>
                    </div>
                    <ChevronRight className="w-5 h-5 text-gray-400 group-hover:text-emerald-500 transition-colors" />
                  </div>
                </CardContent>
              </Card>
            </button>
          )}

          {/* Explore & My Circles — 2-col grid */}
          <div className="grid grid-cols-2 gap-3 w-full mb-3">
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
                <div className="p-3 flex flex-col items-center justify-center text-center">
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center mb-1 transition-colors duration-200 ${
                    activeCard === 'explore' ? 'bg-blue-100' : 'bg-blue-50'
                  }`}>
                    <Compass className={`w-5 h-5 transition-colors duration-200 ${
                      activeCard === 'explore' ? 'text-blue-600' : 'text-blue-400'
                    }`} />
                  </div>
                  <h3 className="text-sm font-semibold text-gray-900 leading-tight">Explore</h3>
                  <p className="text-[11px] text-gray-400 leading-tight">Browse public Wills</p>
                </div>
              </div>
            </button>

            <button
              onClick={() => { setActiveCard('friends'); handleFriends(); }}
              onPointerDown={() => setActiveCard('friends')}
              className="group"
              data-testid="button-friends"
            >
              <div className={`h-full rounded-2xl transition-all duration-200 group-hover:-translate-y-0.5 ${
                activeCard === 'friends'
                  ? 'bg-white border-2 border-purple-300 shadow-md shadow-purple-100/50'
                  : 'bg-white border border-gray-200 shadow-sm group-hover:shadow-md group-hover:border-purple-200'
              }`}>
                <div className="p-3 flex flex-col items-center justify-center text-center">
                  <div className="relative">
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center mb-1 transition-colors duration-200 ${
                      activeCard === 'friends' ? 'bg-purple-100' : 'bg-purple-50'
                    }`}>
                      <Users className={`w-5 h-5 transition-colors duration-200 ${
                        activeCard === 'friends' ? 'text-purple-600' : 'text-purple-400'
                      }`} />
                    </div>
                  </div>
                  <h3 className="text-sm font-semibold text-gray-900 leading-tight">Friends</h3>
                  <p className="text-[11px] text-gray-400 leading-tight">find people to grow with</p>
                </div>
              </div>
            </button>
          </div>

          {/* Today — de-emphasised: subtle row, no heavy card */}
          <button
            onClick={() => setLocation('/today')}
            className="w-full group mb-1"
            data-testid="button-today"
          >
            <div className="px-2 py-2 flex items-center gap-2 group-hover:opacity-70 transition-opacity duration-200">
              <Sun className="w-3.5 h-3.5 flex-shrink-0" style={{ color: '#E9A84C' }} />
              <span className="text-[12px] text-gray-400 leading-tight">Today — what's on your heart?</span>
              <ChevronRight className="w-3 h-3 text-gray-300 ml-auto" />
            </div>
          </button>

          {/* Footer — Settings + Sign Out */}
          <div className="mt-auto pt-4 flex items-center justify-center gap-5">
            <button
              onClick={() => setShowAccountSettings(true)}
              className="inline-flex items-center gap-1.5 text-gray-400 hover:text-gray-600 text-sm transition-colors"
              data-testid="button-settings"
            >
              <Settings className="w-3.5 h-3.5" />
              Settings
            </button>
            <span className="text-gray-200 text-lg leading-none">|</span>
            <button
              onClick={handleLogout}
              disabled={isLoggingOut}
              className="inline-flex items-center gap-1.5 text-gray-400 hover:text-gray-600 text-sm transition-colors disabled:opacity-50"
              data-testid="button-sign-out"
            >
              <LogOut className="w-3.5 h-3.5" />
              {isLoggingOut ? "Signing out..." : "Sign Out"}
            </button>
          </div>

        </div>
      </div>

      <AccountSettingsModal
        isOpen={showAccountSettings}
        onClose={() => setShowAccountSettings(false)}
      />
      <WhoModal
        isOpen={showWhoModal}
        onClose={() => setShowWhoModal(false)}
      />
    </div>
  );
}
