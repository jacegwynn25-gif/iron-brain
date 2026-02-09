'use client';

import { useEffect, useMemo, useRef, useState, type TouchEvent } from 'react';
import { useRouter } from 'next/navigation';
import { AnimatePresence, motion } from 'framer-motion';
import {
  Activity,
  ArrowLeft,
  ArrowDown,
  ArrowUp,
  Dumbbell,
  FileText,
  History,
  Plus,
  Trash2,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import type { ProgramTemplate } from '@/app/lib/types';
import type { SetLog, WorkoutSession } from '@/app/lib/types';
import type { ActiveCell, Block, Exercise, Set as SessionSet } from '@/app/lib/types/session';
import { useRecoveryState } from '@/app/lib/hooks/useRecoveryState';
import { useWorkoutSession } from '@/app/lib/hooks/useWorkoutSession';
import { useAuth } from '@/app/lib/supabase/auth-context';
import { supabase } from '@/app/lib/supabase/client';
import { resolveExerciseIds } from '@/app/lib/supabase/workouts';
import HardyStepper from '@/app/components/workout/controls/HardyStepper';
import RpeSlider from '@/app/components/workout/controls/RpeSlider';
import RestTimer from '@/app/components/RestTimer';
import { saveWorkout, storage } from '@/app/lib/storage';
import { createUuid, isValidUuid } from '@/app/lib/uuid';
import { rpeAdjusted1RM } from '@/app/lib/stats/one-rep-max';
import { convertWeight } from '@/app/lib/units';

type ViewMode = 'overview' | 'cockpit' | 'rest';

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

type CommonExercise = {
  id: string;
  name: string;
  target: 'push' | 'pull' | 'legs' | 'core';
};

type MuscleGroup =
  | 'chest'
  | 'shoulders'
  | 'triceps'
  | 'biceps'
  | 'back'
  | 'quads'
  | 'hamstrings'
  | 'glutes'
  | 'calves'
  | 'core'
  | 'other';

type ExerciseIdentity = Pick<Exercise, 'id' | 'name'>;

const COMMON_EXERCISES: CommonExercise[] = [
  { id: 'back_squat', name: 'Back Squat', target: 'legs' },
  { id: 'deadlift', name: 'Deadlift', target: 'legs' },
  { id: 'bench_press', name: 'Bench Press', target: 'push' },
  { id: 'overhead_press', name: 'Overhead Press', target: 'push' },
  { id: 'pull_up', name: 'Pull-up', target: 'pull' },
  { id: 'chin_up', name: 'Chin-up', target: 'pull' },
  { id: 'barbell_row', name: 'Barbell Row', target: 'pull' },
  { id: 'dumbbell_row', name: 'Dumbbell Row', target: 'pull' },
  { id: 'lat_pulldown', name: 'Lat Pulldown', target: 'pull' },
  { id: 'dips', name: 'Dip', target: 'push' },
  { id: 'tricep_extension', name: 'Tricep Extension', target: 'push' },
  { id: 'bicep_curl', name: 'Bicep Curl', target: 'pull' },
  { id: 'leg_press', name: 'Leg Press', target: 'legs' },
  { id: 'lunges', name: 'Lunge', target: 'legs' },
  { id: 'split_squat', name: 'Split Squat', target: 'legs' },
  { id: 'calf_raise', name: 'Calf Raise', target: 'legs' },
  { id: 'hip_thrust', name: 'Hip Thrust', target: 'legs' },
  { id: 'leg_extension', name: 'Leg Extension', target: 'legs' },
  { id: 'leg_curl', name: 'Leg Curl', target: 'legs' },
  { id: 'face_pull', name: 'Face Pull', target: 'pull' },
  { id: 'lateral_raise', name: 'Lateral Raise', target: 'push' },
  { id: 'plank', name: 'Plank', target: 'core' },
  { id: 'ab_wheel', name: 'Ab Wheel', target: 'core' },
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

const MUSCLE_BLEND_BY_ID: Record<string, [MuscleGroup, MuscleGroup]> = {
  bench_press: ['chest', 'triceps'],
  dips: ['chest', 'triceps'],
  overhead_press: ['shoulders', 'triceps'],
  pull_up: ['back', 'biceps'],
  chin_up: ['back', 'biceps'],
  barbell_row: ['back', 'biceps'],
  dumbbell_row: ['back', 'biceps'],
  lat_pulldown: ['back', 'biceps'],
  face_pull: ['back', 'biceps'],
  back_squat: ['quads', 'glutes'],
  split_squat: ['quads', 'glutes'],
  lunges: ['quads', 'glutes'],
  leg_press: ['quads', 'glutes'],
  leg_extension: ['quads', 'glutes'],
  deadlift: ['hamstrings', 'glutes'],
  hip_thrust: ['glutes', 'hamstrings'],
  leg_curl: ['hamstrings', 'glutes'],
};

const MUSCLE_PRIMARY_BY_ID: Record<string, MuscleGroup> = {
  lateral_raise: 'shoulders',
  tricep_extension: 'triceps',
  bicep_curl: 'biceps',
  calf_raise: 'calves',
  plank: 'core',
  ab_wheel: 'core',
};

const resolveMuscleBlend = (exercise: Exercise): { primary: MuscleGroup; secondary?: MuscleGroup } => {
  if (MUSCLE_BLEND_BY_ID[exercise.id]) {
    const [primary, secondary] = MUSCLE_BLEND_BY_ID[exercise.id];
    return { primary, secondary };
  }
  if (MUSCLE_PRIMARY_BY_ID[exercise.id]) {
    return { primary: MUSCLE_PRIMARY_BY_ID[exercise.id] };
  }

  const name = exercise.name.toLowerCase();
  if (name.includes('bench') || name.includes('chest') || name.includes('dip')) {
    return { primary: 'chest', secondary: 'triceps' };
  }
  if (name.includes('overhead') || name.includes('shoulder press') || name.includes('press')) {
    if (name.includes('leg press')) {
      return { primary: 'quads', secondary: 'glutes' };
    }
    return { primary: 'shoulders', secondary: 'triceps' };
  }
  if (name.includes('squat') || name.includes('leg press') || name.includes('lunge') || name.includes('split squat')) {
    return { primary: 'quads', secondary: 'glutes' };
  }
  if (name.includes('deadlift') || name.includes('rdl')) {
    return { primary: 'hamstrings', secondary: 'glutes' };
  }
  if (name.includes('row') || name.includes('pull') || name.includes('lat') || name.includes('chin')) {
    return { primary: 'back', secondary: 'biceps' };
  }
  if (name.includes('tricep')) return { primary: 'triceps' };
  if (name.includes('bicep') || name.includes('curl')) return { primary: 'biceps' };
  if (name.includes('calf')) return { primary: 'calves' };
  if (name.includes('plank') || name.includes('ab ') || name.includes('core') || name.includes('hanging leg')) {
    return { primary: 'core' };
  }
  if (name.includes('hip thrust') || name.includes('glute')) return { primary: 'glutes' };
  if (name.includes('hamstring') || name.includes('leg curl')) return { primary: 'hamstrings' };

  const normalizedName = name;
  const foundTarget = COMMON_EXERCISES.find(
    (entry) => entry.id === exercise.id || entry.name.toLowerCase() === normalizedName
  )?.target;
  if (foundTarget === 'core') return { primary: 'core' };
  if (foundTarget === 'legs') return { primary: 'quads', secondary: 'glutes' };
  if (foundTarget === 'pull') return { primary: 'back', secondary: 'biceps' };
  if (foundTarget === 'push') return { primary: 'chest', secondary: 'triceps' };

  return { primary: 'other' };
};

function createQuickStartProgram(): ProgramTemplate {
  return {
    id: 'qs',
    name: 'Quick Start',
    isCustom: true,
    weeks: [],
  };
}

type ExerciseStyle = {
  icon: LucideIcon;
  label: string;
  primaryColor: string;
  secondaryColor: string;
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

const formatProjectedPrValue = (metric: PrMetric, value: number): string => {
  if (metric === 'max_reps') return `${Math.round(value)}`;
  if (metric === 'max_volume') return `${Math.round(value).toLocaleString()}LBS`;
  return `${Math.round(value).toLocaleString()}LBS`;
};

const ExerciseBadge = ({ icon: Icon, style }: { icon: LucideIcon; style: ExerciseStyle }) => {
  const ringStyle = style.isCompound
    ? { backgroundImage: `linear-gradient(135deg, ${style.primaryColor}, ${style.secondaryColor})` }
    : { backgroundColor: style.primaryColor };
  const glowColor = style.isCompound ? style.secondaryColor : style.primaryColor;

  return (
    <span className="inline-flex rounded-full p-[1px]" style={ringStyle}>
      <span
        className="inline-flex h-4 w-4 items-center justify-center rounded-full bg-zinc-950"
        style={{ boxShadow: `0 0 10px ${glowColor}55` }}
      >
        <Icon className="h-3.5 w-3.5" style={{ color: style.primaryColor }} />
      </span>
    </span>
  );
};

const MUSCLE_ICONS: Record<MuscleGroup, LucideIcon> = {
  chest: ArrowUp,
  shoulders: ArrowUp,
  triceps: ArrowUp,
  biceps: ArrowDown,
  back: ArrowDown,
  quads: Activity,
  hamstrings: Activity,
  glutes: Activity,
  calves: Activity,
  core: Activity,
  other: Dumbbell,
};

const getExerciseStyle = (exercise: ExerciseIdentity): ExerciseStyle => {
  const { primary, secondary } = resolveMuscleBlend(exercise as Exercise);
  const primaryKey = MUSCLE_COLORS[primary] ? primary : 'other';
  const secondaryKey = secondary && MUSCLE_COLORS[secondary] ? secondary : primaryKey;
  const primaryPalette = MUSCLE_COLORS[primaryKey];
  const secondaryPalette = MUSCLE_COLORS[secondaryKey];
  const isCompound = secondaryKey !== primaryKey;
  return {
    icon: MUSCLE_ICONS[primaryKey] ?? Dumbbell,
    label: MUSCLE_LABELS[primaryKey] ?? 'LIFT',
    primaryColor: primaryPalette.color,
    secondaryColor: secondaryPalette.color,
    isCompound,
  };
};

const isBodyweight = (name: string): boolean => {
  const lower = name.toLowerCase();
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

const getRestDurationSeconds = (exercise: Exercise): number => {
  const { primary, secondary } = resolveMuscleBlend(exercise);
  const isCompound = Boolean(secondary);
  if (isCompound) return COMPOUND_REST_SECONDS;
  if (primary === 'core') return CORE_REST_SECONDS;
  if (primary === 'calves' || primary === 'biceps' || primary === 'triceps' || primary === 'shoulders') {
    return SMALL_ISO_REST_SECONDS;
  }
  return ISOLATION_REST_SECONDS;
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

type SessionLoggerProps = {
  initialData?: ProgramTemplate;
};

export default function SessionLogger({ initialData }: SessionLoggerProps) {
  const router = useRouter();
  const { user } = useAuth();
  const { readiness } = useRecoveryState();
  const readinessModifier = readiness?.modifier ?? 0.85;
  const readinessScore = readiness?.score ?? 35;

  const initialProgram = useMemo(() => initialData ?? createQuickStartProgram(), [initialData]);
  const {
    state: session,
    dispatch,
    toggleComplete,
    addSet,
    updateNote,
    addExercise,
    removeExercise,
    setActiveCell,
  } = useWorkoutSession(initialProgram, readinessModifier);

  const [viewMode, setViewMode] = useState<ViewMode>('overview');
  const [focusedExerciseId, setFocusedExerciseId] = useState<string | null>(null);
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
  const [isNotesOpen, setIsNotesOpen] = useState(false);
  const [activeInput, setActiveInput] = useState<{
    blockId: string;
    setId: string;
    field: 'weight' | 'reps';
  } | null>(null);
  const [isSummaryOpen, setIsSummaryOpen] = useState(false);
  const [isAddMovementOpen, setIsAddMovementOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [notesDraft, setNotesDraft] = useState('');
  const [, setKeypadValue] = useState('');
  const [keypadArmed, setKeypadArmed] = useState(false);
  const [revealedId, setRevealedId] = useState<string | null>(null);
  const [pendingExerciseName, setPendingExerciseName] = useState<string | null>(null);
  const [cloudPrBaseline, setCloudPrBaseline] = useState<Record<string, PrBaseline>>({});
  const [isPrBaselineSyncing, setIsPrBaselineSyncing] = useState(false);
  const [restContext, setRestContext] = useState<{
    blockId: string;
    exerciseId: string;
    setId: string;
    wasLastSet: boolean;
    wasEditing: boolean;
  } | null>(null);
  const overviewScrollRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const swipeStartRef = useRef<{ x: number; y: number } | null>(null);
  const viewHistoryRef = useRef<ViewMode[]>(['overview']);
  const isBackNavRef = useRef(false);
  const saveInFlightRef = useRef(false);

  const calculateSessionStats = (blocks: Block[]) => {
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
          if (weight > maxLoadedWeight) {
            maxLoadedWeight = weight;
          }
        });
      });
    });

    const bodyweightBaseline = Math.max(65, maxLoadedWeight * 0.6);

    blocks.forEach((block) => {
      block.exercises.forEach((exercise) => {
        const { primary, secondary } = resolveMuscleBlend(exercise);
        const bodyweightExercise = isBodyweight(exercise.name);
        exercise.sets.forEach((set) => {
          if (!set.completed) return;
          const weight = Number(set.weight) || 0;
          const reps = set.reps === null || set.reps === undefined ? 8 : Number(set.reps);
          const effectiveWeight = weight > 0 ? weight : bodyweightExercise ? bodyweightBaseline : 0;
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
  };

  const sessionStats = useMemo(() => calculateSessionStats(session.blocks), [session.blocks]);
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
          console.error('Failed to load cloud PR baseline:', error);
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
      } catch (error) {
        console.error('Unexpected PR baseline sync error:', error);
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
          const e1rm =
            weight > 0 ? Number(rpeAdjusted1RM(weight, reps, set.rpe ?? null) || 0) : 0;
          const volume = weight > 0 ? weight * reps : 0;

          const current = currentByExercise.get(exercise.id) ?? {
            exerciseName: exercise.name,
            maxWeight: 0,
            maxReps: 0,
            maxE1RM: 0,
            maxVolume: 0,
          };

          current.maxWeight = Math.max(current.maxWeight, weight);
          current.maxReps = Math.max(current.maxReps, reps);
          current.maxE1RM = Math.max(current.maxE1RM, e1rm);
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
  }, [cloudPrBaseline, isSummaryOpen, session.blocks]);
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

  useEffect(() => {
    setActiveInput(null);
    setKeypadValue('');
    setKeypadArmed(false);
  }, [viewMode]);

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
    setNotesDraft(focusContext.exercise.notes ?? '');
  }, [focusContext]);

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

  const handleLogSet = () => {
    if (!focusContext) return;

    const setIndex = focusContext.exercise.sets.findIndex((set) => set.id === focusContext.setId);
    const wasLastSet = setIndex === focusContext.exercise.sets.length - 1;
    const wasEditing = focusContext.set.completed;

    setRestContext({
      blockId: focusContext.blockId,
      exerciseId: focusContext.exerciseId,
      setId: focusContext.setId,
      wasLastSet,
      wasEditing,
    });

    if (!wasEditing) {
      toggleComplete(focusContext.blockId, focusContext.exerciseId, focusContext.setId);
    }
    setViewMode('rest');
  };

  const handleContinue = (forceOverview = false) => {
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

  const handleBackNavigation = () => {
    if (isSummaryOpen) {
      setIsSummaryOpen(false);
      return;
    }
    if (isNotesOpen) {
      setIsNotesOpen(false);
      return;
    }
    if (isHistoryOpen) {
      setIsHistoryOpen(false);
      return;
    }
    if (isAddMovementOpen) {
      setIsAddMovementOpen(false);
      return;
    }
    if (activeInput) {
      setActiveInput(null);
      setKeypadValue('');
      setKeypadArmed(false);
      return;
    }
    if (revealedId) {
      setRevealedId(null);
      return;
    }

    const history = viewHistoryRef.current;
    if (history.length <= 1) return;
    history.pop();
    const previous = history[history.length - 1];
    isBackNavRef.current = true;
    setViewMode(previous);
    if (previous === 'overview') {
      setFocusedExerciseId(null);
    }
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
      updateNote(focusContext.blockId, focusContext.exerciseId, notesDraft);
    }
    setIsNotesOpen(false);
  };

  const buildWorkoutSession = (): WorkoutSession => {
    const now = new Date();
    const startTime = session.startTime ?? now;
    const date = startTime.toISOString().split('T')[0];
    const sessionId = `session_${createUuid()}`;
    const programId = initialProgram?.id ?? 'quick_start';
    const programName = initialProgram?.name ?? 'Quick Start';

    const sets: SetLog[] = [];
    session.blocks.forEach((block) => {
      block.exercises.forEach((exercise) => {
        const bodyweightExercise = isBodyweight(exercise.name);
        exercise.sets.forEach((set, index) => {
          const reps = set.reps === null || set.reps === undefined ? 8 : Number(set.reps);
          const weight = Number(set.weight) || 0;
          const volumeLoad = weight > 0 && reps > 0 ? weight * reps : null;
          const e1rm =
            weight > 0 && reps > 0 ? rpeAdjusted1RM(weight, reps, set.rpe ?? null) : null;

          sets.push({
            id: set.id,
            exerciseId: exercise.id,
            exerciseName: exercise.name,
            setIndex: index + 1,
            prescribedReps: String(reps),
            prescribedRPE: set.rpe ?? null,
            actualWeight: weight || null,
            weightUnit: 'lbs',
            loadType: bodyweightExercise && weight === 0 ? 'bodyweight' : 'absolute',
            actualReps: reps,
            actualRPE: set.rpe ?? null,
            completed: set.completed === true,
            e1rm: e1rm ? Math.round(e1rm) : null,
            volumeLoad,
            setType: mapSetType(set.type),
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
      id: sessionId,
      programId,
      programName,
      cycleNumber: 1,
      weekNumber: 1,
      dayOfWeek: '',
      dayName: programName,
      date,
      startTime: startTime.toISOString(),
      endTime: now.toISOString(),
      durationMinutes: Math.max(1, Math.round((now.getTime() - startTime.getTime()) / 60000)),
      sets,
      totalVolumeLoad,
      averageRPE,
      createdAt: now.toISOString(),
      updatedAt: now.toISOString(),
    };
  };

  const handleFinishWorkout = async () => {
    if (saveInFlightRef.current) {
      return;
    }
    saveInFlightRef.current = true;
    try {
      const payload = buildWorkoutSession();
      const saveResult = await saveWorkout(payload, undefined, { skipAnalytics: true });
      if (saveResult.newPersonalRecords.length > 0 && typeof window !== 'undefined') {
        localStorage.setItem(
          'iron_brain_last_pr_hits',
          JSON.stringify({
            createdAt: new Date().toISOString(),
            hits: saveResult.newPersonalRecords,
          })
        );
      }
    } finally {
      saveInFlightRef.current = false;
      router.push('/');
    }
  };

  const handleShare = async () => {
    const text = `IRON BRAIN SESSION\nVolume: ${sessionStats.totalVolume.toLocaleString()} LBS\nSets: ${sessionStats.totalSets}\nReps: ${sessionStats.totalReps}\n\nCompleted with Iron Brain app.`;
    if (navigator.share) {
      try {
        await navigator.share({ title: 'Iron Brain Session', text });
      } catch {
        // no-op
      }
      return;
    }

    try {
      await navigator.clipboard.writeText(text);
    } catch {
      // no-op
    }
  };

  const handleAddExercise = (name: string) => {
    addExercise(name);
    setPendingExerciseName(name);
    setIsAddMovementOpen(false);
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
  const repsValue = focusContext?.set.reps ?? 8;
  const rpeValue = focusContext?.set.rpe ?? null;
  const bodyweightExercise = focusedRef ? isBodyweight(focusedRef.exercise.name) : false;
  const isWeightActive = activeInput?.field === 'weight';
  const isRepsActive = activeInput?.field === 'reps';
  const isEditingSet = Boolean(focusContext?.set.completed);

  const nextSetIndex = nextSetContext
    ? nextSetContext.exercise.sets.findIndex((set) => set.id === nextSetContext.set.id)
    : null;
  const nextSetNumber = (nextSetIndex ?? 0) + 1;
  const restDurationSeconds = useMemo(() => {
    if (!restContext) return DEFAULT_REST_SECONDS;
    const block = session.blocks.find((entry) => entry.id === restContext.blockId);
    const exercise = block?.exercises.find((entry) => entry.id === restContext.exerciseId);
    if (!exercise) return DEFAULT_REST_SECONDS;
    return getRestDurationSeconds(exercise);
  }, [restContext, session.blocks]);

  const filteredExercises = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    if (!query) return COMMON_EXERCISES;
    return COMMON_EXERCISES.filter((exercise) => exercise.name.toLowerCase().includes(query));
  }, [searchQuery]);

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

  const shouldIgnoreSwipe = (target: EventTarget | null) => {
    if (!(target instanceof Element)) return false;
    if (target.closest('[data-swipe-ignore="true"]')) return true;
    if (target.closest('input, textarea, select')) return true;
    return false;
  };

  const handleSwipeStart = (event: TouchEvent) => {
    if (shouldIgnoreSwipe(event.target)) {
      swipeStartRef.current = null;
      return;
    }
    const touch = event.touches[0];
    if (!touch) return;
    swipeStartRef.current = { x: touch.clientX, y: touch.clientY };
  };

  const handleSwipeEnd = (event: TouchEvent) => {
    const start = swipeStartRef.current;
    swipeStartRef.current = null;
    if (!start) return;
    const touch = event.changedTouches[0];
    if (!touch) return;
    const dx = touch.clientX - start.x;
    const dy = touch.clientY - start.y;
    if (dx < -60 && Math.abs(dx) > Math.abs(dy) * 1.3) {
      handleBackNavigation();
    }
  };

  return (
    <>
      <div
        className="relative w-full h-[100dvh] bg-zinc-950 text-white flex flex-col overflow-hidden"
        onTouchStart={handleSwipeStart}
        onTouchEnd={handleSwipeEnd}
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
            className="flex-1 w-full overflow-y-auto pb-20 space-y-8"
            ref={overviewScrollRef}
          >
              <div className="px-4 pt-12 pb-4">
                <p className="text-zinc-500 text-xs uppercase tracking-[0.25em]">Session Readiness</p>
                <p className="text-6xl font-black text-white">{Math.round(readinessScore)}</p>
              </div>

              <div
                className="space-y-6 px-4"
                onClick={() => setRevealedId(null)}
              >
                {exerciseRefs.map((entry) => {
                  const style = getExerciseStyle(entry.exercise);
                  const StyleIcon = style.icon;
                  const isRevealed = revealedId === entry.exercise.id;
                  const bodyweightExercise = isBodyweight(entry.exercise.name);

                  return (
                    <div key={entry.exercise.id} className="relative overflow-hidden rounded-2xl">
                      <button
                        type="button"
                        onClick={() => handleRemoveExercise(entry.blockId, entry.exercise.id)}
                        onPointerDown={(event) => event.stopPropagation()}
                        className="absolute inset-y-0 right-0 flex w-20 items-center justify-center bg-rose-600/90"
                        aria-label={`Delete ${entry.exercise.name}`}
                      >
                        <Trash2 className="h-5 w-5 text-white" />
                      </button>
                      <motion.div
                        drag="x"
                        dragConstraints={{ left: -80, right: 0 }}
                        dragElastic={0.08}
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
                          className="group relative w-full text-left rounded-2xl bg-zinc-950"
                        >
                          <div className="flex flex-col gap-3 p-1">
                            <div>
                              <div className="mb-1 flex items-center gap-2">
                                <ExerciseBadge icon={StyleIcon} style={style} />
                                <span
                                  className={`text-xs font-bold tracking-[0.2em] ${
                                    style.isCompound ? 'bg-clip-text text-transparent' : ''
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
                              <p className="text-3xl font-black italic text-white">{entry.exercise.name}</p>
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
                                    className={`whitespace-nowrap rounded-md border px-3 py-1.5 text-xs font-mono ${
                                      set.completed
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
                  onClick={() => setIsAddMovementOpen(true)}
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
                    setIsSummaryOpen(true);
                  }}
                  className="w-full bg-emerald-500 text-zinc-950 font-black tracking-widest uppercase py-4 rounded-2xl shadow-lg shadow-emerald-500/20"
                >
                  Finish Workout
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
              className="flex-1 w-full flex flex-col overflow-hidden relative select-none touch-none pb-32"
            >
            <header className="mb-6 flex items-center gap-4 px-4">
              <button
                type="button"
                onClick={() => {
                  setViewMode('overview');
                  setFocusedExerciseId(null);
                }}
                className="inline-flex items-center text-zinc-400 transition-colors hover:text-white"
              >
                <ArrowLeft className="h-4 w-4" />
                <span className="sr-only">Back</span>
              </button>

              <div>
                {focusedRef && (() => {
                  const style = getExerciseStyle(focusedRef.exercise);
                  const StyleIcon = style.icon;
                  return (
                    <div className="mb-1 flex items-center gap-2">
                      <ExerciseBadge icon={StyleIcon} style={style} />
                      <span
                        className={`text-xs font-bold tracking-[0.2em] ${
                          style.isCompound ? 'bg-clip-text text-transparent' : ''
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
                <h2 className="text-4xl font-black text-white">{focusedRef?.exercise.name ?? 'Exercise'}</h2>
              </div>
            </header>

            <div className="px-4 mt-6">
              <div className="flex flex-col justify-center gap-6">
                <div className="flex items-center justify-between">
                  <p className="text-zinc-500 text-xs uppercase">Current Set</p>
                  <p className="text-zinc-500 text-xs">Prev {focusContext?.set.previous ?? '--'}</p>
                </div>

                <div className={`grid gap-6 ${bodyweightExercise ? 'grid-cols-1' : 'grid-cols-2'}`}>
                  {!bodyweightExercise && (
                    <HardyStepper
                      layout="vertical"
                      value={weightValue}
                      onChange={handleWeightChange}
                      step={0.5}
                      label="LBS"
                      valueClassName={isWeightActive ? 'text-emerald-400' : undefined}
                      onLabelClick={() => openKeypad('weight')}
                    />
                  )}

                  <HardyStepper
                    layout="vertical"
                    value={repsValue}
                    onChange={handleRepsChange}
                    step={1}
                    label="REPS"
                    valueClassName={isRepsActive ? 'text-emerald-400' : undefined}
                    onLabelClick={() => openKeypad('reps')}
                  />
                </div>

                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <p className="text-zinc-100 text-sm font-bold">RPE {rpeValue?.toFixed(1) ?? '--'}</p>
                    <p className="text-zinc-400 text-sm">RIR {rpeValue == null ? '--' : Math.max(0, Math.round((10 - rpeValue) * 10) / 10)}</p>
                  </div>
                  <div>
                    <RpeSlider value={rpeValue} onChange={handleRpeChange} />
                  </div>
                </div>
              </div>
            </div>

            <footer className="w-full px-4 mt-12">
              <div className="w-full h-20 bg-zinc-900/80 rounded-[2.5rem] flex items-center p-2 backdrop-blur-md">
                <button
                  type="button"
                  onClick={() => setIsHistoryOpen(true)}
                  className="flex-1 h-full flex items-center justify-center rounded-2xl text-zinc-400 hover:bg-zinc-800/50 transition-colors active:scale-95 cursor-pointer"
                >
                  <History className="w-7 h-7" />
                </button>

                <button
                  type="button"
                  onClick={handleLogSet}
                  disabled={!focusContext}
                  className="flex-[2] mx-2 h-full bg-emerald-500 hover:bg-emerald-400 rounded-2xl flex items-center justify-center text-zinc-950 font-black text-xl tracking-wider shadow-lg shadow-emerald-500/20 active:scale-[0.98] transition-all cursor-pointer disabled:opacity-40"
                >
                  {isEditingSet ? 'SAVE CHANGES' : 'LOG SET'}
                </button>

                <button
                  type="button"
                  onClick={handleOpenNotes}
                  className="flex-1 h-full flex items-center justify-center rounded-2xl text-zinc-400 hover:bg-zinc-800/50 transition-colors active:scale-95 cursor-pointer"
                >
                  <FileText className="w-7 h-7" />
                </button>
              </div>
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
                  exerciseName: nextSetContext?.exercise.name,
                  setNumber: nextSetNumber,
                  weight: nextSetContext?.set.weight ?? undefined,
                  reps: nextSetContext?.set.reps ?? undefined,
                }}
                isLastSetOfExercise={Boolean(restContext?.wasLastSet && !restContext?.wasEditing)}
              />
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <AnimatePresence>
        {isHistoryOpen && (
          <motion.div
            key="history"
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 16 }}
            className="fixed inset-0 z-50 bg-zinc-950 px-6 pb-6 pt-[calc(env(safe-area-inset-top)+3rem)]"
          >
            <div className="flex items-center justify-between">
              <p className="text-white text-xl font-black">History</p>
              <button
                type="button"
                onClick={() => setIsHistoryOpen(false)}
                className="text-zinc-500 hover:text-white"
              >
                Close
              </button>
            </div>
            <div className="mt-6">
              {(focusedRef?.exercise.sets ?? []).map((set, index) => (
                <div key={set.id} className="border-b border-zinc-900 py-4">
                  <p className="text-white font-bold">{set.previous ?? `Set ${index + 1}`}</p>
                  <p className="text-zinc-400 text-sm uppercase tracking-[0.2em]">Type: {set.type}</p>
                </div>
              ))}
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
              <h3 className="text-white text-xl font-black">Session Notes</h3>
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
                placeholder="Add notes for this exercise..."
                rows={8}
              />
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
            <div className="flex items-center justify-between">
              <h3 className="text-2xl font-black text-white">ADD MOVEMENT</h3>
              <button
                type="button"
                onClick={() => setIsAddMovementOpen(false)}
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
              {filteredExercises.map((exercise) => {
                const style = getExerciseStyle(exercise);
                const StyleIcon = style.icon;
                return (
                  <button
                    key={exercise.id}
                    type="button"
                  onClick={() => handleAddExercise(exercise.name)}
                    className="w-full py-4 border-b border-zinc-900 text-left"
                  >
                    <div className="flex items-center gap-3 mb-1">
                      <ExerciseBadge icon={StyleIcon} style={style} />
                      <span
                        className={`text-xs font-bold tracking-[0.2em] ${
                          style.isCompound ? 'bg-clip-text text-transparent' : ''
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
                  onClick={() => handleAddExercise(searchQuery.trim())}
                  className="mt-6 text-emerald-400 text-lg font-semibold"
                >
                  Create &quot;{searchQuery.trim()}&quot;
                </button>
              )}
            </div>
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
            className="fixed inset-0 z-[100] bg-zinc-950 overflow-y-auto text-white"
          >
            <div className="pt-[calc(env(safe-area-inset-top)+3rem)] px-6 pb-[calc(8rem+env(safe-area-inset-bottom))]">
              <div className="mx-auto w-full max-w-xl">
                <p className="text-xs font-mono uppercase tracking-[0.4em] text-zinc-500 text-center">
                  SESSION REPORT
                </p>
                <div className="relative h-64 w-full flex items-center justify-center gap-[3px] mb-8 mt-8">
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
                          <span
                            className="h-2 w-2 rounded-full"
                            style={{
                              backgroundColor: MUSCLE_COLORS[item.key].color,
                              boxShadow: `0 0 8px ${MUSCLE_COLORS[item.key].glow}`,
                            }}
                          />
                          <span>{item.label}</span>
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
                        return (
                          <div
                            key={`${hit.exerciseId}-${hit.metric}-${index}`}
                            className="whitespace-nowrap rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3 py-1.5 text-[10px] font-bold uppercase tracking-[0.18em] text-emerald-300"
                          >
                            {shortName} • {PR_METRIC_LABEL[hit.metric]} {formatProjectedPrValue(hit.metric, hit.current)}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                <div className="grid gap-2 text-center">
                  <p className="text-7xl font-black bg-gradient-to-br from-white to-zinc-500 bg-clip-text text-transparent">
                    {sessionStats.totalVolume.toLocaleString()} LBS
                  </p>
                  <p className="text-xs font-mono uppercase tracking-[0.4em] text-zinc-500">
                    {sessionStats.totalSets} SETS
                  </p>
                </div>
              </div>
            </div>

            <div className="fixed bottom-0 left-0 right-0 z-[110] bg-zinc-950 border-t border-zinc-900 px-6 pt-4 pb-[calc(2.5rem+env(safe-area-inset-bottom))]">
              <div className="grid grid-cols-2 gap-4">
                <button
                  type="button"
                  onClick={handleShare}
                  className="w-full rounded-2xl bg-zinc-900 py-4 text-xs font-bold uppercase tracking-[0.3em] text-zinc-200 hover:bg-zinc-800 transition-colors"
                >
                  Share
                </button>
                <button
                  type="button"
                  onClick={handleFinishWorkout}
                  className="w-full rounded-2xl bg-emerald-500 py-4 text-xs font-black uppercase tracking-[0.3em] text-zinc-950 shadow-lg shadow-emerald-500/20 hover:bg-emerald-400 transition-all"
                >
                  Finish
                </button>
              </div>
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
            <div className="px-4 pt-4 pb-[calc(env(safe-area-inset-bottom)+1rem)] touch-none">
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
