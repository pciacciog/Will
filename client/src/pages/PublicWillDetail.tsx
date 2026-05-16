import { useState } from "react";
import { useLocation, useParams } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { apiRequest } from "@/lib/queryClient";
import { MobileLayout, UnifiedBackButton } from "@/components/ui/design-system";
import { useToast } from "@/hooks/use-toast";
import { Zap, MessageCircle, CheckCircle, Users } from "lucide-react";
import type { WillCheckIn } from "@shared/schema";
import DayStrip from "@/components/DayStrip";
import { cn } from "@/lib/utils";

type PublicWillDetails = {
  id: number;
  title: string | null;
  what: string;
  why: string | null;
  checkInType: string | null;
  startDate: string;
  endDate: string | null;
  isIndefinite: boolean;
  activeDays: string | null;
  customDays: string | null;
  createdBy: string;
  creatorName: string;
  memberCount: number;
  status: string | null;
  isOwner: boolean;
  hasJoined: boolean;
  hasPushed: boolean;
};

type Participant = { id: string; firstName: string };

type PublicProgress = {
  checkIns: WillCheckIn[];
  progress: {
    totalDays: number;
    checkedInDays: number;
    successRate: number;
    yesCount: number;
    partialCount: number;
    noCount: number;
    streak: number;
  };
};

function getStatusPill(will: PublicWillDetails): string {
  const status = will.status ?? 'active';
  const label = status.charAt(0).toUpperCase() + status.slice(1);
  if (will.isIndefinite) return `${label} · Ongoing`;
  if (!will.startDate || !will.endDate) return `${label} · Ongoing`;
  const start = new Date(will.startDate);
  const end = new Date(will.endDate);
  const days = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
  return `${label} · ${days} days · ${end < new Date() ? 'Ended' : 'Ongoing'}`;
}

function getInitials(name: string): string {
  return name.charAt(0).toUpperCase();
}

const AVATAR_COLORS = [
  'bg-blue-400', 'bg-emerald-400', 'bg-purple-400', 'bg-amber-400',
  'bg-pink-400', 'bg-teal-400', 'bg-indigo-400', 'bg-rose-400',
];

function avatarColor(id: string): string {
  let hash = 0;
  for (let i = 0; i < id.length; i++) hash = id.charCodeAt(i) + ((hash << 5) - hash);
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
}

export default function PublicWillDetail() {
  const { id } = useParams<{ id: string }>();
  const willId = parseInt(id);
  const [, setLocation] = useLocation();
  const { user } = useAuth();
  const { toast } = useToast();
  const qc = useQueryClient();

  const [pushSuccess, setPushSuccess] = useState(false);

  const { data: will, isLoading } = useQuery<PublicWillDetails>({
    queryKey: [`/api/wills/${willId}/public-details`],
    enabled: !!willId,
  });

  const { data: participantsData } = useQuery<{ participants: Participant[]; totalCount: number }>({
    queryKey: [`/api/wills/${willId}/participants`],
    enabled: !!willId,
  });

  const { data: progressData } = useQuery<PublicProgress>({
    queryKey: [`/api/wills/${willId}/public-progress`],
    enabled: !!willId,
  });

  const pushMutation = useMutation({
    mutationFn: () => apiRequest('POST', `/api/wills/${willId}/push`),
    onSuccess: () => {
      setPushSuccess(true);
      qc.invalidateQueries({ queryKey: [`/api/wills/${willId}/public-details`] });
    },
    onError: (err: any) => {
      const msg = err?.message || 'Could not send push';
      if (msg.includes('already pushed')) {
        toast({ title: "Already pushed", description: "You've already encouraged this Will." });
      } else {
        toast({ title: "Error", description: msg, variant: "destructive" });
      }
    },
  });

  const alreadyPushed = will?.hasPushed || pushSuccess;

  if (isLoading) {
    return (
      <MobileLayout>
        <div className="flex items-center justify-center py-20">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500" />
        </div>
      </MobileLayout>
    );
  }

  if (!will) {
    return (
      <MobileLayout>
        <div className="text-center py-20 text-gray-500">Will not found.</div>
      </MobileLayout>
    );
  }

  const checkInType = will.checkInType ?? 'final_review';
  const isTracking = checkInType === 'daily' || checkInType === 'specific_days';
  const checkIns = progressData?.checkIns ?? [];
  const progress = progressData?.progress;
  const successRate = progress?.successRate ?? 0;
  const participants = participantsData?.participants ?? [];

  return (
    <MobileLayout>
      <div className="pb-28 space-y-4">
        {/* Header */}
        <div className="relative flex items-center justify-between min-h-[44px]">
          <UnifiedBackButton onClick={() => setLocation('/explore')} testId="button-back" />
          <div className="absolute left-0 right-0 flex flex-col items-center pointer-events-none">
            <h1 className="text-xl font-semibold text-gray-900" data-testid="text-page-title">Will</h1>
            <span className="text-xs text-gray-500 mt-0.5" data-testid="text-status-pill">
              {getStatusPill(will)}
            </span>
          </div>
          <div className="w-11" />
        </div>

        {/* Commitment card */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 space-y-3">
          <div className="flex items-center gap-2.5">
            <div className={cn("w-9 h-9 rounded-full flex items-center justify-center text-white text-sm font-semibold", avatarColor(will.createdBy))}>
              {getInitials(will.creatorName)}
            </div>
            <span className="text-sm font-medium text-gray-700" data-testid="text-creator-name">
              @{will.creatorName.toLowerCase().replace(/\s+/g, '')}
            </span>
          </div>
          <p className="text-[10px] font-semibold uppercase tracking-widest text-gray-400">Their Commitment</p>
          <p className="text-base font-semibold text-gray-900 leading-snug" data-testid="text-commitment">
            {will.what}
          </p>
          {will.why && (
            <p className="text-sm italic text-gray-500" data-testid="text-because">
              "{will.why}"
            </p>
          )}
        </div>

        {/* Members strip */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm px-5 py-4">
          <div className="flex items-center gap-3">
            <div className="flex -space-x-2">
              {participants.slice(0, 5).map((p) => (
                <div
                  key={p.id}
                  className={cn("w-8 h-8 rounded-full border-2 border-white flex items-center justify-center text-white text-xs font-semibold", avatarColor(p.id))}
                  title={p.firstName}
                >
                  {getInitials(p.firstName)}
                </div>
              ))}
              {(participantsData?.totalCount ?? 0) > 5 && (
                <div className="w-8 h-8 rounded-full border-2 border-white bg-gray-200 flex items-center justify-center text-xs font-semibold text-gray-600">
                  +{(participantsData?.totalCount ?? 0) - 5}
                </div>
              )}
            </div>
            <p className="text-sm text-gray-600" data-testid="text-member-count">
              <span className="font-semibold text-gray-900">{will.memberCount}</span>{' '}
              {will.memberCount === 1 ? 'person is' : 'people are'} in this Will
            </p>
          </div>
        </div>

        {/* Progress section */}
        {isTracking && (
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 space-y-4">
            <div className="flex items-center gap-2">
              <Users className="w-4 h-4 text-blue-500" />
              <p className="text-sm font-semibold text-gray-700">Their Progress</p>
            </div>

            <div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-xl p-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium text-gray-700">Success Rate</span>
                <span className={cn(
                  "text-sm font-bold",
                  successRate >= 80 ? "text-emerald-600" :
                  successRate >= 50 ? "text-amber-600" :
                  "text-red-500"
                )} data-testid="text-success-rate">
                  {successRate.toFixed(0)}%
                </span>
              </div>
              <div className="h-2.5 bg-white rounded-full overflow-hidden">
                <div
                  className={cn(
                    "h-full rounded-full transition-all duration-500",
                    successRate >= 80 ? "bg-gradient-to-r from-emerald-400 to-emerald-500" :
                    successRate >= 50 ? "bg-gradient-to-r from-amber-400 to-amber-500" :
                    "bg-gradient-to-r from-red-400 to-red-500"
                  )}
                  style={{ width: `${Math.min(successRate, 100)}%` }}
                />
              </div>
              <p className="text-xs text-gray-400 mt-1.5">
                {progress?.checkedInDays ?? 0} of {progress?.totalDays ?? 0} days tracked
                {(progress?.streak ?? 0) > 0 && ` · ${progress!.streak}-day streak 🔥`}
              </p>
            </div>

            {checkIns.length > 0 && (
              <div className="border border-gray-100 rounded-xl p-3">
                <DayStrip
                  startDate={will.startDate}
                  endDate={will.endDate ?? null}
                  checkIns={checkIns}
                />
              </div>
            )}
          </div>
        )}
      </div>

      {/* Bottom engagement bar — hidden for owners */}
      {!will.isOwner && (
        <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-100 px-4 py-3 flex items-center gap-2" style={{ paddingBottom: 'max(12px, env(safe-area-inset-bottom))' }}>
          {/* Push */}
          <button
            onClick={() => {
              if (!alreadyPushed && !pushMutation.isPending) pushMutation.mutate();
            }}
            disabled={alreadyPushed || pushMutation.isPending}
            className={cn(
              "flex-1 flex flex-col items-center justify-center gap-1 py-2.5 rounded-xl transition-all",
              alreadyPushed
                ? "bg-amber-50 text-amber-600"
                : "bg-gray-50 text-gray-700 active:scale-95"
            )}
            data-testid="button-push"
          >
            <Zap className={cn("w-5 h-5", alreadyPushed ? "fill-amber-400 text-amber-400" : "")} />
            <span className="text-xs font-medium">{alreadyPushed ? 'Pushed ✓' : 'Push'}</span>
          </button>

          {/* Message */}
          <button
            onClick={() => setLocation(`/will/${willId}/messages`)}
            className="flex-1 flex flex-col items-center justify-center gap-1 py-2.5 rounded-xl bg-gray-50 text-gray-700 active:scale-95 transition-all"
            data-testid="button-message"
          >
            <MessageCircle className="w-5 h-5" />
            <span className="text-xs font-medium">Message</span>
          </button>

          {/* Join */}
          {will.hasJoined ? (
            <div
              className="flex-1 flex flex-col items-center justify-center gap-1 py-2.5 rounded-xl bg-emerald-50 text-emerald-600"
              data-testid="label-joined"
            >
              <CheckCircle className="w-5 h-5" />
              <span className="text-xs font-medium">You're in ✓</span>
            </div>
          ) : (
            <button
              onClick={() => setLocation(`/explore/join/${willId}`)}
              className="flex-1 flex flex-col items-center justify-center gap-1 py-2.5 rounded-xl bg-blue-500 text-white active:scale-95 transition-all"
              data-testid="button-join"
            >
              <CheckCircle className="w-5 h-5" />
              <span className="text-xs font-medium">Join</span>
            </button>
          )}
        </div>
      )}

      {/* Owner view — no engagement bar, subtle indicator */}
      {will.isOwner && (
        <div className="fixed bottom-0 left-0 right-0 bg-emerald-50 border-t border-emerald-100 px-4 py-3 flex items-center justify-center gap-2" style={{ paddingBottom: 'max(12px, env(safe-area-inset-bottom))' }}>
          <CheckCircle className="w-4 h-4 text-emerald-600" />
          <span className="text-sm font-medium text-emerald-700">Your Will</span>
        </div>
      )}
    </MobileLayout>
  );
}
