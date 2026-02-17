import { useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { MobileLayout, UnifiedBackButton } from "@/components/ui/design-system";
import { Users, ArrowRight, Target, CheckCircle } from "lucide-react";

type PublicWill = {
  id: number;
  what: string;
  checkInType: string;
  startDate: string;
  endDate: string;
  isIndefinite: boolean;
  createdBy: string;
  creatorName: string;
  memberCount: number;
  status: string;
  isOwner: boolean;
  hasJoined: boolean;
};

export default function Explore() {
  const [, setLocation] = useLocation();

  const { data: publicWills, isLoading } = useQuery<PublicWill[]>({
    queryKey: ['/api/wills/public'],
    staleTime: 30000,
  });

  const getTimelineLabel = (will: PublicWill) => {
    if (will.isIndefinite) return "Ongoing";
    if (!will.startDate || !will.endDate) return "Ongoing";
    const start = new Date(will.startDate);
    const end = new Date(will.endDate);
    const days = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
    return `${days} days`;
  };

  const wills = publicWills || [];

  return (
    <MobileLayout>
      <div className="space-y-3">
        <div className="relative flex items-center justify-between mb-2 min-h-[44px]">
          <UnifiedBackButton
            onClick={() => setLocation('/')}
            testId="button-back"
          />
          <h1 className="absolute left-0 right-0 text-center text-xl font-semibold text-gray-900 pointer-events-none" data-testid="text-page-title">
            Explore Wills
          </h1>
          <div className="w-11"></div>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center py-16">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
          </div>
        ) : wills.length === 0 ? (
          <div className="text-center py-16">
            <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <Target className="w-8 h-8 text-gray-400" />
            </div>
            <h3 className="text-lg font-medium text-gray-900 mb-1" data-testid="text-empty-title">No public Wills yet</h3>
            <p className="text-sm text-gray-500">Check back later for Wills you can join.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {wills.map((will) => (
              <div
                key={will.id}
                className="bg-white rounded-xl border border-gray-200 p-4 shadow-sm"
                data-testid={`card-will-${will.id}`}
              >
                <p className="text-base font-medium text-gray-900 leading-snug" data-testid={`text-title-${will.id}`}>
                  {will.what}
                </p>
                <p className="text-xs text-gray-500 mt-1" data-testid={`text-creator-${will.id}`}>
                  by @{will.creatorName?.toLowerCase().replace(/\s+/g, '')}
                </p>

                <div className="flex items-center gap-2 mt-2.5 text-xs text-gray-500">
                  <span data-testid={`text-timeline-${will.id}`}>{getTimelineLabel(will)}</span>
                  <span className="text-gray-300">&bull;</span>
                  <span className="inline-flex items-center gap-1" data-testid={`text-members-${will.id}`}>
                    <Users className="w-3 h-3" />
                    {will.memberCount} {will.memberCount === 1 ? 'member' : 'members'}
                  </span>
                </div>

                {will.isOwner ? (
                  <div
                    className="mt-3 w-full py-2 rounded-lg text-sm font-medium bg-emerald-50 text-emerald-700 border border-emerald-200 flex items-center justify-center gap-1.5"
                    data-testid={`label-owner-${will.id}`}
                  >
                    <CheckCircle className="w-3.5 h-3.5" />
                    Your Will
                  </div>
                ) : will.hasJoined ? (
                  <div
                    className="mt-3 w-full py-2 rounded-lg text-sm font-medium bg-blue-50 text-blue-600 border border-blue-200 flex items-center justify-center gap-1.5"
                    data-testid={`label-joined-${will.id}`}
                  >
                    <CheckCircle className="w-3.5 h-3.5" />
                    Joined
                  </div>
                ) : (
                  <button
                    onClick={() => setLocation(`/explore/join/${will.id}`)}
                    className="mt-3 w-full py-2 rounded-lg text-sm font-medium bg-blue-500 text-white hover:bg-blue-600 transition-colors flex items-center justify-center gap-1.5"
                    data-testid={`button-join-${will.id}`}
                  >
                    Join
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </MobileLayout>
  );
}
