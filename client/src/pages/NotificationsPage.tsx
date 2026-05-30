import { useState, useRef } from "react";
import { useLocation } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { getQueryFn, queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import {
  ArrowLeft, Bell, BellOff, Users, UserPlus, UserCheck,
  Camera, FileCheck, Zap, CheckCircle2, ClipboardList,
  MessageCircle, Trash2, Check, X, Star,
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

// Strip all emoji characters from a string
const EMOJI_RE = /\p{Extended_Pictographic}/gu;
function stripEmoji(s: string): string {
  return s.replace(EMOJI_RE, "").replace(/\s{2,}/g, " ").trim();
}

function cleanTitle(title: string | null, type: string): string {
  if (!title) return typeLabel(type);
  const stripped = stripEmoji(title).trim();
  return stripped || typeLabel(type);
}

// Icon + background colour per type
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

// ─── Page ──────────────────────────────────────────────────────────────────

export default function NotificationsPage() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();

  // Swipe state
  const touchStartX = useRef<Record<number, number>>({});
  const [swipeX, setSwipeX] = useState<Record<number, number>>({});
  const [touchingId, setTouchingId] = useState<number | null>(null);
  const [dismissingIds, setDismissingIds] = useState<Set<number>>(new Set());

  // Optimistic invite action state
  const [inviteActions, setInviteActions] = useState<Record<number, "accepted" | "declined">>({});
  const [invitePending, setInvitePending] = useState<Set<number>>(new Set());

  const { data, isLoading } = useQuery<NotifResponse>({
    queryKey: ["/api/notifications"],
    queryFn: getQueryFn({ on401: "returnNull" }),
    staleTime: 0,
    refetchInterval: 30000,
  });

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
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/notifications"] });
      queryClient.invalidateQueries({ queryKey: ["/api/notifications/unread-count"] });
    },
    onError: () => {
      toast({ title: "Couldn't remove alert", variant: "destructive" });
    },
  });

  const clearAllMutation = useMutation({
    mutationFn: () => apiRequest("/api/notifications", { method: "DELETE" }),
    onMutate: () => {
      // Optimistically wipe the list immediately so the UI responds at once
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
      // Roll back optimistic update
      queryClient.invalidateQueries({ queryKey: ["/api/notifications"] });
      queryClient.invalidateQueries({ queryKey: ["/api/notifications/unread-count"] });
      toast({ title: "Couldn't clear alerts — please try again", variant: "destructive" });
    },
  });

  // ── Swipe handlers ────────────────────────────────────────────────────────

  function onTouchStart(id: number, clientX: number) {
    setTouchingId(id);
    touchStartX.current[id] = clientX;
  }

  function onTouchMove(id: number, clientX: number) {
    const dx = clientX - (touchStartX.current[id] ?? clientX);
    if (dx < 0) {
      setSwipeX((prev) => ({ ...prev, [id]: Math.max(-110, dx) }));
    }
  }

  function onTouchEnd(id: number) {
    setTouchingId(null);
    const x = swipeX[id] ?? 0;
    if (x < -80) {
      triggerDismiss(id);
    } else {
      setSwipeX((prev) => ({ ...prev, [id]: 0 }));
    }
  }

  function triggerDismiss(id: number) {
    setDismissingIds((prev) => new Set(prev).add(id));
    setSwipeX((prev) => ({ ...prev, [id]: -500 }));
    setTimeout(() => dismissMutation.mutate(id), 280);
  }

  // ── Tap (navigate + mark read) ────────────────────────────────────────────

  function handleTap(n: InAppNotification) {
    // Don't navigate if it's an invite with inline buttons (or already acted on)
    if (n.type === "team_will_invite") return;
    if (!n.isRead) markReadMutation.mutate(n.id);
    if (n.deepLink) setLocation(n.deepLink);
  }

  // ── Invite actions ─────────────────────────────────────────────────────────

  async function handleInviteAction(n: InAppNotification, action: "accepted" | "declined") {
    if (!n.willId || invitePending.has(n.id)) return;
    setInvitePending((prev) => new Set(prev).add(n.id));
    try {
      const endpoint = action === "accepted"
        ? `/api/wills/${n.willId}/accept-invite`
        : `/api/wills/${n.willId}/decline-invite`;
      await apiRequest(endpoint, { method: "POST" });
      setInviteActions((prev) => ({ ...prev, [n.id]: action }));
      if (!n.isRead) markReadMutation.mutate(n.id);
      if (action === "accepted" && n.willId) {
        setLocation(`/will/${n.willId}/commit`);
      }
    } catch {
      // If already acted (409), still update UI
      setInviteActions((prev) => ({ ...prev, [n.id]: action }));
    } finally {
      setInvitePending((prev) => {
        const s = new Set(prev);
        s.delete(n.id);
        return s;
      });
    }
  }

  const rawNotifications = data?.notifications ?? [];
  const unreadCount = data?.unreadCount ?? 0;

  // Filter out notifications still animating out (dismissing)
  const notifications = rawNotifications.filter((n) => !dismissingIds.has(n.id));
  const groups = groupByRecency(notifications);

  // ── Card ────────────────────────────────────────────────────────────────────

  function NotifCard({ n }: { n: InAppNotification }) {
    const x = swipeX[n.id] ?? 0;
    const isTouching = touchingId === n.id;
    const localAction = inviteActions[n.id];
    const pending = invitePending.has(n.id);
    const isInvite = n.type === "team_will_invite";

    // Derive acted-on state: prefer local optimistic state, fall back to server status
    const serverActed = n.inviteStatus === "accepted" || n.inviteStatus === "declined" || n.inviteStatus === "expired";
    const isActedOn = !!localAction || serverActed;
    const action: "accepted" | "declined" | "expired" | undefined =
      localAction ??
      (n.inviteStatus === "accepted" ? "accepted" :
       n.inviteStatus === "declined" ? "declined" :
       n.inviteStatus === "expired"  ? "expired"  : undefined);

    const cardBg = isActedOn
      ? "bg-gray-50 border border-gray-100"
      : n.isRead
      ? "bg-white border border-gray-100"
      : "bg-emerald-50 border border-emerald-100";

    return (
      <div className="relative overflow-hidden rounded-2xl">
        {/* Dismiss background */}
        <div className="absolute inset-y-0 right-0 flex items-center justify-end px-4 bg-red-500 rounded-2xl min-w-full">
          <Trash2 className="w-5 h-5 text-white" />
        </div>

        {/* Swipeable card */}
        <div
          style={{
            transform: `translateX(${x}px)`,
            transition: isTouching ? "none" : "transform 0.25s ease",
          }}
          onTouchStart={(e) => onTouchStart(n.id, e.touches[0].clientX)}
          onTouchMove={(e) => onTouchMove(n.id, e.touches[0].clientX)}
          onTouchEnd={() => onTouchEnd(n.id)}
          onClick={() => handleTap(n)}
          data-testid={`notif-item-${n.id}`}
          className={`w-full text-left rounded-2xl px-4 py-3 flex items-start gap-3 transition-colors duration-150 ${
            !isInvite && !isActedOn ? "active:scale-[0.98] cursor-pointer" : "cursor-default"
          } ${cardBg}`}
        >
          {/* Icon */}
          <div className={isActedOn ? "opacity-40" : ""}>
            <TypeIcon type={n.type} />
          </div>

          {/* Content */}
          <div className="flex-1 min-w-0">
            <p
              className={`text-[14px] leading-snug ${
                isActedOn
                  ? "text-gray-400"
                  : n.isRead
                  ? "text-gray-700"
                  : "text-gray-900 font-semibold"
              }`}
            >
              {cleanTitle(n.title, n.type)}
            </p>
            {n.body && (
              <p className={`text-[12px] leading-snug mt-0.5 line-clamp-2 ${isActedOn ? "text-gray-400" : "text-gray-500"}`}>
                {stripEmoji(n.body).trim() || undefined}
              </p>
            )}

            {/* Inline Accept / Decline */}
            {isInvite && !isActedOn && n.willId && (
              <div className="flex items-center gap-2 mt-2.5">
                <button
                  onClick={(e) => { e.stopPropagation(); handleInviteAction(n, "accepted"); }}
                  disabled={pending}
                  data-testid={`button-accept-invite-${n.id}`}
                  className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-emerald-500 text-white text-[12px] font-semibold disabled:opacity-50 active:scale-[0.97] transition-transform"
                >
                  <Check className="w-3 h-3" />
                  Accept
                </button>
                <button
                  onClick={(e) => { e.stopPropagation(); handleInviteAction(n, "declined"); }}
                  disabled={pending}
                  data-testid={`button-decline-invite-${n.id}`}
                  className="flex items-center gap-1 px-3 py-1.5 rounded-lg border border-red-300 text-red-500 text-[12px] font-semibold disabled:opacity-50 active:scale-[0.97] transition-transform"
                >
                  <X className="w-3 h-3" />
                  Decline
                </button>
              </div>
            )}

            {/* Acted-on state */}
            {isInvite && isActedOn && (
              <p className="text-[11px] text-gray-400 mt-1 flex items-center gap-1">
                {action === "accepted" ? (
                  <><Check className="w-3 h-3 text-emerald-400" /> Accepted</>
                ) : action === "expired" ? (
                  <><X className="w-3 h-3 text-gray-400" /> Expired</>
                ) : (
                  <><X className="w-3 h-3 text-gray-400" /> Declined</>
                )}
              </p>
            )}

            <p className="text-[11px] text-gray-400 mt-1">
              {formatDistanceToNow(new Date(n.createdAt), { addSuffix: true })}
            </p>
          </div>

          {/* Unread dot */}
          {!n.isRead && !isActedOn && (
            <div className="w-2 h-2 rounded-full bg-emerald-500 flex-shrink-0 mt-1.5" />
          )}
        </div>
      </div>
    );
  }

  function Section({ label, items }: { label: string; items: InAppNotification[] }) {
    if (items.length === 0) return null;
    return (
      <div className="mb-4">
        <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wide px-1 mb-1.5">
          {label}
        </p>
        <div className="space-y-1.5">
          {items.map((n) => (
            <NotifCard key={n.id} n={n} />
          ))}
        </div>
      </div>
    );
  }

  const hasAny = notifications.length > 0;

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
              <Section label="Today" items={groups.today} />
              <Section label="This week" items={groups.thisWeek} />
              <Section label="Earlier" items={groups.earlier} />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
