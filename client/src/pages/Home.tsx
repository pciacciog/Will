import { useLocation } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { getQueryFn, queryClient, apiRequest } from "@/lib/queryClient";
import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Users, Compass, Settings, LogOut, ChevronRight, Flame, Bell } from "lucide-react";
import { WhoModal } from "@/components/WhoModal";
import SplashScreen from "@/components/SplashScreen";
import AccountSettingsModal from "@/components/AccountSettingsModal";
import { useToast } from "@/hooks/use-toast";
import { getApiPath } from "@/config/api";
import { useHomeAlerts } from "@/hooks/useHomeAlerts";

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

type NotifResponse = {
  notifications: Array<{ id: number; type: string; isRead: boolean }>;
  unreadCount: number;
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

  const { data: notifData } = useQuery<NotifResponse>({
    queryKey: ['/api/notifications'],
    queryFn: getQueryFn({ on401: 'returnNull' }),
    enabled: !!user,
    staleTime: 0,
    refetchInterval: 30000,
    refetchOnWindowFocus: true,
  });

  const unreadCount = notifData?.unreadCount ?? 0;

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

  const { getAlert, totalForSection } = useHomeAlerts(!!user);

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
    const friendAlert = getAlert('friend_request');
    if (friendAlert) {
      setLocation('/friends?highlight=requests');
    } else {
      setLocation('/friends');
    }
  };

  // Smart deep navigation for the My Wills card
  const handleMyWills = () => {
    const reviewAlert = getAlert('will_review');
    const inviteAlert = getAlert('invite_accepted');

    // Prioritise review over invite
    const primaryAlert = reviewAlert ?? inviteAlert;

    // Always land on the My Wills list so the user can see every will. When an
    // alert exists, pass it through so the list highlights/filters the relevant
    // wills — never deep-link straight to a single will (that traps the user on
    // one will and hides the rest).
    if (primaryAlert && primaryAlert.willIds?.length) {
      setLocation(`/wills?alert=${primaryAlert.type}`);
    } else {
      setLocation('/wills');
    }
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

  const myWillsAlertCount = totalForSection('my_wills');
  const friendsAlertCount = totalForSection('friends');
  const reviewAlert = getAlert('will_review');
  const inviteAlert = getAlert('invite_accepted');
  const friendAlert = getAlert('friend_request');

  const myWillsBadgeLabel = (() => {
    if (reviewAlert && inviteAlert) {
      return `${myWillsAlertCount} need attention`;
    }
    if (reviewAlert) {
      return reviewAlert.count === 1 ? '1 review needed' : `${reviewAlert.count} reviews needed`;
    }
    if (inviteAlert) {
      return inviteAlert.count === 1 ? '1 invite' : `${inviteAlert.count} invites`;
    }
    return null;
  })();

  const friendsBadgeLabel = friendAlert
    ? friendAlert.count === 1 ? '1 request' : `${friendAlert.count} requests`
    : null;

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-emerald-50/20">
      <style>{`
        @keyframes sparkle-float {
          0%, 100% { transform: translateY(0px) scale(1) rotate(0deg); opacity: 0.55; }
          50%       { transform: translateY(-7px) scale(1.3) rotate(18deg); opacity: 1; }
        }
        .sp { animation: sparkle-float 2.6s ease-in-out infinite; }
        .sp1 { animation-delay: 0s; }
        .sp2 { animation-delay: 0.52s; }
        .sp3 { animation-delay: 1.04s; }
        .sp4 { animation-delay: 1.56s; }
        .sp5 { animation-delay: 2.08s; }
      `}</style>

      <div className="pt-[calc(env(safe-area-inset-top)+5.5rem)] pb-[calc(env(safe-area-inset-bottom)+0.75rem)] min-h-screen flex flex-col">
        <div className="max-w-sm mx-auto px-5 flex-1 flex flex-col">

          {/* ── Header ── */}
          <div className="mb-3 flex items-start justify-between">
            <div>
              <h1 className="text-[24px] font-bold text-gray-900 leading-tight tracking-tight" data-testid="text-welcome">
                Welcome back{user?.firstName ? `, ${user.firstName}` : ''}
              </h1>
              <p className="text-[15px] text-gray-500 font-medium leading-tight mt-0.5">
                What will you commit to today?
              </p>
            </div>
            <button
              onClick={() => setLocation('/notifications')}
              className="relative mt-1 p-2 rounded-xl hover:bg-gray-100 transition-colors"
              data-testid="button-notifications"
            >
              <Bell className="w-5 h-5 text-gray-400" />
              {unreadCount > 0 && (
                <span className="absolute -top-0.5 -right-0.5 min-w-[17px] h-[17px] bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center leading-none px-0.5">
                  {unreadCount > 9 ? '9+' : unreadCount}
                </span>
              )}
            </button>
          </div>

          {/* ── Create a Will ── */}
          <button onClick={handleCreateWill} className="w-full mb-2.5 group" data-testid="button-create-will">
            <div className="bg-gradient-to-r from-emerald-600 to-teal-600 rounded-2xl px-10 py-3 shadow-lg group-hover:shadow-xl group-hover:-translate-y-0.5 transition-all duration-200 group-active:scale-[0.98]">
              <span className="text-white text-[17px] font-bold tracking-tight">+ Create a Will</span>
            </div>
          </button>

          {/* ── My Wills states ── */}
          {willsLoading && user?.id && (
            <div className="w-full mb-3 flex items-center gap-2 justify-center py-3">
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-emerald-600" />
              <span className="text-sm text-gray-400">Loading your wills...</span>
            </div>
          )}
          {isActiveWillsError && (
            <div className="w-full mb-3 bg-red-50 border border-red-200 rounded-xl p-3 text-center">
              <p className="text-sm text-red-600 mb-1">Could not load your wills</p>
              <p className="text-xs text-red-400 mb-1 font-mono break-all">{activeWillsError?.message || 'Unknown error'}</p>
              <button onClick={() => refetchWills()} className="text-xs text-red-500 underline" data-testid="button-retry-wills">Tap to retry</button>
            </div>
          )}
          {allActiveWills === null && !willsLoading && user?.id && (
            <div className="w-full mb-3 bg-amber-50 border border-amber-200 rounded-xl p-3 text-center">
              <p className="text-sm text-amber-600 mb-1">Session expired — please sign out and back in</p>
              <button onClick={() => refetchWills()} className="text-xs text-amber-500 underline" data-testid="button-retry-auth">Tap to retry</button>
            </div>
          )}
          {!willsLoading && !isActiveWillsError && allActiveWills !== null && (
            <button onClick={handleMyWills} className="w-full mb-2.5 group" data-testid="button-view-all-wills">
              <div className="bg-white border border-emerald-200 rounded-2xl px-4 py-2.5 shadow-sm group-hover:shadow-md group-hover:border-emerald-400 transition-all duration-200 group-active:scale-[0.98]">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-emerald-50 flex items-center justify-center flex-shrink-0">
                      <Flame className={`w-5 h-5 ${activeWills.length > 0 ? 'text-orange-500' : 'text-gray-400'}`} />
                    </div>
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="text-[15px] font-bold text-gray-900 leading-tight">My Wills</h3>
                        {myWillsBadgeLabel && (
                          <span
                            className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold bg-amber-100 text-amber-700 leading-none"
                            data-testid="badge-my-wills-alert"
                          >
                            {myWillsBadgeLabel}
                          </span>
                        )}
                      </div>
                      {activeWills.length > 0 ? (
                        <span className="text-[12px] text-emerald-600 font-medium" data-testid="text-active-wills-label">
                          {activeWills.length} active
                        </span>
                      ) : (
                        <span className="text-[12px] text-gray-400" data-testid="text-active-wills-label">No active wills</span>
                      )}
                    </div>
                  </div>
                  <ChevronRight className="w-5 h-5 text-gray-300 group-hover:text-emerald-400 transition-colors" />
                </div>
              </div>
            </button>
          )}

          {/* ── Explore & Friends ── */}
          <div className="grid grid-cols-2 gap-2.5 w-full mb-2.5">
            <button
              onClick={() => { setActiveCard('explore'); handleExplore(); }}
              onPointerDown={() => setActiveCard('explore')}
              className="group"
              data-testid="button-explore"
            >
              <div className={`h-full rounded-2xl border transition-all duration-200 group-hover:-translate-y-0.5 ${
                activeCard === 'explore'
                  ? 'bg-blue-50 border-blue-200 shadow-md'
                  : 'bg-white border-emerald-200 shadow-sm group-hover:shadow-md group-hover:border-blue-300'
              }`}>
                <div className="p-3 flex flex-col items-center text-center gap-0.5">
                  <div className={`w-10 h-10 rounded-2xl flex items-center justify-center mb-1 transition-colors duration-200 ${
                    activeCard === 'explore' ? 'bg-blue-100' : 'bg-blue-50'
                  }`}>
                    <Compass className={`w-5 h-5 transition-colors duration-200 ${
                      activeCard === 'explore' ? 'text-blue-600' : 'text-blue-500'
                    }`} />
                  </div>
                  <h3 className="text-[13px] font-bold text-gray-900 leading-tight">Explore</h3>
                  <p className="text-[11px] text-gray-400 leading-snug mt-0.5">See what others<br/>are pursuing</p>
                </div>
              </div>
            </button>

            <button
              onClick={() => { setActiveCard('friends'); handleFriends(); }}
              onPointerDown={() => setActiveCard('friends')}
              className="group"
              data-testid="button-friends"
            >
              <div className={`h-full rounded-2xl border transition-all duration-200 group-hover:-translate-y-0.5 ${
                activeCard === 'friends'
                  ? 'bg-violet-50 border-violet-200 shadow-md'
                  : 'bg-white border-emerald-200 shadow-sm group-hover:shadow-md group-hover:border-violet-300'
              }`}>
                <div className="p-3 flex flex-col items-center text-center gap-0.5">
                  <div className={`relative w-10 h-10 rounded-2xl flex items-center justify-center mb-1 transition-colors duration-200 ${
                    activeCard === 'friends' ? 'bg-violet-100' : 'bg-violet-50'
                  }`}>
                    <Users className={`w-5 h-5 transition-colors duration-200 ${
                      activeCard === 'friends' ? 'text-violet-600' : 'text-violet-500'
                    }`} />
                    {friendsAlertCount > 0 && (
                      <span className="absolute -top-1 -right-1 min-w-[16px] h-[16px] bg-amber-500 text-white text-[9px] font-bold rounded-full flex items-center justify-center leading-none px-0.5" data-testid="badge-friends-count">
                        {friendsAlertCount > 9 ? '9+' : friendsAlertCount}
                      </span>
                    )}
                  </div>
                  <h3 className="text-[13px] font-bold text-gray-900 leading-tight">Friends</h3>
                  {friendsBadgeLabel ? (
                    <span className="inline-flex items-center mt-0.5 px-1.5 py-0.5 rounded-full text-[10px] font-semibold bg-amber-100 text-amber-700 leading-none" data-testid="badge-friends-alert">
                      {friendsBadgeLabel}
                    </span>
                  ) : (
                    <p className="text-[11px] text-gray-400 leading-snug mt-0.5">Build your circle,<br/>grow together</p>
                  )}
                </div>
              </div>
            </button>
          </div>

          {/* ── Find Your Will — magical section ── */}
          <div className="flex flex-col items-center gap-1.5 pt-1 pb-1">
            <div className="w-full border-t border-gray-100" />
            <div className="flex flex-col items-center gap-0.5 mt-1">
              <p className="text-[13px] font-semibold text-gray-600 text-center">Not sure where to start?</p>
              <p className="text-[11px] text-gray-400 text-center">Let us help you find the right commitment.</p>
            </div>

            {/* Sparkles + button */}
            <div className="relative inline-flex items-center justify-center mt-1">
              <span className="sp sp1 absolute -top-4 left-4  text-emerald-400 text-sm  select-none pointer-events-none">✦</span>
              <span className="sp sp2 absolute -top-3 right-3 text-teal-300   text-[10px] select-none pointer-events-none">✦</span>
              <span className="sp sp3 absolute top-1  -right-6 text-emerald-300 text-xs   select-none pointer-events-none">✦</span>
              <span className="sp sp4 absolute -bottom-3 -left-6 text-teal-400 text-[10px] select-none pointer-events-none">✦</span>
              <span className="sp sp5 absolute -bottom-2 right-1 text-emerald-500 text-sm  select-none pointer-events-none">✦</span>
              <button
                onClick={() => setLocation('/find-will')}
                className="px-8 py-2.5 rounded-full text-white text-[14px] font-bold bg-gradient-to-r from-emerald-600 to-teal-600 shadow-md hover:shadow-lg hover:-translate-y-0.5 active:scale-[0.97] transition-all duration-200"
                data-testid="button-find-your-will"
              >
                Find Your Will
              </button>
            </div>
          </div>

          {/* ── Footer ── */}
          <div className="mt-auto pt-2 flex items-center justify-center gap-5">
            <button
              onClick={() => setShowAccountSettings(true)}
              className="inline-flex items-center gap-1.5 text-gray-400 hover:text-gray-600 text-[12px] transition-colors"
              data-testid="button-settings"
            >
              <Settings className="w-3.5 h-3.5" />
              Settings
            </button>
            <span className="text-gray-200 text-lg leading-none">|</span>
            <button
              onClick={handleLogout}
              disabled={isLoggingOut}
              className="inline-flex items-center gap-1.5 text-gray-400 hover:text-gray-600 text-[12px] transition-colors disabled:opacity-50"
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
