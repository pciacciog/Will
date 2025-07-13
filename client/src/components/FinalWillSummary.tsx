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
      <DialogContent className="max-w-sm h-[90vh] overflow-hidden [&>button]:hidden animate-in slide-in-from-bottom-4 duration-300">
        <div className="flex flex-col h-full">
          {/* Compact Header */}
          <div className="text-center mb-3">
            <h1 className="text-lg font-bold text-gray-900 mb-1">
              Your <em>Will</em> has been completed
            </h1>
            <h2 className="text-sm font-bold text-gray-900">FINAL SUMMARY</h2>
          </div>

          {/* Main Content - Scrollable if needed */}
          <div className="flex-1 space-y-3">
            {/* Ultra Compact Duration Block */}
            <div className="bg-gray-50 rounded-lg p-2">
              <div className="space-y-1 text-xs">
                <div>
                  <span className="font-bold">Will:</span> {formatWillTimespan()}
                </div>
                {will.endRoomScheduledAt && (
                  <div>
                    <span className="font-bold">End Room:</span> {formatEndRoomTimespan()}
                  </div>
                )}
              </div>
            </div>

            {/* Compact Member Commitments */}
            <div>
              <h3 className="text-xs font-bold text-gray-900 mb-2">Member Commitments</h3>
              <div className="space-y-1">
                {will.commitments?.map((commitment: any) => (
                  <div key={commitment.id} className="py-1">
                    <div className="text-xs font-medium text-gray-700">
                      {commitment.user.firstName && commitment.user.lastName 
                        ? `${commitment.user.firstName} ${commitment.user.lastName}`
                        : commitment.user.email
                      }
                    </div>
                    <div className="text-xs text-gray-600">
                      I will {commitment.commitment}
                    </div>
                  </div>
                )) || []}
              </div>
            </div>
          </div>

          {/* Compact Actions Section */}
          <div className="mt-auto pt-3 border-t">
            {userParticipated ? (
              <div className="border-2 border-green-200 bg-green-50 rounded-lg p-3">
                <div className="text-center space-y-2">
                  <div className="flex items-center justify-center">
                    <CheckCircle className="w-4 h-4 text-green-600 mr-1" />
                    <h3 className="text-xs font-semibold text-gray-900">
                      {hasUserAcknowledged ? <><em>Will</em> Acknowledged</> : "Acknowledge Completion"}
                    </h3>
                  </div>
                  <p className="text-xs text-gray-600">
                    {hasUserAcknowledged 
                      ? <>Acknowledged. Ready for new <em>Will</em>.</>
                      : <>Mark complete to start new <em>Will</em>.</>
                    }
                  </p>
                  {!hasUserAcknowledged && (
                    <Button 
                      onClick={onAcknowledge}
                      disabled={isAcknowledging}
                      className="w-full bg-green-600 hover:bg-green-700 text-white py-1 px-3 mt-2"
                      size="sm"
                    >
                      {isAcknowledging ? "Acknowledging..." : "Acknowledge"}
                    </Button>
                  )}
                </div>
              </div>
            ) : (
              <div className="border-2 border-blue-200 bg-blue-50 rounded-lg p-3">
                <div className="text-center">
                  <div className="flex items-center justify-center mb-1">
                    <CheckCircle className="w-4 h-4 text-blue-600 mr-1" />
                    <h3 className="text-xs font-semibold text-gray-900">
                      <em>Will</em> Complete
                    </h3>
                  </div>
                  <p className="text-xs text-gray-600">
                    Completed. Participants will acknowledge.
                  </p>
                </div>
              </div>
            )}

            {/* Back to Hub */}
            <div className="text-center mt-3">
              <button 
                onClick={onClose}
                className="text-xs text-gray-600 hover:text-gray-800 underline"
              >
                Back to Hub
              </button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}