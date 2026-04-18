import { useState, useEffect, useRef, useCallback } from "react";
import { useParams, useLocation } from "wouter";
import { useMutation, useQueryClient, useQuery } from "@tanstack/react-query";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { WillInstructionModal } from "@/components/WillInstructionModal";
import { MobileLayout, SectionCard, UnifiedBackButton, InlineBackButton } from "@/components/ui/design-system";
import { HelpIcon } from "@/components/ui/HelpIcon";
import { ArrowRight, CheckCircle, Heart, Handshake, Clock, Calendar } from "lucide-react";
import NotificationsSetup, { type NotificationsData } from "@/components/NotificationsSetup";
import type { Will } from "@shared/schema";

function formatTimeForDisplay(time: string): string {
  const [h, m] = time.split(':').map(Number);
  const period = h >= 12 ? 'PM' : 'AM';
  const displayHour = h === 0 ? 12 : h > 12 ? h - 12 : h;
  return `${displayHour}:${String(m).padStart(2, '0')} ${period}`;
}

function formatDateRange(startStr: string, endStr: string | null, isIndefinite: boolean): string {
  const start = new Date(startStr);
  const year = start.getFullYear();
  const startPart = start.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  if (isIndefinite) return `${startPart}, ${year} · ongoing`;
  if (!endStr) return `${startPart}, ${year}`;
  const end = new Date(endStr);
  if (start.toDateString() === end.toDateString()) return `${startPart}, ${year}`;
  const endPart = end.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  const endYear = end.getFullYear();
  if (year === endYear) return `${startPart} – ${endPart}, ${year}`;
  return `${startPart}, ${year} – ${endPart}, ${endYear}`;
}

export default function SubmitCommitment() {
  const { id } = useParams();
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [currentStep, setCurrentStep] = useState(2);
  const [what, setWhat] = useState("");
  const [why, setWhy] = useState("");
  const [whatCharCount, setWhatCharCount] = useState(0);
  const [whyCharCount, setWhyCharCount] = useState(0);
  const [showInstructionModal, setShowInstructionModal] = useState(false);
  const [showHelpIcon, setShowHelpIcon] = useState(false);
  const [notificationsData, setNotificationsData] = useState<NotificationsData | null>(null);
  
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
  }, [what, resizeTextarea]);
  
  useEffect(() => {
    resizeTextarea(whyRef);
  }, [why, resizeTextarea]);

  const { data: will } = useQuery<Will>({
    queryKey: [`/api/wills/${id}/details`],
    enabled: !!id,
  });

  const { data: user } = useQuery({
    queryKey: ['/api/user'],
  });

  // Fetch team members so the confirm step can show who's in
  const { data: inviteData } = useQuery<{
    invite: any;
    will: any;
    teamMembers: Array<{ userId: string; firstName: string; isCreator: boolean; status: string; commitment: string | null }>;
  }>({
    queryKey: [`/api/wills/${id}/my-invite`],
    enabled: !!id,
  });
  
  const isCumulative = (will as any)?.willType === 'cumulative';
  const sharedWhat = (will as any)?.sharedWhat;

  // SubmitCommitment is exclusively for Team Will invitees — every participant
  // should always choose their own tracking preference regardless of duration.
  // Short-duration skipping only applies to solo will creation (StartWill.tsx).
  const isShortDuration = false;
  
  // Tracking is personal — each member chooses their own via NotificationsSetup.
  
  // Classic flow (I Will): 2-What, 3-Why, [4-CheckIn], [5-Confirm] (step 1 Timeline eliminated)
  // Cumulative flow (We Will): 2-Why, [3-CheckIn], [4-Confirm] (step 1 Timeline eliminated)
  // Ladder shows user-facing steps (1-indexed without the eliminated When step)
  const ladderSteps = isCumulative ? 1 : 2;

  useEffect(() => {
    const hasSeenInstruction = localStorage.getItem('willInstructionSeen');
    const hasSubmittedCommitment = localStorage.getItem('hasSubmittedCommitment');
    
    if (!hasSeenInstruction && !hasSubmittedCommitment) {
      setShowInstructionModal(true);
    }
    
    setShowHelpIcon(true);
  }, []);

  const commitmentMutation = useMutation({
    mutationFn: async (data: {
      what: string; why: string;
      checkInType?: string; checkInTime?: string; activeDays?: string; customDays?: string;
      commitmentCategory?: string; reminderTime?: string | null;
      milestones?: string | null; deadlineReminders?: string | null; missionReminderTime?: string | null;
    }) => {
      const response = await apiRequest(`/api/wills/${id}/commitments`, {
        method: 'POST',
        body: JSON.stringify(data)
      });
      return response.json();
    },
    onSuccess: async () => {
      queryClient.invalidateQueries({ queryKey: [`/api/wills/${id}/details`] });
      queryClient.invalidateQueries({ queryKey: ['/api/wills/all-active'] });
      queryClient.invalidateQueries({ queryKey: ['/api/my-wills'] });
      
      toast({
        title: "Commitment Submitted",
        description: "Your commitment has been successfully submitted",
      });
      setLocation(`/will/${id}`);
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
    if (isCumulative) {
      setWhat(sharedWhat || '');
      setCurrentStep(2);
    } else {
      setCurrentStep(2);
    }
  };

  const handleStep2Submit = (e: React.FormEvent) => {
    e.preventDefault();
    const form = e.target as HTMLFormElement;
    const formData = new FormData(form);
    const whatInput = formData.get('what') as string;

    if (!whatInput.trim()) {
      toast({
        title: "Empty Commitment",
        description: "Please describe what you will do",
        variant: "destructive",
      });
      return;
    }

    setWhat(whatInput.trim());
    setCurrentStep(3);
  };

  const handleStep3Submit = (e: React.FormEvent) => {
    e.preventDefault();
    const form = e.target as HTMLFormElement;
    const formData = new FormData(form);
    const whyInput = formData.get('why') as string;

    if (!whyInput.trim()) {
      toast({
        title: "Missing Motivation",
        description: "Please explain why this matters to you",
        variant: "destructive",
      });
      return;
    }

    setWhy(whyInput.trim());
    
    if (isCumulative) {
      setCurrentStep(isShortDuration ? 4 : 3);
    } else {
      setCurrentStep(isShortDuration ? 5 : 4);
    }
  };

  const handleNotificationsComplete = (data: NotificationsData) => {
    setNotificationsData(data);
    if (isCumulative) {
      setCurrentStep(4);
    } else {
      setCurrentStep(5);
    }
  };

  const handleFinalSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const whatToSubmit = isCumulative ? (sharedWhat || what) : what.trim();
    const nd = notificationsData;
    const effectiveCheckInType = nd?.checkInType || 'final_review';
    const submitData = {
      what: whatToSubmit,
      why: why.trim(),
      checkInType: effectiveCheckInType,
      checkInTime: (effectiveCheckInType === 'final_review') ? undefined : (nd?.checkInTime || undefined),
      activeDays: effectiveCheckInType === 'daily' ? 'every_day' : undefined,
      commitmentCategory: nd?.commitmentCategory,
      reminderTime: nd?.reminderTime,
      milestones: nd?.milestones ? JSON.stringify(nd.milestones) : null,
      deadlineReminders: nd?.deadlineReminders ? JSON.stringify(nd.deadlineReminders) : null,
      missionReminderTime: nd?.missionReminderTime,
    };
    commitmentMutation.mutate(submitData);
  };

  const handleBack = () => {
    if (isCumulative) {
      if (currentStep === 2) window.history.back();
      else if (currentStep === 3) setCurrentStep(2);
      else if (currentStep === 4) setCurrentStep(isShortDuration ? 2 : 3);
      else window.history.back();
    } else {
      if (currentStep === 2) window.history.back();
      else if (currentStep === 3) setCurrentStep(2);
      else if (currentStep === 4) setCurrentStep(3);
      else if (currentStep === 5) setCurrentStep(isShortDuration ? 3 : 4);
      else window.history.back();
    }
  };

  const handleModalStart = () => {
    localStorage.setItem('hasSubmittedCommitment', 'true');
  };

  const handleModalClose = () => {
    setShowInstructionModal(false);
  };

  const getStepLabel = (step: number): string => {
    if (isCumulative) {
      const labels: Record<number, string> = { 1: 'Why' };
      return labels[step] || '';
    } else {
      const labels: Record<number, string> = { 1: 'What', 2: 'Why' };
      return labels[step] || '';
    }
  };

  // Convert internal step (starting at 2) to visible step (starting at 1)
  const visibleStep = currentStep - 1;

  const isWhyStep = (isCumulative && currentStep === 2) || (!isCumulative && currentStep === 3);
  const isCheckInStep = (isCumulative && currentStep === 3) || (!isCumulative && currentStep === 4);
  const isConfirmStep = (isCumulative && currentStep === 4) || (!isCumulative && currentStep === 5);

  // Team members for confirm hero card — accepted only, sorted creator-first
  const allTeamMembers = inviteData?.teamMembers ?? [];
  const confirmedTeamMembers = [
    ...allTeamMembers.filter(m => m.isCreator),
    ...allTeamMembers.filter(m => !m.isCreator && m.status === 'accepted'),
  ];

  // Date range label for the commitment inset
  const dateRange = will
    ? formatDateRange((will as any).startDate, (will as any).endDate ?? null, (will as any).isIndefinite ?? false)
    : '';

  // Tracking summary label for confirm card
  const trackingLabel = !notificationsData
    ? 'Final review only'
    : notificationsData.checkInType === 'daily'
    ? `Every day${notificationsData.checkInTime ? ` at ${formatTimeForDisplay(notificationsData.checkInTime)}` : ''}`
    : notificationsData.checkInType === 'specific_days'
    ? 'Specific days'
    : 'Final review only';

  return (
    <div className="w-full max-w-screen-sm mx-auto overflow-x-hidden">
      <MobileLayout>
        <div className="sticky top-0 z-10 bg-white border-b border-gray-100 pb-4 mb-6 pt-[calc(env(safe-area-inset-top)+1rem)]">
          <div className="pt-4 space-y-3">
            <div className="relative flex items-center mb-2 min-h-[44px]">
              <UnifiedBackButton 
                onClick={handleBack}
                testId="button-back"
              />
              <span className="absolute left-0 right-0 text-center text-sm font-medium text-gray-500 pointer-events-none">Join Will</span>
              <div className="w-11 ml-auto"></div>
            </div>
            
            {visibleStep <= ladderSteps && (
              <div className="flex items-center justify-center space-x-2 min-w-0 flex-1">
                {Array.from({ length: ladderSteps }, (_, i) => i + 1).map((step) => (
                  <div key={step} className="flex items-center">
                    {step > 1 && (
                      <div className={`w-4 h-0.5 mr-1 ${visibleStep >= step ? 'bg-brandBlue' : 'bg-gray-300'}`}></div>
                    )}
                    <div className={`w-7 h-7 ${visibleStep >= step ? 'bg-brandBlue text-white' : 'bg-gray-300 text-gray-600'} rounded-full flex items-center justify-center text-xs font-semibold`}>
                      {step}
                    </div>
                    <span className={`ml-1 text-xs ${visibleStep >= step ? 'text-brandBlue' : 'text-gray-600'} font-medium tracking-tight`}>
                      {getStepLabel(step)}
                    </span>
                  </div>
                ))}
              </div>
            )}
          
          {!isConfirmStep && !isCheckInStep && (
          <div className="text-center mt-3">
            <h1 className="text-xl font-semibold text-gray-900">
              {currentStep === 2 && !isCumulative && "What would you like to do?"}
              {isWhyStep && "Why would you like to do this?"}
            </h1>
            {currentStep === 2 && !isCumulative && (
              <>
                <div className="flex justify-center my-3">
                  <div className="w-10 h-10 bg-green-500 rounded-full flex items-center justify-center">
                    <CheckCircle className="w-6 h-6 text-white" />
                  </div>
                </div>
                <p className="text-sm text-gray-500 mt-1">Cause it's as simple as wanting.</p>
              </>
            )}
            {isWhyStep && (
              <>
                <div className="flex justify-center my-3">
                  <div className="w-10 h-10 bg-red-500 rounded-full flex items-center justify-center">
                    <Heart className="w-6 h-6 text-white" />
                  </div>
                </div>
                <p className="text-sm text-gray-500 mt-1">Remember this when it gets tough.</p>
              </>
            )}
          </div>
          )}
        </div>
      </div>

      <div className="flex-1 space-y-6">
        
        {/* Step 1: Proposed Will Timeline */}
        {currentStep === 1 && (
          <SectionCard>
            <form onSubmit={handleStep1Submit} className="space-y-6">
              <div className="space-y-6 mt-8">
                {will?.title && (
                  <div className="text-center mb-2">
                    <p className="text-xs text-gray-400 uppercase tracking-wider mb-1">You're joining</p>
                    <p className="text-base font-semibold text-emerald-700 italic">"{will.title}"</p>
                  </div>
                )}
                <div className="text-center mb-6">
                  <div className="inline-flex items-center space-x-2 bg-blue-50 border border-blue-200 rounded-full px-4 py-2">
                    <div className="w-8 h-8 bg-blue-500 rounded-full flex items-center justify-center">
                      <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                      </svg>
                    </div>
                    <span className="text-sm font-medium text-blue-800">
                      {(will as any)?.creatorFirstName ? `${(will as any).creatorFirstName} ${(will as any).creatorLastName || ''}`.trim() : 'Loading...'} {isCumulative ? 'has proposed a shared commitment:' : 'has proposed the following:'}
                    </span>
                  </div>
                </div>

                <div className="text-center">
                  <div className="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-2xl p-8 border border-blue-200 shadow-sm mx-auto max-w-sm">
                    <div className="flex items-center justify-center mb-4">
                      <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-full flex items-center justify-center">
                        <Calendar className="w-6 h-6 text-white" />
                      </div>
                    </div>
                    <h3 className="text-lg font-semibold text-gray-900 mb-4">Will Schedule</h3>
                    <div className="text-base text-gray-800 leading-relaxed">
                      {(will as any)?.isIndefinite ? (
                        <>
                          <div className="font-medium mb-2">
                            Starts {new Date((will as any).startDate).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
                          </div>
                          <div className="text-sm text-gray-600 mb-3">
                            {(() => {
                              const ad = (will as any)?.activeDays;
                              if (!ad || ad === 'every_day') return 'Ongoing · Every day';
                              if (ad === 'weekdays') return 'Ongoing · Weekdays (Mon–Fri)';
                              if (ad === 'custom') {
                                try {
                                  const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
                                  const days: number[] = JSON.parse((will as any)?.customDays || '[]');
                                  return `Ongoing · ${days.sort((a, b) => a - b).map(d => dayNames[d]).join(', ')}`;
                                } catch { return 'Ongoing'; }
                              }
                              return 'Ongoing';
                            })()}
                          </div>
                        </>
                      ) : (will as any)?.startDate && (will as any)?.endDate ? (
                        <>
                          <div className="font-medium mb-1">
                            {new Date((will as any).startDate).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })},{' '}
                            {new Date((will as any).startDate).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}
                          </div>
                          <div className="text-sm text-gray-500 mb-1">to</div>
                          <div className="font-medium mb-3">
                            {new Date((will as any).endDate).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })},{' '}
                            {new Date((will as any).endDate).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}
                          </div>
                        </>
                      ) : (
                        <div className="mb-3">Loading...</div>
                      )}
                      {isCumulative && sharedWhat && (
                        <div className="mt-4 p-3 bg-purple-50 border border-purple-200 rounded-xl">
                          <p className="text-xs text-purple-600 font-medium mb-1">Team Commitment</p>
                          <p className="text-sm text-purple-900 font-semibold">{sharedWhat}</p>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              <div className="flex justify-between items-center">
                <InlineBackButton 
                  onClick={handleBack}
                  testId="button-back-inline"
                  className="bg-white border border-gray-300 text-gray-700 px-4 py-2 rounded-lg text-sm font-medium hover:bg-gray-50 transition-colors duration-200 flex items-center"
                />
                <button
                  type="submit"
                  className="px-6 py-3 rounded-xl text-sm font-medium transition-all duration-200 flex items-center justify-center bg-gradient-to-r from-emerald-500 to-teal-500 text-white hover:from-emerald-600 hover:to-teal-600 shadow-sm"
                  data-testid="button-join-will"
                >
                  Join Will <ArrowRight className="w-4 h-4 ml-2" />
                </button>
              </div>
            </form>
          </SectionCard>
        )}

        {/* Step 2: What - Classic wills only (Cumulative skips this) */}
        {currentStep === 2 && !isCumulative && (
          <div className="flex flex-col animate-in fade-in duration-500">
            <form onSubmit={handleStep2Submit} className="flex flex-col">
              <div className="flex flex-col pt-4 pb-6">
                <div className="space-y-4 animate-in fade-in slide-in-from-bottom-3 duration-500">
                  <p className="text-3xl font-bold text-gray-900 text-center tracking-tight">
                    I Will
                  </p>
                  
                  <div className="relative px-2">
                    <Textarea 
                      ref={whatRef}
                      name="what"
                      required 
                      rows={2} 
                      maxLength={75}
                      value={what}
                      onChange={(e) => {
                        const newValue = e.target.value;
                        if (newValue.length <= 75) {
                          setWhat(newValue);
                          setWhatCharCount(newValue.length);
                          resizeTextarea(whatRef);
                        }
                      }}
                      className="w-full text-center text-xl leading-relaxed font-normal text-gray-700 bg-transparent border-0 border-b-2 border-gray-200 focus:border-blue-400 focus:ring-0 resize-none transition-colors duration-300 placeholder:text-gray-300 placeholder:italic py-3 px-4" 
                      style={{ minHeight: '72px', maxHeight: '120px' }}
                      placeholder="call my grandmother this week"
                      autoFocus
                      data-testid="input-what"
                    />
                  </div>
                  
                  <p className="text-xs text-gray-400 text-center tracking-tight animate-in fade-in duration-300" style={{ animationDelay: '200ms' }}>
                    {whatCharCount} / 75
                  </p>
                </div>
              </div>
              
              <div className="flex justify-between items-center pt-4 pb-2 border-t border-gray-100 animate-in fade-in slide-in-from-bottom-2 duration-300" style={{ animationDelay: '300ms' }}>
                <div className="flex items-center space-x-2">
                  {showHelpIcon && (
                    <HelpIcon
                      onClick={() => setShowInstructionModal(true)}
                      size="sm"
                    />
                  )}
                </div>
                <button
                  type="submit"
                  disabled={!what.trim()}
                  className="px-6 py-3 rounded-xl text-sm font-medium transition-all duration-200 flex items-center justify-center bg-gradient-to-r from-emerald-500 to-teal-500 text-white hover:from-emerald-600 hover:to-teal-600 shadow-sm disabled:opacity-50"
                  data-testid="button-next"
                >
                  Next <ArrowRight className="w-4 h-4 ml-2" />
                </button>
              </div>
            </form>
          </div>
        )}

        {/* Why Step: Step 2 (Cumulative) or Step 3 (Classic) */}
        {isWhyStep && (
          <div className="flex flex-col animate-in fade-in duration-500">
            <form onSubmit={handleStep3Submit} className="flex flex-col">
              <div className="flex flex-col pt-4 pb-6">
                {(what || (isCumulative && sharedWhat)) && (
                  <div className="mb-6 text-center animate-in fade-in slide-in-from-bottom-2 duration-300">
                    {isCumulative ? (
                      <>
                        <p className="text-xs text-purple-600 font-medium mb-1">Team Commitment</p>
                        <p className="text-lg font-semibold text-gray-800">"{sharedWhat}"</p>
                      </>
                    ) : (
                      <p className="text-lg font-semibold text-gray-800">"I Will {what}"</p>
                    )}
                  </div>
                )}
                
                <div className="space-y-4 animate-in fade-in slide-in-from-bottom-3 duration-500" style={{ animationDelay: '100ms' }}>
                  <div className="text-center">
                    <p className="text-3xl font-bold text-gray-900 tracking-tight">
                      Because
                    </p>
                    <p className="text-xs text-gray-400 mt-1">(Private — only you can see this)</p>
                  </div>
                  
                  <div className="relative px-2">
                    <Textarea 
                      ref={whyRef}
                      name="why"
                      required 
                      rows={2} 
                      maxLength={75}
                      value={why}
                      onChange={(e) => {
                        const newValue = e.target.value;
                        if (newValue.length <= 75) {
                          setWhy(newValue);
                          setWhyCharCount(newValue.length);
                          resizeTextarea(whyRef);
                        }
                      }}
                      className="w-full text-center text-xl leading-relaxed font-normal text-gray-700 bg-transparent border-0 border-b-2 border-gray-200 focus:border-blue-400 focus:ring-0 resize-none transition-colors duration-300 placeholder:text-gray-300 placeholder:italic py-3 px-4" 
                      style={{ minHeight: '72px', maxHeight: '120px' }}
                      placeholder="I like how I feel after I talk to her"
                      autoFocus
                      data-testid="input-why"
                    />
                  </div>
                  
                  <p className="text-xs text-gray-400 text-center tracking-tight animate-in fade-in duration-300" style={{ animationDelay: '200ms' }}>
                    {whyCharCount} / 75
                  </p>
                </div>
              </div>
              
              <div className="flex justify-between items-center pt-4 pb-2 border-t border-gray-100 animate-in fade-in slide-in-from-bottom-2 duration-300" style={{ animationDelay: '300ms' }}>
                <div className="flex items-center space-x-2">
                  {showHelpIcon && (
                    <HelpIcon
                      onClick={() => setShowInstructionModal(true)}
                      size="sm"
                    />
                  )}
                </div>
                <button
                  type="submit"
                  disabled={!why.trim()}
                  className="px-6 py-3 rounded-xl text-sm font-medium transition-all duration-200 flex items-center justify-center bg-gradient-to-r from-emerald-500 to-teal-500 text-white hover:from-emerald-600 hover:to-teal-600 shadow-sm disabled:opacity-50"
                  data-testid="button-next"
                >
                  Next <ArrowRight className="w-4 h-4 ml-2" />
                </button>
              </div>
            </form>
          </div>
        )}

        {/* Check-In Tracking Step */}
        {isCheckInStep && (
          <NotificationsSetup
            what={isCumulative ? (sharedWhat || '') : what}
            because={why}
            onComplete={handleNotificationsComplete}
            onBack={handleBack}
          />
        )}

        {/* Confirm Step */}
        {isConfirmStep && (
          <form onSubmit={handleFinalSubmit} className="space-y-4">

            {/* Purple hero card */}
            <div className="rounded-2xl p-5 space-y-3" style={{ backgroundColor: '#7B3FC4' }}>

              {/* Will type header — no owner, just the type */}
              <div className="flex items-center gap-2">
                {isCumulative ? (
                  <svg viewBox="0 0 24 24" className="w-5 h-5 text-white opacity-80" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                    <circle cx="9" cy="7" r="4" />
                    <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
                    <path d="M16 3.13a4 4 0 0 1 0 7.75" />
                  </svg>
                ) : (
                  <svg viewBox="0 0 24 24" className="w-5 h-5 text-white opacity-80" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="12" cy="12" r="9" />
                    <circle cx="12" cy="12" r="4" />
                    <circle cx="12" cy="12" r="1" fill="currentColor" />
                  </svg>
                )}
                <span className="text-base font-bold text-white">{isCumulative ? 'We Will' : 'I Will'}</span>
              </div>

              {/* Commitment inset — text + date range */}
              <div className="rounded-xl p-4" style={{ backgroundColor: 'rgba(255,255,255,0.18)' }}>
                <p className="text-[10px] font-medium mb-1.5" style={{ color: 'rgba(255,255,255,0.65)' }}>
                  {isCumulative ? 'The commitment' : 'Your commitment'}
                </p>
                <p className="text-base font-bold italic text-white leading-snug">
                  "{isCumulative ? sharedWhat : what}"
                </p>
                {dateRange && (
                  <p className="text-xs mt-1.5" style={{ color: 'rgba(255,255,255,0.70)' }}>
                    {dateRange}
                  </p>
                )}
              </div>

              {/* Team inset — shown for We Will only */}
              {isCumulative && confirmedTeamMembers.length > 0 && (
                <div className="rounded-xl p-4" style={{ backgroundColor: 'rgba(255,255,255,0.18)' }}>
                  <p className="text-[10px] font-medium mb-2.5" style={{ color: 'rgba(255,255,255,0.65)' }}>
                    Team
                  </p>
                  <div className="space-y-2">
                    {confirmedTeamMembers.map(m => (
                      <div key={m.userId} className="flex items-center gap-2.5">
                        <div
                          className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-semibold text-white flex-shrink-0"
                          style={{ backgroundColor: 'rgba(255,255,255,0.25)' }}
                        >
                          {m.firstName.charAt(0).toUpperCase()}
                        </div>
                        <p className="text-sm font-medium text-white">
                          {m.firstName}{m.userId === (user as any)?.id ? ' (you)' : ''}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Your why — white card outside purple */}
            <div className="bg-white border border-gray-100 rounded-2xl px-5 py-4">
              <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-widest mb-1.5">
                Your why · private
              </p>
              <p className="text-sm italic text-gray-700 leading-snug">{why}</p>
            </div>

            {/* Notifications — white card outside purple (I Will only) */}
            {notificationsData?.commitmentCategory && !isCumulative && (
              <div className="bg-white border border-gray-100 rounded-2xl px-5 py-4 flex items-center gap-3">
                <div className="w-9 h-9 rounded-full bg-purple-50 flex items-center justify-center flex-shrink-0 border border-purple-100">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ width: 20, height: 20, color: '#7B3FC4' }}>
                    <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
                    <path d="M13.73 21a2 2 0 0 1-3.46 0" />
                  </svg>
                </div>
                <div>
                  <p className="text-[10px] font-medium text-gray-400 uppercase tracking-widest leading-none mb-0.5">Notifications</p>
                  <p className="text-sm font-semibold text-gray-800" data-testid="text-confirm-notifications">
                    {notificationsData.commitmentCategory === 'habit' ? 'Habit' : notificationsData.commitmentCategory === 'abstain' ? 'Abstain' : 'Mission'}
                  </p>
                </div>
              </div>
            )}

            {/* Primary CTA */}
            <button
              type="submit"
              disabled={commitmentMutation.isPending}
              className="w-full py-4 rounded-2xl text-base font-bold text-white flex items-center justify-center gap-2 transition-all duration-200 disabled:opacity-50"
              style={{ backgroundColor: '#2D9D78' }}
              data-testid="button-submit-commitment"
            >
              {commitmentMutation.isPending ? (
                "Joining..."
              ) : (
                <>
                  <Handshake className="w-5 h-5" />
                  I'm in. Let's do it
                </>
              )}
            </button>

            {/* Secondary go-back */}
            <button
              type="button"
              onClick={handleBack}
              className="w-full py-3.5 rounded-2xl text-sm font-medium text-gray-600 bg-white border border-gray-200 hover:bg-gray-50 transition-colors duration-200"
              data-testid="button-go-back-confirm"
            >
              Go back
            </button>

          </form>
        )}

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
