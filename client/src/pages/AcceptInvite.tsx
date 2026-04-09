import { useParams, useLocation } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { ChevronLeft, Calendar, CheckCircle } from "lucide-react";
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
    invite: { id: number; status: string; expiresAt: string | null };
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

  const acceptMutation = useMutation({
    mutationFn: async () => {
      const r = await apiRequest(`/api/wills/${willId}/accept-invite`, { method: "POST" });
      return r.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/wills/all-active"] });
      queryClient.invalidateQueries({ queryKey: ['/api/wills/my-pending-invites'] });
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
  const isExpired = invite.status === "expired" || (invite.expiresAt && new Date(invite.expiresAt) <= new Date());
  const isAlreadyActioned = invite.status === "accepted" || invite.status === "declined";
  const isWeWill = will.willType === "cumulative";
  const inviterName = will.creatorName || "A friend";
  const inviterInitial = inviterName.charAt(0).toUpperCase();

  // Team section logic — show only when ≥ 2 confirmed non-current-user members exist
  // (i.e. creator + at least one other confirmed invitee). Pending invitees do not count.
  const visibleMembers = teamMembers.filter(m => m.status !== "declined");
  const otherMembers = visibleMembers.filter(m => m.userId !== user?.id);
  const confirmedOtherMembers = otherMembers.filter(m => m.isCreator || m.status === "accepted");
  const showTeamSection = confirmedOtherMembers.length >= 2;

  // Sort: accepted first, then pending
  const sortedMembers = [
    ...visibleMembers.filter(m => m.isCreator || m.status === "accepted"),
    ...visibleMembers.filter(m => !m.isCreator && m.status === "pending"),
  ];

  const isBusy = acceptMutation.isPending || declineMutation.isPending;

  return (
    <div className="min-h-screen bg-gray-50">
      <div
        style={{
          paddingTop: "max(0.75rem, env(safe-area-inset-top))",
          paddingBottom: "calc(env(safe-area-inset-bottom) + 1rem)",
        }}
      >
        <div className="max-w-sm mx-auto px-4 space-y-2.5">

          {/* 3-column nav */}
          <div className="grid items-center mb-1" style={{ gridTemplateColumns: "40px 1fr 40px" }}>
            <button
              onClick={() => setLocation("/")}
              className="w-10 h-10 flex items-center justify-center"
              data-testid="button-back"
            >
              <span className="w-8 h-8 flex items-center justify-center rounded-full bg-gray-100 border border-gray-200 text-gray-700 hover:bg-gray-200 transition-all active:scale-95">
                <ChevronLeft className="w-4 h-4" strokeWidth={2.5} />
              </span>
            </button>
            <h1 className="text-center text-sm font-semibold text-gray-900">Team Will Invite</h1>
            <span />
          </div>

          {/* Hero card */}
          <div className="rounded-2xl overflow-hidden" style={{ backgroundColor: "#7B3FC4" }}>
            <div className="px-5 py-4 text-center">
              <div
                className="w-11 h-11 rounded-full flex items-center justify-center mx-auto mb-2"
                style={{ backgroundColor: "rgba(255,255,255,0.2)" }}
              >
                <span className="text-white font-bold text-lg">{inviterInitial}</span>
              </div>
              <p className="text-xs mb-0.5" style={{ color: "rgba(255,255,255,0.75)" }}>
                {inviterName} invited you to{will.title ? "" : " a"}
              </p>
              <p className="text-lg font-bold text-white mb-2">
                {will.title || "Will"}
              </p>

              {/* We Will — shared commitment inset */}
              {isWeWill && will.sharedWhat && (
                <div
                  className="rounded-xl px-3 py-2.5 text-left"
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

          {/* Team / Commitments — only shown when ≥ 2 confirmed non-current-user members */}
          {showTeamSection && (
            <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
              <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide px-4 pt-3 pb-1.5">
                {isWeWill ? "Team" : "Commitments"}
              </p>
              {sortedMembers.map((member, idx) => {
                const isAccepted = member.isCreator || member.status === "accepted";
                const isCurrentUser = member.userId === user?.id;
                const isLast = idx === sortedMembers.length - 1;
                return (
                  <div
                    key={member.userId}
                    className={`flex items-center gap-3 px-4 py-2.5 ${!isLast ? "border-b border-gray-50" : ""} ${!isAccepted ? "opacity-50" : ""}`}
                  >
                    {/* Avatar with status dot */}
                    <div className="relative flex-shrink-0">
                      <div
                        className="w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-semibold"
                        style={{ backgroundColor: isAccepted ? "#7B3FC4" : "#D1D5DB" }}
                      >
                        {member.firstName.charAt(0).toUpperCase()}
                      </div>
                      {isAccepted && (
                        <span className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 bg-emerald-400 rounded-full border-2 border-white" />
                      )}
                    </div>

                    {/* Name + commitment (I Will only) */}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900 leading-tight">
                        {member.firstName}{isCurrentUser ? " (You)" : ""}
                      </p>
                      {!isWeWill && isAccepted && member.commitment && (
                        <p className="text-xs italic text-gray-400 truncate">"{member.commitment}"</p>
                      )}
                    </div>

                    {/* Status label */}
                    {isAccepted ? (
                      isWeWill ? (
                        <span className="text-xs font-semibold text-emerald-600 flex-shrink-0">In</span>
                      ) : null
                    ) : (
                      <span className="text-xs text-gray-400 flex-shrink-0">Pending</span>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {/* Type of Will */}
          <div
            className="rounded-2xl px-4 py-3 border"
            style={{ backgroundColor: "#F3EAFE", borderColor: "#D4B8F0" }}
          >
            <p className="text-[10px] font-medium text-purple-400 mb-2 uppercase tracking-wide">Type of Will</p>
            <div className="flex items-center gap-3">
              <div
                className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
                style={{ backgroundColor: "#7B3FC4" }}
              >
                {isWeWill ? (
                  <svg viewBox="0 0 24 24" className="w-5 h-5 text-white" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                    <circle cx="9" cy="7" r="4" />
                    <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
                    <path d="M16 3.13a4 4 0 0 1 0 7.75" />
                  </svg>
                ) : (
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
                    ? "Every member pursues the same commitment"
                    : "Each member pursues their own individual commitment"}
                </p>
              </div>
            </div>
          </div>

          {/* Starts row */}
          <div className="bg-white border border-gray-100 rounded-2xl px-4 py-3 flex items-center gap-3 shadow-sm">
            <div className="w-8 h-8 rounded-xl bg-amber-50 flex items-center justify-center flex-shrink-0 border border-amber-100">
              <Calendar className="w-4 h-4 text-amber-500" />
            </div>
            <div>
              <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide mb-0.5">Starts</p>
              <p className="text-sm font-medium text-gray-800">
                {formatDateRange(will.startDate, will.endDate, will.isIndefinite)}
              </p>
            </div>
          </div>

          {/* Expiry */}
          {invite.expiresAt && !isAlreadyActioned && !isExpired && (
            <p className="text-xs text-gray-400 text-center">
              {formatExpiryLine(invite.expiresAt)}
            </p>
          )}

          {/* Expired state */}
          {isExpired && (
            <div className="bg-red-50 border border-red-100 rounded-2xl p-4 text-center">
              <p className="text-sm text-red-600 font-medium">This invite has expired</p>
              <p className="text-xs text-red-400 mt-1">The Will has already started or the invite deadline has passed.</p>
            </div>
          )}

          {/* Already accepted */}
          {invite.status === "accepted" && !isExpired && (
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

          {/* Already declined */}
          {invite.status === "declined" && (
            <div className="bg-gray-50 border border-gray-200 rounded-2xl p-4 text-center">
              <p className="text-sm text-gray-600">You declined this invite.</p>
            </div>
          )}

          {/* Action buttons */}
          {invite.status === "pending" && !isExpired && (
            <div className="space-y-2 pt-1">
              <button
                onClick={() => acceptMutation.mutate()}
                disabled={isBusy}
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

              <button
                onClick={() => declineMutation.mutate()}
                disabled={isBusy}
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
