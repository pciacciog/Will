interface TimeChipPickerProps {
  value: string;
  onChange: (time: string) => void;
  disabled?: boolean;
  className?: string;
  testId?: string;
}

export default function TimeChipPicker({
  value,
  onChange,
  disabled = false,
  className = "",
  testId = "time-chip-picker",
}: TimeChipPickerProps) {
  return (
    <div className={`inline-flex ${className}`} data-testid={testId}>
      <input
        type="time"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
        step="900"
        className={`text-sm font-medium bg-white border border-gray-200 rounded-lg px-3 py-2 text-center transition-all duration-150 appearance-none ${
          disabled
            ? "text-gray-300 cursor-not-allowed bg-gray-50"
            : "text-gray-700 hover:border-blue-300 focus:border-blue-400 focus:ring-1 focus:ring-blue-400 focus:outline-none"
        }`}
        style={{ minWidth: '110px' }}
        data-testid={`${testId}-native`}
      />
    </div>
  );
}
