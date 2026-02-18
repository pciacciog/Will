import { useState, useRef, useEffect } from "react";
import { useLocation, useParams } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { MobileLayout, UnifiedBackButton, PrimaryButton } from "@/components/ui/design-system";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { ArrowRight, Calendar, CalendarDays, Users, ClipboardList, MessageCircle, CheckCircle, Clock } from "lucide-react";

type PublicWillDetails = {
  id: number;
  what: string;
  checkInType: string | null;
  startDate: string;
  endDate: string;
  isIndefinite: boolean;
  activeDays: string | null;
  customDays: string | null;
  creatorName: string;
  memberCount: number;
  status: string | null;
};

function formatDateForDisplay(dateStr: string | null) {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function getDurationText(startDate: string, endDate: string) {
  const start = new Date(startDate);
  const end = new Date(endDate);
  const days = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
  if (days <= 1) return '1 day';
  if (days < 7) return `${days} days`;
  if (days < 30) return `${Math.ceil(days / 7)} weeks`;
  return `${Math.ceil(days / 30)} months`;
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

export default function JoinWill() {
  const params = useParams<{ willId: string }>();
  const willId = parseInt(params.willId || '0');
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [currentStep, setCurrentStep] = useState(1);
  const [why, setWhy] = useState('');
  const [charCount, setCharCount] = useState(0);
  const whyRef = useRef<HTMLTextAreaElement>(null);

  const { data: will, isLoading, error } = useQuery<PublicWillDetails>({
    queryKey: [`/api/wills/${willId}/public-details`],
    enabled: willId > 0,
  });

  const joinMutation = useMutation({
    mutationFn: async () => {
      return apiRequest(`/api/wills/${willId}/join`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ why }),
      });
    },
    onSuccess: (data: any) => {
      toast({
        title: "You're in",
        description: "You've committed to this Will. Let's go.",
      });
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

  const resizeTextarea = (ref: React.RefObject<HTMLTextAreaElement>) => {
    if (ref.current) {
      ref.current.style.height = 'auto';
      ref.current.style.height = Math.min(ref.current.scrollHeight, 120) + 'px';
    }
  };

  const stepLabels = ['Details', 'Because', 'Confirm'];

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
  const checkInLabel = will.checkInType === 'daily' ? 'Ongoing check-ins' : 'Review at the end';

  return (
    <MobileLayout>
      <div className="flex flex-col min-h-[calc(100vh-env(safe-area-inset-top)-4rem)]">
        <div className="relative flex items-center justify-between mb-4 min-h-[44px]">
          <UnifiedBackButton
            onClick={() => {
              if (currentStep === 1) setLocation('/explore');
              else setCurrentStep(currentStep - 1);
            }}
            testId="button-back"
          />
          <h1 className="absolute left-0 right-0 text-center text-lg font-semibold text-gray-900 pointer-events-none" data-testid="text-page-title">
            {currentStep === 1 ? 'Will Details' : currentStep === 2 ? 'Your Why' : 'Confirm'}
          </h1>
          <div className="w-11"></div>
        </div>

        <div className="flex justify-center gap-2 mb-6">
          {stepLabels.map((label, i) => (
            <div key={label} className="flex items-center gap-2">
              <div className={`flex items-center gap-1.5 ${i + 1 <= currentStep ? 'text-emerald-600' : 'text-gray-300'}`}>
                <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-medium ${
                  i + 1 < currentStep ? 'bg-emerald-500 text-white' :
                  i + 1 === currentStep ? 'bg-emerald-100 text-emerald-700 border border-emerald-300' :
                  'bg-gray-100 text-gray-400'
                }`}>
                  {i + 1 < currentStep ? <CheckCircle className="w-3.5 h-3.5" /> : i + 1}
                </div>
                <span className={`text-xs font-medium ${i + 1 <= currentStep ? 'text-gray-700' : 'text-gray-400'}`}>{label}</span>
              </div>
              {i < stepLabels.length - 1 && (
                <div className={`w-6 h-px ${i + 1 < currentStep ? 'bg-emerald-300' : 'bg-gray-200'}`}></div>
              )}
            </div>
          ))}
        </div>

        <div className="flex-1">
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
                      <p className="text-sm text-gray-700 mt-0.5" data-testid="text-join-timeline">Ongoing commitment</p>
                    ) : (
                      <div className="mt-0.5" data-testid="text-join-timeline">
                        <p className="text-sm text-gray-700">
                          {formatDateForDisplay(will.startDate)} — {formatDateForDisplay(will.endDate)}
                        </p>
                        <p className="text-xs text-gray-400 mt-0.5">{getDurationText(will.startDate, will.endDate)}</p>
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
                  <Clock className="w-5 h-5 text-amber-600 mt-0.5 flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium text-gray-400 uppercase tracking-wide">Tracking</p>
                    <p className="text-sm text-gray-700 mt-0.5" data-testid="text-join-tracking">{checkInLabel}</p>
                  </div>
                </div>

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
                  data-testid="button-next-to-confirm"
                >
                  Next <ArrowRight className="w-4 h-4 ml-2" />
                </PrimaryButton>
              </div>
            </div>
          )}

          {currentStep === 3 && (
            <div className="flex flex-col animate-in fade-in duration-500">
              <div className="flex-1 flex flex-col py-4 px-4">
                <div className="space-y-4">
                  <div className="bg-gray-50 rounded-xl p-4 space-y-4">
                    <div className="flex items-start gap-3">
                      <ClipboardList className="w-5 h-5 text-emerald-600 mt-0.5 flex-shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-medium text-gray-400 uppercase tracking-wide">What</p>
                        <p className="text-sm font-medium text-gray-900 mt-0.5" data-testid="text-confirm-what">
                          I Will {will.what}
                        </p>
                      </div>
                    </div>

                    <div className="border-t border-gray-200"></div>

                    <div className="flex items-start gap-3">
                      <MessageCircle className="w-5 h-5 text-red-500 mt-0.5 flex-shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-medium text-gray-400 uppercase tracking-wide">Why</p>
                        <p className="text-sm text-gray-700 mt-0.5" data-testid="text-confirm-why">{why}</p>
                      </div>
                    </div>

                    <div className="border-t border-gray-200"></div>

                    <div className="flex items-start gap-3">
                      <Calendar className="w-5 h-5 text-blue-600 mt-0.5 flex-shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-medium text-gray-400 uppercase tracking-wide">Timeline</p>
                        {isOngoing ? (
                          <p className="text-sm text-gray-700 mt-0.5" data-testid="text-confirm-timeline">Ongoing commitment</p>
                        ) : (
                          <div className="mt-0.5" data-testid="text-confirm-timeline">
                            <p className="text-sm text-gray-700">
                              {formatDateForDisplay(will.startDate)} — {formatDateForDisplay(will.endDate)}
                            </p>
                            <p className="text-xs text-gray-400 mt-0.5">{getDurationText(will.startDate, will.endDate)}</p>
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="border-t border-gray-200"></div>

                    <div className="flex items-start gap-3">
                      <Clock className="w-5 h-5 text-amber-600 mt-0.5 flex-shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-medium text-gray-400 uppercase tracking-wide">Tracking</p>
                        <p className="text-sm text-gray-700 mt-0.5" data-testid="text-confirm-tracking">{checkInLabel}</p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <div className="flex justify-between items-center pt-4 pb-2 border-t border-gray-100 animate-in fade-in slide-in-from-bottom-2 duration-300">
                <Button type="button" variant="ghost" onClick={() => setCurrentStep(2)} className="text-gray-500" data-testid="button-back-to-why">
                  Back
                </Button>
                <button
                  onClick={() => joinMutation.mutate()}
                  disabled={joinMutation.isPending}
                  className={`px-6 py-3 rounded-xl text-sm font-medium transition-all duration-200 flex items-center justify-center ${
                    joinMutation.isPending
                      ? 'bg-gray-200 text-gray-400 cursor-not-allowed'
                      : 'bg-gradient-to-r from-emerald-500 to-teal-500 text-white hover:from-emerald-600 hover:to-teal-600 shadow-sm'
                  }`}
                  data-testid="button-join-will"
                >
                  {joinMutation.isPending ? 'Joining...' : 'Join Will'}
                  <ArrowRight className="w-4 h-4 ml-2" />
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </MobileLayout>
  );
}