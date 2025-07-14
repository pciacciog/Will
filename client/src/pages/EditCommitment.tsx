import { useState, useEffect } from "react";
import { useParams, useLocation } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { useAuth } from "@/hooks/useAuth";
import { MobileLayout, SectionCard, PrimaryButton, SectionTitle, ActionButton } from "@/components/ui/design-system";
import { ArrowLeft, ArrowRight, Save, CheckCircle, Heart } from "lucide-react";

export default function EditCommitment() {
  const { id: willId, commitmentId } = useParams();
  const [, setLocation] = useLocation();
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [step, setStep] = useState(1);
  const [what, setWhat] = useState("");
  const [why, setWhy] = useState("");
  const [whatCharCount, setWhatCharCount] = useState(0);
  const [whyCharCount, setWhyCharCount] = useState(0);

  const { data: will, isLoading: willLoading } = useQuery({
    queryKey: [`/api/wills/${willId}/details`],
    enabled: !!willId,
  });

  const { data: circle } = useQuery({
    queryKey: ['/api/circles/mine'],
  });

  // Find the user's commitment
  const userCommitment = will?.commitments?.find((c: any) => c.id === parseInt(commitmentId!));

  useEffect(() => {
    if (userCommitment) {
      setWhat(userCommitment.what || "");
      setWhy(userCommitment.why || "");
      setWhatCharCount((userCommitment.what || "").length);
      setWhyCharCount((userCommitment.why || "").length);
    }
  }, [userCommitment]);

  const updateMutation = useMutation({
    mutationFn: async (data: { what: string; why: string }) => {
      const response = await apiRequest(`/api/will-commitments/${commitmentId}`, {
        method: 'PUT',
        body: JSON.stringify(data)
      });
      return response.json();
    },
    onSuccess: () => {
      // Invalidate all related queries to ensure UI updates everywhere
      queryClient.invalidateQueries({ queryKey: [`/api/wills/${willId}/details`] });
      queryClient.invalidateQueries({ queryKey: ['/api/wills/circle'] });
      queryClient.invalidateQueries({ queryKey: [`/api/wills/circle/${circle?.id}`] });
      queryClient.invalidateQueries({ queryKey: ['/api/circles/mine'] });
      
      toast({
        title: "Commitment Updated",
        description: "Your commitment has been successfully updated",
      });
      setLocation(`/will/${willId}`);
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleUpdate = () => {
    if (!what.trim() || !why.trim()) {
      toast({
        title: "Missing Information",
        description: "Please fill in both fields",
        variant: "destructive",
      });
      return;
    }
    updateMutation.mutate({ what: what.trim(), why: why.trim() });
  };

  if (willLoading) {
    return (
      <div className="min-h-screen pt-16 flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">Loading...</h2>
        </div>
      </div>
    );
  }

  if (!will || !userCommitment) {
    return (
      <div className="min-h-screen pt-16 flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">Commitment not found</h2>
          <Button onClick={() => setLocation(`/will/${willId}`)}>
            Back to Will Details
          </Button>
        </div>
      </div>
    );
  }

  // Check if user owns this commitment
  if (userCommitment.userId !== user?.id) {
    return (
      <div className="min-h-screen pt-16 flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">Unauthorized</h2>
          <p className="text-gray-600 mb-4">You can only edit your own commitments</p>
          <Button onClick={() => setLocation(`/will/${willId}`)}>
            Back to Will Details
          </Button>
        </div>
      </div>
    );
  }

  // Check if will is still editable (pending or scheduled)
  if (will.status === 'active' || will.status === 'completed') {
    return (
      <div className="min-h-screen pt-16 flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">Cannot Edit Commitment</h2>
          <p className="text-gray-600 mb-4">Commitments can only be edited while the will is pending or scheduled</p>
          <Button onClick={() => setLocation(`/will/${willId}`)}>
            Back to Will Details
          </Button>
        </div>
      </div>
    );
  }

  const handleNext = () => {
    if (!what.trim()) {
      toast({
        title: "Missing Information",
        description: "Please enter what you'd like to do",
        variant: "destructive",
      });
      return;
    }
    setStep(2);
  };

  const handleBack = () => {
    if (step === 1) {
      setLocation(`/will/${willId}`);
    } else {
      setStep(1);
    }
  };

  // Step 1: What
  if (step === 1) {
    return (
      <div className="w-full max-w-screen-sm mx-auto overflow-x-hidden">
        <MobileLayout>
        {/* Sticky Header with Progress */}
        <div className="sticky top-0 z-10 bg-white border-b border-gray-100 pb-4 mb-6 pt-[calc(env(safe-area-inset-top)+1rem)]">
          <div className="pt-4 space-y-3">
            <div className="flex items-center justify-between px-2">
              <div className="flex-1 min-w-0">
                <p className="text-sm text-gray-400 mb-1">Step {step} of 2</p>
                <SectionTitle>Edit Your Commitment</SectionTitle>
              </div>
            </div>

          {/* Progress Bar */}
          <div className="w-full bg-gray-200 rounded-full h-2">
            <div 
              className="bg-brandBlue h-2 rounded-full transition-all duration-300" 
              style={{ width: `${(step / 2) * 100}%` }}
            />
          </div>
          
          {/* Current Step Title */}
          <div className="text-center mt-16">
            <h1 className="text-xl font-semibold text-gray-900">
              What would you like to do?
            </h1>
            <div className="flex justify-center my-3">
              <div className="w-10 h-10 bg-green-500 rounded-full flex items-center justify-center">
                <CheckCircle className="w-6 h-6 text-white" />
              </div>
            </div>
            <p className="text-sm text-gray-500 mt-1">Cause it's as simple as wanting.</p>
          </div>
        </div>
      </div>

      <div className="space-y-3">
        <SectionCard>
          <form onSubmit={(e) => { e.preventDefault(); handleNext(); }} className="space-y-3">
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
                  />
                </div>
              </div>
              <div className="text-xs text-gray-500 mt-2 text-right tracking-tight">{whatCharCount} / 75</div>
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
              <PrimaryButton type="submit" disabled={!what.trim()}>
                Next <ArrowRight className="w-4 h-4 ml-2" />
              </PrimaryButton>
            </div>
          </form>
        </SectionCard>
      </div>
      </MobileLayout>
      </div>
    );
  }

  // Step 2: Why
  return (
    <div className="w-full max-w-screen-sm mx-auto overflow-x-hidden">
      <MobileLayout>
      {/* Sticky Header with Progress */}
      <div className="sticky top-0 z-10 bg-white border-b border-gray-100 pb-4 mb-6 pt-[calc(env(safe-area-inset-top)+1rem)]">
        <div className="pt-4 space-y-3">
          <div className="flex items-center justify-between px-2">
            <div className="flex-1 min-w-0">
              <p className="text-sm text-gray-400 mb-1">Step {step} of 2</p>
              <SectionTitle>Edit Your Commitment</SectionTitle>
            </div>
          </div>

        {/* Progress Bar */}
        <div className="w-full bg-gray-200 rounded-full h-2">
          <div 
            className="bg-brandBlue h-2 rounded-full transition-all duration-300" 
            style={{ width: `${(step / 2) * 100}%` }}
          />
        </div>
        
        {/* Current Step Title */}
        <div className="text-center mt-16">
          <h1 className="text-xl font-semibold text-gray-900">
            Why would you like to do this?
          </h1>
          <div className="flex justify-center my-3">
            <div className="w-10 h-10 bg-red-500 rounded-full flex items-center justify-center">
              <Heart className="w-6 h-6 text-white" />
            </div>
          </div>
          <p className="text-sm text-gray-500 mt-1">Remember this when it gets tough.</p>
        </div>
      </div>
    </div>

    <div className="space-y-3">
      <SectionCard>
        {/* Beautified What Preview */}
        {what && (
          <div className="text-center italic text-lg px-4 py-3 border rounded-md shadow-sm text-gray-800 bg-white mb-3">
            "I will {what}"
          </div>
        )}
        
        <form onSubmit={(e) => { e.preventDefault(); handleUpdate(); }} className="space-y-3">
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
                />
              </div>
            </div>
            <div className="text-xs text-gray-500 mt-2 text-right tracking-tight">{whyCharCount} / 75</div>
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
              disabled={!what.trim() || !why.trim() || updateMutation.isPending}
            >
              <Save className="w-4 h-4 mr-2" />
              {updateMutation.isPending ? "Updating..." : "Update Commitment"}
            </PrimaryButton>
          </div>
        </form>
      </SectionCard>

      {/* Warning Box */}
      <SectionCard>
        <div className="flex items-start space-x-3">
          <svg className="w-5 h-5 text-yellow-600 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
          </svg>
          <div>
            <h3 className="text-sm font-medium text-yellow-800 mb-1 tracking-tight">Note</h3>
            <p className="text-sm text-yellow-700 tracking-tight">
              You can only edit your commitment while the <em>Will</em> is pending or scheduled.
            </p>
          </div>
        </div>
      </SectionCard>
    </div>
    </MobileLayout>
    </div>
  );
}