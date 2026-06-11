'use client';

import { useMemo, useState, type FormEvent, type ReactNode } from 'react';
import {
  Activity,
  Brain,
  CalendarDays,
  Check,
  Clock3,
  Moon,
  Save,
  Utensils,
} from 'lucide-react';
import { supabase } from '../../lib/supabase/client';
import { useAuth } from '../../lib/supabase/auth-context';
import { useUnitPreference } from '../../lib/hooks/useUnitPreference';
import { KG_TO_LBS } from '../../lib/units';

type Quality = 'poor' | 'fair' | 'good' | 'excellent';
type CalorieBalance = 'deficit' | 'maintenance' | 'surplus';
type MealTiming = 'poor' | 'fair' | 'good';

interface CheckInData {
  date: string;
  sleepHours: number | null;
  sleepQuality: Quality | null;
  sleepInterruptions: number;
  proteinIntake: number | null;
  carbIntake: number | null;
  calorieBalance: CalorieBalance | null;
  hydrationLevel: Quality | null;
  mealTiming: MealTiming | null;
  workStress: number;
  lifeStress: number;
  perceivedStress: number;
  restingHeartRate: number | null;
  heartRateVariability: number | null;
  subjectiveReadiness: number;
}

interface DailyCheckInFormProps {
  onComplete?: () => void;
}

interface CheckInSectionProps {
  icon: ReactNode;
  eyebrow: string;
  title: string;
  aside?: ReactNode;
  children: ReactNode;
}

const QUALITY_OPTIONS: Quality[] = ['poor', 'fair', 'good', 'excellent'];
const CALORIE_OPTIONS: CalorieBalance[] = ['deficit', 'maintenance', 'surplus'];
const MEAL_TIMING_OPTIONS: MealTiming[] = ['poor', 'fair', 'good'];

const inputClass =
  'liquid-field h-12 min-w-0 w-full max-w-full px-4 text-sm font-semibold text-zinc-100 placeholder:text-zinc-600';

function titleize(value: string) {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

function getFuelScore(data: CheckInData) {
  let score = 0;
  let total = 0;

  const add = (value: number) => {
    score += value;
    total += 1;
  };

  if (data.proteinIntake != null) add(data.proteinIntake >= 1.6 ? 1 : data.proteinIntake >= 1.2 ? 0.7 : 0.35);
  if (data.carbIntake != null) add(data.carbIntake >= 3 ? 1 : data.carbIntake >= 1.5 ? 0.65 : 0.35);
  if (data.calorieBalance) add(data.calorieBalance === 'surplus' ? 1 : data.calorieBalance === 'maintenance' ? 0.85 : 0.5);
  if (data.hydrationLevel) add({ poor: 0.25, fair: 0.55, good: 0.85, excellent: 1 }[data.hydrationLevel]);
  if (data.mealTiming) add({ poor: 0.3, fair: 0.65, good: 1 }[data.mealTiming]);

  return total === 0 ? null : Math.round((score / total) * 100);
}

function CheckInSection({ icon, eyebrow, title, aside, children }: CheckInSectionProps) {
  return (
    <section className="min-w-0 border-y border-white/8 py-5">
      <div className="mb-5 flex items-start justify-between gap-4">
        <div className="flex min-w-0 items-center gap-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center text-emerald-400">
            {icon}
          </div>
          <div className="min-w-0">
            <p className="text-[9px] font-bold uppercase tracking-[0.24em] text-zinc-500">{eyebrow}</p>
            <h2 className="text-lg font-black italic leading-tight tracking-tight text-zinc-100">{title}</h2>
          </div>
        </div>
        {aside}
      </div>
      <div className="min-w-0 space-y-4">{children}</div>
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
  suffix,
  onChange,
}: {
  label: string;
  value: number | null;
  min: number;
  max: number;
  step?: number;
  placeholder: string;
  suffix?: string;
  onChange: (value: number | null) => void;
}) {
  return (
    <label className="block min-w-0 flex-1">
      <span className="mb-2 block text-[10px] font-bold uppercase tracking-[0.14em] text-zinc-500 sm:tracking-[0.18em]">
        {label}
      </span>
      <div className="relative">
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
          className={`${inputClass} ${suffix ? 'pr-14' : ''}`}
          placeholder={placeholder}
        />
        {suffix && (
          <span className="pointer-events-none absolute inset-y-0 right-4 flex items-center text-xs font-bold text-zinc-500">
            {suffix}
          </span>
        )}
      </div>
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
    <div className="min-w-0">
      <p className="mb-2 text-[10px] font-bold uppercase tracking-[0.14em] text-zinc-500 sm:tracking-[0.18em]">{label}</p>
      <div className="grid min-w-0 grid-cols-2 gap-2 sm:grid-cols-4">
        {options.map((option) => {
          const active = value === option;
          return (
            <button
              key={option}
              type="button"
              onClick={() => onChange(option)}
              className={`min-h-11 min-w-0 rounded-xl border px-2 text-[11px] font-bold uppercase tracking-[0.04em] transition-colors sm:px-3 sm:text-xs sm:tracking-[0.1em] ${active
                ? 'border-emerald-500 bg-emerald-500 text-zinc-950'
                : 'border-white/8 bg-white/[0.035] text-zinc-400 hover:border-white/14 hover:text-zinc-100'
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
  min = 0,
  left,
  right,
  onChange,
}: {
  label: string;
  value: number;
  min?: number;
  left: string;
  right: string;
  onChange: (value: number) => void;
}) {
  return (
    <div className="min-w-0 border-y border-white/8 py-3">
      <div className="mb-3 flex items-center justify-between gap-3">
        <p className="min-w-0 text-[10px] font-bold uppercase tracking-[0.14em] text-zinc-500 sm:tracking-[0.18em]">{label}</p>
        <p className="text-xl font-black italic text-zinc-100">{value}</p>
      </div>
      <input
        type="range"
        min={min}
        max="10"
        value={value}
        onChange={(event) => onChange(Number(event.target.value))}
        className="h-8 w-full accent-emerald-400"
      />
      <div className="mt-1 flex justify-between text-[10px] font-bold uppercase tracking-[0.14em] text-zinc-600">
        <span>{left}</span>
        <span>{right}</span>
      </div>
    </div>
  );
}

function FuelSummary({ score }: { score: number | null }) {
  const label = score == null ? 'Not logged' : score >= 80 ? 'Covered' : score >= 60 ? 'Partial' : 'Low';
  const tone =
    score == null
      ? 'text-zinc-500'
      : score >= 80
        ? 'text-emerald-300'
        : score >= 60
          ? 'text-amber-300'
          : 'text-rose-300';

  return (
    <div className="shrink-0 text-right">
      <p className="text-[9px] font-bold uppercase tracking-[0.2em] text-zinc-500">Fuel</p>
      <p className={`text-sm font-black italic uppercase ${tone}`}>{label}</p>
    </div>
  );
}

function toNutritionDisplay(value: number | null, weightUnit: 'lbs' | 'kg') {
  if (value == null) return null;
  const displayValue = weightUnit === 'lbs' ? value / KG_TO_LBS : value;
  return Number(displayValue.toFixed(2));
}

function fromNutritionDisplay(value: number | null, weightUnit: 'lbs' | 'kg') {
  if (value == null) return null;
  const storedValue = weightUnit === 'lbs' ? value * KG_TO_LBS : value;
  return Number(storedValue.toFixed(3));
}

export default function DailyCheckInForm({ onComplete }: DailyCheckInFormProps) {
  const { user } = useAuth();
  const { weightUnit } = useUnitPreference();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [formData, setFormData] = useState<CheckInData>({
    date: new Date().toISOString().split('T')[0],
    sleepHours: null,
    sleepQuality: null,
    sleepInterruptions: 0,
    proteinIntake: null,
    carbIntake: null,
    calorieBalance: null,
    hydrationLevel: null,
    mealTiming: null,
    workStress: 5,
    lifeStress: 5,
    perceivedStress: 5,
    restingHeartRate: null,
    heartRateVariability: null,
    subjectiveReadiness: 7,
  });

  const fuelScore = useMemo(() => getFuelScore(formData), [formData]);
  const nutritionUnit = weightUnit === 'lbs' ? 'g/lb' : 'g/kg';
  const proteinMax = weightUnit === 'lbs' ? 4.5 : 10;
  const carbMax = weightUnit === 'lbs' ? 9 : 20;

  const handleSubmit = async (event: FormEvent) => {
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
          meal_timing: formData.mealTiming,
          work_stress: formData.workStress,
          life_stress: formData.lifeStress,
          perceived_stress: formData.perceivedStress,
          resting_heart_rate: formData.restingHeartRate,
          heart_rate_variability: formData.heartRateVariability,
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
      <div className="mx-auto max-w-xl border-y border-emerald-400/25 px-5 py-10 text-center">
        <div className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-full bg-emerald-500 text-zinc-950">
          <Check className="h-7 w-7" strokeWidth={3} />
        </div>
        <h2 className="text-2xl font-black italic tracking-tight text-zinc-100">CHECK-IN SAVED</h2>
        <p className="mt-2 text-sm text-zinc-400">Today&apos;s recovery context is logged.</p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="min-w-0 space-y-4">
      <section className="min-w-0 border-y border-white/8 py-5">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex min-w-0 items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-emerald-500 text-zinc-950">
              <CalendarDays className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <p className="text-[9px] font-bold uppercase tracking-[0.24em] text-zinc-500">Today</p>
              <h2 className="text-lg font-black italic leading-tight tracking-tight text-zinc-100">RECOVERY INPUT</h2>
            </div>
          </div>
          <label className="block min-w-0 w-full sm:w-52">
            <span className="mb-2 block text-[10px] font-bold uppercase tracking-[0.18em] text-zinc-500 sm:text-right">
              Date
            </span>
            <input
              type="date"
              value={formData.date}
              onChange={(event) => setFormData({ ...formData, date: event.target.value })}
              className={inputClass}
            />
          </label>
        </div>
      </section>

      {error && (
        <div className="border-y border-rose-400/25 py-3 text-sm text-rose-200">
          {error}
        </div>
      )}

      <CheckInSection eyebrow="Quick" title="TODAY'S READINESS" icon={<Brain className="h-4 w-4" />}>
        <div className="grid gap-3 lg:grid-cols-2">
          <RangeField
            label="Overall readiness"
            value={formData.subjectiveReadiness}
            min={1}
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
        </div>
        <NumberField
          label="Sleep"
          min={0}
          max={24}
          step={0.5}
          value={formData.sleepHours}
          placeholder="8.0"
          suffix="hrs"
          onChange={(sleepHours) => setFormData({ ...formData, sleepHours })}
        />
      </CheckInSection>

      <button
        type="button"
        onClick={() => setShowAdvanced((value) => !value)}
        className="liquid-icon-button flex min-h-11 w-full items-center justify-between rounded-[1rem] px-4 text-left text-[11px] font-black uppercase tracking-[0.14em] text-zinc-300 transition-colors hover:text-zinc-100"
        aria-expanded={showAdvanced}
      >
        <span>Advanced details</span>
        <span className="text-emerald-300">{showAdvanced ? 'Hide' : 'Show'}</span>
      </button>

      {showAdvanced && (
        <div className="space-y-4">
          <CheckInSection eyebrow="Sleep" title="SLEEP DETAILS" icon={<Moon className="h-4 w-4" />}>
            <div className="grid gap-3 sm:grid-cols-2">
              <NumberField
                label="Wake-ups"
                min={0}
                max={20}
                value={formData.sleepInterruptions}
                placeholder="0"
                onChange={(sleepInterruptions) => setFormData({ ...formData, sleepInterruptions: sleepInterruptions ?? 0 })}
              />
              <OptionGroup
                label="Sleep quality"
                options={QUALITY_OPTIONS}
                value={formData.sleepQuality}
                onChange={(sleepQuality) => setFormData({ ...formData, sleepQuality })}
              />
            </div>
          </CheckInSection>

          <CheckInSection
            eyebrow="Fuel"
            title="NUTRITION"
            icon={<Utensils className="h-4 w-4" />}
            aside={<FuelSummary score={fuelScore} />}
          >
            <div className="grid gap-3 sm:grid-cols-2">
              <NumberField
                label="Protein / BW"
                min={0}
                max={proteinMax}
                step={0.1}
                value={toNutritionDisplay(formData.proteinIntake, weightUnit)}
                placeholder={weightUnit === 'lbs' ? '0.8' : '1.8'}
                suffix={nutritionUnit}
                onChange={(proteinIntake) => setFormData({
                  ...formData,
                  proteinIntake: fromNutritionDisplay(proteinIntake, weightUnit),
                })}
              />
              <NumberField
                label="Carbs / BW"
                min={0}
                max={carbMax}
                step={0.1}
                value={toNutritionDisplay(formData.carbIntake, weightUnit)}
                placeholder={weightUnit === 'lbs' ? '1.6' : '3.5'}
                suffix={nutritionUnit}
                onChange={(carbIntake) => setFormData({
                  ...formData,
                  carbIntake: fromNutritionDisplay(carbIntake, weightUnit),
                })}
              />
            </div>
            <OptionGroup
              label="Calories"
              options={CALORIE_OPTIONS}
              value={formData.calorieBalance}
              onChange={(calorieBalance) => setFormData({ ...formData, calorieBalance })}
            />
            <div className="grid gap-4 xl:grid-cols-2">
              <OptionGroup
                label="Hydration"
                options={QUALITY_OPTIONS}
                value={formData.hydrationLevel}
                onChange={(hydrationLevel) => setFormData({ ...formData, hydrationLevel })}
              />
              <OptionGroup
                label="Meal timing"
                options={MEAL_TIMING_OPTIONS}
                value={formData.mealTiming}
                onChange={(mealTiming) => setFormData({ ...formData, mealTiming })}
              />
            </div>
          </CheckInSection>

          <CheckInSection eyebrow="Advanced" title="STRESS + VITALS" icon={<Activity className="h-4 w-4" />}>
            <div className="grid gap-3 lg:grid-cols-2">
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
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="flex min-w-0 items-center gap-3 border-y border-white/8 py-3">
                <Activity className="h-4 w-4 shrink-0 text-rose-300" />
                <NumberField
                  label="Resting heart rate"
                  min={20}
                  max={220}
                  value={formData.restingHeartRate}
                  placeholder="58"
                  suffix="bpm"
                  onChange={(restingHeartRate) => setFormData({ ...formData, restingHeartRate })}
                />
              </div>
              <div className="flex min-w-0 items-center gap-3 border-y border-white/8 py-3">
                <Clock3 className="h-4 w-4 shrink-0 text-emerald-300" />
                <NumberField
                  label="HRV"
                  min={0}
                  max={300}
                  value={formData.heartRateVariability}
                  placeholder="72"
                  suffix="ms"
                  onChange={(heartRateVariability) => setFormData({ ...formData, heartRateVariability })}
                />
              </div>
            </div>
          </CheckInSection>
        </div>
      )}

      <button
        type="submit"
        disabled={loading}
        className="liquid-action-button flex min-h-14 w-full items-center justify-center gap-2 rounded-[1.05rem] px-6 text-sm font-black italic tracking-tight text-zinc-950 transition-colors disabled:cursor-not-allowed disabled:opacity-60"
      >
        <Save className="h-4 w-4" />
        {loading ? 'SAVING...' : 'SAVE CHECK-IN'}
      </button>
    </form>
  );
}
