import { useMemo } from "react";

interface DeadlineArcProps {
  startDate: string;
  endDate: string;
  className?: string;
}

export function deadlineUrgency(daysRemaining: number) {
  if (daysRemaining > 5) {
    return {
      color: '#1D9E75',
      trackColor: '#BEE8D9',
      pillBg: 'bg-emerald-100',
      pillText: 'text-emerald-800',
      phrase: 'You still have time — make a move',
    };
  }
  if (daysRemaining >= 2) {
    return {
      color: '#BA7517',
      trackColor: '#FDEAB4',
      pillBg: 'bg-amber-100',
      pillText: 'text-amber-800',
      phrase: "This is the window. Don't let it close.",
    };
  }
  return {
    color: '#E24B4A',
    trackColor: '#FAC9C8',
    pillBg: 'bg-red-100',
    pillText: 'text-red-800',
    phrase: 'Now or never. You committed to this.',
  };
}

export default function DeadlineArc({ startDate, endDate, className }: DeadlineArcProps) {
  const { daysRemaining, f, deadlineLabel, isOverdue } = useMemo(() => {
    const now = new Date(); now.setHours(0, 0, 0, 0);
    const start = new Date(startDate); start.setHours(0, 0, 0, 0);
    const end = new Date(endDate); end.setHours(0, 0, 0, 0);
    const totalDays = Math.max(1, Math.round((end.getTime() - start.getTime()) / 86400000));
    const daysElapsed = Math.max(0, Math.round((now.getTime() - start.getTime()) / 86400000));
    const remaining = Math.ceil((end.getTime() - now.getTime()) / 86400000);
    const isOverdue = remaining < 0;
    const f = Math.min(1, Math.max(0, daysElapsed / totalDays));
    const deadlineLabel = end.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    return { daysRemaining: remaining, f, deadlineLabel, isOverdue };
  }, [startDate, endDate]);

  const urgency = deadlineUrgency(daysRemaining);

  const filledArcPath = useMemo(() => {
    if (f <= 0.005) return null;
    const clampedF = Math.min(f, 0.9995);
    const angle = Math.PI * (1 - clampedF);
    const x = 80 + 66 * Math.cos(angle);
    const y = 82 - 66 * Math.sin(angle);
    const largeArcFlag = clampedF > 0.5 ? 1 : 0;
    return `M 14 82 A 66 66 0 ${largeArcFlag} 1 ${x.toFixed(2)} ${y.toFixed(2)}`;
  }, [f]);

  return (
    <div
      className={`bg-white rounded-2xl border border-gray-100 shadow-sm p-4 ${className ?? ''}`}
      data-testid="card-deadline-arc"
    >
      <div className="flex justify-center">
        <svg viewBox="0 0 160 88" width="160" height="88">
          {/* Track */}
          <path
            d="M 14 82 A 66 66 0 0 1 146 82"
            fill="none"
            stroke={urgency.trackColor}
            strokeWidth="9"
            strokeLinecap="round"
          />
          {/* Filled arc */}
          {filledArcPath && (
            <path
              d={filledArcPath}
              fill="none"
              stroke={urgency.color}
              strokeWidth="9"
              strokeLinecap="round"
            />
          )}
          {/* Center label */}
          {daysRemaining === 0 ? (
            <>
              <text x="80" y="67" textAnchor="middle" fontSize="22" fontWeight="700" fill={urgency.color}>today</text>
              <text x="80" y="81" textAnchor="middle" fontSize="11" fill={urgency.color} opacity="0.75">is the day</text>
            </>
          ) : isOverdue ? (
            <text x="80" y="72" textAnchor="middle" fontSize="18" fontWeight="700" fill={urgency.color}>overdue</text>
          ) : (
            <>
              <text x="80" y="68" textAnchor="middle" fontSize="36" fontWeight="700" fill={urgency.color}>{daysRemaining}</text>
              <text x="80" y="81" textAnchor="middle" fontSize="11" fill={urgency.color} opacity="0.75">days left</text>
            </>
          )}
        </svg>
      </div>

      <div className="text-center mt-0.5">
        <p className="text-sm text-gray-500">
          Deadline <span className="font-semibold text-gray-800">{deadlineLabel}</span>
        </p>
        <p className="text-xs mt-0.5" style={{ color: urgency.color }}>
          {isOverdue
            ? 'The deadline has passed.'
            : urgency.phrase}
        </p>
      </div>
    </div>
  );
}
