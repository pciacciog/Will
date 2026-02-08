import { useState, useEffect } from "react";

interface TimeChipPickerProps {
  value: string;
  onChange: (time: string) => void;
  presets?: string[];
  disabled?: boolean;
  className?: string;
  testId?: string;
}

const MINUTE_OPTIONS = ["00", "15", "30", "45"];

function formatHourLabel(hour: number): string {
  const period = hour >= 12 ? "PM" : "AM";
  const h12 = hour === 0 ? 12 : hour > 12 ? hour - 12 : hour;
  return `${h12} ${period}`;
}

export default function TimeChipPicker({
  value,
  onChange,
  disabled = false,
  className = "",
  testId = "time-chip-picker",
}: TimeChipPickerProps) {
  const [hour, setHour] = useState("12");
  const [minute, setMinute] = useState("00");

  useEffect(() => {
    if (value) {
      const [h, m] = value.split(":");
      if (h) setHour(h);
      if (m) setMinute(m);
    }
  }, [value]);

  const handleTimeChange = (newHour: string, newMinute: string) => {
    setHour(newHour);
    setMinute(newMinute);
    onChange(`${newHour}:${newMinute}`);
  };

  return (
    <div className={`flex flex-col items-center ${className}`} data-testid={testId}>
      <div className="flex items-center gap-3" data-testid={`${testId}-selector`}>
        <select
          value={hour}
          onChange={(e) => handleTimeChange(e.target.value, minute)}
          disabled={disabled}
          className={`text-base bg-white border border-gray-200 rounded-xl px-3 py-2.5 focus:border-blue-400 focus:ring-1 focus:ring-blue-400 outline-none appearance-none text-center min-w-[90px] ${disabled ? "opacity-40 cursor-not-allowed" : ""}`}
          data-testid={`${testId}-hour`}
        >
          {Array.from({ length: 24 }, (_, i) => (
            <option key={i} value={String(i).padStart(2, "0")}>
              {formatHourLabel(i)}
            </option>
          ))}
        </select>
        <span className="text-gray-400 text-lg font-semibold">:</span>
        <select
          value={minute}
          onChange={(e) => handleTimeChange(hour, e.target.value)}
          disabled={disabled}
          className={`text-base bg-white border border-gray-200 rounded-xl px-3 py-2.5 focus:border-blue-400 focus:ring-1 focus:ring-blue-400 outline-none appearance-none text-center min-w-[70px] ${disabled ? "opacity-40 cursor-not-allowed" : ""}`}
          data-testid={`${testId}-minute`}
        >
          {MINUTE_OPTIONS.map((m) => (
            <option key={m} value={m}>{m}</option>
          ))}
        </select>
      </div>
    </div>
  );
}
