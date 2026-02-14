import { useState } from "react";
import { useLocation } from "wouter";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { MobileLayout, UnifiedBackButton } from "@/components/ui/design-system";
import { Users, Plus, ChevronRight } from "lucide-react";

interface CircleMember {
  id: number;
  circleId: number;
  userId: string;
  user: {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
  };
}

interface Circle {
  id: number;
  inviteCode: string;
  createdBy: string;
  createdAt: string;
  members: CircleMember[];
  activeWillCount: number;
  currentWillStatus: string | null;
}

export default function CircleLobby() {
  const [, setLocation] = useLocation();
  const [inviteCode, setInviteCode] = useState("");
  const [showJoinInput, setShowJoinInput] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  const { data: circles = [], isLoading } = useQuery<Circle[]>({
    queryKey: ['/api/circles/mine'],
    staleTime: 0,
  });

  const circleCount = circles.length;
  const isAtMaxCircles = circleCount >= 3;

  const createCircleMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest('/api/circles', { method: 'POST' });
      return response.json() as Promise<Circle>;
    },
    onSuccess: (newCircle: Circle) => {
      // Invalidate all circle-related queries
      queryClient.invalidateQueries({ queryKey: ['/api/circles/mine'] });
      queryClient.invalidateQueries({ queryKey: [`/api/circles/${newCircle.id}`] });
      toast({
        title: "Circle Created!",
        description: "Your new circle has been created.",
      });
      // Navigate to the new circle
      setLocation(`/circles/${newCircle.id}`);
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const joinCircleMutation = useMutation({
    mutationFn: async (code: string) => {
      const response = await apiRequest('/api/circles/join', {
        method: 'POST',
        body: JSON.stringify({ inviteCode: code })
      });
      return response.json() as Promise<Circle>;
    },
    onSuccess: (joinedCircle: Circle) => {
      // Invalidate all circle-related queries
      queryClient.invalidateQueries({ queryKey: ['/api/circles/mine'] });
      queryClient.invalidateQueries({ queryKey: [`/api/circles/${joinedCircle.id}`] });
      setInviteCode("");
      setShowJoinInput(false);
      toast({
        title: "Joined Circle!",
        description: "You've successfully joined the circle.",
      });
      // Navigate to the joined circle
      setLocation(`/circles/${joinedCircle.id}`);
    },
    onError: (error: Error) => {
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

  const handleEnterCircle = (circleId: number) => {
    setLocation(`/circles/${circleId}`);
  };

  const getCircleDisplayName = (circle: Circle) => {
    const memberNames = circle.members
      .map(m => m.user.firstName)
      .slice(0, 3)
      .join(", ");
    if (circle.members.length > 3) {
      return `${memberNames} +${circle.members.length - 3}`;
    }
    return memberNames || "New Circle";
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
      <div className="space-y-3">
        <div className="relative flex items-center justify-between mb-2 min-h-[44px]">
          <UnifiedBackButton
            onClick={() => setLocation('/')}
            testId="button-back"
          />
          <h1 className="absolute left-0 right-0 text-center text-xl font-semibold text-gray-900 pointer-events-none" data-testid="text-page-title">My Circles</h1>
          <div className="w-11"></div>
        </div>

        <div className="space-y-4 pb-6">
            {circles.length === 0 ? (
              /* Empty State */
              <div className="flex flex-col items-center justify-center py-12 px-4">
                <div className="w-20 h-20 bg-gradient-to-br from-emerald-100 to-teal-100 rounded-full flex items-center justify-center mb-6">
                  <Users className="w-10 h-10 text-emerald-600" />
                </div>
                <h2 className="text-xl font-semibold text-gray-900 mb-2 text-center">
                  You're not in any circles yet
                </h2>
                <p className="text-gray-500 text-center mb-8 max-w-xs">
                  Circles are small groups (2-4 people) who hold each other accountable. Create one or join with an invite code.
                </p>
                
                {/* Create Circle Button */}
                <Button 
                  onClick={handleCreateCircle}
                  disabled={createCircleMutation.isPending}
                  className="w-full max-w-xs bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 text-white py-6 rounded-xl text-base font-semibold shadow-lg shadow-emerald-500/25 mb-3"
                  data-testid="button-create-circle"
                >
                  <Plus className="w-5 h-5 mr-2" />
                  {createCircleMutation.isPending ? "Creating..." : "Create New Circle"}
                </Button>
                
                {/* Join Circle Section */}
                {!showJoinInput ? (
                  <Button 
                    variant="outline"
                    onClick={() => setShowJoinInput(true)}
                    className="w-full max-w-xs py-6 rounded-xl text-base font-semibold border-2"
                    data-testid="button-show-join"
                  >
                    Join Circle with Code
                  </Button>
                ) : (
                  <div className="w-full max-w-xs space-y-3">
                    <Input
                      placeholder="Enter invite code"
                      value={inviteCode}
                      onChange={(e) => setInviteCode(e.target.value.toUpperCase())}
                      className="text-center font-mono tracking-widest text-lg py-6"
                      maxLength={6}
                      data-testid="input-invite-code"
                    />
                    <div className="flex gap-2">
                      <Button 
                        variant="outline"
                        onClick={() => {
                          setShowJoinInput(false);
                          setInviteCode("");
                        }}
                        className="flex-1 py-5"
                      >
                        Cancel
                      </Button>
                      <Button 
                        onClick={handleJoinCircle}
                        disabled={joinCircleMutation.isPending || !inviteCode.trim()}
                        className="flex-1 py-5 bg-gradient-to-r from-blue-500 to-indigo-600"
                        data-testid="button-join-circle"
                      >
                        {joinCircleMutation.isPending ? "Joining..." : "Join"}
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              /* Circles List */
              <>
                {circles.map((circle) => (
                  <Card 
                    key={circle.id}
                    className="cursor-pointer hover:shadow-md transition-all duration-200 border-gray-200"
                    onClick={() => handleEnterCircle(circle.id)}
                    data-testid={`card-circle-${circle.id}`}
                  >
                    <CardContent className="p-4">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3 flex-1 min-w-0">
                          <div className="w-12 h-12 bg-gradient-to-br from-emerald-100 to-teal-100 rounded-xl flex items-center justify-center flex-shrink-0">
                            <Users className="w-6 h-6 text-emerald-600" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <h3 className="font-semibold text-gray-900 truncate">
                              {getCircleDisplayName(circle)}
                            </h3>
                            <div className="flex items-center gap-3 text-sm text-gray-500">
                              <span>{circle.members.length} member{circle.members.length !== 1 ? 's' : ''}</span>
                              {circle.activeWillCount > 0 && circle.currentWillStatus && 
                               ['pending', 'scheduled', 'active', 'will_review', 'paused'].includes(circle.currentWillStatus) ? (
                                <span className={`flex items-center gap-1 ${
                                  circle.currentWillStatus === 'paused' ? 'text-amber-600' :
                                  circle.currentWillStatus === 'pending' || circle.currentWillStatus === 'scheduled' ? 'text-blue-600' :
                                  'text-emerald-600'
                                }`}>
                                  <span className={`w-2 h-2 rounded-full ${
                                    circle.currentWillStatus === 'active' ? 'bg-emerald-500 animate-pulse' :
                                    circle.currentWillStatus === 'will_review' ? 'bg-emerald-500' :
                                    circle.currentWillStatus === 'paused' ? 'bg-amber-500' :
                                    'bg-blue-500'
                                  }`}></span>
                                  {circle.currentWillStatus === 'pending' ? 'Pending' : 
                                   circle.currentWillStatus === 'scheduled' ? 'Scheduled' :
                                   circle.currentWillStatus === 'active' ? 'Active' : 
                                   circle.currentWillStatus === 'will_review' ? 'In Review' : 
                                   circle.currentWillStatus === 'paused' ? 'Paused' :
                                   'Active'}
                                </span>
                              ) : (
                                <span className="flex items-center gap-1 text-gray-400">
                                  <span className="w-2 h-2 bg-gray-300 rounded-full"></span>
                                  No active will
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                        <ChevronRight className="w-5 h-5 text-gray-400 flex-shrink-0" />
                      </div>
                    </CardContent>
                  </Card>
                ))}

                {/* Create/Join buttons - only show if not at max */}
                {!isAtMaxCircles && (
                  <div className="pt-4 space-y-3">
                    <Button 
                      onClick={handleCreateCircle}
                      disabled={createCircleMutation.isPending}
                      className="w-full bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 text-white py-5 rounded-xl font-semibold shadow-lg shadow-emerald-500/25"
                      data-testid="button-create-circle"
                    >
                      <Plus className="w-5 h-5 mr-2" />
                      {createCircleMutation.isPending ? "Creating..." : "Create New Circle"}
                    </Button>
                    
                    {!showJoinInput ? (
                      <Button 
                        variant="outline"
                        onClick={() => setShowJoinInput(true)}
                        className="w-full py-5 rounded-xl font-semibold border-2"
                        data-testid="button-show-join"
                      >
                        Join Circle with Code
                      </Button>
                    ) : (
                      <div className="space-y-3">
                        <Input
                          placeholder="Enter invite code"
                          value={inviteCode}
                          onChange={(e) => setInviteCode(e.target.value.toUpperCase())}
                          className="text-center font-mono tracking-widest text-lg py-5"
                          maxLength={6}
                          data-testid="input-invite-code"
                        />
                        <div className="flex gap-2">
                          <Button 
                            variant="outline"
                            onClick={() => {
                              setShowJoinInput(false);
                              setInviteCode("");
                            }}
                            className="flex-1 py-4"
                          >
                            Cancel
                          </Button>
                          <Button 
                            onClick={handleJoinCircle}
                            disabled={joinCircleMutation.isPending || !inviteCode.trim()}
                            className="flex-1 py-4 bg-gradient-to-r from-blue-500 to-indigo-600"
                            data-testid="button-join-circle"
                          >
                            {joinCircleMutation.isPending ? "Joining..." : "Join"}
                          </Button>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </>
            )}
          </div>
      </div>
    </MobileLayout>
  );
}
