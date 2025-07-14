import { useState, useEffect } from "react";
import { useParams, useLocation } from "wouter";
import { useMutation, useQueryClient, useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { WillInstructionModal } from "@/components/WillInstructionModal";
import { MobileLayout, SectionCard, PrimaryButton, SectionTitle, ActionButton } from "@/components/ui/design-system";
import { HelpIcon } from "@/components/ui/HelpIcon";
import { HelpCircle, ArrowLeft, ArrowRight, CheckCircle, Heart, Calendar, Handshake } from "lucide-react";

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

  const { data: will } = useQuery({
    queryKey: [`/api/wills/${id}/details`],
    enabled: !!id,
  });

  const { data: circle } = useQuery({
    queryKey: ['/api/circles/mine'],
  });

  // Check if user should see instruction modal for first-time submission
  useEffect(() => {
    const hasSeenInstruction = localStorage.getItem('willInstructionSeen');
    const hasSubmittedCommitment = localStorage.getItem('hasSubmittedCommitment');
    
    if (!hasSeenInstruction && !hasSubmittedCommitment) {
      setShowInstructionModal(true);
    }
    
    // Always show help icon once the component is loaded
    setShowHelpIcon(true);
  }, []);

  const commitmentMutation = useMutation({
    mutationFn: async (data: { what: string; why: string }) => {
      const response = await apiRequest(`/api/wills/${id}/commitments`, {
        method: 'POST',
        body: JSON.stringify(data)
      });
      return response.json();
    },
    onSuccess: () => {
      // Invalidate all related queries to ensure UI updates everywhere
      queryClient.invalidateQueries({ queryKey: [`/api/wills/${id}/details`] });
      queryClient.invalidateQueries({ queryKey: ['/api/wills/circle'] });
      queryClient.invalidateQueries({ queryKey: [`/api/wills/circle/${circle?.id}`] });
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
    setCurrentStep(2);
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
    
    // Show transition animation
    setShowTransition(true);
    
    // After 3.5 seconds, move to End Room acceptance step
    setTimeout(() => {
      setShowTransition(false);
      setCurrentStep(4);
    }, 3500);
  };

  const handleStep4Submit = (e: React.FormEvent) => {
    e.preventDefault();
    commitmentMutation.mutate({ what: what.trim(), why: why.trim() });
  };

  const handleBack = () => {
    if (currentStep === 2) {
      setCurrentStep(1);
    } else if (currentStep === 3) {
      setCurrentStep(2);
    } else if (currentStep === 4) {
      setCurrentStep(3);
    } else {
      setLocation(`/will/${id}`);
    }
  };

  const handleModalStart = () => {
    // Mark that user has started submitting a commitment
    localStorage.setItem('hasSubmittedCommitment', 'true');
  };

  const handleModalClose = () => {
    setShowInstructionModal(false);
  };

  return (
    <div className="w-full max-w-screen-sm mx-auto overflow-x-hidden">
      <MobileLayout>
        {/* Sticky Header with Progress Indicator */}
        <div className="sticky top-0 z-10 bg-white border-b border-gray-100 pb-4 mb-6">
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
              {currentStep === 1 && "Proposed Will Timeline"}
              {currentStep === 2 && "What would you like to do?"}
              {currentStep === 3 && "Why would you like to do this?"}
              {currentStep === 4 && "End Room Confirmation"}
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
            {currentStep === 4 && <p className="text-sm text-gray-500 mt-1">Your circle will gather here to reflect, share, and honor the efforts.</p>}
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
                <div className="text-center">
                  <div className="bg-gray-50 rounded-xl p-6 border border-gray-200 mx-auto max-w-md">
                    <div className="flex items-center justify-center mb-3">
                      <Calendar className="w-5 h-5 text-gray-600 mr-2" />
                      <div className="font-medium text-gray-900 tracking-tight">Schedule</div>
                    </div>
                    <div className="text-sm text-gray-700 tracking-tight">
                      <div className="font-medium">
                        {will?.startDate && will?.endDate ? (
                          <>
                            {new Date(will.startDate).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })} from{' '}
                            {new Date(will.startDate).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })} to{' '}
                            {new Date(will.endDate).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}
                          </>
                        ) : (
                          'Loading...'
                        )}
                      </div>
                      <div className="mt-2 text-xs text-gray-600 tracking-tight">This is the schedule for the <em>Will</em> you're joining.</div>
                    </div>
                  </div>
                </div>
              </div>

              <div className="flex justify-between items-center">
                <button 
                  type="button"
                  onClick={handleBack}
                  className="bg-white border border-gray-300 text-gray-700 px-4 py-2 rounded-lg text-sm font-medium hover:bg-gray-50 transition-colors duration-200 flex items-center"
                >
                  <ArrowLeft className="w-4 h-4 mr-2" />
                  Back
                </button>
                <PrimaryButton type="submit">
                  Join Will <ArrowRight className="w-4 h-4 ml-2" />
                </PrimaryButton>
              </div>
            </form>
          </SectionCard>
        )}

        {/* Step 2: What */}
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
                      value={what}
                      onChange={(e) => {
                        const newValue = e.target.value;
                        if (newValue.length <= 75) {
                          setWhat(newValue);
                          setWhatCharCount(newValue.length);
                        }
                      }}
                      className="flex-1 border-none outline-none resize-none text-base leading-relaxed font-normal p-0 shadow-none focus:ring-0 bg-transparent placeholder:text-gray-400"
                      placeholder="call my grandmother this week"
                      autoFocus
                    />
                  </div>
                </div>
                <div className="text-xs text-gray-500 mt-2 text-right tracking-tight">{whatCharCount} / 75</div>
              </div>
              
              <div className="flex justify-between items-center">
                <div className="flex items-center space-x-2">
                  <button 
                    type="button"
                    onClick={handleBack}
                    className="bg-white border border-gray-300 text-gray-700 px-4 py-2 rounded-lg text-sm font-medium hover:bg-gray-50 transition-colors duration-200 flex items-center"
                  >
                    <ArrowLeft className="w-4 h-4 mr-2" />
                    Back
                  </button>
                  {showHelpIcon && (
                    <HelpIcon
                      onClick={() => setShowInstructionModal(true)}
                      size="sm"
                    />
                  )}
                </div>
                <PrimaryButton type="submit" disabled={!what.trim()}>
                  Next <ArrowRight className="w-4 h-4 ml-2" />
                </PrimaryButton>
              </div>
            </form>
          </SectionCard>
        )}

        {/* Step 3: Why */}
        {currentStep === 3 && !showTransition && (
          <SectionCard>
            <div className="space-y-3">
              {/* Beautified What Preview */}
              {what && (
                <div className="text-center italic text-lg px-4 py-3 border rounded-md shadow-sm text-gray-800 bg-white mb-3">
                  "I will {what}"
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
                      value={why}
                      onChange={(e) => {
                        const newValue = e.target.value;
                        if (newValue.length <= 75) {
                          setWhy(newValue);
                          setWhyCharCount(newValue.length);
                        }
                      }}
                      placeholder="I like how I feel after I talk to her"
                      className="flex-1 border-none outline-none resize-none text-base leading-relaxed font-normal p-0 shadow-none focus:ring-0 bg-transparent placeholder:text-gray-400"
                      autoFocus
                    />
                  </div>
                </div>
                <div className="text-xs text-gray-500 mt-2 text-right tracking-tight">{whyCharCount} / 75</div>
              </div>
              
              <div className="flex justify-between items-center">
                <div className="flex items-center space-x-2">
                  <button 
                    type="button"
                    onClick={handleBack}
                    className="bg-white border border-gray-300 text-gray-700 px-4 py-2 rounded-lg text-sm font-medium hover:bg-gray-50 transition-colors duration-200 flex items-center"
                  >
                    <ArrowLeft className="w-4 h-4 mr-2" />
                    Back
                  </button>
                  {showHelpIcon && (
                    <HelpIcon
                      onClick={() => setShowInstructionModal(true)}
                      size="sm"
                    />
                  )}
                </div>
                <PrimaryButton 
                  type="submit" 
                  disabled={!why.trim()}
                >
                  Next <ArrowRight className="w-4 h-4 ml-2" />
                </PrimaryButton>
              </div>
            </form>
            </div>
          </SectionCard>
        )}

        {/* Step 4: End Room Confirmation */}
        {currentStep === 4 && !showTransition && (
          <SectionCard>
            <form onSubmit={handleStep4Submit} className="space-y-6">
              <div className="space-y-6 mt-8">
                <div className="text-center">
                  <div className="bg-gray-50 rounded-xl p-6 border border-gray-200 mx-auto max-w-md">
                    <div className="flex items-center justify-center mb-3">
                      <Calendar className="w-5 h-5 text-gray-600 mr-2" />
                      <div className="font-medium text-gray-900 tracking-tight">Scheduled End Room</div>
                    </div>
                    <div className="text-sm text-gray-700 tracking-tight">
                      <div className="font-medium space-y-1">
                        <div><strong>Date:</strong> {will?.endRoomScheduledAt ? new Date(will.endRoomScheduledAt).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' }) : 'Loading...'}</div>
                        <div><strong>Time:</strong> {will?.endRoomScheduledAt ? new Date(will.endRoomScheduledAt).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }) : ''}</div>
                      </div>
                      <div className="mt-3 text-xs text-gray-600 tracking-tight">(This is your scheduled End Room for reflection and closure.)</div>
                    </div>
                  </div>
                </div>
              </div>

              <div className="flex justify-between items-center">
                <button 
                  type="button"
                  onClick={handleBack}
                  className="bg-white border border-gray-300 text-gray-700 px-4 py-2 rounded-lg text-sm font-medium hover:bg-gray-50 transition-colors duration-200 flex items-center"
                >
                  <ArrowLeft className="w-4 h-4 mr-2" />
                  Back
                </button>
                <PrimaryButton 
                  type="submit" 
                  disabled={commitmentMutation.isPending}
                  className="flex items-center"
                >
                  {commitmentMutation.isPending ? (
                    "Submitting..."
                  ) : (
                    <>
                      <Handshake className="w-4 h-4 mr-2" />
                      Finalize
                    </>
                  )}
                </PrimaryButton>
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