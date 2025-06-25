import { useParams, useLocation } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { useAuth } from "@/hooks/useAuth";
import { useState } from "react";

function formatDateRange(startDate: string, endDate: string): string {
  const start = new Date(startDate);
  const end = new Date(endDate);
  return `${start.toLocaleDateString('en-US', { month: 'long', day: 'numeric' })} - ${end.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}`;
}

function calculateDuration(startDate: string, endDate: string): string {
  const start = new Date(startDate);
  const end = new Date(endDate);
  const diff = end.getTime() - start.getTime();
  const days = Math.ceil(diff / (1000 * 60 * 60 * 24));
  return `${days} days total`;
}

function formatTimeRemaining(endDate: string): string {
  const now = new Date();
  const end = new Date(endDate);
  const diff = end.getTime() - now.getTime();
  
  if (diff <= 0) return 'Completed';
  
  const days = Math.floor(diff / (1000 * 60 * 60 * 24));
  const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
  
  if (days > 0) {
    return `${days} days, ${hours} hours remaining`;
  } else {
    return `${hours} hours remaining`;
  }
}

function calculateProgress(startDate: string, endDate: string): number {
  const now = new Date();
  const start = new Date(startDate);
  const end = new Date(endDate);
  
  if (now <= start) return 0;
  if (now >= end) return 100;
  
  const total = end.getTime() - start.getTime();
  const elapsed = now.getTime() - start.getTime();
  
  return Math.round((elapsed / total) * 100);
}

export default function WillDetails() {
  const { id } = useParams();
  const [, setLocation] = useLocation();
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [what, setWhat] = useState("");
  const [why, setWhy] = useState("");

  const { data: will, isLoading } = useQuery({
    queryKey: [`/api/wills/${id}/details`],
    enabled: !!id,
  });

  const { data: circle } = useQuery({
    queryKey: ['/api/circles/mine'],
  });

  const acknowledgeMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest('POST', `/api/wills/${id}/acknowledge`);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/wills/${id}/details`] });
      toast({
        title: "Acknowledged",
        description: "You have acknowledged the completion of this Will",
      });
    },
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
        title: "Commitment Added",
        description: "Your commitment has been submitted",
      });
      setWhat("");
      setWhy("");
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleSubmitCommitment = () => {
    if (!what.trim() || !why.trim()) {
      toast({
        title: "Missing Information",
        description: "Please fill in both fields",
        variant: "destructive",
      });
      return;
    }
    commitmentMutation.mutate({ what: what.trim(), why: why.trim() });
  };

  if (isLoading) {
    return (
      <div className="min-h-screen pt-16 flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">Loading...</h2>
        </div>
      </div>
    );
  }

  if (!will) {
    return (
      <div className="min-h-screen pt-16 flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">Will not found</h2>
          <Button onClick={() => setLocation('/hub')}>
            Back to Hub
          </Button>
        </div>
      </div>
    );
  }

  const userHasCommitted = will.commitments?.some((c: any) => c.userId === user?.id);
  const totalMembers = circle?.members?.length || 0;
  const submittedCount = will.commitments?.length || 0;

  return (
    <div className="min-h-screen pt-16 py-12">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        
        {/* Header */}
        <div className="text-center mb-8">
          <div className="flex items-center justify-center space-x-3 mb-4">
            <div className="w-12 h-12 bg-gradient-to-br from-primary to-secondary rounded-xl flex items-center justify-center">
              <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <div>
              <h1 className="text-3xl font-bold text-gray-900">
                {will.status === 'pending' ? 'Will pending' : 'Will Details'}
              </h1>
              <Badge 
                className={
                  will.status === 'active' ? 'bg-green-100 text-green-800' :
                  will.status === 'pending' ? 'bg-yellow-100 text-yellow-800' :
                  will.status === 'scheduled' ? 'bg-blue-100 text-blue-800' :
                  'bg-gray-100 text-gray-800'
                }
              >
                {will.status.charAt(0).toUpperCase() + will.status.slice(1)}
              </Badge>
            </div>
          </div>
          
          {will.status === 'pending' && (
            <p className="text-gray-600 text-lg font-medium">
              {submittedCount} / {totalMembers} members have submitted their Will
            </p>
          )}
          
          {will.status !== 'pending' && (
            <p className="text-gray-600">
              {formatDateRange(will.startDate, will.endDate)} • {calculateDuration(will.startDate, will.endDate)}
            </p>
          )}
        </div>

        {/* Submitted Commitments */}
        {will.commitments && will.commitments.length > 0 && (
          <Card className="mb-8">
            <CardHeader>
              <CardTitle className="flex items-center">
                <svg className="w-5 h-5 text-primary mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                Submitted Commitments
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid gap-6">
                {will.commitments.map((commitment: any) => (
                  <div key={commitment.id} className="border-l-4 border-green-500 pl-6">
                    <div className="flex items-start justify-between mb-2">
                      <div className="font-medium text-gray-900">
                        {commitment.user.firstName && commitment.user.lastName 
                          ? `${commitment.user.firstName} ${commitment.user.lastName}`
                          : commitment.user.email
                        }
                      </div>
                      <Badge className="bg-green-100 text-green-800 text-xs">
                        Submitted
                      </Badge>
                    </div>
                    <div className="text-gray-700 mb-2">
                      <span className="font-medium">I will:</span> {commitment.what}
                    </div>
                    <div className="text-gray-600 text-sm">
                      <span className="font-medium">Because:</span> {commitment.why}
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Pending Members */}
        {will.status === 'pending' && (
          <Card className="mb-8">
            <CardHeader>
              <CardTitle className="flex items-center">
                <svg className="w-5 h-5 text-yellow-600 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                Pending Members
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4">
                {circle?.members?.filter((member: any) => 
                  !will.commitments?.some((c: any) => c.userId === member.userId)
                ).map((member: any) => (
                  <div key={member.id} className="border-l-4 border-yellow-500 pl-6">
                    <div className="flex items-center justify-between">
                      <div className="font-medium text-gray-900">
                        {member.user.firstName && member.user.lastName 
                          ? `${member.user.firstName} ${member.user.lastName}`
                          : member.user.email
                        }
                      </div>
                      <Badge variant="outline" className="text-yellow-700 border-yellow-300">
                        Pending submission
                      </Badge>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* User Commitment Form (if user hasn't submitted and will is pending) */}
        {will.status === 'pending' && !userHasCommitted && (
          <Card className="mb-8">
            <CardHeader>
              <CardTitle className="flex items-center">
                <svg className="w-5 h-5 text-primary mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                </svg>
                Your Commitment
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Step 1: I will...
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
                    Step 2: Because...
                  </label>
                  <Textarea
                    value={why}
                    onChange={(e) => setWhy(e.target.value)}
                    placeholder="Explain why this matters to you"
                    className="w-full"
                    rows={3}
                  />
                </div>
                
                <Button 
                  onClick={handleSubmitCommitment}
                  disabled={commitmentMutation.isPending || !what.trim() || !why.trim()}
                  className="w-full"
                >
                  {commitmentMutation.isPending ? "Submitting..." : "Submit Commitment"}
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Back to Hub */}
        <div className="text-center">
          <Button variant="outline" onClick={() => setLocation('/hub')}>
            Back to Hub
          </Button>
        </div>
      </div>
    </div>
  );
}