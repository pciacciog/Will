import React, { useState, useEffect, useMemo } from "react";
import { useParams, useLocation } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { useAuth } from "@/hooks/useAuth";
import { EndRoom } from "@/components/EndRoom";
import { FinalWillSummary } from "@/components/FinalWillSummary";
import { WillReviewFlow } from "@/components/WillReviewFlow";
import { ThreadedMemberReview } from "@/components/ThreadedMemberReview";
import { MobileLayout, SectionCard, PrimaryButton, SectionTitle, ActionButton, AvatarBadge, UnifiedBackButton } from "@/components/ui/design-system";
import { Calendar, Clock, Target, Edit, Trash2, Users, CheckCircle, AlertCircle, Video, Heart, Zap, BarChart3, MinusCircle, XCircle, ChevronRight, ChevronLeft, ChevronDown, X, MessageCircle, Rocket, Bell, Star } from "lucide-react";
import { EndRoomTooltip } from "@/components/EndRoomTooltip";
import { EndRoomCountdown } from "@/components/EndRoomCountdown";
import { notificationService } from "@/services/NotificationService";
import { getWillStatus } from "@/lib/willStatus";
import DailyCheckInModal from "@/components/DailyCheckInModal";
import DailyGutCheckModal from "@/components/DailyGutCheckModal";
import { OngoingWillReviewFlow } from "@/components/OngoingWillReviewFlow";
import ProgressView from "@/components/ProgressView";
import DayStrip from "@/components/DayStrip";
import type { WillCheckIn, AbstainLog } from "@shared/schema";


function isActiveDay(date: Date, activeDays: string, customDays?: string): boolean {
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

function DailyProgressSection({ willId, startDate, endDate, checkInType, activeDays, customDays, onDayClick }: { 
  willId: number; startDate: string; endDate: string | null; checkInType: string; 
  activeDays?: string; customDays?: string;
  onDayClick?: (date: string) => void;
}) {
  const isTracking = checkInType === 'daily' || checkInType === 'specific_days';

  const { data: progress } = useQuery<{
    totalDays: number; checkedInDays: number; successRate: number;
    yesCount: number; partialCount: number; noCount: number; streak: number;
  }>({
    queryKey: [`/api/wills/${willId}/check-in-progress`],
    enabled: isTracking,
  });

  const { data: checkIns = [] } = useQuery<WillCheckIn[]>({
    queryKey: [`/api/wills/${willId}/check-ins`],
    enabled: isTracking,
  });

  const hasData = (progress?.totalDays ?? 0) > 0;

  return (
    <div className="bg-white rounded-lg border border-gray-200 p-4" data-testid="section-daily-progress">
      <div className="flex items-center gap-2 mb-3">
        <BarChart3 className="w-5 h-5 text-blue-500" />
        <span className="text-base font-semibold">Daily Progress</span>
      </div>
      
      {!hasData ? (
        <div className="text-center py-4">
          <p className="text-sm text-gray-500">No check-ins yet</p>
          <p className="text-xs text-gray-400 mt-1">Start tracking your progress!</p>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="grid grid-cols-3 gap-3">
            <div className="text-center p-2.5 bg-emerald-50 rounded-lg">
              <div className="flex items-center justify-center gap-1 mb-0.5">
                <CheckCircle className="h-3.5 w-3.5 text-emerald-600" />
              </div>
              <div className="text-xl font-bold text-emerald-700">{progress?.yesCount ?? 0}</div>
              <div className="text-xs text-emerald-600">Completed</div>
            </div>
            <div className="text-center p-2.5 bg-amber-50 rounded-lg">
              <div className="flex items-center justify-center gap-1 mb-0.5">
                <MinusCircle className="h-3.5 w-3.5 text-amber-600" />
              </div>
              <div className="text-xl font-bold text-amber-700">{progress?.partialCount ?? 0}</div>
              <div className="text-xs text-amber-600">Partial</div>
            </div>
            <div className="text-center p-2.5 bg-red-50 rounded-lg">
              <div className="flex items-center justify-center gap-1 mb-0.5">
                <XCircle className="h-3.5 w-3.5 text-red-500" />
              </div>
              <div className="text-xl font-bold text-red-600">{progress?.noCount ?? 0}</div>
              <div className="text-xs text-red-500">Missed</div>
            </div>
          </div>

          <div className="text-sm text-gray-600">
            Success Rate: <span className="font-semibold text-gray-900">{(progress?.successRate ?? 0).toFixed(0)}%</span>
            <span className="text-gray-400 ml-1">({progress?.yesCount ?? 0}/{progress?.totalDays ?? 0} days)</span>
          </div>

          <div className="border rounded-lg p-3">
            <DayStrip
              startDate={startDate}
              endDate={endDate}
              checkIns={checkIns}
              onDayClick={onDayClick}
            />
          </div>
        </div>
      )}
    </div>
  );
}

function formatDateRange(startDate: string, endDate: string | null): string {
  const start = new Date(startDate);
  if (!endDate) {
    return `${start.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })} - Ongoing`;
  }
  const end = new Date(endDate);
  return `${start.toLocaleDateString('en-US', { month: 'long', day: 'numeric' })} - ${end.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}`;
}

function calculateDuration(startDate: string, endDate: string): string {
  const start = new Date(startDate);
  const end = new Date(endDate);
  const diff = end.getTime() - start.getTime();
  const days = Math.ceil(diff / (1000 * 60 * 60 * 24));
  return `${days} days total`;
}

function formatTimeRemaining(endDate: string): string {
  const now = new Date();
  const end = new Date(endDate);
  const diff = end.getTime() - now.getTime();
  
  if (diff <= 0) return 'Completed';
  
  const days = Math.floor(diff / (1000 * 60 * 60 * 24));
  const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
  const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
  
  if (days > 0) {
    return `${days} days, ${hours} hours remaining`;
  } else if (hours >= 1) {
    return `${hours} hours remaining`;
  } else {
    return `${minutes} minutes remaining`;
  }
}

function formatTimeUntilStart(startDate: string): string {
  const now = new Date();
  const start = new Date(startDate);
  const diff = start.getTime() - now.getTime();
  
  if (diff <= 0) return 'Starting now';
  
  const days = Math.floor(diff / (1000 * 60 * 60 * 24));
  const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
  const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
  
  if (days > 0) {
    return `Starts in ${days} days, ${hours} hours`;
  } else if (hours >= 1) {
    return `Starts in ${hours} hours`;
  } else {
    return `Starts in ${minutes} minutes`;
  }
}

function calculateProgress(startDate: string, endDate: string): number {
  const now = new Date();
  const start = new Date(startDate);
  const end = new Date(endDate);
  
  if (now <= start) return 0;
  if (now >= end) return 100;
  
  const total = end.getTime() - start.getTime();
  const elapsed = now.getTime() - start.getTime();
  
  return Math.round((elapsed / total) * 100);
}

export default function WillDetails() {
  const { id } = useParams();
  const [, setLocation] = useLocation();
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [expandedCommitments, setExpandedCommitments] = useState<Record<string, boolean>>({});
  const [showFinalSummary, setShowFinalSummary] = useState(false);
  const [showCheckInModal, setShowCheckInModal] = useState(false);
  const [selectedCheckInDate, setSelectedCheckInDate] = useState<string | null>(null);
  const [showGutCheckModal, setShowGutCheckModal] = useState(false);
  const [showManageModal, setShowManageModal] = useState(false);
  const [showNotifPanel, setShowNotifPanel] = useState(false);
  const [notifEnabled, setNotifEnabled] = useState(false);
  const [notifTime, setNotifTime] = useState('20:00');
  const [checkinAutoOpened, setCheckinAutoOpened] = useState(false);
  const [showParticipants, setShowParticipants] = useState(false);

  // Category-aware UI state
  const [habitProgressExpanded, setHabitProgressExpanded] = useState(false);
  const [abstainLoggedToday, setAbstainLoggedToday] = useState(false);
  const [abstainCheckInOpen, setAbstainCheckInOpen] = useState(false);
  const [abstainJustLoggedHonored, setAbstainJustLoggedHonored] = useState<boolean | null>(null);
  const [abstainChanging, setAbstainChanging] = useState(false);
  const [abstainProgressExpanded, setAbstainProgressExpanded] = useState(false);
  const [missionCheckInOpen, setMissionCheckInOpen] = useState(false);
  const [missionKeptGoing, setMissionKeptGoing] = useState(false);
  const [missionCompleted, setMissionCompleted] = useState(false);

  const todayLocalDate = new Date().toLocaleDateString('en-CA'); // YYYY-MM-DD

  const handleDayClick = (date: string) => {
    setSelectedCheckInDate(date);
    setShowCheckInModal(true);
  };


  const { data: will, isLoading, error } = useQuery<any>({
    queryKey: [`/api/wills/${id}/details`],
    enabled: !!id && !!user,
    staleTime: 0, // Always consider data stale for immediate updates
    refetchInterval: (data: any) => {
      if (!data || !user?.id) return 30000; // Wait for user data before intelligent polling
      
      // Use centralized getWillStatus for consistency with Hub/Home
      const willStatus = getWillStatus(data, user.id);
      
      // Real-time updates for completed wills awaiting acknowledgment
      if (willStatus === 'completed') {
        return 5000; // 5 seconds for real-time acknowledgment counter
      }
      
      // NEW FEATURE: Real-time updates for will_review status
      // Poll frequently to detect when all members have submitted reviews
      if (willStatus === 'will_review') {
        return 5000; // Every 5 seconds - show immediate feedback when reviews complete
      }
      
      // Intelligent polling for End Room status transitions
      if (willStatus === 'waiting_for_end_room') {
        // Check if End Room is about to open or is already open
        if (data?.endRoomScheduledAt) {
          const now = new Date();
          const scheduled = new Date(data.endRoomScheduledAt);
          const diff = scheduled.getTime() - now.getTime();
          
          // Very frequent if End Room opens within 5 minutes or has passed
          if (diff <= 5 * 60 * 1000) {
            return 5000; // Every 5 seconds
          }
        }
        
        return 15000; // Every 15 seconds otherwise
      }
      
      // Frequent polling when Will is close to ending
      if (willStatus === 'active' && data?.endDate) {
        const now = new Date();
        const end = new Date(data.endDate);
        const diff = end.getTime() - now.getTime();
        
        // Very frequent if ending within 5 minutes
        if (diff <= 5 * 60 * 1000 && diff > 0) {
          return 5000; // Every 5 seconds
        }
        
        // Frequent if ending within 1 hour
        if (diff <= 60 * 60 * 1000 && diff > 0) {
          return 15000; // Every 15 seconds
        }
      }
      
      return 30000; // Default 30 seconds
    },
  });

  // Detect solo mode from will data with localStorage fallback for error states
  const isSoloMode = will?.mode === 'solo' || will?.mode === 'personal';
  
  // Store the mode when will is loaded so we can use it in error states
  useEffect(() => {
    if (will?.mode) {
      localStorage.setItem('lastWillMode', will.mode);
    }
  }, [will?.mode]);
  
  const getHubUrl = () => {
    const backUrl = sessionStorage.getItem('willBackUrl');
    if (backUrl) {
      sessionStorage.removeItem('willBackUrl');
      return backUrl;
    }
    if (will?.mode === 'personal' || will?.mode === 'solo') return '/';
    if (will?.mode === 'circle') {
      return '/my-wills';
    }
    const lastMode = localStorage.getItem('lastWillMode');
    if (lastMode === 'solo' || lastMode === 'personal') return '/';
    return '/my-wills';
  };

  const isPublicWill = will?.visibility === 'public' || !!will?.parentWillId;
  const participantWillId = will?.parentWillId || will?.id;

  const { data: unreadData } = useQuery<{ unreadCount: number }>({
    queryKey: ['/api/wills', participantWillId, 'messages', 'unread-count'],
    queryFn: async () => { const r = await apiRequest(`/api/wills/${participantWillId}/messages/unread-count`); return r.json(); },
    enabled: !!participantWillId && isPublicWill && !!user,
    refetchInterval: 15000,
  });
  const unreadCount = unreadData?.unreadCount ?? 0;

  const { data: participantsData } = useQuery<{ participants: { id: string; firstName: string }[]; totalCount: number; creatorName: string }>({
    queryKey: [`/api/wills/${participantWillId}/participants`],
    enabled: !!participantWillId && isPublicWill,
  });

  // NEW FEATURE: Fetch review status to check if user has reviewed
  // Only enable when Will is in will_review or completed status
  const shouldEnableReviewQueries = !!id && !!user && (will?.status === 'will_review' || will?.status === 'completed');
  
  // Debug logging for mobile
  console.log('[WillDetails] Review Query Conditions:', {
    id,
    hasUser: !!user,
    willStatus: will?.status,
    shouldEnable: shouldEnableReviewQueries
  });
  
  const { data: reviewStatus, isLoading: isReviewStatusLoading, error: reviewStatusError } = useQuery<any>({
    queryKey: [`/api/wills/${id}/review-status`],
    enabled: shouldEnableReviewQueries,
    refetchInterval: shouldEnableReviewQueries ? 5000 : false, // Poll frequently during review phase
    staleTime: 0,
  });

  // NEW FEATURE: Fetch submitted reviews to display
  const { data: reviews, isLoading: isReviewsLoading, error: reviewsError } = useQuery<any>({
    queryKey: [`/api/wills/${id}/reviews`],
    enabled: shouldEnableReviewQueries,
    refetchInterval: shouldEnableReviewQueries ? 5000 : false, // Poll for new reviews
    staleTime: 0,
  });

  const getUserCheckInType = () => {
    if (!will || !user) return 'one-time';
    if (will.mode === 'solo') {
      return will.checkInType || 'one-time';
    }
    if (will.willType === 'cumulative') {
      return will.checkInType || 'one-time';
    }
    const userCommitment = will.commitments?.find((c: any) => c.userId === user.id);
    return userCommitment?.checkInType || 'one-time';
  };

  const getUserActiveDays = () => {
    if (!will || !user) return { activeDays: 'every_day' as string, customDays: undefined as string | undefined };
    if (will.mode === 'solo') {
      return { activeDays: will.activeDays || 'every_day', customDays: will.customDays };
    }
    if (will.willType === 'cumulative') {
      return { activeDays: will.activeDays || 'every_day', customDays: will.customDays };
    }
    const userCommitment = will.commitments?.find((c: any) => c.userId === user.id);
    return { activeDays: userCommitment?.activeDays || 'every_day', customDays: userCommitment?.customDays };
  };

  const userCheckInType = getUserCheckInType();
  const { activeDays: userActiveDays, customDays: userCustomDays } = getUserActiveDays();
  const hasDailyCheckIns = userCheckInType === 'daily' || userCheckInType === 'specific_days';
  const isFinalReviewOnly = userCheckInType === 'final_review' || userCheckInType === 'one-time';

  useEffect(() => {
    if (checkinAutoOpened || !will || will.status !== 'active') return;
    const params = new URLSearchParams(window.location.search);
    if (params.get('action') === 'checkin') {
      setCheckinAutoOpened(true);
      if (hasDailyCheckIns) {
        setShowCheckInModal(true);
      } else {
        setShowGutCheckModal(true);
      }
      window.history.replaceState({}, '', window.location.pathname);
    }
  }, [will, hasDailyCheckIns, checkinAutoOpened]);

  const { data: checkIns = [] } = useQuery<WillCheckIn[]>({
    queryKey: [`/api/wills/${id}/check-ins`],
    enabled: !!id && !!user,
  });

  const todayGutCheckStatus = useMemo(() => {
    if (hasDailyCheckIns) return null;
    const today = new Date();
    const todayKey = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
    return checkIns.find(c => c.date === todayKey)?.status || null;
  }, [checkIns, hasDailyCheckIns]);

  // Habit: detect if already checked in today (from existing check-ins data)
  const habitTodayCheckIn = useMemo(() => {
    if (will?.commitmentCategory !== 'habit') return null;
    return checkIns.find((c: WillCheckIn) => c.date === todayLocalDate) || null;
  }, [checkIns, will?.commitmentCategory, todayLocalDate]);

  // Abstain: fetch log entries
  const { data: abstainLogEntries = [] } = useQuery<AbstainLog[]>({
    queryKey: [`/api/wills/${id}/abstain-log`],
    enabled: !!id && !!user && will?.commitmentCategory === 'abstain',
    staleTime: 0,
  });

  // Abstain: detect if already logged today
  const abstainTodayEntry = useMemo(() => {
    return abstainLogEntries.find((e: AbstainLog) => e.date === todayLocalDate) || null;
  }, [abstainLogEntries, todayLocalDate]);

  // Abstain: compute current streak from streakStartDate
  const abstainStreakDays = useMemo(() => {
    if (!will?.streakStartDate) return 0;
    const start = new Date(will.streakStartDate);
    const now = new Date();
    return Math.max(0, Math.floor((now.getTime() - start.getTime()) / 86400000));
  }, [will?.streakStartDate]);

  // Abstain: best streak from log (count consecutive honored entries)
  const abstainBestStreak = useMemo(() => {
    if (!abstainLogEntries.length) return abstainStreakDays;
    let best = 0, cur = 0;
    const sorted = [...abstainLogEntries].sort((a: AbstainLog, b: AbstainLog) => a.date.localeCompare(b.date));
    for (const e of sorted) {
      if (e.honored) { cur++; best = Math.max(best, cur); } else { cur = 0; }
    }
    return Math.max(best, abstainStreakDays);
  }, [abstainLogEntries, abstainStreakDays]);

  // Abstain: next milestone
  const abstainNextMilestone = useMemo(() => {
    if (!will?.milestones) return null;
    try {
      const ms: { day: number; label: string }[] = JSON.parse(will.milestones);
      const reached = will.sentMilestones ? JSON.parse(will.sentMilestones) : [];
      return ms.find((m) => !reached.includes(m.day)) || null;
    } catch { return null; }
  }, [will?.milestones, will?.sentMilestones]);

  // Abstain: calendar day strip (last 14 days or from startDate, whichever is shorter)
  const abstainCalendarDays = useMemo(() => {
    if (!will?.startDate) return [];
    const start = new Date(will.startDate);
    const today = new Date();
    const days: { date: string; status: 'honored' | 'not-honored' | 'pending' }[] = [];
    for (let d = new Date(start); d <= today; d.setDate(d.getDate() + 1)) {
      const dateStr = new Date(d).toLocaleDateString('en-CA');
      const entry = abstainLogEntries.find((e: AbstainLog) => e.date === dateStr);
      days.push({ date: dateStr, status: entry ? (entry.honored ? 'honored' : 'not-honored') : 'pending' });
    }
    return days.slice(-14);
  }, [will?.startDate, abstainLogEntries]);

  // Mission: compute days remaining / total
  const missionDaysRemaining = useMemo(() => {
    if (!will?.endDate) return 0;
    return Math.max(0, Math.ceil((new Date(will.endDate).getTime() - Date.now()) / 86400000));
  }, [will?.endDate]);

  const missionTotalDays = useMemo(() => {
    if (!will?.startDate || !will?.endDate) return 1;
    return Math.max(1, Math.ceil((new Date(will.endDate).getTime() - new Date(will.startDate).getTime()) / 86400000));
  }, [will?.startDate, will?.endDate]);

  // Debug logging for query states
  console.log('[WillDetails] Query States:', {
    reviewStatusLoading: isReviewStatusLoading,
    reviewStatusError: reviewStatusError,
    reviewStatusData: reviewStatus,
    reviewsLoading: isReviewsLoading,
    reviewsError: reviewsError,
    reviewsData: reviews,
  });

  // Fetch end room data when room is open during will_review
  const shouldEnableEndRoomQuery = !!id && !!user && will?.status === 'will_review' && will?.endRoomStatus === 'open';
  const { data: endRoomData } = useQuery<any>({
    queryKey: [`/api/wills/${id}/end-room`],
    enabled: shouldEnableEndRoomQuery,
    refetchInterval: shouldEnableEndRoomQuery ? 10000 : false,
    staleTime: 0,
  });

  // Handler to join End Room
  const handleJoinEndRoom = async () => {
    if (!endRoomData?.endRoomUrl || !endRoomData?.canJoin) {
      toast({
        title: "End Room not ready",
        description: "The video room is being set up. Please try again in a moment.",
        variant: "destructive"
      });
      return;
    }
    
    try {
      const { Browser } = await import('@capacitor/browser');
      await Browser.open({ url: endRoomData.endRoomUrl });
    } catch (browserError) {
      window.open(endRoomData.endRoomUrl, '_blank');
    }
  };

  const acknowledgeMutation = useMutation({
    mutationFn: async () => {
      // Check if user has already acknowledged before making the request
      if (will?.hasUserAcknowledged) {
        // If already acknowledged, just close modal and navigate
        setShowFinalSummary(false);
        setLocation(getHubUrl());
        return;
      }
      
      const response = await apiRequest(`/api/wills/${id}/acknowledge`, {
        method: 'POST'
      });
      return response.json();
    },
    onSuccess: async () => {
      // Close the Final Will Summary modal
      setShowFinalSummary(false);
      
      // Invalidate queries efficiently - start with most critical
      queryClient.invalidateQueries({ queryKey: ['/api/wills/all-active'] });
      if (isSoloMode) {
        queryClient.invalidateQueries({ queryKey: ['/api/wills/solo'] });
        queryClient.invalidateQueries({ queryKey: ['/api/wills/history', 'solo'] });
      } else {
        queryClient.invalidateQueries({ queryKey: ['/api/my-wills'] });
        queryClient.invalidateQueries({ queryKey: ['/api/wills/history', 'team'] });
      }
      queryClient.invalidateQueries({ queryKey: [`/api/wills/${id}/details`] });
      
      toast({
        title: "Will Acknowledged",
        description: isSoloMode 
          ? "You have acknowledged the completion of this Will. Ready for your next goal!"
          : "You have acknowledged the completion of this Will. Once all of the members have acknowledged, you will be able to start a new will.",
      });
      
      // Navigate back to appropriate hub
      setLocation(getHubUrl());
    },
    onError: (error: any) => {
      // Handle "already acknowledged" error gracefully
      if (error.message?.includes("already acknowledged")) {
        setShowFinalSummary(false);
        setLocation(getHubUrl());
        return;
      }
      
      toast({
        title: "Error",
        description: error.message || "Failed to acknowledge completion",
        variant: "destructive",
      });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async () => {
      await apiRequest(`/api/wills/${id}`, {
        method: 'DELETE'
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/wills/all-active'] });
      queryClient.invalidateQueries({ queryKey: ['/api/my-wills'] });
      queryClient.invalidateQueries({ queryKey: [`/api/wills/${id}/details`] });
      
      toast({
        title: "Will Deleted",
        description: "The will has been successfully deleted",
      });
      setLocation(getHubUrl());
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const invalidateAllWillQueries = () => {
    queryClient.invalidateQueries({ queryKey: [`/api/wills/${id}/details`] });
    queryClient.invalidateQueries({ queryKey: ['/api/wills/all-active'] });
    queryClient.invalidateQueries({ queryKey: ['/api/wills/personal'] });
    queryClient.invalidateQueries({ queryKey: ['/api/my-wills'] });
    queryClient.invalidateQueries({ queryKey: ['/api/wills/public'] });
  };

  const pauseMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest(`/api/wills/${id}/pause`, { method: 'POST' });
      return res.json();
    },
    onSuccess: () => {
      invalidateAllWillQueries();
      toast({ title: "Will Paused", description: "Your Will has been paused" });
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message || "Failed to pause Will", variant: "destructive" });
    },
  });

  const resumeMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest(`/api/wills/${id}/resume`, { method: 'POST' });
      return res.json();
    },
    onSuccess: () => {
      invalidateAllWillQueries();
      toast({ title: "Will Resumed", description: "Your Will is now active again" });
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message || "Failed to resume Will", variant: "destructive" });
    },
  });

  const terminateMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest(`/api/wills/${id}/terminate`, { method: 'POST' });
      return res.json();
    },
    onSuccess: (data: any) => {
      invalidateAllWillQueries();
      if (data?.status === 'will_review') {
        toast({ title: "Will ended", description: "Review your results before wrapping up" });
      } else {
        toast({ title: "Will Ended", description: "Your Will has been ended" });
        setLocation(getHubUrl());
      }
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message || "Failed to end Will", variant: "destructive" });
    },
  });

  const updateNotifMutation = useMutation({
    mutationFn: async ({ reminderTime }: { reminderTime: string | null }) => {
      const res = await apiRequest(`/api/wills/${id}/notifications`, { method: 'PATCH', body: { reminderTime } });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/wills/${id}/details`] });
      toast({ title: "Saved", description: "Notification settings updated" });
      setShowNotifPanel(false);
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message || "Failed to save", variant: "destructive" });
    },
  });

  const [showLeaveModal, setShowLeaveModal] = useState(false);

  const leaveMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest(`/api/wills/${id}/leave`, { method: 'POST' });
      return res.json();
    },
    onSuccess: () => {
      invalidateAllWillQueries();
      if (will?.parentWillId) {
        toast({ title: "You left the Will", description: "Your copy has been ended. Other participants are unaffected." });
        setShowFinalSummary(true);
      } else {
        toast({ title: "You left the Will", description: "The Will has ended for everyone." });
        setLocation(getHubUrl());
      }
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message || "Failed to leave Will", variant: "destructive" });
    },
  });

  // Push notification query and mutation
  const ACTIVE_WILL_STATUSES = ['active', 'committed', 'pending', 'scheduled', 'paused', 'will_review'];
  const { data: pushStatus, isLoading: isPushLoading } = useQuery<any>({
    queryKey: [`/api/wills/${id}/push/status`],
    enabled: !!will && ACTIVE_WILL_STATUSES.includes(will.status),
    refetchInterval: 30000,
  });

  const pushMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest(`/api/wills/${id}/push`, {
        method: 'POST'
      });
      return response.json();
    },
    onSuccess: async () => {
      queryClient.invalidateQueries({ queryKey: [`/api/wills/${id}/push/status`] });
      
      toast({
        title: "Push Sent! 🚀",
        description: "Encouragement sent to all participants",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to send push notification",
        variant: "destructive",
      });
    },
  });

  // Abstain log mutation
  const abstainLogMutation = useMutation({
    mutationFn: async ({ honored }: { honored: boolean }) => {
      const res = await apiRequest(`/api/wills/${id}/abstain-log`, {
        method: 'POST',
        body: JSON.stringify({ honored, date: todayLocalDate }),
      });
      return res.json();
    },
    onSuccess: () => {
      setAbstainLoggedToday(true);
      queryClient.invalidateQueries({ queryKey: [`/api/wills/${id}/abstain-log`] });
      queryClient.invalidateQueries({ queryKey: [`/api/wills/${id}/details`] });
    },
    onError: (error: any) => {
      setAbstainLoggedToday(false);
      toast({ title: "Error", description: error.message || "Failed to log entry", variant: "destructive" });
    },
  });

  // Mission complete mutation
  const missionCompleteMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest(`/api/wills/${id}`, {
        method: 'PATCH',
        body: JSON.stringify({ status: 'completed' }),
      });
      return res.json();
    },
    onSuccess: () => {
      setMissionCompleted(true);
      setMissionShowConfirm(false);
      queryClient.invalidateQueries({ queryKey: [`/api/wills/${id}/details`] });
      toast({ title: "Well done!", description: "Your will has been marked as complete." });
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message || "Failed to complete will", variant: "destructive" });
    },
  });

  // Auto-show Final Will Summary when Will is completed
  // Handles BOTH: Wills with End Room (after it finishes) AND Wills without End Room
  // Solo/personal wills auto-archive after review, so also trigger on archived status
  const [summaryDismissed, setSummaryDismissed] = useState(false);
  useEffect(() => {
    const willCompleted = will?.status === 'completed';
    const willArchivedSolo = will?.status === 'archived' && isSoloMode;
    const endRoomNotScheduled = !will?.endRoomScheduledAt;
    const endRoomFinished = will?.endRoomStatus === 'completed';
    const shouldShowSummary = (willCompleted || willArchivedSolo) && (endRoomNotScheduled || endRoomFinished);
    
    // Solo/personal wills: show summary once after completion (dismiss tracks if user closed it)
    // Circle wills: show until user acknowledges
    const canShow = isSoloMode ? !summaryDismissed : !will?.hasUserAcknowledged;
    
    if (will && shouldShowSummary && canShow && !showFinalSummary) {
      setShowFinalSummary(true);
    }
  }, [will, showFinalSummary, isSoloMode, summaryDismissed]);

  // Early returns after all hooks are defined
  if (!user) {
    return (
      <div className="min-h-screen pt-16 flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">Authentication required</h2>
          <Button onClick={() => setLocation('/auth')}>
            Sign In
          </Button>
        </div>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="min-h-screen pt-16 flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">Loading...</h2>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen pt-16 flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">Error loading <em>Will</em></h2>
          <p className="text-gray-600 mb-4">
            {error.message || 'Unable to load Will details'}
          </p>
          <Button onClick={() => setLocation(getHubUrl())}>
            Back to Hub
          </Button>
        </div>
      </div>
    );
  }

  if (!will) {
    return (
      <div className="min-h-screen pt-16 flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-xl font-semibold text-gray-900 mb-4"><em>Will</em> not found</h2>
          <Button onClick={() => setLocation(getHubUrl())}>
            Back to Hub
          </Button>
        </div>
      </div>
    );
  }

  const userHasCommitted = will.commitments?.some((c: any) => c.userId === user?.id);
  const totalMembers = will.memberCount || will.commitments?.length || 0;
  const submittedCount = will.commitments?.length || 0;

  return (
    <MobileLayout>
      <div className="space-y-3 pt-14">
        {/* Header with Back Button */}
        <div className="relative flex items-center justify-between mb-2 min-h-[44px]">
          <UnifiedBackButton 
            onClick={() => setLocation(getHubUrl())} 
            testId="button-back-hub"
          />
          <h1 className="absolute left-0 right-0 text-center text-xl font-semibold pointer-events-none truncate px-16">
            {will?.mode === 'team' ? 'Team Will' : 'Will'}
          </h1>
          {isPublicWill && participantsData && participantsData.totalCount > 1 && user ? (
            <button
              onClick={() => setLocation(`/will/${id}/messages`)}
              className="relative flex items-center justify-center w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-500 shadow-md active:scale-95 transition-transform"
              data-testid="button-will-messages-chat"
            >
              <MessageCircle className="w-5 h-5 text-white" />
              {unreadCount > 0 && (
                <span className="absolute -top-1 -right-1 flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded-full bg-red-500 text-white text-[10px] font-bold leading-none">
                  {unreadCount > 9 ? '9+' : unreadCount}
                </span>
              )}
            </button>
          ) : (
            <div className="w-11"></div>
          )}
        </div>
        
        {/* Status Badge */}
        <div className="text-center">
          <div className="flex items-center justify-center space-x-2 mb-1">
            <Badge 
              className={`text-xs tracking-tight ${
                will.status === 'active' ? 'bg-green-100 text-green-800' :
                will.status === 'pending' ? 'bg-yellow-100 text-yellow-800' :
                will.status === 'scheduled' ? 'bg-blue-100 text-blue-800' :
                will.status === 'will_review' ? 'bg-purple-100 text-purple-800' :
                will.status === 'waiting_for_end_room' ? 'bg-purple-100 text-purple-800' :
                will.status === 'completed' ? 'bg-gray-100 text-gray-800' :
                'bg-gray-100 text-gray-800'
              }`}
              data-testid="badge-will-status"
            >
              {will.status === 'will_review' ? 'Review' :
               will.status === 'waiting_for_end_room' ? 'Pending End Room' : 
               will.status === 'active' && will.commitmentCategory ? (() => {
                 if (will.commitmentCategory === 'mission' && will.endDate) {
                   const d = new Date(will.endDate);
                   const label = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
                   return `Active · deadline ${label}`;
                 }
                 if ((will.commitmentCategory === 'habit' || will.commitmentCategory === 'abstain') && will.endDate) {
                   const daysLeft = Math.max(0, Math.ceil((new Date(will.endDate).getTime() - Date.now()) / 86400000));
                   return `Active · ${daysLeft} day${daysLeft !== 1 ? 's' : ''} left`;
                 }
                 return 'Active';
               })() :
               will.status === 'active' ? 'Active' :
               will.status === 'pending' ? 'Pending' :
               will.status === 'scheduled' ? 'Scheduled' :
               will.status === 'completed' ? 'Completed' :
               will.status === 'terminated' ? 'Ended' :
               will.status.charAt(0).toUpperCase() + will.status.slice(1)}
            </Badge>
          </div>
          {will.status === 'pending' && (
            <p className="text-gray-500 text-xs tracking-tight">
              {submittedCount} / {totalMembers} members submitted
            </p>
          )}
        </div>

        {/* Will Review Section - Positioned at top for immediate visibility */}
        {will.status === 'will_review' && will.commitments && will.commitments.some((c: any) => c.userId === user?.id) && (
          <div className="bg-purple-50 border border-purple-200 rounded-lg p-4" data-testid="section-will-review-details">
            {reviewStatus?.hasReviewed ? (
              <div className="text-center" data-testid="review-submitted-message">
                <div className="w-12 h-12 bg-purple-100 rounded-full flex items-center justify-center mx-auto mb-3">
                  <CheckCircle className="w-6 h-6 text-purple-600" />
                </div>
                <h3 className="text-base font-semibold text-gray-900 mb-2">Review Submitted</h3>
                
                {isSoloMode ? (
                  <p className="text-sm text-gray-600">
                    Your review is complete! Your Will is finalizing...
                  </p>
                ) : (
                  <>
                    {reviewStatus && reviewStatus.reviewCount < reviewStatus.totalMembers ? (
                      <>
                        <p className="text-sm text-gray-600">
                          Waiting for other circle members to complete their reviews...
                        </p>
                        <p className="text-xs text-gray-500 mt-2" data-testid="text-review-progress">
                          {reviewStatus.reviewCount} of {reviewStatus.totalMembers} members reviewed
                        </p>
                      </>
                    ) : will.endRoomScheduledAt && (will.endRoomStatus === 'pending' || will.endRoomStatus === 'open') ? (
                      <>
                        <p className="text-sm text-gray-600">
                          All reviews complete! This <em>Will</em> will finish after the End Room session ends.
                        </p>
                        <p className="text-xs text-gray-500 mt-2" data-testid="text-review-progress">
                          {reviewStatus?.reviewCount} of {reviewStatus?.totalMembers} members reviewed
                        </p>
                      </>
                    ) : (
                      <>
                        <p className="text-sm text-gray-600">
                          All requirements met! Finalizing...
                        </p>
                        <p className="text-xs text-gray-500 mt-2" data-testid="text-review-progress">
                          {reviewStatus?.reviewCount} of {reviewStatus?.totalMembers} members reviewed
                        </p>
                      </>
                    )}
                  </>
                )}
              </div>
            ) : will.isIndefinite ? (
              <OngoingWillReviewFlow
                willId={will.id}
                startDate={will.startDate}
                onComplete={() => {
                  queryClient.invalidateQueries({ queryKey: [`/api/wills/${id}/details`] });
                  queryClient.invalidateQueries({ queryKey: [`/api/wills/${id}/review-status`] });
                  queryClient.invalidateQueries({ queryKey: [`/api/wills/${id}/reviews`] });
                }}
              />
            ) : (
              <WillReviewFlow 
                willId={will.id}
                mode={isSoloMode ? 'solo' : 'circle'}
                checkInType={userCheckInType}
                startDate={will.startDate}
                endDate={will.endDate}
                onComplete={() => {
                  queryClient.invalidateQueries({ queryKey: [`/api/wills/${id}/details`] });
                  queryClient.invalidateQueries({ queryKey: [`/api/wills/${id}/review-status`] });
                  queryClient.invalidateQueries({ queryKey: [`/api/wills/${id}/reviews`] });
                }}
                onEditCheckIns={() => setShowCheckInModal(true)}
              />
            )}
          </div>
        )}

        {/* Timeline Section */}
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <div className="flex items-center mb-3">
            <Calendar className="w-5 h-5 text-blue-600 mr-2" />
            <span className="text-base font-semibold">Timeline</span>
          </div>
          <div className="space-y-2">
            <div className="text-base">
              <span className="font-medium">{will.endDate ? 'Start:' : 'Started:'}</span> {new Date(will.startDate).toLocaleDateString('en-US', { 
                month: 'short', 
                day: 'numeric',
                hour: 'numeric',
                minute: '2-digit'
              })}
            </div>
            {will.endDate ? (
              <div className="text-base">
                <span className="font-medium">End:</span> {new Date(will.endDate).toLocaleDateString('en-US', { 
                  month: 'short', 
                  day: 'numeric',
                  hour: 'numeric',
                  minute: '2-digit'
                })}
              </div>
            ) : (
              <div className="text-base text-gray-500 italic">
                (Ongoing)
              </div>
            )}
          </div>
        </div>

        {/* Circle Members Section - Right after Timeline for circle wills */}
        {!isSoloMode && will.commitments && will.commitments.length > 0 && (
          <div className="bg-white rounded-lg border border-gray-200 p-4" data-testid="section-circle-members">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 flex-1 min-w-0">
                <Users className="w-5 h-5 text-purple-600 flex-shrink-0" />
                <span className="text-sm font-medium text-gray-500 flex-shrink-0">Circle:</span>
                <span className="text-sm text-gray-800 truncate">
                  {will.commitments.map((c: any) => c.user?.firstName || 'Member').join(', ')}
                </span>
              </div>
              {will.status === 'active' && (
                <button
                  onClick={() => pushMutation.mutate()}
                  disabled={pushMutation.isPending || pushStatus?.hasUserPushed}
                  className={`inline-flex items-center px-3 py-1.5 text-xs font-medium rounded-lg transition-colors flex-shrink-0 ml-3 ${
                    pushStatus?.hasUserPushed
                      ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                      : 'bg-green-600 text-white hover:bg-green-700'
                  }`}
                  title={pushStatus?.hasUserPushed ? 'Already pushed' : 'Send encouragement to your teammates'}
                  data-testid="button-push"
                >
                  <Zap className="w-3 h-3 mr-1" />
                  {pushMutation.isPending ? '...' : 'Push'}
                </button>
              )}
            </div>
          </div>
        )}

        {/* End Room Section - Only for circle mode */}
        {!isSoloMode && will.endRoomScheduledAt && (
          <div className="bg-white rounded-lg border border-gray-200 p-4">
            <div className="flex items-center mb-3">
              <Video className="w-5 h-5 text-blue-600 mr-2" />
              <span className="text-base font-semibold">End Room</span>
              <div className="ml-2">
                <EndRoomTooltip />
              </div>
            </div>
            <div className="space-y-2">
              <div className="text-base">
                <span className="font-medium">Scheduled:</span> {new Date(will.endRoomScheduledAt).toLocaleDateString('en-US', { 
                  month: 'short', 
                  day: 'numeric',
                  hour: 'numeric',
                  minute: '2-digit'
                })}
              </div>
              <div className="text-base">
                <span className="font-medium">Duration:</span> 30 minutes
              </div>
            </div>
          </div>
        )}

        {/* Public Will Participants */}
        {isPublicWill && participantsData && participantsData.totalCount > 1 && (
          <button
            onClick={() => setShowParticipants(true)}
            className="w-full bg-gradient-to-r from-blue-50 to-indigo-50 rounded-lg border border-blue-200 p-3 flex items-center gap-3 hover:shadow-sm transition-all active:scale-[0.98]"
            data-testid="button-show-participants"
          >
            <div className="flex -space-x-2 flex-shrink-0">
              {participantsData.participants.slice(0, 4).map((p, i) => (
                <div
                  key={p.id}
                  className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-indigo-500 flex items-center justify-center text-white text-xs font-semibold border-2 border-white"
                  style={{ zIndex: 4 - i }}
                  data-testid={`avatar-participant-${i}`}
                >
                  {p.firstName?.charAt(0).toUpperCase() || '?'}
                </div>
              ))}
              {participantsData.totalCount > 4 && (
                <div
                  className="w-8 h-8 rounded-full bg-gray-200 flex items-center justify-center text-gray-600 text-xs font-semibold border-2 border-white"
                  style={{ zIndex: 0 }}
                >
                  +{participantsData.totalCount - 4}
                </div>
              )}
            </div>
            <div className="flex-1 text-left">
              <p className="text-sm font-medium text-gray-900">
                You + {participantsData.totalCount - 1} {participantsData.totalCount - 1 === 1 ? 'other' : 'others'} committed
              </p>
              <p className="text-xs text-gray-500">
                Created by {participantsData.creatorName}
              </p>
            </div>
            <ChevronRight className="w-4 h-4 text-gray-400 flex-shrink-0" />
          </button>
        )}

        {/* Public Will Push Encouragement */}
        {isPublicWill && ['active', 'committed', 'pending', 'scheduled', 'paused', 'will_review'].includes(will.status) && participantsData && participantsData.totalCount > 1 && (
          <button
            onClick={() => pushMutation.mutate()}
            disabled={pushMutation.isPending || pushStatus?.hasUserPushed}
            className={`w-full flex items-center justify-center gap-2 rounded-lg border py-3 px-4 transition-all active:scale-[0.98] ${
              pushStatus?.hasUserPushed
                ? 'bg-gray-50 border-gray-200 cursor-not-allowed'
                : 'bg-green-600 border-green-600 hover:bg-green-700'
            }`}
            data-testid="button-public-push"
          >
            <Rocket className={`w-5 h-5 ${pushStatus?.hasUserPushed ? 'text-gray-400' : 'text-white'}`} />
            <span className={`text-sm font-medium ${pushStatus?.hasUserPushed ? 'text-gray-400' : 'text-white'}`}>
              {pushMutation.isPending ? 'Sending...' : pushStatus?.hasUserPushed ? 'Pushed' : 'Push'}
            </span>
          </button>
        )}


        {/* Commitment Details - Solo Mode */}
        {will.status !== 'will_review' && isSoloMode && will.commitments?.[0] && (
          will.commitmentCategory ? (
            /* Category-aware hero card */
            <div className="bg-white rounded-xl border border-gray-200 p-6 text-center" data-testid="card-commitment-hero">
              <div className="flex items-center justify-center mb-4">
                <div className="flex items-center justify-center rounded-2xl" style={{ width: 52, height: 52, backgroundColor: '#E1F5EE' }}>
                  {will.commitmentCategory === 'habit' && <CheckCircle style={{ width: 26, height: 26, color: '#1D9E75' }} strokeWidth={1.75} />}
                  {will.commitmentCategory === 'abstain' && <XCircle style={{ width: 26, height: 26, color: '#1D9E75' }} strokeWidth={1.75} />}
                  {will.commitmentCategory === 'mission' && <Star style={{ width: 26, height: 26, color: '#1D9E75' }} strokeWidth={1.75} />}
                </div>
              </div>
              <p className="text-xs font-semibold uppercase tracking-widest text-gray-400 mb-2">My Commitment</p>
              <div className="text-lg font-bold text-gray-900 leading-snug mb-2">
                "{will.commitments[0].what?.toLowerCase().startsWith('i will')
                  ? will.commitments[0].what
                  : `I will ${will.commitments[0].what}`}"
              </div>
              {will.commitments[0].why && (
                <div className="text-sm text-gray-400 italic">
                  Because {will.commitments[0].why}
                </div>
              )}
              {will.createdBy === user?.id && (will.status === 'pending' || will.status === 'scheduled') && (
                <button
                  onClick={() => setLocation(`/will/${id}/edit`)}
                  className="mt-3 text-sm text-blue-600 font-medium hover:text-blue-700 transition-colors"
                  data-testid="button-edit-will"
                >
                  Edit
                </button>
              )}
            </div>
          ) : (
            /* Legacy card — unchanged */
            <div className="bg-white rounded-lg border border-gray-200 p-4">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <CheckCircle className="w-5 h-5 text-brandGreen" />
                  <span className="text-base font-semibold text-gray-900">Your Commitment</span>
                </div>
                {will.createdBy === user?.id && (will.status === 'pending' || will.status === 'scheduled') && (
                  <button
                    onClick={() => setLocation(`/will/${id}/edit`)}
                    className="text-sm text-blue-600 font-medium hover:text-blue-700 transition-colors"
                    data-testid="button-edit-will"
                  >
                    Edit
                  </button>
                )}
              </div>
              <div className="text-lg text-gray-900 leading-relaxed">
                <span className="font-semibold">I will</span> {will.commitments[0].what}
              </div>
              {will.commitments[0].why && (
                <div className="mt-2 text-sm text-gray-500 italic">
                  Because {will.commitments[0].why}
                </div>
              )}
            </div>
          )
        )}

        {/* Commitment Details - Circle Mode */}
        {will.status !== 'will_review' && !isSoloMode && (
          <div className="bg-white rounded-lg border border-gray-200 p-4">
            <div className="flex items-center justify-between mb-4 pb-2 border-b border-gray-100">
              <div className="flex items-center gap-2">
                <CheckCircle className="w-5 h-5 text-brandGreen" />
                <span className="text-base font-semibold text-gray-900">Commitments</span>
              </div>
              {will.createdBy === user?.id && (will.status === 'pending' || will.status === 'scheduled') && (
                <Button 
                  onClick={() => setLocation(`/will/${id}/edit`)}
                  className="border border-blue-500 text-blue-600 bg-white hover:bg-blue-50 rounded-lg px-3 py-1 text-sm font-medium"
                  size="sm"
                  data-testid="button-edit-will"
                >
                  Edit
                </Button>
              )}
            </div>
            <div className="space-y-4">
              {will.commitments && will.commitments.length > 0 && will.commitments.map((commitment: any) => {
                const isCurrentUser = commitment.userId === user?.id;
                const showWhy = expandedCommitments[commitment.id] || false;
                const toggleWhy = () => {
                  setExpandedCommitments(prev => ({
                    ...prev,
                    [commitment.id]: !prev[commitment.id]
                  }));
                };
                
                return (
                  <div key={commitment.id} className="border-b border-gray-100 pb-3 last:border-b-0 last:pb-0">
                    <div className="flex items-center justify-between mb-2 gap-3">
                      <div className="flex items-center space-x-2 flex-1 min-w-0">
                        <span className="text-base font-medium truncate">
                          {commitment.user.firstName || commitment.user.email}
                          {isCurrentUser && (
                            <span className="ml-2 text-xs bg-blue-100 text-blue-700 px-2 py-1 rounded">
                              You
                            </span>
                          )}
                        </span>
                      </div>
                      <div className="flex items-center space-x-2 flex-shrink-0">
                        {isCurrentUser && (will.status === 'pending' || will.status === 'scheduled') && (
                          <button 
                            onClick={() => setLocation(`/will/${id}/edit-commitment/${commitment.id}`)}
                            className="px-3 py-1 text-sm rounded border bg-white shadow text-gray-700 hover:bg-gray-50 transition-colors duration-200"
                            title="Edit commitment"
                            data-testid="button-edit-commitment"
                          >
                            Edit
                          </button>
                        )}
                        {isCurrentUser && (
                          <button
                            onClick={toggleWhy}
                            className={`text-sm px-3 py-1 rounded border transition-all duration-200 shadow ${
                              showWhy 
                                ? 'bg-red-500 text-white border-red-500 shadow-md hover:bg-red-600' 
                                : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
                            }`}
                            title={showWhy ? "Hide your reason" : "Show your reason"}
                            data-testid="button-toggle-why"
                          >
                            Why
                          </button>
                        )}
                      </div>
                    </div>
                    
                    <div className="space-y-2">
                      <div>
                        <div className="text-sm text-gray-500 font-medium italic mb-1">will</div>
                        <div className="text-base text-gray-800 leading-relaxed">
                          {commitment.what}
                        </div>
                      </div>
                      
                      {isCurrentUser && showWhy && (
                        <div className="mt-3 p-4 bg-gray-50 border-l-4 border-gray-300 rounded-lg shadow-sm animate-in fade-in duration-300">
                          <div className="text-base tracking-wide">
                            <span className="font-bold text-black">Because</span> {commitment.why}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* ── Category-aware action + progress ── */}
        {will.commitmentCategory === 'habit' ? (
          <>
            {/* Habit: Check-in button */}
            {will.status === 'active' && (
              habitTodayCheckIn ? (
                <div
                  className="w-full flex items-center justify-center gap-2 py-4 px-4 rounded-xl text-base font-semibold"
                  style={{ backgroundColor: '#1D9E75', opacity: 0.7, color: '#fff' }}
                  data-testid="button-habit-checked-in"
                >
                  <CheckCircle style={{ width: 20, height: 20, color: '#fff' }} />
                  Checked in for today ✓
                </div>
              ) : (
                <button
                  onClick={() => setShowCheckInModal(true)}
                  className="w-full flex items-center justify-center gap-2 py-4 px-4 rounded-xl text-base font-semibold text-white transition-opacity active:opacity-80"
                  style={{ backgroundColor: '#1D9E75' }}
                  data-testid="button-habit-check-in"
                >
                  <CheckCircle style={{ width: 20, height: 20, color: '#fff' }} />
                  Check in for today
                </button>
              )
            )}

            {/* Habit: Collapsible progress card */}
            {(will.status === 'active' || will.status === 'will_review' || will.status === 'completed' || will.status === 'terminated') && (
              <div className="bg-white rounded-xl border border-gray-200 overflow-hidden" data-testid="card-habit-progress">
                <button
                  className="w-full flex items-center justify-between px-4 py-3"
                  onClick={() => setHabitProgressExpanded(v => !v)}
                  data-testid="button-habit-progress-toggle"
                >
                  <div className="flex items-center gap-2">
                    <span className="flex gap-1">
                      <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 inline-block" />
                      <span className="w-2.5 h-2.5 rounded-full bg-amber-400 inline-block" />
                      <span className="w-2.5 h-2.5 rounded-full bg-red-400 inline-block" />
                    </span>
                    <div>
                      <span className="text-sm font-semibold text-gray-800">Your progress</span>
                      {(() => {
                        const yes = checkIns.filter((c: WillCheckIn) => c.status === 'yes').length;
                        const partial = checkIns.filter((c: WillCheckIn) => c.status === 'partial').length;
                        const no = checkIns.filter((c: WillCheckIn) => c.status === 'no').length;
                        return checkIns.length > 0 ? (
                          <p className="text-xs text-gray-400">{yes} done · {partial} partial · {no} missed</p>
                        ) : null;
                      })()}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-bold" style={{ color: '#1D9E75' }}>
                      {(() => {
                        const yes = checkIns.filter((c: WillCheckIn) => c.status === 'yes').length;
                        const total = checkIns.length;
                        return total > 0 ? `${Math.round((yes / total) * 100)}%` : '—';
                      })()}
                    </span>
                    <ChevronDown
                      style={{ width: 16, height: 16, color: '#9ca3af', transform: habitProgressExpanded ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform 0.2s' }}
                    />
                  </div>
                </button>
                {habitProgressExpanded && (
                  <div className="px-4 pb-4">
                    <DailyProgressSection
                      willId={Number(id)}
                      startDate={will.startDate}
                      endDate={will.endDate}
                      checkInType={userCheckInType}
                      activeDays={userActiveDays}
                      customDays={userCustomDays}
                      onDayClick={will.status === 'active' ? handleDayClick : undefined}
                    />
                  </div>
                )}
              </div>
            )}
          </>

        ) : will.commitmentCategory === 'abstain' ? (
          <>
            {/* Abstain: Check-in flow */}
            {will.status === 'active' && (
              <div data-testid="section-abstain-actions">
                {(abstainTodayEntry || abstainJustLoggedHonored !== null) && !abstainChanging ? (
                  /* Result card — with Change option */
                  (() => {
                    const honored = abstainTodayEntry?.honored ?? (abstainJustLoggedHonored ?? true);
                    return honored ? (
                      <div className="w-full rounded-xl p-4 flex flex-col items-center gap-1.5" style={{ backgroundColor: '#E1F5EE', border: '2px solid #1D9E75' }} data-testid="abstain-result-honored">
                        <div className="flex items-center justify-center rounded-full" style={{ width: 44, height: 44, backgroundColor: '#1D9E75' }}>
                          <CheckCircle style={{ width: 22, height: 22, color: '#fff' }} />
                        </div>
                        <p className="text-sm font-semibold mt-1" style={{ color: '#085041' }}>Will honored</p>
                        <p className="text-xs" style={{ color: '#2E7D63' }}>Logged for today.</p>
                        <button
                          onClick={() => setAbstainChanging(true)}
                          className="mt-1 text-xs underline"
                          style={{ color: '#2E7D63', background: 'none', border: 'none', cursor: 'pointer' }}
                          data-testid="button-abstain-change"
                        >Change</button>
                      </div>
                    ) : (
                      <div className="w-full rounded-xl p-4 flex flex-col items-center gap-1.5" style={{ backgroundColor: '#FCEBEB', border: '2px solid #E24B4A' }} data-testid="abstain-result-not-honored">
                        <div className="flex items-center justify-center rounded-full" style={{ width: 44, height: 44, backgroundColor: '#E24B4A' }}>
                          <XCircle style={{ width: 22, height: 22, color: '#fff' }} />
                        </div>
                        <p className="text-sm font-semibold mt-1" style={{ color: '#791F1F' }}>That's okay</p>
                        <p className="text-xs" style={{ color: '#A32D2D' }}>Tomorrow is a fresh start.</p>
                        <button
                          onClick={() => setAbstainChanging(true)}
                          className="mt-1 text-xs underline"
                          style={{ color: '#A32D2D', background: 'none', border: 'none', cursor: 'pointer' }}
                          data-testid="button-abstain-change"
                        >Change</button>
                      </div>
                    );
                  })()
                ) : abstainCheckInOpen || abstainChanging ? (
                  /* Options card — first check-in or changing answer */
                  <div className="bg-white rounded-xl border border-gray-200 p-4" data-testid="abstain-checkin-options">
                    <p className="text-xs text-gray-400 text-center mb-3">Did you honor your will today?</p>
                    <div className="space-y-2">
                      <button
                        onClick={() => { setAbstainJustLoggedHonored(true); setAbstainCheckInOpen(false); setAbstainChanging(false); abstainLogMutation.mutate({ honored: true }); }}
                        disabled={abstainLogMutation.isPending}
                        className="w-full flex items-center justify-center gap-2 py-4 px-4 rounded-xl text-base font-semibold bg-white transition-colors active:opacity-80"
                        style={{ border: '2px solid #1D9E75', color: '#085041' }}
                        data-testid="button-abstain-honored"
                      >
                        <CheckCircle style={{ width: 20, height: 20, color: '#1D9E75' }} />
                        I honored my will
                      </button>
                      <button
                        onClick={() => { setAbstainJustLoggedHonored(false); setAbstainCheckInOpen(false); setAbstainChanging(false); abstainLogMutation.mutate({ honored: false }); }}
                        disabled={abstainLogMutation.isPending}
                        className="w-full flex items-center justify-center gap-2 py-4 px-4 rounded-xl text-base font-semibold bg-white transition-colors active:opacity-80"
                        style={{ border: '2px solid #E24B4A', color: '#A32D2D' }}
                        data-testid="button-abstain-didnt-honor"
                      >
                        <XCircle style={{ width: 20, height: 20, color: '#E24B4A' }} />
                        I didn't honor it
                      </button>
                    </div>
                  </div>
                ) : (
                  /* Step 1: Check in button */
                  <button
                    onClick={() => setAbstainCheckInOpen(true)}
                    className="w-full flex items-center justify-center gap-2 py-4 px-4 rounded-xl text-base font-semibold text-white transition-opacity active:opacity-80"
                    style={{ backgroundColor: '#1D9E75' }}
                    data-testid="button-abstain-check-in"
                  >
                    <CheckCircle style={{ width: 20, height: 20, color: '#fff' }} />
                    Check in for today
                  </button>
                )}
              </div>
            )}

            {/* Abstain: Progress card (collapsible) */}
            {(will.status === 'active' || will.status === 'will_review' || will.status === 'completed' || will.status === 'terminated') && (
              <div className="bg-white rounded-xl border border-gray-200 overflow-hidden" data-testid="card-abstain-progress">
                <button
                  className="w-full flex items-center justify-between px-4 py-3"
                  onClick={() => setAbstainProgressExpanded(v => !v)}
                  data-testid="button-abstain-progress-toggle"
                >
                  <div className="flex items-center gap-2">
                    <span className="flex gap-1">
                      <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 inline-block" />
                      <span className="w-2.5 h-2.5 rounded-full bg-red-400 inline-block" />
                    </span>
                    <div>
                      <span className="text-sm font-semibold text-gray-800">Your progress</span>
                      {(() => {
                        const honored = abstainLogEntries.filter((e: AbstainLog) => e.honored).length;
                        const notHonored = abstainLogEntries.filter((e: AbstainLog) => !e.honored).length;
                        return (honored + notHonored) > 0 ? (
                          <p className="text-xs text-gray-400">{honored} honored · {notHonored} not honored</p>
                        ) : null;
                      })()}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {(() => {
                      const honored = abstainLogEntries.filter((e: AbstainLog) => e.honored).length;
                      const total = abstainLogEntries.length;
                      return total > 0 ? (
                        <span className="text-sm font-bold" style={{ color: '#1D9E75' }}>
                          {Math.round((honored / total) * 100)}%
                        </span>
                      ) : null;
                    })()}
                    <ChevronDown style={{ width: 16, height: 16, color: '#9ca3af', transform: abstainProgressExpanded ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform 0.2s' }} />
                  </div>
                </button>
                {abstainProgressExpanded && (
                  <div className="px-4 pb-4 space-y-3">
                    <div className="grid grid-cols-3 gap-2">
                      <div className="text-center p-2 rounded-lg" style={{ backgroundColor: '#E1F5EE' }}>
                        <div className="text-lg font-bold" style={{ color: '#1D9E75' }}>{abstainLogEntries.filter((e: AbstainLog) => e.honored).length}</div>
                        <div className="text-xs" style={{ color: '#1D9E75' }}>honored</div>
                      </div>
                      <div className="text-center p-2 rounded-lg" style={{ backgroundColor: '#FCEBEB' }}>
                        <div className="text-lg font-bold" style={{ color: '#E24B4A' }}>{abstainLogEntries.filter((e: AbstainLog) => !e.honored).length}</div>
                        <div className="text-xs" style={{ color: '#E24B4A' }}>not honored</div>
                      </div>
                      <div className="text-center p-2 rounded-lg bg-gray-50">
                        <div className="text-lg font-bold text-gray-700">
                          {will.endDate ? Math.max(0, Math.ceil((new Date(will.endDate).getTime() - Date.now()) / 86400000)) : '∞'}
                        </div>
                        <div className="text-xs text-gray-500">days left</div>
                      </div>
                    </div>
                    {abstainCalendarDays.length > 0 && (
                      <div className="space-y-2">
                        <div className="flex gap-1 flex-wrap">
                          {abstainCalendarDays.map((d) => (
                            <div key={d.date} className="flex flex-col items-center" style={{ minWidth: 30 }}>
                              <div
                                className="w-8 h-8 rounded-lg flex items-center justify-center text-xs font-medium"
                                style={{
                                  backgroundColor: d.status === 'honored' ? '#1D9E75' : d.status === 'not-honored' ? '#E24B4A' : '#F3F4F6',
                                  color: d.status === 'pending' ? '#9CA3AF' : '#fff',
                                }}
                              >
                                {new Date(d.date + 'T00:00:00').getDate()}
                              </div>
                            </div>
                          ))}
                        </div>
                        <div className="flex items-center gap-3 flex-wrap">
                          <div className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-emerald-500 inline-block" /><span className="text-xs text-gray-500">Honored</span></div>
                          <div className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-red-400 inline-block" /><span className="text-xs text-gray-500">Not honored</span></div>
                          <div className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-gray-200 inline-block" /><span className="text-xs text-gray-500">Pending</span></div>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </>

        ) : will.commitmentCategory === 'mission' ? (
          <>
            {/* Mission: countdown ring + check-in flow */}
            {(will.status === 'active' || will.status === 'completed') && (
              <div className="bg-white rounded-xl border border-gray-200 p-6 flex flex-col items-center gap-4" data-testid="card-mission-progress">
                {/* SVG Circular Countdown Ring — unchanged */}
                <div className="relative flex items-center justify-center" style={{ width: 120, height: 120 }}>
                  <svg width={120} height={120} style={{ transform: 'rotate(-90deg)' }}>
                    <circle cx={60} cy={60} r={50} fill="none" stroke="#E5E7EB" strokeWidth={9} />
                    <circle
                      cx={60} cy={60} r={50} fill="none"
                      stroke="#534AB7" strokeWidth={9}
                      strokeLinecap="round"
                      strokeDasharray={2 * Math.PI * 50}
                      strokeDashoffset={2 * Math.PI * 50 * (1 - (missionDaysRemaining / missionTotalDays))}
                      style={{ transition: 'stroke-dashoffset 0.5s ease' }}
                    />
                  </svg>
                  <div className="absolute flex flex-col items-center justify-center">
                    <span className="text-2xl font-bold text-gray-900">{missionDaysRemaining}</span>
                    <span className="text-xs text-gray-400 leading-tight">days left</span>
                  </div>
                </div>

                {/* Check-in flow */}
                {will.status === 'active' && (
                  missionCompleted ? (
                    /* Step 3: Completed result */
                    <div className="w-full rounded-xl p-4 flex flex-col items-center gap-1.5" style={{ backgroundColor: '#E1F5EE', border: '2px solid #1D9E75' }} data-testid="mission-result-completed">
                      <p className="text-sm font-semibold" style={{ color: '#085041' }}>Will completed!</p>
                      <p className="text-xs" style={{ color: '#2E7D63' }}>You did it. This chapter is closed.</p>
                    </div>
                  ) : missionKeptGoing ? (
                    /* Step 4: Not yet result */
                    <div className="w-full rounded-xl p-4 flex flex-col items-center gap-1.5 bg-gray-50 border border-gray-200" data-testid="mission-result-not-yet">
                      <p className="text-sm font-semibold text-gray-700">Keep going</p>
                      <p className="text-xs text-gray-400">You still have time.</p>
                    </div>
                  ) : missionCheckInOpen ? (
                    /* Step 2: Options card */
                    <div className="w-full" data-testid="mission-checkin-options">
                      <p className="text-xs text-gray-400 text-center mb-3">Have you completed it?</p>
                      <div className="space-y-2">
                        <button
                          onClick={() => missionCompleteMutation.mutate()}
                          disabled={missionCompleteMutation.isPending}
                          className="w-full flex items-center justify-center gap-2 py-4 px-4 rounded-xl text-base font-semibold bg-white transition-colors active:opacity-80"
                          style={{ border: '2px solid #534AB7', color: '#26215C' }}
                          data-testid="button-mission-confirm-done"
                        >
                          <CheckCircle style={{ width: 20, height: 20, color: '#534AB7' }} />
                          {missionCompleteMutation.isPending ? 'Saving...' : 'Yes, I completed it'}
                        </button>
                        <button
                          onClick={() => {
                            setMissionCheckInOpen(false);
                            setMissionKeptGoing(true);
                            setTimeout(() => setMissionKeptGoing(false), 2000);
                          }}
                          className="w-full flex items-center justify-center gap-2 py-4 px-4 rounded-xl text-base font-semibold bg-white transition-colors active:opacity-80"
                          style={{ border: '0.5px solid #D1D5DB', color: '#6B7280' }}
                          data-testid="button-mission-not-yet"
                        >
                          Not yet
                        </button>
                      </div>
                    </div>
                  ) : (
                    /* Step 1: Check in button */
                    <button
                      onClick={() => setMissionCheckInOpen(true)}
                      className="w-full flex items-center justify-center gap-2 py-4 px-4 rounded-xl text-base font-semibold text-white transition-opacity active:opacity-80"
                      style={{ backgroundColor: '#534AB7' }}
                      data-testid="button-mission-check-in"
                    >
                      <CheckCircle style={{ width: 20, height: 20, color: '#fff' }} />
                      Check in for today
                    </button>
                  )
                )}

                {will.status === 'completed' && (
                  <div className="w-full rounded-xl p-4 flex flex-col items-center gap-1.5" style={{ backgroundColor: '#E1F5EE', border: '2px solid #1D9E75' }} data-testid="mission-already-completed">
                    <p className="text-sm font-semibold" style={{ color: '#085041' }}>Will completed!</p>
                    <p className="text-xs" style={{ color: '#2E7D63' }}>You did it. This chapter is closed.</p>
                  </div>
                )}
              </div>
            )}
          </>

        ) : (
          /* ── Legacy null — unchanged ── */
          <>
            {/* Daily Check-in Button - Primary action for active daily wills */}
            {hasDailyCheckIns && will.status === 'active' && (
              <Button
                onClick={() => setShowCheckInModal(true)}
                className="w-full bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-600 hover:to-teal-600 text-white py-6 text-base"
                data-testid="button-daily-check-in"
              >
                <CheckCircle className="w-5 h-5 mr-2" />
                Daily Check-in
              </Button>
            )}

            {!hasDailyCheckIns && !isFinalReviewOnly && will.status === 'active' && (
              todayGutCheckStatus ? (
                <div className="w-full flex items-center justify-center gap-2 py-4 px-4 rounded-lg bg-gray-50 border border-gray-200 text-sm" data-testid="gut-check-completed">
                  <CheckCircle className={`w-4 h-4 ${todayGutCheckStatus === 'yes' ? 'text-emerald-500' : todayGutCheckStatus === 'partial' ? 'text-amber-500' : 'text-red-400'}`} />
                  <span className="text-gray-600">Today's progress: <span className={`font-medium capitalize ${todayGutCheckStatus === 'yes' ? 'text-emerald-600' : todayGutCheckStatus === 'partial' ? 'text-amber-500' : 'text-red-400'}`}>{todayGutCheckStatus}</span></span>
                </div>
              ) : (
                <Button
                  onClick={() => setShowGutCheckModal(true)}
                  variant="outline"
                  className="w-full border-emerald-200 text-emerald-700 hover:bg-emerald-50 py-6 text-base"
                  data-testid="button-gut-check"
                >
                  <CheckCircle className="w-5 h-5 mr-2" />
                  Have you honored your will today?
                </Button>
              )
            )}

            {isFinalReviewOnly && will.status === 'active' && (
              <div className="w-full flex items-center justify-center gap-2 py-4 px-4 rounded-lg bg-blue-50 border border-blue-200 text-sm" data-testid="final-review-info">
                <Target className="w-4 h-4 text-blue-500" />
                <span className="text-gray-600">No daily check-ins — just review at the end</span>
              </div>
            )}

            {/* Daily Progress Section */}
            {hasDailyCheckIns && (will.status === 'active' || will.status === 'will_review' || will.status === 'completed' || will.status === 'terminated') && (
              <DailyProgressSection
                willId={Number(id)}
                startDate={will.startDate}
                endDate={will.endDate}
                checkInType={userCheckInType}
                activeDays={userActiveDays}
                customDays={userCustomDays}
                onDayClick={will.status === 'active' ? handleDayClick : undefined}
              />
            )}
          </>
        )}

        {/* Threaded Commitments + Reviews Section - During will_review status */}
        {will.status === 'will_review' && (
          <div className="bg-white rounded-lg border border-gray-200 p-4" data-testid="section-threaded-reviews">
            <div className="flex items-center mb-4 pb-2 border-b border-gray-100">
              <CheckCircle className="w-5 h-5 text-purple-600 mr-2" />
              <span className="text-base font-semibold text-gray-900">
                {isSoloMode ? 'Your Commitment & Review' : 'Circle Progress'}
              </span>
            </div>
            <div className="space-y-4">
              {will.commitments && will.commitments.length > 0 && will.commitments.map((commitment: any) => {
                const isCurrentUser = commitment.userId === user?.id;
                const memberReview = reviews?.find((r: any) => r.userId === commitment.userId);
                
                return (
                  <ThreadedMemberReview
                    key={commitment.id}
                    commitment={commitment}
                    review={memberReview}
                    isCurrentUser={isCurrentUser}
                    isSoloMode={isSoloMode}
                  />
                );
              })}
            </div>
          </div>
        )}

        {/* Submit Commitment Section */}
        {(will.status === 'pending' || will.status === 'scheduled') && !userHasCommitted && (
          <div className="bg-white rounded-lg border border-gray-200 p-4">
            <div className="text-center">
              <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-3">
                <svg className="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                </svg>
              </div>
              <h3 className="text-base font-semibold text-gray-900 mb-2">Ready to commit?</h3>
              <p className="text-sm text-gray-500 mb-4">
                {isSoloMode 
                  ? "Define your personal commitment for this will."
                  : "Join your circle members on this will."
                }
              </p>
              <Button 
                onClick={() => setLocation(`/will/${id}/commit`)}
                className="bg-green-600 hover:bg-green-700 text-base py-3 px-6"
                size="lg"
                data-testid="button-submit-commitment"
              >
                Submit My Commitment
              </Button>
            </div>
          </div>
        )}

        {/* Display Submitted Reviews - Only for completed status */}
        {will.status === 'completed' && (
          <div className="bg-white border border-gray-200 rounded-lg p-4" data-testid="section-reviews-display">
            <div className="flex items-center mb-4">
              <CheckCircle className="w-5 h-5 text-purple-600 mr-2" />
              <h3 className="text-base font-semibold text-gray-900">
                {isSoloMode ? 'Your Reflection' : 'Circle Reflections'}
              </h3>
            </div>
            {isReviewsLoading ? (
              <div className="text-center py-4" data-testid="reviews-loading">
                <div className="animate-pulse space-y-3">
                  <div className="h-16 bg-gray-200 rounded-lg"></div>
                  <div className="h-16 bg-gray-200 rounded-lg"></div>
                </div>
                <p className="text-sm text-gray-600 mt-3">Loading reflections...</p>
              </div>
            ) : reviews && reviews.length > 0 ? (
              <div className="space-y-3">
                {reviews.map((review: any) => (
                  <div key={review.id} className="bg-gray-50 border border-gray-200 rounded-lg p-3" data-testid={`review-${review.id}`}>
                    <div className="flex items-center justify-between mb-2">
                      <span className="font-medium text-gray-900" data-testid={`review-author-${review.id}`}>
                        {review.user.firstName}
                      </span>
                      <Badge 
                        className={
                          review.followThrough === 'yes' 
                            ? 'bg-emerald-100 text-emerald-800' 
                            : review.followThrough === 'mostly'
                            ? 'bg-amber-100 text-amber-800'
                            : 'bg-rose-100 text-rose-800'
                        } 
                        data-testid={`review-follow-through-${review.id}`}
                      >
                        {review.followThrough === 'yes' ? 'Yes' : review.followThrough === 'mostly' ? 'Mostly' : 'No'}
                      </Badge>
                    </div>
                    {review.reflectionText && (
                      <p className="text-sm text-gray-700" data-testid={`review-reflection-${review.id}`}>
                        {review.reflectionText}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-4" data-testid="reviews-empty">
                <p className="text-sm text-gray-500">No reviews submitted yet</p>
              </div>
            )}
          </div>
        )}

        {/* End Room Countdown - Show during will_review when End Room is pending */}
        {will.status === 'will_review' && 
         will.endRoomScheduledAt && 
         will.endRoomStatus === 'pending' && (
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4" data-testid="section-end-room-countdown">
            {isReviewStatusLoading ? (
              <div className="text-center py-4">
                <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-3 animate-pulse">
                  <Video className="w-5 h-5 text-blue-600" />
                </div>
                <p className="text-sm text-gray-600">Loading End Room details...</p>
              </div>
            ) : reviewStatus && reviewStatus.hasReviewed ? (
              <div className="text-center">
                <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-3">
                  <Video className="w-5 h-5 text-blue-600" />
                </div>
                <h3 className="text-base font-semibold text-gray-900 mb-2">End Room Coming Up</h3>
                <EndRoomCountdown will={will} />
                <p className="text-sm text-gray-600 mt-3">
                  This <em>Will</em> will complete after the End Room finishes. Join at the scheduled time to reflect together with your circle!
                </p>
              </div>
            ) : null}
          </div>
        )}

        {/* End Room OPEN - Show join button during will_review when room is open */}
        {will.status === 'will_review' && 
         will.endRoomScheduledAt && 
         will.endRoomStatus === 'open' && (
          <div className="bg-green-50 border border-green-200 rounded-lg p-4" data-testid="section-end-room-open">
            <div className="text-center">
              <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-3">
                <Video className="w-6 h-6 text-green-600" />
              </div>
              <h3 className="text-lg font-semibold text-gray-900 mb-2">End Room is Open!</h3>
              <EndRoomCountdown will={will} />
              <p className="text-sm text-gray-600 mt-2 mb-4">
                Join now to reflect with your circle. This <em>Will</em> will complete after the session ends.
              </p>
              <Button 
                onClick={handleJoinEndRoom}
                className="w-full bg-green-600 hover:bg-green-700 text-white text-base py-3"
                size="lg"
                data-testid="button-join-end-room"
              >
                <Video className="w-5 h-5 mr-2" />
                Join End Room
              </Button>
            </div>
          </div>
        )}

        {/* Acknowledgment Section for Completed Circle Wills only */}
        {will.status === 'completed' && !isSoloMode && will.commitments && will.commitments.some((c: any) => c.userId === user?.id) && (
          <div className="bg-green-50 border border-green-200 rounded-lg p-4">
            <div className="text-center">
              <div className="w-10 h-10 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-3">
                <CheckCircle className="w-5 h-5 text-green-600" />
              </div>
              <h3 className="text-base font-semibold text-gray-900 mb-2">Acknowledge <em>Will</em> Completion</h3>
              <p className="text-sm text-gray-600 mb-3">
                {will.acknowledgedCount || 0} of {will.commitments?.length || 0} members acknowledged
              </p>
              {!will.hasUserAcknowledged ? (
                <Button 
                  onClick={() => acknowledgeMutation.mutate()}
                  disabled={acknowledgeMutation.isPending}
                  className="bg-green-600 hover:bg-green-700 text-base py-3 px-6"
                  size="lg"
                  data-testid="button-acknowledge"
                >
                  {acknowledgeMutation.isPending ? 'Acknowledging...' : 'Acknowledge and Close Will'}
                </Button>
              ) : (
                <div className="text-green-700 font-medium text-base">
                  <CheckCircle className="w-5 h-5 inline mr-2" />
                  Acknowledged
                </div>
              )}
            </div>
          </div>
        )}

        {/* End Room Section for active states */}
        {(will.status === 'waiting_for_end_room' || will.status === 'completed') && (
          <div className="bg-purple-50 border border-purple-200 rounded-lg p-4">
            <div className="text-center">
              <div className="w-10 h-10 bg-purple-100 rounded-full flex items-center justify-center mx-auto mb-3">
                <Video className="w-5 h-5 text-purple-600" />
              </div>
              <h3 className="text-base font-semibold text-gray-900 mb-2">End Room</h3>
              <EndRoomCountdown will={will} />
              <EndRoom willId={will.id} />
            </div>
          </div>
        )}

        {/* Manage Will - Collapsed button that opens modal */}
        {(will.createdBy === user?.id || (will.mode === 'circle' && userHasCommitted)) && (will.status === 'active' || will.status === 'paused') && (
          <button
            onClick={() => setShowManageModal(true)}
            className="w-full flex items-center justify-center gap-2 py-3 px-4 bg-gray-50 border border-gray-200 rounded-xl text-gray-600 hover:bg-gray-100 transition-colors"
            data-testid="button-manage-will"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
            <span className="text-sm font-medium">Manage Will</span>
          </button>
        )}

        {/* Back to Hub */}
        <div className="text-center mt-4">
          <button 
            onClick={() => setLocation(getHubUrl())}
            className="text-base text-gray-600 hover:text-gray-800 underline font-medium"
            data-testid="button-back-to-hub"
          >
            Back to Hub
          </button>
        </div>
      </div>

      {/* Manage Will Modal */}
      {showManageModal && (
        <div className="fixed inset-0 z-50 flex items-end justify-center" onClick={() => { setShowManageModal(false); setShowNotifPanel(false); }}>
          <div className="absolute inset-0 bg-black/40" />
          <div 
            className="relative w-full max-w-md bg-white rounded-t-2xl p-6 pb-[calc(env(safe-area-inset-bottom)+1.5rem)] animate-in slide-in-from-bottom duration-200"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="w-10 h-1 bg-gray-300 rounded-full mx-auto mb-6" />

            {showNotifPanel ? (
              /* Notification editing sub-panel */
              <div>
                <div className="flex items-center gap-2 mb-5">
                  <button
                    onClick={() => setShowNotifPanel(false)}
                    className="p-1 rounded-lg hover:bg-gray-100 text-gray-500"
                    data-testid="button-notif-back"
                  >
                    <ChevronLeft className="w-5 h-5" />
                  </button>
                  <h3 className="text-lg font-semibold text-gray-900 flex-1 text-center pr-6">Notifications</h3>
                </div>
                <div className="space-y-5">
                  {/* Toggle */}
                  <div className="flex items-center justify-between py-1">
                    <div className="flex items-center gap-2">
                      <Bell className="w-4 h-4 text-gray-500" />
                      <span className="text-sm font-medium text-gray-800">Send me reminders</span>
                    </div>
                    <button
                      onClick={() => setNotifEnabled(!notifEnabled)}
                      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${notifEnabled ? 'bg-emerald-500' : 'bg-gray-200'}`}
                      data-testid="toggle-notif-enabled"
                    >
                      <span className={`inline-block h-4 w-4 rounded-full bg-white shadow transition-transform ${notifEnabled ? 'translate-x-6' : 'translate-x-1'}`} />
                    </button>
                  </div>

                  {/* Time picker */}
                  {notifEnabled && (
                    <div className="animate-in fade-in slide-in-from-top-2 duration-200">
                      <label className="block text-xs font-medium text-gray-400 uppercase tracking-widest mb-2">
                        Reminder time
                      </label>
                      <input
                        type="time"
                        value={notifTime}
                        onChange={(e) => setNotifTime(e.target.value)}
                        className="w-full border border-gray-200 rounded-xl px-4 py-3 text-base text-gray-900 focus:border-emerald-400 focus:ring-1 focus:ring-emerald-400 focus:outline-none"
                        data-testid="input-notif-time"
                      />
                      <p className="text-xs text-gray-400 mt-1.5">In your local time zone</p>
                    </div>
                  )}

                  {/* Save */}
                  <Button
                    onClick={() => updateNotifMutation.mutate({ reminderTime: notifEnabled ? notifTime : null })}
                    disabled={updateNotifMutation.isPending}
                    className="w-full bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl py-3 text-base font-medium"
                    data-testid="button-save-notif"
                  >
                    {updateNotifMutation.isPending ? "Saving..." : "Save"}
                  </Button>
                </div>
              </div>
            ) : (
              /* Main manage buttons */
              <div>
                <h3 className="text-lg font-semibold text-gray-900 mb-4 text-center">Manage Will</h3>
                <div className="space-y-3">
                  {will.createdBy === user?.id && !will.parentWillId && (
                    <>
                      {will.status === 'active' ? (
                        <Button
                          onClick={() => { pauseMutation.mutate(); setShowManageModal(false); }}
                          disabled={pauseMutation.isPending}
                          className="w-full border border-amber-500 text-amber-600 bg-white hover:bg-amber-50 rounded-xl py-3 text-base font-medium"
                          variant="outline"
                          data-testid="button-pause-will"
                        >
                          {pauseMutation.isPending ? "Pausing..." : "Pause Will"}
                        </Button>
                      ) : will.status === 'paused' ? (
                        <Button
                          onClick={() => { resumeMutation.mutate(); setShowManageModal(false); }}
                          disabled={resumeMutation.isPending}
                          className="w-full border border-green-500 text-green-600 bg-white hover:bg-green-50 rounded-xl py-3 text-base font-medium"
                          variant="outline"
                          data-testid="button-resume-will"
                        >
                          {resumeMutation.isPending ? "Resuming..." : "Resume Will"}
                        </Button>
                      ) : null}
                      
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button 
                            className="w-full border border-red-500 text-red-600 bg-white hover:bg-red-50 rounded-xl py-3 text-base font-medium"
                            variant="outline"
                            data-testid="button-end-will"
                          >
                            End Will
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>End this Will?</AlertDialogTitle>
                            <AlertDialogDescription>
                              This will permanently end this Will. Your progress will be saved but you won't be able to continue tracking.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                            <AlertDialogAction 
                              onClick={() => { terminateMutation.mutate(); setShowManageModal(false); }}
                              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                            >
                              {terminateMutation.isPending ? "Ending..." : "End Will"}
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </>
                  )}

                  {/* Edit Notifications — available to anyone with check-in type reminders */}
                  {will.checkInType !== 'final_review' && will.checkInType !== 'one-time' && (
                    <Button
                      onClick={() => {
                        setNotifEnabled(!!will.reminderTime);
                        setNotifTime(will.reminderTime || '20:00');
                        setShowNotifPanel(true);
                      }}
                      className="w-full border border-gray-300 text-gray-700 bg-white hover:bg-gray-50 rounded-xl py-3 text-base font-medium flex items-center justify-center gap-2"
                      variant="outline"
                      data-testid="button-edit-notifications"
                    >
                      <Bell className="w-4 h-4" />
                      Edit Notifications
                    </Button>
                  )}

                  {(will.mode === 'circle' || !!will.parentWillId) && (
                    <Button
                      onClick={() => { setShowManageModal(false); setShowLeaveModal(true); }}
                      className="w-full border border-red-500 text-red-600 bg-white hover:bg-red-50 rounded-xl py-3 text-base font-medium"
                      variant="outline"
                      data-testid="button-leave-will"
                    >
                      Leave Will
                    </Button>
                  )}

                  <Button
                    onClick={() => setShowManageModal(false)}
                    className="w-full bg-gray-100 text-gray-700 hover:bg-gray-200 rounded-xl py-3 text-base font-medium"
                    variant="ghost"
                    data-testid="button-cancel-manage"
                  >
                    Cancel
                  </Button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Leave Will Confirmation Modal */}
      {showLeaveModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={() => setShowLeaveModal(false)}>
          <div className="absolute inset-0 bg-black/40" />
          <div 
            className="relative w-full max-w-sm bg-white rounded-2xl p-6 animate-in fade-in zoom-in-95 duration-200"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-lg font-semibold text-gray-900 mb-2 text-center" data-testid="title-leave-will">Leave this Will?</h3>
            <p className="text-sm text-gray-500 text-center mb-4">
              {will.parentWillId ? (
                <>Your progress will be saved, but you will no longer be tracking this Will. Other participants are <span className="font-medium text-gray-700">not affected</span>.</>
              ) : (
                <>If you leave, <span className="font-medium text-red-600">this Will ends for everyone</span>. All progress will be saved but no one can continue tracking.</>
              )}
            </p>
            {!will.parentWillId && will.commitments && will.commitments.length > 0 && (
              <div className="bg-gray-50 rounded-xl p-3 mb-4">
                <p className="text-xs text-gray-500 mb-2 font-medium">Members affected:</p>
                <div className="space-y-1">
                  {will.commitments.map((c: any) => (
                    <div key={c.userId} className="flex items-center gap-2" data-testid={`text-leave-member-${c.userId}`}>
                      <div className="w-6 h-6 rounded-full bg-gradient-to-br from-emerald-400 to-teal-500 flex items-center justify-center text-[10px] font-bold text-white">
                        {(c.userFirstName || '?')[0]}
                      </div>
                      <span className="text-sm text-gray-700">
                        {c.userFirstName || 'Member'}
                        {c.userId === user?.id ? ' (you)' : ''}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
            <div className="flex gap-3">
              <Button
                onClick={() => setShowLeaveModal(false)}
                className="flex-1 bg-gray-100 text-gray-700 hover:bg-gray-200 rounded-xl py-3"
                variant="ghost"
                data-testid="button-cancel-leave"
              >
                Cancel
              </Button>
              <Button
                onClick={() => { leaveMutation.mutate(); setShowLeaveModal(false); }}
                disabled={leaveMutation.isPending}
                className="flex-1 bg-red-600 text-white hover:bg-red-700 rounded-xl py-3"
                data-testid="button-confirm-leave"
              >
                {leaveMutation.isPending ? "Leaving..." : "Leave Will"}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Final Will Summary Modal */}
      <FinalWillSummary
        isOpen={showFinalSummary}
        onClose={() => {
          setShowFinalSummary(false);
          setSummaryDismissed(true);
          if (isSoloMode || will?.hasUserAcknowledged || will?.status === 'terminated') {
            setLocation(getHubUrl());
          }
        }}
        onAcknowledge={() => acknowledgeMutation.mutate()}
        will={will}
        isAcknowledging={acknowledgeMutation.isPending}
        currentUserId={user?.id}
        hasUserAcknowledged={will?.hasUserAcknowledged}
        acknowledgedCount={will?.acknowledgedCount || 0}
        commitmentCount={will?.commitmentCount || 0}
        reviews={reviews || []}
      />

      {hasDailyCheckIns && (
        <DailyCheckInModal
          isOpen={showCheckInModal}
          onClose={() => {
            setShowCheckInModal(false);
            setSelectedCheckInDate(null);
          }}
          willId={Number(id)}
          startDate={will?.startDate || ''}
          endDate={will?.endDate || ''}
          existingCheckIns={checkIns}
          initialDate={selectedCheckInDate}
          checkInType={userCheckInType}
          activeDays={userActiveDays}
          customDays={userCustomDays}
        />
      )}

      {/* Daily Gut-Check Modal (set-duration wills only) */}
      {!hasDailyCheckIns && (
        <DailyGutCheckModal
          isOpen={showGutCheckModal}
          onClose={() => setShowGutCheckModal(false)}
          willId={Number(id)}
        />
      )}

      {/* Participants Modal for Public Wills */}
      {showParticipants && participantsData && (
        <div className="fixed inset-0 z-50 flex items-end justify-center" data-testid="modal-participants">
          <div className="absolute inset-0 bg-black/40" onClick={() => setShowParticipants(false)} />
          <div className="relative w-full max-w-lg bg-white rounded-t-2xl max-h-[70vh] flex flex-col animate-in slide-in-from-bottom duration-200">
            <div className="flex items-center justify-between p-4 border-b border-gray-100">
              <div>
                <h3 className="text-lg font-semibold text-gray-900">Participants</h3>
                <p className="text-sm text-gray-500">{participantsData.totalCount} people committed</p>
              </div>
              <button
                onClick={() => setShowParticipants(false)}
                className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center hover:bg-gray-200 transition-colors"
                data-testid="button-close-participants"
              >
                <X className="w-4 h-4 text-gray-600" />
              </button>
            </div>
            <div className="overflow-y-auto p-4 space-y-2">
              {participantsData.participants.map((p) => (
                <div key={p.id} className="flex items-center gap-3 p-2 rounded-lg" data-testid={`participant-${p.id}`}>
                  <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-indigo-500 flex items-center justify-center text-white text-sm font-semibold flex-shrink-0">
                    {p.firstName?.charAt(0).toUpperCase() || '?'}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900">
                      {p.firstName}
                      {p.id === user?.id && (
                        <span className="ml-2 text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded">You</span>
                      )}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </MobileLayout>
  );
}