import { useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ChevronLeft, Calendar, User, Users, Clock } from "lucide-react";

type WillHistoryItem = {
  id: number;
  mode: string;
  startDate: string;
  endDate: string;
  status: string;
  circle?: { id: number; inviteCode: string } | null;
  participants: {
    userId: string;
    firstName: string | null;
    lastName: string | null;
    email: string;
    commitment: string;
    followThrough: string | null;
    reflectionText: string | null;
  }[];
};

interface WillHistoryProps {
  mode: 'solo' | 'circle';
}

export default function WillHistory({ mode }: WillHistoryProps) {
  const [, setLocation] = useLocation();
  const isSolo = mode === 'solo';

  const { data: history, isLoading, error } = useQuery<WillHistoryItem[]>({
    queryKey: ['/api/wills/history', mode],
    queryFn: async () => {
      const response = await fetch(`/api/wills/history?mode=${mode}`, {
        credentials: 'include',
      });
      if (!response.ok) {
        throw new Error('Failed to fetch history');
      }
      return response.json();
    },
    retry: 1,
    staleTime: 30000,
  });

  const handleBack = () => {
    setLocation(isSolo ? '/solo/hub' : '/hub');
  };

  const formatDateRange = (startDate: string, endDate: string) => {
    const start = new Date(startDate);
    const end = new Date(endDate);
    const options: Intl.DateTimeFormatOptions = { month: 'short', day: 'numeric' };
    const yearOptions: Intl.DateTimeFormatOptions = { year: 'numeric' };
    
    const startStr = start.toLocaleDateString('en-US', options);
    const endStr = end.toLocaleDateString('en-US', options);
    const year = end.toLocaleDateString('en-US', yearOptions);
    
    return `${startStr} - ${endStr}, ${year}`;
  };

  const getFollowThroughBadge = (value: string | null) => {
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
            No Review
          </Badge>
        );
    }
  };

  const themeColors = isSolo
    ? {
        gradient: 'from-gray-50 via-white to-purple-50/30',
        iconBg: 'from-purple-50 to-indigo-50',
        iconBorder: 'border-purple-100',
        iconColor: 'text-purple-600',
        cardBorder: 'border-purple-100',
        headerColor: 'text-purple-700',
      }
    : {
        gradient: 'from-gray-50 via-white to-emerald-50/30',
        iconBg: 'from-emerald-50 to-teal-50',
        iconBorder: 'border-emerald-100',
        iconColor: 'text-emerald-600',
        cardBorder: 'border-emerald-100',
        headerColor: 'text-emerald-700',
      };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className={`animate-spin rounded-full h-8 w-8 border-b-2 ${isSolo ? 'border-purple-500' : 'border-emerald-500'}`}></div>
      </div>
    );
  }

  return (
    <div className={`min-h-screen bg-gradient-to-br ${themeColors.gradient}`}>
      <div className="pt-[calc(env(safe-area-inset-top)+3rem)] pb-[calc(env(safe-area-inset-bottom)+2rem)] min-h-screen">
        <div className="max-w-sm mx-auto px-5">
          
          {/* Header with Back Button */}
          <div className="flex items-center justify-between mb-4">
            <button
              onClick={handleBack}
              className="w-11 h-11 -ml-2 flex items-center justify-center"
              data-testid="button-back"
              aria-label="Go back"
            >
              <span className="w-8 h-8 flex items-center justify-center rounded-lg bg-gray-100 border border-gray-200 text-gray-700 hover:text-gray-900 hover:bg-gray-200 hover:border-gray-300 transition-all duration-200 active:scale-95">
                <ChevronLeft className="w-5 h-5" strokeWidth={2.5} />
              </span>
            </button>
            
            <div className="flex-1 text-center -ml-2">
              <h1 className="text-xl font-semibold text-gray-900">
                {isSolo ? 'Solo' : 'Circle'} History
              </h1>
            </div>
            
            <div className="w-9" />
          </div>

          {/* Mode Icon */}
          <div className="text-center mb-6">
            <div className="inline-flex items-center justify-center mb-2">
              <div className="relative">
                <div className={`relative w-12 h-12 bg-gradient-to-br ${themeColors.iconBg} rounded-full border-2 ${themeColors.iconBorder} flex items-center justify-center shadow-md`}>
                  {isSolo ? (
                    <User className={`w-6 h-6 ${themeColors.iconColor}`} />
                  ) : (
                    <Users className={`w-6 h-6 ${themeColors.iconColor}`} />
                  )}
                </div>
              </div>
            </div>
            <p className="text-gray-500 text-sm">
              Your completed {isSolo ? 'solo' : 'circle'} wills
            </p>
          </div>

          {/* History List */}
          {error ? (
            <div className="text-center py-12">
              <div className={`w-16 h-16 mx-auto mb-4 bg-gradient-to-br ${themeColors.iconBg} rounded-full border-2 ${themeColors.iconBorder} flex items-center justify-center`}>
                <Clock className={`w-8 h-8 ${themeColors.iconColor} opacity-50`} />
              </div>
              <h3 className="text-lg font-medium text-gray-900 mb-2">No History Available</h3>
              <p className="text-gray-500 text-sm">
                {isSolo 
                  ? "Complete your first solo Will to see it here."
                  : "Complete your first circle Will to see it here."
                }
              </p>
            </div>
          ) : history && history.length > 0 ? (
            <div className="space-y-4">
              {history.map((will) => (
                <Card 
                  key={will.id} 
                  className={`border ${themeColors.cardBorder} shadow-sm overflow-hidden`}
                  data-testid={`card-will-${will.id}`}
                >
                  <CardContent className="p-4">
                    {/* Date Header */}
                    <div className="flex items-center gap-2 mb-3 pb-2 border-b border-gray-100">
                      <Calendar className={`w-4 h-4 ${themeColors.iconColor}`} />
                      <span className={`text-sm font-medium ${themeColors.headerColor}`}>
                        {formatDateRange(will.startDate, will.endDate)}
                      </span>
                    </div>

                    {/* Participants */}
                    <div className="space-y-3">
                      {will.participants.map((participant, index) => (
                        <div 
                          key={`${will.id}-${participant.userId}`}
                          className="bg-gray-50 rounded-lg p-3 border border-gray-100"
                          data-testid={`participant-${will.id}-${index}`}
                        >
                          {/* Name and Status */}
                          <div className="flex items-center justify-between mb-1.5">
                            <span className="font-medium text-gray-900 text-sm">
                              {participant.firstName || participant.email.split('@')[0]}
                            </span>
                            {getFollowThroughBadge(participant.followThrough)}
                          </div>
                          
                          {/* Commitment */}
                          <p className="text-gray-700 text-sm">
                            <span className="text-gray-500">I will</span>{' '}
                            {participant.commitment}
                          </p>
                          
                          {/* Reflection (if present) */}
                          {participant.reflectionText && (
                            <p className="text-gray-500 text-xs italic mt-2 pt-2 border-t border-gray-100">
                              "{participant.reflectionText}"
                            </p>
                          )}
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : (
            <div className="text-center py-12">
              <div className={`w-16 h-16 mx-auto mb-4 bg-gradient-to-br ${themeColors.iconBg} rounded-full border-2 ${themeColors.iconBorder} flex items-center justify-center`}>
                <Clock className={`w-8 h-8 ${themeColors.iconColor} opacity-50`} />
              </div>
              <h3 className="text-lg font-medium text-gray-900 mb-2">No History Yet</h3>
              <p className="text-gray-500 text-sm">
                {isSolo 
                  ? "Complete your first solo Will to see it here."
                  : "Complete your first circle Will to see it here."
                }
              </p>
            </div>
          )}

        </div>
      </div>
    </div>
  );
}
