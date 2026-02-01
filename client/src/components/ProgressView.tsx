import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Calendar } from "@/components/ui/calendar";
import { CheckCircle, XCircle, MinusCircle, TrendingUp, CalendarDays, Target } from "lucide-react";
import { cn } from "@/lib/utils";
import type { WillCheckIn } from "@shared/schema";

interface ProgressViewProps {
  willId: number;
  startDate: string;
  endDate: string;
  checkInType: 'daily' | 'one-time';
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

export default function ProgressView({ willId, startDate, endDate, checkInType }: ProgressViewProps) {
  const { data: checkIns = [], isLoading: checkInsLoading } = useQuery<WillCheckIn[]>({
    queryKey: ['/api/wills', willId, 'check-ins'],
    enabled: checkInType === 'daily',
  });

  const { data: progress, isLoading: progressLoading } = useQuery<CheckInProgress>({
    queryKey: ['/api/wills', willId, 'check-in-progress'],
    enabled: checkInType === 'daily',
  });

  const willStart = new Date(startDate);
  const willEnd = new Date(endDate);
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

  const getDateStatus = (date: Date): 'yes' | 'no' | 'partial' | null => {
    const dateKey = formatDateKey(date);
    const checkIn = checkInMap.get(dateKey);
    return checkIn ? checkIn.status as 'yes' | 'no' | 'partial' : null;
  };

  const isDateInWillRange = (date: Date) => {
    const dateNormalized = new Date(date);
    dateNormalized.setHours(0, 0, 0, 0);
    
    const startNormalized = new Date(willStart);
    startNormalized.setHours(0, 0, 0, 0);
    
    const endNormalized = new Date(willEnd);
    endNormalized.setHours(0, 0, 0, 0);
    
    return dateNormalized >= startNormalized && dateNormalized <= endNormalized;
  };

  const isDateDisabled = (date: Date) => {
    return !isDateInWillRange(date);
  };

  if (checkInType === 'one-time') {
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
              This Will uses one-time tracking. Complete your final review at the end to mark it done!
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

  const successRate = progress?.successRate ?? 0;

  return (
    <Card className="border-gray-100">
      <CardHeader className="pb-3">
        <CardTitle className="text-lg flex items-center gap-2">
          <CalendarDays className="h-5 w-5 text-blue-500" />
          Daily Progress
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="grid grid-cols-3 gap-3">
          <div className="text-center p-3 bg-emerald-50 rounded-lg">
            <div className="flex items-center justify-center gap-1 mb-1">
              <CheckCircle className="h-4 w-4 text-emerald-600" />
            </div>
            <div className="text-2xl font-bold text-emerald-700">{progress?.yesCount ?? 0}</div>
            <div className="text-xs text-emerald-600">Completed</div>
          </div>
          <div className="text-center p-3 bg-amber-50 rounded-lg">
            <div className="flex items-center justify-center gap-1 mb-1">
              <MinusCircle className="h-4 w-4 text-amber-600" />
            </div>
            <div className="text-2xl font-bold text-amber-700">{progress?.partialCount ?? 0}</div>
            <div className="text-xs text-amber-600">Partial</div>
          </div>
          <div className="text-center p-3 bg-red-50 rounded-lg">
            <div className="flex items-center justify-center gap-1 mb-1">
              <XCircle className="h-4 w-4 text-red-500" />
            </div>
            <div className="text-2xl font-bold text-red-600">{progress?.noCount ?? 0}</div>
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
            {progress?.checkedInDays ?? 0} of {progress?.totalDays ?? 0} days tracked
          </p>
        </div>

        {(progress?.streak ?? 0) > 1 && (
          <div className="flex items-center gap-3 p-3 bg-gradient-to-r from-orange-50 to-yellow-50 rounded-lg">
            <TrendingUp className="h-5 w-5 text-orange-500" />
            <div>
              <span className="font-semibold text-orange-700">{progress?.streak} day streak!</span>
              <p className="text-xs text-orange-600">Keep it going!</p>
            </div>
          </div>
        )}

        <div className="border rounded-lg p-2">
          <Calendar
            mode="single"
            disabled={isDateDisabled}
            modifiers={{
              success: (date) => getDateStatus(date) === 'yes',
              partial: (date) => getDateStatus(date) === 'partial',
              failed: (date) => getDateStatus(date) === 'no',
              inRange: (date) => isDateInWillRange(date) && !getDateStatus(date),
            }}
            modifiersStyles={{
              success: { backgroundColor: '#dcfce7', color: '#166534' },
              partial: { backgroundColor: '#fef3c7', color: '#92400e' },
              failed: { backgroundColor: '#fee2e2', color: '#dc2626' },
              inRange: { backgroundColor: '#f3f4f6' },
            }}
            className="rounded-md mx-auto"
          />
          <div className="flex items-center justify-center gap-4 mt-3 text-xs">
            <div className="flex items-center gap-1">
              <div className="w-3 h-3 rounded-full bg-emerald-200" />
              <span className="text-gray-600">Done</span>
            </div>
            <div className="flex items-center gap-1">
              <div className="w-3 h-3 rounded-full bg-amber-200" />
              <span className="text-gray-600">Partial</span>
            </div>
            <div className="flex items-center gap-1">
              <div className="w-3 h-3 rounded-full bg-red-200" />
              <span className="text-gray-600">Missed</span>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
