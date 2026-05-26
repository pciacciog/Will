import { useState } from "react";
import { useLocation } from "wouter";
import { MobileLayout, UnifiedBackButton } from "@/components/ui/design-system";

const LIFE_AREAS = [
  { label: "Personal discipline",   sub: "Habits, routines, self-control",  slug: "personal_discipline" },
  { label: "Health and body",       sub: "Movement, sleep, nutrition",       slug: "health_and_body" },
  { label: "Relationships",         sub: "Family, friends, connection",      slug: "relationships" },
  { label: "Career and money",      sub: "Work, income, stability",          slug: "career_and_money" },
  { label: "Purpose and direction", sub: "Meaning, values, future self",     slug: "purpose_and_direction" },
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
        {/* Header */}
        <div className="flex items-center min-h-[44px]">
          <UnifiedBackButton onClick={() => setLocation("/")} testId="button-back-find-will" />
          <h1 className="flex-1 text-center text-base font-semibold text-gray-900 pr-11">
            Where do you feel most off?
          </h1>
        </div>

        <p className="text-center text-xs text-gray-400 mt-0.5 mb-5">Pick the area that pulls at you most right now.</p>

        {/* Option cards */}
        <div className="space-y-3">
          {LIFE_AREAS.map(({ label, sub, slug }) => (
            <button
              key={slug}
              onClick={() => setSelected(slug)}
              className={`w-full rounded-2xl border p-4 text-left transition-all duration-150 active:scale-[0.98] ${
                selected === slug
                  ? "border-[#1D9E75] bg-[#F0FAF5] shadow-sm"
                  : "border-gray-200 bg-white shadow-sm hover:border-gray-300"
              }`}
              data-testid={`button-area-${slug}`}
            >
              <p className={`text-sm font-semibold leading-tight ${
                selected === slug ? "text-[#1D9E75]" : "text-gray-800"
              }`}>
                {label}
              </p>
              <p className={`text-xs mt-0.5 ${
                selected === slug ? "text-[#1D9E75]/70" : "text-gray-400"
              }`}>
                {sub}
              </p>
            </button>
          ))}
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
          style={{ backgroundColor: "#1D9E75" }}
          data-testid="button-find-will"
        >
          Find my Will
        </button>
      </div>
    </MobileLayout>
  );
}
