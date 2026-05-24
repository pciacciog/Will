import { useState } from "react";
import { useLocation } from "wouter";
import { MobileLayout, UnifiedBackButton } from "@/components/ui/design-system";

type WillCategory = "recurring" | "duration" | "event";

interface Suggestion {
  type: WillCategory;
  text: string;
}

const REFLECTIONS: Record<string, string> = {
  personal_discipline:  "Discipline is built one decision at a time.",
  health_and_body:      "Your body keeps the score. Start small.",
  relationships:        "The people in your life feel your presence or your absence.",
  career_and_money:     "Clarity on one thing beats confusion about everything.",
  purpose_and_direction: "You already know what matters. You just haven't committed yet.",
};

const SUGGESTIONS: Record<string, Suggestion[]> = {
  personal_discipline: [
    { type: "recurring", text: "I will wake up at 5:30am every day without hitting snooze" },
    { type: "duration",  text: "I will not look at my phone for the first 30 minutes of my day for 21 days" },
    { type: "event",     text: "I will write out my top 3 priorities every Sunday night" },
  ],
  health_and_body: [
    { type: "recurring", text: "I will train for at least 30 minutes every day" },
    { type: "duration",  text: "I will cut out sugar completely for 30 days" },
    { type: "event",     text: "I will book my annual health checkup this week" },
  ],
  relationships: [
    { type: "recurring", text: "I will check in on someone I care about every day" },
    { type: "duration",  text: "I will put my phone away during every meal for 14 days" },
    { type: "event",     text: "I will write a letter to someone who has impacted my life" },
  ],
  career_and_money: [
    { type: "recurring", text: "I will spend 30 minutes every day working on my most important project" },
    { type: "duration",  text: "I will track every dollar I spend for 30 days" },
    { type: "event",     text: "I will send that email I have been putting off this week" },
  ],
  purpose_and_direction: [
    { type: "recurring", text: "I will journal for 10 minutes every morning" },
    { type: "duration",  text: "I will consume zero mindless content for 14 days" },
    { type: "event",     text: "I will write out where I want to be in 1 year and why" },
  ],
};

const TYPE_LABEL: Record<WillCategory, string> = {
  recurring: "Recurring",
  duration:  "Duration",
  event:     "Event",
};

const TYPE_BADGE_CLASS: Record<WillCategory, string> = {
  recurring: "bg-emerald-100 text-emerald-700",
  duration:  "bg-blue-100 text-blue-700",
  event:     "bg-[#EEEDF9] text-[#534AB7]",
};

export default function FindWillSuggestions() {
  const [, setLocation] = useLocation();
  const params = new URLSearchParams(window.location.search);
  const area = params.get("area") || "personal_discipline";

  const [selected, setSelected] = useState<number | null>(null);

  const suggestions = SUGGESTIONS[area] ?? SUGGESTIONS.personal_discipline;
  const reflection = REFLECTIONS[area] ?? "";

  const handleCommit = () => {
    if (selected === null) return;
    const s = suggestions[selected];
    const dest = new URLSearchParams();
    dest.set("what", s.text);
    dest.set("category", s.type);
    setLocation(`/create-will?${dest.toString()}`);
  };

  return (
    <MobileLayout>
      <div className="pb-32 px-5 space-y-5">
        {/* Header */}
        <div className="flex items-center min-h-[44px]">
          <UnifiedBackButton
            onClick={() => window.history.back()}
            testId="button-back-suggestions"
          />
          <div className="flex-1" />
        </div>

        {/* Reflection line */}
        <p className="text-sm text-gray-400 italic text-center px-2">{reflection}</p>

        {/* Suggestion cards */}
        <div className="space-y-3">
          {suggestions.map((s, i) => (
            <button
              key={i}
              onClick={() => setSelected(i)}
              className={`w-full rounded-2xl border p-4 text-left transition-all duration-150 active:scale-[0.98] ${
                selected === i
                  ? "border-[#1D9E75] bg-[#F0FAF5] shadow-sm"
                  : "border-gray-200 bg-white shadow-sm"
              }`}
              data-testid={`button-suggestion-${i}`}
            >
              <span
                className={`inline-block px-2.5 py-0.5 rounded-full text-[11px] font-semibold mb-2 ${TYPE_BADGE_CLASS[s.type]}`}
              >
                {TYPE_LABEL[s.type]}
              </span>
              <p
                className={`text-sm font-medium leading-snug ${
                  selected === i ? "text-[#085041]" : "text-gray-800"
                }`}
              >
                "{s.text}"
              </p>
            </button>
          ))}
        </div>
      </div>

      {/* Fixed bottom button — appears once a card is selected */}
      {selected !== null && (
        <div
          className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-100 px-5"
          style={{ paddingTop: 12, paddingBottom: "max(16px, env(safe-area-inset-bottom))" }}
        >
          <button
            onClick={handleCommit}
            className="w-full py-3.5 rounded-2xl text-sm font-semibold text-white transition-all duration-200 active:opacity-80"
            style={{ backgroundColor: "#1D9E75" }}
            data-testid="button-commit-will"
          >
            Commit to this Will
          </button>
        </div>
      )}
    </MobileLayout>
  );
}
