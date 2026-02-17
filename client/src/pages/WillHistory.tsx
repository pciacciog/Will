import { useState } from "react";
import { useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { ChevronLeft, Calendar as CalendarIcon, User, Users, Clock, TrendingUp, CheckCircle, XCircle, MinusCircle, ChevronRight, X } from "lucide-react";
import { getApiPath } from "@/config/api";
import { sessionPersistence } from "@/services/SessionPersistence";
import { cn } from "@/lib/utils";

type WillCheckInStats = {
  total: number;
  completed: number;
  partial: number;
  missed: number;
  successRate: number;
};

type WillHistoryItem = {
  id: number;
  mode: string;
  startDate: string;
  endDate: string;
  status: string;
  checkInType: string | null;
  willType: string | null;
  sharedWhat: string | null;
  circle?: { id: number; inviteCode: string } | null;
  currentUserId: string;
  currentUserParticipant: {
    commitment: string;
    followThrough: string | null;
    reflectionText: string | null;
    checkInType: string | null;
  } | null;
  participants: {
    userId: string;
    firstName: string | null;
    lastName: string | null;
    email: string;
    commitment: string;
    followThrough: string | null;
    reflectionText: string | null;
    checkInType: string | null;
  }[];
  userCheckInStats?: WillCheckInStats;
};

type UserStats = {
  totalWills: number;
  overallSuccessRate: number;
  dailyStats: { totalDays: number; successfulDays: number; successRate: number };
  oneTimeStats: { total: number; successful: number; successRate: number };
};

type WillCheckIn = {
  id: number;
  willId: number;
  userId: string;
  date: string;
  status: string;
  reflectionText: string | null;
};

interface WillHistoryProps {
  mode: 'solo' | 'circle';
}

export default function WillHistory({ mode }: WillHistoryProps) {
  const [, setLocation] = useLocation();
  const [selectedWill, setSelectedWill] = useState<WillHistoryItem | null>(null);
  const isSolo = mode === 'solo';

  const { data: stats, isLoading: statsLoading } = useQuery<UserStats>({
    queryKey: ['/api/user/stats', mode],
    queryFn: async () => {
      const token = await sessionPersistence.getToken();
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (token) headers['Authorization'] = `Bearer ${token}`;
      const response = await fetch(getApiPath(`/api/user/stats?mode=${mode}`), { credentials: 'include', headers });
      if (!response.ok) throw new Error('Failed to fetch stats');
      return response.json();
    },
    staleTime: 30000,
  });

  const { data: history, isLoading: historyLoading, error } = useQuery<WillHistoryItem[]>({
    queryKey: ['/api/wills/history', mode, 'enhanced'],
    queryFn: async () => {
      const token = await sessionPersistence.getToken();
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (token) headers['Authorization'] = `Bearer ${token}`;
      const response = await fetch(getApiPath(`/api/wills/history?mode=${mode}&enhanced=true`), { credentials: 'include', headers });
      if (!response.ok) throw new Error('Failed to fetch history');
      return response.json();
    },
    retry: 1,
    staleTime: 30000,
  });

  const handleBack = () => {
    if (selectedWill) {
      setSelectedWill(null);
    } else {
      setLocation(isSolo ? '/solo/hub' : '/hub');
    }
  };

  const formatDateRange = (startDate: string, endDate: string) => {
    const start = new Date(startDate);
    const end = new Date(endDate);
    const options: Intl.DateTimeFormatOptions = { month: 'short', day: 'numeric' };
    const yearOptions: Intl.DateTimeFormatOptions = { year: 'numeric' };
    const startStr = start.toLocaleDateString('en-US', options);
    const endStr = end.toLocaleDateString('en-US', options);
    const year = end.toLocaleDateString('en-US', yearOptions);
    return `${startStr} - ${endStr}, ${year}`;
  };

  const formatSingleDate = (dateStr: string) => {
    const date = new Date(dateStr);
    const options: Intl.DateTimeFormatOptions = { month: 'short', day: 'numeric', year: 'numeric' };
    return date.toLocaleDateString('en-US', options);
  };

  const getFollowThroughBadge = (value: string | null) => {
    switch (value) {
      case 'yes':
        return <Badge className="bg-emerald-100 text-emerald-700 border border-emerald-200 text-xs px-2 py-0.5">Yes</Badge>;
      case 'mostly':
        return <Badge className="bg-amber-100 text-amber-700 border border-amber-200 text-xs px-2 py-0.5">Mostly</Badge>;
      case 'no':
        return <Badge className="bg-rose-100 text-rose-700 border border-rose-200 text-xs px-2 py-0.5">No</Badge>;
      default:
        return <Badge className="bg-gray-100 text-gray-500 border border-gray-200 text-xs px-2 py-0.5">No Review</Badge>;
    }
  };

  const getUserCheckInType = (will: WillHistoryItem) => {
    if (will.mode === 'solo') return will.checkInType || 'one-time';
    if (will.willType === 'cumulative') return will.checkInType || 'one-time';
    // Use current user's participant data for classic circle wills
    return will.currentUserParticipant?.checkInType || 'one-time';
  };

  const themeColors = isSolo
    ? {
        gradient: 'from-gray-50 via-white to-purple-50/30',
        iconBg: 'from-purple-50 to-indigo-50',
        iconBorder: 'border-purple-100',
        iconColor: 'text-purple-600',
        cardBorder: 'border-purple-100',
        headerColor: 'text-purple-700',
        accentBg: 'bg-purple-50',
        accentText: 'text-purple-600',
        statsBg: 'bg-gradient-to-r from-purple-500 to-indigo-600',
      }
    : {
        gradient: 'from-gray-50 via-white to-emerald-50/30',
        iconBg: 'from-emerald-50 to-teal-50',
        iconBorder: 'border-emerald-100',
        iconColor: 'text-emerald-600',
        cardBorder: 'border-emerald-100',
        headerColor: 'text-emerald-700',
        accentBg: 'bg-emerald-50',
        accentText: 'text-emerald-600',
        statsBg: 'bg-gradient-to-r from-emerald-500 to-teal-600',
      };

  const isLoading = statsLoading || historyLoading;

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className={`animate-spin rounded-full h-8 w-8 border-b-2 ${isSolo ? 'border-purple-500' : 'border-emerald-500'}`}></div>
      </div>
    );
  }

  // Detail View
  if (selectedWill) {
    return (
      <WillDetailView 
        will={selectedWill} 
        mode={mode}
        themeColors={themeColors}
        onBack={() => setSelectedWill(null)}
        formatSingleDate={formatSingleDate}
        getFollowThroughBadge={getFollowThroughBadge}
      />
    );
  }

  return (
    <div className={`min-h-screen bg-gradient-to-br ${themeColors.gradient}`}>
      <div className="pt-[calc(env(safe-area-inset-top)+3rem)] pb-[calc(env(safe-area-inset-bottom)+2rem)] min-h-screen">
        <div className="max-w-sm mx-auto px-5">
          
          {/* Header with Back Button */}
          <div className="relative flex items-center justify-between mb-4 min-h-[44px]">
            <button
              onClick={handleBack}
              className="w-11 h-11 -ml-2 flex items-center justify-center"
              data-testid="button-back"
              aria-label="Go back"
            >
              <span className="w-8 h-8 flex items-center justify-center rounded-lg bg-gray-100 border border-gray-200 text-gray-700 hover:text-gray-900 hover:bg-gray-200 hover:border-gray-300 transition-all duration-200 active:scale-95">
                <ChevronLeft className="w-5 h-5" strokeWidth={2.5} />
              </span>
            </button>
            
            <h1 className="absolute left-0 right-0 text-center text-xl font-semibold text-gray-900 pointer-events-none">
              {isSolo ? 'Solo' : 'Circle'} Insights
            </h1>
            
            <div className="w-9" />
          </div>

          {/* Overall Stats Section */}
          {stats && stats.totalWills > 0 && (
            <div className={`${themeColors.statsBg} rounded-2xl p-5 mb-6 text-white shadow-lg`}>
              <div className="flex items-center gap-2 mb-4">
                <TrendingUp className="w-5 h-5" />
                <h2 className="text-lg font-semibold">Your Stats</h2>
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-white/20 rounded-xl p-3 text-center backdrop-blur-sm">
                  <div className="text-3xl font-bold">{stats.totalWills}</div>
                  <div className="text-sm opacity-90">Total Wills</div>
                </div>
                <div className="bg-white/20 rounded-xl p-3 text-center backdrop-blur-sm">
                  <div className="text-3xl font-bold">{stats.overallSuccessRate}%</div>
                  <div className="text-sm opacity-90">Success Rate</div>
                </div>
              </div>
            </div>
          )}

          {/* Mode Icon */}
          <div className="text-center mb-4">
            <div className="inline-flex items-center justify-center mb-2">
              <div className="relative">
                <div className={`relative w-12 h-12 bg-gradient-to-br ${themeColors.iconBg} rounded-full border-2 ${themeColors.iconBorder} flex items-center justify-center shadow-md`}>
                  {isSolo ? (
                    <User className={`w-6 h-6 ${themeColors.iconColor}`} />
                  ) : (
                    <Users className={`w-6 h-6 ${themeColors.iconColor}`} />
                  )}
                </div>
              </div>
            </div>
            <p className="text-gray-500 text-sm">
              Your completed {isSolo ? 'solo' : 'circle'} wills
            </p>
          </div>

          {/* History List */}
          {error ? (
            <EmptyState isSolo={isSolo} themeColors={themeColors} message="No History Available" />
          ) : history && history.length > 0 ? (
            <div className="space-y-3">
              {history.map((will) => {
                const checkInType = getUserCheckInType(will);
                const isDailyTracked = checkInType === 'daily';
                // Use current user's data, not participants[0]
                const userData = will.currentUserParticipant;
                const commitment = will.sharedWhat || userData?.commitment || 'Commitment';
                
                return (
                  <Card 
                    key={will.id} 
                    className={`border ${themeColors.cardBorder} shadow-sm overflow-hidden cursor-pointer hover:shadow-md transition-shadow`}
                    data-testid={`card-will-${will.id}`}
                    onClick={() => setSelectedWill(will)}
                  >
                    <CardContent className="p-4">
                      {/* Will Summary */}
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex-1 min-w-0">
                          {/* Commitment Text */}
                          <p className="text-gray-900 font-medium text-sm line-clamp-2 mb-2">
                            {commitment}
                          </p>
                          
                          {/* Date */}
                          <div className="flex items-center gap-1.5 text-gray-500 text-xs mb-2">
                            <CalendarIcon className="w-3.5 h-3.5" />
                            <span>{formatDateRange(will.startDate, will.endDate)}</span>
                          </div>
                          
                          {/* Status */}
                          {isDailyTracked && will.userCheckInStats ? (
                            <div className={`inline-flex items-center gap-1.5 ${themeColors.accentBg} px-2 py-1 rounded-lg`}>
                              <TrendingUp className={`w-3.5 h-3.5 ${themeColors.accentText}`} />
                              <span className={`text-xs font-medium ${themeColors.accentText}`}>
                                {will.userCheckInStats.successRate}% ({will.userCheckInStats.completed}/{will.userCheckInStats.total} days)
                              </span>
                            </div>
                          ) : (
                            <div className="flex items-center gap-2">
                              {getFollowThroughBadge(userData?.followThrough ?? null)}
                            </div>
                          )}
                        </div>
                        
                        {/* Arrow */}
                        <ChevronRight className="w-5 h-5 text-gray-400 flex-shrink-0 mt-1" />
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          ) : (
            <EmptyState isSolo={isSolo} themeColors={themeColors} message="No History Yet" />
          )}

        </div>
      </div>
    </div>
  );
}

function EmptyState({ isSolo, themeColors, message }: { isSolo: boolean; themeColors: any; message: string }) {
  return (
    <div className="text-center py-12">
      <div className={`w-16 h-16 mx-auto mb-4 bg-gradient-to-br ${themeColors.iconBg} rounded-full border-2 ${themeColors.iconBorder} flex items-center justify-center`}>
        <Clock className={`w-8 h-8 ${themeColors.iconColor} opacity-50`} />
      </div>
      <h3 className="text-lg font-medium text-gray-900 mb-2">{message}</h3>
      <p className="text-gray-500 text-sm">
        {isSolo 
          ? "Complete your first solo Will to see it here."
          : "Complete your first circle Will to see it here."
        }
      </p>
    </div>
  );
}

interface WillDetailViewProps {
  will: WillHistoryItem;
  mode: 'solo' | 'circle';
  themeColors: any;
  onBack: () => void;
  formatSingleDate: (date: string) => string;
  getFollowThroughBadge: (value: string | null) => JSX.Element;
}

function WillDetailView({ will, mode, themeColors, onBack, formatSingleDate, getFollowThroughBadge }: WillDetailViewProps) {
  const isSolo = mode === 'solo';
  
  const getUserCheckInType = () => {
    if (will.mode === 'solo') return will.checkInType || 'one-time';
    if (will.willType === 'cumulative') return will.checkInType || 'one-time';
    // Use current user's check-in type for classic circle wills
    return will.currentUserParticipant?.checkInType || 'one-time';
  };
  
  const checkInType = getUserCheckInType();
  const isDailyTracked = checkInType === 'daily';
  // Use current user's data, not participants[0]
  const userData = will.currentUserParticipant;
  const commitment = will.sharedWhat || userData?.commitment || 'Commitment';

  // Fetch check-ins for daily tracked wills
  const { data: checkIns = [] } = useQuery<WillCheckIn[]>({
    queryKey: [`/api/wills/${will.id}/check-ins`],
    queryFn: async () => {
      const token = await sessionPersistence.getToken();
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (token) headers['Authorization'] = `Bearer ${token}`;
      const response = await fetch(getApiPath(`/api/wills/${will.id}/check-ins`), { credentials: 'include', headers });
      if (!response.ok) throw new Error('Failed to fetch check-ins');
      return response.json();
    },
    enabled: isDailyTracked,
  });

  const checkInMap = new Map<string, WillCheckIn>();
  checkIns.forEach(c => checkInMap.set(c.date, c));

  const formatDateKey = (date: Date) => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  const willStart = new Date(will.startDate);
  const willEnd = new Date(will.endDate);

  const isDateInWillRange = (date: Date) => {
    const dateNormalized = new Date(date);
    dateNormalized.setHours(0, 0, 0, 0);
    const startNormalized = new Date(willStart);
    startNormalized.setHours(0, 0, 0, 0);
    const endNormalized = new Date(willEnd);
    endNormalized.setHours(0, 0, 0, 0);
    return dateNormalized >= startNormalized && dateNormalized <= endNormalized;
  };

  const getDateStatus = (date: Date): 'yes' | 'no' | 'partial' | null => {
    const dateKey = formatDateKey(date);
    const checkIn = checkInMap.get(dateKey);
    return checkIn ? checkIn.status as 'yes' | 'no' | 'partial' : null;
  };

  // Generate daily breakdown for daily tracked wills
  const dailyBreakdown = isDailyTracked ? (() => {
    const days: { date: Date; dateKey: string; status: string | null; reflection: string | null }[] = [];
    const current = new Date(willStart);
    while (current <= willEnd) {
      const dateKey = formatDateKey(current);
      const checkIn = checkInMap.get(dateKey);
      days.push({
        date: new Date(current),
        dateKey,
        status: checkIn?.status || null,
        reflection: checkIn?.reflectionText || null,
      });
      current.setDate(current.getDate() + 1);
    }
    return days;
  })() : [];

  const formatDayLabel = (date: Date) => {
    const options: Intl.DateTimeFormatOptions = { weekday: 'short', month: 'numeric', day: 'numeric' };
    return date.toLocaleDateString('en-US', options);
  };

  const getStatusIcon = (status: string | null) => {
    switch (status) {
      case 'yes':
        return <CheckCircle className="w-5 h-5 text-emerald-500" />;
      case 'partial':
        return <MinusCircle className="w-5 h-5 text-amber-500" />;
      case 'no':
        return <XCircle className="w-5 h-5 text-rose-500" />;
      default:
        return <div className="w-5 h-5 rounded-full border-2 border-gray-300" />;
    }
  };

  const getStatusLabel = (status: string | null) => {
    switch (status) {
      case 'yes': return 'Yes';
      case 'partial': return 'Partial';
      case 'no': return 'No';
      default: return 'Not logged';
    }
  };

  return (
    <div className={`min-h-screen bg-gradient-to-br ${themeColors.gradient}`}>
      <div className="pt-[calc(env(safe-area-inset-top)+3rem)] pb-[calc(env(safe-area-inset-bottom)+2rem)] min-h-screen">
        <div className="max-w-sm mx-auto px-5">
          
          {/* Header */}
          <div className="relative flex items-center justify-between mb-4 min-h-[44px]">
            <button
              onClick={onBack}
              className="w-11 h-11 -ml-2 flex items-center justify-center"
              data-testid="button-back-detail"
              aria-label="Go back"
            >
              <span className="w-8 h-8 flex items-center justify-center rounded-lg bg-gray-100 border border-gray-200 text-gray-700 hover:text-gray-900 hover:bg-gray-200 hover:border-gray-300 transition-all duration-200 active:scale-95">
                <ChevronLeft className="w-5 h-5" strokeWidth={2.5} />
              </span>
            </button>
            
            <h1 className="absolute left-0 right-0 text-center text-xl font-semibold text-gray-900 pointer-events-none">Will Details</h1>
            
            <div className="w-9" />
          </div>

          {/* Commitment Header */}
          <div className={`${themeColors.accentBg} rounded-xl p-4 mb-4 border ${themeColors.cardBorder}`}>
            <p className="text-gray-900 font-medium mb-2">{commitment}</p>
            <div className="flex items-center gap-1.5 text-gray-500 text-sm">
              <CalendarIcon className="w-4 h-4" />
              <span>{formatSingleDate(will.startDate)} - {formatSingleDate(will.endDate)}</span>
            </div>
          </div>

          {/* Daily Tracked Will */}
          {isDailyTracked ? (
            <>
              {/* Stats Summary */}
              {will.userCheckInStats && (
                <div className="bg-white rounded-xl p-4 mb-4 border border-gray-200 shadow-sm">
                  <h3 className="text-sm font-semibold text-gray-700 mb-3">Summary</h3>
                  <div className="grid grid-cols-4 gap-2 text-center mb-3">
                    <div>
                      <div className="text-xl font-bold text-emerald-600">{will.userCheckInStats.completed}</div>
                      <div className="text-xs text-gray-500">Yes</div>
                    </div>
                    <div>
                      <div className="text-xl font-bold text-amber-600">{will.userCheckInStats.partial}</div>
                      <div className="text-xs text-gray-500">Partial</div>
                    </div>
                    <div>
                      <div className="text-xl font-bold text-rose-600">{will.userCheckInStats.missed}</div>
                      <div className="text-xs text-gray-500">Missed</div>
                    </div>
                    <div>
                      <div className={`text-xl font-bold ${themeColors.accentText}`}>{will.userCheckInStats.successRate}%</div>
                      <div className="text-xs text-gray-500">Rate</div>
                    </div>
                  </div>
                </div>
              )}

              {/* Calendar View */}
              <div className="bg-white rounded-xl p-4 mb-4 border border-gray-200 shadow-sm">
                <h3 className="text-sm font-semibold text-gray-700 mb-3">Calendar</h3>
                <Calendar
                  mode="single"
                  month={willStart}
                  defaultMonth={willStart}
                  className="rounded-md border-0 w-full"
                  classNames={{
                    months: "flex flex-col",
                    month: "space-y-2",
                    caption: "flex justify-center pt-1 relative items-center text-sm font-medium",
                    caption_label: "text-sm font-medium",
                    nav: "space-x-1 flex items-center",
                    nav_button: "h-7 w-7 bg-transparent p-0 opacity-50 hover:opacity-100",
                    nav_button_previous: "absolute left-1",
                    nav_button_next: "absolute right-1",
                    table: "w-full border-collapse",
                    head_row: "flex justify-between",
                    head_cell: "text-gray-500 rounded-md w-8 font-normal text-[0.7rem]",
                    row: "flex w-full mt-1 justify-between",
                    cell: "text-center text-xs p-0 relative",
                    day: cn(
                      "h-8 w-8 p-0 font-normal text-xs rounded-full flex items-center justify-center",
                      "hover:bg-gray-100 focus:bg-gray-100"
                    ),
                    day_selected: "bg-primary text-primary-foreground hover:bg-primary hover:text-primary-foreground focus:bg-primary focus:text-primary-foreground",
                    day_today: "border border-gray-300",
                    day_outside: "text-gray-300 opacity-50",
                    day_disabled: "text-gray-300 opacity-50",
                    day_hidden: "invisible",
                  }}
                  modifiers={{
                    yes: (date) => isDateInWillRange(date) && getDateStatus(date) === 'yes',
                    no: (date) => isDateInWillRange(date) && getDateStatus(date) === 'no',
                    partial: (date) => isDateInWillRange(date) && getDateStatus(date) === 'partial',
                    inRange: (date) => isDateInWillRange(date),
                  }}
                  modifiersClassNames={{
                    yes: "bg-emerald-500 text-white hover:bg-emerald-600",
                    no: "bg-rose-500 text-white hover:bg-rose-600",
                    partial: "bg-amber-400 text-white hover:bg-amber-500",
                    inRange: "ring-1 ring-inset ring-gray-200",
                  }}
                  disabled={(date) => !isDateInWillRange(date)}
                />
              </div>

              {/* Daily Breakdown */}
              <div className="bg-white rounded-xl p-4 border border-gray-200 shadow-sm">
                <h3 className="text-sm font-semibold text-gray-700 mb-3">Daily Breakdown</h3>
                <div className="space-y-2 max-h-64 overflow-y-auto">
                  {dailyBreakdown.map((day) => (
                    <div key={day.dateKey} className="flex items-start gap-3 py-2 border-b border-gray-100 last:border-0">
                      {getStatusIcon(day.status)}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between">
                          <span className="text-sm font-medium text-gray-700">{formatDayLabel(day.date)}</span>
                          <span className={cn(
                            "text-xs",
                            day.status === 'yes' && "text-emerald-600",
                            day.status === 'partial' && "text-amber-600",
                            day.status === 'no' && "text-rose-600",
                            !day.status && "text-gray-400"
                          )}>
                            {getStatusLabel(day.status)}
                          </span>
                        </div>
                        {day.reflection && (
                          <p className="text-xs text-gray-500 italic mt-1">"{day.reflection}"</p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </>
          ) : (
            /* One-Time Will */
            <div className="bg-white rounded-xl p-4 border border-gray-200 shadow-sm">
              <h3 className="text-sm font-semibold text-gray-700 mb-3">Result</h3>
              <div className="flex items-center gap-3 mb-3">
                <span className="text-gray-600">Status:</span>
                {getFollowThroughBadge(userData?.followThrough ?? null)}
              </div>
              {userData?.reflectionText && (
                <div className="mt-3 pt-3 border-t border-gray-100">
                  <p className="text-sm text-gray-500 italic">"{userData.reflectionText}"</p>
                </div>
              )}
            </div>
          )}

        </div>
      </div>
    </div>
  );
}
