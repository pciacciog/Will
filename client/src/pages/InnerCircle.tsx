import { useState } from "react";
import { useLocation } from "wouter";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { MobileLayout, SectionCard, PrimaryButton, SectionTitle, ActionButton } from "@/components/ui/design-system";
import { Users, Plus } from "lucide-react";

export default function InnerCircle() {
  const [, setLocation] = useLocation();
  const [inviteCode, setInviteCode] = useState("");
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  const { data: circle, isLoading, error: circleError } = useQuery({
    queryKey: ['/api/circles/mine'],
    staleTime: 0, // Always consider data stale for immediate updates
    retry: (failureCount, error: any) => {
      // Don't retry on 404 errors (user not in circle)
      if (error?.message?.includes('404')) return false;
      return failureCount < 3;
    },
  });

  const createCircleMutation = useMutation({
    mutationFn: async () => {
      return apiRequest('/api/circles', { method: 'POST' });
    },
    onSuccess: () => {
      // Comprehensive cache invalidation to ensure fresh data
      queryClient.invalidateQueries({ queryKey: ['/api/circles/mine'] });
      queryClient.invalidateQueries({ queryKey: ['/api/wills/circle'] });
      queryClient.invalidateQueries({ queryKey: ['/api/user'] });
      // Remove any stale cache entries
      queryClient.removeQueries({ queryKey: ['/api/circles/mine'] });
      queryClient.removeQueries({ queryKey: ['/api/wills/circle'] });
      toast({
        title: "Circle Created!",
        description: "Your Circle has been created successfully.",
      });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const joinCircleMutation = useMutation({
    mutationFn: async (code: string) => {
      return apiRequest('/api/circles/join', {
        method: 'POST',
        body: JSON.stringify({ inviteCode: code })
      });
    },
    onSuccess: () => {
      // Comprehensive cache invalidation to ensure fresh data
      queryClient.invalidateQueries({ queryKey: ['/api/circles/mine'] });
      queryClient.invalidateQueries({ queryKey: ['/api/wills/circle'] });
      queryClient.invalidateQueries({ queryKey: ['/api/user'] });
      // Remove any stale cache entries
      queryClient.removeQueries({ queryKey: ['/api/circles/mine'] });
      queryClient.removeQueries({ queryKey: ['/api/wills/circle'] });
      toast({
        title: "Joined Circle!",
        description: "You've successfully joined the Circle.",
      });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleCreateCircle = () => {
    createCircleMutation.mutate();
  };

  const handleJoinCircle = () => {
    if (!inviteCode.trim()) {
      toast({
        title: "Error",
        description: "Please enter an invite code",
        variant: "destructive",
      });
      return;
    }
    joinCircleMutation.mutate(inviteCode.trim().toUpperCase());
  };

  const handleEnterCircle = () => {
    setLocation('/hub');
  };

  const copyInviteCode = async (code: string) => {
    try {
      await navigator.clipboard.writeText(code);
      toast({
        title: "Copied!",
        description: "Invite code copied to clipboard",
      });
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to copy invite code",
        variant: "destructive",
      });
    }
  };

  if (isLoading) {
    return (
      <MobileLayout>
        <div className="flex items-center justify-center min-h-screen-safe">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        </div>
      </MobileLayout>
    );
  }

  return (
    <MobileLayout scrollable={false}>
      <div className="relative h-full">
        {/* Animated Background Orbs - scoped within relative container */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute -top-20 -right-20 w-72 h-72 bg-gradient-to-br from-emerald-200/40 to-teal-300/30 rounded-full blur-3xl animate-pulse"></div>
          <div className="absolute -bottom-32 -left-20 w-80 h-80 bg-gradient-to-br from-blue-200/30 to-indigo-300/20 rounded-full blur-3xl animate-pulse" style={{ animationDelay: '1s' }}></div>
          <div className="absolute top-1/2 right-1/4 w-40 h-40 bg-gradient-to-br from-teal-100/40 to-emerald-200/30 rounded-full blur-2xl animate-pulse" style={{ animationDelay: '2s' }}></div>
        </div>
        
        <div className="relative max-w-screen-sm mx-auto px-4 py-1 overflow-x-hidden h-full overflow-y-hidden">
        
        {!circle ? (
          // No Circle State - Fixed non-scrollable layout
          <div className="h-full flex flex-col">
            {/* Fixed Header with Glowy Icon */}
            <div className="flex-shrink-0 text-center pt-[calc(env(safe-area-inset-top)+1rem)] pb-4">
              <div className="relative inline-block">
                {/* Glow effect behind icon */}
                <div className="absolute inset-0 bg-gradient-to-br from-emerald-400 to-teal-500 rounded-2xl blur-xl opacity-40 animate-pulse scale-125"></div>
                <div className="relative w-14 h-14 bg-gradient-to-br from-emerald-500 to-teal-600 rounded-2xl flex items-center justify-center mx-auto mb-3 shadow-xl shadow-emerald-500/25">
                  <Users className="w-6 h-6 text-white" />
                </div>
              </div>
              
              <h1 className="text-2xl font-bold text-gray-900 mb-2">Create Your Circle</h1>
              <p className="text-base text-gray-600 px-4">
                Start a new circle or join an existing one with your invite code.
              </p>
            </div>
            
            {/* Content Area */}
            <div className="flex-1 px-4 flex flex-col justify-center space-y-5">
              {/* Join Circle Card - with persistent subtle glow */}
              <div className="relative">
                <div className="absolute -inset-1 bg-gradient-to-r from-blue-400 to-indigo-500 rounded-2xl blur-lg opacity-25"></div>
                <Card className="relative bg-white/95 backdrop-blur-sm border border-blue-100/60 shadow-xl rounded-2xl overflow-hidden">
                  <CardContent className="p-5">
                    <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-xl flex items-center justify-center mx-auto mb-4 shadow-lg shadow-blue-500/25">
                      <Users className="w-5 h-5 text-white" />
                    </div>
                    <h3 className="text-lg font-semibold text-gray-900 mb-2 text-center">Join a Circle</h3>
                    <p className="text-gray-600 mb-4 text-center text-sm">Have an invite code? Join your friends' circle.</p>
                    
                    <div className="space-y-3">
                      <Input 
                        type="text" 
                        placeholder="Enter invite code (e.g., J3ZQ9P)" 
                        value={inviteCode}
                        onChange={(e) => setInviteCode(e.target.value.toUpperCase())}
                        className="text-center font-mono tracking-widest uppercase bg-white/80 border-gray-200 focus:border-blue-400 focus:ring-blue-400"
                        maxLength={6}
                      />
                      <Button 
                        onClick={handleJoinCircle} 
                        disabled={joinCircleMutation.isPending}
                        className="w-full bg-gradient-to-r from-blue-500 to-indigo-600 hover:from-blue-600 hover:to-indigo-700 shadow-lg shadow-blue-500/25 hover:shadow-xl hover:shadow-blue-500/30 transition-all duration-300"
                      >
                        {joinCircleMutation.isPending ? "Joining..." : "Join Circle"}
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              </div>
              
              {/* Create Circle Card - with persistent subtle glow */}
              <div className="relative">
                <div className="absolute -inset-1 bg-gradient-to-r from-emerald-400 to-teal-500 rounded-2xl blur-lg opacity-25"></div>
                <Card className="relative bg-white/95 backdrop-blur-sm border border-emerald-100/60 shadow-xl rounded-2xl overflow-hidden">
                  <CardContent className="p-5">
                    <div className="w-12 h-12 bg-gradient-to-br from-emerald-500 to-teal-600 rounded-xl flex items-center justify-center mx-auto mb-4 shadow-lg shadow-emerald-500/25">
                      <Plus className="w-5 h-5 text-white" />
                    </div>
                    <h3 className="text-lg font-semibold text-gray-900 mb-2 text-center">Create a Circle</h3>
                    <p className="text-gray-600 mb-4 text-center text-sm">Start fresh with a new circle for your group.</p>
                    
                    <Button 
                      onClick={handleCreateCircle}
                      disabled={createCircleMutation.isPending}
                      className="w-full bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 shadow-lg shadow-emerald-500/25 hover:shadow-xl hover:shadow-emerald-500/30 transition-all duration-300"
                    >
                      {createCircleMutation.isPending ? "Creating..." : "Create New Circle"}
                    </Button>
                  </CardContent>
                </Card>
              </div>
            </div>
            
            {/* Bottom safe area */}
            <div className="flex-shrink-0 pb-[calc(env(safe-area-inset-bottom)+1rem)]"></div>
          </div>
        ) : (
          // Has Circle State
          <div className="h-full flex flex-col space-y-2">
            {/* Header Section with Glowy Code */}
            <div className="flex-shrink-0 text-center pt-4">
              <h2 className="text-xl font-bold text-gray-900 mb-3">Your Circle</h2>
              <div className="flex items-center justify-center gap-x-2">
                <span className="text-sm text-gray-500">Invite Code:</span>
                <div className="relative">
                  <div className="absolute inset-0 bg-gradient-to-r from-emerald-400 to-teal-500 rounded-lg blur-sm opacity-30"></div>
                  <div className="relative bg-gradient-to-r from-emerald-50 to-teal-50 px-3 py-1.5 rounded-lg font-mono tracking-widest text-sm font-bold text-emerald-700 border border-emerald-200">
                    {circle.inviteCode}
                  </div>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => copyInviteCode(circle.inviteCode)}
                  className="text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50 p-1.5 rounded-lg transition-colors"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                  </svg>
                </Button>
              </div>
            </div>
            
            {/* Members Section */}
            <div className="flex-1 space-y-2">
              {circle.members?.map((member: any, index: number) => (
                <div key={member.id} className="flex items-center justify-between py-3 px-4 bg-gray-50 rounded-xl border border-gray-200">
                  <div className="flex items-center space-x-3 flex-1 min-w-0">
                    <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center flex-shrink-0">
                      <span className="text-white font-semibold text-sm">
                        {member.user.firstName?.charAt(0) || member.user.email?.charAt(0).toUpperCase() || '?'}
                      </span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="font-medium text-gray-900 text-base truncate">
                        {member.user.firstName && member.user.lastName 
                          ? `${member.user.firstName} ${member.user.lastName}`
                          : member.user.email
                        }
                      </div>
                      <div className="text-sm text-gray-500 truncate">{member.user.email}</div>
                    </div>
                  </div>
                  <div className="flex-shrink-0 ml-2">
                    <span className="inline-flex items-center px-2 py-1 rounded-md text-xs font-medium bg-blue-100 text-blue-800">
                      Member
                    </span>
                  </div>
                </div>
              ))}
            </div>
            
            {/* Footer Section */}
            <div className="flex-shrink-0 space-y-3 pb-4">
              <div className="relative">
                <div className="absolute inset-0 bg-gradient-to-r from-emerald-200 to-teal-200 rounded-xl blur-sm opacity-40"></div>
                <div className="relative px-4 py-3 bg-gradient-to-r from-emerald-50 to-teal-50 rounded-xl shadow-sm border border-emerald-100 text-sm">
                  <div className="flex items-center justify-center gap-x-2 text-emerald-700">
                    <Users className="w-5 h-5 flex-shrink-0" />
                    <span className="font-semibold text-base">
                      Circle Status: {circle.members?.length || 0} of 4 members
                    </span>
                  </div>
                </div>
              </div>
              
              <div className="text-center">
                <Button 
                  onClick={handleEnterCircle}
                  className="bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 text-white px-10 py-4 rounded-xl text-lg font-bold transition-all duration-300 shadow-xl shadow-emerald-500/25 hover:shadow-2xl hover:shadow-emerald-500/30 hover:scale-105 transform"
                >
                  Enter Circle →
                </Button>
              </div>
            </div>
          </div>
        )}
        </div>
      </div>
    </MobileLayout>
  );
}
