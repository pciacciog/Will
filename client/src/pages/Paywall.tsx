import { useEffect, useState } from "react";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { Hand, Check, Loader2 } from "lucide-react";
import {
  isIosNative,
  initRevenueCat,
  getMonthlyPackage,
  purchasePremium,
  restorePurchases,
  isUserCancelled,
} from "@/lib/revenueCat";

const FEATURES = [
  "Unlimited Solo & Inner Circle wills",
  "Team wills with friends",
  "Daily progress tracking & streaks",
  "Reminders & accountability nudges",
];

export default function Paywall() {
  const { toast } = useToast();
  const { user } = useAuth();
  const onIos = isIosNative();
  const userId = user?.id;

  const [loading, setLoading] = useState(false);
  const [restoring, setRestoring] = useState(false);
  const [priceLabel, setPriceLabel] = useState<string | null>(null);

  // Ensures RevenueCat is configured for this user before any store interaction.
  // Idempotent and re-attempts if a prior init failed (avoids a race where the
  // user taps before App.tsx's post-auth init has finished).
  const ensureConfigured = async () => {
    if (userId) await initRevenueCat(userId);
  };

  // On iOS, pull the real App Store price string from the current offering.
  useEffect(() => {
    if (!onIos || !userId) return;
    let cancelled = false;
    (async () => {
      try {
        await initRevenueCat(userId);
        const pkg = await getMonthlyPackage();
        if (!cancelled && pkg?.product?.priceString) setPriceLabel(pkg.product.priceString);
      } catch (err) {
        console.error("[Paywall] failed to load offering", err);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [onIos, userId]);

  const refreshAccess = () => {
    queryClient.invalidateQueries({ queryKey: ["/api/subscription/status"] });
  };

  // --- Web (Stripe) checkout ---
  const handleStripeSubscribe = async () => {
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

  // --- iOS (Apple In-App Purchase via RevenueCat) ---
  const handleApplePurchase = async () => {
    setLoading(true);
    try {
      await ensureConfigured();
      const active = await purchasePremium();
      if (active) {
        refreshAccess();
      } else {
        toast({
          title: "Purchase not completed",
          description: "We couldn't confirm your subscription. Please try again.",
          variant: "destructive",
        });
      }
    } catch (err) {
      if (!isUserCancelled(err)) {
        toast({
          title: "Purchase failed",
          description: "Something went wrong with the App Store. Please try again.",
          variant: "destructive",
        });
      }
    } finally {
      setLoading(false);
    }
  };

  const handleRestore = async () => {
    setRestoring(true);
    try {
      await ensureConfigured();
      const active = await restorePurchases();
      if (active) {
        toast({ title: "Subscription restored", description: "Welcome back!" });
        refreshAccess();
      } else {
        toast({
          title: "Nothing to restore",
          description: "We couldn't find an active subscription for your Apple ID.",
        });
      }
    } catch (err) {
      toast({
        title: "Restore failed",
        description: "Something went wrong. Please try again.",
        variant: "destructive",
      });
    } finally {
      setRestoring(false);
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
            <span className="text-4xl font-bold text-gray-900" data-testid="text-price">
              {priceLabel ?? "$5.99"}
            </span>
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
            onClick={onIos ? handleApplePurchase : handleStripeSubscribe}
            disabled={loading || restoring}
            className="mt-7 h-12 w-full rounded-xl bg-brandGreen text-base font-semibold hover:bg-brandGreen/90"
            data-testid="button-subscribe"
          >
            {loading ? (
              <>
                <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                {onIos ? "Processing…" : "Starting checkout…"}
              </>
            ) : (
              "Subscribe"
            )}
          </Button>

          {onIos && (
            <Button
              onClick={handleRestore}
              disabled={loading || restoring}
              variant="ghost"
              className="mt-2 h-10 w-full rounded-xl text-sm font-medium text-gray-600 hover:text-gray-900"
              data-testid="button-restore"
            >
              {restoring ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Restoring…
                </>
              ) : (
                "Restore purchases"
              )}
            </Button>
          )}

          {onIos ? (
            <p className="mt-4 text-[11px] leading-relaxed text-gray-400">
              {priceLabel ?? "$5.99"}/month. Your subscription automatically renews
              monthly unless cancelled at least 24 hours before the end of the current
              period. Payment is charged to your Apple ID account at confirmation of
              purchase. Manage or cancel anytime in your Apple ID settings.
            </p>
          ) : (
            <p className="mt-4 text-xs text-gray-400">
              Cancel anytime. Secure payment powered by Stripe.
            </p>
          )}

          <p className="mt-3 text-[11px] text-gray-400">
            <Link href="/terms">
              <a className="underline hover:text-gray-600" data-testid="link-paywall-terms">
                Terms of Use
              </a>
            </Link>
            {" · "}
            <Link href="/privacy">
              <a className="underline hover:text-gray-600" data-testid="link-paywall-privacy">
                Privacy Policy
              </a>
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
