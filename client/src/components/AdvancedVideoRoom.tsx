import React, { useEffect, useState, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Phone, PhoneOff, Mic, MicOff, Video, VideoOff, Users, X, ExternalLink } from 'lucide-react';
import { Device } from '@capacitor/device';
import { Browser } from '@capacitor/browser';
import { useToast } from '@/hooks/use-toast';

interface AdvancedVideoRoomProps {
  roomUrl: string;
  onLeave: () => void;
  durationMinutes?: number;
}

// Main video room component using iframe approach
export function AdvancedVideoRoom({ roomUrl, onLeave, durationMinutes = 30 }: AdvancedVideoRoomProps) {
  const { toast } = useToast();

  const [isJoined, setIsJoined] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [timeRemaining, setTimeRemaining] = useState<string>('');
  const [hasPermissions, setHasPermissions] = useState(false);
  const [joinStartTime, setJoinStartTime] = useState<Date | null>(null);
  const [isMobile, setIsMobile] = useState(false);

  // Request camera and microphone permissions
  const requestPermissions = useCallback(async () => {
    try {
      console.log('Checking device and requesting permissions...');
      
      // Check if we're on a mobile device
      const deviceInfo = await Device.getInfo();
      const mobile = deviceInfo.platform === 'ios' || deviceInfo.platform === 'android';
      setIsMobile(mobile);
      
      if (mobile) {
        console.log('Mobile device detected, using iframe approach');
      }
      
      // Permissions will be handled by iframe and browser
      setHasPermissions(true);
      return true;
      
    } catch (err) {
      console.error('Error checking device:', err);
      // Fallback: assume permissions are available
      setHasPermissions(true);
      return true;
    }
  }, []);

  // Fallback to native browser
  const fallbackToBrowser = useCallback(async () => {
    console.log('Falling back to native browser...');
    try {
      await Browser.open({ url: roomUrl });
      toast({
        title: "Opening in Browser",
        description: "Video call opened in your device's browser for better compatibility.",
      });
      onLeave();
    } catch (browserError) {
      window.open(roomUrl, '_blank');
      toast({
        title: "Opening in New Tab",
        description: "Video call opened in a new browser tab.",
      });
      onLeave();
    }
  }, [roomUrl, onLeave, toast]);

  // Initialize Daily call - simplified approach using iframe
  const initializeCall = useCallback(async () => {
    if (!hasPermissions) return;

    try {
      console.log('Initializing Daily call via iframe...');
      setIsLoading(true);
      
      // For iframe approach, we simulate joining
      const joinTimeout = setTimeout(async () => {
        setIsJoined(true);
        setIsLoading(false);
        setJoinStartTime(new Date());
        console.log('Successfully initialized iframe Daily call');
        
        // Send End Room live notification for mobile
        try {
          const { notificationService } = await import('@/services/NotificationService');
          await notificationService.sendEndRoomNotification('live', 'now');
        } catch (error) {
          console.error('Failed to send End Room notification:', error);
        }
      }, 3000); // Increased timeout to give iframe more time to load
      
      // Mobile fallback timeout - if iframe doesn't work on mobile, show error after 8 seconds
      if (isMobile) {
        setTimeout(() => {
          if (!isJoined) {
            console.log('Mobile iframe failed to load, showing fallback');
            setError('Video room needs to open in browser on mobile. Please use the "Open in Browser" button below.');
            setIsLoading(false);
            clearTimeout(joinTimeout);
          }
        }, 8000);
      }
      
    } catch (err) {
      console.error('Failed to initialize Daily iframe:', err);
      setError('Failed to connect to video room. Use "Open in Browser" button below for alternative access.');
    }
  }, [hasPermissions, isMobile, isJoined]);

  // No Daily SDK event listeners needed for iframe approach

  // Auto-disconnect timer
  useEffect(() => {
    if (!joinStartTime || !isJoined) return;

    const interval = setInterval(() => {
      const now = new Date();
      const elapsed = now.getTime() - joinStartTime.getTime();
      const remaining = (durationMinutes * 60 * 1000) - elapsed;

      if (remaining <= 0) {
        console.log('Auto-disconnecting due to time limit');
        onLeave();
        return;
      }

      const minutes = Math.floor(remaining / (1000 * 60));
      const seconds = Math.floor((remaining % (1000 * 60)) / 1000);
      setTimeRemaining(`${minutes}:${seconds.toString().padStart(2, '0')}`);
    }, 1000);

    return () => clearInterval(interval);
  }, [joinStartTime, isJoined, durationMinutes, onLeave]);

  // Initialize permissions and call
  useEffect(() => {
    const initialize = async () => {
      const permissionsGranted = await requestPermissions();
      if (permissionsGranted) {
        await initializeCall();
      }
    };

    initialize();
  }, [requestPermissions, initializeCall]);

  // Control functions - simplified for iframe approach
  const leaveCall = useCallback(async () => {
    console.log('Leaving video call');
    onLeave();
  }, [onLeave]);

  // Error state with fallback option
  if (error) {
    return (
      <div className="fixed inset-0 z-50 bg-gray-900 flex items-center justify-center p-4">
        <Card className="border-red-200 bg-red-50 max-w-md w-full">
          <CardHeader>
            <CardTitle className="text-red-800 flex items-center justify-between">
              Video Call Error
              <Button onClick={onLeave} variant="ghost" size="sm">
                <X className="w-4 h-4" />
              </Button>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-red-700 mb-4">{error}</p>
            <div className="flex gap-2">
              <Button 
                onClick={fallbackToBrowser} 
                className="flex-1"
              >
                Open in Browser
              </Button>
              <Button onClick={onLeave} variant="outline">
                Cancel
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Main video interface
  return (
    <div className="fixed inset-0 z-50 bg-black flex flex-col">
      {/* Header */}
      <div className="bg-gray-800 p-4 flex justify-between items-center text-white">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <Users className="w-4 h-4" />
            <span className="text-sm">End Room</span>
          </div>
          {timeRemaining && (
            <div className="text-sm bg-gray-700 px-2 py-1 rounded">
              {timeRemaining}
            </div>
          )}
        </div>
        
        <Button onClick={onLeave} variant="ghost" size="sm" className="text-white hover:bg-gray-700">
          <X className="w-4 h-4" />
        </Button>
      </div>

      {/* Video Container */}
      <div className="flex-1 relative bg-gray-900">
        {/* Daily's video iframe for better mobile compatibility */}
        <div className="w-full h-full">
          {isJoined && (
            <iframe
              src={roomUrl}
              style={{
                width: '100%',
                height: '100%',
                border: 'none',
                backgroundColor: '#1f2937'
              }}
              allow="camera *; microphone *; fullscreen *; display-capture *; autoplay *; clipboard-write"
              referrerPolicy="strict-origin-when-cross-origin"
              sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-popups-to-escape-sandbox allow-presentation allow-camera allow-microphone"
              onLoad={() => {
                console.log('Daily.co iframe loaded successfully');
              }}
              onError={(e) => {
                console.error('Daily.co iframe error:', e);
                setError('Video room failed to load. Please use the "Open in Browser" button below.');
              }}
            />
          )}
        </div>
        
        {(isLoading || !isJoined) && (
          <div className="absolute inset-0 bg-gray-900 bg-opacity-90 flex items-center justify-center">
            <div className="text-white text-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-white mx-auto mb-4"></div>
              <p className="mb-2">
                {isLoading ? 'Connecting to End Room...' : 'Joining video call...'}
              </p>
              {!hasPermissions && (
                <p className="text-sm text-gray-300">
                  Please allow camera and microphone access
                </p>
              )}
              {isMobile && (
                <p className="text-sm text-gray-300 mt-2">
                  If this doesn't work, try the "Open in Browser" button below
                </p>
              )}
            </div>
          </div>
        )}
      </div>
      
      {/* Controls */}
      <div className="bg-gray-800 p-4 flex justify-center items-center gap-4">
        <Button
          onClick={leaveCall}
          variant="destructive"
          size="lg"
          className="px-6 py-3"
        >
          <PhoneOff className="w-5 h-5 mr-2" />
          Leave Call
        </Button>
        
        <Button 
          onClick={fallbackToBrowser} 
          variant="outline" 
          size="lg"
          className="text-white border-gray-600 hover:bg-gray-700 px-6 py-3"
        >
          <ExternalLink className="w-4 h-4 mr-2" />
          Open in Browser
        </Button>
      </div>
    </div>
  );
}