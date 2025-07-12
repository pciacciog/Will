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
import { ArrowLeft, Save, CheckCircle, Heart } from "lucide-react";

export default function EditCommitment() {
  const { id: willId, commitmentId } = useParams();
  const [, setLocation] = useLocation();
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
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

  return (
    <MobileLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="text-center">
          <SectionTitle>Edit Your Commitment</SectionTitle>
          <p className="text-gray-600 text-base tracking-tight">Update your commitment details</p>
        </div>

        <SectionCard>
          <div className="space-y-6">
            <div className="text-center space-y-4">
              <div className="w-16 h-16 bg-green-100 rounded-2xl flex items-center justify-center mx-auto">
                <CheckCircle className="w-6 h-6 text-brandGreen" />
              </div>
              <div>
                <h2 className="text-xl font-bold text-gray-900 tracking-tight">What You Will Do</h2>
              </div>
            </div>
            
            <div className="space-y-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-4 tracking-tight">
                  Your Want
                </label>
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
                      placeholder="describe what you will do"
                      className="flex-1 border-none outline-none resize-none text-base leading-relaxed font-normal p-0 shadow-none focus:ring-0 bg-transparent placeholder:text-gray-400"
                      rows={2}
                      maxLength={75}
                    />
                  </div>
                  <div className="text-right text-xs text-gray-500 mt-2 tracking-tight">
                    {whatCharCount} / 75
                  </div>
                </div>
              </div>
              
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
                      placeholder="explain why this matters to you"
                      className="flex-1 border-none outline-none resize-none text-base leading-relaxed font-normal p-0 shadow-none focus:ring-0 bg-transparent placeholder:text-gray-400"
                      rows={3}
                      maxLength={75}
                    />
                  </div>
                  <div className="text-right text-xs text-gray-500 mt-2 tracking-tight">
                    {whyCharCount} / 75
                  </div>
                </div>
              </div>
            </div>
          </div>
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
                You can only edit your commitment while the will is pending or scheduled.
              </p>
            </div>
          </div>
        </SectionCard>

        {/* Action Buttons */}
        <div className="flex justify-between gap-4">
          <ActionButton onClick={() => setLocation(`/will/${willId}`)}>
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Will
          </ActionButton>
          
          <PrimaryButton
            onClick={handleUpdate}
            disabled={!what.trim() || !why.trim() || updateMutation.isPending}
          >
            <Save className="w-4 h-4 mr-2" />
            {updateMutation.isPending ? "Updating..." : "Update Commitment"}
          </PrimaryButton>
        </div>
      </div>
    </MobileLayout>
  );
}