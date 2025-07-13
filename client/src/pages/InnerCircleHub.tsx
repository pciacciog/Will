import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { MobileLayout, MobileHeader, SectionCard, PrimaryButton, AvatarBadge, SectionTitle, ActionButton } from "@/components/ui/design-system";
import { useAuth } from "@/hooks/useAuth";
import { Copy, Settings, LogOut, UserMinus, ChevronDown, Shield, Users, Target, Plus, Video, Clock, CheckCircle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { formatDisplayDateTime } from "@/lib/dateUtils";
import { apiRequest } from "@/lib/queryClient";
import AccountSettingsModal from "@/components/AccountSettingsModal";
import { Browser } from '@capacitor/browser';
import { DailyVideoRoom } from "@/components/DailyVideoRoom";
import { SimpleVideoRoom } from "@/components/SimpleVideoRoom";
import { MobileVideoRoom } from "@/components/MobileVideoRoom";
import { FinalWillSummary } from "@/components/FinalWillSummary";
import { useAppRefresh } from "@/hooks/useAppRefresh";
import { EndRoomTooltip } from "@/components/EndRoomTooltip";

function getWillStatus(will: any, memberCount: number): string {
  if (!will) return 'no_will';
  
  // If will is archived, treat as no will
  if (will.status === 'archived') return 'no_will';
  
  // If will has explicit status, use it (for End Room flow)
  if (will.status === 'waiting_for_end_room' || will.status === 'completed') {
    return will.status;
  }
  
  const now = new Date();
  const startDate = new Date(will.startDate);
  const endDate = new Date(will.endDate);

  if (now >= endDate) {
    // Will should transition to waiting_for_end_room, but check acknowledgments
    const acknowledgedCount = will.acknowledgedCount || 0;
    if (acknowledgedCount >= memberCount) {
      return 'no_will'; // All acknowledged, can start new will
    }
    return 'completed';
  } else if (now >= startDate) {
    return 'active';
  } else {
    // Check commitment count to determine pending vs scheduled
    const commitmentCount = will.commitments?.length || 0;
    if (commitmentCount < memberCount) {
      return 'pending';
    } else if (commitmentCount >= memberCount) {
      return 'scheduled';
    } else {
      return 'pending';
    }
  }
}

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

  const queryClient = useQueryClient();
  
  // Automatically refresh data when app comes back to foreground (mobile & web)
  useAppRefresh();

  const { data: circle } = useQuery({
    queryKey: ['/api/circles/mine'],
    queryFn: () => fetch('/api/circles/mine').then(res => res.json()),
    enabled: !!user,
  });

  const { data: will } = useQuery({
    queryKey: [`/api/wills/circle/${circle?.id}`],
    queryFn: () => fetch(`/api/wills/circle/${circle?.id}`).then(res => res.json()),
    enabled: !!circle?.id,
    refetchInterval: (data: any) => {
      if (!data) return 120000;
      
      const willStatus = getWillStatus(data, circle?.members?.length || 0);
      
      // More frequent updates for completed wills awaiting acknowledgment
      if (willStatus === 'completed') {
        return 5000; // 5 seconds for real-time acknowledgment counter
      }
      
      // More frequent updates for wills waiting for end room
      if (willStatus === 'waiting_for_end_room') {
        return 30000; // 30 seconds for end room status updates
      }
      
      // More frequent updates when will is close to starting
      if (data?.startDate) {
        const now = new Date();
        const start = new Date(data.startDate);
        const diff = start.getTime() - now.getTime();
        
        // Update every 10 seconds if starting within 5 minutes
        if (diff > 0 && diff <= 5 * 60 * 1000) {
          return 10000;
        }
        // Update every 30 seconds if starting within 1 hour
        if (diff > 0 && diff <= 60 * 60 * 1000) {
          return 30000;
        }
      }
      
      // Default: update every 2 minutes
      return 120000;
    }
  });

  const willStatus = getWillStatus(will, circle?.members?.length || 0);

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
      queryClient.invalidateQueries({ queryKey: ['/api/circles/mine'] });
      setLocation('/inner-circle');
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to leave circle",
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
      await fetch('/api/logout', { method: 'POST' });
      window.location.href = '/';
    } catch (error) {
      console.error('Logout failed:', error);
    }
  };

  const formatDisplayDateTime = (dateString: string): string => {
    if (!dateString) return '';
    
    const date = new Date(dateString);
    const now = new Date();
    const isToday = date.toDateString() === now.toDateString();
    const isTomorrow = date.toDateString() === new Date(now.getTime() + 24 * 60 * 60 * 1000).toDateString();
    
    const timeStr = date.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
    
    if (isToday) {
      return `Today at ${timeStr}`;
    } else if (isTomorrow) {
      return `Tomorrow at ${timeStr}`;
    } else {
      return date.toLocaleDateString([], { 
        weekday: 'long',
        month: 'short', 
        day: 'numeric',
        hour: 'numeric',
        minute: '2-digit'
      });
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
      <MobileLayout>
        <div className="flex items-center justify-center min-h-screen-safe">
          <div className="text-center">
            <h2 className="text-2xl font-bold mb-4">Access Denied</h2>
            <p className="text-muted-foreground mb-6">Please log in to view your Inner Circle Hub.</p>
            <PrimaryButton onClick={() => setLocation('/auth')} size="lg">
              Sign In
            </PrimaryButton>
          </div>
        </div>
      </MobileLayout>
    );
  }

  if (!circle) {
    return (
      <MobileLayout>
        <div className="flex items-center justify-center min-h-screen-safe">
          <div className="text-center">
            <h2 className="text-2xl font-bold mb-4">No Inner Circle</h2>
            <p className="text-muted-foreground mb-6">You need to be part of an Inner Circle first.</p>
            <PrimaryButton onClick={() => setLocation('/inner-circle')} size="lg">
              Create or Join Circle
            </PrimaryButton>
          </div>
        </div>
      </MobileLayout>
    );
  }

  return (
    <MobileLayout
      className="bg-gray-50/50"
      header={
        <MobileHeader 
          title="Inner Circle Hub"
          subtitle="Become More — Together"
          actions={
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" className="w-10 h-10 rounded-full p-0 bg-gradient-to-br from-primary to-secondary hover:from-primary/90 hover:to-secondary/90">
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
                <DropdownMenuSeparator />
                <DropdownMenuItem 
                  onClick={handleLogout}
                  className="flex items-center space-x-2 cursor-pointer"
                >
                  <LogOut className="h-4 w-4" />
                  <span>Sign Out</span>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          }
        />
      }
    >
      {/* Embedded Video Room - Full Screen Overlay */}
      {showVideoRoom && videoRoomUrl && (
        <MobileVideoRoom 
          roomUrl={videoRoomUrl} 
          onLeave={handleLeaveVideoRoom}
          durationMinutes={30}
        />
      )}

      {/* Main Content */}
      <div className="flex-1 py-4 space-y-4 ios-scroll">{/* Removed old header layout wrapper */}
        {/* Members Section */}
        <SectionCard className="mb-4">
          <SectionTitle 
            title="Circle Members" 
            icon={Users}
            actions={
              <div className="flex items-center space-x-2 bg-primary/5 px-3 py-2 rounded-lg">
                <span className="text-sm text-muted-foreground">Invite Code:</span>
                <span className="font-mono font-bold text-primary text-base tracking-tight">{circle.inviteCode}</span>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => {
                    navigator.clipboard.writeText(circle.inviteCode);
                    toast({
                      title: "Copied!",
                      description: "Invite code copied to clipboard",
                    });
                  }}
                  className="h-8 w-8 p-0 hover:bg-primary/10"
                >
                  <Copy className="h-4 w-4" />
                </Button>
              </div>
            }
          />
          
          <div className={`space-y-3 ${circle.members?.length <= 3 ? 'mt-2' : 'mt-4'}`}>
            {circle.members?.map((member: any, index: number) => (
              <div key={member.id} className="flex items-center space-x-3 p-3 bg-muted/30 rounded-lg">
                <AvatarBadge
                  name={member.user.firstName || member.user.email}
                  email={member.user.email}
                  size="md"
                  status="online"
                  interactive={member.user.id === user?.id}
                  onClick={member.user.id === user?.id ? () => setShowAccountSettings(true) : undefined}
                />
                <div className="flex-1 min-w-0">
                  <div className="font-medium text-foreground truncate tracking-tight">
                    {member.user.firstName 
                      ? member.user.firstName
                      : member.user.email
                    }
                  </div>
                  <div className="text-sm text-muted-foreground tracking-tight">
                    Member
                  </div>
                </div>
              </div>
            ))}
          </div>
        </SectionCard>
        {/* Will Status Section */}
        <SectionCard>
          <SectionTitle 
            title="Current Will" 
            icon={Target}
          />

          {willStatus === 'no_will' && (
            <div className="text-center py-8">
              <ActionButton 
                onClick={() => setLocation('/start-will')}
                variant="primary"
                size="lg"
                className="mx-auto mb-4"
                ariaLabel="Create a Will"
              >
                <Plus className="w-8 h-8" />
              </ActionButton>
              <h3 className="text-lg font-medium mb-2 tracking-tight">No active <em>Will</em></h3>
              <p className="text-muted-foreground mb-6 text-sm tracking-tight">Ready to commit to something meaningful together?</p>
              <div className="mt-3 mb-3 px-4">
                <PrimaryButton 
                  onClick={() => setLocation('/start-will')}
                  variant="primary"
                  size="lg"
                  fullWidth
                >
                  <span>Start a <em>Will</em></span>
                </PrimaryButton>
              </div>
            </div>
          )}

          {willStatus === 'pending' && (
            <div className="bg-white border border-gray-200 rounded-xl p-4 space-y-3 text-center shadow-sm">
              {/* Dynamic Will Initiator Message */}
              <div className="text-sm text-gray-600">
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
              <div className="flex justify-center items-center space-x-2 text-yellow-600 text-sm font-semibold">
                <Clock className="w-4 h-4" />
                <span><em>Will</em> Pending</span>
              </div>

              {/* Submission Progress */}
              <div className="text-sm text-gray-700">
                {will?.commitments?.length || 0} of {will?.memberCount || 0} members have submitted
              </div>

              {/* Compact Info Box */}
              <div className="bg-yellow-50 border border-yellow-200 rounded-md p-2 text-xs text-yellow-900">
                This <em>Will</em> will activate automatically at <span className="font-semibold">{formatActivationTime(will?.startDate)}</span>.
                <br />
                Anyone who hasn't submitted by then will not be included.
              </div>

              {/* Action Button */}
              <div className="mt-3 mb-3 px-4">
                <PrimaryButton onClick={handleViewWillDetails} size="lg" fullWidth>
                  <>View <em>Will</em> Details</>
                </PrimaryButton>
              </div>
            </div>
          )}

          {willStatus === 'scheduled' && (
            <div>
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center space-x-3">
                  <div className="w-12 h-12 bg-blue-100 rounded-xl flex items-center justify-center">
                    <Clock className="w-5 h-5 text-blue-600" />
                  </div>
                  <div>
                    <h3 className="font-semibold"><em>Will</em> Scheduled</h3>
                    <p className="text-sm text-muted-foreground">
                      Starts {formatActivationTime(will?.startDate)}
                    </p>
                  </div>
                </div>
                <Badge className="bg-blue-100 text-blue-800">
                  Scheduled
                </Badge>
              </div>
              
              <div className="bg-blue-50 rounded-xl p-4 mb-4">
                <div className="text-sm text-blue-700">
                  <svg className="w-4 h-4 inline mr-2" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                  </svg>
                  Your <em>Will</em> will begin in <span className="font-semibold">{formatTimeUntilStart(will?.startDate)}</span>
                </div>
              </div>
              
              <div className="mt-3 mb-3 px-4">
                <PrimaryButton onClick={handleViewWillDetails} size="lg" fullWidth>
                  <>View <em>Will</em> Details</>
                </PrimaryButton>
              </div>
            </div>
          )}

          {willStatus === 'active' && (
            <div>
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center space-x-3">
                  <div className="w-12 h-12 bg-green-100 rounded-xl flex items-center justify-center">
                    <CheckCircle className="w-5 h-5 text-green-600" />
                  </div>
                  <div>
                    <h3 className="font-semibold tracking-tight"><em>Will</em> Active</h3>
                    <p className="text-sm text-muted-foreground tracking-tight">Ends at {formatDisplayDateTime(will?.endDate)}</p>
                  </div>
                </div>
                <Badge className="bg-green-100 text-green-800">
                  Active
                </Badge>
              </div>
              
              <div className="mt-3 mb-3 px-4">
                <PrimaryButton onClick={handleViewWillDetails} size="lg" fullWidth>
                  <>View <em>Will</em> Details</>
                </PrimaryButton>
              </div>
            </div>
          )}

          {willStatus === 'waiting_for_end_room' && (
            <div className="p-4">
              {/* Check if End Room is currently active */}
              {will?.endRoomStatus === 'open' ? (
                // End Room is currently in progress
                <>
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-green-100 rounded-xl flex items-center justify-center">
                        <Video className="w-5 h-5 text-green-600" />
                      </div>
                      <div>
                        <div className="flex items-center">
                          <h3 className="font-semibold tracking-tight"><em>Will</em> - End Room in Process</h3>
                          <EndRoomTooltip className="ml-2" />
                        </div>
                        <p className="text-sm text-muted-foreground tracking-tight">
                          Closes at {will?.endRoomScheduledAt ? (() => {
                            const openTime = new Date(will.endRoomScheduledAt);
                            const closeTime = new Date(openTime.getTime() + 30 * 60 * 1000);
                            return formatEndRoomTime(closeTime.toISOString());
                          })() : 'N/A'}
                        </p>
                      </div>
                    </div>
                    <Badge className="bg-green-100 text-green-800">
                      Live
                    </Badge>
                  </div>
                  
                  <div className="mt-3 mb-3 px-4">
                    <PrimaryButton 
                      onClick={handleJoinEndRoom}
                      variant="secondary"
                      size="lg"
                      fullWidth
                    >
                      <>Join End Room</>
                    </PrimaryButton>
                  </div>
                </>
              ) : (
                // End Room is scheduled but not yet started
                <>
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-purple-100 rounded-xl flex items-center justify-center">
                        <Video className="w-5 h-5 text-purple-600" />
                      </div>
                      <div>
                        <div className="flex items-center">
                          <h3 className="font-semibold tracking-tight"><em>Will</em> - End Room</h3>
                          <EndRoomTooltip className="ml-2" />
                        </div>
                        <p className="text-sm text-muted-foreground tracking-tight">
                          Opens at {will?.endRoomScheduledAt ? formatEndRoomTime(will.endRoomScheduledAt) : 'N/A'}
                        </p>
                      </div>
                    </div>
                    <Badge className="bg-purple-100 text-purple-800">
                      Scheduled
                    </Badge>
                  </div>
                  
                  <div className="mt-3 mb-3 px-4">
                    <PrimaryButton 
                      onClick={handleViewWillDetails}
                      size="lg"
                      fullWidth
                    >
                      <>View End Room Details</>
                    </PrimaryButton>
                  </div>
                </>
              )}
            </div>
          )}

          {willStatus === 'completed' && (
            <div className="p-4">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-green-100 rounded-xl flex items-center justify-center">
                    <CheckCircle className="w-5 h-5 text-green-600" />
                  </div>
                  <div>
                    <h3 className="font-semibold tracking-tight"><em>Will</em> Complete - Ready to Review</h3>
                    <p className="text-sm text-muted-foreground tracking-tight">Review final summary to close out</p>
                  </div>
                </div>
                <Badge className="bg-green-100 text-green-800">
                  Complete
                </Badge>
              </div>
              
              <div className="mt-3 mb-3 px-4">
                <PrimaryButton 
                  onClick={handleViewWillDetails}
                  variant="secondary"
                  size="lg"
                  fullWidth
                >
                  <>Review Final Summary</>
                </PrimaryButton>
              </div>
            </div>
          )}
        </SectionCard>
      </div>

      {/* Account Settings Modal */}
      <AccountSettingsModal 
        isOpen={showAccountSettings}
        onClose={() => setShowAccountSettings(false)}
      />
      
      {/* Final Will Summary Modal */}
      {will && willStatus === 'completed' && (
        <FinalWillSummary 
          will={will}
          hasUserAcknowledged={will.hasUserAcknowledged}
          onClose={() => {
            queryClient.invalidateQueries({ queryKey: ['/api/wills/circle'] });
            queryClient.invalidateQueries({ queryKey: ['/api/circles/mine'] });
          }}
        />
      )}
    </MobileLayout>
  );
}