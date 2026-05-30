import { useState } from "react";
import { useLocation } from "wouter";
import { MobileLayout, UnifiedBackButton } from "@/components/ui/design-system";
import { Target, Activity, Heart, TrendingUp, Compass, ChevronRight } from "lucide-react";

const LIFE_AREAS = [
  {
    label: "Personal discipline",
    sub: "Habits, routines, self-control",
    slug: "personal_discipline",
    color: "#D97706",
    bg: "#FFFBEB",
    selectedBg: "#FEF3C7",
    Icon: Target,
  },
  {
    label: "Health and body",
    sub: "Movement, sleep, nutrition",
    slug: "health_and_body",
    color: "#1D9E75",
    bg: "#F0FAF5",
    selectedBg: "#D1FAE5",
    Icon: Activity,
  },
  {
    label: "Relationships",
    sub: "Family, friends, connection",
    slug: "relationships",
    color: "#E11D48",
    bg: "#FFF1F4",
    selectedBg: "#FFE4E6",
    Icon: Heart,
  },
  {
    label: "Career and money",
    sub: "Work, income, stability",
    slug: "career_and_money",
    color: "#2563EB",
    bg: "#EFF6FF",
    selectedBg: "#DBEAFE",
    Icon: TrendingUp,
  },
  {
    label: "Purpose and direction",
    sub: "Meaning, values, future self",
    slug: "purpose_and_direction",
    color: "#7C3AED",
    bg: "#F5F3FF",
    selectedBg: "#EDE9FE",
    Icon: Compass,
  },
] as const;

export default function FindWillLifeArea() {
  const [, setLocation] = useLocation();
  const [selected, setSelected] = useState<string | null>(null);

  const handleNext = () => {
    if (!selected) return;
    const params = new URLSearchParams();
    params.set("area", selected);
    setLocation(`/find-will/suggestions?${params.toString()}`);
  };

  return (
    <MobileLayout>
      <div
        className="flex flex-col px-5 overflow-hidden"
        style={{ height: "calc(100dvh - env(safe-area-inset-top) - env(safe-area-inset-bottom))" }}
      >
        {/* Back button */}
        <div className="flex items-center h-11 flex-shrink-0">
          <UnifiedBackButton onClick={() => setLocation("/")} testId="button-back-find-will" />
        </div>

        {/* Title block */}
        <div className="text-center px-2 mt-3 mb-5 flex-shrink-0">
          <h1 className="text-[26px] font-bold text-gray-900 leading-tight tracking-tight">
            Where do you feel<br />most off?
          </h1>
          <p className="text-sm text-gray-400 mt-1.5">
            Pick the area that pulls at you most right now.
          </p>
        </div>

        {/* Option cards — flex-1 so they fill remaining space */}
        <div className="flex flex-col gap-2.5 flex-1 justify-between pb-4">
          {LIFE_AREAS.map(({ label, sub, slug, color, bg, selectedBg, Icon }) => {
            const isSelected = selected === slug;
            return (
              <button
                key={slug}
                onClick={() => setSelected(slug)}
                className="w-full rounded-2xl text-left transition-all duration-150 active:scale-[0.98] overflow-hidden flex-1"
                style={{
                  backgroundColor: isSelected ? selectedBg : bg,
                  border: `1.5px solid ${isSelected ? color : 'transparent'}`,
                  boxShadow: isSelected
                    ? `0 0 0 0px ${color}30`
                    : '0 1px 3px rgba(0,0,0,0.06)',
                }}
                data-testid={`button-area-${slug}`}
              >
                <div className="flex items-stretch h-full">
                  {/* Left accent bar */}
                  <div
                    className="w-[5px] flex-shrink-0 rounded-l-2xl"
                    style={{ backgroundColor: color, opacity: isSelected ? 1 : 0.45 }}
                  />
                  {/* Text */}
                  <div className="flex-1 px-4 flex flex-col justify-center py-2">
                    <p
                      className="text-[15px] font-semibold leading-tight"
                      style={{ color: isSelected ? color : '#1C1C1E' }}
                    >
                      {label}
                    </p>
                    <p
                      className="text-xs mt-0.5"
                      style={{ color: isSelected ? color : '#9CA3AF', opacity: isSelected ? 0.8 : 1 }}
                    >
                      {sub}
                    </p>
                  </div>
                  {/* Right — icon + chevron */}
                  <div className="flex items-center gap-1.5 pr-4">
                    <Icon
                      className="w-4 h-4 flex-shrink-0"
                      style={{ color, opacity: isSelected ? 0.9 : 0.4 }}
                    />
                    <ChevronRight className="w-4 h-4 flex-shrink-0 text-gray-300" />
                  </div>
                </div>
              </button>
            );
          })}
        </div>

        {/* Bottom button — inline, not fixed */}
        <div
          className="flex-shrink-0 bg-white border-t border-gray-100 -mx-5 px-5"
          style={{ paddingTop: 12, paddingBottom: "max(16px, env(safe-area-inset-bottom))" }}
        >
          <button
            onClick={handleNext}
            disabled={!selected}
            className="w-full py-3.5 rounded-2xl text-sm font-semibold text-white transition-all duration-200 active:scale-[0.98] disabled:cursor-not-allowed"
            style={{ backgroundColor: "#1D9E75" }}
            data-testid="button-find-will"
          >
            Find my Will
          </button>
        </div>
      </div>
    </MobileLayout>
  );
}
