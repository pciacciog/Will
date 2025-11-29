import { useState, useEffect, useRef, useCallback } from "react";
import { useLocation } from "wouter";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
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
import { MobileLayout, SectionCard, PrimaryButton, SectionTitle, ActionButton } from "@/components/ui/design-system";
import { HelpIcon } from "@/components/ui/HelpIcon";
import { EndRoomTooltip } from "@/components/EndRoomTooltip";
import { notificationService } from "@/services/NotificationService";
import { ArrowLeft, ArrowRight, Calendar, Clock, Target, HelpCircle, CheckCircle, Heart, Video } from "lucide-react";

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
}

export default function StartWill({ isSoloMode = false }: StartWillProps) {
  const [, setLocation] = useLocation();
  const [currentStep, setCurrentStep] = useState(1);
  const [showTransition, setShowTransition] = useState(false);
  
  // Both modes now have 4 steps:
  // Solo mode: When, What, Why, Confirm
  // Circle mode: When, What, Why, End Room
  const totalSteps = 4;
  
  // Get step label based on mode
  const getStepLabel = (step: number) => {
    if (step === 4) {
      return isSoloMode ? "Confirm" : "End Room";
    }
    const labels = ["", "When", "What", "Why"];
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
  
  const [willData, setWillData] = useState({
    startDate: '',
    endDate: '',
    what: '',
    why: '',
    circleId: null as number | null,
    endRoomScheduledAt: '' as string | null,
  });
  const [whatCharCount, setWhatCharCount] = useState(0);
  const [whyCharCount, setWhyCharCount] = useState(0);
  const [showInstructionModal, setShowInstructionModal] = useState(false);
  const [showHelpIcon, setShowHelpIcon] = useState(false);
  const [endRoomDateTime, setEndRoomDateTime] = useState('');
  const [showEndRoomForm, setShowEndRoomForm] = useState(false);
  const [showSkipConfirmation, setShowSkipConfirmation] = useState(false);
  
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

  const { data: circle } = useQuery<any>({
    queryKey: ['/api/circles/mine'],
  });

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
        // Invalidate solo-specific queries
        queryClient.invalidateQueries({ queryKey: ['/api/wills/solo'] });
      } else {
        // Invalidate all related queries to ensure UI updates everywhere
        queryClient.invalidateQueries({ queryKey: ['/api/wills/circle'] });
        queryClient.invalidateQueries({ queryKey: ['/api/circles/mine'] });
        queryClient.invalidateQueries({ queryKey: [`/api/wills/circle/${circle?.id}`] });
        
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
      }
      
      // Add the creator's commitment
      addCommitmentMutation.mutate({
        willId: will.id,
        what: willData.what,
        why: willData.why,
      });
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
        })
      });
      return response.json();
    },
    onSuccess: () => {
      if (isSoloMode) {
        // Invalidate solo-specific queries
        queryClient.invalidateQueries({ queryKey: ['/api/wills/solo'] });
        
        toast({
          title: "Will Created!",
          description: "Your solo Will is now active. Time to get started!",
        });
        setLocation('/solo/hub');
      } else {
        // Invalidate all related queries to ensure UI updates everywhere
        queryClient.invalidateQueries({ queryKey: ['/api/wills/circle'] });
        queryClient.invalidateQueries({ queryKey: ['/api/circles/mine'] });
        queryClient.invalidateQueries({ queryKey: [`/api/wills/circle/${circle?.id}`] });
        
        toast({
          title: "Will Created!",
          description: "Will has been created and is pending review from other members.",
        });
        setLocation('/hub');
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

  const handleStep1Submit = (e: React.FormEvent) => {
    e.preventDefault();

    // Combine date and time using utility function
    const startDateTime = createDateTimeFromInputs(startDate, startTime);
    const endDateTime = createDateTimeFromInputs(endDate, endTime);

    // Validation
    const now = new Date();
    const start = new Date(startDateTime);
    const end = new Date(endDateTime);

    if (start <= now) {
      toast({
        title: "Invalid Start Date",
        description: "Start date must be in the future",
        variant: "destructive",
      });
      return;
    }

    if (end <= start) {
      toast({
        title: "Invalid End Date",
        description: "End date must be after start date",
        variant: "destructive",
      });
      return;
    }

    // Only save daily reminder settings if user has made changes
    if (hasModifiedReminder) {
      updateReminderSettingsMutation.mutate({
        dailyReminderTime: skipDailyReminder ? null : dailyReminderTime,
        dailyReminderEnabled: !skipDailyReminder
      });
    }

    setWillData({ ...willData, startDate: startDateTime, endDate: endDateTime });
    setCurrentStep(2);
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
    setCurrentStep(3);
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
    
    if (isSoloMode) {
      // Solo mode: Go to confirmation step (Step 4)
      setCurrentStep(4);
    } else {
      // Circle mode: Show transition animation then go to End Room step
      setShowTransition(true);
      
      // After 3.5 seconds, move to End Room scheduling step
      setTimeout(() => {
        setShowTransition(false);
        setCurrentStep(4);
      }, 3500);
    }
  };
  
  // Handler for Solo mode confirmation step
  const handleSoloConfirmSubmit = () => {
    createWillMutation.mutate({
      title: willData.what || "Solo Goal",
      description: willData.why || "Personal commitment",
      startDate: willData.startDate,
      endDate: willData.endDate,
      endRoomScheduledAt: null,
      mode: 'solo',
    });
  };

  const handleStep4Submit = (e: React.FormEvent) => {
    e.preventDefault();
    const form = e.target as HTMLFormElement;
    const formData = new FormData(form);
    const endRoomDateTime = formData.get('endRoomDateTime') as string;

    // End Room is now OPTIONAL - only validate if user provides a time
    let endRoomTimeUTC = null;
    if (endRoomDateTime) {
      // Validate End Room scheduling rules
      const endRoomTime = new Date(endRoomDateTime);
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

      // Convert local datetime to UTC for storage
      endRoomTimeUTC = new Date(endRoomDateTime).toISOString();
    }
    
    const finalWillData = {
      ...willData,
      endRoomScheduledAt: endRoomTimeUTC,
      circleId: circle?.id,
    };

    // Create the will with optional End Room time
    createWillMutation.mutate({
      title: finalWillData.what || "Group Goal",
      description: finalWillData.why || "Group commitment",
      startDate: finalWillData.startDate,
      endDate: finalWillData.endDate,
      endRoomScheduledAt: finalWillData.endRoomScheduledAt,
      circleId: finalWillData.circleId,
    });

    setWillData(finalWillData);
  };

  const handleCancel = () => {
    setLocation(isSoloMode ? '/solo/hub' : '/hub');
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
          <h2 className="text-xl font-semibold text-gray-900 mb-4">No Circle Found</h2>
          <p className="text-gray-600 mb-6">You need to be part of a Circle to create a Will.</p>
          <Button onClick={() => setLocation('/inner-circle')}>
            Create or Join Circle
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full max-w-screen-sm mx-auto overflow-x-hidden bg-gradient-to-br from-gray-50 via-white to-gray-50/50 min-h-screen">
      <MobileLayout>
        {/* Sticky Header with Progress Indicator */}
        <div className="sticky top-0 z-10 bg-white border-b border-gray-100 pb-4 mb-6 pt-[calc(env(safe-area-inset-top)+1rem)]">
          <div className="pt-4 space-y-3">
            <div className="flex items-center justify-center space-x-1.5 min-w-0 flex-1">
              {/* Step 1: When */}
              <div className="flex items-center">
                <div className={`w-7 h-7 ${currentStep >= 1 ? 'bg-brandBlue text-white' : 'bg-gray-300 text-gray-600'} rounded-full flex items-center justify-center text-xs font-semibold`}>
                  1
                </div>
                <span className={`ml-1 text-xs ${currentStep >= 1 ? 'text-brandBlue' : 'text-gray-600'} font-medium tracking-tight`}>{getStepLabel(1)}</span>
              </div>
              <div className={`w-4 h-0.5 ${currentStep >= 2 ? 'bg-brandBlue' : 'bg-gray-300'}`}></div>
              {/* Step 2: What */}
              <div className="flex items-center">
                <div className={`w-7 h-7 ${currentStep >= 2 ? 'bg-brandBlue text-white' : 'bg-gray-300 text-gray-600'} rounded-full flex items-center justify-center text-xs font-semibold`}>
                  2
                </div>
                <span className={`ml-1 text-xs ${currentStep >= 2 ? 'text-brandBlue' : 'text-gray-600'} font-medium tracking-tight`}>{getStepLabel(2)}</span>
              </div>
              <div className={`w-4 h-0.5 ${currentStep >= 3 ? 'bg-brandBlue' : 'bg-gray-300'}`}></div>
              {/* Step 3: Why */}
              <div className="flex items-center">
                <div className={`w-7 h-7 ${currentStep >= 3 ? 'bg-brandBlue text-white' : 'bg-gray-300 text-gray-600'} rounded-full flex items-center justify-center text-xs font-semibold`}>
                  3
                </div>
                <span className={`ml-1 text-xs ${currentStep >= 3 ? 'text-brandBlue' : 'text-gray-600'} font-medium tracking-tight`}>{getStepLabel(3)}</span>
              </div>
              {/* Note: Step 4 (End Room for Circle mode, Confirm for Solo mode) exists in the flow 
                  but is intentionally hidden from the visual step indicator. 
                  Users experience the core flow as When → What → Why, then proceed to End Room/Confirm. */}
            </div>
          
          {/* Current Step Title */}
          <div className="text-center mt-16">
            <h1 className="text-xl font-semibold text-gray-900">
              {currentStep === 1 && "Set Your Timeline"}
              {currentStep === 2 && "What would you like to do?"}
              {currentStep === 3 && "Why would you like to do this?"}
              {currentStep === 4 && (isSoloMode ? "Review Your Will" : "Schedule Your End Room")}
            </h1>
            {currentStep === 1 && (
              <p className="text-sm text-gray-500 mt-1">When will your Will begin and end?</p>
            )}
            {currentStep === 2 && (
              <>
                <div className="flex justify-center my-3">
                  <div className="w-10 h-10 bg-green-500 rounded-full flex items-center justify-center">
                    <CheckCircle className="w-6 h-6 text-white" />
                  </div>
                </div>
                <p className="text-sm text-gray-500 mt-1">Cause it's as simple as wanting.</p>
              </>
            )}
            {currentStep === 3 && (
              <>
                <div className="flex justify-center my-3">
                  <div className="w-10 h-10 bg-red-500 rounded-full flex items-center justify-center">
                    <Heart className="w-6 h-6 text-white" />
                  </div>
                </div>
                <p className="text-sm text-gray-500 mt-1">Remember this when it gets tough.</p>
              </>
            )}
            {currentStep === 4 && (
              <p className="text-sm text-gray-500 mt-1">
                {isSoloMode 
                  ? "Confirm your commitment before starting" 
                  : "An opportunity for your circle to gather, reflect, share, and honor the effort."}
              </p>
            )}
          </div>
        </div>
      </div>

      <div className="flex-1 space-y-6">
        
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

        {/* Step 1: Set Dates */}
        {currentStep === 1 && !showTransition && (
          <SectionCard>
            
            <form onSubmit={handleStep1Submit} className="space-y-5 px-4">
              {/* Start Date & Time */}
              <div className="animate-in fade-in slide-in-from-bottom-2 duration-300">
                <label className="block text-sm font-medium text-gray-700 mb-2 tracking-tight">Start</label>
                <div className="grid grid-cols-2 gap-3">
                  <Input 
                    type="date" 
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    min={new Date().toISOString().split('T')[0]}
                    required 
                    className="w-full text-sm"
                    data-testid="input-start-date"
                  />
                  <Input 
                    type="time" 
                    value={startTime}
                    onChange={(e) => setStartTime(e.target.value)}
                    step="900"
                    required 
                    className="w-full text-sm"
                    data-testid="input-start-time"
                  />
                </div>
              </div>
              
              {/* End Date & Time */}
              <div className="animate-in fade-in slide-in-from-bottom-2 duration-300" style={{ animationDelay: '100ms' }}>
                <label className="block text-sm font-medium text-gray-700 mb-2 tracking-tight">End</label>
                <div className="grid grid-cols-2 gap-3">
                  <Input 
                    type="date" 
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                    min={startDate}
                    required 
                    className="w-full text-sm"
                    data-testid="input-end-date"
                  />
                  <Input 
                    type="time" 
                    value={endTime}
                    onChange={(e) => setEndTime(e.target.value)}
                    step="900"
                    required 
                    className="w-full text-sm"
                    data-testid="input-end-time"
                  />
                </div>
              </div>
              
              {/* Asterisk note */}
              <p className="text-xs text-gray-400 text-center">*Defaults to next Mon–Sun</p>
              
              {/* Daily Reminder Time */}
              <div className="animate-in fade-in slide-in-from-bottom-2 duration-300 pt-2 border-t border-gray-100" style={{ animationDelay: '150ms' }}>
                <label className="block text-sm font-medium text-gray-700 mb-2 tracking-tight">
                  Remind me about my Will each day at:
                </label>
                <div className="flex items-center gap-3">
                  <Input 
                    type="time" 
                    value={dailyReminderTime}
                    onChange={(e) => {
                      setDailyReminderTime(e.target.value);
                      setHasModifiedReminder(true);
                    }}
                    step="900"
                    disabled={skipDailyReminder === true}
                    className={`w-32 text-sm ${skipDailyReminder ? 'opacity-50' : ''}`}
                    data-testid="input-daily-reminder-time"
                  />
                  <label className="flex items-center gap-2 text-sm text-gray-600 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={skipDailyReminder === true}
                      onChange={(e) => {
                        setSkipDailyReminder(e.target.checked);
                        setHasModifiedReminder(true);
                      }}
                      className="w-4 h-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                      data-testid="checkbox-skip-daily-reminder"
                    />
                    Skip daily reminders
                  </label>
                </div>
              </div>
              
              <div className="flex justify-between items-center pt-4 animate-in fade-in duration-500" style={{ animationDelay: '200ms' }}>
                <div className="flex items-center space-x-2">
                  <Button type="button" variant="ghost" onClick={handleCancel} className="text-gray-500" data-testid="button-cancel">
                    Cancel
                  </Button>
                  {showHelpIcon && (
                    <HelpIcon
                      onClick={() => setShowInstructionModal(true)}
                      size="sm"
                    />
                  )}
                </div>
                <PrimaryButton data-testid="button-next">
                  Next <ArrowRight className="w-4 h-4 ml-2" />
                </PrimaryButton>
              </div>
            </form>
          </SectionCard>
        )}
        
        {/* Step 2: What Will You Do - Focused Writing Experience */}
        {currentStep === 2 && !showTransition && (
          <div className="flex flex-col min-h-[60vh] animate-in fade-in duration-500">
            <form onSubmit={handleStep2Submit} className="flex flex-col flex-1">
              {/* Main Writing Area - Centered and Focused */}
              <div className="flex-1 flex flex-col justify-center py-8">
                {/* Prompt Label */}
                <div className="mb-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
                  <p className="text-sm font-medium text-gray-500 uppercase tracking-widest text-center">
                    Your Commitment
                  </p>
                </div>
                
                {/* The Writing Statement */}
                <div className="space-y-4 animate-in fade-in slide-in-from-bottom-3 duration-500" style={{ animationDelay: '100ms' }}>
                  {/* "I will" - Large, Prominent */}
                  <p className="text-2xl font-semibold text-gray-800 text-center tracking-tight">
                    I will
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
                      placeholder="call my grandmother this week"
                      data-testid="input-what"
                    />
                    {/* Subtle focus indicator line animation */}
                    <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-0 h-0.5 bg-gradient-to-r from-blue-400 to-indigo-500 transition-all duration-300 group-focus-within:w-full" />
                  </div>
                  
                  {/* Character count - Subtle, Right-aligned */}
                  <p className="text-xs text-gray-400 text-center tracking-tight animate-in fade-in duration-300" style={{ animationDelay: '200ms' }}>
                    {whatCharCount} / 75
                  </p>
                </div>
                
                {/* Inspirational hint - Only show when empty */}
                {willData.what.length === 0 && (
                  <div className="mt-8 text-center animate-in fade-in duration-700" style={{ animationDelay: '400ms' }}>
                    <p className="text-sm text-gray-400 italic">
                      What meaningful action will you take?
                    </p>
                  </div>
                )}
              </div>
              
              {/* Navigation - Fixed at bottom */}
              <div className="flex justify-between items-center pt-6 pb-2 border-t border-gray-100 animate-in fade-in slide-in-from-bottom-2 duration-300" style={{ animationDelay: '300ms' }}>
                <button 
                  type="button" 
                  onClick={() => setCurrentStep(1)}
                  className="text-gray-500 hover:text-gray-700 px-4 py-2 text-sm font-medium transition-colors duration-200 flex items-center"
                  data-testid="button-back"
                >
                  <ArrowLeft className="w-4 h-4 mr-2" />
                  Back
                </button>
                <PrimaryButton data-testid="button-next">
                  Next <ArrowRight className="w-4 h-4 ml-2" />
                </PrimaryButton>
              </div>
            </form>
          </div>
        )}
        
        {/* Step 3: Why */}
        {currentStep === 3 && !showTransition && (
          <SectionCard>
            {/* Will Statement Preview - Bordered Card with subtle tint */}
            {willData.what && (
              <div className="bg-gradient-to-br from-blue-50/60 to-indigo-50/40 rounded-xl p-4 mb-4 border border-blue-100/60">
                <div className="bg-white/90 rounded-lg border border-gray-200 px-5 py-4 shadow-sm">
                  <p className="text-center text-gray-800 text-lg font-medium italic leading-relaxed">
                    "I will {willData.what}"
                  </p>
                </div>
              </div>
            )}
            
            <form onSubmit={handleStep3Submit} className="space-y-4">
              <div>
                {/* Combined label with privacy note on single line - only show privacy note in circle mode */}
                <label className="flex items-center text-sm font-semibold text-gray-700 tracking-tight mb-2">
                  Your Why
                  {!isSoloMode && (
                    <span className="text-xs text-gray-400 font-normal ml-2 flex items-center">
                      <svg className="w-3 h-3 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                      </svg>
                      (Private — only you can see this)
                    </span>
                  )}
                </label>
                {/* Input container - matches Step 2 with "Because" inside like "I will" */}
                <div className="relative">
                  <div className="flex items-center bg-white border-2 border-gray-200 rounded-xl px-4 py-3.5 shadow-sm focus-within:border-blue-400 focus-within:ring-2 focus-within:ring-blue-100 transition-all duration-200 min-h-[52px]">
                    <span className="text-gray-800 font-semibold text-base mr-3 flex-shrink-0">Because</span>
                    <Textarea 
                      ref={whyRef}
                      name="why"
                      required 
                      rows={1} 
                      maxLength={75}
                      value={willData.why}
                      onChange={(e) => {
                        setWillData({ ...willData, why: e.target.value });
                        setWhyCharCount(e.target.value.length);
                        resizeTextarea(whyRef);
                      }}
                      placeholder="I like how I feel after I talk to her"
                      className="flex-1 border-none outline-none resize-none overflow-y-auto text-base leading-relaxed font-normal p-0 shadow-none focus:ring-0 bg-transparent placeholder:text-gray-400 transition-all flex items-center" 
                      style={{ maxHeight: '96px', minHeight: '24px' }}
                    />
                  </div>
                </div>
                <div className="text-xs text-gray-400 mt-2 text-right tracking-tight">{whyCharCount} / 75</div>
              </div>
              
              <div className="flex justify-between items-center">
                <button 
                  type="button" 
                  onClick={() => setCurrentStep(2)}
                  className="bg-white border border-gray-300 text-gray-700 px-4 py-2 rounded-lg text-sm font-medium hover:bg-gray-50 transition-colors duration-200 flex items-center"
                >
                  <ArrowLeft className="w-4 h-4 mr-2" />
                  Back
                </button>
                <PrimaryButton>
                  Next <ArrowRight className="w-4 h-4 ml-2" />
                </PrimaryButton>
              </div>
            </form>
          </SectionCard>
        )}
        
        {/* Step 4: Confirmation (Solo) or End Room Scheduling (Circle) */}
        {currentStep === 4 && !showTransition && (
          <>
            {isSoloMode ? (
              /* Solo Mode: Confirmation Screen */
              <SectionCard>
                <div className="space-y-5 px-4">
                  {/* Summary Card */}
                  <Card className="border border-purple-100 shadow-sm">
                    <CardContent className="pt-5 space-y-4">
                      {/* Timeline Section */}
                      <div>
                        <div className="flex items-center mb-2">
                          <Calendar className="w-4 h-4 text-purple-500 mr-2" />
                          <p className="text-sm font-medium text-gray-500">Timeline</p>
                        </div>
                        <div className="flex items-center gap-2 text-sm pl-6">
                          <span className="font-medium text-gray-900">{formatDateForDisplay(willData.startDate)}</span>
                          <ArrowRight className="w-4 h-4 text-gray-400" />
                          <span className="font-medium text-gray-900">{formatDateForDisplay(willData.endDate)}</span>
                        </div>
                        <p className="text-xs text-gray-500 mt-1 pl-6">
                          {getDurationText(willData.startDate, willData.endDate)}
                        </p>
                      </div>

                      {/* What Section */}
                      <div>
                        <div className="flex items-center mb-2">
                          <Target className="w-4 h-4 text-green-500 mr-2" />
                          <p className="text-sm font-medium text-gray-500">Your What</p>
                        </div>
                        <div className="pl-6 bg-green-50/50 rounded-lg p-3 border border-green-100">
                          <p className="text-base font-semibold text-gray-900 italic">
                            "I will {willData.what}"
                          </p>
                        </div>
                      </div>

                      {/* Why Section */}
                      <div>
                        <div className="flex items-center mb-2">
                          <Heart className="w-4 h-4 text-red-500 mr-2" />
                          <p className="text-sm font-medium text-gray-500">Your Why</p>
                        </div>
                        <div className="pl-6 bg-red-50/30 rounded-lg p-3 border border-red-100/50">
                          <p className="text-sm text-gray-700 italic">
                            Because {willData.why}
                          </p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>

                  {/* Action Buttons */}
                  <div className="flex gap-3 pt-2">
                    <button 
                      type="button" 
                      onClick={() => setCurrentStep(3)}
                      className="flex-1 px-4 py-3 bg-white border border-gray-300 text-gray-700 rounded-xl text-sm font-medium hover:bg-gray-50 transition-colors duration-200 flex items-center justify-center"
                      data-testid="button-back-to-edit"
                    >
                      <ArrowLeft className="w-4 h-4 mr-1.5" />
                      Edit
                    </button>
                    <button
                      type="button"
                      onClick={handleSoloConfirmSubmit}
                      disabled={createWillMutation.isPending || addCommitmentMutation.isPending}
                      className={`flex-1 px-4 py-3 rounded-xl text-sm font-medium transition-all duration-200 flex items-center justify-center ${
                        createWillMutation.isPending || addCommitmentMutation.isPending
                          ? 'bg-gray-200 text-gray-400 cursor-not-allowed'
                          : 'bg-gradient-to-r from-purple-500 to-indigo-500 text-white hover:from-purple-600 hover:to-indigo-600 shadow-sm'
                      }`}
                      data-testid="button-confirm-create"
                    >
                      {createWillMutation.isPending || addCommitmentMutation.isPending 
                        ? 'Creating...' 
                        : 'Create'}
                    </button>
                  </div>
                </div>
              </SectionCard>
            ) : (
              /* Circle Mode: End Room Scheduling */
              <SectionCard>
                <form onSubmit={handleStep4Submit} className="space-y-3">
                  {/* Skip button anchored in top-right corner - subtle secondary action */}
                  <div className="flex justify-end -mt-3 -mr-1 mb-0">
                    <button 
                      type="button" 
                      onClick={() => setShowSkipConfirmation(true)}
                      disabled={createWillMutation.isPending || addCommitmentMutation.isPending}
                      className="text-xs text-gray-400 hover:text-gray-600 px-2 py-1 rounded-md hover:bg-gray-50 transition-all duration-200 disabled:opacity-50"
                      data-testid="button-skip-endroom"
                    >
                      Skip
                    </button>
                  </div>
                  
                  {/* Header with Video Icon */}
                  <div className="px-4">
                    {/* Compact Video Icon */}
                    <div className="flex justify-center mb-2">
                      <div className="relative">
                        <div className="absolute inset-0 bg-gradient-to-r from-blue-400 to-indigo-500 rounded-full blur-md opacity-20 animate-pulse"></div>
                        <div className="relative w-10 h-10 bg-gradient-to-br from-blue-50 to-indigo-50 rounded-full border border-blue-100 flex items-center justify-center">
                          <Video className="w-5 h-5 text-blue-600" />
                        </div>
                      </div>
                    </div>
                    
                    <label className="block text-sm font-medium text-gray-700 mb-3 text-center">
                      Choose a time for a video call after your <em>Will</em> ends on{' '}
                      <span className="font-semibold text-gray-900">
                        {endDate ? new Date(`${endDate}T${endTime || '12:00'}`).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : ''}{' '}
                        at {endTime ? new Date(`${endDate}T${endTime}`).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }) : '12:00 PM'}
                      </span>
                    </label>
                    
                    {/* Input field */}
                    <div className="w-full max-w-md mx-auto">
                      <input
                        type="datetime-local"
                        name="endRoomDateTime"
                        min={willData.endDate}
                        max={willData.endDate ? new Date(new Date(willData.endDate).getTime() + 48 * 60 * 60 * 1000).toISOString().slice(0, 16) : undefined}
                        value={endRoomDateTime}
                        onChange={(e) => setEndRoomDateTime(e.target.value)}
                        className="w-full text-sm text-gray-900 bg-white border border-gray-200 rounded-xl p-3 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-300 transition-all duration-200"
                        data-testid="input-end-room-datetime"
                      />
                    </div>
                  </div>

                  {/* Info Box with slightly larger text */}
                  <div className="mx-4 bg-blue-50/50 border border-blue-100/50 rounded-lg p-3">
                    <ul className="space-y-1.5 text-sm text-gray-600">
                      <li className="flex items-start">
                        <span className="w-1.5 h-1.5 bg-blue-400 rounded-full mr-2 mt-1.5 flex-shrink-0"></span>
                        Virtual meeting link opens automatically at the time you choose.
                      </li>
                      <li className="flex items-start">
                        <span className="w-1.5 h-1.5 bg-blue-400 rounded-full mr-2 mt-1.5 flex-shrink-0"></span>
                        Runs for 30 minutes.
                      </li>
                      <li className="flex items-start">
                        <span className="w-1.5 h-1.5 bg-blue-400 rounded-full mr-2 mt-1.5 flex-shrink-0"></span>
                        Can't be changed once your Will starts.
                      </li>
                    </ul>
                  </div>

                  {/* Action Buttons - Compact row layout */}
                  <div className="px-4 pt-1">
                    <div className="flex gap-3">
                      {/* Back button - smaller, left side */}
                      <button 
                        type="button" 
                        onClick={() => setCurrentStep(3)}
                        className="px-3 py-2 bg-white border border-gray-300 text-gray-700 rounded-xl text-sm font-medium hover:bg-gray-50 transition-colors duration-200 flex items-center"
                        data-testid="button-back"
                      >
                        <ArrowLeft className="w-4 h-4 mr-1" />
                        Back
                      </button>
                  
                  {/* Primary CTA - tighter padding */}
                  <button
                    type="submit"
                    disabled={!endRoomDateTime || createWillMutation.isPending || addCommitmentMutation.isPending}
                    className={`px-5 py-2 rounded-xl text-sm font-medium flex items-center justify-center transition-all duration-200 ${
                      !endRoomDateTime || createWillMutation.isPending || addCommitmentMutation.isPending
                        ? 'bg-gray-200 text-gray-400 cursor-not-allowed'
                        : 'bg-brandGreen text-white hover:bg-green-600 shadow-sm'
                    }`}
                    data-testid="button-schedule-and-create"
                  >
                      {createWillMutation.isPending || addCommitmentMutation.isPending 
                        ? 'Creating...' 
                        : 'Create Will'}
                      <ArrowRight className="w-4 h-4 ml-1" />
                    </button>
                    </div>
                  </div>
                </form>
              </SectionCard>
            )}
          </>
        )}
        
        {/* Skip End Room Confirmation Modal */}
        {showSkipConfirmation && (
          <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-5 backdrop-blur-sm">
            <div className="bg-white rounded-2xl p-6 max-w-sm w-full shadow-2xl animate-in fade-in zoom-in-95 duration-200">
              {/* Modal Header */}
              <h3 className="text-lg font-semibold text-gray-900 mb-3 text-center">
                Are you sure you want to skip the End Room?
              </h3>
              
              {/* Modal Body */}
              <p className="text-sm text-gray-600 mb-6 text-center leading-relaxed">
                This is your circle's opportunity to gather and reflect at the end of your <em>Will</em>.
                <br /><br />
                You can still continue without setting one.
              </p>
              
              {/* Modal Actions */}
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
                    // Submit without End Room
                    const finalWillData = {
                      ...willData,
                      endRoomScheduledAt: null,
                      circleId: circle?.id,
                    };
                    createWillMutation.mutate({
                      title: finalWillData.what || "Group Goal",
                      description: finalWillData.why || "Group commitment",
                      startDate: finalWillData.startDate,
                      endDate: finalWillData.endDate,
                      endRoomScheduledAt: null,
                      circleId: finalWillData.circleId,
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