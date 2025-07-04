import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { useAuth } from "@/hooks/useAuth";
import { Copy, Settings, LogOut, UserMinus, ChevronDown, Shield } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { formatDisplayDateTime } from "@/lib/dateUtils";
import { apiRequest } from "@/lib/queryClient";
import AccountSettingsModal from "@/components/AccountSettingsModal";

function getWillStatus(will: any, memberCount: number): string {
  if (!will) return 'no_will';
  
  // If will is archived, treat as no will
  if (will.status === 'archived') return 'no_will';
  
  const now = new Date();
  const startDate = new Date(will.startDate);
  const endDate = new Date(will.endDate);

  if (now >= endDate) {
    // Check if all members have acknowledged
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

export default function InnerCircleHub() {
  const { user } = useAuth();
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [showAccountSettings, setShowAccountSettings] = useState(false);
  const queryClient = useQueryClient();

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

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-gray-900 mb-4">Access Denied</h2>
          <p className="text-gray-600 mb-6">Please log in to view your Inner Circle Hub.</p>
          <Button onClick={() => setLocation('/auth')}>
            Sign In
          </Button>
        </div>
      </div>
    );
  }

  if (!circle) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-gray-900 mb-4">No Inner Circle</h2>
          <p className="text-gray-600 mb-6">You need to be part of an Inner Circle first.</p>
          <Button onClick={() => setLocation('/inner-circle')}>
            Create or Join Circle
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 ios-safe-area-top ios-safe-area-bottom">
      {/* User Menu - iOS Safe Area Compatible */}
      <div className="fixed top-0 right-0 z-50 mobile-header" style={{ paddingTop: 'calc(env(safe-area-inset-top) + 8px)' }}>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" className="h-auto p-2 flex items-center space-x-2 text-gray-700 hover:text-gray-900 hover:bg-gray-100 mobile-text">
              <span className="text-sm font-medium truncate">
                {user?.firstName} {user?.lastName}
              </span>
              <ChevronDown className="h-4 w-4 flex-shrink-0" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-48">
            {user?.role === 'admin' && (
              <>
                <DropdownMenuItem 
                  onClick={() => setLocation('/admin')}
                  className="flex items-center space-x-2 cursor-pointer text-purple-600 hover:text-purple-700 hover:bg-purple-50"
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
              className="flex items-center space-x-2 cursor-pointer text-gray-600 hover:text-gray-700"
            >
              <LogOut className="h-4 w-4" />
              <span>Sign Out</span>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <div className="max-w-4xl mx-auto mobile-container" style={{ paddingTop: 'calc(env(safe-area-inset-top) + 80px)' }}>
        
        {/* Header */}
        <div className="relative mb-8 md:mb-12">
          {/* Main Header Content */}
          <div className="text-center">
            <h1 className="text-2xl md:text-3xl font-bold text-gray-900 mb-2 mobile-title">Inner Circle Hub</h1>
            <p className="text-base md:text-lg text-gray-600 italic tracking-wide mobile-subtitle">Become More — Together</p>
          </div>
        </div>
        
        {/* Members Section */}
        <Card className="mb-6 md:mb-8 mobile-card">
          <CardContent className="p-4 md:p-8">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-6 space-y-4 sm:space-y-0">
              <h2 className="text-lg md:text-xl font-semibold text-gray-900 flex items-center">
                <svg className="w-5 h-5 text-primary mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                </svg>
                Circle Members
              </h2>
              
              <div className="flex items-center space-x-2 bg-blue-50 px-3 py-2 rounded-lg">
                <span className="text-sm text-gray-600">Invite Code:</span>
                <span className="font-mono font-bold text-blue-600 text-base md:text-lg">{circle.inviteCode}</span>
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
                  className="h-8 w-8 p-0 hover:bg-blue-100 mobile-touch-target"
                >
                  <Copy className="h-4 w-4" />
                </Button>
              </div>
            </div>
            
            <div className="grid grid-cols-1 gap-4">
              {circle.members?.map((member: any, index: number) => (
                <div key={member.id} className="flex items-center space-x-4 p-6 bg-gray-50 rounded-xl mobile-touch-target min-h-[64px]">
                  <div className="w-14 h-14 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center flex-shrink-0">
                    <span className="text-white font-semibold text-xl">
                      {member.user.firstName?.charAt(0) || member.user.email?.charAt(0).toUpperCase() || '?'}
                    </span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-gray-900 text-lg truncate">
                      {member.user.firstName 
                        ? member.user.firstName
                        : member.user.email
                      }
                    </div>
                    <div className="text-base text-gray-500">
                      Member
                    </div>
                  </div>
                  <div className="w-4 h-4 bg-green-400 rounded-full flex-shrink-0" title="Online"></div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
        
        {/* Will Status Section */}
        <Card className="mobile-card">
          <CardContent className="p-4 md:p-8">
            <div className="mb-6">
              <h2 className="text-lg md:text-xl font-semibold text-gray-900 flex items-center">
                <svg className="w-5 h-5 text-primary mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                Current WILL
              </h2>
            </div>

            {willStatus === 'no_will' && (
              <div className="text-center py-8">
                <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-6">
                  <svg className="w-6 h-6 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                  </svg>
                </div>
                <h3 className="text-lg font-medium text-gray-900 mb-2">No active <em>Will</em></h3>
                <p className="text-gray-600 mb-6">Ready to commit to something meaningful together?</p>
                <Button 
                  onClick={() => setLocation('/start-will')}
                  className="bg-secondary hover:bg-green-600 mobile-button"
                >
                  Start a <em>Will</em>
                </Button>
              </div>
            )}

            {willStatus === 'pending' && (
              <div>
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center space-x-3">
                    <div className="w-12 h-12 bg-yellow-100 rounded-xl flex items-center justify-center">
                      <svg className="w-5 h-5 text-yellow-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                    </div>
                    <div>
                      <h3 className="font-semibold text-gray-900">WILL Pending</h3>
                      <p className="text-sm text-gray-600">
                        {will?.commitments?.length || 0} of {will?.memberCount || 0} members have submitted
                      </p>
                    </div>
                  </div>
                  <Badge variant="secondary" className="bg-yellow-100 text-yellow-800">
                    Pending
                  </Badge>
                </div>

                <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 mb-4">
                  <div className="flex items-start space-x-3">
                    <svg className="w-5 h-5 text-amber-600 mt-0.5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                    </svg>
                    <div className="text-sm text-amber-800">
                      <strong>Note:</strong> This <em>Will</em> becomes active automatically at the start date. Any member who has not submitted by then will not be included in the <em>Will</em>.
                    </div>
                  </div>
                </div>
                
                <Button onClick={handleViewWillDetails} className="w-full mobile-button">
                  View <em>Will</em> Details
                </Button>
              </div>
            )}

            {willStatus === 'scheduled' && (
              <div>
                <div className="flex items-center justify-between mb-6">
                  <div className="flex items-center space-x-3">
                    <div className="w-12 h-12 bg-blue-100 rounded-xl flex items-center justify-center">
                      <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                      </svg>
                    </div>
                    <div>
                      <h3 className="font-semibold text-gray-900">WILL Scheduled</h3>
                      <p className="text-sm text-gray-600">
                        Starts {formatDisplayDateTime(will?.startDate)}
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
                
                <Button onClick={handleViewWillDetails} className="w-full mobile-button">
                  View <em>Will</em> Details
                </Button>
              </div>
            )}

            {willStatus === 'active' && (
              <div>
                <div className="flex items-center justify-between mb-6">
                  <div className="flex items-center space-x-3">
                    <div className="w-12 h-12 bg-green-100 rounded-xl flex items-center justify-center">
                      <svg className="w-5 h-5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 18.657A8 8 0 016.343 7.343S7 9 9 10c0-2 .5-5 2.986-7C14 5 16.09 5.777 17.656 7.343A7.975 7.975 0 0120 13a7.975 7.975 0 01-2.343 5.657z" />
                      </svg>
                    </div>
                    <div>
                      <h3 className="font-semibold text-gray-900"><em>Will</em> Active</h3>
                      <p className="text-sm text-gray-600">{formatTimeRemaining(will?.endDate)}</p>
                    </div>
                  </div>
                  <Badge className="bg-green-100 text-green-800">
                    Active
                  </Badge>
                </div>
                
                <Button onClick={handleViewWillDetails} className="w-full mobile-button">
                  View <em>Will</em> Details
                </Button>
              </div>
            )}

            {willStatus === 'completed' && (
              <div className="text-center py-8"> {/* Simplified completion interface */}
                <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6">
                  <svg className="w-8 h-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z" />
                  </svg>
                </div>
                <h3 className="text-xl font-semibold text-gray-900 mb-2"><em>Will</em> Completed!</h3>
                <p className="text-gray-600 mb-6">Congratulations on completing your journey together</p>
                
                <Button className="bg-green-600 hover:bg-green-700 mobile-button" onClick={handleViewWillDetails}>
                  View
                </Button>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Account Settings Modal */}
        <AccountSettingsModal 
          isOpen={showAccountSettings}
          onClose={() => setShowAccountSettings(false)}
        />
      </div>
    </div>
  );
}