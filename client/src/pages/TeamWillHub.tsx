import { useState, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
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
import DailyCheckInModal from "@/components/DailyCheckInModal";
import { Capacitor } from "@capacitor/core";
import {
  ChevronLeft, ChevronRight, Camera, Plus, Clock, CheckCircle, X,
  Pause, Play, Power, AlertTriangle, ImageIcon,
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

interface TeamWillHubProps {
  willId: number;
}

export default function TeamWillHub({ willId }: TeamWillHubProps) {
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
  const [showFullProgress, setShowFullProgress] = useState(false);
  const [showProofPicker, setShowProofPicker] = useState(false);
  const [showCheckInModal, setShowCheckInModal] = useState(false);

  useAppRefresh();

  const { data: will, isLoading } = useQuery<Will & {
    commitments?: any[];
    pendingInviteCount?: number;
    creatorName?: string;
    willType?: string;
    isIndefinite?: boolean;
    activeDays?: string;
    customDays?: string;
    sharedWhat?: string | null;
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
    enabled: !!user && (will?.status === "active" || will?.status === "will_review"),
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

  // Normalise any image (including HEIC from iOS photo library) to a JPEG Blob
  // capped at 1200px on the longest side, quality 0.8.
  const normalizeToJpeg = (file: File): Promise<File> =>
    new Promise((resolve, reject) => {
      const url = URL.createObjectURL(file);
      const img = new Image();
      img.onload = () => {
        URL.revokeObjectURL(url);
        const MAX = 1200;
        let { width, height } = img;
        if (width > MAX || height > MAX) {
          if (width >= height) { height = Math.round((height * MAX) / width); width = MAX; }
          else { width = Math.round((width * MAX) / height); height = MAX; }
        }
        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext("2d");
        if (!ctx) { reject(new Error("Canvas not available")); return; }
        ctx.drawImage(img, 0, 0, width, height);
        canvas.toBlob(
          (blob) => {
            if (!blob) { reject(new Error("Image conversion failed")); return; }
            resolve(new File([blob], "proof.jpg", { type: "image/jpeg" }));
          },
          "image/jpeg",
          0.8,
        );
      };
      img.onerror = () => { URL.revokeObjectURL(url); reject(new Error("Could not load image")); };
      img.src = url;
    });

  // Capacitor-native camera / photo-library capture.
  // KEY FIX: request ONLY the permission relevant to the source — requesting
  // camera permission when the user chose "library" triggers AVCaptureSession
  // access internally, which crashes if NSCameraUsageDescription is absent
  // from the compiled binary (stale build) or was previously denied.
  const handleCapacitorCapture = async (source: "camera" | "library") => {
    setShowProofPicker(false);

    // Platform guard — should never be called on web, but belt-and-suspenders
    if (!Capacitor.isNativePlatform()) return;

    try {
      const { Camera, CameraResultType, CameraSource } = await import("@capacitor/camera");

      // Request ONLY the permission we need for this specific source.
      // Requesting both simultaneously is the primary crash trigger:
      // - "library" path must NEVER touch AVCaptureSession (camera hardware)
      // - "camera" path must NEVER request PHPhotoLibrary access unnecessarily
      const permissionNeeded = source === "camera" ? "camera" : "photos";
      console.log(`[ProofDrop] Requesting permission: ${permissionNeeded}`);

      const perms = await Camera.requestPermissions({ permissions: [permissionNeeded] });
      console.log(`[ProofDrop] Permission status:`, JSON.stringify(perms));

      // "limited" counts as granted — iOS 14+ users may grant limited photo access
      const status = source === "camera" ? perms.camera : perms.photos;
      const granted = status === "granted" || status === "limited";

      if (!granted) {
        console.warn(`[ProofDrop] Permission denied for ${permissionNeeded}: ${status}`);
        toast({
          title: "Permission required",
          description: `Please allow ${source === "camera" ? "camera" : "photo library"} access in iOS Settings > WILL.`,
          variant: "destructive",
        });
        return;
      }

      console.log(`[ProofDrop] Permission granted — opening ${source}`);
      const photo = await Camera.getPhoto({
        resultType: CameraResultType.Base64,
        source: source === "camera" ? CameraSource.Camera : CameraSource.Photos,
        quality: 70,      // Reduced from 80 — prevents memory crash on large library images
        width: 1200,      // Cap resolution — large photos can OOM-kill on main thread
        correctOrientation: true,
        allowEditing: false,
      });

      if (!photo.base64String) throw new Error("No image data returned from camera.");
      console.log(`[ProofDrop] Captured — format: ${photo.format}, base64 length: ${photo.base64String.length}`);

      // Convert base64 → Blob → File and hand off to the existing upload pipeline
      const byteStr = atob(photo.base64String);
      const ab = new ArrayBuffer(byteStr.length);
      const ia = new Uint8Array(ab);
      for (let i = 0; i < byteStr.length; i++) ia[i] = byteStr.charCodeAt(i);
      const blob = new Blob([ab], { type: "image/jpeg" });
      const file = new File([blob], "proof.jpg", { type: "image/jpeg" });
      await handleDropPhoto(file);
    } catch (err: any) {
      // "User cancelled photos app" is not a real error — swallow silently
      const msg = err?.message?.toLowerCase() ?? "";
      console.error("[ProofDrop] Capture error:", JSON.stringify(err));
      if (!msg.includes("cancel") && !msg.includes("dismiss")) {
        toast({ title: "Camera error", description: err?.message || "Could not open camera.", variant: "destructive" });
      }
    }
  };

  // Opens the correct picker depending on platform:
  // - Native iOS: Capacitor camera plugin (safe permission flow)
  // - Web: native file input (browser handles permissions)
  const openPhotoPicker = () => {
    if (Capacitor.isNativePlatform()) {
      setShowProofPicker(true);
    } else {
      fileInputRef.current?.click();
    }
  };

  const handleDropPhoto = async (file: File) => {
    if (isUploading) return;
    const tempId = `tmp-${Date.now()}`;
    // Use original file for the local preview thumbnail; convert for upload
    const blobUrl = URL.createObjectURL(file);
    setPendingProofs(prev => [...prev, { tempId, blobUrl }]);
    setIsUploading(true);
    let proofId: number | null = null;
    try {
      // Normalise to JPEG before upload — handles HEIC/HEIF from iOS photo library
      // and compresses large library photos (often 4–8 MB) down to a consistent size.
      let uploadFile: File;
      try {
        uploadFile = await normalizeToJpeg(file);
        console.log("[ProofDrop] normalised:", file.type, file.size, "→ image/jpeg", uploadFile.size);
      } catch (convErr) {
        console.warn("[ProofDrop] normalisation failed, using raw file:", convErr);
        uploadFile = file;
      }
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
      formData.append("file", uploadFile);
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
      const createRes = await fetch(getApiPath(`/api/wills/${willId}/proofs`), {
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

  const hasCustomTitle = !!(will as any)?.title?.trim();
  const endDateStr = will?.endDate as unknown as string | null;
  const daysLeft = !(will as any)?.isIndefinite && endDateStr
    ? Math.max(0, Math.ceil((new Date(endDateStr).getTime() - Date.now()) / 86400000))
    : null;

  const statusConfig: Record<string, { label: string; bg: string; text: string }> = {
    pending:    { label: "Pending",   bg: "bg-amber-100",   text: "text-amber-700" },
    scheduled:  { label: "Scheduled", bg: "bg-blue-100",    text: "text-blue-700" },
    active:     { label: "Active",    bg: "bg-emerald-100", text: "text-emerald-700" },
    paused:     { label: "Paused",    bg: "bg-orange-100",  text: "text-orange-700" },
    will_review:{ label: "In review", bg: "bg-purple-100",  text: "text-purple-700" },
    completed:  { label: "Completed", bg: "bg-emerald-100", text: "text-emerald-700" },
    terminated: { label: "Ended",     bg: "bg-gray-100",    text: "text-gray-600" },
  };
  const statusInfo = will ? (statusConfig[will.status] || statusConfig.terminated) : statusConfig.terminated;

  // Avatar dot color per state
  const avatarDotColors: Record<string, string> = {
    pending:    "bg-amber-400",
    scheduled:  "bg-blue-400",
    active:     "bg-green-400",
    paused:     "bg-orange-400",
    will_review:"bg-purple-400",
    completed:  "bg-emerald-400",
    terminated: "bg-gray-400",
  };
  const avatarDotColor = will ? (avatarDotColors[will.status] || "bg-gray-400") : "bg-gray-400";

  // Which cards are locked
  const isProgressLocked = will?.status === "pending" || will?.status === "scheduled";
  const isProofLocked = will?.status !== "active" && will?.status !== "will_review";
  const proofLockMessage =
    will?.status === "pending" || will?.status === "scheduled" ? "Available once Will starts" :
    will?.status === "paused" ? "Resume Will to add drops" :
    "Will has ended";

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

      {/* Web-only hidden file input — used on non-native platforms as fallback */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/jpeg,image/png,image/gif,image/webp"
        className="hidden"
        onChange={(e) => { const f = e.target.files?.[0]; if (f) handleDropPhoto(f); }}
      />

      {/* Native iOS proof-drop picker bottom sheet */}
      {showProofPicker && (
        <div
          className="fixed inset-0 z-50 flex items-end"
          style={{ backgroundColor: "rgba(0,0,0,0.4)" }}
          onClick={() => setShowProofPicker(false)}
        >
          <div
            className="w-full bg-white rounded-t-2xl pb-10 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            {/* drag handle */}
            <div className="w-10 h-1 bg-gray-200 rounded-full mx-auto mt-3 mb-4" />
            <p className="text-center text-sm font-semibold text-gray-800 mb-4 px-6">Add Proof Drop</p>

            <button
              onClick={() => handleCapacitorCapture("camera")}
              className="w-full flex items-center gap-4 px-6 py-4 active:bg-gray-50 transition-colors"
              data-testid="button-proof-camera"
            >
              <span className="w-10 h-10 rounded-xl bg-emerald-50 flex items-center justify-center flex-shrink-0">
                <Camera className="w-5 h-5 text-emerald-600" />
              </span>
              <div className="text-left">
                <p className="text-sm font-semibold text-gray-900">Take Photo</p>
                <p className="text-xs text-gray-400">Open camera now</p>
              </div>
            </button>

            <button
              onClick={() => handleCapacitorCapture("library")}
              className="w-full flex items-center gap-4 px-6 py-4 active:bg-gray-50 transition-colors"
              data-testid="button-proof-library"
            >
              <span className="w-10 h-10 rounded-xl bg-blue-50 flex items-center justify-center flex-shrink-0">
                <ImageIcon className="w-5 h-5 text-blue-500" />
              </span>
              <div className="text-left">
                <p className="text-sm font-semibold text-gray-900">Choose from Library</p>
                <p className="text-xs text-gray-400">Pick an existing photo</p>
              </div>
            </button>

            <div className="mx-5 mt-2">
              <button
                onClick={() => setShowProofPicker(false)}
                className="w-full py-3.5 rounded-2xl bg-gray-100 text-sm font-semibold text-gray-700 active:bg-gray-200 transition-colors"
                data-testid="button-proof-picker-cancel"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="pt-[calc(env(safe-area-inset-top)+4rem)] pb-[calc(env(safe-area-inset-bottom)+1rem)] min-h-screen">
        <div className="max-w-sm mx-auto px-5">

          {/* Nav — 3-column grid so title is always centred */}
          <div className="grid items-center gap-2 mb-2" style={{ gridTemplateColumns: "40px 1fr auto" }}>
            {/* Back */}
            <button
              onClick={() => setLocation(backUrl)}
              className="w-10 h-10 flex items-center justify-center"
              data-testid="button-back-home"
            >
              <span className="w-8 h-8 flex items-center justify-center rounded-lg bg-gray-100 border border-gray-200 text-gray-700 hover:bg-gray-200 transition-all duration-200 active:scale-95">
                <ChevronLeft className="w-5 h-5" strokeWidth={2.5} />
              </span>
            </button>

            {/* Title */}
            <div className="text-center overflow-hidden">
              <h1 className="text-base font-semibold text-gray-900 leading-tight">
                {hasCustomTitle ? (will as any).title : "Will"}
              </h1>
            </div>

            {/* Action icons */}
            <div className="flex items-center gap-1.5">
              {/* Chat / messages */}
              <button
                onClick={() => {
                  sessionStorage.setItem("willBackUrl", `/will/${willId}`);
                  setLocation(`/will/${willId}/messages`);
                }}
                className="w-9 h-9 flex items-center justify-center rounded-xl text-white transition-all active:scale-95"
                style={{ backgroundColor: "#2D9D78" }}
                data-testid="button-open-messages"
                aria-label="Messages"
              >
                <svg viewBox="0 0 24 24" className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
                </svg>
              </button>

              {/* Manage / settings */}
              {canManage && (will.status === "active" || will.status === "paused" || will.status === "scheduled") && (
                <button
                  onClick={() => setShowManageModal(true)}
                  className="w-9 h-9 flex items-center justify-center rounded-xl text-white transition-all active:scale-95"
                  style={{ backgroundColor: "#2D9D78" }}
                  data-testid="button-manage-will"
                  aria-label="Manage Will"
                >
                  <svg viewBox="0 0 24 24" className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="12" cy="12" r="3" />
                    <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
                  </svg>
                </button>
              )}
            </div>
          </div>

          {/* Badge row — status only */}
          <div className="flex justify-center items-center mb-4">
            <span className={`px-2.5 py-0.5 rounded-full text-xs font-medium ${statusInfo.bg} ${statusInfo.text}`}>
              {statusInfo.label}
            </span>
          </div>

          {/* ── State banner ─────────────────────────────────────── */}
          {will.status === "pending" && (
            <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 mb-3 flex items-start gap-3">
              <div className="w-8 h-8 rounded-full bg-amber-100 flex items-center justify-center flex-shrink-0 mt-0.5">
                <Clock className="w-4 h-4 text-amber-600" />
              </div>
              <div>
                <p className="text-sm font-semibold text-amber-800">Waiting for friends to accept</p>
                <p className="text-xs text-amber-600 mt-0.5 leading-snug">Will activates at start date if at least one friend joins.</p>
              </div>
            </div>
          )}

          {will.status === "scheduled" && (
            <div className="bg-blue-50 border border-blue-200 rounded-2xl p-4 mb-3 flex items-start gap-3">
              <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center flex-shrink-0 mt-0.5">
                <Clock className="w-4 h-4 text-blue-600" />
              </div>
              <div>
                <p className="text-sm font-bold text-blue-700">Starts in {formatTimeUntilStart(will.startDate as unknown as string)}</p>
                <p className="text-xs text-blue-500 mt-0.5">{formatDisplayDateTime(will.startDate as unknown as string)} — get ready</p>
              </div>
            </div>
          )}

          {will.status === "paused" && (
            <div className="bg-orange-50 border border-orange-200 rounded-2xl p-4 mb-3 flex items-center gap-3">
              <div className="w-8 h-8 rounded-full bg-orange-100 flex items-center justify-center flex-shrink-0">
                <Pause className="w-4 h-4 text-orange-600" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-orange-800">Will paused</p>
                <p className="text-xs text-orange-600 mt-0.5">Resume to continue tracking</p>
              </div>
              {canManage && (
                <button
                  onClick={() => resumeMutation.mutate()}
                  disabled={resumeMutation.isPending}
                  className="flex items-center gap-1.5 bg-orange-500 hover:bg-orange-600 text-white text-xs font-semibold px-3 py-1.5 rounded-full transition-colors disabled:opacity-50 flex-shrink-0"
                  data-testid="button-resume-inline"
                >
                  <Play className="w-3 h-3" />
                  {resumeMutation.isPending ? "Resuming…" : "Resume"}
                </button>
              )}
            </div>
          )}

          {will.status === "will_review" && (
            <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 mb-3">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-8 h-8 rounded-full bg-amber-100 flex items-center justify-center flex-shrink-0">
                  <svg viewBox="0 0 24 24" className="w-4 h-4 text-amber-600" fill="currentColor">
                    <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/>
                  </svg>
                </div>
                <div>
                  <p className="text-sm font-semibold text-amber-900">Will ended — how'd it go?</p>
                  <p className="text-xs text-amber-600 mt-0.5">Submit your final check-in</p>
                </div>
              </div>
              {userCommitment && (
                reviewStatus?.hasReviewed ? (
                  <div className="bg-white border border-purple-200 rounded-xl p-4 text-center">
                    <CheckCircle className="w-8 h-8 text-purple-500 mx-auto mb-2" />
                    <p className="text-sm font-semibold text-gray-900">Review submitted</p>
                    {reviewStatus.reviewCount < reviewStatus.totalMembers ? (
                      <p className="text-xs text-gray-500 mt-1">Waiting for others… {reviewStatus.reviewCount}/{reviewStatus.totalMembers} reviewed</p>
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
                    checkInType={userCheckInType === "daily" || userCheckInType === "specific_days" ? "daily" : "one-time"}
                    startDate={will.startDate}
                    endDate={will.endDate ?? undefined}
                    onComplete={() => {
                      queryClient.invalidateQueries({ queryKey: [`/api/wills/${willId}/details`] });
                      queryClient.invalidateQueries({ queryKey: [`/api/wills/${willId}/review-status`] });
                    }}
                  />
                )
              )}
            </div>
          )}

          {will.status === "completed" && (
            <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-4 mb-3 flex items-center gap-3">
              <div className="w-8 h-8 rounded-full bg-emerald-100 flex items-center justify-center flex-shrink-0">
                <CheckCircle className="w-4 h-4 text-emerald-600" />
              </div>
              <div>
                <p className="text-sm font-semibold text-emerald-800">Will completed</p>
                <p className="text-xs text-emerald-600 mt-0.5">Great work — this Will is done</p>
              </div>
            </div>
          )}

          {will.status === "terminated" && (
            <div className="bg-gray-50 border border-gray-200 rounded-2xl p-4 mb-3 flex items-center gap-3">
              <div className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center flex-shrink-0">
                <Power className="w-4 h-4 text-gray-500" />
              </div>
              <div>
                <p className="text-sm font-semibold text-gray-700">Will ended</p>
                <p className="text-xs text-gray-500 mt-0.5">This Will was terminated early</p>
              </div>
            </div>
          )}

          {/* ── Team card ─────────────────────────────────────────── */}
          <div className="bg-white border border-gray-100 rounded-2xl p-4 mb-3 shadow-sm">
            <div className="flex items-center justify-between mb-3">
              <p className="text-[15px] font-semibold" style={{ color: "#1C1C1E" }}>Team</p>
              {isCreator && pendingInvites.length > 0 && (
                <span className="text-[11px] font-medium text-amber-600 bg-amber-50 px-2 py-0.5 rounded-full" data-testid="badge-pending-invites">
                  {pendingInvites.length} pending
                </span>
              )}
            </div>
            {isWeWill && will.sharedWhat && (
              <div className="mb-3 px-3 py-2 rounded-xl" style={{ backgroundColor: "#F3EAFE" }}>
                <p className="text-xs text-purple-700 text-center leading-snug italic">"{will.sharedWhat}"</p>
              </div>
            )}
            {commitments.length === 0 ? (
              <p className="text-xs text-gray-400 italic text-center py-2">
                No commitments yet — waiting for friends to accept
              </p>
            ) : (
              <div className={`grid gap-3 ${commitments.length === 1 ? "grid-cols-1 max-w-[140px] mx-auto" : "grid-cols-2"}`}>
                {commitments.map((c: any) => (
                  <div
                    key={c.id}
                    className="flex flex-col items-center p-3 bg-gray-50 rounded-xl"
                    data-testid={`participant-${c.userId}`}
                  >
                    <div className="relative mb-2">
                      <div
                        className="w-10 h-10 bg-gradient-to-br from-violet-500 to-purple-500 rounded-full flex items-center justify-center"
                        style={{ border: "3px solid #fff", boxShadow: "0 0 0 2px #9B5CE5" }}
                      >
                        <span className="text-white font-semibold text-sm">
                          {(c.user?.firstName || c.user?.email)?.charAt(0).toUpperCase()}
                        </span>
                      </div>
                      <div className={`absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 ${avatarDotColor} rounded-full border-2 border-white`} />
                    </div>
                    <p className="font-medium text-gray-900 text-xs text-center leading-tight">
                      {c.user?.firstName || c.user?.email?.split("@")[0]}
                    </p>
                    {!isWeWill && c.what && (
                      <p className="text-[10px] text-gray-500 mt-1 text-center leading-snug">
                        {c.what}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* ── Progress card — always shown ──────────────────────── */}
          <div className={`bg-white border border-gray-100 rounded-2xl p-4 mb-3 shadow-sm${isProgressLocked ? " opacity-50 pointer-events-none select-none" : ""}`}>
            {isProgressLocked ? (
              /* Locked state */
              <>
                <div className="flex items-center justify-between mb-3">
                  <p className="text-[15px] font-semibold" style={{ color: "#1C1C1E" }}>Progress</p>
                  <svg viewBox="0 0 24 24" className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                    <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                  </svg>
                </div>
                <p className="text-xs text-gray-400 text-center py-2">Available once Will starts</p>
              </>
            ) : (
              /* Unlocked state */
              <>
                <button
                  onClick={() => hasDailyCheckIns && setShowFullProgress(p => !p)}
                  className="w-full flex items-center justify-between mb-3"
                  data-testid="button-toggle-progress"
                >
                  <p className="text-[15px] font-semibold" style={{ color: "#1C1C1E" }}>Progress</p>
                  {hasDailyCheckIns && (
                    <ChevronRight
                      className={`w-4 h-4 text-gray-400 transition-transform duration-200 ${!isWeWill && showFullProgress ? "rotate-90" : ""}`}
                    />
                  )}
                </button>
                <div className="grid grid-cols-3 gap-3 text-center">
                  <div>
                    <p className="text-xl font-bold text-emerald-500">
                      {checkInProgress?.streak ?? 0}
                    </p>
                    <p className="text-[10px] text-gray-400 mt-0.5">day streak</p>
                  </div>
                  <div>
                    <p className={`text-xl font-bold ${will.status === "will_review" ? "text-amber-500" : "text-gray-700"}`}>
                      {will.status === "completed" || will.status === "terminated"
                        ? (checkInProgress?.checkedInDays ?? 0)
                        : will.status === "will_review"
                        ? 0
                        : daysLeft !== null ? daysLeft : "∞"}
                    </p>
                    <p className="text-[10px] text-gray-400 mt-0.5">
                      {will.status === "will_review" || will.status === "completed" || will.status === "terminated" ? "completed" : "days left"}
                    </p>
                  </div>
                  <div>
                    <p className="text-xl font-bold text-gray-700">
                      {`${checkInProgress?.successRate ?? 0}%`}
                    </p>
                    <p className="text-[10px] text-gray-400 mt-0.5">
                      {will.status === "will_review" || will.status === "completed" || will.status === "terminated" ? "completed" : "on track"}
                    </p>
                  </div>
                </div>
                {/* Daily Check-in button — I Will only, inside Progress card */}
                {!isWeWill && hasDailyCheckIns && will.status === "active" && (
                  <button
                    onClick={() => setShowCheckInModal(true)}
                    className="w-full mt-3 py-4 rounded-2xl text-white font-semibold text-sm flex items-center justify-center gap-2 transition-all active:scale-[0.98]"
                    style={{ background: "linear-gradient(135deg, #2D9D78, #1e8a68)" }}
                    data-testid="button-daily-check-in"
                  >
                    <svg viewBox="0 0 24 24" className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="20 6 9 17 4 12" />
                    </svg>
                    Daily Check-in
                  </button>
                )}
                {showFullProgress && hasDailyCheckIns && (
                  <div className="mt-3 pt-3 border-t border-gray-100">
                    <ProgressView
                      willId={willId}
                      startDate={will.startDate as unknown as string}
                      endDate={will.endDate as unknown as string | null}
                      checkInType={userCheckInType}
                      activeDays={will.activeDays || undefined}
                      customDays={will.customDays || undefined}
                    />
                  </div>
                )}
                {/* Auto-show calendar for completed/terminated */}
                {!showFullProgress && hasDailyCheckIns && (will.status === "completed" || will.status === "terminated") && (
                  <div className="mt-3 pt-3 border-t border-gray-100">
                    <ProgressView
                      willId={willId}
                      startDate={will.startDate as unknown as string}
                      endDate={will.endDate as unknown as string | null}
                      checkInType={userCheckInType}
                      activeDays={will.activeDays || undefined}
                      customDays={will.customDays || undefined}
                    />
                  </div>
                )}
              </>
            )}
          </div>

          {/* ── Proof card — always shown ──────────────────────────── */}
          <div className={`bg-white border border-gray-100 rounded-2xl p-4 mb-3 shadow-sm${isProofLocked ? " opacity-50 pointer-events-none select-none" : ""}`}>
            {isProofLocked ? (
              /* Locked state */
              <>
                <div className="flex items-center justify-between mb-3">
                  <p className="text-[15px] font-semibold" style={{ color: "#1C1C1E" }}>Proof</p>
                  <svg viewBox="0 0 24 24" className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                    <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                  </svg>
                </div>
                <p className="text-xs text-gray-400 text-center py-2">{proofLockMessage}</p>
              </>
            ) : (
              /* Unlocked state (active only) */
              <>
                <div className="flex items-center justify-between mb-3">
                  <p className="text-[15px] font-semibold" style={{ color: "#1C1C1E" }}>Proof</p>
                  <button
                    onClick={openPhotoPicker}
                    disabled={isUploading}
                    className="flex items-center gap-1.5 bg-emerald-500 hover:bg-emerald-600 text-white disabled:opacity-50 text-xs font-semibold px-3 py-1.5 rounded-full transition-colors"
                    data-testid="button-add-drop"
                  >
                    <Plus className="w-3 h-3" />
                    Drop
                  </button>
                </div>
                {proofItems.length === 0 && pendingProofs.length === 0 ? (
                  <button
                    onClick={openPhotoPicker}
                    disabled={isUploading}
                    className="w-full border border-dashed border-gray-200 rounded-xl py-5 flex flex-col items-center gap-2 text-gray-400 hover:border-emerald-400 hover:text-emerald-500 hover:bg-emerald-50/30 transition-colors disabled:pointer-events-none"
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
              </>
            )}
          </div>

        </div>
      </div>

      {/* Daily Check-in Modal — I Will with daily tracking */}
      {hasDailyCheckIns && (
        <DailyCheckInModal
          isOpen={showCheckInModal}
          onClose={() => setShowCheckInModal(false)}
          willId={willId}
          startDate={will.startDate as unknown as string || ''}
          endDate={will.endDate as unknown as string || ''}
          checkInType={userCheckInType}
          activeDays={(userCommitment as any)?.activeDays || will.activeDays || undefined}
          customDays={(userCommitment as any)?.customDays || will.customDays || undefined}
        />
      )}
    </div>
  );
}
