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
import { notificationService } from "@/services/NotificationService";
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
    onSuccess: async () => {
      // Invalidate all related queries to ensure UI updates everywhere
      queryClient.invalidateQueries({ queryKey: [`/api/wills/${id}/details`] });
      queryClient.invalidateQueries({ queryKey: ['/api/wills/circle'] });
      queryClient.invalidateQueries({ queryKey: [`/api/wills/circle/${circle?.id}`] });
      queryClient.invalidateQueries({ queryKey: ['/api/circles/mine'] });
      
      // Send notification about commitment submission
      if (will?.title) {
        try {
          await notificationService.sendCommitmentReceivedNotification(
            "You", // Will show as user's own commitment
            will.title
          );
        } catch (error) {
          console.error('Failed to send commitment notification:', error);
        }
      }
      
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
                {/* Creator Information */}
                <div className="text-center mb-6">
                  <div className="inline-flex items-center space-x-2 bg-blue-50 border border-blue-200 rounded-full px-4 py-2">
                    <div className="w-8 h-8 bg-blue-500 rounded-full flex items-center justify-center">
                      <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                      </svg>
                    </div>
                    <span className="text-sm font-medium text-blue-800">
                      {(() => {
                        console.log('SubmitCommitment Creator Debug:', { 
                          willCreatedBy: will?.createdBy, 
                          circleMembers: circle?.members,
                          willLoaded: !!will,
                          circleLoaded: !!circle
                        });
                        
                        // Wait for both will and circle data to load
                        if (!will || !circle || !circle.members) {
                          return 'Loading...';
                        }
                        
                        const creator = circle.members.find(member => member.user.id === will.createdBy);
                        console.log('Found creator:', creator);
                        
                        return creator?.user.firstName || 'Someone';
                      })()} has proposed the following:
                    </span>
                  </div>
                </div>

                {/* Enhanced Schedule Card */}
                <div className="text-center">
                  <div className="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-2xl p-8 border border-blue-200 shadow-sm mx-auto max-w-sm">
                    <div className="flex items-center justify-center mb-4">
                      <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-full flex items-center justify-center">
                        <Calendar className="w-6 h-6 text-white" />
                      </div>
                    </div>
                    <h3 className="text-lg font-semibold text-gray-900 mb-4">Will Schedule</h3>
                    <div className="text-base text-gray-800 leading-relaxed">
                      <div className="font-medium mb-2">
                        {will?.startDate && will?.endDate ? (
                          <>
                            {new Date(will.startDate).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
                          </>
                        ) : (
                          'Loading...'
                        )}
                      </div>
                      <div className="text-sm text-gray-600 mb-3">
                        {will?.startDate && will?.endDate ? (
                          <>
                            {new Date(will.startDate).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })} to{' '}
                            {new Date(will.endDate).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}
                          </>
                        ) : (
                          'Loading...'
                        )}
                      </div>
                      <div className="bg-white/60 rounded-lg p-3 border border-blue-100">
                        <p className="text-xs text-blue-700 leading-relaxed">
                          Join your circle for this commitment period and work together toward your goals
                        </p>
                      </div>
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
                {/* Enhanced End Room Card */}
                <div className="text-center">
                  <div className="bg-gradient-to-br from-purple-50 to-indigo-50 rounded-2xl p-8 border border-purple-200 shadow-sm mx-auto max-w-sm">
                    <div className="flex items-center justify-center mb-4">
                      <div className="w-12 h-12 bg-gradient-to-br from-purple-500 to-indigo-600 rounded-full flex items-center justify-center">
                        <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                        </svg>
                      </div>
                    </div>
                    <h3 className="text-lg font-semibold text-gray-900 mb-4">End Room</h3>
                    <div className="text-base text-gray-800 leading-relaxed">
                      <div className="font-medium mb-2">
                        {will?.endRoomScheduledAt ? (
                          new Date(will.endRoomScheduledAt).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })
                        ) : (
                          'Loading...'
                        )}
                      </div>
                      <div className="text-sm text-gray-600 mb-3">
                        {will?.endRoomScheduledAt ? (
                          new Date(will.endRoomScheduledAt).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
                        ) : (
                          ''
                        )}
                      </div>
                      <div className="bg-white/60 rounded-lg p-3 border border-purple-100">
                        <p className="text-xs text-purple-700 leading-relaxed">
                          Your circle will gather here to reflect, share, and honor your collective efforts
                        </p>
                      </div>
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
                      Let's do it
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