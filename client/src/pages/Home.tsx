import { useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Target, ChevronDown, ChevronUp } from "lucide-react";

export default function Home() {
  const [, setLocation] = useLocation();
  const [showWhy, setShowWhy] = useState(false);
  
  const { data: circle } = useQuery({
    queryKey: ['/api/circles/mine'],
  });

  const { data: will } = useQuery({
    queryKey: ['/api/wills/circle'],
    enabled: !!circle,
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
      <div className="min-h-screen pt-16">
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

  // Check if there's an active Will (scheduled or active status)
  const isActiveWill = will && (will.status === 'active' || will.status === 'scheduled' || will.status === 'waiting_for_end_room');
  
  // Get user's commitment if they have one
  const userCommitment = isActiveWill && user ? will.commitments?.find((c: any) => c.userId === user.id) : null;



  return (
    <div className="min-h-screen pt-16">
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

        {/* Active Will Card - Only show if user has an active Will */}
        {isActiveWill && userCommitment && (
          <Card className="mb-8 border-2 border-blue-200 bg-blue-50">
            <CardContent className="p-6">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center space-x-3">
                  <div className="w-12 h-12 bg-blue-100 rounded-xl flex items-center justify-center">
                    <Target className="w-6 h-6 text-blue-600" />
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900">Your Active <em>Will</em></h3>
                    <Badge className="bg-blue-100 text-blue-800 text-xs">
                      {will.status === 'active' ? 'Active' : 
                       will.status === 'waiting_for_end_room' ? 'Completed' : 'Scheduled'}
                    </Badge>
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
                      <span>Reveal My Why</span>
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
