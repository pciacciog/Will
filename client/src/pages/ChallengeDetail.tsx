import { useState } from "react";
import { useLocation } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { MobileLayout, UnifiedBackButton } from "@/components/ui/design-system";
import { apiRequest } from "@/lib/queryClient";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { ArrowRight, CheckCircle, Trophy } from "lucide-react";

const CORAL = "#D85A30";
const CORAL_LIGHT = "#FAECE7";
const CORAL_DARK = "#712B13";

interface Competitor {
  userId: string;
  firstName: string;
  isCreator: boolean;
  isYou: boolean;
  successRate: number;
  totalDaysCompleted: number;
  totalDays: number;
  score: number;
  willId: number;
}

interface ChallengeData {
  id: number;
  title: string | null;
  what: string;
  visibility: "open" | "private";
  type: string;
  startDate: string;
  endDate: string | null;
  isIndefinite: boolean;
  createdBy: string;
  creatorName: string;
  status: string;
  daysIn: number;
  challengeTotalDays: number | null;
  daysLeft: number | null;
  renderState: "owner" | "participant" | "viewer";
  myWillId: number | null;
  checkedInToday: boolean;
  competitors: Competitor[];
  competitorCount: number;
  blocked?: boolean;
}

function avatarColor(id: string) {
  const palette = ["#534AB7","#1D9E75","#D85A30","#0891B2","#7C3AED","#DC2626","#059669","#D97706"];
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) & 0xfffffff;
  return palette[Math.abs(h) % palette.length];
}

function getInitial(name: string) { return (name || "?").charAt(0).toUpperCase(); }

function Avatar({ userId, firstName, size = 10 }: { userId: string; firstName: string; size?: number }) {
  const sz = `w-${size} h-${size}`;
  return (
    <div
      className={`${sz} rounded-full flex items-center justify-center text-white font-semibold flex-shrink-0`}
      style={{ backgroundColor: avatarColor(userId), fontSize: size <= 8 ? "12px" : "14px" }}
    >
      {getInitial(firstName)}
    </div>
  );
}

function scoreColor(score: number) {
  if (score >= 70) return "#10B981";
  if (score < 50) return "#EF4444";
  return "#534AB7";
}

const RANK_MEDALS: Record<number, string> = { 1: "🥇", 2: "🥈", 3: "🥉" };

function LeaderboardRow({ competitor, rank, onTapProfile }: { competitor: Competitor; rank: number; onTapProfile: (id: string) => void }) {
  const sc = scoreColor(competitor.score);
  const medal = RANK_MEDALS[rank];
  return (
    <div
      className="rounded-2xl p-3 cursor-pointer transition-colors"
      style={{
        border: competitor.isYou ? `1.5px solid ${CORAL}` : "1px solid #F3F4F6",
        backgroundColor: competitor.isYou ? CORAL_LIGHT : "#fff",
      }}
      onClick={() => !competitor.isYou && onTapProfile(competitor.userId)}
      data-testid={`row-competitor-${competitor.userId}`}
    >
      <div className="flex items-center gap-3">
        <span className="text-base w-6 flex-shrink-0 text-center font-semibold">
          {medal ?? <span className="text-sm text-gray-400">{rank}</span>}
        </span>
        <Avatar userId={competitor.userId} firstName={competitor.firstName} size={9} />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-sm font-semibold text-gray-900 truncate">@{competitor.firstName.toLowerCase()}</span>
            {competitor.isYou && (
              <span className="text-[10px] font-medium px-1.5 py-0.5 rounded-full flex-shrink-0" style={{ backgroundColor: CORAL_LIGHT, color: CORAL_DARK }}>
                You
              </span>
            )}
            {competitor.isCreator && !competitor.isYou && (
              <span className="text-[10px] font-medium px-1.5 py-0.5 rounded-full flex-shrink-0" style={{ backgroundColor: CORAL_LIGHT, color: CORAL_DARK }}>
                Creator
              </span>
            )}
          </div>
          <p className="text-xs text-gray-400 mt-0.5">{competitor.successRate}% · {competitor.totalDaysCompleted} days done</p>
        </div>
        <span className="text-sm font-bold flex-shrink-0" style={{ color: sc }}>{competitor.score}</span>
      </div>
      <div className="mt-2 ml-9 h-1.5 bg-gray-100 rounded-full overflow-hidden">
        <div
          className="h-full rounded-full transition-all duration-500"
          style={{ width: `${Math.max(2, competitor.score)}%`, backgroundColor: sc }}
        />
      </div>
    </div>
  );
}

export default function ChallengeDetail({ challengeId }: { challengeId: number }) {
  const [, setLocation] = useLocation();
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [showAllTop4, setShowAllTop4] = useState(false);

  const { data, isLoading } = useQuery<ChallengeData>({
    queryKey: [`/api/wills/challenge/${challengeId}`],
    staleTime: 15000,
    refetchInterval: 30000,
  });

  const joinMutation = useMutation({
    mutationFn: () =>
      apiRequest(`/api/wills/challenge/${challengeId}/join`, { method: "POST" }).then((r) => r.json()),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/wills/challenge/${challengeId}`] });
      toast({ title: "Joined! 🏆", description: "You're now competing. Mark today complete!" });
    },
    onError: (err: any) => {
      toast({ title: "Error", description: err?.message ?? "Could not join.", variant: "destructive" });
    },
  });

  const checkInMutation = useMutation({
    mutationFn: () => {
      const today = new Date().toISOString().split("T")[0];
      return apiRequest(`/api/wills/${data!.myWillId}/check-ins`, {
        method: "POST",
        body: { date: today, status: "yes" },
      }).then((r) => r.json());
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/wills/challenge/${challengeId}`] });
      toast({ title: "Checked in ✓", description: "Score updated. Keep it up!" });
    },
    onError: (err: any) => {
      toast({ title: "Error", description: err?.message ?? "Could not check in.", variant: "destructive" });
    },
  });

  if (isLoading) {
    return (
      <MobileLayout>
        <div className="flex items-center justify-center py-20">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2" style={{ borderColor: CORAL }} />
        </div>
      </MobileLayout>
    );
  }

  if (!data) {
    return (
      <MobileLayout>
        <div className="text-center py-20">
          <p className="text-gray-500">Challenge not found.</p>
          <button onClick={() => setLocation("/")} className="mt-4 text-sm text-blue-500">Go home</button>
        </div>
      </MobileLayout>
    );
  }

  // Blocked state (private challenge, not a participant)
  if (data.blocked) {
    return (
      <MobileLayout>
        <div className="relative flex items-center mb-6 min-h-[44px]">
          <UnifiedBackButton onClick={() => setLocation(-1 as any)} testId="button-back" />
        </div>
        <div className="text-center py-20 px-6">
          <div className="w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4" style={{ backgroundColor: CORAL_LIGHT }}>
            <Trophy className="w-8 h-8" style={{ color: CORAL }} />
          </div>
          <h2 className="text-lg font-semibold text-gray-900 mb-2">This challenge is private.</h2>
          <p className="text-sm text-gray-500">You need an invite link to join.</p>
        </div>
      </MobileLayout>
    );
  }

  const isPrivate = data.visibility === "private";
  const label = isPrivate ? "THE BET" : "THE CHALLENGE";
  const sectionLabel = isPrivate ? "Standings" : "Leaderboard";
  const startedText = isPrivate ? "started this bet" : "started this challenge";
  const creator = data.competitors.find((c) => c.isCreator);

  const top4 = data.competitors.slice(0, 4);
  const overflow = data.competitorCount - 4;

  const formatDate = (d: string) =>
    new Date(d).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });

  const isParticipating = data.renderState === "owner" || data.renderState === "participant";

  return (
    <MobileLayout>
      {/* Header */}
      <div className="relative flex items-center mb-4 min-h-[44px]">
        <UnifiedBackButton onClick={() => setLocation(-1 as any)} testId="button-back" />
        <div className="absolute left-0 right-0 flex justify-center pointer-events-none">
          <span
            className="text-xs font-semibold px-3 py-1 rounded-full"
            style={{ backgroundColor: CORAL_LIGHT, color: CORAL_DARK }}
            data-testid="pill-header"
          >
            Challenge · {isPrivate ? "Private" : "Public"} · Day {data.daysIn}
          </span>
        </div>
      </div>

      {/* Challenge card */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 mb-4" data-testid="card-challenge">
        {creator && (
          <div className="flex items-center gap-2 mb-3">
            <Avatar userId={creator.userId} firstName={creator.firstName} size={8} />
            <div>
              <div className="flex items-center gap-1.5">
                <span className="text-sm font-semibold text-gray-900">@{creator.firstName.toLowerCase()}</span>
                <span className="text-[10px] font-medium px-1.5 py-0.5 rounded-full" style={{ backgroundColor: CORAL_LIGHT, color: CORAL_DARK }}>Creator</span>
              </div>
              <p className="text-xs text-gray-400">{startedText}</p>
            </div>
          </div>
        )}

        <p className="text-[10px] font-bold uppercase tracking-widest mb-2" style={{ color: CORAL }}>
          {label}
        </p>
        <p className="text-base font-semibold text-gray-900 mb-3" data-testid="text-what">{data.what}</p>

        <div className="text-xs text-gray-500 space-y-0.5">
          {data.startDate && (
            <p>{formatDate(data.startDate as string)}{data.endDate ? ` → ${formatDate(data.endDate as string)}` : ""}</p>
          )}
          {data.daysLeft !== null && (
            <p style={{ color: data.daysLeft <= 3 ? CORAL : undefined }}>
              {data.daysLeft === 0 ? "Last day!" : `${data.daysLeft} days left`}
            </p>
          )}
        </div>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-3 gap-2 mb-4" data-testid="row-stats">
        {[
          { label: "Competitors", value: data.competitorCount },
          { label: "Days in", value: data.daysIn },
          { label: "Days left", value: data.daysLeft ?? "∞", urgent: data.daysLeft !== null && data.daysLeft <= 3 },
        ].map((s) => (
          <div key={s.label} className="bg-white rounded-2xl border border-gray-100 shadow-sm p-3 text-center">
            <p
              className="text-xl font-bold"
              style={{ color: s.urgent ? CORAL : "#111827" }}
              data-testid={`stat-${s.label.toLowerCase().replace(/\s+/g, "-")}`}
            >
              {s.value}
            </p>
            <p className="text-[10px] text-gray-400 mt-0.5">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Leaderboard */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 mb-4" data-testid="card-leaderboard">
        <p className="text-sm font-semibold text-gray-700 mb-3">{sectionLabel}</p>
        <div className="space-y-2">
          {top4.map((c, i) => (
            <LeaderboardRow
              key={c.userId}
              competitor={c}
              rank={i + 1}
              onTapProfile={(id) => setLocation(`/profile/${id}`)}
            />
          ))}
          {overflow > 0 && (
            <button
              onClick={() => setLocation(`/challenge/${challengeId}/competitors`)}
              className="w-full py-2.5 rounded-xl text-sm font-medium flex items-center justify-center gap-2 bg-gray-50 border border-gray-100"
              data-testid="button-see-all-competitors"
            >
              <div className="flex -space-x-1.5">
                {data.competitors.slice(4, 7).map((c) => (
                  <div
                    key={c.userId}
                    className="w-6 h-6 rounded-full border-2 border-white flex items-center justify-center text-white font-bold flex-shrink-0"
                    style={{ backgroundColor: avatarColor(c.userId), fontSize: "9px" }}
                  >
                    {getInitial(c.firstName)}
                  </div>
                ))}
              </div>
              <span className="text-gray-500">+ {overflow} more competitors · See all →</span>
            </button>
          )}
        </div>
      </div>

      {/* Check-in CTA (owner/participant) */}
      {isParticipating && (
        <div className="mt-2 pb-6" data-testid="section-checkin">
          {data.checkedInToday ? (
            <div
              className="w-full py-3.5 rounded-2xl flex items-center justify-center gap-2 text-base font-semibold"
              style={{ backgroundColor: "#E6F9F2", color: "#1D9E75" }}
              data-testid="label-checked-in"
            >
              <CheckCircle className="w-5 h-5" />
              Checked in today ✓
            </div>
          ) : (
            <button
              onClick={() => checkInMutation.mutate()}
              disabled={checkInMutation.isPending}
              className="w-full py-3.5 rounded-2xl text-base font-semibold text-white transition-opacity disabled:opacity-60"
              style={{ backgroundColor: CORAL }}
              data-testid="button-check-in"
            >
              {checkInMutation.isPending ? "Saving…" : "Mark today complete"}
            </button>
          )}
        </div>
      )}

      {/* Viewer CTA */}
      {data.renderState === "viewer" && (
        <div className="mt-2 pb-6" data-testid="section-viewer-cta">
          {isPrivate ? (
            <div className="text-center py-4">
              <p className="text-sm text-gray-500">This challenge is private.</p>
            </div>
          ) : (
            <button
              onClick={() => joinMutation.mutate()}
              disabled={joinMutation.isPending}
              className="w-full py-3.5 rounded-2xl text-base font-semibold text-white transition-opacity disabled:opacity-60 flex items-center justify-center gap-2"
              style={{ backgroundColor: CORAL }}
              data-testid="button-join-challenge"
            >
              {joinMutation.isPending ? "Joining…" : "Join Challenge"}
              <ArrowRight className="w-5 h-5" />
            </button>
          )}
        </div>
      )}
    </MobileLayout>
  );
}
