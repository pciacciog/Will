import { useState } from "react";
import { useLocation } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { MobileLayout } from "@/components/ui/design-system";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { Search, Target, Calendar, Users, Clock, ChevronRight, Compass, ArrowRight } from "lucide-react";

type PublicWill = {
  id: number;
  what: string;
  checkInType: string;
  startDate: string;
  endDate: string;
  createdBy: string;
  creatorName: string;
  memberCount: number;
  status: string;
};

export default function Explore() {
  const [, setLocation] = useLocation();
  const [searchQuery, setSearchQuery] = useState("");
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: publicWills, isLoading } = useQuery<PublicWill[]>({
    queryKey: ['/api/wills/public', searchQuery],
    staleTime: 30000,
  });

  const joinMutation = useMutation({
    mutationFn: async (willId: number) => {
      return apiRequest(`/api/wills/${willId}/join`, {
        method: 'POST',
      });
    },
    onSuccess: (data: any) => {
      toast({
        title: "Joined!",
        description: "You've joined this commitment. Good luck!",
      });
      queryClient.invalidateQueries({ queryKey: ['/api/wills/personal'] });
      queryClient.invalidateQueries({ queryKey: ['/api/wills/public'] });
      if (data?.willId) {
        setLocation(`/will/${data.willId}`);
      }
    },
    onError: (error: any) => {
      toast({
        title: "Couldn't join",
        description: error.message || "Something went wrong",
        variant: "destructive",
      });
    },
  });

  const formatDateRange = (startDate: string, endDate: string) => {
    const start = new Date(startDate);
    const end = new Date(endDate);
    return `${start.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} - ${end.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`;
  };

  const getDaysRemaining = (endDate: string) => {
    const end = new Date(endDate);
    const now = new Date();
    const diff = Math.ceil((end.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
    return diff > 0 ? diff : 0;
  };

  const filteredWills = publicWills?.filter(will => 
    !searchQuery || will.what.toLowerCase().includes(searchQuery.toLowerCase())
  ) || [];

  return (
    <MobileLayout title="Explore" showBack onBack={() => setLocation('/')}>
      <div className="space-y-6">
        <div className="text-center">
          <div className="inline-flex items-center justify-center w-12 h-12 bg-blue-50 rounded-full mb-3">
            <Compass className="w-6 h-6 text-blue-600" />
          </div>
          <h2 className="text-lg font-semibold text-gray-900 mb-1">Discover Public Commitments</h2>
          <p className="text-sm text-gray-500">Join others on their journey</p>
        </div>

        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
          <Input
            type="text"
            placeholder="Search commitments..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
            data-testid="input-search"
          />
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
          </div>
        ) : filteredWills.length === 0 ? (
          <div className="text-center py-12">
            <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <Target className="w-8 h-8 text-gray-400" />
            </div>
            <h3 className="text-lg font-medium text-gray-900 mb-2">No public commitments yet</h3>
            <p className="text-sm text-gray-500 mb-4">Be the first to create one!</p>
            <Button onClick={() => setLocation('/create-will')} className="bg-blue-500 hover:bg-blue-600">
              Create a Public Will
            </Button>
          </div>
        ) : (
          <div className="space-y-3">
            {filteredWills.map((will) => (
              <Card 
                key={will.id} 
                className="bg-white border border-gray-200 shadow-sm hover:shadow-md transition-shadow"
              >
                <CardContent className="p-4">
                  <div className="space-y-3">
                    <div className="flex items-start justify-between">
                      <div className="flex-1 min-w-0">
                        <p className="text-base font-medium text-gray-900 line-clamp-2">
                          {will.what}
                        </p>
                        <p className="text-xs text-gray-500 mt-1">
                          by {will.creatorName}
                        </p>
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                      <Badge className="bg-blue-100 text-blue-700 text-xs">
                        <Calendar className="w-3 h-3 mr-1" />
                        {formatDateRange(will.startDate, will.endDate)}
                      </Badge>
                      <Badge className="bg-gray-100 text-gray-700 text-xs">
                        {will.checkInType === 'daily' ? 'Daily' : 'One-time'}
                      </Badge>
                      {will.memberCount > 0 && (
                        <Badge className="bg-emerald-100 text-emerald-700 text-xs">
                          <Users className="w-3 h-3 mr-1" />
                          {will.memberCount} {will.memberCount === 1 ? 'member' : 'members'}
                        </Badge>
                      )}
                      {getDaysRemaining(will.endDate) > 0 && (
                        <Badge className="bg-amber-100 text-amber-700 text-xs">
                          <Clock className="w-3 h-3 mr-1" />
                          {getDaysRemaining(will.endDate)} days left
                        </Badge>
                      )}
                    </div>

                    <Button
                      onClick={() => joinMutation.mutate(will.id)}
                      disabled={joinMutation.isPending}
                      className="w-full bg-gradient-to-r from-blue-500 to-indigo-500 hover:from-blue-600 hover:to-indigo-600 text-white"
                      data-testid={`button-join-${will.id}`}
                    >
                      {joinMutation.isPending ? 'Joining...' : 'Join This Commitment'}
                      <ArrowRight className="w-4 h-4 ml-2" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </MobileLayout>
  );
}
