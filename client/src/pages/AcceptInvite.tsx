import { useParams, useLocation } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { MobileLayout, UnifiedBackButton } from "@/components/ui/design-system";
import { Users, Target, Calendar, Clock, CheckCircle, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString("en-US", {
    month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit"
  });
}

function getDuration(startStr: string, endStr: string | null) {
  if (!endStr) return "Habit";
  const days = Math.ceil((new Date(endStr).getTime() - new Date(startStr).getTime()) / (1000 * 60 * 60 * 24));
  if (days === 1) return "1 day";
  if (days < 7) return `${days} days`;
  if (days === 7) return "1 week";
  const weeks = Math.floor(days / 7), rem = days % 7;
  return rem === 0 ? `${weeks} week${weeks > 1 ? "s" : ""}` : `${weeks}w ${rem}d`;
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
    onSuccess: (res) => {
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
      <MobileLayout>
        <div className="text-center py-16">
          <p className="text-gray-500 mb-4">This invite could not be found or has expired.</p>
          <Button onClick={() => setLocation("/")} variant="outline">Go Home</Button>
        </div>
      </MobileLayout>
    );
  }

  const { invite, will } = data;
  const isExpired = invite.status === "expired" || (invite.expiresAt && new Date(invite.expiresAt) <= new Date());
  const isAlreadyActioned = invite.status === "accepted" || invite.status === "declined";
  const isWill = will.willType === "cumulative";

  const checkInLabel = will.checkInType === "daily" ? "Every day" : will.checkInType === "specific_days" ? "Specific days" : "Final review only";

  return (
    <MobileLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="relative flex items-center justify-between mb-2 min-h-[44px]">
          <UnifiedBackButton onClick={() => setLocation("/")} testId="button-back" />
          <h1 className="absolute left-0 right-0 text-center text-xl font-semibold text-gray-900 pointer-events-none">
            Will Invite
          </h1>
          <span />
        </div>

        {/* Invite card */}
        <div className="relative">
          <div className="absolute -inset-1 bg-gradient-to-r from-violet-400 to-purple-400 rounded-2xl blur opacity-20" />
          <div className="relative bg-white border-0 shadow-xl rounded-2xl overflow-hidden">
            <div className="bg-gradient-to-r from-violet-600 to-purple-600 p-5 text-white text-center">
              <div className="w-14 h-14 bg-white/20 rounded-full flex items-center justify-center mx-auto mb-3">
                <Users className="w-7 h-7 text-white" strokeWidth={1.5} />
              </div>
              <p className="text-sm font-medium text-white/80 mb-1">
                {will.creatorName || "A friend"} invited you to a Shared Will
              </p>
              <p className="text-lg font-bold text-white">
                {isWill ? "We Will" : "I Will"}
              </p>
              {will.sharedWhat && (
                <p className="text-base text-white/90 mt-1 italic">"{will.sharedWhat}"</p>
              )}
            </div>

            <div className="p-5 space-y-4">
              {/* Will type badge */}
              <div className="flex items-center justify-center gap-2">
                <Badge className={isWill ? "bg-purple-100 text-purple-700" : "bg-violet-100 text-violet-700"}>
                  {isWill ? "We Will — shared commitment" : "I Will — individual commitments"}
                </Badge>
              </div>

              {/* Timeline */}
              <div className="flex items-start gap-3">
                <Calendar className="w-4 h-4 text-blue-500 mt-0.5 flex-shrink-0" />
                <div>
                  <p className="text-xs text-gray-400 font-medium uppercase tracking-wide">Starts</p>
                  <p className="text-sm text-gray-700 font-medium">{formatDate(will.startDate)}</p>
                  <p className="text-xs text-gray-400 mt-0.5">
                    {will.isIndefinite ? "Habit — no end date" : will.endDate ? `Duration: ${getDuration(will.startDate, will.endDate)}` : ""}
                  </p>
                </div>
              </div>

              {/* Tracking */}
              <div className="flex items-start gap-3">
                <Clock className="w-4 h-4 text-indigo-500 mt-0.5 flex-shrink-0" />
                <div>
                  <p className="text-xs text-gray-400 font-medium uppercase tracking-wide">Tracking</p>
                  <p className="text-sm text-gray-700">{checkInLabel}</p>
                </div>
              </div>

              {/* What happens when you accept */}
              <div className="bg-violet-50 border border-violet-100 rounded-xl p-3">
                <p className="text-xs text-violet-700 font-medium mb-1">
                  {isWill ? "If you accept (We Will):" : "If you accept (I Will):"}
                </p>
                <p className="text-xs text-violet-600 leading-relaxed">
                  {isWill
                    ? `You'll commit to the same goal: "${will.sharedWhat}". You'll add your personal "Why" next.`
                    : "You'll define your own personal commitment and why it matters to you."}
                </p>
              </div>

              {/* Expiry note */}
              {invite.expiresAt && !isAlreadyActioned && (
                <p className="text-xs text-gray-400 text-center italic">
                  Invite expires at {formatDate(invite.expiresAt)}
                </p>
              )}
            </div>
          </div>
        </div>

        {/* Status messages for expired / already actioned */}
        {isExpired && (
          <div className="bg-red-50 border border-red-100 rounded-xl p-4 text-center">
            <p className="text-sm text-red-600 font-medium">This invite has expired</p>
            <p className="text-xs text-red-400 mt-1">The Will has already started or the invite deadline has passed.</p>
          </div>
        )}

        {invite.status === "accepted" && !isExpired && (
          <div className="bg-emerald-50 border border-emerald-100 rounded-xl p-4 text-center">
            <CheckCircle className="w-6 h-6 text-emerald-500 mx-auto mb-2" />
            <p className="text-sm text-emerald-700 font-medium">You already accepted this invite</p>
            <Button onClick={() => setLocation(`/will/${willId}`)} className="mt-3 bg-emerald-600 hover:bg-emerald-700 text-white text-sm">
              View Will
            </Button>
          </div>
        )}

        {invite.status === "declined" && (
          <div className="bg-gray-50 border border-gray-200 rounded-xl p-4 text-center">
            <p className="text-sm text-gray-600">You declined this invite.</p>
          </div>
        )}

        {/* Action buttons — only when pending and not expired */}
        {invite.status === "pending" && !isExpired && (
          <div className="space-y-3">
            <button
              onClick={() => acceptMutation.mutate()}
              disabled={acceptMutation.isPending || declineMutation.isPending}
              className="w-full flex items-center justify-center gap-2 py-4 px-6 rounded-2xl bg-gradient-to-r from-violet-600 to-purple-600 hover:from-violet-700 hover:to-purple-700 text-white font-semibold text-base shadow-lg transition-all duration-200 active:scale-[0.98] disabled:opacity-50"
              data-testid="button-accept-invite"
            >
              {acceptMutation.isPending ? (
                <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white" />
              ) : (
                <CheckCircle className="w-5 h-5" />
              )}
              Accept Invite
            </button>

            <button
              onClick={() => declineMutation.mutate()}
              disabled={acceptMutation.isPending || declineMutation.isPending}
              className="w-full flex items-center justify-center gap-2 py-3.5 px-6 rounded-2xl border-2 border-gray-200 text-gray-600 font-medium text-sm hover:bg-gray-50 transition-all duration-200 active:scale-[0.98] disabled:opacity-50"
              data-testid="button-decline-invite"
            >
              {declineMutation.isPending ? (
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-gray-400" />
              ) : (
                <X className="w-4 h-4" />
              )}
              Decline
            </button>

            <p className="text-xs text-gray-400 text-center">
              You can decline if this doesn't work for you right now.
            </p>
          </div>
        )}
      </div>
    </MobileLayout>
  );
}
