import { useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { getQueryFn } from "@/lib/queryClient";
import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Users, Target, ChevronRight, Calendar, Flame, Pause, Clock, Globe, History } from "lucide-react";
import { MobileLayout, UnifiedBackButton } from "@/components/ui/design-system";

type Will = {
  id: number;
  mode: string;
  visibility: string;
  parentWillId?: number | null;
  status: string;
  startDate: string;
  endDate: string | null;
  isIndefinite?: boolean;
  checkInType?: string;
  circleId?: number;
  circleName?: string;
  commitments?: { id: number; userId: string; what: string; why: string }[];
};

function WillCard({ will, onClick }: { will: Will; onClick: () => void }) {
  const commitment = will.commitments?.[0];
  const isCircle = will.mode === 'circle';
  const isPublic = will.visibility === 'public' || !!will.parentWillId;

  const statusConfig: Record<string, { label: string; className: string; icon: typeof Flame }> = {
    active: { label: 'Active', className: 'bg-emerald-100 text-emerald-700', icon: Flame },
    will_review: { label: 'Review', className: 'bg-amber-100 text-amber-700', icon: Clock },
    scheduled: { label: 'Scheduled', className: 'bg-blue-100 text-blue-700', icon: Calendar },
    pending: { label: 'Pending', className: 'bg-gray-100 text-gray-700', icon: Clock },
    paused: { label: 'Paused', className: 'bg-orange-100 text-orange-700', icon: Pause },
    terminated: { label: 'Ended', className: 'bg-gray-100 text-gray-700', icon: Clock },
  };

  const status = statusConfig[will.status] || statusConfig.pending;

  const getDurationLabel = () => {
    if (will.isIndefinite) return 'Ongoing';
    if (!will.endDate) return 'Ongoing';
    const end = new Date(will.endDate);
    const now = new Date();
    const daysLeft = Math.ceil((end.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
    if (daysLeft < 0) return 'Ended';
    if (daysLeft === 0) return 'Ends today';
    if (daysLeft === 1) return '1 day left';
    return `${daysLeft} days left`;
  };

  return (
    <button
      onClick={onClick}
      className="w-full text-left group"
      data-testid={`card-will-${will.id}`}
    >
      <Card className={`bg-white border shadow-sm group-hover:shadow-md transition-all duration-200 group-active:scale-[0.98] ${
        isCircle
          ? 'border-purple-200 group-hover:border-purple-300'
          : isPublic
          ? 'border-blue-200 group-hover:border-blue-300'
          : 'border-gray-200 group-hover:border-emerald-300'
      }`}>
        <CardContent className="p-4">
          <div className="flex items-start gap-3">
            <div className={`w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 ${
              isCircle ? 'bg-purple-50' : isPublic ? 'bg-blue-50' : 'bg-emerald-50'
            }`}>
              {isCircle
                ? <Users className="w-5 h-5 text-purple-600" />
                : isPublic
                ? <Globe className="w-5 h-5 text-blue-600" />
                : <Target className="w-5 h-5 text-emerald-600" />
              }
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-gray-900 truncate" data-testid={`text-will-title-${will.id}`}>
                {commitment?.what || 'Untitled commitment'}
              </p>
              <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
                {isPublic && (
                  <Badge className="text-xs bg-blue-100 text-blue-700 hover:bg-blue-100" data-testid={`badge-public-${will.id}`}>
                    Public
                  </Badge>
                )}
                {isCircle && (
                  <Badge className="text-xs bg-purple-100 text-purple-700 hover:bg-purple-100" data-testid={`badge-circle-name-${will.id}`}>
                    {will.circleName || 'Circle'}
                  </Badge>
                )}
                <Badge className={`text-xs ${status.className} hover:${status.className}`} data-testid={`badge-status-${will.id}`}>
                  {status.label}
                </Badge>
                <span className="text-xs text-gray-400" data-testid={`text-duration-${will.id}`}>
                  {will.checkInType === 'daily' ? 'Daily' : getDurationLabel()}
                </span>
              </div>
            </div>
            <ChevronRight className={`w-5 h-5 mt-2.5 flex-shrink-0 ${
              isCircle
                ? 'text-gray-300 group-hover:text-purple-400'
                : isPublic
                ? 'text-gray-300 group-hover:text-blue-400'
                : 'text-gray-300 group-hover:text-emerald-400'
            }`} />
          </div>
        </CardContent>
      </Card>
    </button>
  );
}

export default function MyWills() {
  const [, setLocation] = useLocation();
  const [activeTab, setActiveTab] = useState<'all' | 'solo' | 'circle' | 'public'>('all');

  const { data: user, isLoading: userLoading } = useQuery<{ firstName?: string; id: string } | null>({
    queryKey: ['/api/user'],
    queryFn: getQueryFn({ on401: "returnNull" }),
  });

  const { data: allActiveWills, isLoading, isError, error, refetch } = useQuery<Will[] | null>({
    queryKey: ['/api/wills/all-active', user?.id],
    queryFn: getQueryFn({ on401: "returnNull" }),
    enabled: !!user?.id,
    staleTime: 1000 * 60 * 5,
    refetchOnMount: 'always',
  });

  const activeWills = allActiveWills?.filter(w =>
    w.status === 'active' || w.status === 'will_review' || w.status === 'scheduled' || w.status === 'pending' || w.status === 'paused'
  ) || [];

  const isPublicWill = (w: Will) => w.visibility === 'public' || !!w.parentWillId;
  const soloWills = activeWills.filter(w => w.mode !== 'circle' && !isPublicWill(w));
  const circleWills = activeWills.filter(w => w.mode === 'circle');
  const publicWills = activeWills.filter(w => isPublicWill(w));

  const displayWills = activeTab === 'all' ? activeWills : activeTab === 'solo' ? soloWills : activeTab === 'circle' ? circleWills : publicWills;

  const handleViewWill = (will: Will) => {
    sessionStorage.setItem('willBackUrl', '/wills');
    setLocation(`/will/${will.id}`);
  };

  if (!user && !userLoading) {
    setLocation('/auth');
    return null;
  }

  return (
    <MobileLayout>
      <div className="space-y-3">
        <div className="relative flex items-center justify-between mb-2 min-h-[44px]">
          <UnifiedBackButton
            onClick={() => setLocation('/')}
            testId="button-back"
          />
          <h1 className="absolute left-0 right-0 text-center text-xl font-semibold text-gray-900 pointer-events-none" data-testid="text-page-title">My Wills</h1>
          <span className="text-sm text-gray-400" data-testid="text-active-count">{activeWills.length}</span>
        </div>

          <div className="flex gap-1 bg-gray-100 rounded-xl p-1 mb-5">
            {([
              { key: 'all' as const, label: 'All', count: activeWills.length },
              { key: 'solo' as const, label: 'Solo', count: soloWills.length },
              { key: 'circle' as const, label: 'Circle', count: circleWills.length },
              { key: 'public' as const, label: 'Public', count: publicWills.length },
            ]).map(tab => (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={`flex-1 py-2 px-3 rounded-lg text-sm font-medium transition-all duration-200 ${
                  activeTab === tab.key
                    ? 'bg-white text-gray-900 shadow-sm'
                    : 'text-gray-500 hover:text-gray-700'
                }`}
                data-testid={`tab-${tab.key}`}
              >
                {tab.label}
                {tab.count > 0 && (
                  <span className={`ml-1.5 text-xs ${
                    activeTab === tab.key ? 'text-emerald-600' : 'text-gray-400'
                  }`}>
                    {tab.count}
                  </span>
                )}
              </button>
            ))}
          </div>

          {isLoading && (
            <div className="flex items-center gap-2 justify-center py-12">
              <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-emerald-600"></div>
              <span className="text-sm text-gray-400">Loading your wills...</span>
            </div>
          )}

          {isError && (
            <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-center">
              <p className="text-sm text-red-600 mb-2">Could not load your wills</p>
              <p className="text-xs text-red-400 mb-3 font-mono break-all">{error?.message || 'Unknown error'}</p>
              <button
                onClick={() => refetch()}
                className="text-sm text-red-500 underline"
                data-testid="button-retry-wills"
              >
                Tap to retry
              </button>
            </div>
          )}

          {allActiveWills === null && !isLoading && user?.id && (
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-center">
              <p className="text-sm text-amber-600 mb-2">Session expired — please sign out and back in</p>
              <button
                onClick={() => refetch()}
                className="text-xs text-amber-500 underline"
                data-testid="button-retry-auth"
              >
                Tap to retry
              </button>
            </div>
          )}

          {!isLoading && !isError && displayWills.length === 0 && (
            <div className="text-center py-12">
              <div className="w-14 h-14 rounded-full bg-gray-100 flex items-center justify-center mx-auto mb-4">
                <Target className="w-7 h-7 text-gray-400" />
              </div>
              <p className="text-gray-500 text-sm mb-1">
                {activeTab === 'all' ? 'No active wills yet' : `No ${activeTab} wills yet`}
              </p>
              <p className="text-gray-400 text-xs mb-5">Create a Will to start your accountability journey</p>
              <button
                onClick={() => setLocation('/create-will')}
                className="text-sm text-emerald-600 font-medium hover:underline"
                data-testid="button-create-will-empty"
              >
                Create a Will
              </button>
            </div>
          )}

          {!isLoading && displayWills.length > 0 && (
            <div className="space-y-3">
              {displayWills.map(will => (
                <WillCard
                  key={will.id}
                  will={will}
                  onClick={() => handleViewWill(will)}
                />
              ))}
            </div>
          )}

          {!isLoading && !isError && allActiveWills !== null && (
            <button
              onClick={() => setLocation(activeTab === 'circle' ? '/circle/history' : '/solo/history')}
              className="w-full mt-4 group"
              data-testid="button-will-history"
            >
              <div className="flex items-center justify-center gap-2 py-3 text-gray-400 hover:text-gray-600 transition-colors">
                <History className="w-4 h-4" />
                <span className="text-sm font-medium">Past Wills</span>
                <ChevronRight className="w-4 h-4" />
              </div>
            </button>
          )}

      </div>
    </MobileLayout>
  );
}