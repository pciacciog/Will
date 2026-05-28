import { useParams, useLocation } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Calendar, CheckCircle, X, Check } from "lucide-react";
import { Button } from "@/components/ui/button";

type TeamMember = {
  userId: string;
  firstName: string;
  isCreator: boolean;
  status: "accepted" | "pending" | "declined";
  commitment: string | null;
};

function formatDateRange(startStr: string, endStr: string | null, isIndefinite: boolean): string {
  const start = new Date(startStr);
  const year = start.getFullYear();
  const startPart = start.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  if (isIndefinite) return `${startPart}, ${year} · ongoing`;
  if (!endStr) return `${startPart}, ${year}`;
  const end = new Date(endStr);
  if (start.toDateString() === end.toDateString()) return `${startPart}, ${year}`;
  const endPart = end.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  const endYear = end.getFullYear();
  if (year === endYear) return `${startPart} – ${endPart}, ${year}`;
  return `${startPart}, ${year} – ${endPart}, ${endYear}`;
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
    invite: { id: number; status: string; expiresAt: string | null; respondedAt: string | null };
    will: {
      id: number;
      mode: string;
      willType: string;
      sharedWhat: string | null;
      title?: string | null;
      startDate: string;
      endDate: string | null;
      isIndefinite: boolean;
      createdBy: string;
      creatorName?: string;
      checkInType: string;
    };
    teamMembers: TeamMember[];
  }>({
    queryKey: [`/api/wills/${willId}/my-invite`],
    enabled: !!user && !!willId,
  });

  const handleAccept = () => {
    setLocation(`/will/${willId}/commit`);
  };

  const declineMutation = useMutation({
    mutationFn: async () => {
      const r = await apiRequest(`/api/wills/${willId}/decline-invite`, { method: "POST" });
      return r.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/wills/all-active"] });
      queryClient.invalidateQueries({ queryKey: ['/api/wills/my-pending-invites'] });
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

  const { invite, will, teamMembers = [] } = data;
  const willHasStarted = will?.startDate ? new Date(will.startDate) <= new Date() : false;

  const myMember = teamMembers.find(m => m.userId === user?.id);
  const hasMyCommitment = !!myMember?.commitment;

  const acceptedDroppedOut =
    !hasMyCommitment &&
    willHasStarted &&
    !!invite.respondedAt &&
    (invite.status === "accepted" || invite.status === "expired");

  const acceptedButNotCommitted =
    invite.status === "accepted" && !hasMyCommitment && !willHasStarted;

  const expiresAtPassed = invite.expiresAt && new Date(invite.expiresAt) <= new Date();
  const isExpired = (invite.status === "expired" || expiresAtPassed) && !acceptedDroppedOut;
  const isAlreadyActioned = invite.status === "accepted" || invite.status === "declined";
  const isWeWill = will.willType === "cumulative";
  const inviterName = will.creatorName || "A friend";
  const inviterInitial = inviterName.charAt(0).toUpperCase();

  const visibleMembers = teamMembers.filter(m => m.status !== "declined");
  const otherMembers = visibleMembers.filter(m => m.userId !== user?.id);
  const showTeamSection = otherMembers.length >= 1;

  const sortedMembers = [
    ...visibleMembers.filter(m => m.isCreator || m.status === "accepted"),
    ...visibleMembers.filter(m => !m.isCreator && m.status === "pending"),
  ];

  const isBusy = declineMutation.isPending;

  const PURPLE = "#7F77DD";
  const PURPLE_BG = "#eeedfe";

  return (
    <div
      className="min-h-screen bg-white flex flex-col"
      style={{ paddingTop: "env(safe-area-inset-top)" }}
    >
      <div
        className="flex-1 flex flex-col max-w-sm mx-auto w-full px-4"
        style={{
          paddingBottom: "max(20px, env(safe-area-inset-bottom))",
        }}
      >

        {/* ── Content ─────────────────────────────────────────────────── */}
        <div className="flex flex-col gap-2.5">

          {/* Hero banner — compact horizontal */}
          <div
            className="flex items-center gap-3 px-4 py-3"
            style={{ background: PURPLE, borderRadius: 16 }}
          >
            {/* Avatar */}
            <div
              className="w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0"
              style={{ background: "rgba(255,255,255,0.2)" }}
            >
              <span className="text-white font-bold text-base">{inviterInitial}</span>
            </div>
            {/* Text */}
            <div className="min-w-0">
              <p className="text-xs leading-tight" style={{ color: "rgba(255,255,255,0.75)" }}>
                {inviterName} invited you to{will.title ? "" : " a"}
              </p>
              <p className="text-base font-bold text-white leading-tight truncate">
                {will.title || "Team Will"}
              </p>
            </div>
          </div>

          {/* Commitments card */}
          {showTeamSection && (
            <div className="bg-white overflow-hidden" style={{ borderRadius: 14, border: "1px solid #f0f0f0" }}>
              <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide px-4 pt-3 pb-1.5">
                {isWeWill ? "Team" : "Commitments"}
              </p>
              {sortedMembers.map((member, idx) => {
                const isAccepted = member.isCreator || member.status === "accepted";
                const isCurrentUser = member.userId === user?.id;
                const isPending = !isAccepted;
                const isLast = idx === sortedMembers.length - 1;
                return (
                  <div key={member.userId}>
                    <div className="flex items-center gap-3 px-4" style={{ paddingTop: 7, paddingBottom: 7 }}>
                      {/* Avatar */}
                      <div
                        className="rounded-full flex items-center justify-center text-white text-xs font-semibold flex-shrink-0"
                        style={{
                          width: 34, height: 34,
                          background: isAccepted ? PURPLE : "#D1D5DB",
                        }}
                      >
                        {member.firstName.charAt(0).toUpperCase()}
                      </div>

                      {/* Name + commitment */}
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-900 leading-tight">
                          {member.firstName}{isCurrentUser ? " (You)" : ""}
                        </p>
                        {!isWeWill && isAccepted && member.commitment && (
                          <p className="text-xs italic text-gray-400 leading-snug truncate mt-0.5">
                            "{member.commitment}"
                          </p>
                        )}
                      </div>

                      {/* Right side */}
                      {isPending ? (
                        <span
                          className="text-xs text-gray-400 flex-shrink-0 px-2 py-0.5 rounded-full"
                          style={{ background: "#f2f2f7" }}
                        >
                          Pending
                        </span>
                      ) : isWeWill ? (
                        <span className="text-xs font-semibold text-emerald-600 flex-shrink-0">In</span>
                      ) : null}
                    </div>
                    {!isLast && (
                      <div style={{ height: 0.5, background: "#E5E7EB", marginLeft: 16, marginRight: 16 }} />
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {/* Type of Will card */}
          <div
            className="flex items-center gap-3 px-4 py-3"
            style={{ background: PURPLE_BG, borderRadius: 14 }}
          >
            <div
              className="flex items-center justify-center flex-shrink-0"
              style={{ width: 36, height: 36, borderRadius: 10, background: PURPLE }}
            >
              {isWeWill ? (
                <svg viewBox="0 0 24 24" className="w-[18px] h-[18px] text-white" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                  <circle cx="9" cy="7" r="4" />
                  <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
                  <path d="M16 3.13a4 4 0 0 1 0 7.75" />
                </svg>
              ) : (
                <svg viewBox="0 0 24 24" className="w-[18px] h-[18px] text-white" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="9" />
                  <circle cx="12" cy="12" r="4" />
                  <circle cx="12" cy="12" r="1" fill="currentColor" />
                </svg>
              )}
            </div>
            <div className="min-w-0">
              <p className="text-sm font-bold text-gray-900 leading-tight">{isWeWill ? "We Will" : "I Will"}</p>
              <p className="text-xs leading-snug truncate" style={{ color: PURPLE }}>
                {isWeWill
                  ? "Every member pursues the same commitment"
                  : "Each member pursues their own individual commitment"}
              </p>
            </div>
          </div>

          {/* We Will shared commitment inset */}
          {isWeWill && will.sharedWhat && (
            <div
              className="px-4 py-2.5"
              style={{ background: PURPLE_BG, borderRadius: 12 }}
            >
              <p className="text-[10px] font-semibold uppercase tracking-wide mb-1" style={{ color: PURPLE }}>
                The commitment
              </p>
              <p className="text-sm font-semibold italic" style={{ color: PURPLE }}>
                "{will.sharedWhat}"
              </p>
            </div>
          )}

          {/* Dates card */}
          <div
            className="bg-white flex items-center gap-3 px-4 py-3"
            style={{ borderRadius: 14, border: "1px solid #f0f0f0" }}
          >
            <div
              className="flex items-center justify-center flex-shrink-0"
              style={{ width: 36, height: 36, borderRadius: 10, background: "#fffbeb", border: "1px solid #fde68a" }}
            >
              <Calendar className="w-4 h-4 text-amber-500" />
            </div>
            <div>
              <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide mb-0.5">Starts</p>
              <p className="text-sm font-medium text-gray-800">
                {formatDateRange(will.startDate, will.endDate, will.isIndefinite)}
              </p>
            </div>
          </div>

          {/* Expiry note */}
          {invite.expiresAt && !isAlreadyActioned && !isExpired && (
            <p className="text-[11px] text-gray-400 text-center -mt-1">
              {formatExpiryLine(invite.expiresAt)}
            </p>
          )}

          {/* ── State-specific cards ─────────────────────────────────── */}

          {isExpired && (
            <div className="bg-red-50 border border-red-100 rounded-2xl p-4 text-center">
              <p className="text-sm text-red-600 font-medium">This invite has expired</p>
              <p className="text-xs text-red-400 mt-1">The Will has already started or the invite deadline has passed.</p>
            </div>
          )}

          {acceptedButNotCommitted && !isExpired && (
            <div className="bg-amber-50 border border-amber-100 rounded-2xl p-4 text-center" data-testid="card-finish-committing">
              <p className="text-sm text-amber-700 font-medium mb-1">You haven't finished committing yet</p>
              <p className="text-xs text-amber-600/80">
                You tapped Accept but never set your commitment. Finish before the Will starts so you don't drop out.
              </p>
              <Button
                onClick={() => setLocation(`/will/${willId}/commit`)}
                className="mt-3 bg-amber-600 hover:bg-amber-700 text-white text-sm"
                data-testid="button-finish-committing"
              >
                Finish committing
              </Button>
            </div>
          )}

          {acceptedDroppedOut && (
            <div className="bg-gray-50 border border-gray-200 rounded-2xl p-4 text-center" data-testid="card-dropped-out">
              <p className="text-sm text-gray-700 font-medium">You didn't finish committing in time</p>
              <p className="text-xs text-gray-500 mt-1">The Will has started without you. You can still join future Wills.</p>
              <Button
                onClick={() => setLocation("/")}
                variant="outline"
                className="mt-3 text-sm"
              >
                Go Home
              </Button>
            </div>
          )}

          {invite.status === "accepted" && hasMyCommitment && !isExpired && (
            <div className="bg-emerald-50 border border-emerald-100 rounded-2xl p-4 text-center">
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

          {invite.status === "declined" && (
            <div className="bg-gray-50 border border-gray-200 rounded-2xl p-4 text-center">
              <p className="text-sm text-gray-600">You declined this invite.</p>
            </div>
          )}

          {/* ── Accept / Decline ─────────────────────────────────────── */}
          {invite.status === "pending" && !isExpired && (
            <div className="flex flex-col gap-2 pt-1">
              {/* Accept */}
              <button
                onClick={handleAccept}
                disabled={isBusy}
                className="w-full flex items-center justify-center gap-2 py-[14px] text-white font-semibold text-base transition-all active:scale-[0.98] disabled:opacity-50"
                style={{ background: "#1D9E75", borderRadius: 14 }}
                data-testid="button-accept-invite"
              >
                <Check className="w-5 h-5" strokeWidth={2.5} />
                Accept invite
              </button>

              {/* Decline */}
              <button
                onClick={() => declineMutation.mutate()}
                disabled={isBusy}
                className="w-full flex items-center justify-center gap-2 py-[13px] bg-white font-medium text-sm transition-all active:scale-[0.98] disabled:opacity-50"
                style={{ border: "1.5px solid #E5E7EB", borderRadius: 14, color: "#6B7280" }}
                data-testid="button-decline-invite"
              >
                {declineMutation.isPending ? (
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-gray-400" />
                ) : (
                  <X className="w-4 h-4" strokeWidth={2.5} />
                )}
                Decline
              </button>

              <p className="text-[11px] text-gray-400 text-center">
                You can decline if this doesn't work for you right now.
              </p>
            </div>
          )}

        </div>
      </div>
    </div>
  );
}
