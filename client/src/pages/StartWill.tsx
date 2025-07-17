import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { createDateTimeFromInputs } from "@/lib/dateUtils";
import { WillInstructionModal } from "@/components/WillInstructionModal";
import { MobileLayout, SectionCard, PrimaryButton, SectionTitle, ActionButton } from "@/components/ui/design-system";
import { HelpIcon } from "@/components/ui/HelpIcon";
import { EndRoomTooltip } from "@/components/EndRoomTooltip";
import { ArrowLeft, ArrowRight, Calendar, Clock, Target, HelpCircle, CheckCircle, Heart } from "lucide-react";

// Helper function to calculate next Monday at 12:00 AM
function getNextMondayStart(): string {
  const now = new Date();
  const dayOfWeek = now.getDay(); // 0 = Sunday, 1 = Monday, etc.
  
  // Calculate days until next Monday
  let daysUntilMonday;
  if (dayOfWeek === 0) { // Sunday
    // If it's Sunday after 12:00 PM, use next Monday
    if (now.getHours() >= 12) {
      daysUntilMonday = 1;
    } else {
      daysUntilMonday = 1;
    }
  } else if (dayOfWeek === 1) { // Monday
    // If it's Monday, use next Monday (one week from today)
    daysUntilMonday = 7;
  } else {
    // Tuesday through Saturday
    daysUntilMonday = 8 - dayOfWeek;
  }
  
  const nextMonday = new Date(now);
  nextMonday.setDate(now.getDate() + daysUntilMonday);
  nextMonday.setHours(0, 0, 0, 0); // 12:00 AM
  
  return nextMonday.toISOString();
}

// Helper function to calculate the Sunday at 12:00 PM of the same week
function getWeekEndSunday(mondayStart: string): string {
  const monday = new Date(mondayStart);
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6); // Add 6 days to get to Sunday
  sunday.setHours(12, 0, 0, 0); // 12:00 PM
  
  return sunday.toISOString();
}

export default function StartWill() {
  const [, setLocation] = useLocation();
  const [currentStep, setCurrentStep] = useState(1);
  const [schedulingMode, setSchedulingMode] = useState('prescribed'); // 'prescribed' or 'custom'
  const [showTransition, setShowTransition] = useState(false);
  const [willData, setWillData] = useState({
    startDate: '',
    endDate: '',
    what: '',
    why: '',
    circleId: null as number | null,
    endRoomScheduledAt: '',
  });
  const [whatCharCount, setWhatCharCount] = useState(0);
  const [whyCharCount, setWhyCharCount] = useState(0);
  const [showInstructionModal, setShowInstructionModal] = useState(false);
  const [showHelpIcon, setShowHelpIcon] = useState(false);
  const [endRoomDateTime, setEndRoomDateTime] = useState('');
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: circle } = useQuery({
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
    onSuccess: (will) => {
      // Invalidate all related queries to ensure UI updates everywhere
      queryClient.invalidateQueries({ queryKey: ['/api/wills/circle'] });
      queryClient.invalidateQueries({ queryKey: ['/api/circles/mine'] });
      queryClient.invalidateQueries({ queryKey: [`/api/wills/circle/${circle?.id}`] });
      
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
    
    let startDateTime: string;
    let endDateTime: string;
    
    if (schedulingMode === 'prescribed') {
      // Use prescribed weekly schedule
      startDateTime = getNextMondayStart();
      endDateTime = getWeekEndSunday(startDateTime);
    } else {
      // Use custom dates from form
      const form = e.target as HTMLFormElement;
      const formData = new FormData(form);
      const startDate = formData.get('startDate') as string;
      const startTime = formData.get('startTime') as string;
      const endDate = formData.get('endDate') as string;
      const endTime = formData.get('endTime') as string;

      // Combine date and time using utility function
      startDateTime = createDateTimeFromInputs(startDate, startTime);
      endDateTime = createDateTimeFromInputs(endDate, endTime);

      // Validation for custom dates
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

    if (!endRoomDateTime) {
      toast({
        title: "Missing End Room Time",
        description: "Please select when your End Room will take place",
        variant: "destructive",
      });
      return;
    }

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
    const endRoomTimeUTC = new Date(endRoomDateTime).toISOString();
    
    const finalWillData = {
      ...willData,
      endRoomScheduledAt: endRoomTimeUTC,
      circleId: circle?.id,
    };

    // Create the will with End Room time
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
            {currentStep === 4 && <p className="text-sm text-gray-500 mt-1">This is where your circle comes together to reflect, share, and honor the effort.</p>}
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
            
            <form onSubmit={handleStep1Submit} className="space-y-4">
              {/* Scheduling Mode Selection */}
              <div className="space-y-4">
                <div>
                  <label className="block text-lg font-medium text-gray-900 mb-4 tracking-tight">
                    Choose a schedule template below
                  </label>
                  <RadioGroup value={schedulingMode} onValueChange={setSchedulingMode} className="space-y-4">
                    <label 
                      htmlFor="prescribed"
                      className={`block p-4 border-2 rounded-lg cursor-pointer transition-all ${
                        schedulingMode === 'prescribed' 
                          ? 'border-brandBlue bg-blue-50 ring-2 ring-blue-200' 
                          : 'border-gray-200 hover:bg-gray-50'
                      }`}
                    >
                      <RadioGroupItem value="prescribed" id="prescribed" className="sr-only" />
                      <div className="font-medium text-gray-900 mb-1 tracking-tight">📅 Week Template</div>
                      <div className="text-sm text-gray-600 tracking-tight">
                        Starts next Monday at 12:00 AM and ends Sunday at 12:00 PM
                      </div>
                    </label>
                    <label 
                      htmlFor="custom"
                      className={`block p-4 border-2 rounded-lg cursor-pointer transition-all ${
                        schedulingMode === 'custom' 
                          ? 'border-brandBlue bg-blue-50 ring-2 ring-blue-200' 
                          : 'border-gray-200 hover:bg-gray-50'
                      }`}
                    >
                      <RadioGroupItem value="custom" id="custom" className="sr-only" />
                      <div className="font-medium text-gray-900 mb-1 tracking-tight">⚙️ Custom</div>
                      <div className="text-sm text-gray-600 tracking-tight">
                        Pick your own start and end times.
                      </div>
                    </label>
                  </RadioGroup>
                </div>
              </div>

              {/* Prescribed Weekly Preview */}
              {schedulingMode === 'prescribed' && (
                <div className="bg-gray-50 rounded-xl p-4 border border-gray-200 mx-4">
                  <div>
                    <div className="font-medium text-gray-900 mb-1 tracking-tight">Selected Schedule</div>
                    <div className="text-sm text-gray-700 space-y-0.5 tracking-tight">
                      <div><strong>Start:</strong> {new Date(getNextMondayStart()).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })} at 12:00 AM</div>
                      <div><strong>End:</strong> {new Date(getWeekEndSunday(getNextMondayStart())).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })} at 12:00 PM</div>
                      <div className="mt-1 text-xs text-gray-600 tracking-tight">This is the schedule for your upcoming <em>Will</em>.</div>
                    </div>
                  </div>
                </div>
              )}

              {/* Custom Date Inputs */}
              {schedulingMode === 'custom' && (
                <div className="space-y-3 px-4">
                  <div className="space-y-3">
                    {/* Start Date & Time */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2 tracking-tight">Start</label>
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <Input 
                            type="date" 
                            name="startDate"
                            required 
                            className="w-full"
                          />
                          <div className="text-xs text-gray-400 mt-1">MM/DD/YYYY</div>
                        </div>
                        <div>
                          <Input 
                            type="time" 
                            name="startTime"
                            required 
                            className="w-full"
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
                            name="endDate"
                            required 
                            className="w-full"
                          />
                          <div className="text-xs text-gray-400 mt-1">MM/DD/YYYY</div>
                        </div>
                        <div>
                          <Input 
                            type="time" 
                            name="endTime"
                            required 
                            className="w-full"
                          />
                          <div className="text-xs text-gray-400 mt-1">HH:MM</div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}
              
              <div className="flex justify-between items-center px-4 pt-2">
                <div className="flex items-center space-x-2">
                  <Button type="button" variant="ghost" onClick={handleCancel}>
                    Cancel
                  </Button>
                  {showHelpIcon && (
                    <HelpIcon
                      onClick={() => setShowInstructionModal(true)}
                      size="sm"
                    />
                  )}
                </div>
                <PrimaryButton type="submit">
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
                <PrimaryButton type="submit">
                  Next <ArrowRight className="w-4 h-4 ml-2" />
                </PrimaryButton>
              </div>
            </form>
          </SectionCard>
        )}
        
        {/* Step 3: Why */}
        {currentStep === 3 && !showTransition && (
          <SectionCard>

            {/* Beautified What Preview */}
            {willData.what && (
              <div className="text-center italic text-lg px-4 py-3 border rounded-md shadow-sm text-gray-800 bg-white mb-3">
                "I will {willData.what}"
              </div>
            )}
            
            <form onSubmit={handleStep3Submit} className="space-y-3">
              <div>
                <div className="flex items-center justify-between mb-3">
                  <label className="block text-sm font-medium text-gray-700 tracking-tight">Your Why</label>
                  <span className="text-xs text-gray-500 flex items-center tracking-tight">
                    <svg className="w-3 h-3 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                    </svg>
                    Private - only you can see this
                  </span>
                </div>
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
                <PrimaryButton type="submit">
                  Next <ArrowRight className="w-4 h-4 ml-2" />
                </PrimaryButton>
              </div>
            </form>
          </SectionCard>
        )}
        
        {/* Step 4: End Room Scheduling - Special Ceremonial Step */}
        {currentStep === 4 && !showTransition && (
          <SectionCard>

            <form onSubmit={handleStep4Submit} className="space-y-3">
              <div className="px-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Choose a time to reflect after your <em>Will</em> ends on {willData.endDate ? new Date(willData.endDate).toLocaleDateString() : '7/20/2025'} (must be within 48 hours).
                </label>
                
                {/* Input field with proper mobile containment */}
                <div className="w-full max-w-md mx-auto">
                  <input
                    type="datetime-local"
                    name="endRoomDateTime"
                    required
                    min={willData.endDate}
                    max={willData.endDate ? new Date(new Date(willData.endDate).getTime() + 48 * 60 * 60 * 1000).toISOString().slice(0, 16) : undefined}
                    value={endRoomDateTime}
                    onChange={(e) => setEndRoomDateTime(e.target.value)}
                    className="w-full text-sm text-gray-900 bg-white border border-gray-200 rounded-xl p-3 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all duration-200"
                  />
                  <div className="text-xs text-gray-400 mt-1 text-center">MM/DD/YYYY HH:MM</div>
                </div>
              </div>

              {/* Warning Box - Compact */}
              <div className="bg-red-50 border border-red-300 rounded-xl p-3 mt-3 mx-4">
                <div className="mb-1 flex items-center">
                  <svg className="w-3 h-3 text-red-600 mr-1.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <span className="text-xs font-medium text-red-800">END ROOM:</span>
                </div>
                <ul className="space-y-0 text-xs text-red-600 break-words">
                  <li className="flex items-start">
                    <span className="w-1 h-1 bg-red-600 rounded-full mt-1.5 mr-1.5 flex-shrink-0"></span>
                    <span>Opens automatically at the scheduled date and runs for 30 minutes</span>
                  </li>
                  <li className="flex items-start">
                    <span className="w-1 h-1 bg-red-600 rounded-full mt-1.5 mr-1.5 flex-shrink-0"></span>
                    <span>Cannot be rescheduled once the <strong>Will</strong> is active</span>
                  </li>
                  <li className="flex items-start">
                    <span className="w-1 h-1 bg-red-600 rounded-full mt-1.5 mr-1.5 flex-shrink-0"></span>
                    <span>Closes automatically after 30 minutes expire — regardless of attendance</span>
                  </li>
                </ul>
              </div>

              <div className="border-t border-gray-200 pt-3 mt-3">
                <div className="flex justify-between items-center px-4">
                  <button 
                    type="button" 
                    onClick={() => setCurrentStep(3)}
                    className="bg-white border border-gray-300 text-gray-700 px-3 py-2 rounded-lg text-sm font-medium hover:bg-gray-50 transition-colors duration-200 flex items-center"
                  >
                    <ArrowLeft className="w-4 h-4 mr-1" />
                    Back
                  </button>
                  <button
                    type="submit"
                    disabled={createWillMutation.isPending || addCommitmentMutation.isPending || !endRoomDateTime}
                    className={`px-3 py-2 rounded-lg text-sm font-medium flex items-center transition-colors duration-200 ${
                      createWillMutation.isPending || addCommitmentMutation.isPending || !endRoomDateTime
                        ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                        : 'bg-brandGreen text-white hover:bg-green-600'
                    }`}
                  >
                    <span className="text-sm font-medium">
                      {createWillMutation.isPending || addCommitmentMutation.isPending ? 'Creating...' : 'Create Will'}
                    </span>
                    <ArrowRight className="w-4 h-4 ml-1" />
                  </button>
                </div>
              </div>
            </form>
          </SectionCard>
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