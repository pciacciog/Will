import { useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Target, ChevronDown, ChevronUp, Users, Plus, Sparkles } from "lucide-react";
import SplashScreen from "@/components/SplashScreen";

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
  const [showSplash, setShowSplash] = useState(false);

  // Check if we should show splash screen on first load
  useEffect(() => {
    const shouldShowSplash = localStorage.getItem('showSplashOnHome');
    console.log('Home useEffect: shouldShowSplash =', shouldShowSplash);
    if (shouldShowSplash === 'true') {
      localStorage.removeItem('showSplashOnHome');
      console.log('Setting showSplash to true');
      setShowSplash(true);
    }
  }, []);
  
  const { data: circle, error: circleError } = useQuery({
    queryKey: ['/api/circles/mine'],
    refetchInterval: 30000, // Refresh every 30 seconds for real-time updates
    staleTime: 0, // Always consider data stale for immediate updates
    retry: (failureCount, error: any) => {
      // Don't retry on 404 errors (user not in circle)
      if (error?.message?.includes('404')) return false;
      return failureCount < 3;
    },
  });

  const { data: will, error: willError } = useQuery({
    queryKey: [`/api/wills/circle/${circle?.id}`],
    enabled: !!circle?.id,
    refetchInterval: 30000, // Refresh every 30 seconds for real-time updates
    staleTime: 0, // Always consider data stale for immediate updates
    retry: (failureCount, error: any) => {
      // Don't retry on 404 errors (no active will)
      if (error?.message?.includes('404')) return false;
      return failureCount < 3;
    },
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

  // Show splash screen if requested
  if (showSplash) {
    console.log('Rendering splash screen from Home component');
    return <SplashScreen onComplete={() => {
      console.log('Splash screen completed');
      setShowSplash(false);
    }} />;
  }

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
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-blue-50/30">
      <div className="pt-[calc(env(safe-area-inset-top)+2rem)] pb-[calc(env(safe-area-inset-bottom)+2rem)]">
        <div className="max-w-lg mx-auto px-6">
          
          {/* Elegant Header */}
          <div className="text-center mb-12">
            <div className="inline-flex items-center justify-center mb-4">
              <div className="relative">
                <div className="absolute inset-0 bg-gradient-to-r from-emerald-400 to-teal-500 rounded-full blur-xl opacity-30 animate-pulse"></div>
                <h1 className="relative text-5xl font-light text-gray-900 tracking-wide">
                  <span className="bg-gradient-to-r from-emerald-600 to-teal-600 bg-clip-text text-transparent">
                    Will
                  </span>
                </h1>
              </div>
            </div>
            <p className="text-sm text-gray-500 font-light tracking-wide uppercase">
              Your Journey Starts Here
            </p>
          </div>

          {/* Circle Status Card */}
          <div className="relative">
            <div className="absolute -inset-1 bg-gradient-to-r from-emerald-400 to-teal-500 rounded-3xl blur opacity-25"></div>
            <Card className="relative bg-white/80 backdrop-blur-xl border-0 shadow-2xl rounded-3xl overflow-hidden">
              <CardContent className="p-8 text-center">
                {circle ? (
                  <div className="space-y-6">
                    {/* Intentional Circle Icon */}
                    <div className="relative mx-auto w-20 h-20">
                      <div className="absolute inset-0 bg-gradient-to-r from-emerald-400 to-teal-500 rounded-full animate-pulse opacity-20"></div>
                      <div className="relative w-20 h-20 bg-gradient-to-br from-emerald-50 to-teal-50 rounded-full border-4 border-emerald-100 flex items-center justify-center shadow-lg">
                        <div className="relative">
                          <Users className="w-8 h-8 text-emerald-600" strokeWidth={1.5} />
                          <div className="absolute -top-1 -right-1 w-4 h-4 bg-emerald-400 rounded-full flex items-center justify-center">
                            <Sparkles className="w-2 h-2 text-white" />
                          </div>
                        </div>
                      </div>
                    </div>
                    
                    <div className="space-y-3">
                      <h3 className="text-2xl font-semibold text-gray-900 tracking-tight">Your Circle</h3>
                      <p className="text-gray-600 leading-relaxed">
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
                    </div>
                    
                    <div className="pt-4">
                      <Button 
                        onClick={handleStartJourney} 
                        className="w-full bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-600 hover:to-teal-600 text-white font-medium py-4 px-8 rounded-2xl shadow-lg hover:shadow-xl transition-all duration-200 transform hover:scale-105"
                      >
                        Enter Your Circle Hub
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-6">
                    {/* Create Circle Icon */}
                    <div className="relative mx-auto w-20 h-20">
                      <div className="absolute inset-0 bg-gradient-to-r from-blue-400 to-indigo-500 rounded-full animate-pulse opacity-20"></div>
                      <div className="relative w-20 h-20 bg-gradient-to-br from-blue-50 to-indigo-50 rounded-full border-4 border-blue-100 flex items-center justify-center shadow-lg">
                        <div className="relative">
                          <Plus className="w-8 h-8 text-blue-600" strokeWidth={1.5} />
                          <div className="absolute -top-1 -right-1 w-4 h-4 bg-blue-400 rounded-full flex items-center justify-center">
                            <Sparkles className="w-2 h-2 text-white" />
                          </div>
                        </div>
                      </div>
                    </div>
                    
                    <div className="space-y-3">
                      <h3 className="text-2xl font-semibold text-gray-900 tracking-tight">Create Your Inner Circle</h3>
                      <p className="text-gray-600 leading-relaxed">
                        Start by creating or joining an Inner Circle to begin your accountability journey
                      </p>
                    </div>
                    
                    <div className="pt-4">
                      <Button 
                        onClick={handleStartJourney} 
                        className="w-full bg-gradient-to-r from-blue-500 to-indigo-500 hover:from-blue-600 hover:to-indigo-600 text-white font-medium py-4 px-8 rounded-2xl shadow-lg hover:shadow-xl transition-all duration-200 transform hover:scale-105"
                      >
                        Get Started
                      </Button>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Active/Scheduled Will Card - Only show if user has an active, scheduled, or completed Will */}
          {isActiveWill && userCommitment && (
            <div className="mt-8">
              <div className="relative">
                <div className={`absolute -inset-1 rounded-3xl blur opacity-25 ${
                  willStatus === 'active' ? 'bg-gradient-to-r from-green-400 to-emerald-500' :
                  willStatus === 'waiting_for_end_room' ? 'bg-gradient-to-r from-green-400 to-emerald-500' :
                  'bg-gradient-to-r from-blue-400 to-indigo-500'
                }`}></div>
                <Card className="relative bg-white/80 backdrop-blur-xl border-0 shadow-2xl rounded-3xl overflow-hidden">
                  <CardContent className="p-8">
                    <div className="flex items-center justify-between mb-6">
                      <div className="flex items-center space-x-4">
                        <div className={`w-14 h-14 rounded-2xl flex items-center justify-center shadow-lg ${
                          willStatus === 'active' ? 'bg-gradient-to-br from-green-50 to-emerald-50 border-2 border-green-100' :
                          willStatus === 'waiting_for_end_room' ? 'bg-gradient-to-br from-green-50 to-emerald-50 border-2 border-green-100' :
                          'bg-gradient-to-br from-blue-50 to-indigo-50 border-2 border-blue-100'
                        }`}>
                          <Target className={`w-7 h-7 ${
                            willStatus === 'active' ? 'text-green-600' :
                            willStatus === 'waiting_for_end_room' ? 'text-green-600' :
                            'text-blue-600'
                          }`} strokeWidth={1.5} />
                        </div>
                        <div>
                          <h3 className="text-xl font-semibold text-gray-900 tracking-tight">
                            <em>Will</em>
                          </h3>
                          <div className="flex items-center space-x-2 mt-1">
                            <Badge className={`text-xs font-medium px-3 py-1 rounded-full ${
                              willStatus === 'active' ? 'bg-green-100 text-green-800' :
                              willStatus === 'waiting_for_end_room' ? 'bg-green-100 text-green-800' :
                              'bg-blue-100 text-blue-800'
                            }`}>
                              {willStatus === 'active' ? 'Active' : 
                               willStatus === 'waiting_for_end_room' ? 'Completed' : 'Scheduled'}
                            </Badge>
                            {willStatus === 'scheduled' && will?.startDate && (
                              <span className="text-xs text-gray-500 font-medium">
                                {formatStartTime(will.startDate)}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                    
                    <div className="space-y-4">
                      <div className="bg-gradient-to-r from-gray-50 to-gray-100/50 rounded-2xl p-4 border border-gray-100">
                        <p className="text-lg italic text-gray-800 font-medium leading-relaxed">
                          "I will {userCommitment.what || userCommitment.commitment}"
                        </p>
                      </div>
                      
                      {userCommitment.why && (
                        <div className="space-y-2">
                          <button
                            onClick={() => setShowWhy(!showWhy)}
                            className={`inline-flex items-center space-x-2 px-4 py-2 rounded-xl border transition-all duration-200 shadow-sm font-medium ${
                              showWhy 
                                ? 'bg-red-500 text-white border-red-500 shadow-md hover:bg-red-600 hover:shadow-lg' 
                                : 'bg-blue-100 text-blue-800 border-blue-200 hover:bg-blue-200 hover:shadow-md'
                            }`}
                          >
                            <span>Why</span>
                            {showWhy ? (
                              <ChevronUp className="w-4 h-4" />
                            ) : (
                              <ChevronDown className="w-4 h-4" />
                            )}
                          </button>
                          
                          {showWhy && (
                            <div className="mt-3 p-4 bg-white rounded-2xl border border-gray-200 shadow-sm">
                              <p className="text-gray-700 leading-relaxed">
                                Because {userCommitment.why}
                              </p>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
