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
      <DialogContent className="max-w-md h-[90vh] overflow-hidden [&>button]:hidden animate-in slide-in-from-bottom-4 duration-300 fade-in">
        <div className="flex flex-col h-full p-6 rounded-xl bg-white shadow-xl space-y-4 mx-auto">
          {/* Refined Header */}
          <div className="text-center">
            <h2 className="text-xl font-semibold text-gray-900 mb-2">
              Your <em>Will</em> has been completed
            </h2>
            <h3 className="text-sm font-semibold text-gray-600 uppercase tracking-wide">
              Final Summary
            </h3>
          </div>

          {/* Main Content */}
          <div className="flex-1 space-y-4 w-full max-w-sm mx-auto">
            {/* Duration Block */}
            <div className="bg-gray-50 border border-gray-200 p-4 rounded-lg text-xs space-y-1 w-full">
              <div className="whitespace-nowrap text-center">
                <span className="font-semibold">Will:</span> {formatWillTimespan()}
              </div>
              {will.endRoomScheduledAt && (
                <div className="whitespace-nowrap text-center">
                  <span className="font-semibold">End Room:</span> {formatEndRoomTimespan()}
                </div>
              )}
            </div>

            {/* Member Commitments */}
            <div className="space-y-3 w-full">
              <h4 className="text-sm font-medium uppercase text-gray-600 tracking-wide text-center">Member Commitments</h4>
              <div className="space-y-3">
                {will.commitments?.map((commitment: any) => (
                  <div key={commitment.id} className="text-center">
                    <p className="font-semibold text-gray-900">
                      {commitment.user.firstName && commitment.user.lastName 
                        ? `${commitment.user.firstName} ${commitment.user.lastName}`
                        : commitment.user.email
                      }
                    </p>
                    <p className="text-gray-600 italic">
                      I will: {commitment.what || commitment.commitment}
                    </p>
                  </div>
                )) || []}
              </div>
            </div>
          </div>

          {/* Refined Actions Section */}
          <div className="mt-auto w-full max-w-sm mx-auto">
            {userParticipated ? (
              <div className="bg-green-50 border border-green-200 rounded-lg p-4 text-center">
                <div className="flex items-center justify-center mb-2">
                  <CheckCircle className="w-5 h-5 text-green-600 mr-2" />
                  <p className="font-semibold text-gray-900">
                    {hasUserAcknowledged ? <><em>Will</em> Acknowledged</> : "Acknowledge Completion"}
                  </p>
                </div>
                <p className="text-sm text-gray-700 mb-4">
                  {hasUserAcknowledged 
                    ? <>You have acknowledged this <em>Will</em>. It has been archived and you're ready to start a new one.</>
                    : <>This marks the end of your <em>will</em>. Once acknowledged, it will be archived and you'll be ready to start a new one.</>
                  }
                </p>
                {!hasUserAcknowledged && (
                  <Button 
                    onClick={onAcknowledge}
                    disabled={isAcknowledging}
                    className="w-full bg-green-600 hover:bg-green-700 hover:scale-105 transition-all duration-200 text-white py-2 rounded-lg"
                    size="sm"
                  >
                    {isAcknowledging ? "Acknowledging..." : "Acknowledge"}
                  </Button>
                )}
              </div>
            ) : (
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 text-center">
                <div className="flex items-center justify-center mb-2">
                  <CheckCircle className="w-5 h-5 text-blue-600 mr-2" />
                  <p className="font-semibold text-gray-900">
                    <em>Will</em> Complete
                  </p>
                </div>
                <p className="text-sm text-gray-700">
                  This <em>Will</em> has been completed. Only participating members need to acknowledge completion.
                </p>
              </div>
            )}

            {/* Back to Hub */}
            <div className="text-center mt-4">
              <button 
                onClick={onClose}
                className="text-blue-600 text-sm underline hover:text-blue-800 transition-colors"
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