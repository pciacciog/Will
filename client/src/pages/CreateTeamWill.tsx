import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { useLocation } from "wouter";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { apiRequest } from "@/lib/queryClient";
import { createDateTimeFromInputs } from "@/lib/dateUtils";
import { MobileLayout, PrimaryButton, UnifiedBackButton } from "@/components/ui/design-system";
import { ArrowRight, Check, Users, Target, Calendar, Clock, ClipboardList, MessageCircle, CalendarDays, CheckCircle, Heart, Search } from "lucide-react";
import TimeChipPicker from "@/components/TimeChipPicker";
import NotificationsSetup, { type NotificationsData } from "@/components/NotificationsSetup";

type Friend = {
  friendshipId: number;
  userId: string;
  firstName: string | null;
  lastName: string | null;
  username: string | null;
};

function getInitial(f: Friend) {
  return (f.firstName || f.username || "?")[0].toUpperCase();
}

function displayName(f: Friend) {
  if (f.firstName || f.lastName) return [f.firstName, f.lastName].filter(Boolean).join(" ");
  return f.username || "Unknown";
}

function getNextMondayDate(): string {
  const now = new Date();
  const d = now.getDay();
  const days = d === 0 ? 1 : d === 1 ? 0 : 8 - d;
  const m = new Date(now);
  m.setDate(now.getDate() + days);
  return `${m.getFullYear()}-${String(m.getMonth() + 1).padStart(2, "0")}-${String(m.getDate()).padStart(2, "0")}`;
}

function getFollowingSundayDate(monday: string): string {
  const [y, mo, d] = monday.split("-").map(Number);
  const base = new Date(y, mo - 1, d);
  base.setDate(base.getDate() + 6);
  return `${base.getFullYear()}-${String(base.getMonth() + 1).padStart(2, "0")}-${String(base.getDate()).padStart(2, "0")}`;
}

function formatDateForDisplay(dateStr: string) {
  const date = new Date(dateStr);
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" });
}

function formatDateShort(dateStr: string) {
  const date = new Date(dateStr);
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function getDurationText(startStr: string, endStr: string) {
  const days = Math.ceil((new Date(endStr).getTime() - new Date(startStr).getTime()) / (1000 * 60 * 60 * 24));
  if (days === 1) return "1 day";
  if (days < 7) return `${days} days`;
  if (days === 7) return "1 week";
  const weeks = Math.floor(days / 7), rem = days % 7;
  return rem === 0 ? `${weeks} week${weeks > 1 ? "s" : ""}` : `${weeks} week${weeks > 1 ? "s" : ""}, ${rem} day${rem > 1 ? "s" : ""}`;
}

export default function CreateTeamWill() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { user } = useAuth();

  // Step machine: 0=friends, 1=type, 2=what, 3=why, 4=when, 5=tracking, 6=review
  const [step, setStep] = useState(0);

  const [selectedFriendIds, setSelectedFriendIds] = useState<string[]>([]);
  const [willType, setWillType] = useState<"classic" | "cumulative">("classic");
  const [what, setWhat] = useState("");
  const [why, setWhy] = useState("");
  const [startDate, setStartDate] = useState(() => getNextMondayDate());
  const [startTime, setStartTime] = useState("00:00");
  const [endDate, setEndDate] = useState(() => getFollowingSundayDate(getNextMondayDate()));
  const [endTime, setEndTime] = useState("12:00");
  const [isIndefinite, setIsIndefinite] = useState(false);
  const [checkInType, setCheckInType] = useState<"daily" | "specific_days" | "final_review">("final_review");
  const [checkInTime, setCheckInTime] = useState("20:00");
  const [customDays, setCustomDays] = useState<number[]>([1, 2, 3, 4, 5]);
  const [whatCharCount, setWhatCharCount] = useState(0);
  const [friendSearch, setFriendSearch] = useState("");
  const [notificationsData, setNotificationsData] = useState<NotificationsData | null>(null);

  const whatRef = useRef<HTMLTextAreaElement>(null);
  const whyRef = useRef<HTMLTextAreaElement>(null);

  const resizeTextarea = useCallback((ref: React.RefObject<HTMLTextAreaElement>) => {
    const ta = ref.current;
    if (!ta) return;
    ta.style.height = "auto";
    ta.style.height = `${Math.min(ta.scrollHeight, 120)}px`;
  }, []);

  useEffect(() => { resizeTextarea(whatRef); }, [what, resizeTextarea]);
  useEffect(() => { resizeTextarea(whyRef); }, [why, resizeTextarea]);

  // Pre-select a friend passed via URL param (e.g. from friend profile page)
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const preId = params.get('preSelectedUserId');
    if (preId) {
      setSelectedFriendIds(prev => prev.includes(preId) ? prev : [...prev, preId]);
    }
  }, []);

  useEffect(() => {
    if (startDate && endDate) {
      const s = new Date(`${startDate}T${startTime || "00:00"}`);
      const e = new Date(`${endDate}T${endTime || "12:00"}`);
      if (e <= s) {
        const d = new Date(s);
        d.setDate(d.getDate() + 6);
        setEndDate(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`);
      }
    }
  }, [startDate, startTime]);

  const isShortDuration = useMemo(() => {
    if (isIndefinite || !startDate || !endDate || !startTime) return false;
    const s = new Date(`${startDate}T${startTime}`);
    const e = new Date(`${endDate}T${endTime || "23:59"}`);
    return e.getTime() - s.getTime() <= 24 * 60 * 60 * 1000;
  }, [startDate, startTime, endDate, endTime, isIndefinite]);

  const { data: friendsData, isLoading: friendsLoading } = useQuery<{ friends: Friend[] }>({
    queryKey: ["/api/friends"],
    enabled: !!user,
  });

  const friends = friendsData?.friends || [];

  const createWillMutation = useMutation({
    mutationFn: async (body: any) => {
      const r = await apiRequest("/api/wills", { method: "POST", body: JSON.stringify(body) });
      return r.json();
    },
    onSuccess: (will) => {
      queryClient.invalidateQueries({ queryKey: ["/api/wills/all-active"] });
      toast({ title: "Will Created!", description: "Your friends will receive an invite.", duration: 4000 });
      setLocation("/");
    },
    onError: (err: any) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  const goBack = () => {
    if (step === 0) setLocation("/");
    else setStep(step - 1);
  };

  const handleFriendToggle = (userId: string) => {
    setSelectedFriendIds(prev =>
      prev.includes(userId) ? prev.filter(id => id !== userId) : [...prev, userId]
    );
  };

  const handleStep0Next = () => {
    if (selectedFriendIds.length === 0) {
      toast({ title: "Select a friend", description: "Please select at least one friend.", variant: "destructive" });
      return;
    }
    setStep(1);
  };

  const handleStep2Next = (e: React.FormEvent) => {
    e.preventDefault();
    if (!what.trim()) {
      toast({ title: "Empty commitment", description: "Please describe what you will do.", variant: "destructive" });
      return;
    }
    setStep(3);
  };

  const handleStep3Next = (e: React.FormEvent) => {
    e.preventDefault();
    if (!why.trim()) {
      toast({ title: "Missing motivation", description: "Please explain why this matters.", variant: "destructive" });
      return;
    }
    setStep(4);
  };

  const handleStep4Next = (e: React.FormEvent) => {
    e.preventDefault();
    const s = new Date(`${startDate}T${startTime}`);
    if (s <= new Date()) {
      toast({ title: "Invalid start date", description: "Start date must be in the future.", variant: "destructive" });
      return;
    }
    if (!isIndefinite) {
      const en = new Date(`${endDate}T${endTime}`);
      if (en <= s) {
        toast({ title: "Invalid end date", description: "End date must be after start date.", variant: "destructive" });
        return;
      }
    }
    setStep(isShortDuration ? 6 : 5);
  };

  const handleStep5Next = (e: React.FormEvent) => {
    e.preventDefault();
    if (checkInType === "specific_days" && customDays.length === 0) {
      toast({ title: "No days selected", description: "Pick at least one day.", variant: "destructive" });
      return;
    }
    setStep(6);
  };

  const handleConfirm = () => {
    const startDateTime = createDateTimeFromInputs(startDate, startTime);
    const endDateTime = isIndefinite ? null : createDateTimeFromInputs(endDate, endTime);

    const resolvedCheckInType = isShortDuration ? "final_review" : (notificationsData?.checkInType ?? checkInType);
    const resolvedCheckInTime = notificationsData
      ? (notificationsData.checkInTime ?? undefined)
      : (checkInType !== "final_review" && !isShortDuration ? checkInTime : undefined);

    createWillMutation.mutate({
      mode: "team",
      willType,
      invitedFriendIds: selectedFriendIds,
      startDate: startDateTime,
      endDate: endDateTime,
      isIndefinite,
      what: willType === "cumulative" ? undefined : what,
      sharedWhat: willType === "cumulative" ? what : undefined,
      because: why,
      checkInType: resolvedCheckInType,
      checkInTime: resolvedCheckInTime,
      activeDays: "every_day",
      commitmentCategory: notificationsData?.commitmentCategory ?? undefined,
      milestones: notificationsData?.milestones ? JSON.stringify(notificationsData.milestones) : undefined,
      reminderTime: notificationsData?.reminderTime ?? undefined,
    });
  };

  const selectedFriends = friends.filter(f => selectedFriendIds.includes(f.userId));

  const stepLabel = ["Friends", "Type", "What", "Why", "When", "Tracking", "Review"][step];
  const totalSteps = 7;

  return (
    <div className="w-full max-w-screen-sm mx-auto overflow-x-hidden bg-gradient-to-br from-gray-50 via-white to-gray-50/50 min-h-screen">
      <MobileLayout>
        {/* Header */}
        <div className={`sticky top-0 z-10 bg-white border-b border-gray-100 pt-[calc(env(safe-area-inset-top)+1rem)] ${step === 6 ? "pb-2 mb-2" : "pb-4 mb-6"}`}>
          <div className="pt-4 space-y-3">
            <div className="relative flex items-center mb-2 min-h-[44px]">
              <UnifiedBackButton onClick={goBack} testId="button-back" />
              <span className="absolute left-0 right-0 text-center text-sm font-medium text-gray-500 pointer-events-none">
                Create Team Will
              </span>
              <div className="w-11 ml-auto" />
            </div>
            {/* Progress — only shown from step 2 onward (after Define your Will) */}
            {step >= 2 && step <= 4 && (
              <div className="flex items-center justify-center gap-1.5 mt-2">
                {["Type", "What", "Why", "When"].map((label, i) => (
                  <div key={i} className="flex items-center">
                    <div className={`flex items-center justify-center w-6 h-6 rounded-full text-[10px] font-semibold transition-colors ${
                      i < step - 1 ? "bg-violet-600 text-white" : i === step - 1 ? "bg-violet-600 text-white" : "bg-gray-200 text-gray-500"
                    }`}>
                      {i < step - 1 ? <Check className="w-3 h-3" /> : i + 1}
                    </div>
                    {i < 3 && <div className={`w-4 h-0.5 mx-0.5 ${i < step - 1 ? "bg-violet-600" : "bg-gray-200"}`} />}
                  </div>
                ))}
              </div>
            )}
          </div>
          {step > 1 && step < 6 && (
          <div className="text-center mt-3">
            <h1 className="text-xl font-semibold text-gray-900">
              {step === 2 && "What would you like to do?"}
              {step === 3 && "Why would you like to do this?"}
              {step === 4 && "Set Your Timeline"}
              {step === 5 && "Notifications"}
            </h1>
            <p className="text-sm text-gray-400 mt-1">
              {step === 2 && (willType === "cumulative" ? "This commitment is shared by everyone" : "Cause it's as simple as wanting.")}
              {step === 3 && "Remember this when it gets tough."}
              {step === 4 && "When will your Will begin and end?"}
              {step === 5 && what && `"${what}"`}
            </p>
          </div>
          )}
        </div>

        <div className="flex-1 space-y-6">

          {/* Step 0: Friend picker */}
          {step === 0 && (
            <div className="animate-in fade-in duration-300">
              {/* Page heading — large, left-aligned, lives in page body not sticky header */}
              <div className="mb-5">
                <h1 className="text-[28px] font-bold text-gray-900 leading-tight">Build your team</h1>
                <p className="text-[14px] text-gray-500 mt-0.5">Who's committing with you?</p>
              </div>

              {friendsLoading ? (
                <div className="flex items-center justify-center py-12">
                  <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-violet-600" />
                </div>
              ) : friends.length === 0 ? (
                <div className="text-center py-12">
                  <div className="w-14 h-14 rounded-full bg-violet-50 flex items-center justify-center mx-auto mb-4">
                    <Users className="w-7 h-7 text-violet-400" />
                  </div>
                  <p className="text-gray-600 font-medium mb-1">No friends yet</p>
                  <p className="text-gray-400 text-sm mb-5">Add friends first to create a Team Will</p>
                  <Button onClick={() => setLocation("/friends")} className="bg-violet-600 hover:bg-violet-700 text-white">
                    Go to Friends
                  </Button>
                </div>
              ) : (
                <>
                  {/* Search bar */}
                  <div className="mb-3">
                    <Input
                      value={friendSearch}
                      onChange={e => setFriendSearch(e.target.value)}
                      placeholder="Search friends"
                      className="h-11 px-4 rounded-xl border-gray-200 bg-white focus:border-violet-400 focus:ring-violet-400/20"
                      data-testid="input-search-friends-picker"
                    />
                  </div>

                  {/* Selected chips row */}
                  {selectedFriendIds.length > 0 && (
                    <div className="flex gap-2 overflow-x-auto pb-2 mb-3 scrollbar-hide">
                      {selectedFriends.map(f => (
                        <button
                          key={f.userId}
                          onClick={() => handleFriendToggle(f.userId)}
                          className="flex-shrink-0 flex items-center gap-1.5 px-3 py-1.5 bg-violet-100 text-violet-700 rounded-full text-sm font-medium hover:bg-violet-200 transition-colors"
                          data-testid={`chip-selected-${f.userId}`}
                        >
                          {(f.firstName || f.username || "?").split(" ")[0]}
                          <span className="text-violet-500 text-xs leading-none">×</span>
                        </button>
                      ))}
                    </div>
                  )}

                  {/* Friends list */}
                  <div className="space-y-2 px-1">
                    {friends
                      .filter(f => {
                        if (!friendSearch.trim()) return true;
                        const q = friendSearch.toLowerCase();
                        return (
                          (f.firstName?.toLowerCase().includes(q)) ||
                          (f.lastName?.toLowerCase().includes(q)) ||
                          (f.username?.toLowerCase().includes(q))
                        );
                      })
                      .map(friend => {
                        const selected = selectedFriendIds.includes(friend.userId);
                        return (
                          <button
                            key={friend.userId}
                            onClick={() => handleFriendToggle(friend.userId)}
                            className="w-full flex items-center gap-3 p-4 rounded-2xl transition-all duration-150"
                            style={selected
                              ? { background: "#F3EAFE", border: "1.5px solid #9B5CE5" }
                              : { background: "#fff", border: "1.5px solid #C7C7CC" }
                            }
                            data-testid={`button-friend-${friend.userId}`}
                          >
                            <div
                              className="w-10 h-10 rounded-full flex items-center justify-center font-semibold text-sm flex-shrink-0 transition-colors"
                              style={selected
                                ? { background: "#9B5CE5", color: "#fff" }
                                : { background: "#F3F4F6", color: "#6B7280" }
                              }
                            >
                              {getInitial(friend)}
                            </div>
                            <div className="flex-1 text-left min-w-0">
                              <p className="text-sm font-medium text-gray-900 truncate">{displayName(friend)}</p>
                              {friend.username && <p className="text-xs text-gray-400">@{friend.username}</p>}
                            </div>
                            {/* Square checkbox */}
                            <div
                              className="w-5 h-5 flex items-center justify-center flex-shrink-0 transition-all"
                              style={selected
                                ? { background: "#9B5CE5", borderRadius: 5, border: "1.5px solid #9B5CE5" }
                                : { background: "transparent", borderRadius: 5, border: "1.5px solid #C7C7CC" }
                              }
                            >
                              {selected && <Check className="w-3 h-3 text-white" />}
                            </div>
                          </button>
                        );
                      })}
                  </div>
                </>
              )}

              {/* Bottom bar */}
              {friends.length > 0 && (
                <div className="flex justify-between items-center pt-4 pb-2 border-t border-gray-100 mt-4">
                  <span className="text-sm text-gray-500">
                    {selectedFriendIds.length === 0 ? "Select friends" : `${selectedFriendIds.length} selected`}
                  </span>
                  <button
                    onClick={handleStep0Next}
                    disabled={selectedFriendIds.length === 0}
                    className="px-6 py-3 rounded-xl text-sm font-semibold flex items-center transition-all active:scale-95"
                    style={selectedFriendIds.length === 0
                      ? { background: "#F3F4F6", color: "#9CA3AF", cursor: "not-allowed" }
                      : { background: "#2D9D78", color: "#fff" }
                    }
                    data-testid="button-next-friends"
                  >
                    Next <ArrowRight className="w-4 h-4 ml-2" />
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Step 1: Define your Will */}
          {step === 1 && (
            <div className="animate-in fade-in duration-300 flex flex-col">
              {/* Heading */}
              <div className="mb-4">
                <h1 className="text-[26px] font-bold text-gray-900 leading-tight">Define your Will</h1>
                <p className="text-[14px] text-gray-500 mt-0.5">How will your team commit?</p>
              </div>

              <div className="flex flex-col gap-3">
                {/* I Will card */}
                <button
                  onClick={() => setWillType("classic")}
                  className="w-full text-left rounded-2xl p-4 transition-all duration-150 active:scale-[0.98]"
                  style={willType === "classic"
                    ? { background: "#E8F5F0", border: "2px solid #2D9D78" }
                    : { background: "#F5F5F7", border: "2px solid #D1D5DB" }
                  }
                  data-testid="button-type-i-will"
                >
                  <div className="flex items-start gap-3">
                    <div
                      className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
                      style={{ background: willType === "classic" ? "#2D9D78" : "#D1D5DB" }}
                    >
                      <svg viewBox="0 0 24 24" style={{ width: 20, height: 20 }} fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <circle cx="12" cy="12" r="10" /><circle cx="12" cy="12" r="6" /><circle cx="12" cy="12" r="2" />
                      </svg>
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="text-base font-bold mb-0.5" style={{ color: willType === "classic" ? "#1A6647" : "#9CA3AF" }}>I Will</h3>
                      <p className="text-sm leading-snug" style={{ color: willType === "classic" ? "#2D6B52" : "#9CA3AF" }}>
                        Each member pursues their own individual commitment.
                      </p>
                    </div>
                  </div>
                  {willType === "classic" && (
                    <div className="mt-3 rounded-xl p-2.5 space-y-1.5 pointer-events-none" style={{ background: "rgba(255,255,255,0.7)" }}>
                      {[
                        { initial: "J", name: "Jack", commitment: "run 3x this week" },
                        { initial: "J", name: "Joe",  commitment: "read 20 pages daily" },
                        { initial: "A", name: "Alex", commitment: "no phone after 9pm" },
                      ].map((row, i) => (
                        <div key={i} className="flex items-center gap-2">
                          <div className="w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0" style={{ background: "#2D9D78" }}>
                            <span style={{ color: "#fff", fontSize: 9, fontWeight: 700 }}>{row.initial}</span>
                          </div>
                          <span style={{ fontSize: 11, color: "#1A6647", fontWeight: 500 }}>{row.name}</span>
                          <span style={{ fontSize: 11, color: "#2D9D78" }}>—</span>
                          <span style={{ fontSize: 11, color: "#4B7A6A" }}>{row.commitment}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </button>

                {/* We Will card */}
                <button
                  onClick={() => setWillType("cumulative")}
                  className="w-full text-left rounded-2xl p-4 transition-all duration-150 active:scale-[0.98]"
                  style={willType === "cumulative"
                    ? { background: "#F3EAFE", border: "2px solid #9B5CE5" }
                    : { background: "#F5F5F7", border: "2px solid #D1D5DB" }
                  }
                  data-testid="button-type-we-will"
                >
                  <div className="flex items-start gap-3">
                    <div
                      className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
                      style={{ background: willType === "cumulative" ? "#9B5CE5" : "#D1D5DB" }}
                    >
                      <svg viewBox="0 0 24 24" style={{ width: 20, height: 20 }} fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" />
                        <path d="M23 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" />
                      </svg>
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="text-base font-bold mb-0.5" style={{ color: willType === "cumulative" ? "#4A1D8C" : "#9CA3AF" }}>We Will</h3>
                      <p className="text-sm leading-snug" style={{ color: willType === "cumulative" ? "#6B3FA8" : "#9CA3AF" }}>
                        Every member pursues the same commitment.
                      </p>
                    </div>
                  </div>
                  {willType === "cumulative" && (
                    <div className="mt-3 rounded-xl p-2.5 space-y-1.5 pointer-events-none" style={{ background: "rgba(255,255,255,0.7)" }}>
                      <div className="flex justify-center mb-1">
                        <span className="px-2.5 py-0.5 rounded-full italic" style={{ background: "rgba(155,92,229,0.15)", color: "#4A1D8C", fontSize: 11, fontWeight: 500 }}>
                          "Go phone free for 24 hours"
                        </span>
                      </div>
                      {[
                        { initial: "J", name: "Jack" },
                        { initial: "J", name: "Joe" },
                        { initial: "A", name: "Alex" },
                      ].map((row, i) => (
                        <div key={i} className="flex items-center gap-2">
                          <div className="w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0" style={{ background: "#9B5CE5" }}>
                            <span style={{ color: "#fff", fontSize: 9, fontWeight: 700 }}>{row.initial}</span>
                          </div>
                          <span className="flex-1" style={{ fontSize: 11, color: "#4A1D8C", fontWeight: 500 }}>{row.name}</span>
                          <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: "#2D9D78" }} />
                        </div>
                      ))}
                    </div>
                  )}
                </button>
              </div>

              {/* Continue button — adopts selection color */}
              <div className="pt-4 pb-2 border-t border-gray-100 mt-4">
                <button
                  onClick={() => setStep(2)}
                  className="w-full py-3.5 rounded-xl text-sm font-semibold text-white flex items-center justify-center transition-all active:scale-95"
                  style={{ background: willType === "classic" ? "#2D9D78" : "#9B5CE5" }}
                  data-testid="button-continue-type"
                >
                  Continue
                  <svg viewBox="0 0 24 24" style={{ width: 16, height: 16, marginLeft: 8 }} fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <line x1="5" y1="12" x2="19" y2="12" /><polyline points="12 5 19 12 12 19" />
                  </svg>
                </button>
              </div>
            </div>
          )}

          {/* Step 2: What */}
          {step === 2 && (
            <div className="animate-in fade-in duration-500">
              <form onSubmit={handleStep2Next} className="flex flex-col">
                <div className="flex flex-col pt-4 pb-6">
                  <div className="space-y-4">
                    <p className="text-3xl font-bold text-gray-900 text-center tracking-tight">
                      {willType === "cumulative" ? "We Will" : "I Will"}
                    </p>
                    <div className="flex justify-center">
                      {willType === "cumulative" ? (
                        <div className="w-10 h-10 rounded-full flex items-center justify-center" style={{ background: "#9B5CE5" }}>
                          <Users className="w-6 h-6 text-white" />
                        </div>
                      ) : (
                        <div className="w-10 h-10 bg-green-500 rounded-full flex items-center justify-center">
                          <CheckCircle className="w-6 h-6 text-white" />
                        </div>
                      )}
                    </div>
                    <div className="relative px-2">
                      <Textarea
                        ref={whatRef}
                        required
                        rows={2}
                        maxLength={75}
                        value={what}
                        onChange={(e) => { setWhat(e.target.value); setWhatCharCount(e.target.value.length); resizeTextarea(whatRef); }}
                        className="w-full text-center text-xl leading-relaxed font-normal text-gray-700 bg-transparent border-0 border-b-2 border-gray-200 focus:border-violet-400 focus:ring-0 resize-none placeholder:text-gray-300 placeholder:italic py-3 px-4"
                        style={{ minHeight: "72px", maxHeight: "120px" }}
                        placeholder={willType === "cumulative" ? "go phone free for 24 hours" : "call my grandmother this week"}
                        data-testid="input-what"
                      />
                    </div>
                    <p className="text-xs text-gray-400 text-center">{whatCharCount} / 75</p>
                  </div>
                </div>
                <div className="flex justify-end items-center pt-4 pb-2 border-t border-gray-100">
                  <PrimaryButton data-testid="button-next-what">
                    Next <ArrowRight className="w-4 h-4 ml-2" />
                  </PrimaryButton>
                </div>
              </form>
            </div>
          )}

          {/* Step 3: Why */}
          {step === 3 && (
            <div className="animate-in fade-in duration-500">
              <form onSubmit={handleStep3Next} className="flex flex-col">
                <div className="flex flex-col pt-4 pb-6">
                  <div className="space-y-4">
                    <div className="flex justify-center">
                      <div className="w-10 h-10 bg-red-500 rounded-full flex items-center justify-center">
                        <Heart className="w-6 h-6 text-white" />
                      </div>
                    </div>
                    <p className="text-sm text-gray-400 text-center italic mb-4">This is private — only you can see it</p>
                    <div className="relative px-2">
                      <Textarea
                        ref={whyRef}
                        name="why"
                        required
                        rows={3}
                        maxLength={200}
                        value={why}
                        onChange={(e) => { setWhy(e.target.value); resizeTextarea(whyRef); }}
                        className="w-full text-center text-base leading-relaxed text-gray-700 bg-transparent border-0 border-b-2 border-gray-200 focus:border-violet-400 focus:ring-0 resize-none placeholder:text-gray-300 placeholder:italic py-3 px-4"
                        style={{ minHeight: "80px", maxHeight: "150px" }}
                        placeholder="Because it will make me feel…"
                        data-testid="input-why"
                      />
                    </div>
                  </div>
                </div>
                <div className="flex justify-end items-center pt-4 pb-2 border-t border-gray-100">
                  <PrimaryButton data-testid="button-next-why">
                    Next <ArrowRight className="w-4 h-4 ml-2" />
                  </PrimaryButton>
                </div>
              </form>
            </div>
          )}

          {/* Step 4: When */}
          {step === 4 && (
            <div className="animate-in fade-in duration-500">
              <form onSubmit={handleStep4Next} className="flex flex-col">
                <div className="flex-1 flex flex-col justify-center py-2">
                  <div className="flex justify-center gap-2 mb-6">
                    <button type="button" onClick={() => setIsIndefinite(false)} className={`px-4 py-2 rounded-full text-sm font-medium transition-all ${!isIndefinite ? "bg-blue-500 text-white shadow-md" : "bg-gray-100 text-gray-600"}`} data-testid="button-duration-defined">Set dates</button>
                    <button type="button" onClick={() => setIsIndefinite(true)} className={`px-4 py-2 rounded-full text-sm font-medium transition-all ${isIndefinite ? "bg-blue-500 text-white shadow-md" : "bg-gray-100 text-gray-600"}`} data-testid="button-duration-indefinite">Ongoing</button>
                  </div>
                  <div className="space-y-5 px-4">
                    <div>
                      <p className="text-xs font-medium text-gray-400 uppercase tracking-widest mb-2">Start</p>
                      <div className="flex items-center gap-3">
                        <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} min={(() => { const t = new Date(); return `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, "0")}-${String(t.getDate()).padStart(2, "0")}`; })()} required className="flex-1 text-sm bg-white border border-gray-200 rounded-lg px-3 py-2" data-testid="input-start-date" />
                        <TimeChipPicker value={startTime} onChange={setStartTime} testId="input-start-time" />
                      </div>
                    </div>
                    {!isIndefinite && (
                      <>
                        <div className="flex justify-center"><div className="w-px h-3 bg-gray-200" /></div>
                        <div>
                          <p className="text-xs font-medium text-gray-400 uppercase tracking-widest mb-2">End</p>
                          <div className="flex items-center gap-3">
                            <Input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} min={startDate} required className="flex-1 text-sm bg-white border border-gray-200 rounded-lg px-3 py-2" data-testid="input-end-date" />
                            <TimeChipPicker value={endTime} onChange={setEndTime} testId="input-end-time" />
                          </div>
                        </div>
                      </>
                    )}
                    {isIndefinite && <p className="text-xs text-gray-400 text-center italic pt-4">You can pause or end this Will at any time</p>}
                  </div>
                </div>
                <div className="flex justify-end items-center pt-4 pb-2 border-t border-gray-100">
                  <PrimaryButton data-testid="button-next-timeline">
                    Next <ArrowRight className="w-4 h-4 ml-2" />
                  </PrimaryButton>
                </div>
              </form>
            </div>
          )}

          {/* Step 5: Notifications Setup */}
          {step === 5 && (
            <NotificationsSetup
              what={willType === "cumulative" ? what : what}
              because={why}
              onComplete={(data) => {
                setNotificationsData(data);
                setCheckInType(data.checkInType);
                setStep(6);
              }}
              onBack={() => setStep(4)}
            />
          )}

          {/* Step 6: Review */}
          {step === 6 && (
            <div className="animate-in fade-in duration-500">
              {/* Page heading */}
              <div className="mb-2">
                <h1 className="text-[18px] font-semibold text-gray-900 leading-tight">Review your Will</h1>
                <p className="text-[13px] text-gray-500 mt-0.5">Make sure everything looks right.</p>
              </div>

              {/* Review rows */}
              <div className="bg-white border border-gray-100 rounded-2xl divide-y divide-gray-100 shadow-sm">
                {/* Team */}
                <div className="flex items-start gap-2.5 px-3 py-2">
                  <div className="w-7 h-7 rounded-md bg-violet-50 flex items-center justify-center flex-shrink-0 mt-0.5">
                    <Users className="w-3.5 h-3.5 text-violet-500" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[11px] font-medium text-gray-400">Team</p>
                    <div className="mt-0.5 space-y-0.5" data-testid="text-confirm-friends">
                      <p className="text-sm font-medium text-gray-900">
                        {user
                          ? [user.firstName, user.lastName].filter(Boolean).join(" ") || user.username || "You"
                          : "You"}{" "}
                        <span className="text-xs text-gray-400 font-normal">(you)</span>
                      </p>
                      {selectedFriends.map(f => (
                        <p key={f.userId} className="text-sm font-medium text-gray-900">{displayName(f)}</p>
                      ))}
                    </div>
                  </div>
                </div>
                {/* What */}
                <div className="flex items-start gap-2.5 px-3 py-2">
                  <div className="w-7 h-7 rounded-md bg-emerald-50 flex items-center justify-center flex-shrink-0 mt-0.5">
                    <ClipboardList className="w-3.5 h-3.5 text-emerald-500" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[11px] font-medium text-gray-400">What</p>
                    <p className="text-sm font-medium text-gray-900 mt-0.5" data-testid="text-confirm-what">
                      {willType === "cumulative" ? "We Will" : "I Will"} {what}
                    </p>
                  </div>
                </div>
                {/* Why */}
                <div className="flex items-start gap-2.5 px-3 py-2">
                  <div className="w-7 h-7 rounded-md bg-blue-50 flex items-center justify-center flex-shrink-0 mt-0.5">
                    <MessageCircle className="w-3.5 h-3.5 text-blue-500" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[11px] font-medium text-gray-400">Why · private</p>
                    <p className="text-sm text-gray-700 mt-0.5" data-testid="text-confirm-why">{why}</p>
                  </div>
                </div>
                {/* Timeline */}
                <div className="flex items-start gap-2.5 px-3 py-2">
                  <div className="w-7 h-7 rounded-md bg-amber-50 flex items-center justify-center flex-shrink-0 mt-0.5">
                    <Calendar className="w-3.5 h-3.5 text-amber-500" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[11px] font-medium text-gray-400">Timeline</p>
                    {isIndefinite ? (
                      <p className="text-sm text-gray-700 mt-0.5">Ongoing (no end date)</p>
                    ) : (
                      <p className="text-sm text-gray-700 mt-0.5">
                        {formatDateShort(createDateTimeFromInputs(startDate, startTime))} → {formatDateShort(createDateTimeFromInputs(endDate, endTime))}, {new Date(createDateTimeFromInputs(endDate, endTime)).getFullYear()} · {getDurationText(createDateTimeFromInputs(startDate, startTime), createDateTimeFromInputs(endDate, endTime))}
                      </p>
                    )}
                  </div>
                </div>
                {/* Notifications */}
                {notificationsData?.commitmentCategory && (
                  <div className="flex items-start gap-2.5 px-3 py-2">
                    <div className="w-7 h-7 rounded-md bg-gray-50 flex items-center justify-center flex-shrink-0 mt-0.5">
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ width: 14, height: 14, color: '#7B3FC4' }}>
                        <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
                        <path d="M13.73 21a2 2 0 0 1-3.46 0" />
                      </svg>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-[11px] font-medium text-gray-400">Notifications</p>
                      <p className="text-sm text-gray-700 mt-0.5" data-testid="text-confirm-notifications">
                        {notificationsData.commitmentCategory === 'habit' ? 'Habit' : notificationsData.commitmentCategory === 'abstain' ? 'Abstain' : 'Mission'}
                      </p>
                    </div>
                  </div>
                )}
              </div>

              {/* Disclaimer */}
              <p className="text-[12px] text-gray-400 text-center mt-2 leading-relaxed px-2">
                Your team will be notified and can accept until the start date.
              </p>

              {/* CTA */}
              <div className="pt-2">
                <button
                  onClick={handleConfirm}
                  disabled={createWillMutation.isPending}
                  className={`w-full py-3 rounded-2xl text-[15px] font-semibold flex items-center justify-center transition-all ${
                    createWillMutation.isPending
                      ? "bg-gray-200 text-gray-400 cursor-not-allowed"
                      : "bg-emerald-500 hover:bg-emerald-600 text-white shadow-sm active:scale-[0.98]"
                  }`}
                  data-testid="button-create-will"
                >
                  {createWillMutation.isPending ? "Creating..." : "Create Will →"}
                </button>
              </div>
            </div>
          )}

        </div>
      </MobileLayout>
    </div>
  );
}
