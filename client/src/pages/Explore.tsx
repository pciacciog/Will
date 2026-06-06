import { useState } from "react";
import { useLocation } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { MobileLayout, UnifiedBackButton } from "@/components/ui/design-system";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { Users, ArrowRight, Target, CheckCircle, Zap } from "lucide-react";

type PublicWill = {
  id: number;
  title: string | null;
  kind: string | null;
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

function KindPill({ kind }: { kind: string | null }) {
  if (!kind) return null;
  const map: Record<string, { label: string; className: string }> = {
    solo:          { label: "Solo",    className: "bg-emerald-100 text-emerald-700" },
    public:        { label: "Public",  className: "bg-blue-100 text-blue-700" },
    team_i_will:   { label: "Team",    className: "bg-violet-100 text-violet-700" },
    team_we_will:  { label: "We Will", className: "bg-indigo-100 text-indigo-700" },
  };
  const { label, className } = map[kind] ?? { label: kind, className: "bg-gray-100 text-gray-600" };
  return (
    <span className={`inline-block text-[10px] font-semibold px-2 py-0.5 rounded-full uppercase tracking-wide ${className}`}>
      {label}
    </span>
  );
}

export default function Explore() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [pushedIds, setPushedIds] = useState<Set<number>>(new Set());

  const { data: publicWills, isLoading } = useQuery<PublicWill[]>({
    queryKey: ['/api/wills/public'],
    staleTime: 30000,
  });

  const pushMutation = useMutation({
    mutationFn: (willId: number) =>
      apiRequest(`/api/wills/${willId}/push`, { method: "POST" }).then(r => r.json()),
    onSuccess: (_data, willId) => {
      setPushedIds(prev => new Set(prev).add(willId));
      toast({ title: "Pushed! 🚀", description: "Your encouragement was sent." });
    },
    onError: (err: any, willId) => {
      if (err?.status === 409 || err?.message?.includes("already")) {
        setPushedIds(prev => new Set(prev).add(willId));
        toast({ title: "Already pushed today", description: "Come back tomorrow!", variant: "destructive" });
      } else {
        toast({ title: "Error", description: err?.message ?? "Could not send push.", variant: "destructive" });
      }
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
    <MobileLayout>
      <div className="space-y-3">
        <div className="relative flex items-center justify-between mb-2 min-h-[44px]">
          <UnifiedBackButton onClick={() => setLocation('/')} testId="button-back" />
          <h1
            className="absolute left-0 right-0 text-center text-xl font-semibold text-gray-900 pointer-events-none"
            data-testid="text-page-title"
          >
            Explore Wills
          </h1>
          <div className="w-11" />
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center py-16">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500" />
          </div>
        ) : wills.length === 0 ? (
          <div className="text-center py-16">
            <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <Target className="w-8 h-8 text-gray-400" />
            </div>
            <h3 className="text-lg font-medium text-gray-900 mb-1" data-testid="text-empty-title">
              No open Wills yet
            </h3>
            <p className="text-sm text-gray-500">Check back later for Wills to explore.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {wills.map((will) => {
              const hasPushed = pushedIds.has(will.id);
              const isSolo = will.kind === 'solo';
              const isTeam = will.kind === 'team_i_will' || will.kind === 'team_we_will';
              const isPublicKind = will.kind === 'public';

              return (
                <div
                  key={will.id}
                  className="bg-white rounded-xl border border-gray-200 p-4 shadow-sm"
                  data-testid={`card-will-${will.id}`}
                >
                  {/* Kind pill + title */}
                  <div className="flex items-center gap-1.5 mb-1.5">
                    <KindPill kind={will.kind} />
                  </div>
                  <p className="text-base font-medium text-gray-900 leading-snug" data-testid={`text-title-${will.id}`}>
                    {will.title ?? will.what}
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

                  {/* CTAs */}
                  {will.isOwner ? (
                    <div
                      className="mt-3 w-full py-2 rounded-lg text-sm font-medium bg-emerald-50 text-emerald-700 border border-emerald-200 flex items-center justify-center gap-1.5"
                      data-testid={`label-owner-${will.id}`}
                    >
                      <CheckCircle className="w-3.5 h-3.5" />
                      Your Will
                    </div>
                  ) : isSolo ? (
                    // Solo: Push button CTA
                    <button
                      onClick={() => !hasPushed && pushMutation.mutate(will.id)}
                      disabled={hasPushed || pushMutation.isPending}
                      className="mt-3 w-full py-2 rounded-lg text-sm font-medium flex items-center justify-center gap-1.5 transition-all active:scale-95 disabled:cursor-default"
                      style={{
                        background: hasPushed ? '#F3F4F6' : 'linear-gradient(135deg, #10B981, #059669)',
                        color: hasPushed ? '#9CA3AF' : 'white',
                      }}
                      data-testid={`button-push-${will.id}`}
                    >
                      <Zap className="w-3.5 h-3.5" fill={hasPushed ? 'none' : 'currentColor'} />
                      {hasPushed ? 'Pushed ✓' : '⚡ Push'}
                    </button>
                  ) : isTeam ? (
                    // Team: View → link only, no interaction CTA
                    <button
                      onClick={() => setLocation(`/will/${will.id}`)}
                      className="mt-3 w-full py-2 rounded-lg text-sm font-medium bg-gray-50 text-gray-700 border border-gray-200 hover:bg-gray-100 transition-colors flex items-center justify-center gap-1.5"
                      data-testid={`button-view-${will.id}`}
                    >
                      View
                      <ArrowRight className="w-3.5 h-3.5" />
                    </button>
                  ) : isPublicKind ? (
                    // Public: existing View behavior (join/push happen on detail page)
                    <button
                      onClick={() => setLocation(`/public-will/${will.id}`)}
                      className="mt-3 w-full py-2 rounded-lg text-sm font-medium bg-blue-500 text-white hover:bg-blue-600 transition-colors flex items-center justify-center gap-1.5"
                      data-testid={`button-view-${will.id}`}
                    >
                      View
                      <ArrowRight className="w-3.5 h-3.5" />
                    </button>
                  ) : (
                    // Fallback
                    <button
                      onClick={() => setLocation(`/will/${will.id}`)}
                      className="mt-3 w-full py-2 rounded-lg text-sm font-medium bg-blue-500 text-white hover:bg-blue-600 transition-colors flex items-center justify-center gap-1.5"
                      data-testid={`button-view-${will.id}`}
                    >
                      View
                      <ArrowRight className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </MobileLayout>
  );
}
