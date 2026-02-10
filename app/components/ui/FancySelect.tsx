'use client';

import { useEffect, useRef, useState } from 'react';
import { Check, ChevronDown } from 'lucide-react';

export type FancySelectOption = {
  value: string;
  label: string;
};

export type FancySelectProps = {
  value: string;
  options: FancySelectOption[];
  onChange: (value: string) => void;
  buttonClassName?: string;
  listClassName?: string;
  optionClassName?: string;
  ariaLabel?: string;
  disabled?: boolean;
};

export default function FancySelect({
  value,
  options,
  onChange,
  buttonClassName,
  listClassName,
  optionClassName,
  ariaLabel,
  disabled = false,
}: FancySelectProps) {
  const [open, setOpen] = useState(false);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const selected = options.find((option) => option.value === value) ?? options[0] ?? null;

  useEffect(() => {
    if (!open) return;

    const handlePointerDown = (event: MouseEvent) => {
      const target = event.target as Node | null;
      if (!target) return;
      if (buttonRef.current?.contains(target) || listRef.current?.contains(target)) return;
      setOpen(false);
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      event.stopPropagation();
      setOpen(false);
      buttonRef.current?.focus();
    };

    document.addEventListener('mousedown', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [open]);

  return (
    <div className="relative">
      <button
        ref={buttonRef}
        type="button"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={ariaLabel}
        onClick={() => {
          if (disabled) return;
          setOpen((prev) => !prev);
        }}
        className={`flex w-full items-center justify-between gap-2 ${buttonClassName ?? ''} ${
          disabled ? 'cursor-not-allowed opacity-60' : ''
        }`}
      >
        <span className="truncate">{selected?.label ?? 'Select'}</span>
        <ChevronDown
          className={`h-4 w-4 text-zinc-500 transition-transform ${open ? 'rotate-180' : ''}`}
        />
      </button>
      {open && (
        <div
          ref={listRef}
          role="listbox"
          className={`absolute z-[120] mt-2 w-full min-w-[10rem] overflow-hidden rounded-xl border border-zinc-800 bg-zinc-950/95 shadow-[0_25px_60px_-40px_rgba(0,0,0,0.8)] backdrop-blur ${listClassName ?? ''}`}
        >
          {options.map((option) => {
            const isSelected = option.value === value;
            return (
              <button
                key={option.value}
                type="button"
                role="option"
                aria-selected={isSelected}
                onClick={() => {
                  onChange(option.value);
                  setOpen(false);
                  requestAnimationFrame(() => buttonRef.current?.focus());
                }}
                className={`flex w-full items-center justify-between gap-2 px-3 py-2 text-left text-sm transition-colors ${
                  isSelected ? 'bg-emerald-500/15 text-emerald-200' : 'text-zinc-200 hover:bg-zinc-900/70'
                } ${optionClassName ?? ''}`}
              >
                <span className="truncate">{option.label}</span>
                {isSelected && <Check className="h-4 w-4" />}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
