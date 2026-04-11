import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { useLocation } from "wouter";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { apiRequest } from "@/lib/queryClient";
import { createDateTimeFromInputs } from "@/lib/dateUtils";
import { WillInstructionModal } from "@/components/WillInstructionModal";
import { MobileLayout, SectionCard, PrimaryButton, SectionTitle, ActionButton, UnifiedBackButton } from "@/components/ui/design-system";
import { HelpIcon } from "@/components/ui/HelpIcon";
import { EndRoomTooltip } from "@/components/EndRoomTooltip";
import { notificationService } from "@/services/NotificationService";
import { ArrowRight, Calendar, Clock, Target, HelpCircle, CheckCircle, Heart, Video, Users, Lock, Eye, ClipboardList, MessageCircle, CalendarDays, Pencil } from "lucide-react";
import TimeChipPicker from "@/components/TimeChipPicker";
import NotificationsSetup, { type NotificationsData } from "@/components/NotificationsSetup";

const ENABLE_END_ROOM = false;

function TitleEditRow({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const [editing, setEditing] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (editing && inputRef.current) {
      inputRef.current.focus();
    }
  }, [editing]);

  return (
    <div
      className="flex items-start gap-3 bg-emerald-50/60 rounded-lg p-2.5 -m-0.5 cursor-pointer"
      onClick={() => { if (!editing) setEditing(true); }}
      data-testid="row-will-title"
    >
      <Pencil className="w-4 h-4 text-emerald-500 mt-1 flex-shrink-0" />
      <div className="flex-1 min-w-0">
        <p className="text-[10px] font-semibold text-emerald-600 uppercase tracking-wider">Title · optional</p>
        {editing ? (
          <>
            <input
              ref={inputRef}
              type="text"
              maxLength={40}
              value={value}
              onChange={(e) => onChange(e.target.value)}
              onBlur={() => setEditing(false)}
              onKeyDown={(e) => { if (e.key === 'Enter') setEditing(false); }}
              placeholder="Add a title to your Will…"
              className="w-full mt-1 text-sm text-gray-700 bg-transparent border-0 border-b border-emerald-300 focus:border-emerald-500 focus:outline-none focus:ring-0 pb-0.5"
              data-testid="input-will-title"
            />
            <p className="text-[10px] text-emerald-400 mt-0.5 text-right">{value.length}/40</p>
          </>
        ) : (
          <p className="text-sm mt-1 pb-0.5 border-b border-emerald-200/60">
            {value ? (
              <span className="font-semibold text-gray-800">{value}</span>
            ) : (
              <span className="italic text-gray-300">Add a title to your Will…</span>
            )}
          </p>
        )}
      </div>
    </div>
  );
}

// Helper function to get next Monday's date in YYYY-MM-DD format (local timezone)
// Returns the upcoming Monday:
// - Sunday: tomorrow (Monday)
// - Monday: today (user can adjust time to be future)
// - Tuesday-Saturday: the upcoming Monday
function getNextMondayDate(): string {
  const now = new Date();
  const dayOfWeek = now.getDay(); // 0 = Sunday, 1 = Monday, etc.
  
  // Calculate days until next Monday
  let daysUntilMonday;
  if (dayOfWeek === 0) { // Sunday
    daysUntilMonday = 1; // Tomorrow is Monday
  } else if (dayOfWeek === 1) { // Monday
    daysUntilMonday = 0; // Today is Monday (user can set time in future)
  } else {
    // Tuesday (2) through Saturday (6)
    daysUntilMonday = 8 - dayOfWeek;
  }
  
  const nextMonday = new Date(now);
  nextMonday.setDate(now.getDate() + daysUntilMonday);
  
  // Return in YYYY-MM-DD format (local date)
  const year = nextMonday.getFullYear();
  const month = String(nextMonday.getMonth() + 1).padStart(2, '0');
  const day = String(nextMonday.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

// Helper function to get following Sunday's date in YYYY-MM-DD format (local timezone)
function getFollowingSundayDate(mondayDateStr: string): string {
  const [year, month, day] = mondayDateStr.split('-').map(Number);
  const monday = new Date(year, month - 1, day);
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6); // Add 6 days to get to Sunday
  
  // Return in YYYY-MM-DD format (local date)
  const sunYear = sunday.getFullYear();
  const sunMonth = String(sunday.getMonth() + 1).padStart(2, '0');
  const sunDay = String(sunday.getDate()).padStart(2, '0');
  return `${sunYear}-${sunMonth}-${sunDay}`;
}

interface StartWillProps {
  isSoloMode?: boolean;
  circleId?: number;
}

export default function StartWill({ isSoloMode = false, circleId }: StartWillProps) {
  const [, setLocation] = useLocation();
  const [currentStep, setCurrentStep] = useState(1);
  const [showTransition, setShowTransition] = useState(false);
  const [showFinalStepLoading, setShowFinalStepLoading] = useState(false);
  
  // 5 steps: What, Why, When, Check-In, Confirm
  // 6 steps with End Room enabled: What, Why, When, Check-In, Confirm, End Room
  const totalSteps = ENABLE_END_ROOM ? 6 : 5;
  
  // Get step label based on mode
  const getStepLabel = (step: number) => {
    if (step === 6) return "End Room";
    const labels = ["", "What", "Why", "When", "Check-In", "Confirm"];
    return labels[step] || "";
  };
  
  // Helper functions for confirmation screen
  const formatDateForDisplay = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', { 
      month: 'short', 
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit'
    });
  };

  const getDurationText = (startStr: string, endStr: string) => {
    const startDate = new Date(startStr);
    const endDate = new Date(endStr);
    const diffMs = endDate.getTime() - startDate.getTime();
    const days = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
    
    if (days === 1) return "1 day";
    if (days < 7) return `${days} days`;
    if (days === 7) return "1 week";
    const weeks = Math.floor(days / 7);
    const remainingDays = days % 7;
    if (remainingDays === 0) return `${weeks} week${weeks > 1 ? 's' : ''}`;
    return `${weeks} week${weeks > 1 ? 's' : ''}, ${remainingDays} day${remainingDays > 1 ? 's' : ''}`;
  };
  
  // Helper to get minimum valid start time (next 15-min block from now)
  const getMinimumStartDateTime = () => {
    const now = new Date();
    const minutes = now.getMinutes();
    const roundedMinutes = Math.ceil(minutes / 15) * 15;
    now.setMinutes(roundedMinutes, 0, 0);
    if (roundedMinutes >= 60) {
      now.setHours(now.getHours() + 1);
      now.setMinutes(0);
    }
    return now;
  };

  // Initialize date/time defaults once on mount
  const [startDate, setStartDate] = useState(() => getNextMondayDate());
  const [startTime, setStartTime] = useState('00:00');
  const [endDate, setEndDate] = useState(() => getFollowingSundayDate(getNextMondayDate()));
  const [endTime, setEndTime] = useState('12:00');
  const [isIndefinite, setIsIndefinite] = useState(false);
  
  // Enforce End date/time must be after Start - auto-bump End when Start changes
  useEffect(() => {
    if (startDate && endDate) {
      const startDateTime = new Date(`${startDate}T${startTime || '00:00'}`);
      const endDateTime = new Date(`${endDate}T${endTime || '12:00'}`);
      
      // If End is now before or equal to Start, bump End forward (Start + 6 days)
      if (endDateTime <= startDateTime) {
        const newEndDate = new Date(startDateTime);
        newEndDate.setDate(newEndDate.getDate() + 6);
        const year = newEndDate.getFullYear();
        const month = String(newEndDate.getMonth() + 1).padStart(2, '0');
        const day = String(newEndDate.getDate()).padStart(2, '0');
        setEndDate(`${year}-${month}-${day}`);
      }
    }
  }, [startDate, startTime]);

  useEffect(() => {
    setCheckInType(isIndefinite ? 'daily' : 'final_review');
  }, [isIndefinite]);
  
  const [willData, setWillData] = useState({
    startDate: '',
    endDate: '',
    what: '',
    why: '',
    willTitle: '',
    circleId: null as number | null,
    endRoomScheduledAt: '' as string | null,
  });
  
  // Will type for Circle mode: 'classic' (individual commitments) or 'cumulative' (shared commitment)
  const [willType, setWillType] = useState<'classic' | 'cumulative' | null>(null);
  
  const [checkInType, setCheckInType] = useState<'daily' | 'specific_days' | 'final_review'>('daily');

  // Short-duration wills (< 24 hours) skip the check-in time step entirely
  const isShortDuration = useMemo(() => {
    if (isIndefinite) return false;
    if (!startDate || !endDate || !startTime) return false;
    const start = new Date(`${startDate}T${startTime}`);
    const end = new Date(`${endDate}T${endTime || '23:59'}`);
    const diffMs = end.getTime() - start.getTime();
    return diffMs <= 24 * 60 * 60 * 1000;
  }, [startDate, startTime, endDate, endTime, isIndefinite]);
  
  // Will-specific reminder time for daily check-ins (HH:MM format)
  const [willReminderTime, setWillReminderTime] = useState<string>('20:00');
  
  // Check-in time: when to prompt the user (HH:MM format)
  const [checkInTime, setCheckInTime] = useState<string>('20:00');
  
  const [activeDays, setActiveDays] = useState<'every_day' | 'weekdays' | 'custom'>('every_day');
  const [customDays, setCustomDays] = useState<number[]>([1, 2, 3, 4, 5]);
  
  // Visibility: 'private' (default) or 'public' (discoverable in Explore)
  // Pre-set to 'public' if ?visibility=public is in the URL (from WhoModal "Everyone" choice)
  const [visibility, setVisibility] = useState<'private' | 'public'>(() => {
    const params = new URLSearchParams(window.location.search);
    return params.get('visibility') === 'public' ? 'public' : 'private';
  });
  
  // For Circle mode, we show type selection before step 1
  const showTypeSelection = !isSoloMode && willType === null;
  const [whatCharCount, setWhatCharCount] = useState(0);
  const [whyCharCount, setWhyCharCount] = useState(0);
  const [showInstructionModal, setShowInstructionModal] = useState(false);
  const [showHelpIcon, setShowHelpIcon] = useState(false);
  const [endRoomDateTime, setEndRoomDateTime] = useState('');
  const [showEndRoomForm, setShowEndRoomForm] = useState(false);
  const [showSkipConfirmation, setShowSkipConfirmation] = useState(false);
  
  // Notifications setup data — set when the user completes the NotificationsSetup step
  const [notificationsData, setNotificationsData] = useState<NotificationsData | null>(null);

  // Daily reminder settings - track if user has made changes
  const [dailyReminderTime, setDailyReminderTime] = useState<string>('');
  const [skipDailyReminder, setSkipDailyReminder] = useState<boolean | null>(null);
  const [hasModifiedReminder, setHasModifiedReminder] = useState(false);
  
  const { toast } = useToast();
  
  // Auto-resize refs for textareas
  const whatRef = useRef<HTMLTextAreaElement>(null);
  const whyRef = useRef<HTMLTextAreaElement>(null);
  
  const resizeTextarea = useCallback((ref: React.RefObject<HTMLTextAreaElement>, maxHeight: number = 96) => {
    const textarea = ref.current;
    if (!textarea) return;
    textarea.style.height = 'auto';
    const newHeight = Math.min(textarea.scrollHeight, maxHeight);
    textarea.style.height = `${newHeight}px`;
  }, []);
  
  useEffect(() => {
    resizeTextarea(whatRef);
  }, [willData.what, resizeTextarea]);
  
  useEffect(() => {
    resizeTextarea(whyRef);
  }, [willData.why, resizeTextarea]);
  const queryClient = useQueryClient();
  const { user } = useAuth();

  // Legacy circle query — disabled (circles removed; isSoloMode is always true from routing)
  const circle = undefined;

  // Check if user should see instruction modal
  useEffect(() => {
    const hasSeenInstruction = localStorage.getItem('willInstructionSeen');
    const hasCreatedWill = localStorage.getItem('hasCreatedWill');
    
    if (!hasSeenInstruction && !hasCreatedWill) {
      setShowInstructionModal(true);
    }
    
    // Always show help icon once the component is loaded
    setShowHelpIcon(true);
  }, []);
  
  // Initialize daily reminder time from user's existing settings
  useEffect(() => {
    if (user) {
      // Respect server state: if user has a reminder time set, use it; otherwise use default 07:30
      setDailyReminderTime(user.dailyReminderTime || '07:30');
      // Respect server state: if explicitly disabled (false) or never set (null), default to showing enabled
      // This makes the toggle default to ON for new users but respects their choice if they disabled it
      setSkipDailyReminder(user.dailyReminderEnabled === false);
    }
  }, [user]);
  
  // Mutation to update reminder settings
  const updateReminderSettingsMutation = useMutation({
    mutationFn: async (settings: { dailyReminderTime?: string | null; dailyReminderEnabled?: boolean }) => {
      const response = await apiRequest('/api/user/reminder-settings', {
        method: 'PATCH',
        body: JSON.stringify(settings)
      });
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/user'] });
    },
    onError: (error: any) => {
      toast({
        title: "Reminder Settings",
        description: error.message || "Failed to save reminder settings, but your Will was created",
        variant: "destructive",
      });
    }
  });

  const createWillMutation = useMutation({
    mutationFn: async (data: any) => {
      const response = await apiRequest('/api/wills', {
        method: 'POST',
        body: JSON.stringify(data)
      });
      return response.json();
    },
    onSuccess: async (will) => {
      if (isSoloMode) {
        // Invalidate solo-specific queries and wait for completion
        await queryClient.invalidateQueries({ queryKey: ['/api/wills/solo'] });
        await queryClient.invalidateQueries({ queryKey: ['/api/wills/all-active'] });
        await queryClient.invalidateQueries({ queryKey: ['/api/wills'] });
        
        // Solo mode: Backend auto-creates commitment, so just show success and navigate
        toast({
          title: "Will Created!",
          description: "Your solo Will is now active. Time to get started!",
          duration: 4000,
        });
        setLocation('/solo/hub');
      } else {
        // Invalidate all related queries to ensure UI updates everywhere
        queryClient.invalidateQueries({ queryKey: ['/api/wills/all-active'] });
        queryClient.invalidateQueries({ queryKey: ['/api/my-wills'] });
        
        // Send notification about WILL proposal to other members (circle mode only)
        if (willData.what && user?.firstName) {
          try {
            await notificationService.sendWillProposedNotification(
              user.firstName,
              willData.what
            );
          } catch (error) {
            console.error('Failed to send WILL proposal notification:', error);
          }
        }
        
        // Circle mode: Add the creator's commitment separately (include checkInType for all wills)
        // For cumulative wills: stored on will table (all members use same tracking type)
        // For classic wills: stored on commitment table (each member has their own tracking type)
        addCommitmentMutation.mutate({
          willId: will.id,
          what: willData.what,
          why: willData.why,
          checkInType: checkInType, // Proposer's checkInType for both classic and cumulative wills
        });
      }
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const addCommitmentMutation = useMutation({
    mutationFn: async (data: any) => {
      const response = await apiRequest(`/api/wills/${data.willId}/commitments`, {
        method: 'POST',
        body: JSON.stringify({
          what: data.what,
          why: data.why,
          checkInType: data.checkInType, // Pass tracking type for all wills
        })
      });
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/wills/all-active'] });
      queryClient.invalidateQueries({ queryKey: ['/api/my-wills'] });
      
      toast({
        title: "Will Created!",
        description: "Will has been created and is pending review from other members.",
      });
      setLocation('/my-wills');
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleStep1Submit = (e: React.FormEvent) => {
    e.preventDefault();

    const startDateTime = createDateTimeFromInputs(startDate, startTime);
    const endDateTime = isIndefinite ? '' : createDateTimeFromInputs(endDate, endTime);

    const now = new Date();
    const start = new Date(startDateTime);

    if (start <= now) {
      toast({
        title: "Invalid Start Date",
        description: "Start date must be in the future",
        variant: "destructive",
      });
      return;
    }

    if (!isIndefinite) {
      const end = new Date(endDateTime);
      if (end <= start) {
        toast({
          title: "Invalid End Date",
          description: "End date must be after start date",
          variant: "destructive",
        });
        return;
      }
    }

    const updatedWillData = { ...willData, startDate: startDateTime, endDate: endDateTime };
    setWillData(updatedWillData);
    setShowFinalStepLoading(true);

    // Short-duration wills (< 24 hours) skip check-in step, go straight to confirm
    const skipCheckIn = !isIndefinite && endDateTime &&
      (new Date(endDateTime).getTime() - new Date(startDateTime).getTime()) < 24 * 60 * 60 * 1000;

    setTimeout(() => {
      setShowFinalStepLoading(false);
      setCurrentStep(skipCheckIn ? 5 : 4);
    }, 1500);
  };

  const handleStep4Submit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!willData.startDate) {
      toast({
        title: "Missing Timeline",
        description: "Please go back and set your start date first",
        variant: "destructive",
      });
      setCurrentStep(3);
      return;
    }

    if (checkInType === 'specific_days' && customDays.length === 0) {
      toast({
        title: "No Days Selected",
        description: "Please select at least one day for check-ins",
        variant: "destructive",
      });
      return;
    }

    if (hasModifiedReminder) {
      updateReminderSettingsMutation.mutate({
        dailyReminderTime: skipDailyReminder ? null : dailyReminderTime,
        dailyReminderEnabled: !skipDailyReminder
      });
    }

    setCurrentStep(5);
  };

  const handleConfirmSubmit = () => {
    const resolvedCheckInType = notificationsData?.checkInType ?? checkInType;
    const resolvedCheckInTime = notificationsData
      ? (notificationsData.checkInTime ?? undefined)
      : (checkInType !== 'final_review' && !isShortDuration ? checkInTime : undefined);
    const resolvedReminderTime = notificationsData
      ? (notificationsData.reminderTime ?? undefined)
      : (checkInType !== 'final_review' && !isShortDuration ? willReminderTime : undefined);

    if (ENABLE_END_ROOM && !isSoloMode) {
      setCurrentStep(6);
    } else if (isSoloMode) {
      createWillMutation.mutate({
        title: willData.willTitle.trim() || undefined,
        startDate: willData.startDate,
        endDate: isIndefinite ? null : willData.endDate,
        endRoomScheduledAt: null,
        circleId: null,
        mode: 'personal',
        what: willData.what,
        because: willData.why,
        checkInType: resolvedCheckInType,
        isIndefinite: isIndefinite,
        visibility: visibility,
        checkInTime: resolvedCheckInTime,
        activeDays: 'every_day',
        reminderTime: resolvedReminderTime,
        commitmentCategory: notificationsData?.commitmentCategory ?? undefined,
        milestones: notificationsData?.milestones ? JSON.stringify(notificationsData.milestones) : undefined,
      });
    } else {
      // Non-solo, non-circle: create as personal will
      createWillMutation.mutate({
        title: willData.willTitle.trim() || undefined,
        startDate: willData.startDate,
        endDate: isIndefinite ? null : willData.endDate,
        endRoomScheduledAt: null,
        circleId: null,
        mode: 'personal',
        what: willData.what,
        because: willData.why,
        checkInType: resolvedCheckInType,
        isIndefinite: isIndefinite,
        checkInTime: resolvedCheckInTime,
        activeDays: 'every_day',
        reminderTime: resolvedReminderTime,
        commitmentCategory: notificationsData?.commitmentCategory ?? undefined,
        milestones: notificationsData?.milestones ? JSON.stringify(notificationsData.milestones) : undefined,
      });
    }
  };

  const handleStep2Submit = (e: React.FormEvent) => {
    e.preventDefault();
    const form = e.target as HTMLFormElement;
    const formData = new FormData(form);
    const what = formData.get('what') as string;

    if (!what.trim()) {
      toast({
        title: "Empty Commitment",
        description: "Please describe what you will do",
        variant: "destructive",
      });
      return;
    }

    setWillData({ ...willData, what: what.trim() });
    // What is now step 1 → go to step 2 (Why)
    setCurrentStep(2);
  };

  const handleStep3Submit = (e: React.FormEvent) => {
    e.preventDefault();
    const form = e.target as HTMLFormElement;
    const formData = new FormData(form);
    const why = formData.get('why') as string;

    if (!why.trim()) {
      toast({
        title: "Missing Motivation",
        description: "Please explain why this matters to you",
        variant: "destructive",
      });
      return;
    }

    const updatedWillData = {
      ...willData,
      why: why.trim(),
      circleId: isSoloMode ? null : circle?.id,
    };
    
    setWillData(updatedWillData);
    // Why is now step 2 → go to step 3 (When)
    setCurrentStep(3);
  };
  
  const handleCircleCreateSubmit = () => {
    createWillMutation.mutate({
      title: willData.what || "Group Goal",
      description: willData.why || "Group commitment",
      startDate: willData.startDate,
      endDate: isIndefinite ? null : willData.endDate,
      endRoomScheduledAt: null,
      circleId: circle?.id,
      willType: willType || 'classic',
      sharedWhat: willType === 'cumulative' ? willData.what : undefined,
      checkInType: checkInType,
      isIndefinite: isIndefinite,
      checkInTime: checkInType !== 'final_review' ? checkInTime : undefined,
      activeDays: checkInType === 'specific_days' ? 'custom' : (checkInType === 'daily' ? 'every_day' : undefined),
      customDays: checkInType === 'specific_days' ? JSON.stringify(customDays) : undefined,
      reminderTime: checkInType !== 'final_review' ? willReminderTime : undefined,
    });
  };

  // Handler for End Room scheduling (Step 5 in circle mode, only when ENABLE_END_ROOM is true)
  const handleEndRoomSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const form = e.target as HTMLFormElement;
    const formData = new FormData(form);
    const endRoomDateTimeValue = formData.get('endRoomDateTime') as string;

    let endRoomTimeUTC = null;
    if (endRoomDateTimeValue) {
      const endRoomTime = new Date(endRoomDateTimeValue);
      const willEndTime = new Date(willData.endDate);
      const maxEndRoomTime = new Date(willEndTime.getTime() + 48 * 60 * 60 * 1000);

      if (endRoomTime <= willEndTime) {
        toast({
          title: "Invalid End Room Time",
          description: "End Room must be scheduled after the Will ends",
          variant: "destructive",
        });
        return;
      }

      if (endRoomTime > maxEndRoomTime) {
        toast({
          title: "Invalid End Room Time",
          description: "End Room must be scheduled within 48 hours after the Will ends",
          variant: "destructive",
        });
        return;
      }

      endRoomTimeUTC = new Date(endRoomDateTimeValue).toISOString();
    }
    
    createWillMutation.mutate({
      title: willData.what || "Group Goal",
      description: willData.why || "Group commitment",
      startDate: willData.startDate,
      endDate: isIndefinite ? null : willData.endDate,
      endRoomScheduledAt: isIndefinite ? null : endRoomTimeUTC,
      circleId: circle?.id,
      willType: willType || 'classic',
      sharedWhat: willType === 'cumulative' ? willData.what : undefined,
      checkInType: checkInType,
      isIndefinite: isIndefinite,
      checkInTime: checkInType !== 'final_review' ? checkInTime : undefined,
      activeDays: checkInType === 'specific_days' ? 'custom' : (checkInType === 'daily' ? 'every_day' : undefined),
      customDays: checkInType === 'specific_days' ? JSON.stringify(customDays) : undefined,
      reminderTime: checkInType !== 'final_review' ? willReminderTime : undefined,
    });
  };

  const handlePersonalConfirmSubmit = () => {
    createWillMutation.mutate({
      title: willData.what || "Personal Goal",
      description: willData.why || "Personal commitment",
      startDate: willData.startDate,
      endDate: isIndefinite ? null : willData.endDate,
      endRoomScheduledAt: null,
      mode: 'personal',
      visibility: visibility,
      what: willData.what,
      because: willData.why,
      checkInType: checkInType,
      reminderTime: checkInType !== 'final_review' ? willReminderTime : undefined,
      isIndefinite: isIndefinite,
      checkInTime: checkInType !== 'final_review' ? checkInTime : undefined,
      activeDays: checkInType === 'specific_days' ? 'custom' : (checkInType === 'daily' ? 'every_day' : undefined),
      customDays: checkInType === 'specific_days' ? JSON.stringify(customDays) : undefined,
    });
  };

  const handleCancel = () => {
    setLocation(isSoloMode ? '/' : '/my-wills');
  };

  const handleModalStart = () => {
    // Mark that user has started creating a will
    localStorage.setItem('hasCreatedWill', 'true');
  };

  const handleModalClose = () => {
    setShowInstructionModal(false);
  };

  // Only require circle for circle mode
  if (!isSoloMode && !circle) {
    return (
      <div className="min-h-screen pt-16 flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">Create a Will</h2>
          <p className="text-gray-600 mb-6">Start a personal will or create a team will with friends.</p>
          <Button onClick={() => setLocation('/my-wills')}>
            Go to My Wills
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full max-w-screen-sm mx-auto overflow-x-hidden bg-gradient-to-br from-gray-50 via-white to-gray-50/50 min-h-screen">
      {showFinalStepLoading && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-white/90 backdrop-blur-sm">
          <div className="text-center animate-in fade-in zoom-in-95 duration-300">
            <div className="w-14 h-14 mx-auto mb-4 rounded-full bg-gradient-to-r from-emerald-500 to-teal-500 flex items-center justify-center">
              <CheckCircle className="w-7 h-7 text-white animate-pulse" />
            </div>
            <p className="text-lg font-semibold text-gray-800">One final step...</p>
            <p className="text-sm text-gray-500 mt-1">Almost there!</p>
          </div>
        </div>
      )}
      <MobileLayout>
        {/* Sticky Header with Progress Indicator */}
        <div className={`sticky top-0 z-10 bg-white border-b border-gray-100 pt-[calc(env(safe-area-inset-top)+1rem)] ${currentStep === 5 ? "pb-2 mb-2" : "pb-4 mb-6"}`}>
          <div className="pt-4 space-y-3">
            {/* Back Button Row */}
            <div className="relative flex items-center mb-2 min-h-[44px]">
              <UnifiedBackButton 
                onClick={() => {
                  if (showTypeSelection) {
                    setLocation('/my-wills');
                  } else if (currentStep === 1 && !isSoloMode && willType !== null) {
                    setWillType(null);
                  } else if (currentStep === 1) {
                    setLocation(isSoloMode ? '/' : '/my-wills');
                  } else {
                    setCurrentStep(currentStep - 1);
                  }
                }} 
                testId="button-back"
              />
              <span className="absolute left-0 right-0 text-center text-sm font-medium text-gray-500 pointer-events-none">Create Will</span>
              <div className="w-11 ml-auto"></div>
            </div>
            
            {/* Hide step indicators during type selection and on steps 4-5 (Check-In and Confirm are unlabeled steps) */}
            {!showTypeSelection && currentStep <= 3 && (
              <div className="flex items-center justify-center space-x-2 min-w-0 flex-1">
                {/* Step 1: What */}
                <div className="flex items-center">
                  <div className={`w-6 h-6 ${currentStep >= 1 ? 'bg-brandBlue text-white' : 'bg-gray-300 text-gray-600'} rounded-full flex items-center justify-center text-[10px] font-semibold`}>
                    1
                  </div>
                  <span className={`ml-1 text-[10px] ${currentStep >= 1 ? 'text-brandBlue' : 'text-gray-600'} font-medium tracking-tight`}>{getStepLabel(1)}</span>
                </div>
                <div className={`w-5 h-0.5 ${currentStep >= 2 ? 'bg-brandBlue' : 'bg-gray-300'}`}></div>
                {/* Step 2: Why */}
                <div className="flex items-center">
                  <div className={`w-6 h-6 ${currentStep >= 2 ? 'bg-brandBlue text-white' : 'bg-gray-300 text-gray-600'} rounded-full flex items-center justify-center text-[10px] font-semibold`}>
                    2
                  </div>
                  <span className={`ml-1 text-[10px] ${currentStep >= 2 ? 'text-brandBlue' : 'text-gray-600'} font-medium tracking-tight`}>{getStepLabel(2)}</span>
                </div>
                <div className={`w-5 h-0.5 ${currentStep >= 3 ? 'bg-brandBlue' : 'bg-gray-300'}`}></div>
                {/* Step 3: When */}
                <div className="flex items-center">
                  <div className={`w-6 h-6 ${currentStep >= 3 ? 'bg-brandBlue text-white' : 'bg-gray-300 text-gray-600'} rounded-full flex items-center justify-center text-[10px] font-semibold`}>
                    3
                  </div>
                  <span className={`ml-1 text-[10px] ${currentStep >= 3 ? 'text-brandBlue' : 'text-gray-600'} font-medium tracking-tight`}>{getStepLabel(3)}</span>
                </div>
              </div>
            )}
          </div>
          
          {/* Current Step Title — hidden on review and notifications steps */}
          {currentStep !== 5 && currentStep !== 4 && (
          <div className="text-center mt-3">
            <h1 className="text-xl font-semibold text-gray-900">
              {showTypeSelection && "Choose your Will Type:"}
              {!showTypeSelection && currentStep === 1 && (willType === 'cumulative' ? "What would your circle like to do?" : "What would you like to do?")}
              {!showTypeSelection && currentStep === 2 && "Why would you like to do this?"}
              {!showTypeSelection && currentStep === 3 && "Set Your Timeline"}
              {!showTypeSelection && currentStep === 4 && "Notifications"}
            </h1>
            {!showTypeSelection && currentStep === 1 && (
              <>
                <div className="flex justify-center my-3">
                  <div className="w-10 h-10 bg-green-500 rounded-full flex items-center justify-center">
                    <CheckCircle className="w-6 h-6 text-white" />
                  </div>
                </div>
                <p className="text-sm text-gray-500 mt-1">Cause it's as simple as wanting.</p>
              </>
            )}
            {!showTypeSelection && currentStep === 2 && (
              <>
                <div className="flex justify-center my-3">
                  <div className="w-10 h-10 bg-red-500 rounded-full flex items-center justify-center">
                    <Heart className="w-6 h-6 text-white" />
                  </div>
                </div>
                <p className="text-sm text-gray-500 mt-1">Remember this when it gets tough.</p>
              </>
            )}
            {!showTypeSelection && currentStep === 3 && (
              <p className="text-sm text-gray-500 mt-1">When will your Will begin and end?</p>
            )}
            {!showTypeSelection && currentStep === 4 && (
              <p className="text-sm text-gray-500 mt-1">
                Which type best describes your Will?
              </p>
            )}
          </div>
          )}
        </div>

        <div className="flex-1 space-y-6">
        
        {/* Type Selection Screen (Circle mode only) */}
        {showTypeSelection && (
          <div className="flex flex-col animate-in fade-in duration-500 px-4">
            <div className="space-y-4 py-6">
              {/* Normal Option - Enhanced design matching Home screen */}
              <button
                onClick={() => setWillType('classic')}
                className="w-full text-left group"
                data-testid="button-type-classic"
              >
                <div className="relative">
                  <div className="absolute -inset-1 bg-gradient-to-r from-blue-400 to-indigo-500 rounded-2xl blur opacity-10 group-hover:opacity-30 transition-opacity duration-300"></div>
                  <div className="relative bg-white border-2 border-blue-200 shadow-sm group-hover:border-blue-400 rounded-2xl overflow-hidden transition-all duration-300 group-hover:shadow-xl group-hover:-translate-y-0.5 p-5">
                    <div className="flex items-start space-x-4">
                      <div className="relative flex-shrink-0">
                        <div className="w-14 h-14 bg-gradient-to-br from-blue-50 to-indigo-50 rounded-xl border border-blue-200 flex items-center justify-center shadow-sm group-hover:shadow-md transition-shadow">
                          <Target className="w-7 h-7 text-blue-600" strokeWidth={1.5} />
                        </div>
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between">
                          <h3 className="text-lg font-semibold text-gray-900">Normal</h3>
                          <ArrowRight className="w-5 h-5 text-gray-400 group-hover:text-blue-500 group-hover:translate-x-1 transition-all" />
                        </div>
                        <p className="text-blue-600/90 text-sm font-medium italic mt-0.5 tracking-tight">
                          "I Will…"
                        </p>
                        <p className="text-gray-500 text-sm mt-2 leading-relaxed">
                          Each circle member defines their own Will
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              </button>
              
              {/* Shared Option - Enhanced design matching Home screen */}
              <button
                onClick={() => setWillType('cumulative')}
                className="w-full text-left group"
                data-testid="button-type-cumulative"
              >
                <div className="relative">
                  <div className="absolute -inset-1 bg-gradient-to-r from-purple-400 to-pink-500 rounded-2xl blur opacity-10 group-hover:opacity-30 transition-opacity duration-300"></div>
                  <div className="relative bg-white border-2 border-purple-200 shadow-sm group-hover:border-purple-400 rounded-2xl overflow-hidden transition-all duration-300 group-hover:shadow-xl group-hover:-translate-y-0.5 p-5">
                    <div className="flex items-start space-x-4">
                      <div className="relative flex-shrink-0">
                        <div className="w-14 h-14 bg-gradient-to-br from-purple-50 to-pink-50 rounded-xl border border-purple-200 flex items-center justify-center shadow-sm group-hover:shadow-md transition-shadow">
                          <Users className="w-7 h-7 text-purple-600" strokeWidth={1.5} />
                        </div>
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between">
                          <h3 className="text-lg font-semibold text-gray-900">Shared</h3>
                          <ArrowRight className="w-5 h-5 text-gray-400 group-hover:text-purple-500 group-hover:translate-x-1 transition-all" />
                        </div>
                        <p className="text-purple-600/90 text-sm font-medium italic mt-0.5 tracking-tight">
                          "We Will…"
                        </p>
                        <p className="text-gray-500 text-sm mt-2 leading-relaxed">
                          All circle members commit to the same Will
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              </button>
            </div>
          </div>
        )}
        
        {/* Transition Animation Screen */}
        {showTransition && (
          <div className="flex items-center justify-center py-16">
            <div className="text-center space-y-6 animate-fade-in">
              <div className="w-16 h-16 mx-auto bg-brandBlue rounded-full flex items-center justify-center animate-pulse">
                <CheckCircle className="w-8 h-8 text-white" />
              </div>
              <p className="text-lg font-medium text-gray-900 animate-slide-up">
                One last step before you set up your <em>Will</em>...
              </p>
            </div>
          </div>
        )}

        {/* Step 3: Timeline - Clean Date/Time Layout */}
        {currentStep === 3 && !showTransition && !showTypeSelection && (
          <div className="flex flex-col animate-in fade-in duration-500">
            <form onSubmit={handleStep1Submit} className="flex flex-col flex-1">
              <div className="flex-1 flex flex-col justify-center py-2">
                
                {/* Duration Type Toggle */}
                <div className="flex justify-center gap-2 mb-6 animate-in fade-in slide-in-from-bottom-2 duration-300" style={{ animationDelay: '50ms' }}>
                  <button
                    type="button"
                    onClick={() => setIsIndefinite(false)}
                    className={`px-4 py-2 rounded-full text-sm font-medium transition-all ${
                      !isIndefinite 
                        ? 'bg-blue-500 text-white shadow-md' 
                        : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                    }`}
                    data-testid="button-duration-defined"
                  >
                    Set dates
                  </button>
                  <button
                    type="button"
                    onClick={() => setIsIndefinite(true)}
                    className={`px-4 py-2 rounded-full text-sm font-medium transition-all ${
                      isIndefinite 
                        ? 'bg-blue-500 text-white shadow-md' 
                        : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                    }`}
                    data-testid="button-duration-indefinite"
                  >
                    Ongoing
                  </button>
                </div>

                {/* Date/Time Rows - Inline Layout */}
                <div className="space-y-5 px-4 animate-in fade-in slide-in-from-bottom-3 duration-500" style={{ animationDelay: '100ms' }}>
                  {/* Start Row */}
                  <div className="animate-in fade-in slide-in-from-bottom-2 duration-300">
                    <p className="text-xs font-medium text-gray-400 uppercase tracking-widest mb-2">Start</p>
                    <div className="flex items-center gap-3">
                      <Input 
                        type="date" 
                        value={startDate}
                        onChange={(e) => setStartDate(e.target.value)}
                        min={(() => {
                          const today = new Date();
                          return `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
                        })()}
                        required 
                        className="flex-1 text-sm bg-white border border-gray-200 rounded-lg px-3 py-2 focus:border-blue-400 focus:ring-1 focus:ring-blue-400"
                        data-testid="input-start-date"
                      />
                      <TimeChipPicker
                        value={startTime}
                        onChange={setStartTime}
                        testId="input-start-time"
                      />
                    </div>
                  </div>
                  
                  {!isIndefinite && (
                    <>
                      {/* Connector */}
                      <div className="flex justify-center">
                        <div className="w-px h-3 bg-gray-200"></div>
                      </div>
                      
                      {/* End Row */}
                      <div className="animate-in fade-in slide-in-from-bottom-2 duration-300" style={{ animationDelay: '50ms' }}>
                        <p className="text-xs font-medium text-gray-400 uppercase tracking-widest mb-2">End</p>
                        <div className="flex items-center gap-3">
                          <Input 
                            type="date" 
                            value={endDate}
                            onChange={(e) => setEndDate(e.target.value)}
                            min={startDate}
                            required 
                            className="flex-1 text-sm bg-white border border-gray-200 rounded-lg px-3 py-2 focus:border-blue-400 focus:ring-1 focus:ring-blue-400"
                            data-testid="input-end-date"
                          />
                          <TimeChipPicker
                            value={endTime}
                            onChange={setEndTime}
                            testId="input-end-time"
                          />
                        </div>
                      </div>
                    </>
                  )}
                  
                  {isIndefinite && (
                    <p className="text-xs text-gray-400 text-center italic animate-in fade-in duration-300 pt-4" style={{ animationDelay: '250ms' }}>
                      You can pause or end this Will at any time
                    </p>
                  )}
                </div>

              </div>
              
              {/* Navigation */}
              <div className="flex justify-end items-center pt-4 pb-2 border-t border-gray-100 animate-in fade-in slide-in-from-bottom-2 duration-300" style={{ animationDelay: '250ms' }}>
                <PrimaryButton data-testid="button-next-timeline">
                  Next <ArrowRight className="w-4 h-4 ml-2" />
                </PrimaryButton>
              </div>
            </form>
          </div>
        )}

        {/* Step 4: Notifications Setup */}
        {currentStep === 4 && !showTransition && !showTypeSelection && (
          <NotificationsSetup
            what={willData.what}
            because={willData.why}
            onComplete={(data) => {
              setNotificationsData(data);
              setCheckInType(data.checkInType);
              setCurrentStep(5);
            }}
            onBack={() => setCurrentStep(3)}
          />
        )}
        
        {/* Step 5: Confirmation / Review Page */}
        {currentStep === 5 && !showTransition && !showTypeSelection && (
          <div className="flex flex-col animate-in fade-in duration-500">
            <div className="flex-1 flex flex-col py-1 px-4">
              <div className="space-y-2">
                <div className="bg-gray-50 rounded-xl p-3 space-y-2">
                  {/* TITLE row — optional, tap-to-edit inline */}
                  <TitleEditRow
                    value={willData.willTitle}
                    onChange={(v) => setWillData({ ...willData, willTitle: v })}
                  />

                  <div className="border-t border-gray-200"></div>

                  <div className="flex items-start gap-3">
                    <ClipboardList className="w-5 h-5 text-emerald-600 mt-0.5 flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium text-gray-400 uppercase tracking-wide">What</p>
                      <p className="text-sm font-medium text-gray-900 mt-0.5" data-testid="text-confirm-what">
                        {willType === 'cumulative' ? 'We Will' : 'I Will'} {willData.what}
                      </p>
                    </div>
                  </div>

                  <div className="border-t border-gray-200"></div>

                  <div className="flex items-start gap-3">
                    <MessageCircle className="w-5 h-5 text-red-500 mt-0.5 flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium text-gray-400 uppercase tracking-wide">Why</p>
                      <p className="text-sm text-gray-700 mt-0.5" data-testid="text-confirm-why">{willData.why}</p>
                    </div>
                  </div>

                  <div className="border-t border-gray-200"></div>

                  <div className="flex items-start gap-3">
                    <Calendar className="w-5 h-5 text-blue-600 mt-0.5 flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium text-gray-400 uppercase tracking-wide">Timeline</p>
                      {isIndefinite ? (
                        <p className="text-sm text-gray-700 mt-0.5" data-testid="text-confirm-timeline">
                          Ongoing
                        </p>
                      ) : (
                        <div className="mt-0.5" data-testid="text-confirm-timeline">
                          <p className="text-sm text-gray-700">
                            {formatDateForDisplay(willData.startDate)} — {formatDateForDisplay(willData.endDate)}
                          </p>
                          <p className="text-xs text-gray-400 mt-0.5">
                            {getDurationText(willData.startDate, willData.endDate)}
                          </p>
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="border-t border-gray-200"></div>
                  <div className="flex items-start gap-3">
                    <CalendarDays className="w-5 h-5 text-indigo-600 mt-0.5 flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium text-gray-400 uppercase tracking-wide">Tracking</p>
                      <p className="text-sm text-gray-700 mt-0.5" data-testid="text-confirm-tracking">
                        {checkInType === 'daily' && 'Every day'}
                        {checkInType === 'specific_days' && (() => {
                          const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
                          return customDays.sort((a, b) => a - b).map(d => dayNames[d]).join(', ');
                        })()}
                        {checkInType === 'final_review' && 'Final review only'}
                      </p>
                    </div>
                  </div>

                  {checkInType !== 'final_review' && !isShortDuration && (
                    <>
                      <div className="border-t border-gray-200"></div>
                      <div className="flex items-start gap-3">
                        <Clock className="w-5 h-5 text-amber-600 mt-0.5 flex-shrink-0" />
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-medium text-gray-400 uppercase tracking-wide">Check-In Time</p>
                          <p className="text-sm text-gray-700 mt-0.5" data-testid="text-confirm-checkin-time">
                            {(() => {
                              const [h, m] = checkInTime.split(':').map(Number);
                              const period = h >= 12 ? 'PM' : 'AM';
                              const displayHour = h === 0 ? 12 : h > 12 ? h - 12 : h;
                              return `${displayHour}:${String(m).padStart(2, '0')} ${period}`;
                            })()}
                          </p>
                        </div>
                      </div>
                    </>
                  )}

                  {isSoloMode && (
                    <>
                      <div className="border-t border-gray-200"></div>
                      <div className="flex items-start gap-3">
                        {visibility === 'private' 
                          ? <Lock className="w-5 h-5 text-gray-500 mt-0.5 flex-shrink-0" />
                          : <Eye className="w-5 h-5 text-green-600 mt-0.5 flex-shrink-0" />
                        }
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-medium text-gray-400 uppercase tracking-wide">Visibility</p>
                          <p className="text-sm text-gray-700 mt-0.5 capitalize" data-testid="text-confirm-visibility">
                            {visibility}
                          </p>
                        </div>
                      </div>
                    </>
                  )}
                </div>
              </div>
            </div>

            <div className="flex justify-between items-center pt-2 pb-1 border-t border-gray-100 animate-in fade-in slide-in-from-bottom-2 duration-300">
              <Button type="button" variant="ghost" onClick={() => setCurrentStep(isShortDuration ? 3 : 4)} className="text-gray-500" data-testid="button-back-to-tracking">
                Back
              </Button>
              <button
                onClick={handleConfirmSubmit}
                disabled={createWillMutation.isPending || addCommitmentMutation.isPending}
                className={`px-6 py-3 rounded-xl text-sm font-medium transition-all duration-200 flex items-center justify-center ${
                  createWillMutation.isPending || addCommitmentMutation.isPending
                    ? 'bg-gray-200 text-gray-400 cursor-not-allowed'
                    : 'bg-gradient-to-r from-emerald-500 to-teal-500 text-white hover:from-emerald-600 hover:to-teal-600 shadow-sm'
                }`}
                data-testid="button-create-will"
              >
                {createWillMutation.isPending || addCommitmentMutation.isPending 
                  ? 'Creating...' 
                  : 'Create Will'}
                <ArrowRight className="w-4 h-4 ml-2" />
              </button>
            </div>
          </div>
        )}

        {/* Step 1: What Will You Do - Focused Writing Experience */}
        {currentStep === 1 && !showTransition && !showTypeSelection && (
          <div className="flex flex-col animate-in fade-in duration-500">
            <form onSubmit={handleStep2Submit} className="flex flex-col">
              {/* Main Writing Area - Compact, No Scroll */}
              <div className="flex flex-col pt-4 pb-6">
                {/* The Writing Statement */}
                <div className="space-y-4 animate-in fade-in slide-in-from-bottom-3 duration-500">
                  {/* "I Will" or "We Will" - Large, Prominent, Strong */}
                  <p className="text-3xl font-bold text-gray-900 text-center tracking-tight">
                    {willType === 'cumulative' ? 'We Will' : 'I Will'}
                  </p>
                  
                  {/* Text Input - Clean, Minimal, Focused */}
                  <div className="relative px-2">
                    <Textarea 
                      ref={whatRef}
                      name="what"
                      required 
                      rows={2} 
                      maxLength={75}
                      value={willData.what}
                      onChange={(e) => {
                        setWillData({ ...willData, what: e.target.value });
                        setWhatCharCount(e.target.value.length);
                        resizeTextarea(whatRef);
                      }}
                      className="w-full text-center text-xl leading-relaxed font-normal text-gray-700 bg-transparent border-0 border-b-2 border-gray-200 focus:border-blue-400 focus:ring-0 resize-none transition-colors duration-300 placeholder:text-gray-300 placeholder:italic py-3 px-4" 
                      style={{ minHeight: '72px', maxHeight: '120px' }}
                      placeholder={willType === 'cumulative' ? "go phone free for 24 hours" : "call my grandmother this week"}
                      data-testid="input-what"
                    />
                  </div>
                  
                  {/* Character count - Subtle */}
                  <p className="text-xs text-gray-400 text-center tracking-tight animate-in fade-in duration-300" style={{ animationDelay: '200ms' }}>
                    {whatCharCount} / 75
                  </p>
                </div>

              </div>
              
              {/* Navigation - Anchored */}
              <div className="flex justify-end items-center pt-4 pb-2 border-t border-gray-100 animate-in fade-in slide-in-from-bottom-2 duration-300" style={{ animationDelay: '400ms' }}>
                <PrimaryButton data-testid="button-next">
                  Next <ArrowRight className="w-4 h-4 ml-2" />
                </PrimaryButton>
              </div>
            </form>
          </div>
        )}
        
        {/* Step 2: Why - Focused Writing Experience */}
        {currentStep === 2 && !showTransition && (
          <div className="flex flex-col animate-in fade-in duration-500">
            <form onSubmit={handleStep3Submit} className="flex flex-col">
              {/* Main Writing Area - Compact, No Scroll */}
              <div className="flex flex-col pt-4 pb-6">
                {/* Commitment Preview - Prominent reminder */}
                {willData.what && (
                  <div className="mb-6 text-center animate-in fade-in slide-in-from-bottom-2 duration-300">
                    <p className="text-lg font-semibold text-gray-800">
                      {willType === 'cumulative' ? `"${willData.what}"` : `"I Will ${willData.what}"`}
                    </p>
                  </div>
                )}
                
                {/* The Writing Statement */}
                <div className="space-y-4 animate-in fade-in slide-in-from-bottom-3 duration-500" style={{ animationDelay: '100ms' }}>
                  {/* "Because" - Large, Prominent with privacy note */}
                  <div className="text-center">
                    <p className="text-3xl font-bold text-gray-900 tracking-tight">
                      Because
                    </p>
                    {!isSoloMode && (
                      <p className="text-xs text-gray-400 mt-1">(Private — only you can see this)</p>
                    )}
                  </div>
                  
                  {/* Text Input - Clean, Minimal, Focused */}
                  <div className="relative px-2">
                    <Textarea 
                      ref={whyRef}
                      name="why"
                      required 
                      rows={2} 
                      maxLength={75}
                      value={willData.why}
                      onChange={(e) => {
                        setWillData({ ...willData, why: e.target.value });
                        setWhyCharCount(e.target.value.length);
                        resizeTextarea(whyRef);
                      }}
                      className="w-full text-center text-xl leading-relaxed font-normal text-gray-700 bg-transparent border-0 border-b-2 border-gray-200 focus:border-red-300 focus:ring-0 resize-none transition-colors duration-300 placeholder:text-gray-300 placeholder:italic py-3 px-4" 
                      style={{ minHeight: '72px', maxHeight: '120px' }}
                      placeholder={willType === 'cumulative' ? "this will make me be more present" : "I like how I feel after I talk to her"}
                      data-testid="input-why"
                    />
                  </div>
                  
                  {/* Character count - Subtle */}
                  <p className="text-xs text-gray-400 text-center tracking-tight animate-in fade-in duration-300" style={{ animationDelay: '200ms' }}>
                    {whyCharCount} / 75
                  </p>
                </div>
              </div>
              
              {/* Navigation - Anchored */}
              <div className="flex justify-end items-center pt-4 pb-2 border-t border-gray-100 animate-in fade-in slide-in-from-bottom-2 duration-300" style={{ animationDelay: '300ms' }}>
                <PrimaryButton data-testid="button-next">
                  Next <ArrowRight className="w-4 h-4 ml-2" />
                </PrimaryButton>
              </div>
            </form>
          </div>
        )}
        
        {/* Step 4: End Room Scheduling (Circle mode only, behind ENABLE_END_ROOM flag) */}
        {ENABLE_END_ROOM && currentStep === 6 && !showTransition && !isSoloMode && (
          <div className="flex flex-col animate-in fade-in duration-500">
            <form onSubmit={handleEndRoomSubmit} className="flex flex-col">
              <div className="flex flex-col pt-2 pb-4">
                <div className="flex justify-center mb-2">
                  <div className="relative">
                    <div className="absolute inset-0 bg-gradient-to-r from-blue-400 to-indigo-500 rounded-full blur-md opacity-20"></div>
                    <div className="relative w-10 h-10 bg-gradient-to-br from-blue-50 to-indigo-50 rounded-full border border-blue-100 flex items-center justify-center">
                      <Video className="w-5 h-5 text-blue-600" />
                    </div>
                  </div>
                </div>
                
                <label className="block text-sm font-medium text-gray-700 mb-2 text-center px-2">
                  Schedule a video call after your <em>Will</em> ends on{' '}
                  <span className="font-semibold text-gray-900">
                    {endDate ? new Date(`${endDate}T${endTime || '12:00'}`).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : ''}{' '}
                    at {endTime ? new Date(`${endDate}T${endTime}`).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }) : '12:00 PM'}
                  </span>
                </label>
                
                <div className="w-full max-w-xs mx-auto mb-3">
                  <input
                    type="datetime-local"
                    name="endRoomDateTime"
                    min={willData.endDate}
                    max={willData.endDate ? new Date(new Date(willData.endDate).getTime() + 48 * 60 * 60 * 1000).toISOString().slice(0, 16) : undefined}
                    value={endRoomDateTime}
                    onChange={(e) => setEndRoomDateTime(e.target.value)}
                    className="w-full text-sm text-gray-900 bg-white border border-gray-200 rounded-xl p-2.5 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-300 transition-all duration-200"
                    data-testid="input-end-room-datetime"
                  />
                </div>

                <div className="mx-2 bg-blue-50 border border-blue-200 rounded-xl p-3">
                  <ul className="space-y-1.5 text-sm text-gray-600 leading-relaxed">
                    <li className="flex items-start">
                      <span className="w-1.5 h-1.5 bg-blue-500 rounded-full mr-2 mt-1.5 flex-shrink-0"></span>
                      Video link opens automatically at chosen time
                    </li>
                    <li className="flex items-start">
                      <span className="w-1.5 h-1.5 bg-blue-500 rounded-full mr-2 mt-1.5 flex-shrink-0"></span>
                      Runs for 30 minutes
                    </li>
                    <li className="flex items-start">
                      <span className="w-1.5 h-1.5 bg-blue-500 rounded-full mr-2 mt-1.5 flex-shrink-0"></span>
                      Can't be changed once Will starts
                    </li>
                  </ul>
                </div>
              </div>

              <div className="flex items-center justify-between pt-4 pb-2 border-t border-gray-100 animate-in fade-in slide-in-from-bottom-2 duration-300" style={{ animationDelay: '300ms' }}>
                <button 
                  type="button" 
                  onClick={() => setShowSkipConfirmation(true)}
                  disabled={createWillMutation.isPending || addCommitmentMutation.isPending}
                  className="h-11 px-4 text-sm font-medium text-gray-500 bg-transparent border border-gray-200 rounded-xl hover:bg-gray-50 hover:text-gray-700 hover:border-gray-300 transition-all duration-200 disabled:opacity-50"
                  data-testid="button-skip-endroom"
                >
                  Skip this step
                </button>
                
                <button
                  type="submit"
                  disabled={!endRoomDateTime || createWillMutation.isPending || addCommitmentMutation.isPending}
                  className={`h-11 px-4 inline-flex items-center justify-center font-medium text-base rounded-lg transition-colors ${
                    !endRoomDateTime || createWillMutation.isPending || addCommitmentMutation.isPending
                      ? 'bg-gray-200 text-gray-400 cursor-not-allowed'
                      : 'bg-secondary text-secondary-foreground hover:bg-secondary/90 active:bg-secondary/80'
                  }`}
                  data-testid="button-schedule-and-create"
                >
                  {createWillMutation.isPending || addCommitmentMutation.isPending 
                    ? 'Creating...' 
                    : 'Create'}
                  <ArrowRight className="w-4 h-4 ml-2" />
                </button>
              </div>
            </form>
          </div>
        )}
        
        {/* Skip End Room Confirmation Modal (behind ENABLE_END_ROOM flag) */}
        {ENABLE_END_ROOM && showSkipConfirmation && (
          <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-5 backdrop-blur-sm">
            <div className="bg-white rounded-2xl p-6 max-w-sm w-full shadow-2xl animate-in fade-in zoom-in-95 duration-200">
              <h3 className="text-lg font-semibold text-gray-900 mb-3 text-center">
                Are you sure you want to skip the End Room?
              </h3>
              
              <p className="text-sm text-gray-600 mb-6 text-center leading-relaxed">
                This is your circle's opportunity to gather and reflect at the end of your <em>Will</em>.
                <br /><br />
                You can still continue without setting one.
              </p>
              
              <div className="flex flex-col space-y-3">
                <button
                  onClick={() => setShowSkipConfirmation(false)}
                  className="w-full px-4 py-3 bg-white border border-gray-300 text-gray-700 rounded-xl text-sm font-medium hover:bg-gray-50 transition-colors duration-200"
                  data-testid="modal-button-cancel"
                >
                  Cancel
                </button>
                <button
                  onClick={() => {
                    setShowSkipConfirmation(false);
                    setEndRoomDateTime('');
                    createWillMutation.mutate({
                      title: willData.what || "Group Goal",
                      description: willData.why || "Group commitment",
                      startDate: willData.startDate,
                      endDate: isIndefinite ? null : willData.endDate,
                      endRoomScheduledAt: null,
                      circleId: circle?.id,
                      willType: willType || 'classic',
                      sharedWhat: willType === 'cumulative' ? willData.what : undefined,
                      checkInType: checkInType,
                      isIndefinite: isIndefinite,
                      checkInTime: checkInType !== 'final_review' ? checkInTime : undefined,
                      activeDays: checkInType === 'specific_days' ? 'custom' : (checkInType === 'daily' ? 'every_day' : undefined),
                      customDays: checkInType === 'specific_days' ? JSON.stringify(customDays) : undefined,
                      reminderTime: checkInType !== 'final_review' ? willReminderTime : undefined,
                    });
                  }}
                  disabled={createWillMutation.isPending || addCommitmentMutation.isPending}
                  className="w-full px-4 py-3 bg-gray-800 text-white rounded-xl text-sm font-medium hover:bg-gray-900 transition-colors duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
                  data-testid="modal-button-skip"
                >
                  {createWillMutation.isPending || addCommitmentMutation.isPending 
                    ? 'Creating...' 
                    : 'Skip End Room'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Instruction Modal */}
        <WillInstructionModal
          isOpen={showInstructionModal}
          onClose={handleModalClose}
          onStart={handleModalStart}
          showDontShowAgain={true}
        />
      </div>
    </MobileLayout>
    </div>
  );
}