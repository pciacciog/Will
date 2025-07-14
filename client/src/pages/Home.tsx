import { useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Target, ChevronDown, ChevronUp } from "lucide-react";

function getWillStatus(will: any, memberCount: number): string {
  if (!will) return 'no_will';
  
  // If will is archived, treat as no will
  if (will.status === 'archived') return 'no_will';
  
  // If will has explicit status, use it (for End Room flow)
  if (will.status === 'waiting_for_end_room') {
    return will.status;
  }
  
  // Special handling for completed status
  if (will.status === 'completed') {
    const committedMemberCount = will.commitments?.length || 0;
    const acknowledgedCount = will.acknowledgedCount || 0;
    
    // If all committed members have acknowledged, show no_will to allow new Will creation
    if (acknowledgedCount >= committedMemberCount) {
      return 'no_will';
    }
    return 'completed';
  }
  
  const now = new Date();
  const startDate = new Date(will.startDate);
  const endDate = new Date(will.endDate);

  if (now >= endDate) {
    // Will should transition to waiting_for_end_room, but check acknowledgments
    const committedMemberCount = will.commitments?.length || 0;
    const acknowledgedCount = will.acknowledgedCount || 0;
    
    if (acknowledgedCount >= committedMemberCount) {
      return 'no_will'; // All committed members acknowledged, can start new will
    }
    return 'completed';
  } else if (now >= startDate) {
    return 'active';
  } else {
    // Check commitment count to determine pending vs scheduled
    const commitmentCount = will.commitments?.length || 0;
    if (commitmentCount < memberCount) {
      return 'pending';
    } else if (commitmentCount >= memberCount) {
      return 'scheduled';
    } else {
      return 'pending';
    }
  }
}

function formatStartTime(startDate: string): string {
  if (!startDate) return '';
  
  const start = new Date(startDate);
  const now = new Date();
  const diffMs = start.getTime() - now.getTime();
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  const diffDays = Math.floor(diffHours / 24);
  
  if (diffDays > 0) {
    return `Starts in ${diffDays} day${diffDays > 1 ? 's' : ''}`;
  } else if (diffHours > 0) {
    return `Starts in ${diffHours} hour${diffHours > 1 ? 's' : ''}`;
  } else {
    return 'Starting soon';
  }
}

export default function Home() {
  const [, setLocation] = useLocation();
  const [showWhy, setShowWhy] = useState(false);
  
  const { data: circle } = useQuery({
    queryKey: ['/api/circles/mine'],
    refetchInterval: 30000, // Refresh every 30 seconds for real-time updates
    staleTime: 0, // Always consider data stale for immediate updates
  });

  const { data: will } = useQuery({
    queryKey: [`/api/wills/circle/${circle?.id}`],
    enabled: !!circle?.id,
    refetchInterval: 30000, // Refresh every 30 seconds for real-time updates
    staleTime: 0, // Always consider data stale for immediate updates
  });

  const { data: user } = useQuery({
    queryKey: ['/api/user'],
  });

  const handleStartJourney = () => {
    if (circle) {
      setLocation('/hub');
    } else {
      setLocation('/inner-circle');
    }
  };

  // If user is not authenticated, redirect to auth
  if (!user) {
    return (
      <div className="min-h-screen pt-[calc(env(safe-area-inset-top)+1.5rem)] pb-[calc(env(safe-area-inset-bottom)+1.5rem)]">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
          <div className="text-center mb-12">
            <h1 className="text-4xl font-bold text-gray-900 mb-4">
              Welcome
            </h1>
            <p className="text-gray-600 mb-8">Please log in to access your accountability circle.</p>
            <Button onClick={() => setLocation('/auth')} className="bg-primary hover:bg-blue-600">
              Sign In
            </Button>
          </div>
        </div>
      </div>
    );
  }

  // Check if there's an active Will using the same logic as InnerCircleHub
  const willStatus = getWillStatus(will, circle?.members?.length || 0);
  const isActiveWill = willStatus === 'active' || willStatus === 'scheduled' || willStatus === 'waiting_for_end_room';
  
  // Get user's commitment if they have one
  const userCommitment = isActiveWill && user ? will?.commitments?.find((c: any) => c.userId === user.id) : null;
  
  // Debug logging
  console.log('Home component debug:', {
    will,
    willStatus,
    isActiveWill,
    userCommitment,
    userId: user?.id,
    commitments: will?.commitments
  });



  return (
    <div className="min-h-screen pt-[calc(env(safe-area-inset-top)+1.5rem)] pb-[calc(env(safe-area-inset-bottom)+1.5rem)]">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        
        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold text-gray-900 mb-4">
            Welcome
          </h1>
        </div>

        {/* Circle Status Card */}
        <Card className="mb-8">
          <CardContent className="p-8 text-center">
            {circle ? (
              <div>
                <div className="w-16 h-16 bg-green-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
                  <svg className="w-6 h-6 text-secondary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                  </svg>
                </div>
                <h3 className="text-xl font-semibold text-gray-900 mb-2">Your Circle</h3>
                <p className="text-gray-600 mb-6">
                  {(() => {
                    const memberCount = circle.members?.length || 0;
                    if (memberCount === 1) {
                      return "You're the first member of this Inner Circle";
                    } else if (memberCount === 2) {
                      return "You're part of an Inner Circle with 1 other member";
                    } else {
                      return `You're part of an Inner Circle with ${memberCount - 1} other members`;
                    }
                  })()}
                </p>
                <Button onClick={handleStartJourney} className="bg-secondary hover:bg-green-600">
                  Enter Your Circle Hub
                </Button>
              </div>
            ) : (
              <div>
                <div className="w-16 h-16 bg-blue-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
                  <svg className="w-6 h-6 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                  </svg>
                </div>
                <h3 className="text-xl font-semibold text-gray-900 mb-2">Create Your Inner Circle</h3>
                <p className="text-gray-600 mb-6">
                  Start by creating or joining an Inner Circle to begin your accountability journey
                </p>
                <Button onClick={handleStartJourney} className="bg-primary hover:bg-blue-600">
                  Get Started
                </Button>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Active/Scheduled Will Card - Only show if user has an active, scheduled, or completed Will */}
        {isActiveWill && userCommitment && (
          <Card className={`mb-8 border-2 ${
            willStatus === 'active' ? 'border-green-200 bg-green-50' :
            willStatus === 'waiting_for_end_room' ? 'border-amber-200 bg-amber-50' :
            'border-blue-200 bg-blue-50'
          }`}>
            <CardContent className="p-6">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center space-x-3">
                  <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${
                    willStatus === 'active' ? 'bg-green-100' :
                    willStatus === 'waiting_for_end_room' ? 'bg-amber-100' :
                    'bg-blue-100'
                  }`}>
                    <Target className={`w-6 h-6 ${
                      willStatus === 'active' ? 'text-green-600' :
                      willStatus === 'waiting_for_end_room' ? 'text-amber-600' :
                      'text-blue-600'
                    }`} />
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900">
                      Your {willStatus === 'active' ? 'Active' : 
                             willStatus === 'waiting_for_end_room' ? 'Completed' : 'Scheduled'} <em>Will</em>
                    </h3>
                    <div className="flex items-center space-x-2">
                      <Badge className={`text-xs ${
                        willStatus === 'active' ? 'bg-green-100 text-green-800' :
                        willStatus === 'waiting_for_end_room' ? 'bg-amber-100 text-amber-800' :
                        'bg-blue-100 text-blue-800'
                      }`}>
                        {willStatus === 'active' ? 'Active' : 
                         willStatus === 'waiting_for_end_room' ? 'Completed' : 'Scheduled'}
                      </Badge>
                      {willStatus === 'scheduled' && will?.startDate && (
                        <span className="text-xs text-gray-500">
                          {formatStartTime(will.startDate)}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </div>
              
              <div className="space-y-3">
                <p className="text-lg italic text-gray-800 font-medium">
                  "I will {userCommitment.what || userCommitment.commitment}"
                </p>
                
                {userCommitment.why && (
                  <div className="text-sm">
                    <button
                      onClick={() => setShowWhy(!showWhy)}
                      className="flex items-center space-x-1 text-blue-600 hover:text-blue-800 hover:underline focus:outline-none"
                    >
                      <span>Why</span>
                      {showWhy ? (
                        <ChevronUp className="w-4 h-4" />
                      ) : (
                        <ChevronDown className="w-4 h-4" />
                      )}
                    </button>
                    
                    {showWhy && (
                      <div className="mt-2 p-3 bg-white rounded-lg border border-gray-200">
                        <p className="text-gray-700">
                          Because {userCommitment.why}
                        </p>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        )}


      </div>
    </div>
  );
}
