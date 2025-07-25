import React from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { CheckCircle, Clock, Users, Video } from 'lucide-react';
import { useLocation } from 'wouter';

interface FinalWillSummaryProps {
  isOpen: boolean;
  onClose: () => void;
  onAcknowledge: () => void;
  will: any;
  isAcknowledging?: boolean;
  currentUserId?: number;
  hasUserAcknowledged?: boolean;
  acknowledgedCount?: number;
  commitmentCount?: number;
}

export function FinalWillSummary({ isOpen, onClose, onAcknowledge, will, isAcknowledging = false, currentUserId, hasUserAcknowledged = false, acknowledgedCount = 0, commitmentCount = 0 }: FinalWillSummaryProps) {
  const [, setLocation] = useLocation();
  
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
      <DialogContent className="max-w-sm h-screen overflow-hidden [&>button]:hidden animate-in slide-in-from-bottom-4 duration-300 fade-in">
        <div className="h-full flex flex-col pt-[calc(env(safe-area-inset-top)+3rem)] pb-[calc(env(safe-area-inset-bottom)+1rem)] px-3 py-2">
          {/* Compact Header */}
          <div className="text-center mb-2">
            <h2 className="text-base font-semibold text-gray-900 mb-1">
              Your <em>Will</em> has been completed
            </h2>
            <h3 className="text-xs font-semibold text-gray-600 uppercase tracking-wide">
              Final Summary
            </h3>
          </div>

          {/* Compact Duration Block */}
          <div className="bg-gray-50 border border-gray-200 p-2 rounded-lg text-xs space-y-1 mb-2">
            <div className="text-center">
              <span className="font-semibold">Will:</span> {formatWillTimespan()}
            </div>
            {will.endRoomScheduledAt && (
              <div className="text-center">
                <span className="font-semibold">End Room:</span> {formatEndRoomTimespan()}
              </div>
            )}
          </div>

          {/* Compact Member Commitments */}
          <div className="flex-1 overflow-y-auto mb-2">
            <h4 className="text-xs font-medium uppercase text-gray-600 tracking-wide text-center mb-2">Member Commitments</h4>
            <div className="space-y-1">
              {will.commitments?.map((commitment: any) => (
                <div key={commitment.id} className="text-center space-y-0.5 py-1">
                  <p className="font-semibold text-gray-800 text-sm">
                    {commitment.user.firstName && commitment.user.lastName 
                      ? `${commitment.user.firstName} ${commitment.user.lastName}`
                      : commitment.user.email
                    }
                  </p>
                  <p className="text-gray-600 italic text-xs leading-tight">
                    I will: {commitment.what || commitment.commitment}
                  </p>
                </div>
              )) || []}
            </div>
          </div>

          {/* Compact Bottom Actions */}
          <div className="space-y-2">
            {userParticipated ? (
              <div className="bg-green-50 border border-green-200 rounded-lg p-2 text-center">
                <div className="flex items-center justify-center mb-1">
                  <CheckCircle className="w-4 h-4 text-green-600 mr-2" />
                  <p className="font-semibold text-gray-900 text-sm">
                    {hasUserAcknowledged ? <><em>Will</em> Acknowledged</> : "Acknowledge Completion"}
                  </p>
                </div>
                <p className="text-xs text-gray-700 mb-2">
                  {hasUserAcknowledged 
                    ? <>You have acknowledged this <em>Will</em>. Ready for new <em>Will</em> once all members acknowledge ({acknowledgedCount} / {commitmentCount}).</>
                    : <>Mark complete to start new <em>Will</em>.</>
                  }
                </p>
                {!hasUserAcknowledged && (
                  <Button 
                    onClick={onAcknowledge}
                    disabled={isAcknowledging}
                    className="w-full bg-green-600 hover:bg-green-700 text-white py-2 rounded-lg text-sm"
                    size="sm"
                  >
                    {isAcknowledging ? "Acknowledging..." : "Acknowledge"}
                  </Button>
                )}
              </div>
            ) : (
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-2 text-center">
                <div className="flex items-center justify-center mb-1">
                  <CheckCircle className="w-4 h-4 text-blue-600 mr-2" />
                  <p className="font-semibold text-gray-900 text-sm">
                    <em>Will</em> Complete
                  </p>
                </div>
                <p className="text-xs text-gray-700">
                  This <em>Will</em> has been completed. Only participating members need to acknowledge completion.
                </p>
              </div>
            )}

            {/* Enhanced Navigation Options */}
            <div className="flex justify-center space-x-4 pt-2">
              <button 
                onClick={() => {
                  console.log('Back to Hub button clicked');
                  onClose();
                  setTimeout(() => {
                    setLocation('/hub');
                  }, 100);
                }}
                className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
              >
                Back to Hub
              </button>
              {hasUserAcknowledged && (
                <button 
                  onClick={() => {
                    console.log('Close button clicked');
                    onClose();
                  }}
                  className="bg-gray-600 hover:bg-gray-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
                >
                  Close
                </button>
              )}
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}