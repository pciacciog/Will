import { useState } from "react";
import { useLocation } from "wouter";
import { MobileLayout, UnifiedBackButton } from "@/components/ui/design-system";

const LIFE_AREAS = [
  { label: "Personal discipline",   slug: "personal_discipline" },
  { label: "Health and body",       slug: "health_and_body" },
  { label: "Relationships",         slug: "relationships" },
  { label: "Career and money",      slug: "career_and_money" },
  { label: "Purpose and direction", slug: "purpose_and_direction" },
] as const;

export default function FindWillLifeArea() {
  const [, setLocation] = useLocation();
  const [selected, setSelected] = useState<string | null>(null);
  const [reflection, setReflection] = useState("");

  const handleNext = () => {
    if (!selected) return;
    const params = new URLSearchParams();
    params.set("area", selected);
    if (reflection.trim()) params.set("text", reflection.trim());
    setLocation(`/find-will/suggestions?${params.toString()}`);
  };

  return (
    <MobileLayout>
      <div className="pb-32 px-5 space-y-5">
        {/* Header */}
        <div className="flex items-center min-h-[44px]">
          <UnifiedBackButton onClick={() => setLocation("/")} testId="button-back-find-will" />
          <h1 className="flex-1 text-center text-base font-semibold text-gray-900 pr-11">
            Where do you feel most off?
          </h1>
        </div>

        {/* Option cards */}
        <div className="space-y-2.5">
          {LIFE_AREAS.map(({ label, slug }) => (
            <button
              key={slug}
              onClick={() => setSelected(slug)}
              className={`w-full rounded-2xl border p-4 text-left transition-all duration-150 active:scale-[0.98] ${
                selected === slug
                  ? "border-[#1D9E75] bg-[#F0FAF5] shadow-sm"
                  : "border-gray-200 bg-white shadow-sm"
              }`}
              data-testid={`button-area-${slug}`}
            >
              <span
                className={`text-sm font-medium ${
                  selected === slug ? "text-[#1D9E75]" : "text-gray-800"
                }`}
              >
                {label}
              </span>
            </button>
          ))}
        </div>

        {/* Open text input */}
        <div className="space-y-1.5">
          <label className="text-[11px] font-semibold uppercase tracking-widest text-gray-400">
            What keeps coming up for you in this area?
          </label>
          <textarea
            value={reflection}
            onChange={(e) => setReflection(e.target.value)}
            placeholder="Be honest, even one sentence helps."
            rows={3}
            className="w-full bg-gray-50 text-gray-900 placeholder:text-gray-400 rounded-xl px-3.5 py-2.5 text-sm resize-none focus:outline-none focus:ring-1 focus:ring-emerald-500/40 border border-gray-200"
            data-testid="input-reflection"
          />
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
