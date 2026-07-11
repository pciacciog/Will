import { useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { MobileLayout, UnifiedBackButton } from "@/components/ui/design-system";
import { Target, ArrowRight, CheckCircle } from "lucide-react";
import { cn } from "@/lib/utils";

type ExploreWill = {
  id: number;
  title: string | null;
  kind: string | null;
  what: string;
  checkInType: string | null;
  startDate: string;
  endDate: string;
  isIndefinite: boolean;
  createdBy: string;
  creatorName: string;
  memberCount: number;
  status: string;
  daysActive: number;
  members: { userId: string; firstName: string }[];
  isOwner: boolean;
  hasJoined: boolean;
  isTeamMember: boolean;
};

const KIND_STYLES: Record<string, { label: string; bg: string; text: string }> = {
  solo:        { label: "Solo",     bg: "#E1F5EE", text: "#085041" },
  public:      { label: "Public",   bg: "#E1F5EE", text: "#085041" },
  team_i_will: { label: "Team",     bg: "#EEEDFE", text: "#3C3489" },
  team_we_will:{ label: "We Will",  bg: "#EEEDFE", text: "#3C3489" },
};

function avatarColor(id: string) {
  const colors = ["#534AB7","#1D9E75","#D85A30","#0891B2","#7C3AED","#DC2626","#059669","#D97706"];
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) & 0xfffffff;
  return colors[Math.abs(h) % colors.length];
}

function getInitial(name: string) {
  return (name || "?").charAt(0).toUpperCase();
}

function AvatarStack({ members = [], size = 7 }: { members?: { userId: string; firstName: string }[]; size?: number }) {
  const px = size === 7 ? "w-7 h-7 text-xs" : "w-6 h-6 text-[10px]";
  return (
    <div className="flex items-center -space-x-1.5">
      {members.slice(0, 3).map((m) => (
        <div
          key={m.userId}
          className={cn("rounded-full border-2 border-white flex items-center justify-center font-semibold text-white flex-shrink-0", px)}
          style={{ backgroundColor: avatarColor(m.userId) }}
        >
          {getInitial(m.firstName)}
        </div>
      ))}
    </div>
  );
}

function getNavTarget(will: ExploreWill): string {
  const { kind, id, isOwner, isTeamMember, hasJoined } = will;
  if (kind === "public") return `/public-will/${id}`;
  if (kind === "solo") return isOwner ? `/will/${id}` : `/solo-viewer/${id}`;
  if (kind === "team_i_will" || kind === "team_we_will") {
    return isOwner || isTeamMember ? `/will/${id}` : `/team-viewer/${id}`;
  }
  return `/will/${id}`;
}

function getContextLabel(will: ExploreWill): string {
  const { kind, memberCount, daysActive } = will;
  if (kind === "public") {
    const mem = `${memberCount} ${memberCount === 1 ? "member" : "members"}`;
    const days = daysActive > 0 ? ` · ${daysActive}d` : "";
    return `${mem}${days}`;
  }
  return daysActive > 0 ? `${daysActive} days active` : "Just started";
}

function CreatorRow({ will }: { will: ExploreWill }) {
  const isTeam = will.kind === "team_i_will" || will.kind === "team_we_will";
  const extra = will.memberCount - 1;
  return (
    <div className="flex items-center gap-2">
      <AvatarStack members={will.members} />
      <span className="text-xs text-gray-500 truncate">
        @{(will.creatorName ?? "").toLowerCase()}
        {isTeam && extra > 0 ? ` + ${extra} other${extra === 1 ? "" : "s"}` : ""}
      </span>
    </div>
  );
}

function ExploreCard({ will }: { will: ExploreWill }) {
  const [, setLocation] = useLocation();
  const style = KIND_STYLES[will.kind ?? "solo"] ?? KIND_STYLES.solo;
  const isYours = will.isOwner || (will.kind === "public" && will.hasJoined);

  const navigate = () => setLocation(getNavTarget(will));

  return (
    <div
      className="bg-white rounded-2xl shadow-sm p-4 cursor-pointer active:bg-gray-50 transition-colors"
      style={{
        border: isYours ? "1.5px solid #1D9E75" : "1px solid #F3F4F6",
      }}
      onClick={navigate}
      data-testid={`card-will-${will.id}`}
    >
      <div className="flex items-start justify-between gap-2 mb-2">
        <div className="flex items-center gap-1.5 flex-wrap">
          <span
            className="text-[10px] font-semibold px-2 py-0.5 rounded-full uppercase tracking-wide"
            style={{ backgroundColor: style.bg, color: style.text }}
            data-testid={`pill-kind-${will.id}`}
          >
            {style.label}
          </span>
          {isYours && (
            <span
              className="text-[10px] font-semibold px-2 py-0.5 rounded-full uppercase tracking-wide"
              style={{ backgroundColor: "#E6F9F2", color: "#1D9E75" }}
              data-testid={`pill-yours-${will.id}`}
            >
              Yours
            </span>
          )}
        </div>
        <span className="text-[11px] text-gray-400 whitespace-nowrap flex-shrink-0" data-testid={`text-context-${will.id}`}>
          {getContextLabel(will)}
        </span>
      </div>

      <p className="text-[15px] font-semibold text-gray-900 leading-snug mb-3" data-testid={`text-title-${will.id}`}>
        {will.title ?? will.what}
      </p>

      <div className="flex items-center justify-between gap-2">
        <CreatorRow will={will} />

        {isYours ? (
          <div
            className="flex items-center gap-1 px-3 py-1.5 rounded-full text-xs font-semibold flex-shrink-0"
            style={{ backgroundColor: "#E6F9F2", color: "#1D9E75" }}
            data-testid={`label-yours-${will.id}`}
          >
            <CheckCircle className="w-3.5 h-3.5" />
            Your will
          </div>
        ) : (
          <button
            className="flex items-center gap-1 px-3 py-1.5 rounded-full text-xs font-semibold bg-gray-100 text-gray-600 flex-shrink-0 active:bg-gray-200 transition-colors"
            onClick={(e) => { e.stopPropagation(); navigate(); }}
            data-testid={`button-view-${will.id}`}
          >
            View
            <ArrowRight className="w-3 h-3" />
          </button>
        )}
      </div>
    </div>
  );
}

export default function Explore() {
  const [, setLocation] = useLocation();

  const { data: allWills, isLoading } = useQuery<ExploreWill[]>({
    queryKey: ["/api/wills/public"],
    staleTime: 30000,
  });

  const wills = allWills ?? [];

  return (
    <MobileLayout>
      <div className="space-y-3">
        <div className="relative flex items-center justify-between mb-1 min-h-[44px]">
          <UnifiedBackButton onClick={() => setLocation("/")} testId="button-back" />
          <h1
            className="absolute left-0 right-0 text-center text-xl font-semibold text-gray-900 pointer-events-none"
            data-testid="text-page-title"
          >
            Explore
          </h1>
          <div className="w-11" />
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center py-20">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-500" />
          </div>
        ) : wills.length === 0 ? (
          <div className="text-center py-16">
            <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <Target className="w-8 h-8 text-gray-400" />
            </div>
            <p className="text-sm text-gray-500 px-8" data-testid="text-empty">
              No public wills to explore yet — check back soon.
            </p>
          </div>
        ) : (
          <div className="space-y-3" data-testid="list-wills">
            {wills.map((will) => (
              <ExploreCard key={will.id} will={will} />
            ))}
          </div>
        )}
      </div>
    </MobileLayout>
  );
}
