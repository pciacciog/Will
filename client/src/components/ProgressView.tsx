import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { CheckCircle, XCircle, MinusCircle, CalendarDays, Target } from "lucide-react";
import { cn } from "@/lib/utils";
import type { WillCheckIn } from "@shared/schema";
import DayStrip from "./DayStrip";

interface ProgressViewProps {
  willId: number;
  startDate: string;
  endDate: string | null;
  checkInType: string;
  activeDays?: string;
  customDays?: string;
  onDayClick?: (date: string) => void;
}

function isActiveDayForProgress(date: Date, activeDays?: string, customDays?: string): boolean {
  if (!activeDays || activeDays === 'every_day') return true;
  if (activeDays === 'weekdays') {
    const day = date.getDay();
    return day >= 1 && day <= 5;
  }
  if (activeDays === 'custom' && customDays) {
    try {
      const days = JSON.parse(customDays) as number[];
      return days.includes(date.getDay());
    } catch {
      return true;
    }
  }
  return true;
}

interface CheckInProgress {
  totalDays: number;
  checkedInDays: number;
  successRate: number;
  yesCount: number;
  partialCount: number;
  noCount: number;
  streak: number;
}

export default function ProgressView({ willId, startDate, endDate, checkInType, activeDays, customDays, onDayClick }: ProgressViewProps) {
  const isTracking = checkInType === 'daily' || checkInType === 'specific_days';
  const isSpecificDays = checkInType === 'specific_days';

  const { data: checkIns = [], isLoading: checkInsLoading } = useQuery<WillCheckIn[]>({
    queryKey: [`/api/wills/${willId}/check-ins`],
    enabled: isTracking,
  });

  const { data: progress, isLoading: progressLoading } = useQuery<CheckInProgress>({
    queryKey: [`/api/wills/${willId}/check-in-progress`],
    enabled: isTracking,
  });

  const adjustedProgress = useMemo(() => {
    if (!isSpecificDays || !progress) return progress;
    const start = new Date(startDate);
    start.setHours(0, 0, 0, 0);
    const end = endDate ? new Date(endDate) : new Date();
    end.setHours(0, 0, 0, 0);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const effectiveEnd = end < today ? end : today;

    let activeDayCount = 0;
    const current = new Date(start);
    while (current <= effectiveEnd) {
      if (isActiveDayForProgress(current, activeDays, customDays)) {
        activeDayCount++;
      }
      current.setDate(current.getDate() + 1);
    }

    const activeCheckIns = checkIns.filter(c => {
      const d = new Date(c.date + 'T12:00:00');
      return isActiveDayForProgress(d, activeDays, customDays);
    });
    const yesCount = activeCheckIns.filter(c => c.status === 'yes').length;
    const partialCount = activeCheckIns.filter(c => c.status === 'partial').length;
    const noCount = activeCheckIns.filter(c => c.status === 'no').length;
    const successRate = activeDayCount > 0 ? ((yesCount + 0.5 * partialCount) / activeDayCount) * 100 : 0;

    return {
      totalDays: activeDayCount,
      checkedInDays: activeCheckIns.length,
      successRate,
      yesCount,
      partialCount,
      noCount,
      streak: progress.streak,
    };
  }, [isSpecificDays, progress, checkIns, startDate, endDate, activeDays, customDays]);

  const displayProgress = isSpecificDays ? adjustedProgress : progress;

  if (checkInType === 'one-time' || checkInType === 'final_review') {
    return (
      <Card className="border-gray-100">
        <CardHeader className="pb-3">
          <CardTitle className="text-lg flex items-center gap-2">
            <Target className="h-5 w-5 text-emerald-500" />
            Progress
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-6">
            <p className="text-gray-600">
              No daily check-ins — just review at the end!
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (checkInsLoading || progressLoading) {
    return (
      <Card className="border-gray-100 animate-pulse">
        <CardHeader className="pb-3">
          <div className="h-6 bg-gray-200 rounded w-32" />
        </CardHeader>
        <CardContent>
          <div className="h-64 bg-gray-100 rounded" />
        </CardContent>
      </Card>
    );
  }

  const successRate = displayProgress?.successRate ?? 0;

  return (
    <Card className="border-gray-100">
      <CardHeader className="pb-3">
        <CardTitle className="text-lg flex items-center gap-2">
          <CalendarDays className="h-5 w-5 text-blue-500" />
          {isSpecificDays ? 'Specific Days Progress' : 'Daily Progress'}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="grid grid-cols-3 gap-3">
          <div className="text-center p-3 bg-emerald-50 rounded-lg">
            <div className="flex items-center justify-center gap-1 mb-1">
              <CheckCircle className="h-4 w-4 text-emerald-600" />
            </div>
            <div className="text-2xl font-bold text-emerald-700">{displayProgress?.yesCount ?? 0}</div>
            <div className="text-xs text-emerald-600">Completed</div>
          </div>
          <div className="text-center p-3 bg-amber-50 rounded-lg">
            <div className="flex items-center justify-center gap-1 mb-1">
              <MinusCircle className="h-4 w-4 text-amber-600" />
            </div>
            <div className="text-2xl font-bold text-amber-700">{displayProgress?.partialCount ?? 0}</div>
            <div className="text-xs text-amber-600">Partial</div>
          </div>
          <div className="text-center p-3 bg-red-50 rounded-lg">
            <div className="flex items-center justify-center gap-1 mb-1">
              <XCircle className="h-4 w-4 text-red-500" />
            </div>
            <div className="text-2xl font-bold text-red-600">{displayProgress?.noCount ?? 0}</div>
            <div className="text-xs text-red-500">Missed</div>
          </div>
        </div>

        <div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-xl p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-gray-700">Success Rate</span>
            <Badge 
              variant="outline"
              className={cn(
                "font-semibold",
                successRate >= 80 ? "bg-emerald-100 text-emerald-700 border-emerald-300" :
                successRate >= 50 ? "bg-amber-100 text-amber-700 border-amber-300" :
                "bg-red-100 text-red-600 border-red-300"
              )}
            >
              {successRate.toFixed(0)}%
            </Badge>
          </div>
          <div className="h-3 bg-white rounded-full overflow-hidden">
            <div 
              className={cn(
                "h-full rounded-full transition-all duration-500",
                successRate >= 80 ? "bg-gradient-to-r from-emerald-400 to-emerald-500" :
                successRate >= 50 ? "bg-gradient-to-r from-amber-400 to-amber-500" :
                "bg-gradient-to-r from-red-400 to-red-500"
              )}
              style={{ width: `${Math.min(successRate, 100)}%` }}
            />
          </div>
          <p className="text-xs text-gray-500 mt-2">
            {displayProgress?.checkedInDays ?? 0} of {displayProgress?.totalDays ?? 0} {isSpecificDays ? 'active' : ''} days tracked
          </p>
        </div>

        <div className="border rounded-lg p-3">
          <DayStrip
            startDate={startDate}
            endDate={endDate}
            checkIns={checkIns}
            onDayClick={onDayClick}
          />
        </div>
      </CardContent>
    </Card>
  );
}
