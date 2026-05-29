import { useState, useRef, useEffect } from "react";
import { useLocation, useParams } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { MobileLayout, UnifiedBackButton, PrimaryButton } from "@/components/ui/design-system";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { ArrowRight, Calendar, CalendarDays, Users, CheckCircle, Heart } from "lucide-react";
import NotificationsSetup, { type NotificationsData } from "@/components/NotificationsSetup";

type Category = 'recurring' | 'duration' | 'event';

type PublicWillDetails = {
  id: number;
  what: string;
  checkInType: string | null;
  commitmentCategory: Category | null;
  startDate: string;
  endDate: string;
  isIndefinite: boolean;
  activeDays: string | null;
  customDays: string | null;
  creatorName: string;
  memberCount: number;
  status: string | null;
};

const CAT_COLOR: Record<Category, string> = {
  recurring: '#1D9E75',
  duration: '#378ADD',
  event: '#7F77DD',
};

const CAT_LABEL: Record<Category, string> = {
  recurring: 'Recurring',
  duration: 'Duration',
  event: 'Event',
};

function formatDateForDisplay(dateStr: string | null) {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function formatDateRange(startStr: string, endStr: string | null, isIndefinite: boolean): string {
  const start = new Date(startStr);
  const year = start.getFullYear();
  const startPart = start.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  if (isIndefinite) return `${startPart}, ${year} · ongoing`;
  if (!endStr) return `${startPart}, ${year}`;
  const end = new Date(endStr);
  if (start.toDateString() === end.toDateString()) return `${startPart}, ${year}`;
  const endPart = end.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  const endYear = end.getFullYear();
  if (year === endYear) return `${startPart} – ${endPart}, ${year}`;
  return `${startPart}, ${year} – ${endPart}, ${endYear}`;
}

function getDurationDays(startDate: string, endDate: string) {
  return Math.ceil((new Date(endDate).getTime() - new Date(startDate).getTime()) / 86400000);
}

function getActiveDaysLabel(activeDays: string | null, customDays: string | null) {
  if (!activeDays || activeDays === 'every_day') return 'Every day';
  if (activeDays === 'weekdays') return 'Weekdays (Mon–Fri)';
  if (activeDays === 'custom' && customDays) {
    try {
      const days = JSON.parse(customDays);
      const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
      return days.sort((a: number, b: number) => a - b).map((d: number) => dayNames[d]).join(', ');
    } catch { return 'Custom schedule'; }
  }
  return 'Every day';
}

function trackedDaysToActiveDays(trackedDays: number[] | null): { activeDays: string; customDays: string | null } {
  if (!trackedDays || trackedDays.length === 7) return { activeDays: 'every_day', customDays: null };
  return { activeDays: 'custom', customDays: JSON.stringify(trackedDays) };
}

export default function JoinWill() {
  const params = useParams<{ willId: string }>();
  const willId = parseInt(params.willId || '0');
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [currentStep, setCurrentStep] = useState(1);
  const [why, setWhy] = useState('');
  const [charCount, setCharCount] = useState(0);
  const [notificationsData, setNotificationsData] = useState<NotificationsData | null>(null);
  const [whyRevealed, setWhyRevealed] = useState(false);
  const whyRef = useRef<HTMLTextAreaElement>(null);

  const { data: will, isLoading, error } = useQuery<PublicWillDetails>({
    queryKey: [`/api/wills/${willId}/public-details`],
    enabled: willId > 0,
  });

  const joinMutation = useMutation({
    mutationFn: async () => {
      if (!notificationsData) throw new Error('No notifications data');
      const { activeDays, customDays } = trackedDaysToActiveDays(notificationsData.trackedDays);
      return apiRequest(`/api/wills/${willId}/join`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          why,
          commitmentCategory: notificationsData.commitmentCategory,
          checkInType: notificationsData.checkInType,
          checkInTime: notificationsData.checkInTime,
          reminderTime: notificationsData.reminderTime,
          activeDays,
          customDays,
          milestones: notificationsData.milestones,
          deadlineReminders: notificationsData.deadlineReminders,
          missionReminderTime: notificationsData.missionReminderTime,
        }),
      });
    },
    onSuccess: (data: any) => {
      toast({ title: "You're in", description: "You've committed to this Will. Let's go." });
      queryClient.invalidateQueries({ queryKey: ['/api/wills/personal'] });
      queryClient.invalidateQueries({ queryKey: ['/api/wills/public'] });
      if (data?.willId) {
        sessionStorage.setItem('willBackUrl', '/explore');
        setLocation(`/will/${data.willId}`);
      } else {
        setLocation('/wills');
      }
    },
    onError: (error: any) => {
      toast({
        title: "Couldn't join",
        description: error.message || "Something went wrong",
        variant: "destructive",
      });
    },
  });

  useEffect(() => {
    if (currentStep === 2 && whyRef.current) {
      setTimeout(() => whyRef.current?.focus(), 300);
    }
  }, [currentStep]);

  useEffect(() => {
    setWhyRevealed(false);
  }, [currentStep]);

  const resizeTextarea = (ref: React.RefObject<HTMLTextAreaElement>) => {
    if (ref.current) {
      ref.current.style.height = 'auto';
      ref.current.style.height = Math.min(ref.current.scrollHeight, 120) + 'px';
    }
  };

  const ladderSteps = ['What', 'Why', 'Notifications'];
  const confirmStep = 4;
  const ladderIndex = currentStep >= confirmStep ? ladderSteps.length : currentStep - 1;

  if (isLoading) {
    return (
      <MobileLayout>
        <div className="flex items-center justify-center py-16">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
        </div>
      </MobileLayout>
    );
  }

  if (error || !will) {
    return (
      <MobileLayout>
        <div className="text-center py-16">
          <h3 className="text-lg font-medium text-gray-900 mb-1">Will not found</h3>
          <p className="text-sm text-gray-500 mb-4">This Will may no longer be available.</p>
          <Button variant="outline" onClick={() => setLocation('/explore')} data-testid="button-back-to-explore">
            Back to Explore
          </Button>
        </div>
      </MobileLayout>
    );
  }

  const isOngoing = will.isIndefinite;
  const defaultCategory: Category = will.commitmentCategory ?? 'recurring';
  const willDurationDays = !isOngoing && will.endDate && will.startDate
    ? getDurationDays(will.startDate, will.endDate)
    : 365;
  const dateRange = !isOngoing && will.startDate
    ? formatDateRange(will.startDate, will.endDate, false)
    : null;

  // ── Confirm-step derived values ───────────────────────────────────────────
  const cat: Category = (notificationsData?.commitmentCategory ?? defaultCategory);
  const heroColor = CAT_COLOR[cat];

  return (
    <MobileLayout>
      <div className="flex flex-col min-h-[calc(100vh-env(safe-area-inset-top)-4rem)]">

        {/* ── Nav bar ─────────────────────────────────────────────────────── */}
        <div className="relative flex items-center justify-between mb-4 min-h-[44px]">
          <UnifiedBackButton
            onClick={() => {
              if (currentStep === 1) setLocation('/explore');
              else if (currentStep === 3) setCurrentStep(2);
              else if (currentStep === 4) setCurrentStep(3);
              else setCurrentStep(currentStep - 1);
            }}
            testId="button-back"
          />
          <h1 className="absolute left-0 right-0 text-center text-lg font-semibold text-gray-900 pointer-events-none" data-testid="text-page-title">
            {currentStep === 1 ? 'What' : currentStep === 2 ? 'Why' : currentStep === 3 ? 'Notifications' : 'Review'}
          </h1>
          <div className="w-11"></div>
        </div>

        {/* ── Progress ladder ─────────────────────────────────────────────── */}
        {currentStep < confirmStep && (
          <div className="flex justify-center gap-2 mb-6">
            {ladderSteps.map((label, i) => (
              <div key={label} className="flex items-center gap-2">
                <div className={`flex items-center gap-1.5 ${i <= ladderIndex ? 'text-emerald-600' : 'text-gray-300'}`}>
                  <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-medium ${
                    i < ladderIndex ? 'bg-emerald-500 text-white' :
                    i === ladderIndex ? 'bg-emerald-100 text-emerald-700 border border-emerald-300' :
                    'bg-gray-100 text-gray-400'
                  }`}>
                    {i < ladderIndex ? <CheckCircle className="w-3.5 h-3.5" /> : i + 1}
                  </div>
                  <span className={`text-xs font-medium ${i <= ladderIndex ? 'text-gray-700' : 'text-gray-400'}`}>{label}</span>
                </div>
                {i < ladderSteps.length - 1 && (
                  <div className={`w-6 h-px ${i < ladderIndex ? 'bg-emerald-300' : 'bg-gray-200'}`}></div>
                )}
              </div>
            ))}
          </div>
        )}

        {/* ── Step 1: What ─────────────────────────────────────────────────── */}
        {currentStep === 1 && (
          <div className="animate-in fade-in duration-500">
            <div className="bg-gray-50 rounded-xl p-5 space-y-4">
              <div className="text-center pb-2">
                <p className="text-xs text-gray-400 uppercase tracking-wide mb-1">You're about to commit to</p>
                <p className="text-lg font-semibold text-gray-900" data-testid="text-join-what">
                  I Will {will.what}
                </p>
                <p className="text-xs text-gray-500 mt-1.5" data-testid="text-join-creator">
                  Created by @{will.creatorName?.toLowerCase().replace(/\s+/g, '')}
                </p>
              </div>

              <div className="border-t border-gray-200"></div>

              <div className="flex items-start gap-3">
                <Calendar className="w-5 h-5 text-blue-600 mt-0.5 flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium text-gray-400 uppercase tracking-wide">Timeline</p>
                  {isOngoing ? (
                    <p className="text-sm text-gray-700 mt-0.5" data-testid="text-join-timeline">Ongoing</p>
                  ) : (
                    <div className="mt-0.5" data-testid="text-join-timeline">
                      <p className="text-sm text-gray-700">
                        {formatDateForDisplay(will.startDate)} — {formatDateForDisplay(will.endDate)}
                      </p>
                    </div>
                  )}
                </div>
              </div>

              {isOngoing && (
                <>
                  <div className="border-t border-gray-200"></div>
                  <div className="flex items-start gap-3">
                    <CalendarDays className="w-5 h-5 text-indigo-600 mt-0.5 flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium text-gray-400 uppercase tracking-wide">Active Days</p>
                      <p className="text-sm text-gray-700 mt-0.5" data-testid="text-join-active-days">
                        {getActiveDaysLabel(will.activeDays, will.customDays)}
                      </p>
                    </div>
                  </div>
                </>
              )}

              <div className="border-t border-gray-200"></div>

              <div className="flex items-start gap-3">
                <Users className="w-5 h-5 text-purple-600 mt-0.5 flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium text-gray-400 uppercase tracking-wide">Members</p>
                  <p className="text-sm text-gray-700 mt-0.5" data-testid="text-join-members">
                    {will.memberCount} {will.memberCount === 1 ? 'person' : 'people'} committed
                  </p>
                </div>
              </div>
            </div>

            <div className="flex justify-end pt-6">
              <PrimaryButton onClick={() => setCurrentStep(2)} data-testid="button-next-to-why">
                Continue <ArrowRight className="w-4 h-4 ml-2" />
              </PrimaryButton>
            </div>
          </div>
        )}

        {/* ── Step 2: Why ─────────────────────────────────────────────────── */}
        {currentStep === 2 && (
          <div className="flex flex-col animate-in fade-in duration-500">
            <div className="flex flex-col pt-4 pb-6">
              <div className="mb-6 text-center animate-in fade-in slide-in-from-bottom-2 duration-300">
                <p className="text-lg font-semibold text-gray-800">
                  "I Will {will.what}"
                </p>
              </div>

              <div className="space-y-4 animate-in fade-in slide-in-from-bottom-3 duration-500" style={{ animationDelay: '100ms' }}>
                <div className="text-center">
                  <p className="text-3xl font-bold text-gray-900 tracking-tight">Because</p>
                  <p className="text-xs text-gray-400 mt-1">(Private — only you can see this)</p>
                </div>

                <div className="relative px-2">
                  <Textarea
                    ref={whyRef}
                    name="why"
                    required
                    rows={2}
                    maxLength={75}
                    value={why}
                    onChange={(e) => {
                      setWhy(e.target.value);
                      setCharCount(e.target.value.length);
                      resizeTextarea(whyRef);
                    }}
                    className="w-full text-center text-xl leading-relaxed font-normal text-gray-700 bg-transparent border-0 border-b-2 border-gray-200 focus:border-red-300 focus:ring-0 resize-none transition-colors duration-300 placeholder:text-gray-300 placeholder:italic py-3 px-4"
                    style={{ minHeight: '72px', maxHeight: '120px' }}
                    placeholder="I like how I feel after I do this"
                    data-testid="input-join-why"
                  />
                </div>

                <p className="text-xs text-gray-400 text-center tracking-tight animate-in fade-in duration-300" style={{ animationDelay: '200ms' }}>
                  {charCount} / 75
                </p>
              </div>
            </div>

            <div className="flex justify-end items-center pt-4 pb-2 border-t border-gray-100 animate-in fade-in slide-in-from-bottom-2 duration-300" style={{ animationDelay: '300ms' }}>
              <PrimaryButton
                onClick={() => { if (why.trim()) setCurrentStep(3); }}
                disabled={!why.trim()}
                data-testid="button-next-to-notifications"
              >
                Next <ArrowRight className="w-4 h-4 ml-2" />
              </PrimaryButton>
            </div>
          </div>
        )}

        {/* ── Step 3: Notifications Setup ─────────────────────────────────── */}
        {currentStep === 3 && (
          <div className="animate-in fade-in duration-500 -mx-4">
            <NotificationsSetup
              what={will.what}
              because={why}
              defaultCategory={defaultCategory}
              willDurationDays={willDurationDays}
              onComplete={(data) => {
                setNotificationsData(data);
                setCurrentStep(4);
              }}
              onBack={() => setCurrentStep(2)}
            />
          </div>
        )}

        {/* ── Step 4: Review & Commit ─────────────────────────────────────── */}
        {currentStep === 4 && notificationsData && (
          <div className="flex flex-col animate-in fade-in duration-500 space-y-4 pb-6">

            {/* Hero card */}
            <div className="rounded-2xl p-5 space-y-3" style={{ backgroundColor: heroColor }}>
              <div className="flex items-center gap-2">
                <svg viewBox="0 0 24 24" className="w-5 h-5 text-white opacity-80" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="9" />
                  <circle cx="12" cy="12" r="4" />
                  <circle cx="12" cy="12" r="1" fill="currentColor" />
                </svg>
                <span className="text-base font-bold text-white">I Will</span>
              </div>

              <div className="rounded-xl p-4" style={{ backgroundColor: 'rgba(255,255,255,0.18)' }}>
                <p className="text-[10px] font-medium mb-1.5" style={{ color: 'rgba(255,255,255,0.65)' }}>
                  Your commitment
                </p>
                <p className="text-base font-bold italic text-white leading-snug" data-testid="text-confirm-what">
                  "{will.what}"
                </p>
                {dateRange && (
                  <p className="text-xs mt-1.5" style={{ color: 'rgba(255,255,255,0.70)' }}>
                    {dateRange}
                  </p>
                )}
                {isOngoing && (
                  <p className="text-xs mt-1.5" style={{ color: 'rgba(255,255,255,0.70)' }}>
                    Ongoing · {getActiveDaysLabel(will.activeDays, will.customDays)}
                  </p>
                )}
              </div>
            </div>

            {/* Why card with heart reveal */}
            <button
              type="button"
              onClick={() => setWhyRevealed(r => !r)}
              className="w-full bg-white border border-gray-100 rounded-2xl px-5 py-4 text-left transition-all duration-200 hover:border-gray-200"
              data-testid="card-why-reveal"
            >
              <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-widest mb-1.5 flex items-center gap-1.5">
                <Heart className={`w-3 h-3 transition-colors duration-300 ${whyRevealed ? 'text-red-400 fill-red-400' : 'text-gray-300'}`} />
                Your why · private
                <span className="ml-auto text-[10px] text-gray-300 normal-case tracking-normal font-normal">
                  {whyRevealed ? 'tap to hide' : 'tap to reveal'}
                </span>
              </p>
              {whyRevealed ? (
                <p className="text-sm italic text-gray-700 leading-snug animate-in fade-in duration-300" data-testid="text-confirm-why">
                  {why}
                </p>
              ) : (
                <div className="flex gap-1 mt-1">
                  {[...Array(Math.min(Math.ceil(why.length / 5), 8))].map((_, i) => (
                    <div key={i} className="h-2 rounded-full bg-gray-200" style={{ width: `${20 + Math.random() * 20}px` }} />
                  ))}
                </div>
              )}
            </button>

            {/* Details summary card */}
            <div className="bg-white border border-gray-100 rounded-2xl px-5 py-4 space-y-3">
              {/* Type */}
              <div className="flex items-center gap-3">
                <div
                  className="w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0"
                  style={{ backgroundColor: `${heroColor}18` }}
                >
                  <svg viewBox="0 0 24 24" className="w-4 h-4" fill="none" stroke={heroColor} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
                    <path d="M13.73 21a2 2 0 0 1-3.46 0" />
                  </svg>
                </div>
                <div>
                  <p className="text-[10px] font-medium text-gray-400 uppercase tracking-widest leading-none mb-0.5">Type</p>
                  <p className="text-sm font-semibold" style={{ color: heroColor }} data-testid="text-confirm-type">
                    {CAT_LABEL[cat]}
                  </p>
                </div>
              </div>

              {/* Timeline */}
              <div className="border-t border-gray-100 pt-3 flex items-center gap-3">
                <div className="w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0 bg-gray-50">
                  <Calendar className="w-4 h-4 text-gray-400" />
                </div>
                <div>
                  <p className="text-[10px] font-medium text-gray-400 uppercase tracking-widest leading-none mb-0.5">Timeline</p>
                  <p className="text-sm font-medium text-gray-800" data-testid="text-confirm-timeline">
                    {isOngoing ? 'Ongoing' : (dateRange ?? '—')}
                  </p>
                </div>
              </div>
            </div>

            {/* CTA */}
            <button
              type="button"
              onClick={() => joinMutation.mutate()}
              disabled={joinMutation.isPending}
              className="w-full py-4 rounded-2xl text-base font-bold text-white flex items-center justify-center gap-2 transition-all duration-200 active:scale-[0.98] disabled:opacity-60"
              style={{ backgroundColor: '#1D9E75' }}
              data-testid="button-commit"
            >
              {joinMutation.isPending ? (
                <><div className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" /> Joining...</>
              ) : (
                'Commit to this Will'
              )}
            </button>

            <button
              type="button"
              onClick={() => setCurrentStep(3)}
              className="w-full py-3 rounded-2xl text-sm font-medium text-gray-500 bg-white border border-gray-200 transition-colors duration-200"
              data-testid="button-back-to-notifications"
            >
              Go back
            </button>
          </div>
        )}

      </div>
    </MobileLayout>
  );
}
