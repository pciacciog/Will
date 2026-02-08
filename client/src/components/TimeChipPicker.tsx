import { useState, useEffect, useRef } from "react";

interface TimeChipPickerProps {
  value: string;
  onChange: (time: string) => void;
  presets?: string[];
  disabled?: boolean;
  className?: string;
  testId?: string;
}

const DEFAULT_PRESETS = [
  "07:00", "08:00", "09:00",
  "12:00", "18:00", "19:00",
  "20:00", "21:00", "22:00",
];

const HOUR_OPTIONS = Array.from({ length: 24 }, (_, i) => {
  const h = String(i).padStart(2, "0");
  return `${h}:00`;
});

const MINUTE_OPTIONS = ["00", "15", "30", "45"];

function formatTimeLabel(time24: string): string {
  const [h, m] = time24.split(":").map(Number);
  const period = h >= 12 ? "PM" : "AM";
  const h12 = h === 0 ? 12 : h > 12 ? h - 12 : h;
  if (m === 0) return `${h12} ${period}`;
  return `${h12}:${String(m).padStart(2, "0")} ${period}`;
}

function formatHourLabel(hour: number): string {
  const period = hour >= 12 ? "PM" : "AM";
  const h12 = hour === 0 ? 12 : hour > 12 ? hour - 12 : hour;
  return `${h12} ${period}`;
}

export default function TimeChipPicker({
  value,
  onChange,
  presets = DEFAULT_PRESETS,
  disabled = false,
  className = "",
  testId = "time-chip-picker",
}: TimeChipPickerProps) {
  const [showCustom, setShowCustom] = useState(false);
  const [customHour, setCustomHour] = useState("12");
  const [customMinute, setCustomMinute] = useState("00");

  useEffect(() => {
    if (value && !presets.includes(value)) {
      setShowCustom(true);
      const [h, m] = value.split(":");
      if (h) setCustomHour(h);
      if (m) setCustomMinute(m);
    }
  }, [value, presets]);

  const handleCustomTimeChange = (hour: string, minute: string) => {
    setCustomHour(hour);
    setCustomMinute(minute);
    onChange(`${hour}:${minute}`);
  };

  return (
    <div className={`flex flex-col items-center gap-2 ${className}`} data-testid={testId}>
      <div className="flex flex-wrap justify-center gap-1.5 max-w-[280px]">
        {presets.map((preset) => (
          <button
            key={preset}
            type="button"
            disabled={disabled}
            onClick={() => {
              setShowCustom(false);
              onChange(preset);
            }}
            className={`px-2.5 py-1.5 rounded-full text-xs font-medium transition-all ${
              value === preset && !showCustom
                ? "bg-blue-500 text-white shadow-sm"
                : "bg-gray-100 text-gray-600 hover:bg-gray-200"
            } ${disabled ? "opacity-40 cursor-not-allowed" : "cursor-pointer"}`}
            data-testid={`${testId}-${preset.replace(":", "")}`}
          >
            {formatTimeLabel(preset)}
          </button>
        ))}
        <button
          type="button"
          disabled={disabled}
          onClick={() => {
            if (!showCustom) {
              const [h, m] = (value || "12:00").split(":");
              setCustomHour(h || "12");
              setCustomMinute(m || "00");
            }
            setShowCustom(!showCustom);
          }}
          className={`px-2.5 py-1.5 rounded-full text-xs font-medium transition-all ${
            showCustom
              ? "bg-blue-500 text-white shadow-sm"
              : "bg-gray-100 text-gray-600 hover:bg-gray-200"
          } ${disabled ? "opacity-40 cursor-not-allowed" : "cursor-pointer"}`}
          data-testid={`${testId}-custom-toggle`}
        >
          {showCustom && value && !presets.includes(value) ? formatTimeLabel(value) : "Custom"}
        </button>
      </div>
      {showCustom && (
        <div className="flex items-center gap-2 animate-in fade-in duration-200" data-testid={`${testId}-custom-selector`}>
          <select
            value={customHour}
            onChange={(e) => handleCustomTimeChange(e.target.value, customMinute)}
            disabled={disabled}
            className={`text-sm bg-white border border-gray-200 rounded-lg px-2 py-1.5 focus:border-blue-400 focus:ring-1 focus:ring-blue-400 outline-none ${disabled ? "opacity-40" : ""}`}
            data-testid={`${testId}-custom-hour`}
          >
            {Array.from({ length: 24 }, (_, i) => (
              <option key={i} value={String(i).padStart(2, "0")}>
                {formatHourLabel(i)}
              </option>
            ))}
          </select>
          <span className="text-gray-400 text-sm font-medium">:</span>
          <select
            value={customMinute}
            onChange={(e) => handleCustomTimeChange(customHour, e.target.value)}
            disabled={disabled}
            className={`text-sm bg-white border border-gray-200 rounded-lg px-2 py-1.5 focus:border-blue-400 focus:ring-1 focus:ring-blue-400 outline-none ${disabled ? "opacity-40" : ""}`}
            data-testid={`${testId}-custom-minute`}
          >
            {MINUTE_OPTIONS.map((m) => (
              <option key={m} value={m}>{m}</option>
            ))}
          </select>
        </div>
      )}
    </div>
  );
}
