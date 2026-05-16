import { useLocation, useRoute } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { ChevronLeft, MessageCircle } from "lucide-react";

type Profile = {
  id: string;
  firstName: string | null;
  lastName: string | null;
  username: string | null;
};

type WillEntry = {
  id: number;
  isPublic: boolean;
  title: string | null;
  category: string;
  dayCount: number;
  successRate: number;
  duration: string | null;
};

type WillsProfile = {
  activeWills: WillEntry[];
  pastWills: WillEntry[];
  completedCount: number;
  hasMorePast: boolean;
};

const AVATAR_COLORS = [
  '#7C3AED', '#2563EB', '#059669', '#D97706', '#DB2777', '#0891B2',
];

function avatarColor(id: string): string {
  let hash = 0;
  for (let i = 0; i < id.length; i++) hash = id.charCodeAt(i) + ((hash << 5) - hash);
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
}

function getInitial(firstName: string | null, lastName: string | null, username: string | null) {
  if (firstName) return firstName[0].toUpperCase();
  if (username) return username[0].toUpperCase();
  return "?";
}

function displayName(firstName: string | null, lastName: string | null, username: string | null) {
  if (firstName || lastName) return [firstName, lastName].filter(Boolean).join(" ");
  return username || "Unknown";
}

function handleDisplay(firstName: string | null, username: string | null) {
  if (username) return `@${username}`;
  if (firstName) return `@${firstName.toLowerCase()}`;
  return '';
}

export default function FriendProfile() {
  const [, setLocation] = useLocation();
  const [, params] = useRoute("/profile/:userId");
  const userId = params?.userId;

  const { data: profile, isLoading: profileLoading } = useQuery<Profile>({
    queryKey: ["/api/users", userId],
    queryFn: () => apiRequest(`/api/users/${userId}`).then(r => r.json()),
    enabled: !!userId,
  });

  const { data: willsProfile, isLoading: willsLoading } = useQuery<WillsProfile>({
    queryKey: ["/api/users", userId, "wills-profile"],
    queryFn: () => apiRequest(`/api/users/${userId}/wills-profile`).then(r => r.json()),
    enabled: !!userId,
  });

  const isLoading = profileLoading || willsLoading;

  const color = profile ? avatarColor(profile.id) : '#7C3AED';
  const initial = profile ? getInitial(profile.firstName ?? null, profile.lastName ?? null, profile.username ?? null) : '?';
  const name = profile ? displayName(profile.firstName ?? null, profile.lastName ?? null, profile.username ?? null) : '';
  const handle = profile ? handleDisplay(profile.firstName ?? null, profile.username ?? null) : '';

  const activeWills = willsProfile?.activeWills ?? [];
  const pastWills = willsProfile?.pastWills ?? [];
  const completedCount = willsProfile?.completedCount ?? 0;

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col" style={{ paddingTop: "env(safe-area-inset-top)" }}>
      {/* Nav */}
      <div className="flex items-center justify-between px-4 pt-14 pb-2 bg-gray-50">
        <button
          onClick={() => setLocation("/friends")}
          className="w-10 h-10 flex items-center justify-center rounded-lg bg-white border border-gray-200 text-gray-700 hover:bg-gray-100 transition-all active:scale-95 shadow-sm"
          data-testid="button-back-friends"
        >
          <ChevronLeft className="w-5 h-5" strokeWidth={2.5} />
        </button>

        <button
          onClick={() => setLocation(`/dm/${userId}`)}
          className="flex items-center gap-1.5 px-4 py-2 rounded-full border border-emerald-500 text-emerald-600 bg-white text-sm font-semibold hover:bg-emerald-50 transition-all active:scale-95 shadow-sm"
          data-testid="button-message"
        >
          <MessageCircle className="w-4 h-4" />
          Message
        </button>
      </div>

      {/* Hero */}
      <div className="flex flex-col items-center pt-8 pb-6 px-6 bg-gray-50">
        <div
          className="w-[72px] h-[72px] rounded-full flex items-center justify-center shadow-md"
          style={{ background: `linear-gradient(135deg, ${color}cc 0%, ${color} 100%)` }}
        >
          {isLoading ? (
            <span className="text-white text-2xl font-bold">…</span>
          ) : (
            <span className="text-white font-bold" style={{ fontSize: 28 }}>{initial}</span>
          )}
        </div>

        <p className="mt-3 text-xl font-bold text-gray-900 text-center" data-testid="text-full-name">{name}</p>
        <p className="text-sm text-gray-400 mt-0.5" data-testid="text-handle">{handle}</p>

        {!isLoading && (
          <div className="mt-3 px-4 py-1.5 rounded-full bg-emerald-50 border border-emerald-200">
            <span className="text-sm font-semibold text-emerald-700" data-testid="text-completed-count">
              {completedCount} Wills completed
            </span>
          </div>
        )}
      </div>

      {/* Content */}
      <div className="flex-1 px-4 pb-6 space-y-4">
        {/* Active Wills */}
        <div>
          <p className="text-xs font-semibold uppercase tracking-widest text-gray-400 mb-2 px-1">Active Wills</p>
          <div className="space-y-2">
            {isLoading ? (
              <div className="bg-white rounded-xl border border-gray-100 p-4 animate-pulse">
                <div className="h-4 bg-gray-200 rounded w-3/4 mb-2" />
                <div className="h-3 bg-gray-100 rounded w-1/2" />
              </div>
            ) : activeWills.length === 0 ? (
              <p className="text-sm text-gray-400 px-1 py-2">No active Wills</p>
            ) : (
              activeWills.map(w => (
                <div key={w.id} className="bg-white rounded-xl border border-gray-100 shadow-sm px-4 py-3" data-testid={`card-active-will-${w.id}`}>
                  {w.isPublic ? (
                    <>
                      <div className="flex items-start justify-between gap-2">
                        <p className="text-sm font-semibold text-gray-900 leading-snug flex-1" data-testid={`text-will-title-${w.id}`}>
                          {w.title}
                        </p>
                        <span className="shrink-0 text-[11px] font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-full px-2 py-0.5">
                          Active
                        </span>
                      </div>
                      <p className="text-xs text-gray-400 mt-1" data-testid={`text-will-meta-${w.id}`}>
                        {w.category} · Day {w.dayCount}
                      </p>
                      <div className="mt-2 h-1 bg-gray-100 rounded-full overflow-hidden">
                        <div
                          className="h-full rounded-full bg-emerald-500 transition-all duration-500"
                          style={{ width: `${Math.min(w.successRate, 100)}%` }}
                        />
                      </div>
                    </>
                  ) : (
                    <div className="flex items-center justify-between gap-2">
                      <div>
                        <p className="text-sm font-medium text-gray-400">🔒 Private Will</p>
                        <p className="text-xs text-gray-400 mt-0.5">Ongoing</p>
                      </div>
                      <span className="shrink-0 text-[11px] font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-full px-2 py-0.5">
                        Active
                      </span>
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        </div>

        {/* Past Wills */}
        <div>
          <p className="text-xs font-semibold uppercase tracking-widest text-gray-400 mb-2 px-1">Past Wills</p>
          <div className="space-y-2">
            {isLoading ? (
              <div className="bg-white rounded-xl border border-gray-100 p-4 animate-pulse">
                <div className="h-4 bg-gray-200 rounded w-2/3 mb-2" />
                <div className="h-3 bg-gray-100 rounded w-1/3" />
              </div>
            ) : pastWills.length === 0 ? (
              <p className="text-sm text-gray-400 px-1 py-2">No completed Wills yet</p>
            ) : (
              <>
                {pastWills.map(w => (
                  <div key={w.id} className="bg-white rounded-xl border border-gray-100 shadow-sm px-4 py-3" data-testid={`card-past-will-${w.id}`}>
                    {w.isPublic ? (
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1">
                          <p className="text-sm font-semibold text-gray-900 leading-snug" data-testid={`text-past-will-title-${w.id}`}>
                            {w.title}
                          </p>
                          {w.duration && (
                            <p className="text-xs text-gray-400 mt-0.5">{w.duration}</p>
                          )}
                        </div>
                        <span className="shrink-0 text-[11px] font-semibold text-purple-700 bg-purple-50 border border-purple-200 rounded-full px-2 py-0.5">
                          Done
                        </span>
                      </div>
                    ) : (
                      <div className="flex items-center justify-between gap-2">
                        <div>
                          <p className="text-sm font-medium text-gray-400">🔒 Completed Will</p>
                          {w.duration && <p className="text-xs text-gray-400 mt-0.5">{w.duration}</p>}
                        </div>
                        <span className="shrink-0 text-[11px] font-semibold text-purple-700 bg-purple-50 border border-purple-200 rounded-full px-2 py-0.5">
                          Done
                        </span>
                      </div>
                    )}
                  </div>
                ))}
                {willsProfile?.hasMorePast && (
                  <p className="text-xs text-emerald-600 font-medium text-center py-1 cursor-pointer hover:text-emerald-700" data-testid="link-see-all-past">
                    See all
                  </p>
                )}
              </>
            )}
          </div>
        </div>
      </div>

      {/* Bottom CTA */}
      <div className="px-4 pb-8 pt-2 bg-gray-50">
        <button
          onClick={() => setLocation(`/create-team-will?preSelectedUserId=${userId}`)}
          className="w-full py-4 rounded-2xl font-bold text-base border-2 border-emerald-500 text-emerald-600 bg-white hover:bg-emerald-50 transition-colors active:scale-[0.98] shadow-sm"
          data-testid="button-start-team-will"
        >
          Start a Team Will together
        </button>
      </div>
    </div>
  );
}
