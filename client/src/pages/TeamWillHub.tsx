import { useState, useRef, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { getApiPath } from "@/config/api";
import { sessionPersistence } from "@/services/SessionPersistence";
import { useAppRefresh } from "@/hooks/useAppRefresh";
import { formatDisplayDateTime } from "@/lib/dateUtils";
import ProgressView from "@/components/ProgressView";
import { WillReviewFlow } from "@/components/WillReviewFlow";
import { OngoingWillReviewFlow } from "@/components/OngoingWillReviewFlow";
import DailyCheckInModal from "@/components/DailyCheckInModal";
import { Capacitor } from "@capacitor/core";
import {
  ChevronLeft, ChevronRight, ChevronDown, Camera, Plus, Clock, CheckCircle, XCircle, X, Check,
  Pause, Play, Power, AlertTriangle, ImageIcon, MinusCircle, Zap, Bell, Trash2,
} from "lucide-react";
import type { Will, AbstainLog, WillCheckIn } from "@shared/schema";

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
  const [checkInDate, setCheckInDate] = useState<string | null>(null);
  const handleDayClick = (date: string) => { setCheckInDate(date); setShowCheckInModal(true); };
  const [abstainCheckInOpen, setAbstainCheckInOpen] = useState(false);
  const [abstainJustLoggedHonored, setAbstainJustLoggedHonored] = useState<boolean | null>(null);
  const [abstainProgressExpanded, setAbstainProgressExpanded] = useState(false);
  const [missionCheckInOpen, setMissionCheckInOpen] = useState(false);
  const [missionKeptGoing, setMissionKeptGoing] = useState(false);
  const [missionConfirming, setMissionConfirming] = useState(false);
  // missionCompleted is derived from server data (persists across sessions)

  // Ping modal state
  const [pingTarget, setPingTarget] = useState<{ id: number; invitedUserId: string; firstName: string } | null>(null);
  const [pingSent, setPingSent] = useState(false);

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
    commitmentCategory?: string | null;
    streakStartDate?: string | null;
    endDate?: string | null;
  }>({
    queryKey: [`/api/wills/${willId}/details`],
    refetchInterval: 30000,
    staleTime: 0,
    enabled: !!user,
  });

  const { data: invitesData } = useQuery<Array<{ id: number; status: string; invitedUserId: string; firstName?: string; lastName?: string; hasCommitted?: boolean }>>({
    queryKey: [`/api/wills/${willId}/invites`],
    enabled: !!user && will?.createdBy === user?.id,
    refetchInterval: 60000,
  });

  // Invitees who tapped Accept but never finished setting their commitment.
  // Shown to the creator as a separate "awaiting commitment" group so they
  // are visually distinct from real members and Team Today is not polluted
  // with ghost participants.
  const awaitingCommitInvitees = (invitesData || []).filter(
    inv => inv.status === 'accepted' && !inv.hasCommitted
  );

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

  const { data: checkIns = [] } = useQuery<WillCheckIn[]>({
    queryKey: [`/api/wills/${willId}/check-ins`],
    enabled: !!user && (will?.commitmentCategory === 'recurring' || !will?.commitmentCategory) && hasDailyCheckIns,
    staleTime: 0,
  });

  // Team check-in status badges — poll every 30s
  const todayStr = new Date().toLocaleDateString('en-CA'); // YYYY-MM-DD local
  const { data: teamCheckIns = [] } = useQuery<{ userId: string; status: string | null }[]>({
    queryKey: [`/api/wills/${willId}/team-checkins`, todayStr],
    queryFn: async () => {
      const token = await sessionPersistence.getToken();
      const headers: Record<string, string> = { "Content-Type": "application/json" };
      if (token) headers["Authorization"] = `Bearer ${token}`;
      const resp = await fetch(getApiPath(`/api/wills/${willId}/team-checkins?date=${todayStr}`), {
        credentials: "include",
        headers,
      });
      if (!resp.ok) throw new Error("Failed to fetch team check-ins");
      return resp.json();
    },
    enabled: !!user && !!will && will.mode === 'team',
    refetchInterval: 30000,
    staleTime: 0,
  });
  const teamCheckInMap = Object.fromEntries(teamCheckIns.map((t) => [t.userId, t.status]));

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

  // Team today — per-member check-in status (only for team/circle wills with a category)
  const willMode = will?.mode;
  const willCategory = will?.commitmentCategory;
  const { data: teamTodayData } = useQuery<{
    category: string | null;
    today: string;
    members: { userId: string; firstName: string; profileImageUrl: string | null; status: string }[];
  }>({
    queryKey: [`/api/wills/${willId}/team-today`],
    enabled: !!user && !!will && willMode === 'team' && !!willCategory && (will.status === 'active' || will.status === 'will_review'),
    refetchInterval: 30000,
    staleTime: 0,
  });

  // Category-aware: abstain log query
  const { data: abstainLogEntries = [] } = useQuery<AbstainLog[]>({
    queryKey: [`/api/wills/${willId}/abstain-log`],
    enabled: !!user && will?.commitmentCategory === 'duration',
    staleTime: 0,
  });

  // Category-aware: abstain log mutation
  const abstainLogMutation = useMutation({
    mutationFn: async ({ honored }: { honored: boolean }) => {
      const res = await apiRequest(`/api/wills/${willId}/abstain-log`, {
        method: 'POST',
        body: JSON.stringify({ honored }),
      });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/wills/${willId}/abstain-log`] });
      queryClient.invalidateQueries({ queryKey: [`/api/wills/${willId}/details`] });
    },
    onError: (err: any) => {
      toast({ title: "Error", description: err.message || "Failed to log entry", variant: "destructive" });
    },
  });

  // Category-aware: mission complete mutation (team: per-member endpoint, no creator guard)
  const missionCompleteMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest(`/api/wills/${willId}/mission-complete`, {
        method: 'POST',
      });
      return res.json();
    },
    onSuccess: () => {
      setMissionCheckInOpen(false);
      queryClient.invalidateQueries({ queryKey: [`/api/wills/${willId}/details`] });
      queryClient.invalidateQueries({ queryKey: ["/api/wills/all-active"] });
    },
    onError: (err: any) => toast({ title: "Error", description: err.message || "Failed to complete Will", variant: "destructive" }),
  });

  // missionCompleted from server (persists across navigations)
  const missionCompleted = userCommitment?.missionCompleted === true;

  // Recurring: direct check-in mutation (bypasses modal)
  const recurringCheckInMutation = useMutation({
    mutationFn: async ({ status }: { status: 'yes' | 'no' }) => {
      const res = await apiRequest(`/api/wills/${willId}/check-ins`, {
        method: 'POST',
        body: JSON.stringify({ date: todayLocalDate, status }),
      });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/wills/${willId}/check-ins`] });
      queryClient.invalidateQueries({ queryKey: [`/api/wills/${willId}/check-in-progress`] });
    },
    onError: (err: any) => {
      toast({ title: "Error", description: err.message || "Failed to log check-in", variant: "destructive" });
    },
  });

  const pingInviteeMutation = useMutation({
    mutationFn: async ({ inviteId }: { inviteId: number }) => {
      const res = await apiRequest(`/api/wills/${willId}/invites/${inviteId}/ping`, { method: 'POST' });
      return res.json();
    },
    onSuccess: () => {
      setPingSent(true);
    },
    onError: () => {
      toast({ title: "Failed to send ping", variant: "destructive" });
    },
  });

  const removeInviteeMutation = useMutation({
    mutationFn: async ({ inviteId }: { inviteId: number }) => {
      const res = await apiRequest(`/api/wills/${willId}/invites/${inviteId}`, { method: 'DELETE' });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/wills/${willId}/invites`] });
      setPingTarget(null);
      setPingSent(false);
      toast({ title: "Member removed" });
    },
    onError: () => {
      toast({ title: "Failed to remove member", variant: "destructive" });
    },
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
  //
  // CRASH DIAGNOSIS (both camera + library crashing immediately on tap):
  //
  // Issue 1 — UIViewController presentation race:
  //   setShowProofPicker(false) begins unmounting the bottom sheet DOM while iOS
  //   simultaneously tries to present the system permission dialog from
  //   bridge?.viewController. On iOS 17/18, presenting a UIViewController during
  //   an active layout pass is fatal (unrecoverable exception, not caught by JS).
  //   FIX: wait 400 ms for the sheet to fully dismiss before ANY native call.
  //
  // Issue 2 — Calling requestPermissions() when permission is already set:
  //   requestPermissions() presents the system dialog. If the permission was
  //   already granted/denied, this call is wasteful AND causes the bridge to
  //   present a UIViewController unnecessarily during the transition window.
  //   FIX: use checkPermissions() first (a pure read, no UI); only call
  //   requestPermissions() when status is "prompt" (never been asked before).
  //
  // Issue 3 — Capacitor Camera v7 showPhotos() bug with .limited access:
  //   The native showPhotos() uses the deprecated PHPhotoLibrary.authorizationStatus()
  //   which returns .limited on iOS 14+, but the function only proceeds for
  //   .authorized. For .limited users, getPhoto(Photos) always rejects with
  //   "User denied access to photos". No JS-side workaround is possible.
  //   FIX: detect "limited" status before calling getPhoto and tell the user
  //   to grant full access in Settings instead of crashing/silent failure.
  const handleCapacitorCapture = async (source: "camera" | "library") => {
    setShowProofPicker(false);

    // Platform guard — should never be called on web, but belt-and-suspenders
    if (!Capacitor.isNativePlatform()) return;

    // ─── CRITICAL: let the bottom sheet finish dismissing ───────────────────
    // Presenting a native UIViewController while the WKWebView is mid-layout
    // triggers an unrecoverable iOS exception. 400 ms > longest sheet animation.
    await new Promise(resolve => setTimeout(resolve, 400));

    try {
      const { Camera, CameraResultType, CameraSource } = await import("@capacitor/camera");

      // Step 1: check current permission status (pure read — no system dialog,
      // no UIViewController, no timing hazard).
      const currentPerms = await Camera.checkPermissions();
      const currentStatus = source === "camera" ? currentPerms.camera : currentPerms.photos;
      console.log(`[ProofDrop] checkPermissions for ${source}:`, currentStatus);

      if (currentStatus === "denied" || currentStatus === "restricted") {
        // Permission was previously denied — direct user to Settings
        toast({
          title: "Permission required",
          description: `Please allow ${source === "camera" ? "camera" : "photo library"} access in Settings → WILL.`,
          variant: "destructive",
        });
        return;
      }

      if (source === "library" && currentStatus === "limited") {
        // Capacitor Camera v7 showPhotos() bug: the native code uses the deprecated
        // PHPhotoLibrary.authorizationStatus() which only accepts .authorized,
        // causing getPhoto(Photos) to always reject for limited-access users.
        // Until this is fixed upstream, prompt users to grant full access.
        toast({
          title: "Full photo access required",
          description: "Please go to Settings → WILL → Photos and select 'All Photos'.",
          variant: "destructive",
        });
        return;
      }

      // Step 2: if status is "prompt" (first time), let getPhoto() trigger the
      // system permission dialog internally. Calling requestPermissions() manually
      // before getPhoto() causes iOS to crash when the plist key lookup fires
      // during an active WKWebView layout pass. getPhoto() defers the dialog to
      // a stable UIViewController presentation window — no crash.
      console.log(`[ProofDrop] Status is ${currentStatus} — proceeding to getPhoto`);

      // Step 3: open the camera or photo library (handles permission prompt for
      // "prompt" status automatically on first launch).
      console.log(`[ProofDrop] Opening ${source}`);
      const photo = await Camera.getPhoto({
        resultType: CameraResultType.Base64,
        source: source === "camera" ? CameraSource.Camera : CameraSource.Photos,
        quality: 70,
        width: 1200,
        correctOrientation: true,
        allowEditing: false,
        saveToGallery: false,
      });

      if (!photo.base64String) throw new Error("No image data returned from camera.");
      console.log(`[ProofDrop] Captured — format: ${photo.format}, size: ${photo.base64String.length}`);

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
  const isWeWill = will.willType === "cumulative";
  const commitments: any[] = will.commitments || [];
  const pendingInvites = (invitesData || []).filter(i => i.status === "pending");
  const canPauseResume = canManage && (will.status === "active" || will.status === "paused");
  const canTerminate = canManage && (will.status === "active" || will.status === "paused" || will.status === "scheduled");

  const backUrl = sessionStorage.getItem("willBackUrl") || "/";

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

  // Members row: for creator build from invitesData; for non-creator use commitments
  const membersForRow = useMemo(() => {
    if (!user) return [];
    if (isCreator && invitesData) {
      return [
        { key: 'creator', userId: user.id, firstName: (user as any).firstName || user.email?.split('@')[0] || '?', status: 'creator', inviteId: null as number | null },
        ...invitesData.map(inv => ({
          key: String(inv.id),
          userId: inv.invitedUserId,
          firstName: inv.firstName || '?',
          status: inv.status,
          inviteId: inv.id,
        })),
      ];
    }
    // Non-creator: just show committed members
    return commitments.map((c: any) => ({
      key: String(c.id),
      userId: c.userId,
      firstName: c.user?.firstName || c.user?.email?.split('@')[0] || '?',
      status: c.userId === will?.createdBy ? 'creator' : 'accepted',
      inviteId: null as number | null,
    }));
  }, [isCreator, invitesData, commitments, user, will?.createdBy]);

  // Which cards are locked
  const isProgressLocked = will?.status === "pending" || will?.status === "scheduled";
  const isProofLocked = will?.status !== "active" && will?.status !== "will_review";
  const proofLockMessage =
    will?.status === "pending" || will?.status === "scheduled" ? "Available once Will starts" :
    will?.status === "paused" ? "Resume Will to add drops" :
    "Will has ended";

  // Category-aware computed values
  const category = will?.commitmentCategory ?? null;
  // Recompute on every render so midnight unlock works without reload
  const todayLocalDate = (() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  })();
  const abstainTodayEntry = useMemo(() => {
    return abstainLogEntries.find((e: AbstainLog) => e.date === todayLocalDate) || null;
  }, [abstainLogEntries, todayLocalDate]);
  const abstainStreakDays = useMemo(() => {
    if (!will?.streakStartDate) return 0;
    const start = new Date(will.streakStartDate);
    const now = new Date();
    return Math.max(0, Math.floor((now.getTime() - start.getTime()) / 86400000));
  }, [will?.streakStartDate]);
  const abstainBestStreak = useMemo(() => {
    if (!abstainLogEntries.length) return abstainStreakDays;
    // Only count consecutive calendar days — sort by date and check adjacency
    const sorted = [...abstainLogEntries].sort((a: AbstainLog, b: AbstainLog) => a.date.localeCompare(b.date));
    let best = 0, cur = 0, prevDate: string | null = null;
    for (const e of sorted) {
      if (!e.honored) { cur = 0; prevDate = null; continue; }
      if (prevDate) {
        const prev = new Date(prevDate);
        const curr = new Date(e.date);
        const diffDays = Math.round((curr.getTime() - prev.getTime()) / 86400000);
        if (diffDays === 1) { cur++; } else { cur = 1; }
      } else { cur = 1; }
      best = Math.max(best, cur);
      prevDate = e.date;
    }
    return Math.max(best, abstainStreakDays);
  }, [abstainLogEntries, abstainStreakDays]);

  // Habit: detect if already checked in today
  const habitTodayCheckIn = useMemo(() => {
    if (will?.commitmentCategory !== 'recurring') return null;
    return checkIns.find((c: WillCheckIn) => c.date === todayLocalDate) || null;
  }, [checkIns, will?.commitmentCategory, todayLocalDate]);

  // Recurring: current week (Mon–Sun) for the week strip
  const recurringWeekDays = useMemo(() => {
    if (will?.commitmentCategory !== 'recurring') return [];
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const dow = today.getDay();
    const mondayOffset = dow === 0 ? -6 : 1 - dow;
    const monday = new Date(today); monday.setDate(today.getDate() + mondayOffset);
    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date(monday); d.setDate(monday.getDate() + i);
      const dateStr = d.toLocaleDateString('en-CA');
      const ci = checkIns.find((c: WillCheckIn) => c.date === dateStr);
      const isToday = d.getTime() === today.getTime();
      const isFuture = d > today;
      let status: 'yes' | 'partial' | 'no' | 'today' | 'future';
      if (ci) { status = ci.status as 'yes' | 'partial' | 'no'; }
      else if (isToday) { status = 'today'; }
      else if (isFuture) { status = 'future'; }
      else { status = 'no'; }
      return { d, dateStr, dayNum: d.getDate(), status, isToday };
    });
  }, [will?.commitmentCategory, checkIns]);

  // Duration: total days in the will period
  const durTotalDays = useMemo(() => {
    if (!will?.startDate || !will?.endDate) return 0;
    return Math.max(1, Math.round((new Date(will.endDate as string).getTime() - new Date(will.startDate as unknown as string).getTime()) / 86400000));
  }, [will?.startDate, will?.endDate]);

  // Duration: days elapsed including today (capped at total)
  const durDaysIn = useMemo(() => {
    if (!will?.startDate || durTotalDays === 0) return 0;
    const start = new Date(will.startDate as unknown as string); start.setHours(0, 0, 0, 0);
    const todayMidnight = new Date(); todayMidnight.setHours(0, 0, 0, 0);
    return Math.min(durTotalDays, Math.max(1, Math.floor((todayMidnight.getTime() - start.getTime()) / 86400000) + 1));
  }, [will?.startDate, durTotalDays]);

  const durDaysLeft = Math.max(0, durTotalDays - durDaysIn);

  // Duration: missed = past days (before today) with no entry or not-honored entry
  const durMissedDays = useMemo(() => {
    if (!will?.startDate || durDaysIn === 0) return 0;
    const start = new Date(will.startDate as unknown as string); start.setHours(0, 0, 0, 0);
    let missed = 0;
    for (let i = 0; i < durDaysIn - 1; i++) {
      const d = new Date(start); d.setDate(d.getDate() + i);
      const dateStr = d.toLocaleDateString('en-CA');
      const entry = abstainLogEntries.find((e: AbstainLog) => e.date === dateStr);
      if (!entry || !entry.honored) missed++;
    }
    return missed;
  }, [will?.startDate, durDaysIn, abstainLogEntries]);

  // Duration: calendar day array (all days from start to end)
  const durCalendarDays = useMemo(() => {
    if (!will?.startDate || durTotalDays === 0) return [] as { dayNum: number; date: string; status: 'checked-in' | 'missed' | 'today' | 'upcoming' }[];
    const start = new Date(will.startDate as unknown as string); start.setHours(0, 0, 0, 0);
    const todayMidnight = new Date(); todayMidnight.setHours(0, 0, 0, 0);
    return Array.from({ length: durTotalDays }, (_, i) => {
      const d = new Date(start); d.setDate(d.getDate() + i);
      const dateStr = d.toLocaleDateString('en-CA');
      const isToday = d.getTime() === todayMidnight.getTime();
      const isPast = d < todayMidnight;
      const entry = abstainLogEntries.find((e: AbstainLog) => e.date === dateStr);
      const status = isToday ? 'today' : isPast ? (entry?.honored ? 'checked-in' : 'missed') : 'upcoming';
      return { dayNum: i + 1, date: dateStr, status } as { dayNum: number; date: string; status: 'checked-in' | 'missed' | 'today' | 'upcoming' };
    });
  }, [will?.startDate, durTotalDays, abstainLogEntries]);

  // Duration: Mon-first day-of-week offset for calendar grid start
  const durStartDOW = useMemo(() => {
    if (!will?.startDate) return 0;
    return (new Date(will.startDate as unknown as string).getDay() + 6) % 7;
  }, [will?.startDate]);

  // Abstain: calendar day strip (last 14 days) — kept for any legacy usage
  const abstainCalendarDays = useMemo(() => {
    if (!will?.startDate) return [];
    const start = new Date(will.startDate as unknown as string);
    const today = new Date();
    const days: { date: string; status: 'honored' | 'not-honored' | 'pending' }[] = [];
    for (let d = new Date(start); d <= today; d.setDate(d.getDate() + 1)) {
      const dateStr = new Date(d).toLocaleDateString('en-CA');
      const entry = abstainLogEntries.find((e: AbstainLog) => e.date === dateStr);
      days.push({ date: dateStr, status: entry ? (entry.honored ? 'honored' : 'not-honored') : 'pending' });
    }
    return days.slice(-14);
  }, [will?.startDate, abstainLogEntries]);

  const missionDaysRemaining = useMemo(() => {
    if (!will?.endDate) return 0;
    return Math.max(0, Math.ceil((new Date(will.endDate as string).getTime() - Date.now()) / 86400000));
  }, [will?.endDate]);
  const missionTotalDays = useMemo(() => {
    if (!will?.startDate || !will?.endDate) return 1;
    return Math.max(1, Math.ceil((new Date(will.endDate as string).getTime() - new Date(will.startDate as unknown as string).getTime()) / 86400000));
  }, [will?.startDate, will?.endDate]);
  // Mission deadline label
  const missionDeadlineLabel = useMemo(() => {
    if (!will?.endDate) return '';
    return new Date(will.endDate as string).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  }, [will?.endDate]);

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
            <button onClick={() => setPhotoModal(null)} className="w-14 h-14 flex items-center justify-center bg-white/30 rounded-full hover:bg-white/50 transition-colors" data-testid="button-close-photo-modal">
              <X className="w-7 h-7 text-white" />
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

      {/* ── Ping member bottom sheet ────────────────────────────────── */}
      {pingTarget && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center"
          onClick={() => { setPingTarget(null); setPingSent(false); }}
        >
          <div className="absolute inset-0 bg-black/40" />
          <div
            className="relative w-full max-w-sm bg-white rounded-t-2xl px-5 pt-4 shadow-2xl"
            style={{ paddingBottom: "max(2rem, env(safe-area-inset-bottom))" }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="w-10 h-1 bg-gray-200 rounded-full mx-auto mb-5" />

            {/* Member avatar + name */}
            <div className="flex flex-col items-center mb-5">
              <div
                className="w-14 h-14 rounded-full flex items-center justify-center text-xl font-bold mb-2"
                style={{ border: '2px dashed #F59E0B', backgroundColor: '#FEF3C7', opacity: 0.7 }}
              >
                <span style={{ color: '#92400E' }}>{pingTarget.firstName.charAt(0).toUpperCase()}</span>
              </div>
              <p className="text-base font-semibold text-gray-900">{pingTarget.firstName}</p>
              <p className="text-xs text-gray-400 mt-0.5">Invited · still pending</p>
            </div>

            <div className="space-y-2.5">
              {/* Ping button */}
              {pingSent ? (
                <div className="w-full flex items-center justify-center gap-2 py-3.5 rounded-2xl bg-green-50 border border-green-200 text-green-700 text-sm font-semibold" data-testid="ping-sent-confirmation">
                  <CheckCircle className="w-4 h-4" />
                  Ping sent to {pingTarget.firstName}!
                </div>
              ) : (
                <button
                  onClick={() => pingInviteeMutation.mutate({ inviteId: pingTarget.id })}
                  disabled={pingInviteeMutation.isPending}
                  className="w-full flex items-center justify-center gap-2 py-3.5 rounded-2xl text-sm font-semibold text-white transition-colors disabled:opacity-50"
                  style={{ backgroundColor: '#534AB7' }}
                  data-testid="button-ping-member"
                >
                  <Bell className="w-4 h-4" />
                  {pingInviteeMutation.isPending ? 'Sending…' : `Ping ${pingTarget.firstName} to respond`}
                </button>
              )}

              {/* Remove from Will button */}
              <button
                onClick={() => removeInviteeMutation.mutate({ inviteId: pingTarget.id })}
                disabled={removeInviteeMutation.isPending}
                className="w-full flex items-center justify-center gap-2 py-3.5 rounded-2xl text-sm font-semibold text-red-600 border border-red-200 bg-red-50 hover:bg-red-100 transition-colors disabled:opacity-50"
                data-testid="button-remove-member"
              >
                <Trash2 className="w-4 h-4" />
                {removeInviteeMutation.isPending ? 'Removing…' : 'Remove from Will'}
              </button>

              {/* Cancel */}
              <button
                onClick={() => { setPingTarget(null); setPingSent(false); }}
                className="w-full py-3 text-center text-sm text-gray-500 hover:text-gray-700 transition-colors"
                data-testid="button-ping-cancel"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="pt-[calc(env(safe-area-inset-top)+4rem)] pb-[calc(env(safe-area-inset-bottom)+1rem)] min-h-screen">
        <div className="max-w-sm mx-auto px-5">

          {/* Nav — back button left, action icons right, title absolutely centred */}
          <div className="relative flex items-center mb-2" style={{ height: 40 }}>
            {/* Back */}
            <button
              onClick={() => setLocation(backUrl)}
              className="absolute left-0 w-10 h-10 flex items-center justify-center"
              data-testid="button-back-home"
            >
              <span className="w-8 h-8 flex items-center justify-center rounded-lg bg-gray-100 border border-gray-200 text-gray-700 hover:bg-gray-200 transition-all duration-200 active:scale-95">
                <ChevronLeft className="w-5 h-5" strokeWidth={2.5} />
              </span>
            </button>

            {/* Title — absolutely centred on the full row width, independent of button widths */}
            <h1 className="absolute left-0 right-0 text-center text-base font-semibold text-gray-900 leading-tight pointer-events-none">
              Team Will
            </h1>

            {/* Action icons */}
            <div className="absolute right-0 flex items-center gap-1.5">
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
                <svg viewBox="0 0 24 24" style={{ width: 20, height: 20, flexShrink: 0 }} fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
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
                  <svg viewBox="0 0 24 24" style={{ width: 20, height: 20, flexShrink: 0 }} fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="12" cy="12" r="3" />
                    <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
                  </svg>
                </button>
              )}
            </div>
          </div>

          {/* Badge row — status + optional category context */}
          <div className="flex justify-center items-center mb-4">
            <span className={`px-2.5 py-0.5 rounded-full text-xs font-medium ${statusInfo.bg} ${statusInfo.text}`}>
              {will.status === 'active' && category === 'event' && missionDeadlineLabel
                ? `Active · deadline ${missionDeadlineLabel}`
                : will.status === 'active' && daysLeft !== null && (category === 'recurring' || category === 'duration')
                ? `Active · ${daysLeft} days left`
                : statusInfo.label}
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
          {isWeWill ? (
            /* We Will — OUR COMMITMENT hero card */
            <div className="mb-2">
              <p className="text-[10px] font-semibold uppercase tracking-widest text-gray-400 text-center mb-2">Our Commitment</p>
              <div className="bg-white border border-gray-100 rounded-2xl p-4 shadow-sm">
                {will.sharedWhat ? (
                  <p className="text-[20px] font-bold text-gray-900 text-center leading-snug mb-3">
                    &ldquo;{will.sharedWhat}&rdquo;
                  </p>
                ) : (
                  <p className="text-sm text-gray-400 italic text-center mb-3">No shared commitment set</p>
                )}
                <div className="border-t border-gray-100 pt-3">
                  {commitments.length === 0 ? (
                    <p className="text-xs text-gray-400 italic text-center py-1">
                      No members yet — waiting for friends to accept
                    </p>
                  ) : (
                    <div className="flex items-start justify-center gap-6 flex-wrap">
                      {commitments.map((c: any) => {
                        const isMe = c.userId === user.id;
                        return (
                          <div key={c.id} className="flex flex-col items-center" data-testid={`participant-${c.userId}`}>
                            <div className="relative mb-1.5">
                              <div className="w-10 h-10 bg-gradient-to-br from-violet-500 to-purple-500 rounded-full flex items-center justify-center">
                                <span className="text-white font-semibold text-sm">
                                  {(c.user?.firstName || c.user?.email)?.charAt(0).toUpperCase()}
                                </span>
                              </div>
                              {(() => {
                                const s = teamCheckInMap[c.userId];
                                const cat = will?.commitmentCategory;
                                const isGreen = (cat === 'recurring' && (s === 'yes' || s === 'partial')) || (cat === 'duration' && s === 'honored') || (cat === 'event' && s === 'completed');
                                const isRed = (cat === 'recurring' && s === 'no') || (cat === 'duration' && s === 'not_honored');
                                if (!isGreen && !isRed) return null;
                                return (
                                  <div className="absolute -bottom-0.5 -right-0.5 flex items-center justify-center rounded-full border-2 border-white" style={{ width: 18, height: 18, backgroundColor: isGreen ? '#1D9E75' : '#E24B4A' }}>
                                    {isGreen ? <Check style={{ width: 10, height: 10, color: 'white', strokeWidth: 3 }} /> : <X style={{ width: 10, height: 10, color: 'white', strokeWidth: 3 }} />}
                                  </div>
                                );
                              })()}
                            </div>
                            <p className="text-xs font-medium text-gray-800 text-center">
                              {c.user?.firstName || c.user?.email?.split("@")[0]}
                            </p>
                            {isMe && (
                              <p style={{ fontSize: '10px', color: '#aaa', marginTop: '2px' }}>You</p>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>

                {/* ── Members row (WeWill) ───────────────── */}
                {membersForRow.length > 0 && (
                  <div className="border-t border-gray-100 mt-3 pt-3">
                    <p className="text-[10px] font-semibold uppercase tracking-widest text-gray-400 mb-2.5">Members</p>
                    <div className="flex gap-5 overflow-x-auto pb-1">
                      {membersForRow.map(member => {
                        const isPending = member.status === 'pending';
                        const initial = member.firstName.charAt(0).toUpperCase();
                        return (
                          <button
                            key={member.key}
                            className={`flex flex-col items-center gap-1 flex-shrink-0 ${isCreator && isPending ? 'active:opacity-70' : 'cursor-default'}`}
                            onClick={() => {
                              if (isCreator && isPending && member.inviteId) {
                                setPingTarget({ id: member.inviteId, invitedUserId: member.userId, firstName: member.firstName });
                                setPingSent(false);
                              }
                            }}
                            data-testid={`member-avatar-${member.userId}`}
                          >
                            <div className="relative">
                              <div
                                className="w-11 h-11 rounded-full flex items-center justify-center text-sm font-semibold"
                                style={isPending
                                  ? { opacity: 0.45, border: '2px dashed #F59E0B', backgroundColor: '#FEF3C7' }
                                  : { background: 'linear-gradient(135deg, #8B5CF6, #7C3AED)' }
                                }
                              >
                                <span style={{ color: isPending ? '#92400E' : '#fff' }}>{initial}</span>
                              </div>
                              <div
                                className="absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-white"
                                style={{ backgroundColor: member.status === 'creator' ? '#8B5CF6' : member.status === 'accepted' ? '#22C55E' : '#F59E0B' }}
                              />
                            </div>
                            <p className={`text-[11px] font-medium text-center max-w-[54px] truncate ${isPending ? 'text-gray-400' : 'text-gray-800'}`}>
                              {member.firstName}
                            </p>
                            <p className="text-[10px] font-medium" style={{ color: member.status === 'creator' ? '#8B5CF6' : member.status === 'accepted' ? '#16A34A' : '#D97706' }}>
                              {member.status === 'creator' ? 'You' : member.status === 'accepted' ? 'In ✓' : 'Pending'}
                            </p>
                          </button>
                        );
                      })}
                    </div>
                    {isCreator && membersForRow.some(m => m.status === 'pending') && (
                      <p className="text-center text-[11px] text-amber-600 mt-2.5 flex items-center justify-center gap-1" data-testid="hint-tap-pending">
                        <span>👆</span>
                        Tap a pending member to ping them
                      </p>
                    )}
                  </div>
                )}
              </div>
            </div>
          ) : (
            /* I Will — YOUR TEAM label + member grid with current user green border */
            <div className="mb-2">
              <div className="flex items-center justify-between mb-1.5">
                <p className="text-[10px] font-semibold uppercase tracking-widest text-gray-400">Your Team</p>
                {isCreator && pendingInvites.length > 0 && (
                  <span className="text-[11px] font-medium text-amber-600 bg-amber-50 px-2 py-0.5 rounded-full" data-testid="badge-pending-invites">
                    {pendingInvites.length} pending
                  </span>
                )}
              </div>
              <div className="bg-white border border-gray-100 rounded-2xl p-3 shadow-sm">
                {commitments.length === 0 ? (
                  <p className="text-xs text-gray-400 italic text-center py-2">
                    No commitments yet — waiting for friends to accept
                  </p>
                ) : (
                  <div className={`grid gap-1.5 ${commitments.length === 1 ? "grid-cols-1 max-w-[140px] mx-auto" : "grid-cols-2"}`}>
                    {commitments.map((c: any) => {
                      const isMe = c.userId === user.id;
                      return (
                        <div
                          key={c.id}
                          className="flex flex-col items-center py-2 px-1.5 bg-gray-50 rounded-xl"
                          data-testid={`participant-${c.userId}`}
                        >
                          <div className="relative mb-1">
                            <div
                              className="bg-gradient-to-br from-violet-500 to-purple-500 rounded-full flex items-center justify-center"
                              style={{ width: 38, height: 38, border: "3px solid #fff", boxShadow: "0 0 0 2px #9B5CE5" }}
                            >
                              <span className="text-white font-semibold text-sm">
                                {(c.user?.firstName || c.user?.email)?.charAt(0).toUpperCase()}
                              </span>
                            </div>
                            {(() => {
                              const s = teamCheckInMap[c.userId];
                              const cat = will?.commitmentCategory;
                              const isGreen = (cat === 'recurring' && (s === 'yes' || s === 'partial')) || (cat === 'duration' && s === 'honored') || (cat === 'event' && s === 'completed');
                              const isRed = (cat === 'recurring' && s === 'no') || (cat === 'duration' && s === 'not_honored');
                              if (!isGreen && !isRed) return null;
                              return (
                                <div className="absolute -bottom-0.5 -right-0.5 flex items-center justify-center rounded-full border-2 border-white" style={{ width: 18, height: 18, backgroundColor: isGreen ? '#1D9E75' : '#E24B4A' }}>
                                  {isGreen ? <Check style={{ width: 10, height: 10, color: 'white', strokeWidth: 3 }} /> : <X style={{ width: 10, height: 10, color: 'white', strokeWidth: 3 }} />}
                                </div>
                              );
                            })()}
                          </div>
                          <p className="font-medium text-gray-900 text-xs text-center leading-tight">
                            {c.user?.firstName || c.user?.email?.split("@")[0]}
                          </p>
                          {isMe && (
                            <p style={{ fontSize: '10px', color: '#aaa', marginTop: '2px' }}>You</p>
                          )}
                          {c.what && (
                            <p className="text-[10px] text-gray-500 mt-1 text-center leading-snug truncate w-full">
                              {c.what}
                            </p>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}

                {/* ── Members row (I-Will) ───────────────── */}
                {membersForRow.length > 0 && (
                  <div className="border-t border-gray-100 mt-3 pt-3">
                    <p className="text-[10px] font-semibold uppercase tracking-widest text-gray-400 mb-2.5">Members</p>
                    <div className="flex gap-5 overflow-x-auto pb-1">
                      {membersForRow.map(member => {
                        const isPending = member.status === 'pending';
                        const initial = member.firstName.charAt(0).toUpperCase();
                        return (
                          <button
                            key={member.key}
                            className={`flex flex-col items-center gap-1 flex-shrink-0 ${isCreator && isPending ? 'active:opacity-70' : 'cursor-default'}`}
                            onClick={() => {
                              if (isCreator && isPending && member.inviteId) {
                                setPingTarget({ id: member.inviteId, invitedUserId: member.userId, firstName: member.firstName });
                                setPingSent(false);
                              }
                            }}
                            data-testid={`member-avatar-${member.userId}`}
                          >
                            <div className="relative">
                              <div
                                className="w-11 h-11 rounded-full flex items-center justify-center text-sm font-semibold"
                                style={isPending
                                  ? { opacity: 0.45, border: '2px dashed #F59E0B', backgroundColor: '#FEF3C7' }
                                  : { background: 'linear-gradient(135deg, #8B5CF6, #7C3AED)' }
                                }
                              >
                                <span style={{ color: isPending ? '#92400E' : '#fff' }}>{initial}</span>
                              </div>
                              <div
                                className="absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-white"
                                style={{ backgroundColor: member.status === 'creator' ? '#8B5CF6' : member.status === 'accepted' ? '#22C55E' : '#F59E0B' }}
                              />
                            </div>
                            <p className={`text-[11px] font-medium text-center max-w-[54px] truncate ${isPending ? 'text-gray-400' : 'text-gray-800'}`}>
                              {member.firstName}
                            </p>
                            <p className="text-[10px] font-medium" style={{ color: member.status === 'creator' ? '#8B5CF6' : member.status === 'accepted' ? '#16A34A' : '#D97706' }}>
                              {member.status === 'creator' ? 'You' : member.status === 'accepted' ? 'In ✓' : 'Pending'}
                            </p>
                          </button>
                        );
                      })}
                    </div>
                    {isCreator && membersForRow.some(m => m.status === 'pending') && (
                      <p className="text-center text-[11px] text-amber-600 mt-2.5 flex items-center justify-center gap-1" data-testid="hint-tap-pending">
                        <span>👆</span>
                        Tap a pending member to ping them
                      </p>
                    )}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ── Progress section — YOUR PROGRESS label + category branch ── */}
          <div className="mb-2">
            <p className="text-[10px] font-semibold uppercase tracking-widest text-gray-400 mb-1">Your Progress</p>

            {isProgressLocked ? (
              /* Locked state — same for all categories */
              <div className="bg-white border border-gray-100 rounded-2xl p-4 shadow-sm opacity-50 pointer-events-none select-none">
                <div className="flex items-center justify-between mb-3">
                  <p className="text-[15px] font-semibold" style={{ color: "#1C1C1E" }}>Your Progress</p>
                  <svg viewBox="0 0 24 24" className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                    <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                  </svg>
                </div>
                <p className="text-xs text-gray-400 text-center py-2">Available once Will starts</p>
              </div>

            ) : category === 'recurring' ? (
              /* ── Recurring ── */
              <div className="space-y-3">
                {/* Recurring: two side-by-side check-in buttons */}
                {will.status === 'active' && hasDailyCheckIns && (
                  habitTodayCheckIn ? (
                    <div
                      className="w-full flex items-center justify-center gap-2 py-[11px] px-4 rounded-xl text-base font-semibold"
                      style={{ backgroundColor: '#E1F5EE', color: '#1D9E75', border: '2px solid #1D9E75' }}
                      data-testid="button-habit-checked-in"
                    >
                      <CheckCircle style={{ width: 20, height: 20, color: '#1D9E75' }} />
                      Checked in for today ✓
                    </div>
                  ) : (
                    <div className="flex gap-2">
                      <button
                        onClick={() => recurringCheckInMutation.mutate({ status: 'yes' })}
                        disabled={recurringCheckInMutation.isPending}
                        className="flex-1 flex items-center justify-center gap-2 py-[11px] px-4 rounded-xl text-base font-semibold text-white transition-opacity active:opacity-80 disabled:opacity-60"
                        style={{ backgroundColor: '#1D9E75' }}
                        data-testid="button-recurring-did-it"
                      >
                        <Check style={{ width: 18, height: 18, color: '#fff' }} />
                        Did it
                      </button>
                      <button
                        onClick={() => recurringCheckInMutation.mutate({ status: 'no' })}
                        disabled={recurringCheckInMutation.isPending}
                        className="flex-1 flex items-center justify-center gap-2 py-[11px] px-4 rounded-xl text-base font-semibold bg-white transition-opacity active:opacity-80 disabled:opacity-60"
                        style={{ border: '2px solid #E24B4A', color: '#E24B4A' }}
                        data-testid="button-recurring-did-not"
                      >
                        <X style={{ width: 18, height: 18, color: '#E24B4A' }} />
                        Did not
                      </button>
                    </div>
                  )
                )}
                {/* Recurring: flat always-expanded progress card */}
                {(will.status === 'active' || will.status === 'will_review' || will.status === 'completed' || will.status === 'terminated') && (() => {
                  const yesCount = checkIns.filter((c: WillCheckIn) => c.status === 'yes').length;
                  const partialCount = checkIns.filter((c: WillCheckIn) => c.status === 'partial').length;
                  const noCount = checkIns.filter((c: WillCheckIn) => c.status === 'no').length;
                  const total = yesCount + partialCount + noCount;
                  const successRate = total > 0 ? Math.round((yesCount / total) * 100) : 0;
                  return (
                    <div className="bg-white rounded-xl border border-gray-200 p-4" data-testid="card-habit-progress">
                      <p className="text-xs font-semibold uppercase tracking-widest text-gray-400 text-center mb-3">Your Progress</p>
                      <div className="flex gap-2 mb-3">
                        <div className="flex-1 rounded-xl py-2.5 text-center" style={{ backgroundColor: '#F0FAF5' }}>
                          <p className="text-xl font-bold" style={{ color: '#1D9E75' }}>{yesCount}</p>
                          <p className="text-xs text-gray-400 mt-0.5">completed</p>
                        </div>
                        <div className="flex-1 rounded-xl py-2.5 text-center" style={{ backgroundColor: '#FFFBEB' }}>
                          <p className="text-xl font-bold text-amber-400">{partialCount}</p>
                          <p className="text-xs text-gray-400 mt-0.5">partial</p>
                        </div>
                        <div className="flex-1 rounded-xl py-2.5 text-center" style={{ backgroundColor: '#FEF2F2' }}>
                          <p className="text-xl font-bold text-red-400">{noCount}</p>
                          <p className="text-xs text-gray-400 mt-0.5">missed</p>
                        </div>
                      </div>
                      <div className="border-t border-gray-100 mb-3" />
                      <div className="mb-3">
                        <div className="grid grid-cols-7 gap-1 mb-1.5">
                          {['M','T','W','T','F','S','S'].map((l, i) => (
                            <div key={i} className="text-center text-[10px] text-gray-400 font-medium">{l}</div>
                          ))}
                        </div>
                        <div className="grid grid-cols-7 gap-1">
                          {recurringWeekDays.map((day) => {
                            const filled = day.status === 'yes' || day.status === 'partial' || day.status === 'no';
                            const bg = day.status === 'yes' ? '#1D9E75' : day.status === 'partial' ? '#F59E0B' : day.status === 'no' ? '#F87171' : 'transparent';
                            const border = day.status === 'today' ? '2px solid #1D9E75' : day.status === 'future' ? '2px solid #D1D5DB' : 'none';
                            const textColor = filled ? '#fff' : day.status === 'today' ? '#1D9E75' : '#9CA3AF';
                            return (
                              <div
                                key={day.dateStr}
                                className="flex items-center justify-center rounded-full"
                                style={{ aspectRatio: '1', backgroundColor: bg, border, width: '100%' }}
                              >
                                <span className="text-xs font-semibold" style={{ color: textColor }}>{day.dayNum}</span>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                      <div className="flex items-center justify-center gap-3 text-[10px] text-gray-500 mb-3">
                        <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full inline-block" style={{ backgroundColor: '#1D9E75' }} />Done</span>
                        <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full inline-block" style={{ backgroundColor: '#F59E0B' }} />Partial</span>
                        <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full inline-block" style={{ backgroundColor: '#F87171' }} />Missed</span>
                        <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full inline-block border-2 border-[#1D9E75]" style={{ backgroundColor: 'transparent' }} />Today</span>
                      </div>
                      <div className="flex items-center justify-between pt-2 border-t border-gray-100">
                        <span className="text-xs text-gray-500">Success rate</span>
                        <span className="text-xs font-semibold" style={{ color: '#1D9E75' }}>{successRate}% · {yesCount} of {total} days</span>
                      </div>
                    </div>
                  );
                })()}
              </div>

            ) : category === 'duration' ? (
              /* ── Duration (flat progress card) ── */
              <div className="space-y-3">
                {(will.status === 'active' || will.status === 'will_review' || will.status === 'completed' || will.status === 'terminated') && (
                  <div className="bg-white rounded-xl border border-gray-200 p-4" data-testid="card-duration-progress">
                    {/* Section label */}
                    <p className="text-[10px] font-semibold text-gray-400 tracking-widest uppercase text-center mb-4">Your Progress</p>

                    {/* Circular progress ring */}
                    <div className="flex justify-center mb-4">
                      <div className="relative" style={{ width: 144, height: 144 }}>
                        <svg width="144" height="144" style={{ transform: 'rotate(-90deg)' }}>
                          <circle cx="72" cy="72" r="56" fill="none" stroke="#E5E7EB" strokeWidth="10" />
                          <circle
                            cx="72" cy="72" r="56" fill="none"
                            stroke="#1D6FBE" strokeWidth="10"
                            strokeLinecap="round"
                            strokeDasharray={`${2 * Math.PI * 56}`}
                            strokeDashoffset={`${2 * Math.PI * 56 * (1 - durDaysIn / Math.max(1, durTotalDays))}`}
                            style={{ transition: 'stroke-dashoffset 0.6s ease' }}
                          />
                        </svg>
                        {/* Centered inner text — three lines */}
                        <div className="absolute inset-0 flex flex-col items-center justify-center" style={{ gap: 0 }}>
                          <span className="text-[11px] text-gray-400" style={{ lineHeight: '1.2' }}>Day</span>
                          <span className="font-bold" style={{ fontSize: 36, lineHeight: '1.05', color: '#1D6FBE' }}>{durDaysIn}</span>
                          <span className="text-[11px] text-gray-400" style={{ lineHeight: '1.2' }}>of {durTotalDays}</span>
                        </div>
                      </div>
                    </div>

                    {/* Stat boxes */}
                    <div className="grid grid-cols-3 gap-2 mb-4">
                      <div className="text-center py-2.5 px-1 rounded-xl bg-gray-50">
                        <div className="text-lg font-bold text-gray-800">{durDaysIn}</div>
                        <div className="text-[11px] text-gray-500">days in</div>
                      </div>
                      <div className="text-center py-2.5 px-1 rounded-xl bg-gray-50">
                        <div className="text-lg font-bold text-gray-800">{durDaysLeft}</div>
                        <div className="text-[11px] text-gray-500">days left</div>
                      </div>
                      <div className="text-center py-2.5 px-1 rounded-xl bg-gray-50">
                        <div className="text-lg font-bold" style={{ color: durMissedDays > 0 ? '#E24B4A' : '#1F2937' }}>{durMissedDays}</div>
                        <div className="text-[11px] text-gray-500">missed</div>
                      </div>
                    </div>

                    {/* Check-in area (active only) */}
                    {will.status === 'active' && (
                      <div className="mb-4" data-testid="section-abstain-actions">
                        {(abstainTodayEntry || abstainJustLoggedHonored !== null) ? (
                          (() => {
                            const honored = abstainTodayEntry?.honored ?? (abstainJustLoggedHonored ?? true);
                            return honored ? (
                              <div className="w-full rounded-xl p-3 flex items-center gap-3" style={{ backgroundColor: '#E1F5EE', border: '1.5px solid #1D9E75' }} data-testid="abstain-result-honored">
                                <div className="flex items-center justify-center rounded-full flex-shrink-0" style={{ width: 36, height: 36, backgroundColor: '#1D9E75' }}>
                                  <CheckCircle style={{ width: 18, height: 18, color: '#fff' }} />
                                </div>
                                <div>
                                  <p className="text-sm font-semibold" style={{ color: '#085041' }}>Will honored today</p>
                                  <p className="text-xs" style={{ color: '#2E7D63' }}>Logged for today.</p>
                                </div>
                              </div>
                            ) : (
                              <div className="w-full rounded-xl p-3 flex items-center gap-3" style={{ backgroundColor: '#FCEBEB', border: '1.5px solid #E24B4A' }} data-testid="abstain-result-not-honored">
                                <div className="flex items-center justify-center rounded-full flex-shrink-0" style={{ width: 36, height: 36, backgroundColor: '#E24B4A' }}>
                                  <XCircle style={{ width: 18, height: 18, color: '#fff' }} />
                                </div>
                                <div>
                                  <p className="text-sm font-semibold" style={{ color: '#791F1F' }}>That's okay</p>
                                  <p className="text-xs" style={{ color: '#A32D2D' }}>Tomorrow is a fresh start.</p>
                                </div>
                              </div>
                            );
                          })()
                        ) : abstainCheckInOpen ? (
                          <div className="space-y-2" data-testid="abstain-checkin-options">
                            <p className="text-xs text-gray-400 text-center">Did you honor your will today?</p>
                            <button
                              onClick={() => { setAbstainJustLoggedHonored(true); setAbstainCheckInOpen(false); abstainLogMutation.mutate({ honored: true }); }}
                              disabled={abstainLogMutation.isPending}
                              className="w-full flex items-center justify-center gap-2 py-[11px] px-4 rounded-xl text-base font-semibold bg-white transition-colors active:opacity-80"
                              style={{ border: '2px solid #1D6FBE', color: '#0A3870' }}
                              data-testid="button-abstain-honored"
                            >
                              <CheckCircle style={{ width: 20, height: 20, color: '#1D6FBE' }} />
                              I honored my will
                            </button>
                            <button
                              onClick={() => { setAbstainJustLoggedHonored(false); setAbstainCheckInOpen(false); abstainLogMutation.mutate({ honored: false }); }}
                              disabled={abstainLogMutation.isPending}
                              className="w-full flex items-center justify-center gap-2 py-[11px] px-4 rounded-xl text-base font-semibold bg-white transition-colors active:opacity-80"
                              style={{ border: '2px solid #E24B4A', color: '#A32D2D' }}
                              data-testid="button-abstain-didnt-honor"
                            >
                              <XCircle style={{ width: 20, height: 20, color: '#E24B4A' }} />
                              I didn't honor it
                            </button>
                          </div>
                        ) : (
                          <button
                            onClick={() => setAbstainCheckInOpen(true)}
                            className="w-full flex items-center justify-center gap-2 py-[11px] px-4 rounded-xl text-base font-semibold text-white transition-opacity active:opacity-80"
                            style={{ backgroundColor: '#1D6FBE' }}
                            data-testid="button-abstain-check-in"
                          >
                            <CheckCircle style={{ width: 20, height: 20, color: '#fff' }} />
                            Check in for today
                          </button>
                        )}
                      </div>
                    )}

                    {/* Divider */}
                    <div className="border-t border-gray-100 mb-3" />

                    {/* 7-column calendar grid */}
                    {durCalendarDays.length > 0 && (
                      <div>
                        {/* Day-of-week headers */}
                        <div className="grid grid-cols-7 mb-1.5">
                          {['M','T','W','T','F','S','S'].map((h, i) => (
                            <div key={i} className="text-center text-[10px] font-semibold text-gray-400">{h}</div>
                          ))}
                        </div>
                        {/* Day cells */}
                        <div className="grid grid-cols-7 gap-y-1.5">
                          {Array.from({ length: durStartDOW }).map((_, i) => <div key={`pad-${i}`} />)}
                          {durCalendarDays.map((d) => (
                            <div key={d.dayNum} className="flex justify-center">
                              <div
                                className="w-8 h-8 rounded-full flex items-center justify-center text-[11px] font-semibold"
                                style={{
                                  backgroundColor:
                                    d.status === 'checked-in' ? '#1D6FBE'
                                    : d.status === 'missed' ? '#FECDD3'
                                    : 'transparent',
                                  border:
                                    d.status === 'today' ? '2px solid #534AB7'
                                    : d.status === 'upcoming' ? '1px solid #E5E7EB'
                                    : 'none',
                                  color:
                                    d.status === 'checked-in' ? '#fff'
                                    : d.status === 'missed' ? '#E24B4A'
                                    : d.status === 'today' ? '#534AB7'
                                    : '#9CA3AF',
                                }}
                                data-testid={`day-dot-${d.dayNum}`}
                              >
                                {d.dayNum}
                              </div>
                            </div>
                          ))}
                        </div>
                        {/* Legend */}
                        <div className="flex items-center justify-center gap-3 mt-3 flex-wrap">
                          <div className="flex items-center gap-1">
                            <span className="w-2.5 h-2.5 rounded-full inline-block" style={{ backgroundColor: '#1D6FBE' }} />
                            <span className="text-[10px] text-gray-500">Checked in</span>
                          </div>
                          <div className="flex items-center gap-1">
                            <span className="w-2.5 h-2.5 rounded-full inline-block" style={{ border: '2px solid #534AB7' }} />
                            <span className="text-[10px] text-gray-500">Today</span>
                          </div>
                          <div className="flex items-center gap-1">
                            <span className="w-2.5 h-2.5 rounded-full inline-block" style={{ backgroundColor: '#FECDD3' }} />
                            <span className="text-[10px] text-gray-500">Missed</span>
                          </div>
                          <div className="flex items-center gap-1">
                            <span className="w-2.5 h-2.5 rounded-full inline-block" style={{ backgroundColor: '#F3F4F6', border: '1px solid #E5E7EB' }} />
                            <span className="text-[10px] text-gray-500">Upcoming</span>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>

            ) : category === 'event' ? (
              /* ── Event ── */
              <div className="space-y-3">
                {(will.status === 'active' || will.status === 'completed') && (
                  <div className="bg-white rounded-xl border border-gray-200 p-3 flex flex-col items-center gap-2.5" data-testid="card-mission-progress">
                    {/* Check-in flow */}
                    {will.status === 'active' && (
                      missionCompleted ? (
                        <div className="w-full rounded-xl p-4 flex flex-col items-center gap-1.5" style={{ backgroundColor: '#E1F5EE', border: '2px solid #1D9E75' }} data-testid="mission-result-completed">
                          <p className="text-sm font-semibold" style={{ color: '#085041' }}>You completed it!</p>
                          <p className="text-xs" style={{ color: '#2E7D63' }}>Your event is done.</p>
                        </div>
                      ) : missionKeptGoing ? (
                        <div className="w-full rounded-xl p-4 flex flex-col items-center gap-1.5 bg-gray-50 border border-gray-200" data-testid="mission-result-not-yet">
                          <p className="text-sm font-semibold text-gray-700">Keep going</p>
                          <p className="text-xs text-gray-400">You still have time.</p>
                        </div>
                      ) : missionConfirming ? (
                        <div className="w-full space-y-2" data-testid="mission-confirm-step">
                          <button
                            onClick={() => { missionCompleteMutation.mutate(); setMissionConfirming(false); }}
                            disabled={missionCompleteMutation.isPending}
                            className="w-full flex items-center justify-center gap-2 py-[11px] px-4 rounded-xl text-base font-semibold text-white transition-opacity active:opacity-80"
                            style={{ backgroundColor: '#534AB7' }}
                            data-testid="button-mission-confirm-done"
                          >
                            <CheckCircle style={{ width: 20, height: 20, color: '#fff' }} />
                            {missionCompleteMutation.isPending ? 'Saving...' : 'Confirm completion'}
                          </button>
                          <button
                            onClick={() => setMissionConfirming(false)}
                            className="w-full flex items-center justify-center gap-2 py-[11px] px-4 rounded-xl text-base font-semibold bg-white transition-colors active:opacity-80"
                            style={{ border: '0.5px solid #D1D5DB', color: '#6B7280' }}
                            data-testid="button-mission-confirm-cancel"
                          >
                            Cancel
                          </button>
                        </div>
                      ) : missionCheckInOpen ? (
                        <div className="w-full" data-testid="mission-checkin-options">
                          <p className="text-xs text-gray-400 text-center mb-3">Did you complete this?</p>
                          <div className="space-y-2">
                            <button
                              onClick={() => { setMissionCheckInOpen(false); setMissionConfirming(true); }}
                              className="w-full flex items-center justify-center gap-2 py-[11px] px-4 rounded-xl text-base font-semibold bg-white transition-colors active:opacity-80"
                              style={{ border: '2px solid #534AB7', color: '#26215C' }}
                              data-testid="button-mission-yes"
                            >
                              <CheckCircle style={{ width: 20, height: 20, color: '#534AB7' }} />
                              Yes
                            </button>
                            <button
                              onClick={() => {
                                setMissionCheckInOpen(false);
                                setMissionKeptGoing(true);
                                setTimeout(() => setMissionKeptGoing(false), 2000);
                              }}
                              className="w-full flex items-center justify-center gap-2 py-[11px] px-4 rounded-xl text-base font-semibold bg-white transition-colors active:opacity-80"
                              style={{ border: '0.5px solid #D1D5DB', color: '#6B7280' }}
                              data-testid="button-mission-not-yet"
                            >
                              Not yet
                            </button>
                          </div>
                        </div>
                      ) : (
                        <button
                          onClick={() => setMissionCheckInOpen(true)}
                          className="w-full flex items-center justify-center gap-2 py-[11px] px-4 rounded-xl text-base font-semibold text-white transition-opacity active:opacity-80"
                          style={{ backgroundColor: '#534AB7' }}
                          data-testid="button-mission-check-in"
                        >
                          <Zap style={{ width: 20, height: 20, color: '#fff' }} />
                          Did you complete this?
                        </button>
                      )
                    )}
                    {will.status === 'completed' && (
                      <div className="w-full rounded-xl p-4 flex flex-col items-center gap-1.5" style={{ backgroundColor: '#E1F5EE', border: '2px solid #1D9E75' }} data-testid="mission-already-completed">
                        <p className="text-sm font-semibold" style={{ color: '#085041' }}>Will completed!</p>
                        <p className="text-xs" style={{ color: '#2E7D63' }}>You did it. This chapter is closed.</p>
                      </div>
                    )}
                  </div>
                )}
              </div>

            ) : (
              /* ── Null / legacy — unchanged from before ── */
              <div className="bg-white border border-gray-100 rounded-2xl p-4 shadow-sm">
                <button
                  onClick={() => hasDailyCheckIns && setShowFullProgress(p => !p)}
                  className="w-full flex items-center justify-between mb-3"
                  data-testid="button-toggle-progress"
                >
                  <p className="text-[15px] font-semibold" style={{ color: "#1C1C1E" }}>Your Progress</p>
                  {hasDailyCheckIns && (
                    <ChevronRight
                      className={`w-4 h-4 text-gray-400 transition-transform duration-200 ${showFullProgress ? "rotate-90" : ""}`}
                    />
                  )}
                </button>
                <div className="grid grid-cols-3 gap-3 text-center">
                  <div>
                    <p className="text-xl font-bold text-emerald-500">{checkInProgress?.streak ?? 0}</p>
                    <p className="text-[10px] text-gray-400 mt-0.5">day streak</p>
                  </div>
                  <div>
                    <p className={`text-xl font-bold ${will.status === "will_review" ? "text-amber-500" : "text-gray-700"}`}>
                      {will.status === "completed" || will.status === "terminated"
                        ? (checkInProgress?.checkedInDays ?? 0)
                        : will.status === "will_review" ? 0
                        : daysLeft !== null ? daysLeft : "∞"}
                    </p>
                    <p className="text-[10px] text-gray-400 mt-0.5">
                      {will.status === "will_review" || will.status === "completed" || will.status === "terminated" ? "completed" : "days left"}
                    </p>
                  </div>
                  <div>
                    <p className="text-xl font-bold text-gray-700">{`${checkInProgress?.successRate ?? 0}%`}</p>
                    <p className="text-[10px] text-gray-400 mt-0.5">
                      {will.status === "will_review" || will.status === "completed" || will.status === "terminated" ? "completed" : "on track"}
                    </p>
                  </div>
                </div>
                {hasDailyCheckIns && will.status === "active" && (
                  <button
                    onClick={() => setShowCheckInModal(true)}
                    className="w-full mt-3 py-4 rounded-2xl text-white font-semibold text-sm flex items-center justify-center gap-2 transition-all active:scale-[0.98]"
                    style={{ background: "linear-gradient(135deg, #2D9D78, #1e8a68)" }}
                    data-testid="button-daily-check-in"
                  >
                    <svg viewBox="0 0 24 24" className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="20 6 9 17 4 12" />
                    </svg>
                    Check in for today
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
              </div>
            )}
          </div>

          {/* ── Awaiting commitment (creator-only) ─────────────────── */}
          {will.createdBy === user?.id && awaitingCommitInvitees.length > 0 && (
            <div className="mb-3" data-testid="section-awaiting-commitment">
              <p className="text-[10px] font-semibold uppercase tracking-widest text-gray-400 mb-2">
                Awaiting commitment
              </p>
              <div className="bg-amber-50 border border-amber-100 rounded-2xl p-3 shadow-sm space-y-2">
                {awaitingCommitInvitees.map(inv => (
                  <div
                    key={inv.id}
                    className="flex items-center gap-3"
                    data-testid={`awaiting-commit-${inv.invitedUserId}`}
                  >
                    <div className="w-8 h-8 rounded-full bg-amber-200 flex items-center justify-center flex-shrink-0">
                      <span className="text-amber-800 text-xs font-semibold">
                        {(inv.firstName || '?').charAt(0).toUpperCase()}
                      </span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900 truncate">
                        {inv.firstName || 'Member'}
                      </p>
                      <p className="text-[11px] text-amber-700">
                        Accepted but hasn't set their commitment yet
                      </p>
                    </div>
                  </div>
                ))}
                <p className="text-[10px] text-amber-600/80 pt-1 border-t border-amber-100">
                  They'll be dropped automatically if they don't commit before the Will starts.
                </p>
              </div>
            </div>
          )}

          {/* ── Team Today section ─────────────────────────────────── */}
          {teamTodayData && teamTodayData.members.length > 1 && (
            <div className="mb-3" data-testid="section-team-today">
              <p className="text-[10px] font-semibold uppercase tracking-widest text-gray-400 mb-2">Team Today</p>
              <div className="bg-white border border-gray-100 rounded-2xl p-4 shadow-sm">
                <div className={`grid gap-3 ${teamTodayData.members.length === 1 ? "grid-cols-1 max-w-[120px] mx-auto" : teamTodayData.members.length === 2 ? "grid-cols-2" : "grid-cols-3"}`}>
                  {teamTodayData.members.map((m) => {
                    const isMe = m.userId === user?.id;
                    const cat = teamTodayData.category;

                    // Determine dot color and label from status
                    let dotClass = "bg-gray-300";
                    let dotLabel = "Pending";
                    if (cat === 'recurring') {
                      if (m.status === 'yes') { dotClass = "bg-emerald-500"; dotLabel = "Done"; }
                      else if (m.status === 'partial') { dotClass = "bg-amber-400"; dotLabel = "Partial"; }
                      else if (m.status === 'no') { dotClass = "bg-red-400"; dotLabel = "Missed"; }
                    } else if (cat === 'duration') {
                      if (m.status === 'honored') { dotClass = "bg-emerald-500"; dotLabel = "Honored"; }
                      else if (m.status === 'not-honored') { dotClass = "bg-red-400"; dotLabel = "Slipped"; }
                    } else if (cat === 'event') {
                      if (m.status === 'completed') { dotClass = "bg-emerald-500"; dotLabel = "Completed"; }
                    }

                    return (
                      <div key={m.userId} className="flex flex-col items-center" data-testid={`team-today-member-${m.userId}`}>
                        <div className="relative mb-1.5">
                          <div className="w-10 h-10 bg-gradient-to-br from-violet-500 to-purple-500 rounded-full flex items-center justify-center">
                            <span className="text-white font-semibold text-sm">
                              {m.firstName?.charAt(0)?.toUpperCase() || "?"}
                            </span>
                          </div>
                          <div
                            className={`absolute -bottom-0.5 -right-0.5 w-3 h-3 ${dotClass} rounded-full border-2 border-white`}
                            title={dotLabel}
                            data-testid={`team-today-dot-${m.userId}`}
                          />
                        </div>
                        <p className="text-xs font-medium text-gray-800 text-center leading-tight">
                          {m.firstName || "Member"}
                        </p>
                        {isMe && (
                          <p style={{ fontSize: '10px', color: '#aaa', marginTop: '2px' }}>You</p>
                        )}
                      </div>
                    );
                  })}
                </div>
                {/* Legend */}
                <div className="mt-3 pt-3 border-t border-gray-100 flex flex-wrap gap-3 justify-center">
                  {teamTodayData.category === 'recurring' && (
                    <>
                      <span className="flex items-center gap-1 text-[10px] text-gray-500"><span className="w-2 h-2 rounded-full bg-emerald-500 inline-block" />Done</span>
                      <span className="flex items-center gap-1 text-[10px] text-gray-500"><span className="w-2 h-2 rounded-full bg-amber-400 inline-block" />Partial</span>
                      <span className="flex items-center gap-1 text-[10px] text-gray-500"><span className="w-2 h-2 rounded-full bg-red-400 inline-block" />Missed</span>
                      <span className="flex items-center gap-1 text-[10px] text-gray-500"><span className="w-2 h-2 rounded-full bg-gray-300 inline-block" />Pending</span>
                    </>
                  )}
                  {teamTodayData.category === 'duration' && (
                    <>
                      <span className="flex items-center gap-1 text-[10px] text-gray-500"><span className="w-2 h-2 rounded-full bg-emerald-500 inline-block" />Honored</span>
                      <span className="flex items-center gap-1 text-[10px] text-gray-500"><span className="w-2 h-2 rounded-full bg-red-400 inline-block" />Slipped</span>
                      <span className="flex items-center gap-1 text-[10px] text-gray-500"><span className="w-2 h-2 rounded-full bg-gray-300 inline-block" />Pending</span>
                    </>
                  )}
                  {teamTodayData.category === 'event' && (
                    <>
                      <span className="flex items-center gap-1 text-[10px] text-gray-500"><span className="w-2 h-2 rounded-full bg-emerald-500 inline-block" />Completed</span>
                      <span className="flex items-center gap-1 text-[10px] text-gray-500"><span className="w-2 h-2 rounded-full bg-gray-300 inline-block" />In progress</span>
                    </>
                  )}
                </div>
              </div>
            </div>
          )}

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
                    className="flex items-center gap-1.5 text-white disabled:opacity-50 text-xs font-semibold px-3 py-1.5 rounded-full transition-all active:scale-95"
                    style={{ backgroundColor: "#2D9D78" }}
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

      {/* Daily Check-in Modal — habit and null-category wills with daily tracking */}
      {hasDailyCheckIns && (!category || category === 'recurring') && (
        <DailyCheckInModal
          isOpen={showCheckInModal}
          onClose={() => { setShowCheckInModal(false); setCheckInDate(null); }}
          willId={willId}
          startDate={will.startDate as unknown as string || ''}
          endDate={will.endDate as unknown as string || ''}
          existingCheckIns={checkIns}
          checkInType={userCheckInType}
          activeDays={(userCommitment as any)?.activeDays || will.activeDays || undefined}
          customDays={(userCommitment as any)?.customDays || will.customDays || undefined}
          initialDate={checkInDate}
        />
      )}
    </div>
  );
}
