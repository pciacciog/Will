import { useState, useEffect } from "react";
import { useMutation, useQueryClient, useQuery } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Calendar } from "@/components/ui/calendar";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { CheckCircle, XCircle, MinusCircle, CalendarIcon, ChevronLeft } from "lucide-react";
import { cn } from "@/lib/utils";
import type { WillCheckIn } from "@shared/schema";

interface DailyCheckInModalProps {
  isOpen: boolean;
  onClose: () => void;
  willId: number;
  startDate: string;
  endDate: string;
  existingCheckIns?: WillCheckIn[];
}

type CheckInStatus = 'yes' | 'no' | 'partial';

export default function DailyCheckInModal({ 
  isOpen, 
  onClose, 
  willId, 
  startDate, 
  endDate,
  existingCheckIns = []
}: DailyCheckInModalProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  const [step, setStep] = useState<'select-date' | 'select-status'>('select-date');
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(undefined);
  const [status, setStatus] = useState<CheckInStatus | null>(null);
  const [note, setNote] = useState("");
  
  const willStart = new Date(startDate);
  const willEnd = new Date(endDate);
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  useEffect(() => {
    if (isOpen) {
      setStep('select-date');
      setSelectedDate(undefined);
      setStatus(null);
      setNote("");
    }
  }, [isOpen]);

  const formatDateKey = (date: Date) => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  const checkedInDates = new Set(existingCheckIns.map(c => c.date));

  const isDateDisabled = (date: Date) => {
    const dateKey = formatDateKey(date);
    const dateNormalized = new Date(date);
    dateNormalized.setHours(0, 0, 0, 0);
    
    const startNormalized = new Date(willStart);
    startNormalized.setHours(0, 0, 0, 0);
    
    const endNormalized = new Date(willEnd);
    endNormalized.setHours(0, 0, 0, 0);
    
    if (dateNormalized < startNormalized || dateNormalized > endNormalized) {
      return true;
    }
    
    if (dateNormalized > today) {
      return true;
    }
    
    return false;
  };

  const getDateStatus = (date: Date): CheckInStatus | null => {
    const dateKey = formatDateKey(date);
    const checkIn = existingCheckIns.find(c => c.date === dateKey);
    return checkIn ? checkIn.status as CheckInStatus : null;
  };

  const submitCheckInMutation = useMutation({
    mutationFn: async (data: { date: string; status: string; reflectionText?: string }) => {
      const res = await apiRequest(`/api/wills/${willId}/check-ins`, {
        method: 'POST',
        body: JSON.stringify(data)
      });
      return await res.json();
    },
    onSuccess: () => {
      toast({
        title: "Check-in recorded!",
        description: status === 'yes' 
          ? "Great job staying on track!" 
          : status === 'partial' 
            ? "Every bit of progress counts!" 
            : "Thanks for being honest. Tomorrow is a new day!",
        duration: 4000,
      });
      queryClient.invalidateQueries({ queryKey: ['/api/wills', willId, 'check-ins'] });
      queryClient.invalidateQueries({ queryKey: ['/api/wills', willId, 'check-in-progress'] });
      onClose();
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to record check-in",
        variant: "destructive",
        duration: 4000,
      });
    },
  });

  const handleDateSelect = (date: Date | undefined) => {
    if (date && !isDateDisabled(date)) {
      setSelectedDate(date);
      const existingStatus = getDateStatus(date);
      if (existingStatus) {
        setStatus(existingStatus);
        const existingCheckIn = existingCheckIns.find(c => c.date === formatDateKey(date));
        setNote(existingCheckIn?.reflectionText || "");
      }
      setStep('select-status');
    }
  };

  const handleSubmit = () => {
    if (!selectedDate || !status) return;
    
    submitCheckInMutation.mutate({
      date: formatDateKey(selectedDate),
      status,
      reflectionText: note.trim() || undefined
    });
  };

  const statusOptions: { value: CheckInStatus; label: string; icon: typeof CheckCircle; color: string; bgColor: string }[] = [
    { 
      value: 'yes', 
      label: 'Yes, I did it!', 
      icon: CheckCircle, 
      color: 'text-emerald-600',
      bgColor: 'bg-emerald-50 border-emerald-200 hover:bg-emerald-100'
    },
    { 
      value: 'partial', 
      label: 'Partially done', 
      icon: MinusCircle, 
      color: 'text-amber-600',
      bgColor: 'bg-amber-50 border-amber-200 hover:bg-amber-100'
    },
    { 
      value: 'no', 
      label: 'No, not today', 
      icon: XCircle, 
      color: 'text-red-500',
      bgColor: 'bg-red-50 border-red-200 hover:bg-red-100'
    },
  ];

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-md mx-auto max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-xl font-semibold">
            {step === 'select-date' ? 'Select a Day' : 'Daily Check-in'}
          </DialogTitle>
          <DialogDescription>
            {step === 'select-date' 
              ? 'Choose which day you want to check in for' 
              : `${selectedDate?.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}`
            }
          </DialogDescription>
        </DialogHeader>

        {step === 'select-date' ? (
          <div className="py-4">
            <Calendar
              mode="single"
              selected={selectedDate}
              onSelect={handleDateSelect}
              disabled={isDateDisabled}
              modifiers={{
                checked: (date) => checkedInDates.has(formatDateKey(date)),
                success: (date) => getDateStatus(date) === 'yes',
                partial: (date) => getDateStatus(date) === 'partial',
                failed: (date) => getDateStatus(date) === 'no',
              }}
              modifiersStyles={{
                success: { backgroundColor: '#dcfce7', color: '#166534' },
                partial: { backgroundColor: '#fef3c7', color: '#92400e' },
                failed: { backgroundColor: '#fee2e2', color: '#dc2626' },
              }}
              className="rounded-md border mx-auto"
              initialFocus
            />
            <p className="text-sm text-gray-500 mt-3 text-center">
              Tap a date to check in. Colored dates have existing check-ins.
            </p>
          </div>
        ) : (
          <div className="space-y-6 py-4">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setStep('select-date')}
              className="flex items-center gap-1 text-gray-600 -ml-2"
              data-testid="button-back-to-calendar"
            >
              <ChevronLeft className="h-4 w-4" />
              Change date
            </Button>

            <div className="space-y-3">
              <Label className="text-base font-medium">Did you follow through on your Will?</Label>
              <div className="space-y-2">
                {statusOptions.map(option => {
                  const Icon = option.icon;
                  const isSelected = status === option.value;
                  return (
                    <button
                      key={option.value}
                      onClick={() => setStatus(option.value)}
                      className={cn(
                        "w-full flex items-center gap-3 p-4 rounded-lg border-2 transition-all",
                        isSelected 
                          ? `${option.bgColor} border-current ring-2 ring-offset-1` 
                          : "bg-white border-gray-200 hover:border-gray-300"
                      )}
                      data-testid={`button-status-${option.value}`}
                    >
                      <Icon className={cn("h-6 w-6", option.color)} />
                      <span className={cn(
                        "font-medium",
                        isSelected ? option.color : "text-gray-700"
                      )}>
                        {option.label}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="note" className="text-base font-medium">
                Add a note (optional)
              </Label>
              <Textarea
                id="note"
                placeholder="How did it go? Any reflections?"
                value={note}
                onChange={(e) => setNote(e.target.value)}
                className="resize-none"
                rows={3}
                data-testid="input-check-in-note"
              />
            </div>

            <Button
              onClick={handleSubmit}
              disabled={!status || submitCheckInMutation.isPending}
              className="w-full bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-600 hover:to-teal-600 text-white"
              data-testid="button-submit-check-in"
            >
              {submitCheckInMutation.isPending ? "Saving..." : "Save Check-in"}
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
