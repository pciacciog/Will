import { cn } from "@/lib/utils";

export type MemberActivity = 'yes' | 'partial' | 'no' | 'none';

export type MemberCardData = {
  userId: string;
  firstName: string;
  isCreator: boolean;
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

const activityStyle: Record<MemberActivity, string> = {
  yes: 'bg-emerald-500',
  partial: 'bg-amber-400',
  no: 'bg-red-400',
  none: 'bg-gray-200',
};

interface MemberCardProps {
  member: MemberCardData;
}

export default function MemberCard({ member }: MemberCardProps) {
  return (
    <div
      className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 flex flex-col gap-3"
      data-testid={`card-member-${member.userId}`}
    >
      <div className="flex items-center gap-3">
        <div
          className="w-10 h-10 rounded-full flex items-center justify-center text-white text-sm font-semibold flex-shrink-0"
          style={{ backgroundColor: avatarColor(member.userId) }}
        >
          {getInitials(member.firstName)}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-sm font-semibold text-gray-900 truncate">
              @{member.firstName.toLowerCase()}
            </span>
            {member.isCreator && (
              <span className="text-[10px] font-medium px-1.5 py-0.5 rounded-full bg-amber-50 text-amber-600 flex-shrink-0">
                Creator
              </span>
            )}
          </div>
          <span className="text-xs text-gray-400">Day {member.daysIn}</span>
        </div>
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
