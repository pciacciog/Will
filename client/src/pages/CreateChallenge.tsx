import { useState } from "react";
import { useLocation } from "wouter";
import { useMutation } from "@tanstack/react-query";
import { MobileLayout, UnifiedBackButton } from "@/components/ui/design-system";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Users, Globe, Copy, Check, ArrowRight, RefreshCw, Calendar } from "lucide-react";
import { cn } from "@/lib/utils";

const CORAL = "#D85A30";
const CORAL_LIGHT = "#FAECE7";
const CORAL_DARK = "#712B13";
const CORAL_MID = "#993C1D";

type Visibility = "open" | "private";
type WillType = "recurring" | "duration";

interface StepHeaderProps {
  step: number;
  totalSteps: number;
  onBack: () => void;
}

function StepHeader({ step, totalSteps, onBack }: StepHeaderProps) {
  const pct = Math.round((step / totalSteps) * 100);
  return (
    <div className="sticky top-0 z-10 bg-white border-b border-gray-100 pt-safe pb-3 mb-6">
      <div className="px-4 pt-4 space-y-3">
        <div className="flex items-center justify-between min-h-[44px]">
          <UnifiedBackButton onClick={onBack} testId="button-back" />
          <span className="text-sm font-medium text-gray-500">Create Challenge</span>
          <div className="w-11" />
        </div>
        <div className="h-1 bg-gray-100 rounded-full overflow-hidden">
          <div
            className="h-full rounded-full transition-all duration-300"
            style={{ width: `${pct}%`, backgroundColor: CORAL }}
          />
        </div>
      </div>
    </div>
  );
}

export default function CreateChallenge() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();

  const [step, setStep] = useState(0);
  const [visibility, setVisibility] = useState<Visibility>("open");
  const [willType, setWillType] = useState<WillType>("recurring");
  const [what, setWhat] = useState("");
  const [because, setBecause] = useState("");
  const [endDate, setEndDate] = useState("");
  const [createdId, setCreatedId] = useState<number | null>(null);
  const [copied, setCopied] = useState(false);

  const totalSteps = visibility === "private" ? 5 : 4;

  const createMutation = useMutation({
    mutationFn: () =>
      apiRequest("/api/wills/challenge", {
        method: "POST",
        body: {
          what: what.trim(),
          because: because.trim() || undefined,
          visibility,
          type: willType === "duration" ? "duration" : "recurring",
          endDate: willType === "duration" && endDate ? endDate : undefined,
          isIndefinite: willType === "recurring",
        },
      }).then((r) => r.json()),
    onSuccess: (data) => {
      setCreatedId(data.id);
      if (visibility === "private") {
        setStep(4);
      } else {
        toast({ title: "Challenge created! 🏆", description: "Your challenge is live." });
        setLocation(`/challenge/${data.id}`);
      }
    },
    onError: (err: any) => {
      toast({ title: "Error", description: err?.message ?? "Could not create challenge.", variant: "destructive" });
    },
  });

  const inviteUrl = createdId ? `${window.location.origin}/will/${createdId}/invite` : "";

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(inviteUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast({ title: "Could not copy", description: "Please copy the link manually.", variant: "destructive" });
    }
  };

  const goBack = () => {
    if (step === 0) setLocation("/");
    else setStep(step - 1);
  };

  const CTAButton = ({ label, onClick, disabled = false }: { label: string; onClick: () => void; disabled?: boolean }) => (
    <button
      onClick={onClick}
      disabled={disabled}
      className="w-full py-3.5 rounded-2xl text-base font-semibold text-white transition-opacity disabled:opacity-40"
      style={{ backgroundColor: CORAL }}
      data-testid="button-cta"
    >
      {label}
    </button>
  );

  // Step 0: Audience picker
  if (step === 0) {
    return (
      <div className="w-full max-w-screen-sm mx-auto min-h-screen bg-white">
        <StepHeader step={0} totalSteps={totalSteps} onBack={goBack} />
        <div className="px-4 space-y-5">
          <div className="space-y-1">
            <h1 className="text-2xl font-bold text-gray-900">Who competes?</h1>
            <p className="text-gray-500 text-sm">Choose your challenge audience.</p>
          </div>

          <div className="grid grid-cols-2 gap-3 pt-2">
            <button
              onClick={() => setVisibility("private")}
              className="relative flex flex-col items-center gap-3 p-5 rounded-2xl border-2 transition-all"
              style={
                visibility === "private"
                  ? { borderColor: CORAL, backgroundColor: CORAL_LIGHT }
                  : { borderColor: "#E5E7EB", backgroundColor: "#fff" }
              }
              data-testid="card-audience-private"
            >
              <Users
                className="w-8 h-8"
                style={{ color: visibility === "private" ? CORAL : "#6B7280" }}
                strokeWidth={1.5}
              />
              <div className="text-center">
                <p className="font-semibold text-gray-900 text-sm">Friends only</p>
                <p className="text-xs text-gray-400 mt-0.5">Invite from your friend list</p>
              </div>
            </button>

            <button
              onClick={() => setVisibility("open")}
              className="relative flex flex-col items-center gap-3 p-5 rounded-2xl border-2 transition-all"
              style={
                visibility === "open"
                  ? { borderColor: CORAL, backgroundColor: CORAL_LIGHT }
                  : { borderColor: "#E5E7EB", backgroundColor: "#fff" }
              }
              data-testid="card-audience-public"
            >
              <Globe
                className="w-8 h-8"
                style={{ color: visibility === "open" ? CORAL : "#6B7280" }}
                strokeWidth={1.5}
              />
              <div className="text-center">
                <p className="font-semibold text-gray-900 text-sm">Public</p>
                <p className="text-xs text-gray-400 mt-0.5">Open to everyone</p>
              </div>
            </button>
          </div>

          <div className="pt-4">
            <CTAButton label="Continue →" onClick={() => setStep(1)} />
          </div>
        </div>
      </div>
    );
  }

  // Step 1: Goal text
  if (step === 1) {
    return (
      <div className="w-full max-w-screen-sm mx-auto min-h-screen bg-white">
        <StepHeader step={1} totalSteps={totalSteps} onBack={goBack} />
        <div className="px-4 space-y-5">
          <div className="space-y-1">
            <h1 className="text-2xl font-bold text-gray-900">What's the challenge?</h1>
            <p className="text-gray-500 text-sm">Set the goal everyone will compete on.</p>
          </div>

          <textarea
            value={what}
            onChange={(e) => setWhat(e.target.value)}
            placeholder="e.g. Run 5km every day for 30 days"
            className="w-full h-32 px-4 py-3 rounded-2xl border border-gray-200 focus:border-orange-400 focus:outline-none text-gray-900 text-base resize-none"
            maxLength={200}
            autoFocus
            data-testid="input-what"
          />

          <div className="pt-2">
            <CTAButton label="Continue →" onClick={() => setStep(2)} disabled={!what.trim()} />
          </div>
        </div>
      </div>
    );
  }

  // Step 2: Why (optional)
  if (step === 2) {
    return (
      <div className="w-full max-w-screen-sm mx-auto min-h-screen bg-white">
        <StepHeader step={2} totalSteps={totalSteps} onBack={goBack} />
        <div className="px-4 space-y-5">
          <div className="space-y-1">
            <h1 className="text-2xl font-bold text-gray-900">Why does it matter?</h1>
            <p className="text-gray-500 text-sm">Optional — this stays private to you.</p>
          </div>

          <textarea
            value={because}
            onChange={(e) => setBecause(e.target.value)}
            placeholder="Because..."
            className="w-full h-32 px-4 py-3 rounded-2xl border border-gray-200 focus:border-orange-400 focus:outline-none text-gray-900 text-base resize-none"
            maxLength={300}
            data-testid="input-why"
          />

          <div className="pt-2 space-y-3">
            <CTAButton label="Continue →" onClick={() => setStep(3)} />
            <button
              onClick={() => setStep(3)}
              className="w-full py-3 text-sm font-medium text-gray-400"
              data-testid="button-skip-why"
            >
              Skip
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Step 3: Timeline
  if (step === 3) {
    const canSubmit = willType === "recurring" || (willType === "duration" && !!endDate);
    return (
      <div className="w-full max-w-screen-sm mx-auto min-h-screen bg-white">
        <StepHeader step={3} totalSteps={totalSteps} onBack={goBack} />
        <div className="px-4 space-y-5">
          <div className="space-y-1">
            <h1 className="text-2xl font-bold text-gray-900">Set the timeline</h1>
            <p className="text-gray-500 text-sm">How long does the challenge run?</p>
          </div>

          <div className="space-y-3">
            <button
              onClick={() => setWillType("recurring")}
              className="w-full flex items-center gap-4 p-4 rounded-2xl border-2 transition-all text-left"
              style={willType === "recurring" ? { borderColor: CORAL, backgroundColor: CORAL_LIGHT } : { borderColor: "#E5E7EB" }}
              data-testid="card-type-recurring"
            >
              <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0" style={{ backgroundColor: willType === "recurring" ? CORAL_LIGHT : "#F9FAFB" }}>
                <RefreshCw className="w-5 h-5" style={{ color: willType === "recurring" ? CORAL : "#6B7280" }} />
              </div>
              <div>
                <p className="font-semibold text-gray-900">Ongoing</p>
                <p className="text-xs text-gray-500 mt-0.5">No end date — runs indefinitely</p>
              </div>
            </button>

            <button
              onClick={() => setWillType("duration")}
              className="w-full flex items-center gap-4 p-4 rounded-2xl border-2 transition-all text-left"
              style={willType === "duration" ? { borderColor: CORAL, backgroundColor: CORAL_LIGHT } : { borderColor: "#E5E7EB" }}
              data-testid="card-type-duration"
            >
              <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0" style={{ backgroundColor: willType === "duration" ? CORAL_LIGHT : "#F9FAFB" }}>
                <Calendar className="w-5 h-5" style={{ color: willType === "duration" ? CORAL : "#6B7280" }} />
              </div>
              <div>
                <p className="font-semibold text-gray-900">Set duration</p>
                <p className="text-xs text-gray-500 mt-0.5">Challenge ends on a specific date</p>
              </div>
            </button>

            {willType === "duration" && (
              <div className="pl-2">
                <label className="block text-sm font-medium text-gray-700 mb-1.5">End date</label>
                <input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  min={new Date(Date.now() + 86400000).toISOString().split("T")[0]}
                  className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:border-orange-400 focus:outline-none text-gray-900"
                  data-testid="input-end-date"
                />
              </div>
            )}
          </div>

          <div className="pt-2">
            <CTAButton
              label={createMutation.isPending ? "Creating…" : (visibility === "private" ? "Continue →" : "Launch Challenge 🏆")}
              onClick={() => createMutation.mutate()}
              disabled={!canSubmit || createMutation.isPending}
            />
          </div>
        </div>
      </div>
    );
  }

  // Step 4: Private — invite link
  if (step === 4 && createdId) {
    return (
      <div className="w-full max-w-screen-sm mx-auto min-h-screen bg-white">
        <StepHeader step={4} totalSteps={totalSteps} onBack={() => setLocation(`/challenge/${createdId}`)} />
        <div className="px-4 space-y-6">
          <div className="space-y-1">
            <h1 className="text-2xl font-bold text-gray-900">Invite your friends</h1>
            <p className="text-gray-500 text-sm">Share this link with anyone you want to compete against.</p>
          </div>

          <div className="bg-gray-50 rounded-2xl p-4 space-y-3">
            <p className="text-xs text-gray-500 font-medium uppercase tracking-wide">Invite Link</p>
            <p className="text-sm text-gray-800 break-all font-mono">{inviteUrl}</p>
            <button
              onClick={handleCopy}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold text-white transition-all"
              style={{ backgroundColor: CORAL }}
              data-testid="button-copy-link"
            >
              {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
              {copied ? "Copied!" : "Copy link"}
            </button>
          </div>

          <button
            onClick={() => setLocation(`/challenge/${createdId}`)}
            className="w-full py-3.5 rounded-2xl text-base font-semibold border-2 transition-all flex items-center justify-center gap-2"
            style={{ borderColor: CORAL, color: CORAL }}
            data-testid="button-go-to-challenge"
          >
            Go to Challenge
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </div>
    );
  }

  return null;
}
