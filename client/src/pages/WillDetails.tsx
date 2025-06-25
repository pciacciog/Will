import { useParams, useLocation } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { useAuth } from "@/hooks/useAuth";

function formatDateRange(startDate: string, endDate: string): string {
  const start = new Date(startDate);
  const end = new Date(endDate);
  return `${start.toLocaleDateString('en-US', { month: 'long', day: 'numeric' })} - ${end.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}`;
}

function calculateDuration(startDate: string, endDate: string): string {
  const start = new Date(startDate);
  const end = new Date(endDate);
  const diff = end.getTime() - start.getTime();
  const days = Math.ceil(diff / (1000 * 60 * 60 * 24));
  return `${days} days total`;
}

function formatTimeRemaining(endDate: string): string {
  const now = new Date();
  const end = new Date(endDate);
  const diff = end.getTime() - now.getTime();
  
  if (diff <= 0) return 'Completed';
  
  const days = Math.floor(diff / (1000 * 60 * 60 * 24));
  const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
  
  if (days > 0) {
    return `${days} days, ${hours} hours remaining`;
  } else {
    return `${hours} hours remaining`;
  }
}

function calculateProgress(startDate: string, endDate: string): number {
  const now = new Date();
  const start = new Date(startDate);
  const end = new Date(endDate);
  
  if (now <= start) return 0;
  if (now >= end) return 100;
  
  const total = end.getTime() - start.getTime();
  const elapsed = now.getTime() - start.getTime();
  return Math.round((elapsed / total) * 100);
}

export default function WillDetails() {
  const { id } = useParams();
  const [, setLocation] = useLocation();
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: willDetails, isLoading } = useQuery({
    queryKey: ['/api/wills', id, 'details'],
    enabled: !!id,
  });

  const acknowledgeWillMutation = useMutation({
    mutationFn: async () => {
      return apiRequest('POST', `/api/wills/${id}/acknowledge`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/wills', id, 'details'] });
      queryClient.invalidateQueries({ queryKey: ['/api/wills/circle'] });
      toast({
        title: "Acknowledged!",
        description: "You have acknowledged the completion of this Will.",
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

  const markProgressMutation = useMutation({
    mutationFn: async () => {
      const today = new Date().toISOString().split('T')[0];
      return apiRequest('POST', `/api/wills/${id}/progress`, {
        date: today,
        completed: true,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/wills', id, 'details'] });
      toast({
        title: "Progress Marked!",
        description: "Great job completing your commitment today!",
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

  const handleBackToHub = () => {
    setLocation('/hub');
  };

  const handleAcknowledgeCompletion = () => {
    acknowledgeWillMutation.mutate();
  };

  const handleMarkDoneToday = () => {
    markProgressMutation.mutate();
  };

  if (isLoading) {
    return (
      <div className="min-h-screen pt-16 flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!willDetails) {
    return (
      <div className="min-h-screen pt-16 flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">Will Not Found</h2>
          <Button onClick={handleBackToHub}>Back to Hub</Button>
        </div>
      </div>
    );
  }

  const progress = calculateProgress(willDetails.startDate, willDetails.endDate);
  const progressCircumference = 2 * Math.PI * 36; // radius = 36
  const progressOffset = progressCircumference - (progress / 100) * progressCircumference;

  return (
    <div className="min-h-screen pt-16 py-12">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <Button variant="ghost" onClick={handleBackToHub} className="flex items-center text-gray-600 hover:text-gray-800">
            <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            Back to Hub
          </Button>
          
          <div className="flex items-center space-x-3">
            <Badge className={`${
              willDetails.status === 'active' 
                ? 'bg-green-100 text-green-800' 
                : willDetails.status === 'completed' 
                ? 'bg-gray-100 text-gray-800'
                : willDetails.status === 'scheduled'
                ? 'bg-blue-100 text-blue-800'
                : 'bg-yellow-100 text-yellow-800'
            }`}>
              {willDetails.status.charAt(0).toUpperCase() + willDetails.status.slice(1)}
            </Badge>
            <span className="text-sm text-gray-500">
              {willDetails.status === 'active' ? formatTimeRemaining(willDetails.endDate) : ''}
            </span>
          </div>
        </div>
        
        {/* Will Overview */}
        <Card className="mb-8">
          <CardContent className="p-8">
            <div className="flex items-start justify-between mb-6">
              <div>
                <h1 className="text-2xl font-bold text-gray-900 mb-2">Our Will</h1>
                <div className="text-gray-600">
                  <p className="mb-1">{formatDateRange(willDetails.startDate, willDetails.endDate)}</p>
                  <p className="text-sm">{calculateDuration(willDetails.startDate, willDetails.endDate)}</p>
                </div>
              </div>
              
              {/* Progress Ring */}
              <div className="text-center">
                <div className="relative w-20 h-20">
                  <svg className="w-20 h-20 transform -rotate-90">
                    <circle cx="40" cy="40" r="36" stroke="#E5E7EB" strokeWidth="4" fill="none"></circle>
                    <circle 
                      cx="40" 
                      cy="40" 
                      r="36" 
                      stroke="#10B981" 
                      strokeWidth="4" 
                      fill="none" 
                      strokeDasharray={progressCircumference}
                      strokeDashoffset={progressOffset}
                      className="transition-all duration-500"
                    ></circle>
                  </svg>
                  <div className="absolute inset-0 flex items-center justify-center">
                    <span className="text-lg font-bold text-gray-900">{progress}%</span>
                  </div>
                </div>
              </div>
            </div>
            
            {/* Timeline */}
            <div className="border-l-2 border-gray-200 ml-4">
              <div className="relative -ml-2 pb-6">
                <div className="w-4 h-4 bg-green-500 rounded-full border-2 border-white shadow"></div>
                <div className="ml-6 -mt-4">
                  <p className="text-sm font-medium text-gray-900">Started</p>
                  <p className="text-xs text-gray-500">
                    {new Date(willDetails.startDate).toLocaleDateString('en-US', { 
                      month: 'long', 
                      day: 'numeric', 
                      year: 'numeric',
                      hour: 'numeric',
                      minute: '2-digit'
                    })}
                  </p>
                </div>
              </div>
              
              {willDetails.status === 'active' && (
                <div className="relative -ml-2 pb-6">
                  <div className="w-4 h-4 bg-blue-500 rounded-full border-2 border-white shadow animate-pulse"></div>
                  <div className="ml-6 -mt-4">
                    <p className="text-sm font-medium text-gray-900">Now</p>
                    <p className="text-xs text-gray-500">In progress</p>
                  </div>
                </div>
              )}
              
              <div className="relative -ml-2">
                <div className={`w-4 h-4 ${willDetails.status === 'completed' ? 'bg-green-500' : 'bg-gray-300'} rounded-full border-2 border-white shadow`}></div>
                <div className="ml-6 -mt-4">
                  <p className="text-sm font-medium text-gray-900">
                    {willDetails.status === 'completed' ? 'Completed' : 'Ends'}
                  </p>
                  <p className="text-xs text-gray-500">
                    {new Date(willDetails.endDate).toLocaleDateString('en-US', { 
                      month: 'long', 
                      day: 'numeric', 
                      year: 'numeric',
                      hour: 'numeric',
                      minute: '2-digit'
                    })}
                  </p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
        
        {/* Member Commitments */}
        <div className="grid gap-8">
          {willDetails.commitments?.map((commitment: any) => (
            <Card key={commitment.id}>
              <CardContent className="p-8">
                <div className="flex items-start space-x-4">
                  <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center">
                    <span className="text-white font-semibold">
                      {commitment.user.firstName?.charAt(0) || commitment.user.email?.charAt(0).toUpperCase() || '?'}
                    </span>
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="font-semibold text-gray-900">
                        {commitment.user.firstName && commitment.user.lastName 
                          ? `${commitment.user.firstName} ${commitment.user.lastName}`
                          : commitment.user.email
                        }
                      </h3>
                      <div className="flex items-center space-x-2">
                        <span className="text-sm text-gray-500">Progress:</span>
                        <div className="w-16 bg-gray-200 rounded-full h-2">
                          <div 
                            className="bg-green-500 h-2 rounded-full transition-all duration-500" 
                            style={{ width: `${commitment.progressPercent || 0}%` }}
                          ></div>
                        </div>
                        <span className="text-sm font-medium text-gray-900">{commitment.progressPercent || 0}%</span>
                      </div>
                    </div>
                    
                    <div className="mb-4">
                      <p className="text-gray-900 mb-2">
                        <span className="font-medium">I will</span> {commitment.what}
                      </p>
                      <p className="text-gray-600 text-sm">
                        <span className="font-medium">Because</span> {commitment.why}
                      </p>
                    </div>
                    
                    {/* Recent Activity placeholder - would need daily progress data */}
                    <div className="bg-gray-50 rounded-xl p-4">
                      <h4 className="text-sm font-medium text-gray-900 mb-2">Progress Stats</h4>
                      <div className="text-sm text-gray-600">
                        <p>Completed: {commitment.progressStats?.completed || 0} days</p>
                        <p>Total tracked: {commitment.progressStats?.total || 0} days</p>
                      </div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
        
        {/* Action Buttons */}
        <div className="mt-8 flex justify-center space-x-4">
          {willDetails.status === 'active' && (
            <Button 
              onClick={handleMarkDoneToday}
              disabled={markProgressMutation.isPending}
              className="bg-green-100 text-green-700 hover:bg-green-200 border-green-200"
              variant="outline"
            >
              <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
              {markProgressMutation.isPending ? 'Marking...' : 'Mark Done Today'}
            </Button>
          )}
          
          {willDetails.status === 'completed' && (
            <Button 
              onClick={handleAcknowledgeCompletion}
              disabled={acknowledgeWillMutation.isPending}
              className="bg-green-600 hover:bg-green-700"
            >
              {acknowledgeWillMutation.isPending ? 'Acknowledging...' : 'Acknowledge Completion'}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
