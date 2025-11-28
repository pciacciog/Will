import { useState, useRef, useEffect, useCallback } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Form, FormControl, FormField, FormItem, FormMessage } from "@/components/ui/form";
import { Textarea } from "@/components/ui/textarea";
import { CheckCircle2, Loader2, Check } from "lucide-react";
import { useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

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
  onComplete: () => void;
}

export function WillReviewFlow({ willId, onComplete }: WillReviewFlowProps) {
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [skippedExpand, setSkippedExpand] = useState(false);
  const { toast } = useToast();

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
        title: "Shared with your circle",
        description: "Your acknowledgment has been shared.",
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
          
          {/* Step 1: Acknowledge */}
          {step === 1 && (
            <div className="space-y-6" data-testid="step-1-acknowledge">
              <div className="text-center">
                <h2 className="text-xl font-semibold text-gray-900 mb-2">Step 1: Acknowledge</h2>
                <p className="text-gray-500 text-sm">
                  Did you follow through this week?
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
            </div>
          )}

          {/* Step 2: Expand */}
          {step === 2 && (
            <div className="space-y-6" data-testid="step-2-expand">
              {/* Header - title centered with Skip absolutely positioned (matches Step 1 & 3 layout) */}
              <div className="relative text-center">
                {/* Skip button - absolutely positioned, doesn't affect title vertical position */}
                <button
                  type="button"
                  onClick={handleSkip}
                  className="absolute right-0 top-0.5 text-[11px] text-gray-400 hover:text-gray-600 px-2 py-0.5 transition-colors duration-200"
                  data-testid="button-skip"
                >
                  Skip
                </button>
                <h2 className="text-xl font-semibold text-gray-900 mb-2">Step 2: Expand</h2>
                <p className="text-gray-500 text-sm">
                  You marked this Will as <span className={getFollowThroughColorClasses(followThroughValue || "")}>{getFollowThroughLabel(followThroughValue || "")}</span>. 
                  Add a short note for your circle if you'd like.
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

          {/* Step 3: Share */}
          {step === 3 && (
            <div className="space-y-6" data-testid="step-3-share">
              <div className="text-center">
                <h2 className="text-xl font-semibold text-gray-900 mb-2">Step 3: Share</h2>
                <p className="text-gray-500 text-sm">
                  {skippedExpand 
                    ? "Confirm your response to share with your circle."
                    : "Review before sharing with your circle."
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
                      Sharing...
                    </>
                  ) : (
                    "Share"
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
