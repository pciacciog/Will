import React from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { CheckCircle, Clock, Users, Video, Star, Target } from 'lucide-react';

interface FinalWillSummaryProps {
  isOpen: boolean;
  onClose: () => void;
  onAcknowledge: () => void;
  will: any;
  isAcknowledging?: boolean;
  currentUserId?: number;
  hasUserAcknowledged?: boolean;
}

export function FinalWillSummary({ isOpen, onClose, onAcknowledge, will, isAcknowledging = false, currentUserId, hasUserAcknowledged = false }: FinalWillSummaryProps) {
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

  const formatCompactDateTime = (dateString: string) => {
    const date = new Date(dateString);
    return `${date.getMonth() + 1}/${date.getDate()}/${date.getFullYear()}, ${date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })}`;
  };

  const formatWillTimespan = () => {
    return `${formatCompactDateTime(will.startDate)} – ${formatCompactDateTime(will.endDate)}`;
  };

  const formatEndRoomTimespan = () => {
    if (!will.endRoomScheduledAt) return '';
    
    const startTime = new Date(will.endRoomScheduledAt);
    const endTime = new Date(startTime.getTime() + 30 * 60 * 1000); // 30 minutes later
    
    return `${formatCompactDateTime(will.endRoomScheduledAt)} – ${formatCompactDateTime(endTime.toISOString())}`;
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
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-sm max-h-[90vh] overflow-y-auto [&>button]:hidden animate-in slide-in-from-bottom-4 duration-300">
        <DialogHeader>
          {/* Celebratory Header */}
          <div className="text-center mb-4">
            <div className="flex items-center justify-center mb-2">
              <Star className="w-6 h-6 text-yellow-500 mr-2" />
              <h1 className="text-xl font-bold text-gray-900">
                You did it — another <em>Will</em> complete!
              </h1>
              <Star className="w-6 h-6 text-yellow-500 ml-2" />
            </div>
          </div>
          
          {/* Final Summary Title */}
          <div className="text-center mt-2 mb-4">
            <h2 className="text-lg font-semibold text-gray-700">Final Summary</h2>
          </div>
        </DialogHeader>

        <div className="space-y-4">
          {/* Compact Duration Block */}
          <div className="bg-gray-50 rounded-lg p-3 mb-4">
            <div className="space-y-2 text-sm">
              <div>
                <span className="font-semibold">WILL:</span> {formatWillTimespan()}
              </div>
              {will.endRoomScheduledAt && (
                <div>
                  <span className="font-semibold">END ROOM:</span> {formatEndRoomTimespan()}
                </div>
              )}
            </div>
          </div>

          {/* Member Commitments */}
          <div className="mt-2 mb-4">
            <h3 className="text-sm font-bold text-gray-900 mb-3">Member Commitments</h3>
            <div className="space-y-2">
              {will.commitments?.map((commitment: any) => (
                <div key={commitment.id} className="py-2">
                  <div className="text-sm font-medium text-gray-700">
                    {commitment.user.firstName && commitment.user.lastName 
                      ? `${commitment.user.firstName} ${commitment.user.lastName}`
                      : commitment.user.email
                    }
                  </div>
                  <div className="text-sm text-gray-600 mt-1">
                    I will {commitment.commitment}
                  </div>
                </div>
              )) || []}
            </div>
          </div>

          {/* Acknowledge & Close Box */}
          {userParticipated ? (
            <div className="border-2 border-green-200 bg-green-50 rounded-lg p-4 mb-4">
              <div className="text-center space-y-3">
                <div className="flex items-center justify-center mb-2">
                  <Target className="w-5 h-5 text-green-600 mr-2" />
                  <h3 className="text-sm font-semibold text-gray-900">
                    {hasUserAcknowledged ? <><em>Will</em> Acknowledged</> : "Acknowledge Completion"}
                  </h3>
                </div>
                <p className="text-xs text-gray-600">
                  {hasUserAcknowledged 
                    ? <>You have acknowledged this <em>Will</em>. It will be archived and you can start a new one.</>
                    : <>This marks the end of your <em>will</em>. Once acknowledged, it will be archived and you'll be ready to start a new one.</>
                  }
                </p>
                {!hasUserAcknowledged && (
                  <Button 
                    onClick={onAcknowledge}
                    disabled={isAcknowledging}
                    className="w-full bg-green-600 hover:bg-green-700 text-white py-2 px-4 mt-3"
                    size="sm"
                  >
                    {isAcknowledging ? "Acknowledging..." : "Acknowledge"}
                  </Button>
                )}
              </div>
            </div>
          ) : (
            <div className="border-2 border-blue-200 bg-blue-50 rounded-lg p-4 mb-4">
              <div className="text-center space-y-3">
                <div className="flex items-center justify-center mb-2">
                  <CheckCircle className="w-5 h-5 text-blue-600 mr-2" />
                  <h3 className="text-sm font-semibold text-gray-900">
                    <em>Will</em> Complete
                  </h3>
                </div>
                <p className="text-xs text-gray-600">
                  This <em>Will</em> has been completed. Only participating members need to acknowledge completion.
                </p>
              </div>
            </div>
          )}

          {/* Back to Hub */}
          <div className="text-center">
            <button 
              onClick={onClose}
              className="text-sm text-gray-600 hover:text-gray-800 underline"
            >
              Back to Hub
            </button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}