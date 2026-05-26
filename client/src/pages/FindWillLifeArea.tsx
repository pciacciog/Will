import { useState } from "react";
import { useLocation } from "wouter";
import { MobileLayout, UnifiedBackButton } from "@/components/ui/design-system";

const LIFE_AREAS = [
  {
    label: "Personal discipline",
    sub: "Habits, routines, self-control",
    slug: "personal_discipline",
    color: "#D97706",
    bg: "#FFFBEB",
    selectedBg: "#FEF3C7",
  },
  {
    label: "Health and body",
    sub: "Movement, sleep, nutrition",
    slug: "health_and_body",
    color: "#1D9E75",
    bg: "#F0FAF5",
    selectedBg: "#D1FAE5",
  },
  {
    label: "Relationships",
    sub: "Family, friends, connection",
    slug: "relationships",
    color: "#E11D48",
    bg: "#FFF1F4",
    selectedBg: "#FFE4E6",
  },
  {
    label: "Career and money",
    sub: "Work, income, stability",
    slug: "career_and_money",
    color: "#2563EB",
    bg: "#EFF6FF",
    selectedBg: "#DBEAFE",
  },
  {
    label: "Purpose and direction",
    sub: "Meaning, values, future self",
    slug: "purpose_and_direction",
    color: "#7C3AED",
    bg: "#F5F3FF",
    selectedBg: "#EDE9FE",
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
      <div className="pb-32 px-5">
        {/* Back button row */}
        <div className="flex items-center min-h-[44px]">
          <UnifiedBackButton onClick={() => setLocation("/")} testId="button-back-find-will" />
        </div>

        {/* Title block — lower with breathing room */}
        <div className="mt-6 mb-7 text-center px-2">
          <h1 className="text-[26px] font-bold text-gray-900 leading-tight tracking-tight">
            Where do you feel<br />most off?
          </h1>
          <p className="text-sm text-gray-400 mt-2">
            Pick the area that pulls at you most right now.
          </p>
        </div>

        {/* Option cards */}
        <div className="space-y-3">
          {LIFE_AREAS.map(({ label, sub, slug, color, bg, selectedBg }) => {
            const isSelected = selected === slug;
            return (
              <button
                key={slug}
                onClick={() => setSelected(slug)}
                className="w-full rounded-2xl text-left transition-all duration-150 active:scale-[0.98] overflow-hidden"
                style={{
                  backgroundColor: isSelected ? selectedBg : bg,
                  border: `1.5px solid ${isSelected ? color : 'transparent'}`,
                  boxShadow: isSelected
                    ? `0 0 0 0px ${color}30`
                    : '0 1px 3px rgba(0,0,0,0.06)',
                }}
                data-testid={`button-area-${slug}`}
              >
                <div className="flex items-stretch">
                  {/* Left accent bar */}
                  <div
                    className="w-1 flex-shrink-0 rounded-l-2xl"
                    style={{ backgroundColor: color, opacity: isSelected ? 1 : 0.35 }}
                  />
                  {/* Text */}
                  <div className="px-4 py-3.5">
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
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Fixed bottom button */}
      <div
        className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-100 px-5"
        style={{ paddingTop: 12, paddingBottom: "max(16px, env(safe-area-inset-bottom))" }}
      >
        <button
          onClick={handleNext}
          disabled={!selected}
          className="w-full py-3.5 rounded-2xl text-sm font-semibold text-white transition-all duration-200 active:opacity-80 disabled:opacity-40 disabled:cursor-not-allowed"
          style={{ backgroundColor: selected ? LIFE_AREAS.find(a => a.slug === selected)?.color ?? "#1D9E75" : "#1D9E75" }}
          data-testid="button-find-will"
        >
          Find my Will
        </button>
      </div>
    </MobileLayout>
  );
}
