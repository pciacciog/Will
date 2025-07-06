import React, { useState, useEffect } from "react";
import { useParams, useLocation } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { useAuth } from "@/hooks/useAuth";
import { EndRoom } from "@/components/EndRoom";
import { FinalWillSummary } from "@/components/FinalWillSummary";


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
  const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
  
  if (days > 0) {
    return `${days} days, ${hours} hours remaining`;
  } else if (hours >= 1) {
    return `${hours} hours remaining`;
  } else {
    return `${minutes} minutes remaining`;
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
  const [expandedCommitments, setExpandedCommitments] = useState<Record<string, boolean>>({});
  const [showFinalSummary, setShowFinalSummary] = useState(false);


  const { data: will, isLoading } = useQuery({
    queryKey: [`/api/wills/${id}/details`],
    enabled: !!id,
    refetchInterval: (data) => {
      if (!data) return 30000;
      
      // More frequent updates for completed wills awaiting acknowledgment
      if (data.status === 'completed') {
        return 5000; // 5 seconds for real-time acknowledgment counter
      }
      
      return 30000; // Default 30 seconds
    },
  });

  const { data: circle } = useQuery({
    queryKey: ['/api/circles/mine'],
  });

  const acknowledgeMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest(`/api/wills/${id}/acknowledge`, {
        method: 'POST'
      });
      return response.json();
    },
    onSuccess: () => {
      // Close the Final Will Summary modal
      setShowFinalSummary(false);
      
      // Invalidate multiple queries to ensure UI updates everywhere
      queryClient.invalidateQueries({ queryKey: [`/api/wills/${id}/details`] });
      queryClient.invalidateQueries({ queryKey: ['/api/wills/circle'] });
      queryClient.invalidateQueries({ queryKey: ['/api/circles/mine'] });
      
      toast({
        title: "Will Acknowledged",
        description: "You have acknowledged the completion of this Will. You can now start a new Will.",
      });
      
      // Navigate back to hub after acknowledgment
      setTimeout(() => {
        setLocation('/hub');
      }, 1500);
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to acknowledge completion",
        variant: "destructive",
      });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async () => {
      await apiRequest(`/api/wills/${id}`, {
        method: 'DELETE'
      });
    },
    onSuccess: () => {
      // Invalidate all related queries to ensure UI updates everywhere
      queryClient.invalidateQueries({ queryKey: ['/api/wills/circle'] });
      queryClient.invalidateQueries({ queryKey: [`/api/wills/circle/${circle?.id}`] });
      queryClient.invalidateQueries({ queryKey: ['/api/circles/mine'] });
      queryClient.invalidateQueries({ queryKey: [`/api/wills/${id}/details`] });
      
      toast({
        title: "Will Deleted",
        description: "The will has been successfully deleted",
      });
      setLocation('/hub');
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Auto-show Final Will Summary when Will is completed
  useEffect(() => {
    if (will && will.status === 'completed' && !will.hasUserAcknowledged && !showFinalSummary) {
      setShowFinalSummary(true);
    }
  }, [will, showFinalSummary]);

  // Early returns after all hooks are defined
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
          <h2 className="text-xl font-semibold text-gray-900 mb-4"><em>Will</em> not found</h2>
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
                {will.status === 'pending' ? <><em>Will</em> Pending</> : <><em>Will</em> Details</>}
              </h1>
              <Badge 
                className={
                  will.status === 'active' ? 'bg-green-100 text-green-800' :
                  will.status === 'pending' ? 'bg-yellow-100 text-yellow-800' :
                  will.status === 'scheduled' ? 'bg-blue-100 text-blue-800' :
                  will.status === 'waiting_for_end_room' ? 'bg-purple-100 text-purple-800' :
                  will.status === 'completed' ? 'bg-gray-100 text-gray-800' :
                  'bg-gray-100 text-gray-800'
                }
              >
                {will.status === 'waiting_for_end_room' ? 'Awaiting End Room' : 
                 will.status.charAt(0).toUpperCase() + will.status.slice(1)}
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

        {/* Proposed Timeline - Show dates and details for pending wills */}
        {will.status === 'pending' && (
          <Card className="mb-8">
            <CardHeader>
              <CardTitle className="flex items-center">
                <svg className="w-5 h-5 text-blue-600 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 002 2z" />
                </svg>
                Proposed Timeline
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <div>
                  <span className="font-medium text-gray-700">Start:</span>
                  <span className="ml-2 text-gray-600">{new Date(will.startDate).toLocaleDateString('en-US', { 
                    weekday: 'long', 
                    year: 'numeric', 
                    month: 'long', 
                    day: 'numeric',
                    hour: 'numeric',
                    minute: '2-digit'
                  })}</span>
                </div>
                <div>
                  <span className="font-medium text-gray-700">End:</span>
                  <span className="ml-2 text-gray-600">{new Date(will.endDate).toLocaleDateString('en-US', { 
                    weekday: 'long', 
                    year: 'numeric', 
                    month: 'long', 
                    day: 'numeric',
                    hour: 'numeric',
                    minute: '2-digit'
                  })}</span>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Submitted Commitments */}
        {will.commitments && will.commitments.length > 0 && (
          <Card className="mb-8">
            <CardHeader>
              <CardTitle className="flex items-center">
                <svg className="w-5 h-5 text-primary mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                Member Commitments
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid gap-6">
                {will.commitments.map((commitment: any) => {
                  const isCurrentUser = commitment.userId === user?.id;
                  const showWhy = expandedCommitments[commitment.id] || false;
                  const toggleWhy = () => {
                    setExpandedCommitments(prev => ({
                      ...prev,
                      [commitment.id]: !prev[commitment.id]
                    }));
                  };
                  
                  return (
                    <div 
                      key={commitment.id} 
                      className={`border-l-4 pl-6 py-4 rounded-r-lg ${
                        isCurrentUser 
                          ? 'border-blue-500 bg-blue-50' 
                          : 'border-green-500'
                      }`}
                    >
                      <div className="flex items-start justify-between mb-2">
                        <div className="font-medium text-gray-900 flex items-center">
                          {commitment.user.firstName && commitment.user.lastName 
                            ? `${commitment.user.firstName} ${commitment.user.lastName}`
                            : commitment.user.email
                          }
                          {isCurrentUser && (
                            <span className="ml-2 text-xs bg-blue-100 text-blue-700 px-2 py-1 rounded-full">
                              You
                            </span>
                          )}
                        </div>
                        <div className="flex items-center space-x-2">
                          <Badge className="bg-green-100 text-green-800 text-xs">
                            Submitted
                          </Badge>
                          {isCurrentUser && (will.status === 'pending' || will.status === 'scheduled') && (
                            <Button 
                              size="sm" 
                              variant="outline"
                              className="text-xs h-7 px-3"
                              onClick={() => setLocation(`/will/${id}/edit-commitment/${commitment.id}`)}
                            >
                              Edit
                            </Button>
                          )}
                        </div>
                      </div>
                      <div className="text-gray-700 mb-2">
                        <span className="font-medium">I will:</span> {commitment.what}
                      </div>
                      {isCurrentUser && (
                        <div className="flex items-center space-x-3">
                          <Button
                            onClick={toggleWhy}
                            variant="ghost"
                            size="sm"
                            className="text-blue-600 hover:text-blue-700 hover:bg-blue-100 p-1 h-auto"
                          >
                            <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                            </svg>
                            {showWhy ? 'Hide Why' : 'Why?'}
                          </Button>
                          {showWhy && (
                            <div className="flex-1 text-gray-600 text-sm">
                              <span className="font-normal">Because</span> {commitment.why}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
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

        {/* User Commitment Button (if user hasn't submitted and will is pending) */}
        {will.status === 'pending' && !userHasCommitted && (
          <Card className="mb-8">
            <CardContent className="p-8 text-center">
              <div className="mb-6">
                <div className="w-16 h-16 bg-gradient-to-br from-primary to-secondary rounded-full flex items-center justify-center mx-auto mb-4">
                  <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                  </svg>
                </div>
                <h3 className="text-xl font-semibold text-gray-900 mb-2">Ready to commit?</h3>
                <p className="text-gray-600">
                  Join your circle members by adding your commitment to this will.
                </p>
              </div>
              
              <Button 
                onClick={() => setLocation(`/will/${id}/commit`)}
                className="bg-secondary hover:bg-green-600"
                size="lg"
              >
                Submit My Commitment
              </Button>
            </CardContent>
          </Card>
        )}

        {/* Acknowledgment Section for Completed Wills - Only for participants */}
        {will.status === 'completed' && will.commitments && will.commitments.some((c: any) => c.userId === user?.id) && (
          <Card className="mb-8 border-green-200 bg-green-50">
            <CardContent className="p-6">
              <div className="text-center">
                <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <svg className="w-8 h-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z" />
                  </svg>
                </div>
                <h3 className="text-xl font-semibold text-gray-900 mb-2">Will Completed!</h3>
                <p className="text-gray-600 mb-4">Congratulations on completing your journey together</p>
                
                <div className="bg-green-100 rounded-xl p-4 mb-6">
                  <div className="text-sm text-green-700">
                    <svg className="w-4 h-4 inline mr-2" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                    </svg>
                    <span className="font-semibold">{will.acknowledgedCount || 0} of {will.commitments?.length || 0}</span> participating members have acknowledged
                  </div>
                  <div className="text-xs text-green-600 mt-2">
                    Required before creating a new WILL
                  </div>
                </div>
                
                {!will.hasUserAcknowledged ? (
                  <Button 
                    onClick={() => acknowledgeMutation.mutate()}
                    disabled={acknowledgeMutation.isPending}
                    className="bg-green-600 hover:bg-green-700"
                  >
                    {acknowledgeMutation.isPending ? 'Acknowledging...' : 'Acknowledge Completion'}
                  </Button>
                ) : (
                  <div className="text-green-700 font-medium">
                    <svg className="w-5 h-5 inline mr-2" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                    </svg>
                    You have acknowledged this completion
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        )}

        {/* End Room Section - Show for wills that are waiting for end room or completed */}
        {(will.status === 'waiting_for_end_room' || will.status === 'completed') && (
          <div className="mb-8">
            <EndRoom willId={will.id} />
          </div>
        )}

        {/* Creator Actions (Edit/Delete) - Only for pending/scheduled status */}
        {will.createdBy === user?.id && (will.status === 'pending' || will.status === 'scheduled') && (
          <Card className="mb-8 border-blue-200 bg-blue-50">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div className="flex items-start space-x-3">
                  <svg className="w-5 h-5 text-blue-600 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <div>
                    <h3 className="text-sm font-medium text-blue-800 mb-1">Creator Options</h3>
                    <p className="text-sm text-blue-700">
                      You can modify or delete this will until it becomes active.
                    </p>
                  </div>
                </div>
                <Button 
                  onClick={() => setLocation(`/will/${id}/edit`)}
                  variant="outline"
                  className="border-blue-300 text-blue-700 hover:bg-blue-100"
                >
                  Edit WILL
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Active Will Notice - Creator can delete active wills */}
        {will.createdBy === user?.id && will.status === 'active' && (
          <Card className="mb-8 border-red-200 bg-red-50">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div className="flex items-start space-x-3">
                  <svg className="w-5 h-5 text-red-600 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
                  </svg>
                  <div>
                    <h3 className="text-sm font-medium text-red-800 mb-1">Creator Options</h3>
                    <p className="text-sm text-red-700">
                      As the creator, you can delete this active will if needed.
                    </p>
                  </div>
                </div>
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button 
                      variant="destructive"
                      size="sm"
                    >
                      Delete <em>Will</em>
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Delete Active <em>Will</em></AlertDialogTitle>
                      <AlertDialogDescription>
                        Are you sure you want to delete this active will? This action cannot be undone and will remove all commitments and progress.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancel</AlertDialogCancel>
                      <AlertDialogAction 
                        onClick={() => deleteMutation.mutate()}
                        className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                      >
                        {deleteMutation.isPending ? "Deleting..." : "Delete"}
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
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

      {/* Final Will Summary Modal */}
      <FinalWillSummary
        isOpen={showFinalSummary}
        onClose={() => setShowFinalSummary(false)}
        onAcknowledge={() => acknowledgeMutation.mutate()}
        will={will}
        isAcknowledging={acknowledgeMutation.isPending}
      />
    </div>
  );
}