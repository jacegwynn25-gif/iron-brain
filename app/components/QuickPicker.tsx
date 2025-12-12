'use client';

interface QuickPickerProps {
  label: string;
  value: string;
  onChange: (value: string);
  step?: number;
  placeholder?: string;
  unit?: string;
  lastValue?: string; // For "Match Last" button
}

/**
 * Ultra-simplified picker - just input and 3 smart buttons
 * Zero scrolling, maximum speed
 */
export default function QuickPicker({
  label,
  value,
  onChange,
  step = 1,
  placeholder,
  unit,
  lastValue,
}: QuickPickerProps) {
  const incrementValue = (amount: number) => {
    const current = parseFloat(value) || 0;
    onChange((current + amount).toString());
  };

  const matchLast = () => {
    if (lastValue) {
      onChange(lastValue);
    }
  };

  return (
    <div>
      <label className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-zinc-600 dark:text-zinc-400">
        {label}
      </label>

      {/* Input with inline buttons */}
      <div className="flex items-stretch gap-2">
        {/* -5 Button */}
        <button
          type="button"
          onClick={() => incrementValue(-step * 5)}
          className="flex items-center justify-center rounded-lg bg-red-50 px-3 text-sm font-bold text-red-700 hover:bg-red-100 active:bg-red-200 dark:bg-red-900/20 dark:text-red-300 dark:hover:bg-red-900/30 transition-colors flex-shrink-0"
        >
          −5
        </button>

        {/* Main Input */}
        <div className="relative flex-1">
          <input
            type="number"
            value={value}
            onChange={(e) => onChange(e.target.value)}
            placeholder={placeholder}
            step={step}
            className="w-full rounded-lg border-2 border-zinc-300 bg-white px-4 py-3 text-center text-2xl font-black text-zinc-900 focus:border-purple-500 focus:outline-none focus:ring-2 focus:ring-purple-500/20 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-50 dark:focus:border-purple-600"
          />
          {unit && (
            <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-sm font-semibold text-zinc-500 dark:text-zinc-400">
              {unit}
            </span>
          )}
        </div>

        {/* +5 Button */}
        <button
          type="button"
          onClick={() => incrementValue(step * 5)}
          className="flex items-center justify-center rounded-lg bg-green-50 px-3 text-sm font-bold text-green-700 hover:bg-green-100 active:bg-green-200 dark:bg-green-900/20 dark:text-green-300 dark:hover:bg-green-900/30 transition-colors flex-shrink-0"
        >
          +5
        </button>
      </div>

      {/* Match Last Button (if available) */}
      {lastValue && (
        <button
          type="button"
          onClick={matchLast}
          className="mt-2 w-full rounded-lg bg-purple-50 py-2 text-sm font-bold text-purple-700 hover:bg-purple-100 active:bg-purple-200 dark:bg-purple-900/20 dark:text-purple-300 dark:hover:bg-purple-900/30 transition-colors"
        >
          Match Last ({lastValue}{unit ? ` ${unit}` : ''})
        </button>
      )}
    </div>
  );
}
