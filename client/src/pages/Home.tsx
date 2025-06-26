import { useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

export default function Home() {
  const [, setLocation] = useLocation();
  
  const { data: circle } = useQuery({
    queryKey: ['/api/circles/mine'],
  });

  const handleStartJourney = () => {
    if (circle) {
      setLocation('/hub');
    } else {
      setLocation('/inner-circle');
    }
  };

  return (
    <div className="min-h-screen pt-16">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        
        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold text-gray-900 mb-4">
            Become More - Together
          </h1>
        </div>

        {/* Quick Action Card */}
        <Card className="mb-8">
          <CardContent className="p-8 text-center">
            {circle ? (
              <div>
                <div className="w-16 h-16 bg-green-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
                  <svg className="w-6 h-6 text-secondary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                  </svg>
                </div>
                <h3 className="text-xl font-semibold text-gray-900 mb-2">Your Circle is Ready</h3>
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

        {/* Core Flow - Simplified Action Steps - Updated */}
        <div className="text-center mb-8">
          <h2 className="text-2xl font-bold text-gray-900 mb-8">A space to grow with your people</h2>
          <div className="grid md:grid-cols-3 gap-8">
            <div className="text-center">
              <div className="w-16 h-16 bg-blue-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
                <svg className="w-6 h-6 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                </svg>
              </div>
              <h3 className="text-lg font-bold text-gray-900 mb-2">Build Your Inner Circle</h3>
              <p className="text-gray-600">Invite the people who matter most.</p>
            </div>

            <div className="text-center">
              <div className="w-16 h-16 bg-green-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
                <svg className="w-6 h-6 text-secondary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <h3 className="text-lg font-bold text-gray-900 mb-2">Create Your Will</h3>
              <p className="text-gray-600">Define what you will do.</p>
            </div>

            <div className="text-center">
              <div className="w-16 h-16 bg-purple-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
                <svg className="w-6 h-6 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                </svg>
              </div>
              <h3 className="text-lg font-bold text-gray-900 mb-2">Go to Work</h3>
              <p className="text-gray-600">Share in the struggle.</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
