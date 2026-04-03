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
import { ChevronLeft, Camera, Plus, Clock, CheckCircle, MessageCircle, X, Users, Target, Calendar } from "lucide-react";
import { formatDisplayDateTime } from "@/lib/dateUtils";
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

type PhotoModalState = {
  imageUrl: string;
  firstName: string | null;
  email: string;
  caption: string | null;
  createdAt: string;
  willTitle: string | null;
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
  const [photoModal, setPhotoModal] = useState<PhotoModalState>(null);

  useAppRefresh();

  const { data: will, isLoading } = useQuery<Will & {
    commitments?: any[];
    sharedParticipants?: { firstName: string }[];
    pendingInviteCount?: number;
    creatorName?: string;
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
      if (!willId) return { items: [], hasMore: false };
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

  const proofItems: ProofDrop[] = proofsData?.items || [];

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
      if (!signRes.ok) { if (signRes.status === 503) throw new Error("Photo uploads are not configured yet."); throw new Error("Failed to get upload credentials."); }
      const { timestamp, signature, publicId: serverPublicId, apiKey: cApiKey, cloudName: cCloudName, eager: eagerTransform, uploadToken } = await signRes.json();
      const formData = new FormData();
      formData.append("file", file); formData.append("timestamp", String(timestamp)); formData.append("signature", signature);
      formData.append("api_key", cApiKey); formData.append("public_id", serverPublicId);
      formData.append("transformation", "c_limit,w_1200,h_1200,q_auto");
      if (eagerTransform) formData.append("eager", eagerTransform);
      const uploadRes = await fetch(`https://api.cloudinary.com/v1_1/${cCloudName}/image/upload`, { method: "POST", body: formData });
      if (!uploadRes.ok) throw new Error("Photo upload failed.");
      const uploadData = await uploadRes.json();
      const imageUrl: string = uploadData.secure_url;
      const cloudinaryPublicId: string = uploadData.public_id;
      const thumbnailUrl = imageUrl.replace("/upload/", "/upload/c_fill,w_200,h_200,q_auto/");
      const createRes = await fetch(getApiPath(`/api/wills/${willId}/proof`), {
        method: "POST", credentials: "include",
        headers: { "Content-Type": "application/json", ...authHeaders },
        body: JSON.stringify({ imageUrl, thumbnailUrl, cloudinaryPublicId }),
      });
      if (!createRes.ok) {
        const err = await createRes.json().catch(() => ({}));
        if (uploadToken) fetch(getApiPath("/api/cloudinary/abandon"), { method: "POST", credentials: "include", headers: { "Content-Type": "application/json", ...authHeaders }, body: JSON.stringify({ uploadToken }) }).catch(() => {});
        throw new Error(err.message || "Failed to save proof.");
      }
      const created = await createRes.json();
      proofId = created.id;
      if (proofId) {
        const confirmRes = await fetch(getApiPath(`/api/proofs/${proofId}/confirm`), { method: "PATCH", credentials: "include", headers: authHeaders });
        if (!confirmRes.ok) throw new Error("Failed to confirm proof.");
      }
      await refetchProofs();
      toast({ title: "Drop added!", description: "Your proof has been posted." });
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
  const willTitle = willDisplayTitle(will as any, user.id);
  const isWeWill = (will as any).willType === "cumulative";
  const commitments: any[] = (will as any).commitments || [];
  const pendingInvites = invitesData?.invites?.filter(i => i.status === "pending") || [];

  const backUrl = sessionStorage.getItem("willBackUrl") || "/wills";

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-violet-50/30">
      {/* Photo modal */}
      {photoModal && (
        <div className="fixed inset-0 z-50 bg-black/90 flex flex-col" onClick={() => setPhotoModal(null)}>
          <div className="flex items-center justify-between px-4 py-3 text-white" style={{ paddingTop: "max(12px, env(safe-area-inset-top))" }}>
            <div className="min-w-0">
              <p className="font-semibold text-sm truncate">{photoModal.firstName || photoModal.email?.split("@")[0]}</p>
              {photoModal.willTitle && <p className="text-xs text-white/80 truncate">{photoModal.willTitle}</p>}
              <p className="text-xs text-white/60">{new Date(photoModal.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}</p>
            </div>
            <button onClick={() => setPhotoModal(null)} className="w-11 h-11 flex items-center justify-center bg-white/10 rounded-full hover:bg-white/20 transition-colors" data-testid="button-close-photo-modal">
              <X className="w-5 h-5 text-white" />
            </button>
          </div>
          <div className="flex-1 flex items-center justify-center px-4 pb-4" onClick={(e) => e.stopPropagation()}>
            <img src={photoModal.imageUrl} alt="Proof" className="max-w-full max-h-full rounded-xl object-contain shadow-2xl" />
          </div>
          {photoModal.caption ? (
            <p className="text-white/80 text-sm px-4 text-center" style={{ paddingBottom: "max(24px, env(safe-area-inset-bottom))" }}>{photoModal.caption}</p>
          ) : (
            <div style={{ paddingBottom: "env(safe-area-inset-bottom)" }} />
          )}
        </div>
      )}

      <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) handleDropPhoto(f); }} />

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
            <div className="flex-1 text-center">
              <h1 className="text-base font-semibold text-gray-900 truncate">{willTitle}</h1>
            </div>
            {/* Messages button */}
            <button
              onClick={() => { sessionStorage.setItem("willBackUrl", `/will/${willId}`); setLocation(`/will/${willId}/messages`); }}
              className="w-10 h-10 flex items-center justify-center rounded-full bg-gradient-to-br from-violet-500 to-purple-500 hover:from-violet-600 hover:to-purple-600 text-white transition-all duration-200 active:scale-95 shadow-md"
              data-testid="button-open-messages"
              aria-label="Open messages"
            >
              <MessageCircle className="w-5 h-5" strokeWidth={2} />
            </button>
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
                    <Badge className="ml-auto bg-amber-100 text-amber-700 text-xs">
                      {pendingInvites.length} pending invite{pendingInvites.length !== 1 ? "s" : ""}
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
                      <div key={c.id} className="flex flex-col items-center p-2 bg-gradient-to-br from-gray-50 to-violet-50/30 rounded-xl border border-violet-100/50">
                        <div className="relative mb-1">
                          <div className="absolute inset-0 bg-violet-500/20 blur-sm rounded-full" />
                          <div className="relative w-9 h-9 bg-gradient-to-br from-violet-500 to-purple-500 rounded-full flex items-center justify-center shadow-sm">
                            <span className="text-white font-semibold text-xs">{(c.user?.firstName || c.user?.email)?.charAt(0).toUpperCase()}</span>
                          </div>
                          <div className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 bg-green-400 rounded-full border-2 border-white" />
                        </div>
                        <div className="text-center min-w-0 w-full">
                          <div className="font-medium text-gray-900 truncate text-xs leading-tight">
                            {c.user?.firstName || c.user?.email?.split("@")[0]}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Will status section */}
          <div className="relative mb-3">
            <div className="absolute -inset-1 bg-gradient-to-r from-violet-400 to-purple-500 rounded-2xl blur opacity-15" />
            <Card className="relative bg-white border-0 shadow-xl rounded-2xl overflow-hidden">
              <CardContent className="p-3">
                <div className="flex items-center gap-1.5 mb-2">
                  <Target className="w-3.5 h-3.5 text-violet-600" />
                  <h3 className="font-semibold text-gray-900 text-xs">Current Will</h3>
                </div>

                {will.status === "pending" && (
                  <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-center space-y-2">
                    <div className="flex items-center justify-center gap-1.5 text-amber-600 text-xs font-semibold">
                      <Clock className="w-3.5 h-3.5" />
                      <span>Waiting for friends to accept</span>
                    </div>
                    <p className="text-[10px] text-amber-700 leading-tight">
                      Will activates at start date if at least one friend accepts.
                    </p>
                    {isCreator && (
                      <Button onClick={() => setLocation(`/will/${willId}`)} size="sm" className="w-full bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white text-xs py-1.5">
                        View Details
                      </Button>
                    )}
                  </div>
                )}

                {will.status === "scheduled" && (
                  <div>
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-2">
                        <div className="relative">
                          <div className="absolute inset-0 bg-blue-500/20 blur-sm rounded-lg" />
                          <div className="relative w-9 h-9 bg-gradient-to-br from-blue-50 to-indigo-50 rounded-lg flex items-center justify-center border border-blue-100">
                            <Clock className="w-4 h-4 text-blue-600" />
                          </div>
                        </div>
                        <div>
                          <h3 className="font-semibold text-gray-900 text-sm">Scheduled</h3>
                          <p className="text-xs text-gray-500">Starts in {formatTimeUntilStart(will.startDate as unknown as string)}</p>
                        </div>
                      </div>
                      <Badge className="bg-blue-100 text-blue-800 border border-blue-200 text-xs">Scheduled</Badge>
                    </div>
                    <Button onClick={() => setLocation(`/will/${willId}`)} className="w-full bg-gradient-to-r from-violet-600 to-purple-600 hover:from-violet-700 hover:to-purple-700 text-white py-2 rounded-lg">
                      View Details
                    </Button>
                  </div>
                )}

                {will.status === "active" && (
                  <div>
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-2">
                        <div className="relative">
                          <div className="absolute inset-0 bg-green-500/20 blur-sm rounded-lg" />
                          <div className="relative w-9 h-9 bg-gradient-to-br from-green-50 to-emerald-50 rounded-lg flex items-center justify-center border border-green-100">
                            <CheckCircle className="w-4 h-4 text-green-600" />
                          </div>
                        </div>
                        <div>
                          <h3 className="font-semibold text-gray-900 text-sm truncate">{willTitle}</h3>
                          <p className="text-xs text-gray-500">{(will as any).isIndefinite ? "Habit" : `Ends ${formatDisplayDateTime(will.endDate as unknown as string)}`}</p>
                        </div>
                      </div>
                      <Badge className="bg-green-100 text-green-800 border border-green-200 text-xs">Active</Badge>
                    </div>
                    <Button onClick={() => setLocation(`/will/${willId}`)} className="w-full bg-gradient-to-r from-violet-600 to-purple-600 hover:from-violet-700 hover:to-purple-700 text-white py-2 rounded-lg">
                      View Details
                    </Button>
                  </div>
                )}

                {will.status === "will_review" && (
                  <div>
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-2">
                        <div className="relative">
                          <div className="absolute inset-0 bg-purple-500/20 blur-sm rounded-lg" />
                          <div className="relative w-9 h-9 bg-gradient-to-br from-purple-50 to-indigo-50 rounded-lg flex items-center justify-center border border-purple-100">
                            <CheckCircle className="w-4 h-4 text-purple-600" />
                          </div>
                        </div>
                        <div>
                          <h3 className="font-semibold text-gray-900 text-sm">Will Review</h3>
                          <p className="text-xs text-gray-500">Time to reflect</p>
                        </div>
                      </div>
                      <Badge className="bg-purple-100 text-purple-800 border border-purple-200 text-xs">Review</Badge>
                    </div>
                    <Button onClick={() => setLocation(`/will/${willId}`)} className="w-full bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white py-2 rounded-lg">
                      Submit Review
                    </Button>
                  </div>
                )}

                {(will.status === "terminated" || will.status === "paused") && (
                  <div className="text-center py-3">
                    <Badge className={will.status === "paused" ? "bg-orange-100 text-orange-700" : "bg-gray-100 text-gray-600"}>
                      {will.status === "paused" ? "Paused" : "Ended"}
                    </Badge>
                    <Button onClick={() => setLocation(`/will/${willId}`)} variant="outline" size="sm" className="mt-3 w-full text-xs">View Details</Button>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Proof Drops — active only */}
          {will.status === "active" && (
            <div className="relative mt-2">
              <div className="absolute -inset-1 bg-gradient-to-r from-violet-400 to-purple-500 rounded-2xl blur opacity-15" />
              <Card className="relative bg-white border-0 shadow-xl rounded-2xl overflow-hidden">
                <CardContent className="px-3.5 py-2.5">
                  <div className="flex items-center justify-between mb-2.5">
                    <div className="flex items-center gap-1.5">
                      <Camera className="w-4 h-4 text-violet-600" />
                      <h3 className="font-semibold text-gray-900 text-sm">Proof</h3>
                    </div>
                    <button onClick={() => fileInputRef.current?.click()} disabled={isUploading} className="flex items-center gap-1 border border-violet-600 text-violet-600 hover:bg-violet-50 disabled:opacity-50 bg-transparent text-xs font-medium px-2.5 py-1 rounded-full transition-colors" data-testid="button-add-drop">
                      <Plus className="w-3 h-3" /> Drop
                    </button>
                  </div>
                  {proofItems.length === 0 && pendingProofs.length === 0 ? (
                    <button onClick={() => fileInputRef.current?.click()} disabled={isUploading} className="w-full border border-dashed border-gray-300 rounded-xl py-3 flex flex-col items-center gap-1.5 text-gray-400 hover:border-violet-400 hover:text-violet-500 hover:bg-violet-50/40 transition-colors disabled:pointer-events-none" data-testid="button-empty-drop-zone">
                      <Camera className="w-5 h-5 opacity-60" />
                      <span className="text-xs">No drops yet — be the first</span>
                    </button>
                  ) : (
                    <div className="border border-dashed border-gray-200 rounded-xl p-2">
                      <div className="flex gap-2 flex-wrap">
                        {proofItems.slice(0, 3).map((proof) => {
                          const initial = (proof.firstName || proof.email)?.charAt(0).toUpperCase() || "?";
                          const src = proof.thumbnailUrl || proof.imageUrl;
                          return (
                            <button key={proof.id} onClick={() => setPhotoModal({ imageUrl: proof.imageUrl, firstName: proof.firstName, email: proof.email, caption: proof.caption, createdAt: proof.createdAt, willTitle: willTitle })} className="relative w-14 h-14 rounded-[10px] overflow-hidden flex-shrink-0 border border-gray-100 shadow-sm hover:opacity-90 transition-opacity" data-testid={`button-proof-thumb-${proof.id}`}>
                              <img src={src} alt="Proof" className="w-full h-full object-cover" />
                              <span className="absolute top-0.5 left-0.5 w-4 h-4 bg-violet-500 rounded-full flex items-center justify-center text-white font-bold text-[9px] shadow">{initial}</span>
                            </button>
                          );
                        })}
                        {pendingProofs.map((p) => (
                          <div key={p.tempId} className="relative w-14 h-14 rounded-[10px] overflow-hidden flex-shrink-0 border border-gray-100 shadow-sm">
                            <img src={p.blobUrl} alt="Uploading…" className="w-full h-full object-cover opacity-50" />
                            <div className="absolute inset-0 flex items-center justify-center"><div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /></div>
                          </div>
                        ))}
                        {(proofsData?.hasMore || proofItems.length > 3) && (
                          <button onClick={() => setLocation(`/will/${willId}`)} className="w-14 h-14 rounded-[10px] flex-shrink-0 border-2 border-dashed border-gray-200 flex flex-col items-center justify-center gap-0.5 hover:border-violet-300 transition-colors" data-testid="button-proof-more">
                            <Plus className="w-3.5 h-3.5 text-gray-400" />
                            <span className="text-[10px] text-gray-400 font-medium">{proofItems.length - 3}+ more</span>
                          </button>
                        )}
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          )}

          {/* View full details link */}
          <div className="mt-4 text-center">
            <button onClick={() => setLocation(`/will/${willId}`)} className="inline-flex items-center gap-1.5 text-violet-600 hover:text-violet-700 text-xs font-medium transition-colors" data-testid="button-view-will-details">
              <Calendar className="w-3.5 h-3.5" />
              Full Details & History
            </button>
          </div>

        </div>
      </div>
    </div>
  );
}
