import { useState, useRef, useEffect, useCallback, useMemo } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Form, FormControl, FormField, FormItem, FormMessage } from "@/components/ui/form";
import { Textarea } from "@/components/ui/textarea";
import { Calendar } from "@/components/ui/calendar";
import { CheckCircle2, Loader2, Check, CheckCircle, XCircle, MinusCircle, Edit2 } from "lucide-react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import type { WillCheckIn } from "@shared/schema";

const reviewFormSchema = z.object({
  followThrough: z.enum(["yes", "mostly", "no"], {
    required_error: "Please select an option",
  }),
  reflection: z
    .string()
    .max(200, "Cannot exceed 200 characters"),
});

type ReviewFormValues = z.infer<typeof reviewFormSchema>;

interface WillReviewFlowProps {
  willId: number;
  mode?: 'solo' | 'circle';
  checkInType?: 'daily' | 'one-time';
  startDate?: string;
  endDate?: string;
  onComplete: () => void;
  onEditCheckIns?: () => void;
}

export function WillReviewFlow({ willId, mode = 'circle', checkInType = 'one-time', startDate, endDate, onComplete, onEditCheckIns }: WillReviewFlowProps) {
  const isSolo = mode === 'solo';
  const isDailyTracker = checkInType === 'daily';
  // For daily trackers, we skip Step 1 (acknowledgment) and start at summary step
  const [step, setStep] = useState<1 | 2 | 3>(isDailyTracker ? 1 : 1);
  const [skippedExpand, setSkippedExpand] = useState(false);
  const { toast } = useToast();
  
  // Fetch check-in data for daily trackers
  const { data: checkIns = [] } = useQuery<WillCheckIn[]>({
    queryKey: [`/api/wills/${willId}/check-ins`],
    enabled: isDailyTracker,
  });
  
  // Calculate success rate and determine follow-through status for daily trackers
  const dailyStats = useMemo(() => {
    if (!isDailyTracker || !startDate || !endDate) return null;
    
    const start = new Date(startDate);
    const end = new Date(endDate);
    const today = new Date();
    const effectiveEnd = end > today ? today : end;
    
    // Count total days in the will period (up to today)
    let totalDays = 0;
    const current = new Date(start);
    current.setHours(0, 0, 0, 0);
    effectiveEnd.setHours(0, 0, 0, 0);
    while (current <= effectiveEnd) {
      totalDays++;
      current.setDate(current.getDate() + 1);
    }
    
    const yesCount = checkIns.filter(c => c.status === 'yes').length;
    const partialCount = checkIns.filter(c => c.status === 'partial').length;
    const noCount = checkIns.filter(c => c.status === 'no').length;
    const checkedInDays = yesCount + partialCount + noCount;
    
    // Success rate: yes = 1, partial = 0.5, no = 0
    const successScore = yesCount + (partialCount * 0.5);
    const successRate = totalDays > 0 ? Math.round((successScore / totalDays) * 100) : 0;
    
    // Determine follow-through status based on success rate
    let followThrough: 'yes' | 'mostly' | 'no';
    if (successRate >= 80) {
      followThrough = 'yes';
    } else if (successRate >= 50) {
      followThrough = 'mostly';
    } else {
      followThrough = 'no';
    }
    
    return {
      totalDays,
      checkedInDays,
      yesCount,
      partialCount,
      noCount,
      successRate,
      followThrough
    };
  }, [isDailyTracker, startDate, endDate, checkIns]);

  const form = useForm<ReviewFormValues>({
    resolver: zodResolver(reviewFormSchema),
    defaultValues: {
      followThrough: undefined,
      reflection: "",
    },
  });
  
  // Auto-resize for reflection textarea
  const reflectionRef = useRef<HTMLTextAreaElement>(null);
  const resizeReflection = useCallback(() => {
    const textarea = reflectionRef.current;
    if (!textarea) return;
    textarea.style.height = 'auto';
    const newHeight = Math.min(textarea.scrollHeight, 120);
    textarea.style.height = `${newHeight}px`;
  }, []);
  
  const reflectionValue = form.watch("reflection");
  useEffect(() => {
    resizeReflection();
  }, [reflectionValue, resizeReflection]);

  const submitReview = useMutation({
    mutationFn: async (data: ReviewFormValues) => {
      const payload = {
        followThrough: data.followThrough,
        reflectionText: data.reflection || "",
      };
      const response = await apiRequest(`/api/wills/${willId}/review`, {
        method: "POST",
        body: JSON.stringify(payload),
      });
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: isSolo ? "Review submitted" : "Shared with your circle",
        description: isSolo ? "Your Will is now complete." : "Your acknowledgment has been shared.",
        duration: 4000,
      });
      queryClient.invalidateQueries({ queryKey: ["/api/wills"] });
      queryClient.invalidateQueries({ queryKey: ["/api/wills", willId] });
      queryClient.invalidateQueries({ queryKey: ["/api/wills", willId, "review-status"] });
      queryClient.invalidateQueries({ queryKey: ["/api/wills", willId, "reviews"] });
      onComplete();
    },
    onError: (error: Error) => {
      toast({
        title: "Submission Failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleNext = () => {
    const currentValues = form.getValues();

    if (step === 1 && !currentValues.followThrough) {
      form.setError("followThrough", {
        type: "manual",
        message: "Please select an option",
      });
      return;
    }

    if (step === 2) {
      const reflectionResult = reviewFormSchema.shape.reflection.safeParse(
        currentValues.reflection
      );
      if (!reflectionResult.success) {
        form.setError("reflection", {
          type: "manual",
          message: reflectionResult.error.errors[0]?.message || "Invalid text",
        });
        return;
      }
    }

    if (step < 3) {
      setStep((prev) => (prev + 1) as 1 | 2 | 3);
    }
  };

  const onSubmit = (data: ReviewFormValues) => {
    submitReview.mutate(data);
  };

  const followThroughValue = form.watch("followThrough");

  const getFollowThroughLabel = (value: string) => {
    switch (value) {
      case "yes": return "Yes";
      case "mostly": return "Mostly";
      case "no": return "No";
      default: return value;
    }
  };

  const getFollowThroughColorClasses = (value: string) => {
    switch (value) {
      case "yes": return "text-emerald-600 font-semibold";
      case "mostly": return "text-amber-600 font-semibold";
      case "no": return "text-rose-600 font-semibold";
      default: return "text-gray-700 font-medium";
    }
  };

  const handleSkip = () => {
    form.setValue("reflection", "");
    setSkippedExpand(true);
    setStep(3);
  };

  return (
    <div className="w-full max-w-2xl mx-auto px-4 py-6">
      {/* Progress Indicator - tighter spacing */}
      <div className="flex items-center justify-center mb-5">
        <div className="flex items-center gap-2">
          <div
            className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${
              step >= 1
                ? "bg-gradient-to-r from-emerald-500 to-teal-500 text-white"
                : "bg-gray-200 text-gray-600"
            }`}
            data-testid="step-indicator-1"
          >
            {step > 1 ? <CheckCircle2 className="w-5 h-5" /> : "1"}
          </div>
          <div className={`h-0.5 w-12 ${step >= 2 ? "bg-emerald-500" : "bg-gray-200"}`} />
          <div
            className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${
              step >= 2
                ? "bg-gradient-to-r from-emerald-500 to-teal-500 text-white"
                : "bg-gray-200 text-gray-600"
            }`}
            data-testid="step-indicator-2"
          >
            {step > 2 ? <CheckCircle2 className="w-5 h-5" /> : "2"}
          </div>
          <div className={`h-0.5 w-12 ${step >= 3 ? "bg-emerald-500" : "bg-gray-200"}`} />
          <div
            className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${
              step >= 3
                ? "bg-gradient-to-r from-emerald-500 to-teal-500 text-white"
                : "bg-gray-200 text-gray-600"
            }`}
            data-testid="step-indicator-3"
          >
            3
          </div>
        </div>
      </div>

      {/* Form */}
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
          
          {/* Step 1: For daily trackers show summary, for one-time show acknowledge */}
          {step === 1 && (
            <div className="space-y-6" data-testid="step-1-acknowledge">
              {isDailyTracker && dailyStats ? (
                // Daily Tracker Summary View
                <>
                  <div className="text-center">
                    <h2 className="text-xl font-semibold text-gray-900 mb-2">Challenge Results</h2>
                    <p className="text-gray-500 text-sm">
                      Review your daily check-ins before finalizing
                    </p>
                  </div>
                  
                  {/* Stats Summary */}
                  <div className="grid grid-cols-3 gap-3">
                    <div className="text-center p-3 bg-emerald-50 rounded-lg">
                      <div className="flex items-center justify-center gap-1 mb-1">
                        <CheckCircle className="h-4 w-4 text-emerald-600" />
                      </div>
                      <div className="text-2xl font-bold text-emerald-700">{dailyStats.yesCount}</div>
                      <div className="text-xs text-emerald-600">Completed</div>
                    </div>
                    <div className="text-center p-3 bg-amber-50 rounded-lg">
                      <div className="flex items-center justify-center gap-1 mb-1">
                        <MinusCircle className="h-4 w-4 text-amber-600" />
                      </div>
                      <div className="text-2xl font-bold text-amber-700">{dailyStats.partialCount}</div>
                      <div className="text-xs text-amber-600">Partial</div>
                    </div>
                    <div className="text-center p-3 bg-red-50 rounded-lg">
                      <div className="flex items-center justify-center gap-1 mb-1">
                        <XCircle className="h-4 w-4 text-red-500" />
                      </div>
                      <div className="text-2xl font-bold text-red-600">{dailyStats.noCount}</div>
                      <div className="text-xs text-red-500">Missed</div>
                    </div>
                  </div>
                  
                  {/* Success Rate */}
                  <div className="text-center py-4 bg-gradient-to-r from-blue-50 to-indigo-50 rounded-xl">
                    <div className="text-4xl font-bold text-blue-700">{dailyStats.successRate}%</div>
                    <div className="text-sm text-blue-600">
                      Success Rate ({dailyStats.yesCount + Math.floor(dailyStats.partialCount * 0.5)}/{dailyStats.totalDays} days)
                    </div>
                  </div>
                  
                  {/* Calendar Preview */}
                  {startDate && endDate && (
                    <div className="flex justify-center">
                      <Calendar
                        mode="single"
                        disabled={() => true}
                        modifiers={{
                          success: (date) => {
                            const dateKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
                            return checkIns.some(c => c.date === dateKey && c.status === 'yes');
                          },
                          partial: (date) => {
                            const dateKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
                            return checkIns.some(c => c.date === dateKey && c.status === 'partial');
                          },
                          failed: (date) => {
                            const dateKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
                            return checkIns.some(c => c.date === dateKey && c.status === 'no');
                          },
                        }}
                        modifiersStyles={{
                          success: { backgroundColor: '#dcfce7', color: '#166534' },
                          partial: { backgroundColor: '#fef3c7', color: '#92400e' },
                          failed: { backgroundColor: '#fee2e2', color: '#dc2626' },
                        }}
                        className="rounded-md border"
                      />
                    </div>
                  )}
                  
                  {/* Action Buttons */}
                  <div className="space-y-3">
                    <Button
                      type="button"
                      onClick={() => {
                        // Set follow-through based on calculated stats
                        form.setValue("followThrough", dailyStats.followThrough);
                        handleNext();
                      }}
                      className="w-full bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-600 hover:to-teal-600"
                      size="lg"
                      data-testid="button-finalize"
                    >
                      Looks good! Finalize Results
                    </Button>
                    
                    {onEditCheckIns && (
                      <button
                        type="button"
                        onClick={onEditCheckIns}
                        className="w-full text-center text-sm text-blue-600 hover:text-blue-700 underline flex items-center justify-center gap-1"
                        data-testid="link-edit-checkins"
                      >
                        <Edit2 className="h-3 w-3" />
                        Make adjustments
                      </button>
                    )}
                  </div>
                </>
              ) : (
                // One-time Commitment Acknowledge View (original)
                <>
                  <div className="text-center">
                    <h2 className="text-xl font-semibold text-gray-900 mb-2">Step 1: Acknowledge</h2>
                    <p className="text-gray-500 text-sm">
                      Did you follow through on your commitment?
                    </p>
                  </div>

                  <FormField
                    control={form.control}
                    name="followThrough"
                    render={({ field }) => (
                      <FormItem>
                        <FormControl>
                          <div className="space-y-3">
                            {/* Yes Option */}
                            <button
                              type="button"
                              onClick={() => field.onChange("yes")}
                              className={`w-full p-4 rounded-xl border-2 transition-all duration-200 flex items-center justify-between ${
                                field.value === "yes"
                                  ? "border-emerald-500 bg-emerald-50"
                                  : "border-gray-200 hover:border-gray-300 bg-white"
                              }`}
                              data-testid="option-yes"
                            >
                              <span className={`font-medium ${field.value === "yes" ? "text-emerald-700" : "text-gray-700"}`}>
                                Yes
                              </span>
                              <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center transition-all ${
                                field.value === "yes"
                                  ? "border-emerald-500 bg-emerald-500"
                                  : "border-gray-300"
                              }`}>
                                {field.value === "yes" && <Check className="w-4 h-4 text-white" />}
                              </div>
                            </button>

                            {/* Mostly Option */}
                            <button
                              type="button"
                              onClick={() => field.onChange("mostly")}
                              className={`w-full p-4 rounded-xl border-2 transition-all duration-200 flex items-center justify-between ${
                                field.value === "mostly"
                                  ? "border-amber-500 bg-amber-50"
                                  : "border-gray-200 hover:border-gray-300 bg-white"
                              }`}
                              data-testid="option-mostly"
                            >
                              <span className={`font-medium ${field.value === "mostly" ? "text-amber-700" : "text-gray-700"}`}>
                                Mostly
                              </span>
                              <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center transition-all ${
                                field.value === "mostly"
                                  ? "border-amber-500 bg-amber-500"
                                  : "border-gray-300"
                              }`}>
                                {field.value === "mostly" && <Check className="w-4 h-4 text-white" />}
                              </div>
                            </button>

                            {/* No Option */}
                            <button
                              type="button"
                              onClick={() => field.onChange("no")}
                              className={`w-full p-4 rounded-xl border-2 transition-all duration-200 flex items-center justify-between ${
                                field.value === "no"
                                  ? "border-rose-500 bg-rose-50"
                                  : "border-gray-200 hover:border-gray-300 bg-white"
                              }`}
                              data-testid="option-no"
                            >
                              <span className={`font-medium ${field.value === "no" ? "text-rose-700" : "text-gray-700"}`}>
                                No
                              </span>
                              <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center transition-all ${
                                field.value === "no"
                                  ? "border-rose-500 bg-rose-500"
                                  : "border-gray-300"
                              }`}>
                                {field.value === "no" && <Check className="w-4 h-4 text-white" />}
                              </div>
                            </button>
                          </div>
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <Button
                    type="button"
                    onClick={handleNext}
                    disabled={!followThroughValue}
                    className="w-full bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-600 hover:to-teal-600 disabled:opacity-50"
                    size="lg"
                    data-testid="button-next-1"
                  >
                    Continue
                  </Button>
                </>
              )}
            </div>
          )}

          {/* Step 2: Expand */}
          {step === 2 && (
            <div className="space-y-4" data-testid="step-2-expand">
              {/* Skip button row - separate from title for clear visual separation */}
              <div className="flex justify-end -mt-2 -mr-2">
                <button
                  type="button"
                  onClick={handleSkip}
                  className="text-xs text-gray-400 hover:text-gray-600 px-3 py-1.5 rounded-lg hover:bg-gray-50 transition-colors duration-200"
                  data-testid="button-skip"
                >
                  Skip
                </button>
              </div>
              
              {/* Header - centered title */}
              <div className="text-center -mt-2">
                <h2 className="text-xl font-semibold text-gray-900 mb-2">Step 2: Expand</h2>
                <p className="text-gray-500 text-sm">
                  You marked this Will as <span className={getFollowThroughColorClasses(followThroughValue || "")}>{getFollowThroughLabel(followThroughValue || "")}</span>. 
                  {isSolo ? " Add a short note for yourself if you'd like." : " Add a short note for your circle if you'd like."}
                </p>
              </div>

              <FormField
                control={form.control}
                name="reflection"
                render={({ field }) => (
                  <FormItem>
                    <FormControl>
                      <Textarea
                        {...field}
                        ref={reflectionRef}
                        rows={1}
                        placeholder="Add a short note..."
                        className="resize-none overflow-y-auto rounded-xl border-gray-200 focus:border-emerald-500 focus:ring-emerald-500 py-3 px-4 text-base leading-relaxed transition-all min-h-[44px]"
                        style={{ maxHeight: '120px' }}
                        maxLength={200}
                        data-testid="textarea-reflection"
                      />
                    </FormControl>
                    <div className="flex justify-end text-xs text-gray-400">
                      <span data-testid="text-char-count">{field.value.length}/200</span>
                    </div>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="flex gap-3">
                <Button
                  type="button"
                  onClick={() => setStep(1)}
                  variant="outline"
                  className="flex-1 rounded-xl"
                  data-testid="button-back-2"
                >
                  Back
                </Button>
                <Button
                  type="button"
                  onClick={() => { setSkippedExpand(false); handleNext(); }}
                  className="flex-1 bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-600 hover:to-teal-600 rounded-xl"
                  size="lg"
                  data-testid="button-next-2"
                >
                  Continue
                </Button>
              </div>
            </div>
          )}

          {/* Step 3: Share/Finalize */}
          {step === 3 && (
            <div className="space-y-6" data-testid="step-3-share">
              <div className="text-center">
                <h2 className="text-xl font-semibold text-gray-900 mb-2">
                  {isSolo ? "Step 3: Finalize" : "Step 3: Share"}
                </h2>
                <p className="text-gray-500 text-sm">
                  {isSolo
                    ? (skippedExpand 
                        ? "Confirm your response to complete this Will."
                        : "Review your reflection before completing this Will.")
                    : (skippedExpand 
                        ? "Confirm your response to share with your circle."
                        : "Review before sharing with your circle.")
                  }
                </p>
              </div>

              {/* Preview Card */}
              <div className="bg-gray-50 rounded-xl p-4 space-y-3">
                {/* Follow-through Answer Section */}
                <div className="bg-white rounded-lg border border-gray-200 p-4">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-500 font-medium">Followed-Through?</span>
                    <span className={`text-sm font-semibold px-3 py-1 rounded-full whitespace-nowrap ${
                      followThroughValue === "yes" 
                        ? "bg-emerald-100 text-emerald-700"
                        : followThroughValue === "mostly"
                        ? "bg-amber-100 text-amber-700"
                        : "bg-rose-100 text-rose-700"
                    }`}>
                      {getFollowThroughLabel(followThroughValue || "")}
                    </span>
                  </div>
                </div>
                
                {/* Notes Section - only show if not skipped */}
                {!skippedExpand && (
                  <div className="bg-white rounded-lg border border-gray-200 p-4">
                    <span className="text-sm text-gray-500 font-medium block mb-2">Notes</span>
                    {reflectionValue ? (
                      <p className="text-gray-700 text-sm leading-relaxed" data-testid="text-reflection-preview">
                        {reflectionValue}
                      </p>
                    ) : (
                      <p className="text-gray-400 text-sm italic">No additional note added.</p>
                    )}
                  </div>
                )}
              </div>

              <div className="flex gap-3">
                <Button
                  type="button"
                  onClick={() => setStep(skippedExpand ? 1 : 2)}
                  variant="outline"
                  className="flex-1 rounded-xl"
                  data-testid="button-back-3"
                >
                  Back
                </Button>
                <Button
                  type="submit"
                  disabled={submitReview.isPending}
                  className="flex-1 bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-600 hover:to-teal-600 rounded-xl"
                  size="lg"
                  data-testid="button-submit-review"
                >
                  {submitReview.isPending ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      {isSolo ? "Submitting..." : "Sharing..."}
                    </>
                  ) : (
                    isSolo ? "Submit Review" : "Share"
                  )}
                </Button>
              </div>
            </div>
          )}
        </form>
      </Form>
    </div>
  );
}
