'use client';

import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { AnimatePresence, motion } from 'framer-motion';
import {
  ArrowLeft,
  FileText,
  History,
  Info,
  Plus,
  Timer,
  Trash2,
  X,
} from 'lucide-react';

import type { CustomExercise, DayTemplate, ProgramTemplate, SetLog, WeightUnit, WorkoutSession } from '@/app/lib/types';
import type { ActiveCell, Block, Exercise, Set as SessionSet } from '@/app/lib/types/session';
import { useRecoveryState } from '@/app/lib/hooks/useRecoveryState';
import { useWorkoutSession, type ReadinessLoadModifiers } from '@/app/lib/hooks/useWorkoutSession';
import { useUnitPreference } from '@/app/lib/hooks/useUnitPreference';
import { useActiveSession } from '@/app/providers/ActiveSessionProvider';

import { getCustomExercises } from '@/app/lib/exercises/custom-exercises';
import {
  buildExerciseCatalog,
  resolveExerciseDisplayName,
  resolveExerciseMuscleProfile,
  type ExerciseMuscleGroup,
} from '@/app/lib/exercises/catalog';
import { defaultExercises } from '@/app/lib/programs';
import {
  advanceProgramProgress,
  getProgramProgress,
  resolveProgramDay,
  syncProgramProgressToCloud,
  type ProgramProgress,
} from '@/app/lib/programs/progress';
import { useAuth } from '@/app/lib/supabase/auth-context';
import { supabase } from '@/app/lib/supabase/client';
import { resolveExerciseIds } from '@/app/lib/supabase/workouts';
import { fetchJsonWithAuth } from '@/app/lib/api/authed-fetch';
import HardyStepper from '@/app/components/workout/controls/HardyStepper';
import RpeSlider from '@/app/components/workout/controls/RpeSlider';
import RestTimer from '@/app/components/RestTimer';
import { saveWorkout, storage } from '@/app/lib/storage';
import { createUuid, isValidUuid } from '@/app/lib/uuid';
import { rpeAdjusted1RM } from '@/app/lib/stats/one-rep-max';
import { convertWeight } from '@/app/lib/units';
import { trackUiEvent } from '@/app/lib/analytics/ui-events';
import { updateScheduleEvent } from '@/app/lib/calendar/schedule-api';
import { FEATURES } from '@/app/lib/features';
import { useBodyScrollLock } from '@/app/lib/hooks/useBodyScrollLock';
import { type ActiveSessionSnapshot } from '@/app/providers/ActiveSessionProvider';
import {
  buildTrainingRecommendations,
  recommendationHasApplyPatch,
  type TrainingHistorySet,
  type TrainingPersonalRecord,
  type TrainingRecommendation,
  type TrainingRecommendationInput,
  type TrainingSetInput,
} from '@/app/lib/intelligence/training-recommendations';

type ViewMode = 'overview' | 'cockpit' | 'rest';
type InfoPanel = 'set-unit' | 'rpe' | null;

type ExerciseRef = {
  blockId: string;
  blockType: Block['type'];
  exercise: Exercise;
};

const DEFAULT_REST_SECONDS = 90;
const COMPOUND_REST_SECONDS = 180;
const ISOLATION_REST_SECONDS = 90;
const SMALL_ISO_REST_SECONDS = 75;
const CORE_REST_SECONDS = 60;
const METRONOME_BEAT_MS = 600;

type CommonExercise = {
  id: string;
  name: string;
};

type MuscleGroup = ExerciseMuscleGroup;

type ExerciseIdentity = Pick<Exercise, 'id' | 'name'>;
type MuscleProfile = { primary: MuscleGroup; secondary?: MuscleGroup };
type ResolveMuscleProfile = (exercise: ExerciseIdentity) => MuscleProfile;

const COMMON_EXERCISES: CommonExercise[] = [
  { id: 'back_squat', name: 'Back Squat' },
  { id: 'deadlift', name: 'Deadlift' },
  { id: 'bench_press', name: 'Bench Press' },
  { id: 'overhead_press', name: 'Overhead Press' },
  { id: 'pull_up', name: 'Pull-up' },
  { id: 'chin_up', name: 'Chin-up' },
  { id: 'barbell_row', name: 'Barbell Row' },
  { id: 'dumbbell_row', name: 'Dumbbell Row' },
  { id: 'lat_pulldown', name: 'Lat Pulldown' },
  { id: 'dips', name: 'Dip' },
  { id: 'tricep_extension', name: 'Tricep Extension' },
  { id: 'bicep_curl', name: 'Bicep Curl' },
  { id: 'leg_press', name: 'Leg Press' },
  { id: 'lunges', name: 'Lunge' },
  { id: 'split_squat', name: 'Split Squat' },
  { id: 'calf_raise', name: 'Calf Raise' },
  { id: 'hip_thrust', name: 'Hip Thrust' },
  { id: 'leg_extension', name: 'Leg Extension' },
  { id: 'leg_curl', name: 'Leg Curl' },
  { id: 'face_pull', name: 'Face Pull' },
  { id: 'lateral_raise', name: 'Lateral Raise' },
  { id: 'plank', name: 'Plank' },
  { id: 'ab_wheel', name: 'Ab Wheel' },
];

const KEYPAD_KEYS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '.', '0', 'del'];

const MUSCLE_COLORS: Record<MuscleGroup, { color: string; glow: string }> = {
  chest: { color: '#fb7185', glow: 'rgba(251,113,133,0.55)' },
  shoulders: { color: '#60a5fa', glow: 'rgba(96,165,250,0.55)' },
  triceps: { color: '#fb923c', glow: 'rgba(251,146,60,0.5)' },
  biceps: { color: '#fde047', glow: 'rgba(253,224,71,0.5)' },
  back: { color: '#a78bfa', glow: 'rgba(167,139,250,0.6)' },
  quads: { color: '#34d399', glow: 'rgba(52,211,153,0.55)' },
  hamstrings: { color: '#6366f1', glow: 'rgba(99,102,241,0.55)' },
  glutes: { color: '#0ea5e9', glow: 'rgba(14,165,233,0.55)' },
  calves: { color: '#bef264', glow: 'rgba(190,242,100,0.5)' },
  core: { color: '#22d3ee', glow: 'rgba(34,211,238,0.5)' },
  other: { color: '#71717a', glow: 'rgba(113,113,122,0.35)' },
};

const MUSCLE_LABELS: Record<MuscleGroup, string> = {
  chest: 'CHEST',
  shoulders: 'SHOULDERS',
  triceps: 'TRICEPS',
  biceps: 'BICEPS',
  back: 'BACK',
  quads: 'QUADS',
  hamstrings: 'HAMS',
  glutes: 'GLUTES',
  calves: 'CALVES',
  core: 'CORE',
  other: 'LIFT',
};

const LEGEND_ITEMS: Array<{ key: MuscleGroup; label: string }> = [
  { key: 'chest', label: 'Chest' },
  { key: 'back', label: 'Back' },
  { key: 'quads', label: 'Quads' },
  { key: 'glutes', label: 'Glutes' },
  { key: 'hamstrings', label: 'Hams' },
  { key: 'shoulders', label: 'Shoulders' },
  { key: 'triceps', label: 'Triceps' },
  { key: 'biceps', label: 'Biceps' },
  { key: 'core', label: 'Core' },
  { key: 'calves', label: 'Calves' },
];

function createQuickStartProgram(): ProgramTemplate {
  return {
    id: 'qs',
    name: 'Quick Start',
    isCustom: true,
    weeks: [],
  };
}

type ProgramDayContext = {
  cycleNumber: number;
  weekIndex: number;
  dayIndex: number;
  weekNumber: number;
  day: DayTemplate;
};

function createProgramSliceForDay(program: ProgramTemplate, context: ProgramDayContext): ProgramTemplate {
  const clonedDay: DayTemplate = {
    ...context.day,
    sets: context.day.sets.map((set) => ({ ...set })),
    blocks: context.day.blocks?.map((block) => ({
      ...block,
      exercises: block.exercises.map((exercise) => ({
        ...exercise,
        sets: exercise.sets.map((set) => ({ ...set })),
      })),
    })),
  };

  return {
    ...program,
    weeks: [
      {
        weekNumber: context.weekNumber,
        days: [clonedDay],
      },
    ],
  };
}

function withTimeout<T>(promise: Promise<T>, timeoutMs: number, timeoutMessage: string): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timeoutId = setTimeout(() => {
      reject(new Error(timeoutMessage));
    }, timeoutMs);

    promise
      .then((value) => {
        clearTimeout(timeoutId);
        resolve(value);
      })
      .catch((error) => {
        clearTimeout(timeoutId);
        reject(error);
      });
  });
}

type ExerciseStyle = {
  label: string;
  primaryColor: string;
  secondaryColor: string;
  primaryGroup: MuscleGroup;
  secondaryGroup: MuscleGroup;
  isCompound: boolean;
};

type PrMetric = 'max_weight' | 'max_reps' | 'max_e1rm' | 'max_volume';

type ProjectedPrHit = {
  exerciseId: string;
  exerciseName: string;
  metric: PrMetric;
  current: number;
  previous: number;
};

type PrBaseline = {
  maxWeight: number;
  maxReps: number;
  maxE1RM: number;
  maxVolume: number;
};

const PR_METRIC_LABEL: Record<PrMetric, string> = {
  max_weight: 'WEIGHT',
  max_reps: 'REPS',
  max_e1rm: 'E1RM',
  max_volume: 'VOLUME',
};

const formatProjectedPrValue = (metric: PrMetric, value: number, unit: 'lbs' | 'kg'): string => {
  if (metric === 'max_reps') return `${Math.round(value)}`;
  const formatted = Math.round(value).toLocaleString();
  return `${formatted}${unit.toUpperCase()}`;
};

function MuscleGlyph({ group }: { group: MuscleGroup }) {
  const glyphs: Record<MuscleGroup, ReactNode> = {
    chest: (
      <>
        <path fill="currentColor" d="M16 12.2C12.2 7.7 5.7 8.9 4.1 15.5c1 5.7 6.5 7.7 11.9 3.9 5.4 3.8 10.9 1.8 11.9-3.9-1.6-6.6-8.1-7.8-11.9-3.3Z" />
        <path fill="currentColor" opacity="0.38" d="M9.3 12.6c2.3 0 4.2 1.4 5.4 3.9-3.5 1.9-6.6.7-7.4-2.1.5-1.1 1.2-1.8 2-1.8Zm13.4 0c.8 0 1.5.7 2 1.8-.8 2.8-3.9 4-7.4 2.1 1.2-2.5 3.1-3.9 5.4-3.9Z" />
      </>
    ),
    shoulders: (
      <>
        <path fill="currentColor" d="M16 8.4c-2.7 0-4.7 1.6-5.8 4.4-3.6-1.4-6.9.7-7.9 5.3 4.3 1.5 8.2.1 11.1-3.9.8-.2 1.7-.2 2.6-.2s1.8 0 2.6.2c2.9 4 6.8 5.4 11.1 3.9-1-4.6-4.3-6.7-7.9-5.3-1.1-2.8-3.1-4.4-5.8-4.4Z" />
        <path fill="currentColor" opacity="0.35" d="M16 10.9c1.2 0 2.2.5 2.9 1.5-1.8-.3-3.9-.3-5.8 0 .7-1 1.7-1.5 2.9-1.5Z" />
      </>
    ),
    triceps: (
      <>
        <path fill="currentColor" d="M12.1 5.8c5.1.2 9.1 3.6 9.1 8.6 0 5.4-4.8 8.8-10.2 7.1 2.8-3.1 2.9-6.6.3-9.1l-3 5.5-4-2.2 4.9-9.1c.8-.5 1.8-.8 2.9-.8Z" />
        <path fill="currentColor" opacity="0.32" d="M14.3 10.2c2.3 1 3.8 2.8 3.8 4.9 0 2.4-1.8 4-4.4 4.2 1.2-2.7 1.3-5.7.6-9.1Z" />
      </>
    ),
    biceps: (
      <>
        <path fill="currentColor" d="M7.1 18.7c1.6-7.7 7-12.7 12.2-9.4 3.6 2.3 3.3 7.4-.7 10.1-3.8 2.6-8.6 2.4-11.5-.7Z" />
        <path fill="currentColor" d="M4.6 16.3 8 18.5l-2.1 4.1-3.4-2.1 2.1-4.2Z" opacity="0.78" />
        <path fill="currentColor" opacity="0.3" d="M14.1 11.2c2.7-.7 5 .4 5.5 2.3.5 1.8-.8 3.8-3.4 4.7 1.5-2.4.8-5-2.1-7Z" />
      </>
    ),
    back: (
      <>
        <path fill="currentColor" d="M16 6.4c-2.1 2.1-3.8 5.4-5.1 9.8-2.3-4.4-5.2-6.3-8.2-5.3.4 8.4 5.2 12.2 13.3 14.7 8.1-2.5 12.9-6.3 13.3-14.7-3-1-5.9.9-8.2 5.3-1.3-4.4-3-7.7-5.1-9.8Z" />
        <path fill="currentColor" opacity="0.32" d="M16 12c1.4 2.8 2.3 6.1 2.8 9.8-.8.4-1.7.7-2.8 1-1.1-.3-2-.6-2.8-1 .5-3.7 1.4-7 2.8-9.8Z" />
      </>
    ),
    quads: (
      <>
        <path fill="currentColor" d="M9.4 5.7h13.2c1.9 5.3 2.3 12.2.9 20.6H18l-2-10-2 10H8.5c-1.4-8.4-1-15.3.9-20.6Z" />
        <path fill="currentColor" opacity="0.32" d="M12.3 8.4h2.4l-1.3 14.5h-2.6c-.7-5.8-.2-10.7 1.5-14.5Zm5 0h2.4c1.7 3.8 2.2 8.7 1.5 14.5h-2.6L17.3 8.4Z" />
      </>
    ),
    hamstrings: (
      <>
        <path fill="currentColor" d="M9.2 5.8h13.6c2.1 6.1 1.1 13.5-3.6 20.4h-4.1L16 15l.9 11.2h-4.1C8.1 19.3 7.1 11.9 9.2 5.8Z" />
        <path fill="currentColor" opacity="0.34" d="M10.8 8.5h3.1c-.7 5.7-.2 10.4 1.4 14.2h-2c-2.6-4.4-3.4-9.1-2.5-14.2Zm7.3 0h3.1c.9 5.1.1 9.8-2.5 14.2h-2c1.6-3.8 2.1-8.5 1.4-14.2Z" />
      </>
    ),
    glutes: (
      <>
        <path fill="currentColor" d="M16 9.8c-3.6-5-10.1-2-10.1 4.2 0 6.8 6.5 10.7 10.1 7.2 3.6 3.5 10.1-.4 10.1-7.2 0-6.2-6.5-9.2-10.1-4.2Z" />
        <path fill="currentColor" opacity="0.32" d="M12.6 11.7c.8 2.7.7 5.3-.2 7.8-2.1-.3-3.8-2.6-3.8-5.3 0-2.5 1.7-3.9 4-2.5Zm6.8 0c2.3-1.4 4 .1 4 2.5 0 2.7-1.7 5-3.8 5.3-.9-2.5-1-5.1-.2-7.8Z" />
      </>
    ),
    calves: (
      <>
        <path fill="currentColor" d="M11.3 5.6c3.1 2.1 4 6.5 1.8 13l-2.5 7.8H6.9l2.3-7.1C11 13.5 10.2 9.8 7.5 6.9c1.1-.8 2.4-1.2 3.8-1.3Zm9.4 0c1.4.1 2.7.5 3.8 1.3-2.7 2.9-3.5 6.6-1.7 12.4l2.3 7.1h-3.7l-2.5-7.8c-2.2-6.5-1.3-10.9 1.8-13Z" />
        <path fill="currentColor" opacity="0.32" d="M11.2 12.9h3.1c-.1 1.7-.5 3.7-1.2 5.8l-1.5 4.4h-1.8l1.5-4.6c.7-2.1.7-4 .1-5.6Zm6.5 0h3.1c-.6 1.6-.6 3.5.1 5.6l1.5 4.6h-1.8l-1.5-4.4c-.7-2.1-1.1-4.1-1.4-5.8Z" />
      </>
    ),
    core: (
      <>
        <path fill="currentColor" d="M11.2 5.5h9.6c2.4 5.6 2.4 12.6 0 21h-9.6c-2.4-8.4-2.4-15.4 0-21Z" />
        <rect fill="currentColor" opacity="0.32" x="12.4" y="8.2" width="3.1" height="4.1" rx="1" />
        <rect fill="currentColor" opacity="0.32" x="16.5" y="8.2" width="3.1" height="4.1" rx="1" />
        <rect fill="currentColor" opacity="0.32" x="12.2" y="14" width="3.3" height="4.2" rx="1" />
        <rect fill="currentColor" opacity="0.32" x="16.5" y="14" width="3.3" height="4.2" rx="1" />
        <rect fill="currentColor" opacity="0.32" x="12.8" y="19.9" width="2.9" height="3.4" rx="1" />
        <rect fill="currentColor" opacity="0.32" x="16.3" y="19.9" width="2.9" height="3.4" rx="1" />
      </>
    ),
    other: (
      <>
        <rect fill="currentColor" x="6.8" y="14.2" width="18.4" height="3.6" rx="1.2" />
        <rect fill="currentColor" opacity="0.55" x="2.8" y="11.2" width="3.2" height="9.6" rx="1" />
        <rect fill="currentColor" opacity="0.55" x="26" y="11.2" width="3.2" height="9.6" rx="1" />
        <rect fill="currentColor" opacity="0.8" x="7" y="9.5" width="4" height="13" rx="1.1" />
        <rect fill="currentColor" opacity="0.8" x="21" y="9.5" width="4" height="13" rx="1.1" />
      </>
    ),
  };

  return (
    <svg aria-hidden="true" viewBox="0 0 32 32" className="h-5 w-5">
      {glyphs[group] ?? glyphs.other}
    </svg>
  );
}

const ExerciseBadge = ({ style }: { style: ExerciseStyle }) => {
  const ringStyle = style.isCompound
    ? { backgroundImage: `linear-gradient(135deg, ${style.primaryColor}, ${style.secondaryColor})` }
    : { backgroundColor: style.primaryColor };
  const glowColor = style.isCompound ? style.secondaryColor : style.primaryColor;

  return (
    <span className="inline-flex rounded-full p-[1px]" style={ringStyle}>
      <span
        className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-zinc-950"
        style={{ boxShadow: `0 0 12px ${glowColor}55`, color: style.primaryColor }}
      >
        <MuscleGlyph group={style.primaryGroup} />
      </span>
    </span>
  );
};

function formatSmartWeight(value: number | null | undefined, unit: WeightUnit | undefined): string | null {
  if (value == null || !Number.isFinite(value)) return null;
  const display = unit === 'kg' ? Number(value.toFixed(2)).toString() : Math.round(value).toString();
  return `${display} ${unit?.toUpperCase() ?? 'LBS'}`;
}

function formatRecommendationSource(source: TrainingRecommendation['source']): string {
  if (source === 'exercise_history') return 'History';
  if (source === 'session_fatigue') return 'Set Signal';
  if (source === 'load_pressure') return 'Load';
  if (source === 'performance_trend') return 'Trend';
  if (source === 'prescription') return 'Plan';
  if (source === 'readiness') return 'Readiness';
  if (source === 'e1rm') return 'Max Data';
  if (source === 'program_load') return 'Program';
  return 'Baseline';
}

function SmartTargetReadout({
  recommendation,
  onApply,
  label = 'Smart Target',
  testId = 'smart-target-card',
  applyTestId = 'smart-target-apply',
}: {
  recommendation: TrainingRecommendation | null;
  onApply: (recommendation: TrainingRecommendation) => void;
  label?: string;
  testId?: string;
  applyTestId?: string;
}) {
  if (!recommendation) return null;

  const targetWeight = formatSmartWeight(recommendation.target?.weight, recommendation.target?.weightUnit);
  const targetReps = recommendation.target?.reps != null ? `${Math.round(recommendation.target.reps)} REPS` : null;
  const restText = recommendation.target?.restSeconds != null ? `+${recommendation.target.restSeconds}s REST` : null;
  const targetText = [targetWeight, targetReps].filter(Boolean).join(' x ') || restText || 'BASELINE';
  const canApply = recommendationHasApplyPatch(recommendation);

  return (
    <div
      className="rounded-2xl border border-zinc-800 bg-zinc-950/80 px-3.5 py-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.03)]"
      data-testid={testId}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[9px] font-black uppercase tracking-[0.28em] text-emerald-300">
            {label}
          </p>
          <p className="mt-1 font-mono text-lg font-black uppercase tracking-tight text-white">
            {targetText}
          </p>
        </div>
        <p className="shrink-0 text-right text-[9px] font-bold uppercase tracking-[0.2em] text-zinc-500">
          {recommendation.confidence} · {formatRecommendationSource(recommendation.source)}
        </p>
      </div>
      <div className="mt-2 flex items-end justify-between gap-3">
        <p className="min-w-0 text-xs leading-snug text-zinc-400">
          {recommendation.reason}
        </p>
        {canApply && (
          <button
            type="button"
            onClick={() => onApply(recommendation)}
            className="shrink-0 rounded-xl border border-emerald-400/40 bg-emerald-400 px-3 py-2 text-[10px] font-black uppercase tracking-[0.18em] text-zinc-950 shadow-[0_12px_28px_-20px_rgba(52,211,153,0.9)] active:scale-95"
            data-testid={applyTestId}
          >
            Apply
          </button>
        )}
      </div>
    </div>
  );
}

const getExerciseStyle = (exercise: ExerciseIdentity, resolveMuscleProfile: ResolveMuscleProfile): ExerciseStyle => {
  const { primary, secondary } = resolveMuscleProfile(exercise);
  const primaryKey = MUSCLE_COLORS[primary] ? primary : 'other';
  const secondaryKey = secondary && MUSCLE_COLORS[secondary] ? secondary : primaryKey;
  const primaryPalette = MUSCLE_COLORS[primaryKey];
  const secondaryPalette = MUSCLE_COLORS[secondaryKey];
  const isCompound = secondaryKey !== primaryKey;
  return {
    label: MUSCLE_LABELS[primaryKey] ?? 'LIFT',
    primaryColor: primaryPalette.color,
    secondaryColor: secondaryPalette.color,
    primaryGroup: primaryKey,
    secondaryGroup: secondaryKey,
    isCompound,
  };
};

const isBodyweight = (name: string): boolean => {
  const lower = name.toLowerCase();
  if (lower.includes('weighted')) return false;
  return [
    'bodyweight',
    'pull-up',
    'pull up',
    'chin-up',
    'chin up',
    'dip',
    'plank',
    'ab wheel',
  ].some((keyword) => lower.includes(keyword));
};

const getRestDurationSeconds = (exercise: ExerciseIdentity, resolveMuscleProfile: ResolveMuscleProfile): number => {
  const { primary, secondary } = resolveMuscleProfile(exercise);
  const isCompound = Boolean(secondary);
  if (isCompound) return COMPOUND_REST_SECONDS;
  if (primary === 'core') return CORE_REST_SECONDS;
  if (primary === 'calves' || primary === 'biceps' || primary === 'triceps' || primary === 'shoulders') {
    return SMALL_ISO_REST_SECONDS;
  }
  return ISOLATION_REST_SECONDS;
};

const parseTempoSteps = (tempo: string | null | undefined): number[] => {
  if (!tempo) return [];
  return tempo
    .split('-')
    .map((entry) => Number(entry.trim()))
    .filter((entry) => Number.isFinite(entry) && entry >= 0);
};

const mapSetType = (setType: SessionSet['type']): SetLog['setType'] => {
  if (setType === 'warmup') return 'warmup';
  if (setType === 'drop') return 'drop';
  if (setType === 'failure') return 'amrap';
  return 'straight';
};

function findSetByActiveCell(blocks: Block[], activeCell: ActiveCell | null) {
  if (!activeCell) return null;
  const block = blocks.find((entry) => entry.id === activeCell.blockId);
  if (!block) return null;
  const exercise = block.exercises.find((entry) => entry.id === activeCell.exerciseId);
  if (!exercise) return null;
  const set = exercise.sets.find((entry) => entry.id === activeCell.setId);
  if (!set) return null;
  return { block, exercise, set };
}

function getFocusSet(exercise: Exercise, activeCell: ActiveCell | null, blockId: string): SessionSet | null {
  if (
    activeCell &&
    activeCell.blockId === blockId &&
    activeCell.exerciseId === exercise.id
  ) {
    const activeSet = exercise.sets.find((set) => set.id === activeCell.setId);
    if (activeSet) return activeSet;
  }

  return exercise.sets.find((set) => !set.completed) ?? exercise.sets[exercise.sets.length - 1] ?? null;
}

function toTrainingSetInput(
  blockId: string,
  exercise: Exercise,
  set: SessionSet,
  setIndex: number,
  exerciseName: string
): TrainingSetInput {
  return {
    blockId,
    exerciseId: exercise.id,
    exerciseName,
    setId: set.id,
    setIndex: setIndex + 1,
    weight: set.weight,
    weightUnit: set.weightUnit,
    reps: set.reps,
    rpe: set.rpe,
    prescribedRPE: set.prescribedRPE,
    prescribedRIR: set.prescribedRIR,
    prescribedPercentage: set.prescribedPercentage,
    prescribedWeight: set.prescribedWeight,
    touchedWeight: set.touchedWeight,
    touchedReps: set.touchedReps,
    touchedRpe: set.touchedRpe,
    completed: set.completed,
    skipped: set.skipped,
    type: set.type,
  };
}

function toTrainingHistorySets(sessions: WorkoutSession[]): TrainingHistorySet[] {
  return sessions.flatMap((session) =>
    session.sets.map((set) => ({
      id: set.id,
      workoutSessionId: session.id,
      exerciseId: set.exerciseId,
      exerciseName: set.exerciseName,
      actualWeight: set.actualWeight,
      weightUnit: set.weightUnit,
      actualReps: set.actualReps,
      actualRPE: set.actualRPE,
      actualRIR: set.actualRIR,
      prescribedReps: set.prescribedReps,
      prescribedRPE: set.prescribedRPE,
      prescribedRIR: set.prescribedRIR,
      prescribedPercentage: set.prescribedPercentage,
      prescribedWeight: set.prescribedWeight,
      e1rm: set.e1rm,
      completed: set.completed,
      performedAt: set.timestamp ?? session.endTime ?? session.startTime ?? session.date,
    }))
  );
}

function getLocalPersonalRecordInputs(exerciseId: string | null | undefined): TrainingPersonalRecord[] {
  if (!exerciseId) return [];
  const records = storage.getPersonalRecords(exerciseId);
  if (!records) return [];
  return [
    {
      exerciseId,
      recordType: 'max_weight',
      weight: records.maxWeight.weight,
      reps: records.maxWeight.reps,
    },
    {
      exerciseId,
      recordType: 'max_reps',
      weight: records.maxReps.weight,
      reps: records.maxReps.reps,
    },
    {
      exerciseId,
      recordType: 'max_e1rm',
      weight: records.maxE1RM.weight,
      reps: records.maxE1RM.reps,
      e1rm: records.maxE1RM.e1rm,
    },
    {
      exerciseId,
      recordType: 'max_volume',
      weight: records.maxVolume.weight,
      reps: records.maxVolume.reps,
      volume: records.maxVolume.volume,
    },
  ];
}

function locateSetForPatch(blocks: Block[], recommendation: TrainingRecommendation) {
  const patch = recommendation.apply;
  if (!patch?.setId) return null;
  if (patch.blockId && patch.exerciseId) {
    return findSetByActiveCell(blocks, {
      blockId: patch.blockId,
      exerciseId: patch.exerciseId,
      setId: patch.setId,
      field: 'weight',
    });
  }

  for (const block of blocks) {
    for (const exercise of block.exercises) {
      const set = exercise.sets.find((entry) => entry.id === patch.setId);
      if (set) return { block, exercise, set };
    }
  }

  return null;
}

function sortSupersetExercisesBySlot(exercises: Exercise[]): Exercise[] {
  return [...exercises].sort((a, b) => {
    const rankA = a.slot === 'A1' ? 0 : a.slot === 'A2' ? 1 : 9;
    const rankB = b.slot === 'A1' ? 0 : b.slot === 'A2' ? 1 : 9;
    return rankA - rankB;
  });
}

function shouldSkipRestForSupersetTransition(
  blocks: Block[],
  context: { blockId: string; exerciseId: string; setId: string }
): boolean {
  const block = blocks.find((entry) => entry.id === context.blockId);
  if (!block || block.type !== 'superset') return false;

  const exercises = sortSupersetExercisesBySlot(block.exercises);
  const currentExerciseIndex = exercises.findIndex((exercise) => exercise.id === context.exerciseId);
  if (currentExerciseIndex === -1) return false;

  const currentExercise = exercises[currentExerciseIndex];
  const currentRoundIndex = currentExercise.sets.findIndex((set) => set.id === context.setId);
  if (currentRoundIndex === -1) return false;

  for (let index = currentExerciseIndex + 1; index < exercises.length; index += 1) {
    const nextSet = exercises[index].sets[currentRoundIndex];
    if (nextSet && !nextSet.completed) {
      return true;
    }
  }

  return false;
}

type SessionLoggerProps = {
  initialData?: ProgramTemplate;
  initialProgress?: ProgramProgress | null;
  ignoreActiveSnapshot?: boolean;
};

function getSnapshotDefaultWeightUnit(snapshot: ActiveSessionSnapshot | null, fallback: WeightUnit): WeightUnit {
  const activeCell = snapshot?.activeCell;
  const activeSet =
    activeCell
      ? snapshot?.blocks
        .find((block) => block.id === activeCell.blockId)
        ?.exercises.find((exercise) => exercise.id === activeCell.exerciseId)
        ?.sets.find((set) => set.id === activeCell.setId)
      : null;

  if (activeSet?.weightUnit) return activeSet.weightUnit;

  for (const block of snapshot?.blocks ?? []) {
    for (const exercise of block.exercises) {
      const setWithUnit = exercise.sets.find((set) => set.weightUnit);
      if (setWithUnit?.weightUnit) return setWithUnit.weightUnit;
    }
  }

  return fallback;
}

export default function SessionLogger({ initialData, initialProgress, ignoreActiveSnapshot = false }: SessionLoggerProps) {
  const router = useRouter();
  const { user } = useAuth();
  const { weightUnit: preferredWeightUnit } = useUnitPreference();
  const { readiness, loading: readinessLoading } = useRecoveryState();
  const [customExercises, setCustomExercises] = useState<CustomExercise[]>([]);
  const [customExercisesLoading, setCustomExercisesLoading] = useState(true);
  const readinessModifier = readiness?.modifier ?? 1;
  const readinessScore = readiness?.score ?? 72;
  const readinessLabel = readiness?.source === 'manual'
    ? 'Session Readiness'
    : readiness?.source === 'training'
      ? 'Training Readiness'
      : 'Session Baseline';
  const readinessLoadModifiers = useMemo<ReadinessLoadModifiers>(() => ({
    overall: readinessModifier,
    upperBody: readiness?.focus_adjustments.upper_body_modifier ?? readinessModifier,
    lowerBody: readiness?.focus_adjustments.lower_body_modifier ?? readinessModifier,
  }), [
    readinessModifier,
    readiness?.focus_adjustments.upper_body_modifier,
    readiness?.focus_adjustments.lower_body_modifier,
  ]);
  const sessionReadinessModifierRef = useRef<ReadinessLoadModifiers | null>(null);
  if (sessionReadinessModifierRef.current == null && (!readinessLoading || readiness)) {
    sessionReadinessModifierRef.current = readinessLoadModifiers;
  }
  const sessionReadinessModifiers = sessionReadinessModifierRef.current ?? readinessLoadModifiers;
  const sessionReadinessModifier = sessionReadinessModifiers.overall;
  const namespaceId = user?.id ?? 'guest';
  const baseProgram = useMemo(() => initialData ?? createQuickStartProgram(), [initialData]);
  const programDayContext = useMemo<ProgramDayContext | null>(() => {
    if (!initialData || initialData.weeks.length === 0) return null;
    const progress = initialProgress ?? getProgramProgress(initialData, namespaceId);
    const day = resolveProgramDay(initialData, progress);
    if (!day.day) return null;
    return {
      cycleNumber: day.cycleNumber,
      weekIndex: day.weekIndex,
      dayIndex: day.dayIndex,
      weekNumber: day.weekNumber,
      day: day.day,
    };
  }, [initialData, initialProgress, namespaceId]);
  const sessionProgram = useMemo(() => {
    if (!initialData || !programDayContext) return baseProgram;
    return createProgramSliceForDay(initialData, programDayContext);
  }, [baseProgram, initialData, programDayContext]);

  useEffect(() => {
    let active = true;

    const loadCustom = async () => {
      try {
        const loaded = await getCustomExercises(user?.id ?? null);
        if (!active) return;
        setCustomExercises(loaded);
      } catch {
        if (active) {
          setCustomExercises([]);
        }
      } finally {
        if (active) setCustomExercisesLoading(false);
      }
    };

    void loadCustom();

    return () => {
      active = false;
    };
  }, [user?.id]);

  const exerciseCatalog = useMemo(
    () => buildExerciseCatalog(defaultExercises, customExercises),
    [customExercises]
  );
  const resolveExerciseNameLatest = useCallback(
    (exerciseId: string) => resolveExerciseDisplayName(exerciseId, { catalog: exerciseCatalog }),
    [exerciseCatalog]
  );
  // Stable reference that always delegates to the latest catalog.
  // Prevents callback identity changes from triggering session reinitialize.
  const resolveExerciseNameRef = useRef(resolveExerciseNameLatest);
  useEffect(() => { resolveExerciseNameRef.current = resolveExerciseNameLatest; }, [resolveExerciseNameLatest]);
  const resolveExerciseName = useCallback(
    (exerciseId: string) => resolveExerciseNameRef.current(exerciseId),
    []
  );
  const getExerciseDisplayName = useCallback(
    (exercise: ExerciseIdentity) =>
      resolveExerciseDisplayName(exercise.id, {
        catalog: exerciseCatalog,
        cachedName: exercise.name,
      }),
    [exerciseCatalog]
  );
  const resolveMuscleProfile = useCallback<ResolveMuscleProfile>(
    (exercise) => resolveExerciseMuscleProfile(exercise, { catalog: exerciseCatalog }),
    [exerciseCatalog]
  );
  // ── Active session provider (persistent background session) ──
  // Must be initialized before useWorkoutSession so we can inject the saved state
  const { snapshot, isReady: activeSessionReady, saveSnapshot, clearSession } = useActiveSession();
  const resumeSnapshot = ignoreActiveSnapshot ? null : snapshot;
  const [sessionWeightUnit, setSessionWeightUnit] = useState<WeightUnit>(() =>
    getSnapshotDefaultWeightUnit(resumeSnapshot, preferredWeightUnit)
  );

  const {
    state: session,
    dispatch,
    toggleComplete,
    skipSet,
    addSet,
    addExercise,
    removeExercise,
    setActiveCell,
    reinitializeSession,
  } = useWorkoutSession(sessionProgram, sessionReadinessModifier, sessionWeightUnit, {
    resolveExerciseName,
    initialState: resumeSnapshot ? {
      ...resumeSnapshot,
      startTime: new Date(resumeSnapshot.startTime)
    } : undefined,
    readinessLoadModifiers: sessionReadinessModifiers,
  });
  const hydratedSnapshotKeyRef = useRef<string | null>(
    resumeSnapshot ? `${resumeSnapshot.startTime}:${resumeSnapshot.meta.programId}` : null
  );

  // ── Elapsed timer ──
  const [elapsedDisplay, setElapsedDisplay] = useState('0:00');
  useEffect(() => {
    const tick = () => {
      const elapsed = Math.max(0, Math.floor((Date.now() - session.startTime.getTime()) / 1000));
      const hours = Math.floor(elapsed / 3600);
      const minutes = Math.floor((elapsed % 3600) / 60);
      const seconds = elapsed % 60;
      const pad = (n: number) => String(n).padStart(2, '0');
      setElapsedDisplay(hours > 0 ? `${hours}:${pad(minutes)}:${pad(seconds)}` : `${minutes}:${pad(seconds)}`);
    };
    tick();
    const interval = setInterval(tick, 1000);
    return () => clearInterval(interval);
  }, [session.startTime]);

  // ── Sync session to provider so it persists across navigation ──
  useEffect(() => {
    if (!activeSessionReady) return;
    if (session.status === 'finished') return;
    const snap: ActiveSessionSnapshot = {
      status: session.status,
      startTime: session.startTime.toISOString(),
      blocks: session.blocks,
      activeCell: session.activeCell,
      meta: {
        programId: baseProgram.id,
        programName: baseProgram.name ?? 'Quick Start',
        weightUnit: sessionWeightUnit,
        weekNumber: programDayContext?.weekNumber,
        dayName: programDayContext?.day?.name,
        cycleNumber: programDayContext?.cycleNumber,
        weekIndex: programDayContext?.weekIndex,
        dayIndex: programDayContext?.dayIndex,
      },
    };
    saveSnapshot(snap);
  }, [
    activeSessionReady,
    baseProgram.id,
    baseProgram.name,
    programDayContext?.cycleNumber,
    programDayContext?.day?.name,
    programDayContext?.dayIndex,
    programDayContext?.weekIndex,
    programDayContext?.weekNumber,
    saveSnapshot,
    session.activeCell,
    session.blocks,
    session.startTime,
    session.status,
    sessionWeightUnit,
  ]);

  const hasCompletedSets = useMemo(
    () => session.blocks.some((block) => block.exercises.some((exercise) => exercise.sets.some((set) => set.completed))),
    [session.blocks]
  );
  const hasTouchedSets = useMemo(
    () =>
      session.blocks.some((block) =>
        block.exercises.some((exercise) =>
          exercise.sets.some((set) => set.touchedWeight || set.touchedReps || set.touchedRpe)
        )
      ),
    [session.blocks]
  );
  const prevWeightUnitRef = useRef<WeightUnit>(sessionWeightUnit);
  const prevSessionProgramRef = useRef(sessionProgram);
  const readinessModifierKey = `${sessionReadinessModifiers.overall}:${sessionReadinessModifiers.upperBody}:${sessionReadinessModifiers.lowerBody}`;
  const prevReadinessModifierKeyRef = useRef(readinessModifierKey);

  useEffect(() => {
    if (!resumeSnapshot || resumeSnapshot.status !== 'active') return;
    const snapshotKey = `${resumeSnapshot.startTime}:${resumeSnapshot.meta.programId}`;
    if (hydratedSnapshotKeyRef.current === snapshotKey) return;
    if (hasCompletedSets || hasTouchedSets) return;

    hydratedSnapshotKeyRef.current = snapshotKey;
    setSessionWeightUnit(getSnapshotDefaultWeightUnit(resumeSnapshot, sessionWeightUnit));
    dispatch({
      type: 'HYDRATE_SESSION',
      payload: {
        ...resumeSnapshot,
        startTime: new Date(resumeSnapshot.startTime),
      },
    });
  }, [dispatch, hasCompletedSets, hasTouchedSets, resumeSnapshot, sessionWeightUnit]);


  useEffect(() => {
    if (prevSessionProgramRef.current === sessionProgram) return;
    prevSessionProgramRef.current = sessionProgram;

    // If we have progress in the current session, don't reset.
    if (hasCompletedSets || hasTouchedSets) return;

    // If we are resuming an active session from a snapshot, don't reset
    // just because the program reference changed (which happens on mount).
    if (resumeSnapshot && session.status === 'active' && resumeSnapshot.status === 'active') {
      // Only reset if the program ID itself has changed fundamentally
      if (resumeSnapshot.meta?.programId === baseProgram.id) {
        return;
      }
    }

    reinitializeSession();
	  }, [hasCompletedSets, hasTouchedSets, reinitializeSession, sessionProgram, resumeSnapshot, session.status, baseProgram.id]);

  useEffect(() => {
    if (readinessLoading) return;
    if (prevReadinessModifierKeyRef.current === readinessModifierKey) return;
    prevReadinessModifierKeyRef.current = readinessModifierKey;
    if (resumeSnapshot || hasCompletedSets || hasTouchedSets) return;
    reinitializeSession();
  }, [
    hasCompletedSets,
    hasTouchedSets,
    readinessLoading,
    readinessModifierKey,
    reinitializeSession,
    resumeSnapshot,
  ]);

  useEffect(() => {
    if (hasCompletedSets || hasTouchedSets) return;
    if (preferredWeightUnit !== sessionWeightUnit) {
      setSessionWeightUnit(preferredWeightUnit);
    }
  }, [hasCompletedSets, hasTouchedSets, preferredWeightUnit, sessionWeightUnit]);

  useEffect(() => {
    if (prevWeightUnitRef.current === sessionWeightUnit) return;
    prevWeightUnitRef.current = sessionWeightUnit;
    if (hasCompletedSets || hasTouchedSets) return;
    reinitializeSession();
  }, [hasCompletedSets, hasTouchedSets, reinitializeSession, sessionWeightUnit]);

  // NOTE: The resolveExerciseName effect was removed. The callback is now
  // stabilized via useRef so its identity never changes, preventing
  // accidental session reinitializations when custom exercises load async.

  const [viewMode, setViewMode] = useState<ViewMode>('overview');
  const [focusedExerciseId, setFocusedExerciseId] = useState<string | null>(null);
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
  const [isNotesOpen, setIsNotesOpen] = useState(false);
  const [infoPanel, setInfoPanel] = useState<InfoPanel>(null);
  const [activeInput, setActiveInput] = useState<{
    blockId: string;
    setId: string;
    field: 'weight' | 'reps';
  } | null>(null);
  const [isSummaryOpen, setIsSummaryOpen] = useState(false);
  const [isFinishingWorkout, setIsFinishingWorkout] = useState(false);
  const [finishStatusMessage, setFinishStatusMessage] = useState<string | null>(null);
  const [shareStatusMessage, setShareStatusMessage] = useState<string | null>(null);
  const [isAddMovementOpen, setIsAddMovementOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [notesDraft, setNotesDraft] = useState('');
  const [, setKeypadValue] = useState('');
  const [keypadArmed, setKeypadArmed] = useState(false);
  const [revealedId, setRevealedId] = useState<string | null>(null);
  const [pendingExerciseName, setPendingExerciseName] = useState<string | null>(null);
  const [pendingAddName, setPendingAddName] = useState<string | null>(null);
  const [pendingAddExerciseId, setPendingAddExerciseId] = useState<string | null>(null);
  const [pendingSetCount, setPendingSetCount] = useState(3);
  const [cloudPrBaseline, setCloudPrBaseline] = useState<Record<string, PrBaseline>>({});
  const [isPrBaselineSyncing, setIsPrBaselineSyncing] = useState(false);
  const [clusterProgressBySetId, setClusterProgressBySetId] = useState<Record<string, number>>({});
  const [tempoMetronomeEnabled, setTempoMetronomeEnabled] = useState(false);
  const [justLogged, setJustLogged] = useState(false);
  const [remoteSmartRecommendations, setRemoteSmartRecommendations] = useState<Record<string, TrainingRecommendation[]>>({});
  const [restBoostBySetId, setRestBoostBySetId] = useState<Record<string, number>>({});
  const [restContext, setRestContext] = useState<{
    blockId: string;
    exerciseId: string;
    setId: string;
    wasLastSet: boolean;
    wasEditing: boolean;
    supersetRoundRest?: boolean;
    clusterTransition?: boolean;
    clusterRestSeconds?: number;
    nextClusterRound?: number;
    clusterTotalRounds?: number;
  } | null>(null);
  const overviewScrollRef = useRef<HTMLDivElement>(null);
  const cockpitScrollRef = useRef<HTMLDivElement>(null);
  const overviewScrollPositionRef = useRef<number>(0);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const viewHistoryRef = useRef<ViewMode[]>(['overview']);
  const isBackNavRef = useRef(false);
  const saveInFlightRef = useRef(false);
  const audioContextRef = useRef<AudioContext | null>(null);

  const isAnyModalOpen = isHistoryOpen || isNotesOpen || isAddMovementOpen || isSummaryOpen || infoPanel !== null;
  useBodyScrollLock(isAnyModalOpen);

  const calculateSessionStats = useCallback((blocks: Block[]) => {
    let totalVolume = 0;
    let totalSets = 0;
    let totalReps = 0;
    let maxWeight = 0;
    let maxLoadedWeight = 0;
    const pulseMap: {
      volume: number;
      weight: number;
      rpe: number | null;
      reps: number;
      primary: MuscleGroup;
      secondary?: MuscleGroup;
    }[] = [];

    blocks.forEach((block) => {
      block.exercises.forEach((exercise) => {
        exercise.sets.forEach((set) => {
          if (!set.completed) return;
          const weight = Number(set.weight) || 0;
          const displayWeight = weight > 0
            ? convertWeight(weight, set.weightUnit ?? sessionWeightUnit, sessionWeightUnit)
            : 0;
          if (displayWeight > maxLoadedWeight) {
            maxLoadedWeight = displayWeight;
          }
        });
      });
    });

    const bodyweightBaseline = Math.max(65, maxLoadedWeight * 0.6);

    blocks.forEach((block) => {
      block.exercises.forEach((exercise) => {
        const { primary, secondary } = resolveMuscleProfile(exercise);
        const resolvedExerciseName = resolveExerciseDisplayName(exercise.id, {
          catalog: exerciseCatalog,
          cachedName: exercise.name,
        });
        const bodyweightExercise = isBodyweight(resolvedExerciseName);
        exercise.sets.forEach((set) => {
          if (!set.completed) return;
          const weight = Number(set.weight) || 0;
          const reps = set.reps === null || set.reps === undefined ? 8 : Number(set.reps);
          const displayWeight = weight > 0
            ? convertWeight(weight, set.weightUnit ?? sessionWeightUnit, sessionWeightUnit)
            : 0;
          const effectiveWeight = displayWeight > 0 ? displayWeight : bodyweightExercise ? bodyweightBaseline : 0;
          const volume = effectiveWeight * reps;
          totalVolume += volume;
          totalSets += 1;
          totalReps += reps;
          maxWeight = Math.max(maxWeight, effectiveWeight);
          pulseMap.push({
            volume,
            weight: effectiveWeight,
            rpe: set.rpe ?? null,
            reps,
            primary,
            secondary,
          });
        });
      });
    });

    return {
      totalVolume,
      totalSets,
      totalReps,
      pulseMap,
      maxWeight: Math.max(1, maxWeight),
    };
  }, [exerciseCatalog, resolveMuscleProfile, sessionWeightUnit]);

  const sessionStats = useMemo(
    () => calculateSessionStats(session.blocks),
    [calculateSessionStats, session.blocks]
  );
  const maxSessionVolume = useMemo(
    () => Math.max(1, ...sessionStats.pulseMap.map((entry) => entry.volume)),
    [sessionStats.pulseMap]
  );
  useEffect(() => {
    let active = true;
    const emptyBaseline: Record<string, PrBaseline> = {};

    const loadCloudPrBaseline = async () => {
      if (!isSummaryOpen || !user?.id) {
        if (active) {
          setCloudPrBaseline(emptyBaseline);
          setIsPrBaselineSyncing(false);
        }
        return;
      }

      const exerciseRefs = Array.from(
        new Set(
          session.blocks.flatMap((block) => block.exercises.map((exercise) => exercise.id).filter(Boolean))
        )
      );

      if (exerciseRefs.length === 0) {
        if (active) {
          setCloudPrBaseline(emptyBaseline);
          setIsPrBaselineSyncing(false);
        }
        return;
      }

      setIsPrBaselineSyncing(true);
      try {
        const resolvedIds = await resolveExerciseIds(supabase, exerciseRefs);
        const lookupByResolvedId = new Map<string, PrBaseline>();

        const exerciseUuidIds = Array.from(
          new Set(
            exerciseRefs
              .map((ref) => resolvedIds.get(ref) ?? (isValidUuid(ref) ? ref : null))
              .filter((value): value is string => Boolean(value))
          )
        );

        if (exerciseUuidIds.length === 0) {
          if (active) {
            setCloudPrBaseline(emptyBaseline);
          }
          return;
        }

        const { data, error } = await supabase
          .from('personal_records')
          .select('exercise_id, record_type, weight, reps, e1rm, volume')
          .eq('user_id', user.id)
          .eq('is_current', true)
          .in('exercise_id', exerciseUuidIds)
          .in('record_type', ['max_weight', 'max_reps', 'max_e1rm', 'max_volume']);

        if (error) {
          
          if (active) {
            setCloudPrBaseline(emptyBaseline);
          }
          return;
        }

        for (const row of data ?? []) {
          const exerciseId = row.exercise_id ?? '';
          if (!exerciseId) continue;
          const baseline = lookupByResolvedId.get(exerciseId) ?? {
            maxWeight: 0,
            maxReps: 0,
            maxE1RM: 0,
            maxVolume: 0,
          };
          const recordType = row.record_type;
          if (recordType === 'max_weight') baseline.maxWeight = Math.max(baseline.maxWeight, Number(row.weight) || 0);
          if (recordType === 'max_reps') baseline.maxReps = Math.max(baseline.maxReps, Number(row.reps) || 0);
          if (recordType === 'max_e1rm') baseline.maxE1RM = Math.max(baseline.maxE1RM, Number(row.e1rm) || 0);
          if (recordType === 'max_volume') baseline.maxVolume = Math.max(baseline.maxVolume, Number(row.volume) || 0);
          lookupByResolvedId.set(exerciseId, baseline);
        }

        const byExerciseRef: Record<string, PrBaseline> = {};
        exerciseRefs.forEach((ref) => {
          const resolved = resolvedIds.get(ref) ?? (isValidUuid(ref) ? ref : null);
          if (!resolved) return;
          const baseline = lookupByResolvedId.get(resolved);
          if (!baseline) return;
          byExerciseRef[ref] = baseline;
        });

        if (active) {
          setCloudPrBaseline(byExerciseRef);
        }
      } catch {
        if (active) {
          setCloudPrBaseline(emptyBaseline);
        }
      } finally {
        if (active) {
          setIsPrBaselineSyncing(false);
        }
      }
    };

    void loadCloudPrBaseline();

    return () => {
      active = false;
    };
  }, [isSummaryOpen, session.blocks, user?.id]);

  const projectedPrHits = useMemo<ProjectedPrHit[]>(() => {
    if (!isSummaryOpen || typeof window === 'undefined') {
      return [];
    }

    const baselineByExercise = new Map<
      string,
      { maxWeight: number; maxReps: number; maxE1RM: number; maxVolume: number }
    >();

    const history = storage.getWorkoutHistory();
    history.forEach((historySession) => {
      historySession.sets.forEach((set) => {
        if (!set.completed) return;
        const exerciseId = set.exerciseId;
        if (!exerciseId) return;
        const reps = Number(set.actualReps) || 0;
        const weightRaw = Number(set.actualWeight) || 0;
        const weight = weightRaw > 0 ? convertWeight(weightRaw, set.weightUnit ?? 'lbs', 'lbs') : 0;
        const e1rmRaw = Number(set.e1rm) || 0;
        const e1rm = e1rmRaw > 0 ? convertWeight(e1rmRaw, set.weightUnit ?? 'lbs', 'lbs') : 0;
        const volume = weight > 0 && reps > 0 ? weight * reps : 0;

        const baseline = baselineByExercise.get(exerciseId) ?? {
          maxWeight: 0,
          maxReps: 0,
          maxE1RM: 0,
          maxVolume: 0,
        };

        baseline.maxWeight = Math.max(baseline.maxWeight, weight);
        baseline.maxReps = Math.max(baseline.maxReps, reps);
        baseline.maxE1RM = Math.max(baseline.maxE1RM, e1rm);
        baseline.maxVolume = Math.max(baseline.maxVolume, volume);
        baselineByExercise.set(exerciseId, baseline);
      });
    });

    Object.entries(cloudPrBaseline).forEach(([exerciseId, cloud]) => {
      const baseline = baselineByExercise.get(exerciseId) ?? {
        maxWeight: 0,
        maxReps: 0,
        maxE1RM: 0,
        maxVolume: 0,
      };
      baseline.maxWeight = Math.max(baseline.maxWeight, cloud.maxWeight);
      baseline.maxReps = Math.max(baseline.maxReps, cloud.maxReps);
      baseline.maxE1RM = Math.max(baseline.maxE1RM, cloud.maxE1RM);
      baseline.maxVolume = Math.max(baseline.maxVolume, cloud.maxVolume);
      baselineByExercise.set(exerciseId, baseline);
    });

    const currentByExercise = new Map<
      string,
      {
        exerciseName: string;
        maxWeight: number;
        maxReps: number;
        maxE1RM: number;
        maxVolume: number;
      }
    >();

    session.blocks.forEach((block) => {
      block.exercises.forEach((exercise) => {
        exercise.sets.forEach((set) => {
          if (!set.completed) return;
          const reps = set.reps == null ? 8 : Number(set.reps);
          if (!Number.isFinite(reps) || reps <= 0) return;
          const weight = Number(set.weight) || 0;
          const setWeightUnit = set.weightUnit ?? sessionWeightUnit;
          const weightLbs = weight > 0 ? convertWeight(weight, setWeightUnit, 'lbs') : 0;
          const e1rmRaw =
            weight > 0 ? Number(rpeAdjusted1RM(weight, reps, set.rpe ?? null) || 0) : 0;
          const e1rmLbs = e1rmRaw > 0 ? convertWeight(e1rmRaw, setWeightUnit, 'lbs') : 0;
          const volume = weightLbs > 0 ? weightLbs * reps : 0;

          const current = currentByExercise.get(exercise.id) ?? {
            exerciseName: resolveExerciseDisplayName(exercise.id, {
              catalog: exerciseCatalog,
              cachedName: exercise.name,
            }),
            maxWeight: 0,
            maxReps: 0,
            maxE1RM: 0,
            maxVolume: 0,
          };

          current.maxWeight = Math.max(current.maxWeight, weightLbs);
          current.maxReps = Math.max(current.maxReps, reps);
          current.maxE1RM = Math.max(current.maxE1RM, e1rmLbs);
          current.maxVolume = Math.max(current.maxVolume, volume);
          currentByExercise.set(exercise.id, current);
        });
      });
    });

    const hits: ProjectedPrHit[] = [];
    currentByExercise.forEach((current, exerciseId) => {
      const baseline = baselineByExercise.get(exerciseId) ?? {
        maxWeight: 0,
        maxReps: 0,
        maxE1RM: 0,
        maxVolume: 0,
      };

      if (current.maxWeight > 0 && current.maxWeight > baseline.maxWeight) {
        hits.push({
          exerciseId,
          exerciseName: current.exerciseName,
          metric: 'max_weight',
          current: current.maxWeight,
          previous: baseline.maxWeight,
        });
      }
      if (current.maxReps > 0 && current.maxReps > baseline.maxReps) {
        hits.push({
          exerciseId,
          exerciseName: current.exerciseName,
          metric: 'max_reps',
          current: current.maxReps,
          previous: baseline.maxReps,
        });
      }
      if (current.maxE1RM > 0 && current.maxE1RM > baseline.maxE1RM) {
        hits.push({
          exerciseId,
          exerciseName: current.exerciseName,
          metric: 'max_e1rm',
          current: current.maxE1RM,
          previous: baseline.maxE1RM,
        });
      }
      if (current.maxVolume > 0 && current.maxVolume > baseline.maxVolume) {
        hits.push({
          exerciseId,
          exerciseName: current.exerciseName,
          metric: 'max_volume',
          current: current.maxVolume,
          previous: baseline.maxVolume,
        });
      }
    });

    return hits
      .sort((a, b) => (b.current - b.previous) - (a.current - a.previous))
      .slice(0, 8);
  }, [cloudPrBaseline, exerciseCatalog, isSummaryOpen, session.blocks, sessionWeightUnit]);
  const legendItems = useMemo(() => {
    const activeGroups = new Set<MuscleGroup>();
    const groupCounts = new Map<MuscleGroup, number>();
    sessionStats.pulseMap.forEach((entry) => {
      activeGroups.add(entry.primary);
      groupCounts.set(entry.primary, (groupCounts.get(entry.primary) ?? 0) + 1);
      if (entry.secondary) {
        activeGroups.add(entry.secondary);
        groupCounts.set(entry.secondary, (groupCounts.get(entry.secondary) ?? 0) + 1);
      }
    });
    if (activeGroups.size === 0) return [];
    const orderMap = new Map(LEGEND_ITEMS.map((item, index) => [item.key, index]));
    return LEGEND_ITEMS.filter((item) => activeGroups.has(item.key)).sort((a, b) => {
      const countDelta = (groupCounts.get(b.key) ?? 0) - (groupCounts.get(a.key) ?? 0);
      if (countDelta !== 0) return countDelta;
      return (orderMap.get(a.key) ?? 0) - (orderMap.get(b.key) ?? 0);
    });
  }, [sessionStats.pulseMap]);
  const pulseBars = useMemo(() => {
    return sessionStats.pulseMap.map((entry, index) => {
      const heightPercent = Math.max(8, (entry.volume / maxSessionVolume) * 100);
      const opacity = 0.35 + (entry.weight / sessionStats.maxWeight) * 0.65;
      const heatIntensity =
        entry.rpe == null ? 0 : Math.min(1, Math.max(0, (entry.rpe - 6) / 4));
      const echoOffsets = index % 2 === 0 ? [-8, -4, 4] : [8, 4, -4];
      const primaryKey = MUSCLE_COLORS[entry.primary] ? entry.primary : 'other';
      const secondaryKey =
        entry.secondary && MUSCLE_COLORS[entry.secondary] ? entry.secondary : primaryKey;
      const primaryPalette = MUSCLE_COLORS[primaryKey];
      const secondaryPalette = MUSCLE_COLORS[secondaryKey];
      const isCompound = secondaryKey !== primaryKey;
      const gradient = isCompound
        ? `linear-gradient(145deg, ${primaryPalette.color} 0%, ${secondaryPalette.color} 100%)`
        : `linear-gradient(180deg, ${primaryPalette.color} 0%, ${primaryPalette.color} 100%)`;
      const maxRungs = 18;
      const rawReps = Math.max(1, Math.round(entry.reps));
      const rungCount = Math.min(maxRungs, rawReps);
      const overflow = Math.max(0, rawReps - maxRungs);
      const rungSize = 100 / rungCount;
      const maskPattern =
        'linear-gradient(to bottom, transparent 0, transparent 50%, #000 50%, #000 100%)';
      const glowStrength = (12 + opacity * 14) * (isCompound ? 1.15 : 1);
      const glowStyle = `0 0 ${glowStrength}px ${primaryPalette.glow}`;
      const echoGlow = `0 0 ${Math.max(6, glowStrength - 6)}px ${primaryPalette.glow}`;

      return {
        key: `${index}-${entry.volume}-${entry.weight}`,
        heightPercent,
        opacity,
        gradient,
        glow: primaryPalette.glow,
        glowStyle,
        echoGlow,
        heatIntensity,
        echoOffsets,
        maskPattern,
        maskSize: `100% ${rungSize}%`,
        overflow,
      };
    });
  }, [sessionStats.pulseMap, maxSessionVolume, sessionStats.maxWeight]);


  const exerciseRefs = useMemo<ExerciseRef[]>(() => {
    return session.blocks.flatMap((block) =>
      block.exercises.map((exercise) => ({
        blockId: block.id,
        blockType: block.type,
        exercise,
      }))
    );
  }, [session.blocks]);

  const focusedRef = useMemo(() => {
    if (!focusedExerciseId) return null;
    return exerciseRefs.find((entry) => entry.exercise.id === focusedExerciseId) ?? null;
  }, [exerciseRefs, focusedExerciseId]);

  const focusedSet = useMemo(() => {
    if (!focusedRef) return null;
    return getFocusSet(focusedRef.exercise, session.activeCell, focusedRef.blockId);
  }, [focusedRef, session.activeCell]);

  const focusContext = useMemo(() => {
    if (!focusedRef || !focusedSet) return null;
    return {
      blockId: focusedRef.blockId,
      exerciseId: focusedRef.exercise.id,
      setId: focusedSet.id,
      set: focusedSet,
      exercise: focusedRef.exercise,
    };
  }, [focusedRef, focusedSet]);

  const nextSetContext = useMemo(() => findSetByActiveCell(session.blocks, session.activeCell), [session.blocks, session.activeCell]);
  const localHistorySets = useMemo<TrainingHistorySet[]>(() => {
    void namespaceId;
    if (typeof window === 'undefined') return [];
    return toTrainingHistorySets(storage.getWorkoutHistory().slice(0, 30));
  }, [namespaceId]);
  const sessionTrainingSets = useMemo<TrainingSetInput[]>(() => {
    return session.blocks.flatMap((block) =>
      block.exercises.flatMap((exercise) => {
        const exerciseName = getExerciseDisplayName(exercise);
        return exercise.sets.map((set, index) => toTrainingSetInput(block.id, exercise, set, index, exerciseName));
      })
    );
  }, [getExerciseDisplayName, session.blocks]);
  const focusTrainingSet = useMemo<TrainingSetInput | null>(() => {
    if (!focusContext) return null;
    const setIndex = focusContext.exercise.sets.findIndex((set) => set.id === focusContext.setId);
    return toTrainingSetInput(
      focusContext.blockId,
      focusContext.exercise,
      focusContext.set,
      Math.max(0, setIndex),
      getExerciseDisplayName(focusContext.exercise)
    );
  }, [focusContext, getExerciseDisplayName]);
  const nextTrainingSet = useMemo<TrainingSetInput | null>(() => {
    if (!nextSetContext) return null;
    const setIndex = nextSetContext.exercise.sets.findIndex((set) => set.id === nextSetContext.set.id);
    return toTrainingSetInput(
      nextSetContext.block.id,
      nextSetContext.exercise,
      nextSetContext.set,
      Math.max(0, setIndex),
      getExerciseDisplayName(nextSetContext.exercise)
    );
  }, [getExerciseDisplayName, nextSetContext]);
  const readinessTrainingInput = useMemo(() => ({
    score: readiness?.score ?? null,
    modifier: readiness?.modifier ?? null,
    source: readiness?.source ?? null,
    focusAdjustments: {
      overallModifier: sessionReadinessModifiers.overall,
      upperBodyModifier: sessionReadinessModifiers.upperBody,
      lowerBodyModifier: sessionReadinessModifiers.lowerBody,
    },
  }), [
    readiness?.modifier,
    readiness?.score,
    readiness?.source,
    sessionReadinessModifiers.lowerBody,
    sessionReadinessModifiers.overall,
    sessionReadinessModifiers.upperBody,
  ]);
  const buildSmartInput = useCallback((
    setInput: TrainingSetInput | null,
    exercise: Exercise | null | undefined
  ): TrainingRecommendationInput => {
    const profile = exercise ? resolveMuscleProfile(exercise) : null;
    return {
      currentSet: setInput,
      sessionSets: sessionTrainingSets,
      historySets: localHistorySets,
      personalRecords: getLocalPersonalRecordInputs(setInput?.exerciseId),
      readiness: readinessTrainingInput,
      exerciseMuscleProfile: profile
        ? {
          primary: profile.primary,
          secondary: profile.secondary,
          groups: [profile.primary, profile.secondary].filter(Boolean) as string[],
        }
        : null,
      weightUnit: sessionWeightUnit,
    };
  }, [
    localHistorySets,
    readinessTrainingInput,
    resolveMuscleProfile,
    sessionTrainingSets,
    sessionWeightUnit,
  ]);
  const localFocusRecommendations = useMemo(() => {
    if (!focusTrainingSet) return [];
    return buildTrainingRecommendations(buildSmartInput(focusTrainingSet, focusContext?.exercise));
  }, [buildSmartInput, focusContext?.exercise, focusTrainingSet]);
  const activeSmartRecommendations = useMemo(() => {
    if (!focusTrainingSet?.setId) return localFocusRecommendations;
    return remoteSmartRecommendations[focusTrainingSet.setId] ?? localFocusRecommendations;
  }, [focusTrainingSet?.setId, localFocusRecommendations, remoteSmartRecommendations]);
  const smartTargetRecommendation = useMemo(
    () => activeSmartRecommendations.find((recommendation) => recommendation.scope === 'next_set') ?? null,
    [activeSmartRecommendations]
  );
  const nextSmartRecommendation = useMemo(() => {
    if (!nextTrainingSet || restContext?.clusterTransition) return null;
    return buildTrainingRecommendations(buildSmartInput(nextTrainingSet, nextSetContext?.exercise))
      .find((recommendation) => recommendation.scope === 'next_set') ?? null;
  }, [buildSmartInput, nextSetContext?.exercise, nextTrainingSet, restContext?.clusterTransition]);
  const summarySmartRecommendations = useMemo(() => {
    if (!isSummaryOpen) return [];
    return buildTrainingRecommendations({
      sessionSets: sessionTrainingSets,
      historySets: localHistorySets,
      readiness: readinessTrainingInput,
      weightUnit: sessionWeightUnit,
    }).filter((recommendation) => recommendation.scope === 'session').slice(0, 2);
  }, [isSummaryOpen, localHistorySets, readinessTrainingInput, sessionTrainingSets, sessionWeightUnit]);
  const smartRequestKey = useMemo(() => {
    if (!focusTrainingSet?.setId) return null;
    const completedKey = sessionTrainingSets
      .filter((set) => set.completed)
      .map((set) => `${set.setId}:${set.weight}:${set.reps}:${set.rpe}`)
      .join(',');
    return [
      focusTrainingSet.setId,
      focusTrainingSet.weight,
      focusTrainingSet.reps,
      focusTrainingSet.rpe,
      focusTrainingSet.touchedWeight ? 'tw' : 'gw',
      focusTrainingSet.touchedReps ? 'tr' : 'gr',
      focusTrainingSet.touchedRpe ? 'te' : 'ge',
      readinessTrainingInput.score,
      readinessTrainingInput.modifier,
      completedKey,
    ].join('|');
  }, [
    focusTrainingSet?.reps,
    focusTrainingSet?.rpe,
    focusTrainingSet?.setId,
    focusTrainingSet?.touchedReps,
    focusTrainingSet?.touchedRpe,
    focusTrainingSet?.touchedWeight,
    focusTrainingSet?.weight,
    readinessTrainingInput.modifier,
    readinessTrainingInput.score,
    sessionTrainingSets,
  ]);

  useEffect(() => {
    if (!user?.id || !focusTrainingSet?.setId || !smartRequestKey) return;
    if (viewMode !== 'cockpit') return;
    let active = true;
    const setId = focusTrainingSet.setId;
    const requestInput = buildSmartInput(focusTrainingSet, focusContext?.exercise);

    void fetchJsonWithAuth<{ recommendations: TrainingRecommendation[] }>('/api/training/recommendations', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(requestInput),
    })
      .then((payload) => {
        if (!active) return;
        setRemoteSmartRecommendations((current) => ({
          ...current,
          [setId]: payload.recommendations,
        }));
      })
      .catch(() => {
        if (!active) return;
        setRemoteSmartRecommendations((current) => {
          if (!(setId in current)) return current;
          const next = { ...current };
          delete next[setId];
          return next;
        });
      });

    return () => {
      active = false;
    };
  }, [
    buildSmartInput,
    focusContext?.exercise,
    focusTrainingSet,
    smartRequestKey,
    user?.id,
    viewMode,
  ]);

  useEffect(() => {
    setActiveInput(null);
    setKeypadValue('');
    setKeypadArmed(false);
  }, [viewMode]);

  useEffect(() => {
    if (viewMode !== 'cockpit') return;
    requestAnimationFrame(() => {
      cockpitScrollRef.current?.scrollTo({ top: 0 });
      window.scrollTo({ top: 0 });
    });
  }, [focusedExerciseId, viewMode]);

  useEffect(() => {
    if (!isAddMovementOpen) return;
    const focusTimer = setTimeout(() => {
      searchInputRef.current?.focus();
    }, 50);
    return () => clearTimeout(focusTimer);
  }, [isAddMovementOpen]);

  useEffect(() => {
    if (!focusedRef || viewMode !== 'cockpit') return;

    const hasIncomplete = focusedRef.exercise.sets.some((set) => !set.completed);
    if (hasIncomplete) return;

    if (session.activeCell?.exerciseId && session.activeCell.exerciseId !== focusedRef.exercise.id) {
      setFocusedExerciseId(session.activeCell.exerciseId);
    }
  }, [focusedRef, session.activeCell, viewMode]);

  useEffect(() => {
    if (!focusContext) return;
    setNotesDraft(focusContext.set.notes ?? '');
  }, [focusContext]);

  useEffect(() => {
    if (viewMode !== 'cockpit' || !focusContext?.set.tempo) {
      setTempoMetronomeEnabled(false);
    }
  }, [focusContext?.set.id, focusContext?.set.tempo, viewMode]);

  useEffect(() => {
    if (!tempoMetronomeEnabled || viewMode !== 'cockpit' || !focusContext?.set.tempo) return;

    const audioCtor =
      window.AudioContext ||
      (window as Window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!audioCtor) return;

    if (!audioContextRef.current) {
      audioContextRef.current = new audioCtor();
    }

    const audioCtx = audioContextRef.current;
    if (audioCtx.state === 'suspended') {
      void audioCtx.resume();
    }

    const tick = () => {
      const now = audioCtx.currentTime;
      const oscillator = audioCtx.createOscillator();
      const gainNode = audioCtx.createGain();

      oscillator.type = 'triangle';
      oscillator.frequency.setValueAtTime(880, now);
      gainNode.gain.setValueAtTime(0.0001, now);
      gainNode.gain.exponentialRampToValueAtTime(0.08, now + 0.01);
      gainNode.gain.exponentialRampToValueAtTime(0.0001, now + 0.08);

      oscillator.connect(gainNode);
      gainNode.connect(audioCtx.destination);
      oscillator.start(now);
      oscillator.stop(now + 0.09);
    };

    tick();
    const intervalId = window.setInterval(tick, METRONOME_BEAT_MS);

    return () => {
      window.clearInterval(intervalId);
    };
  }, [focusContext?.set.id, focusContext?.set.tempo, tempoMetronomeEnabled, viewMode]);

  useEffect(() => {
    return () => {
      if (audioContextRef.current) {
        void audioContextRef.current.close();
        audioContextRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    if (!pendingExerciseName) return;
    const lastBlock = session.blocks[session.blocks.length - 1];
    const lastExercise = lastBlock?.exercises[lastBlock.exercises.length - 1];
    if (!lastBlock || !lastExercise || lastExercise.name !== pendingExerciseName) return;
    const firstSet = lastExercise.sets[0];
    if (!firstSet) return;
    if (firstSet.reps == null) {
      dispatch({
        type: 'UPDATE_SET',
        payload: {
          blockId: lastBlock.id,
          exerciseId: lastExercise.id,
          setId: firstSet.id,
          updates: { reps: 8 },
        },
      });
    }
    setPendingExerciseName(null);
  }, [pendingExerciseName, session.blocks, dispatch]);

  const openKeypad = (field: 'weight' | 'reps') => {
    if (!focusContext) return;
    const currentValue = field === 'weight' ? focusContext.set.weight : focusContext.set.reps;
    setKeypadValue(currentValue == null ? '' : String(currentValue));
    setKeypadArmed(true);
    setActiveInput({ blockId: focusContext.blockId, setId: focusContext.setId, field });
    setActiveCell({
      blockId: focusContext.blockId,
      exerciseId: focusContext.exerciseId,
      setId: focusContext.setId,
      field,
    });
  };

  const updateActiveInputValue = (field: 'weight' | 'reps', nextValue: number | null) => {
    if (!activeInput) return;
    const block = session.blocks.find((entry) => entry.id === activeInput.blockId);
    if (!block) return;
    const exercise = block.exercises.find((entry) =>
      entry.sets.some((set) => set.id === activeInput.setId)
    );
    if (!exercise) return;

    dispatch({
      type: 'UPDATE_SET',
      payload: {
        blockId: activeInput.blockId,
        exerciseId: exercise.id,
        setId: activeInput.setId,
        updates:
          field === 'weight'
            ? { weight: nextValue == null ? null : Math.max(0, nextValue) }
            : { reps: nextValue == null ? null : Math.max(0, Math.round(nextValue)) },
      },
    });
  };

  const handleKeypadPress = (key: string) => {
    if (!activeInput) return;

    const clearExisting = keypadArmed && key !== 'del';
    if (keypadArmed) {
      setKeypadArmed(false);
    }

    setKeypadValue((current) => {
      const base = clearExisting ? '' : current;
      let next = base;
      if (key === 'del') {
        next = current.slice(0, -1);
      } else if (key === '.') {
        if (activeInput.field === 'reps') return current;
        if (base.includes('.')) return current;
        next = base === '' ? '0.' : `${base}.`;
      } else {
        next = base === '0' ? key : `${base}${key}`;
      }

      const parsed = next === '' || next === '.' ? null : Number(next);
      if (parsed != null && Number.isNaN(parsed)) {
        return current;
      }

      updateActiveInputValue(activeInput.field, parsed);

      return next;
    });
  };

  const handleOpenFocus = (entry: ExerciseRef, targetSetId?: string) => {
    const targetSet =
      (targetSetId
        ? entry.exercise.sets.find((set) => set.id === targetSetId)
        : entry.exercise.sets.find((set) => !set.completed)) ??
      entry.exercise.sets[0] ??
      null;

    if (targetSet) {
      setActiveCell({
        blockId: entry.blockId,
        exerciseId: entry.exercise.id,
        setId: targetSet.id,
        field: 'weight',
      });
    } else {
      addSet(entry.blockId, entry.exercise.id);
    }

    overviewScrollPositionRef.current = overviewScrollRef.current?.scrollTop ?? 0;
    setFocusedExerciseId(entry.exercise.id);
    setViewMode('cockpit');
  };

  const applySetUpdate = (field: 'weight' | 'reps' | 'rpe', nextValue: number | null) => {
    if (!focusContext) return;

    dispatch({
      type: 'UPDATE_SET',
      payload: {
        blockId: focusContext.blockId,
        exerciseId: focusContext.exerciseId,
        setId: focusContext.setId,
        updates:
          field === 'weight'
            ? { weight: nextValue }
            : field === 'reps'
              ? { reps: nextValue == null ? null : Math.max(0, Math.round(nextValue)) }
              : { rpe: nextValue == null ? null : Math.max(1, Math.min(10, Math.round(nextValue * 2) / 2)) },
      },
    });
  };

  const handleWeightChange = (nextValue: number) => {
    applySetUpdate('weight', Math.max(0, nextValue));
  };

  const handleRepsChange = (nextValue: number) => {
    applySetUpdate('reps', Math.max(0, Math.round(nextValue)));
  };

  const handleRpeChange = (nextValue: number) => {
    applySetUpdate('rpe', nextValue);
  };

  const handleSetUnitChange = (nextUnit: WeightUnit) => {
    if (!focusContext) return;
    const currentUnit = focusContext.set.weightUnit ?? sessionWeightUnit;
    if (currentUnit === nextUnit) return;

    const convertedWeight =
      focusContext.set.weight == null
        ? null
        : Math.round(convertWeight(Number(focusContext.set.weight), currentUnit, nextUnit) * 100) / 100;

    dispatch({
      type: 'UPDATE_SET',
      payload: {
        blockId: focusContext.blockId,
        exerciseId: focusContext.exerciseId,
        setId: focusContext.setId,
        updates: {
          weightUnit: nextUnit,
          ...(convertedWeight == null ? {} : { weight: convertedWeight }),
        },
      },
    });
    setSessionWeightUnit(nextUnit);
  };

  const applySmartRecommendation = useCallback((recommendation: TrainingRecommendation | null) => {
    if (!recommendation?.apply) return;
    const target = locateSetForPatch(session.blocks, recommendation);
    const patch = recommendation.apply;

    if (patch.restSeconds != null && patch.setId) {
      setRestBoostBySetId((current) => ({
        ...current,
        [patch.setId as string]: Math.max(0, Math.round(patch.restSeconds ?? 0)),
      }));
    }

    if (!target) return;
    const updates: Partial<Pick<SessionSet, 'weight' | 'weightUnit' | 'reps'>> = {};
    if (patch.weight !== undefined) updates.weight = patch.weight;
    if (patch.weightUnit !== undefined) updates.weightUnit = patch.weightUnit;
    if (patch.reps !== undefined) updates.reps = patch.reps;
    if (Object.keys(updates).length === 0) return;

    dispatch({
      type: 'UPDATE_SET',
      payload: {
        blockId: target.block.id,
        exerciseId: target.exercise.id,
        setId: target.set.id,
        updates,
      },
    });
  }, [dispatch, session.blocks]);

  const handleLogSet = () => {
    if (!focusContext) return;

    setJustLogged(true);
    setTimeout(() => setJustLogged(false), 600);

    const setIndex = focusContext.exercise.sets.findIndex((set) => set.id === focusContext.setId);
    const wasLastSet = setIndex === focusContext.exercise.sets.length - 1;
    const wasEditing = focusContext.set.completed;
    const cluster = focusContext.set.cluster;
    const completedRounds = clusterProgressBySetId[focusContext.setId] ?? 0;
    const clusterTotal = cluster?.reps.length ?? 0;
    const hasClusterTransition = !wasEditing && Boolean(cluster && completedRounds + 1 < clusterTotal);
    const skipRestForSupersetTransition =
      !wasEditing &&
      shouldSkipRestForSupersetTransition(session.blocks, {
        blockId: focusContext.blockId,
        exerciseId: focusContext.exerciseId,
        setId: focusContext.setId,
      });
    const block = session.blocks.find((entry) => entry.id === focusContext.blockId);
    const isSupersetRoundRest = !wasEditing && !skipRestForSupersetTransition && block?.type === 'superset';

    if (hasClusterTransition && cluster) {
      const nextCompletedRounds = completedRounds + 1;
      const nextTargetReps = cluster.reps[nextCompletedRounds] ?? null;
      setClusterProgressBySetId((current) => ({
        ...current,
        [focusContext.setId]: nextCompletedRounds,
      }));
      if (nextTargetReps != null) {
        dispatch({
          type: 'UPDATE_SET',
          payload: {
            blockId: focusContext.blockId,
            exerciseId: focusContext.exerciseId,
            setId: focusContext.setId,
            updates: { reps: nextTargetReps },
          },
        });
      }
      setRestContext({
        blockId: focusContext.blockId,
        exerciseId: focusContext.exerciseId,
        setId: focusContext.setId,
        wasLastSet: false,
        wasEditing,
        supersetRoundRest: false,
        clusterTransition: true,
        clusterRestSeconds: cluster.restSeconds,
        nextClusterRound: nextCompletedRounds + 1,
        clusterTotalRounds: clusterTotal,
      });
      setViewMode('rest');
      return;
    }

    if (clusterTotal > 0) {
      setClusterProgressBySetId((current) => {
        if (!(focusContext.setId in current)) return current;
        const next = { ...current };
        delete next[focusContext.setId];
        return next;
      });
    }

    if (!wasEditing) {
      toggleComplete(focusContext.blockId, focusContext.exerciseId, focusContext.setId);
    }

    if (skipRestForSupersetTransition) {
      setRestContext(null);
      setViewMode('cockpit');
      return;
    }

    setRestContext({
      blockId: focusContext.blockId,
      exerciseId: focusContext.exerciseId,
      setId: focusContext.setId,
      wasLastSet,
      wasEditing,
      supersetRoundRest: isSupersetRoundRest,
    });

    setViewMode('rest');
  };

  const handleContinue = (forceOverview = false) => {
    if (restContext?.clusterTransition) {
      setViewMode('cockpit');
      return;
    }
    if (restContext?.wasEditing) {
      setViewMode('overview');
      setFocusedExerciseId(null);
      return;
    }
    if (forceOverview) {
      setViewMode('overview');
      setFocusedExerciseId(null);
      return;
    }
    if (nextSetContext && restContext && nextSetContext.exercise.id === restContext.exerciseId) {
      setViewMode('cockpit');
    } else {
      setViewMode('overview');
      setFocusedExerciseId(null);
    }
  };

  const handleSkipSet = () => {
    if (!focusContext) return;

    setJustLogged(true);
    setTimeout(() => setJustLogged(false), 600);

    const setIndex = focusContext.exercise.sets.findIndex((set) => set.id === focusContext.setId);
    const wasLastSet = setIndex === focusContext.exercise.sets.length - 1;
    const wasEditing = focusContext.set.completed;

    // We don't advance clusters for skipped sets, so we just skip the whole cluster logic
    const skipRestForSupersetTransition =
      !wasEditing &&
      shouldSkipRestForSupersetTransition(session.blocks, {
        blockId: focusContext.blockId,
        exerciseId: focusContext.exerciseId,
        setId: focusContext.setId,
      });

    const block = session.blocks.find((entry) => entry.id === focusContext.blockId);
    const isSupersetRoundRest = !wasEditing && !skipRestForSupersetTransition && block?.type === 'superset';

    if (!wasEditing) {
      skipSet(focusContext.blockId, focusContext.exerciseId, focusContext.setId);
    }

    if (skipRestForSupersetTransition) {
      setRestContext(null);
      setViewMode('cockpit');
      return;
    }

    setRestContext({
      blockId: focusContext.blockId,
      exerciseId: focusContext.exerciseId,
      setId: focusContext.setId,
      wasLastSet,
      wasEditing,
      supersetRoundRest: isSupersetRoundRest,
    });

    setViewMode('rest');
  };



  const handleAddBonusSet = () => {
    if (!restContext) return;
    addSet(restContext.blockId, restContext.exerciseId);
    setRestContext((current) => (current ? { ...current, wasLastSet: false } : current));
    setViewMode('cockpit');
  };

  const handleOpenNotes = () => {
    setIsNotesOpen(true);
  };

  const handleSaveNotes = () => {
    if (focusContext) {
      dispatch({
        type: 'UPDATE_SET',
        payload: {
          blockId: focusContext.blockId,
          exerciseId: focusContext.exerciseId,
          setId: focusContext.setId,
          updates: { notes: notesDraft },
        },
      });
    }
    setIsNotesOpen(false);
  };

  const buildWorkoutSession = (): { payload: WorkoutSession; autoCompletedSets: number } => {
    const now = new Date();
    const startTime = session.startTime ?? now;
    const date = startTime.toISOString().split('T')[0];
    const sessionId = `session_${createUuid()}`;
    const programId = baseProgram?.id ?? 'quick_start';
    const programName = baseProgram?.name ?? 'Quick Start';
    const activeCycleNumber = programDayContext?.cycleNumber ?? 1;
    const activeWeekNumber = programDayContext?.weekNumber ?? 1;
    const activeDayOfWeek = programDayContext?.day.dayOfWeek ?? '';
    const activeDayName = programDayContext?.day.name ?? programName;

    const sets: SetLog[] = [];
    let autoCompletedSets = 0;
    session.blocks.forEach((block) => {
      block.exercises.forEach((exercise) => {
        const resolvedExerciseName = resolveExerciseDisplayName(exercise.id, {
          catalog: exerciseCatalog,
          cachedName: exercise.name,
        });
        const bodyweightExercise = isBodyweight(resolvedExerciseName);
        exercise.sets.forEach((set, index) => {
          const rawReps = set.reps === null || set.reps === undefined ? null : Number(set.reps);
          const reps = rawReps == null ? 8 : rawReps;
          const weight = Number(set.weight) || 0;
          const setWeightUnit = set.weightUnit ?? sessionWeightUnit;
          const weightLbs = weight > 0 ? convertWeight(weight, setWeightUnit, 'lbs') : 0;
          const volumeLoad = weightLbs > 0 && reps > 0 ? weightLbs * reps : null;
          const e1rm =
            weight > 0 && reps > 0 ? rpeAdjusted1RM(weight, reps, set.rpe ?? null) : null;
          const touched = set.touchedWeight || set.touchedReps || set.touchedRpe;
          const hasMeaningfulInput = (rawReps != null && rawReps > 0) || weight > 0 || set.rpe != null;
          const autoCompleted = !set.skipped && set.completed !== true && touched && hasMeaningfulInput;
          if (autoCompleted) {
            autoCompletedSets += 1;
          }

          sets.push({
            id: set.id,
            exerciseId: exercise.id,
            exerciseName: resolveExerciseDisplayName(exercise.id, {
              catalog: exerciseCatalog,
              cachedName: resolvedExerciseName,
            }),
            setIndex: index + 1,
            prescribedReps: String(reps),
            prescribedRPE: set.prescribedRPE ?? set.rpe ?? null,
            prescribedRIR: set.prescribedRIR ?? null,
            prescribedPercentage: set.prescribedPercentage ?? null,
            prescribedWeight: set.prescribedWeight ?? null,
            actualWeight: weight || null,
            weightUnit: setWeightUnit,
            loadType: bodyweightExercise && weight === 0 ? 'bodyweight' : 'absolute',
            actualReps: reps,
            actualRPE: set.rpe ?? null,
            notes: set.notes?.trim() || undefined,
            completed: !set.skipped && (set.completed === true || autoCompleted),
            e1rm: e1rm ? Math.round(e1rm) : null,
            volumeLoad,
            setType: set.cluster ? 'cluster' : mapSetType(set.type),
            tempo: set.tempo ?? undefined,
            supersetGroup: set.supersetGroup ?? (block.type === 'superset' ? block.id : undefined),
            clusterRounds: set.cluster
              ? set.cluster.reps.map((clusterReps) => ({
                reps: clusterReps,
                restSeconds: set.cluster?.restSeconds ?? 20,
              }))
              : undefined,
            timestamp: now.toISOString(),
          });
        });
      });
    });

    const completedSets = sets.filter((set) => set.completed);
    const totalVolumeLoad = completedSets.reduce((sum, set) => sum + (set.volumeLoad ?? 0), 0);
    const averageRPE =
      completedSets.length > 0
        ? completedSets.reduce((sum, set) => sum + (set.actualRPE ?? 0), 0) / completedSets.length
        : undefined;

    return {
      payload: {
        id: sessionId,
        programId,
        programName,
        cycleNumber: activeCycleNumber,
        weekNumber: activeWeekNumber,
        dayOfWeek: activeDayOfWeek,
        dayName: activeDayName,
        date,
        startTime: startTime.toISOString(),
        endTime: now.toISOString(),
        durationMinutes: Math.max(1, Math.round((now.getTime() - startTime.getTime()) / 60000)),
        sets,
        totalVolumeLoad,
        averageRPE,
        metadata: programDayContext
          ? {
            dayIndex: programDayContext.dayIndex,
            weekIndex: programDayContext.weekIndex,
            cycleNumber: programDayContext.cycleNumber,
            dayOfWeek: programDayContext.day.dayOfWeek,
            dayName: programDayContext.day.name,
          }
          : undefined,
        createdAt: now.toISOString(),
        updatedAt: now.toISOString(),
      },
      autoCompletedSets,
    };
  };

  const handleFinishWorkout = async () => {
    if (saveInFlightRef.current || isFinishingWorkout) {
      if (user?.id) {
        void trackUiEvent(
          {
            name: 'workout_finish_ignored',
            source: 'workout',
            properties: {
              reason: saveInFlightRef.current ? 'save_in_flight' : 'is_finishing',
            },
          },
          user.id
        );
      }
      return;
    }
    saveInFlightRef.current = true;
    setIsFinishingWorkout(true);
    setFinishStatusMessage('Saving workout...');
    setActiveInput(null);
    const startedAt = Date.now();
    const finishEventBase = {
      programId: baseProgram?.id ?? 'quick_start',
      programName: baseProgram?.name ?? 'Quick Start',
      blockCount: session.blocks.length,
    };
    if (user?.id) {
      void trackUiEvent(
        {
          name: 'workout_finish_pressed',
          source: 'workout',
          properties: finishEventBase,
        },
        user.id
      );
    }
    let builtSession: WorkoutSession | null = null;
    let autoCompletedSets = 0;
    let completedSetsSent = 0;

    try {
      const buildResult = buildWorkoutSession();
      builtSession = buildResult.payload;
      autoCompletedSets = buildResult.autoCompletedSets;
      completedSetsSent = builtSession.sets.filter((set) => set.completed).length;

      const criticalPathStartedAt = Date.now();
      const saveResult = await withTimeout(
        saveWorkout(builtSession, user?.id, { skipAnalytics: true, criticalPathOnly: true }),
        12000,
        'Workout save timed out'
      );
      const criticalPathDurationMs = Date.now() - criticalPathStartedAt;
      const hasCompletedSetsInPayload = completedSetsSent > 0;

      if (saveResult.newPersonalRecords.length > 0 && typeof window !== 'undefined') {
        localStorage.setItem(
          'iron_brain_last_pr_hits',
          JSON.stringify({
            createdAt: new Date().toISOString(),
            hits: saveResult.newPersonalRecords,
          })
        );
      }

      if (hasCompletedSetsInPayload && initialData && programDayContext && user?.id) {
        const nextProgress = advanceProgramProgress(
          initialData,
          {
            cycleNumber: programDayContext.cycleNumber,
            weekIndex: programDayContext.weekIndex,
            dayIndex: programDayContext.dayIndex,
          },
          namespaceId
        );
        void syncProgramProgressToCloud(user.id, initialData, nextProgress, namespaceId).catch(() => {});
      }

      if (FEATURES.programCalendar && hasCompletedSetsInPayload && programDayContext && builtSession.programId) {
        void updateScheduleEvent({
          match: {
            programId: builtSession.programId,
            weekIndex: programDayContext.weekIndex,
            dayIndex: programDayContext.dayIndex,
            scheduledDate: builtSession.date,
          },
          status: 'completed',
          completedWorkoutSessionId: builtSession.id,
          metadata: {
            completed_from: 'workout_finish',
          },
        }).catch(() => {});
      }

      if (user?.id) {
        void trackUiEvent(
          {
            name: 'workout_finish_success',
            source: 'workout',
            properties: {
              ...finishEventBase,
              durationMs: Date.now() - startedAt,
              criticalPathDurationMs,
              completedSets: completedSetsSent,
              completedSetsSent,
              autoCompletedSets,
              totalSets: builtSession.sets.length,
              prHits: saveResult.newPersonalRecords.length,
              queued: saveResult.queued,
              syncedToCloud: saveResult.syncedToCloud,
            },
          },
          user.id
        );
      }

      setFinishStatusMessage('Saved. Finishing up...');
      // Clear persistent session before navigating away
      clearSession();
      // Save succeeded — navigate out
      setIsSummaryOpen(false);
      router.replace('/');
      // Fallback in case navigation is interrupted in mobile webviews.
      window.setTimeout(() => {
        if (window.location.pathname.startsWith('/workout')) {
          window.location.assign('/');
        }
      }, 900);
    } catch (error) {
      
      if (user?.id) {
        const message = error instanceof Error ? error.message : String(error);
        void trackUiEvent(
          {
            name: 'workout_finish_fallback_exit',
            source: 'workout',
            properties: {
              ...finishEventBase,
              durationMs: Date.now() - startedAt,
              error: message,
              completedSetsSent,
              autoCompletedSets,
              totalSets: builtSession?.sets.length ?? 0,
            },
          },
          user.id
        );
      }
      // Stay on the workout screen so the user can retry
      setFinishStatusMessage('Save failed \u2013 your data is safe. Try again.');
    } finally {
      saveInFlightRef.current = false;
      setIsFinishingWorkout(false);
    }
  };

  const handleCloseSummary = () => {
    if (isFinishingWorkout) return;
    setIsSummaryOpen(false);
    setFinishStatusMessage(null);
    setShareStatusMessage(null);
  };

  const handleCancelWorkout = () => {
    clearSession();
    router.replace('/');
  };

  useEffect(() => {
    if (!isSummaryOpen || !finishStatusMessage) return;
    const timer = window.setTimeout(() => {
      setFinishStatusMessage((current) => (current === finishStatusMessage ? null : current));
    }, 2500);
    return () => window.clearTimeout(timer);
  }, [finishStatusMessage, isSummaryOpen]);

  useEffect(() => {
    if (!isSummaryOpen || !shareStatusMessage) return;
    const timer = window.setTimeout(() => {
      setShareStatusMessage((current) => (current === shareStatusMessage ? null : current));
    }, 2500);
    return () => window.clearTimeout(timer);
  }, [isSummaryOpen, shareStatusMessage]);

  const handleShare = async () => {
    const text = [
      'IRON BRAIN SESSION',
      `Volume: ${Math.round(sessionStats.totalVolume).toLocaleString()} ${sessionWeightUnit.toUpperCase()}`,
      `Sets: ${sessionStats.totalSets}`,
      `Reps: ${sessionStats.totalReps}`,
      '',
      'Logged with Iron Brain.',
    ].join('\n');
    const url = typeof window !== 'undefined' ? window.location.origin : undefined;

    if (typeof navigator !== 'undefined' && navigator.share) {
      try {
        await navigator.share({ title: 'Iron Brain Session', text, url });
        setShareStatusMessage('Share sheet opened');
      } catch {
        setShareStatusMessage('Share canceled');
      }
      return;
    }

    try {
      if (typeof navigator === 'undefined' || !navigator.clipboard) {
        throw new Error('Clipboard unavailable');
      }
      await navigator.clipboard.writeText(text);
      setShareStatusMessage('Summary copied');
    } catch {
      setShareStatusMessage('Share unavailable');
    }
  };

  const handleAddExercise = (name: string, setCount = 1, exerciseId?: string | null) => {
    addExercise(name, setCount, exerciseId ?? undefined);
    setPendingExerciseName(name);
    setIsAddMovementOpen(false);
    setPendingAddName(null);
    setPendingAddExerciseId(null);
    setSearchQuery('');
    setTimeout(() => {
      overviewScrollRef.current?.scrollTo({
        top: overviewScrollRef.current.scrollHeight,
        behavior: 'smooth',
      });
    }, 50);
  };

  const handleRemoveExercise = (blockId: string, exerciseId: string) => {
    removeExercise(blockId, exerciseId);
  };

  const weightValue = focusContext?.set.weight ?? 0;
  const currentSetWeightUnit = focusContext?.set.weightUnit ?? sessionWeightUnit;
  const repsValue = focusContext?.set.reps ?? 8;
  const rpeValue = focusContext?.set.rpe ?? null;
  const currentSetNote = focusContext?.set.notes?.trim() ?? '';
  const previousSetNote = focusContext?.set.previousNote?.trim() ?? '';
  const isEditingSet = Boolean(focusContext?.set.completed);
  const focusTempo = focusContext?.set.tempo ?? null;
  const focusTempoSteps = useMemo(() => parseTempoSteps(focusTempo), [focusTempo]);
  const focusCluster = focusContext?.set.cluster ?? null;
  const completedClusterRounds = focusContext ? clusterProgressBySetId[focusContext.setId] ?? 0 : 0;
  const clusterTotalRounds = focusCluster?.reps.length ?? 0;
  const isClusterSet = Boolean(focusCluster && clusterTotalRounds > 0 && !isEditingSet);
  const activeClusterRoundIndex = isClusterSet
    ? Math.min(completedClusterRounds, Math.max(0, clusterTotalRounds - 1))
    : -1;
  const activeClusterRepTarget =
    isClusterSet && activeClusterRoundIndex >= 0
      ? focusCluster?.reps[activeClusterRoundIndex] ?? null
      : null;
  const supersetSlotLabel =
    focusedRef?.blockType === 'superset' && focusContext?.exercise.slot
      ? focusContext.exercise.slot
      : null;
  const bodyweightExercise = focusedRef ? isBodyweight(getExerciseDisplayName(focusedRef.exercise)) : false;
  const isWeightActive = activeInput?.field === 'weight';
  const isRepsActive = activeInput?.field === 'reps';

  const nextSetIndex = nextSetContext
    ? nextSetContext.exercise.sets.findIndex((set) => set.id === nextSetContext.set.id)
    : null;
  const nextSetNumber = (nextSetIndex ?? 0) + 1;
  const nextExerciseDisplayName = nextSetContext ? getExerciseDisplayName(nextSetContext.exercise) : undefined;
  const focusedExerciseDisplayName = focusedRef ? getExerciseDisplayName(focusedRef.exercise) : undefined;
  const restDurationSeconds = useMemo(() => {
    if (!restContext) return DEFAULT_REST_SECONDS;
    if (restContext.clusterTransition && restContext.clusterRestSeconds) {
      return restContext.clusterRestSeconds;
    }
    const block = session.blocks.find((entry) => entry.id === restContext.blockId);
    if (restContext.supersetRoundRest && block?.type === 'superset' && block.restAfterRoundSeconds) {
      return block.restAfterRoundSeconds;
    }
    const exercise = block?.exercises.find((entry) => entry.id === restContext.exerciseId);
    if (!exercise) return DEFAULT_REST_SECONDS;
    const baseRest = getRestDurationSeconds(exercise, resolveMuscleProfile);
    const nextSetBoost = nextSetContext?.set.id ? restBoostBySetId[nextSetContext.set.id] ?? 0 : 0;
    return baseRest + nextSetBoost;
  }, [nextSetContext?.set.id, resolveMuscleProfile, restBoostBySetId, restContext, session.blocks]);

  const availableExercises = useMemo<CommonExercise[]>(() => {
    const byId = new Map<string, CommonExercise>();
    COMMON_EXERCISES.forEach((exercise) => {
      byId.set(exercise.id, exercise);
    });
    customExercises.forEach((exercise) => {
      byId.set(exercise.id, { id: exercise.id, name: exercise.name });
    });
    return Array.from(byId.values()).sort((a, b) => a.name.localeCompare(b.name));
  }, [customExercises]);

  const filteredExercises = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    if (!query) return availableExercises;
    return availableExercises.filter((exercise) => exercise.name.toLowerCase().includes(query));
  }, [availableExercises, searchQuery]);

  useEffect(() => {
    if (isBackNavRef.current) {
      isBackNavRef.current = false;
      return;
    }
    const history = viewHistoryRef.current;
    if (history[history.length - 1] !== viewMode) {
      history.push(viewMode);
      if (history.length > 20) {
        history.shift();
      }
    }
  }, [viewMode]);

  return (
    <>
      <div
        className="relative w-full min-h-[100dvh] bg-zinc-950 text-white flex flex-col"
        data-swipe-scope="local"
      >

        <AnimatePresence mode="wait" initial={false}>
          {viewMode === 'overview' && (
            <motion.div
              key="overview"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.2 }}
              className="flex-1 w-full overflow-y-auto pb-32 space-y-8"
              ref={overviewScrollRef}
              data-swipe-ignore="true"
            >
              <div className="px-4 pt-12 pb-4">
                <div className="mb-8 flex items-center justify-between">
                  <button
                    type="button"
                    onClick={handleCancelWorkout}
                    className="group inline-flex min-h-10 items-center gap-2 rounded-xl border border-rose-500/25 bg-zinc-950/80 px-3.5 text-[10px] font-black uppercase tracking-[0.2em] text-rose-300 transition-colors hover:border-rose-400/50 hover:bg-rose-500/10 active:bg-rose-500/15"
                  >
                    <X className="h-3 w-3 transition-transform group-hover:rotate-90" />
                    <span>Discard Session</span>
                  </button>
                  <div className="flex items-center gap-2 rounded-full border border-zinc-800 bg-zinc-900/50 px-3.5 py-2">
                    <Timer className="h-4 w-4 text-emerald-400" />
                    <span className="font-mono text-lg font-bold tabular-nums text-emerald-300">{elapsedDisplay}</span>
                  </div>
                </div>

                <div className="flex items-end justify-between">
                  <div>
                    <p className="text-xs uppercase tracking-[0.25em] text-zinc-500">
                      {readinessLabel}
                    </p>
                    <p className="text-6xl font-black text-white">
                      {Math.round(readinessScore)}
                    </p>
                  </div>
                </div>
              </div>


              <div
                className="space-y-6 px-4"
                onClick={() => setRevealedId(null)}
              >
                {exerciseRefs.map((entry) => {
                  const style = getExerciseStyle(entry.exercise, resolveMuscleProfile);
                  const isRevealed = revealedId === entry.exercise.id;
                  const displayName = getExerciseDisplayName(entry.exercise);
                  const bodyweightExercise = isBodyweight(displayName);

                  return (
                    <div key={entry.exercise.id} className="relative overflow-hidden rounded-2xl">
                      <button
                        type="button"
                        onClick={() => handleRemoveExercise(entry.blockId, entry.exercise.id)}
                        onPointerDown={(event) => event.stopPropagation()}
                        className="absolute inset-y-0 right-0 flex w-20 items-center justify-center bg-rose-600/90 active:brightness-75 transition-all"
                        aria-label={`Delete ${displayName}`}
                      >
                        <Trash2 className="h-5 w-5 text-white" />
                      </button>
                      <motion.div
                        drag="x"
                        dragConstraints={{ left: -80, right: 0 }}
                        dragElastic={0.15}
                        dragSnapToOrigin
                        dragMomentum={false}
                        animate={{ x: isRevealed ? -80 : 0 }}
                        transition={{ type: 'spring', stiffness: 300, damping: 30 }}
                        onDragEnd={(_, info) => {
                          const threshold = 36;
                          if (!isRevealed && info.offset.x < -threshold) {
                            setRevealedId(entry.exercise.id);
                          } else if (isRevealed && info.offset.x > threshold) {
                            setRevealedId(null);
                          }
                        }}
                        className="relative z-10 rounded-2xl bg-zinc-950"
                        data-swipe-ignore="true"
                      >
                        <div
                          role="button"
                          tabIndex={0}
                          onClick={(event) => {
                            event.stopPropagation();
                            setRevealedId(null);
                            handleOpenFocus(entry);
                          }}
                          onKeyDown={(event) => {
                            if (event.key === 'Enter' || event.key === ' ') {
                              event.preventDefault();
                              event.stopPropagation();
                              setRevealedId(null);
                              handleOpenFocus(entry);
                            }
                          }}
                          className="group relative w-full text-left rounded-2xl bg-zinc-950 active:scale-[0.99] transition-transform"
                        >
                          <div className="flex flex-col gap-3 p-1">
                            <div>
                              <div className="mb-1 flex items-center gap-2">
                                <ExerciseBadge style={style} />
                                <span
                                  className={`text-xs font-bold tracking-[0.2em] ${style.isCompound ? 'bg-clip-text text-transparent' : ''
                                    }`}
                                  style={{
                                    color: style.isCompound ? undefined : style.primaryColor,
                                    backgroundImage: style.isCompound
                                      ? `linear-gradient(120deg, ${style.primaryColor} 0%, ${style.secondaryColor} 100%)`
                                      : undefined,
                                  }}
                                >
                                  {style.label}
                                </span>
                                <span
                                  className="text-[9px] font-mono uppercase tracking-[0.35em]"
                                  style={{ color: style.secondaryColor }}
                                >
                                  {style.isCompound ? 'COMP' : 'ISO'}
                                </span>
                              </div>
                              <p className="text-3xl font-black italic text-white">{displayName}</p>
                            </div>
                            <div
                              className="data-stream flex gap-2 overflow-x-auto pr-8 pb-1"
                              data-swipe-ignore="true"
                              style={{
                                WebkitMaskImage:
                                  'linear-gradient(to right, rgba(0,0,0,1) 0%, rgba(0,0,0,1) 88%, rgba(0,0,0,0) 100%)',
                                maskImage:
                                  'linear-gradient(to right, rgba(0,0,0,1) 0%, rgba(0,0,0,1) 88%, rgba(0,0,0,0) 100%)',
                                scrollbarWidth: 'none',
                                msOverflowStyle: 'none',
                              }}
                            >
                              {entry.exercise.sets.map((set, index) => {
                                const repsValue =
                                  set.reps === null || set.reps === undefined
                                    ? 8
                                    : Number(set.reps);
                                const weightValue = Number(set.weight) || 0;
                                const displayWeight = Number.isInteger(weightValue)
                                  ? `${weightValue}`
                                  : weightValue.toFixed(1);
                                const displayReps = Number.isInteger(repsValue)
                                  ? `${repsValue}`
                                  : repsValue.toFixed(1);
                                let label = `Set ${index + 1}`;
                                if (set.completed) {
                                  if (bodyweightExercise && weightValue === 0) {
                                    label = repsValue > 0 ? `BW × ${displayReps}` : 'BW';
                                  } else if (weightValue > 0) {
                                    label = repsValue > 0 ? `${displayWeight} × ${displayReps}` : displayWeight;
                                  } else {
                                    label = repsValue > 0 ? `BW × ${displayReps}` : '--';
                                  }
                                }

                                return (
                                  <button
                                    key={set.id}
                                    type="button"
                                    onClick={(event) => {
                                      event.stopPropagation();
                                      setRevealedId(null);
                                      handleOpenFocus(entry, set.id);
                                    }}
                                    className={`whitespace-nowrap rounded-md border px-3 py-1.5 text-xs font-mono ${set.completed
                                      ? 'border-emerald-500/50 bg-emerald-500/10 font-bold text-emerald-400 shadow-[0_0_10px_rgba(16,185,129,0.1)]'
                                      : 'border-zinc-800 bg-zinc-900 text-zinc-600'
                                      }`}
                                  >
                                    {label}
                                  </button>
                                );
                              })}
                            </div>
                          </div>
                        </div>
                      </motion.div>
                    </div>
                  );
                })}

                <button
                  type="button"
                  onClick={() => {
                    setPendingAddName(null);
                    setPendingAddExerciseId(null);
                    setSearchQuery('');
                    setIsAddMovementOpen(true);
                  }}
                  className="w-full py-6 border-2 border-dashed border-zinc-800 rounded-2xl text-zinc-500 font-bold hover:border-emerald-500 hover:text-emerald-500 transition-all flex items-center justify-center gap-2"
                >
                  <Plus className="h-5 w-5" />
                  Add Exercise
                </button>
              </div>

              <div className="px-4 pb-6">
                <button
                  type="button"
                  onClick={() => {
                    setActiveInput(null);
                    setFinishStatusMessage(null);
                    setShareStatusMessage(null);
                    setIsSummaryOpen(true);
                  }}
                  className="w-full bg-emerald-500 text-zinc-950 font-black tracking-widest uppercase py-4 rounded-2xl shadow-lg shadow-emerald-500/20"
                >
                  Review Finish
                </button>
              </div>
            </motion.div>
          )}

          {viewMode === 'cockpit' && (
            <motion.div
              key="cockpit"
              initial={{ opacity: 0, x: 24 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -24 }}
              transition={{ duration: 0.2 }}
              className="flex-1 w-full flex flex-col overflow-y-auto relative select-none pb-20"
              ref={cockpitScrollRef}
            >
              <header className="mb-4 px-4">
                <div className="flex min-w-0 items-start gap-3">
                  <button
                    type="button"
                    onClick={() => {
                      setViewMode('overview');
                      setFocusedExerciseId(null);
                      setInfoPanel(null);
                      requestAnimationFrame(() => {
                        overviewScrollRef.current?.scrollTo({ top: overviewScrollPositionRef.current });
                      });
                    }}
                    className="mt-1 inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-zinc-800 bg-zinc-950/70 text-zinc-400 transition-colors hover:border-zinc-700 hover:text-white active:bg-zinc-900"
                  >
                    <ArrowLeft className="h-4 w-4" />
                    <span className="sr-only">Back</span>
                  </button>

                  <div className="min-w-0 flex-1">

                    {focusedRef && (() => {
                      const style = getExerciseStyle(focusedRef.exercise, resolveMuscleProfile);
                      return (
                        <div className="mb-1 flex items-center gap-2">
                          <ExerciseBadge style={style} />
                          <span
                            className={`text-xs font-bold tracking-[0.2em] ${style.isCompound ? 'bg-clip-text text-transparent' : ''
                              }`}
                            style={{
                              color: style.isCompound ? undefined : style.primaryColor,
                              backgroundImage: style.isCompound
                                ? `linear-gradient(120deg, ${style.primaryColor} 0%, ${style.secondaryColor} 100%)`
                                : undefined,
                            }}
                          >
                            {style.label}
                          </span>
                          <span
                            className="text-[9px] font-mono uppercase tracking-[0.35em]"
                            style={{ color: style.secondaryColor }}
                          >
                            {style.isCompound ? 'COMP' : 'ISO'}
                          </span>
                        </div>
                      );
                    })()}
                    <h2 className="truncate text-3xl font-black italic leading-none tracking-tight text-white sm:text-4xl">
                      {focusedExerciseDisplayName ?? 'Exercise'}
                    </h2>
                  </div>
                </div>
              </header>


              <div className="px-4 mt-3">
                <div className="flex flex-col justify-center gap-4">
                  <div className="flex items-center justify-between">
                    <p className="text-zinc-500 text-xs uppercase">Current Set</p>
                    <p className="text-zinc-500 text-xs">Prev {focusContext?.set.previous ?? '--'}</p>
                  </div>

                  {(supersetSlotLabel || focusTempo || isClusterSet) && (
                    <div className="flex flex-wrap items-center gap-2">
                      {supersetSlotLabel && (
                        <span className="rounded-full border border-violet-400/35 bg-violet-500/10 px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.2em] text-violet-300">
                          Superset {supersetSlotLabel}
                        </span>
                      )}
                      {focusTempo && (
                        <span className="rounded-full border border-cyan-400/35 bg-cyan-500/10 px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.2em] text-cyan-300">
                          Tempo {focusTempo}
                        </span>
                      )}
                      {isClusterSet && (
                        <span className="rounded-full border border-amber-400/35 bg-amber-500/10 px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.2em] text-amber-300">
                          Cluster {Math.min(completedClusterRounds + 1, clusterTotalRounds)}/{clusterTotalRounds}
                        </span>
                      )}
                    </div>
                  )}

                  <div className={`grid gap-4 ${bodyweightExercise ? 'grid-cols-1' : 'grid-cols-2'}`}>
                    {!bodyweightExercise && (
                      <HardyStepper
                        layout="vertical"
                        value={weightValue}
                        onChange={handleWeightChange}
                        step={currentSetWeightUnit === 'kg' ? 0.25 : 0.5}
                        label={currentSetWeightUnit.toUpperCase()}
                        valueClassName={isWeightActive ? 'text-emerald-400' : undefined}
                        onLabelClick={() => openKeypad('weight')}
                      />
                    )}

                    <HardyStepper
                      layout="vertical"
                      value={repsValue}
                      onChange={handleRepsChange}
                      step={1}
                      label={isClusterSet && activeClusterRepTarget != null ? `REPS (TARGET ${activeClusterRepTarget})` : 'REPS'}
                      valueClassName={isRepsActive ? 'text-emerald-400' : undefined}
                      onLabelClick={() => openKeypad('reps')}
                    />
                  </div>

                  <SmartTargetReadout
                    recommendation={smartTargetRecommendation}
                    onApply={applySmartRecommendation}
                  />

                  {!bodyweightExercise && (
                    <div className="flex items-center justify-between gap-3 rounded-[1rem] border border-zinc-900 bg-zinc-950/70 px-3 py-2">
                      <div className="flex min-w-0 items-center gap-2">
                        <p className="text-[9px] font-bold uppercase tracking-[0.2em] text-zinc-500">Set Unit</p>
                        <button
                          type="button"
                          onClick={() => setInfoPanel('set-unit')}
                          aria-label="What does set unit mean?"
                          className="inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full border border-zinc-800 bg-zinc-950 text-zinc-500 transition-colors hover:border-emerald-500/40 hover:text-emerald-300"
                        >
                          <Info className="h-3 w-3" />
                        </button>
                      </div>
                      <div className="grid shrink-0 grid-cols-2 rounded-lg border border-zinc-800 bg-zinc-900/70 p-0.5">
                        {(['lbs', 'kg'] as WeightUnit[]).map((unit) => (
                          <button
                            key={unit}
                            type="button"
                            aria-label={unit}
                            onClick={() => handleSetUnitChange(unit)}
                            className={`min-h-8 min-w-12 rounded-md px-2.5 text-[10px] font-black uppercase tracking-[0.16em] transition-colors ${currentSetWeightUnit === unit
                              ? 'bg-emerald-400 text-zinc-950 shadow-[0_10px_24px_-18px_rgba(52,211,153,0.9)]'
                              : 'text-zinc-500 hover:text-zinc-200'
                              }`}
                          >
                            {unit.toUpperCase()}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  {focusTempo && (
                    <div className="space-y-2 rounded-2xl border border-cyan-400/20 bg-cyan-500/5 px-3 py-3">
                      <div className="flex items-center justify-between">
                        <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-cyan-200">Tempo Cue</p>
                        <button
                          type="button"
                          onClick={() => setTempoMetronomeEnabled((current) => !current)}
                          className={`rounded-full px-3 py-1 text-[10px] font-bold uppercase tracking-[0.2em] transition-colors ${tempoMetronomeEnabled
                            ? 'bg-cyan-500/20 text-cyan-200'
                            : 'bg-zinc-900/70 text-zinc-400 hover:text-zinc-200'
                            }`}
                        >
                          {tempoMetronomeEnabled ? 'Metronome On' : 'Metronome Off'}
                        </button>
                      </div>
                      <p className="text-xs uppercase tracking-[0.18em] text-cyan-300">
                        {focusTempoSteps.length > 0
                          ? `Eccentric ${focusTempoSteps[0] ?? 0} • Pause ${focusTempoSteps[1] ?? 0} • Concentric ${focusTempoSteps[2] ?? 0} • Top ${focusTempoSteps[3] ?? 0}`
                          : `Tempo ${focusTempo}`}
                      </p>
                    </div>
                  )}

                  <div>
                    <RpeSlider
                      value={rpeValue}
                      onChange={handleRpeChange}
                      onInfoClick={() => setInfoPanel('rpe')}
                    />
                  </div>
                </div>
              </div>

              <footer className="w-full px-4 mt-6 pb-4 flex flex-col items-center gap-2">
                <div className="w-full h-16 bg-zinc-900/80 rounded-[2rem] flex items-center p-1.5 backdrop-blur-md">
                  <button
                    type="button"
                    onClick={() => setIsHistoryOpen(true)}
                    className="flex-1 h-full flex items-center justify-center rounded-2xl text-zinc-400 hover:bg-zinc-800/50 transition-colors active:scale-95 cursor-pointer"
                  >
                    <History className="w-5.5 h-5.5" />
                  </button>

                  <button
                    type="button"
                    onClick={handleLogSet}
                    disabled={!focusContext}
                    className={`flex-[2] mx-1.5 h-full rounded-2xl flex items-center justify-center text-zinc-950 font-black text-base tracking-wider active:scale-[0.98] transition-all cursor-pointer disabled:opacity-40 ${justLogged ? 'bg-emerald-400 shadow-[0_0_20px_6px_rgba(52,211,153,0.45)]' : 'bg-emerald-500 hover:bg-emerald-400 shadow-lg shadow-emerald-500/20'}`}
                  >
                    {isEditingSet ? 'SAVE CHANGES' : 'LOG SET'}
                  </button>

                  <button
                    type="button"
                    onClick={handleOpenNotes}
                    className={`flex-1 h-full flex items-center justify-center rounded-2xl transition-colors active:scale-95 cursor-pointer ${currentSetNote
                      ? 'bg-emerald-500/10 text-emerald-300'
                      : 'text-zinc-400 hover:bg-zinc-800/50'
                      }`}
                  >
                    <FileText className="w-5.5 h-5.5" />
                  </button>
                </div>

                {!isEditingSet && (
                  <div className="flex justify-center">
                    <button
                      type="button"
                      onClick={handleSkipSet}
                      className="group flex items-center gap-2 rounded-full border border-zinc-800 bg-zinc-900/40 px-5 py-2 text-[9px] font-bold uppercase tracking-[0.22em] text-zinc-500 transition-all hover:bg-zinc-800 hover:text-zinc-300 active:scale-95"
                    >
                      <X className="h-3 w-3 opacity-50 group-hover:opacity-100" />
                      <span>Skip Set</span>
                    </button>
                  </div>
                )}
              </footer>

            </motion.div>
          )}

          {viewMode === 'rest' && (
            <motion.div
              key="rest"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="flex-1 w-full flex flex-col overflow-hidden"
            >
              <RestTimer
                isActive={viewMode === 'rest'}
                duration={restDurationSeconds}
                weightUnit={sessionWeightUnit}
                onComplete={(addExtra) => {
                  if (addExtra) {
                    handleAddBonusSet();
                  } else {
                    handleContinue();
                  }
                }}
                onSkip={(addExtra) => {
                  if (addExtra && !restContext?.wasEditing) {
                    handleAddBonusSet();
                  } else {
                    handleContinue();
                  }
                }}
                showUpNext={!restContext?.wasEditing}
                nextSetInfo={{
                  exerciseName: restContext?.clusterTransition
                    ? nextExerciseDisplayName ?? focusedExerciseDisplayName
                    : nextExerciseDisplayName,
                  setNumber: restContext?.clusterTransition ? undefined : nextSetNumber,
                  weight: restContext?.clusterTransition ? undefined : nextSetContext?.set.weight ?? undefined,
                  suggestedWeight: restContext?.clusterTransition ? undefined : nextSmartRecommendation?.target?.weight ?? undefined,
                  reps: restContext?.clusterTransition
                    ? `Cluster ${restContext?.nextClusterRound ?? 1}/${restContext?.clusterTotalRounds ?? 1}`
                    : nextSetContext?.set.reps ?? undefined,
                }}
                smartRecommendation={nextSmartRecommendation}
                onApplyRecommendation={applySmartRecommendation}
                isLastSetOfExercise={Boolean(
                  restContext?.wasLastSet &&
                  !restContext?.wasEditing &&
                  !restContext?.clusterTransition
                )}
              />
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <AnimatePresence>
        {infoPanel && (
          <motion.div
            key="cockpit-info"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[140] flex items-end justify-center bg-zinc-950/70 p-4 backdrop-blur-md sm:items-center"
            data-swipe-ignore="true"
            onClick={() => setInfoPanel(null)}
          >
            <motion.div
              initial={{ opacity: 0, y: 18, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 18, scale: 0.98 }}
              transition={{ duration: 0.18 }}
              className="w-full max-w-md overflow-hidden rounded-[1.25rem] border border-zinc-800 bg-zinc-950 shadow-2xl"
              onClick={(event) => event.stopPropagation()}
            >
              <div className="flex items-start justify-between gap-4 border-b border-zinc-900 p-5">
                <div className="min-w-0">
                  <p className="text-[9px] font-bold uppercase tracking-[0.24em] text-emerald-500/80">
                    {infoPanel === 'set-unit' ? 'Set Unit' : 'Effort Scale'}
                  </p>
                  <h3 className="mt-1 text-2xl font-black italic tracking-tight text-zinc-100">
                    {infoPanel === 'set-unit' ? 'UNIT LOCK' : 'RPE / RIR'}
                  </h3>
                </div>
                <button
                  type="button"
                  onClick={() => setInfoPanel(null)}
                  className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-zinc-800 text-zinc-500 transition-colors hover:border-zinc-700 hover:text-zinc-100"
                  aria-label="Close info"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
              <div className="space-y-4 p-5">
                {infoPanel === 'set-unit' ? (
                  <>
                    <p className="text-sm leading-6 text-zinc-300">
                      Choose the unit for the set you are logging right now. Iron Brain saves that set exactly as entered, so old sets keep their original unit even if your display preference changes later.
                    </p>
                    <div className="grid grid-cols-2 gap-2">
                      <div className="rounded-xl border border-zinc-900 bg-zinc-950/70 p-3">
                        <p className="text-[9px] font-bold uppercase tracking-[0.2em] text-zinc-600">LBS</p>
                        <p className="mt-1 text-xs leading-5 text-zinc-400">Use for pound-based loads.</p>
                      </div>
                      <div className="rounded-xl border border-zinc-900 bg-zinc-950/70 p-3">
                        <p className="text-[9px] font-bold uppercase tracking-[0.2em] text-zinc-600">KG</p>
                        <p className="mt-1 text-xs leading-5 text-zinc-400">Use for kilogram-based loads.</p>
                      </div>
                    </div>
                  </>
                ) : (
                  <>
                    <p className="text-sm leading-6 text-zinc-300">
                      RPE means rate of perceived exertion. Use it to record how hard the set felt on a 1-10 scale after the set is done.
                    </p>
                    <div className="grid grid-cols-2 gap-2">
                      <div className="rounded-xl border border-zinc-900 bg-zinc-950/70 p-3">
                        <p className="text-[9px] font-bold uppercase tracking-[0.2em] text-zinc-600">RPE</p>
                        <p className="mt-1 text-xs leading-5 text-zinc-400">Higher means closer to max effort.</p>
                      </div>
                      <div className="rounded-xl border border-zinc-900 bg-zinc-950/70 p-3">
                        <p className="text-[9px] font-bold uppercase tracking-[0.2em] text-zinc-600">RIR</p>
                        <p className="mt-1 text-xs leading-5 text-zinc-400">Estimated reps left in reserve.</p>
                      </div>
                    </div>
                  </>
                )}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {isHistoryOpen && focusedRef && (
          <motion.div
            key="history"
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 16 }}
            className="fixed inset-0 z-[120] bg-zinc-950 px-6 pb-6 pt-[calc(env(safe-area-inset-top)+3rem)] flex flex-col"
            data-swipe-ignore="true"
          >
            <div className="flex items-center justify-between mb-8">
              <div>
                <p className="text-zinc-500 text-[10px] font-mono uppercase tracking-[0.4em]">EXERCISE HISTORY</p>
                <h3 className="text-white text-2xl font-black mt-1 uppercase italic tracking-tighter">
                  {focusedExerciseDisplayName}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setIsHistoryOpen(false)}
                className="rounded-full border border-zinc-800 bg-zinc-900/50 px-4 py-2 text-[10px] font-bold uppercase tracking-[0.2em] text-zinc-400 transition-colors hover:text-white active:scale-95"
              >
                Close
              </button>
            </div>

            <div className="flex-1 overflow-y-auto pr-2 space-y-6">
              {(() => {
                const logs = storage.getExerciseHistory(focusedRef.exercise.id);
                if (logs.length === 0) {
                  return (
                    <div className="flex flex-col items-center justify-center py-20 text-center">
                      <History className="w-10 h-10 text-zinc-800 mb-4" />
                      <p className="text-zinc-500 font-mono text-xs uppercase tracking-widest">No previous data found</p>
                    </div>
                  );
                }

                return logs.map((session) => {
                  const daySets = session.sets.filter(s => s.exerciseId === focusedRef.exercise.id && s.completed);
                  if (daySets.length === 0) return null;

                  return (
                    <div key={session.id} className="group relative">
                      <div className="mb-3 flex items-center justify-between">
                        <p className="text-xs font-mono uppercase tracking-[0.2em] text-emerald-400">
                          {new Date(session.date).toLocaleDateString(undefined, {
                            month: 'short',
                            day: 'numeric',
                            year: 'numeric'
                          })}
                        </p>
                        <p className="text-[10px] font-mono text-zinc-600 uppercase tracking-widest">
                          {session.dayName || 'Workout'}
                        </p>
                      </div>

                      <div className="grid gap-2">
                        {daySets.map((set, setIdx) => (
                          <div
                            key={`${session.id}-set-${setIdx}`}
                            className="flex items-center justify-between rounded-xl bg-zinc-900/40 border border-zinc-900/50 px-4 py-3"
                          >
                            <div className="flex items-center gap-4">
                              <span className="text-[10px] font-mono text-zinc-600 uppercase tracking-widest w-4">
                                {setIdx + 1}
                              </span>
                              <div className="flex items-baseline gap-1">
                                <span className="text-sm font-black text-zinc-200">
                                  {set.actualWeight ?? '--'}<span className="text-[10px] font-bold text-zinc-500 ml-0.5">{set.weightUnit?.toUpperCase() ?? 'LBS'}</span>
                                </span>
                                <span className="text-zinc-700 mx-1">×</span>
                                <span className="text-sm font-black text-white">
                                  {set.actualReps ?? '--'}<span className="text-[10px] font-bold text-zinc-500 ml-0.5">REPS</span>
                                </span>
                              </div>
                            </div>

                            <div className="flex items-center gap-2">
                              {set.actualRPE && (
                                <span className="rounded-md bg-zinc-800/80 px-2 py-0.5 text-[9px] font-black tracking-wider text-zinc-400">
                                  RPE {set.actualRPE}
                                </span>
                              )}
                              {set.e1rm && (
                                <span className="text-[9px] font-mono text-emerald-500/60 font-bold uppercase tracking-wider">
                                  {Math.round(set.e1rm)} E1RM
                                </span>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                });
              })()}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {isNotesOpen && (
          <motion.div
            key="notes"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-zinc-950 px-6 pb-6 pt-[calc(env(safe-area-inset-top)+3rem)] flex flex-col"
          >
            <div className="flex items-center justify-between">
              <h3 className="text-white text-xl font-black">Set Notes</h3>
              <button
                type="button"
                onClick={() => setIsNotesOpen(false)}
                className="text-zinc-500 hover:text-white"
              >
                Close
              </button>
            </div>
            <div className="mt-6">
              <textarea
                value={notesDraft}
                onChange={(event) => setNotesDraft(event.target.value)}
                className="w-full resize-none rounded-2xl bg-zinc-900 p-4 text-lg text-white placeholder:text-zinc-600 focus:outline-none focus:ring-1 focus:ring-zinc-700"
                placeholder="Grip, setup, pain, technique cues, equipment..."
                rows={8}
              />
              {previousSetNote && (
                <div className="mt-4 rounded-2xl border border-zinc-800 bg-zinc-900/50 p-4">
                  <div className="mb-2 flex items-center justify-between gap-3">
                    <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-zinc-500">Previous Note</p>
                    <button
                      type="button"
                      onClick={() => setNotesDraft(previousSetNote)}
                      className="text-[10px] font-bold uppercase tracking-[0.2em] text-emerald-300 hover:text-emerald-200"
                    >
                      Use
                    </button>
                  </div>
                  <p className="text-sm leading-relaxed text-zinc-300">{previousSetNote}</p>
                </div>
              )}
              <div className="mt-4 flex justify-end">
                <button
                  type="button"
                  onClick={handleSaveNotes}
                  className="text-sm font-bold uppercase tracking-[0.2em] text-zinc-400 hover:text-white"
                >
                  Save
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {isAddMovementOpen && (
          <motion.div
            key="add-movement"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[60] bg-zinc-950 px-6 pb-6 pt-[calc(env(safe-area-inset-top)+4rem)] flex flex-col"
          >
            {pendingAddName !== null ? (
              /* ── Set-count step ── */
              <>
                <div className="flex items-center justify-between">
                  <button
                    type="button"
                    onClick={() => {
                      setPendingAddName(null);
                      setPendingAddExerciseId(null);
                    }}
                    className="text-zinc-500 active:opacity-60 transition-opacity"
                  >
                    ← Back
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setIsAddMovementOpen(false);
                      setPendingAddName(null);
                      setPendingAddExerciseId(null);
                    }}
                    className="text-zinc-500 hover:text-white"
                  >
                    Close
                  </button>
                </div>

                <div className="flex flex-1 flex-col items-center justify-center gap-10">
                  <div className="text-center">
                    <p className="text-xs font-mono uppercase tracking-[0.35em] text-zinc-500">Adding</p>
                    <p className="mt-2 text-2xl font-black text-white">{pendingAddName}</p>
                  </div>

                  <p className="text-sm text-zinc-400">How many sets?</p>

                  <div className="grid grid-cols-4 gap-3 w-full max-w-xs">
                    {[1, 2, 3, 4, 5, 6, 7, 8].map((n) => (
                      <button
                        key={n}
                        type="button"
                        onClick={() => setPendingSetCount(n)}
                        className={`rounded-2xl py-4 text-xl font-black transition-all active:scale-95 ${pendingSetCount === n
                          ? 'bg-emerald-500 text-zinc-950 shadow-lg shadow-emerald-500/30'
                          : 'bg-zinc-900 text-zinc-300'
                          }`}
                      >
                        {n}
                      </button>
                    ))}
                  </div>

                  <button
                    type="button"
                    onClick={() => handleAddExercise(pendingAddName, pendingSetCount, pendingAddExerciseId)}
                    className="w-full max-w-xs rounded-2xl bg-emerald-500 py-4 text-sm font-black uppercase tracking-[0.3em] text-zinc-950 shadow-lg shadow-emerald-500/20 active:scale-[0.98] transition-transform"
                  >
                    Add {pendingSetCount} Set{pendingSetCount !== 1 ? 's' : ''}
                  </button>
                </div>
              </>
            ) : (
              /* ── Exercise search step ── */
              <>
                <div className="flex items-center justify-between">
                  <h3 className="text-2xl font-black text-white">ADD MOVEMENT</h3>
                  <button
                    type="button"
                    onClick={() => {
                      setIsAddMovementOpen(false);
                      setPendingAddName(null);
                      setPendingAddExerciseId(null);
                    }}
                    className="text-zinc-500 hover:text-white"
                  >
                    Close
                  </button>
                </div>

                <div className="mt-6">
                  <input
                    ref={searchInputRef}
                    value={searchQuery}
                    onChange={(event) => setSearchQuery(event.target.value)}
                    placeholder="Search"
                    className="w-full bg-transparent text-3xl text-white placeholder:text-zinc-800 focus:outline-none"
                  />
                </div>

                <div className="mt-8 flex-1 overflow-y-auto">
                  {customExercisesLoading && (
                    <div className="mb-4 space-y-2">
                      {[0, 1, 2, 3].map((i) => (
                        <div key={i} className="h-[72px] rounded-2xl bg-zinc-900 animate-pulse" />
                      ))}
                    </div>
                  )}
                  {filteredExercises.map((exercise) => {
                    const style = getExerciseStyle(exercise, resolveMuscleProfile);
                    return (
                      <button
                        key={exercise.id}
                        type="button"
                        onClick={() => {
                          setPendingAddName(exercise.name);
                          setPendingAddExerciseId(exercise.id);
                          setPendingSetCount(3);
                        }}
                        className="w-full py-4 border-b border-zinc-900 text-left"
                      >
                        <div className="flex items-center gap-3 mb-1">
                          <ExerciseBadge style={style} />
                          <span
                            className={`text-xs font-bold tracking-[0.2em] ${style.isCompound ? 'bg-clip-text text-transparent' : ''
                              }`}
                            style={{
                              color: style.isCompound ? undefined : style.primaryColor,
                              backgroundImage: style.isCompound
                                ? `linear-gradient(120deg, ${style.primaryColor} 0%, ${style.secondaryColor} 100%)`
                                : undefined,
                            }}
                          >
                            {style.label}
                          </span>
                          <span
                            className="text-[9px] font-mono uppercase tracking-[0.35em]"
                            style={{ color: style.secondaryColor }}
                          >
                            {style.isCompound ? 'COMP' : 'ISO'}
                          </span>
                        </div>
                        <p className="text-white text-xl font-bold">{exercise.name}</p>
                      </button>
                    );
                  })}

                  {searchQuery.trim().length > 0 && filteredExercises.length === 0 && (
                    <button
                      type="button"
                      onClick={() => {
                        setPendingAddName(searchQuery.trim());
                        setPendingAddExerciseId(null);
                        setPendingSetCount(3);
                      }}
                      className="mt-6 text-emerald-400 text-lg font-semibold"
                    >
                      Create &quot;{searchQuery.trim()}&quot;
                    </button>
                  )}
                </div>
              </>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {isSummaryOpen && (
          <motion.div
            key="summary"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] bg-zinc-950 overflow-y-auto text-white scroll-smooth"
            data-swipe-ignore="true"
          >
            <div className="px-5 pb-[calc(11rem+env(safe-area-inset-bottom))] pt-[calc(env(safe-area-inset-top)+1.25rem)] sm:px-6 sm:pt-[calc(env(safe-area-inset-top)+3rem)]">
              <div className="mx-auto w-full max-w-xl">
                <div className="mb-4 flex justify-end">
                  <button
                    type="button"
                    onClick={handleCloseSummary}
                    disabled={isFinishingWorkout}
                    className="rounded-full border border-zinc-800 px-3 py-1.5 text-[10px] font-bold uppercase tracking-[0.22em] text-zinc-400 transition-colors hover:text-zinc-100 disabled:opacity-40"
                  >
                    Back
                  </button>
                </div>
                <p className="text-xs font-mono uppercase tracking-[0.4em] text-zinc-500 text-center">
                  SESSION REPORT
                </p>

                <div className="mt-5 grid gap-2 text-center sm:mt-8" data-testid="workout-summary-totals">
                  <p className="text-5xl font-black leading-none tracking-tight text-white sm:text-7xl">
                    {Math.round(sessionStats.totalVolume).toLocaleString()}
                    <span className="ml-2 align-baseline text-lg font-black italic text-zinc-500 sm:text-2xl">
                      {sessionWeightUnit.toUpperCase()}
                    </span>
                  </p>
                  <div className="mx-auto grid w-full max-w-sm grid-cols-2 divide-x divide-zinc-900 border-y border-zinc-900 py-2">
                    <div>
                      <p className="text-lg font-black italic text-zinc-100">{sessionStats.totalSets}</p>
                      <p className="text-[9px] font-bold uppercase tracking-[0.22em] text-zinc-500">Sets</p>
                    </div>
                    <div>
                      <p className="text-lg font-black italic text-zinc-100">{sessionStats.totalReps}</p>
                      <p className="text-[9px] font-bold uppercase tracking-[0.22em] text-zinc-500">Reps</p>
                    </div>
                  </div>
                </div>

                <div className="relative mb-6 mt-6 flex h-44 w-full items-center justify-center gap-[3px] sm:mb-8 sm:mt-8 sm:h-64">
                  {pulseBars.map((bar) => (
                    <div key={bar.key} className="relative z-10 flex-1 max-w-4 h-full flex items-center justify-center">
                      {bar.echoOffsets.map((offset, echoIndex) => (
                        <motion.div
                          key={`${bar.key}-echo-${echoIndex}`}
                          initial={{ height: 0, opacity: 0 }}
                          animate={{
                            height: `${bar.heightPercent * 0.95}%`,
                            opacity: bar.opacity * (0.3 - echoIndex * 0.08),
                          }}
                          transition={{ duration: 0.35, delay: 0.05 + echoIndex * 0.05 }}
                          className="absolute left-0 right-0 rounded-full"
                          style={{
                            top: '50%',
                            transform: `translateY(-50%) translateX(${offset}px)`,
                            filter: 'blur(6px)',
                            boxShadow: bar.echoGlow,
                            backgroundImage: bar.gradient,
                            WebkitMaskImage:
                              bar.maskPattern,
                            maskImage:
                              bar.maskPattern,
                            WebkitMaskSize: bar.maskSize,
                            maskSize: bar.maskSize,
                            WebkitMaskRepeat: 'repeat-y',
                            maskRepeat: 'repeat-y',
                          }}
                        />
                      ))}

                      {bar.heatIntensity > 0 && (
                        <div
                          className="absolute left-0 right-0 rounded-full"
                          style={{
                            top: '50%',
                            height: `${bar.heightPercent}%`,
                            transform: 'translateY(-50%)',
                            background: `radial-gradient(circle, ${bar.glow} 0%, rgba(0,0,0,0) 70%)`,
                            opacity: bar.heatIntensity * 0.6,
                            filter: 'blur(12px)',
                          }}
                        />
                      )}

                      <motion.div
                        initial={{ height: 0 }}
                        animate={{ height: `${bar.heightPercent}%` }}
                        transition={{ duration: 0.3 }}
                        className="relative w-full rounded-full"
                        style={{
                          opacity: bar.opacity,
                          boxShadow: bar.glowStyle,
                          backgroundImage: bar.gradient,
                          WebkitMaskImage:
                            bar.maskPattern,
                          maskImage:
                            bar.maskPattern,
                          WebkitMaskSize: bar.maskSize,
                          maskSize: bar.maskSize,
                          WebkitMaskRepeat: 'repeat-y',
                          maskRepeat: 'repeat-y',
                        }}
                      >
                        {bar.overflow > 0 && (
                          <div
                            className="absolute bottom-1 left-1/2 -translate-x-1/2 rounded-full px-1.5 py-0.5 text-[8px] font-mono tracking-wide text-white/80"
                            style={{
                              backgroundColor: 'rgba(0,0,0,0.45)',
                              boxShadow: `0 0 10px ${bar.glow}`,
                              border: '1px solid rgba(255,255,255,0.08)',
                            }}
                          >
                            +{bar.overflow}
                          </div>
                        )}
                      </motion.div>
                    </div>
                  ))}
                </div>

                {legendItems.length > 0 && (
                  <div className="mb-10 text-center">
                    <p className="text-[10px] font-mono uppercase tracking-[0.35em] text-zinc-600">
                      Muscle Map
                    </p>
                    <div className="mt-3 flex flex-wrap items-center justify-center gap-x-4 gap-y-2 text-[10px] uppercase tracking-[0.25em] text-zinc-500">
                      {legendItems.map((item) => (
                        <div key={item.key} className="flex items-center gap-2">
                          <ExerciseBadge
                            style={{
                              label: MUSCLE_LABELS[item.key],
                              primaryColor: MUSCLE_COLORS[item.key].color,
                              secondaryColor: MUSCLE_COLORS[item.key].color,
                              primaryGroup: item.key,
                              secondaryGroup: item.key,
                              isCompound: false,
                            }}
                          />
                          <span>{item.label}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {summarySmartRecommendations.length > 0 && (
                  <div className="mb-10" data-testid="next-session-adjustments">
                    <p className="text-center text-[10px] font-mono uppercase tracking-[0.35em] text-emerald-300">
                      Next Session Adjustments
                    </p>
                    <div className="mt-3 space-y-2">
                      {summarySmartRecommendations.map((recommendation) => (
                        <div
                          key={recommendation.id}
                          className="rounded-2xl border border-zinc-800 bg-zinc-950/80 px-4 py-3"
                        >
                          <div className="flex items-start justify-between gap-3">
                            <p className="text-sm font-black uppercase tracking-[0.16em] text-zinc-100">
                              {recommendation.title}
                            </p>
                            <p className="text-[9px] font-bold uppercase tracking-[0.2em] text-zinc-500">
                              {recommendation.confidence}
                            </p>
                          </div>
                          <p className="mt-2 text-xs leading-snug text-zinc-400">
                            {recommendation.reason}
                          </p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {projectedPrHits.length > 0 && (
                  <div className="mb-10">
                    <p className="text-center text-[10px] font-mono uppercase tracking-[0.35em] text-emerald-300">
                      Projected PRs
                    </p>
                    {isPrBaselineSyncing && (
                      <p className="mt-2 text-center text-[10px] font-mono uppercase tracking-[0.24em] text-zinc-500">
                        Syncing cloud baseline
                      </p>
                    )}
                    <div
                      className="mt-3 flex gap-2 overflow-x-auto pb-2 pr-6"
                      data-swipe-ignore="true"
                      style={{
                        WebkitMaskImage:
                          'linear-gradient(to right, rgba(0,0,0,1) 0%, rgba(0,0,0,1) 88%, rgba(0,0,0,0) 100%)',
                        maskImage:
                          'linear-gradient(to right, rgba(0,0,0,1) 0%, rgba(0,0,0,1) 88%, rgba(0,0,0,0) 100%)',
                        scrollbarWidth: 'none',
                        msOverflowStyle: 'none',
                      }}
                    >
                      {projectedPrHits.map((hit, index) => {
                        const shortName =
                          hit.exerciseName.length > 18
                            ? `${hit.exerciseName.slice(0, 16)}…`
                            : hit.exerciseName;
                        const displayValue =
                          hit.metric === 'max_reps'
                            ? hit.current
                            : convertWeight(hit.current, 'lbs', sessionWeightUnit);
                        return (
                          <div
                            key={`${hit.exerciseId}-${hit.metric}-${index}`}
                            className="whitespace-nowrap rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3 py-1.5 text-[10px] font-bold uppercase tracking-[0.18em] text-emerald-300"
                          >
                            {shortName} • {PR_METRIC_LABEL[hit.metric]} {formatProjectedPrValue(hit.metric, displayValue, sessionWeightUnit)}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {(finishStatusMessage || shareStatusMessage) && (
                  <p
                    className="mt-5 text-center text-[10px] font-bold uppercase tracking-[0.24em] text-zinc-500"
                    data-testid="workout-summary-status"
                  >
                    {finishStatusMessage || shareStatusMessage}
                  </p>
                )}
              </div>
            </div>

            <div className="fixed bottom-0 left-0 right-0 z-[110] bg-zinc-950/90 backdrop-blur-xl border-t border-zinc-900 px-6 pt-4 pb-[calc(1.5rem+env(safe-area-inset-bottom))] sm:pb-[calc(2.5rem+env(safe-area-inset-bottom))]">
              <div className="grid grid-cols-2 gap-4">
                <button
                  type="button"
                  onClick={handleShare}
                  disabled={isFinishingWorkout}
                  className="w-full rounded-2xl bg-zinc-900 py-4 text-xs font-bold uppercase tracking-[0.3em] text-zinc-200 transition-colors hover:bg-zinc-800 disabled:opacity-40"
                >
                  Share
                </button>
                <button
                  type="button"
                  onClick={handleFinishWorkout}
                  disabled={isFinishingWorkout}
                  className="w-full rounded-2xl bg-emerald-500 py-4 text-xs font-black uppercase tracking-[0.3em] text-zinc-950 shadow-lg shadow-emerald-500/20 transition-all hover:bg-emerald-400 disabled:cursor-wait disabled:opacity-65"
                >
                  {isFinishingWorkout ? (
                    <span className="flex items-center justify-center gap-2">
                      <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                      </svg>
                      Finishing...
                    </span>
                  ) : 'Complete Workout'}
                </button>
              </div>
            </div>

            <div className="mt-6 border-t border-zinc-900/50 pt-6 px-4 pb-2">
              <button
                type="button"
                onClick={handleCancelWorkout}
                disabled={isFinishingWorkout}
                className="w-full rounded-2xl border border-rose-500/20 bg-rose-500/10 py-4 text-xs font-bold uppercase tracking-[0.3em] text-rose-400 transition-colors hover:bg-rose-500/20 disabled:opacity-40"
              >
                Cancel & Discard Workout
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {activeInput && (
          <motion.div
            key="keypad"
            initial={{ y: 180, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 180, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed bottom-0 left-0 right-0 z-[200] bg-zinc-950/95 backdrop-blur-2xl border-t border-zinc-800 pb-safe"
          >
            <div className="px-4 pt-4 pb-[calc(env(safe-area-inset-bottom)+1rem)]">
              <div className="mb-3 flex items-center justify-between">
                <p className="text-[0.65rem] font-mono uppercase tracking-[0.4em] text-zinc-500">
                  {activeInput.field === 'weight' ? 'WEIGHT' : 'REPS'}
                </p>
                <button
                  type="button"
                  onClick={() => {
                    setActiveInput(null);
                    setKeypadValue('');
                    setKeypadArmed(false);
                  }}
                  className="rounded-full bg-zinc-800 px-4 py-2 text-xs font-bold uppercase tracking-[0.25em] text-zinc-200 hover:bg-zinc-700 transition-colors"
                >
                  Done
                </button>
              </div>

              <div className="grid grid-cols-3 gap-2">
                {KEYPAD_KEYS.map((key) => (
                  <button
                    key={key}
                    type="button"
                    onClick={() => handleKeypadPress(key)}
                    className="h-16 rounded-2xl bg-zinc-900 text-2xl font-black text-white active:scale-[0.98] transition-transform"
                  >
                    {key === 'del' ? 'DEL' : key}
                  </button>
                ))}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <style jsx>{`
        .data-stream::-webkit-scrollbar {
          display: none;
        }
      `}</style>
    </>
  );
}
