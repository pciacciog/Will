import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { MobileLayout, UnifiedBackButton } from "@/components/ui/design-system";
import DayStrip from "@/components/DayStrip";
import { Zap, Send, MessageCircle } from "lucide-react";
import type { WillCheckIn } from "@shared/schema";

interface SoloViewerData {
  id: number;
  title: string | null;
  mode: string;
  kind: string;
  status: string;
  startDate: string;
  endDate: string | null;
  isIndefinite: boolean;
  commitmentCategory: string | null;
  checkInType: string;
  creator: { id: string; firstName: string | null; username: string | null };
  checkIns: WillCheckIn[];
  progress: {
    totalDays: number;
    successRate: number;
    yesCount: number;
    partialCount: number;
    noCount: number;
    streak: number;
  };
  daysActive: number;
  isOwner: boolean;
}

interface PushStatus {
  hasUserPushedToday: boolean;
  pushes: { id: number; userId: string; pushedAt: string; user?: { firstName: string | null } }[];
}

export default function SoloWillViewer({ willId }: { willId: number }) {
  const [, navigate] = useLocation();
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [messageText, setMessageText] = useState("");

  const { data: will, isLoading } = useQuery<SoloViewerData>({
    queryKey: [`/api/wills/${willId}/solo-viewer`],
    enabled: !!willId && !!user,
  });

  const { data: pushStatus } = useQuery<PushStatus>({
    queryKey: [`/api/wills/${willId}/push/status`],
    enabled: !!willId && !!user,
  });

  const pushMutation = useMutation({
    mutationFn: () =>
      apiRequest(`/api/wills/${willId}/push`, { method: "POST" }).then(r => r.json()),
    onSuccess: () => {
      toast({ title: "Pushed! 🚀", description: "Your encouragement was sent." });
      queryClient.invalidateQueries({ queryKey: [`/api/wills/${willId}/push/status`] });
    },
    onError: (err: any) => {
      toast({ title: "Already pushed today", description: err?.message ?? "Try again tomorrow.", variant: "destructive" });
    },
  });

  const messageMutation = useMutation({
    mutationFn: (text: string) =>
      apiRequest(`/api/wills/${willId}/messages`, {
        method: "POST",
        body: JSON.stringify({ text }),
      }).then(r => r.json()),
    onSuccess: () => {
      toast({ title: "Message sent 💬" });
      setMessageText("");
    },
    onError: (err: any) => {
      toast({ title: "Error", description: err?.message ?? "Failed to send message.", variant: "destructive" });
    },
  });

  const handleSendMessage = () => {
    const text = messageText.trim();
    if (!text || messageMutation.isPending) return;
    messageMutation.mutate(text);
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-600" />
      </div>
    );
  }

  if (!will) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <p className="text-gray-500 text-sm">Will not found.</p>
      </div>
    );
  }

  const creatorName = will.creator?.firstName || "Someone";
  const hasPushedToday = pushStatus?.hasUserPushedToday ?? false;
  const isTracking = will.checkInType === "daily" || will.checkInType === "specific_days";

  const now = new Date();
  const endDate = will.endDate ? new Date(will.endDate) : null;
  const totalDays = endDate
    ? Math.ceil((endDate.getTime() - new Date(will.startDate).getTime()) / (1000 * 60 * 60 * 24))
    : null;
  const daysLeft = endDate
    ? Math.max(0, Math.ceil((endDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)))
    : null;
  const daysIn = will.daysActive;
  const successRate = will.progress?.successRate ?? 0;

  // SVG progress ring
  const R = 36;
  const circumference = 2 * Math.PI * R;
  const ringPercent = totalDays && totalDays > 0 ? Math.min(100, (daysIn / totalDays) * 100) : 0;
  const strokeDash = (ringPercent / 100) * circumference;

  const statusColors: Record<string, string> = {
    active: "bg-emerald-100 text-emerald-700",
    completed: "bg-blue-100 text-blue-700",
    will_review: "bg-amber-100 text-amber-700",
    paused: "bg-gray-100 text-gray-600",
    terminated: "bg-red-100 text-red-600",
  };

  return (
    <MobileLayout>
      <div className="px-4 pt-4 pb-2">
        <UnifiedBackButton onClick={() => navigate("/")} />
      </div>

      <div className="px-4 pb-10 space-y-4">
        {/* Header: type pill + title */}
        <div>
          <div className="flex items-center gap-2 mb-1.5">
            <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700 tracking-wide uppercase">
              Solo
            </span>
            <span
              className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${statusColors[will.status] ?? "bg-gray-100 text-gray-600"}`}
            >
              {will.status === "will_review" ? "Review" : will.status.charAt(0).toUpperCase() + will.status.slice(1)}
            </span>
          </div>
          <h1 className="text-xl font-bold text-gray-900 leading-snug" data-testid="text-will-title">
            {will.title ?? `I Will`}
          </h1>
        </div>

        {/* Creator row */}
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-emerald-500 flex items-center justify-center flex-shrink-0">
            <span className="text-white font-bold text-sm">
              {(creatorName[0] ?? "?").toUpperCase()}
            </span>
          </div>
          <div>
            <p className="text-sm font-semibold text-gray-900" data-testid="text-creator-name">
              {creatorName}
            </p>
            <p className="text-xs text-gray-400">
              Day {daysIn} in · {will.isIndefinite ? "Ongoing" : totalDays ? `${totalDays} day will` : ""}
            </p>
          </div>
        </div>

        {/* Progress card */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
          <div className="flex items-center gap-5 mb-4">
            {/* Ring */}
            <div className="flex-shrink-0">
              <svg width="88" height="88" viewBox="0 0 88 88">
                <circle cx="44" cy="44" r={R} fill="none" stroke="#F3F4F6" strokeWidth="8" />
                <circle
                  cx="44" cy="44" r={R} fill="none"
                  stroke="#10B981"
                  strokeWidth="8"
                  strokeLinecap="round"
                  strokeDasharray={`${strokeDash} ${circumference}`}
                  strokeDashoffset="0"
                  transform="rotate(-90 44 44)"
                />
                <text x="44" y="41" textAnchor="middle" fontSize="14" fontWeight="700" fill="#111827">
                  {totalDays ? Math.min(daysIn, totalDays) : daysIn}
                </text>
                <text x="44" y="56" textAnchor="middle" fontSize="9" fill="#6B7280">
                  {totalDays ? `of ${totalDays}` : "days"}
                </text>
              </svg>
            </div>

            {/* Stat chips */}
            <div className="flex-1 grid grid-cols-2 gap-2.5">
              <div className="bg-gray-50 rounded-xl p-2.5 text-center">
                <div className="text-lg font-bold text-gray-900">{successRate.toFixed(0)}%</div>
                <div className="text-[10px] text-gray-500 mt-0.5">Success rate</div>
              </div>
              <div className="bg-gray-50 rounded-xl p-2.5 text-center">
                <div className="text-lg font-bold text-gray-900">{daysIn}</div>
                <div className="text-[10px] text-gray-500 mt-0.5">Days in</div>
              </div>
              {daysLeft !== null && (
                <div className="bg-gray-50 rounded-xl p-2.5 text-center col-span-2">
                  <div className="text-lg font-bold text-gray-900">{daysLeft}</div>
                  <div className="text-[10px] text-gray-500 mt-0.5">Days remaining</div>
                </div>
              )}
            </div>
          </div>

          {/* Calendar strip */}
          {isTracking && will.checkIns.length > 0 && (
            <div className="border-t border-gray-100 pt-3">
              <DayStrip
                startDate={will.startDate}
                endDate={will.endDate}
                checkIns={will.checkIns}
              />
            </div>
          )}
        </div>

        {/* Encouragement card */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 space-y-3">
          <div className="flex items-center gap-2 mb-0.5">
            <MessageCircle className="w-4 h-4 text-gray-400" />
            <p className="text-sm font-semibold text-gray-700">Send encouragement</p>
          </div>

          {/* Push button */}
          <button
            onClick={() => !hasPushedToday && pushMutation.mutate()}
            disabled={hasPushedToday || pushMutation.isPending}
            className="w-full py-3 rounded-xl font-semibold text-sm flex items-center justify-center gap-2 transition-all active:scale-95 disabled:cursor-default"
            style={{
              background: hasPushedToday ? "#F3F4F6" : "linear-gradient(135deg, #10B981, #059669)",
              color: hasPushedToday ? "#9CA3AF" : "white",
            }}
            data-testid="button-push"
          >
            <Zap className="w-4 h-4" fill={hasPushedToday ? "none" : "currentColor"} />
            {hasPushedToday ? `Pushed ${creatorName} today ✓` : `Push ${creatorName}`}
          </button>

          {/* Message input */}
          <div className="flex gap-2">
            <input
              type="text"
              value={messageText}
              onChange={e => setMessageText(e.target.value)}
              onKeyDown={e => {
                if (e.key === "Enter" && messageText.trim()) handleSendMessage();
              }}
              placeholder={`Message ${creatorName}…`}
              maxLength={500}
              className="flex-1 text-sm px-3 py-2.5 rounded-xl border border-gray-200 bg-gray-50 focus:outline-none focus:ring-2 focus:ring-emerald-300 focus:border-transparent"
              data-testid="input-supporter-message"
            />
            <button
              onClick={handleSendMessage}
              disabled={!messageText.trim() || messageMutation.isPending}
              className="w-10 h-10 rounded-xl bg-emerald-500 flex items-center justify-center flex-shrink-0 disabled:opacity-40 transition-all active:scale-95"
              data-testid="button-send-supporter-message"
            >
              <Send className="w-4 h-4 text-white" />
            </button>
          </div>
        </div>
      </div>
    </MobileLayout>
  );
}
