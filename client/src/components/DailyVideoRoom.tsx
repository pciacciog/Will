import React, { useEffect, useRef, useState, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { PhoneOff, Users, X, ExternalLink, AlertTriangle } from 'lucide-react';
import { Browser } from '@capacitor/browser';
import { Device } from '@capacitor/device';
import { useToast } from '@/hooks/use-toast';

interface DailyVideoRoomProps {
  roomUrl: string;
  onLeave: () => void;
  durationMinutes?: number;
}

declare global {
  interface Window {
    DailyIframe: any;
  }
}

export function DailyVideoRoom({ roomUrl, onLeave, durationMinutes = 30 }: DailyVideoRoomProps) {
  const { toast } = useToast();
  const containerRef = useRef<HTMLDivElement>(null);
  const callFrameRef = useRef<any>(null);
  
  const [isJoined, setIsJoined] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [timeRemaining, setTimeRemaining] = useState<string>('');
  const [joinStartTime, setJoinStartTime] = useState<Date | null>(null);
  const [isMobile, setIsMobile] = useState(false);
  const [participantCount, setParticipantCount] = useState(0);

  // Check device type
  useEffect(() => {
    const checkDevice = async () => {
      try {
        const deviceInfo = await Device.getInfo();
        const mobile = deviceInfo.platform === 'ios' || deviceInfo.platform === 'android';
        setIsMobile(mobile);
        console.log('Device detected:', deviceInfo.platform, mobile ? '(mobile)' : '(web)');
      } catch (err) {
        console.log('Device check failed, assuming web platform');
        setIsMobile(false);
      }
    };
    checkDevice();
  }, []);

  // Fallback to native browser
  const fallbackToBrowser = useCallback(async () => {
    console.log('Opening video room in native browser...');
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

  // Initialize Daily.co iframe
  const initializeDailyFrame = useCallback(async () => {
    if (!containerRef.current) return;

    try {
      setIsLoading(true);
      console.log('Initializing Daily.co iframe...');

      // Import Daily.co library directly
      let DailyIframe;
      try {
        const DailyModule = await import('@daily-co/daily-js');
        DailyIframe = DailyModule.default;
        console.log('Daily.co library loaded successfully');
      } catch (importError) {
        console.warn('Failed to import @daily-co/daily-js, trying CDN fallback...', importError);
        
        // Fallback to CDN if module import fails
        if (!window.DailyIframe) {
          const script = document.createElement('script');
          script.src = 'https://unpkg.com/@daily-co/daily-js';
          script.async = true;
          
          await new Promise((resolve, reject) => {
            script.onload = resolve;
            script.onerror = reject;
            document.head.appendChild(script);
          });
          
          // Wait for library to initialize
          await new Promise(resolve => setTimeout(resolve, 1000));
        }
        
        DailyIframe = window.DailyIframe;
      }

      if (!DailyIframe) {
        throw new Error('Daily.co library failed to load from both module and CDN');
      }

      // Create call frame with mobile-optimized settings
      const callFrame = DailyIframe.createFrame(containerRef.current, {
        showLeaveButton: false,
        showFullscreenButton: isMobile,
        showLocalVideo: true,
        showParticipantsBar: true,
        iframeStyle: {
          position: 'absolute',
          top: '0',
          left: '0',
          width: '100%',
          height: '100%',
          border: 'none'
        },
        theme: {
          accent: '#6366f1',
          accentText: '#ffffff',
          background: '#1f2937',
          backgroundAccent: '#374151',
          baseText: '#f3f4f6',
          border: '#4b5563',
          mainAreaBg: '#111827',
          mainAreaBgAccent: '#1f2937',
          mainAreaText: '#f3f4f6',
          supportiveText: '#d1d5db'
        }
      });

      callFrameRef.current = callFrame;

      // Set up event listeners
      callFrame.on('joined-meeting', (event: any) => {
        console.log('Successfully joined Daily.co meeting');
        setIsJoined(true);
        setIsLoading(false);
        setJoinStartTime(new Date());
        setError(null);
        
        toast({
          title: "Joined End Room",
          description: "You are now connected to the video call.",
        });
      });

      callFrame.on('left-meeting', () => {
        console.log('Left Daily.co meeting');
        setIsJoined(false);
        onLeave();
      });

      callFrame.on('error', (event: any) => {
        console.error('Daily.co error:', event);
        setError(`Video call error: ${event.errorMsg || 'Connection failed'}`);
        setIsLoading(false);
      });

      callFrame.on('participant-joined', () => {
        updateParticipantCount();
      });

      callFrame.on('participant-left', () => {
        updateParticipantCount();
      });

      callFrame.on('camera-error', () => {
        console.error('Camera permission denied');
        setError('Camera access denied. Please enable camera permissions and try again.');
      });

      callFrame.on('mic-error', () => {
        console.error('Microphone permission denied');
        setError('Microphone access denied. Please enable microphone permissions and try again.');
      });

      // Join the meeting with mobile-optimized settings
      console.log('Attempting to join room:', roomUrl);
      await callFrame.join({ 
        url: roomUrl,
        startVideoOff: false,
        startAudioOff: false,
        videoSource: true,
        audioSource: true
      });
      
      console.log('Successfully joined Daily.co room');

    } catch (err) {
      console.error('Failed to initialize Daily.co iframe:', err);
      setError('Failed to load video call. Please try opening in browser.');
      setIsLoading(false);
    }
  }, [roomUrl, onLeave, toast]);

  const updateParticipantCount = useCallback(() => {
    if (callFrameRef.current) {
      try {
        const participants = callFrameRef.current.participants();
        setParticipantCount(Object.keys(participants).length);
      } catch (err) {
        console.warn('Failed to get participant count:', err);
      }
    }
  }, []);

  // Auto-disconnect timer
  useEffect(() => {
    if (!joinStartTime || !isJoined) return;

    const interval = setInterval(() => {
      const now = new Date();
      const elapsed = now.getTime() - joinStartTime.getTime();
      const remaining = (durationMinutes * 60 * 1000) - elapsed;

      if (remaining <= 0) {
        console.log('Auto-disconnecting due to time limit');
        if (callFrameRef.current) {
          callFrameRef.current.leave();
        }
        return;
      }

      const minutes = Math.floor(remaining / (1000 * 60));
      const seconds = Math.floor((remaining % (1000 * 60)) / 1000);
      setTimeRemaining(`${minutes}:${seconds.toString().padStart(2, '0')}`);
    }, 1000);

    return () => clearInterval(interval);
  }, [joinStartTime, isJoined, durationMinutes]);

  // Initialize on mount
  useEffect(() => {
    initializeDailyFrame();

    return () => {
      if (callFrameRef.current) {
        try {
          callFrameRef.current.destroy();
        } catch (err) {
          console.warn('Error destroying call frame:', err);
        }
      }
    };
  }, [initializeDailyFrame]);

  const leaveCall = useCallback(() => {
    if (callFrameRef.current) {
      callFrameRef.current.leave();
    } else {
      onLeave();
    }
  }, [onLeave]);

  // Error state with fallback options
  if (error) {
    return (
      <div className="fixed inset-0 z-50 bg-gray-900 flex items-center justify-center p-4">
        <Card className="border-red-200 bg-red-50 max-w-md w-full">
          <CardHeader>
            <CardTitle className="text-red-800 flex items-center justify-between">
              <div className="flex items-center">
                <AlertTriangle className="w-5 h-5 mr-2" />
                Video Call Error
              </div>
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
                <ExternalLink className="w-4 h-4 mr-2" />
                Open in Browser
              </Button>
              <Button 
                onClick={() => {
                  setError(null);
                  setIsLoading(true);
                  initializeDailyFrame();
                }} 
                variant="outline"
              >
                Retry
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 bg-black flex flex-col">
      {/* Header */}
      <div className="bg-gray-800 p-4 flex justify-between items-center text-white">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <Users className="w-4 h-4" />
            <span className="text-sm">
              {participantCount > 0 ? `${participantCount} participant${participantCount !== 1 ? 's' : ''}` : 'End Room'}
            </span>
          </div>
          {timeRemaining && (
            <div className="text-sm bg-gray-700 px-3 py-1 rounded">
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
        <div 
          ref={containerRef}
          className="w-full h-full"
          style={{ minHeight: '400px' }}
        />
        
        {isLoading && (
          <div className="absolute inset-0 bg-gray-900 bg-opacity-90 flex items-center justify-center">
            <div className="text-white text-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-white mx-auto mb-4"></div>
              <p className="mb-2">Connecting to End Room...</p>
              <p className="text-sm text-gray-300">
                {isMobile ? 'Requesting camera and microphone access...' : 'Loading video call...'}
              </p>
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