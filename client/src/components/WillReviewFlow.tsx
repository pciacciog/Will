import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Textarea } from "@/components/ui/textarea";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { CheckCircle2, Loader2 } from "lucide-react";
import { useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

const reviewFormSchema = z.object({
  followThrough: z.enum(["yes", "no"], {
    required_error: "Please indicate whether you followed through",
  }),
  reflection: z
    .string()
    .min(10, "Reflection must be at least 10 characters")
    .max(200, "Reflection cannot exceed 200 characters"),
  shareWithCircle: z.boolean().default(true),
});

type ReviewFormValues = z.infer<typeof reviewFormSchema>;

interface WillReviewFlowProps {
  willId: number;
  onComplete: () => void;
}

export function WillReviewFlow({ willId, onComplete }: WillReviewFlowProps) {
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const { toast } = useToast();

  const form = useForm<ReviewFormValues>({
    resolver: zodResolver(reviewFormSchema),
    defaultValues: {
      followThrough: undefined,
      reflection: "",
      shareWithCircle: true,
    },
  });

  const submitReview = useMutation({
    mutationFn: async (data: ReviewFormValues) => {
      const response = await apiRequest(`/api/wills/${willId}/review`, {
        method: "POST",
        body: JSON.stringify(data),
      });
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Review Submitted",
        description: "Your Will review has been submitted successfully.",
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
          message: reflectionResult.error.errors[0]?.message || "Invalid reflection",
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

  return (
    <div className="w-full max-w-2xl mx-auto px-4 py-6">
      {/* Progress Indicator */}
      <div className="flex items-center justify-center mb-8">
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
        <form onSubmit={form.handleSubmit(onSubmit)} className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          {step === 1 && (
            <div className="space-y-6" data-testid="step-1-acknowledge">
              <div>
                <h2 className="text-2xl font-bold text-gray-900 mb-2">Step 1: Acknowledge</h2>
                <p className="text-gray-600">
                  Did you follow through on your commitment this week?
                </p>
              </div>

              <FormField
                control={form.control}
                name="followThrough"
                render={({ field }) => (
                  <FormItem>
                    <FormControl>
                      <RadioGroup
                        value={field.value || ""}
                        onValueChange={field.onChange}
                        data-testid="radio-group-follow-through"
                      >
                        <div className="flex items-center space-x-3 p-4 border border-gray-200 rounded-lg hover:border-emerald-500 transition-colors">
                          <RadioGroupItem value="yes" id="yes" data-testid="radio-yes" />
                          <Label htmlFor="yes" className="flex-1 cursor-pointer text-base">
                            ✅ Yes, I did it
                          </Label>
                        </div>

                        <div className="flex items-center space-x-3 p-4 border border-gray-200 rounded-lg hover:border-red-500 transition-colors">
                          <RadioGroupItem value="no" id="no" data-testid="radio-no" />
                          <Label htmlFor="no" className="flex-1 cursor-pointer text-base">
                            ❌ No, I didn't do it
                          </Label>
                        </div>
                      </RadioGroup>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <Button
                type="button"
                onClick={handleNext}
                className="w-full bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-600 hover:to-teal-600"
                size="lg"
                data-testid="button-next-1"
              >
                Next: Reflect
              </Button>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-6" data-testid="step-2-reflect">
              <div>
                <h2 className="text-2xl font-bold text-gray-900 mb-2">Step 2: Reflect</h2>
                <p className="text-gray-600">
                  Take a moment to reflect on your experience. What did you learn?
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
                        placeholder="Share your thoughts, lessons learned, challenges faced, or victories achieved..."
                        className="min-h-[120px] resize-none"
                        maxLength={200}
                        data-testid="textarea-reflection"
                      />
                    </FormControl>
                    <div className="flex justify-between text-sm text-gray-500">
                      <span>Minimum 10 characters</span>
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
                  className="flex-1"
                  data-testid="button-back-2"
                >
                  Back
                </Button>
                <Button
                  type="button"
                  onClick={handleNext}
                  className="flex-1 bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-600 hover:to-teal-600"
                  size="lg"
                  data-testid="button-next-2"
                >
                  Next: Share
                </Button>
              </div>
            </div>
          )}

          {step === 3 && (
            <div className="space-y-6" data-testid="step-3-share">
              <div>
                <h2 className="text-2xl font-bold text-gray-900 mb-2">Step 3: Share</h2>
                <p className="text-gray-600">
                  Would you like to share your reflection with your Inner Circle?
                </p>
              </div>

              <div className="bg-gray-50 border border-gray-200 rounded-lg p-6 space-y-4">
                <div className="prose prose-sm max-w-none">
                  <p className="text-gray-700 italic" data-testid="text-reflection-preview">
                    "{form.getValues("reflection")}"
                  </p>
                </div>

                <FormField
                  control={form.control}
                  name="shareWithCircle"
                  render={({ field }) => (
                    <FormItem className="flex items-center justify-between pt-4 border-t border-gray-200">
                      <div className="space-y-1">
                        <FormLabel className="text-base font-medium">Share with Circle</FormLabel>
                        <p className="text-sm text-gray-500">
                          Your circle can see your reflection and learn from it
                        </p>
                      </div>
                      <FormControl>
                        <Switch
                          checked={field.value}
                          onCheckedChange={field.onChange}
                          data-testid="switch-share"
                        />
                      </FormControl>
                    </FormItem>
                  )}
                />
              </div>

              <div className="flex gap-3">
                <Button
                  type="button"
                  onClick={() => setStep(2)}
                  variant="outline"
                  className="flex-1"
                  data-testid="button-back-3"
                >
                  Back
                </Button>
                <Button
                  type="submit"
                  disabled={submitReview.isPending}
                  className="flex-1 bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-600 hover:to-teal-600"
                  size="lg"
                  data-testid="button-submit-review"
                >
                  {submitReview.isPending ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Submitting...
                    </>
                  ) : (
                    "Submit Review"
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
