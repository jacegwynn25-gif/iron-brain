'use client';

interface RpeRirSliderProps {
  value: number;
  onChange: (val: number) => void;
}

export default function RpeRirSlider({ value, onChange }: RpeRirSliderProps) {
  const rir = Math.max(0, 10 - value);
  const ticks = [5, 6, 7, 8, 9, 10];
  const percent = ((value - 5) / 5) * 100;

  return (
    <div className="w-full space-y-4">
      <div className="flex items-end justify-between px-1">
        <div className="flex flex-col">
          <span className="text-[10px] font-bold tracking-wider text-purple-400">
            INTENSITY
          </span>
          <span className="text-2xl font-black text-purple-500">RPE {value}</span>
        </div>
        <div className="flex flex-col items-end">
          <span className="text-[10px] font-bold tracking-wider text-gray-500">
            RESERVE
          </span>
          <span className="text-xl font-bold text-gray-400">{rir} RIR</span>
        </div>
      </div>

      <div className="space-y-2">
        <div className="relative h-10">
        <input
          type="range"
          min="5"
          max="10"
          step="0.5"
          value={value}
          onChange={(event) => onChange(Number(event.target.value))}
            className="absolute left-0 right-0 top-1/2 z-20 h-2 w-full -translate-y-1/2 cursor-pointer appearance-none rounded-full bg-transparent opacity-0"
        />

          <div className="absolute left-0 right-0 top-1/2 h-3 -translate-y-1/2 overflow-hidden rounded-full bg-zinc-800">
          <div
            className="h-full bg-gradient-to-r from-purple-900 via-purple-600 to-fuchsia-500 transition-all duration-150"
              style={{ width: `${percent}%` }}
          />
        </div>

          <div className="pointer-events-none absolute left-0 right-0 top-1/2 -translate-y-1/2">
            {ticks.map((tick) => (
              <div
                key={tick}
                className="absolute flex flex-col items-center"
                style={{ left: `${((tick - 5) / 5) * 100}%`, transform: 'translateX(-50%)' }}
              >
                <div className="h-3 w-1 rounded-full bg-zinc-400" />
              </div>
            ))}
          </div>

          <div
            className="pointer-events-none absolute top-1/2 h-6 w-6 -translate-y-1/2 rounded-full border-2 border-purple-500 bg-white shadow-lg transition-all"
            style={{ left: `calc(${percent}% - 12px)` }}
          />
        </div>

        <div className="relative h-4">
          {ticks.map((tick) => (
            <span
              key={tick}
              className="absolute text-[11px] font-semibold text-zinc-500"
              style={{ left: `${((tick - 5) / 5) * 100}%`, transform: 'translateX(-50%)' }}
            >
              {tick}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}
