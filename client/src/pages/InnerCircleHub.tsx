import { useState, useEffect, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { useAuth } from "@/hooks/useAuth";
import { Copy, Settings, UserMinus, ChevronDown, Shield, Users, Target, Plus, Video, Clock, CheckCircle, ChevronLeft, History, Camera, X, ChevronRight } from "lucide-react";
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
import { MessageCircle } from "lucide-react";
import { sessionPersistence } from "@/services/SessionPersistence";

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

interface InnerCircleHubProps {
  circleId?: number;
}

type PendingProof = {
  tempId: string;
  blobUrl: string;
};

type ProofDrop = {
  id: number;
  userId: string;
  imageUrl: string;
  thumbnailUrl: string | null;
  caption: string | null;
  createdAt: string;
  firstName: string | null;
  email: string;
};

type PhotoModalState = {
  imageUrl: string;
  firstName: string | null;
  email: string;
  caption: string | null;
  createdAt: string;
  willTitle: string | null;
} | null;

export default function InnerCircleHub({ circleId }: InnerCircleHubProps) {
  const { user } = useAuth();
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [showAccountSettings, setShowAccountSettings] = useState(false);
  const [showVideoRoom, setShowVideoRoom] = useState(false);
  const [videoRoomUrl, setVideoRoomUrl] = useState<string | null>(null);
  const [showFinalSummary, setShowFinalSummary] = useState(false);
  const [pendingProofs, setPendingProofs] = useState<PendingProof[]>([]);
  const [photoModal, setPhotoModal] = useState<PhotoModalState>(null);
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const queryClient = useQueryClient();
  
  // Automatically refresh data when app comes back to foreground (mobile & web)
  useAppRefresh();

  // Fetch the specific circle by ID (required prop from /circles/:circleId route)
  const { data: circle, isLoading: circleLoading, isError: circleError } = useQuery<any>({
    queryKey: [`/api/circles/${circleId}`],
    enabled: !!user && !!circleId,
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

  const { data: notificationsData } = useQuery<{ notifications: { id: number; type: string; willId: number | null; circleId: number | null }[]; count: number }>({
    queryKey: ['/api/notifications'],
    refetchInterval: 30000,
    enabled: !!user,
  });

  const circleNotifications = notificationsData?.notifications?.filter(n => n.circleId === circleId) || [];
  const hasProposalNotification = circleNotifications.some(n => n.type === 'will_proposed');
  const hasReviewNotification = circleNotifications.some(n => n.type === 'review_required');

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
      if (!circle?.id) throw new Error("No circle to leave");
      const res = await apiRequest(`/api/circles/${circle.id}/leave`, { method: 'POST' });
      return await res.json();
    },
    onSuccess: () => {
      toast({
        title: "Success",
        description: "You have left the circle",
      });
      // Comprehensive cache invalidation to prevent stale data
      queryClient.invalidateQueries({ queryKey: ['/api/circles/mine'] });
      queryClient.invalidateQueries({ queryKey: ['/api/circles', circle?.id] });
      queryClient.invalidateQueries({ queryKey: ['/api/wills/circle'] });
      queryClient.invalidateQueries({ queryKey: [`/api/wills/circle/${circle?.id}`] });
      queryClient.invalidateQueries({ queryKey: ['/api/user'] });
      // Clear all cache to ensure fresh state
      queryClient.removeQueries({ queryKey: ['/api/circles/mine'] });
      queryClient.removeQueries({ queryKey: ['/api/circles', circle?.id] });
      queryClient.removeQueries({ queryKey: ['/api/wills/circle'] });
      queryClient.removeQueries({ queryKey: [`/api/wills/circle/${circle?.id}`] });
      // Go back to My Circles lobby
      setLocation('/circles');
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
      queryClient.invalidateQueries({ queryKey: ['/api/wills/history', 'circle'] });
      
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

  const markCircleNotificationsRead = async () => {
    if (!circleId || circleNotifications.length === 0) return;
    try {
      await apiRequest(`/api/notifications/circle/${circleId}/read`, { method: 'PATCH' });
      queryClient.invalidateQueries({ queryKey: ['/api/notifications'] });
    } catch (e) { /* non-critical */ }
  };

  const handleViewWillDetails = () => {
    if (will?.id) {
      markCircleNotificationsRead();
      sessionStorage.setItem('willBackUrl', `/circles/${circleId}`);
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

  // ── PROOF ─────────────────────────────────────────────────────────────────
  const { data: proofsData, refetch: refetchProofs } = useQuery<{ items: ProofDrop[]; hasMore: boolean }>({
    queryKey: [`/api/circles/${circleId}/proofs`, will?.id],
    queryFn: async () => {
      if (!circleId || !will?.id) return { items: [], hasMore: false };
      const token = await sessionPersistence.getToken();
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (token) headers['Authorization'] = `Bearer ${token}`;
      const resp = await fetch(getApiPath(`/api/circles/${circleId}/proofs?willId=${will.id}&limit=4`), {
        credentials: 'include',
        headers,
      });
      if (!resp.ok) throw new Error('Failed to fetch proofs');
      return resp.json();
    },
    enabled: !!circleId && !!will?.id,
    refetchInterval: 30000,
    staleTime: 0,
  });

  const proofItems: ProofDrop[] = proofsData?.items || [];

  const handleDropPhoto = async (file: File) => {
    if (isUploading) return;
    if (!circleId || !will?.id) return;

    const tempId = `tmp-${Date.now()}`;
    const blobUrl = URL.createObjectURL(file);
    setPendingProofs(prev => [...prev, { tempId, blobUrl }]);
    setIsUploading(true);

    let proofId: number | null = null;

    try {
      // 1. Get signed upload params
      const token = await sessionPersistence.getToken();
      const headers: Record<string, string> = {};
      if (token) headers['Authorization'] = `Bearer ${token}`;

      const signRes = await fetch(getApiPath('/api/cloudinary/sign'), { credentials: 'include', headers });
      if (!signRes.ok) {
        if (signRes.status === 503) throw new Error('Photo uploads are not configured yet.');
        throw new Error('Failed to get upload credentials.');
      }
      const { timestamp, signature, publicId: serverPublicId, apiKey: cApiKey, cloudName: cCloudName, eager: eagerTransform, uploadToken } = await signRes.json();

      // 2. Upload to Cloudinary using the server-assigned public_id
      const formData = new FormData();
      formData.append('file', file);
      formData.append('timestamp', String(timestamp));
      formData.append('signature', signature);
      formData.append('api_key', cApiKey);
      formData.append('public_id', serverPublicId);
      formData.append('transformation', 'c_limit,w_1200,h_1200,q_auto');
      if (eagerTransform) formData.append('eager', eagerTransform);

      const uploadRes = await fetch(`https://api.cloudinary.com/v1_1/${cCloudName}/image/upload`, {
        method: 'POST',
        body: formData,
      });
      if (!uploadRes.ok) throw new Error('Photo upload failed.');
      const uploadData = await uploadRes.json();

      const imageUrl: string = uploadData.secure_url;
      const cloudinaryPublicId: string = uploadData.public_id;
      // Build a 200×200 thumbnail URL
      const thumbnailUrl = imageUrl.replace('/upload/', '/upload/c_fill,w_200,h_200,q_auto/');

      // 3. Create proof record
      const createRes = await fetch(getApiPath(`/api/circles/${circleId}/proofs`), {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json', ...headers },
        body: JSON.stringify({ imageUrl, thumbnailUrl, cloudinaryPublicId, willId: will.id }),
      });
      if (!createRes.ok) {
        const err = await createRes.json().catch(() => ({}));
        // Cloudinary upload succeeded but DB save failed — clean up orphan asset using ownership-verified token
        if (uploadToken) {
          fetch(getApiPath('/api/cloudinary/abandon'), {
            method: 'POST',
            credentials: 'include',
            headers: { 'Content-Type': 'application/json', ...headers },
            body: JSON.stringify({ uploadToken }),
          }).catch(() => {});
        }
        throw new Error(err.message || 'Failed to save proof.');
      }
      const created = await createRes.json();
      proofId = created.id;

      // 4. Confirm proof
      const confirmRes = await fetch(getApiPath(`/api/proofs/${proofId}/confirm`), {
        method: 'PATCH',
        credentials: 'include',
        headers,
      });
      if (!confirmRes.ok) throw new Error('Failed to confirm proof.');

      await refetchProofs();
      toast({ title: 'Drop added!', description: 'Your proof has been posted.' });
    } catch (err: any) {
      console.error('[Proof] Upload error:', err);
      // If we have a proofId, mark it failed
      if (proofId) {
        const token2 = await sessionPersistence.getToken();
        const h: Record<string, string> = {};
        if (token2) h['Authorization'] = `Bearer ${token2}`;
        fetch(getApiPath(`/api/proofs/${proofId}/fail`), { method: 'PATCH', credentials: 'include', headers: h }).catch(() => {});
      }
      toast({
        title: 'Drop failed',
        description: err?.message || 'Something went wrong. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setPendingProofs(prev => prev.filter(p => p.tempId !== tempId));
      URL.revokeObjectURL(blobUrl);
      setIsUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };
  // ── END PROOF ──────────────────────────────────────────────────────────────

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

  // Show loading state while fetching circle
  if (circleLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-emerald-50/30">
        <div className="flex items-center justify-center min-h-screen">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-600"></div>
        </div>
      </div>
    );
  }

  // Show error if circleId is missing or fetch failed
  if (!circleId || !circle || circleError) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-emerald-50/30">
        <div className="flex items-center justify-center min-h-screen">
          <div className="text-center">
            <h2 className="text-2xl font-bold mb-4">Circle Not Found</h2>
            <p className="text-muted-foreground mb-6">This circle doesn't exist or you're not a member.</p>
            <Button 
              onClick={() => setLocation('/circles')} 
              className="bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white"
            >
              Go to My Circles
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

      <div className="pt-[calc(env(safe-area-inset-top)+4rem)] pb-[calc(env(safe-area-inset-bottom)+1rem)] min-h-screen">
        <div className="max-w-sm mx-auto px-5">
          
          {/* Header with Back Button - Title aligned closer to avatar */}
          <div className="flex items-center justify-between mb-1">
            {/* Back Button - goes to My Circles lobby if accessed from /circles/:circleId, otherwise home */}
            <button
              onClick={() => setLocation(circleId ? '/circles' : '/')}
              className="w-11 h-11 -ml-2 flex items-center justify-center"
              data-testid="button-back-home"
              aria-label="Go back to My Circles"
            >
              <span className="w-8 h-8 flex items-center justify-center rounded-lg bg-gray-100 border border-gray-200 text-gray-700 hover:text-gray-900 hover:bg-gray-200 hover:border-gray-300 transition-all duration-200 active:scale-95">
                <ChevronLeft className="w-5 h-5" strokeWidth={2.5} />
              </span>
            </button>
            
            {/* Title - positioned to align with user avatar */}
            <div className="flex-1 text-center">
              <h1 className="text-lg font-semibold text-gray-900">Circle</h1>
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

          {/* Circle Icon with Glow + Tagline + Chat Bubble */}
          <div className="relative text-center mb-4 mt-2">
            <div className="inline-flex items-center justify-center mb-1.5">
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
            <button
              onClick={() => circle && setLocation(`/circles/${circle.id}/messages`)}
              className="absolute right-0 top-1/2 -translate-y-1/2 w-14 h-14 flex items-center justify-center rounded-full bg-gradient-to-br from-emerald-500 to-teal-500 hover:from-emerald-600 hover:to-teal-600 text-white transition-all duration-200 active:scale-95 shadow-lg"
              data-testid="button-open-messages"
              aria-label="Open circle messages"
            >
              <MessageCircle className="w-10 h-10" strokeWidth={2.5} />
            </button>
          </div>

          {/* Members Section - More Breathing Room */}
          <div className="relative mb-4">
            <div className="absolute -inset-1 bg-gradient-to-r from-emerald-400 to-teal-500 rounded-2xl blur opacity-20"></div>
            <Card className="relative bg-white border-0 shadow-xl rounded-2xl overflow-hidden">
              <CardContent className="p-4">
                {/* Section Header */}
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center space-x-2">
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
                    if (count === 4) return 'grid-cols-4';
                    if (count === 5) return 'grid-cols-5';
                    if (count === 6) return 'grid-cols-6';
                    return 'grid-cols-3'; // fallback
                  })()
                }`}>
                  {circle.members?.map((member: any, index: number) => (
                    <div 
                      key={member.id} 
                      className={`flex flex-col items-center p-2 bg-gradient-to-br from-gray-50 to-emerald-50/30 rounded-xl border border-emerald-100/50 ${member.user.id === user?.id ? 'cursor-pointer hover:bg-emerald-50/50 transition-colors' : ''}`}
                      onClick={member.user.id === user?.id ? () => setShowAccountSettings(true) : undefined}
                    >
                      {/* Avatar with glow */}
                      <div className="relative mb-1">
                        <div className="absolute inset-0 bg-emerald-500/20 blur-sm rounded-full"></div>
                        <div className="relative w-9 h-9 bg-gradient-to-br from-emerald-500 to-teal-500 rounded-full flex items-center justify-center shadow-sm">
                          <span className="text-white font-semibold text-xs">
                            {(member.user.firstName || member.user.email)?.charAt(0).toUpperCase()}
                          </span>
                        </div>
                        {/* Online indicator */}
                        <div className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 bg-green-400 rounded-full border-2 border-white"></div>
                      </div>
                      <div className="text-center min-w-0 w-full">
                        <div className="font-medium text-gray-900 truncate text-xs leading-tight">
                          {member.user.firstName || member.user.email?.split('@')[0]}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
          
          {/* Will Status Section - Ultra Compact */}
          <div className="relative">
            <div className="absolute -inset-1 bg-gradient-to-r from-emerald-400 to-teal-500 rounded-2xl blur opacity-20"></div>
            <Card className="relative bg-white border-0 shadow-xl rounded-2xl overflow-hidden">
              <CardContent className="p-2.5">
                {/* Section Header - Compact */}
                <div className="flex items-center space-x-1.5 mb-2">
                  <Target className="w-3.5 h-3.5 text-emerald-600" />
                  <h3 className="font-semibold text-gray-900 text-xs">Current Will</h3>
                </div>

          {willStatus === 'no_will' && (
            <div className="text-center py-4">
              <button 
                onClick={() => setLocation(circle?.id ? `/circles/${circle.id}/start-will` : '/start-will')}
                className="mx-auto mb-3 w-16 h-16 bg-gradient-to-br from-emerald-500 to-teal-500 rounded-full flex items-center justify-center shadow-lg hover:shadow-xl transition-all duration-200 hover:scale-105"
                aria-label="Create a Will"
              >
                <Plus className="w-8 h-8 text-white stroke-[2.5]" />
              </button>
              <h3 className="text-base font-medium mb-1 tracking-tight text-gray-900">No active <em>Will</em></h3>
              <p className="text-gray-500 mb-4 text-sm tracking-tight">Ready to commit together?</p>
              <Button 
                onClick={() => setLocation(circle?.id ? `/circles/${circle.id}/start-will` : '/start-will')}
                className="w-full bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white py-2.5 rounded-xl shadow-md transition-all duration-200"
              >
                <span>Start a <em>Will</em></span>
              </Button>
            </div>
          )}

          {willStatus === 'pending' && (
            <div className={`bg-gradient-to-br from-amber-50/50 to-yellow-50/30 rounded-lg p-3 space-y-2 text-center ${hasProposalNotification ? 'border-2 border-amber-400 ring-2 ring-amber-200/50' : 'border border-amber-200/60'}`} data-testid="section-pending-will">
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
                {hasProposalNotification && (
                  <span className="w-2 h-2 bg-red-500 rounded-full animate-pulse" data-testid="dot-proposal-action"></span>
                )}
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
                    <h3 className="font-semibold tracking-tight text-gray-900 text-sm">
                      {will?.title ? <><em className="not-italic font-bold">{will.title}</em></> : <><em>Will</em> Active</>}
                    </h3>
                    <p className="text-xs text-gray-500 tracking-tight">{will?.isIndefinite ? 'Habit' : `Ends ${formatDisplayDateTime(will?.endDate)}`}</p>
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
            <div data-testid="section-will-review" className={hasReviewNotification ? 'ring-2 ring-purple-300/60 rounded-lg p-1 -m-1' : ''}>
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <div className="relative">
                    <div className={`absolute inset-0 ${hasReviewNotification ? 'bg-purple-500/30 animate-pulse' : 'bg-purple-500/20'} blur-sm rounded-lg`}></div>
                    <div className="relative w-9 h-9 bg-gradient-to-br from-purple-50 to-indigo-50 rounded-lg flex items-center justify-center border border-purple-100 shadow-sm">
                      <CheckCircle className="w-4 h-4 text-purple-600" />
                    </div>
                    {hasReviewNotification && (
                      <span className="absolute -top-1 -right-1 w-3 h-3 bg-red-500 rounded-full border-2 border-white animate-pulse" data-testid="dot-review-action"></span>
                    )}
                  </div>
                  <div>
                    <h3 className="font-semibold tracking-tight text-gray-900 text-sm" data-testid="text-will-review-heading">
                      <em>Will</em> Review
                    </h3>
                    <p className="text-xs text-gray-500 tracking-tight" data-testid="text-will-review-description">
                      {hasReviewNotification ? 'Your review is needed' : 'Reflect on your experience'}
                    </p>
                  </div>
                </div>
                <Badge className="bg-purple-100 text-purple-800 border border-purple-200 text-xs py-0.5" data-testid="badge-will-review">
                  Review
                </Badge>
              </div>
              
              <Button 
                onClick={() => {
                  markCircleNotificationsRead();
                  sessionStorage.setItem('willBackUrl', `/circles/${circleId}`);
                  setLocation(`/will/${will.id}`);
                }}
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

          {/* Hidden file input for proof uploads */}
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) handleDropPhoto(file);
            }}
          />

          {/* Proof Card — only visible for the active will */}
          {will && willStatus === 'active' && (
            <div className="relative mt-3">
              <div className="absolute -inset-1 bg-gradient-to-r from-emerald-400 to-teal-500 rounded-2xl blur opacity-20"></div>
              <Card className="relative bg-white border-0 shadow-xl rounded-2xl overflow-hidden">
                <CardContent className="p-3">
                  {/* Header */}
                  <div className="flex items-center justify-between mb-2.5">
                    <button
                      onClick={() => setLocation(`/circles/${circleId}/proof?willId=${will.id}`)}
                      className="flex items-center gap-1.5 hover:opacity-70 transition-opacity"
                      data-testid="button-proof-header"
                    >
                      <Camera className="w-4 h-4 text-emerald-600" />
                      <h3 className="font-semibold text-gray-900 text-sm">Proof</h3>
                    </button>
                    <button
                      onClick={() => fileInputRef.current?.click()}
                      disabled={isUploading}
                      className="flex items-center gap-1 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white text-xs font-medium px-2.5 py-1 rounded-full transition-colors"
                      data-testid="button-add-drop"
                    >
                      <Plus className="w-3 h-3" />
                      Drop
                    </button>
                  </div>

                  {/* Thumbnails row */}
                  {proofItems.length === 0 && pendingProofs.length === 0 ? (
                    <div className="flex items-center justify-center gap-2 py-3 text-gray-400">
                      <Camera className="w-4 h-4 opacity-50" />
                      <span className="text-xs">No drops yet — be the first</span>
                    </div>
                  ) : (
                    <div className="flex gap-2">
                      {/* Show up to 3 confirmed proofs */}
                      {proofItems.slice(0, 3).map((proof) => {
                        const initial = (proof.firstName || proof.email)?.charAt(0).toUpperCase() || '?';
                        const src = proof.thumbnailUrl || proof.imageUrl;
                        return (
                          <button
                            key={proof.id}
                            onClick={() => setPhotoModal({
                              imageUrl: proof.imageUrl,
                              firstName: proof.firstName,
                              email: proof.email,
                              caption: proof.caption,
                              createdAt: proof.createdAt,
                              willTitle: will?.title || will?.sharedWhat || null,
                            })}
                            className="relative w-16 h-16 rounded-[10px] overflow-hidden flex-shrink-0 border border-gray-100 shadow-sm hover:opacity-90 transition-opacity"
                            data-testid={`button-proof-thumb-${proof.id}`}
                          >
                            <img src={src} alt="Proof" className="w-full h-full object-cover" />
                            <span className="absolute top-0.5 left-0.5 w-4 h-4 bg-emerald-500 rounded-full flex items-center justify-center text-white font-bold text-[9px] shadow">
                              {initial}
                            </span>
                          </button>
                        );
                      })}

                      {/* Pending optimistic uploads */}
                      {pendingProofs.map((p) => (
                        <div
                          key={p.tempId}
                          className="relative w-16 h-16 rounded-[10px] overflow-hidden flex-shrink-0 border border-gray-100 shadow-sm"
                        >
                          <img src={p.blobUrl} alt="Uploading…" className="w-full h-full object-cover opacity-50" />
                          <div className="absolute inset-0 flex items-center justify-center">
                            <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                          </div>
                        </div>
                      ))}

                      {/* "+N more" tile */}
                      {proofsData?.hasMore || proofItems.length > 3 ? (
                        <button
                          onClick={() => setLocation(`/circles/${circleId}/proof?willId=${will.id}`)}
                          className="w-16 h-16 rounded-[10px] flex-shrink-0 border-2 border-dashed border-gray-200 flex flex-col items-center justify-center gap-0.5 hover:border-emerald-300 transition-colors"
                          data-testid="button-proof-more"
                        >
                          <Plus className="w-3.5 h-3.5 text-gray-400" />
                          <span className="text-[10px] text-gray-400 font-medium">
                            {proofsData?.hasMore ? `${proofItems.length - 3}+ more` : `${proofItems.length - 3} more`}
                          </span>
                        </button>
                      ) : null}
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          )}

          {/* History Link - Compact */}
          <div className="mt-4 text-center">
            <button
              onClick={() => setLocation('/circle/history')}
              className="inline-flex items-center gap-1.5 text-emerald-600 hover:text-emerald-700 text-xs font-medium transition-colors"
              data-testid="button-view-circle-history"
            >
              <History className="w-3.5 h-3.5" />
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
          acknowledgments={will.acknowledgments || []}
        />
      )}

      {/* Full-screen photo modal */}
      {photoModal && (
        <div
          className="fixed inset-0 z-50 bg-black/90 flex flex-col"
          onClick={() => setPhotoModal(null)}
        >
          <div className="flex items-center justify-between px-4 py-3 text-white">
            <div className="min-w-0">
              <p className="font-semibold text-sm truncate">
                {photoModal.firstName || photoModal.email?.split('@')[0]}
              </p>
              {photoModal.willTitle && (
                <p className="text-xs text-white/80 truncate">{photoModal.willTitle}</p>
              )}
              <p className="text-xs text-white/60">
                {new Date(photoModal.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}
              </p>
            </div>
            <button
              onClick={() => setPhotoModal(null)}
              className="w-8 h-8 flex items-center justify-center bg-white/10 rounded-full hover:bg-white/20 transition-colors flex-shrink-0"
              data-testid="button-close-photo-modal"
            >
              <X className="w-4 h-4 text-white" />
            </button>
          </div>
          <div
            className="flex-1 flex items-center justify-center px-4 pb-4"
            onClick={(e) => e.stopPropagation()}
          >
            <img
              src={photoModal.imageUrl}
              alt="Proof"
              className="max-w-full max-h-full rounded-xl object-contain shadow-2xl"
            />
          </div>
          {photoModal.caption && (
            <p className="text-white/80 text-sm px-4 pb-6 text-center">{photoModal.caption}</p>
          )}
        </div>
      )}
    </div>
  );
}