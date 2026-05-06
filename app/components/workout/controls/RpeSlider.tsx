'use client';

import { Info } from 'lucide-react';

interface RpeSliderProps {
  value: number | null;
  onChange: (value: number) => void;
  onInfoClick?: () => void;
}

const formatRpeValue = (nextValue: number | null) => (nextValue == null ? '--' : nextValue.toFixed(1));
const formatRirValue = (nextValue: number | null) => {
  if (nextValue == null) return '--';
  return Math.max(0, Math.round((10 - nextValue) * 10) / 10).toFixed(1);
};

export default function RpeSlider({ value, onChange, onInfoClick }: RpeSliderProps) {
  const sliderValue = value ?? 7;
  const isEmpty = value == null;
  const percent = ((sliderValue - 1) / 9) * 100;
  const presets = [6, 7, 8, 9, 10];

  return (
    <div className="space-y-4">
      <div className="flex items-end justify-between">
        <div>
          <div className="flex items-center gap-2">
            <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-zinc-500">RPE</p>
            {onInfoClick && (
              <button
                type="button"
                onClick={onInfoClick}
                aria-label="What is RPE?"
                className="inline-flex h-5 w-5 items-center justify-center rounded-full border border-zinc-800 bg-zinc-950 text-zinc-500 transition-colors hover:border-emerald-500/40 hover:text-emerald-300"
              >
                <Info className="h-3 w-3" />
              </button>
            )}
          </div>
          <p className="mt-1 text-3xl font-black tabular-nums tracking-tight text-zinc-100">
            {formatRpeValue(value)}
          </p>
        </div>
        <div className="text-right">
          <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-zinc-500">RIR</p>
          <p className="mt-1 text-3xl font-black tabular-nums tracking-tight text-zinc-100">
            {formatRirValue(value)}
          </p>
        </div>
      </div>

      <div className="relative flex h-11 items-center">
        <div
          className={`pointer-events-none h-3 w-full overflow-hidden rounded-full bg-zinc-900 ring-1 ring-white/10 ${isEmpty ? 'opacity-50' : ''}`}
        >
          <div
            className="h-full rounded-full bg-gradient-to-r from-emerald-400 via-amber-400 to-rose-500 shadow-[0_0_16px_rgba(251,191,36,0.24)]"
            style={{ width: `${percent}%` }}
          />
        </div>

        <input
          type="range"
          min={1}
          max={10}
          step={0.5}
          value={sliderValue}
          onChange={(event) => onChange(Number(event.target.value))}
          className="rpe-slider absolute inset-x-0 top-1/2 h-11 w-full -translate-y-1/2 appearance-none bg-transparent"
        />
      </div>

      <div className="grid grid-cols-5 gap-2">
        {presets.map((preset) => {
          const selected = value === preset;
          return (
            <button
              key={preset}
              type="button"
              onClick={() => onChange(preset)}
              className={`min-h-10 rounded-xl border text-xs font-black transition-colors ${selected
                ? 'border-emerald-400 bg-emerald-400 text-zinc-950'
                : 'border-zinc-800 bg-zinc-950 text-zinc-400 hover:border-zinc-700 hover:text-zinc-100'
                }`}
            >
              {preset}
            </button>
          );
        })}
      </div>

      <div className="flex items-center justify-between text-[10px] font-bold uppercase tracking-[0.22em] text-zinc-600">
        <span>Easy</span>
        <span>Limit</span>
      </div>

      <style jsx>{`
        .rpe-slider::-webkit-slider-runnable-track {
          height: 44px;
          background: transparent;
        }

        .rpe-slider::-webkit-slider-thumb {
          -webkit-appearance: none;
          appearance: none;
          width: 24px;
          height: 24px;
          margin-top: 10px;
          border-radius: 9999px;
          border: 2px solid rgba(255, 255, 255, 0.86);
          background: #18181b;
          box-shadow:
            0 8px 20px rgba(0, 0, 0, 0.45),
            0 0 0 5px rgba(24, 24, 27, 0.75),
            0 0 18px rgba(16, 185, 129, 0.22);
          cursor: pointer;
        }

        .rpe-slider::-moz-range-track {
          height: 44px;
          background: transparent;
        }

        .rpe-slider::-moz-range-thumb {
          width: 24px;
          height: 24px;
          border-radius: 9999px;
          border: 2px solid rgba(255, 255, 255, 0.86);
          background: #18181b;
          box-shadow:
            0 8px 20px rgba(0, 0, 0, 0.45),
            0 0 0 5px rgba(24, 24, 27, 0.75),
            0 0 18px rgba(16, 185, 129, 0.22);
          cursor: pointer;
        }

        .rpe-slider:focus-visible {
          outline: none;
        }

        .rpe-slider:focus-visible::-webkit-slider-thumb {
          box-shadow:
            0 8px 20px rgba(0, 0, 0, 0.45),
            0 0 0 5px rgba(24, 24, 27, 0.75),
            0 0 0 8px rgba(16, 185, 129, 0.24);
        }

        .rpe-slider:focus-visible::-moz-range-thumb {
          box-shadow:
            0 8px 20px rgba(0, 0, 0, 0.45),
            0 0 0 5px rgba(24, 24, 27, 0.75),
            0 0 0 8px rgba(16, 185, 129, 0.24);
        }
      `}</style>
    </div>
  );
}
