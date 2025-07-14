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
  
  const { data: circle, isLoading } = useQuery({
    queryKey: ['/api/circles/mine'],
  });

  const createCircleMutation = useMutation({
    mutationFn: async () => {
      return apiRequest('/api/circles', { method: 'POST' });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/circles/mine'] });
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
      queryClient.invalidateQueries({ queryKey: ['/api/circles/mine'] });
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
    <MobileLayout>
      <div className="max-w-4xl mx-auto py-8">
        
        {!circle ? (
          // No Circle State
          <div className="text-center">
            <div className="w-20 h-20 bg-gradient-to-br from-primary to-secondary rounded-3xl flex items-center justify-center mx-auto mb-8">
              <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
              </svg>
            </div>
            
            <h1 className="text-3xl font-bold text-gray-900 mb-4">Create Your Inner Circle</h1>
            <p className="text-lg text-gray-600 mb-12 max-w-2xl mx-auto">
              Start a new circle or join an existing one with your invite code.
            </p>
            
            <div className="grid md:grid-cols-2 gap-6 max-w-2xl mx-auto">
              <Card className="border-2 border-transparent hover:border-primary transition-colors">
                <CardContent className="p-8">
                  <div className="w-16 h-16 bg-primary rounded-2xl flex items-center justify-center mx-auto mb-6">
                    <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                    </svg>
                  </div>
                  <h3 className="text-xl font-semibold text-gray-900 mb-3">Join a Circle</h3>
                  <p className="text-gray-600 mb-6">Have an invite code? Join your friends' circle.</p>
                  
                  <div className="space-y-4">
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
                <CardContent className="p-8">
                  <div className="w-16 h-16 bg-secondary rounded-2xl flex items-center justify-center mx-auto mb-6">
                    <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" />
                    </svg>
                  </div>
                  <h3 className="text-xl font-semibold text-gray-900 mb-3">Create a Circle</h3>
                  <p className="text-gray-600 mb-6">Start fresh with a new circle for your group.</p>
                  
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
          </div>
        ) : (
          // Has Circle State
          <div>
            <Card className="mb-8">
              <CardContent className="p-8">
                <div className="mb-6">
                  <h2 className="text-2xl font-bold text-gray-900 mb-4">Your Inner Circle</h2>
                  <div className="flex flex-col sm:flex-row sm:items-center gap-x-2 gap-y-2">
                    <span className="text-sm text-gray-500 font-medium">Invite Code:</span>
                    <div className="flex items-center gap-x-2">
                      <div className="bg-gray-100 px-4 py-2 rounded-md font-mono tracking-widest text-lg font-semibold text-gray-800">
                        {circle.inviteCode}
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => copyInviteCode(circle.inviteCode)}
                        className="text-primary hover:text-blue-600"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                        </svg>
                      </Button>
                    </div>
                  </div>
                </div>
                
                <div className="space-y-2 mb-6">
                  {circle.members?.map((member: any, index: number) => (
                    <div key={member.id} className="flex items-center justify-between py-3 px-4 bg-gray-50 rounded-xl shadow-sm border border-gray-200 hover:bg-gray-100 transition-colors">
                      <div className="flex items-center space-x-3 flex-1 min-w-0">
                        <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center flex-shrink-0">
                          <span className="text-white font-semibold text-sm">
                            {member.user.firstName?.charAt(0) || member.user.email?.charAt(0).toUpperCase() || '?'}
                          </span>
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="font-medium text-gray-900 truncate">
                            {member.user.firstName && member.user.lastName 
                              ? `${member.user.firstName} ${member.user.lastName}`
                              : member.user.email
                            }
                          </div>
                          <div className="text-sm text-gray-500 truncate">{member.user.email}</div>
                        </div>
                      </div>
                      <div className="flex-shrink-0 ml-3">
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                          Member
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
                
                <div className="mt-4 px-3 py-2 bg-blue-50 rounded-md">
                  <div className="flex items-center gap-x-2 text-blue-700">
                    <svg className="w-4 h-4 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                    </svg>
                    <span className="text-sm font-medium">
                      Circle Status: {circle.members?.length || 0} of 4 members
                    </span>
                  </div>
                </div>
              </CardContent>
            </Card>
            
            <div className="text-center mt-6">
              <Button 
                onClick={handleEnterCircle}
                className="bg-primary hover:bg-blue-600 text-white px-6 py-2 rounded-xl text-sm font-semibold transition-all duration-200 shadow-md hover:shadow-lg"
              >
                Enter Circle →
              </Button>
            </div>
          </div>
        )}
      </div>
    </MobileLayout>
  );
}
