import { useLocation, useParams } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { apiRequest } from "@/lib/queryClient";
import { ChevronLeft } from "lucide-react";
import DirectMessages from "@/components/DirectMessages";

export default function DirectMessagePage() {
  const { userId: otherUserId } = useParams<{ userId: string }>();
  const [, setLocation] = useLocation();
  const { user } = useAuth();

  const { data: profile } = useQuery<{ firstName: string | null; lastName: string | null; username: string | null }>({
    queryKey: ["/api/users", otherUserId],
    queryFn: () => apiRequest(`/api/users/${otherUserId}`).then(r => r.json()),
    enabled: !!otherUserId,
  });

  const displayName = profile
    ? [profile.firstName, profile.lastName].filter(Boolean).join(" ") || profile.username || "User"
    : "...";

  if (!user) return null;

  return (
    <div className="h-[100dvh] bg-white flex flex-col overflow-hidden">
      <div className="bg-white ios-safe-area-top shrink-0">
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
          <button
            onClick={() => setLocation(`/profile/${otherUserId}`)}
            className="w-11 h-11 -ml-2 flex items-center justify-center"
            data-testid="button-back-dm"
          >
            <span className="w-8 h-8 flex items-center justify-center rounded-lg bg-gray-100 border border-gray-200 text-gray-700 hover:bg-gray-200 transition-all active:scale-95">
              <ChevronLeft className="w-5 h-5" strokeWidth={2.5} />
            </span>
          </button>

          <div className="flex-1 text-center">
            <h1 className="text-base font-semibold text-gray-900" data-testid="text-dm-title">{displayName}</h1>
          </div>

          <div className="w-10 h-10 rounded-full bg-gradient-to-br from-emerald-500 to-teal-500 flex items-center justify-center shadow-sm">
            <span className="text-white font-semibold text-sm">
              {user.firstName?.charAt(0) || user.email?.charAt(0).toUpperCase() || '?'}
            </span>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-hidden">
        <DirectMessages otherUserId={otherUserId} currentUserId={user.id} />
      </div>
    </div>
  );
}
