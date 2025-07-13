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
import { ArrowLeft, Calendar, Clock, Target, Edit, Trash2, Users, CheckCircle, AlertCircle, Video, Heart } from "lucide-react";
import { EndRoomTooltip } from "@/components/EndRoomTooltip";


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
              <EndRoomTooltip className="ml-2" />
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
          <div className="flex items-center mb-4 pb-2 border-b border-gray-100">
            <CheckCircle className="w-5 h-5 text-brandGreen mr-2" />
            <span className="text-base font-semibold uppercase tracking-wide">Circle Commitments</span>
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
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center space-x-2">
                      <span className="text-base font-medium">
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
                    <div className="flex items-center space-x-1">
                      {isCurrentUser && (will.status === 'pending' || will.status === 'scheduled') && (
                        <button 
                          onClick={() => setLocation(`/will/${id}/edit-commitment/${commitment.id}`)}
                          className="text-sm text-blue-600 hover:text-blue-800 px-2 py-1 rounded transition-colors"
                        >
                          <Edit className="w-4 h-4" />
                        </button>
                      )}
                      {isCurrentUser && (
                        <button
                          onClick={toggleWhy}
                          className="text-sm text-blue-600 hover:text-blue-800 active:opacity-70 px-2 py-1 rounded transition-colors flex items-center"
                        >
                          <span className="text-sm">{showWhy ? '▲' : '▼'}</span>
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
                      <div className="pt-1">
                        <div className="text-sm text-gray-500 font-medium italic mb-1">Because</div>
                        <div className="text-base text-gray-800 leading-relaxed">
                          {commitment.why}
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
          <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
            <div className="text-center">
              <div className="w-10 h-10 bg-amber-100 rounded-full flex items-center justify-center mx-auto mb-3">
                <Video className="w-5 h-5 text-amber-600" />
              </div>
              <div className="flex items-center justify-center mb-2">
                <h3 className="text-base font-semibold text-gray-900">End Room</h3>
                <EndRoomTooltip className="ml-2" />
              </div>
              <p className="text-sm text-gray-600 mb-3">
                30-minute group reflection session
              </p>
              <EndRoom willId={will.id} />
            </div>
          </div>
        )}

        {/* Creator Actions */}
        {will.createdBy === user?.id && (will.status === 'pending' || will.status === 'scheduled') && (
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <span className="text-base font-medium text-blue-800">Creator Options</span>
              </div>
              <Button 
                onClick={() => setLocation(`/will/${id}/edit`)}
                variant="outline"
                className="border-blue-300 text-blue-700 hover:bg-blue-100 text-base py-2 px-4"
                size="default"
              >
                Edit{" "}<em>Will</em>
              </Button>
            </div>
          </div>
        )}

        {/* Active Will Creator Actions */}
        {will.createdBy === user?.id && will.status === 'active' && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <svg className="w-5 h-5 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
                </svg>
                <span className="text-base font-medium text-red-800">Creator Options</span>
              </div>
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button 
                    variant="destructive"
                    size="default"
                    className="text-base py-2 px-4"
                  >
                    Delete{" "}<em>Will</em>
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
      />
    </MobileLayout>
  );
}