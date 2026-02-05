'use client';

interface RpeSliderProps {
  value: number | null;
  onChange: (value: number) => void;
}

export default function RpeSlider({ value, onChange }: RpeSliderProps) {
  const sliderValue = value ?? 1;
  const isEmpty = value == null;

  return (
    <div className="rounded-3xl border border-white/10 bg-zinc-900/40 p-4 backdrop-blur-xl">
      <div className="mb-3 flex items-end justify-between">
        <div>
          <p className="text-zinc-400 text-xs uppercase tracking-[0.18em]">Intensity</p>
          <p className="text-zinc-100 text-3xl font-bold">{isEmpty ? '--' : sliderValue.toFixed(1)}</p>
        </div>
        <p className="text-zinc-400 text-xs uppercase">RPE</p>
      </div>

      <input
        type="range"
        min={1}
        max={10}
        step={0.5}
        value={sliderValue}
        onChange={(event) => onChange(Number(event.target.value))}
        className={`rpe-slider h-10 w-full appearance-none bg-transparent ${isEmpty ? 'opacity-75' : ''}`}
      />

      <div className="mt-2 flex items-center justify-between text-[11px] uppercase tracking-[0.15em] text-zinc-400">
        <span>Warmup (1-4)</span>
        <span>Failure (10)</span>
      </div>

      <style jsx>{`
        .rpe-slider::-webkit-slider-runnable-track {
          height: 14px;
          border-radius: 9999px;
          border: 1px solid rgba(255, 255, 255, 0.18);
          background: linear-gradient(90deg, #22c55e 0%, #facc15 55%, #ef4444 100%);
        }

        .rpe-slider::-webkit-slider-thumb {
          -webkit-appearance: none;
          appearance: none;
          width: 24px;
          height: 24px;
          margin-top: -6px;
          border-radius: 9999px;
          border: 2px solid rgba(24, 24, 27, 0.95);
          background: #ffffff;
          box-shadow: 0 6px 16px rgba(0, 0, 0, 0.45);
          cursor: pointer;
        }

        .rpe-slider::-moz-range-track {
          height: 14px;
          border-radius: 9999px;
          border: 1px solid rgba(255, 255, 255, 0.18);
          background: linear-gradient(90deg, #22c55e 0%, #facc15 55%, #ef4444 100%);
        }

        .rpe-slider::-moz-range-thumb {
          width: 24px;
          height: 24px;
          border-radius: 9999px;
          border: 2px solid rgba(24, 24, 27, 0.95);
          background: #ffffff;
          box-shadow: 0 6px 16px rgba(0, 0, 0, 0.45);
          cursor: pointer;
        }
      `}</style>
    </div>
  );
}
