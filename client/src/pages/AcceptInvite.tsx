import { useParams, useLocation } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { ChevronLeft, Calendar, CheckCircle } from "lucide-react";
import { Button } from "@/components/ui/button";

function formatStartsLine(startStr: string, endStr: string | null, isIndefinite: boolean): string {
  const start = new Date(startStr);
  const datePart = start.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
  const timePart = start.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
  if (isIndefinite) return `${datePart} at ${timePart} · ongoing`;
  if (!endStr) return `${datePart} at ${timePart}`;
  const days = Math.ceil((new Date(endStr).getTime() - start.getTime()) / 86400000);
  const dur = days === 1 ? "1 day" : days < 7 ? `${days} days` : days === 7 ? "1 week" : `${Math.floor(days / 7)}w ${days % 7 > 0 ? `${days % 7}d` : ""}`.trim();
  return `${datePart} at ${timePart} · ${dur}`;
}

function formatExpiryLine(expiresAt: string): string {
  const d = new Date(expiresAt);
  const datePart = d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
  const timePart = d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
  return `Invite expires ${datePart} at ${timePart}`;
}

export default function AcceptInvite() {
  const { id } = useParams();
  const willId = parseInt(id || "0");
  const [, setLocation] = useLocation();
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data, isLoading, isError } = useQuery<{
    invite: { id: number; status: string; expiresAt: string | null };
    will: {
      id: number;
      mode: string;
      willType: string;
      sharedWhat: string | null;
      startDate: string;
      endDate: string | null;
      isIndefinite: boolean;
      createdBy: string;
      creatorName?: string;
      checkInType: string;
    };
  }>({
    queryKey: [`/api/wills/${willId}/my-invite`],
    enabled: !!user && !!willId,
  });

  const acceptMutation = useMutation({
    mutationFn: async () => {
      const r = await apiRequest(`/api/wills/${willId}/accept-invite`, { method: "POST" });
      return r.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/wills/all-active"] });
      toast({ title: "Invite accepted!", description: "Now set your commitment.", duration: 3000 });
      setLocation(`/will/${willId}/commit`);
    },
    onError: (err: any) => {
      toast({ title: "Error", description: err.message || "Could not accept invite.", variant: "destructive" });
    },
  });

  const declineMutation = useMutation({
    mutationFn: async () => {
      const r = await apiRequest(`/api/wills/${willId}/decline-invite`, { method: "POST" });
      return r.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/wills/all-active"] });
      toast({ title: "Invite declined.", duration: 3000 });
      setLocation("/");
    },
    onError: (err: any) => {
      toast({ title: "Error", description: err.message || "Could not decline invite.", variant: "destructive" });
    },
  });

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <p className="text-gray-500 mb-4">Please sign in to view this invite.</p>
          <Button onClick={() => setLocation("/auth")}>Sign In</Button>
        </div>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-violet-600" />
      </div>
    );
  }

  if (isError || !data) {
    return (
      <div className="min-h-screen flex items-center justify-center px-5">
        <div className="text-center">
          <p className="text-gray-500 mb-4">This invite could not be found or has expired.</p>
          <Button onClick={() => setLocation("/")} variant="outline">Go Home</Button>
        </div>
      </div>
    );
  }

  const { invite, will } = data;
  const isExpired = invite.status === "expired" || (invite.expiresAt && new Date(invite.expiresAt) <= new Date());
  const isAlreadyActioned = invite.status === "accepted" || invite.status === "declined";
  const isWeWill = will.willType === "cumulative";
  const inviterName = will.creatorName || "A friend";
  const inviterInitial = inviterName.charAt(0).toUpperCase();

  return (
    <div className="min-h-screen bg-gray-50">
      <div
        className="pb-[calc(env(safe-area-inset-bottom)+1.5rem)]"
        style={{ paddingTop: "max(1rem, env(safe-area-inset-top))" }}
      >
        <div className="max-w-sm mx-auto px-5">

          {/* 3-column nav */}
          <div className="grid items-center mb-4" style={{ gridTemplateColumns: "40px 1fr 40px" }}>
            <button
              onClick={() => setLocation("/")}
              className="w-10 h-10 flex items-center justify-center"
              data-testid="button-back"
            >
              <span className="w-8 h-8 flex items-center justify-center rounded-lg bg-gray-100 border border-gray-200 text-gray-700 hover:bg-gray-200 transition-all active:scale-95">
                <ChevronLeft className="w-5 h-5" strokeWidth={2.5} />
              </span>
            </button>
            <h1 className="text-center text-base font-semibold text-gray-900">Team Will Invite</h1>
            <span />
          </div>

          {/* Hero card */}
          <div className="rounded-2xl overflow-hidden mb-3" style={{ backgroundColor: "#7B3FC4" }}>
            <div className="p-6 text-center">
              <div
                className="w-14 h-14 rounded-full flex items-center justify-center mx-auto mb-3"
                style={{ backgroundColor: "rgba(255,255,255,0.2)" }}
              >
                <span className="text-white font-bold text-xl">{inviterInitial}</span>
              </div>
              <p className="text-sm mb-1" style={{ color: "rgba(255,255,255,0.75)" }}>
                {inviterName} invited you to a
              </p>
              <p className="text-xl font-bold text-white mb-3">Team Will</p>

              {/* We Will — shared commitment inset */}
              {isWeWill && will.sharedWhat && (
                <div
                  className="rounded-xl px-4 py-3 text-center"
                  style={{ backgroundColor: "rgba(255,255,255,0.15)" }}
                >
                  <p className="text-[10px] font-medium mb-1" style={{ color: "rgba(255,255,255,0.65)" }}>
                    The commitment
                  </p>
                  <p className="text-sm font-bold italic text-white">
                    "{will.sharedWhat}"
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* Type of Will card */}
          <div
            className="rounded-2xl p-4 mb-3 border"
            style={{ backgroundColor: "#F3EAFE", borderColor: "#D4B8F0" }}
          >
            <p className="text-[11px] font-medium text-purple-400 mb-2 uppercase tracking-wide">Type of Will</p>
            <div className="flex items-center gap-3">
              <div
                className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
                style={{ backgroundColor: "#7B3FC4" }}
              >
                {isWeWill ? (
                  /* Group / people icon for We Will */
                  <svg viewBox="0 0 24 24" className="w-5 h-5 text-white" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                    <circle cx="9" cy="7" r="4" />
                    <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
                    <path d="M16 3.13a4 4 0 0 1 0 7.75" />
                  </svg>
                ) : (
                  /* Target / circle icon for I Will */
                  <svg viewBox="0 0 24 24" className="w-5 h-5 text-white" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="12" cy="12" r="9" />
                    <circle cx="12" cy="12" r="4" />
                    <circle cx="12" cy="12" r="1" fill="currentColor" />
                  </svg>
                )}
              </div>
              <div>
                <p className="font-bold text-gray-900 text-sm">{isWeWill ? "We Will" : "I Will"}</p>
                <p className="text-xs mt-0.5 leading-snug" style={{ color: "#7B3FC4" }}>
                  {isWeWill
                    ? "Every member pursues a shared commitment"
                    : "Each member pursues their own individual commitment"}
                </p>
              </div>
            </div>
          </div>

          {/* Starts row */}
          <div className="bg-white border border-gray-100 rounded-2xl p-4 mb-3 flex items-center gap-3 shadow-sm">
            <div className="w-9 h-9 rounded-xl bg-amber-50 flex items-center justify-center flex-shrink-0 border border-amber-100">
              <Calendar className="w-4 h-4 text-amber-500" />
            </div>
            <div>
              <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide mb-0.5">Starts</p>
              <p className="text-sm font-medium text-gray-800">
                {formatStartsLine(will.startDate, will.endDate, will.isIndefinite)}
              </p>
            </div>
          </div>

          {/* Expiry line */}
          {invite.expiresAt && !isAlreadyActioned && !isExpired && (
            <p className="text-xs text-gray-400 text-center mb-4">
              {formatExpiryLine(invite.expiresAt)}
            </p>
          )}

          {/* Expired state */}
          {isExpired && (
            <div className="bg-red-50 border border-red-100 rounded-2xl p-4 text-center mb-3">
              <p className="text-sm text-red-600 font-medium">This invite has expired</p>
              <p className="text-xs text-red-400 mt-1">The Will has already started or the invite deadline has passed.</p>
            </div>
          )}

          {/* Already accepted */}
          {invite.status === "accepted" && !isExpired && (
            <div className="bg-emerald-50 border border-emerald-100 rounded-2xl p-4 text-center mb-3">
              <CheckCircle className="w-6 h-6 text-emerald-500 mx-auto mb-2" />
              <p className="text-sm text-emerald-700 font-medium">You already accepted this invite</p>
              <Button
                onClick={() => setLocation(`/will/${willId}`)}
                className="mt-3 bg-emerald-600 hover:bg-emerald-700 text-white text-sm"
              >
                View Will
              </Button>
            </div>
          )}

          {/* Already declined */}
          {invite.status === "declined" && (
            <div className="bg-gray-50 border border-gray-200 rounded-2xl p-4 text-center mb-3">
              <p className="text-sm text-gray-600">You declined this invite.</p>
            </div>
          )}

          {/* Action buttons — pending and not expired */}
          {invite.status === "pending" && !isExpired && (
            <div className="space-y-3 mt-1">
              {/* Accept */}
              <button
                onClick={() => acceptMutation.mutate()}
                disabled={acceptMutation.isPending || declineMutation.isPending}
                className="w-full flex items-center justify-center gap-2 py-4 px-6 rounded-2xl text-white font-semibold text-base transition-all duration-200 active:scale-[0.98] disabled:opacity-50"
                style={{ backgroundColor: "#2D9D78" }}
                data-testid="button-accept-invite"
              >
                {acceptMutation.isPending ? (
                  <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white" />
                ) : (
                  <CheckCircle className="w-5 h-5" />
                )}
                Accept invite
              </button>

              {/* Decline */}
              <button
                onClick={() => declineMutation.mutate()}
                disabled={acceptMutation.isPending || declineMutation.isPending}
                className="w-full flex items-center justify-center gap-2 py-3.5 px-6 rounded-2xl bg-white border border-gray-200 text-gray-500 font-medium text-sm hover:bg-gray-50 transition-all duration-200 active:scale-[0.98] disabled:opacity-50"
                data-testid="button-decline-invite"
              >
                {declineMutation.isPending ? (
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-gray-400" />
                ) : (
                  <span className="text-base leading-none">×</span>
                )}
                Decline
              </button>

              <p className="text-xs text-gray-400 text-center">
                You can decline if this doesn't work for you right now.
              </p>
            </div>
          )}

        </div>
      </div>
    </div>
  );
}
