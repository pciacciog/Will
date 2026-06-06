import { useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { MobileLayout, UnifiedBackButton } from "@/components/ui/design-system";
import { Trophy } from "lucide-react";

const CORAL = "#D85A30";
const CORAL_LIGHT = "#FAECE7";
const CORAL_DARK = "#712B13";

interface Competitor {
  userId: string;
  firstName: string;
  isCreator: boolean;
  isYou: boolean;
  successRate: number;
  totalDaysCompleted: number;
  score: number;
  willId: number;
}

function avatarColor(id: string) {
  const palette = ["#534AB7","#1D9E75","#D85A30","#0891B2","#7C3AED","#DC2626","#059669","#D97706"];
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) & 0xfffffff;
  return palette[Math.abs(h) % palette.length];
}

function getInitial(name: string) { return (name || "?").charAt(0).toUpperCase(); }

function scoreColor(score: number) {
  if (score >= 70) return "#10B981";
  if (score < 50) return "#EF4444";
  return "#534AB7";
}

const RANK_MEDALS: Record<number, string> = { 1: "🥇", 2: "🥈", 3: "🥉" };

export default function SeeAllCompetitorsPage({ challengeId }: { challengeId: number }) {
  const [, setLocation] = useLocation();

  const { data, isLoading } = useQuery<{ competitors: Competitor[]; competitorCount: number }>({
    queryKey: [`/api/wills/challenge/${challengeId}/all-competitors`],
    staleTime: 15000,
  });

  const competitors = data?.competitors ?? [];

  return (
    <MobileLayout>
      <div className="relative flex items-center mb-6 min-h-[44px]">
        <UnifiedBackButton onClick={() => setLocation(`/challenge/${challengeId}`)} testId="button-back" />
        <h1
          className="absolute left-0 right-0 text-center text-base font-semibold text-gray-900 pointer-events-none"
          data-testid="text-page-title"
        >
          Competitors · {data?.competitorCount ?? "…"} total
        </h1>
        <div className="w-11" />
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-20">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2" style={{ borderColor: CORAL }} />
        </div>
      ) : competitors.length === 0 ? (
        <div className="text-center py-20">
          <div className="w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4" style={{ backgroundColor: CORAL_LIGHT }}>
            <Trophy className="w-8 h-8" style={{ color: CORAL }} />
          </div>
          <p className="text-sm text-gray-500">No competitors yet.</p>
        </div>
      ) : (
        <div className="space-y-2" data-testid="list-competitors">
          {competitors.map((c, i) => {
            const rank = i + 1;
            const medal = RANK_MEDALS[rank];
            const sc = scoreColor(c.score);
            return (
              <div
                key={c.userId}
                className="rounded-2xl p-3 cursor-pointer transition-colors"
                style={{
                  border: c.isYou ? `1.5px solid ${CORAL}` : "1px solid #F3F4F6",
                  backgroundColor: c.isYou ? CORAL_LIGHT : "#fff",
                }}
                onClick={() => !c.isYou && setLocation(`/profile/${c.userId}`)}
                data-testid={`row-competitor-${c.userId}`}
              >
                <div className="flex items-center gap-3">
                  <span className="text-base w-6 flex-shrink-0 text-center font-semibold">
                    {medal ?? <span className="text-sm text-gray-400">{rank}</span>}
                  </span>
                  <div
                    className="w-9 h-9 rounded-full flex items-center justify-center text-white font-semibold flex-shrink-0"
                    style={{ backgroundColor: avatarColor(c.userId), fontSize: "12px" }}
                  >
                    {getInitial(c.firstName)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="text-sm font-semibold text-gray-900 truncate">@{c.firstName.toLowerCase()}</span>
                      {c.isYou && (
                        <span className="text-[10px] font-medium px-1.5 py-0.5 rounded-full flex-shrink-0" style={{ backgroundColor: CORAL_LIGHT, color: CORAL_DARK }}>
                          You
                        </span>
                      )}
                      {c.isCreator && !c.isYou && (
                        <span className="text-[10px] font-medium px-1.5 py-0.5 rounded-full flex-shrink-0" style={{ backgroundColor: CORAL_LIGHT, color: CORAL_DARK }}>
                          Creator
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-gray-400 mt-0.5">{c.successRate}% · {c.totalDaysCompleted} days done</p>
                  </div>
                  <span className="text-sm font-bold flex-shrink-0" style={{ color: sc }}>{c.score}</span>
                </div>
                <div className="mt-2 ml-9 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all"
                    style={{ width: `${Math.max(2, c.score)}%`, backgroundColor: sc }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      )}
    </MobileLayout>
  );
}
