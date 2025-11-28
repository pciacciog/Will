import { useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Target, Plus, User, ChevronLeft, Sparkles } from "lucide-react";

type Will = {
  id: number;
  mode: string;
  status: string;
  startDate: string;
  endDate: string;
  commitments?: { id: number; userId: string; what: string; why: string }[];
};

export default function SoloHub() {
  const [, setLocation] = useLocation();

  const { data: user } = useQuery({
    queryKey: ['/api/user'],
  });

  // Fetch solo wills for the current user
  const { data: soloWills, isLoading } = useQuery<Will[]>({
    queryKey: ['/api/wills/solo'],
    enabled: !!user,
    retry: (failureCount, error: any) => {
      if (error?.message?.includes('404')) return false;
      return failureCount < 3;
    },
  });

  // Get active or most recent solo will
  const activeWill = soloWills?.find(w => 
    w.status === 'active' || w.status === 'will_review' || w.status === 'scheduled'
  );

  const handleStartWill = () => {
    setLocation('/solo/start-will');
  };

  const handleViewWill = (willId: number) => {
    setLocation(`/will/${willId}`);
  };

  const handleBack = () => {
    setLocation('/');
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-500"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-purple-50/30">
      <div className="pt-[calc(env(safe-area-inset-top)+4.5rem)] pb-[calc(env(safe-area-inset-bottom)+2rem)] min-h-screen">
        <div className="max-w-sm mx-auto px-5">
          
          {/* Header with Back Button */}
          <div className="flex items-center justify-between mb-2">
            {/* Back Button */}
            <button
              onClick={handleBack}
              className="w-11 h-11 -ml-2 flex items-center justify-center"
              data-testid="button-back-home"
              aria-label="Go back"
            >
              <span className="w-8 h-8 flex items-center justify-center rounded-lg bg-gray-100 border border-gray-200 text-gray-700 hover:text-gray-900 hover:bg-gray-200 hover:border-gray-300 transition-all duration-200 active:scale-95">
                <ChevronLeft className="w-5 h-5" strokeWidth={2.5} />
              </span>
            </button>
            
            {/* Centered Title */}
            <div className="flex-1 text-center -ml-2">
              <h1 className="text-xl font-semibold text-gray-900">Solo</h1>
            </div>
            
            {/* Spacer to balance centering */}
            <div className="w-9" />
          </div>

          {/* Solo Icon with Glow + Tagline */}
          <div className="text-center mb-4">
            <div className="inline-flex items-center justify-center mb-2">
              <div className="relative">
                <div className="absolute inset-0 bg-gradient-to-br from-purple-500/20 to-indigo-500/20 blur-2xl opacity-40 animate-pulse"></div>
                <div className="absolute inset-0 bg-gradient-to-tr from-purple-400/10 to-indigo-400/10 blur-lg opacity-25"></div>
                <div className="relative w-14 h-14 bg-gradient-to-br from-purple-50 to-indigo-50 rounded-full border-2 border-purple-100 flex items-center justify-center shadow-lg">
                  <User className="w-7 h-7 text-purple-600" />
                </div>
              </div>
            </div>
            <p className="text-purple-600 text-sm font-medium italic">
              "No one is watching... but you"
            </p>
          </div>

          {/* Active Will Card or Start New */}
          {activeWill ? (
            <div className="space-y-4">
              {/* Active Will Card */}
              <div className="relative">
                <div className="absolute -inset-1 bg-gradient-to-r from-purple-400 to-indigo-500 rounded-2xl blur opacity-25"></div>
                <Card className="relative bg-white border-0 shadow-xl rounded-2xl overflow-hidden">
                  <CardContent className="p-5">
                    <div className="flex items-start space-x-4">
                      <div className="w-12 h-12 bg-gradient-to-br from-purple-50 to-indigo-50 rounded-xl border border-purple-100 flex items-center justify-center shadow-sm">
                        <Target className="w-6 h-6 text-purple-600" />
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center space-x-2 mb-1">
                          <h3 className="text-lg font-semibold text-gray-900">Your Will</h3>
                          <Badge className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                            activeWill.status === 'active' ? 'bg-green-100 text-green-800' :
                            activeWill.status === 'will_review' ? 'bg-amber-100 text-amber-800' :
                            'bg-blue-100 text-blue-800'
                          }`}>
                            {activeWill.status === 'active' ? 'Active' : 
                             activeWill.status === 'will_review' ? 'Review' : 
                             'Scheduled'}
                          </Badge>
                        </div>
                        
                        {activeWill.commitments?.[0] && (
                          <div className="bg-gray-50 rounded-lg p-3 mt-2 border border-gray-100">
                            <p className="text-sm italic text-gray-700">
                              "I will {activeWill.commitments[0].what}"
                            </p>
                          </div>
                        )}
                        
                        <Button
                          onClick={() => handleViewWill(activeWill.id)}
                          className="w-full mt-4 bg-gradient-to-r from-purple-500 to-indigo-500 hover:from-purple-600 hover:to-indigo-600"
                          data-testid="button-view-will"
                        >
                          View Details
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              {/* Empty State - Start First Will */}
              <div className="relative">
                <div className="absolute -inset-1 bg-gradient-to-r from-purple-400 to-indigo-500 rounded-2xl blur opacity-20"></div>
                <Card className="relative bg-white border-2 border-dashed border-purple-200 rounded-2xl overflow-hidden">
                  <CardContent className="p-6 text-center">
                    <div className="w-16 h-16 bg-gradient-to-br from-purple-50 to-indigo-50 rounded-full border border-purple-100 flex items-center justify-center mx-auto mb-4">
                      <Plus className="w-8 h-8 text-purple-500" />
                    </div>
                    <h3 className="text-lg font-semibold text-gray-900 mb-2">Start Your Solo Will</h3>
                    <p className="text-gray-500 text-sm mb-5">
                      Create a personal commitment and hold yourself accountable.
                    </p>
                    <Button
                      onClick={handleStartWill}
                      className="w-full bg-gradient-to-r from-purple-500 to-indigo-500 hover:from-purple-600 hover:to-indigo-600 py-3"
                      data-testid="button-start-solo-will"
                    >
                      <Sparkles className="w-4 h-4 mr-2" />
                      Start a Will
                    </Button>
                  </CardContent>
                </Card>
              </div>
            </div>
          )}

          {/* Past Wills Section (if any completed) */}
          {soloWills && soloWills.filter(w => w.status === 'completed').length > 0 && (
            <div className="mt-8">
              <h3 className="text-sm font-medium text-gray-500 uppercase tracking-wide mb-3">
                Completed Wills
              </h3>
              <div className="space-y-2">
                {soloWills
                  .filter(w => w.status === 'completed')
                  .slice(0, 3)
                  .map(will => (
                    <button
                      key={will.id}
                      onClick={() => handleViewWill(will.id)}
                      className="w-full text-left p-3 bg-white rounded-xl border border-gray-100 hover:border-purple-200 hover:shadow-sm transition-all"
                      data-testid={`button-past-will-${will.id}`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-gray-700">
                          {will.commitments?.[0]?.what?.substring(0, 40)}...
                        </span>
                        <Badge className="bg-gray-100 text-gray-600 text-xs">
                          Completed
                        </Badge>
                      </div>
                    </button>
                  ))
                }
              </div>
            </div>
          )}

        </div>
      </div>
    </div>
  );
}
