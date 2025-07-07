import React from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { CheckCircle, Clock, Users, Video } from 'lucide-react';

interface FinalWillSummaryProps {
  isOpen: boolean;
  onClose: () => void;
  onAcknowledge: () => void;
  will: any;
  isAcknowledging?: boolean;
  currentUserId?: number;
}

export function FinalWillSummary({ isOpen, onClose, onAcknowledge, will, isAcknowledging = false, currentUserId }: FinalWillSummaryProps) {
  if (!will) return null;

  // Check if current user participated in this will
  const userParticipated = will.commitments?.some((commitment: any) => 
    commitment.userId === currentUserId
  ) || false;

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

  const formatEndRoomTimespan = () => {
    if (!will.endRoomScheduledAt) return '';
    
    const startTime = new Date(will.endRoomScheduledAt);
    const endTime = new Date(startTime.getTime() + 30 * 60 * 1000); // 30 minutes later
    
    const formatTime = (date: Date) => {
      return `${date.getMonth() + 1}/${date.getDate()} ${date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })}`;
    };
    
    return `${formatTime(startTime)} to ${formatTime(endTime)}`;
  };

  const formatEndRoomStart = () => {
    if (!will.endRoomScheduledAt) return "Not scheduled";
    return formatDateTime(will.endRoomScheduledAt);
  };

  const formatEndRoomEnd = () => {
    if (!will.endRoomScheduledAt) return "Not scheduled";
    const startTime = new Date(will.endRoomScheduledAt);
    const endTime = new Date(startTime.getTime() + 30 * 60 * 1000); // 30 minutes later
    return formatDateTime(endTime.toISOString());
  };

  const calculateDuration = () => {
    const start = new Date(will.startDate);
    const end = new Date(will.endDate);
    const diff = end.getTime() - start.getTime();
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
  };

  return (
    <Dialog open={isOpen} onOpenChange={userParticipated ? onClose : onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-3 text-2xl">
            <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center">
              <CheckCircle className="w-6 h-6 text-green-600" />
            </div>
            <em>Will</em> Complete - Final Summary
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {/* Will Duration Summary */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Clock className="w-5 h-5 text-blue-600" />
                <em>Will</em> Duration
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <span className="font-medium text-gray-700">Started:</span>
                  <p className="text-gray-600">{formatDateTime(will.startDate)}</p>
                </div>
                <div>
                  <span className="font-medium text-gray-700">Ended:</span>
                  <p className="text-gray-600">{formatDateTime(will.endDate)}</p>
                </div>
              </div>
              <div>
                <span className="font-medium text-gray-700">Total Duration:</span>
                <p className="text-gray-600">{calculateDuration()}</p>
              </div>
            </CardContent>
          </Card>

          {/* Member Commitments */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Users className="w-5 h-5 text-purple-600" />
                Member Commitments
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {will.commitments?.map((commitment: any) => (
                  <div 
                    key={commitment.id}
                    className="border-l-4 border-purple-500 pl-4 py-3 bg-purple-50 rounded-r-lg"
                  >
                    <div className="font-medium text-gray-900 mb-1">
                      {commitment.user.firstName && commitment.user.lastName 
                        ? `${commitment.user.firstName} ${commitment.user.lastName}`
                        : commitment.user.email
                      }
                    </div>
                    <p className="text-gray-700 mb-2">
                      <span className="font-medium">I will</span> {commitment.commitment}
                    </p>
                    <Badge variant="secondary" className="bg-purple-100 text-purple-800">
                      Committed
                    </Badge>
                  </div>
                )) || []}
              </div>
            </CardContent>
          </Card>

          {/* End Room Summary */}
          {will.endRoomScheduledAt && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Video className="w-5 h-5 text-green-600" />
                  End Room
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <span className="font-medium text-gray-700">Started:</span>
                    <p className="text-gray-600">{formatEndRoomStart()}</p>
                  </div>
                  <div>
                    <span className="font-medium text-gray-700">Ended:</span>
                    <p className="text-gray-600">{formatEndRoomEnd()}</p>
                  </div>
                </div>
                <div>
                  <span className="font-medium text-gray-700">Total Duration:</span>
                  <p className="text-gray-600">30 minutes</p>
                </div>
                <div>
                  <span className="font-medium text-gray-700">Participants:</span>
                  <div className="mt-2 space-y-2">
                    {will.commitments?.filter((commitment: any) => commitment.user).map((commitment: any) => (
                      <div key={commitment.id} className="flex items-center gap-2">
                        <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                        <span className="text-gray-600">
                          {commitment.user.firstName && commitment.user.lastName 
                            ? `${commitment.user.firstName} ${commitment.user.lastName}`
                            : commitment.user.email
                          }
                        </span>
                      </div>
                    )) || []}
                  </div>
                </div>
                <div>
                  <span className="font-medium text-gray-700">Status:</span>
                  <Badge className="ml-2 bg-green-100 text-green-800">
                    Completed
                  </Badge>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Acknowledgment Section - Only show for participating users */}
          {userParticipated ? (
            <Card className="border-2 border-green-200 bg-green-50">
              <CardContent className="p-6">
                <div className="text-center space-y-4">
                  <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto">
                    <CheckCircle className="w-8 h-8 text-green-600" />
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900 mb-2">
                      Acknowledge <em>Will</em> Completion
                    </h3>
                    <p className="text-gray-600 mb-6">
                      This marks the end of your will. Once acknowledged, it will be archived and you'll be ready to start a new one.
                    </p>
                  </div>
                  <Button 
                    onClick={onAcknowledge}
                    disabled={isAcknowledging}
                    className="bg-green-600 hover:bg-green-700 text-white px-8 py-3 text-lg"
                    size="lg"
                  >
                    {isAcknowledging ? "Acknowledging..." : "Acknowledge and Close Will"}
                  </Button>
                </div>
              </CardContent>
            </Card>
          ) : (
            <Card className="border-2 border-blue-200 bg-blue-50">
              <CardContent className="p-6">
                <div className="text-center space-y-4">
                  <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto">
                    <CheckCircle className="w-8 h-8 text-blue-600" />
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900 mb-2">
                      <em>Will</em> Complete
                    </h3>
                    <p className="text-gray-600 mb-6">
                      This <em>Will</em> has been completed. Only participating members need to acknowledge completion.
                    </p>
                  </div>
                  <Button 
                    onClick={onClose}
                    className="bg-blue-600 hover:bg-blue-700 text-white px-8 py-3 text-lg"
                    size="lg"
                  >
                    Close Summary
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}