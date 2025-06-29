import { useState } from "react";
import { useParams, useLocation } from "wouter";
import { useMutation, useQueryClient, useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";

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

  const { data: will } = useQuery({
    queryKey: [`/api/wills/${id}/details`],
    enabled: !!id,
  });

  const { data: circle } = useQuery({
    queryKey: ['/api/circles/mine'],
  });

  const commitmentMutation = useMutation({
    mutationFn: async (data: { what: string; why: string }) => {
      const response = await apiRequest('POST', `/api/wills/${id}/commitments`, data);
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

  return (
    <div className="min-h-screen pt-16 py-12 bg-gray-50">
      <div className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8">
        
        {/* Header */}
        <div className="text-center mb-8">
          <div className="flex items-center justify-center space-x-3 mb-4">
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
                    <div className="relative">
                      <span className="absolute left-4 top-3 text-gray-900 pointer-events-none select-none font-normal text-sm leading-6">I will</span>
                      <Textarea 
                        value={what}
                        onChange={(e) => {
                          const newValue = e.target.value;
                          if (newValue.length <= 50) {
                            setWhat(newValue);
                            setWhatCharCount(newValue.length);
                          }
                        }}
                        placeholder="call my grandmother this week"
                        className="w-full pl-16 resize-none"
                        rows={2}
                        maxLength={50}
                        autoFocus
                      />
                    </div>
                    <div className="text-right text-xs text-gray-500 mt-1">
                      {whatCharCount} / 50
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
                    <div className="relative">
                      <span className="absolute left-4 top-3 text-gray-900 pointer-events-none select-none font-normal text-sm leading-6 z-10">Because </span>
                      <Textarea 
                        value={why}
                        onChange={(e) => {
                          const newValue = e.target.value;
                          if (newValue.length <= 50) {
                            setWhy(newValue);
                            setWhyCharCount(newValue.length);
                          }
                        }}
                        placeholder="I like how I feel after I talk to her"
                        className="w-full pl-20 resize-none border-2 border-blue-200 focus:border-blue-400 bg-white/80"
                        rows={4}
                        maxLength={50}
                        autoFocus
                        style={{ 
                          lineHeight: '1.5',
                          paddingTop: '12px'
                        }}
                      />
                    </div>
                    <div className="text-right text-xs text-gray-500 mt-1">
                      {whyCharCount} / 50
                    </div>
                  </div>
                  
                  <div className="flex justify-between">
                    <Button type="button" variant="ghost" onClick={handleBack}>
                      ← Back
                    </Button>
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
    </div>
  );
}