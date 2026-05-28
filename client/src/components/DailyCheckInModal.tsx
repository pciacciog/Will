import { useMemo } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { Check, X } from "lucide-react";
import type { WillCheckIn } from "@shared/schema";

interface DailyCheckInModalProps {
  isOpen: boolean;
  onClose: () => void;
  willId: number;
  startDate?: string;
  endDate?: string;
  existingCheckIns?: WillCheckIn[];
  initialDate?: string | null;
  checkInType?: string;
  activeDays?: string;
  customDays?: string;
  commitmentText?: string;
}

export default function DailyCheckInModal({
  isOpen,
  onClose,
  willId,
  initialDate = null,
  commitmentText,
}: DailyCheckInModalProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const targetDate = useMemo(() => {
    if (initialDate) return initialDate;
    const d = new Date();
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }, [initialDate]);

  const dateLabel = useMemo(() => {
    return new Date(targetDate + 'T12:00:00').toLocaleDateString('en-US', {
      weekday: 'long', month: 'long', day: 'numeric',
    });
  }, [targetDate]);

  const mutation = useMutation({
    mutationFn: async (status: 'yes' | 'no' | 'partial') => {
      const res = await apiRequest(`/api/wills/${willId}/check-ins`, {
        method: 'POST',
        body: JSON.stringify({ date: targetDate, status }),
      });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/wills/${willId}/check-ins`] });
      queryClient.invalidateQueries({ queryKey: [`/api/wills/${willId}/check-in-progress`] });
      onClose();
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to record check-in",
        variant: "destructive",
      });
    },
  });

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center" data-testid="modal-daily-checkin">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div
        className="relative w-full max-w-lg bg-white flex flex-col"
        style={{
          borderRadius: '20px 20px 0 0',
          paddingBottom: 'calc(env(safe-area-inset-bottom) + 24px)',
          animation: 'slideUpSheet 0.28s cubic-bezier(0.34, 1.56, 0.64, 1)',
        }}
        data-testid="sheet-daily-checkin"
      >
        <div className="flex justify-center pt-3 pb-1">
          <div className="w-10 h-1 rounded-full bg-gray-200" />
        </div>
        <div className="px-6 pt-3 pb-2">
          <p className="text-[17px] font-bold text-gray-900 mb-1" data-testid="text-checkin-title">
            Update check-in for {dateLabel}
          </p>
          {commitmentText ? (
            <p className="text-[13px] text-gray-400 mb-5 leading-snug">{commitmentText}</p>
          ) : (
            <div className="mb-5" />
          )}

          <button
            onClick={() => mutation.mutate('yes')}
            disabled={mutation.isPending}
            className="w-full flex items-center gap-3 mb-3 font-semibold text-white text-base disabled:opacity-60"
            style={{ height: 52, borderRadius: 12, backgroundColor: '#1a7a4a', boxShadow: '0 4px 12px rgba(26,122,74,0.2)', paddingLeft: 20 }}
            data-testid="button-checkin-done"
          >
            <Check style={{ width: 18, height: 18 }} /> Mark as Done
          </button>

          <button
            onClick={() => mutation.mutate('no')}
            disabled={mutation.isPending}
            className="w-full flex items-center gap-3 mb-3 font-semibold text-base bg-white disabled:opacity-60"
            style={{ height: 52, borderRadius: 12, border: '2px solid #e74c3c', color: '#e74c3c', boxShadow: '0 4px 12px rgba(231,76,60,0.15)', paddingLeft: 20 }}
            data-testid="button-checkin-missed"
          >
            <X style={{ width: 18, height: 18 }} /> Mark as Missed
          </button>

          <button
            onClick={() => mutation.mutate('partial')}
            disabled={mutation.isPending}
            className="w-full flex items-center gap-3 mb-3 font-semibold text-base bg-white disabled:opacity-60"
            style={{ height: 52, borderRadius: 12, border: '2px solid #F59E0B', color: '#d97706', boxShadow: '0 4px 12px rgba(245,158,11,0.15)', paddingLeft: 20 }}
            data-testid="button-checkin-partial"
          >
            <span style={{ width: 18, height: 18, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16 }}>~</span> Mark as Partial
          </button>

          <button
            onClick={onClose}
            className="w-full mt-1 text-center text-sm text-gray-400 py-2"
            data-testid="button-checkin-cancel"
          >
            Cancel
          </button>
        </div>
      </div>
      <style>{`
        @keyframes slideUpSheet {
          from { transform: translateY(100%); }
          to { transform: translateY(0); }
        }
      `}</style>
    </div>
  );
}
