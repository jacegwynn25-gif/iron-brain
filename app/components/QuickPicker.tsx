'use client';

interface QuickPickerProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
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

  const buttonDelta = Math.max(step, 1);

  return (
    <div>
      <label className="mb-1.5 flex items-center justify-between text-[11px] font-bold uppercase tracking-wider text-zinc-600 dark:text-zinc-400">
        <span>{label}</span>
        {unit && (
          <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-[10px] font-semibold text-zinc-500 dark:bg-zinc-800 dark:text-zinc-300">
            {unit}
          </span>
        )}
      </label>

      {/* Input with inline buttons */}
      <div className="flex items-center gap-2 rounded-2xl border border-zinc-200 bg-zinc-50 px-2.5 py-2 shadow-sm dark:border-zinc-800 dark:bg-zinc-900/70">
        {/* Decrement */}
        <button
          type="button"
          onClick={() => incrementValue(-buttonDelta)}
          className="h-11 w-11 flex-shrink-0 rounded-xl bg-white text-base font-black text-zinc-800 shadow-sm transition-all hover:bg-zinc-50 active:scale-95 dark:bg-zinc-950 dark:text-zinc-100 dark:hover:bg-zinc-900"
          aria-label={`Decrease ${label}`}
        >
          -{buttonDelta}
        </button>

        {/* Main Input */}
        <input
          type="number"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          step={step}
          className="flex-1 border-none bg-transparent text-center text-3xl font-black text-zinc-900 focus:outline-none focus:ring-0 dark:text-zinc-50"
        />

        {/* Increment */}
        <button
          type="button"
          onClick={() => incrementValue(buttonDelta)}
          className="h-11 w-11 flex-shrink-0 rounded-xl bg-white text-base font-black text-zinc-800 shadow-sm transition-all hover:bg-zinc-50 active:scale-95 dark:bg-zinc-950 dark:text-zinc-100 dark:hover:bg-zinc-900"
          aria-label={`Increase ${label}`}
        >
          +{buttonDelta}
        </button>
      </div>

      {/* Match Last Button (if available) */}
      {lastValue && (
        <button
          type="button"
          onClick={matchLast}
          className="mt-2 w-full rounded-xl border border-dashed border-purple-200 bg-purple-50 px-3 py-2 text-xs font-bold text-purple-700 transition-all hover:bg-purple-100 active:scale-[0.99] dark:border-purple-800 dark:bg-purple-900/30 dark:text-purple-100"
        >
          Match Last ({lastValue}{unit ? ` ${unit}` : ''})
        </button>
      )}
    </div>
  );
}
