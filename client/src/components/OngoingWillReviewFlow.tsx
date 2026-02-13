import { useState, useMemo, useRef, useCallback, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { CheckCircle, XCircle, MinusCircle, TrendingUp, Calendar, BarChart3 } from "lucide-react";
import type { WillCheckIn } from "@shared/schema";

interface OngoingWillReviewFlowProps {
  willId: number;
  startDate: string;
  onComplete: () => void;
}

export function OngoingWillReviewFlow({ willId, startDate, onComplete }: OngoingWillReviewFlowProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [step, setStep] = useState<1 | 2>(1);
  const [reflection, setReflection] = useState("");

  const reflectionRef = useRef<HTMLTextAreaElement>(null);
  const resize = useCallback(() => {
    const ta = reflectionRef.current;
    if (!ta) return;
    ta.style.height = 'auto';
    ta.style.height = `${Math.min(ta.scrollHeight, 150)}px`;
  }, []);
  useEffect(() => { resize(); }, [reflection, resize]);

  const { data: checkIns = [] } = useQuery<WillCheckIn[]>({
    queryKey: [`/api/wills/${willId}/check-ins`],
  });

  const stats = useMemo(() => {
    const start = new Date(startDate);
    const now = new Date();
    const diffMs = now.getTime() - start.getTime();
    const totalDays = Math.max(1, Math.ceil(diffMs / (1000 * 60 * 60 * 24)));

    const yesCount = checkIns.filter(c => c.status === 'yes').length;
    const partialCount = checkIns.filter(c => c.status === 'partial').length;
    const noCount = checkIns.filter(c => c.status === 'no').length;
    const checkedInDays = yesCount + partialCount + noCount;

    const successScore = yesCount + (partialCount * 0.5);
    const successRate = checkedInDays > 0 ? Math.round((successScore / checkedInDays) * 100) : 0;

    let bestStreak = 0;
    let currentStreak = 0;
    const sorted = [...checkIns].sort((a, b) => a.date.localeCompare(b.date));
    for (const ci of sorted) {
      if (ci.status === 'yes' || ci.status === 'partial') {
        currentStreak++;
        if (currentStreak > bestStreak) bestStreak = currentStreak;
      } else {
        currentStreak = 0;
      }
    }

    let followThrough: 'yes' | 'mostly' | 'no';
    if (successRate >= 80) followThrough = 'yes';
    else if (successRate >= 50) followThrough = 'mostly';
    else followThrough = 'no';

    return { totalDays, checkedInDays, yesCount, partialCount, noCount, successRate, bestStreak, followThrough };
  }, [checkIns, startDate]);

  const submitReview = useMutation({
    mutationFn: async () => {
      const payload = {
        followThrough: stats.followThrough,
        reflectionText: reflection || "",
      };
      const res = await apiRequest(`/api/wills/${willId}/review`, {
        method: "POST",
        body: JSON.stringify(payload),
      });
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Review submitted", description: "Your Will is now complete.", duration: 3000 });
      queryClient.invalidateQueries({ queryKey: ["/api/wills"] });
      queryClient.invalidateQueries({ queryKey: [`/api/wills/${willId}/details`] });
      queryClient.invalidateQueries({ queryKey: [`/api/wills/${willId}/review-status`] });
      queryClient.invalidateQueries({ queryKey: [`/api/wills/${willId}/reviews`] });
      onComplete();
    },
    onError: (error: Error) => {
      toast({ title: "Failed to submit", description: error.message, variant: "destructive" });
    },
  });

  if (step === 1) {
    return (
      <div className="space-y-4" data-testid="ongoing-review-results">
        <h3 className="text-base font-semibold text-gray-900 text-center">Your Results</h3>

        <div className="grid grid-cols-2 gap-3">
          <div className="bg-white border border-gray-200 rounded-xl p-3 text-center">
            <Calendar className="w-5 h-5 text-blue-500 mx-auto mb-1" />
            <p className="text-2xl font-bold text-gray-900">{stats.totalDays}</p>
            <p className="text-xs text-gray-500">Days</p>
          </div>
          <div className="bg-white border border-gray-200 rounded-xl p-3 text-center">
            <BarChart3 className="w-5 h-5 text-emerald-500 mx-auto mb-1" />
            <p className="text-2xl font-bold text-gray-900">{stats.successRate}%</p>
            <p className="text-xs text-gray-500">Success Rate</p>
          </div>
          <div className="bg-white border border-gray-200 rounded-xl p-3 text-center">
            <TrendingUp className="w-5 h-5 text-amber-500 mx-auto mb-1" />
            <p className="text-2xl font-bold text-gray-900">{stats.bestStreak}</p>
            <p className="text-xs text-gray-500">Best Streak</p>
          </div>
          <div className="bg-white border border-gray-200 rounded-xl p-3 text-center">
            <CheckCircle className="w-5 h-5 text-purple-500 mx-auto mb-1" />
            <p className="text-2xl font-bold text-gray-900">{stats.checkedInDays}</p>
            <p className="text-xs text-gray-500">Check-ins</p>
          </div>
        </div>

        <div className="flex items-center justify-center gap-4 py-2">
          <div className="flex items-center gap-1.5">
            <CheckCircle className="w-4 h-4 text-emerald-500" />
            <span className="text-sm text-gray-600">{stats.yesCount}</span>
          </div>
          <div className="flex items-center gap-1.5">
            <MinusCircle className="w-4 h-4 text-amber-500" />
            <span className="text-sm text-gray-600">{stats.partialCount}</span>
          </div>
          <div className="flex items-center gap-1.5">
            <XCircle className="w-4 h-4 text-red-400" />
            <span className="text-sm text-gray-600">{stats.noCount}</span>
          </div>
        </div>

        <Button
          onClick={() => setStep(2)}
          className="w-full bg-gradient-to-r from-purple-500 to-indigo-500 hover:from-purple-600 hover:to-indigo-600 text-white py-5"
          data-testid="button-ongoing-review-next"
        >
          Continue
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-4" data-testid="ongoing-review-reflection">
      <h3 className="text-base font-semibold text-gray-900 text-center">Any reflections?</h3>
      <p className="text-sm text-gray-500 text-center -mt-2">Optional — a few words if you'd like.</p>

      <Textarea
        ref={reflectionRef}
        value={reflection}
        onChange={(e) => setReflection(e.target.value.slice(0, 300))}
        placeholder="..."
        className="resize-none min-h-[60px] text-sm"
        data-testid="input-ongoing-reflection"
      />
      <p className="text-xs text-gray-400 text-right">{reflection.length}/300</p>

      <div className="flex gap-3">
        <Button
          variant="outline"
          onClick={() => setStep(1)}
          className="flex-1"
          data-testid="button-ongoing-review-back"
        >
          Back
        </Button>
        <Button
          onClick={() => submitReview.mutate()}
          disabled={submitReview.isPending}
          className="flex-1 bg-gradient-to-r from-purple-500 to-indigo-500 hover:from-purple-600 hover:to-indigo-600 text-white"
          data-testid="button-ongoing-review-submit"
        >
          {submitReview.isPending ? "Submitting..." : reflection.trim() ? "Submit" : "Skip & Finish"}
        </Button>
      </div>
    </div>
  );
}
