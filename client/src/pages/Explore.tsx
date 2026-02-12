import { useLocation } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { Users, ArrowRight, ArrowLeft, Target, CheckCircle } from "lucide-react";

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
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: publicWills, isLoading } = useQuery<PublicWill[]>({
    queryKey: ['/api/wills/public'],
    staleTime: 30000,
  });

  const joinMutation = useMutation({
    mutationFn: async (willId: number) => {
      return apiRequest(`/api/wills/${willId}/join`, {
        method: 'POST',
      });
    },
    onSuccess: (data: any) => {
      toast({
        title: "Joined!",
        description: "You've joined this commitment. Good luck!",
      });
      queryClient.invalidateQueries({ queryKey: ['/api/wills/personal'] });
      queryClient.invalidateQueries({ queryKey: ['/api/wills/public'] });
      if (data?.willId) {
        sessionStorage.setItem('willBackUrl', '/explore');
        setLocation(`/will/${data.willId}`);
      }
    },
    onError: (error: any) => {
      toast({
        title: "Couldn't join",
        description: error.message || "Something went wrong",
        variant: "destructive",
      });
    },
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
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-md mx-auto px-5 pt-[calc(env(safe-area-inset-top)+1.5rem)] pb-[calc(env(safe-area-inset-bottom)+2rem)]">
        <div className="relative flex items-center justify-center py-4 mb-4">
          <button
            onClick={() => setLocation('/')}
            className="absolute left-0 w-9 h-9 rounded-full bg-white border border-gray-200 flex items-center justify-center hover:bg-gray-50 transition-colors"
            data-testid="button-back"
          >
            <ArrowLeft className="w-4 h-4 text-gray-600" />
          </button>
          <h1 className="text-xl font-semibold text-gray-900" data-testid="text-page-title">
            Explore Wills
          </h1>
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
            <p className="text-sm text-gray-500 mb-5">Be the first to create!</p>
            <Button
              onClick={() => setLocation('/solo/start-will')}
              className="bg-blue-500 hover:bg-blue-600 text-white"
              data-testid="button-create-public"
            >
              Create Public Will
            </Button>
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
                  <span className="text-gray-300">•</span>
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
                    onClick={() => joinMutation.mutate(will.id)}
                    disabled={joinMutation.isPending}
                    className="mt-3 w-full py-2 rounded-lg text-sm font-medium bg-blue-500 text-white hover:bg-blue-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-1.5"
                    data-testid={`button-join-${will.id}`}
                  >
                    {joinMutation.isPending ? 'Joining...' : 'Join'}
                    {!joinMutation.isPending && <ArrowRight className="w-3.5 h-3.5" />}
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
