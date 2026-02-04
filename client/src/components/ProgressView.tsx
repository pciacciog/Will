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
  endDate: string;
  checkInType: 'daily' | 'one-time';
  onDayClick?: (date: string) => void;
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

export default function ProgressView({ willId, startDate, endDate, checkInType, onDayClick }: ProgressViewProps) {
  const { data: checkIns = [], isLoading: checkInsLoading } = useQuery<WillCheckIn[]>({
    queryKey: [`/api/wills/${willId}/check-ins`],
    enabled: checkInType === 'daily',
  });

  const { data: progress, isLoading: progressLoading } = useQuery<CheckInProgress>({
    queryKey: [`/api/wills/${willId}/check-in-progress`],
    enabled: checkInType === 'daily',
  });

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
