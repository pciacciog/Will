import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { CheckCircle, Clock, Users, Sparkles } from 'lucide-react';
import { useLocation } from 'wouter';

interface Acknowledgment {
  userId: string;
  acknowledgedAt: string;
  user?: { id: string; firstName: string | null; email: string };
}

interface FinalWillSummaryProps {
  isOpen: boolean;
  onClose: () => void;
  onAcknowledge: () => void;
  will: any;
  isAcknowledging?: boolean;
  currentUserId?: string;
  hasUserAcknowledged?: boolean;
  acknowledgedCount?: number;
  commitmentCount?: number;
  reviews?: any[];
  acknowledgments?: Acknowledgment[];
}

export function FinalWillSummary({ 
  isOpen, 
  onClose, 
  onAcknowledge, 
  will, 
  isAcknowledging = false, 
  currentUserId, 
  hasUserAcknowledged = false, 
  acknowledgedCount = 0, 
  commitmentCount = 0,
  reviews = [],
  acknowledgments = []
}: FinalWillSummaryProps) {
  const [, setLocation] = useLocation();
  
  if (!will) return null;

  const isSoloMode = will.mode === 'solo';

  const userParticipated = will.commitments?.some((commitment: any) => 
    commitment.userId === currentUserId
  ) || false;

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
    const endTime = new Date(startTime.getTime() + 30 * 60 * 1000);
    
    return `${formatCompactDateTime(will.endRoomScheduledAt)} – ${formatCompactDateTime(endTime.toISOString())}`;
  };

  const getReviewForUser = (userId: number) => {
    return reviews?.find((r: any) => r.userId === userId);
  };

  const hasUserAcknowledgedWill = (userId: string) => {
    return acknowledgments?.some((a: Acknowledgment) => a.userId === userId);
  };

  const getAcknowledgmentBadge = (userId: string) => {
    const hasAcked = hasUserAcknowledgedWill(userId);
    if (hasAcked) {
      return (
        <Badge className="bg-emerald-100 text-emerald-700 border border-emerald-200 text-[10px] px-1.5 py-0">
          Acknowledged
        </Badge>
      );
    }
    return (
      <Badge className="bg-amber-100 text-amber-700 border border-amber-200 text-[10px] px-1.5 py-0">
        Pending
      </Badge>
    );
  };

  const getFollowThroughBadge = (value: string) => {
    switch (value) {
      case 'yes':
        return (
          <Badge className="bg-emerald-100 text-emerald-700 border border-emerald-200 text-xs px-2 py-0.5">
            Yes
          </Badge>
        );
      case 'mostly':
        return (
          <Badge className="bg-amber-100 text-amber-700 border border-amber-200 text-xs px-2 py-0.5">
            Mostly
          </Badge>
        );
      case 'no':
        return (
          <Badge className="bg-rose-100 text-rose-700 border border-rose-200 text-xs px-2 py-0.5">
            No
          </Badge>
        );
      default:
        return (
          <Badge className="bg-gray-100 text-gray-500 border border-gray-200 text-xs px-2 py-0.5">
            Pending
          </Badge>
        );
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-sm h-screen overflow-hidden [&>button]:hidden animate-in slide-in-from-bottom-4 duration-300 fade-in p-0 border-0">
        {/* Glowy background effects */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute -top-20 -right-20 w-60 h-60 bg-gradient-to-br from-emerald-200/50 to-teal-300/40 rounded-full blur-3xl animate-pulse"></div>
          <div className="absolute -bottom-20 -left-20 w-60 h-60 bg-gradient-to-br from-purple-200/40 to-indigo-300/30 rounded-full blur-3xl animate-pulse" style={{ animationDelay: '1s' }}></div>
          <div className="absolute top-1/3 right-1/4 w-32 h-32 bg-gradient-to-br from-teal-100/50 to-emerald-200/40 rounded-full blur-2xl animate-pulse" style={{ animationDelay: '2s' }}></div>
        </div>

        <div className="relative h-full flex flex-col pt-[calc(env(safe-area-inset-top)+3rem)] pb-[calc(env(safe-area-inset-bottom)+1rem)] px-4">
          {/* Header with glowy icon - extra top breathing room */}
          <div className="text-center mb-3">
            <div className="inline-flex items-center justify-center mb-3">
              <div className="relative">
                <div className="absolute -inset-2 bg-gradient-to-r from-emerald-400 via-teal-400 to-emerald-500 rounded-full blur-xl opacity-40 animate-pulse"></div>
                <div className="absolute inset-0 bg-gradient-to-r from-emerald-400 to-teal-500 rounded-full blur-lg opacity-25"></div>
                <div className="relative w-14 h-14 bg-gradient-to-br from-emerald-50 to-teal-50 rounded-full border-2 border-emerald-200 flex items-center justify-center shadow-xl">
                  <Sparkles className="w-7 h-7 text-emerald-600" />
                </div>
              </div>
            </div>
            <h2 className="text-lg font-bold text-gray-900 mb-1">
              Your <em>Will</em> has been completed
            </h2>
            <p className="text-xs text-gray-500 uppercase tracking-wider font-medium">
              Final Summary
            </p>
          </div>

          {/* Duration Block with subtle glow */}
          <div className="relative mb-4">
            <div className="absolute -inset-0.5 bg-gradient-to-r from-gray-200 to-gray-300 rounded-xl blur-sm opacity-50"></div>
            <div className="relative bg-white/90 backdrop-blur-sm border border-gray-200 p-3 rounded-xl text-xs space-y-1.5">
              <div className="text-center">
                <span className="font-semibold text-gray-700">Will:</span>{' '}
                <span className="text-gray-600">{formatWillTimespan()}</span>
              </div>
              {will.endRoomScheduledAt && (
                <div className="text-center">
                  <span className="font-semibold text-gray-700">End Room:</span>{' '}
                  <span className="text-gray-600">{formatEndRoomTimespan()}</span>
                </div>
              )}
            </div>
          </div>

          {/* Member Commitments with Reviews - Threaded Layout */}
          <div className="flex-1 overflow-y-auto mb-3">
            <h4 className="text-xs font-semibold uppercase text-gray-500 tracking-wider text-center mb-3">
              {isSoloMode ? 'Your Commitment' : 'Circle Results'}
            </h4>
            <div className="space-y-3">
              {will.commitments?.map((commitment: any) => {
                const review = getReviewForUser(commitment.userId);
                const isCurrentUser = commitment.userId === currentUserId;
                
                return (
                  <div key={commitment.id} className="relative group">
                    {/* Subtle glow behind card */}
                    <div className={`absolute -inset-0.5 rounded-xl blur-sm opacity-30 ${
                      review?.followThrough === 'yes' ? 'bg-gradient-to-r from-emerald-300 to-teal-300' :
                      review?.followThrough === 'mostly' ? 'bg-gradient-to-r from-amber-300 to-yellow-300' :
                      review?.followThrough === 'no' ? 'bg-gradient-to-r from-rose-300 to-pink-300' :
                      'bg-gradient-to-r from-gray-200 to-gray-300'
                    }`}></div>
                    
                    <div className="relative bg-white/95 backdrop-blur-sm rounded-xl border border-gray-200 p-3 shadow-sm">
                      {/* Member Name Row */}
                      <div className="flex items-center gap-2 mb-1.5">
                        <span className="font-semibold text-gray-900 text-sm">
                          {commitment.user.firstName || commitment.user.email?.split('@')[0]}
                        </span>
                        {isCurrentUser && (
                          <Badge variant="secondary" className="text-[10px] bg-blue-100 text-blue-700 border-blue-200 px-1.5 py-0">
                            You
                          </Badge>
                        )}
                        {/* Acknowledgment Status Badge */}
                        {!isSoloMode && getAcknowledgmentBadge(commitment.userId)}
                      </div>
                      
                      {/* Commitment Text with Status Badge inline */}
                      <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
                        <p className="text-gray-700 text-sm leading-relaxed">
                          <span className="text-gray-500 font-medium">I will</span>{' '}
                          {commitment.what || commitment.commitment}
                        </p>
                        {/* Follow-through Badge - immediately next to commitment */}
                        {getFollowThroughBadge(review?.followThrough)}
                      </div>
                      
                      {/* Reflection Text (if present) */}
                      {review?.reflectionText && (
                        <p className="text-gray-500 text-xs italic mt-2 border-t border-gray-100 pt-2">
                          "{review.reflectionText}"
                        </p>
                      )}
                    </div>
                  </div>
                );
              }) || []}
            </div>
          </div>

          {/* Bottom Actions with glowy buttons */}
          <div className="space-y-3">
            {userParticipated ? (
              <div className="relative">
                <div className="absolute -inset-0.5 bg-gradient-to-r from-emerald-400 to-teal-500 rounded-xl blur-sm opacity-25"></div>
                <div className="relative bg-emerald-50/90 backdrop-blur-sm border border-emerald-200 rounded-xl p-3 text-center">
                  <div className="flex items-center justify-center mb-1.5">
                    <CheckCircle className="w-4 h-4 text-emerald-600 mr-2" />
                    <p className="font-semibold text-gray-900 text-sm">
                      {hasUserAcknowledged ? <><em>Will</em> Acknowledged</> : "Acknowledge Completion"}
                    </p>
                  </div>
                  <p className="text-xs text-gray-600 mb-2">
                    {hasUserAcknowledged 
                      ? <>Ready for new <em>Will</em> once all members acknowledge ({acknowledgedCount} / {commitmentCount}).</>
                      : <>Mark complete to start new <em>Will</em>.</>
                    }
                  </p>
                  {!hasUserAcknowledged && (
                    <Button 
                      onClick={onAcknowledge}
                      disabled={isAcknowledging}
                      className="w-full bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-600 hover:to-teal-600 text-white py-2 rounded-lg text-sm font-medium shadow-md"
                      size="sm"
                    >
                      {isAcknowledging ? "Acknowledging..." : "Acknowledge"}
                    </Button>
                  )}
                </div>
              </div>
            ) : (
              <div className="relative">
                <div className="absolute -inset-0.5 bg-gradient-to-r from-blue-400 to-indigo-500 rounded-xl blur-sm opacity-20"></div>
                <div className="relative bg-blue-50/90 backdrop-blur-sm border border-blue-200 rounded-xl p-3 text-center">
                  <div className="flex items-center justify-center mb-1">
                    <CheckCircle className="w-4 h-4 text-blue-600 mr-2" />
                    <p className="font-semibold text-gray-900 text-sm">
                      <em>Will</em> Complete
                    </p>
                  </div>
                  <p className="text-xs text-gray-600">
                    Only participating members need to acknowledge completion.
                  </p>
                </div>
              </div>
            )}

            {/* Navigation Buttons */}
            <div className="flex justify-center gap-3 pt-1">
              <button 
                onClick={() => {
                  onClose();
                  setTimeout(() => {
                    setLocation(isSoloMode ? '/solo/hub' : '/hub');
                  }, 100);
                }}
                className="bg-gradient-to-r from-blue-500 to-indigo-500 hover:from-blue-600 hover:to-indigo-600 text-white px-5 py-2.5 rounded-xl text-sm font-medium transition-all shadow-md hover:shadow-lg"
              >
                Back to Hub
              </button>
              {hasUserAcknowledged && (
                <button 
                  onClick={onClose}
                  className="bg-gray-100 hover:bg-gray-200 text-gray-700 px-5 py-2.5 rounded-xl text-sm font-medium transition-all border border-gray-200"
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
