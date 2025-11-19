import { useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Target, ChevronDown, ChevronUp, Users, Plus, Sparkles, Heart, Hand } from "lucide-react";
import SplashScreen from "@/components/SplashScreen";
import { getWillStatus } from "@/lib/willStatus";

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

  const { data: user, isLoading: userLoading } = useQuery({
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

  // Show loading state while user data is being fetched
  if (userLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
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

  // Check if there's an active Will using centralized status logic
  const willStatus = getWillStatus(will, user?.id);
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
    <div className="h-screen bg-gradient-to-br from-gray-50 via-white to-blue-50/30 overflow-hidden">
      <div className="pt-[calc(env(safe-area-inset-top)+1rem)] pb-[calc(env(safe-area-inset-bottom)+1rem)] h-full flex flex-col">
        <div className="max-w-sm mx-auto px-4 flex-1 flex flex-col justify-center space-y-4">
          
          {/* Compact Header */}
          <div className="text-center mb-4">
            <div className="inline-flex items-center justify-center mb-2">
              <div className="relative">
                <div className="absolute inset-0 bg-gradient-to-r from-emerald-400 to-teal-500 rounded-full blur-lg opacity-30 animate-pulse"></div>
                <div className="relative flex items-center space-x-3">
                  {/* Heart Hands Symbol */}
                  <div className="flex items-center space-x-1">
                    <div className="relative">
                      <Heart className="w-8 h-8 text-emerald-600 fill-emerald-200" strokeWidth={1.5} />
                      <Hand className="absolute -right-1 -bottom-1 w-5 h-5 text-emerald-700" strokeWidth={2} />
                    </div>
                  </div>
                  {/* Will Text */}
                  <h1 className="text-3xl font-light text-gray-900 tracking-wide">
                    <span className="bg-gradient-to-r from-emerald-600 to-teal-600 bg-clip-text text-transparent">
                      Will
                    </span>
                  </h1>
                </div>
              </div>
            </div>
            <p className="text-xs text-gray-500 font-light tracking-wide uppercase">
              Your Journey Starts Here
            </p>
          </div>

          {/* Compact Circle Status Card */}
          <div className="relative">
            <div className="absolute -inset-1 bg-gradient-to-r from-emerald-400 to-teal-500 rounded-2xl blur opacity-25"></div>
            <Card className="relative bg-white/80 backdrop-blur-xl border-0 shadow-xl rounded-2xl overflow-hidden">
              <CardContent className="p-4 text-center">
                {circle ? (
                  <div className="space-y-3">
                    {/* Compact Circle Icon */}
                    <div className="relative mx-auto w-12 h-12">
                      <div className="absolute inset-0 bg-gradient-to-r from-emerald-400 to-teal-500 rounded-full animate-pulse opacity-20"></div>
                      <div className="relative w-12 h-12 bg-gradient-to-br from-emerald-50 to-teal-50 rounded-full border-2 border-emerald-100 flex items-center justify-center shadow-md">
                        <Users className="w-5 h-5 text-emerald-600" strokeWidth={1.5} />
                      </div>
                    </div>
                    
                    <div className="space-y-2">
                      <h3 className="text-lg font-semibold text-gray-900">Your Circle</h3>
                      <p className="text-sm text-gray-600">
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
                    
                    <div className="pt-2">
                      <Button 
                        onClick={handleStartJourney} 
                        className="w-full bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-600 hover:to-teal-600 text-white font-medium py-3 px-6 rounded-xl shadow-lg hover:shadow-xl transition-all duration-200"
                      >
                        Enter Your Circle Hub
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {/* Compact Create Circle Icon */}
                    <div className="relative mx-auto w-12 h-12">
                      <div className="absolute inset-0 bg-gradient-to-r from-blue-400 to-indigo-500 rounded-full animate-pulse opacity-20"></div>
                      <div className="relative w-12 h-12 bg-gradient-to-br from-blue-50 to-indigo-50 rounded-full border-2 border-blue-100 flex items-center justify-center shadow-md">
                        <Plus className="w-5 h-5 text-blue-600" strokeWidth={1.5} />
                      </div>
                    </div>
                    
                    <div className="space-y-2">
                      <h3 className="text-lg font-semibold text-gray-900">Create Your Inner Circle</h3>
                      <p className="text-sm text-gray-600">
                        Start by creating or joining an Inner Circle to begin your accountability journey
                      </p>
                    </div>
                    
                    <div className="pt-2">
                      <Button 
                        onClick={handleStartJourney} 
                        className="w-full bg-gradient-to-r from-blue-500 to-indigo-500 hover:from-blue-600 hover:to-indigo-600 text-white font-medium py-3 px-6 rounded-xl shadow-lg hover:shadow-xl transition-all duration-200"
                      >
                        Get Started
                      </Button>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Compact Active Will Card */}
          {isActiveWill && userCommitment && (
            <div className="relative">
              <div className={`absolute -inset-1 rounded-2xl blur opacity-25 ${
                willStatus === 'active' ? 'bg-gradient-to-r from-green-400 to-emerald-500' :
                willStatus === 'waiting_for_end_room' ? 'bg-gradient-to-r from-green-400 to-emerald-500' :
                'bg-gradient-to-r from-blue-400 to-indigo-500'
              }`}></div>
              <Card className="relative bg-white/80 backdrop-blur-xl border-0 shadow-xl rounded-2xl overflow-hidden">
                <CardContent className="p-4">
                  <div className="flex items-center space-x-3 mb-3">
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center shadow-md ${
                      willStatus === 'active' ? 'bg-gradient-to-br from-green-50 to-emerald-50 border border-green-100' :
                      willStatus === 'waiting_for_end_room' ? 'bg-gradient-to-br from-green-50 to-emerald-50 border border-green-100' :
                      'bg-gradient-to-br from-blue-50 to-indigo-50 border border-blue-100'
                    }`}>
                      <Target className={`w-5 h-5 ${
                        willStatus === 'active' ? 'text-green-600' :
                        willStatus === 'waiting_for_end_room' ? 'text-green-600' :
                        'text-blue-600'
                      }`} strokeWidth={1.5} />
                    </div>
                    <div className="flex-1">
                      <h3 className="text-lg font-semibold text-gray-900">
                        <em>Will</em>
                      </h3>
                      <div className="flex items-center space-x-2">
                        <Badge className={`text-xs font-medium px-2 py-1 rounded-full ${
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
                  
                  <div className="space-y-2">
                    <div className="bg-gradient-to-r from-gray-50 to-gray-100/50 rounded-xl p-3 border border-gray-100">
                      <p className="text-sm italic text-gray-800 font-medium">
                        "I will {userCommitment.what || userCommitment.commitment}"
                      </p>
                    </div>
                    
                    {userCommitment.why && (
                      <div className="space-y-2">
                        <button
                          onClick={() => setShowWhy(!showWhy)}
                          className={`inline-flex items-center space-x-2 px-3 py-1.5 rounded-lg border transition-all duration-200 shadow-sm text-sm font-medium ${
                            showWhy 
                              ? 'bg-red-500 text-white border-red-500 shadow-md hover:bg-red-600' 
                              : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
                          }`}
                        >
                          <span>Why</span>
                          {showWhy ? (
                            <ChevronUp className="w-3 h-3" />
                          ) : (
                            <ChevronDown className="w-3 h-3" />
                          )}
                        </button>
                        
                        {showWhy && (
                          <div className="mt-2 p-3 bg-gray-50 border-l-4 border-gray-300 text-sm rounded">
                            <p className="leading-relaxed">
                              <span className="font-bold text-black">Because</span> {userCommitment.why}
                            </p>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
