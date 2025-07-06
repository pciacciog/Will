import React, { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Clock, Video, Users, ExternalLink } from 'lucide-react';

interface EndRoomProps {
  willId: number;
}

interface EndRoomData {
  endRoomUrl: string;
  endRoomScheduledAt: string;
  endRoomStatus: string;
  isOpen: boolean;
  canJoin: boolean;
}

export function EndRoom({ willId }: EndRoomProps) {
  const [timeRemaining, setTimeRemaining] = useState<string>('');

  const { data: endRoomData, isLoading, error } = useQuery<EndRoomData>({
    queryKey: ['/api/wills', willId, 'end-room'],
    refetchInterval: 30000, // Check every 30 seconds for status updates
  });

  useEffect(() => {
    if (!endRoomData?.endRoomScheduledAt) return;

    const updateTimeRemaining = () => {
      const now = new Date().getTime();
      const scheduledTime = new Date(endRoomData.endRoomScheduledAt).getTime();
      const difference = scheduledTime - now;

      if (difference > 0) {
        const hours = Math.floor(difference / (1000 * 60 * 60));
        const minutes = Math.floor((difference % (1000 * 60 * 60)) / (1000 * 60));
        const seconds = Math.floor((difference % (1000 * 60)) / 1000);

        if (hours > 0) {
          setTimeRemaining(`${hours}h ${minutes}m ${seconds}s`);
        } else if (minutes > 0) {
          setTimeRemaining(`${minutes}m ${seconds}s`);
        } else {
          setTimeRemaining(`${seconds}s`);
        }
      } else {
        setTimeRemaining('Now');
      }
    };

    updateTimeRemaining();
    const interval = setInterval(updateTimeRemaining, 1000);
    
    return () => clearInterval(interval);
  }, [endRoomData?.endRoomScheduledAt]);

  const handleJoinRoom = () => {
    if (endRoomData?.endRoomUrl && endRoomData.canJoin) {
      window.open(endRoomData.endRoomUrl, '_blank');
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'pending':
        return <Badge variant="secondary" className="bg-yellow-100 text-yellow-800">Scheduled</Badge>;
      case 'open':
        return <Badge variant="secondary" className="bg-green-100 text-green-800">Open Now</Badge>;
      case 'completed':
        return <Badge variant="secondary" className="bg-gray-100 text-gray-800">Completed</Badge>;
      default:
        return <Badge variant="secondary">Unknown</Badge>;
    }
  };

  const formatDateTime = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      timeZoneName: 'short'
    });
  };

  const getExpirationTime = (startTime: string) => {
    const start = new Date(startTime);
    const expiration = new Date(start.getTime() + 30 * 60 * 1000);
    return expiration.toISOString();
  };

  if (isLoading) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="animate-pulse">
            <div className="h-4 bg-gray-200 rounded w-3/4 mb-2"></div>
            <div className="h-4 bg-gray-200 rounded w-1/2"></div>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (error || !endRoomData) {
    return null; // Don't show End Room section if not available
  }

  return (
    <Card className="border-2 border-purple-200 bg-gradient-to-r from-purple-50 to-indigo-50">
      <CardHeader className="pb-4">
        <CardTitle className="flex items-center gap-2 text-purple-900">
          <Video className="w-5 h-5" />
          End Room Ceremony
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium text-gray-700">Status:</span>
          {getStatusBadge(endRoomData.endRoomStatus)}
        </div>

        {endRoomData.endRoomScheduledAt && (
          <div className="space-y-3">
            <div className="flex items-center gap-2 text-sm text-gray-600">
              <Clock className="w-4 h-4" />
              <span>Schedule:</span>
            </div>
            <div className="ml-6 space-y-2">
              <div>
                <span className="text-xs text-gray-500">Opens at: </span>
                <span className="text-sm font-medium text-gray-900">{formatDateTime(endRoomData.endRoomScheduledAt)}</span>
              </div>
              <div>
                <span className="text-xs text-gray-500">Expires at: </span>
                <span className="text-sm font-medium text-gray-900">{formatDateTime(getExpirationTime(endRoomData.endRoomScheduledAt))}</span>
              </div>
              
              {endRoomData.endRoomStatus === 'pending' && timeRemaining && (
                <div>
                  <span className="text-xs text-gray-500">Starts in: </span>
                  <span className="text-sm font-mono font-bold text-purple-600">{timeRemaining}</span>
                </div>
              )}
            </div>
          </div>
        )}

        <div className="p-4 bg-white/70 rounded-lg border border-purple-100">
          <div className="flex items-start gap-2 mb-3">
            <Users className="w-4 h-4 text-purple-600 mt-0.5" />
            <div>
              <p className="text-sm font-medium text-gray-900">Group Reflection</p>
              <p className="text-xs text-gray-600">
                Connect with your circle to reflect on your shared journey and celebrate your progress.
              </p>
            </div>
          </div>
          
          {endRoomData.canJoin && endRoomData.isOpen ? (
            <Button 
              onClick={handleJoinRoom}
              className="w-full bg-purple-600 hover:bg-purple-700 text-white"
            >
              <ExternalLink className="w-4 h-4 mr-2" />
              Join End Room
            </Button>
          ) : endRoomData.endRoomStatus === 'pending' ? (
            <Button 
              disabled
              className="w-full"
              variant="outline"
            >
              Room opens {timeRemaining === 'Now' ? 'now' : `in ${timeRemaining}`}
            </Button>
          ) : endRoomData.endRoomStatus === 'completed' ? (
            <Button 
              disabled
              className="w-full"
              variant="outline"
            >
              Session completed
            </Button>
          ) : null}
        </div>

        <div className="text-xs text-gray-500 text-center">
          The End Room opens automatically for 30 minutes when scheduled.
        </div>
      </CardContent>
    </Card>
  );
}