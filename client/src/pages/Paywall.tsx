import { useState } from "react";
import { Button } from "@/components/ui/button";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Hand, Check, Loader2 } from "lucide-react";

const FEATURES = [
  "Unlimited Solo & Inner Circle wills",
  "Team wills with friends",
  "Daily progress tracking & streaks",
  "Reminders & accountability nudges",
];

export default function Paywall() {
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  const handleSubscribe = async () => {
    setLoading(true);
    try {
      const res = await apiRequest("/api/stripe/create-checkout-session", { method: "POST" });
      const data = await res.json();
      if (data?.url) {
        window.location.href = data.url;
      } else {
        throw new Error("No checkout URL returned");
      }
    } catch (err) {
      toast({
        title: "Couldn't start checkout",
        description: "Something went wrong. Please try again.",
        variant: "destructive",
      });
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-6 py-10 bg-gradient-to-b from-brandGreen/10 via-white to-brandBlue/10">
      <div className="w-full max-w-md text-center">
        <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-2xl bg-brandGreen/15">
          <Hand className="h-8 w-8 text-brandGreen" />
        </div>

        <h1 className="text-3xl font-bold tracking-tight text-gray-900" data-testid="text-paywall-title">
          Your free trial has ended
        </h1>
        <p className="mt-3 text-gray-600" data-testid="text-paywall-subtitle">
          Subscribe to WILL to keep building momentum on your goals.
        </p>

        <div className="mt-8 rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
          <div className="flex items-baseline justify-center gap-1">
            <span className="text-4xl font-bold text-gray-900" data-testid="text-price">$5.99</span>
            <span className="text-gray-500">/month</span>
          </div>

          <ul className="mt-6 space-y-3 text-left">
            {FEATURES.map((feature) => (
              <li key={feature} className="flex items-start gap-3">
                <Check className="mt-0.5 h-5 w-5 flex-shrink-0 text-brandGreen" />
                <span className="text-gray-700">{feature}</span>
              </li>
            ))}
          </ul>

          <Button
            onClick={handleSubscribe}
            disabled={loading}
            className="mt-7 h-12 w-full rounded-xl bg-brandGreen text-base font-semibold hover:bg-brandGreen/90"
            data-testid="button-subscribe"
          >
            {loading ? (
              <>
                <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                Starting checkout…
              </>
            ) : (
              "Subscribe"
            )}
          </Button>

          <p className="mt-4 text-xs text-gray-400">
            Cancel anytime. Secure payment powered by Stripe.
          </p>
        </div>
      </div>
    </div>
  );
}
