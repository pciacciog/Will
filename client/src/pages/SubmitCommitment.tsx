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
      queryClient.invalidateQueries({ queryKey: [`/api/wills/${id}/details`] });
      queryClient.invalidateQueries({ queryKey: ['/api/wills/circle', circle?.id] });
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
          <CardHeader>
            <CardTitle className="text-center">
              {step === 1 ? "What will you commit to?" : "Why does this matter to you?"}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {step === 1 ? (
              <div className="space-y-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-3">
                    I will...
                  </label>
                  <Input
                    value={what}
                    onChange={(e) => setWhat(e.target.value)}
                    placeholder="Describe what you will commit to doing"
                    className="w-full"
                    autoFocus
                  />
                  <p className="text-sm text-gray-500 mt-2">
                    Be specific about what you want to achieve during this will period.
                  </p>
                </div>
                
                <div className="flex justify-between pt-4">
                  <Button variant="outline" onClick={handleBack}>
                    Back to Will Details
                  </Button>
                  <Button onClick={handleNext} disabled={!what.trim()}>
                    Next
                  </Button>
                </div>
              </div>
            ) : (
              <div className="space-y-6">
                {/* Summary of Step 1 */}
                <div className="bg-gray-50 rounded-lg p-4">
                  <p className="text-sm font-medium text-gray-700 mb-1">Your commitment:</p>
                  <p className="text-gray-900">"I will {what}"</p>
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-3">
                    Because...
                  </label>
                  <Textarea
                    value={why}
                    onChange={(e) => setWhy(e.target.value)}
                    placeholder="Explain why this commitment is meaningful to you"
                    className="w-full"
                    rows={4}
                    autoFocus
                  />
                  <p className="text-sm text-gray-500 mt-2">
                    Share your motivation and why achieving this matters to you personally.
                  </p>
                </div>
                
                <div className="flex justify-between pt-4">
                  <Button variant="outline" onClick={handleBack}>
                    Back
                  </Button>
                  <Button 
                    onClick={handleSubmit} 
                    disabled={!why.trim() || commitmentMutation.isPending}
                    className="bg-secondary hover:bg-green-600"
                  >
                    {commitmentMutation.isPending ? "Submitting..." : "Submit Commitment"}
                  </Button>
                </div>
              </div>
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