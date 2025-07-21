import React, { useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Phone, PhoneOff, Mic, MicOff, Video, VideoOff, Users } from 'lucide-react';

interface EmbeddedVideoRoomProps {
  roomUrl: string;
  onLeave: () => void;
}

export function EmbeddedVideoRoom({ roomUrl, onLeave }: EmbeddedVideoRoomProps) {
  const callObjectRef = useRef<any>(null);
  const videoContainerRef = useRef<HTMLDivElement>(null);
  const [isJoined, setIsJoined] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [isVideoOff, setIsVideoOff] = useState(false);
  const [participantCount, setParticipantCount] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const initializeDaily = async () => {
      try {
        console.log('Initializing Daily.co video room...', roomUrl);
        
        // Dynamically import Daily to avoid SSR issues
        const Daily = (await import('@daily-co/daily-js')).default;
        
        // Create call object
        const callObject = Daily.createCallObject({
          audioSource: true,
          videoSource: true,
        });

        callObjectRef.current = callObject;
        console.log('Daily.co call object created successfully');

        // Set up event listeners
        callObject.on('joined-meeting', async () => {
          setIsJoined(true);
          setError(null);
          
          // Send End Room starting notification
          try {
            const { notificationService } = await import('@/services/NotificationService');
            await notificationService.sendEndRoomNotification('starting', 'now');
          } catch (error) {
            console.error('Failed to send End Room notification:', error);
          }
        });

        callObject.on('left-meeting', () => {
          setIsJoined(false);
          onLeave();
        });

        callObject.on('error', (error) => {
          console.error('Daily.co error:', error);
          setError(error.errorMsg || 'Video call error occurred');
        });

        callObject.on('participant-joined', () => {
          updateParticipantCount();
        });

        callObject.on('participant-left', () => {
          updateParticipantCount();
        });

        callObject.on('camera-error', () => {
          setError('Camera access denied. Please enable camera permissions.');
        });

        callObject.on('mic-error', () => {
          setError('Microphone access denied. Please enable microphone permissions.');
        });

        // Join the room
        await callObject.join({ url: roomUrl });
        setIsLoading(false);

      } catch (err) {
        console.error('Failed to initialize video call:', err);
        setError('Failed to connect to video room');
        setIsLoading(false);
      }
    };

    const updateParticipantCount = () => {
      if (callObjectRef.current) {
        const participants = callObjectRef.current.participants();
        setParticipantCount(Object.keys(participants).length);
      }
    };

    initializeDaily();

    return () => {
      if (callObjectRef.current) {
        try {
          callObjectRef.current.destroy();
        } catch (e) {
          console.warn('Error destroying call object:', e);
        }
      }
    };
  }, [roomUrl, onLeave]);

  const toggleMute = async () => {
    if (callObjectRef.current) {
      const newMutedState = !isMuted;
      await callObjectRef.current.setLocalAudio(!newMutedState);
      setIsMuted(newMutedState);
    }
  };

  const toggleVideo = async () => {
    if (callObjectRef.current) {
      const newVideoState = !isVideoOff;
      await callObjectRef.current.setLocalVideo(!newVideoState);
      setIsVideoOff(newVideoState);
    }
  };

  const leaveCall = async () => {
    if (callObjectRef.current) {
      await callObjectRef.current.leave();
    }
  };

  if (error) {
    return (
      <Card className="border-red-200 bg-red-50">
        <CardHeader>
          <CardTitle className="text-red-800">Video Call Error</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-red-700 mb-4">{error}</p>
          <Button onClick={onLeave} variant="outline">
            Return to Will Details
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="w-full h-full bg-black flex flex-col">
      {/* Video Container */}
      <div 
        ref={videoContainerRef}
        className="flex-1 bg-gray-900 relative"
        style={{ minHeight: '400px' }}
      />
      
      {/* Controls */}
      <div className="bg-gray-800 p-4 flex justify-between items-center">
        <div className="flex items-center gap-2 text-white">
          <Users className="w-4 h-4" />
          <span className="text-sm">{participantCount} participant{participantCount !== 1 ? 's' : ''}</span>
        </div>
        
        <div className="flex gap-2">
          <Button
            onClick={toggleMute}
            variant={isMuted ? "destructive" : "secondary"}
            size="sm"
            className="w-10 h-10 p-0"
          >
            {isMuted ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
          </Button>
          
          <Button
            onClick={toggleVideo}
            variant={isVideoOff ? "destructive" : "secondary"}
            size="sm"
            className="w-10 h-10 p-0"
          >
            {isVideoOff ? <VideoOff className="w-4 h-4" /> : <Video className="w-4 h-4" />}
          </Button>
          
          <Button
            onClick={leaveCall}
            variant="destructive"
            size="sm"
            className="w-10 h-10 p-0"
          >
            <PhoneOff className="w-4 h-4" />
          </Button>
        </div>
        
        <Button onClick={onLeave} variant="outline" size="sm">
          Exit
        </Button>
      </div>
      
      {(isLoading || !isJoined) && (
        <div className="absolute inset-0 bg-gray-900 bg-opacity-90 flex items-center justify-center z-10">
          <div className="text-white text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-white mx-auto mb-4"></div>
            <p>{isLoading ? 'Connecting to End Room...' : 'Joining video call...'}</p>
          </div>
        </div>
      )}
    </div>
  );
}