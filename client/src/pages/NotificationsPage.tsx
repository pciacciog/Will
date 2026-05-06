import { useLocation } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { getQueryFn, queryClient, apiRequest } from "@/lib/queryClient";
import { ArrowLeft, Bell, BellOff, Check } from "lucide-react";
import { formatDistanceToNow, isToday, isYesterday } from "date-fns";

type InAppNotification = {
  id: number;
  type: string;
  title: string | null;
  body: string | null;
  deepLink: string | null;
  willId: number | null;
  isRead: boolean;
  createdAt: string;
};

type NotifResponse = {
  notifications: InAppNotification[];
  unreadCount: number;
};

function groupByRecency(notifications: InAppNotification[]) {
  const today: InAppNotification[] = [];
  const yesterday: InAppNotification[] = [];
  const earlier: InAppNotification[] = [];
  for (const n of notifications) {
    const d = new Date(n.createdAt);
    if (isToday(d)) today.push(n);
    else if (isYesterday(d)) yesterday.push(n);
    else earlier.push(n);
  }
  return { today, yesterday, earlier };
}

function typeIcon(type: string): string {
  if (type === "team_will_invite") return "🤝";
  if (type === "friend_request") return "👋";
  if (type === "friend_accepted") return "🎉";
  if (type === "proof_dropped") return "📸";
  if (type === "review_submitted") return "✍️";
  if (type === "will_started") return "🚀";
  if (type === "will_proposed") return "🔔";
  if (type === "team_checkin") return "✅";
  return "🔔";
}

export default function NotificationsPage() {
  const [, setLocation] = useLocation();

  const { data, isLoading } = useQuery<NotifResponse>({
    queryKey: ["/api/notifications"],
    queryFn: getQueryFn({ on401: "returnNull" }),
    staleTime: 0,
    refetchInterval: 30000,
  });

  const markReadMutation = useMutation({
    mutationFn: async (id: number) => {
      await apiRequest(`/api/notifications/${id}/read`, { method: "PATCH" });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/notifications"] });
      queryClient.invalidateQueries({ queryKey: ["/api/notifications/unread-count"] });
    },
  });

  const markAllMutation = useMutation({
    mutationFn: async () => {
      await apiRequest("/api/notifications/read-all", { method: "POST" });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/notifications"] });
      queryClient.invalidateQueries({ queryKey: ["/api/notifications/unread-count"] });
    },
  });

  function handleTap(n: InAppNotification) {
    if (!n.isRead) markReadMutation.mutate(n.id);
    if (n.deepLink) setLocation(n.deepLink);
  }

  const notifications = data?.notifications ?? [];
  const unreadCount = data?.unreadCount ?? 0;
  const groups = groupByRecency(notifications);

  function Section({ label, items }: { label: string; items: InAppNotification[] }) {
    if (items.length === 0) return null;
    return (
      <div className="mb-4">
        <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wide px-1 mb-1">{label}</p>
        <div className="space-y-1">
          {items.map((n) => (
            <button
              key={n.id}
              onClick={() => handleTap(n)}
              data-testid={`notif-item-${n.id}`}
              className={`w-full text-left rounded-2xl px-4 py-3 flex items-start gap-3 transition-all duration-150 active:scale-[0.98] ${
                n.isRead ? "bg-white border border-gray-100" : "bg-emerald-50 border border-emerald-100"
              }`}
            >
              <span className="text-xl leading-none mt-0.5 flex-shrink-0">{typeIcon(n.type)}</span>
              <div className="flex-1 min-w-0">
                <p className={`text-[14px] leading-snug ${n.isRead ? "text-gray-700" : "text-gray-900 font-semibold"}`}>
                  {n.title ?? n.type}
                </p>
                {n.body && (
                  <p className="text-[12px] text-gray-500 leading-snug mt-0.5 line-clamp-2">{n.body}</p>
                )}
                <p className="text-[11px] text-gray-400 mt-1">
                  {formatDistanceToNow(new Date(n.createdAt), { addSuffix: true })}
                </p>
              </div>
              {!n.isRead && (
                <div className="w-2 h-2 rounded-full bg-emerald-500 flex-shrink-0 mt-1.5" />
              )}
            </button>
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
            {unreadCount > 0 && (
              <button
                onClick={() => markAllMutation.mutate()}
                disabled={markAllMutation.isPending}
                className="flex items-center gap-1 text-[13px] text-emerald-600 hover:text-emerald-800 transition-colors disabled:opacity-50"
                data-testid="button-mark-all-read"
              >
                <Check className="w-3.5 h-3.5" />
                All read
              </button>
            )}
            {unreadCount === 0 && <div className="w-16" />}
          </div>

          {/* Loading */}
          {isLoading && (
            <div className="flex-1 flex items-center justify-center">
              <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-emerald-500" />
            </div>
          )}

          {/* Empty */}
          {!isLoading && notifications.length === 0 && (
            <div className="flex-1 flex flex-col items-center justify-center text-center gap-3">
              <div className="w-14 h-14 rounded-2xl bg-gray-100 flex items-center justify-center">
                <BellOff className="w-6 h-6 text-gray-400" />
              </div>
              <p className="text-[15px] font-semibold text-gray-700">You're all caught up</p>
              <p className="text-[13px] text-gray-400">Alerts for invites, friends, and activity will show up here.</p>
            </div>
          )}

          {/* Grouped list */}
          {!isLoading && notifications.length > 0 && (
            <div className="flex-1">
              <Section label="Today" items={groups.today} />
              <Section label="Yesterday" items={groups.yesterday} />
              <Section label="Earlier" items={groups.earlier} />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
