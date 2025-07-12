import React, { useEffect, useState, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Phone, PhoneOff, ExternalLink, X, Users, AlertCircle } from 'lucide-react';
import { Browser } from '@capacitor/browser';
import { useToast } from '@/hooks/use-toast';

interface MobileVideoRoomProps {
  roomUrl: string;
  onLeave: () => void;
  durationMinutes?: number;
}

// Mobile-optimized video room component
export function MobileVideoRoom({ roomUrl, onLeave, durationMinutes = 30 }: MobileVideoRoomProps) {
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [timeRemaining, setTimeRemaining] = useState<string>('');
  const [joinStartTime, setJoinStartTime] = useState<Date | null>(null);
  const [iframeLoaded, setIframeLoaded] = useState(false);

  // Open in native browser as fallback
  const openInBrowser = useCallback(async () => {
    try {
      console.log('Opening Daily.co room in native browser:', roomUrl);
      await Browser.open({ url: roomUrl });
      
      toast({
        title: "Opened in Browser",
        description: "Video room opened in your device's browser.",
      });
      
      // Leave the in-app video room since we're opening externally
      onLeave();
    } catch (browserError) {
      console.error('Failed to open browser:', browserError);
      // Fallback to regular window.open
      window.open(roomUrl, '_blank');
      onLeave();
    }
  }, [roomUrl, onLeave, toast]);

  // Handle iframe loading
  const handleIframeLoad = useCallback(() => {
    console.log('Mobile iframe loaded successfully');
    setIframeLoaded(true);
    setIsLoading(false);
    setJoinStartTime(new Date());
  }, []);

  // Handle iframe error
  const handleIframeError = useCallback(() => {
    console.error('Mobile iframe failed to load');
    setError('Video room cannot load in the app. Please use "Open in Browser" to join the video call.');
    setIsLoading(false);
  }, []);

  // Timer countdown
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

  // Initialize with a timeout to detect iframe loading issues
  useEffect(() => {
    const timeout = setTimeout(() => {
      if (!iframeLoaded && !error) {
        console.log('Mobile iframe timeout - showing fallback');
        setError('Video room is taking too long to load in the app. Please use "Open in Browser" to join the video call.');
        setIsLoading(false);
      }
    }, 10000); // Increased timeout to 10 seconds

    return () => clearTimeout(timeout);
  }, [iframeLoaded, error]);

  // Error state with prominent browser fallback
  if (error) {
    return (
      <div className="fixed inset-0 z-50 bg-gray-900 flex items-center justify-center p-4">
        <Card className="border-amber-200 bg-amber-50 max-w-md w-full">
          <CardHeader>
            <CardTitle className="text-amber-800 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <AlertCircle className="w-5 h-5" />
                End Room Issue
              </div>
              <Button onClick={onLeave} variant="ghost" size="sm">
                <X className="w-4 h-4" />
              </Button>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-amber-700 mb-4">{error}</p>
            <div className="space-y-3">
              <Button 
                onClick={openInBrowser} 
                className="w-full bg-blue-600 hover:bg-blue-700 text-white"
                size="lg"
              >
                <ExternalLink className="w-4 h-4 mr-2" />
                Open in Browser
              </Button>
              <Button 
                onClick={onLeave} 
                variant="outline" 
                size="lg"
                className="w-full"
              >
                Cancel
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Main mobile video interface
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
        {/* Mobile-optimized Daily.co iframe */}
        <div className="w-full h-full">
          <iframe
            src={roomUrl}
            style={{
              width: '100%',
              height: '100%',
              border: 'none',
              backgroundColor: '#1f2937'
            }}
            allow="camera *; microphone *; fullscreen *; display-capture *; autoplay *; clipboard-write *; geolocation *"
            referrerPolicy="strict-origin-when-cross-origin"
            sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-popups-to-escape-sandbox allow-presentation allow-camera allow-microphone allow-modals allow-downloads"
            onLoad={handleIframeLoad}
            onError={handleIframeError}
            title="Daily.co Video Room"
          />
        </div>
        
        {/* Loading overlay */}
        {isLoading && (
          <div className="absolute inset-0 bg-gray-900 bg-opacity-90 flex items-center justify-center">
            <div className="text-white text-center max-w-sm mx-auto">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-white mx-auto mb-4"></div>
              <p className="mb-2">Connecting to End Room...</p>
              <p className="text-sm text-gray-300">
                This may take a moment on mobile
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
          onClick={openInBrowser} 
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