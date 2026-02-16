import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { useParams, useLocation } from "wouter";
import { useMutation, useQueryClient, useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { WillInstructionModal } from "@/components/WillInstructionModal";
import { MobileLayout, SectionCard, PrimaryButton, SectionTitle, ActionButton, UnifiedBackButton, InlineBackButton } from "@/components/ui/design-system";
import { HelpIcon } from "@/components/ui/HelpIcon";
import { notificationService } from "@/services/NotificationService";
import { HelpCircle, ArrowRight, CheckCircle, Heart, Calendar, Handshake, Clock } from "lucide-react";
import TimeChipPicker from "@/components/TimeChipPicker";

function formatTimeForDisplay(time: string): string {
  const [h, m] = time.split(':').map(Number);
  const period = h >= 12 ? 'PM' : 'AM';
  const displayHour = h === 0 ? 12 : h > 12 ? h - 12 : h;
  return `${displayHour}:${String(m).padStart(2, '0')} ${period}`;
}

export default function SubmitCommitment() {
  const { id } = useParams();
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [currentStep, setCurrentStep] = useState(1);
  const [showTransition, setShowTransition] = useState(false);
  const [what, setWhat] = useState("");
  const [why, setWhy] = useState("");
  const [whatCharCount, setWhatCharCount] = useState(0);
  const [whyCharCount, setWhyCharCount] = useState(0);
  const [showInstructionModal, setShowInstructionModal] = useState(false);
  const [showHelpIcon, setShowHelpIcon] = useState(false);
  
  const [checkInType, setCheckInType] = useState<'daily' | 'one-time'>('one-time');
  const [checkInTime, setCheckInTime] = useState<string>('19:00');
  
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

  const { data: will } = useQuery({
    queryKey: [`/api/wills/${id}/details`],
    enabled: !!id,
  });

  const { data: circle } = useQuery({
    queryKey: ['/api/circles/mine'],
  });

  const { data: user } = useQuery({
    queryKey: ['/api/user'],
  });
  
  const isCumulative = (will as any)?.willType === 'cumulative';
  const sharedWhat = (will as any)?.sharedWhat;

  const isShortDuration = useMemo(() => {
    const w = will as any;
    if (!w?.startDate || !w?.endDate || w?.isIndefinite) return false;
    const diffMs = new Date(w.endDate).getTime() - new Date(w.startDate).getTime();
    return diffMs <= 24 * 60 * 60 * 1000;
  }, [will]);
  
  // Initialize check-in time from will's check-in time if available
  useEffect(() => {
    if ((will as any)?.checkInTime) {
      setCheckInTime((will as any).checkInTime);
    }
  }, [will]);
  
  // Classic flow: 1-Timeline, 2-What, 3-Why, [4-CheckIn], [5-Confirm] (5 total, ladder shows 3)
  // Cumulative flow: 1-Timeline, 2-Why, [3-CheckIn], [4-Confirm] (4 total, ladder shows 2)
  const ladderSteps = isCumulative ? 2 : 3;

  useEffect(() => {
    const hasSeenInstruction = localStorage.getItem('willInstructionSeen');
    const hasSubmittedCommitment = localStorage.getItem('hasSubmittedCommitment');
    
    if (!hasSeenInstruction && !hasSubmittedCommitment) {
      setShowInstructionModal(true);
    }
    
    setShowHelpIcon(true);
  }, []);

  const commitmentMutation = useMutation({
    mutationFn: async (data: { what: string; why: string; checkInType?: string; checkInTime?: string }) => {
      const response = await apiRequest(`/api/wills/${id}/commitments`, {
        method: 'POST',
        body: JSON.stringify(data)
      });
      return response.json();
    },
    onSuccess: async () => {
      queryClient.invalidateQueries({ queryKey: [`/api/wills/${id}/details`] });
      queryClient.invalidateQueries({ queryKey: ['/api/wills/circle'] });
      queryClient.invalidateQueries({ queryKey: [`/api/wills/circle/${(circle as any)?.id}`] });
      queryClient.invalidateQueries({ queryKey: ['/api/circles/mine'] });
      
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

  const handleCheckInTimeSubmit = () => {
    setShowTransition(true);
    setTimeout(() => {
      setShowTransition(false);
      if (isCumulative) {
        setCurrentStep(4);
      } else {
        setCurrentStep(5);
      }
    }, 2500);
  };

  const handleFinalSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    const whatToSubmit = isCumulative ? (sharedWhat || what) : what.trim();
    const willCheckInType = (will as any)?.checkInType;
    commitmentMutation.mutate({ 
      what: whatToSubmit, 
      why: why.trim(),
      checkInType: isCumulative ? willCheckInType : checkInType,
      checkInTime: isShortDuration ? undefined : checkInTime,
    });
  };

  const handleBack = () => {
    if (currentStep === 1) {
      setLocation(`/will/${id}`);
    } else if (isCumulative) {
      if (currentStep === 2) setCurrentStep(1);
      else if (currentStep === 3) setCurrentStep(2);
      else if (currentStep === 4) setCurrentStep(isShortDuration ? 2 : 3);
      else setLocation(`/will/${id}`);
    } else {
      if (currentStep === 2) setCurrentStep(1);
      else if (currentStep === 3) setCurrentStep(2);
      else if (currentStep === 4) setCurrentStep(3);
      else if (currentStep === 5) setCurrentStep(isShortDuration ? 3 : 4);
      else setLocation(`/will/${id}`);
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
      const labels: Record<number, string> = { 1: 'When', 2: 'Why' };
      return labels[step] || '';
    } else {
      const labels: Record<number, string> = { 1: 'When', 2: 'What', 3: 'Why' };
      return labels[step] || '';
    }
  };

  const isWhyStep = (isCumulative && currentStep === 2) || (!isCumulative && currentStep === 3);
  const isCheckInStep = (isCumulative && currentStep === 3) || (!isCumulative && currentStep === 4);
  const isConfirmStep = (isCumulative && currentStep === 4) || (!isCumulative && currentStep === 5);

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
            
            {currentStep <= ladderSteps && (
              <div className="flex items-center justify-center space-x-2 min-w-0 flex-1">
                {Array.from({ length: ladderSteps }, (_, i) => i + 1).map((step) => (
                  <div key={step} className="flex items-center">
                    {step > 1 && (
                      <div className={`w-4 h-0.5 mr-1 ${currentStep >= step ? 'bg-brandBlue' : 'bg-gray-300'}`}></div>
                    )}
                    <div className={`w-7 h-7 ${currentStep >= step ? 'bg-brandBlue text-white' : 'bg-gray-300 text-gray-600'} rounded-full flex items-center justify-center text-xs font-semibold`}>
                      {step}
                    </div>
                    <span className={`ml-1 text-xs ${currentStep >= step ? 'text-brandBlue' : 'text-gray-600'} font-medium tracking-tight`}>
                      {getStepLabel(step)}
                    </span>
                  </div>
                ))}
              </div>
            )}
          
          <div className="text-center mt-16">
            <h1 className="text-xl font-semibold text-gray-900">
              {currentStep === 1 && "Proposed Will Timeline"}
              {currentStep === 2 && !isCumulative && "What would you like to do?"}
              {isWhyStep && "Why would you like to do this?"}
              {isCheckInStep && "Tracking"}
              {isConfirmStep && "Confirm Your Commitment"}
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
        </div>
      </div>

      <div className="flex-1 space-y-6">
        
        {showTransition && (
          <div className="flex items-center justify-center py-16">
            <div className="text-center space-y-6 animate-fade-in">
              <div className="w-16 h-16 mx-auto bg-brandBlue rounded-full flex items-center justify-center animate-pulse">
                <CheckCircle className="w-8 h-8 text-white" />
              </div>
              <p className="text-lg font-medium text-gray-900 animate-slide-up">
                One last step before you submit your commitment...
              </p>
            </div>
          </div>
        )}

        {/* Step 1: Proposed Will Timeline */}
        {currentStep === 1 && !showTransition && (
          <SectionCard>
            <form onSubmit={handleStep1Submit} className="space-y-6">
              <div className="space-y-6 mt-8">
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
                          <div className="text-sm text-gray-600 mb-3">Ongoing commitment</div>
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
        {currentStep === 2 && !showTransition && !isCumulative && (
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
        {isWhyStep && !showTransition && (
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

        {/* Check-In Time Step */}
        {isCheckInStep && !showTransition && (
          <div className="flex flex-col animate-in fade-in duration-500">
            <div className="flex flex-col flex-1">
              <div className="flex-1 flex flex-col py-6 px-4">
                <h2 className="text-base font-medium text-gray-700 text-center mb-2" data-testid="text-checkin-subtitle">
                  When should we check in with you?
                </h2>

                <div className="flex justify-center mt-6 animate-in fade-in slide-in-from-bottom-2 duration-400" style={{ animationDelay: '100ms' }}>
                  <TimeChipPicker
                    value={checkInTime}
                    onChange={setCheckInTime}
                    testId="input-check-in-time"
                  />
                </div>

                <p className="text-xs text-gray-400 text-center mt-5 animate-in fade-in duration-300" style={{ animationDelay: '200ms' }} data-testid="text-checkin-confirm">
                  {(will as any)?.isIndefinite && (will as any)?.activeDays && (will as any)?.activeDays !== 'every_day'
                    ? "We'll check in with you on your active days"
                    : "We'll check in with you daily at this time"}
                </p>
              </div>
              
              <div className="flex justify-between items-center pt-4 pb-2 border-t border-gray-100 animate-in fade-in slide-in-from-bottom-2 duration-300" style={{ animationDelay: '300ms' }}>
                <InlineBackButton 
                  onClick={handleBack}
                  testId="button-back-inline"
                  className="bg-white border border-gray-300 text-gray-700 px-4 py-2 rounded-lg text-sm font-medium hover:bg-gray-50 transition-colors duration-200 flex items-center"
                />
                <button
                  type="button"
                  onClick={handleCheckInTimeSubmit}
                  className="px-6 py-3 rounded-xl text-sm font-medium transition-all duration-200 flex items-center justify-center bg-gradient-to-r from-emerald-500 to-teal-500 text-white hover:from-emerald-600 hover:to-teal-600 shadow-sm"
                  data-testid="button-continue-checkin"
                >
                  Continue <ArrowRight className="w-4 h-4 ml-2" />
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Confirm Step: Cumulative */}
        {isConfirmStep && isCumulative && !showTransition && (
          <SectionCard>
            <form onSubmit={handleFinalSubmit} className="space-y-3">
              <div className="space-y-3 mt-2">
                <div className="text-center">
                  <div className="bg-gradient-to-br from-purple-50 to-indigo-50 rounded-xl p-4 border border-purple-200 shadow-sm mx-auto max-w-sm">
                    <div className="flex items-center justify-center mb-2">
                      <div className="w-10 h-10 bg-gradient-to-br from-purple-500 to-indigo-600 rounded-full flex items-center justify-center">
                        <Handshake className="w-5 h-5 text-white" />
                      </div>
                    </div>
                    <h3 className="text-base font-semibold text-gray-900 mb-2">Your Commitment</h3>
                    <div className="text-sm text-gray-800 leading-relaxed">
                      <div className="font-medium mb-2">
                        <span className="text-purple-600">We Will</span> {sharedWhat}
                      </div>
                      <div className="font-medium">
                        <span className="text-red-500">Because</span> <span className="text-xs text-gray-400">(Private)</span> {why}
                      </div>
                    </div>
                  </div>
                </div>
                
                {!isShortDuration && (
                <div className="pt-2 border-t border-gray-100">
                  <div className="flex items-center justify-center gap-2 mb-1">
                    <Clock className="w-3 h-3 text-amber-500" />
                    <p className="text-xs font-medium text-gray-500 uppercase tracking-widest">
                      Check-In Time
                    </p>
                  </div>
                  <p className="text-sm font-medium text-gray-700 text-center" data-testid="text-confirm-checkin-time">
                    {formatTimeForDisplay(checkInTime)}
                  </p>
                </div>
                )}
              </div>

              <div className="flex justify-between items-center pt-2">
                <InlineBackButton 
                  onClick={handleBack}
                  testId="button-back-inline"
                  className="bg-white border border-gray-300 text-gray-700 px-3 py-1.5 rounded-lg text-sm font-medium hover:bg-gray-50 transition-colors duration-200 flex items-center"
                />
                <button
                  type="submit"
                  disabled={commitmentMutation.isPending}
                  className="px-6 py-3 rounded-xl text-sm font-medium transition-all duration-200 flex items-center justify-center bg-gradient-to-r from-emerald-500 to-teal-500 text-white hover:from-emerald-600 hover:to-teal-600 shadow-sm disabled:opacity-50"
                  data-testid="button-submit-commitment"
                >
                  {commitmentMutation.isPending ? (
                    "Submitting..."
                  ) : (
                    <>
                      <Handshake className="w-4 h-4 mr-2" />
                      Let's do it
                    </>
                  )}
                </button>
              </div>
            </form>
          </SectionCard>
        )}

        {/* Confirm Step: Classic */}
        {isConfirmStep && !isCumulative && !showTransition && (
          <SectionCard>
            <form onSubmit={handleFinalSubmit} className="space-y-6">
              <div className="space-y-6 mt-4">
                <div className="text-center">
                  <div className="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-2xl p-5 border border-blue-200 shadow-sm mx-auto max-w-sm">
                    <h3 className="text-lg font-semibold text-gray-900 mb-3">Your Commitment</h3>
                    <div className="text-base text-gray-800 leading-relaxed">
                      <div className="font-medium mb-2">
                        <span className="text-blue-600">I Will</span> {what}
                      </div>
                      <div className="font-medium mb-1">
                        <span className="text-red-500">Because</span> <span className="text-xs text-gray-400">(Private)</span>
                      </div>
                      <div className="font-medium mb-2">
                        {why}
                      </div>
                    </div>
                    <div className="mt-3 pt-3 border-t border-blue-100">
                      <div className="flex items-center justify-center gap-2 text-sm text-gray-600">
                        {checkInType === 'daily' ? (
                          <>
                            <Calendar className="w-4 h-4 text-purple-500" />
                            <span>Daily check-ins</span>
                          </>
                        ) : (
                          <>
                            <CheckCircle className="w-4 h-4 text-green-500" />
                            <span>One-time check-in</span>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
                
                {(will as any)?.endRoomScheduledAt && (
                  <div className="text-center">
                    <div className="bg-gradient-to-br from-purple-50 to-indigo-50 rounded-2xl p-5 border border-purple-200 shadow-sm mx-auto max-w-sm">
                      <div className="flex items-center justify-center mb-2">
                        <div className="w-8 h-8 bg-gradient-to-br from-purple-500 to-indigo-600 rounded-full flex items-center justify-center">
                          <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                          </svg>
                        </div>
                      </div>
                      <h3 className="text-sm font-semibold text-gray-900 mb-2">End Room</h3>
                      <div className="text-sm text-gray-800">
                        {new Date((will as any).endRoomScheduledAt).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
                        {' at '}
                        {new Date((will as any).endRoomScheduledAt).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}
                      </div>
                    </div>
                  </div>
                )}
                
                {!isShortDuration && (
                <div className="pt-3 border-t border-gray-100">
                  <div className="flex items-center justify-center gap-2 mb-1">
                    <Clock className="w-3 h-3 text-amber-500" />
                    <p className="text-xs font-medium text-gray-500 uppercase tracking-widest">
                      Check-In Time
                    </p>
                  </div>
                  <p className="text-sm font-medium text-gray-700 text-center" data-testid="text-confirm-checkin-time-classic">
                    {formatTimeForDisplay(checkInTime)}
                  </p>
                </div>
                )}
              </div>

              <div className="flex justify-between items-center pt-2">
                <InlineBackButton 
                  onClick={handleBack}
                  testId="button-back-inline"
                  className="bg-white border border-gray-300 text-gray-700 px-3 py-1.5 rounded-lg text-sm font-medium hover:bg-gray-50 transition-colors duration-200 flex items-center"
                />
                <button
                  type="submit"
                  disabled={commitmentMutation.isPending}
                  className="px-6 py-3 rounded-xl text-sm font-medium transition-all duration-200 flex items-center justify-center bg-gradient-to-r from-emerald-500 to-teal-500 text-white hover:from-emerald-600 hover:to-teal-600 shadow-sm disabled:opacity-50"
                  data-testid="button-submit-commitment"
                >
                  {commitmentMutation.isPending ? (
                    "Submitting..."
                  ) : (
                    <>
                      <Handshake className="w-4 h-4 mr-2" />
                      Let's do it
                    </>
                  )}
                </button>
              </div>
            </form>
          </SectionCard>
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
