'use client';

interface QuickPickerProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
  suggestions: number[];
  step?: number;
  placeholder?: string;
  unit?: string;
}

/**
 * Mobile-optimized quick picker with large touch targets
 * Shows common values as quick-tap buttons
 */
export default function QuickPicker({
  label,
  value,
  onChange,
  suggestions,
  step = 1,
  placeholder,
  unit,
}: QuickPickerProps) {
  const handleQuickSelect = (val: number) => {
    onChange(val.toString());
  };

  const incrementValue = (amount: number) => {
    const current = parseFloat(value) || 0;
    onChange((current + amount).toString());
  };

  return (
    <div>
      <label className="mb-2 block text-sm font-medium text-zinc-700 dark:text-zinc-300">
        {label}
      </label>

      {/* Current Value Display */}
      <div className="mb-2 flex items-center gap-2">
        <input
          type="number"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          step={step}
          className="w-full rounded-lg border border-zinc-300 bg-white px-4 py-3 text-lg font-semibold text-zinc-900 focus:border-zinc-900 focus:outline-none focus:ring-2 focus:ring-zinc-900 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-50"
        />
        {unit && (
          <span className="text-sm font-medium text-zinc-600 dark:text-zinc-400">{unit}</span>
        )}
      </div>

      {/* Quick Adjust Buttons */}
      <div className="mb-2 flex gap-2">
        <button
          type="button"
          onClick={() => incrementValue(-step * 5)}
          className="flex-1 rounded-lg bg-red-100 py-2 text-sm font-semibold text-red-900 hover:bg-red-200 active:bg-red-300 dark:bg-red-900/30 dark:text-red-100 dark:hover:bg-red-900/40"
        >
          -{step * 5}
        </button>
        <button
          type="button"
          onClick={() => incrementValue(-step)}
          className="flex-1 rounded-lg bg-orange-100 py-2 text-sm font-semibold text-orange-900 hover:bg-orange-200 active:bg-orange-300 dark:bg-orange-900/30 dark:text-orange-100 dark:hover:bg-orange-900/40"
        >
          -{step}
        </button>
        <button
          type="button"
          onClick={() => incrementValue(step)}
          className="flex-1 rounded-lg bg-green-100 py-2 text-sm font-semibold text-green-900 hover:bg-green-200 active:bg-green-300 dark:bg-green-900/30 dark:text-green-100 dark:hover:bg-green-900/40"
        >
          +{step}
        </button>
        <button
          type="button"
          onClick={() => incrementValue(step * 5)}
          className="flex-1 rounded-lg bg-blue-100 py-2 text-sm font-semibold text-blue-900 hover:bg-blue-200 active:bg-blue-300 dark:bg-blue-900/30 dark:text-blue-100 dark:hover:bg-blue-900/40"
        >
          +{step * 5}
        </button>
      </div>

      {/* Quick Select Suggestions */}
      {suggestions.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {suggestions.map((suggestion) => (
            <button
              key={suggestion}
              type="button"
              onClick={() => handleQuickSelect(suggestion)}
              className={`min-w-[60px] rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
                value === suggestion.toString()
                  ? 'bg-zinc-900 text-white dark:bg-zinc-50 dark:text-zinc-900'
                  : 'bg-zinc-100 text-zinc-700 hover:bg-zinc-200 active:bg-zinc-300 dark:bg-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-700'
              }`}
            >
              {suggestion}
              {unit && <span className="ml-1 text-xs opacity-70">{unit}</span>}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
