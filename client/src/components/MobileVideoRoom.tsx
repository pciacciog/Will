import React, { useEffect, useState, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Phone, PhoneOff, ExternalLink, X, Users, AlertCircle, Video } from 'lucide-react';
import { Browser } from '@capacitor/browser';
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

  // Open in Capacitor InAppBrowser for proper WebRTC support
  const openInAppBrowser = useCallback(async () => {
    try {
      console.log('Opening Daily.co room in Capacitor InAppBrowser:', roomUrl);
      
      // Use Capacitor Browser with proper options for WebRTC support
      await Browser.open({ 
        url: roomUrl,
        windowName: 'endroom',
        toolbarColor: '#1f2937',
        presentationStyle: 'fullscreen'
      });
      
      toast({
        title: "End Room Opened",
        description: "Video call opened in dedicated browser window.",
      });
      
      // Don't leave immediately - let user manually close when done
      console.log('InAppBrowser opened successfully');
      setIsLoading(false);
      
    } catch (browserError) {
      console.error('Failed to open InAppBrowser:', browserError);
      setError('Unable to open video room. Please try again.');
      setIsLoading(false);
    }
  }, [roomUrl, toast]);

  // Open InAppBrowser immediately for mobile devices
  useEffect(() => {
    const mobileTimeout = setTimeout(() => {
      console.log('Opening End Room in InAppBrowser for proper WebRTC support');
      openInAppBrowser();
    }, 500); // Open after brief delay for better UX

    return () => clearTimeout(mobileTimeout);
  }, [openInAppBrowser]);



  // Error state with retry option
  if (error) {
    return (
      <div className="fixed inset-0 z-50 bg-gray-900 flex items-center justify-center p-4">
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
                onClick={openInAppBrowser} 
                className="w-full bg-blue-600 hover:bg-blue-700 text-white"
                size="lg"
              >
                <Video className="w-4 h-4 mr-2" />
                Try Again
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
            onClick={openInAppBrowser} 
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
    </div>
  );
}