import { useState, useEffect } from "react";

export interface NotificationsData {
  commitmentCategory: 'habit' | 'abstain' | 'mission';
  reminderTime: string | null;
  checkInTime: string | null;
  checkInType: 'daily' | 'specific_days' | 'final_review';
  milestones: { day: number; label: string }[] | null;
  missionReminderTime: string | null;
  deadlineReminders: { threeDays: boolean; oneDay: boolean; dayOf: boolean };
}

interface NotificationsSetupProps {
  what: string;
  because: string;
  onComplete: (data: NotificationsData) => void;
  onBack: () => void;
}

type Category = 'habit' | 'abstain' | 'mission';

const TIME_OPTIONS = [
  { label: "6:00 AM", value: "06:00" },
  { label: "6:30 AM", value: "06:30" },
  { label: "7:00 AM", value: "07:00" },
  { label: "7:30 AM", value: "07:30" },
  { label: "8:00 AM", value: "08:00" },
  { label: "8:30 AM", value: "08:30" },
  { label: "9:00 AM", value: "09:00" },
  { label: "12:00 PM", value: "12:00" },
  { label: "3:00 PM", value: "15:00" },
  { label: "5:00 PM", value: "17:00" },
  { label: "6:00 PM", value: "18:00" },
  { label: "7:00 PM", value: "19:00" },
  { label: "7:30 PM", value: "19:30" },
  { label: "8:00 PM", value: "20:00" },
  { label: "8:30 PM", value: "20:30" },
  { label: "9:00 PM", value: "21:00" },
  { label: "9:30 PM", value: "21:30" },
  { label: "10:00 PM", value: "22:00" },
];

const DEFAULT_MILESTONES = [
  { day: 1, label: "First day done, hardest part over" },
  { day: 3, label: "You're halfway there, keep going" },
  { day: 6, label: "One last day, finish strong" },
];

const COLORS: Record<Category, { bg: string; border: string; text: string; pillBg: string; pillBorder: string; pillText: string; tint: string; chipBg: string; chipBorder: string; chipText: string; toggleOn: string; checkBg: string }> = {
  habit: {
    bg: "#1D9E75",
    border: "#1D9E75",
    text: "#1D9E75",
    pillBg: "#E8F7F1",
    pillBorder: "#1D9E75",
    pillText: "#1D9E75",
    tint: "#E8F7F1",
    chipBg: "#E8F7F1",
    chipBorder: "#1D9E75",
    chipText: "#1D9E75",
    toggleOn: "#1D9E75",
    checkBg: "#1D9E75",
  },
  abstain: {
    bg: "#D85A30",
    border: "#D85A30",
    text: "#D85A30",
    pillBg: "#FBF0EB",
    pillBorder: "#D85A30",
    pillText: "#D85A30",
    tint: "#FBF0EB",
    chipBg: "#FBF0EB",
    chipBorder: "#D85A30",
    chipText: "#D85A30",
    toggleOn: "#D85A30",
    checkBg: "#D85A30",
  },
  mission: {
    bg: "#534AB7",
    border: "#534AB7",
    text: "#534AB7",
    pillBg: "#EEEDF9",
    pillBorder: "#534AB7",
    pillText: "#534AB7",
    tint: "#EEEDF9",
    chipBg: "#EEEDF9",
    chipBorder: "#534AB7",
    chipText: "#534AB7",
    toggleOn: "#534AB7",
    checkBg: "#534AB7",
  },
};

function formatTime(value: string): string {
  const opt = TIME_OPTIONS.find(t => t.value === value);
  if (opt) return opt.label;
  const [h, m] = value.split(":").map(Number);
  const period = h >= 12 ? "PM" : "AM";
  const display = h === 0 ? 12 : h > 12 ? h - 12 : h;
  return `${display}:${String(m).padStart(2, "0")} ${period}`;
}

function Toggle({ on, onChange, color }: { on: boolean; onChange: (v: boolean) => void; color: string }) {
  return (
    <button
      type="button"
      onClick={() => onChange(!on)}
      data-testid="toggle-notification"
      aria-label={on ? "Turn off" : "Turn on"}
      style={{
        position: "relative",
        flexShrink: 0,
        width: 51,
        height: 31,
        borderRadius: 15.5,
        background: on ? color : "#E5E7EB",
        border: "none",
        outline: "none",
        cursor: "pointer",
        overflow: "hidden",
        transition: "background 0.2s",
        padding: 0,
        display: "inline-flex",
        alignItems: "center",
      }}
    >
      <span
        style={{
          position: "absolute",
          width: 23,
          height: 23,
          borderRadius: "50%",
          background: "#fff",
          top: 4,
          left: on ? 24 : 4,
          boxShadow: "0 1px 3px rgba(0,0,0,0.2)",
          transition: "left 0.2s",
        }}
      />
    </button>
  );
}

function TimeChip({ value, onChange, color }: { value: string; onChange: (v: string) => void; color: typeof COLORS.habit }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-semibold transition-all active:scale-95"
        style={{ background: color.chipBg, border: `1.5px solid ${color.chipBorder}`, color: color.chipText }}
        data-testid="chip-time"
      >
        <svg viewBox="0 0 24 24" style={{ width: 14, height: 14, flexShrink: 0 }} fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" />
        </svg>
        {formatTime(value)}
      </button>
      {open && (
        <div
          className="absolute left-0 z-20 mt-1 rounded-xl overflow-y-auto shadow-lg border border-gray-100 bg-white"
          style={{ width: 160, maxHeight: 240 }}
        >
          {TIME_OPTIONS.map(opt => (
            <button
              key={opt.value}
              type="button"
              onClick={() => { onChange(opt.value); setOpen(false); }}
              className="w-full text-left px-4 py-2.5 text-sm transition-colors hover:bg-gray-50"
              style={opt.value === value ? { color: color.chipText, fontWeight: 600, background: color.chipBg } : { color: "#374151" }}
              data-testid={`option-time-${opt.value}`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function PreviewCard({ title, subtitle }: { title: string; subtitle: string }) {
  return (
    <div className="rounded-xl p-3 mt-3" style={{ background: "#F3F4F6" }}>
      <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-widest mb-1">NOTIFICATION PREVIEW</p>
      <p className="text-sm font-bold text-gray-900 leading-snug">{title || "Your will"}</p>
      <p className="text-xs text-gray-500 mt-0.5 leading-snug">{subtitle || "Because…"}</p>
    </div>
  );
}

function NotifCard({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-4 mb-3">
      <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-widest mb-3">{label}</p>
      {children}
    </div>
  );
}

interface MilestoneRow {
  day: number;
  label: string;
}

export default function NotificationsSetup({ what, because, onComplete, onBack }: NotificationsSetupProps) {
  const formattedWhat = what?.toLowerCase().startsWith('i will')
    ? what
    : `I will ${what}`;

  const [selected, setSelected] = useState<Category | null>(null);

  const [habitState, setHabitState] = useState({
    reminderOn: true, reminderTime: "20:30",
    checkInOn: true, checkInTime: "08:00",
  });
  const [abstainState, setAbstainState] = useState({
    reminderOn: true, reminderTime: "18:00",
    milestones: [...DEFAULT_MILESTONES] as MilestoneRow[],
  });
  const [missionState, setMissionState] = useState({
    threeDays: true, oneDay: true, dayOf: true,
    dailyOn: false, dailyTime: "09:00",
  });

  const handleContinue = () => {
    if (!selected) return;

    let data: NotificationsData;

    if (selected === 'habit') {
      data = {
        commitmentCategory: 'habit',
        reminderTime: habitState.reminderOn ? habitState.reminderTime : null,
        checkInTime: habitState.checkInOn ? habitState.checkInTime : null,
        checkInType: 'daily',
        milestones: null,
        missionReminderTime: null,
        deadlineReminders: { threeDays: false, oneDay: false, dayOf: false },
      };
    } else if (selected === 'abstain') {
      data = {
        commitmentCategory: 'abstain',
        reminderTime: abstainState.reminderOn ? abstainState.reminderTime : null,
        checkInTime: null,
        checkInType: 'final_review',
        milestones: abstainState.milestones,
        missionReminderTime: null,
        deadlineReminders: { threeDays: false, oneDay: false, dayOf: false },
      };
    } else {
      data = {
        commitmentCategory: 'mission',
        reminderTime: null,
        checkInTime: null,
        checkInType: 'final_review',
        milestones: null,
        missionReminderTime: missionState.dailyOn ? missionState.dailyTime : null,
        deadlineReminders: {
          threeDays: missionState.threeDays,
          oneDay: missionState.oneDay,
          dayOf: missionState.dayOf,
        },
      };
    }

    onComplete(data);
  };

  const CARDS: {
    category: Category;
    title: string;
    example: string;
    iconBg: string;
    iconColor: string;
    selectedCardBg: string;
    selectedBorder: string;
    selectedTitle: string;
    selectedExample: string;
    icon: 'check-circle' | 'x-circle' | 'star';
  }[] = [
    {
      category: 'habit',
      title: 'Habit',
      example: '"I will be in bed by 9:00 pm"',
      iconBg: '#E1F5EE',
      iconColor: '#1D9E75',
      selectedCardBg: '#E8F7F1',
      selectedBorder: '#1D9E75',
      selectedTitle: '#085041',
      selectedExample: '#0F6E56',
      icon: 'check-circle',
    },
    {
      category: 'abstain',
      title: 'Abstain',
      example: '"I will not use social media"',
      iconBg: '#FAECE7',
      iconColor: '#D85A30',
      selectedCardBg: '#FBF0EB',
      selectedBorder: '#D85A30',
      selectedTitle: '#7A2913',
      selectedExample: '#A0401A',
      icon: 'x-circle',
    },
    {
      category: 'mission',
      title: 'Mission',
      example: '"I will call my grandmother"',
      iconBg: '#EEEDFE',
      iconColor: '#534AB7',
      selectedCardBg: '#EEEDF9',
      selectedBorder: '#534AB7',
      selectedTitle: '#2B2580',
      selectedExample: '#403AA0',
      icon: 'star',
    },
  ];

  return (
    <div className="flex flex-col min-h-0">
      {/* ── No selection: three big tap cards ── */}
      {!selected && (
        <div className="px-4 flex flex-col" style={{ gap: 10 }}>
          {CARDS.map(card => (
            <button
              key={card.category}
              type="button"
              onClick={() => setSelected(card.category)}
              className="w-full text-left transition-all duration-150 active:scale-[0.98] rounded-2xl"
              style={{
                background: '#fafafa',
                border: '1.5px solid #eee',
                padding: '14px 16px',
                display: 'flex',
                alignItems: 'center',
                gap: 14,
              }}
              data-testid={`card-${card.category}`}
            >
              <div
                style={{
                  width: 38,
                  height: 38,
                  borderRadius: 10,
                  background: card.iconBg,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                }}
              >
                {card.icon === 'check-circle' && (
                  <svg viewBox="0 0 24 24" style={{ width: 22, height: 22 }} fill="none" stroke={card.iconColor} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="12" cy="12" r="10" /><polyline points="9 12 11 14 15 10" />
                  </svg>
                )}
                {card.icon === 'x-circle' && (
                  <svg viewBox="0 0 24 24" style={{ width: 22, height: 22 }} fill="none" stroke={card.iconColor} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="12" cy="12" r="10" />
                    <line x1="15" y1="9" x2="9" y2="15" /><line x1="9" y1="9" x2="15" y2="15" />
                  </svg>
                )}
                {card.icon === 'star' && (
                  <svg viewBox="0 0 24 24" style={{ width: 22, height: 22 }} fill="none" stroke={card.iconColor} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
                  </svg>
                )}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-base font-bold leading-tight" style={{ color: '#111' }}>{card.title}</p>
                <p className="text-sm italic mt-0.5 leading-snug" style={{ color: '#888' }}>{card.example}</p>
              </div>
            </button>
          ))}
        </div>
      )}

      {/* ── After selection: compact pills + will statement + section ── */}
      {selected && (
        <>
          {/* Compact pill row */}
          <div className="flex gap-2 px-4 mb-2 flex-shrink-0">
            {(["habit", "abstain", "mission"] as Category[]).map(cat => (
              <button
                key={cat}
                type="button"
                onClick={() => setSelected(cat)}
                className="flex-1 py-2 rounded-full text-sm font-semibold transition-all active:scale-95"
                style={selected === cat
                  ? { background: COLORS[cat].pillBg, border: `2px solid ${COLORS[cat].pillBorder}`, color: COLORS[cat].pillText }
                  : { background: "#fff", border: "1.5px solid #D1D5DB", color: "#9CA3AF" }
                }
                data-testid={`pill-${cat}`}
              >
                {cat.charAt(0).toUpperCase() + cat.slice(1)}
              </button>
            ))}
          </div>

          {/* User's actual will statement */}
          <p
            className="px-4 mb-3 text-sm italic font-medium flex-shrink-0"
            style={{ color: COLORS[selected].text }}
          >
            "{formattedWhat}"
          </p>

          {/* Notification section */}
          <div className="px-4 pb-24 flex-1 overflow-y-auto">
            {selected === 'habit' && (
              <HabitSectionControlled
                what={formattedWhat}
                because={because}
                color={COLORS.habit}
                state={habitState}
                onChange={setHabitState}
              />
            )}
            {selected === 'abstain' && (
              <AbstainSectionControlled
                what={formattedWhat}
                because={because}
                color={COLORS.abstain}
                state={abstainState}
                onChange={setAbstainState}
              />
            )}
            {selected === 'mission' && (
              <MissionSectionControlled
                what={formattedWhat}
                because={because}
                color={COLORS.mission}
                state={missionState}
                onChange={setMissionState}
              />
            )}
          </div>
        </>
      )}

      {/* Continue button — fixed at bottom */}
      <div
        className="fixed bottom-0 left-0 right-0 px-4 pb-[calc(env(safe-area-inset-bottom)+1rem)] pt-3 bg-white border-t border-gray-100"
        style={{ maxWidth: "640px", margin: "0 auto" }}
      >
        <button
          type="button"
          onClick={handleContinue}
          disabled={!selected}
          className="w-full py-4 rounded-2xl text-base font-semibold text-white transition-all active:scale-[0.98]"
          style={selected
            ? { background: COLORS[selected].bg }
            : { background: "#E5E7EB", color: "#9CA3AF", cursor: "not-allowed" }
          }
          data-testid="button-notifications-continue"
        >
          Continue
        </button>
      </div>
    </div>
  );
}

/* ── Controlled wrappers so parent can read state ── */

function HabitSectionControlled({
  what, because, color, state, onChange,
}: {
  what: string; because: string; color: typeof COLORS.habit;
  state: { reminderOn: boolean; reminderTime: string; checkInOn: boolean; checkInTime: string };
  onChange: (s: typeof state) => void;
}) {
  const { reminderOn, reminderTime, checkInOn, checkInTime } = state;
  return (
    <div>
      <NotifCard label="Want a reminder before?">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-base font-bold text-gray-900">Reminder</p>
            <p className="text-xs text-gray-500 mt-0.5">Fires before the moment</p>
          </div>
          <Toggle on={reminderOn} onChange={v => onChange({ ...state, reminderOn: v })} color={color.toggleOn} />
        </div>
        {reminderOn && (
          <div className="mt-3">
            <TimeChip value={reminderTime} onChange={v => onChange({ ...state, reminderTime: v })} color={color} />
            <PreviewCard title={what} subtitle={because} />
          </div>
        )}
      </NotifCard>

      <NotifCard label="Want to check in after?">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-base font-bold text-gray-900">Check-in</p>
            <p className="text-xs text-gray-500 mt-0.5">Log how it went</p>
          </div>
          <Toggle on={checkInOn} onChange={v => onChange({ ...state, checkInOn: v })} color={color.toggleOn} />
        </div>
        {checkInOn && (
          <div className="mt-3">
            <TimeChip value={checkInTime} onChange={v => onChange({ ...state, checkInTime: v })} color={color} />
            <PreviewCard title="Did you honor your will?" subtitle={what} />
          </div>
        )}
      </NotifCard>
    </div>
  );
}

function AbstainSectionControlled({
  what, because, color, state, onChange,
}: {
  what: string; because: string; color: typeof COLORS.abstain;
  state: { reminderOn: boolean; reminderTime: string; milestones: MilestoneRow[] };
  onChange: (s: typeof state) => void;
}) {
  const { reminderOn, reminderTime, milestones } = state;
  const [openIdx, setOpenIdx] = useState<number | null>(null);
  const [localDayStr, setLocalDayStr] = useState<string>('');
  const [confirmDeleteIdx, setConfirmDeleteIdx] = useState<number | null>(null);

  useEffect(() => {
    if (openIdx !== null && milestones[openIdx]) {
      setLocalDayStr(String(milestones[openIdx].day));
      setConfirmDeleteIdx(null);
    }
  }, [openIdx]);

  const handleToggleMilestone = (i: number) => setOpenIdx(prev => prev === i ? null : i);
  const updateDay = (i: number, day: number) => onChange({ ...state, milestones: milestones.map((m, idx) => idx === i ? { ...m, day } : m) });
  const updateLabel = (i: number, label: string) => onChange({ ...state, milestones: milestones.map((m, idx) => idx === i ? { ...m, label } : m) });
  const addMilestone = () => {
    const newMs = [...milestones, { day: 21, label: "Three weeks" }];
    onChange({ ...state, milestones: newMs });
    setOpenIdx(newMs.length - 1);
  };
  const deleteMilestone = (i: number) => {
    const newMs = milestones.filter((_, idx) => idx !== i);
    onChange({ ...state, milestones: newMs });
    setOpenIdx(null);
    setConfirmDeleteIdx(null);
  };

  return (
    <div>
      <NotifCard label="Want a daily nudge?">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-base font-bold text-gray-900">Remind me</p>
            <p className="text-xs text-gray-500 mt-0.5">A nudge to stay strong</p>
          </div>
          <Toggle on={reminderOn} onChange={v => onChange({ ...state, reminderOn: v })} color={color.toggleOn} />
        </div>
        {reminderOn && (
          <div className="mt-3">
            <TimeChip value={reminderTime} onChange={v => onChange({ ...state, reminderTime: v })} color={color} />
            <PreviewCard title={what} subtitle={because} />
          </div>
        )}
      </NotifCard>

      <NotifCard label="Celebrate your milestones?">
        <p className="text-xs text-gray-500 mb-3 leading-snug">We celebrate these moments with you. Tap any milestone to customize it.</p>
        <div className="space-y-0">
          {milestones.map((m, i) => (
            <div key={i}>
              <button
                type="button"
                onClick={() => handleToggleMilestone(i)}
                className="w-full flex items-center gap-3 py-2.5 transition-colors"
                data-testid={`button-milestone-${i}`}
              >
                <span
                  className="flex-shrink-0 flex items-center justify-center"
                  style={{ width: 22, height: 22, borderRadius: "50%", background: color.checkBg }}
                >
                  <svg viewBox="0 0 24 24" style={{ width: 12, height: 12 }} fill="none" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                </span>
                <span className="flex-1 text-sm font-medium text-gray-900 text-left">
                  Day {m.day} — {m.label}
                </span>
                <span className="text-xs font-semibold" style={{ color: color.text }}>Edit</span>
              </button>

              {openIdx === i && (
                <div className="rounded-xl p-3 mb-2 border" style={{ background: color.tint, borderColor: color.border }}>
                  <p className="text-[10px] font-semibold uppercase tracking-widest mb-2" style={{ color: color.text }}>CELEBRATE ON DAY</p>
                  <input
                    type="number"
                    min={1}
                    max={365}
                    value={localDayStr}
                    onChange={e => {
                      setLocalDayStr(e.target.value);
                      const val = parseInt(e.target.value, 10);
                      if (!isNaN(val) && val >= 1 && val <= 365) updateDay(i, val);
                    }}
                    onBlur={() => {
                      const val = parseInt(localDayStr, 10);
                      if (isNaN(val) || val < 1 || val > 365) setLocalDayStr(String(m.day));
                    }}
                    className="w-full rounded-lg px-3 py-2 bg-white border focus:outline-none text-center font-bold"
                    style={{ fontSize: 15, borderColor: '#F5C4B3', color: '#111' }}
                    data-testid="input-milestone-day"
                  />
                  <p className="text-[10px] font-semibold uppercase tracking-widest mt-3 mb-1.5" style={{ color: color.text }}>MESSAGE</p>
                  <input
                    type="text"
                    value={m.label}
                    onChange={e => updateLabel(i, e.target.value)}
                    className="w-full rounded-lg px-3 py-2 text-sm bg-white border focus:outline-none"
                    style={{ borderColor: color.border }}
                    placeholder="Milestone label"
                    data-testid="input-milestone-label"
                  />
                  <PreviewCard title={`Day ${m.day} — ${m.label}`} subtitle={`I will ${what}`} />
                  {milestones.length > 1 && (
                    confirmDeleteIdx === i ? (
                      <div className="mt-3 text-center">
                        <p className="text-xs text-gray-600 mb-2">Remove this milestone?</p>
                        <div className="flex gap-4 justify-center">
                          <button type="button" onClick={() => setConfirmDeleteIdx(null)} className="text-xs text-gray-500 px-3 py-1">No</button>
                          <button type="button" onClick={() => deleteMilestone(i)} className="text-xs font-semibold px-3 py-1" style={{ color: '#E24B4A' }} data-testid={`button-confirm-delete-milestone-${i}`}>Yes</button>
                        </div>
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={() => setConfirmDeleteIdx(i)}
                        className="w-full mt-3 text-center bg-transparent border-0"
                        style={{ fontSize: 13, color: '#E24B4A' }}
                        data-testid={`button-delete-milestone-${i}`}
                      >
                        Delete milestone
                      </button>
                    )
                  )}
                </div>
              )}

              {i < milestones.length - 1 && <div className="border-b border-gray-100" />}
            </div>
          ))}
        </div>
        <button
          type="button"
          onClick={addMilestone}
          className="w-full mt-3 py-2.5 rounded-xl text-sm font-semibold transition-all active:scale-95"
          style={{ border: `1.5px dashed ${color.border}`, color: color.text, background: "transparent" }}
          data-testid="button-add-milestone"
        >
          + Add milestone
        </button>
      </NotifCard>
    </div>
  );
}

function MissionSectionControlled({
  what, because, color, state, onChange,
}: {
  what: string; because: string; color: typeof COLORS.mission;
  state: { threeDays: boolean; oneDay: boolean; dayOf: boolean; dailyOn: boolean; dailyTime: string };
  onChange: (s: typeof state) => void;
}) {
  const { threeDays, oneDay, dayOf, dailyOn, dailyTime } = state;

  return (
    <div>
      <NotifCard label="Notify me as I get closer?">
        <p className="text-sm text-gray-600 mb-3">Notify me when there are…</p>
        <div className="space-y-2 mb-3">
          {[
            { label: "When I have 3 days left", value: threeDays, key: "threeDays" as const },
            { label: "When I have 1 day left", value: oneDay, key: "oneDay" as const },
            { label: "On the final day", value: dayOf, key: "dayOf" as const },
          ].map(row => (
            <button
              key={row.label}
              type="button"
              onClick={() => onChange({ ...state, [row.key]: !row.value })}
              className="w-full flex items-center gap-3 rounded-xl px-3 py-2.5 border border-gray-200 bg-gray-50 text-left transition-all active:scale-[0.98]"
              data-testid={`check-${row.key}`}
            >
              <span
                className="flex-shrink-0 flex items-center justify-center"
                style={{ width: 20, height: 20, borderRadius: "50%", border: `2px solid ${row.value ? color.bg : "#D1D5DB"}`, background: row.value ? color.bg : "transparent" }}
              >
                {row.value && (
                  <svg viewBox="0 0 24 24" style={{ width: 11, height: 11 }} fill="none" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                )}
              </span>
              <span className="text-sm font-medium text-gray-900">{row.label}</span>
            </button>
          ))}
        </div>
        {(threeDays || oneDay || dayOf) && (
          <PreviewCard title={`1 day left — ${what}`} subtitle={because} />
        )}
      </NotifCard>

      <NotifCard label="Want a daily nudge?">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-base font-bold text-gray-900">Daily reminder</p>
            <p className="text-xs text-gray-500 mt-0.5">Off by default</p>
          </div>
          <Toggle on={dailyOn} onChange={v => onChange({ ...state, dailyOn: v })} color={color.toggleOn} />
        </div>
        {dailyOn && (
          <div className="mt-3">
            <TimeChip value={dailyTime} onChange={v => onChange({ ...state, dailyTime: v })} color={color} />
            <PreviewCard title={what} subtitle={because} />
          </div>
        )}
      </NotifCard>
    </div>
  );
}
