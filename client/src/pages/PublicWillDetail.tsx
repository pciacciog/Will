import { useState } from "react";
import { useParams, useLocation } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { apiRequest } from "@/lib/queryClient";
import { MobileLayout } from "@/components/ui/design-system";
import { useToast } from "@/hooks/use-toast";
import {
  Zap, ChevronRight, CheckCircle, Users, MessageCircle,
  ArrowLeft, Star, XCircle,
} from "lucide-react";
import type { WillCheckIn } from "@shared/schema";
import DayStrip from "@/components/DayStrip";
import DeadlineArc from "@/components/DeadlineArc";
import DailyCheckInModal from "@/components/DailyCheckInModal";
import MemberCard from "@/components/MemberCard";
import type { MemberCardData } from "@/components/MemberCard";
import { cn } from "@/lib/utils";

// ── Types ─────────────────────────────────────────────────────────────────────

type RenderState = 'owner' | 'member' | 'viewer';

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
  renderState: RenderState;
  childWillId?: number;
};

type MyProgress = {
  myWillId: number;
  isOwner: boolean;
  what: string;
  why: string;
  checkInType: string | null;
  commitmentCategory: string | null;
  startDate: string;
  endDate: string | null;
  isIndefinite: boolean | null;
  activeDays: string | null;
  customDays: string | null;
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
  dayCount: number;
  daysLeft: number | null;
};

type MembersData = {
  members: MemberCardData[];
  totalCount: number;
};

type PushStatus = {
  hasUserPushedToday: boolean;
  pushes: { id: number; willId: number; userId: string; pushedAt: string; user: { firstName: string } }[];
};

type MessagesPreview = {
  messages: { id: number; text: string; createdAt: string; userId: string; user: { firstName: string } }[];
  totalCount: number;
};

// ── Helpers ───────────────────────────────────────────────────────────────────

const AVATAR_COLORS = [
  '#7C3AED', '#2563EB', '#059669', '#D97706',
  '#DC2626', '#0891B2', '#65A30D', '#C026D3',
];
function avatarColor(id: string) {
  let hash = 0;
  for (let i = 0; i < id.length; i++) hash = id.charCodeAt(i) + ((hash << 5) - hash);
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
}
function getInitials(name: string) { return (name || '?').charAt(0).toUpperCase(); }
function todayKey() { return new Date().toLocaleDateString('en-CA'); }
function relativeTime(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

// ── Chat Preview Card (shared by both views) ──────────────────────────────────

function ChatPreviewCard({
  totalCount, messages, onOpenChat,
}: {
  totalCount: number;
  messages: MessagesPreview['messages'];
  onOpenChat: () => void;
}) {
  const preview = messages.slice(0, 3);
  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4" data-testid="card-hub-chat">
      <div className="flex items-center justify-between mb-3">
        <p className="text-sm font-semibold text-gray-700 flex items-center gap-1.5">
          <MessageCircle className="w-4 h-4 text-blue-500" />
          Hub Chat
        </p>
        {totalCount > 0 && (
          <span className="text-xs text-gray-400">{totalCount} {totalCount === 1 ? 'message' : 'messages'}</span>
        )}
      </div>

      {preview.length > 0 ? (
        <div className="space-y-2.5 mb-3">
          {preview.map(msg => (
            <div key={msg.id} className="flex items-start gap-2">
              <div
                className="w-6 h-6 rounded-full flex items-center justify-center text-white text-[10px] font-semibold flex-shrink-0 mt-0.5"
                style={{ backgroundColor: avatarColor(msg.userId) }}
              >
                {getInitials(msg.user.firstName)}
              </div>
              <div className="flex-1 min-w-0">
                <span className="text-xs font-semibold text-gray-700">
                  @{msg.user.firstName.toLowerCase()}
                </span>
                <span className="text-gray-400 ml-1 text-[10px]">{relativeTime(msg.createdAt)}</span>
                <p className="text-xs text-gray-600 break-words leading-snug">{msg.text}</p>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <p className="text-sm text-gray-400 text-center py-2 mb-3">No messages yet — be the first!</p>
      )}

      <button
        onClick={onOpenChat}
        className="w-full flex items-center justify-center gap-1 py-2 text-sm font-medium transition-opacity active:opacity-70"
        style={{ color: '#534AB7' }}
        data-testid="button-open-chat"
      >
        {totalCount > 0 ? `See all ${totalCount} messages` : 'Start the conversation'}
        <ChevronRight className="w-4 h-4" />
      </button>
    </div>
  );
}

// ── Viewer View ───────────────────────────────────────────────────────────────

function ViewerView({
  will, members, pushStatus, messagesPreview,
  onJoin, onTeamPush, teamPushPending, onOpenChat,
}: {
  will: PublicWillDetails;
  members: MemberCardData[];
  pushStatus: PushStatus | undefined;
  messagesPreview: MessagesPreview | undefined;
  onJoin: () => void;
  onTeamPush: () => void;
  teamPushPending: boolean;
  onOpenChat: () => void;
}) {
  const [, setLocation] = useLocation();
  const alreadyPushed = pushStatus?.hasUserPushedToday ?? false;
  const topMembers = members.slice(0, 4);

  return (
    <>
      <div
        className="flex-1 overflow-y-auto pb-[calc(env(safe-area-inset-bottom)+80px)]"
        style={{ paddingTop: 12 }}
      >
        <div className="px-4 space-y-4">

          {/* Commitment header card */}
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5" data-testid="card-commitment">
            <div className="flex items-start gap-3">
              <div
                className="w-10 h-10 rounded-full flex items-center justify-center text-white text-sm font-semibold flex-shrink-0"
                style={{ backgroundColor: avatarColor(will.createdBy) }}
              >
                {getInitials(will.creatorName)}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs text-gray-400 mb-0.5">@{will.creatorName.toLowerCase()}</p>
                <p className="text-base font-semibold text-gray-900 leading-snug">I will {will.what}</p>
                <div className="flex items-center flex-wrap gap-2 mt-2">
                  {will.commitmentCategory && (
                    <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-purple-50 text-purple-600 capitalize">
                      {will.commitmentCategory}
                    </span>
                  )}
                  <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-gray-100 text-gray-500">
                    Public Will
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Stats row */}
          <div className="grid grid-cols-3 gap-3">
            <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-3 text-center" data-testid="stat-members">
              <p className="text-xl font-bold text-gray-900">{will.memberCount}</p>
              <p className="text-[11px] text-gray-400 mt-0.5">members</p>
            </div>
            <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-3 text-center" data-testid="stat-days">
              <p className="text-xl font-bold text-gray-900">{will.daysIn}</p>
              <p className="text-[11px] text-gray-400 mt-0.5">days running</p>
            </div>
            <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-3 text-center" data-testid="stat-status">
              <p className="text-base font-bold text-emerald-600 mt-1">●</p>
              <p className="text-[11px] text-gray-400 mt-0.5">
                {will.status === 'active' ? 'active' : will.status ?? 'open'}
              </p>
            </div>
          </div>

          {/* Who's in */}
          {topMembers.length > 0 && (
            <div data-testid="section-members">
              <div className="flex items-center justify-between mb-3">
                <p className="text-sm font-semibold text-gray-700 flex items-center gap-1.5">
                  <Users className="w-4 h-4 text-gray-400" />
                  Who's in ({will.memberCount})
                </p>
                {will.memberCount > 4 && (
                  <button
                    onClick={() => setLocation(`/public-will/${will.id}/members`)}
                    className="text-xs font-medium flex items-center gap-0.5"
                    style={{ color: '#534AB7' }}
                    data-testid="button-see-all-members"
                  >
                    See all <ChevronRight className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
              <div className="space-y-3">
                {topMembers.map(m => <MemberCard key={m.userId} member={m} />)}
                {will.memberCount > 4 && (
                  <button
                    onClick={() => setLocation(`/public-will/${will.id}/members`)}
                    className="w-full py-2.5 rounded-xl text-sm font-medium text-gray-500 bg-gray-50 border border-gray-100"
                    data-testid="button-see-more-members"
                  >
                    + {will.memberCount - 4} more members
                  </button>
                )}
              </div>
            </div>
          )}

          {/* Team Push card */}
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4" data-testid="card-team-push">
            <div className="flex items-center gap-2 mb-1">
              <Zap className="w-4 h-4 text-amber-500" fill="currentColor" />
              <p className="text-sm font-semibold text-gray-700">Team Push</p>
            </div>
            <p className="text-xs text-gray-500 mb-3">
              Encourage everyone in this Will — they'll all get a notification from you.
            </p>
            <button
              onClick={() => !alreadyPushed && !teamPushPending && onTeamPush()}
              disabled={alreadyPushed || teamPushPending}
              className={cn(
                "w-full flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-semibold transition-all",
                alreadyPushed ? "bg-gray-100 text-gray-400" : "text-white active:opacity-80",
              )}
              style={alreadyPushed ? {} : { backgroundColor: '#534AB7' }}
              data-testid="button-team-push"
            >
              <Zap
                className={cn("w-4 h-4", alreadyPushed ? "text-gray-400" : "fill-white text-white")}
              />
              {alreadyPushed ? 'Team Pushed today ✓' : 'Push the whole group ⚡'}
            </button>
          </div>

          {/* Hub Chat preview */}
          {messagesPreview && (
            <ChatPreviewCard
              totalCount={messagesPreview.totalCount}
              messages={messagesPreview.messages}
              onOpenChat={onOpenChat}
            />
          )}
        </div>
      </div>

      {/* Fixed bottom: Join CTA */}
      <div
        className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-100 px-4"
        style={{ paddingTop: 12, paddingBottom: 'max(12px, env(safe-area-inset-bottom))' }}
      >
        <button
          onClick={onJoin}
          className="w-full flex items-center justify-center gap-2 py-4 rounded-2xl text-base font-semibold text-white transition-opacity active:opacity-80"
          style={{ backgroundColor: '#534AB7' }}
          data-testid="button-join"
        >
          Join Will
        </button>
      </div>
    </>
  );
}

// ── Personal View (owner / member) ────────────────────────────────────────────

function PersonalView({
  will, myProgress, members, pushStatus, messagesPreview,
  onOpenChat, onOpenAllMembers,
  checkInOpen, onOpenCheckIn, onCloseCheckIn, checkInDate, onDayClick,
}: {
  will: PublicWillDetails;
  myProgress: MyProgress;
  members: MemberCardData[];
  pushStatus: PushStatus | undefined;
  messagesPreview: MessagesPreview | undefined;
  onOpenChat: () => void;
  onOpenAllMembers: () => void;
  checkInOpen: boolean;
  onOpenCheckIn: (date?: string) => void;
  onCloseCheckIn: () => void;
  checkInDate: string | null;
  onDayClick: (date: string) => void;
}) {
  const { user } = useAuth();
  const [, setLocation] = useLocation();
  const [whyExpanded, setWhyExpanded] = useState(false);

  const todayStr = todayKey();
  const todayCheckIn = myProgress.checkIns.find(c => c.date === todayStr);
  const isCheckedInToday = todayCheckIn?.status === 'yes' || todayCheckIn?.status === 'partial';
  const isDailyTracking = myProgress.checkInType === 'daily' || myProgress.checkInType === 'specific_days';
  const isRecurring = myProgress.commitmentCategory === 'recurring';
  const isDuration = myProgress.commitmentCategory === 'duration';
  const isEvent = myProgress.commitmentCategory === 'event';

  const othersWithMe = members.filter(m => m.userId !== user?.id);
  const topOthers = othersWithMe.slice(0, 3);
  const receievedPushCount = (pushStatus?.pushes ?? []).length;

  const heroGradient = isRecurring
    ? 'from-emerald-500 to-emerald-600'
    : isDuration
    ? 'from-blue-500 to-blue-600'
    : isEvent
    ? 'from-purple-500 to-purple-600'
    : 'from-gray-500 to-gray-600';

  return (
    <>
      <div
        className="flex-1 overflow-y-auto pb-[calc(env(safe-area-inset-bottom)+72px)]"
        style={{ paddingTop: 12 }}
      >
        <div className="px-4 space-y-4">

          {/* Personal hero card */}
          <div
            className={`bg-gradient-to-br ${heroGradient} rounded-2xl p-5 shadow-sm`}
            data-testid="card-personal-hero"
          >
            <div className="flex items-center gap-2 mb-2">
              {isRecurring && <CheckCircle className="w-4 h-4 text-white opacity-80" />}
              {isDuration && <XCircle className="w-4 h-4 text-white opacity-80" />}
              {isEvent && <Star className="w-4 h-4 text-white opacity-80" />}
              <span className="text-white text-xs font-medium opacity-80 capitalize">
                {myProgress.commitmentCategory ?? 'Will'}
              </span>
            </div>
            <p className="text-white font-semibold text-base leading-snug mb-4">
              I will {myProgress.what || will.what}
            </p>

            {isRecurring && isDailyTracking ? (
              isCheckedInToday ? (
                <div className="flex items-center gap-2 bg-white/20 rounded-xl px-4 py-3">
                  <CheckCircle className="w-5 h-5 text-white" />
                  <span className="text-white font-semibold text-sm">Checked in today ✓</span>
                </div>
              ) : (
                <button
                  onClick={() => onOpenCheckIn()}
                  className="w-full flex items-center justify-center gap-2 bg-white rounded-xl py-3 text-sm font-semibold transition-opacity active:opacity-80"
                  style={{ color: '#059669' }}
                  data-testid="button-check-in"
                >
                  <CheckCircle className="w-4 h-4" />
                  Check in for today
                </button>
              )
            ) : isDuration ? (
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-white text-xs opacity-70">Streak</p>
                  <p className="text-white text-2xl font-bold">{myProgress.progress?.streak ?? 0} days</p>
                </div>
                <button
                  onClick={() => setLocation(`/will/${myProgress.myWillId}`)}
                  className="flex items-center gap-1 bg-white/20 text-white text-xs font-medium px-3 py-1.5 rounded-full"
                  data-testid="button-full-view"
                >
                  Check in <ChevronRight className="w-3 h-3" />
                </button>
              </div>
            ) : isEvent ? (
              <button
                onClick={() => setLocation(`/will/${myProgress.myWillId}`)}
                className="w-full flex items-center justify-center gap-2 bg-white/20 text-white rounded-xl py-3 text-sm font-semibold"
                data-testid="button-full-view"
              >
                View full Will <ChevronRight className="w-4 h-4" />
              </button>
            ) : (
              <div className="bg-white/20 rounded-xl px-4 py-3">
                <p className="text-white text-xs opacity-70">Day</p>
                <p className="text-white text-2xl font-bold">{myProgress.dayCount}</p>
              </div>
            )}
          </div>

          {/* Stats row */}
          <div className="grid grid-cols-3 gap-3">
            <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-3 text-center" data-testid="stat-day-in">
              <p className="text-xl font-bold text-gray-900">{myProgress.dayCount}</p>
              <p className="text-[11px] text-gray-400 mt-0.5">day in</p>
            </div>
            <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-3 text-center" data-testid="stat-days-left">
              <p className="text-xl font-bold text-gray-900">
                {myProgress.daysLeft !== null ? myProgress.daysLeft : '∞'}
              </p>
              <p className="text-[11px] text-gray-400 mt-0.5">days left</p>
            </div>
            <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-3 text-center" data-testid="stat-success-rate">
              <p className="text-xl font-bold text-gray-900">
                {Math.round(myProgress.progress?.successRate ?? 0)}%
              </p>
              <p className="text-[11px] text-gray-400 mt-0.5">done</p>
            </div>
          </div>

          {/* DayStrip calendar (only if daily tracking with data) */}
          {isDailyTracking && myProgress.checkIns.length > 0 && (
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4" data-testid="card-calendar">
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">Your Calendar</p>
              <DayStrip
                startDate={myProgress.startDate}
                endDate={myProgress.endDate}
                checkIns={myProgress.checkIns}
                onDayClick={onDayClick}
              />
            </div>
          )}

          {/* DeadlineArc for event wills */}
          {isEvent && myProgress.startDate && myProgress.endDate && (
            <DeadlineArc startDate={myProgress.startDate} endDate={myProgress.endDate} />
          )}

          {/* Why chip */}
          {myProgress.why && (
            <button
              onClick={() => setWhyExpanded(e => !e)}
              className="w-full bg-white rounded-2xl border border-gray-100 shadow-sm p-4 text-left"
              data-testid="card-why"
            >
              <div className="flex items-center justify-between">
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Because</p>
                <ChevronRight
                  className={cn("w-4 h-4 text-gray-400 transition-transform", whyExpanded && "rotate-90")}
                />
              </div>
              {whyExpanded ? (
                <p className="text-sm text-gray-700 mt-2 leading-relaxed">{myProgress.why}</p>
              ) : (
                <p className="text-sm text-gray-500 mt-1 truncate">{myProgress.why}</p>
              )}
            </button>
          )}

          {/* Pushes received */}
          {receievedPushCount > 0 && (
            <div
              className="bg-amber-50 rounded-2xl border border-amber-100 p-4 flex items-center gap-3"
              data-testid="card-pushes-received"
            >
              <Zap className="w-5 h-5 text-amber-500 flex-shrink-0" fill="currentColor" />
              <p className="text-sm text-amber-800">
                <span className="font-semibold">{receievedPushCount}</span>{' '}
                {receievedPushCount === 1 ? 'person has' : 'people have'} pushed this Will today!
              </p>
            </div>
          )}

          {/* Who's with you */}
          {topOthers.length > 0 && (
            <div data-testid="section-members-with-you">
              <div className="flex items-center justify-between mb-3">
                <p className="text-sm font-semibold text-gray-700 flex items-center gap-1.5">
                  <Users className="w-4 h-4 text-gray-400" />
                  Who's with you ({will.memberCount})
                </p>
                <button
                  onClick={onOpenAllMembers}
                  className="text-xs font-medium flex items-center gap-0.5"
                  style={{ color: '#534AB7' }}
                  data-testid="button-see-all-members"
                >
                  See all <ChevronRight className="w-3.5 h-3.5" />
                </button>
              </div>
              <div className="space-y-3">
                {topOthers.map(m => <MemberCard key={m.userId} member={m} />)}
              </div>
            </div>
          )}

          {/* Hub Chat preview */}
          {messagesPreview && (
            <ChatPreviewCard
              totalCount={messagesPreview.totalCount}
              messages={messagesPreview.messages}
              onOpenChat={onOpenChat}
            />
          )}
        </div>
      </div>

      {/* DailyCheckInModal */}
      <DailyCheckInModal
        isOpen={checkInOpen}
        onClose={onCloseCheckIn}
        willId={myProgress.myWillId}
        initialDate={checkInDate}
        commitmentText={myProgress.what || will.what}
        startDate={myProgress.startDate}
        endDate={myProgress.endDate ?? undefined}
        existingCheckIns={myProgress.checkIns}
        checkInType={myProgress.checkInType ?? undefined}
        activeDays={myProgress.activeDays ?? undefined}
        customDays={myProgress.customDays ?? undefined}
      />

      {/* Fixed bottom status bar */}
      <div
        className="fixed bottom-0 left-0 right-0 border-t px-4"
        style={{
          paddingTop: 12,
          paddingBottom: 'max(12px, env(safe-area-inset-bottom))',
          backgroundColor: '#F0FDF4',
          borderColor: '#D1FAE5',
        }}
      >
        <div className="flex items-center justify-center gap-2">
          <CheckCircle className="w-4 h-4 text-emerald-600" />
          <span className="text-sm font-medium text-emerald-700">
            {will.renderState === 'owner' ? 'Your Will' : "You're in ✓"}
          </span>
        </div>
      </div>
    </>
  );
}

// ── Main Component ────────────────────────────────────────────────────────────

export default function PublicWillDetail() {
  const { id } = useParams<{ id: string }>();
  const willId = parseInt(id!);
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const qc = useQueryClient();

  const [checkInOpen, setCheckInOpen] = useState(false);
  const [checkInDate, setCheckInDate] = useState<string | null>(null);

  const { data: will, isLoading } = useQuery<PublicWillDetails>({
    queryKey: [`/api/wills/${willId}/public-details`],
    enabled: !!willId,
    refetchInterval: 30000,
  });

  const { data: membersData } = useQuery<MembersData>({
    queryKey: [`/api/wills/${willId}/members-activity`],
    enabled: !!willId,
    refetchInterval: 60000,
  });

  const { data: pushStatus } = useQuery<PushStatus>({
    queryKey: [`/api/wills/${willId}/push/status`],
    enabled: !!willId,
    refetchInterval: 60000,
  });

  const isParticipant = will?.renderState === 'owner' || will?.renderState === 'member';

  const { data: myProgress } = useQuery<MyProgress>({
    queryKey: [`/api/wills/${willId}/my-public-progress`],
    enabled: !!willId && isParticipant,
    refetchInterval: 30000,
  });

  const { data: messagesPreview } = useQuery<MessagesPreview>({
    queryKey: [`/api/wills/${willId}/public-messages-preview`],
    enabled: !!willId,
    refetchInterval: 30000,
  });

  const teamPushMutation = useMutation({
    mutationFn: () => apiRequest(`/api/wills/${willId}/team-push`, 'POST'),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [`/api/wills/${willId}/push/status`] });
      toast({ title: "Team Push sent! ⚡", description: "Everyone got your encouragement." });
    },
    onError: (err: any) => {
      const msg = String(err?.message || '');
      if (msg.toLowerCase().includes('already')) {
        toast({ title: "Already pushed today", description: "Come back tomorrow!" });
        qc.invalidateQueries({ queryKey: [`/api/wills/${willId}/push/status`] });
      } else {
        toast({ title: "Couldn't send push", description: msg || "Please try again.", variant: "destructive" });
      }
    },
  });

  const handleOpenCheckIn = (date?: string) => {
    setCheckInDate(date ?? null);
    setCheckInOpen(true);
  };

  const handleCloseCheckIn = () => {
    setCheckInOpen(false);
    setCheckInDate(null);
    qc.invalidateQueries({ queryKey: [`/api/wills/${willId}/my-public-progress`] });
  };

  const handleDayClick = (date: string) => handleOpenCheckIn(date);
  const handleOpenChat = () => setLocation(`/will/${willId}/messages?from=public`);
  const handleJoin = () => setLocation(`/explore/join/${willId}`);
  const handleOpenAllMembers = () => setLocation(`/public-will/${willId}/members`);

  const members = membersData?.members ?? [];
  const navTitle = will?.title || (will?.what ? `I will ${will.what}` : 'Public Will');

  if (isLoading || !will) {
    return (
      <MobileLayout>
        <div
          className="sticky top-0 z-20 bg-white/95 backdrop-blur-sm border-b border-gray-100 px-4 py-3 flex items-center gap-3"
          style={{ paddingTop: 'max(12px, env(safe-area-inset-top))' }}
        >
          <button onClick={() => setLocation('/explore')} className="text-gray-600 p-1 -ml-1">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div className="h-4 w-40 bg-gray-200 rounded animate-pulse" />
        </div>
        <div className="p-4 space-y-4">
          {[1, 2, 3].map(i => (
            <div key={i} className="h-24 bg-gray-100 rounded-2xl animate-pulse" />
          ))}
        </div>
      </MobileLayout>
    );
  }

  return (
    <MobileLayout>
      {/* Nav bar */}
      <div
        className="sticky top-0 z-20 bg-white/95 backdrop-blur-sm border-b border-gray-100 px-4 py-3 flex items-center gap-3"
        style={{ paddingTop: 'max(12px, env(safe-area-inset-top))' }}
      >
        <button
          onClick={() => setLocation('/explore')}
          className="text-gray-600 p-1 -ml-1 flex-shrink-0"
          data-testid="button-back"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        <p
          className="flex-1 text-sm font-semibold text-gray-900 truncate"
          data-testid="text-nav-title"
        >
          {navTitle}
        </p>
        {isParticipant ? (
          <button
            onClick={handleOpenAllMembers}
            className="flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-medium bg-gray-100 text-gray-600 flex-shrink-0"
            data-testid="button-members-count"
          >
            <Users className="w-3 h-3" />
            {will.memberCount}
          </button>
        ) : (
          <span
            className="flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-medium bg-gray-100 text-gray-500 flex-shrink-0"
            data-testid="text-members-count"
          >
            <Users className="w-3 h-3" />
            {will.memberCount}
          </span>
        )}
      </div>

      {/* Dispatch to appropriate view */}
      {isParticipant && myProgress ? (
        <PersonalView
          will={will}
          myProgress={myProgress}
          members={members}
          pushStatus={pushStatus}
          messagesPreview={messagesPreview}
          onOpenChat={handleOpenChat}
          onOpenAllMembers={handleOpenAllMembers}
          checkInOpen={checkInOpen}
          onOpenCheckIn={handleOpenCheckIn}
          onCloseCheckIn={handleCloseCheckIn}
          checkInDate={checkInDate}
          onDayClick={handleDayClick}
        />
      ) : (
        <ViewerView
          will={will}
          members={members}
          pushStatus={pushStatus}
          messagesPreview={messagesPreview}
          onJoin={handleJoin}
          onTeamPush={() => teamPushMutation.mutate()}
          teamPushPending={teamPushMutation.isPending}
          onOpenChat={handleOpenChat}
        />
      )}
    </MobileLayout>
  );
}
