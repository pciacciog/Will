import React from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { CheckCircle, Clock, Users, Video } from 'lucide-react';

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

  const formatCompactTime = (dateString: string) => {
    const date = new Date(dateString);
    return `${date.getMonth() + 1}/${date.getDate()} ${date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })}`;
  };

  const formatEndRoomTimespan = () => {
    if (!will.endRoomScheduledAt) return '';
    
    const startTime = new Date(will.endRoomScheduledAt);
    const endTime = new Date(startTime.getTime() + 30 * 60 * 1000); // 30 minutes later
    
    return `${formatCompactTime(will.endRoomScheduledAt)} to ${formatCompactTime(endTime.toISOString())}`;
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
      <DialogContent className="max-w-sm max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-lg font-semibold text-left">
            ✅ <em>Will</em> – Final Summary
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Compact Time Summary Block */}
          <div className="bg-gray-50 rounded-lg p-3">
            <div className="space-y-1 text-sm">
              <div>
                <span className="font-medium">• <em>Will</em> Duration:</span> {formatCompactTime(will.startDate)} to {formatCompactTime(will.endDate)} ({calculateDuration()})
              </div>
              {will.endRoomScheduledAt && (
                <div>
                  <span className="font-medium">• End Room:</span> {formatEndRoomTimespan()} (30 mins)
                </div>
              )}
            </div>
          </div>

          {/* Member Commitments */}
          <div>
            <h3 className="text-sm font-semibold text-gray-900 mb-2">Member Commitments</h3>
            <div className="space-y-1 divide-y divide-gray-200">
              {will.commitments?.map((commitment: any) => (
                <div key={commitment.id} className="pt-1 first:pt-0">
                  <div className="text-sm text-gray-700">
                    ✅ <span className="font-medium">
                      {commitment.user.firstName && commitment.user.lastName 
                        ? `${commitment.user.firstName} ${commitment.user.lastName}`
                        : commitment.user.email
                      }
                    </span> – I will {commitment.commitment}
                  </div>
                </div>
              )) || []}
            </div>
          </div>

          {/* Acknowledge & Close Box */}
          {userParticipated ? (
            <div className="border-2 border-green-200 bg-green-50 rounded-lg p-3">
              <div className="text-center space-y-3">
                <div>
                  <h3 className="text-sm font-semibold text-gray-900 mb-1">
                    {hasUserAcknowledged ? <><em>Will</em> Acknowledged</> : "Acknowledge Completion"}
                  </h3>
                  <p className="text-xs text-gray-600">
                    {hasUserAcknowledged 
                      ? <>You have acknowledged this <em>Will</em>. It will be archived and you can start a new one.</>
                      : <>This marks the end of your <em>will</em>. Once acknowledged, it will be archived and you'll be ready to start a new one.</>
                    }
                  </p>
                </div>
                <Button 
                  onClick={hasUserAcknowledged ? onClose : onAcknowledge}
                  disabled={isAcknowledging}
                  className="w-full bg-green-600 hover:bg-green-700 text-white py-2 px-4"
                  size="sm"
                >
                  {isAcknowledging ? "Acknowledging..." : hasUserAcknowledged ? "Return to Dashboard" : <>Acknowledge and Close <em>Will</em></>}
                </Button>
              </div>
            </div>
          ) : (
            <div className="border-2 border-blue-200 bg-blue-50 rounded-lg p-3">
              <div className="text-center space-y-3">
                <div>
                  <h3 className="text-sm font-semibold text-gray-900 mb-1">
                    <em>Will</em> Complete
                  </h3>
                  <p className="text-xs text-gray-600">
                    This <em>Will</em> has been completed. Only participating members need to acknowledge completion.
                  </p>
                </div>
                <Button 
                  onClick={onClose}
                  className="w-full bg-blue-600 hover:bg-blue-700 text-white py-2 px-4"
                  size="sm"
                >
                  Close Summary
                </Button>
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