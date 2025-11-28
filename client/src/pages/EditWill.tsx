import { useState, useEffect } from "react";
import { useParams, useLocation } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { useAuth } from "@/hooks/useAuth";
import { splitDateTime, createDateTimeFromInputs } from "@/lib/dateUtils";

export default function EditWill() {
  const { id } = useParams();
  const [, setLocation] = useLocation();
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [startDate, setStartDate] = useState("");
  const [startTime, setStartTime] = useState("");
  const [endDate, setEndDate] = useState("");
  const [endTime, setEndTime] = useState("");

  const { data: will, isLoading } = useQuery({
    queryKey: [`/api/wills/${id}/details`],
    enabled: !!id,
  });

  const { data: circle } = useQuery({
    queryKey: ['/api/circles/mine'],
  });

  // Detect solo mode from will data with localStorage fallback
  const isSoloMode = will?.mode === 'solo';
  
  // Helper to get the appropriate hub URL even in error states
  const getHubUrl = () => {
    if (will?.mode === 'solo') return '/solo/hub';
    if (will?.mode === 'circle') return '/hub';
    // Fallback to localStorage for error states
    const lastMode = localStorage.getItem('lastWillMode');
    return lastMode === 'solo' ? '/solo/hub' : '/hub';
  };

  useEffect(() => {
    if (will) {
      const startDateTime = splitDateTime(will.startDate);
      const endDateTime = splitDateTime(will.endDate);
      
      setStartDate(startDateTime.date);
      setStartTime(startDateTime.time);
      setEndDate(endDateTime.date);
      setEndTime(endDateTime.time);
    }
  }, [will]);

  const updateMutation = useMutation({
    mutationFn: async (data: { startDate: string; endDate: string }) => {
      await apiRequest(`/api/wills/${id}`, {
        method: 'PUT',
        body: JSON.stringify(data)
      });
    },
    onSuccess: () => {
      // Invalidate all related queries to ensure UI updates everywhere
      queryClient.invalidateQueries({ queryKey: [`/api/wills/${id}/details`] });
      queryClient.invalidateQueries({ queryKey: ['/api/wills/circle'] });
      queryClient.invalidateQueries({ queryKey: [`/api/wills/circle/${circle?.id}`] });
      queryClient.invalidateQueries({ queryKey: ['/api/circles/mine'] });
      
      toast({
        title: "WILL Updated",
        description: "The will dates have been successfully updated",
      });
      setLocation(`/will/${id}`);
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async () => {
      await apiRequest(`/api/wills/${id}`, { method: 'DELETE' });
    },
    onSuccess: () => {
      // Invalidate all related queries to ensure UI updates everywhere
      if (isSoloMode) {
        queryClient.invalidateQueries({ queryKey: ['/api/wills/solo'] });
      } else {
        queryClient.invalidateQueries({ queryKey: ['/api/wills/circle'] });
        queryClient.invalidateQueries({ queryKey: [`/api/wills/circle/${circle?.id}`] });
        queryClient.invalidateQueries({ queryKey: ['/api/circles/mine'] });
      }
      
      toast({
        title: "WILL Deleted",
        description: "The will has been successfully deleted",
      });
      setLocation(getHubUrl());
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleUpdate = () => {
    if (!startDate || !endDate || !startTime || !endTime) {
      toast({
        title: "Missing Information",
        description: "Please provide both start and end dates with times",
        variant: "destructive",
      });
      return;
    }

    // Create proper datetime strings
    const startDateTime = createDateTimeFromInputs(startDate, startTime);
    const endDateTime = createDateTimeFromInputs(endDate, endTime);
    
    const start = new Date(startDateTime);
    const end = new Date(endDateTime);
    const now = new Date();

    if (start <= now) {
      toast({
        title: "Invalid Date",
        description: "Start date must be in the future",
        variant: "destructive",
      });
      return;
    }

    if (end <= start) {
      toast({
        title: "Invalid Date",
        description: "End date must be after start date",
        variant: "destructive",
      });
      return;
    }

    updateMutation.mutate({
      startDate: startDateTime,
      endDate: endDateTime,
    });
  };

  const handleDelete = () => {
    deleteMutation.mutate();
  };

  if (isLoading) {
    return (
      <div className="min-h-screen pt-16 flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">Loading...</h2>
        </div>
      </div>
    );
  }

  if (!will) {
    return (
      <div className="min-h-screen pt-16 flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">WILL not found</h2>
          <Button onClick={() => setLocation(getHubUrl())}>
            Back to Hub
          </Button>
        </div>
      </div>
    );
  }

  // Check if user is the creator
  if (will.createdBy !== user?.id) {
    return (
      <div className="min-h-screen pt-16 flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">Unauthorized</h2>
          <p className="text-gray-600 mb-4">Only the will creator can edit this will</p>
          <Button onClick={() => setLocation(`/will/${id}`)}>
            Back to <em>Will</em> Details
          </Button>
        </div>
      </div>
    );
  }

  // Check if will can be edited
  if (will.status === 'active' || will.status === 'completed') {
    return (
      <div className="min-h-screen pt-16 flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">Cannot Edit <em>Will</em></h2>
          <p className="text-gray-600 mb-4">This will cannot be modified because it is {will.status}</p>
          <Button onClick={() => setLocation(`/will/${id}`)}>
            Back to <em>Will</em> Details
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen pt-16 py-12 bg-gray-50">
      <div className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8">
        
        {/* Header */}
        <div className="text-center mb-8">
          <div className="flex items-center justify-center space-x-3 mb-4">
            <div className="w-12 h-12 bg-gradient-to-br from-primary to-secondary rounded-xl flex items-center justify-center">
              <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
              </svg>
            </div>
            <div>
              <h1 className="text-3xl font-bold text-gray-900">Edit Will</h1>
              <p className="text-gray-600">Modify the will dates</p>
            </div>
          </div>
        </div>

        <Card className="mb-8">
          <CardHeader>
            <CardTitle>Will Dates</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-8">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Start Date & Time */}
                <div className="space-y-4">
                  <label className="block text-sm font-medium text-gray-700 mb-3">Start Date & Time</label>
                  <div className="space-y-3">
                    <div>
                      <label className="block text-xs font-medium text-gray-500 mb-1">Date</label>
                      <Input
                        type="date"
                        value={startDate}
                        onChange={(e) => setStartDate(e.target.value)}
                        className="w-full"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-500 mb-1">Time</label>
                      <Input
                        type="time"
                        value={startTime}
                        onChange={(e) => setStartTime(e.target.value)}
                        className="w-full"
                      />
                    </div>
                  </div>
                </div>
                
                {/* End Date & Time */}
                <div className="space-y-4">
                  <label className="block text-sm font-medium text-gray-700 mb-3">End Date & Time</label>
                  <div className="space-y-3">
                    <div>
                      <label className="block text-xs font-medium text-gray-500 mb-1">Date</label>
                      <Input
                        type="date"
                        value={endDate}
                        onChange={(e) => setEndDate(e.target.value)}
                        className="w-full"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-500 mb-1">Time</label>
                      <Input
                        type="time"
                        value={endTime}
                        onChange={(e) => setEndTime(e.target.value)}
                        className="w-full"
                      />
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Warning Box */}
        <Card className="mb-8 border-yellow-200 bg-yellow-50">
          <CardContent className="p-6">
            <div className="flex items-start space-x-3">
              <svg className="w-5 h-5 text-yellow-600 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
              </svg>
              <div>
                <h3 className="text-sm font-medium text-yellow-800 mb-1">Important Notice</h3>
                <p className="text-sm text-yellow-700">
                  Once this will becomes active, it cannot be modified or deleted. Make sure the dates are correct before saving.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Action Buttons */}
        <div className="flex justify-between">
          <div className="space-x-3">
            <Button variant="outline" onClick={() => setLocation(`/will/${id}`)}>
              Cancel
            </Button>
            
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="destructive">
                  Delete Will
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Delete Will</AlertDialogTitle>
                  <AlertDialogDescription>
                    Are you sure you want to delete this will? This action cannot be undone and will remove all commitments.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction 
                    onClick={handleDelete}
                    className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                  >
                    {deleteMutation.isPending ? "Deleting..." : "Delete"}
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
          
          <Button 
            onClick={handleUpdate}
            disabled={updateMutation.isPending}
            className="bg-secondary hover:bg-green-600"
          >
            {updateMutation.isPending ? "Updating..." : "Update Will"}
          </Button>
        </div>
      </div>
    </div>
  );
}