import { useState, useCallback } from "react";
import { useLocation } from "wouter";
import { RotateCcw, CheckCircle } from "lucide-react";
import { MobileLayout, UnifiedBackButton } from "@/components/ui/design-system";

type WillCategory = "recurring" | "duration" | "event";

interface SuggestionPool {
  recurring: string[];
  duration: string[];
  event: string[];
}

const REFLECTIONS: Record<string, string> = {
  personal_discipline:   "Discipline is built one decision at a time.",
  health_and_body:       "Your body keeps the score. Start small.",
  relationships:         "The people in your life feel your presence or your absence.",
  career_and_money:      "Clarity on one thing beats confusion about everything.",
  purpose_and_direction: "You already know what matters. You just haven't committed yet.",
};

const AREA_BADGE: Record<string, string> = {
  personal_discipline:   "🧠 Personal Discipline",
  health_and_body:       "💪 Health & Body",
  relationships:         "❤️ Relationships",
  career_and_money:      "💼 Career & Money",
  purpose_and_direction: "🧭 Purpose & Direction",
};

const POOLS: Record<string, SuggestionPool> = {
  personal_discipline: {
    recurring: [
      "I will wake up at 5:30am every day without hitting snooze",
      "I will make my bed every single morning before I leave my room",
      "I will read for 20 minutes every night before bed",
      "I will plan my next day the night before every day",
      "I will do 10 minutes of meditation every morning",
    ],
    duration: [
      "I will not look at my phone for the first 30 minutes of my day for 21 days",
      "I will wake up at the same time every day for 30 days",
      "I will not watch TV for 2 weeks",
      "I will do a digital detox every Sunday for a month",
      "I will go to bed before midnight every night for 21 days",
    ],
    event: [
      "I will write out my top 3 priorities every Sunday night this week",
      "I will delete every app on my phone that wastes my time this weekend",
      "I will set up my ideal morning routine on paper today",
      "I will identify my single biggest distraction and eliminate it this week",
      "I will block off deep work time on my calendar for the next month this week",
    ],
  },
  health_and_body: {
    recurring: [
      "I will train for at least 30 minutes every day",
      "I will train before I open my phone every morning",
      "I will go for a 20 minute walk every day",
      "I will not eat after 8pm every day",
      "I will stretch for 10 minutes every night before bed",
    ],
    duration: [
      "I will cut out sugar completely for 30 days",
      "I will not drink alcohol for 30 days",
      "I will eat no processed food for 2 weeks",
      "I will train every day for 21 days without missing",
      "I will sleep at least 7 hours every night for 30 days",
    ],
    event: [
      "I will book my annual health checkup this week",
      "I will sign up for a gym or fitness class this week",
      "I will meal prep for the entire week this Sunday",
      "I will get my bloodwork done this month",
      "I will buy nothing but whole foods at my next grocery run",
    ],
  },
  relationships: {
    recurring: [
      "I will check in on someone I care about every day",
      "I will tell someone I love them every single day",
      "I will put my phone away for the first hour after getting home every day",
      "I will write one thing I appreciate about someone in my life every morning",
      "I will have one real conversation every day — no small talk",
    ],
    duration: [
      "I will put my phone away during every meal for 14 days",
      "I will not complain to anyone about anything for 7 days",
      "I will reach out to one person I have lost touch with every day for 2 weeks",
      "I will go screen-free every evening after 8pm for 21 days",
      "I will say something genuine and specific to someone I love every day for 30 days",
    ],
    event: [
      "I will write a letter to someone who has impacted my life this week",
      "I will plan a meaningful experience with someone I love this month",
      "I will have an honest conversation I have been avoiding this week",
      "I will call my parents or a family member I have been neglecting this week",
      "I will apologize to someone I owe an apology to this week",
    ],
  },
  career_and_money: {
    recurring: [
      "I will spend 30 minutes every day working on my most important project",
      "I will review my finances for 10 minutes every morning",
      "I will reach out to one person in my industry every single day",
      "I will learn something new in my field for 20 minutes every day",
      "I will write down one idea every day no matter what",
    ],
    duration: [
      "I will track every dollar I spend for 30 days",
      "I will not make any unnecessary purchases for 21 days",
      "I will work on my side project for at least 1 hour every day for 30 days",
      "I will cut out one recurring expense I do not need for 60 days",
      "I will cold outreach one person every day for 30 days",
    ],
    event: [
      "I will send that email I have been putting off this week",
      "I will set up a budget this weekend",
      "I will update my resume or portfolio this week",
      "I will have the salary or rate conversation I have been avoiding this month",
      "I will define my 90 day career goal in writing this week",
    ],
  },
  purpose_and_direction: {
    recurring: [
      "I will journal for 10 minutes every morning",
      "I will spend 15 minutes every day working toward something that is purely mine",
      "I will listen to something that challenges my thinking every day",
      "I will spend 30 minutes every day working on my own thing — no exceptions",
      "I will do one thing every day that the person I want to become would do",
    ],
    duration: [
      "I will consume zero mindless content for 14 days",
      "I will read one book this month from cover to cover",
      "I will spend 30 days saying yes to things that scare me",
      "I will go social media free for 21 days",
      "I will spend 30 days doing one thing every day that moves me toward my goal",
    ],
    event: [
      "I will write out where I want to be in 1 year and why this week",
      "I will identify my core values and write them down this weekend",
      "I will have a conversation with someone who is living the life I want this month",
      "I will write my personal mission statement this week",
      "I will make a decision I have been sitting on for too long this week",
    ],
  },
};

const TYPE_LABEL: Record<WillCategory, string> = {
  recurring: "Recurring",
  duration:  "Duration",
  event:     "Event",
};

const TYPE_COLOR: Record<WillCategory, string> = {
  recurring: "#1D9E75",
  duration:  "#185FA5",
  event:     "#3C3489",
};

const TYPE_BG: Record<WillCategory, string> = {
  recurring: "#E8F7F2",
  duration:  "#EBF2FB",
  event:     "#EEEDF9",
};

const TYPE_TEXT: Record<WillCategory, string> = {
  recurring: "#085041",
  duration:  "#0D3A6B",
  event:     "#2A2460",
};

const TYPE_BADGE_BG: Record<WillCategory, string> = {
  recurring: "#D1F5E8",
  duration:  "#DAEAF8",
  event:     "#E2E1F5",
};

function pickRandom<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

interface Card {
  type: WillCategory;
  text: string;
}

export default function FindWillSuggestions() {
  const [, setLocation] = useLocation();
  const params = new URLSearchParams(window.location.search);
  const area = params.get("area") || "personal_discipline";

  const [selected, setSelected] = useState<number | null>(null);

  const buildCards = useCallback((): Card[] => {
    const pool = POOLS[area] ?? POOLS.personal_discipline;
    return [
      { type: "recurring", text: pickRandom(pool.recurring) },
      { type: "duration",  text: pickRandom(pool.duration) },
      { type: "event",     text: pickRandom(pool.event) },
    ];
  }, [area]);

  const [cards, setCards] = useState<Card[]>(buildCards);

  const reshuffle = () => {
    setCards(buildCards());
    setSelected(null);
  };

  const reflection = REFLECTIONS[area] ?? "";
  const areaBadge = AREA_BADGE[area] ?? "";

  const handleCommit = () => {
    if (selected === null) return;
    const s = cards[selected];
    const dest = new URLSearchParams();
    dest.set("what", s.text);
    dest.set("category", s.type);
    setLocation(`/create-will?${dest.toString()}`);
  };

  const selectedCard = selected !== null ? cards[selected] : null;
  const commitColor = selectedCard ? TYPE_COLOR[selectedCard.type] : "#1D9E75";

  return (
    <MobileLayout>
      <div className="pb-32 px-5 space-y-4">
        {/* Header */}
        <div className="flex items-center min-h-[44px]">
          <UnifiedBackButton
            onClick={() => window.history.back()}
            testId="button-back-suggestions"
          />
          <div className="flex-1" />
        </div>

        {/* Area context badge */}
        {areaBadge && (
          <div className="flex justify-center">
            <span
              className="inline-flex items-center px-3 py-1 rounded-full text-[12px] font-semibold text-gray-600 bg-gray-100 border border-gray-200"
              data-testid="badge-area-context"
            >
              {areaBadge}
            </span>
          </div>
        )}

        {/* Reflection line */}
        <p className="text-sm text-gray-400 italic text-center px-2">{reflection}</p>

        {/* Suggestion cards */}
        <div className="space-y-3">
          {cards.map((s, i) => {
            const isSelected = selected === i;
            const isOther = selected !== null && !isSelected;
            return (
              <button
                key={i}
                onClick={() => setSelected(i)}
                className="w-full rounded-2xl border p-4 text-left transition-all duration-200 active:scale-[0.98] relative"
                style={{
                  borderColor: isSelected ? TYPE_COLOR[s.type] : '#E5E7EB',
                  backgroundColor: isSelected ? TYPE_BG[s.type] : 'white',
                  boxShadow: isSelected ? `0 0 0 1.5px ${TYPE_COLOR[s.type]}22` : '0 1px 3px rgba(0,0,0,0.06)',
                  opacity: isOther ? 0.45 : 1,
                }}
                data-testid={`button-suggestion-${i}`}
              >
                {/* Checkmark badge — top right when selected */}
                {isSelected && (
                  <CheckCircle
                    className="absolute top-3 right-3 w-5 h-5"
                    style={{ color: TYPE_COLOR[s.type] }}
                  />
                )}
                <span
                  className="inline-block px-2.5 py-0.5 rounded-full text-[11px] font-semibold mb-2"
                  style={{
                    backgroundColor: isSelected ? TYPE_BADGE_BG[s.type] : '#F3F4F6',
                    color: isSelected ? TYPE_COLOR[s.type] : '#6B7280',
                  }}
                >
                  {TYPE_LABEL[s.type]}
                </span>
                <p
                  className="text-sm font-medium leading-snug pr-6"
                  style={{ color: isSelected ? TYPE_TEXT[s.type] : '#1F2937' }}
                >
                  "{s.text}"
                </p>
              </button>
            );
          })}
        </div>

        {/* Circular refresh button — small, quiet, icon-only */}
        <div className="flex justify-center pt-1">
          <button
            onClick={reshuffle}
            className="flex items-center justify-center w-9 h-9 rounded-full bg-white border border-gray-200 shadow-sm transition-all active:scale-95 hover:border-gray-300"
            data-testid="button-reshuffle"
            aria-label="Show different suggestions"
          >
            <RotateCcw className="w-4 h-4 text-gray-400" />
          </button>
        </div>
      </div>

      {/* Fixed bottom button — appears once a card is selected */}
      {selected !== null && (
        <div
          className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-100 px-5 transition-all duration-200"
          style={{ paddingTop: 12, paddingBottom: "max(16px, env(safe-area-inset-bottom))" }}
        >
          <button
            onClick={handleCommit}
            className="w-full py-3.5 rounded-2xl text-sm font-semibold text-white transition-all duration-200 active:opacity-80"
            style={{ backgroundColor: commitColor }}
            data-testid="button-commit-will"
          >
            Commit to this Will
          </button>
        </div>
      )}
    </MobileLayout>
  );
}
