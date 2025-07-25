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
        description: "Your Inner Circle has been created successfully.",
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
        description: "You've successfully joined the Inner Circle.",
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
      <div className="max-w-screen-sm mx-auto px-4 py-1 overflow-x-hidden h-full overflow-y-hidden">
        
        {!circle ? (
          // No Circle State - Fixed non-scrollable layout
          <div className="h-full flex flex-col">
            {/* Fixed Header */}
            <div className="flex-shrink-0 text-center pt-[calc(env(safe-area-inset-top)+1rem)] pb-4">
              <div className="w-12 h-12 bg-gradient-to-br from-primary to-secondary rounded-2xl flex items-center justify-center mx-auto mb-3">
                <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                </svg>
              </div>
              
              <h1 className="text-2xl font-bold text-gray-900 mb-2">Create Your Inner Circle</h1>
              <p className="text-base text-gray-600 px-4">
                Start a new circle or join an existing one with your invite code.
              </p>
            </div>
            
            {/* Content Area */}
            <div className="flex-1 px-4 flex flex-col justify-center space-y-4">
              <Card className="border-2 border-transparent hover:border-primary transition-colors">
                <CardContent className="p-4">
                  <div className="w-12 h-12 bg-primary rounded-xl flex items-center justify-center mx-auto mb-4">
                    <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                    </svg>
                  </div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-2 text-center">Join a Circle</h3>
                  <p className="text-gray-600 mb-4 text-center text-sm">Have an invite code? Join your friends' circle.</p>
                  
                  <div className="space-y-3">
                    <Input 
                      type="text" 
                      placeholder="Enter invite code (e.g., J3ZQ9P)" 
                      value={inviteCode}
                      onChange={(e) => setInviteCode(e.target.value.toUpperCase())}
                      className="text-center font-mono tracking-widest uppercase"
                      maxLength={6}
                    />
                    <Button 
                      onClick={handleJoinCircle} 
                      disabled={joinCircleMutation.isPending}
                      className="w-full bg-primary hover:bg-blue-600"
                    >
                      {joinCircleMutation.isPending ? "Joining..." : "Join Circle"}
                    </Button>
                  </div>
                </CardContent>
              </Card>
              
              <Card className="border-2 border-transparent hover:border-secondary transition-colors">
                <CardContent className="p-4">
                  <div className="w-12 h-12 bg-secondary rounded-xl flex items-center justify-center mx-auto mb-4">
                    <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" />
                    </svg>
                  </div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-2 text-center">Create a Circle</h3>
                  <p className="text-gray-600 mb-4 text-center text-sm">Start fresh with a new circle for your group.</p>
                  
                  <Button 
                    onClick={handleCreateCircle}
                    disabled={createCircleMutation.isPending}
                    className="w-full bg-secondary hover:bg-green-600"
                  >
                    {createCircleMutation.isPending ? "Creating..." : "Create New Circle"}
                  </Button>
                </CardContent>
              </Card>
            </div>
            
            {/* Bottom safe area */}
            <div className="flex-shrink-0 pb-[calc(env(safe-area-inset-bottom)+1rem)]"></div>
          </div>
        ) : (
          // Has Circle State
          <div className="h-full flex flex-col space-y-2">
            {/* Header Section */}
            <div className="flex-shrink-0 text-center">
              <h2 className="text-xl font-bold text-gray-900 mb-2">Your Inner Circle</h2>
              <div className="flex items-center justify-center gap-x-2">
                <span className="text-sm text-gray-500">Invite Code:</span>
                <div className="bg-gray-100 px-3 py-1 rounded-md font-mono tracking-widest text-sm font-semibold text-gray-800">
                  {circle.inviteCode}
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => copyInviteCode(circle.inviteCode)}
                  className="text-primary hover:text-blue-600 p-1"
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
            <div className="flex-shrink-0 space-y-3">
              <div className="px-4 py-3 bg-blue-50 rounded-xl shadow-sm border border-blue-100 text-sm">
                <div className="flex items-center justify-center gap-x-2 text-blue-700">
                  <svg className="w-5 h-5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                  </svg>
                  <span className="font-semibold text-base">
                    Circle Status: {circle.members?.length || 0} of 4 members
                  </span>
                </div>
              </div>
              
              <div className="text-center">
                <Button 
                  onClick={handleEnterCircle}
                  className="bg-primary hover:bg-blue-600 text-white px-10 py-4 rounded-xl text-lg font-bold transition-all duration-200 shadow-lg hover:shadow-xl hover:scale-105 transform"
                >
                  Enter Circle →
                </Button>
              </div>
            </div>
          </div>
        )}
      </div>
    </MobileLayout>
  );
}
