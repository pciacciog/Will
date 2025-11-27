import { useState, useEffect } from "react";
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

export default function StartWill() {
  const [, setLocation] = useLocation();
  const [currentStep, setCurrentStep] = useState(1);
  const [showTransition, setShowTransition] = useState(false);
  
  // Initialize date/time defaults once on mount
  const [startDate, setStartDate] = useState(() => getNextMondayDate());
  const [startTime, setStartTime] = useState('00:00');
  const [endDate, setEndDate] = useState(() => getFollowingSundayDate(getNextMondayDate()));
  const [endTime, setEndTime] = useState('12:00');
  
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
  const { toast } = useToast();
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

  const createWillMutation = useMutation({
    mutationFn: async (data: any) => {
      const response = await apiRequest('/api/wills', {
        method: 'POST',
        body: JSON.stringify(data)
      });
      return response.json();
    },
    onSuccess: async (will) => {
      // Invalidate all related queries to ensure UI updates everywhere
      queryClient.invalidateQueries({ queryKey: ['/api/wills/circle'] });
      queryClient.invalidateQueries({ queryKey: ['/api/circles/mine'] });
      queryClient.invalidateQueries({ queryKey: [`/api/wills/circle/${circle?.id}`] });
      
      // Send notification about WILL proposal to other members
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
      // Invalidate all related queries to ensure UI updates everywhere
      queryClient.invalidateQueries({ queryKey: ['/api/wills/circle'] });
      queryClient.invalidateQueries({ queryKey: ['/api/circles/mine'] });
      queryClient.invalidateQueries({ queryKey: [`/api/wills/circle/${circle?.id}`] });
      
      toast({
        title: "Will Created!",
        description: "Will has been created and is pending review from other members.",
      });
      setLocation('/hub');
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

    // Update will data and show transition
    setWillData({
      ...willData,
      why: why.trim(),
      circleId: circle?.id,
    });
    
    // Show transition animation
    setShowTransition(true);
    
    // After 3.5 seconds, move to End Room scheduling step
    setTimeout(() => {
      setShowTransition(false);
      setCurrentStep(4);
    }, 3500);
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
    setLocation('/hub');
  };

  const handleModalStart = () => {
    // Mark that user has started creating a will
    localStorage.setItem('hasCreatedWill', 'true');
  };

  const handleModalClose = () => {
    setShowInstructionModal(false);
  };

  if (!circle) {
    return (
      <div className="min-h-screen pt-16 flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">No Circle Found</h2>
          <p className="text-gray-600 mb-6">You need to be part of an Inner Circle to create a Will.</p>
          <Button onClick={() => setLocation('/inner-circle')}>
            Create or Join Circle
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full max-w-screen-sm mx-auto overflow-x-hidden">
      <MobileLayout>
        {/* Sticky Header with Progress Indicator */}
        <div className="sticky top-0 z-10 bg-white border-b border-gray-100 pb-4 mb-6 pt-[calc(env(safe-area-inset-top)+1rem)]">
          <div className="pt-4 space-y-3">
            <div className="flex items-center justify-center space-x-2 min-w-0 flex-1">
              <div className="flex items-center">
                <div className={`w-8 h-8 ${currentStep >= 1 ? 'bg-brandBlue text-white' : 'bg-gray-300 text-gray-600'} rounded-full flex items-center justify-center text-sm font-semibold`}>
                  1
                </div>
                <span className={`ml-1 text-sm ${currentStep >= 1 ? 'text-brandBlue' : 'text-gray-600'} font-medium tracking-tight`}>When</span>
              </div>
              <div className={`w-6 h-0.5 ${currentStep >= 2 ? 'bg-brandBlue' : 'bg-gray-300'}`}></div>
              <div className="flex items-center">
                <div className={`w-8 h-8 ${currentStep >= 2 ? 'bg-brandBlue text-white' : 'bg-gray-300 text-gray-600'} rounded-full flex items-center justify-center text-sm font-semibold`}>
                  2
                </div>
                <span className={`ml-1 text-sm ${currentStep >= 2 ? 'text-brandBlue' : 'text-gray-600'} font-medium tracking-tight`}>What</span>
              </div>
              <div className={`w-6 h-0.5 ${currentStep >= 3 ? 'bg-brandBlue' : 'bg-gray-300'}`}></div>
              <div className="flex items-center">
                <div className={`w-8 h-8 ${currentStep >= 3 ? 'bg-brandBlue text-white' : 'bg-gray-300 text-gray-600'} rounded-full flex items-center justify-center text-sm font-semibold`}>
                  3
                </div>
                <span className={`ml-1 text-sm ${currentStep >= 3 ? 'text-brandBlue' : 'text-gray-600'} font-medium tracking-tight`}>Why</span>
              </div>
            </div>
          
          {/* Current Step Title */}
          <div className="text-center mt-16">
            <h1 className="text-xl font-semibold text-gray-900">
              {currentStep === 1 && "Set Your Timeline"}
              {currentStep === 2 && "What would you like to do?"}
              {currentStep === 3 && "Why would you like to do this?"}
              {currentStep === 4 && "Schedule Your End Room"}
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
            {currentStep === 4 && <p className="text-sm text-gray-500 mt-1">An opportunity for your circle to gather, reflect, share, and honor the effort.</p>}
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
            
            <form onSubmit={handleStep1Submit} className="space-y-6 px-4">
              {/* Start Date & Time */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2 tracking-tight">Start</label>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <Input 
                      type="date" 
                      value={startDate}
                      onChange={(e) => setStartDate(e.target.value)}
                      required 
                      className="w-full"
                      data-testid="input-start-date"
                    />
                    <div className="text-xs text-gray-400 mt-1">MM/DD/YYYY</div>
                  </div>
                  <div>
                    <Input 
                      type="time" 
                      value={startTime}
                      onChange={(e) => setStartTime(e.target.value)}
                      required 
                      className="w-full"
                      data-testid="input-start-time"
                    />
                    <div className="text-xs text-gray-400 mt-1">HH:MM</div>
                  </div>
                </div>
              </div>
              
              {/* End Date & Time */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2 tracking-tight">End</label>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <Input 
                      type="date" 
                      value={endDate}
                      onChange={(e) => setEndDate(e.target.value)}
                      required 
                      className="w-full"
                      data-testid="input-end-date"
                    />
                    <div className="text-xs text-gray-400 mt-1">MM/DD/YYYY</div>
                  </div>
                  <div>
                    <Input 
                      type="time" 
                      value={endTime}
                      onChange={(e) => setEndTime(e.target.value)}
                      required 
                      className="w-full"
                      data-testid="input-end-time"
                    />
                    <div className="text-xs text-gray-400 mt-1">HH:MM</div>
                  </div>
                </div>
              </div>
              
              <div className="flex justify-between items-center pt-4">
                <div className="flex items-center space-x-2">
                  <Button type="button" variant="ghost" onClick={handleCancel} data-testid="button-cancel">
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
        
        {/* Step 2: What Will You Do */}
        {currentStep === 2 && !showTransition && (
          <SectionCard>
            
            <form onSubmit={handleStep2Submit} className="space-y-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-3 tracking-tight">Your Want</label>
                <div className="relative">
                  <div className="flex items-start bg-white border border-gray-200 rounded-xl p-4 focus-within:outline-none focus-within:ring-2 focus-within:ring-blue-500 transition-all duration-200">
                    <span className="text-gray-900 font-medium text-base mr-3 mt-1 flex-shrink-0">I will</span>
                    <Textarea 
                      name="what"
                      required 
                      rows={2} 
                      maxLength={75}
                      value={willData.what}
                      onChange={(e) => {
                        setWillData({ ...willData, what: e.target.value });
                        setWhatCharCount(e.target.value.length);
                      }}
                      className="flex-1 border-none outline-none resize-none text-base leading-relaxed font-normal p-0 shadow-none focus:ring-0 bg-transparent placeholder:text-gray-400" 
                      placeholder="call my grandmother this week"
                    />
                  </div>
                </div>
                <div className="text-xs text-gray-500 mt-2 text-right tracking-tight">{whatCharCount} / 75</div>
              </div>
              
              <div className="flex justify-between items-center">
                <button 
                  type="button" 
                  onClick={() => setCurrentStep(1)}
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
        
        {/* Step 3: Why */}
        {currentStep === 3 && !showTransition && (
          <SectionCard>
            {/* Will Statement Preview - Grounded Card */}
            {willData.what && (
              <div className="bg-gray-50 rounded-xl px-5 py-4 mb-4">
                <p className="text-center text-gray-800 text-lg font-medium italic leading-relaxed">
                  "I will {willData.what}"
                </p>
              </div>
            )}
            
            <form onSubmit={handleStep3Submit} className="space-y-3">
              <div>
                {/* Header with label and privacy note - matches Step 2 styling */}
                <div className="flex items-center justify-between mb-3">
                  <label className="block text-sm font-medium text-gray-700 tracking-tight">Your Why</label>
                  <span className="text-xs text-gray-500 flex items-center tracking-tight">
                    <svg className="w-3 h-3 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                    </svg>
                    Private - only you can see this
                  </span>
                </div>
                {/* Input container - matches Step 2 with "Because" inside like "I will" */}
                <div className="relative">
                  <div className="flex items-start bg-white border border-gray-200 rounded-xl p-4 focus-within:outline-none focus-within:ring-2 focus-within:ring-blue-500 transition-all duration-200">
                    <span className="text-gray-900 font-medium text-base mr-3 mt-1 flex-shrink-0">Because</span>
                    <Textarea 
                      name="why"
                      required 
                      rows={2} 
                      maxLength={75}
                      value={willData.why}
                      onChange={(e) => {
                        setWillData({ ...willData, why: e.target.value });
                        setWhyCharCount(e.target.value.length);
                      }}
                      placeholder="I like how I feel after I talk to her"
                      className="flex-1 border-none outline-none resize-none text-base leading-relaxed font-normal p-0 shadow-none focus:ring-0 bg-transparent placeholder:text-gray-400" 
                    />
                  </div>
                </div>
                <div className="text-xs text-gray-500 mt-2 text-right tracking-tight">{whyCharCount} / 75</div>
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
        
        {/* Step 4: End Room Scheduling */}
        {currentStep === 4 && !showTransition && (
          <SectionCard>
            <form onSubmit={handleStep4Submit} className="space-y-5">
              {/* Decorative Video Icon with gentle animation */}
              <div className="flex justify-center mb-2">
                <div className="relative">
                  <div className="absolute inset-0 bg-gradient-to-r from-blue-400 to-indigo-500 rounded-full blur-lg opacity-30 animate-pulse"></div>
                  <div className="relative w-14 h-14 bg-gradient-to-br from-blue-50 to-indigo-50 rounded-full border-2 border-blue-100 flex items-center justify-center shadow-md">
                    <Video className="w-6 h-6 text-blue-600" />
                  </div>
                </div>
              </div>

              {/* Header with instruction */}
              <div className="px-4 animate-in fade-in slide-in-from-bottom-2 duration-300">
                <label className="block text-sm font-medium text-gray-700 mb-3 text-center">
                  Choose a time to set up a video call after your <em>Will</em> ends on {willData.endDate ? new Date(willData.endDate).toLocaleDateString() : '7/20/2025'}
                </label>
                
                {/* Input field with proper mobile containment */}
                <div className="w-full max-w-md mx-auto">
                  <input
                    type="datetime-local"
                    name="endRoomDateTime"
                    min={willData.endDate}
                    max={willData.endDate ? new Date(new Date(willData.endDate).getTime() + 48 * 60 * 60 * 1000).toISOString().slice(0, 16) : undefined}
                    value={endRoomDateTime}
                    onChange={(e) => setEndRoomDateTime(e.target.value)}
                    className="w-full text-sm text-gray-900 bg-white border border-gray-200 rounded-xl p-3.5 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-300 transition-all duration-200 hover:border-gray-300"
                    data-testid="input-end-room-datetime"
                  />
                  <div className="text-xs text-gray-400 mt-1.5 text-center">MM/DD/YYYY HH:MM</div>
                </div>
              </div>

              {/* Info Box - with subtle gradient and animation */}
              <div className="relative mx-4 animate-in fade-in slide-in-from-bottom-3 duration-500 delay-100">
                <div className="absolute inset-0 bg-gradient-to-br from-blue-50/50 to-indigo-50/50 rounded-xl"></div>
                <div className="relative bg-white/80 backdrop-blur-sm border border-blue-100/50 rounded-xl p-4 shadow-sm">
                  <div className="mb-2.5 flex items-center">
                    <div className="w-6 h-6 bg-blue-100 rounded-full flex items-center justify-center mr-2">
                      <svg className="w-3.5 h-3.5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                    </div>
                    <span className="text-sm font-medium text-gray-700">How the End Room works</span>
                  </div>
                  <ul className="space-y-2.5 text-sm text-gray-600 ml-1">
                    <li className="flex items-start animate-in fade-in slide-in-from-left-2 duration-300" style={{ animationDelay: '150ms' }}>
                      <span className="w-1.5 h-1.5 bg-blue-400 rounded-full mt-1.5 mr-2.5 flex-shrink-0"></span>
                      <span>It will open automatically at the time you choose</span>
                    </li>
                    <li className="flex items-start animate-in fade-in slide-in-from-left-2 duration-300" style={{ animationDelay: '250ms' }}>
                      <span className="w-1.5 h-1.5 bg-blue-400 rounded-full mt-1.5 mr-2.5 flex-shrink-0"></span>
                      <span>It runs for 30 minutes</span>
                    </li>
                    <li className="flex items-start animate-in fade-in slide-in-from-left-2 duration-300" style={{ animationDelay: '350ms' }}>
                      <span className="w-1.5 h-1.5 bg-blue-400 rounded-full mt-1.5 mr-2.5 flex-shrink-0"></span>
                      <span>Once your <em>Will</em> starts, the time can't be changed</span>
                    </li>
                  </ul>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="border-t border-gray-100 pt-5 mt-2">
                <div className="flex flex-col space-y-3 px-4">
                  {/* Primary CTA - DISABLED when no date/time entered */}
                  <button
                    type="submit"
                    disabled={!endRoomDateTime || createWillMutation.isPending || addCommitmentMutation.isPending}
                    className={`w-full px-4 py-3.5 rounded-xl text-sm font-medium flex items-center justify-center transition-all duration-200 ${
                      !endRoomDateTime || createWillMutation.isPending || addCommitmentMutation.isPending
                        ? 'bg-gray-200 text-gray-400 cursor-not-allowed'
                        : 'bg-brandGreen text-white hover:bg-green-600 shadow-sm hover:shadow-md'
                    }`}
                    data-testid="button-schedule-and-create"
                  >
                    <span className="text-sm font-medium">
                      {createWillMutation.isPending || addCommitmentMutation.isPending 
                        ? 'Creating...' 
                        : 'Create Will'}
                    </span>
                    <ArrowRight className="w-4 h-4 ml-2" />
                  </button>

                  {/* Skip End Room - explicit action with confirmation */}
                  <button 
                    type="button" 
                    onClick={() => setShowSkipConfirmation(true)}
                    disabled={createWillMutation.isPending || addCommitmentMutation.isPending}
                    className="w-full text-center text-gray-500 text-sm font-medium py-2 hover:text-gray-700 transition-colors duration-200 disabled:opacity-50"
                    data-testid="button-skip-endroom"
                  >
                    Skip End Room
                  </button>

                  {/* Back button */}
                  <button 
                    type="button" 
                    onClick={() => setCurrentStep(3)}
                    className="w-full bg-white border border-gray-300 text-gray-700 px-4 py-2.5 rounded-xl text-sm font-medium hover:bg-gray-50 transition-colors duration-200 flex items-center justify-center"
                    data-testid="button-back"
                  >
                    <ArrowLeft className="w-4 h-4 mr-2" />
                    Back
                  </button>
                </div>
              </div>
            </form>
          </SectionCard>
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