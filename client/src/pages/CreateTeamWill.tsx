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
      checkInType: isShortDuration ? "final_review" : checkInType,
      checkInTime: checkInType !== "final_review" && !isShortDuration ? checkInTime : undefined,
      activeDays: checkInType === "specific_days" ? "custom" : checkInType === "daily" ? "every_day" : undefined,
      customDays: checkInType === "specific_days" ? JSON.stringify(customDays) : undefined,
    });
  };

  const selectedFriends = friends.filter(f => selectedFriendIds.includes(f.userId));

  const stepLabel = ["Friends", "Type", "What", "Why", "When", "Tracking", "Review"][step];
  const totalSteps = 7;

  return (
    <div className="w-full max-w-screen-sm mx-auto overflow-x-hidden bg-gradient-to-br from-gray-50 via-white to-gray-50/50 min-h-screen">
      <MobileLayout>
        {/* Header */}
        <div className="sticky top-0 z-10 bg-white border-b border-gray-100 pb-4 mb-6 pt-[calc(env(safe-area-inset-top)+1rem)]">
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
          {step > 1 && (
          <div className="text-center mt-3">
            <h1 className="text-xl font-semibold text-gray-900">
              {step === 2 && (willType === "cumulative" ? "What will you all do?" : "What will you do?")}
              {step === 3 && "Why does this matter?"}
              {step === 4 && "Set Your Timeline"}
              {step === 5 && "Tracking"}
              {step === 6 && "Review Your Will"}
            </h1>
            <p className="text-sm text-gray-400 mt-1">
              {step === 2 && (willType === "cumulative" ? "This commitment is shared by everyone" : "Cause it's as simple as wanting.")}
              {step === 3 && "Remember this when it gets tough."}
              {step === 4 && "When will your Will begin and end?"}
              {step === 5 && "When should we check in with you?"}
              {step === 6 && "Make sure everything looks right."}
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
                  <div className="relative mb-3">
                    <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
                    <Input
                      value={friendSearch}
                      onChange={e => setFriendSearch(e.target.value)}
                      placeholder="Search friends"
                      className="pl-10 h-11 rounded-xl border-gray-200 bg-white focus:border-violet-400 focus:ring-violet-400/20"
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
                            className={`w-full flex items-center gap-3 p-4 rounded-2xl border-2 transition-all duration-150 ${
                              selected
                                ? "border-violet-400 bg-violet-50"
                                : "border-gray-100 bg-white hover:border-gray-200"
                            }`}
                            data-testid={`button-friend-${friend.userId}`}
                          >
                            <div className={`w-10 h-10 rounded-full flex items-center justify-center font-semibold text-sm flex-shrink-0 transition-colors ${
                              selected ? "bg-violet-600 text-white" : "bg-gray-100 text-gray-500"
                            }`}>
                              {getInitial(friend)}
                            </div>
                            <div className="flex-1 text-left min-w-0">
                              <p className="text-sm font-medium text-gray-900 truncate">{displayName(friend)}</p>
                              {friend.username && <p className="text-xs text-gray-400">@{friend.username}</p>}
                            </div>
                            {/* Square checkbox */}
                            <div className={`w-5 h-5 rounded-sm border-2 flex items-center justify-center flex-shrink-0 transition-all ${
                              selected ? "border-violet-500 bg-violet-500" : "border-gray-300 bg-white"
                            }`}>
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
                    className={`px-6 py-3 rounded-xl text-sm font-semibold flex items-center transition-all ${
                      selectedFriendIds.length === 0
                        ? "bg-gray-100 text-gray-400 cursor-not-allowed"
                        : "bg-emerald-500 hover:bg-emerald-600 text-white shadow-sm active:scale-95"
                    }`}
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
            <div className="animate-in fade-in duration-300">
              {/* Page heading — matches "Build your team" style */}
              <div className="mb-6">
                <h1 className="text-[28px] font-bold text-gray-900 leading-tight">Define your Will</h1>
                <p className="text-[14px] text-gray-500 mt-0.5">How will your team commit?</p>
              </div>

              <div className="flex flex-col gap-4">
                {/* I Will card */}
                <button
                  onClick={() => { setWillType("classic"); setStep(2); }}
                  className="w-full text-left rounded-2xl p-6 transition-all duration-150 active:scale-[0.98]"
                  style={{ background: "#E8F5F0", border: "2px solid #2D9D78" }}
                  data-testid="button-type-i-will"
                >
                  <div className="w-12 h-12 rounded-xl flex items-center justify-center mb-4" style={{ background: "#2D9D78" }}>
                    <Target className="w-6 h-6 text-white" strokeWidth={1.5} />
                  </div>
                  <h3 className="text-2xl font-bold mb-2" style={{ color: "#1A6647" }}>I Will</h3>
                  <p className="text-[15px] leading-snug" style={{ color: "#1A6647" }}>
                    Each member pursues their own individual commitment.
                  </p>
                </button>

                {/* We Will card */}
                <button
                  onClick={() => { setWillType("cumulative"); setStep(2); }}
                  className="w-full text-left rounded-2xl p-6 transition-all duration-150 active:scale-[0.98]"
                  style={{ background: "#F3EAFE", border: "2px solid #9B5CE5" }}
                  data-testid="button-type-we-will"
                >
                  <div className="w-12 h-12 rounded-xl flex items-center justify-center mb-4" style={{ background: "#9B5CE5" }}>
                    <Users className="w-6 h-6 text-white" strokeWidth={1.5} />
                  </div>
                  <h3 className="text-2xl font-bold mb-2" style={{ color: "#4A1D8C" }}>We Will</h3>
                  <p className="text-[15px] leading-snug" style={{ color: "#4A1D8C" }}>
                    Every member pursues the same commitment.
                  </p>
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
                    <button type="button" onClick={() => setIsIndefinite(true)} className={`px-4 py-2 rounded-full text-sm font-medium transition-all ${isIndefinite ? "bg-blue-500 text-white shadow-md" : "bg-gray-100 text-gray-600"}`} data-testid="button-duration-indefinite">Habit</button>
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

          {/* Step 5: Tracking */}
          {step === 5 && (
            <div className="animate-in fade-in duration-500">
              <form onSubmit={handleStep5Next} className="flex flex-col">
                <div className="flex-1 flex flex-col py-4 px-4">
                  <div className="space-y-3">
                    {(["daily", "specific_days", "final_review"] as const).map((type) => (
                      <button key={type} type="button" onClick={() => setCheckInType(type)} className={`w-full text-left rounded-xl border-2 p-4 transition-all duration-200 ${checkInType === type ? "border-blue-500 bg-blue-50/50 shadow-sm" : "border-gray-200 bg-white hover:border-gray-300"}`} data-testid={`button-checkin-${type}`}>
                        <div className="flex items-center gap-3">
                          <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0 ${checkInType === type ? "border-blue-500" : "border-gray-300"}`}>
                            {checkInType === type && <div className="w-2.5 h-2.5 rounded-full bg-blue-500" />}
                          </div>
                          <div>
                            <p className="text-sm font-semibold text-gray-900">{type === "daily" ? "Every Day" : type === "specific_days" ? "Specific Days" : "Final Review Only"}</p>
                            <p className="text-xs text-gray-500 mt-0.5">{type === "daily" ? "Check in every day at a chosen time" : type === "specific_days" ? "Pick which days of the week to check in" : "No daily check-ins — just review at the end"}</p>
                          </div>
                        </div>
                      </button>
                    ))}
                  </div>
                  {checkInType === "specific_days" && (
                    <div className="mt-5">
                      <p className="text-xs font-medium text-gray-400 uppercase tracking-widest text-center mb-3">Select Days</p>
                      <div className="flex justify-center gap-1.5">
                        {["S","M","T","W","T","F","S"].map((day, i) => (
                          <button key={i} type="button" onClick={() => setCustomDays(p => p.includes(i) ? p.filter(d => d !== i) : [...p, i].sort())} className={`w-9 h-9 rounded-full text-xs font-medium transition-all flex items-center justify-center leading-none ${customDays.includes(i) ? "bg-blue-500 text-white" : "bg-gray-100 text-gray-500 hover:bg-gray-200"}`} data-testid={`button-day-${i}`}>{day}</button>
                        ))}
                      </div>
                    </div>
                  )}
                  {checkInType !== "final_review" && (
                    <div className="mt-5">
                      <p className="text-xs font-medium text-gray-400 uppercase tracking-widest text-center mb-3">Check-In Time</p>
                      <div className="flex justify-center">
                        <TimeChipPicker value={checkInTime} onChange={setCheckInTime} testId="input-check-in-time" />
                      </div>
                    </div>
                  )}
                </div>
                <div className="flex justify-end items-center pt-4 pb-2 border-t border-gray-100">
                  <button type="submit" className="px-6 py-3 rounded-xl text-sm font-medium bg-gradient-to-r from-violet-500 to-purple-500 text-white hover:from-violet-600 hover:to-purple-600 shadow-sm flex items-center" data-testid="button-review-will">
                    Review <ArrowRight className="w-4 h-4 ml-2" />
                  </button>
                </div>
              </form>
            </div>
          )}

          {/* Step 6: Review */}
          {step === 6 && (
            <div className="animate-in fade-in duration-500">
              <div className="flex flex-col px-4">
                <div className="space-y-4">
                  <div className="bg-gray-50 rounded-xl p-4 space-y-4">
                    {/* Friends */}
                    <div className="flex items-start gap-3">
                      <Users className="w-5 h-5 text-violet-600 mt-0.5 flex-shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-medium text-gray-400 uppercase tracking-wide">Invited Friends</p>
                        <p className="text-sm font-medium text-gray-900 mt-0.5" data-testid="text-confirm-friends">
                          {selectedFriends.map(displayName).join(", ")}
                        </p>
                      </div>
                    </div>
                    <div className="border-t border-gray-200" />
                    {/* What */}
                    <div className="flex items-start gap-3">
                      <ClipboardList className="w-5 h-5 text-emerald-600 mt-0.5 flex-shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-medium text-gray-400 uppercase tracking-wide">What</p>
                        <p className="text-sm font-medium text-gray-900 mt-0.5" data-testid="text-confirm-what">
                          {willType === "cumulative" ? "We Will" : "I Will"} {what}
                        </p>
                      </div>
                    </div>
                    <div className="border-t border-gray-200" />
                    {/* Why */}
                    <div className="flex items-start gap-3">
                      <MessageCircle className="w-5 h-5 text-red-500 mt-0.5 flex-shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-medium text-gray-400 uppercase tracking-wide">Why (private)</p>
                        <p className="text-sm text-gray-700 mt-0.5" data-testid="text-confirm-why">{why}</p>
                      </div>
                    </div>
                    <div className="border-t border-gray-200" />
                    {/* Timeline */}
                    <div className="flex items-start gap-3">
                      <Calendar className="w-5 h-5 text-blue-600 mt-0.5 flex-shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-medium text-gray-400 uppercase tracking-wide">Timeline</p>
                        {isIndefinite ? (
                          <p className="text-sm text-gray-700 mt-0.5">Habit</p>
                        ) : (
                          <div className="mt-0.5">
                            <p className="text-sm text-gray-700">{formatDateForDisplay(createDateTimeFromInputs(startDate, startTime))} — {formatDateForDisplay(createDateTimeFromInputs(endDate, endTime))}</p>
                            <p className="text-xs text-gray-400 mt-0.5">{getDurationText(createDateTimeFromInputs(startDate, startTime), createDateTimeFromInputs(endDate, endTime))}</p>
                          </div>
                        )}
                      </div>
                    </div>
                    <div className="border-t border-gray-200" />
                    {/* Tracking */}
                    <div className="flex items-start gap-3">
                      <CalendarDays className="w-5 h-5 text-indigo-600 mt-0.5 flex-shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-medium text-gray-400 uppercase tracking-wide">Tracking</p>
                        <p className="text-sm text-gray-700 mt-0.5">
                          {isShortDuration ? "Final review only" : checkInType === "daily" ? "Every day" : checkInType === "specific_days" ? (() => { const names = ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"]; return customDays.sort((a,b)=>a-b).map(d=>names[d]).join(", "); })() : "Final review only"}
                        </p>
                      </div>
                    </div>
                    {/* Note about invites */}
                    <div className="border-t border-gray-200" />
                    <p className="text-xs text-gray-400 italic text-center">
                      Friends will receive an invite notification. They have until the start date to accept.
                    </p>
                  </div>
                </div>

                <div className="flex justify-between items-center pt-4 pb-2 border-t border-gray-100 mt-4">
                  <Button type="button" variant="ghost" onClick={() => setStep(isShortDuration ? 4 : 5)} className="text-gray-500" data-testid="button-back-to-tracking">
                    Back
                  </Button>
                  <button
                    onClick={handleConfirm}
                    disabled={createWillMutation.isPending}
                    className={`px-6 py-3 rounded-xl text-sm font-medium transition-all duration-200 flex items-center justify-center ${
                      createWillMutation.isPending
                        ? "bg-gray-200 text-gray-400 cursor-not-allowed"
                        : "bg-gradient-to-r from-violet-500 to-purple-500 text-white hover:from-violet-600 hover:to-purple-600 shadow-sm"
                    }`}
                    data-testid="button-create-will"
                  >
                    {createWillMutation.isPending ? "Creating..." : "Create & Send Invites"}
                    <ArrowRight className="w-4 h-4 ml-2" />
                  </button>
                </div>
              </div>
            </div>
          )}

        </div>
      </MobileLayout>
    </div>
  );
}
