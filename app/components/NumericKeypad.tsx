'use client';

import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { Delete } from 'lucide-react';

interface NumericKeypadProps {
  value: string;
  onChange: (next: string) => void;
  onClose: () => void;
  allowDecimal?: boolean;
}

function KeypadButton({
  label,
  onClick,
  ariaLabel,
}: {
  label: React.ReactNode;
  onClick: () => void;
  ariaLabel?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={ariaLabel ?? (typeof label === 'string' ? label : undefined)}
      className="flex h-14 items-center justify-center rounded-xl bg-zinc-100 text-2xl font-bold text-zinc-800 transition active:scale-95 active:bg-purple-100 dark:bg-zinc-800 dark:text-zinc-100 dark:active:bg-purple-900/40"
    >
      {label}
    </button>
  );
}

export default function NumericKeypad({
  value,
  onChange,
  onClose,
  allowDecimal = true,
}: NumericKeypadProps) {
  const [mounted, setMounted] = useState(false);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    setMounted(true);
    setTimeout(() => setVisible(true), 10);
  }, []);

  if (typeof document === 'undefined' || !mounted) return null;

  const handlePress = (key: string) => {
    console.log('[Keypad] handlePress', { key, value });
    if (key === '.') {
      if (!allowDecimal || value.includes('.')) return;
      onChange(value ? `${value}.` : '0.');
      return;
    }
    onChange(value === '0' ? key : `${value}${key}`);
  };

  const handleBackspace = () => {
    if (!value) return;
    onChange(value.slice(0, -1));
  };

  const keypad = (
    <div className="fixed inset-0 z-[60]">
      <button
        aria-label="Close keypad"
        className="absolute inset-0 bg-black/40"
        onClick={onClose}
      />
      <div
        className={`absolute inset-x-0 bottom-0 transform transition-all duration-200 ease-out ${
          visible ? 'translate-y-0 opacity-100' : 'translate-y-full opacity-0'
        }`}
        style={{ paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 16px)' }}
      >
        <div className="mx-auto max-w-md rounded-t-2xl bg-white px-4 pt-4 shadow-2xl ring-1 ring-zinc-200 dark:bg-zinc-900 dark:ring-zinc-800">
          <div className="grid grid-cols-3 gap-3">
            {[1, 2, 3, 4, 5, 6, 7, 8, 9].map(num => (
              <KeypadButton key={num} label={num.toString()} onClick={() => handlePress(num.toString())} />
            ))}
            <KeypadButton
              label="."
              onClick={() => handlePress('.')}
              ariaLabel="Decimal"
            />
            <KeypadButton label="0" onClick={() => handlePress('0')} />
            <KeypadButton
              label={<Delete className="h-6 w-6" />}
              onClick={handleBackspace}
              ariaLabel="Backspace"
            />
          </div>
          <button
            type="button"
            onClick={onClose}
            className="mt-4 flex w-full items-center justify-center rounded-xl bg-gradient-to-r from-purple-600 to-fuchsia-500 py-3 text-sm font-bold text-white shadow-md transition active:scale-95"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );

  return createPortal(keypad, document.body);
}
