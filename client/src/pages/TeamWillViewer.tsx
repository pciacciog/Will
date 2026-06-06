import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { useAuth } from "@/hooks/useAuth";
import { MobileLayout, UnifiedBackButton } from "@/components/ui/design-system";
import { Users, Lock } from "lucide-react";

interface TeamViewerData {
  id: number;
  title: string | null;
  kind: string | null;
  status: string;
  startDate: string;
  endDate: string | null;
  isIndefinite: boolean;
  memberCount: number;
  members: { firstName: string | null; daysActive: number }[];
  groupCheckInRate: number | null;
  isMember: boolean;
}

function kindLabel(kind: string | null): string {
  if (kind === "team_we_will") return "We Will";
  return "Team I Will";
}

function kindColor(kind: string | null): { bg: string; text: string } {
  if (kind === "team_we_will") return { bg: "bg-indigo-100", text: "text-indigo-700" };
  return { bg: "bg-violet-100", text: "text-violet-700" };
}

function getInitial(name: string | null): string {
  return (name?.[0] ?? "?").toUpperCase();
}

const AVATAR_COLORS = [
  "bg-violet-400", "bg-indigo-400", "bg-blue-400", "bg-emerald-400",
  "bg-amber-400", "bg-rose-400", "bg-pink-400", "bg-teal-400",
];

function avatarColor(index: number): string {
  return AVATAR_COLORS[index % AVATAR_COLORS.length];
}

export default function TeamWillViewer({ willId }: { willId: number }) {
  const [, navigate] = useLocation();
  const { user } = useAuth();

  const { data: will, isLoading } = useQuery<TeamViewerData>({
    queryKey: [`/api/wills/${willId}/team-viewer`],
    enabled: !!willId && !!user,
  });

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-violet-600" />
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

  const { bg: pillBg, text: pillText } = kindColor(will.kind);
  const label = kindLabel(will.kind);

  const statusColors: Record<string, string> = {
    active: "bg-emerald-100 text-emerald-700",
    completed: "bg-blue-100 text-blue-700",
    will_review: "bg-amber-100 text-amber-700",
    paused: "bg-gray-100 text-gray-600",
    terminated: "bg-red-100 text-red-600",
    pending: "bg-gray-100 text-gray-500",
  };

  return (
    <MobileLayout>
      <div className="px-4 pt-4 pb-2">
        <UnifiedBackButton onClick={() => navigate("/")} />
      </div>

      <div className="px-4 pb-10 space-y-4">
        {/* Header */}
        <div>
          <div className="flex items-center gap-2 mb-1.5 flex-wrap">
            <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full uppercase tracking-wide ${pillBg} ${pillText}`}>
              {label}
            </span>
            <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${statusColors[will.status] ?? "bg-gray-100 text-gray-600"}`}>
              {will.status === "will_review" ? "Review" : will.status.charAt(0).toUpperCase() + will.status.slice(1)}
            </span>
          </div>
          <h1 className="text-xl font-bold text-gray-900 leading-snug" data-testid="text-will-title">
            {will.title ?? label}
          </h1>
        </div>

        {/* Closed group notice */}
        <div className="flex items-center gap-2 bg-gray-50 border border-gray-100 rounded-xl px-3 py-2.5">
          <Lock className="w-4 h-4 text-gray-400 flex-shrink-0" />
          <p className="text-sm text-gray-500">This is a closed group will</p>
        </div>

        {/* Members card */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="px-4 pt-3 pb-2 border-b border-gray-50 flex items-center gap-2">
            <Users className="w-4 h-4 text-gray-400" />
            <p className="text-sm font-semibold text-gray-700">
              {will.memberCount} {will.memberCount === 1 ? "member" : "members"}
            </p>
          </div>
          <div className="divide-y divide-gray-50">
            {will.members.map((member, i) => (
              <div key={i} className="px-4 py-3 flex items-center gap-3" data-testid={`member-row-${i}`}>
                <div className={`w-9 h-9 rounded-full ${avatarColor(i)} flex items-center justify-center flex-shrink-0`}>
                  <span className="text-white font-bold text-sm">{getInitial(member.firstName)}</span>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-gray-900">{member.firstName ?? "Member"}</p>
                  <p className="text-xs text-gray-400">
                    {member.daysActive > 0 ? `Day ${member.daysActive} in` : "Just started"}
                  </p>
                </div>
              </div>
            ))}
            {will.members.length === 0 && (
              <div className="px-4 py-4 text-center text-sm text-gray-400">No members yet</div>
            )}
          </div>

          {/* Group check-in rate chip */}
          {will.groupCheckInRate !== null && (
            <div className="px-4 py-3 border-t border-gray-50 flex items-center justify-between">
              <p className="text-sm text-gray-500">Group check-in rate</p>
              <span className="text-sm font-bold text-emerald-600">{will.groupCheckInRate}%</span>
            </div>
          )}
        </div>

        {/* CTA */}
        <button
          onClick={() => navigate("/create-team-will")}
          className="w-full py-3.5 rounded-2xl font-semibold text-sm text-white transition-all active:scale-95"
          style={{ background: "linear-gradient(135deg, #7C3AED, #4F46E5)" }}
          data-testid="button-start-team-will"
        >
          Start your own Team Will
        </button>
      </div>
    </MobileLayout>
  );
}
