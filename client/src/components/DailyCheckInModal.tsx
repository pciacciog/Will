import { useState, useEffect, useMemo, useCallback } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { CheckCircle, XCircle, MinusCircle, ChevronLeft, ChevronRight, ChevronDown, ChevronUp } from "lucide-react";
import { cn } from "@/lib/utils";
import type { WillCheckIn } from "@shared/schema";

interface DailyCheckInModalProps {
  isOpen: boolean;
  onClose: () => void;
  willId: number;
  startDate: string;
  endDate: string;
  existingCheckIns?: WillCheckIn[];
  initialDate?: string | null;
}

type CheckInStatus = 'yes' | 'no' | 'partial';

const DAY_LABELS = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];

function formatDateKey(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function getWeekStart(date: Date): Date {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  const day = d.getDay();
  d.setDate(d.getDate() - day);
  return d;
}

function getMonthDays(year: number, month: number): Date[] {
  const days: Date[] = [];
  const firstDay = new Date(year, month, 1);
  const startPad = firstDay.getDay();
  
  for (let i = startPad - 1; i >= 0; i--) {
    const d = new Date(year, month, -i);
    days.push(d);
  }
  
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  for (let i = 1; i <= daysInMonth; i++) {
    days.push(new Date(year, month, i));
  }
  
  const remaining = 7 - (days.length % 7);
  if (remaining < 7) {
    for (let i = 1; i <= remaining; i++) {
      days.push(new Date(year, month + 1, i));
    }
  }
  
  return days;
}

export default function DailyCheckInModal({ 
  isOpen, 
  onClose, 
  willId, 
  startDate, 
  endDate,
  existingCheckIns = [],
  initialDate = null
}: DailyCheckInModalProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  const [viewMode, setViewMode] = useState<'week' | 'month'>('week');
  const [currentWeekStart, setCurrentWeekStart] = useState<Date>(() => getWeekStart(new Date()));
  const [currentMonth, setCurrentMonth] = useState<Date>(() => new Date());
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [status, setStatus] = useState<CheckInStatus | null>(null);
  
  const willStart = useMemo(() => { const d = new Date(startDate); d.setHours(0, 0, 0, 0); return d; }, [startDate]);
  const willEnd = useMemo(() => { const d = new Date(endDate); d.setHours(0, 0, 0, 0); return d; }, [endDate]);
  const today = useMemo(() => { const d = new Date(); d.setHours(0, 0, 0, 0); return d; }, []);

  const checkInMap = useMemo(() => {
    const map = new Map<string, WillCheckIn>();
    existingCheckIns.forEach(c => map.set(c.date, c));
    return map;
  }, [existingCheckIns]);

  useEffect(() => {
    if (isOpen) {
      setViewMode('week');
      setStatus(null);
      
      if (initialDate) {
        const date = new Date(initialDate + 'T12:00:00');
        date.setHours(0, 0, 0, 0);
        setSelectedDate(date);
        setCurrentWeekStart(getWeekStart(date));
        setCurrentMonth(new Date(date.getFullYear(), date.getMonth(), 1));
        const existing = checkInMap.get(initialDate);
        if (existing) setStatus(existing.status as CheckInStatus);
      } else {
        setSelectedDate(today);
        setCurrentWeekStart(getWeekStart(today));
        setCurrentMonth(new Date(today.getFullYear(), today.getMonth(), 1));
        const todayKey = formatDateKey(today);
        const existing = checkInMap.get(todayKey);
        if (existing) setStatus(existing.status as CheckInStatus);
      }
    }
  }, [isOpen, initialDate, today, checkInMap]);

  const isDateDisabled = useCallback((date: Date): boolean => {
    const d = new Date(date);
    d.setHours(0, 0, 0, 0);
    if (d < willStart || d > willEnd) return true;
    if (d > today) return true;
    return false;
  }, [willStart, willEnd, today]);

  const getDateStatus = useCallback((date: Date): CheckInStatus | null => {
    const key = formatDateKey(date);
    const checkIn = checkInMap.get(key);
    return checkIn ? checkIn.status as CheckInStatus : null;
  }, [checkInMap]);

  const weekDays = useMemo(() => {
    const days: Date[] = [];
    for (let i = 0; i < 7; i++) {
      const d = new Date(currentWeekStart);
      d.setDate(d.getDate() + i);
      days.push(d);
    }
    return days;
  }, [currentWeekStart]);

  const monthDays = useMemo(() => {
    return getMonthDays(currentMonth.getFullYear(), currentMonth.getMonth());
  }, [currentMonth]);

  const weekLabel = useMemo(() => {
    const end = new Date(currentWeekStart);
    end.setDate(end.getDate() + 6);
    const startMonth = currentWeekStart.toLocaleDateString('en-US', { month: 'short' });
    const endMonth = end.toLocaleDateString('en-US', { month: 'short' });
    if (startMonth === endMonth) {
      return `${startMonth} ${currentWeekStart.getDate()} – ${end.getDate()}`;
    }
    return `${startMonth} ${currentWeekStart.getDate()} – ${endMonth} ${end.getDate()}`;
  }, [currentWeekStart]);

  const monthLabel = useMemo(() => {
    return currentMonth.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
  }, [currentMonth]);

  const navigateWeek = (direction: number) => {
    setCurrentWeekStart(prev => {
      const d = new Date(prev);
      d.setDate(d.getDate() + direction * 7);
      return d;
    });
  };

  const navigateMonth = (direction: number) => {
    setCurrentMonth(prev => {
      const d = new Date(prev);
      d.setMonth(d.getMonth() + direction);
      return d;
    });
  };

  const handleDateSelect = (date: Date) => {
    if (isDateDisabled(date)) return;
    const d = new Date(date);
    d.setHours(0, 0, 0, 0);
    setSelectedDate(d);
    const existingStatus = getDateStatus(d);
    setStatus(existingStatus);
  };

  const toggleView = () => {
    if (viewMode === 'week') {
      const refDate = selectedDate || today;
      setCurrentMonth(new Date(refDate.getFullYear(), refDate.getMonth(), 1));
      setViewMode('month');
    } else {
      const refDate = selectedDate || today;
      setCurrentWeekStart(getWeekStart(refDate));
      setViewMode('week');
    }
  };

  const submitCheckInMutation = useMutation({
    mutationFn: async (data: { date: string; status: string }) => {
      const res = await apiRequest(`/api/wills/${willId}/check-ins`, {
        method: 'POST',
        body: JSON.stringify(data)
      });
      return await res.json();
    },
    onSuccess: () => {
      toast({
        title: "Check-in recorded!",
        description: status === 'yes' 
          ? "Great job staying on track!" 
          : status === 'partial' 
            ? "Every bit of progress counts!" 
            : "Thanks for being honest. Tomorrow is a new day!",
        duration: 4000,
      });
      queryClient.invalidateQueries({ queryKey: [`/api/wills/${willId}/check-ins`] });
      queryClient.invalidateQueries({ queryKey: [`/api/wills/${willId}/check-in-progress`] });
      onClose();
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to record check-in",
        variant: "destructive",
        duration: 4000,
      });
    },
  });

  const handleSubmit = () => {
    if (!selectedDate || !status) return;
    submitCheckInMutation.mutate({
      date: formatDateKey(selectedDate),
      status
    });
  };

  const statusOptions: { value: CheckInStatus; label: string; icon: typeof CheckCircle; color: string; bgColor: string; selectedBg: string }[] = [
    { 
      value: 'yes', 
      label: 'Yes, I did it!', 
      icon: CheckCircle, 
      color: 'text-emerald-600',
      bgColor: 'bg-white border-gray-200 hover:border-emerald-300 hover:bg-emerald-50',
      selectedBg: 'bg-emerald-50 border-emerald-400 ring-2 ring-emerald-200'
    },
    { 
      value: 'partial', 
      label: 'Partially done', 
      icon: MinusCircle, 
      color: 'text-amber-600',
      bgColor: 'bg-white border-gray-200 hover:border-amber-300 hover:bg-amber-50',
      selectedBg: 'bg-amber-50 border-amber-400 ring-2 ring-amber-200'
    },
    { 
      value: 'no', 
      label: 'No, not today', 
      icon: XCircle, 
      color: 'text-red-500',
      bgColor: 'bg-white border-gray-200 hover:border-red-300 hover:bg-red-50',
      selectedBg: 'bg-red-50 border-red-400 ring-2 ring-red-200'
    },
  ];

  const renderDayCell = (date: Date, isCurrentMonth: boolean = true) => {
    const d = new Date(date);
    d.setHours(0, 0, 0, 0);
    const key = formatDateKey(d);
    const disabled = isDateDisabled(d);
    const isToday = d.getTime() === today.getTime();
    const isSelected = selectedDate ? d.getTime() === selectedDate.getTime() : false;
    const dayStatus = getDateStatus(d);
    const isOutOfMonth = !isCurrentMonth;

    let bgClass = 'bg-white text-gray-300';
    if (!disabled) {
      if (dayStatus === 'yes') bgClass = isOutOfMonth ? 'bg-emerald-300 text-white' : 'bg-emerald-500 text-white';
      else if (dayStatus === 'partial') bgClass = isOutOfMonth ? 'bg-amber-300 text-white' : 'bg-amber-400 text-white';
      else if (dayStatus === 'no') bgClass = isOutOfMonth ? 'bg-red-300 text-white' : 'bg-red-500 text-white';
      else bgClass = isOutOfMonth ? 'bg-gray-50 text-gray-400 hover:bg-gray-100' : 'bg-gray-100 text-gray-700 hover:bg-gray-200';
    }

    let ringClass = '';
    if (isSelected) ringClass = 'ring-2 ring-blue-500 ring-offset-2';
    else if (isToday && !disabled) ringClass = 'ring-2 ring-amber-400 ring-offset-1';

    return (
      <button
        key={key}
        type="button"
        onClick={() => handleDateSelect(d)}
        disabled={disabled}
        className={cn(
          "w-10 h-10 rounded-full flex items-center justify-center text-sm font-medium transition-all duration-150",
          bgClass,
          ringClass,
          disabled ? "opacity-40 cursor-not-allowed" : "cursor-pointer active:scale-95"
        )}
        data-testid={`day-cell-${key}`}
      >
        {d.getDate()}
      </button>
    );
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-md mx-auto max-h-[90vh] overflow-y-auto p-0">
        <DialogHeader className="px-5 pt-5 pb-0">
          <DialogTitle className="text-lg font-semibold" data-testid="text-checkin-title">Check In</DialogTitle>
          <DialogDescription className="sr-only">Select a day and record your check-in status</DialogDescription>
        </DialogHeader>

        <div className="px-5 pb-5 space-y-4">
          <div className="flex items-center justify-between">
            <button
              onClick={() => viewMode === 'week' ? navigateWeek(-1) : navigateMonth(-1)}
              className="p-1.5 rounded-full hover:bg-gray-100 transition-colors"
              data-testid="button-nav-prev"
            >
              <ChevronLeft className="w-5 h-5 text-gray-600" />
            </button>
            <span className="text-sm font-semibold text-gray-800" data-testid="text-nav-label">
              {viewMode === 'week' ? weekLabel : monthLabel}
            </span>
            <div className="flex items-center gap-1">
              <button
                onClick={() => viewMode === 'week' ? navigateWeek(1) : navigateMonth(1)}
                className="p-1.5 rounded-full hover:bg-gray-100 transition-colors"
                data-testid="button-nav-next"
              >
                <ChevronRight className="w-5 h-5 text-gray-600" />
              </button>
              <button
                onClick={toggleView}
                className="flex items-center gap-1 ml-1 px-2.5 py-1 rounded-full text-xs font-medium text-gray-600 bg-gray-100 hover:bg-gray-200 transition-colors"
                data-testid="button-toggle-view"
              >
                {viewMode === 'week' ? (
                  <>
                    <ChevronDown className="w-3.5 h-3.5" />
                    Month
                  </>
                ) : (
                  <>
                    <ChevronUp className="w-3.5 h-3.5" />
                    Week
                  </>
                )}
              </button>
            </div>
          </div>

          <div className="grid grid-cols-7 gap-0 mb-1">
            {DAY_LABELS.map(label => (
              <div key={label} className="text-center text-xs font-medium text-gray-400 py-1">
                {label}
              </div>
            ))}
          </div>

          {viewMode === 'week' ? (
            <div className="grid grid-cols-7 gap-0 place-items-center">
              {weekDays.map(day => renderDayCell(day, true))}
            </div>
          ) : (
            <div className="grid grid-cols-7 gap-y-1 place-items-center transition-all duration-300">
              {monthDays.map(day => {
                const isCurrentMonth = day.getMonth() === currentMonth.getMonth();
                return renderDayCell(day, isCurrentMonth);
              })}
            </div>
          )}

          <div className="flex items-center justify-center gap-4 text-xs pt-1">
            <div className="flex items-center gap-1.5">
              <div className="w-2.5 h-2.5 rounded-full ring-2 ring-amber-400 ring-offset-1 bg-white" />
              <span className="text-gray-500">Today</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
              <span className="text-gray-500">Done</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-2.5 h-2.5 rounded-full bg-amber-400" />
              <span className="text-gray-500">Partial</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-2.5 h-2.5 rounded-full bg-red-500" />
              <span className="text-gray-500">Missed</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-2.5 h-2.5 rounded-full bg-gray-200" />
              <span className="text-gray-500">Pending</span>
            </div>
          </div>

          {selectedDate && !isDateDisabled(selectedDate) && (
            <div className="space-y-3 pt-2 border-t border-gray-100">
              <div className="text-center">
                <span className="text-sm font-medium text-gray-700">
                  {selectedDate.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
                </span>
                {getDateStatus(selectedDate) && (
                  <span className="ml-2 text-xs text-gray-400">(editing)</span>
                )}
              </div>

              <div className="space-y-2">
                {statusOptions.map(option => {
                  const Icon = option.icon;
                  const isSelected = status === option.value;
                  return (
                    <button
                      key={option.value}
                      onClick={() => setStatus(option.value)}
                      className={cn(
                        "w-full flex items-center gap-3 p-3 rounded-xl border-2 transition-all duration-150",
                        isSelected ? option.selectedBg : option.bgColor
                      )}
                      data-testid={`button-status-${option.value}`}
                    >
                      <Icon className={cn("h-5 w-5", option.color)} />
                      <span className={cn(
                        "text-sm font-medium",
                        isSelected ? option.color : "text-gray-700"
                      )}>
                        {option.label}
                      </span>
                    </button>
                  );
                })}
              </div>

              <Button
                onClick={handleSubmit}
                disabled={!status || submitCheckInMutation.isPending}
                className="w-full bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-600 hover:to-teal-600 text-white rounded-xl h-11"
                data-testid="button-submit-check-in"
              >
                {submitCheckInMutation.isPending ? "Saving..." : "Save Check-in"}
              </Button>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
