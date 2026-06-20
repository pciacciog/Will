import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { Loader2 } from "lucide-react";
import appLogo from "@assets/apple-devices/AppIcon.appiconset/icon-ios-1024x1024.png";
import {
  isIosNative,
  initRevenueCat,
  purchasePremium,
  restorePurchases,
  isUserCancelled,
} from "@/lib/revenueCat";

export default function Paywall() {
  const { toast } = useToast();
  const { user } = useAuth();
  const onIos = isIosNative();
  const userId = user?.id;

  const [loading, setLoading] = useState(false);
  const [restoring, setRestoring] = useState(false);

  // Ensures RevenueCat is configured for this user before any store interaction.
  // Idempotent and re-attempts if a prior init failed (avoids a race where the
  // user taps before App.tsx's post-auth init has finished).
  const ensureConfigured = async () => {
    if (userId) await initRevenueCat(userId);
  };

  // Warm RevenueCat configuration on mount so the purchase is ready when tapped.
  useEffect(() => {
    if (!onIos || !userId) return;
    initRevenueCat(userId).catch((err) => console.error("[Paywall] init failed", err));
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
    <div className="min-h-screen flex flex-col items-center justify-center px-6 py-10 bg-gradient-to-b from-brandGreen/10 to-white">
      <div className="w-full max-w-md text-center">
        <p
          className="text-sm font-bold uppercase tracking-[0.2em] text-[#1D9E75]"
          data-testid="text-paywall-brand"
        >
          WILL
        </p>

        <div className="mx-auto mt-4 h-20 w-20 overflow-hidden rounded-2xl bg-white shadow-sm">
          <img
            src={appLogo}
            alt="WILL"
            className="h-full w-full object-cover"
            data-testid="img-paywall-icon"
          />
        </div>

        <h1
          className="mt-8 text-4xl font-bold leading-tight tracking-tight text-gray-900"
          data-testid="text-paywall-title"
        >
          Become your intentions.
        </h1>

        <div className="mt-10 rounded-2xl bg-white p-7 shadow-sm" data-testid="card-price">
          <p className="text-2xl font-bold text-[#1D9E75]" data-testid="text-trial">
            30-Day Free Trial
          </p>
          <p
            className="mt-2 text-xs font-medium uppercase tracking-[0.2em] text-gray-400"
            data-testid="text-then"
          >
            THEN
          </p>
          <p className="mt-1 text-lg text-gray-500" data-testid="text-price">
            $5.99 / month
          </p>
        </div>

        <Button
          onClick={onIos ? handleApplePurchase : handleStripeSubscribe}
          disabled={loading || restoring}
          className="mt-8 h-12 w-full rounded-xl bg-[#1D9E75] text-base font-semibold text-white hover:bg-[#1D9E75]/90"
          data-testid="button-subscribe"
        >
          {loading ? (
            <>
              <Loader2 className="mr-2 h-5 w-5 animate-spin" />
              Processing…
            </>
          ) : (
            "Start Free Trial"
          )}
        </Button>

        <p className="mt-3 text-sm text-gray-500" data-testid="text-disclaimer">
          No charge today · Cancel anytime
        </p>

        <button
          onClick={handleRestore}
          disabled={loading || restoring}
          className="mt-6 text-sm text-gray-500 underline hover:text-gray-700 disabled:opacity-50"
          data-testid="button-restore"
        >
          {restoring ? "Restoring…" : "Restore purchases"}
        </button>
      </div>
    </div>
  );
}
