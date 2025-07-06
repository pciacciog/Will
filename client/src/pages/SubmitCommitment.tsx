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
    <div className="min-h-screen pt-16 py-12 bg-gray-50">
      <div className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8">
        
        {/* Header */}
        <div className="text-center mb-8">
          <div className="flex items-center justify-between mb-4">
            <div className="flex-1"></div>
            <div className="flex items-center space-x-3">
              <div className="w-12 h-12 bg-gradient-to-br from-primary to-secondary rounded-xl flex items-center justify-center">
                <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                </svg>
              </div>
              <div>
                <h1 className="text-3xl font-bold text-gray-900">Submit Your Commitment</h1>
                <p className="text-gray-600">Step {step} of 2</p>
              </div>
            </div>
            <div className="flex-1"></div>
          </div>
        </div>

        {/* Progress Bar */}
        <div className="w-full bg-gray-200 rounded-full h-2 mb-8">
          <div 
            className="bg-primary h-2 rounded-full transition-all duration-300" 
            style={{ width: `${(step / 2) * 100}%` }}
          ></div>
        </div>

        <Card>
          <CardContent className="p-8">
            {step === 1 ? (
              <>
                <div className="text-center mb-8">
                  <div className="w-16 h-16 bg-green-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
                    <svg className="w-6 h-6 text-secondary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  </div>
                  <h2 className="text-2xl font-bold text-gray-900 mb-2">What would you like to do?</h2>
                  <p className="text-gray-600">Cause it's as simple as wanting.</p>
                </div>
                
                <form className="space-y-6">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Your Want</label>
                    <div className="relative border-2 border-gray-200 rounded-md focus-within:border-blue-500">
                      <div className="flex items-start p-3">
                        <span className="text-gray-900 font-bold text-sm mr-2 mt-0.5 flex-shrink-0">I will</span>
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
                          className="flex-1 border-none outline-none resize-none text-sm leading-6 font-normal p-0 shadow-none focus:ring-0"
                          rows={2}
                          maxLength={75}
                          autoFocus
                          style={{ 
                            background: 'transparent',
                            boxShadow: 'none'
                          }}
                        />
                      </div>
                    </div>
                    <div className="text-right text-xs text-gray-500 mt-1">
                      {whatCharCount} / 75
                    </div>
                  </div>
                  
                  <div className="flex justify-between">
                    <Button type="button" variant="ghost" onClick={handleBack}>
                      ← Back
                    </Button>
                    <Button type="button" onClick={handleNext} disabled={!what.trim()}>
                      Next →
                    </Button>
                  </div>
                </form>
              </>
            ) : (
              <>
                <div className="text-center mb-8">
                  <div className="w-16 h-16 bg-orange-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
                    <svg className="w-6 h-6 text-accent" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M3.172 5.172a4 4 0 015.656 0L10 6.343l1.172-1.171a4 4 0 115.656 5.656L10 17.657l-6.828-6.829a4 4 0 010-5.656z" clipRule="evenodd" />
                    </svg>
                  </div>
                  <h2 className="text-2xl font-bold text-gray-900 mb-2">Why would you like to do this?</h2>
                  <p className="text-gray-600">Remember this when it gets tough.</p>
                </div>

                {/* What Preview */}
                {what && (
                  <div className="mb-6 p-4 bg-white border border-gray-100 rounded-lg shadow-sm">
                    <p className="text-gray-900 font-medium text-center">
                      I will {what}
                    </p>
                  </div>
                )}
                
                <form className="space-y-6">
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <label className="block text-sm font-medium text-gray-700">Your Why</label>
                      <span className="text-xs text-gray-500 flex items-center">
                        <svg className="w-3 h-3 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                        </svg>
                        Private - only you can see this
                      </span>
                    </div>
                    <div className="border-2 border-blue-200 rounded-md focus-within:border-blue-400 bg-white/80">
                      <div className="flex items-start p-3">
                        <span className="text-gray-900 font-bold text-sm mr-2 mt-0.5 flex-shrink-0">Because</span>
                        <Textarea 
                          value={why}
                          onChange={(e) => {
                            const newValue = e.target.value;
                            if (newValue.length <= 75) {
                              setWhy(newValue);
                              setWhyCharCount(newValue.length);
                            }
                          }}
                          className="flex-1 border-none outline-none resize-none text-sm leading-6 font-normal p-0 shadow-none focus:ring-0"
                          rows={4}
                          maxLength={75}
                          autoFocus
                          style={{ 
                            background: 'transparent',
                            boxShadow: 'none',
                            lineHeight: '1.5'
                          }}
                        />
                      </div>
                    </div>
                    <div className="text-right text-xs text-gray-500 mt-1">
                      {whyCharCount} / 75
                    </div>
                  </div>
                  
                  <div className="flex justify-between items-center">
                    <div className="flex items-center space-x-2">
                      <Button type="button" variant="ghost" onClick={handleBack}>
                        ← Back
                      </Button>
                      {showHelpIcon && (
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => setShowInstructionModal(true)}
                          className="w-8 h-8 p-0 text-gray-500 hover:text-gray-700"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                          </svg>
                        </Button>
                      )}
                    </div>
                    <Button 
                      type="button"
                      onClick={handleSubmit} 
                      disabled={!why.trim() || commitmentMutation.isPending}
                      className="bg-primary hover:bg-blue-600"
                    >
                      {commitmentMutation.isPending ? "Submitting..." : "Submit Commitment"}
                    </Button>
                  </div>
                </form>
              </>
            )}
          </CardContent>
        </Card>

        {/* Will Context */}
        {will && (
          <Card className="mt-8">
            <CardContent className="p-6">
              <h3 className="font-medium text-gray-900 mb-2">Will Context</h3>
              <p className="text-sm text-gray-600 mb-2">
                <span className="font-medium">Duration:</span> {new Date(will.startDate).toLocaleDateString()} - {new Date(will.endDate).toLocaleDateString()}
              </p>
              <p className="text-sm text-gray-600">
                <span className="font-medium">Status:</span> {will.commitments?.length || 0} of {circle?.members?.length || 0} members have submitted
              </p>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Instruction Modal */}
      <WillInstructionModal
        isOpen={showInstructionModal}
        onClose={handleModalClose}
        onStart={handleModalStart}
        showDontShowAgain={true}
      />
    </div>
  );
}