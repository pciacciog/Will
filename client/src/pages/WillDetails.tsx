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
import { MobileLayout, SectionCard, PrimaryButton, SectionTitle, ActionButton, AvatarBadge } from "@/components/ui/design-system";
import { ArrowLeft, Calendar, Clock, Target, Edit, Trash2, Users, CheckCircle, AlertCircle, Video, Heart, Zap } from "lucide-react";
import { EndRoomTooltip } from "@/components/EndRoomTooltip";
import { EndRoomCountdown } from "@/components/EndRoomCountdown";
import { notificationService } from "@/services/NotificationService";


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

function formatTimeUntilStart(startDate: string): string {
  const now = new Date();
  const start = new Date(startDate);
  const diff = start.getTime() - now.getTime();
  
  if (diff <= 0) return 'Starting now';
  
  const days = Math.floor(diff / (1000 * 60 * 60 * 24));
  const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
  const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
  
  if (days > 0) {
    return `Starts in ${days} days, ${hours} hours`;
  } else if (hours >= 1) {
    return `Starts in ${hours} hours`;
  } else {
    return `Starts in ${minutes} minutes`;
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


  const { data: will, isLoading, error } = useQuery({
    queryKey: [`/api/wills/${id}/details`],
    enabled: !!id && !!user,
    staleTime: 0, // Always consider data stale for immediate updates
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
    enabled: !!user,
    refetchInterval: 30000, // Refresh every 30 seconds for real-time updates
    staleTime: 0, // Always consider data stale for immediate updates
  });

  const acknowledgeMutation = useMutation({
    mutationFn: async () => {
      // Check if user has already acknowledged before making the request
      if (will?.hasUserAcknowledged) {
        // If already acknowledged, just close modal and navigate
        setShowFinalSummary(false);
        setLocation('/hub');
        return;
      }
      
      const response = await apiRequest(`/api/wills/${id}/acknowledge`, {
        method: 'POST'
      });
      return response.json();
    },
    onSuccess: async () => {
      // Close the Final Will Summary modal
      setShowFinalSummary(false);
      
      // Invalidate queries efficiently - start with most critical
      queryClient.invalidateQueries({ queryKey: ['/api/wills/circle'] });
      queryClient.invalidateQueries({ queryKey: ['/api/circles/mine'] });
      queryClient.invalidateQueries({ queryKey: [`/api/wills/${id}/details`] });
      
      // Note: No notification needed for individual acknowledgment
      // Notification sent when all members acknowledge
      
      toast({
        title: "Will Acknowledged",
        description: "You have acknowledged the completion of this Will. Once all of the members have acknowledged, you will be able to start a new will.",
      });
      
      // Navigate back to hub immediately - remove artificial delay
      setLocation('/hub');
    },
    onError: (error: any) => {
      // Handle "already acknowledged" error gracefully
      if (error.message?.includes("already acknowledged")) {
        setShowFinalSummary(false);
        setLocation('/hub');
        return;
      }
      
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

  // Push notification query and mutation
  const { data: pushStatus, isLoading: isPushLoading } = useQuery({
    queryKey: [`/api/wills/${id}/push/status`],
    enabled: !!will && will.status === 'active',
    refetchInterval: 30000,
  });

  const pushMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest(`/api/wills/${id}/push`, {
        method: 'POST'
      });
      return response.json();
    },
    onSuccess: async () => {
      queryClient.invalidateQueries({ queryKey: [`/api/wills/${id}/push/status`] });
      
      // Send local notification to encourage teammates
      if (user && will) {
        const pusherName = user.firstName && user.lastName 
          ? `${user.firstName} ${user.lastName}`
          : user.email;
        await notificationService.sendPushNotification(pusherName, will.title || 'Your Will');
      }
      
      toast({
        title: "Push Sent!",
        description: "You have pushed your circle (local notification only - not cross-device)",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to send push notification",
        variant: "destructive",
      });
    },
  });

  // Auto-show Final Will Summary when End Room ceremony is finished
  useEffect(() => {
    if (will && will.status === 'completed' && will.endRoomStatus === 'completed' && !will.hasUserAcknowledged && !showFinalSummary) {
      setShowFinalSummary(true);
    }
  }, [will, showFinalSummary]);

  // Early returns after all hooks are defined
  if (!user) {
    return (
      <div className="min-h-screen pt-16 flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">Authentication required</h2>
          <Button onClick={() => setLocation('/auth')}>
            Sign In
          </Button>
        </div>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="min-h-screen pt-16 flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">Loading...</h2>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen pt-16 flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">Error loading <em>Will</em></h2>
          <p className="text-gray-600 mb-4">
            {error.message || 'Unable to load Will details'}
          </p>
          <Button onClick={() => setLocation('/hub')}>
            Back to Hub
          </Button>
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
    <MobileLayout>
      <div className="space-y-3">
        {/* Compact Header */}
        <div className="text-center">
          <h1 className="text-xl font-semibold mb-2"><em>Will</em></h1>
          <div className="flex items-center justify-center space-x-2 mb-1">
            <Badge 
              className={`text-xs tracking-tight ${
                will.status === 'active' ? 'bg-green-100 text-green-800' :
                will.status === 'pending' ? 'bg-yellow-100 text-yellow-800' :
                will.status === 'scheduled' ? 'bg-blue-100 text-blue-800' :
                will.status === 'waiting_for_end_room' ? 'bg-purple-100 text-purple-800' :
                will.status === 'completed' ? 'bg-gray-100 text-gray-800' :
                'bg-gray-100 text-gray-800'
              }`}
            >
              {will.status === 'waiting_for_end_room' ? 'Pending End Room' : 
               will.status === 'active' ? 'Active' :
               will.status === 'pending' ? 'Pending' :
               will.status === 'scheduled' ? 'Scheduled' :
               will.status === 'completed' ? 'Completed' :
               will.status.charAt(0).toUpperCase() + will.status.slice(1)}
            </Badge>
          </div>
          {will.status === 'pending' && (
            <p className="text-gray-500 text-xs tracking-tight">
              {submittedCount} / {totalMembers} members submitted
            </p>
          )}
        </div>

        {/* Timeline Section */}
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <div className="flex items-center mb-3">
            <Calendar className="w-5 h-5 text-blue-600 mr-2" />
            <span className="text-base font-semibold">Timeline</span>
          </div>
          <div className="space-y-2">
            <div className="text-base">
              <span className="font-medium">Start:</span> {new Date(will.startDate).toLocaleDateString('en-US', { 
                month: 'short', 
                day: 'numeric',
                hour: 'numeric',
                minute: '2-digit'
              })}
            </div>
            <div className="text-base">
              <span className="font-medium">End:</span> {new Date(will.endDate).toLocaleDateString('en-US', { 
                month: 'short', 
                day: 'numeric',
                hour: 'numeric',
                minute: '2-digit'
              })}
            </div>
          </div>
        </div>

        {/* End Room Section */}
        {will.endRoomScheduledAt && (
          <div className="bg-white rounded-lg border border-gray-200 p-4">
            <div className="flex items-center mb-3">
              <Video className="w-5 h-5 text-blue-600 mr-2" />
              <span className="text-base font-semibold">End Room</span>
              <div className="ml-2">
                <EndRoomTooltip />
              </div>
            </div>
            <div className="space-y-2">
              <div className="text-base">
                <span className="font-medium">Scheduled:</span> {new Date(will.endRoomScheduledAt).toLocaleDateString('en-US', { 
                  month: 'short', 
                  day: 'numeric',
                  hour: 'numeric',
                  minute: '2-digit'
                })}
              </div>
              <div className="text-base">
                <span className="font-medium">Duration:</span> 30 minutes
              </div>
            </div>
          </div>
        )}

        {/* Circle Commitments Section */}
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <div className="flex items-center justify-between mb-4 pb-2 border-b border-gray-100">
            <div className="flex items-center">
              <CheckCircle className="w-5 h-5 text-brandGreen mr-2" />
              <span className="text-base font-semibold text-gray-900 underline">Circle Commitments</span>
            </div>
            {/* Push notification button for active wills */}
            {will.status === 'active' && (
              <button
                onClick={() => pushMutation.mutate()}
                disabled={pushMutation.isPending || pushStatus?.hasUserPushed}
                className={`inline-flex items-center px-2 py-1 text-xs font-medium rounded transition-colors ${
                  pushStatus?.hasUserPushed
                    ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                    : 'bg-green-600 text-white hover:bg-green-700'
                }`}
                title={pushStatus?.hasUserPushed ? 'Already pushed' : 'Push your teammates (local notification only)'}
              >
                <Zap className="w-3 h-3 mr-1" />
                {pushMutation.isPending ? 'Pushing...' : 'Push'}
              </button>
            )}
          </div>
          <div className="space-y-4">
            {will.commitments && will.commitments.length > 0 && will.commitments.map((commitment: any) => {
              const isCurrentUser = commitment.userId === user?.id;
              const showWhy = expandedCommitments[commitment.id] || false;
              const toggleWhy = () => {
                setExpandedCommitments(prev => ({
                  ...prev,
                  [commitment.id]: !prev[commitment.id]
                }));
              };
              
              return (
                <div key={commitment.id} className="border-b border-gray-100 pb-3 last:border-b-0 last:pb-0">
                  {/* User name and actions row */}
                  <div className="flex items-center justify-between mb-2 gap-3">
                    <div className="flex items-center space-x-2 flex-1 min-w-0">
                      <span className="text-base font-medium truncate">
                        {commitment.user.firstName && commitment.user.lastName 
                          ? `${commitment.user.firstName} ${commitment.user.lastName}`
                          : commitment.user.email
                        }
                        {isCurrentUser && (
                          <span className="ml-2 text-xs bg-blue-100 text-blue-700 px-2 py-1 rounded">
                            You
                          </span>
                        )}
                      </span>
                    </div>
                    <div className="flex items-center space-x-2 flex-shrink-0">
                      {isCurrentUser && (will.status === 'pending' || will.status === 'scheduled') && (
                        <button 
                          onClick={() => setLocation(`/will/${id}/edit-commitment/${commitment.id}`)}
                          className="px-3 py-1 text-sm rounded border bg-white shadow text-gray-700 hover:bg-gray-50 transition-colors duration-200"
                          title="Edit commitment"
                        >
                          Edit
                        </button>
                      )}
                      {isCurrentUser && (
                        <button
                          onClick={toggleWhy}
                          className={`text-sm px-3 py-1 rounded border transition-all duration-200 shadow ${
                            showWhy 
                              ? 'bg-red-500 text-white border-red-500 shadow-md hover:bg-red-600' 
                              : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
                          }`}
                          title={showWhy ? "Hide your reason" : "Show your reason"}
                        >
                          Why
                        </button>
                      )}
                    </div>
                  </div>
                  
                  {/* Commitment content */}
                  <div className="space-y-2">
                    <div>
                      <div className="text-sm text-gray-500 font-medium italic mb-1">I will</div>
                      <div className="text-base text-gray-800 leading-relaxed">
                        {commitment.what}
                      </div>
                    </div>
                    
                    {isCurrentUser && showWhy && (
                      <div className="mt-3 p-4 bg-gray-50 border-l-4 border-gray-300 rounded-lg shadow-sm animate-in fade-in duration-300">
                        <div className="text-base tracking-wide">
                          <span className="font-bold text-black">Because</span> {commitment.why}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>



        {/* Submit Commitment Section */}
        {will.status === 'pending' && !userHasCommitted && (
          <div className="bg-white rounded-lg border border-gray-200 p-4">
            <div className="text-center">
              <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-3">
                <svg className="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                </svg>
              </div>
              <h3 className="text-base font-semibold text-gray-900 mb-2">Ready to commit?</h3>
              <p className="text-sm text-gray-500 mb-4">
                Join your circle members by adding your commitment to this will.
              </p>
              <Button 
                onClick={() => setLocation(`/will/${id}/commit`)}
                className="bg-green-600 hover:bg-green-700 text-base py-3 px-6"
                size="lg"
              >
                Submit My Commitment
              </Button>
            </div>
          </div>
        )}

        {/* Acknowledgment Section for Completed Wills */}
        {will.status === 'completed' && will.commitments && will.commitments.some((c: any) => c.userId === user?.id) && (
          <div className="bg-green-50 border border-green-200 rounded-lg p-4">
            <div className="text-center">
              <div className="w-10 h-10 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-3">
                <CheckCircle className="w-5 h-5 text-green-600" />
              </div>
              <h3 className="text-base font-semibold text-gray-900 mb-2">Acknowledge <em>Will</em> Completion</h3>
              <p className="text-sm text-gray-600 mb-3">
                {will.acknowledgedCount || 0} of {will.commitments?.length || 0} members acknowledged
              </p>
              {!will.hasUserAcknowledged ? (
                <Button 
                  onClick={() => acknowledgeMutation.mutate()}
                  disabled={acknowledgeMutation.isPending}
                  className="bg-green-600 hover:bg-green-700 text-base py-3 px-6"
                  size="lg"
                >
                  {acknowledgeMutation.isPending ? 'Acknowledging...' : 'Acknowledge and Close Will'}
                </Button>
              ) : (
                <div className="text-green-700 font-medium text-base">
                  <CheckCircle className="w-5 h-5 inline mr-2" />
                  Acknowledged
                </div>
              )}
            </div>
          </div>
        )}

        {/* End Room Section for active states */}
        {(will.status === 'waiting_for_end_room' || will.status === 'completed') && (
          <div className="bg-purple-50 border border-purple-200 rounded-lg p-4">
            <div className="text-center">
              <div className="w-10 h-10 bg-purple-100 rounded-full flex items-center justify-center mx-auto mb-3">
                <Video className="w-5 h-5 text-purple-600" />
              </div>
              <h3 className="text-base font-semibold text-gray-900 mb-2">End Room</h3>
              <EndRoomCountdown will={will} />
              <EndRoom willId={will.id} />
            </div>
          </div>
        )}

        {/* Creator Actions */}
        {will.createdBy === user?.id && (will.status === 'pending' || will.status === 'scheduled') && (
          <div className="bg-slate-50 border border-blue-100 rounded-2xl shadow-md py-4 px-6">
            <div className="flex justify-between items-center gap-4">
              <div className="flex items-center gap-2">
                <svg className="w-5 h-5 text-blue-500 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <span className="text-base font-medium text-blue-700">Creator Options</span>
              </div>
              <Button 
                onClick={() => setLocation(`/will/${id}/edit`)}
                className="border border-blue-500 text-blue-600 bg-white hover:bg-blue-50 rounded-lg px-4 py-2 text-base font-medium"
                size="default"
              >
                Edit <em>Will</em>
              </Button>
            </div>
          </div>
        )}

        {/* Active Will Creator Actions */}
        {will.createdBy === user?.id && will.status === 'active' && (
          <div className="bg-red-50 border border-red-100 rounded-2xl shadow-md py-4 px-6">
            <div className="flex justify-between items-center gap-4">
              <div className="flex items-center gap-2">
                <svg className="w-5 h-5 text-red-500 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
                </svg>
                <span className="text-base font-medium text-red-700">Creator Options</span>
              </div>
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button 
                    className="border border-red-500 text-red-600 bg-white hover:bg-red-50 rounded-lg px-4 py-2 text-base font-medium"
                    size="default"
                  >
                    Delete <em>Will</em>
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Delete Active{" "}<em>Will</em></AlertDialogTitle>
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
          </div>
        )}

        {/* Back to Hub */}
        <div className="text-center mt-4">
          <button 
            onClick={() => setLocation('/hub')}
            className="text-base text-gray-600 hover:text-gray-800 underline font-medium"
          >
            Back to Hub
          </button>
        </div>
      </div>

      {/* Final Will Summary Modal */}
      <FinalWillSummary
        isOpen={showFinalSummary}
        onClose={() => {
          setShowFinalSummary(false);
          // Navigate back to dashboard if already acknowledged
          if (will?.hasUserAcknowledged) {
            setLocation('/hub');
          }
        }}
        onAcknowledge={() => acknowledgeMutation.mutate()}
        will={will}
        isAcknowledging={acknowledgeMutation.isPending}
        currentUserId={user?.id}
        hasUserAcknowledged={will?.hasUserAcknowledged}
        acknowledgedCount={will?.acknowledgedCount || 0}
        commitmentCount={will?.commitmentCount || 0}
      />
    </MobileLayout>
  );
}