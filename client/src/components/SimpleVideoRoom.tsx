import React, { useEffect, useRef, useState, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { PhoneOff, Users, X, ExternalLink, AlertTriangle } from 'lucide-react';
import { Browser } from '@capacitor/browser';
import { Device } from '@capacitor/device';
import { useToast } from '@/hooks/use-toast';

interface SimpleVideoRoomProps {
  roomUrl: string;
  onLeave: () => void;
  durationMinutes?: number;
}

export function SimpleVideoRoom({ roomUrl, onLeave, durationMinutes = 30 }: SimpleVideoRoomProps) {
  const { toast } = useToast();
  const iframeRef = useRef<HTMLIFrameElement>(null);
  
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [timeRemaining, setTimeRemaining] = useState<string>('');
  const [joinStartTime, setJoinStartTime] = useState<Date | null>(null);
  const [isMobile, setIsMobile] = useState(false);

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
        description: "Video call opened in your device's browser.",
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

  // Initialize iframe
  useEffect(() => {
    if (!iframeRef.current) return;

    console.log('Initializing iframe with URL:', roomUrl);
    setJoinStartTime(new Date());
    
    // Set up iframe load handlers
    const iframe = iframeRef.current;
    
    const handleLoad = () => {
      console.log('Iframe loaded successfully');
      setIsLoading(false);
      toast({
        title: "Joined End Room",
        description: "Video call is now active.",
      });
    };

    const handleError = () => {
      console.error('Iframe failed to load');
      setError('Failed to load video call. Please try opening in browser.');
      setIsLoading(false);
    };

    iframe.addEventListener('load', handleLoad);
    iframe.addEventListener('error', handleError);

    // Set loading timeout
    const timeout = setTimeout(() => {
      if (isLoading) {
        console.warn('Iframe loading timeout');
        setError('Video call is taking too long to load. Please try opening in browser.');
        setIsLoading(false);
      }
    }, 10000);

    return () => {
      iframe.removeEventListener('load', handleLoad);
      iframe.removeEventListener('error', handleError);
      clearTimeout(timeout);
    };
  }, [roomUrl, isLoading, toast]);

  // Auto-disconnect timer
  useEffect(() => {
    if (!joinStartTime) return;

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
  }, [joinStartTime, durationMinutes, onLeave]);

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
            <span className="text-sm">End Room</span>
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
        <iframe
          ref={iframeRef}
          src={roomUrl}
          style={{
            width: '100%',
            height: '100%',
            border: 'none'
          }}
          allow="camera; microphone; fullscreen; display-capture; autoplay"
          referrerPolicy="strict-origin-when-cross-origin"
          sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-popups-to-escape-sandbox allow-presentation allow-modals"
        />
        
        {isLoading && (
          <div className="absolute inset-0 bg-gray-900 bg-opacity-90 flex items-center justify-center">
            <div className="text-white text-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-white mx-auto mb-4"></div>
              <p className="mb-2">Connecting to End Room...</p>
              <p className="text-sm text-gray-300">
                Loading video call interface...
              </p>
            </div>
          </div>
        )}
      </div>
      
      {/* Controls */}
      <div className="bg-gray-800 p-4 flex justify-center items-center gap-4">
        <Button
          onClick={onLeave}
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