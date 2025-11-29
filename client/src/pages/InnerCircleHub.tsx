import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { useAuth } from "@/hooks/useAuth";
import { Copy, Settings, UserMinus, ChevronDown, Shield, Users, Target, Plus, Video, Clock, CheckCircle, ChevronLeft, History } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { formatDisplayDateTime } from "@/lib/dateUtils";
import { apiRequest } from "@/lib/queryClient";
import { getApiPath } from "@/config/api";
import AccountSettingsModal from "@/components/AccountSettingsModal";
import { Browser } from '@capacitor/browser';
import { DailyVideoRoom } from "@/components/DailyVideoRoom";
import { SimpleVideoRoom } from "@/components/SimpleVideoRoom";
import { MobileVideoRoom } from "@/components/MobileVideoRoom";
import { FinalWillSummary } from "@/components/FinalWillSummary";
import { useAppRefresh } from "@/hooks/useAppRefresh";
import { EndRoomTooltip } from "@/components/EndRoomTooltip";
import { notificationService } from "@/services/NotificationService";
import { getWillStatus } from "@/lib/willStatus";

function formatTimeRemaining(endDate: string): string {
  const now = new Date();
  const end = new Date(endDate);
  const diff = end.getTime() - now.getTime();

  if (diff <= 0) return "Time's up!";

  const days = Math.floor(diff / (1000 * 60 * 60 * 24));
  const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
  const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));

  if (days > 0) {
    return `${days} day${days !== 1 ? 's' : ''}, ${hours} hour${hours !== 1 ? 's' : ''} left`;
  } else if (hours > 0) {
    return `${hours} hour${hours !== 1 ? 's' : ''}, ${minutes} minute${minutes !== 1 ? 's' : ''} left`;
  } else {
    return `${minutes} minute${minutes !== 1 ? 's' : ''} left`;
  }
}

function formatTimeUntilStart(startDate: string): string {
  const now = new Date();
  const start = new Date(startDate);
  const diff = start.getTime() - now.getTime();

  if (diff <= 0) return "Starting now!";

  const days = Math.floor(diff / (1000 * 60 * 60 * 24));
  const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
  const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));

  if (days > 0) {
    return `${days} day${days !== 1 ? 's' : ''}, ${hours} hour${hours !== 1 ? 's' : ''}`;
  } else if (hours > 0) {
    return `${hours} hour${hours !== 1 ? 's' : ''}, ${minutes} minute${minutes !== 1 ? 's' : ''}`;
  } else {
    return `${minutes} minute${minutes !== 1 ? 's' : ''}`;
  }
}

function formatActivationTime(dateString: string): string {
  if (!dateString) return '';
  
  const date = new Date(dateString);
  const now = new Date();
  const isToday = date.toDateString() === now.toDateString();
  
  const timeStr = date.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
  
  if (isToday) {
    return timeStr; // Just "8:39 PM" for today
  } else {
    const monthDay = date.toLocaleDateString([], { month: 'long', day: 'numeric' });
    return `on ${monthDay} at ${timeStr}`; // "on July 6 at 8:39 PM" for other days
  }
}

function formatEndRoomTime(dateString: string): string {
  if (!dateString) return '';
  
  // Parse UTC timestamp and convert to local time for display
  const date = new Date(dateString);
  const now = new Date();
  
  // Compare dates in local timezone
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const dateOnly = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const isToday = dateOnly.getTime() === today.getTime();
  
  const timeStr = date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
  
  if (isToday) {
    return timeStr; // Just "8:50 PM" for today
  } else {
    return `${date.getMonth() + 1}/${date.getDate()} ${timeStr}`; // "7/7 8:50 PM" for other days
  }
}

export default function InnerCircleHub() {
  const { user } = useAuth();
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [showAccountSettings, setShowAccountSettings] = useState(false);
  const [showVideoRoom, setShowVideoRoom] = useState(false);
  const [videoRoomUrl, setVideoRoomUrl] = useState<string | null>(null);
  const [showFinalSummary, setShowFinalSummary] = useState(false);

  const queryClient = useQueryClient();
  
  // Automatically refresh data when app comes back to foreground (mobile & web)
  useAppRefresh();

  const { data: circle } = useQuery<any>({
    queryKey: ['/api/circles/mine'],
    enabled: !!user,
    refetchInterval: 30000, // Refresh every 30 seconds for real-time updates
    staleTime: 0, // Always consider data stale for immediate updates
  });

  const { data: will } = useQuery<any>({
    queryKey: [`/api/wills/circle/${circle?.id}`],
    enabled: !!circle?.id,
    staleTime: 0, // Always consider data stale for immediate updates
    // INTELLIGENT POLLING STRATEGY:
    // - Aggressive polling (5s) ONLY during critical 5-minute windows before transitions
    // - Most of the time polls at 15s-30s intervals
    // - useAppRefresh() invalidates on visibility change for instant updates when app opens
    // - refetchOnWindowFocus in queryClient.ts ensures paused polling when backgrounded
    // Expected load: ~1-2 req/sec during critical moments, ~1 req/30s normally
    refetchInterval: (data: any) => {
      if (!data || !user?.id) return 30000; // Wait for user data before intelligent polling
      
      const willStatus = getWillStatus(data, user.id);
      
      // Real-time updates for completed wills awaiting acknowledgment
      if (willStatus === 'completed') {
        return 5000; // 5 seconds for real-time acknowledgment counter
      }
      
      // NEW FEATURE: Real-time updates for will_review status
      // Poll frequently to detect when all members have submitted reviews
      if (willStatus === 'will_review') {
        return 5000; // Every 5 seconds - show immediate feedback when reviews complete
      }
      
      // Intelligent polling for End Room status transitions
      if (willStatus === 'waiting_for_end_room') {
        // Check if End Room is about to open or is already open
        if (data?.endRoomScheduledAt) {
          const now = new Date();
          const scheduled = new Date(data.endRoomScheduledAt);
          const diff = scheduled.getTime() - now.getTime();
          
          // Very frequent if End Room opens within 5 minutes
          if (diff <= 5 * 60 * 1000 && diff > 0) {
            return 5000; // Every 5 seconds - catch the exact moment it opens
          }
          
          // Very frequent if End Room time has passed (room should be open)
          if (diff <= 0) {
            return 5000; // Every 5 seconds - ensure join button appears immediately
          }
        }
        
        return 15000; // Every 15 seconds otherwise (faster than old 30s)
      }
      
      // Intelligent polling when Will is close to ending
      if (willStatus === 'active' && data?.endDate) {
        const now = new Date();
        const end = new Date(data.endDate);
        const diff = end.getTime() - now.getTime();
        
        // Very frequent if ending within 5 minutes
        if (diff <= 5 * 60 * 1000 && diff > 0) {
          return 5000; // Every 5 seconds - catch transition to waiting_for_end_room
        }
        
        // Frequent if ending within 1 hour
        if (diff <= 60 * 60 * 1000 && diff > 0) {
          return 15000; // Every 15 seconds
        }
      }
      
      // More frequent updates when will is close to starting
      if (data?.startDate) {
        const now = new Date();
        const start = new Date(data.startDate);
        const diff = start.getTime() - now.getTime();
        
        // Update every 5 seconds if starting within 5 minutes
        if (diff > 0 && diff <= 5 * 60 * 1000) {
          return 5000;
        }
        // Update every 15 seconds if starting within 1 hour
        if (diff > 0 && diff <= 60 * 60 * 1000) {
          return 15000;
        }
      }
      
      // Default: update every 30 seconds (reduced from 2 minutes)
      return 30000;
    }
  });

  const willStatus = getWillStatus(will, user?.id);
  const [previousWillStatus, setPreviousWillStatus] = useState<string | null>(null);

  // Monitor for status changes and send notifications
  useEffect(() => {
    if (willStatus && previousWillStatus && willStatus !== previousWillStatus) {
      const sendStatusNotification = async () => {
        try {
          // Will just became active
          if (willStatus === 'active' && previousWillStatus !== 'active' && will?.title) {
            await notificationService.sendWillStartedNotification(will.title);
          }
          
          // Ready for new Will (all members acknowledged)
          if (willStatus === 'no_will' && previousWillStatus === 'completed') {
            await notificationService.sendReadyForNewWillNotification();
          }
          
        } catch (error) {
          console.error('Failed to send status change notification:', error);
        }
      };
      
      sendStatusNotification();
    }
    
    // Update previous status for next comparison
    if (willStatus !== previousWillStatus) {
      setPreviousWillStatus(willStatus);
    }
  }, [willStatus, previousWillStatus, will?.title, will?.endRoomScheduledAt]);

  const leaveCircleMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest(`/api/circles/leave`, { method: 'POST' });
      return await res.json();
    },
    onSuccess: () => {
      toast({
        title: "Success",
        description: "You have left the circle",
      });
      // Comprehensive cache invalidation to prevent stale data
      queryClient.invalidateQueries({ queryKey: ['/api/circles/mine'] });
      queryClient.invalidateQueries({ queryKey: ['/api/wills/circle'] });
      queryClient.invalidateQueries({ queryKey: [`/api/wills/circle/${circle?.id}`] });
      queryClient.invalidateQueries({ queryKey: ['/api/user'] });
      // Clear all cache to ensure fresh state
      queryClient.removeQueries({ queryKey: ['/api/circles/mine'] });
      queryClient.removeQueries({ queryKey: ['/api/wills/circle'] });
      queryClient.removeQueries({ queryKey: [`/api/wills/circle/${circle?.id}`] });
      setLocation('/');
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to leave circle",
        variant: "destructive",
      });
    },
  });

  const acknowledgeMutation = useMutation({
    mutationFn: async () => {
      if (!will?.id) return;
      const response = await apiRequest(`/api/wills/${will.id}/acknowledge`, {
        method: 'POST'
      });
      return response.json();
    },
    onSuccess: () => {
      // Close the modal first
      setShowFinalSummary(false);
      
      // Invalidate queries efficiently - start with most critical
      queryClient.invalidateQueries({ queryKey: ['/api/wills/circle'] });
      queryClient.invalidateQueries({ queryKey: ['/api/circles/mine'] });
      queryClient.invalidateQueries({ queryKey: [`/api/wills/circle/${circle?.id}`] });
      
      toast({
        title: "Will Acknowledged",
        description: "You have acknowledged the completion of this Will. Once all of the members have acknowledged, you will be able to start a new will.",
      });
    },
    onError: (error: any) => {
      // Handle "already acknowledged" error gracefully
      if (error.message?.includes("already acknowledged")) {
        setShowFinalSummary(false);
        return;
      }
      
      toast({
        title: "Error",
        description: error.message || "Failed to acknowledge Will",
        variant: "destructive",
      });
    },
  });

  const handleLeaveCircle = () => {
    if (will && (will.status === 'active' || will.status === 'scheduled' || will.status === 'pending')) {
      toast({
        title: "Cannot leave circle",
        description: "You cannot leave while there's an active WILL. Please wait for it to complete or be cancelled.",
        variant: "destructive",
      });
      return;
    }

    if (confirm('Are you sure you want to leave this circle? This action cannot be undone.')) {
      leaveCircleMutation.mutate();
    }
  };

  const handleLogout = async () => {
    try {
      // Clear any pending device token so it doesn't link to next user
      const pendingToken = localStorage.getItem('pendingDeviceToken');
      if (pendingToken) {
        console.log('🗑️ Clearing pending device token on logout');
        localStorage.removeItem('pendingDeviceToken');
      }
      
      // ISSUE #1 FIX: Clear persisted session
      const { sessionPersistence } = await import('@/services/SessionPersistence');
      await sessionPersistence.clearSession();
      console.log('[Logout] ✅ Session cleared from persistent storage');
      
      await fetch(getApiPath('/api/logout'), { 
        method: 'POST',
        headers: {
          'X-Requested-With': 'XMLHttpRequest',
          'Origin': 'https://will-staging-porfirioaciacci.replit.app',
          'Referer': 'https://will-staging-porfirioaciacci.replit.app'
        }
      });
      window.location.href = '/';
    } catch (error) {
      console.error('Logout failed:', error);
    }
  };

  const handleViewWillDetails = () => {
    if (will?.id) {
      setLocation(`/will/${will.id}`);
    }
  };

  const handleJoinEndRoom = async () => {
    if (!will?.id) return;
    
    try {
      // Fetch End Room data from the dedicated endpoint
      const response = await apiRequest(`/api/wills/${will.id}/end-room`);
      const data = await response.json();
      
      if (data.canJoin && data.endRoomUrl) {
        console.log('Opening embedded video room:', data.endRoomUrl);
        
        // Always try embedded video room first (works on both mobile and desktop)
        setVideoRoomUrl(data.endRoomUrl);
        setShowVideoRoom(true);
        
        toast({
          title: "Joining End Room",
          description: "Starting video call with camera permissions...",
        });
      } else if (!data.endRoomUrl) {
        toast({
          title: "End Room not ready",
          description: "The video room is being set up. Please try again in a moment.",
          variant: "destructive"
        });
      } else {
        toast({
          title: "End Room not available", 
          description: "The End Room is not currently active.",
          variant: "destructive"
        });
      }
    } catch (error) {
      console.error('Error joining End Room:', error);
      toast({
        title: "Connection error",
        description: "Unable to connect to End Room. Please try again.",
        variant: "destructive"
      });
    }
  };

  const handleLeaveVideoRoom = () => {
    setShowVideoRoom(false);
    setVideoRoomUrl(null);
    toast({
      title: "Left End Room",
      description: "You have left the video call.",
    });
  };



  if (!user) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-emerald-50/30">
        <div className="flex items-center justify-center min-h-screen">
          <div className="text-center">
            <h2 className="text-2xl font-bold mb-4">Access Denied</h2>
            <p className="text-muted-foreground mb-6">Please log in to view your Circle.</p>
            <Button 
              onClick={() => setLocation('/auth')} 
              className="bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white"
            >
              Sign In
            </Button>
          </div>
        </div>
      </div>
    );
  }

  if (!circle) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-emerald-50/30">
        <div className="flex items-center justify-center min-h-screen">
          <div className="text-center">
            <h2 className="text-2xl font-bold mb-4">No Circle</h2>
            <p className="text-muted-foreground mb-6">You need to be part of a Circle first.</p>
            <Button 
              onClick={() => setLocation('/inner-circle')} 
              className="bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white"
            >
              Create or Join Circle
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-emerald-50/30">
      {/* Embedded Video Room - Full Screen Overlay */}
      {showVideoRoom && videoRoomUrl && (
        <MobileVideoRoom 
          roomUrl={videoRoomUrl} 
          onLeave={handleLeaveVideoRoom}
          durationMinutes={30}
        />
      )}

      <div className="pt-[calc(env(safe-area-inset-top)+3rem)] pb-[calc(env(safe-area-inset-bottom)+1rem)] min-h-screen">
        <div className="max-w-sm mx-auto px-5">
          
          {/* Header with Back Button */}
          <div className="flex items-center justify-between mb-2">
            {/* Back Button */}
            <button
              onClick={() => setLocation('/')}
              className="w-11 h-11 -ml-2 flex items-center justify-center"
              data-testid="button-back-home"
              aria-label="Go back"
            >
              <span className="w-8 h-8 flex items-center justify-center rounded-lg bg-gray-100 border border-gray-200 text-gray-700 hover:text-gray-900 hover:bg-gray-200 hover:border-gray-300 transition-all duration-200 active:scale-95">
                <ChevronLeft className="w-5 h-5" strokeWidth={2.5} />
              </span>
            </button>
            
            {/* Title */}
            <div className="flex-1 text-center -ml-2">
              <h1 className="text-xl font-semibold text-gray-900">Circle</h1>
            </div>
            
            {/* User Menu */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" className="w-10 h-10 rounded-full p-0 bg-gradient-to-br from-emerald-500 to-teal-500 hover:from-emerald-600 hover:to-teal-600 shadow-lg">
                  <span className="text-white font-semibold text-sm">
                    {user?.firstName?.charAt(0) || user?.email?.charAt(0).toUpperCase() || '?'}
                  </span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48">
                <div className="px-3 py-2 border-b">
                  <p className="text-sm font-medium">
                    {user?.firstName} {user?.lastName}
                  </p>
                  <p className="text-xs text-muted-foreground truncate">
                    {user?.email}
                  </p>
                </div>
                {user?.role === 'admin' && (
                  <>
                    <DropdownMenuItem 
                      onClick={() => setLocation('/admin')}
                      className="flex items-center space-x-2 cursor-pointer"
                    >
                      <Shield className="h-4 w-4" />
                      <span>Admin Panel</span>
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                  </>
                )}
                <DropdownMenuItem 
                  onClick={() => setShowAccountSettings(true)}
                  className="flex items-center space-x-2 cursor-pointer"
                >
                  <Settings className="h-4 w-4" />
                  <span>Account Settings</span>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem 
                  onClick={handleLeaveCircle}
                  className="flex items-center space-x-2 cursor-pointer text-orange-600 hover:text-orange-700 hover:bg-orange-50"
                >
                  <UserMinus className="h-4 w-4" />
                  <span>Leave Circle</span>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>

          {/* Circle Icon with Glow + Tagline */}
          <div className="text-center mb-4">
            <div className="inline-flex items-center justify-center mb-2">
              <div className="relative">
                <div className="absolute inset-0 bg-gradient-to-br from-emerald-500/20 to-teal-500/20 blur-2xl opacity-40 animate-pulse"></div>
                <div className="absolute inset-0 bg-gradient-to-tr from-emerald-400/10 to-teal-400/10 blur-lg opacity-25"></div>
                <div className="relative w-14 h-14 bg-gradient-to-br from-emerald-50 to-teal-50 rounded-full border-2 border-emerald-100 flex items-center justify-center shadow-lg">
                  <Users className="w-7 h-7 text-emerald-600" />
                </div>
              </div>
            </div>
            <p className="text-emerald-600 text-sm font-medium italic">
              "Become more… together"
            </p>
          </div>

          {/* Members Section - Compact */}
          <div className="relative mb-4">
            <div className="absolute -inset-1 bg-gradient-to-r from-emerald-400 to-teal-500 rounded-2xl blur opacity-20"></div>
            <Card className="relative bg-white border-0 shadow-xl rounded-2xl overflow-hidden">
              <CardContent className="p-3">
                {/* Section Header - Compact */}
                <div className="flex items-center justify-between mb-2.5">
                  <div className="flex items-center space-x-1.5">
                    <Users className="w-4 h-4 text-emerald-600" />
                    <h3 className="font-semibold text-gray-900 text-sm">Circle Members</h3>
                  </div>
                  <div className="flex items-center space-x-1.5 bg-emerald-50 px-2 py-1 rounded-md border border-emerald-100">
                    <span className="text-[10px] text-emerald-700">Code:</span>
                    <span className="font-mono font-bold text-emerald-700 text-xs">{circle.inviteCode}</span>
                    <button
                      onClick={() => {
                        navigator.clipboard.writeText(circle.inviteCode);
                        toast({
                          title: "Copied!",
                          description: "Invite code copied to clipboard",
                        });
                      }}
                      className="p-0.5 hover:bg-emerald-100 rounded transition-colors"
                    >
                      <Copy className="h-3 w-3 text-emerald-600" />
                    </button>
                  </div>
                </div>
                
                {/* Members Grid - Dynamic layout based on member count (max 6) */}
                <div className={`grid gap-3 ${
                  (() => {
                    const count = circle.members?.length || 0;
                    if (count === 1) return 'grid-cols-1 max-w-[120px] mx-auto';
                    if (count === 2) return 'grid-cols-2 max-w-[260px] mx-auto';
                    if (count === 3) return 'grid-cols-3';
                    if (count === 4) return 'grid-cols-2 max-w-[260px] mx-auto';
                    if (count === 5) return 'grid-cols-3';
                    if (count === 6) return 'grid-cols-3';
                    return 'grid-cols-3'; // fallback
                  })()
                }`}>
                  {circle.members?.map((member: any, index: number) => (
                    <div 
                      key={member.id} 
                      className={`flex flex-col items-center p-2 bg-gradient-to-br from-gray-50 to-emerald-50/30 rounded-lg border border-emerald-100/50 ${member.user.id === user?.id ? 'cursor-pointer hover:bg-emerald-50/50 transition-colors' : ''}`}
                      onClick={member.user.id === user?.id ? () => setShowAccountSettings(true) : undefined}
                    >
                      {/* Avatar with glow - smaller */}
                      <div className="relative mb-1">
                        <div className="absolute inset-0 bg-emerald-500/20 blur-sm rounded-full"></div>
                        <div className="relative w-8 h-8 bg-gradient-to-br from-emerald-500 to-teal-500 rounded-full flex items-center justify-center shadow-sm">
                          <span className="text-white font-semibold text-xs">
                            {(member.user.firstName || member.user.email)?.charAt(0).toUpperCase()}
                          </span>
                        </div>
                        {/* Online indicator - smaller */}
                        <div className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 bg-green-400 rounded-full border-[1.5px] border-white"></div>
                      </div>
                      <div className="text-center min-w-0 w-full">
                        <div className="font-medium text-gray-900 truncate text-xs">
                          {member.user.firstName || member.user.email?.split('@')[0]}
                        </div>
                        <div className="text-[10px] text-emerald-600">
                          {member.user.id === user?.id ? 'You' : 'Member'}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
          
          {/* Will Status Section - Compact */}
          <div className="relative">
            <div className="absolute -inset-1 bg-gradient-to-r from-emerald-400 to-teal-500 rounded-2xl blur opacity-20"></div>
            <Card className="relative bg-white border-0 shadow-xl rounded-2xl overflow-hidden">
              <CardContent className="p-3">
                {/* Section Header - Compact */}
                <div className="flex items-center space-x-1.5 mb-2.5">
                  <Target className="w-4 h-4 text-emerald-600" />
                  <h3 className="font-semibold text-gray-900 text-sm">Current Will</h3>
                </div>

          {willStatus === 'no_will' && (
            <div className="text-center py-4">
              <button 
                onClick={() => setLocation('/start-will')}
                className="mx-auto mb-3 w-14 h-14 bg-gradient-to-br from-emerald-500 to-teal-500 rounded-full flex items-center justify-center shadow-md hover:shadow-lg transition-all duration-200 hover:scale-105"
                aria-label="Create a Will"
              >
                <Plus className="w-8 h-8 text-white stroke-[2.5]" />
              </button>
              <h3 className="text-base font-medium mb-1 tracking-tight text-gray-900">No active <em>Will</em></h3>
              <p className="text-gray-500 mb-4 text-sm tracking-tight">Ready to commit to something meaningful together?</p>
              <Button 
                onClick={() => setLocation('/start-will')}
                className="w-full bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white py-2.5 rounded-xl shadow-md transition-all duration-200"
              >
                <span>Start a <em>Will</em></span>
              </Button>
            </div>
          )}

          {willStatus === 'pending' && (
            <div className="bg-gradient-to-br from-amber-50/50 to-yellow-50/30 border border-amber-200/60 rounded-lg p-3 space-y-2 text-center">
              {/* Dynamic Will Initiator Message */}
              <div className="text-xs text-gray-600">
                {(() => {
                  const creator = circle?.members?.find((member: any) => member.user.id === will?.createdBy);
                  const creatorName = creator?.user?.firstName || creator?.user?.email || 'Someone';
                  return (
                    <>
                      <span className="font-medium text-gray-800">{creatorName}</span> proposed a new <em>Will</em>.
                    </>
                  );
                })()}
              </div>

              {/* Will Pending Status */}
              <div className="flex justify-center items-center space-x-1.5 text-amber-600 text-xs font-semibold">
                <Clock className="w-3.5 h-3.5" />
                <span><em>Will</em> Pending</span>
              </div>

              {/* Submission Progress */}
              <div className="text-xs text-gray-700">
                {will?.commitments?.length || 0} of {will?.memberCount || 0} members have submitted
              </div>

              {/* Compact Info Box */}
              <div className="bg-amber-100/60 border border-amber-200 rounded-md p-1.5 text-[10px] text-amber-900 leading-tight">
                This <em>Will</em> will activate at <span className="font-semibold">{formatActivationTime(will?.startDate)}</span>.
                Anyone who hasn't submitted by then will not be included.
              </div>

              {/* Action Button */}
              <Button 
                onClick={handleViewWillDetails} 
                className="w-full bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white py-2 rounded-lg shadow-md transition-all duration-200"
              >
                View <em>Will</em> Details
              </Button>
            </div>
          )}

          {willStatus === 'scheduled' && (
            <div>
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center space-x-2">
                  <div className="relative">
                    <div className="absolute inset-0 bg-blue-500/20 blur-sm rounded-lg"></div>
                    <div className="relative w-9 h-9 bg-gradient-to-br from-blue-50 to-indigo-50 rounded-lg flex items-center justify-center border border-blue-100 shadow-sm">
                      <Clock className="w-4 h-4 text-blue-600" />
                    </div>
                  </div>
                  <div>
                    <h3 className="font-semibold text-gray-900 text-sm"><em>Will</em> Scheduled</h3>
                    <p className="text-xs text-gray-500">
                      Starts {formatActivationTime(will?.startDate)}
                    </p>
                  </div>
                </div>
                <Badge className="bg-blue-100 text-blue-800 border border-blue-200 text-xs py-0.5">
                  Scheduled
                </Badge>
              </div>
              
              <div className="bg-gradient-to-br from-blue-50 to-indigo-50/50 rounded-lg p-2.5 mb-3 border border-blue-100">
                <div className="text-xs text-blue-700">
                  <svg className="w-3.5 h-3.5 inline mr-1.5" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                  </svg>
                  Your <em>Will</em> will begin in <span className="font-semibold">{formatTimeUntilStart(will?.startDate)}</span>
                </div>
              </div>
              
              <Button 
                onClick={handleViewWillDetails} 
                className="w-full bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white py-2 rounded-lg shadow-md transition-all duration-200"
              >
                View <em>Will</em> Details
              </Button>
            </div>
          )}

          {willStatus === 'active' && (
            <div>
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center space-x-2">
                  <div className="relative">
                    <div className="absolute inset-0 bg-green-500/20 blur-sm rounded-lg"></div>
                    <div className="relative w-9 h-9 bg-gradient-to-br from-green-50 to-emerald-50 rounded-lg flex items-center justify-center border border-green-100 shadow-sm">
                      <CheckCircle className="w-4 h-4 text-green-600" />
                    </div>
                  </div>
                  <div>
                    <h3 className="font-semibold tracking-tight text-gray-900 text-sm"><em>Will</em> Active</h3>
                    <p className="text-xs text-gray-500 tracking-tight">Ends at {formatDisplayDateTime(will?.endDate)}</p>
                  </div>
                </div>
                <Badge className="bg-green-100 text-green-800 border border-green-200 text-xs py-0.5">
                  Active
                </Badge>
              </div>
              
              <Button 
                onClick={handleViewWillDetails} 
                className="w-full bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white py-2 rounded-lg shadow-md transition-all duration-200"
              >
                View <em>Will</em> Details
              </Button>
            </div>
          )}

          {willStatus === 'will_review' && (
            <div data-testid="section-will-review">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <div className="relative">
                    <div className="absolute inset-0 bg-purple-500/20 blur-sm rounded-lg"></div>
                    <div className="relative w-9 h-9 bg-gradient-to-br from-purple-50 to-indigo-50 rounded-lg flex items-center justify-center border border-purple-100 shadow-sm">
                      <CheckCircle className="w-4 h-4 text-purple-600" />
                    </div>
                  </div>
                  <div>
                    <h3 className="font-semibold tracking-tight text-gray-900 text-sm" data-testid="text-will-review-heading">
                      <em>Will</em> Review
                    </h3>
                    <p className="text-xs text-gray-500 tracking-tight" data-testid="text-will-review-description">
                      Reflect on your experience
                    </p>
                  </div>
                </div>
                <Badge className="bg-purple-100 text-purple-800 border border-purple-200 text-xs py-0.5" data-testid="badge-will-review">
                  Review
                </Badge>
              </div>
              
              <Button 
                onClick={() => setLocation(`/will/${will.id}`)}
                className="w-full bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white py-2 rounded-lg shadow-md transition-all duration-200"
                data-testid="button-submit-will-review"
              >
                Review
              </Button>
            </div>
          )}

          {willStatus === 'waiting_for_end_room' && will?.endRoomScheduledAt && (
            <div>
              {/* Check if End Room is currently active */}
              {will?.endRoomStatus === 'open' ? (
                // End Room is currently in progress
                <>
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <div className="relative">
                        <div className="absolute inset-0 bg-green-500/30 blur-sm rounded-lg animate-pulse"></div>
                        <div className="relative w-9 h-9 bg-gradient-to-br from-green-50 to-emerald-50 rounded-lg flex items-center justify-center border border-green-100 shadow-sm">
                          <Video className="w-4 h-4 text-green-600" />
                        </div>
                      </div>
                      <div>
                        <div className="flex items-center gap-1.5">
                          <h3 className="font-semibold tracking-tight text-gray-900 text-sm"><em>Will</em> - End Room</h3>
                          <Badge className="bg-green-100 text-green-800 border border-green-200 animate-pulse text-xs py-0">
                            Live
                          </Badge>
                        </div>
                        <p className="text-xs text-gray-500 tracking-tight">
                          Closes at {will?.endRoomScheduledAt ? (() => {
                            const openTime = new Date(will.endRoomScheduledAt);
                            const closeTime = new Date(openTime.getTime() + 30 * 60 * 1000);
                            return formatEndRoomTime(closeTime.toISOString());
                          })() : 'N/A'}
                        </p>
                      </div>
                    </div>
                  </div>
                  
                  <Button 
                    onClick={handleJoinEndRoom}
                    className="w-full bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 text-white py-2 rounded-lg shadow-md transition-all duration-200"
                  >
                    Join End Room
                  </Button>
                </>
              ) : (
                // End Room is scheduled but not yet started
                <>
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <div className="relative">
                        <div className="absolute inset-0 bg-purple-500/20 blur-sm rounded-lg"></div>
                        <div className="relative w-9 h-9 bg-gradient-to-br from-purple-50 to-indigo-50 rounded-lg flex items-center justify-center border border-purple-100 shadow-sm">
                          <Video className="w-4 h-4 text-purple-600" />
                        </div>
                      </div>
                      <div>
                        <div className="flex items-center gap-1.5">
                          <h3 className="font-semibold tracking-tight text-gray-900 text-sm"><em>Will</em> - End Room</h3>
                          <Badge className="bg-purple-100 text-purple-800 border border-purple-200 text-xs py-0">
                            Scheduled
                          </Badge>
                        </div>
                        <p className="text-xs text-gray-500 tracking-tight">
                          Opens at {formatEndRoomTime(will.endRoomScheduledAt)}
                        </p>
                      </div>
                    </div>
                  </div>
                  
                  <Button 
                    onClick={handleViewWillDetails}
                    className="w-full bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white py-2 rounded-lg shadow-md transition-all duration-200"
                  >
                    View End Room Details
                  </Button>
                </>
              )}
            </div>
          )}

          {willStatus === 'completed' && (
            <div>
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <div className="relative">
                    <div className="absolute inset-0 bg-green-500/20 blur-sm rounded-lg"></div>
                    <div className="relative w-9 h-9 bg-gradient-to-br from-green-50 to-emerald-50 rounded-lg flex items-center justify-center border border-green-100 shadow-sm">
                      <CheckCircle className="w-4 h-4 text-green-600" />
                    </div>
                  </div>
                  <div>
                    <h3 className="font-semibold tracking-tight text-gray-900 text-sm"><em>Will</em> Complete</h3>
                    <p className="text-xs text-gray-500 tracking-tight">Review final summary to close out</p>
                  </div>
                </div>
                <Badge className="bg-green-100 text-green-800 border border-green-200 text-xs py-0.5">
                  Complete
                </Badge>
              </div>
              
              <Button 
                onClick={() => setShowFinalSummary(true)}
                className="w-full bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white py-2 rounded-lg shadow-md transition-all duration-200"
              >
                Review Final Summary
              </Button>
            </div>
          )}
              </CardContent>
            </Card>
          </div>

          {/* History Link */}
          <div className="mt-8 text-center">
            <button
              onClick={() => setLocation('/circle/history')}
              className="inline-flex items-center gap-2 text-emerald-600 hover:text-emerald-700 text-sm font-medium transition-colors"
              data-testid="button-view-circle-history"
            >
              <History className="w-4 h-4" />
              View History
            </button>
          </div>

        </div>
      </div>

      {/* Account Settings Modal */}
      <AccountSettingsModal 
        isOpen={showAccountSettings}
        onClose={() => setShowAccountSettings(false)}
      />
      
      {/* Final Will Summary Modal */}
      {will && willStatus === 'completed' && (
        <FinalWillSummary 
          isOpen={showFinalSummary}
          will={will}
          hasUserAcknowledged={will.hasUserAcknowledged}
          onClose={() => {
            setShowFinalSummary(false);
            queryClient.invalidateQueries({ queryKey: ['/api/wills/circle'] });
            queryClient.invalidateQueries({ queryKey: ['/api/circles/mine'] });
          }}
          onAcknowledge={() => acknowledgeMutation.mutate()}
          isAcknowledging={acknowledgeMutation.isPending}
          currentUserId={user?.id}
          acknowledgedCount={will.acknowledgedCount || 0}
          commitmentCount={will.commitmentCount || 0}
        />
      )}
    </div>
  );
}