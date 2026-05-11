import { useState, useEffect } from "react";

export interface NotificationsData {
  commitmentCategory: 'recurring' | 'duration' | 'event';
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
  willDurationDays?: number;
}

type Category = 'recurring' | 'duration' | 'event';

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


const COLORS: Record<Category, { bg: string; border: string; text: string; pillBg: string; pillBorder: string; pillText: string; tint: string; chipBg: string; chipBorder: string; chipText: string; toggleOn: string; checkBg: string }> = {
  recurring: {
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
  duration: {
    bg: "#1D6FBE",
    border: "#1D6FBE",
    text: "#1D6FBE",
    pillBg: "#E0EDFA",
    pillBorder: "#1D6FBE",
    pillText: "#1D6FBE",
    tint: "#E0EDFA",
    chipBg: "#E0EDFA",
    chipBorder: "#1D6FBE",
    chipText: "#1D6FBE",
    toggleOn: "#1D6FBE",
    checkBg: "#1D6FBE",
  },
  event: {
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

export default function NotificationsSetup({ what, because, onComplete, onBack, willDurationDays }: NotificationsSetupProps) {
  const formattedWhat = what?.toLowerCase().startsWith('i will')
    ? what
    : `I will ${what}`;

  const [selected, setSelected] = useState<Category | null>(null);

  const [recurringState, setRecurringState] = useState({
    reminderOn: true, reminderTime: "20:30",
    checkInOn: true, checkInTime: "08:00",
  });
  const [durationState, setDurationState] = useState({
    reminderOn: true, reminderTime: "18:00",
    milestones: [] as MilestoneRow[],
  });
  const [eventState, setEventState] = useState({
    threeDays: true, oneDay: true, dayOf: true,
    dailyOn: false, dailyTime: "09:00",
  });

  const handleContinue = () => {
    if (!selected) return;

    let data: NotificationsData;

    if (selected === 'recurring') {
      data = {
        commitmentCategory: 'recurring',
        reminderTime: recurringState.reminderOn ? recurringState.reminderTime : null,
        checkInTime: recurringState.checkInOn ? recurringState.checkInTime : null,
        checkInType: 'daily',
        milestones: null,
        missionReminderTime: null,
        deadlineReminders: { threeDays: false, oneDay: false, dayOf: false },
      };
    } else if (selected === 'duration') {
      data = {
        commitmentCategory: 'duration',
        reminderTime: durationState.reminderOn ? durationState.reminderTime : null,
        checkInTime: null,
        checkInType: 'final_review',
        milestones: durationState.milestones,
        missionReminderTime: null,
        deadlineReminders: { threeDays: false, oneDay: false, dayOf: false },
      };
    } else {
      data = {
        commitmentCategory: 'event',
        reminderTime: null,
        checkInTime: null,
        checkInType: 'final_review',
        milestones: null,
        missionReminderTime: eventState.dailyOn ? eventState.dailyTime : null,
        deadlineReminders: {
          threeDays: eventState.threeDays,
          oneDay: eventState.oneDay,
          dayOf: eventState.dayOf,
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
    icon: 'repeat' | 'hourglass' | 'bolt';
  }[] = [
    {
      category: 'recurring',
      title: 'Recurring',
      example: '"I will go to the gym 3x a week"',
      iconBg: '#E1F5EE',
      iconColor: '#1D9E75',
      selectedCardBg: '#E8F7F1',
      selectedBorder: '#1D9E75',
      selectedTitle: '#085041',
      selectedExample: '#0F6E56',
      icon: 'repeat',
    },
    {
      category: 'duration',
      title: 'Duration',
      example: '"I will not use social media"',
      iconBg: '#E0EDFA',
      iconColor: '#1D6FBE',
      selectedCardBg: '#E0EDFA',
      selectedBorder: '#1D6FBE',
      selectedTitle: '#0D3D6E',
      selectedExample: '#1A5490',
      icon: 'hourglass',
    },
    {
      category: 'event',
      title: 'Event',
      example: '"I will call my grandmother"',
      iconBg: '#EEEDFE',
      iconColor: '#534AB7',
      selectedCardBg: '#EEEDF9',
      selectedBorder: '#534AB7',
      selectedTitle: '#2B2580',
      selectedExample: '#403AA0',
      icon: 'bolt',
    },
  ];

  return (
    <div className="flex flex-col min-h-0">
      {/* Subtitle — shown before a type is selected */}
      {!selected && (
        <p className="px-4 mb-4 text-center" style={{ fontSize: 13, color: '#9CA3AF' }}>
          Which type best describes your Will?
        </p>
      )}

      {/* Will statement — shown after a type is selected, above the pills */}
      {selected && (
        <p className="px-4 mb-3 text-center flex-shrink-0" style={{ fontSize: 13, fontStyle: 'italic', color: COLORS[selected].text }}>
          {formattedWhat.toLowerCase().startsWith('i will') ? `"${formattedWhat}"` : `"I will ${formattedWhat}"`}
        </p>
      )}

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
                {card.icon === 'repeat' && (
                  <svg viewBox="0 0 24 24" style={{ width: 22, height: 22 }} fill="none" stroke={card.iconColor} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="17 1 21 5 17 9" />
                    <path d="M3 11V9a4 4 0 0 1 4-4h14" />
                    <polyline points="7 23 3 19 7 15" />
                    <path d="M21 13v2a4 4 0 0 1-4 4H3" />
                  </svg>
                )}
                {card.icon === 'hourglass' && (
                  <svg viewBox="0 0 24 24" style={{ width: 22, height: 22 }} fill="none" stroke={card.iconColor} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M5 22h14" />
                    <path d="M5 2h14" />
                    <path d="M17 22v-4.172a2 2 0 0 0-.586-1.414L12 12l-4.414 4.414A2 2 0 0 0 7 17.828V22" />
                    <path d="M7 2v4.172a2 2 0 0 0 .586 1.414L12 12l4.414-4.414A2 2 0 0 0 17 6.172V2" />
                  </svg>
                )}
                {card.icon === 'bolt' && (
                  <svg viewBox="0 0 24 24" style={{ width: 22, height: 22 }} fill="none" stroke={card.iconColor} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
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

          {/* Notification section */}
          <div className="px-4 pb-24 flex-1 overflow-y-auto">
            {selected === 'recurring' && (
              <HabitSectionControlled
                what={formattedWhat}
                because={because}
                color={COLORS.recurring}
                state={recurringState}
                onChange={setRecurringState}
              />
            )}
            {selected === 'duration' && (
              <AbstainSectionControlled
                what={formattedWhat}
                because={because}
                color={COLORS.duration}
                state={durationState}
                onChange={setDurationState}
                willDurationDays={willDurationDays}
              />
            )}
            {selected === 'event' && (
              <MissionSectionControlled
                what={formattedWhat}
                because={because}
                color={COLORS.event}
                state={eventState}
                onChange={setEventState}
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
        {selected === 'duration' && (
          <p className="text-center text-xs text-gray-400 mt-2">
            Milestones are optional — you can always skip them.
          </p>
        )}
      </div>
    </div>
  );
}

/* ── Controlled wrappers so parent can read state ── */

function HabitSectionControlled({
  what, because, color, state, onChange,
}: {
  what: string; because: string; color: typeof COLORS.recurring;
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
  what, because, color, state, onChange, willDurationDays,
}: {
  what: string; because: string; color: typeof COLORS.duration;
  state: { reminderOn: boolean; reminderTime: string; milestones: MilestoneRow[] };
  onChange: (s: typeof state) => void;
  willDurationDays?: number;
}) {
  const { reminderOn, reminderTime, milestones } = state;
  const maxDay = willDurationDays ?? 365;

  const [showAddForm, setShowAddForm] = useState(false);
  const [newDayStr, setNewDayStr] = useState('');
  const [newLabel, setNewLabel] = useState('');
  const [dayError, setDayError] = useState('');

  const openAddForm = () => {
    setNewDayStr('');
    setNewLabel('');
    setDayError('');
    setShowAddForm(true);
  };

  const cancelAdd = () => {
    setShowAddForm(false);
    setNewDayStr('');
    setNewLabel('');
    setDayError('');
  };

  const confirmAdd = () => {
    const day = parseInt(newDayStr, 10);
    if (isNaN(day) || day < 1) { setDayError('Enter a valid day number.'); return; }
    if (day > maxDay) { setDayError(`Your will is ${maxDay} day${maxDay === 1 ? '' : 's'} long. Pick a day between 1 and ${maxDay}.`); return; }
    if (!newLabel.trim()) { setDayError('Add a short message for this day.'); return; }
    onChange({ ...state, milestones: [...milestones, { day, label: newLabel.trim() }] });
    setShowAddForm(false);
    setNewDayStr('');
    setNewLabel('');
    setDayError('');
  };

  const deleteMilestone = (i: number) => {
    onChange({ ...state, milestones: milestones.filter((_, idx) => idx !== i) });
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

      <NotifCard label="Milestones">
        <p className="text-xs text-gray-500 mb-3 leading-snug">Leave yourself a note for a specific day.</p>

        {/* Quiet will context */}
        <p
          className="text-xs italic mb-4 truncate"
          style={{ color: color.text, opacity: 0.7 }}
        >
          {what}
        </p>

        {/* Grayed example row */}
        <div className="flex items-center gap-3 mb-4" style={{ opacity: 0.38 }}>
          <span
            className="flex-shrink-0 text-xs font-semibold px-2.5 py-1 rounded-full"
            style={{ background: '#F3F4F6', color: '#9CA3AF', border: '1px solid #E5E7EB' }}
          >
            Day 1
          </span>
          <span className="flex-1 text-sm italic text-gray-400 leading-snug">Your message here…</span>
          <span
            className="text-[9px] font-semibold uppercase tracking-widest flex-shrink-0"
            style={{ color: '#C4C4C4' }}
          >
            example
          </span>
        </div>

        {/* Added milestones */}
        {milestones.length > 0 && (
          <div className="mb-3 space-y-2">
            {milestones.map((m, i) => (
              <div
                key={i}
                className="flex items-center gap-3 py-2 px-3 rounded-xl"
                style={{ background: color.tint }}
                data-testid={`milestone-row-${i}`}
              >
                <span
                  className="flex-shrink-0 text-xs font-bold px-2.5 py-1 rounded-full"
                  style={{ background: color.chipBg, color: color.chipText, border: `1px solid ${color.chipBorder}` }}
                >
                  Day {m.day}
                </span>
                <span className="flex-1 text-sm text-gray-800 leading-snug">{m.label}</span>
                <button
                  type="button"
                  onClick={() => deleteMilestone(i)}
                  className="flex-shrink-0 flex items-center justify-center rounded-full transition-opacity active:opacity-60"
                  style={{ width: 24, height: 24, background: 'rgba(0,0,0,0.06)' }}
                  data-testid={`button-delete-milestone-${i}`}
                  aria-label="Remove milestone"
                >
                  <svg viewBox="0 0 24 24" style={{ width: 13, height: 13 }} fill="none" stroke="#6B7280" strokeWidth="2.5" strokeLinecap="round">
                    <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
                  </svg>
                </button>
              </div>
            ))}
          </div>
        )}

        {/* Add form */}
        {showAddForm ? (
          <div
            className="rounded-2xl p-4 mt-1"
            style={{ background: color.tint, border: `1.5px solid ${color.border}` }}
          >
            <p
              className="text-[10px] font-semibold uppercase tracking-widest mb-2"
              style={{ color: color.text }}
            >
              Which day?
            </p>
            <input
              type="number"
              min={1}
              max={maxDay}
              value={newDayStr}
              onChange={e => { setNewDayStr(e.target.value); setDayError(''); }}
              className="w-full rounded-xl px-3 py-2.5 bg-white border text-center font-bold focus:outline-none mb-3"
              style={{ fontSize: 15, borderColor: color.border, color: '#111' }}
              placeholder={willDurationDays ? `1 – ${maxDay}` : 'Day number'}
              data-testid="input-milestone-day"
              autoFocus
            />
            <p
              className="text-[10px] font-semibold uppercase tracking-widest mb-2"
              style={{ color: color.text }}
            >
              Your note
            </p>
            <input
              type="text"
              value={newLabel}
              onChange={e => { setNewLabel(e.target.value); setDayError(''); }}
              onKeyDown={e => { if (e.key === 'Enter') confirmAdd(); }}
              className="w-full rounded-xl px-3 py-2.5 text-sm bg-white border focus:outline-none mb-1"
              style={{ borderColor: color.border }}
              placeholder="Write anything…"
              maxLength={100}
              data-testid="input-milestone-label"
            />
            {dayError && (
              <p className="text-xs mb-2" style={{ color: '#E24B4A' }}>{dayError}</p>
            )}
            <div className="flex gap-2 mt-3">
              <button
                type="button"
                onClick={confirmAdd}
                className="flex-1 py-2.5 rounded-xl text-sm font-semibold text-white transition-all active:scale-95"
                style={{ background: color.bg }}
                data-testid="button-confirm-add-milestone"
              >
                Add
              </button>
              <button
                type="button"
                onClick={cancelAdd}
                className="px-4 py-2.5 rounded-xl text-sm font-medium text-gray-500 transition-all active:scale-95"
                style={{ background: '#F3F4F6' }}
                data-testid="button-cancel-add-milestone"
              >
                Cancel
              </button>
            </div>
          </div>
        ) : (
          <button
            type="button"
            onClick={openAddForm}
            className="w-full py-3 rounded-xl text-sm font-semibold transition-all active:scale-95 flex items-center justify-center gap-2"
            style={{ border: `1.5px dashed ${color.border}`, color: color.text, background: 'transparent' }}
            data-testid="button-add-milestone"
          >
            <svg viewBox="0 0 24 24" style={{ width: 16, height: 16 }} fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
              <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
            </svg>
            Add a milestone
          </button>
        )}
      </NotifCard>
    </div>
  );
}

function MissionSectionControlled({
  what, because, color, state, onChange,
}: {
  what: string; because: string; color: typeof COLORS.event;
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
