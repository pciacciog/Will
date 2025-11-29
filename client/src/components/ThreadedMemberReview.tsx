import { Badge } from "@/components/ui/badge";
import { CheckCircle, Clock, MessageSquare } from "lucide-react";

interface ThreadedMemberReviewProps {
  commitment: {
    id: number;
    userId: number;
    what: string;
    user: {
      firstName: string;
      lastName?: string;
      email: string;
    };
  };
  review?: {
    id: number;
    followThrough: 'yes' | 'mostly' | 'no';
    reflectionText?: string;
    createdAt: string;
  } | null;
  isCurrentUser: boolean;
  isSoloMode?: boolean;
}

export function ThreadedMemberReview({ 
  commitment, 
  review, 
  isCurrentUser,
  isSoloMode = false 
}: ThreadedMemberReviewProps) {
  const displayName = commitment.user.firstName || commitment.user.email.split('@')[0];
  
  const getFollowThroughBadge = (value: string) => {
    switch (value) {
      case 'yes':
        return (
          <Badge className="bg-emerald-100 text-emerald-800 border-emerald-200">
            Yes
          </Badge>
        );
      case 'mostly':
        return (
          <Badge className="bg-amber-100 text-amber-800 border-amber-200">
            Mostly
          </Badge>
        );
      case 'no':
        return (
          <Badge className="bg-rose-100 text-rose-800 border-rose-200">
            No
          </Badge>
        );
      default:
        return null;
    }
  };

  return (
    <div 
      className={`rounded-xl border ${review ? 'border-gray-200 bg-white' : 'border-dashed border-gray-300 bg-gray-50/50'} overflow-hidden`}
      data-testid={`threaded-member-${commitment.id}`}
    >
      {/* Commitment Section - Top */}
      <div className="p-4 border-b border-gray-100">
        {/* Member Name & You Badge */}
        <div className="flex items-center gap-2 mb-2">
          <span className="font-semibold text-gray-900" data-testid={`member-name-${commitment.id}`}>
            {displayName}
          </span>
          {isCurrentUser && (
            <Badge variant="secondary" className="text-xs bg-blue-100 text-blue-700 border-blue-200">
              You
            </Badge>
          )}
        </div>
        
        {/* Commitment Text */}
        <div className="bg-gradient-to-r from-gray-50 to-white rounded-lg p-3 border border-gray-100">
          <p className="text-gray-800 text-sm leading-relaxed" data-testid={`commitment-text-${commitment.id}`}>
            <span className="font-medium text-gray-600">I will</span>{' '}
            {commitment.what}
          </p>
        </div>
      </div>

      {/* Reflection Section - Bottom */}
      <div className={`p-4 ${review ? 'bg-white' : 'bg-gray-50/30'}`}>
        {review ? (
          <div className="space-y-3">
            {/* Follow-through Badge Row */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <CheckCircle className="w-4 h-4 text-purple-500" />
                <span className="text-sm font-medium text-gray-600">Follow-through</span>
              </div>
              {getFollowThroughBadge(review.followThrough)}
            </div>
            
            {/* Reflection Text (if present) */}
            {review.reflectionText && review.reflectionText.trim() && (
              <div className="flex gap-2">
                <MessageSquare className="w-4 h-4 text-gray-400 mt-0.5 flex-shrink-0" />
                <p className="text-sm text-gray-700 leading-relaxed italic" data-testid={`reflection-text-${commitment.id}`}>
                  "{review.reflectionText}"
                </p>
              </div>
            )}
          </div>
        ) : (
          <div className="flex items-center gap-2 text-gray-500">
            <Clock className="w-4 h-4" />
            <span className="text-sm" data-testid={`awaiting-review-${commitment.id}`}>
              {isCurrentUser ? 'Complete your review above' : 'Awaiting review...'}
            </span>
          </div>
        )}
      </div>
    </div>
  );
}
