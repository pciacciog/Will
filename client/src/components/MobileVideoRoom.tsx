import React, { useEffect, useState, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Phone, PhoneOff, ExternalLink, X, Users, AlertCircle, Video } from 'lucide-react';
import { Browser } from '@capacitor/browser';
import { Capacitor } from '@capacitor/core';
import { useToast } from '@/hooks/use-toast';

interface MobileVideoRoomProps {
  roomUrl: string;
  onLeave: () => void;
  durationMinutes?: number;
}

// Mobile-optimized video room component using Capacitor InAppBrowser
export function MobileVideoRoom({ roomUrl, onLeave, durationMinutes = 30 }: MobileVideoRoomProps) {
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Open video room with iOS-compatible solution
  const openVideoRoom = useCallback(async () => {
    try {
      console.log('Opening Daily.co room for mobile:', roomUrl);
      console.log('Platform:', Capacitor.getPlatform());
      
      // Check if running in Capacitor
      if (Capacitor.isNativePlatform()) {
        console.log('Running in Capacitor - attempting Browser plugin');
        
        // For iOS, we need to use a direct approach since Browser plugin may not work
        if (Capacitor.getPlatform() === 'ios') {
          console.log('iOS detected - using Safari fallback');
          // Direct Safari opening for iOS
          window.location.href = roomUrl;
          
          toast({
            title: "End Room Opened",
            description: "Video call opened in Safari.",
          });
          
          console.log('iOS Safari redirect successful');
          setIsLoading(false);
          return;
        }
        
        // For Android, try Browser plugin
        try {
          await Browser.open({ 
            url: roomUrl,
            presentationStyle: 'fullscreen'
          });
          
          toast({
            title: "End Room Opened",
            description: "Video call opened in browser.",
          });
          
          console.log('Capacitor Browser opened successfully');
          setIsLoading(false);
          return;
          
        } catch (capacitorError) {
          console.error('Capacitor Browser failed:', capacitorError);
          // If Browser plugin fails, fall back to Safari
          window.location.href = roomUrl;
          
          toast({
            title: "End Room Opened",
            description: "Video call opened in Safari.",
          });
          
          console.log('Safari fallback successful');
          setIsLoading(false);
          return;
        }
      } else {
        console.log('Running in web browser - using window.open');
        // For web, use window.open
        const newWindow = window.open(roomUrl, '_blank', 'noopener,noreferrer');
        
        if (newWindow) {
          toast({
            title: "End Room Opened",
            description: "Video call opened in new browser tab.",
          });
          
          console.log('window.open successful');
          setIsLoading(false);
          return;
        } else {
          throw new Error('Popup blocked or window.open failed');
        }
      }
      
    } catch (error) {
      console.error('Video room opening failed:', error);
      setError(`Unable to open video room automatically. ${error.message || 'Please try the manual options below.'}`);
      setIsLoading(false);
    }
  }, [roomUrl, toast]);

  // Open video room immediately for mobile devices
  useEffect(() => {
    const mobileTimeout = setTimeout(() => {
      console.log('Opening End Room for mobile with fallback support');
      openVideoRoom();
    }, 500); // Open after brief delay for better UX

    return () => clearTimeout(mobileTimeout);
  }, [openVideoRoom]);



  // Error state with retry option
  if (error) {
    return (
      <div className="fixed inset-0 z-50 bg-gray-900 flex items-center justify-center p-4 pt-[calc(env(safe-area-inset-top)+1rem)]">
        <Card className="border-red-200 bg-red-50 max-w-md w-full">
          <CardHeader>
            <CardTitle className="text-red-800 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <AlertCircle className="w-5 h-5" />
                Connection Error
              </div>
              <Button onClick={onLeave} variant="ghost" size="sm">
                <X className="w-4 h-4" />
              </Button>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-red-700 mb-4">{error}</p>
            <div className="space-y-3">
              <Button 
                onClick={openVideoRoom} 
                className="w-full bg-blue-600 hover:bg-blue-700 text-white"
                size="lg"
              >
                <Video className="w-4 h-4 mr-2" />
                Try Again
              </Button>
              <Button 
                onClick={() => {
                  // iOS-compatible system browser opening
                  if (Capacitor.getPlatform() === 'ios') {
                    window.location.href = roomUrl;
                  } else {
                    // For other platforms, try window.open first
                    const newWindow = window.open(roomUrl, '_blank', 'noopener,noreferrer');
                    if (!newWindow) {
                      window.location.href = roomUrl;
                    }
                  }
                  
                  toast({
                    title: "Opening Video Room",
                    description: "Video call opening in Safari.",
                  });
                }} 
                variant="outline"
                size="lg"
                className="w-full"
              >
                <ExternalLink className="w-4 h-4 mr-2" />
                Open in Safari
              </Button>
              <Button 
                onClick={() => {
                  // Copy URL to clipboard as final fallback
                  navigator.clipboard.writeText(roomUrl).then(() => {
                    toast({
                      title: "URL Copied",
                      description: "Video room URL copied to clipboard. Open it in your browser.",
                    });
                  }).catch(() => {
                    // If clipboard API fails, show the URL
                    alert(`Video room URL: ${roomUrl}`);
                  });
                }} 
                variant="outline"
                size="lg"
                className="w-full"
              >
                <AlertCircle className="w-4 h-4 mr-2" />
                Copy URL
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

  // Main mobile video interface - shows loading screen while InAppBrowser opens
  return (
    <div className="fixed inset-0 z-50 bg-gray-900 flex flex-col">
      {/* Safe area spacer for iOS */}
      <div className="flex-shrink-0 bg-gray-800 h-[env(safe-area-inset-top)] w-full"></div>
      
      {/* Header */}
      <div className="bg-gray-800 p-4 flex justify-between items-center text-white">
        <div className="flex items-center gap-2">
          <Video className="w-4 h-4" />
          <span className="text-sm">End Room</span>
        </div>
        
        <Button onClick={onLeave} variant="ghost" size="sm" className="text-white hover:bg-gray-700">
          <X className="w-4 h-4" />
        </Button>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex items-center justify-center p-6">
        <div className="text-center text-white max-w-md">
          {isLoading ? (
            <>
              <div className="w-16 h-16 mx-auto mb-6 bg-blue-600 rounded-full flex items-center justify-center">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-white"></div>
              </div>
              <h3 className="text-xl font-semibold mb-2">Opening End Room</h3>
              <p className="text-gray-300 mb-4">
                Opening your video call in a dedicated browser window for the best experience with camera and microphone support.
              </p>
              <p className="text-sm text-gray-400">
                The video room will open in a new window within the app.
              </p>
            </>
          ) : (
            <>
              <div className="w-16 h-16 mx-auto mb-6 bg-green-600 rounded-full flex items-center justify-center">
                <Video className="w-8 h-8 text-white" />
              </div>
              <h3 className="text-xl font-semibold mb-2">End Room Opened</h3>
              <p className="text-gray-300 mb-4">
                Your video call has been opened in a dedicated browser window. You can now participate in the End Room ceremony.
              </p>
              <p className="text-sm text-gray-400">
                Close this screen when you're done with the video call.
              </p>
            </>
          )}
        </div>
      </div>
      
      {/* Controls */}
      <div className="bg-gray-800 p-4 flex justify-center items-center gap-4">
        {!isLoading && (
          <Button 
            onClick={openVideoRoom} 
            variant="outline" 
            size="lg"
            className="text-white border-gray-600 hover:bg-gray-700 px-6 py-3"
          >
            <Video className="w-4 h-4 mr-2" />
            Reopen Video Room
          </Button>
        )}
        
        <Button
          onClick={onLeave}
          variant={isLoading ? "outline" : "destructive"}
          size="lg"
          className={`px-6 py-3 ${isLoading ? "text-white border-gray-600 hover:bg-gray-700" : ""}`}
        >
          <X className="w-5 h-5 mr-2" />
          {isLoading ? "Cancel" : "Close"}
        </Button>
      </div>
      
      {/* Safe area spacer for iOS bottom */}
      <div className="flex-shrink-0 bg-gray-800 h-[env(safe-area-inset-bottom)] w-full"></div>
    </div>
  );
}