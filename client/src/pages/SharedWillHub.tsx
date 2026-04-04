import { useState, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { getApiPath } from "@/config/api";
import { sessionPersistence } from "@/services/SessionPersistence";
import { useAppRefresh } from "@/hooks/useAppRefresh";
import { willDisplayTitle } from "@/lib/willUtils";
import { formatDisplayDateTime } from "@/lib/dateUtils";
import ProgressView from "@/components/ProgressView";
import { WillReviewFlow } from "@/components/WillReviewFlow";
import { OngoingWillReviewFlow } from "@/components/OngoingWillReviewFlow";
import {
  ChevronLeft, Camera, Plus, Clock, CheckCircle, MessageCircle, X, Users,
  Target, Calendar, Settings, Pause, Play, Power, AlertTriangle, BarChart3,
} from "lucide-react";
import type { Will } from "@shared/schema";

type ProofDrop = {
  id: number;
  userId: string;
  imageUrl: string;
  thumbnailUrl: string | null;
  caption: string | null;
  createdAt: string;
  firstName: string | null;
  email: string;
};

type PhotoModal = {
  imageUrl: string;
  firstName: string | null;
  email: string;
  caption: string | null;
  createdAt: string;
} | null;

function formatTimeUntilStart(dateStr: string) {
  const diff = new Date(dateStr).getTime() - Date.now();
  if (diff <= 0) return "Starting now!";
  const days = Math.floor(diff / 86400000);
  const hours = Math.floor((diff % 86400000) / 3600000);
  if (days > 0) return `${days}d ${hours}h`;
  const mins = Math.floor((diff % 3600000) / 60000);
  if (hours > 0) return `${hours}h ${mins}m`;
  return `${mins}m`;
}

interface SharedWillHubProps {
  willId: number;
}

export default function SharedWillHub({ willId }: SharedWillHubProps) {
  const { user } = useAuth();
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [pendingProofs, setPendingProofs] = useState<{ tempId: string; blobUrl: string }[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [photoModal, setPhotoModal] = useState<PhotoModal>(null);
  const [showManageModal, setShowManageModal] = useState(false);
  const [showTerminateConfirm, setShowTerminateConfirm] = useState(false);

  useAppRefresh();

  const { data: will, isLoading } = useQuery<Will & {
    commitments?: any[];
    pendingInviteCount?: number;
    creatorName?: string;
    willType?: string;
    isIndefinite?: boolean;
    activeDays?: string;
    customDays?: string;
  }>({
    queryKey: [`/api/wills/${willId}/details`],
    refetchInterval: 30000,
    staleTime: 0,
    enabled: !!user,
  });

  const { data: invitesData } = useQuery<{ invites: { id: number; status: string; invitedUserId: string; firstName?: string }[] }>({
    queryKey: [`/api/wills/${willId}/invites`],
    enabled: !!user && will?.createdBy === user?.id,
    refetchInterval: 60000,
  });

  const { data: proofsData, refetch: refetchProofs } = useQuery<{ items: ProofDrop[]; hasMore: boolean }>({
    queryKey: [`/api/wills/${willId}/proofs`],
    queryFn: async () => {
      const token = await sessionPersistence.getToken();
      const headers: Record<string, string> = { "Content-Type": "application/json" };
      if (token) headers["Authorization"] = `Bearer ${token}`;
      const resp = await fetch(getApiPath(`/api/wills/${willId}/proofs?limit=4`), {
        credentials: "include",
        headers,
      });
      if (!resp.ok) throw new Error("Failed to fetch proofs");
      return resp.json();
    },
    enabled: !!user && will?.status === "active",
    refetchInterval: 30000,
    staleTime: 0,
  });

  // Check-in progress for users with daily tracking
  const userCommitment = will?.commitments?.find((c: any) => c.userId === user?.id);
  const userCheckInType = userCommitment?.checkInType || will?.checkInType || "final_review";
  const hasDailyCheckIns = userCheckInType === "daily" || userCheckInType === "specific_days";

  const { data: checkInProgress } = useQuery<{
    totalDays: number; checkedInDays: number; successRate: number;
    yesCount: number; partialCount: number; noCount: number; streak: number;
  }>({
    queryKey: [`/api/wills/${willId}/check-in-progress`],
    enabled: !!user && hasDailyCheckIns,
  });

  const isInReview = will?.status === 'will_review';
  const { data: reviewStatus } = useQuery<{
    hasReviewed: boolean;
    reviewCount: number;
    totalMembers: number;
  }>({
    queryKey: [`/api/wills/${willId}/review-status`],
    enabled: !!user && isInReview,
    refetchInterval: isInReview ? 5000 : false,
    staleTime: 0,
  });

  const proofItems: ProofDrop[] = proofsData?.items || [];

  // Lifecycle mutations
  const pauseMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest(`/api/wills/${willId}/pause`, { method: "POST" });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/wills/${willId}/details`] });
      queryClient.invalidateQueries({ queryKey: ["/api/wills/all-active"] });
      toast({ title: "Will Paused" });
      setShowManageModal(false);
    },
    onError: (err: any) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const resumeMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest(`/api/wills/${willId}/resume`, { method: "POST" });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/wills/${willId}/details`] });
      queryClient.invalidateQueries({ queryKey: ["/api/wills/all-active"] });
      toast({ title: "Will Resumed" });
      setShowManageModal(false);
    },
    onError: (err: any) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const terminateMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest(`/api/wills/${willId}/terminate`, { method: "POST" });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/wills/all-active"] });
      toast({ title: "Will ended" });
      setShowManageModal(false);
      setShowTerminateConfirm(false);
      setLocation("/");
    },
    onError: (err: any) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const handleDropPhoto = async (file: File) => {
    if (isUploading) return;
    const tempId = `tmp-${Date.now()}`;
    const blobUrl = URL.createObjectURL(file);
    setPendingProofs(prev => [...prev, { tempId, blobUrl }]);
    setIsUploading(true);
    let proofId: number | null = null;
    try {
      const token = await sessionPersistence.getToken();
      const authHeaders: Record<string, string> = {};
      if (token) authHeaders["Authorization"] = `Bearer ${token}`;
      const signRes = await fetch(getApiPath("/api/cloudinary/sign"), { credentials: "include", headers: authHeaders });
      if (!signRes.ok) {
        if (signRes.status === 503) throw new Error("Photo uploads are not configured yet.");
        throw new Error("Failed to get upload credentials.");
      }
      const { timestamp, signature, publicId: serverPublicId, apiKey: cApiKey, cloudName: cCloudName, eager: eagerTransform, uploadToken } = await signRes.json();
      const formData = new FormData();
      formData.append("file", file);
      formData.append("timestamp", String(timestamp));
      formData.append("signature", signature);
      formData.append("api_key", cApiKey);
      formData.append("public_id", serverPublicId);
      formData.append("transformation", "c_limit,w_1200,h_1200,q_auto");
      if (eagerTransform) formData.append("eager", eagerTransform);
      const uploadRes = await fetch(`https://api.cloudinary.com/v1_1/${cCloudName}/image/upload`, { method: "POST", body: formData });
      if (!uploadRes.ok) throw new Error("Photo upload failed.");
      const uploadData = await uploadRes.json();
      const imageUrl: string = uploadData.secure_url;
      const thumbnailUrl = imageUrl.replace("/upload/", "/upload/c_fill,w_200,h_200,q_auto/");
      const createRes = await fetch(getApiPath(`/api/wills/${willId}/proof`), {
        method: "POST", credentials: "include",
        headers: { "Content-Type": "application/json", ...authHeaders },
        body: JSON.stringify({ imageUrl, thumbnailUrl, cloudinaryPublicId: uploadData.public_id }),
      });
      if (!createRes.ok) {
        const err = await createRes.json().catch(() => ({}));
        if (uploadToken) {
          fetch(getApiPath("/api/cloudinary/abandon"), {
            method: "POST", credentials: "include",
            headers: { "Content-Type": "application/json", ...authHeaders },
            body: JSON.stringify({ uploadToken }),
          }).catch(() => {});
        }
        throw new Error((err as any).message || "Failed to save proof.");
      }
      const created = await createRes.json();
      proofId = created.id;
      if (proofId) {
        const confirmRes = await fetch(getApiPath(`/api/proofs/${proofId}/confirm`), {
          method: "PATCH", credentials: "include", headers: authHeaders,
        });
        if (!confirmRes.ok) throw new Error("Failed to confirm proof.");
      }
      await refetchProofs();
      toast({ title: "Drop added!" });
    } catch (err: any) {
      if (proofId) {
        const t = await sessionPersistence.getToken();
        const h: Record<string, string> = {};
        if (t) h["Authorization"] = `Bearer ${t}`;
        fetch(getApiPath(`/api/proofs/${proofId}/fail`), { method: "PATCH", credentials: "include", headers: h }).catch(() => {});
      }
      toast({ title: "Drop failed", description: err?.message || "Something went wrong.", variant: "destructive" });
    } finally {
      setPendingProofs(prev => prev.filter(p => p.tempId !== tempId));
      URL.revokeObjectURL(blobUrl);
      setIsUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-gray-500">Please sign in to view this Will.</p>
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

  if (!will) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <p className="text-gray-500 mb-4">Will not found.</p>
          <Button onClick={() => setLocation("/")} variant="outline">Go Home</Button>
        </div>
      </div>
    );
  }

  const isCreator = will.createdBy === user.id;
  const userHasCommitted = !!will.commitments?.find((c: any) => c.userId === user.id);
  const canManage = isCreator || userHasCommitted;
  const willTitle = willDisplayTitle(will as any, user.id);
  const isWeWill = will.willType === "cumulative";
  const commitments: any[] = will.commitments || [];
  const pendingInvites = invitesData?.invites?.filter(i => i.status === "pending") || [];
  const canPauseResume = canManage && (will.status === "active" || will.status === "paused");
  const canTerminate = canManage && (will.status === "active" || will.status === "paused" || will.status === "scheduled");

  const backUrl = sessionStorage.getItem("willBackUrl") || "/";

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-violet-50/30">
      {/* Photo modal */}
      {photoModal && (
        <div className="fixed inset-0 z-50 bg-black/90 flex flex-col" onClick={() => setPhotoModal(null)}>
          <div className="flex items-center justify-between px-4 py-3 text-white" style={{ paddingTop: "max(12px, env(safe-area-inset-top))" }}>
            <div className="min-w-0">
              <p className="font-semibold text-sm truncate">{photoModal.firstName || photoModal.email?.split("@")[0]}</p>
              <p className="text-xs text-white/60">{new Date(photoModal.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}</p>
            </div>
            <button onClick={() => setPhotoModal(null)} className="w-11 h-11 flex items-center justify-center bg-white/10 rounded-full hover:bg-white/20 transition-colors" data-testid="button-close-photo-modal">
              <X className="w-5 h-5 text-white" />
            </button>
          </div>
          <div className="flex-1 flex items-center justify-center px-4 pb-4" onClick={(e) => e.stopPropagation()}>
            <img src={photoModal.imageUrl} alt="Proof" className="max-w-full max-h-full rounded-xl object-contain shadow-2xl" />
          </div>
          {photoModal.caption && (
            <p className="text-white/80 text-sm px-4 text-center pb-6">{photoModal.caption}</p>
          )}
        </div>
      )}

      {/* Manage modal */}
      {showManageModal && (
        <div className="fixed inset-0 z-50 flex items-end justify-center" onClick={() => { setShowManageModal(false); setShowTerminateConfirm(false); }}>
          <div className="absolute inset-0 bg-black/40" />
          <div
            className="relative w-full max-w-sm bg-white rounded-t-2xl px-5 pt-4 pb-8 shadow-2xl"
            style={{ paddingBottom: "max(2rem, env(safe-area-inset-bottom))" }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="w-10 h-1 bg-gray-200 rounded-full mx-auto mb-5" />
            <h2 className="text-base font-semibold text-gray-900 mb-4">Manage Will</h2>

            {!showTerminateConfirm ? (
              <div className="space-y-2">
                {will.status === "active" && (
                  <button
                    onClick={() => pauseMutation.mutate()}
                    disabled={pauseMutation.isPending}
                    className="w-full flex items-center gap-3 p-4 rounded-xl border border-orange-200 bg-orange-50 hover:bg-orange-100 transition-colors text-left disabled:opacity-50"
                    data-testid="button-pause-will"
                  >
                    <Pause className="w-5 h-5 text-orange-600 flex-shrink-0" />
                    <div>
                      <p className="text-sm font-semibold text-orange-800">{pauseMutation.isPending ? "Pausing..." : "Pause Will"}</p>
                      <p className="text-xs text-orange-600 mt-0.5">Temporarily pause check-ins</p>
                    </div>
                  </button>
                )}
                {will.status === "paused" && (
                  <button
                    onClick={() => resumeMutation.mutate()}
                    disabled={resumeMutation.isPending}
                    className="w-full flex items-center gap-3 p-4 rounded-xl border border-emerald-200 bg-emerald-50 hover:bg-emerald-100 transition-colors text-left disabled:opacity-50"
                    data-testid="button-resume-will"
                  >
                    <Play className="w-5 h-5 text-emerald-600 flex-shrink-0" />
                    <div>
                      <p className="text-sm font-semibold text-emerald-800">{resumeMutation.isPending ? "Resuming..." : "Resume Will"}</p>
                      <p className="text-xs text-emerald-600 mt-0.5">Continue where you left off</p>
                    </div>
                  </button>
                )}
                {canTerminate && (
                  <button
                    onClick={() => setShowTerminateConfirm(true)}
                    className="w-full flex items-center gap-3 p-4 rounded-xl border border-red-200 bg-red-50 hover:bg-red-100 transition-colors text-left"
                    data-testid="button-terminate-will"
                  >
                    <Power className="w-5 h-5 text-red-600 flex-shrink-0" />
                    <div>
                      <p className="text-sm font-semibold text-red-800">End Will</p>
                      <p className="text-xs text-red-600 mt-0.5">Permanently terminate this will</p>
                    </div>
                  </button>
                )}
                <button
                  onClick={() => setShowManageModal(false)}
                  className="w-full py-3 text-center text-sm text-gray-500 hover:text-gray-700 transition-colors"
                  data-testid="button-cancel-manage"
                >
                  Cancel
                </button>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="flex items-center gap-3 p-4 bg-red-50 rounded-xl border border-red-200">
                  <AlertTriangle className="w-5 h-5 text-red-600 flex-shrink-0" />
                  <div>
                    <p className="text-sm font-semibold text-red-800">Are you sure?</p>
                    <p className="text-xs text-red-600 mt-0.5">This will end the will for all participants and cannot be undone.</p>
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    className="flex-1 border-gray-200 text-gray-600"
                    onClick={() => setShowTerminateConfirm(false)}
                    data-testid="button-cancel-terminate"
                  >
                    Cancel
                  </Button>
                  <Button
                    className="flex-1 bg-red-600 hover:bg-red-700 text-white"
                    onClick={() => terminateMutation.mutate()}
                    disabled={terminateMutation.isPending}
                    data-testid="button-confirm-terminate"
                  >
                    {terminateMutation.isPending ? "Ending..." : "End Will"}
                  </Button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => { const f = e.target.files?.[0]; if (f) handleDropPhoto(f); }}
      />

      <div className="pt-[calc(env(safe-area-inset-top)+4rem)] pb-[calc(env(safe-area-inset-bottom)+1rem)] min-h-screen">
        <div className="max-w-sm mx-auto px-5">

          {/* Header */}
          <div className="flex items-center justify-between mb-3">
            <button
              onClick={() => setLocation(backUrl)}
              className="w-11 h-11 -ml-2 flex items-center justify-center"
              data-testid="button-back-home"
            >
              <span className="w-8 h-8 flex items-center justify-center rounded-lg bg-gray-100 border border-gray-200 text-gray-700 hover:bg-gray-200 transition-all duration-200 active:scale-95">
                <ChevronLeft className="w-5 h-5" strokeWidth={2.5} />
              </span>
            </button>
            <div className="flex-1 text-center mx-2">
              <h1 className="text-base font-semibold text-gray-900 truncate">{willTitle}</h1>
            </div>
            <div className="flex items-center gap-1.5">
              {/* Messages */}
              <button
                onClick={() => {
                  sessionStorage.setItem("willBackUrl", `/will/${willId}`);
                  setLocation(`/will/${willId}/messages`);
                }}
                className="w-9 h-9 flex items-center justify-center rounded-full bg-gradient-to-br from-violet-500 to-purple-500 hover:from-violet-600 hover:to-purple-600 text-white transition-all active:scale-95 shadow-md"
                data-testid="button-open-messages"
                aria-label="Messages"
              >
                <MessageCircle className="w-4 h-4" strokeWidth={2} />
              </button>
              {/* Manage */}
              {canManage && (will.status === "active" || will.status === "paused" || will.status === "scheduled") && (
                <button
                  onClick={() => setShowManageModal(true)}
                  className="w-9 h-9 flex items-center justify-center rounded-full bg-gray-100 border border-gray-200 text-gray-600 hover:bg-gray-200 transition-all active:scale-95"
                  data-testid="button-manage-will"
                  aria-label="Manage Will"
                >
                  <Settings className="w-4 h-4" />
                </button>
              )}
            </div>
          </div>

          {/* Mode badge */}
          <div className="text-center mb-3">
            <Badge className={isWeWill ? "bg-purple-100 text-purple-700" : "bg-violet-100 text-violet-700"}>
              {isWeWill ? "We Will" : "I Will"}
            </Badge>
            {will.sharedWhat && (
              <p className="text-sm text-gray-600 italic mt-1.5">"{will.sharedWhat}"</p>
            )}
          </div>

          {/* Participants section */}
          <div className="relative mb-3">
            <div className="absolute -inset-1 bg-gradient-to-r from-violet-400 to-purple-500 rounded-2xl blur opacity-15" />
            <Card className="relative bg-white border-0 shadow-xl rounded-2xl overflow-hidden">
              <CardContent className="p-4">
                <div className="flex items-center gap-2 mb-3">
                  <Users className="w-4 h-4 text-violet-600" />
                  <h3 className="font-semibold text-gray-900 text-sm">Participants</h3>
                  {isCreator && pendingInvites.length > 0 && (
                    <Badge className="ml-auto bg-amber-100 text-amber-700 text-xs" data-testid="badge-pending-invites">
                      {pendingInvites.length} pending
                    </Badge>
                  )}
                </div>
                {commitments.length === 0 ? (
                  <p className="text-xs text-gray-400 italic text-center py-2">
                    No commitments yet — waiting for friends to accept
                  </p>
                ) : (
                  <div className={`grid gap-3 ${commitments.length === 1 ? "grid-cols-1 max-w-[120px] mx-auto" : commitments.length === 2 ? "grid-cols-2 max-w-[260px] mx-auto" : "grid-cols-3"}`}>
                    {commitments.map((c: any) => (
                      <div key={c.id} className="flex flex-col items-center p-2 bg-gradient-to-br from-gray-50 to-violet-50/30 rounded-xl border border-violet-100/50" data-testid={`participant-${c.userId}`}>
                        <div className="relative mb-1">
                          <div className="absolute inset-0 bg-violet-500/20 blur-sm rounded-full" />
                          <div className="relative w-9 h-9 bg-gradient-to-br from-violet-500 to-purple-500 rounded-full flex items-center justify-center shadow-sm">
                            <span className="text-white font-semibold text-xs">
                              {(c.user?.firstName || c.user?.email)?.charAt(0).toUpperCase()}
                            </span>
                          </div>
                          <div className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 bg-green-400 rounded-full border-2 border-white" />
                        </div>
                        <div className="text-center min-w-0 w-full">
                          <div className="font-medium text-gray-900 truncate text-xs leading-tight">
                            {c.user?.firstName || c.user?.email?.split("@")[0]}
                          </div>
                          {!isWeWill && c.what && (
                            <p className="text-[10px] text-gray-400 mt-0.5 truncate italic">"{c.what}"</p>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Status card */}
          <div className="relative mb-3">
            <div className="absolute -inset-1 bg-gradient-to-r from-violet-400 to-purple-500 rounded-2xl blur opacity-15" />
            <Card className="relative bg-white border-0 shadow-xl rounded-2xl overflow-hidden">
              <CardContent className="p-4">
                <div className="flex items-center gap-1.5 mb-3">
                  <Target className="w-4 h-4 text-violet-600" />
                  <h3 className="font-semibold text-gray-900 text-sm">Will Status</h3>
                </div>

                {will.status === "pending" && (
                  <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 text-center space-y-1.5">
                    <div className="flex items-center justify-center gap-1.5 text-amber-600 text-xs font-semibold">
                      <Clock className="w-3.5 h-3.5" />
                      <span>Waiting for friends to accept</span>
                    </div>
                    <p className="text-[10px] text-amber-600 leading-tight">
                      Will activates at start date if at least one friend accepts.
                    </p>
                  </div>
                )}

                {will.status === "scheduled" && (
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 bg-blue-50 rounded-lg flex items-center justify-center border border-blue-100">
                        <Clock className="w-4 h-4 text-blue-600" />
                      </div>
                      <div>
                        <h3 className="font-semibold text-gray-900 text-sm">Starts in {formatTimeUntilStart(will.startDate as unknown as string)}</h3>
                        <p className="text-xs text-gray-500">{formatDisplayDateTime(will.startDate as unknown as string)}</p>
                      </div>
                    </div>
                    <Badge className="bg-blue-100 text-blue-800 border border-blue-200 text-xs">Scheduled</Badge>
                  </div>
                )}

                {will.status === "active" && (
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className="w-8 h-8 bg-green-50 rounded-lg flex items-center justify-center border border-green-100">
                          <CheckCircle className="w-4 h-4 text-green-600" />
                        </div>
                        <div>
                          <h3 className="font-semibold text-gray-900 text-sm truncate">{willTitle}</h3>
                          <p className="text-xs text-gray-500">
                            {(will as any).isIndefinite ? "Habit — no end date" : will.endDate ? `Ends ${formatDisplayDateTime(will.endDate as unknown as string)}` : ""}
                          </p>
                        </div>
                      </div>
                      <Badge className="bg-green-100 text-green-800 border border-green-200 text-xs">Active</Badge>
                    </div>

                    {/* Daily check-in button */}
                    {hasDailyCheckIns && (
                      <Button
                        className="w-full bg-gradient-to-r from-violet-600 to-purple-600 hover:from-violet-700 hover:to-purple-700 text-white text-sm py-2.5"
                        onClick={() => {
                          sessionStorage.setItem("willBackUrl", `/will/${willId}`);
                          setLocation(`/will/${willId}`);
                        }}
                        data-testid="button-daily-check-in"
                      >
                        <Calendar className="w-4 h-4 mr-2" />
                        Daily Check-In
                      </Button>
                    )}
                  </div>
                )}

                {will.status === "paused" && (
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className="w-8 h-8 bg-orange-50 rounded-lg flex items-center justify-center border border-orange-100">
                          <Pause className="w-4 h-4 text-orange-600" />
                        </div>
                        <div>
                          <h3 className="font-semibold text-gray-900 text-sm">Paused</h3>
                          <p className="text-xs text-gray-500">Tap Manage to resume</p>
                        </div>
                      </div>
                      <Badge className="bg-orange-100 text-orange-800 border border-orange-200 text-xs">Paused</Badge>
                    </div>
                    {canManage && (
                      <Button
                        variant="outline"
                        className="w-full border-orange-200 text-orange-700 hover:bg-orange-50 text-sm"
                        onClick={() => resumeMutation.mutate()}
                        disabled={resumeMutation.isPending}
                        data-testid="button-resume-inline"
                      >
                        <Play className="w-4 h-4 mr-2" />
                        {resumeMutation.isPending ? "Resuming..." : "Resume Will"}
                      </Button>
                    )}
                  </div>
                )}

                {will.status === "will_review" && userCommitment && (
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className="w-8 h-8 bg-purple-50 rounded-lg flex items-center justify-center border border-purple-100">
                          <CheckCircle className="w-4 h-4 text-purple-600" />
                        </div>
                        <div>
                          <h3 className="font-semibold text-gray-900 text-sm">Will Review</h3>
                          <p className="text-xs text-gray-500">Time to reflect and review</p>
                        </div>
                      </div>
                      <Badge className="bg-purple-100 text-purple-800 border border-purple-200 text-xs">Review</Badge>
                    </div>

                    {reviewStatus?.hasReviewed ? (
                      <div className="bg-purple-50 border border-purple-200 rounded-xl p-4 text-center">
                        <CheckCircle className="w-8 h-8 text-purple-500 mx-auto mb-2" />
                        <p className="text-sm font-semibold text-gray-900">Review submitted</p>
                        {reviewStatus.reviewCount < reviewStatus.totalMembers ? (
                          <p className="text-xs text-gray-500 mt-1">
                            Waiting for others… {reviewStatus.reviewCount}/{reviewStatus.totalMembers} reviewed
                          </p>
                        ) : (
                          <p className="text-xs text-gray-500 mt-1">All members reviewed — finalizing…</p>
                        )}
                      </div>
                    ) : will.isIndefinite ? (
                      <OngoingWillReviewFlow
                        willId={willId}
                        startDate={will.startDate}
                        onComplete={() => {
                          queryClient.invalidateQueries({ queryKey: [`/api/wills/${willId}/details`] });
                          queryClient.invalidateQueries({ queryKey: [`/api/wills/${willId}/review-status`] });
                        }}
                      />
                    ) : (
                      <WillReviewFlow
                        willId={willId}
                        mode="circle"
                        checkInType={userCheckInType === 'daily' || userCheckInType === 'specific_days' ? 'daily' : 'one-time'}
                        startDate={will.startDate}
                        endDate={will.endDate ?? undefined}
                        onComplete={() => {
                          queryClient.invalidateQueries({ queryKey: [`/api/wills/${willId}/details`] });
                          queryClient.invalidateQueries({ queryKey: [`/api/wills/${willId}/review-status`] });
                        }}
                      />
                    )}
                  </div>
                )}

                {(will.status === "terminated" || will.status === "completed") && (
                  <div className="text-center py-2">
                    <Badge className={will.status === "completed" ? "bg-emerald-100 text-emerald-700" : "bg-gray-100 text-gray-600"}>
                      {will.status === "completed" ? "Completed" : "Ended"}
                    </Badge>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Daily progress — only for users with daily tracking and active/review will */}
          {hasDailyCheckIns && (will.status === "active" || will.status === "will_review" || will.status === "completed" || will.status === "terminated") && (
            <div className="relative mb-3">
              <div className="absolute -inset-1 bg-gradient-to-r from-violet-400 to-purple-500 rounded-2xl blur opacity-15" />
              <Card className="relative bg-white border-0 shadow-xl rounded-2xl overflow-hidden">
                <CardContent className="p-4">
                  <div className="flex items-center gap-2 mb-3">
                    <BarChart3 className="w-4 h-4 text-blue-500" />
                    <h3 className="font-semibold text-gray-900 text-sm">Daily Progress</h3>
                    {checkInProgress && (
                      <span className="ml-auto text-xs text-gray-400">
                        {checkInProgress.successRate}% success
                      </span>
                    )}
                  </div>
                  {checkInProgress && checkInProgress.totalDays > 0 ? (
                    <div>
                      <div className="grid grid-cols-3 gap-2 mb-3">
                        <div className="text-center bg-emerald-50 rounded-lg p-2">
                          <p className="text-lg font-bold text-emerald-600">{checkInProgress.yesCount}</p>
                          <p className="text-xs text-gray-500">Yes</p>
                        </div>
                        <div className="text-center bg-amber-50 rounded-lg p-2">
                          <p className="text-lg font-bold text-amber-600">{checkInProgress.partialCount}</p>
                          <p className="text-xs text-gray-500">Partial</p>
                        </div>
                        <div className="text-center bg-red-50 rounded-lg p-2">
                          <p className="text-lg font-bold text-red-500">{checkInProgress.noCount}</p>
                          <p className="text-xs text-gray-500">Missed</p>
                        </div>
                      </div>
                      <ProgressView
                        willId={willId}
                        startDate={will.startDate as unknown as string}
                        endDate={will.endDate as unknown as string | null}
                        checkInType={userCheckInType}
                        activeDays={will.activeDays || undefined}
                        customDays={will.customDays || undefined}
                      />
                    </div>
                  ) : (
                    <p className="text-xs text-gray-400 text-center py-3">No check-ins yet</p>
                  )}
                </CardContent>
              </Card>
            </div>
          )}

          {/* Proof Drops — active only */}
          {will.status === "active" && (
            <div className="relative mb-3">
              <div className="absolute -inset-1 bg-gradient-to-r from-violet-400 to-purple-500 rounded-2xl blur opacity-15" />
              <Card className="relative bg-white border-0 shadow-xl rounded-2xl overflow-hidden">
                <CardContent className="px-3.5 py-3">
                  <div className="flex items-center justify-between mb-2.5">
                    <div className="flex items-center gap-1.5">
                      <Camera className="w-4 h-4 text-violet-600" />
                      <h3 className="font-semibold text-gray-900 text-sm">Proof Drops</h3>
                    </div>
                    <button
                      onClick={() => fileInputRef.current?.click()}
                      disabled={isUploading}
                      className="flex items-center gap-1 border border-violet-600 text-violet-600 hover:bg-violet-50 disabled:opacity-50 bg-transparent text-xs font-medium px-2.5 py-1 rounded-full transition-colors"
                      data-testid="button-add-drop"
                    >
                      <Plus className="w-3 h-3" /> Drop
                    </button>
                  </div>
                  {proofItems.length === 0 && pendingProofs.length === 0 ? (
                    <button
                      onClick={() => fileInputRef.current?.click()}
                      disabled={isUploading}
                      className="w-full border border-dashed border-gray-300 rounded-xl py-4 flex flex-col items-center gap-1.5 text-gray-400 hover:border-violet-400 hover:text-violet-500 hover:bg-violet-50/40 transition-colors disabled:pointer-events-none"
                      data-testid="button-empty-drop-zone"
                    >
                      <Camera className="w-5 h-5 opacity-60" />
                      <span className="text-xs">No drops yet — be the first</span>
                    </button>
                  ) : (
                    <div className="flex gap-2 flex-wrap">
                      {proofItems.map((proof) => {
                        const initial = (proof.firstName || proof.email)?.charAt(0).toUpperCase() || "?";
                        const src = proof.thumbnailUrl || proof.imageUrl;
                        return (
                          <button
                            key={proof.id}
                            onClick={() => setPhotoModal({ imageUrl: proof.imageUrl, firstName: proof.firstName, email: proof.email, caption: proof.caption, createdAt: proof.createdAt })}
                            className="relative w-16 h-16 rounded-[10px] overflow-hidden flex-shrink-0 border border-gray-100 shadow-sm hover:opacity-90 transition-opacity"
                            data-testid={`button-proof-thumb-${proof.id}`}
                          >
                            <img src={src} alt="Proof" className="w-full h-full object-cover" />
                            <span className="absolute top-0.5 left-0.5 w-4 h-4 bg-violet-500 rounded-full flex items-center justify-center text-white font-bold text-[9px] shadow">
                              {initial}
                            </span>
                          </button>
                        );
                      })}
                      {pendingProofs.map((p) => (
                        <div key={p.tempId} className="relative w-16 h-16 rounded-[10px] overflow-hidden flex-shrink-0 border border-gray-100 shadow-sm">
                          <img src={p.blobUrl} alt="Uploading…" className="w-full h-full object-cover opacity-50" />
                          <div className="absolute inset-0 flex items-center justify-center">
                            <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          )}

          {/* Pending invite count for creator */}
          {isCreator && pendingInvites.length > 0 && (
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 text-center">
              <p className="text-xs text-amber-700 font-medium">
                {pendingInvites.length} friend{pendingInvites.length !== 1 ? "s" : ""} haven't responded yet
              </p>
            </div>
          )}

        </div>
      </div>
    </div>
  );
}
