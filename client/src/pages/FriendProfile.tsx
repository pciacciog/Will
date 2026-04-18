import { useLocation, useRoute } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { ChevronLeft } from "lucide-react";

function getInitial(firstName: string | null, lastName: string | null, username: string | null) {
  if (firstName) return firstName[0].toUpperCase();
  if (username) return username[0].toUpperCase();
  return "?";
}

function displayName(firstName: string | null, lastName: string | null, username: string | null) {
  if (firstName || lastName) return [firstName, lastName].filter(Boolean).join(" ");
  return username || "Unknown";
}

export default function FriendProfile() {
  const [, setLocation] = useLocation();
  const [, params] = useRoute("/profile/:userId");
  const userId = params?.userId;

  const { data: profile, isLoading } = useQuery<{
    id: string;
    firstName: string | null;
    lastName: string | null;
    username: string | null;
  }>({
    queryKey: ["/api/users", userId],
    queryFn: () => apiRequest(`/api/users/${userId}`).then(r => r.json()),
    enabled: !!userId,
  });

  return (
    <div
      className="min-h-screen bg-white flex flex-col"
      style={{ paddingTop: "env(safe-area-inset-top)" }}
    >
      {/* Nav */}
      <div className="flex items-center px-4 pt-14 pb-2">
        <button
          onClick={() => setLocation("/friends")}
          className="w-10 h-10 flex items-center justify-center rounded-lg bg-gray-100 border border-gray-200 text-gray-700 hover:bg-gray-200 transition-all active:scale-95"
          data-testid="button-back-friends"
        >
          <ChevronLeft className="w-5 h-5" strokeWidth={2.5} />
        </button>
      </div>

      {/* Avatar + Name */}
      <div className="flex flex-col items-center mt-12 px-6">
        <div
          className="flex items-center justify-center rounded-full"
          style={{
            width: 72,
            height: 72,
            background: "linear-gradient(135deg, #9B5CE5 0%, #7C3AED 100%)",
            flexShrink: 0,
          }}
        >
          {isLoading ? (
            <span className="text-white text-2xl font-bold">…</span>
          ) : (
            <span className="text-white font-bold" style={{ fontSize: 28 }}>
              {getInitial(profile?.firstName ?? null, profile?.lastName ?? null, profile?.username ?? null)}
            </span>
          )}
        </div>

        <p className="mt-3 text-lg font-bold text-gray-900 text-center">
          {isLoading ? "" : displayName(profile?.firstName ?? null, profile?.lastName ?? null, profile?.username ?? null)}
        </p>
      </div>

      {/* CTA */}
      <div className="px-6 mt-10">
        <button
          onClick={() => setLocation(`/create-team-will?preSelectedUserId=${userId}`)}
          className="w-full py-4 rounded-2xl text-white font-bold text-base active:opacity-80 transition-opacity"
          style={{ backgroundColor: "#1D9E75" }}
          data-testid="button-start-team-will"
        >
          Start a Team Will together
        </button>
      </div>
    </div>
  );
}
