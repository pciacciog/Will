import { useState, useEffect, useRef, useCallback } from "react";
import { useParams, useLocation } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { useAuth } from "@/hooks/useAuth";
import { splitDateTime, createDateTimeFromInputs } from "@/lib/dateUtils";
import TimeChipPicker from "@/components/TimeChipPicker";
import { MobileLayout, UnifiedBackButton } from "@/components/ui/design-system";
import { Calendar, Save, Trash2, AlertTriangle } from "lucide-react";

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
  const [what, setWhat] = useState("");
  const [why, setWhy] = useState("");

  const whatRef = useRef<HTMLTextAreaElement>(null);
  const whyRef = useRef<HTMLTextAreaElement>(null);

  const resizeTextarea = useCallback((ref: React.RefObject<HTMLTextAreaElement>, maxHeight: number = 96) => {
    const textarea = ref.current;
    if (!textarea) return;
    textarea.style.height = 'auto';
    const newHeight = Math.min(textarea.scrollHeight, maxHeight);
    textarea.style.height = `${newHeight}px`;
  }, []);

  useEffect(() => { resizeTextarea(whatRef); }, [what, resizeTextarea]);
  useEffect(() => { resizeTextarea(whyRef); }, [why, resizeTextarea]);

  const { data: will, isLoading } = useQuery<any>({
    queryKey: [`/api/wills/${id}/details`],
    enabled: !!id,
  });

  const { data: circle } = useQuery<any>({
    queryKey: ['/api/circles/mine'],
  });

  const isSoloMode = will?.mode === 'solo' || will?.mode === 'personal';
  const isIndefinite = will?.isIndefinite;
  const userCommitment = will?.commitments?.find((c: any) => c.userId === user?.id);

  const getHubUrl = () => {
    if (will?.mode === 'solo' || will?.mode === 'personal') return '/';
    if (will?.mode === 'circle') return '/hub';
    const lastMode = localStorage.getItem('lastWillMode');
    return lastMode === 'solo' ? '/' : '/hub';
  };

  useEffect(() => {
    if (will) {
      const startDateTime = splitDateTime(will.startDate);
      setStartDate(startDateTime.date);
      setStartTime(startDateTime.time);

      if (!will.isIndefinite && will.endDate) {
        const endDateTime = splitDateTime(will.endDate);
        setEndDate(endDateTime.date);
        setEndTime(endDateTime.time);
      }
    }
  }, [will]);

  useEffect(() => {
    if (userCommitment) {
      setWhat(userCommitment.what || "");
      setWhy(userCommitment.why || "");
    }
  }, [userCommitment]);

  const updateWillMutation = useMutation({
    mutationFn: async (data: { startDate: string; endDate?: string }) => {
      await apiRequest(`/api/wills/${id}`, {
        method: 'PUT',
        body: JSON.stringify(data)
      });
    },
  });

  const updateCommitmentMutation = useMutation({
    mutationFn: async (data: { what: string; why: string }) => {
      if (!userCommitment) return;
      await apiRequest(`/api/will-commitments/${userCommitment.id}`, {
        method: 'PUT',
        body: JSON.stringify(data)
      });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async () => {
      await apiRequest(`/api/wills/${id}`, { method: 'DELETE' });
    },
    onSuccess: () => {
      if (isSoloMode) {
        queryClient.invalidateQueries({ queryKey: ['/api/wills/solo'] });
        queryClient.invalidateQueries({ queryKey: ['/api/wills/personal'] });
      } else {
        queryClient.invalidateQueries({ queryKey: ['/api/wills/circle'] });
        queryClient.invalidateQueries({ queryKey: [`/api/wills/circle/${circle?.id}`] });
        queryClient.invalidateQueries({ queryKey: ['/api/circles/mine'] });
      }
      queryClient.invalidateQueries({ queryKey: ['/api/wills/all-active'] });
      toast({
        title: "Will Deleted",
        description: "The will has been successfully deleted",
      });
      setLocation(getHubUrl());
    },
    onError: (error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const handleSave = async () => {
    if (!isIndefinite) {
      if (!startDate || !endDate || !startTime || !endTime) {
        toast({ title: "Missing Information", description: "Please provide start and end dates with times", variant: "destructive" });
        return;
      }
      const startDateTime = createDateTimeFromInputs(startDate, startTime);
      const endDateTime = createDateTimeFromInputs(endDate, endTime);
      const start = new Date(startDateTime);
      const end = new Date(endDateTime);
      const now = new Date();

      if (start <= now) {
        toast({ title: "Invalid Date", description: "Start date must be in the future", variant: "destructive" });
        return;
      }
      if (end <= start) {
        toast({ title: "Invalid Date", description: "End date must be after start date", variant: "destructive" });
        return;
      }
    }

    if (isSoloMode && (!what.trim() || !why.trim())) {
      toast({ title: "Missing Information", description: "Please fill in your commitment and reason", variant: "destructive" });
      return;
    }

    try {
      if (!isIndefinite) {
        const startDateTime = createDateTimeFromInputs(startDate, startTime);
        const endDateTime = createDateTimeFromInputs(endDate, endTime);
        await updateWillMutation.mutateAsync({ startDate: startDateTime, endDate: endDateTime });
      }

      if (isSoloMode && userCommitment) {
        await updateCommitmentMutation.mutateAsync({ what: what.trim(), why: why.trim() });
      }

      queryClient.invalidateQueries({ queryKey: [`/api/wills/${id}/details`] });
      queryClient.invalidateQueries({ queryKey: ['/api/wills/circle'] });
      queryClient.invalidateQueries({ queryKey: [`/api/wills/circle/${circle?.id}`] });
      queryClient.invalidateQueries({ queryKey: ['/api/circles/mine'] });
      queryClient.invalidateQueries({ queryKey: ['/api/wills/all-active'] });
      queryClient.invalidateQueries({ queryKey: ['/api/wills/solo'] });
      queryClient.invalidateQueries({ queryKey: ['/api/wills/personal'] });

      toast({ title: "Updated", description: "Your will has been updated successfully" });
      setLocation(`/will/${id}`);
    } catch (error: any) {
      toast({ title: "Error", description: error.message || "Failed to update", variant: "destructive" });
    }
  };

  const isSaving = updateWillMutation.isPending || updateCommitmentMutation.isPending;

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!will) {
    return (
      <div className="min-h-screen pt-16 flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">Will not found</h2>
          <Button onClick={() => setLocation(getHubUrl())}>Back to Hub</Button>
        </div>
      </div>
    );
  }

  if (will.createdBy !== user?.id) {
    return (
      <div className="min-h-screen pt-16 flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">Unauthorized</h2>
          <p className="text-gray-600 mb-4">Only the will creator can edit this will</p>
          <Button onClick={() => setLocation(`/will/${id}`)}>Back to Will</Button>
        </div>
      </div>
    );
  }

  if (will.status === 'active' || will.status === 'completed') {
    return (
      <div className="min-h-screen pt-16 flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">Cannot Edit</h2>
          <p className="text-gray-600 mb-4">This will cannot be modified because it is {will.status}</p>
          <Button onClick={() => setLocation(`/will/${id}`)}>Back to Will</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full max-w-screen-sm mx-auto overflow-x-hidden">
      <MobileLayout>
        <div className="relative flex items-center mb-6 min-h-[44px]">
          <UnifiedBackButton 
            onClick={() => setLocation(`/will/${id}`)} 
            testId="button-back"
          />
          <span className="absolute left-0 right-0 text-center text-lg font-semibold text-gray-900 pointer-events-none">
            Edit Will
          </span>
          <div className="w-11 ml-auto"></div>
        </div>

        <div className="space-y-5">
          {isSoloMode && userCommitment && (
            <div className="bg-white rounded-xl border border-gray-200 p-4">
              <h3 className="text-sm font-semibold text-gray-900 mb-3">Your Commitment</h3>
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1.5">I will...</label>
                <div className="flex items-start bg-white border border-gray-200 rounded-lg p-3 focus-within:ring-2 focus-within:ring-blue-500 transition-all">
                  <Textarea
                    ref={whatRef}
                    rows={1}
                    maxLength={75}
                    value={what}
                    onChange={(e) => {
                      if (e.target.value.length <= 75) setWhat(e.target.value);
                    }}
                    className="flex-1 border-none outline-none resize-none overflow-y-auto text-base leading-relaxed p-0 shadow-none focus:ring-0 bg-transparent placeholder:text-gray-400"
                    style={{ maxHeight: '96px' }}
                    placeholder="go to bjj"
                    data-testid="input-what"
                  />
                </div>
                <div className="text-xs text-gray-400 mt-1 text-right">{what.length}/75</div>
              </div>
              <div className="mt-3">
                <div className="flex items-center justify-between mb-1.5">
                  <label className="block text-xs font-medium text-gray-500">Because...</label>
                  <span className="text-[10px] text-gray-400 flex items-center gap-1">
                    <svg className="w-2.5 h-2.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                    </svg>
                    Private
                  </span>
                </div>
                <div className="flex items-start bg-white border border-gray-200 rounded-lg p-3 focus-within:ring-2 focus-within:ring-blue-500 transition-all">
                  <Textarea
                    ref={whyRef}
                    rows={1}
                    maxLength={75}
                    value={why}
                    onChange={(e) => {
                      if (e.target.value.length <= 75) setWhy(e.target.value);
                    }}
                    className="flex-1 border-none outline-none resize-none overflow-y-auto text-base leading-relaxed p-0 shadow-none focus:ring-0 bg-transparent placeholder:text-gray-400"
                    style={{ maxHeight: '96px' }}
                    placeholder="I feel great after training"
                    data-testid="input-why"
                  />
                </div>
                <div className="text-xs text-gray-400 mt-1 text-right">{why.length}/75</div>
              </div>
            </div>
          )}

          {!isIndefinite && (
            <div className="bg-white rounded-xl border border-gray-200 p-4">
              <div className="flex items-center gap-2 mb-3">
                <Calendar className="w-4 h-4 text-blue-500" />
                <h3 className="text-sm font-semibold text-gray-900">Timeline</h3>
              </div>
              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1.5">Start Date & Time</label>
                  <div className="grid grid-cols-2 gap-2">
                    <Input
                      type="date"
                      value={startDate}
                      onChange={(e) => setStartDate(e.target.value)}
                      className="text-sm"
                      data-testid="input-start-date"
                    />
                    <TimeChipPicker
                      value={startTime}
                      onChange={setStartTime}
                      testId="edit-start-time"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1.5">End Date & Time</label>
                  <div className="grid grid-cols-2 gap-2">
                    <Input
                      type="date"
                      value={endDate}
                      onChange={(e) => setEndDate(e.target.value)}
                      className="text-sm"
                      data-testid="input-end-date"
                    />
                    <TimeChipPicker
                      value={endTime}
                      onChange={setEndTime}
                      testId="edit-end-time"
                    />
                  </div>
                </div>
              </div>
            </div>
          )}

          <div className="flex items-start gap-2 px-1 py-2">
            <AlertTriangle className="w-4 h-4 text-amber-500 mt-0.5 flex-shrink-0" />
            <p className="text-xs text-gray-500">
              Once this will becomes active, it cannot be modified or deleted.
            </p>
          </div>

          <button
            onClick={handleSave}
            disabled={isSaving}
            className="w-full bg-gradient-to-r from-emerald-600 to-teal-600 text-white rounded-xl py-3.5 text-base font-semibold shadow-md hover:shadow-lg transition-all active:scale-[0.98] disabled:opacity-50"
            data-testid="button-save-will"
          >
            <span className="flex items-center justify-center gap-2">
              <Save className="w-4 h-4" />
              {isSaving ? "Saving..." : "Save Changes"}
            </span>
          </button>

          <div className="pt-2">
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <button
                  className="w-full flex items-center justify-center gap-2 text-sm text-red-500 hover:text-red-600 py-2 transition-colors"
                  data-testid="button-delete-will"
                >
                  <Trash2 className="w-4 h-4" />
                  Delete Will
                </button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Delete Will</AlertDialogTitle>
                  <AlertDialogDescription>
                    Are you sure you want to delete this will? This action cannot be undone.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction 
                    onClick={() => deleteMutation.mutate()}
                    className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                  >
                    {deleteMutation.isPending ? "Deleting..." : "Delete"}
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        </div>
      </MobileLayout>
    </div>
  );
}
