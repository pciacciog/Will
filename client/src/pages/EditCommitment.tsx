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

export default function EditCommitment() {
  const { id: willId, commitmentId } = useParams();
  const [, setLocation] = useLocation();
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [what, setWhat] = useState("");
  const [why, setWhy] = useState("");

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
    }
  }, [userCommitment]);

  const updateMutation = useMutation({
    mutationFn: async (data: { what: string; why: string }) => {
      const response = await apiRequest('PUT', `/api/will-commitments/${commitmentId}`, data);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/wills/${willId}/details`] });
      queryClient.invalidateQueries({ queryKey: ['/api/wills/circle', circle?.id] });
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
    <div className="min-h-screen pt-16 py-12 bg-gray-50">
      <div className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8">
        
        {/* Header */}
        <div className="text-center mb-8">
          <div className="flex items-center justify-center space-x-3 mb-4">
            <div className="w-12 h-12 bg-gradient-to-br from-primary to-secondary rounded-xl flex items-center justify-center">
              <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
              </svg>
            </div>
            <div>
              <h1 className="text-3xl font-bold text-gray-900">Edit Your Commitment</h1>
              <p className="text-gray-600">Update your commitment details</p>
            </div>
          </div>
        </div>

        <Card className="mb-8">
          <CardHeader>
            <CardTitle>Your Commitment</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  I will...
                </label>
                <Input
                  value={what}
                  onChange={(e) => setWhat(e.target.value)}
                  placeholder="Describe what you will do"
                  className="w-full"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Because...
                </label>
                <Textarea
                  value={why}
                  onChange={(e) => setWhy(e.target.value)}
                  placeholder="Explain why this matters to you"
                  className="w-full"
                  rows={4}
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Warning Box */}
        <Card className="mb-8 border-yellow-200 bg-yellow-50">
          <CardContent className="p-6">
            <div className="flex items-start space-x-3">
              <svg className="w-5 h-5 text-yellow-600 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
              </svg>
              <div>
                <h3 className="text-sm font-medium text-yellow-800 mb-1">Note</h3>
                <p className="text-sm text-yellow-700">
                  You can only edit your commitment while the will is pending or scheduled.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Action Buttons */}
        <div className="flex justify-between">
          <Button variant="outline" onClick={() => setLocation(`/will/${willId}`)}>
            Cancel
          </Button>
          
          <Button 
            onClick={handleUpdate}
            disabled={updateMutation.isPending || !what.trim() || !why.trim()}
            className="bg-secondary hover:bg-green-600"
          >
            {updateMutation.isPending ? "Updating..." : "Update Commitment"}
          </Button>
        </div>
      </div>
    </div>
  );
}