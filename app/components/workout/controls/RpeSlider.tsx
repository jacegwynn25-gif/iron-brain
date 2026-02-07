'use client';

interface RpeSliderProps {
  value: number | null;
  onChange: (value: number) => void;
}

export default function RpeSlider({ value, onChange }: RpeSliderProps) {
  const sliderValue = value ?? 1;
  const isEmpty = value == null;
  const percent = ((sliderValue - 1) / 9) * 100;

  return (
    <div className="space-y-3">
      <div className="flex items-end justify-between">
        <div>
          <p className="text-zinc-400 text-xs uppercase tracking-[0.18em]">Intensity</p>
          <p className="text-zinc-100 text-3xl font-bold">{isEmpty ? '--' : sliderValue.toFixed(1)}</p>
        </div>
        <p className="text-zinc-500 text-[10px] uppercase tracking-[0.2em]">RPE</p>
      </div>

      <div className="relative flex h-8 items-center">
        <div
          className={`pointer-events-none h-2 w-full overflow-hidden rounded-full bg-zinc-900/80 ring-1 ring-white/10 ${isEmpty ? 'opacity-60' : ''}`}
        >
          <div
            className="h-full rounded-full bg-gradient-to-r from-emerald-400 via-amber-400 to-rose-500 shadow-[0_0_12px_rgba(248,113,113,0.35)]"
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
          className="rpe-slider absolute inset-0 h-8 w-full appearance-none bg-transparent"
        />
      </div>

      <div className="flex items-center justify-between text-[10px] uppercase tracking-[0.22em] text-zinc-500">
        <span>Warmup (1-4)</span>
        <span>Failure (10)</span>
      </div>

      <style jsx>{`
        .rpe-slider::-webkit-slider-runnable-track {
          height: 8px;
          background: transparent;
        }

        .rpe-slider::-webkit-slider-thumb {
          -webkit-appearance: none;
          appearance: none;
          width: 18px;
          height: 18px;
          margin-top: -5px;
          border-radius: 9999px;
          border: 1px solid rgba(255, 255, 255, 0.7);
          background: radial-gradient(circle at 30% 30%, #ffffff 0%, #d4d4d8 60%, #09090b 100%);
          box-shadow: 0 8px 20px rgba(0, 0, 0, 0.45), 0 0 10px rgba(244, 63, 94, 0.3);
          cursor: pointer;
        }

        .rpe-slider::-moz-range-track {
          height: 8px;
          background: transparent;
        }

        .rpe-slider::-moz-range-thumb {
          width: 18px;
          height: 18px;
          border-radius: 9999px;
          border: 1px solid rgba(255, 255, 255, 0.7);
          background: radial-gradient(circle at 30% 30%, #ffffff 0%, #d4d4d8 60%, #09090b 100%);
          box-shadow: 0 8px 20px rgba(0, 0, 0, 0.45), 0 0 10px rgba(244, 63, 94, 0.3);
          cursor: pointer;
        }

        .rpe-slider:focus-visible {
          outline: none;
        }
      `}</style>
    </div>
  );
}
