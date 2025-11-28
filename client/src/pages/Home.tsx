import { useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Users, User, ArrowRight, Sparkles } from "lucide-react";
import SplashScreen from "@/components/SplashScreen";

type CircleWithMembers = {
  id: number;
  inviteCode: string;
  members?: { id: number; userId: string }[];
};

export default function Home() {
  const [, setLocation] = useLocation();
  const [showSplash, setShowSplash] = useState(false);

  useEffect(() => {
    const shouldShowSplash = localStorage.getItem('showSplashOnHome');
    if (shouldShowSplash === 'true') {
      localStorage.removeItem('showSplashOnHome');
      setShowSplash(true);
    }
  }, []);
  
  const { data: circle } = useQuery<CircleWithMembers>({
    queryKey: ['/api/circles/mine'],
    retry: (failureCount, error: any) => {
      if (error?.message?.includes('404')) return false;
      return failureCount < 3;
    },
  });

  const { data: user, isLoading: userLoading } = useQuery({
    queryKey: ['/api/user'],
  });

  const handleSoloMode = () => {
    setLocation('/solo/hub');
  };

  const handleCircleMode = () => {
    if (circle) {
      setLocation('/hub');
    } else {
      setLocation('/inner-circle');
    }
  };

  if (showSplash) {
    return <SplashScreen onComplete={() => setShowSplash(false)} />;
  }

  if (userLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen pt-[calc(env(safe-area-inset-top)+1.5rem)] pb-[calc(env(safe-area-inset-bottom)+1.5rem)]">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
          <div className="text-center mb-12">
            <h1 className="text-4xl font-bold text-gray-900 mb-4">Welcome</h1>
            <p className="text-gray-600 mb-8">Please log in to access your accountability journey.</p>
            <Button onClick={() => setLocation('/auth')} className="bg-primary hover:bg-blue-600">
              Sign In
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-emerald-50/30">
      <div className="pt-[calc(env(safe-area-inset-top)+2rem)] pb-[calc(env(safe-area-inset-bottom)+2rem)] min-h-screen flex flex-col">
        <div className="max-w-sm mx-auto px-5 flex-1 flex flex-col justify-center">
          
          {/* Header - Enhanced with stronger glow and better spacing */}
          <div className="text-center mb-10">
            <div className="inline-flex items-center justify-center mb-5">
              <div className="relative">
                {/* Outer glow ring - stronger and more visible */}
                <div className="absolute -inset-2 bg-gradient-to-r from-emerald-400 via-teal-400 to-emerald-500 rounded-full blur-2xl opacity-40 animate-pulse"></div>
                {/* Inner glow layer */}
                <div className="absolute inset-0 bg-gradient-to-r from-emerald-400 to-teal-500 rounded-full blur-lg opacity-25"></div>
                <div className="relative w-16 h-16 bg-gradient-to-br from-emerald-50 to-teal-50 rounded-full border-2 border-emerald-200 flex items-center justify-center shadow-xl">
                  <Sparkles className="w-8 h-8 text-emerald-600" />
                </div>
              </div>
            </div>
            <h1 className="text-2xl font-semibold text-gray-900 mb-3">
              Start Your Journey
            </h1>
            <p className="text-gray-500 text-sm">
              Choose your accountability path
            </p>
          </div>

          {/* Mode Selection Cards */}
          <div className="space-y-4">
            
            {/* Circle Mode Card - Enhanced contrast and tappable feel */}
            <button
              onClick={handleCircleMode}
              className="w-full text-left group"
              data-testid="button-circle-mode"
            >
              <div className="relative">
                <div className="absolute -inset-1 bg-gradient-to-r from-emerald-400 to-teal-500 rounded-2xl blur opacity-0 group-hover:opacity-30 transition-opacity duration-300"></div>
                <Card className="relative bg-white border-2 border-emerald-100/70 shadow-sm group-hover:border-emerald-300 rounded-2xl overflow-hidden transition-all duration-300 group-hover:shadow-xl group-hover:-translate-y-0.5">
                  <CardContent className="p-5">
                    <div className="flex items-start space-x-4">
                      {/* Icon */}
                      <div className="relative flex-shrink-0">
                        <div className="w-14 h-14 bg-gradient-to-br from-emerald-50 to-teal-50 rounded-xl border border-emerald-100 flex items-center justify-center shadow-sm group-hover:shadow-md transition-shadow">
                          <Users className="w-7 h-7 text-emerald-600" strokeWidth={1.5} />
                        </div>
                      </div>
                      
                      {/* Content */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between">
                          <h3 className="text-lg font-semibold text-gray-900">Circle Mode</h3>
                          <ArrowRight className="w-5 h-5 text-gray-400 group-hover:text-emerald-500 group-hover:translate-x-1 transition-all" />
                        </div>
                        {/* Tagline - italic with emphasized power word */}
                        <p className="text-emerald-600/90 text-sm font-medium italic mt-0.5 tracking-tight">
                          "Become more… <span className="text-emerald-700 font-semibold">together</span>."
                        </p>
                        {/* Unified description */}
                        <p className="text-gray-500 text-sm mt-2 leading-relaxed">
                          Shared accountability with the people you trust.
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </button>

            {/* Solo Mode Card - Enhanced contrast and tappable feel */}
            <button
              onClick={handleSoloMode}
              className="w-full text-left group"
              data-testid="button-solo-mode"
            >
              <div className="relative">
                <div className="absolute -inset-1 bg-gradient-to-r from-purple-400 to-indigo-500 rounded-2xl blur opacity-0 group-hover:opacity-30 transition-opacity duration-300"></div>
                <Card className="relative bg-white border-2 border-purple-100/70 shadow-sm group-hover:border-purple-300 rounded-2xl overflow-hidden transition-all duration-300 group-hover:shadow-xl group-hover:-translate-y-0.5">
                  <CardContent className="p-5">
                    <div className="flex items-start space-x-4">
                      {/* Icon */}
                      <div className="relative flex-shrink-0">
                        <div className="w-14 h-14 bg-gradient-to-br from-purple-50 to-indigo-50 rounded-xl border border-purple-100 flex items-center justify-center shadow-sm group-hover:shadow-md transition-shadow">
                          <User className="w-7 h-7 text-purple-600" strokeWidth={1.5} />
                        </div>
                      </div>
                      
                      {/* Content */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between">
                          <h3 className="text-lg font-semibold text-gray-900">Solo Mode</h3>
                          <ArrowRight className="w-5 h-5 text-gray-400 group-hover:text-purple-500 group-hover:translate-x-1 transition-all" />
                        </div>
                        {/* Tagline - italic with emphasized power word */}
                        <p className="text-purple-600/90 text-sm font-medium italic mt-0.5 tracking-tight">
                          "No one is watching… but <span className="text-purple-700 font-semibold">you</span>."
                        </p>
                        {/* Unified description */}
                        <p className="text-gray-500 text-sm mt-2 leading-relaxed">
                          Personal accountability for your own goals.
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </button>

          </div>

        </div>
      </div>
    </div>
  );
}
