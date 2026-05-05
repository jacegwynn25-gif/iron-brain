'use client';

import { useState, type ReactNode } from 'react';
import { Brain, CalendarDays, Check, Moon, Save, Utensils } from 'lucide-react';
import { supabase } from '../../lib/supabase/client';
import { useAuth } from '../../lib/supabase/auth-context';

type Quality = 'poor' | 'fair' | 'good' | 'excellent';
type CalorieBalance = 'deficit' | 'maintenance' | 'surplus';

interface CheckInData {
  date: string;
  sleepHours: number | null;
  sleepQuality: Quality | null;
  sleepInterruptions: number;
  proteinIntake: number | null;
  carbIntake: number | null;
  calorieBalance: CalorieBalance | null;
  hydrationLevel: Quality | null;
  workStress: number;
  lifeStress: number;
  perceivedStress: number;
  subjectiveReadiness: number;
}

interface DailyCheckInFormProps {
  onComplete?: () => void;
}

interface CheckInSectionProps {
  icon: ReactNode;
  eyebrow: string;
  title: string;
  children: ReactNode;
}

const QUALITY_OPTIONS: Quality[] = ['poor', 'fair', 'good', 'excellent'];
const CALORIE_OPTIONS: CalorieBalance[] = ['deficit', 'maintenance', 'surplus'];

function titleize(value: string) {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

function CheckInSection({ icon, eyebrow, title, children }: CheckInSectionProps) {
  return (
    <section className="rounded-[1.25rem] border border-zinc-900 bg-zinc-950/60 p-4 sm:p-5">
      <div className="mb-4 flex items-center gap-3">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-zinc-800 bg-zinc-900/70 text-emerald-300">
          {icon}
        </div>
        <div>
          <p className="text-[9px] font-bold uppercase tracking-[0.24em] text-zinc-500">{eyebrow}</p>
          <h2 className="text-lg font-black italic tracking-tight text-zinc-100">{title}</h2>
        </div>
      </div>
      <div className="space-y-4">{children}</div>
    </section>
  );
}

function NumberField({
  label,
  value,
  min,
  max,
  step,
  placeholder,
  onChange,
}: {
  label: string;
  value: number | null;
  min: number;
  max: number;
  step?: number;
  placeholder: string;
  onChange: (value: number | null) => void;
}) {
  return (
    <label className="block">
      <span className="mb-2 block text-[10px] font-bold uppercase tracking-[0.2em] text-zinc-500">
        {label}
      </span>
      <input
        type="number"
        min={min}
        max={max}
        step={step}
        value={value ?? ''}
        onChange={(event) => {
          const next = event.target.value;
          onChange(next === '' ? null : Number(next));
        }}
        className="h-12 w-full rounded-xl border border-zinc-800 bg-zinc-900/70 px-4 text-sm font-semibold text-zinc-100 outline-none transition-colors placeholder:text-zinc-600 focus:border-emerald-400/50 focus:bg-zinc-900"
        placeholder={placeholder}
      />
    </label>
  );
}

function OptionGroup<T extends string>({
  label,
  options,
  value,
  onChange,
}: {
  label: string;
  options: readonly T[];
  value: T | null;
  onChange: (value: T) => void;
}) {
  return (
    <div>
      <p className="mb-2 text-[10px] font-bold uppercase tracking-[0.2em] text-zinc-500">{label}</p>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {options.map((option) => {
          const active = value === option;
          return (
            <button
              key={option}
              type="button"
              onClick={() => onChange(option)}
              className={`min-h-11 rounded-xl border px-3 text-xs font-bold uppercase tracking-[0.12em] transition-colors ${active
                ? 'border-emerald-400 bg-emerald-400 text-zinc-950'
                : 'border-zinc-800 bg-zinc-900/60 text-zinc-400 hover:border-zinc-700 hover:text-zinc-100'
                }`}
            >
              {titleize(option)}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function RangeField({
  label,
  value,
  left,
  right,
  onChange,
}: {
  label: string;
  value: number;
  left: string;
  right: string;
  onChange: (value: number) => void;
}) {
  return (
    <div className="rounded-xl border border-zinc-900 bg-zinc-950/70 p-3">
      <div className="mb-3 flex items-center justify-between gap-3">
        <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-zinc-500">{label}</p>
        <p className="text-xl font-black italic text-zinc-100">{value}</p>
      </div>
      <input
        type="range"
        min="0"
        max="10"
        value={value}
        onChange={(event) => onChange(Number(event.target.value))}
        className="h-8 w-full accent-emerald-400"
      />
      <div className="mt-1 flex justify-between text-[10px] font-bold uppercase tracking-[0.16em] text-zinc-600">
        <span>{left}</span>
        <span>{right}</span>
      </div>
    </div>
  );
}

export default function DailyCheckInForm({ onComplete }: DailyCheckInFormProps) {
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [formData, setFormData] = useState<CheckInData>({
    date: new Date().toISOString().split('T')[0],
    sleepHours: null,
    sleepQuality: null,
    sleepInterruptions: 0,
    proteinIntake: null,
    carbIntake: null,
    calorieBalance: null,
    hydrationLevel: null,
    workStress: 5,
    lifeStress: 5,
    perceivedStress: 5,
    subjectiveReadiness: 7,
  });

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setLoading(true);
    setError(null);

    if (!user?.id) {
      setError('Sign in again before saving check-in data.');
      setLoading(false);
      return;
    }

    try {
      const { error: insertError } = await supabase
        .from('user_context_data')
        .upsert({
          user_id: user.id,
          date: formData.date,
          sleep_hours: formData.sleepHours,
          sleep_quality: formData.sleepQuality,
          sleep_interruptions: formData.sleepInterruptions,
          protein_intake: formData.proteinIntake,
          carb_intake: formData.carbIntake,
          calorie_balance: formData.calorieBalance,
          hydration_level: formData.hydrationLevel,
          work_stress: formData.workStress,
          life_stress: formData.lifeStress,
          perceived_stress: formData.perceivedStress,
          subjective_readiness: formData.subjectiveReadiness,
          source: 'manual',
        }, {
          onConflict: 'user_id,date',
        });

      if (insertError) throw insertError;

      setSuccess(true);
      window.setTimeout(() => {
        onComplete?.();
      }, 900);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save check-in data.');
    } finally {
      setLoading(false);
    }
  };

  if (success) {
    return (
      <div className="mx-auto max-w-xl rounded-[1.5rem] border border-emerald-400/30 bg-emerald-400/10 px-5 py-10 text-center">
        <div className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-xl bg-emerald-400 text-zinc-950">
          <Check className="h-7 w-7" strokeWidth={3} />
        </div>
        <h2 className="text-2xl font-black italic tracking-tight text-zinc-100">CHECK-IN SAVED</h2>
        <p className="mt-2 text-sm text-zinc-400">Today&apos;s recovery context is logged.</p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <section className="rounded-[1.25rem] border border-zinc-900 bg-zinc-950/60 p-4 sm:p-5">
        <div className="grid gap-4 sm:grid-cols-[1fr_auto] sm:items-center">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-400 text-zinc-950">
              <CalendarDays className="h-5 w-5" />
            </div>
            <div>
              <p className="text-[9px] font-bold uppercase tracking-[0.24em] text-zinc-500">Today</p>
              <h2 className="text-lg font-black italic tracking-tight text-zinc-100">RECOVERY INPUT</h2>
            </div>
          </div>
          <label className="block sm:w-44">
            <span className="sr-only">Date</span>
            <input
              type="date"
              value={formData.date}
              onChange={(event) => setFormData({ ...formData, date: event.target.value })}
              className="h-12 w-full rounded-xl border border-zinc-800 bg-zinc-900/70 px-3 text-sm font-semibold text-zinc-100 outline-none transition-colors focus:border-emerald-400/50"
            />
          </label>
        </div>
      </section>

      {error && (
        <div className="rounded-xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-200">
          {error}
        </div>
      )}

      <div className="grid gap-4 lg:grid-cols-2">
        <CheckInSection eyebrow="Sleep" title="SLEEP" icon={<Moon className="h-4 w-4" />}>
          <NumberField
            label="Hours slept"
            min={0}
            max={24}
            step={0.5}
            value={formData.sleepHours}
            placeholder="8.0"
            onChange={(sleepHours) => setFormData({ ...formData, sleepHours })}
          />
          <OptionGroup
            label="Sleep quality"
            options={QUALITY_OPTIONS}
            value={formData.sleepQuality}
            onChange={(sleepQuality) => setFormData({ ...formData, sleepQuality })}
          />
          <NumberField
            label="Wake-ups"
            min={0}
            max={20}
            value={formData.sleepInterruptions}
            placeholder="0"
            onChange={(sleepInterruptions) => setFormData({ ...formData, sleepInterruptions: sleepInterruptions ?? 0 })}
          />
        </CheckInSection>

        <CheckInSection eyebrow="Fuel" title="NUTRITION" icon={<Utensils className="h-4 w-4" />}>
          <div className="grid gap-3 sm:grid-cols-2">
            <NumberField
              label="Protein"
              min={0}
              max={10}
              step={0.1}
              value={formData.proteinIntake}
              placeholder="g per kg"
              onChange={(proteinIntake) => setFormData({ ...formData, proteinIntake })}
            />
            <NumberField
              label="Carbs"
              min={0}
              max={20}
              step={0.1}
              value={formData.carbIntake}
              placeholder="g per kg"
              onChange={(carbIntake) => setFormData({ ...formData, carbIntake })}
            />
          </div>
          <OptionGroup
            label="Calories"
            options={CALORIE_OPTIONS}
            value={formData.calorieBalance}
            onChange={(calorieBalance) => setFormData({ ...formData, calorieBalance })}
          />
          <OptionGroup
            label="Hydration"
            options={QUALITY_OPTIONS}
            value={formData.hydrationLevel}
            onChange={(hydrationLevel) => setFormData({ ...formData, hydrationLevel })}
          />
        </CheckInSection>
      </div>

      <CheckInSection eyebrow="Stress" title="READINESS" icon={<Brain className="h-4 w-4" />}>
        <div className="grid gap-3 lg:grid-cols-2">
          <RangeField
            label="Overall readiness"
            value={formData.subjectiveReadiness}
            left="low"
            right="ready"
            onChange={(subjectiveReadiness) => setFormData({ ...formData, subjectiveReadiness })}
          />
          <RangeField
            label="Perceived stress"
            value={formData.perceivedStress}
            left="low"
            right="high"
            onChange={(perceivedStress) => setFormData({ ...formData, perceivedStress })}
          />
          <RangeField
            label="Work stress"
            value={formData.workStress}
            left="low"
            right="high"
            onChange={(workStress) => setFormData({ ...formData, workStress })}
          />
          <RangeField
            label="Life stress"
            value={formData.lifeStress}
            left="low"
            right="high"
            onChange={(lifeStress) => setFormData({ ...formData, lifeStress })}
          />
        </div>
      </CheckInSection>

      <button
        type="submit"
        disabled={loading}
        className="flex min-h-14 w-full items-center justify-center gap-2 rounded-[1.25rem] bg-emerald-400 px-6 text-sm font-black italic tracking-tight text-zinc-950 transition-colors hover:bg-emerald-300 active:bg-emerald-500 disabled:cursor-not-allowed disabled:opacity-60"
      >
        <Save className="h-4 w-4" />
        {loading ? 'SAVING...' : 'SAVE CHECK-IN'}
      </button>
    </form>
  );
}
