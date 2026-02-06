'use client';

import { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { ArrowRight, Check, Delete, Minus, Plus, X } from 'lucide-react';
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
  const [mounted, setMounted] = useState(false);
  const [value, setValue] = useState('');

  useEffect(() => {
    setMounted(true);
  }, []);

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

  if (!mounted || !isOpen) return null;

  return createPortal(
    <div className="fixed inset-0 z-[9999] flex flex-col justify-end pointer-events-auto">
      {/* Backdrop */}
      <button
        type="button"
        aria-label="Close keypad"
        onClick={onClose}
        className="absolute inset-0 bg-black/60 backdrop-blur-sm transition-opacity duration-300"
      />

      {/* Keypad Panel */}
      <div
        className={`relative z-[10000] w-full border-t border-white/10 bg-zinc-950/95 backdrop-blur-2xl transition-transform duration-300 pb-[calc(env(safe-area-inset-bottom)+2rem)] ${
          isOpen ? 'translate-y-0' : 'translate-y-full'
        }`}
      >
        <div className="mx-auto w-full max-w-lg px-4 pt-4">
          {/* Header */}
          <div className="mb-4 flex items-center justify-between">
            <p className="text-zinc-400 text-xs font-bold uppercase tracking-[0.2em]">
              {type === 'weight' ? 'LOAD (LBS)' : type === 'reps' ? 'REPS' : 'INTENSITY (RPE)'}
            </p>
            <button
              type="button"
              onClick={onClose}
              className="rounded-full bg-zinc-900/80 p-2 text-zinc-400 hover:text-white"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          <div className="grid grid-cols-[104px_1fr_104px] gap-3">
            {/* Left Col: Adjusters */}
            <div className="flex flex-col gap-3">
              <button
                type="button"
                {...positivePressHandlers}
                className="flex-1 rounded-2xl border border-white/5 bg-zinc-900/50 text-zinc-100 hover:bg-zinc-800"
              >
                <Plus className="mx-auto h-8 w-8" />
              </button>
              <button
                type="button"
                {...negativePressHandlers}
                className="flex-1 rounded-2xl border border-white/5 bg-zinc-900/50 text-zinc-100 hover:bg-zinc-800"
              >
                <Minus className="mx-auto h-8 w-8" />
              </button>
            </div>

            {/* Middle Col: Display & Numpad */}
            <div className="space-y-3">
              <div className="flex h-16 items-center justify-end rounded-2xl border border-white/5 bg-black/40 px-6 text-4xl font-black tracking-tight text-white shadow-inner">
                {value || <span className="text-zinc-700">0</span>}
              </div>

              <div className="grid grid-cols-3 gap-2">
                {keypadLayout.map((key) => (
                  <button
                    key={key}
                    type="button"
                    onClick={() => handleKeypadPress(key)}
                    className="h-14 rounded-xl bg-zinc-800/40 text-xl font-bold text-white hover:bg-zinc-700/60 active:scale-95 transition-all"
                  >
                    {key === 'backspace' ? <Delete className="mx-auto h-5 w-5" /> : key}
                  </button>
                ))}
              </div>
            </div>

            {/* Right Col: Actions */}
            <div className="flex flex-col gap-3">
              <button
                type="button"
                onClick={onClose}
                className="flex flex-1 flex-col items-center justify-center gap-1 rounded-2xl border border-white/5 bg-zinc-900/50 text-zinc-400 hover:text-white"
              >
                <Check className="h-6 w-6" />
                <span className="text-[10px] uppercase font-bold tracking-wider">Enter</span>
              </button>

              <button
                type="button"
                onClick={onNext}
                className="flex-[2] flex flex-col items-center justify-center gap-1 rounded-2xl bg-emerald-500 text-zinc-950 shadow-lg shadow-emerald-500/20 active:scale-95 transition-all"
              >
                <ArrowRight className="h-8 w-8" />
                <span className="text-[10px] uppercase font-black tracking-wider">Next</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}
