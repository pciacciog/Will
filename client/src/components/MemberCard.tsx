import { Zap } from "lucide-react";
import { cn } from "@/lib/utils";

export type MemberActivity = 'yes' | 'partial' | 'no' | 'none';

export type MemberCardData = {
  userId: string;
  firstName: string;
  isCreator: boolean;
  isYou?: boolean;
  daysIn: number;
  joinDate: string;
  sevenDayActivity: MemberActivity[];
};

const AVATAR_COLORS = [
  '#7C3AED', '#2563EB', '#059669', '#D97706',
  '#DC2626', '#0891B2', '#65A30D', '#C026D3',
];

export function avatarColor(id: string) {
  let hash = 0;
  for (let i = 0; i < id.length; i++) hash = id.charCodeAt(i) + ((hash << 5) - hash);
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
}

export function getInitials(name: string) {
  return (name || '?').charAt(0).toUpperCase();
}

function joinedAgo(joinDate: string): string {
  const diff = Date.now() - new Date(joinDate).getTime();
  const days = Math.floor(diff / 86400000);
  if (days === 0) return 'joined today';
  if (days === 1) return 'joined 1 day ago';
  if (days < 7) return `joined ${days} days ago`;
  const weeks = Math.floor(days / 7);
  if (weeks === 1) return 'joined 1 week ago';
  if (weeks < 5) return `joined ${weeks} weeks ago`;
  const months = Math.floor(days / 30);
  if (months === 1) return 'joined 1 month ago';
  return `joined ${months} months ago`;
}

const activityStyle: Record<MemberActivity, string> = {
  yes: 'bg-emerald-500',
  partial: 'bg-amber-400',
  no: 'bg-red-400',
  none: 'bg-gray-200',
};

interface MemberCardProps {
  member: MemberCardData;
  onPush?: (userId: string) => void;
  alreadyPushed?: boolean;
  pushPending?: boolean;
  onTapProfile?: (userId: string) => void;
}

export default function MemberCard({
  member,
  onPush,
  alreadyPushed = false,
  pushPending = false,
  onTapProfile,
}: MemberCardProps) {
  const showPushButton = !member.isYou && !!onPush;

  return (
    <div
      className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4"
      data-testid={`card-member-${member.userId}`}
    >
      <div className="flex items-center gap-3 mb-3">
        <button
          className="flex-shrink-0"
          onClick={() => onTapProfile?.(member.userId)}
          disabled={!onTapProfile}
          aria-label={`View ${member.firstName}'s profile`}
        >
          <div
            className="w-10 h-10 rounded-full flex items-center justify-center text-white text-sm font-semibold"
            style={{ backgroundColor: avatarColor(member.userId) }}
          >
            {getInitials(member.firstName)}
          </div>
        </button>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-sm font-semibold text-gray-900 truncate">
              @{member.firstName.toLowerCase()}
            </span>
            {member.isCreator && (
              <span className="text-[10px] font-medium px-1.5 py-0.5 rounded-full bg-amber-50 text-amber-600 flex-shrink-0">
                Creator
              </span>
            )}
            {member.isYou && (
              <span className="text-[10px] font-medium px-1.5 py-0.5 rounded-full bg-blue-50 text-blue-600 flex-shrink-0">
                You
              </span>
            )}
          </div>
          <p className="text-xs text-gray-400 mt-0.5">
            Day {member.daysIn} · {joinedAgo(member.joinDate)}
          </p>
        </div>

        {showPushButton && (
          <button
            onClick={() => onPush?.(member.userId)}
            disabled={alreadyPushed || pushPending}
            className={cn(
              "flex items-center gap-1 px-2.5 py-1.5 rounded-full text-xs font-semibold transition-all flex-shrink-0",
              alreadyPushed
                ? "bg-gray-100 text-gray-400"
                : "text-white active:opacity-80",
            )}
            style={alreadyPushed ? {} : { backgroundColor: '#534AB7' }}
            data-testid={`button-push-member-${member.userId}`}
          >
            <Zap
              className={cn("w-3 h-3", alreadyPushed ? "text-gray-400" : "fill-white text-white")}
            />
            {alreadyPushed ? 'Pushed ✓' : 'Push'}
          </button>
        )}
      </div>

      <div className="flex gap-1" aria-label="7-day activity">
        {member.sevenDayActivity.map((status, i) => (
          <div
            key={i}
            className={cn("flex-1 h-2 rounded-full", activityStyle[status])}
            title={status === 'none' ? 'N/A' : status}
          />
        ))}
      </div>
    </div>
  );
}
