import { useState } from "react";

// ── Public interface ──────────────────────────────────────────────────────────

export interface NotificationsData {
  commitmentCategory: 'recurring' | 'duration' | 'event';
  reminderTime: string | null;
  checkInTime: string | null;
  checkInType: 'daily' | 'specific_days' | 'final_review';
  milestones: { day: number; label: string }[] | null;
  missionReminderTime: string | null;
  deadlineReminders: { threeDays: boolean; oneDay: boolean; dayOf: boolean };
  customReminders: { date: string; note: string }[] | null;
  trackedDays: number[] | null;
}

interface NotificationsSetupProps {
  what: string;
  because: string;
  onComplete: (data: NotificationsData) => void;
  onBack: () => void;
  willDurationDays?: number;
}

type Category = 'recurring' | 'duration' | 'event';

// ── Color palette (per spec) ──────────────────────────────────────────────────

const C = {
  recurring: {
    bg: '#1D9E75',
    tabBg: '#e8f8f2',
    text: '#1D9E75',
    chipBg: '#e8f8f2',
    chipBorder: '#1D9E75',
  },
  duration: {
    bg: '#378ADD',
    tabBg: '#e6f1fb',
    text: '#378ADD',
    chipBg: '#e6f1fb',
    chipBorder: '#378ADD',
  },
  event: {
    bg: '#7F77DD',
    tabBg: '#eeedfe',
    text: '#7F77DD',
    chipBg: '#eeedfe',
    chipBorder: '#7F77DD',
  },
} as const;

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmt(t: string): string {
  const [hStr, mStr] = t.split(':');
  const h = parseInt(hStr, 10);
  const m = parseInt(mStr, 10);
  const ap = h >= 12 ? 'PM' : 'AM';
  return `${h % 12 || 12}:${m.toString().padStart(2, '0')} ${ap}`;
}

function fmtDate(s: string): string {
  if (!s) return '';
  const [y, mo, d] = s.split('-').map(Number);
  return new Date(y, mo - 1, d).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

const TIME_OPTIONS = [
  '06:00','06:30','07:00','07:30','08:00','08:30','09:00',
  '12:00','15:00','17:00','18:00','19:00','19:30','20:00','20:30','21:00','21:30','22:00',
];

// ── Toggle ────────────────────────────────────────────────────────────────────

function Toggle({ on, onChange, color }: { on: boolean; onChange: (v: boolean) => void; color: string }) {
  return (
    <button
      type="button"
      onClick={() => onChange(!on)}
      data-testid="toggle-notification"
      aria-label={on ? 'Turn off' : 'Turn on'}
      style={{
        position: 'relative', flexShrink: 0,
        width: 44, height: 26, borderRadius: 13,
        background: on ? color : '#d1d1d6',
        border: 'none', outline: 'none', cursor: 'pointer',
        transition: 'background 0.2s', padding: 0,
        display: 'inline-flex', alignItems: 'center',
      }}
    >
      <span style={{
        position: 'absolute', width: 20, height: 20, borderRadius: '50%',
        background: '#fff', top: 3, left: on ? 21 : 3,
        boxShadow: '0 1px 4px rgba(0,0,0,0.22)', transition: 'left 0.2s',
      }} />
    </button>
  );
}

// ── Time picker (tappable time display) ───────────────────────────────────────

function TimePicker({ value, onChange, color }: { value: string; onChange: (v: string) => void; color: string }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className="text-sm font-semibold"
        style={{ color }}
        data-testid="chip-time"
      >
        {fmt(value)}
      </button>
      {open && (
        <div className="absolute right-0 z-20 mt-1 rounded-xl overflow-y-auto shadow-lg border border-gray-100 bg-white" style={{ width: 140, maxHeight: 220 }}>
          {TIME_OPTIONS.map(t => (
            <button
              key={t}
              type="button"
              onClick={() => { onChange(t); setOpen(false); }}
              className="w-full text-left px-4 py-2 text-sm hover:bg-gray-50"
              style={t === value ? { color, fontWeight: 600 } : { color: '#374151' }}
            >
              {fmt(t)}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Remove button (22×22, red circle) ────────────────────────────────────────

function RemoveBtn({ onRemove }: { onRemove: () => void }) {
  return (
    <button
      type="button"
      onClick={onRemove}
      className="flex-shrink-0 flex items-center justify-center transition-opacity active:opacity-60"
      style={{ width: 22, height: 22, borderRadius: '50%', border: '1.5px solid #ff3b30', color: '#ff3b30', fontSize: 16, lineHeight: '1', padding: 0 }}
    >
      ×
    </button>
  );
}

// ── Shared "daily reminder" row ───────────────────────────────────────────────

function DailyReminderRow({ on, time, onToggle, onTime, color }: {
  on: boolean; time: string; onToggle: (v: boolean) => void; onTime: (v: string) => void; color: string;
}) {
  return (
    <div className="flex items-center gap-3 mb-5">
      <span className="flex-1 text-sm text-gray-600 font-medium">Daily reminder</span>
      {on && <TimePicker value={time} onChange={onTime} color={color} />}
      <Toggle on={on} onChange={onToggle} color={color} />
    </div>
  );
}

// ── DAY LABELS / VALUES ───────────────────────────────────────────────────────

const DAY_LABELS = ['M', 'T', 'W', 'T', 'F', 'S', 'S'] as const;
const DAY_JS = [1, 2, 3, 4, 5, 6, 0]; // Mon … Sat, Sun

// ── RECURRING SECTION ─────────────────────────────────────────────────────────

type RecState = { reminderOn: boolean; reminderTime: string; checkInOn: boolean; checkInTime: string; trackedDays: number[] };

function RecurringSection({ state, onChange }: { state: RecState; onChange: (s: RecState) => void }) {
  const { reminderOn, reminderTime, checkInOn, checkInTime, trackedDays } = state;
  const c = C.recurring;

  const toggleDay = (dv: number) => {
    const on = trackedDays.includes(dv);
    if (on && trackedDays.length === 1) return;
    onChange({ ...state, trackedDays: on ? trackedDays.filter(d => d !== dv) : [...trackedDays, dv] });
  };

  return (
    <div>
      {/* TRACK ON */}
      <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-widest mb-3">TRACK ON</p>

      {/* Day buttons — equal-width squares */}
      <div className="flex gap-1.5 mb-5">
        {DAY_LABELS.map((label, i) => {
          const dv = DAY_JS[i];
          const active = trackedDays.includes(dv);
          return (
            <button
              key={dv}
              type="button"
              onClick={() => toggleDay(dv)}
              className="flex-1 flex items-center justify-center font-semibold transition-all active:scale-90 select-none"
              style={{
                aspectRatio: '1',
                borderRadius: 9,
                fontSize: 13,
                border: `1.5px solid ${active ? c.bg : '#D1D5DB'}`,
                background: active ? c.bg : '#fff',
                color: active ? '#fff' : '#9CA3AF',
              }}
              data-testid={`day-pill-${dv}`}
              aria-pressed={active}
            >
              {label}
            </button>
          );
        })}
      </div>

      {/* NOTIFICATIONS */}
      <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-widest mb-3">NOTIFICATIONS</p>

      {/* Card */}
      <div style={{ background: '#f7f7f7', borderRadius: 14, overflow: 'hidden' }}>
        {/* Row 1 — Reminder */}
        <div className="flex items-center px-4 py-3.5 gap-3">
          <div className="flex-1 min-w-0">
            <p className="text-sm font-bold text-gray-900">Reminder</p>
            <p className="text-xs text-gray-400 mt-0.5">Before the moment</p>
          </div>
          <div className="flex items-center gap-2.5">
            {reminderOn && (
              <div className="relative flex items-center">
                <span className="text-sm font-semibold" style={{ color: c.text }}>{fmt(reminderTime)}</span>
                <input
                  type="time" value={reminderTime}
                  onChange={e => onChange({ ...state, reminderTime: e.target.value })}
                  className="absolute inset-0 opacity-0 cursor-pointer"
                  style={{ fontSize: 16 }}
                  data-testid="input-reminder-time"
                />
              </div>
            )}
            <Toggle on={reminderOn} onChange={v => onChange({ ...state, reminderOn: v })} color={c.bg} />
          </div>
        </div>

        {/* Hairline */}
        <div style={{ height: 0.5, background: '#E5E7EB', marginLeft: 16, marginRight: 16 }} />

        {/* Row 2 — Check-in */}
        <div className="flex items-center px-4 py-3.5 gap-3">
          <div className="flex-1 min-w-0">
            <p className="text-sm font-bold text-gray-900">Check-in</p>
            <p className="text-xs text-gray-400 mt-0.5">How did it go?</p>
          </div>
          <div className="flex items-center gap-2.5">
            {checkInOn && (
              <div className="relative flex items-center">
                <span className="text-sm font-semibold" style={{ color: c.text }}>{fmt(checkInTime)}</span>
                <input
                  type="time" value={checkInTime}
                  onChange={e => onChange({ ...state, checkInTime: e.target.value })}
                  className="absolute inset-0 opacity-0 cursor-pointer"
                  style={{ fontSize: 16 }}
                  data-testid="input-checkin-time"
                />
              </div>
            )}
            <Toggle on={checkInOn} onChange={v => onChange({ ...state, checkInOn: v })} color={c.bg} />
          </div>
        </div>
      </div>
    </div>
  );
}

// ── DURATION SECTION ──────────────────────────────────────────────────────────

type MilestoneRow = { day: number; label: string };
type DurState = { reminderOn: boolean; reminderTime: string; milestones: MilestoneRow[] };

const MILESTONE_PLACEHOLDERS = [
  'First day, you got this',
  'Keep pushing, almost there',
  'Halfway through — stay strong',
  'Nearly done — keep going',
];

function DurationSection({ state, onChange, maxDay }: { state: DurState; onChange: (s: DurState) => void; maxDay: number }) {
  const { reminderOn, reminderTime, milestones } = state;
  const c = C.duration;

  const addMilestone = () => {
    onChange({ ...state, milestones: [...milestones, { day: 0, label: '' }] });
  };

  const removeMilestone = (i: number) => {
    onChange({ ...state, milestones: milestones.filter((_, idx) => idx !== i) });
  };

  const updateMilestone = (i: number, field: 'day' | 'label', val: number | string) => {
    onChange({ ...state, milestones: milestones.map((m, idx) => idx === i ? { ...m, [field]: val } : m) });
  };

  return (
    <div>
      {/* Daily reminder */}
      <DailyReminderRow
        on={reminderOn} time={reminderTime}
        onToggle={v => onChange({ ...state, reminderOn: v })}
        onTime={v => onChange({ ...state, reminderTime: v })}
        color={c.bg}
      />

      {/* Section label */}
      <p className="text-[13px] font-semibold mb-3" style={{ color: '#333' }}>Assign yourself milestones:</p>

      {/* Milestone rows */}
      <div className="space-y-2 mb-3">
        {milestones.map((m, i) => (
          <div key={i} className="flex items-center gap-2" data-testid={`milestone-row-${i}`}>
            {/* Day chip */}
            <div className="relative flex-shrink-0">
              <div
                className="flex items-center gap-1 px-2.5 py-1.5"
                style={{
                  background: c.chipBg, border: `1px dashed ${c.chipBorder}`,
                  borderRadius: 8, color: c.text, fontSize: 12, fontWeight: 600,
                  whiteSpace: 'nowrap',
                }}
              >
                {m.day ? `Day ${m.day}` : 'Day?'}
                <span style={{ fontSize: 11, opacity: 0.75 }}>✎</span>
              </div>
              <select
                value={m.day || ''}
                onChange={e => updateMilestone(i, 'day', parseInt(e.target.value, 10))}
                className="absolute inset-0 opacity-0 cursor-pointer w-full"
                style={{ fontSize: 16 }}
                data-testid={`select-milestone-day-${i}`}
              >
                <option value="">Day?</option>
                {Array.from({ length: Math.max(1, maxDay) }, (_, d) => d + 1).map(d => (
                  <option key={d} value={d}>Day {d}</option>
                ))}
              </select>
            </div>

            {/* Text input */}
            <input
              type="text"
              value={m.label}
              onChange={e => updateMilestone(i, 'label', e.target.value)}
              placeholder={MILESTONE_PLACEHOLDERS[i] ?? 'Your note here'}
              maxLength={100}
              className="flex-1 text-[13px] px-2.5 py-1.5"
              style={{
                background: '#f7f7f7', border: '1px solid #ebebeb', borderRadius: 8,
                minWidth: 0, fontStyle: 'italic', color: '#374151', outline: 'none',
              }}
              data-testid={`input-milestone-label-${i}`}
            />

            {/* Remove */}
            <RemoveBtn onRemove={() => removeMilestone(i)} />
          </div>
        ))}
      </div>

      {/* Add a milestone */}
      <button
        type="button"
        onClick={addMilestone}
        className="flex items-center gap-2 py-1 transition-opacity active:opacity-60"
        data-testid="button-add-milestone"
      >
        <span
          className="flex items-center justify-center text-white text-sm font-bold flex-shrink-0"
          style={{ width: 20, height: 20, borderRadius: '50%', background: c.bg }}
        >
          +
        </span>
        <span className="text-sm font-medium" style={{ color: c.bg }}>Add a milestone</span>
      </button>
    </div>
  );
}

// ── EVENT SECTION ─────────────────────────────────────────────────────────────

type ReminderRow = { id: string; date: string; note: string };
type EvtState = { reminderOn: boolean; reminderTime: string; reminders: ReminderRow[] };

function EventSection({ state, onChange, because }: { state: EvtState; onChange: (s: EvtState) => void; because: string }) {
  const { reminderOn, reminderTime, reminders } = state;
  const c = C.event;

  const addReminder = () => {
    onChange({ ...state, reminders: [...reminders, { id: crypto.randomUUID(), date: '', note: '' }] });
  };

  const removeReminder = (id: string) => {
    onChange({ ...state, reminders: reminders.filter(r => r.id !== id) });
  };

  const update = (id: string, field: 'date' | 'note', val: string) => {
    onChange({ ...state, reminders: reminders.map(r => r.id === id ? { ...r, [field]: val } : r) });
  };

  const notePlaceholder = because ? because : 'Your reason…';

  return (
    <div>
      {/* Daily reminder */}
      <DailyReminderRow
        on={reminderOn} time={reminderTime}
        onToggle={v => onChange({ ...state, reminderOn: v })}
        onTime={v => onChange({ ...state, reminderTime: v })}
        color={c.bg}
      />

      {/* Section label */}
      <p className="text-[13px] font-semibold mb-3" style={{ color: '#333' }}>When should we remind you?</p>

      {/* Reminder rows */}
      <div className="space-y-2 mb-3">
        {reminders.map(r => (
          <div key={r.id} className="flex items-center gap-2" data-testid={`reminder-row-${r.id}`}>
            {/* Date chip */}
            <div className="relative flex-shrink-0">
              <div
                className="flex items-center gap-1 px-2.5 py-1.5"
                style={{
                  background: c.chipBg, border: `1px dashed ${c.chipBorder}`,
                  borderRadius: 8, color: c.text, fontSize: 12, fontWeight: 600,
                  whiteSpace: 'nowrap',
                }}
              >
                {r.date ? fmtDate(r.date) : 'Date?'}
                <span style={{ fontSize: 11, opacity: 0.75 }}>✎</span>
              </div>
              <input
                type="date"
                value={r.date}
                onChange={e => update(r.id, 'date', e.target.value)}
                className="absolute inset-0 opacity-0 cursor-pointer w-full"
                style={{ fontSize: 16 }}
                data-testid={`input-reminder-date-${r.id}`}
              />
            </div>

            {/* Note input */}
            <input
              type="text"
              value={r.note}
              onChange={e => update(r.id, 'note', e.target.value)}
              placeholder={notePlaceholder}
              maxLength={100}
              className="flex-1 text-[13px] px-2.5 py-1.5"
              style={{
                background: '#f7f7f7', border: '1px solid #ebebeb', borderRadius: 8,
                minWidth: 0, fontStyle: 'italic', color: '#374151', outline: 'none',
              }}
              data-testid={`input-reminder-note-${r.id}`}
            />

            {/* Remove */}
            <RemoveBtn onRemove={() => removeReminder(r.id)} />
          </div>
        ))}
      </div>

      {/* Add a reminder */}
      <button
        type="button"
        onClick={addReminder}
        className="flex items-center gap-2 py-1 transition-opacity active:opacity-60"
        data-testid="button-add-reminder"
      >
        <span
          className="flex items-center justify-center text-white text-sm font-bold flex-shrink-0"
          style={{ width: 20, height: 20, borderRadius: '50%', background: c.bg }}
        >
          +
        </span>
        <span className="text-sm font-medium" style={{ color: c.bg }}>Add a reminder</span>
      </button>
    </div>
  );
}

// ── MAIN COMPONENT ────────────────────────────────────────────────────────────

export default function NotificationsSetup({ what, because, onComplete, onBack, willDurationDays }: NotificationsSetupProps) {
  const formattedWhat = what?.toLowerCase().startsWith('i will') ? what : `I will ${what}`;
  const willStatement = formattedWhat.startsWith('"') ? formattedWhat : `"${formattedWhat}"`;

  const [selected, setSelected] = useState<Category>('recurring');

  const [recState, setRecState] = useState<RecState>({
    reminderOn: true, reminderTime: '20:30',
    checkInOn: true, checkInTime: '08:00',
    trackedDays: [0, 1, 2, 3, 4, 5, 6],
  });

  const [durState, setDurState] = useState<DurState>({
    reminderOn: true, reminderTime: '18:00',
    milestones: [
      { day: 1, label: '' },
      { day: 3, label: '' },
    ],
  });

  const [evtState, setEvtState] = useState<EvtState>({
    reminderOn: true, reminderTime: '18:00',
    reminders: [{ id: crypto.randomUUID(), date: '', note: '' }],
  });

  const color = C[selected];
  const maxDay = Math.max(1, willDurationDays ?? 365);

  const handleContinue = () => {
    let data: NotificationsData;

    if (selected === 'recurring') {
      data = {
        commitmentCategory: 'recurring',
        reminderTime: recState.reminderOn ? recState.reminderTime : null,
        checkInTime: recState.checkInOn ? recState.checkInTime : null,
        checkInType: 'daily',
        milestones: null,
        missionReminderTime: null,
        deadlineReminders: { threeDays: false, oneDay: false, dayOf: false },
        customReminders: null,
        trackedDays: recState.trackedDays,
      };
    } else if (selected === 'duration') {
      data = {
        commitmentCategory: 'duration',
        reminderTime: durState.reminderOn ? durState.reminderTime : null,
        checkInTime: null,
        checkInType: 'final_review',
        milestones: durState.milestones.filter(m => m.day > 0),
        missionReminderTime: null,
        deadlineReminders: { threeDays: false, oneDay: false, dayOf: false },
        customReminders: null,
        trackedDays: null,
      };
    } else {
      data = {
        commitmentCategory: 'event',
        reminderTime: evtState.reminderOn ? evtState.reminderTime : null,
        checkInTime: null,
        checkInType: 'final_review',
        milestones: null,
        missionReminderTime: null,
        deadlineReminders: { threeDays: false, oneDay: false, dayOf: false },
        customReminders: evtState.reminders
          .filter(r => r.date || r.note)
          .map(r => ({ date: r.date, note: r.note })),
        trackedDays: null,
      };
    }

    onComplete(data);
  };

  return (
    <div className="flex flex-col min-h-0">
      {/* Large bold heading */}
      <h1 className="text-[28px] font-bold text-gray-950 leading-tight mb-2 px-4">
        Notifications<br />Setup
      </h1>

      {/* Will statement */}
      <p
        className="px-4 mb-4 text-sm"
        style={{ fontStyle: 'italic', color: color.text }}
        data-testid="text-will-statement"
      >
        {willStatement}
      </p>

      {/* 3-tab selector */}
      <div className="flex gap-2 px-4 mb-5">
        {(['recurring', 'duration', 'event'] as Category[]).map(cat => (
          <button
            key={cat}
            type="button"
            onClick={() => setSelected(cat)}
            className="flex-1 py-2 text-sm font-semibold transition-all active:scale-95"
            style={
              selected === cat
                ? { background: C[cat].tabBg, border: `2px solid ${C[cat].bg}`, color: C[cat].bg, borderRadius: 999 }
                : { background: '#fff', border: '1.5px solid #E5E7EB', color: '#9CA3AF', borderRadius: 999 }
            }
            data-testid={`tab-${cat}`}
          >
            {cat.charAt(0).toUpperCase() + cat.slice(1)}
          </button>
        ))}
      </div>

      {/* Section content */}
      <div className="px-4 pb-28 flex-1 overflow-y-auto">
        {selected === 'recurring' && (
          <RecurringSection state={recState} onChange={setRecState} />
        )}
        {selected === 'duration' && (
          <DurationSection state={durState} onChange={setDurState} maxDay={maxDay} />
        )}
        {selected === 'event' && (
          <EventSection state={evtState} onChange={setEvtState} because={because} />
        )}
      </div>

      {/* Fixed bottom Continue button */}
      <div
        className="fixed bottom-0 left-0 right-0 px-4 bg-white border-t border-gray-100"
        style={{
          paddingTop: 12,
          paddingBottom: 'max(16px, env(safe-area-inset-bottom))',
          maxWidth: 640,
          margin: '0 auto',
        }}
      >
        <button
          type="button"
          onClick={handleContinue}
          className="w-full py-4 text-base font-semibold text-white transition-all active:scale-[0.98]"
          style={{ background: color.bg, borderRadius: 14 }}
          data-testid="button-notifications-continue"
        >
          Continue
        </button>
        {selected === 'duration' && (
          <p className="text-center text-[11px] text-gray-400 mt-2">
            Milestones are optional — skip if you'd like
          </p>
        )}
        {selected === 'event' && (
          <p className="text-center text-[11px] text-gray-400 mt-2">
            Reminders are optional — skip if you'd like
          </p>
        )}
      </div>
    </div>
  );
}
