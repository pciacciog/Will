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
import { HelpCircle, ArrowLeft, ArrowRight, CheckCircle, Heart } from "lucide-react";

export default function SubmitCommitment() {
  const { id } = useParams();
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [step, setStep] = useState(1);
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

  const handleNext = () => {
    if (step === 1) {
      if (!what.trim()) {
        toast({
          title: "Missing Information",
          description: "Please describe what you will do",
          variant: "destructive",
        });
        return;
      }
      setStep(2);
    }
  };

  const handleSubmit = () => {
    if (!why.trim()) {
      toast({
        title: "Missing Information",
        description: "Please explain why this matters to you",
        variant: "destructive",
      });
      return;
    }
    
    // Show transition animation
    setShowTransition(true);
    
    // After 2.5 seconds, submit the commitment
    setTimeout(() => {
      commitmentMutation.mutate({ what: what.trim(), why: why.trim() });
    }, 2500);
  };

  const handleBack = () => {
    if (step === 2) {
      setStep(1);
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
    <MobileLayout>
      <div className="space-y-3">
        {/* Tightened Header */}
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-gray-400 mb-1">Step {step} of 2</p>
            <SectionTitle>Submit Your Commitment</SectionTitle>
          </div>
          {showHelpIcon && (
            <HelpIcon
              onClick={() => setShowInstructionModal(true)}
              size="md"
            />
          )}
        </div>

        {/* Progress Bar */}
        <div className="w-full bg-gray-200 rounded-full h-2">
          <div 
            className="bg-brandBlue h-2 rounded-full transition-all duration-300" 
            style={{ width: `${(step / 2) * 100}%` }}
          />
        </div>

        <SectionCard>
          {/* Transition Animation Screen */}
          {showTransition ? (
            <div className="flex items-center justify-center py-16">
              <div className="text-center space-y-6 animate-fade-in">
                <div className="w-16 h-16 mx-auto bg-brandBlue rounded-full flex items-center justify-center animate-pulse">
                  <CheckCircle className="w-8 h-8 text-white" />
                </div>
                <p className="text-lg font-medium text-gray-900 animate-slide-up">
                  Submitting your commitment...
                </p>
              </div>
            </div>
          ) : step === 1 ? (
            <div className="space-y-3">
              <div className="text-center space-y-3">
                <div className="w-10 h-10 bg-green-100 rounded-xl flex items-center justify-center mx-auto">
                  <CheckCircle className="w-6 h-6 text-green-600" />
                </div>
                <div>
                  <h2 className="text-xl font-semibold text-gray-900 mb-2">What would you like to do?</h2>
                  <p className="text-sm text-gray-500">Cause it's as simple as wanting.</p>
                </div>
              </div>
              
              <div className="space-y-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-3 tracking-tight">Your Want</label>
                  <div className="relative">
                    <div className="flex items-start bg-white border border-gray-200 rounded-xl p-4 focus-within:outline-none focus-within:ring-2 focus-within:ring-blue-500 transition-all duration-200">
                      <span className="text-gray-900 font-medium text-base mr-3 mt-1 flex-shrink-0">I will</span>
                      <Textarea 
                        value={what}
                        onChange={(e) => {
                          const newValue = e.target.value;
                          if (newValue.length <= 75) {
                            setWhat(newValue);
                            setWhatCharCount(newValue.length);
                          }
                        }}
                        placeholder="call my grandmother this week"
                        className="flex-1 border-none outline-none resize-none text-base leading-relaxed font-normal p-0 shadow-none focus:ring-0 bg-transparent placeholder:text-gray-400"
                        rows={2}
                        maxLength={75}
                        autoFocus
                      />
                    </div>
                    <div className="text-right text-xs text-gray-500 mt-2 tracking-tight">
                      {whatCharCount} / 75
                    </div>
                  </div>
                </div>
                
                <div className="flex justify-between gap-4">
                  <button 
                    onClick={handleBack}
                    className="bg-white border border-gray-300 text-gray-700 px-4 py-2 rounded-lg text-sm font-medium hover:bg-gray-50 transition-colors duration-200 flex items-center"
                  >
                    <ArrowLeft className="w-4 h-4 mr-2" />
                    Back
                  </button>
                  <PrimaryButton onClick={handleNext} disabled={!what.trim()}>
                    Next
                    <ArrowRight className="w-4 h-4 ml-2" />
                  </PrimaryButton>
                </div>
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="text-center space-y-3">
                <div className="w-10 h-10 bg-orange-100 rounded-xl flex items-center justify-center mx-auto">
                  <Heart className="w-6 h-6 text-orange-600" />
                </div>
                <div>
                  <h2 className="text-xl font-semibold text-gray-900 mb-2">Why would you like to do this?</h2>
                  <p className="text-sm text-gray-500">Remember this when it gets tough.</p>
                </div>
              </div>

              {/* Beautified What Preview */}
              {what && (
                <div className="text-center italic text-lg px-4 py-3 border rounded-md shadow-sm text-gray-800 bg-white">
                  "I will {what}"
                </div>
              )}
              
              <div className="space-y-3">
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
                        rows={2}
                        maxLength={75}
                        autoFocus
                      />
                    </div>
                    <div className="text-right text-xs text-gray-500 mt-2 tracking-tight">
                      {whyCharCount} / 75
                    </div>
                  </div>
                </div>
                
                <div className="flex justify-between gap-4">
                  <button 
                    onClick={handleBack}
                    className="bg-white border border-gray-300 text-gray-700 px-4 py-2 rounded-lg text-sm font-medium hover:bg-gray-50 transition-colors duration-200 flex items-center"
                  >
                    <ArrowLeft className="w-4 h-4 mr-2" />
                    Back
                  </button>
                  <PrimaryButton 
                    onClick={handleSubmit} 
                    disabled={!why.trim() || commitmentMutation.isPending}
                  >
                    {commitmentMutation.isPending ? "Submitting..." : "Submit Commitment"}
                  </PrimaryButton>
                </div>
              </div>
            </div>
          )}
        </SectionCard>



        {/* Instruction Modal */}
        <WillInstructionModal
          isOpen={showInstructionModal}
          onClose={handleModalClose}
          onStart={handleModalStart}
          showDontShowAgain={true}
        />
      </div>
    </MobileLayout>
  );
}