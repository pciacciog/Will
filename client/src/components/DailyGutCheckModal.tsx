import { useState, useMemo } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { CheckCircle, XCircle, MinusCircle } from "lucide-react";
import type { WillCheckIn } from "@shared/schema";

interface DailyGutCheckModalProps {
  isOpen: boolean;
  onClose: () => void;
  willId: number;
}

type CheckInStatus = 'yes' | 'no' | 'partial';

function getTodayDateKey(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export default function DailyGutCheckModal({ isOpen, onClose, willId }: DailyGutCheckModalProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const todayKey = getTodayDateKey();

  const { data: checkIns = [] } = useQuery<WillCheckIn[]>({
    queryKey: [`/api/wills/${willId}/check-ins`],
    enabled: isOpen,
  });

  const todayCheckIn = useMemo(() => {
    return checkIns.find(c => c.date === todayKey);
  }, [checkIns, todayKey]);

  const [selected, setSelected] = useState<CheckInStatus | null>(null);

  const submitMutation = useMutation({
    mutationFn: async (status: CheckInStatus) => {
      const res = await apiRequest(`/api/wills/${willId}/check-ins`, {
        method: 'POST',
        body: JSON.stringify({ date: todayKey, status }),
      });
      return res.json();
    },
    onSuccess: () => {
      toast({
        title: "Noted!",
        description: "Your check-in has been saved.",
        duration: 2000,
      });
      queryClient.invalidateQueries({ queryKey: [`/api/wills/${willId}/check-ins`] });
      queryClient.invalidateQueries({ queryKey: [`/api/wills/${willId}/details`] });
      onClose();
      setSelected(null);
    },
    onError: (error: Error) => {
      toast({
        title: "Couldn't save",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleSelect = (status: CheckInStatus) => {
    setSelected(status);
    submitMutation.mutate(status);
  };

  if (todayCheckIn) {
    return (
      <Dialog open={isOpen} onOpenChange={(open) => { if (!open) onClose(); }}>
        <DialogContent className="max-w-[340px] rounded-2xl p-6 text-center">
          <div className="flex flex-col items-center gap-3">
            <div className="w-12 h-12 rounded-full bg-emerald-100 flex items-center justify-center">
              <CheckCircle className="w-6 h-6 text-emerald-600" />
            </div>
            <p className="text-base font-semibold text-gray-900">Already checked in today</p>
            <p className="text-sm text-gray-500">
              You responded: <span className="font-medium capitalize">{todayCheckIn.status}</span>
            </p>
            <Button
              variant="outline"
              onClick={onClose}
              className="mt-2 w-full"
              data-testid="button-gut-check-dismiss"
            >
              Got it
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={isOpen} onOpenChange={(open) => { if (!open) { onClose(); setSelected(null); } }}>
      <DialogContent className="max-w-[340px] rounded-2xl p-6 text-center">
        <div className="flex flex-col items-center gap-4">
          <p className="text-lg font-semibold text-gray-900">Did you follow through today?</p>
          <p className="text-sm text-gray-500 -mt-2">Quick daily accountability check</p>

          <div className="flex gap-3 w-full mt-1">
            <button
              onClick={() => handleSelect('yes')}
              disabled={submitMutation.isPending}
              className={`flex-1 flex flex-col items-center gap-1.5 py-4 rounded-xl border-2 transition-all ${
                selected === 'yes'
                  ? 'border-emerald-500 bg-emerald-50'
                  : 'border-gray-200 hover:border-emerald-300 hover:bg-emerald-50/50'
              }`}
              data-testid="button-gut-check-yes"
            >
              <CheckCircle className="w-7 h-7 text-emerald-500" />
              <span className="text-sm font-medium text-gray-700">Yes</span>
            </button>

            <button
              onClick={() => handleSelect('partial')}
              disabled={submitMutation.isPending}
              className={`flex-1 flex flex-col items-center gap-1.5 py-4 rounded-xl border-2 transition-all ${
                selected === 'partial'
                  ? 'border-amber-500 bg-amber-50'
                  : 'border-gray-200 hover:border-amber-300 hover:bg-amber-50/50'
              }`}
              data-testid="button-gut-check-partial"
            >
              <MinusCircle className="w-7 h-7 text-amber-500" />
              <span className="text-sm font-medium text-gray-700">Partial</span>
            </button>

            <button
              onClick={() => handleSelect('no')}
              disabled={submitMutation.isPending}
              className={`flex-1 flex flex-col items-center gap-1.5 py-4 rounded-xl border-2 transition-all ${
                selected === 'no'
                  ? 'border-red-500 bg-red-50'
                  : 'border-gray-200 hover:border-red-300 hover:bg-red-50/50'
              }`}
              data-testid="button-gut-check-no"
            >
              <XCircle className="w-7 h-7 text-red-500" />
              <span className="text-sm font-medium text-gray-700">No</span>
            </button>
          </div>

          {submitMutation.isPending && (
            <p className="text-xs text-gray-400">Saving...</p>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
