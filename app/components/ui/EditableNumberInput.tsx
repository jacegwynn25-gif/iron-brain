'use client';

import { useEffect, useState } from 'react';

export type EditableNumberInputProps = {
  value: number | null | undefined;
  onCommit: (value: number | null) => void;
  min?: number;
  max?: number;
  step?: number;
  defaultValue?: number;
  className?: string;
  allowDecimal?: boolean;
};

export default function EditableNumberInput({
  value,
  onCommit,
  min,
  max,
  step,
  defaultValue,
  className,
  allowDecimal = false,
}: EditableNumberInputProps) {
  const [textValue, setTextValue] = useState(value != null ? String(value) : '');
  const [focused, setFocused] = useState(false);

  useEffect(() => {
    if (focused) return;
    setTextValue(value != null ? String(value) : '');
  }, [focused, value]);

  const clampValue = (input: number) => {
    let next = input;
    if (min != null) next = Math.max(min, next);
    if (max != null) next = Math.min(max, next);
    return next;
  };

  const commit = (raw: string) => {
    const trimmed = raw.trim();
    if (!trimmed) {
      if (defaultValue != null) {
        const clamped = clampValue(defaultValue);
        setTextValue(String(clamped));
        onCommit(clamped);
      } else {
        setTextValue('');
        onCommit(null);
      }
      return;
    }

    const parsed = Number(trimmed);
    if (!Number.isFinite(parsed)) {
      const fallback = value != null ? String(value) : defaultValue != null ? String(defaultValue) : '';
      setTextValue(fallback);
      return;
    }

    const clamped = clampValue(parsed);
    setTextValue(String(clamped));
    onCommit(clamped);
  };

  return (
    <input
      type="number"
      inputMode={allowDecimal ? 'decimal' : 'numeric'}
      min={min}
      max={max}
      step={step}
      value={textValue}
      onFocus={() => setFocused(true)}
      onBlur={() => {
        setFocused(false);
        commit(textValue);
      }}
      onChange={(event) => {
        const nextValue = event.target.value;
        const pattern = allowDecimal ? /^\d*\.?\d*$/ : /^\d*$/;
        if (!pattern.test(nextValue)) return;
        setTextValue(nextValue);
      }}
      className={className}
    />
  );
}
