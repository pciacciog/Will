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
    commitmentMutation.mutate({ what: what.trim(), why: why.trim() });
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
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <SectionTitle>Submit Your Commitment</SectionTitle>
            <p className="text-gray-600 text-base tracking-tight">Step {step} of 2</p>
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
          {step === 1 ? (
            <div className="space-y-6">
              <div className="text-center space-y-4">
                <div className="w-16 h-16 bg-green-100 rounded-2xl flex items-center justify-center mx-auto">
                  <CheckCircle className="w-6 h-6 text-brandGreen" />
                </div>
                <div>
                  <h2 className="text-2xl font-bold text-gray-900 tracking-tight">What would you like to do?</h2>
                  <p className="text-gray-600 text-base tracking-tight">Cause it's as simple as wanting.</p>
                </div>
              </div>
              
              <div className="space-y-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-4 tracking-tight">Your Want</label>
                  <div className="relative">
                    <div className="flex items-start bg-white border-2 border-gray-200 rounded-xl p-4 focus-within:border-brandBlue focus-within:ring-2 focus-within:ring-blue-100 transition-all duration-200">
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
                  <ActionButton onClick={handleBack}>
                    <ArrowLeft className="w-4 h-4 mr-2" />
                    Back
                  </ActionButton>
                  <PrimaryButton onClick={handleNext} disabled={!what.trim()}>
                    Next
                    <ArrowRight className="w-4 h-4 ml-2" />
                  </PrimaryButton>
                </div>
              </div>
            </div>
          ) : (
            <div className="space-y-6">
              <div className="text-center space-y-4">
                <div className="w-16 h-16 bg-orange-100 rounded-2xl flex items-center justify-center mx-auto">
                  <Heart className="w-6 h-6 text-orange-600" />
                </div>
                <div>
                  <h2 className="text-2xl font-bold text-gray-900 tracking-tight">Why would you like to do this?</h2>
                  <p className="text-gray-600 text-base tracking-tight">Remember this when it gets tough.</p>
                </div>
              </div>

              {/* What Preview */}
              {what && (
                <div className="p-4 bg-white border border-gray-100 rounded-lg shadow-sm">
                  <p className="text-gray-900 font-medium text-center tracking-tight">
                    I will {what}
                  </p>
                </div>
              )}
              
              <div className="space-y-6">
                <div>
                  <div className="flex items-center justify-between mb-4">
                    <label className="block text-sm font-medium text-gray-700 tracking-tight">Your Why</label>
                    <span className="text-xs text-gray-500 flex items-center tracking-tight">
                      <svg className="w-3 h-3 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                      </svg>
                      Private - only you can see this
                    </span>
                  </div>
                  <div className="relative">
                    <div className="flex items-start bg-blue-50 border-2 border-blue-200 rounded-xl p-4 focus-within:border-brandBlue focus-within:ring-2 focus-within:ring-blue-100 transition-all duration-200">
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
                  <ActionButton onClick={handleBack}>
                    <ArrowLeft className="w-4 h-4 mr-2" />
                    Back
                  </ActionButton>
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

        {/* Will Context */}
        {will && (
          <SectionCard>
            <div className="space-y-4">
              <SectionTitle>Will Context</SectionTitle>
              <div className="space-y-2">
                <p className="text-sm text-gray-600 tracking-tight">
                  <span className="font-medium">Duration:</span> {new Date(will.startDate).toLocaleDateString()} - {new Date(will.endDate).toLocaleDateString()}
                </p>
                <p className="text-sm text-gray-600 tracking-tight">
                  <span className="font-medium">Status:</span> {will.commitments?.length || 0} of {circle?.members?.length || 0} members have submitted
                </p>
              </div>
            </div>
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
  );
}