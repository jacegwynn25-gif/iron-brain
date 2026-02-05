'use client';

import { useMemo, useState } from 'react';
import { ArrowRight, Delete, Minus, Plus, X } from 'lucide-react';
import { useLongPress } from '@/app/lib/hooks/useLongPress';

interface GlassKeypadProps {
  isOpen: boolean;
  onClose: () => void;
  onValueChange: (value: string) => void;
  onIncrement: (amount: number) => void;
  onNext: () => void;
  type: 'weight' | 'reps' | 'rpe';
}

const keypadLayout: Array<string> = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '.', '0', 'backspace'];

export default function GlassKeypad({
  isOpen,
  onClose,
  onValueChange,
  onIncrement,
  onNext,
  type,
}: GlassKeypadProps) {
  const [value, setValue] = useState('');

  const increments = useMemo(() => {
    if (type === 'weight') return { primary: 2.5, secondary: 5 };
    if (type === 'reps') return { primary: 1, secondary: 1 };
    return { primary: 0.5, secondary: 0.5 };
  }, [type]);

  const applyValue = (nextValue: string) => {
    setValue(nextValue);
    onValueChange(nextValue);
  };

  const handleKeypadPress = (key: string) => {
    if (key === 'backspace') {
      applyValue(value.slice(0, -1));
      return;
    }

    if (key === '.' && value.includes('.')) return;

    applyValue(`${value}${key}`);
  };

  const positivePressHandlers = useLongPress<HTMLButtonElement>(() => {
    onIncrement(increments.primary);
  });

  const negativePressHandlers = useLongPress<HTMLButtonElement>(() => {
    onIncrement(-increments.primary);
  });

  const nextLabel = value.trim().length > 0 ? 'Next Set' : 'Finish';

  return (
    <div className={`fixed inset-0 z-50 ${isOpen ? 'pointer-events-auto' : 'pointer-events-none'}`}>
      <button
        type="button"
        aria-label="Close keypad backdrop"
        onClick={onClose}
        className={`absolute inset-0 bg-black/35 transition-opacity duration-300 ${isOpen ? 'opacity-100' : 'opacity-0'}`}
      />

      <div
        className={`fixed bottom-0 left-0 right-0 border-t border-white/10 bg-zinc-950/80 backdrop-blur-2xl transition-transform duration-300 ${
          isOpen ? 'translate-y-0' : 'translate-y-full'
        }`}
      >
        <div className="mx-auto w-full max-w-5xl px-3 pb-4 pt-3 sm:px-4">
          <div className="mb-3 flex items-center justify-between">
            <p className="text-zinc-100 text-sm font-bold uppercase tracking-[0.16em]">Input Console</p>
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg border border-white/10 bg-zinc-900/50 p-2 text-zinc-200"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          <div className="grid grid-cols-[104px_1fr_132px] gap-3 sm:grid-cols-[124px_1fr_152px]">
            <div className="flex flex-col gap-3">
              <button
                type="button"
                {...positivePressHandlers}
                className="h-28 rounded-2xl border border-white/10 bg-zinc-900/50 text-zinc-100"
              >
                <Plus className="mx-auto h-8 w-8" />
              </button>

              <button
                type="button"
                {...negativePressHandlers}
                className="h-28 rounded-2xl border border-white/10 bg-zinc-900/50 text-zinc-100"
              >
                <Minus className="mx-auto h-8 w-8" />
              </button>

              {type === 'weight' && (
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => onIncrement(increments.secondary)}
                    className="rounded-xl border border-white/10 bg-zinc-900/50 py-2 text-xs font-bold text-zinc-100"
                  >
                    +5
                  </button>
                  <button
                    type="button"
                    onClick={() => onIncrement(-increments.secondary)}
                    className="rounded-xl border border-white/10 bg-zinc-900/50 py-2 text-xs font-bold text-zinc-100"
                  >
                    -5
                  </button>
                </div>
              )}
            </div>

            <div className="space-y-2">
              <div className="h-12 rounded-xl border border-white/10 bg-zinc-900/50 px-4 text-right text-2xl font-bold leading-[3rem] text-zinc-100">
                {value || '0'}
              </div>

              <div className="grid grid-cols-3 gap-2">
                {keypadLayout.map((key) => (
                  <button
                    key={key}
                    type="button"
                    onClick={() => handleKeypadPress(key)}
                    className="h-14 rounded-xl border border-white/10 bg-zinc-900/50 text-lg font-bold text-zinc-100 transition-colors hover:bg-white/5"
                  >
                    {key === 'backspace' ? <Delete className="mx-auto h-5 w-5" /> : key}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex flex-col gap-2">
              <button
                type="button"
                onClick={() => {
                  onNext();
                }}
                className="flex h-full min-h-[240px] flex-col items-center justify-center gap-2 rounded-2xl border border-emerald-500/30 bg-emerald-500/15 text-zinc-100"
              >
                <ArrowRight className="h-6 w-6" />
                <span className="text-sm font-bold">{nextLabel}</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
