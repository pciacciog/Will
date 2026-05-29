import { useState, useMemo } from "react";
import { useLocation, useParams } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { apiRequest } from "@/lib/queryClient";
import { MobileLayout, UnifiedBackButton } from "@/components/ui/design-system";
import { useToast } from "@/hooks/use-toast";
import { Zap, ChevronRight, CheckCircle, XCircle, Users, MessageCircle } from "lucide-react";
import type { WillCheckIn } from "@shared/schema";
import DayStrip from "@/components/DayStrip";
import { cn } from "@/lib/utils";
import DeadlineArc, { deadlineUrgency } from "@/components/DeadlineArc";

// ── Types ─────────────────────────────────────────────────────────────────────

type PublicWillDetails = {
  id: number;
  title: string | null;
  what: string;
  checkInType: string | null;
  commitmentCategory: string | null;
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
  daysIn: number;
};

type Participant = { id: string; firstName: string; joinDate: string | null };

type PublicProgress = {
  checkIns: WillCheckIn[];
  abstainEntries: { date: string; honored: boolean }[];
  commitmentCategory: string | null;
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

type PushStatus = {
  hasUserPushed: boolean;
  pushes: { id: number; willId: number; userId: string; pushedAt: string; user: { firstName: string; id?: string } }[];
};

type MessagesPreview = {
  messages: { id: number; text: string; createdAt: string; userId: string; user: { firstName: string } }[];
  totalCount: number;
};

// ── Helpers ───────────────────────────────────────────────────────────────────

const AVATAR_COLORS = [
  '#3B82F6', '#10B981', '#8B5CF6', '#F59E0B',
  '#EC4899', '#14B8A6', '#6366F1', '#F43F5E',
];

function avatarColor(id: string): string {
  let hash = 0;
  for (let i = 0; i < id.length; i++) hash = id.charCodeAt(i) + ((hash << 5) - hash);
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
}

function getInitials(name: string): string {
  return name.charAt(0).toUpperCase();
}

function formatJoinDate(dateStr: string | null): string {
  if (!dateStr) return '';
  const d = new Date(dateStr + 'T00:00:00');
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function PublicWillDetail() {
  const { id } = useParams<{ id: string }>();
  const willId = parseInt(id);
  const [, setLocation] = useLocation();
  const { user } = useAuth();
  const { toast } = useToast();
  const qc = useQueryClient();

  const [pushSuccess, setPushSuccess] = useState(false);
  const [showJoinersModal, setShowJoinersModal] = useState(false);

  // ── Queries ─────────────────────────────────────────────────────────────────

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

  const { data: pushStatus } = useQuery<PushStatus>({
    queryKey: [`/api/wills/${willId}/push/status`],
    enabled: !!willId,
    refetchInterval: 30000,
  });

  const { data: messagesPreview } = useQuery<MessagesPreview>({
    queryKey: [`/api/wills/${willId}/public-messages-preview`],
    enabled: !!willId,
    refetchInterval: 15000,
  });

  // ── Push mutation ────────────────────────────────────────────────────────────

  const pushMutation = useMutation({
    mutationFn: () => apiRequest(`/api/wills/${willId}/push`, { method: 'POST' }),
    onSuccess: () => {
      setPushSuccess(true);
      qc.invalidateQueries({ queryKey: [`/api/wills/${willId}/push/status`] });
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

  // ── Derived values ──────────────────────────────────────────────────────────

  const alreadyPushed = will?.hasPushed || pushStatus?.hasUserPushed || pushSuccess;
  const pushCount = pushStatus?.pushes?.length ?? 0;
  const recentPushers = pushStatus?.pushes?.slice(0, 4) ?? [];

  const category = will?.commitmentCategory ?? null;
  const creatorHandle = will ? `@${will.creatorName.toLowerCase().replace(/\s+/g, '')}` : '';

  const missionDaysRemaining = useMemo(() => {
    if (category !== 'event' || !will?.endDate) return 999;
    return Math.ceil((new Date(will.endDate).getTime() - new Date().setHours(0,0,0,0)) / 86400000);
  }, [category, will?.endDate]);

  // Duration calendar computations
  const durTotalDays = useMemo(() => {
    if (category !== 'duration' || !will?.startDate || !will?.endDate) return 0;
    return Math.max(1, Math.round((new Date(will.endDate).getTime() - new Date(will.startDate).getTime()) / 86400000));
  }, [category, will?.startDate, will?.endDate]);

  const durDaysIn = useMemo(() => {
    if (category !== 'duration' || !will?.startDate || durTotalDays === 0) return 0;
    const start = new Date(will.startDate); start.setHours(0, 0, 0, 0);
    const todayMid = new Date(); todayMid.setHours(0, 0, 0, 0);
    return Math.min(durTotalDays, Math.max(1, Math.floor((todayMid.getTime() - start.getTime()) / 86400000) + 1));
  }, [category, will?.startDate, durTotalDays]);

  const durDaysLeft = Math.max(0, durTotalDays - durDaysIn);

  const durStartDOW = useMemo(() => {
    if (category !== 'duration' || !will?.startDate) return 0;
    return (new Date(will.startDate).getDay() + 6) % 7;
  }, [category, will?.startDate]);

  const durCalendarDays = useMemo(() => {
    if (category !== 'duration' || !will?.startDate || durTotalDays === 0) return [] as { dayNum: number; date: string; status: 'checked-in' | 'missed' | 'today' | 'upcoming' }[];
    const abstainEntries = progressData?.abstainEntries ?? [];
    const start = new Date(will.startDate); start.setHours(0, 0, 0, 0);
    const todayMid = new Date(); todayMid.setHours(0, 0, 0, 0);
    return Array.from({ length: durTotalDays }, (_, i) => {
      const d = new Date(start); d.setDate(d.getDate() + i);
      const dateStr = d.toLocaleDateString('en-CA');
      const isToday = d.getTime() === todayMid.getTime();
      const isPast = d < todayMid;
      const entry = abstainEntries.find(e => e.date === dateStr);
      const status = isToday ? 'today' : isPast ? (entry?.honored ? 'checked-in' : 'missed') : 'upcoming';
      return { dayNum: i + 1, date: dateStr, status } as { dayNum: number; date: string; status: 'checked-in' | 'missed' | 'today' | 'upcoming' };
    });
  }, [category, will?.startDate, durTotalDays, progressData?.abstainEntries]);

  const durMissedCount = useMemo(() => {
    return durCalendarDays.filter(d => d.status === 'missed').length;
  }, [durCalendarDays]);

  // Success rate for stat box
  const successRate = useMemo(() => {
    if (category === 'duration') {
      const entries = progressData?.abstainEntries ?? [];
      const past = durCalendarDays.filter(d => d.status === 'checked-in' || d.status === 'missed');
      if (past.length === 0) return null;
      const honored = entries.filter(e => e.honored).length;
      return Math.round((honored / past.length) * 100);
    }
    return progressData?.progress?.successRate != null ? Math.round(progressData.progress.successRate) : null;
  }, [category, progressData, durCalendarDays]);

  // ── Loading / error states ──────────────────────────────────────────────────

  if (isLoading) {
    return (
      <MobileLayout>
        <div className="flex items-center justify-center py-20">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2" style={{ borderColor: '#1D9E75' }} />
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

  const typeBadgeLabel =
    category === 'recurring' ? 'Recurring'
    : category === 'duration' ? 'Duration'
    : category === 'event' ? 'Event'
    : null;

  const checkIns = progressData?.checkIns ?? [];
  const participants = participantsData?.participants ?? [];
  const msgPreview = messagesPreview?.messages ?? [];
  const msgTotal = messagesPreview?.totalCount ?? 0;

  return (
    <MobileLayout>
      <div className="pb-28 space-y-3">

        {/* ── Header ──────────────────────────────────────────────────────── */}
        <div className="flex items-center justify-between min-h-[56px]">
          <UnifiedBackButton onClick={() => setLocation('/explore')} testId="button-back" />
          <div className="flex flex-col items-center gap-1.5">
            <h1 className="text-xl font-semibold text-gray-900" data-testid="text-page-title">Will Hub</h1>
            <div className="flex items-center gap-1.5">
              {(() => {
                const urg = category === 'event' ? deadlineUrgency(missionDaysRemaining) : null;
                return (
                  <span
                    className={`px-2.5 py-0.5 rounded-full text-xs font-semibold ${urg ? `${urg.pillBg} ${urg.pillText}` : 'bg-emerald-100 text-emerald-700'}`}
                    data-testid="badge-active-day"
                  >
                    Active · Day {will.daysIn}
                  </span>
                );
              })()}
              {typeBadgeLabel && (
                <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold" style={{ backgroundColor: '#EEEDF9', color: '#534AB7' }} data-testid="badge-will-type">
                  {typeBadgeLabel}
                </span>
              )}
            </div>
          </div>
          <div className="w-11" />
        </div>

        {/* ── Commitment card ──────────────────────────────────────────────── */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5" data-testid="card-commitment">
          {/* Creator row */}
          <div className="flex items-center gap-3 pb-3">
            <div className="relative flex-shrink-0">
              <div
                className="w-9 h-9 rounded-full flex items-center justify-center text-white text-sm font-semibold"
                style={{ backgroundColor: avatarColor(will.createdBy) }}
                data-testid="avatar-creator"
              >
                {getInitials(will.creatorName)}
              </div>
              <span className="absolute -top-1 -right-1 text-[12px] leading-none">👑</span>
            </div>
            <div>
              <p className="text-sm font-semibold text-gray-900" data-testid="text-creator-name">{creatorHandle}</p>
              <p className="text-xs text-gray-400">Creator · {will.daysIn} days in</p>
            </div>
          </div>
          <div className="border-t border-gray-100 mb-3" />
          {/* WILL label */}
          <p
            className="text-[11px] font-bold tracking-[0.12em] uppercase mb-2"
            style={{
              color: category === 'recurring' ? '#1D9E75'
                   : category === 'duration'  ? '#1D6FBE'
                   : category === 'event'     ? '#534AB7'
                   : '#1D9E75'
            }}
            data-testid="label-will-owner"
          >
            WILL
          </p>
          {/* Commitment text */}
          <p className="text-base font-semibold text-gray-900 leading-snug" data-testid="text-commitment">
            "{will.what}"
          </p>
        </div>

        {/* ── 3 Stat boxes ─────────────────────────────────────────────────── */}
        <div className="grid grid-cols-3 gap-2" data-testid="row-stats">
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm text-center py-3 px-1">
            <div className="text-lg font-bold text-gray-900" data-testid="stat-days-in">{will.daysIn}</div>
            <div className="text-[11px] text-gray-400">days in</div>
          </div>
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm text-center py-3 px-1">
            {successRate !== null ? (
              <div className="text-lg font-bold" style={{ color: '#1D9E75' }} data-testid="stat-success-rate">{successRate}%</div>
            ) : (
              <div className="text-lg font-bold text-gray-300">—</div>
            )}
            <div className="text-[11px] text-gray-400">success rate</div>
          </div>
          <button
            onClick={() => setShowJoinersModal(true)}
            className="bg-white rounded-2xl border border-gray-100 shadow-sm text-center py-3 px-1 flex flex-col items-center justify-center active:opacity-70 transition-opacity"
            data-testid="stat-joined"
          >
            <div className="flex items-center gap-0.5">
              <span className="text-lg font-bold text-gray-900">{will.memberCount}</span>
              <ChevronRight className="w-3.5 h-3.5 text-gray-400 mt-0.5" />
            </div>
            <div className="text-[11px] text-gray-400">joined</div>
          </button>
        </div>

        {/* ── Progress section ─────────────────────────────────────────────── */}
        {category === 'recurring' ? (
          /* Recurring: 7-day week strip */
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 space-y-3" data-testid="card-progress-recurring">
            <p className="text-[10px] font-semibold uppercase tracking-widest text-gray-400">{will.creatorName}'s Week</p>
            {checkIns.length > 0 && (
              <DayStrip
                startDate={will.startDate}
                endDate={will.endDate ?? null}
                checkIns={checkIns}
              />
            )}
            {progressData?.progress && (
              <p className="text-xs text-gray-400">
                Success rate <span className="font-semibold" style={{ color: '#1D9E75' }}>{Math.round(progressData.progress.successRate)}%</span>
                {' · '}{progressData.progress.checkedInDays} of {progressData.progress.totalDays} days
                {(progressData.progress.streak ?? 0) > 0 && ` · ${progressData.progress.streak}-day streak 🔥`}
              </p>
            )}
          </div>

        ) : category === 'duration' ? (
          /* Duration: ring + calendar grid */
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 space-y-4" data-testid="card-progress-duration">
            <p className="text-[10px] font-semibold uppercase tracking-widest text-gray-400 text-center">Their Progress</p>

            {/* Ring */}
            <div className="flex justify-center">
              <div className="relative" style={{ width: 136, height: 136 }}>
                <svg width="136" height="136" style={{ transform: 'rotate(-90deg)' }}>
                  <circle cx="68" cy="68" r="52" fill="none" stroke="#E5E7EB" strokeWidth="10" />
                  <circle
                    cx="68" cy="68" r="52" fill="none"
                    stroke="#1D6FBE" strokeWidth="10"
                    strokeLinecap="round"
                    strokeDasharray={`${2 * Math.PI * 52}`}
                    strokeDashoffset={`${2 * Math.PI * 52 * (1 - durDaysIn / Math.max(1, durTotalDays))}`}
                    style={{ transition: 'stroke-dashoffset 0.6s ease' }}
                  />
                </svg>
                <div className="absolute inset-0 flex flex-col items-center justify-center" style={{ gap: 0 }}>
                  <span className="text-[11px] text-gray-400" style={{ lineHeight: '1.2' }}>Day</span>
                  <span className="font-bold" style={{ fontSize: 32, lineHeight: '1.05', color: '#1D6FBE' }}>{durDaysIn}</span>
                  <span className="text-[11px] text-gray-400" style={{ lineHeight: '1.2' }}>of {durTotalDays}</span>
                </div>
              </div>
            </div>


            {/* Stat boxes */}
            <div className="grid grid-cols-3 gap-2">
              <div className="text-center py-2 px-1 rounded-xl bg-gray-50">
                <div className="text-base font-bold text-gray-800">{durDaysIn}</div>
                <div className="text-[11px] text-gray-500">days in</div>
              </div>
              <div className="text-center py-2 px-1 rounded-xl bg-gray-50">
                <div className="text-base font-bold text-gray-800">{durDaysLeft}</div>
                <div className="text-[11px] text-gray-500">days left</div>
              </div>
              <div className="text-center py-2 px-1 rounded-xl bg-gray-50">
                <div className="text-base font-bold" style={{ color: durMissedCount > 0 ? '#E24B4A' : '#1F2937' }}>{durMissedCount}</div>
                <div className="text-[11px] text-gray-500">missed</div>
              </div>
            </div>

            {/* Grid calendar */}
            {durCalendarDays.length > 0 && (
              <div>
                <div className="border-t border-gray-100 mb-3" />
                <div className="grid grid-cols-7 mb-1.5">
                  {['M','T','W','T','F','S','S'].map((h, i) => (
                    <div key={i} className="text-center text-[10px] font-semibold text-gray-400">{h}</div>
                  ))}
                </div>
                <div className="grid grid-cols-7 gap-y-1.5">
                  {Array.from({ length: durStartDOW }).map((_, i) => <div key={`pad-${i}`} />)}
                  {durCalendarDays.map((d) => (
                    <div key={d.dayNum} className="flex justify-center">
                      <div
                        className="w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-semibold"
                        style={{
                          backgroundColor:
                            d.status === 'checked-in' ? '#1D9E75'
                            : d.status === 'missed' ? '#FECDD3'
                            : d.status === 'today' ? 'rgba(83,74,183,0.12)'
                            : '#F3F4F6',
                          border:
                            d.status === 'missed' ? '2px solid #E24B4A'
                            : d.status === 'today' ? '2px solid #534AB7'
                            : 'none',
                          color:
                            d.status === 'checked-in' ? '#fff'
                            : d.status === 'missed' ? '#E24B4A'
                            : d.status === 'today' ? '#534AB7'
                            : '#9CA3AF',
                        }}
                      >
                        {d.dayNum}
                      </div>
                    </div>
                  ))}
                </div>
                <div className="flex items-center justify-center gap-4 mt-3">
                  <div className="flex items-center gap-1">
                    <span className="w-2.5 h-2.5 rounded-full inline-block" style={{ backgroundColor: '#1D9E75' }} />
                    <span className="text-[10px] text-gray-500">Done</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <span className="w-2.5 h-2.5 rounded-full inline-block" style={{ backgroundColor: '#FECDD3', border: '1.5px solid #E24B4A' }} />
                    <span className="text-[10px] text-gray-500">Missed</span>
                  </div>
                </div>
              </div>
            )}
          </div>

        ) : category === 'event' ? (
          /* Event: Deadline Arc */
          will.status === 'completed' ? (
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 flex items-center justify-center gap-2" data-testid="card-progress-event">
              <CheckCircle style={{ width: 20, height: 20, color: '#1D9E75' }} />
              <span className="text-sm font-semibold" style={{ color: '#085041' }}>Completed</span>
            </div>
          ) : will.startDate && will.endDate ? (
            <DeadlineArc startDate={will.startDate} endDate={will.endDate} />
          ) : (
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 flex items-center justify-center" data-testid="card-progress-event">
              <span className="text-sm font-semibold text-gray-600">Still going</span>
            </div>
          )
        ) : null}

        {/* ── Push card ────────────────────────────────────────────────────── */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 space-y-3" data-testid="card-push">
          {/* Push count row */}
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-semibold text-gray-900">
                <Zap className="inline w-4 h-4 mr-0.5 -mt-0.5" style={{ color: '#F59E0B' }} />
                {pushCount} {pushCount === 1 ? 'person' : 'people'} pushed {creatorHandle}
              </p>
              <p className="text-xs text-gray-400 mt-0.5">Pushes · all time</p>
            </div>
            {/* Stacked pusher avatars */}
            {recentPushers.length > 0 && (
              <div className="flex -space-x-2 flex-shrink-0">
                {recentPushers.map((p, i) => (
                  <div
                    key={i}
                    className="w-7 h-7 rounded-full border-2 border-white flex items-center justify-center text-white text-[11px] font-semibold"
                    style={{ backgroundColor: avatarColor(p.userId) }}
                    title={p.user?.firstName}
                  >
                    {getInitials(p.user?.firstName || '?')}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Push button — inline in card, not owner only */}
          {!will.isOwner && (
            <button
              onClick={() => { if (!alreadyPushed && !pushMutation.isPending) pushMutation.mutate(); }}
              disabled={alreadyPushed || pushMutation.isPending}
              className="w-full flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-semibold transition-opacity active:opacity-80"
              style={{
                backgroundColor: alreadyPushed ? '#E5E7EB' : '#534AB7',
                color: alreadyPushed ? '#6B7280' : '#fff',
              }}
              data-testid="button-push"
            >
              <Zap className={cn("w-4 h-4", alreadyPushed ? "" : "fill-white text-white")} />
              {alreadyPushed ? 'Pushed ✓' : `Push ${creatorHandle}`}
            </button>
          )}
        </div>

        {/* ── Hub Chat card ────────────────────────────────────────────────── */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4" data-testid="card-hub-chat">
          <div className="flex items-center justify-between mb-3">
            <p className="text-[10px] font-semibold uppercase tracking-widest text-gray-400">Hub Chat</p>
            {msgTotal > 0 && (
              <span className="text-xs text-gray-400">{msgTotal} {msgTotal === 1 ? 'message' : 'messages'}</span>
            )}
          </div>

          {msgPreview.length > 0 ? (
            <div className="space-y-3">
              {msgPreview.map((msg) => (
                <div key={msg.id} className="flex items-start gap-2.5">
                  <div
                    className="w-7 h-7 rounded-full flex items-center justify-center text-white text-[11px] font-semibold flex-shrink-0 mt-0.5"
                    style={{ backgroundColor: avatarColor(msg.userId) }}
                  >
                    {getInitials(msg.user.firstName)}
                  </div>
                  <div>
                    <span className="text-xs font-semibold text-gray-700">@{msg.user.firstName.toLowerCase()}</span>
                    <p className="text-sm text-gray-600 leading-snug">{msg.text}</p>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-gray-400 text-center py-2">No messages yet. Be the first!</p>
          )}

          <button
            onClick={() => setLocation(`/will/${willId}/messages?from=public`)}
            className="w-full flex items-center justify-center gap-1 mt-4 py-2 text-sm font-medium transition-opacity active:opacity-70"
            style={{ color: '#534AB7' }}
            data-testid="button-see-all-messages"
          >
            See all {msgTotal > 0 ? msgTotal : ''} messages
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>

      </div>

      {/* ── Bottom bar ──────────────────────────────────────────────────────── */}
      {will.isOwner ? (
        <div
          className="fixed bottom-0 left-0 right-0 bg-emerald-50 border-t border-emerald-100 px-4 flex items-center justify-center gap-2"
          style={{ paddingTop: 12, paddingBottom: 'max(12px, env(safe-area-inset-bottom))' }}
        >
          <CheckCircle className="w-4 h-4 text-emerald-600" />
          <span className="text-sm font-medium text-emerald-700">Your Will</span>
        </div>
      ) : will.hasJoined ? (
        <div
          className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-100 px-4"
          style={{ paddingTop: 12, paddingBottom: 'max(12px, env(safe-area-inset-bottom))' }}
        >
          <div className="flex items-center justify-center gap-2 py-3 rounded-2xl bg-emerald-50" data-testid="label-joined">
            <CheckCircle className="w-5 h-5 text-emerald-600" />
            <span className="text-sm font-semibold text-emerald-700">You're in ✓</span>
          </div>
        </div>
      ) : (
        <div
          className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-100 px-4"
          style={{ paddingTop: 12, paddingBottom: 'max(12px, env(safe-area-inset-bottom))' }}
        >
          <button
            onClick={() => setLocation(`/explore/join/${willId}`)}
            className="w-full flex items-center justify-center gap-2 py-4 rounded-2xl text-base font-semibold text-white transition-opacity active:opacity-80"
            style={{ backgroundColor: '#534AB7' }}
            data-testid="button-join"
          >
            Join Will
          </button>
        </div>
      )}

      {/* ── Joiners modal ────────────────────────────────────────────────────── */}
      {showJoinersModal && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center"
          style={{ backgroundColor: 'rgba(0,0,0,0.4)' }}
          onClick={() => setShowJoinersModal(false)}
        >
          <div
            className="relative w-full max-w-md bg-white rounded-t-2xl p-5 pb-[calc(env(safe-area-inset-bottom)+1.5rem)]"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-base font-semibold text-gray-900">Who's joined</h2>
              <button onClick={() => setShowJoinersModal(false)} className="text-gray-400 text-sm">Close</button>
            </div>
            <div className="space-y-3 max-h-80 overflow-y-auto">
              {participants.map((p) => (
                <div key={p.id} className="flex items-center gap-3">
                  <div
                    className="w-9 h-9 rounded-full flex items-center justify-center text-white text-sm font-semibold flex-shrink-0"
                    style={{ backgroundColor: avatarColor(p.id) }}
                  >
                    {getInitials(p.firstName)}
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-gray-900">@{p.firstName.toLowerCase()}</p>
                    {p.joinDate && (
                      <p className="text-xs text-gray-400">Joined {formatJoinDate(p.joinDate)}</p>
                    )}
                  </div>
                  {p.id === will.createdBy && (
                    <span className="ml-auto text-xs font-medium px-2 py-0.5 rounded-full bg-amber-50 text-amber-600">Creator</span>
                  )}
                </div>
              ))}
              {participants.length === 0 && (
                <p className="text-sm text-gray-400 text-center py-4">No participants yet.</p>
              )}
            </div>
          </div>
        </div>
      )}
    </MobileLayout>
  );
}
