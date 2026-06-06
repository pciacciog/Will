import { useState, useRef, memo, useCallback, useEffect } from "react";
import { useLocation } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { getQueryFn, queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import {
  ArrowLeft, Bell, BellOff, Users, UserPlus, UserCheck,
  Camera, FileCheck, Zap, CheckCircle2, ClipboardList,
  MessageCircle, Trash2, Star,
} from "lucide-react";
import { formatDistanceToNow, isToday, differenceInDays } from "date-fns";

type InAppNotification = {
  id: number;
  type: string;
  title: string | null;
  body: string | null;
  deepLink: string | null;
  willId: number | null;
  isRead: boolean;
  createdAt: string;
  inviteStatus: "pending" | "accepted" | "declined" | "expired" | null;
};

type NotifResponse = {
  notifications: InAppNotification[];
  unreadCount: number;
};

// ─── Helpers ───────────────────────────────────────────────────────────────

const TYPE_LABEL: Record<string, string> = {
  team_will_invite:    "New Team Will invite",
  will_review_required:"Time to review your Will",
  review_required:     "Time to review your Will",
  friend_request:      "New friend request",
  friend_accepted:     "Friend request accepted",
  proof_dropped:       "New proof shared",
  review_submitted:    "Review submitted",
  will_started:        "Will started",
  will_proposed:       "New Will proposed",
  team_checkin:        "Team check-in",
  circle_message:      "New circle message",
  will_message:        "New message",
  invite_declined:     "Invite declined",
  will_completed:      "Will completed",
  midpoint_reminder:   "Halfway there",
  daily_checkin:       "Daily check-in reminder",
  motivational:        "Motivational reminder",
};

function typeLabel(type: string): string {
  return TYPE_LABEL[type] ?? "Notification";
}

const EMOJI_RE = /\p{Extended_Pictographic}/gu;
function stripEmoji(s: string): string {
  return s.replace(EMOJI_RE, "").replace(/\s{2,}/g, " ").trim();
}

function cleanTitle(title: string | null, type: string): string {
  if (!title) return typeLabel(type);
  const stripped = stripEmoji(title).trim();
  return stripped || typeLabel(type);
}

function TypeIcon({ type }: { type: string }) {
  const base = "w-5 h-5 flex-shrink-0";
  switch (type) {
    case "team_will_invite":
      return (
        <div className="w-9 h-9 rounded-xl bg-emerald-100 flex items-center justify-center flex-shrink-0">
          <Users className={`${base} text-emerald-600`} />
        </div>
      );
    case "friend_request":
      return (
        <div className="w-9 h-9 rounded-xl bg-blue-100 flex items-center justify-center flex-shrink-0">
          <UserPlus className={`${base} text-blue-600`} />
        </div>
      );
    case "friend_accepted":
      return (
        <div className="w-9 h-9 rounded-xl bg-purple-100 flex items-center justify-center flex-shrink-0">
          <UserCheck className={`${base} text-purple-600`} />
        </div>
      );
    case "proof_dropped":
      return (
        <div className="w-9 h-9 rounded-xl bg-amber-100 flex items-center justify-center flex-shrink-0">
          <Camera className={`${base} text-amber-600`} />
        </div>
      );
    case "review_submitted":
      return (
        <div className="w-9 h-9 rounded-xl bg-teal-100 flex items-center justify-center flex-shrink-0">
          <FileCheck className={`${base} text-teal-600`} />
        </div>
      );
    case "will_started":
      return (
        <div className="w-9 h-9 rounded-xl bg-green-100 flex items-center justify-center flex-shrink-0">
          <Zap className={`${base} text-green-600`} />
        </div>
      );
    case "team_checkin":
      return (
        <div className="w-9 h-9 rounded-xl bg-cyan-100 flex items-center justify-center flex-shrink-0">
          <CheckCircle2 className={`${base} text-cyan-600`} />
        </div>
      );
    case "will_review_required":
    case "review_required":
      return (
        <div className="w-9 h-9 rounded-xl bg-orange-100 flex items-center justify-center flex-shrink-0">
          <ClipboardList className={`${base} text-orange-500`} />
        </div>
      );
    case "circle_message":
    case "will_message":
      return (
        <div className="w-9 h-9 rounded-xl bg-indigo-100 flex items-center justify-center flex-shrink-0">
          <MessageCircle className={`${base} text-indigo-500`} />
        </div>
      );
    case "will_completed":
      return (
        <div className="w-9 h-9 rounded-xl bg-yellow-100 flex items-center justify-center flex-shrink-0">
          <Star className={`${base} text-yellow-500`} />
        </div>
      );
    default:
      return (
        <div className="w-9 h-9 rounded-xl bg-gray-100 flex items-center justify-center flex-shrink-0">
          <Bell className={`${base} text-gray-500`} />
        </div>
      );
  }
}

function groupByRecency(notifications: InAppNotification[]) {
  const today: InAppNotification[] = [];
  const thisWeek: InAppNotification[] = [];
  const earlier: InAppNotification[] = [];
  const now = new Date();
  for (const n of notifications) {
    const d = new Date(n.createdAt);
    if (isToday(d)) {
      today.push(n);
    } else if (differenceInDays(now, d) < 7) {
      thisWeek.push(n);
    } else {
      earlier.push(n);
    }
  }
  return { today, thisWeek, earlier };
}

// ─── Panel width (card slides this far to reveal the delete zone) ───────────
const PANEL_W = 80;

// ─── NotifCard — MUST be top-level so React never unmounts it on parent re-render ─
interface NotifCardProps {
  n: InAppNotification;
  x: number;
  isTouching: boolean;
  onTouchStart: (id: number, cx: number, cy: number) => void;
  onTouchMove: (id: number, cx: number, cy: number) => void;
  onTouchEnd: (id: number) => void;
  onTap: (n: InAppNotification) => void;
}

const NotifCard = memo(function NotifCard({
  n, x, isTouching,
  onTouchStart, onTouchMove, onTouchEnd, onTap,
}: NotifCardProps) {
  const cardBg = n.isRead
    ? "bg-white border border-gray-100"
    : "bg-emerald-50 border border-emerald-100";

  return (
    <div className="relative overflow-hidden rounded-2xl">
      {/* Fixed-width delete zone — always PANEL_W px on the right */}
      <div
        className="absolute inset-y-0 right-0 flex items-center justify-center bg-red-500"
        style={{ width: PANEL_W }}
      >
        <Trash2 className="w-6 h-6 text-white" />
      </div>

      {/* Swipeable card */}
      <div
        style={{
          transform: `translateX(${x}px)`,
          transition: isTouching ? "none" : "transform 0.28s ease",
        }}
        onTouchStart={(e) => onTouchStart(n.id, e.touches[0].clientX, e.touches[0].clientY)}
        onTouchMove={(e) => onTouchMove(n.id, e.touches[0].clientX, e.touches[0].clientY)}
        onTouchEnd={() => onTouchEnd(n.id)}
        onClick={() => { if (Math.abs(x) < 8) onTap(n); }}
        data-testid={`notif-item-${n.id}`}
        className={`w-full text-left cursor-pointer rounded-2xl px-4 py-3 flex items-start gap-3 transition-colors duration-150 ${cardBg}`}
      >
        <TypeIcon type={n.type} />

        <div className="flex-1 min-w-0">
          <p
            className={`text-[14px] leading-snug ${
              n.isRead ? "text-gray-700" : "text-gray-900 font-semibold"
            }`}
          >
            {cleanTitle(n.title, n.type)}
          </p>
          {n.body && (
            <p className="text-[12px] leading-snug mt-0.5 line-clamp-2 text-gray-500">
              {stripEmoji(n.body).trim() || undefined}
            </p>
          )}

          <p className="text-[11px] text-gray-400 mt-1">
            {formatDistanceToNow(new Date(n.createdAt), { addSuffix: true })}
          </p>
        </div>

        {!n.isRead && (
          <div className="w-2 h-2 rounded-full bg-emerald-500 flex-shrink-0 mt-1.5" />
        )}
      </div>
    </div>
  );
});

// ─── Page ──────────────────────────────────────────────────────────────────

export default function NotificationsPage() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();

  // Swipe state
  const touchStartX = useRef<Record<number, number>>({});
  const touchStartY = useRef<Record<number, number>>({});
  const isScrolling = useRef<Record<number, boolean | null>>({});
  const [swipeX, setSwipeX] = useState<Record<number, number>>({});
  const [touchingId, setTouchingId] = useState<number | null>(null);
  const [dismissingIds, setDismissingIds] = useState<Set<number>>(new Set());

  const { data, isLoading } = useQuery<NotifResponse>({
    queryKey: ["/api/notifications"],
    queryFn: getQueryFn({ on401: "returnNull" }),
    staleTime: 0,
    refetchInterval: 30000,
  });

  // ── On mount: reconcile stale review alerts ───────────────────────────────
  // Any review-required notification whose underlying review is already done
  // gets silently deleted so it never shows as a dead-end action item.
  useEffect(() => {
    if (!data?.notifications) return;
    const staleReviewTypes = new Set(["will_review_required", "review_required"]);
    const reviewAlerts = data.notifications.filter(
      (n) => staleReviewTypes.has(n.type) && n.willId != null
    );
    if (reviewAlerts.length === 0) return;

    (async () => {
      const toDelete: number[] = [];
      await Promise.all(
        reviewAlerts.map(async (n) => {
          try {
            const res = await fetch(`/api/wills/${n.willId}/review-status`, { credentials: "include" });
            if (res.ok) {
              const { hasReviewed } = await res.json();
              if (hasReviewed) toDelete.push(n.id);
            }
          } catch (_) { /* non-critical */ }
        })
      );
      if (toDelete.length === 0) return;
      await Promise.all(
        toDelete.map((id) =>
          apiRequest(`/api/notifications/${id}`, { method: "DELETE" }).catch(() => {})
        )
      );
      queryClient.invalidateQueries({ queryKey: ["/api/notifications"] });
      queryClient.invalidateQueries({ queryKey: ["/api/notifications/unread-count"] });
      queryClient.invalidateQueries({ queryKey: ["/api/home-alerts"] });
    })();
  }, [data?.notifications]);

  const markReadMutation = useMutation({
    mutationFn: (id: number) =>
      apiRequest(`/api/notifications/${id}/read`, { method: "PATCH" }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/notifications"] });
      queryClient.invalidateQueries({ queryKey: ["/api/notifications/unread-count"] });
    },
  });

  const dismissMutation = useMutation({
    mutationFn: (id: number) =>
      apiRequest(`/api/notifications/${id}`, { method: "DELETE" }),
    onMutate: (id: number) => {
      setDismissingIds((prev) => new Set(prev).add(id));
      return { id };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/notifications"] });
      queryClient.invalidateQueries({ queryKey: ["/api/notifications/unread-count"] });
    },
    onError: (_err, _id, context) => {
      if (context?.id !== undefined) {
        setDismissingIds((prev) => {
          const next = new Set(prev);
          next.delete(context.id);
          return next;
        });
        setSwipeX((prev) => ({ ...prev, [context.id]: 0 }));
      }
      toast({ title: "Couldn't remove alert", variant: "destructive" });
    },
  });

  const clearAllMutation = useMutation({
    mutationFn: () => apiRequest("/api/notifications", { method: "DELETE" }),
    onMutate: () => {
      queryClient.setQueryData(["/api/notifications"], { notifications: [], unreadCount: 0 });
      queryClient.setQueryData(["/api/notifications/unread-count"], { count: 0 });
      setDismissingIds(new Set());
      setSwipeX({});
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/notifications"] });
      queryClient.invalidateQueries({ queryKey: ["/api/notifications/unread-count"] });
    },
    onError: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/notifications"] });
      queryClient.invalidateQueries({ queryKey: ["/api/notifications/unread-count"] });
      toast({ title: "Couldn't clear alerts — please try again", variant: "destructive" });
    },
  });

  // ── Swipe handlers ────────────────────────────────────────────────────────

  const onTouchStart = useCallback((id: number, cx: number, cy: number) => {
    setTouchingId(id);
    touchStartX.current[id] = cx;
    touchStartY.current[id] = cy;
    isScrolling.current[id] = null;
  }, []);

  const onTouchMove = useCallback((id: number, cx: number, cy: number) => {
    const dx = cx - (touchStartX.current[id] ?? cx);
    const dy = cy - (touchStartY.current[id] ?? cy);

    if (isScrolling.current[id] === null && (Math.abs(dx) > 4 || Math.abs(dy) > 4)) {
      isScrolling.current[id] = Math.abs(dy) > Math.abs(dx);
    }
    if (isScrolling.current[id]) return;

    if (dx < 0) {
      setSwipeX((prev) => ({ ...prev, [id]: Math.max(-PANEL_W, dx) }));
    }
  }, []);

  const triggerDismiss = useCallback((id: number) => {
    setSwipeX((prev) => ({ ...prev, [id]: -600 }));
    setTimeout(() => dismissMutation.mutate(id), 300);
  }, [dismissMutation]);

  const onTouchEnd = useCallback((id: number) => {
    setTouchingId(null);
    if (isScrolling.current[id]) {
      isScrolling.current[id] = null;
      return;
    }
    isScrolling.current[id] = null;
    const x = swipeX[id] ?? 0;
    if (x <= -(PANEL_W * 0.6)) {
      triggerDismiss(id);
    } else {
      setSwipeX((prev) => ({ ...prev, [id]: 0 }));
    }
  }, [swipeX, triggerDismiss]);

  // ── Tap (navigate + mark read) ────────────────────────────────────────────

  const handleTap = useCallback(async (n: InAppNotification) => {
    const isReviewAlert = n.type === "will_review_required" || n.type === "review_required";

    if (isReviewAlert && n.willId) {
      // Guard: check whether the review has already been submitted before navigating
      try {
        const res = await fetch(`/api/wills/${n.willId}/review-status`, { credentials: "include" });
        if (res.ok) {
          const { hasReviewed } = await res.json();
          if (hasReviewed) {
            // Stale alert — silently delete it and show a brief toast
            dismissMutation.mutate(n.id);
            toast({ title: "Already done", description: "This review has already been completed.", duration: 3000 });
            queryClient.invalidateQueries({ queryKey: ["/api/home-alerts"] });
            return;
          }
        }
      } catch (_) { /* non-critical — fall through to normal navigation */ }
    }

    if (!n.isRead) markReadMutation.mutate(n.id);
    if (n.deepLink) {
      setLocation(n.deepLink);
    } else if (n.type === "team_will_invite" && n.willId) {
      setLocation(`/will/${n.willId}`);
    }
  }, [markReadMutation, dismissMutation, setLocation, toast]);

  // ── Derived ───────────────────────────────────────────────────────────────

  const rawNotifications = data?.notifications ?? [];
  const unreadCount = data?.unreadCount ?? 0;
  const notifications = rawNotifications.filter((n) => !dismissingIds.has(n.id));
  const groups = groupByRecency(notifications);
  const hasAny = notifications.length > 0;

  // ── Render a group section ─────────────────────────────────────────────────

  function renderSection(label: string, items: InAppNotification[]) {
    if (items.length === 0) return null;
    return (
      <div className="mb-4">
        <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wide px-1 mb-1.5">
          {label}
        </p>
        <div className="space-y-1.5">
          {items.map((n) => (
            <NotifCard
              key={n.id}
              n={n}
              x={swipeX[n.id] ?? 0}
              isTouching={touchingId === n.id}
              onTouchStart={onTouchStart}
              onTouchMove={onTouchMove}
              onTouchEnd={onTouchEnd}
              onTap={handleTap}
            />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-emerald-50/30">
      <div className="pt-[calc(env(safe-area-inset-top)+1rem)] pb-[calc(env(safe-area-inset-bottom)+1.5rem)] min-h-screen flex flex-col">
        <div className="max-w-sm mx-auto px-5 w-full flex-1 flex flex-col">

          {/* Header */}
          <div className="flex items-center justify-between mb-5">
            <button
              onClick={() => setLocation("/")}
              className="flex items-center gap-1.5 text-gray-500 hover:text-gray-800 transition-colors"
              data-testid="button-back"
            >
              <ArrowLeft className="w-4 h-4" />
              <span className="text-[14px]">Back</span>
            </button>

            <div className="flex items-center gap-2">
              <Bell className="w-4 h-4 text-gray-700" />
              <span className="text-[16px] font-bold text-gray-900">Alerts</span>
              {unreadCount > 0 && (
                <span className="bg-emerald-500 text-white text-[11px] font-bold rounded-full px-1.5 py-0.5 leading-none">
                  {unreadCount}
                </span>
              )}
            </div>

            {hasAny ? (
              <button
                onClick={() => clearAllMutation.mutate()}
                disabled={clearAllMutation.isPending}
                className="flex items-center gap-1 text-[13px] text-red-400 hover:text-red-600 transition-colors disabled:opacity-50"
                data-testid="button-clear-all"
              >
                <Trash2 className="w-3.5 h-3.5" />
                Clear all
              </button>
            ) : (
              <div className="w-16" />
            )}
          </div>

          {/* Loading */}
          {isLoading && (
            <div className="flex-1 flex items-center justify-center">
              <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-emerald-500" />
            </div>
          )}

          {/* Empty */}
          {!isLoading && !hasAny && (
            <div className="flex-1 flex flex-col items-center justify-center text-center gap-3">
              <div className="w-14 h-14 rounded-2xl bg-gray-100 flex items-center justify-center">
                <BellOff className="w-6 h-6 text-gray-400" />
              </div>
              <p className="text-[15px] font-semibold text-gray-700">You're all caught up</p>
              <p className="text-[13px] text-gray-400">
                Alerts for invites, friends, and activity will show up here.
              </p>
            </div>
          )}

          {/* Grouped list */}
          {!isLoading && hasAny && (
            <div className="flex-1">
              {renderSection("Today", groups.today)}
              {renderSection("This week", groups.thisWeek)}
              {renderSection("Earlier", groups.earlier)}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
