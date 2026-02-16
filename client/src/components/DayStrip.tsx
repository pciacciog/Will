import { useMemo } from "react";
import { cn } from "@/lib/utils";
import type { WillCheckIn } from "@shared/schema";

interface DayStripProps {
  startDate: string;
  endDate: string | null;
  checkIns: WillCheckIn[];
  onDayClick?: (date: string) => void;
}

interface DayInfo {
  date: Date;
  dateKey: string;
  dayOfMonth: number;
  dayOfWeek: string;
  status: 'yes' | 'no' | 'partial' | 'pending' | 'future';
  isToday: boolean;
}

export default function DayStrip({ startDate, endDate, checkIns, onDayClick }: DayStripProps) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const formatDateKey = (date: Date) => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  const checkInMap = useMemo(() => {
    const map = new Map<string, WillCheckIn>();
    checkIns.forEach(c => map.set(c.date, c));
    return map;
  }, [checkIns]);

  const days = useMemo(() => {
    const result: DayInfo[] = [];
    const start = new Date(startDate);
    const end = endDate ? new Date(endDate) : new Date();
    
    start.setHours(0, 0, 0, 0);
    end.setHours(0, 0, 0, 0);

    const current = new Date(start);
    while (current <= end) {
      const dateKey = formatDateKey(current);
      const checkIn = checkInMap.get(dateKey);
      const isToday = current.getTime() === today.getTime();
      const isFuture = current > today;
      
      let status: DayInfo['status'] = 'pending';
      if (checkIn) {
        status = checkIn.status as 'yes' | 'no' | 'partial';
      } else if (isFuture) {
        status = 'future';
      }

      result.push({
        date: new Date(current),
        dateKey,
        dayOfMonth: current.getDate(),
        dayOfWeek: current.toLocaleDateString('en-US', { weekday: 'short' }).slice(0, 2),
        status,
        isToday,
      });

      current.setDate(current.getDate() + 1);
    }

    return result;
  }, [startDate, endDate, checkInMap, today]);

  const getStatusStyles = (status: DayInfo['status'], isToday: boolean) => {
    const baseStyles = "w-11 h-11 rounded-full flex flex-col items-center justify-center transition-all duration-200";
    
    if (status === 'yes') {
      return cn(baseStyles, "bg-emerald-500 text-white", isToday && "ring-2 ring-emerald-300 ring-offset-2");
    }
    if (status === 'partial') {
      return cn(baseStyles, "bg-amber-400 text-white", isToday && "ring-2 ring-amber-300 ring-offset-2");
    }
    if (status === 'no') {
      return cn(baseStyles, "bg-red-500 text-white", isToday && "ring-2 ring-red-300 ring-offset-2");
    }
    if (status === 'future') {
      return cn(baseStyles, "bg-gray-100 text-gray-400", isToday && "ring-2 ring-gray-300 ring-offset-2");
    }
    return cn(baseStyles, "bg-gray-200 text-gray-600", isToday && "ring-2 ring-blue-400 ring-offset-2");
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 overflow-x-auto pb-2 px-1 -mx-1 scrollbar-hide">
        {days.map((day) => (
          <button
            key={day.dateKey}
            type="button"
            onClick={() => day.status !== 'future' && onDayClick?.(day.dateKey)}
            disabled={day.status === 'future'}
            className={cn(
              getStatusStyles(day.status, day.isToday),
              day.status !== 'future' && "hover:scale-105 cursor-pointer",
              day.status === 'future' && "cursor-not-allowed opacity-60"
            )}
            data-testid={`day-${day.dateKey}`}
          >
            <span className="text-[10px] font-medium leading-none">{day.dayOfWeek}</span>
            <span className="text-sm font-bold leading-none">{day.dayOfMonth}</span>
          </button>
        ))}
      </div>
      
      <div className="flex items-center justify-center gap-4 text-xs">
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 rounded-full bg-emerald-500" />
          <span className="text-gray-600">Done</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 rounded-full bg-amber-400" />
          <span className="text-gray-600">Partial</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 rounded-full bg-red-500" />
          <span className="text-gray-600">Missed</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 rounded-full bg-gray-200" />
          <span className="text-gray-600">Pending</span>
        </div>
      </div>
    </div>
  );
}
