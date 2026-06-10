'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import {
  ArrowLeft,
  Check,
  ChevronLeft,
  ChevronRight,
  CirclePlus,
  Copy,
  Dumbbell,
  MoreHorizontal,
  Pencil,
  Play,
  Search,
  Settings2,
  X,
  Trash2,
} from 'lucide-react';
import { defaultExercises } from '@/app/lib/programs';
import { createCustomExercise, getCustomExercises, getLocalCustomExercises } from '@/app/lib/exercises/custom-exercises';
import { inferCustomExerciseDefaults } from '@/app/lib/exercises/catalog';
import { getProgramProgress } from '@/app/lib/programs/progress';
import { blocksToProgramSets, setsToProgramBlocks } from '@/app/lib/programs/structure';
import type {
  CustomExercise,
  DayTemplate,
  ProgramBlockExerciseTemplate,
  ProgramBlockTemplate,
  ProgramSupersetSlot,
  ProgramTemplate,
  SetTemplate,
  WeekTemplate,
} from '@/app/lib/types';
import { createUuid } from '@/app/lib/uuid';
import { useAuth } from '@/app/lib/supabase/auth-context';
import { useProgramContext } from '@/app/providers/ProgramProvider';
import { useDialog } from '@/app/providers/DialogProvider';
import { useRecoveryState } from '@/app/lib/hooks/useRecoveryState';

import EditableNumberInput from '@/app/components/ui/EditableNumberInput';
import FancySelect from '@/app/components/ui/FancySelect';
import {
  LiquidActionMenu,
  LiquidMenuRow,
  LiquidSegmentedControl,
  liquidButtonClass,
} from '@/app/components/ui/liquid';
import ProgramsCalendarView from '@/app/components/program-builder/ProgramsCalendarView';
import CoachCollabPanel from '@/app/components/program-builder/CoachCollabPanel';
import { FEATURES } from '@/app/lib/features';
import { storage } from '@/app/lib/storage';
import {
  applyProgramTuneUp,
  buildProgramTuneUpRecommendation,
  type TrainingHistorySet,
  type TrainingRecommendation,
} from '@/app/lib/intelligence/training-recommendations';

type ProgramFilter = 'all' | 'mine' | 'built-in';
type EditorMode = 'create' | 'edit' | null;
type ExercisePickerTarget =
  | { mode: 'append-single-block' }
  | { mode: 'append-superset-block' }
  | { mode: 'set-superset-slot'; blockIndex: number; slot: ProgramSupersetSlot }
  | { mode: 'replace-exercise'; blockIndex: number; exerciseIndex: number }
  | null;
type EditorSetFocus = { blockIndex: number; exerciseIndex: number; setIndex: number } | null;
type GoalOption = NonNullable<ProgramTemplate['goal']>;
type IntensityOption = NonNullable<ProgramTemplate['intensityMethod']>;
type ExperienceOption = NonNullable<ProgramTemplate['experienceLevel']>;
type PickerExerciseOption = {
  id: string;
  name: string;
  type: string;
  muscleGroups: string[];
  equipment: string[];
  source: 'default' | 'custom';
};
type CustomExerciseDraft = {
  name: string;
  equipment: CustomExercise['equipment'];
  exerciseType: CustomExercise['exerciseType'];
  primaryMusclesText: string;
  secondaryMusclesText: string;
  movementPattern: NonNullable<CustomExercise['movementPattern']> | '';
  defaultRestSeconds: number;
};
type SessionExerciseRow = {
  key: string;
  blockIndex: number;
  blockId: string;
  blockType: ProgramBlockTemplate['type'];
  exerciseIndex: number;
  exercise: ProgramBlockExerciseTemplate;
  slot?: ProgramSupersetSlot;
};
type ExerciseRemovalUndoPayload = {
  id: string;
  weekIndex: number;
  dayIndex: number;
  beforeBlocks: ProgramBlockTemplate[];
  afterBlocksFingerprint: string;
  message: string;
};

function getLocalTrainingHistorySets(): TrainingHistorySet[] {
  if (typeof window === 'undefined') return [];
  return storage.getWorkoutHistory().slice(0, 30).flatMap((session) =>
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

function formatTuneUpSource(source: TrainingRecommendation['source']): string {
  if (source === 'load_pressure') return 'Load';
  if (source === 'program_load') return 'Program';
  if (source === 'readiness') return 'Readiness';
  if (source === 'session_fatigue') return 'Set Signal';
  if (source === 'performance_trend') return 'Trend';
  return 'Baseline';
}

const DAYS: DayTemplate['dayOfWeek'][] = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

const GOAL_OPTIONS: GoalOption[] = ['strength', 'hypertrophy', 'powerlifting', 'general', 'peaking'];
const INTENSITY_OPTIONS: IntensityOption[] = ['rpe', 'rir', 'percentage', 'amrap', 'custom'];
const EXPERIENCE_OPTIONS: ExperienceOption[] = ['beginner', 'intermediate', 'advanced'];
const PRESCRIPTION_OPTIONS: Array<NonNullable<SetTemplate['prescriptionMethod']>> = [
  'rpe',
  'rir',
  'percentage_1rm',
  'percentage_tm',
  'fixed_weight',
  'amrap',
  'time_based',
];
const ADVANCED_SET_TYPE_OPTIONS: Array<NonNullable<SetTemplate['setType']>> = [
  'straight',
  'cluster',
  'superset',
  'drop',
  'rest-pause',
  'amrap',
  'warmup',
  'backoff',
];

const GOAL_LABELS: Record<GoalOption, string> = {
  strength: 'Strength',
  hypertrophy: 'Hypertrophy',
  powerlifting: 'Powerlifting',
  general: 'General',
  peaking: 'Peaking',
};

const EXPERIENCE_LABELS: Record<ExperienceOption, string> = {
  beginner: 'Beginner',
  intermediate: 'Intermediate',
  advanced: 'Advanced',
};

const INTENSITY_LABELS: Record<IntensityOption, string> = {
  rpe: 'RPE',
  rir: 'RIR',
  percentage: 'Percentage',
  amrap: 'AMRAP',
  custom: 'Custom',
};

const PRESCRIPTION_LABELS: Record<NonNullable<SetTemplate['prescriptionMethod']>, string> = {
  rpe: 'RPE',
  rir: 'RIR',
  percentage_1rm: '% 1RM',
  percentage_tm: '% TM',
  fixed_weight: 'Fixed Weight',
  amrap: 'AMRAP',
  time_based: 'Time',
};

const CUSTOM_EXERCISE_EQUIPMENT_OPTIONS: CustomExercise['equipment'][] = [
  'barbell',
  'dumbbell',
  'cable',
  'machine',
  'bodyweight',
  'kettlebell',
  'band',
  'other',
];
const CUSTOM_EXERCISE_TYPE_OPTIONS: CustomExercise['exerciseType'][] = ['compound', 'isolation'];
const CUSTOM_EXERCISE_MOVEMENT_OPTIONS: Array<NonNullable<CustomExercise['movementPattern']>> = [
  'push',
  'pull',
  'squat',
  'hinge',
  'carry',
  'rotation',
  'other',
];
const CUSTOM_EXERCISE_MUSCLE_OPTIONS = [
  'chest',
  'back',
  'lats',
  'shoulders',
  'rear delts',
  'biceps',
  'triceps',
  'forearms',
  'quads',
  'hamstrings',
  'glutes',
  'calves',
  'core',
  'abs',
  'traps',
  'lower back',
];

function createCustomExerciseDraft(name = ''): CustomExerciseDraft {
  const trimmedName = name.trim();
  const inferred = trimmedName ? inferCustomExerciseDefaults(trimmedName) : null;

  return {
    name,
    equipment: inferred?.equipment ?? 'other',
    exerciseType: inferred?.exerciseType ?? 'compound',
    primaryMusclesText: inferred ? formatDraftMuscleText(inferred.primaryMuscles) : '',
    secondaryMusclesText: inferred ? formatDraftMuscleText(inferred.secondaryMuscles) : '',
    movementPattern: inferred?.movementPattern ?? '',
    defaultRestSeconds: inferred?.defaultRestSeconds ?? 90,
  };
}

function formatTokenLabel(value: string): string {
  return value
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function deepClone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function parseMusclesFromInput(value: string): string[] {
  const cleaned = value
    .split(',')
    .map((entry) => entry.trim().toLowerCase())
    .filter(Boolean);
  return Array.from(new Set(cleaned));
}

function toggleMuscleInputValue(value: string, muscle: string): string {
  const muscles = parseMusclesFromInput(value);
  const next = muscles.includes(muscle)
    ? muscles.filter((entry) => entry !== muscle)
    : [...muscles, muscle];
  return next.join(', ');
}

function formatDraftMuscleText(muscles: string[]): string {
  return muscles.map((muscle) => muscle.toLowerCase()).join(', ');
}

function fingerprintProgram(program: ProgramTemplate): string {
  return JSON.stringify(normalizeProgramForSave(program));
}

function cloneSetTemplate(set: SetTemplate): SetTemplate {
  return {
    ...set,
    dropSetWeights: set.dropSetWeights ? [...set.dropSetWeights] : undefined,
    clusterReps: set.clusterReps ? [...set.clusterReps] : undefined,
  };
}

function cloneBlockExerciseTemplate(
  exercise: ProgramBlockExerciseTemplate
): ProgramBlockExerciseTemplate {
  return {
    ...exercise,
    sets: (exercise.sets ?? []).map(cloneSetTemplate),
  };
}

function cloneBlockTemplate(block: ProgramBlockTemplate): ProgramBlockTemplate {
  return {
    ...block,
    exercises: (block.exercises ?? []).map(cloneBlockExerciseTemplate),
  };
}

function cloneBlockTemplates(blocks: ProgramBlockTemplate[]): ProgramBlockTemplate[] {
  return blocks.map(cloneBlockTemplate);
}

function fingerprintBlocks(blocks: ProgramBlockTemplate[]): string {
  return JSON.stringify(blocks);
}

function getDayBlocks(day: DayTemplate | null | undefined): ProgramBlockTemplate[] {
  if (!day) return [];
  if (Array.isArray(day.blocks)) return day.blocks;
  if (Array.isArray(day.sets) && day.sets.length > 0) return setsToProgramBlocks(day.sets);
  return [];
}

function countBlockSets(blocks: ProgramBlockTemplate[]): number {
  return blocks.reduce((blockCount, block) => {
    return (
      blockCount +
      block.exercises.reduce((exerciseCount, exercise) => exerciseCount + (exercise.sets?.length ?? 0), 0)
    );
  }, 0);
}

function countDaySets(day: DayTemplate): number {
  const blocks = getDayBlocks(day);
  if (blocks.length > 0) return countBlockSets(blocks);
  return day.sets.length;
}

function countDayExercises(day: DayTemplate): number {
  const blocks = getDayBlocks(day);
  if (blocks.length > 0) {
    return blocks.reduce((count, block) => count + block.exercises.length, 0);
  }
  return new Set(day.sets.map((set) => set.exerciseId).filter(Boolean)).size;
}

function buildSessionExerciseRows(blocks: ProgramBlockTemplate[]): SessionExerciseRow[] {
  const rows: SessionExerciseRow[] = [];
  blocks.forEach((block, blockIndex) => {
    const orderedExercises =
      block.type === 'superset' ? normalizeSlotOrder(block.exercises) : block.exercises;

    orderedExercises.forEach((exercise) => {
      const exerciseIndex = block.exercises.findIndex((entry) => entry.id === exercise.id);
      if (exerciseIndex < 0) return;
      rows.push({
        key: `${block.id}-${exercise.id}`,
        blockIndex,
        blockId: block.id,
        blockType: block.type,
        exerciseIndex,
        exercise,
        slot: exercise.slot,
      });
    });
  });
  return rows;
}

function createDefaultSetTemplate(
  exerciseId: string,
  setIndex: number,
  blockType: ProgramBlockTemplate['type'],
  supersetGroup?: string
): SetTemplate {
  return {
    exerciseId,
    setIndex,
    prescribedReps: '8',
    prescriptionMethod: 'rpe',
    targetRPE: 8,
    restSeconds: 120,
    setType: blockType === 'superset' ? 'superset' : 'straight',
    supersetGroup: blockType === 'superset' ? supersetGroup : undefined,
  };
}

function createBlockId(type: ProgramBlockTemplate['type']): string {
  return `block_${type}_${createUuid().slice(0, 8)}`;
}

function createBlockExerciseId(blockId: string, slotOrIndex: ProgramSupersetSlot | number): string {
  if (typeof slotOrIndex === 'number') return `${blockId}_exercise_${slotOrIndex + 1}`;
  return `${blockId}_${slotOrIndex.toLowerCase()}`;
}

function createSingleBlock(exerciseId: string): ProgramBlockTemplate {
  const blockId = createBlockId('single');
  return {
    id: blockId,
    type: 'single',
    exercises: [
      {
        id: createBlockExerciseId(blockId, 0),
        exerciseId,
        sets: [createDefaultSetTemplate(exerciseId, 1, 'single')],
      },
    ],
  };
}

function createSupersetBlock(exerciseId: string): ProgramBlockTemplate {
  const blockId = createBlockId('superset');
  return {
    id: blockId,
    type: 'superset',
    rounds: 1,
    exercises: [
      {
        id: createBlockExerciseId(blockId, 'A1'),
        exerciseId,
        slot: 'A1',
        sets: [createDefaultSetTemplate(exerciseId, 1, 'superset', blockId)],
      },
    ],
  };
}

function normalizeSlotOrder(
  exercises: ProgramBlockExerciseTemplate[]
): ProgramBlockExerciseTemplate[] {
  const slotRank: Record<ProgramSupersetSlot, number> = { A1: 0, A2: 1 };
  return [...exercises].sort((a, b) => {
    const rankA = a.slot ? slotRank[a.slot] : 9;
    const rankB = b.slot ? slotRank[b.slot] : 9;
    return rankA - rankB;
  });
}

function sanitizeProgramBlocks(blocks: ProgramBlockTemplate[]): ProgramBlockTemplate[] {
  return blocks
    .map<ProgramBlockTemplate | null>((block, blockIndex) => {
      const blockType: ProgramBlockTemplate['type'] = block.type === 'superset' ? 'superset' : 'single';
      const blockId = block.id?.trim() || `${createBlockId(blockType)}_${blockIndex + 1}`;
      const sourceExercises = (block.exercises ?? [])
        .map(cloneBlockExerciseTemplate)
        .filter((exercise) => exercise.exerciseId?.trim().length > 0);

      const sortedExercises =
        blockType === 'superset'
          ? normalizeSlotOrder(sourceExercises).slice(0, 2)
          : sourceExercises.slice(0, 1);

      const normalizedExercises = sortedExercises
        .map<ProgramBlockExerciseTemplate | null>((exercise, exerciseIndex) => {
          const exerciseId = exercise.exerciseId.trim();
          const slot: ProgramSupersetSlot | undefined =
            blockType === 'superset'
              ? (exercise.slot === 'A2' ? 'A2' : exerciseIndex === 0 ? 'A1' : 'A2')
              : undefined;

          const normalizedSets = (exercise.sets ?? [])
            .map(cloneSetTemplate)
            .map((set) => ({
              ...set,
              exerciseId,
              prescribedReps: set.prescribedReps?.trim() ?? '',
            }))
            .filter((set) => Boolean(set.exerciseId) && Boolean(set.prescribedReps))
            .map((set, setIndex) => {
              const normalizedSetType: SetTemplate['setType'] =
                blockType === 'superset'
                  ? 'superset'
                  : set.setType === 'superset'
                    ? 'straight'
                    : set.setType;
              return {
                ...set,
                setIndex: setIndex + 1,
                setType: normalizedSetType,
                supersetGroup: blockType === 'superset' ? set.supersetGroup ?? blockId : undefined,
              };
            });

          if (normalizedSets.length === 0) return null;

          return {
            ...exercise,
            id: exercise.id?.trim() || createBlockExerciseId(blockId, slot ?? exerciseIndex),
            exerciseId,
            slot,
            notes: exercise.notes?.trim() || undefined,
            sets: normalizedSets,
          };
        })
        .filter((exercise): exercise is ProgramBlockExerciseTemplate => exercise !== null);

      if (normalizedExercises.length === 0) return null;

      const inferredRounds = normalizedExercises.reduce(
        (max, exercise) => Math.max(max, exercise.sets.length),
        1
      );

      return {
        id: blockId,
        type: blockType,
        notes: block.notes?.trim() || undefined,
        rounds:
          blockType === 'superset'
            ? Math.max(1, Math.round(block.rounds ?? inferredRounds))
            : undefined,
        transitionSeconds:
          block.transitionSeconds != null && Number.isFinite(block.transitionSeconds)
            ? Math.max(0, Math.round(block.transitionSeconds))
            : undefined,
        restAfterRoundSeconds:
          block.restAfterRoundSeconds != null && Number.isFinite(block.restAfterRoundSeconds)
            ? Math.max(0, Math.round(block.restAfterRoundSeconds))
            : undefined,
        exercises: normalizedExercises,
      };
    })
    .filter((block): block is ProgramBlockTemplate => Boolean(block));
}

function matchesExerciseSearch(exercise: PickerExerciseOption, query: string): boolean {
  const normalizedQuery = query.trim().toLowerCase();
  if (!normalizedQuery) return true;

  const searchableText = [
    exercise.name,
    exercise.type,
    ...exercise.muscleGroups,
    ...exercise.equipment,
  ]
    .join(' ')
    .toLowerCase();

  if (searchableText.includes(normalizedQuery)) return true;

  const tokens = normalizedQuery.split(/\s+/).filter(Boolean);
  if (tokens.length === 0) return true;
  return tokens.every((token) => searchableText.includes(token));
}

function humanizeExerciseId(exerciseId: string): string {
  return exerciseId
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function createDayTemplate(dayOfWeek: DayTemplate['dayOfWeek'], index: number): DayTemplate {
  return {
    dayOfWeek,
    name: `Session ${index + 1}`,
    sets: [],
    blocks: [],
  };
}

function createWeekTemplate(weekNumber: number, daysPerWeek: number): WeekTemplate {
  const validDays = Math.min(7, Math.max(1, daysPerWeek));
  return {
    weekNumber,
    days: DAYS.slice(0, validDays).map((day, index) => createDayTemplate(day, index)),
  };
}

function createBlankProgram(): ProgramTemplate {
  const weekCount = 4;
  const daysPerWeek = 4;

  return {
    id: `userprog_${createUuid()}`,
    name: 'Untitled Program',
    description: '',
    goal: 'hypertrophy',
    experienceLevel: 'intermediate',
    daysPerWeek,
    weekCount,
    intensityMethod: 'rpe',
    isCustom: true,
    weeks: Array.from({ length: weekCount }, (_, index) => createWeekTemplate(index + 1, daysPerWeek)),
  };
}

function resizeProgramStructure(program: ProgramTemplate, weekCount: number, daysPerWeek: number): ProgramTemplate {
  const safeWeeks = Math.min(24, Math.max(1, weekCount));
  const safeDays = Math.min(7, Math.max(1, daysPerWeek));
  const existing = program.weeks ?? [];

  const nextWeeks: WeekTemplate[] = Array.from({ length: safeWeeks }, (_, weekIndex) => {
    const sourceWeek = existing[weekIndex];
    const sourceDays = sourceWeek?.days ?? [];

    const nextDays: DayTemplate[] = DAYS.slice(0, safeDays).map((dayOfWeek, dayIndex) => {
      const sourceDay = sourceDays[dayIndex];
      const sourceBlocks = sourceDay ? getDayBlocks(sourceDay) : [];
      return {
        dayOfWeek,
        name: sourceDay?.name?.trim() || `Session ${dayIndex + 1}`,
        sets: sourceDay?.sets ? sourceDay.sets.map(cloneSetTemplate) : [],
        blocks: cloneBlockTemplates(sourceBlocks),
      };
    });

    return {
      weekNumber: weekIndex + 1,
      days: nextDays,
    };
  });

  return {
    ...program,
    weekCount: safeWeeks,
    daysPerWeek: safeDays,
    weeks: nextWeeks,
  };
}

function normalizeProgramForSave(program: ProgramTemplate): ProgramTemplate {
  const normalized = resizeProgramStructure(
    {
      ...program,
      name: program.name.trim() || 'Untitled Program',
      description: program.description?.trim() || undefined,
      isCustom: true,
    },
    program.weekCount ?? program.weeks.length ?? 1,
    program.daysPerWeek ?? program.weeks[0]?.days.length ?? 1
  );

  const cleanedWeeks = normalized.weeks.map((week, weekIndex) => ({
    weekNumber: weekIndex + 1,
    days: week.days.map((day, dayIndex) => {
      const sourceBlocks = getDayBlocks(day);
      const sanitizedBlocks = sanitizeProgramBlocks(sourceBlocks);
      const derivedSets = blocksToProgramSets(cloneBlockTemplates(sanitizedBlocks));
      return {
        dayOfWeek: DAYS[dayIndex] ?? day.dayOfWeek,
        name: day.name?.trim() || `Session ${dayIndex + 1}`,
        sets: derivedSets,
        blocks: sanitizedBlocks,
      };
    }),
  }));

  return {
    ...normalized,
    schemaVersion: 2,
    weeks: cleanedWeeks,
  };
}

function getProgramSetCount(program: ProgramTemplate): number {
  return program.weeks.reduce((weekAcc, week) => {
    return weekAcc + week.days.reduce((dayAcc, day) => dayAcc + countDaySets(day), 0);
  }, 0);
}

function getFrequencyLabel(program: ProgramTemplate): string {
  const days = program.daysPerWeek ?? program.weeks[0]?.days.length ?? 0;
  const weeks = program.weekCount ?? program.weeks.length;
  return `${days} sessions/wk • ${weeks} wk`;
}

function getRpeOrRirValue(set: SetTemplate): string {
  if (set.prescriptionMethod === 'rpe') return set.targetRPE == null ? '' : String(set.targetRPE);
  if (set.prescriptionMethod === 'rir') return set.targetRIR == null ? '' : String(set.targetRIR);
  if (set.prescriptionMethod === 'percentage_1rm' || set.prescriptionMethod === 'percentage_tm') {
    return set.targetPercentage == null ? '' : String(set.targetPercentage);
  }
  if (set.prescriptionMethod === 'fixed_weight') return set.fixedWeight == null ? '' : String(set.fixedWeight);
  if (set.prescriptionMethod === 'time_based') return set.targetSeconds == null ? '' : String(set.targetSeconds);
  return '';
}

function getTargetLabel(method: SetTemplate['prescriptionMethod'] | undefined): string {
  if (method === 'rpe') return 'RPE';
  if (method === 'rir') return 'RIR';
  if (method === 'percentage_1rm' || method === 'percentage_tm') return '%';
  if (method === 'fixed_weight') return 'Weight';
  if (method === 'time_based') return 'Seconds';
  return 'Target';
}

function getSetSummaryLine(set: SetTemplate): string {
  const method = set.prescriptionMethod ?? 'rpe';
  const methodLabel = PRESCRIPTION_LABELS[method];
  const targetValue = getRpeOrRirValue(set);
  const targetLabel = targetValue ? `${getTargetLabel(method)} ${targetValue}` : methodLabel;
  const reps = set.prescribedReps?.trim() || '--';
  const rest = `${set.restSeconds ?? 120}s rest`;
  const modeLabel = set.setType ? formatTokenLabel(set.setType) : null;
  const tempoLabel = set.tempo?.trim() ? `Tempo ${set.tempo.trim()}` : null;
  const clusterLabel =
    set.setType === 'cluster' && set.clusterReps && set.clusterReps.length > 0
      ? `${set.clusterReps.length} clusters`
      : null;
  return [reps + ' reps', targetLabel, rest, modeLabel, tempoLabel, clusterLabel]
    .filter(Boolean)
    .join(' • ');
}

function applySetTargetInput(set: SetTemplate, rawValue: string): SetTemplate {
  const raw = rawValue.trim();
  const value = raw === '' ? null : Number(raw);
  const base = {
    ...set,
    targetRPE: null,
    targetRIR: null,
    targetPercentage: null,
    fixedWeight: null,
    targetSeconds: null,
  };
  const method = set.prescriptionMethod ?? 'rpe';
  if (value == null || Number.isNaN(value)) return base;
  if (method === 'rpe') return { ...base, targetRPE: value };
  if (method === 'rir') return { ...base, targetRIR: value };
  if (method === 'percentage_1rm' || method === 'percentage_tm') {
    return { ...base, targetPercentage: value };
  }
  if (method === 'fixed_weight') return { ...base, fixedWeight: value };
  if (method === 'time_based') return { ...base, targetSeconds: value };
  return base;
}

export default function ProgramsPage() {
  const router = useRouter();
  const { user } = useAuth();
  const { readiness } = useRecoveryState();
  const {
    selectedProgram,
    allPrograms,
    builtInProgramIds,
    loading,
    error,
    cloudSaveError,
    selectProgram,
    saveProgram,
    deleteProgram,
    resolveProgramSelection,
  } = useProgramContext();
  const { confirm } = useDialog();
  const namespaceId = user?.id ?? 'guest';

  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<ProgramFilter>('all');
  const [editorMode, setEditorMode] = useState<EditorMode>(null);
  const [draft, setDraft] = useState<ProgramTemplate | null>(null);
  const [editorBaselineFingerprint, setEditorBaselineFingerprint] = useState<string | null>(null);
  const [editorSaving, setEditorSaving] = useState(false);
  const [editorError, setEditorError] = useState<string | null>(null);
  const [editorNotice, setEditorNotice] = useState<string | null>(null);
  const [activeWeekIndex, setActiveWeekIndex] = useState(0);
  const [activeDayIndex, setActiveDayIndex] = useState(0);
  const [exercisePickerOpen, setExercisePickerOpen] = useState(false);
  const [exercisePickerTarget, setExercisePickerTarget] = useState<ExercisePickerTarget>(null);
  const [exerciseQuery, setExerciseQuery] = useState('');
  const [customExercises, setCustomExercises] = useState<CustomExercise[]>([]);
  const [showCreateCustomExercise, setShowCreateCustomExercise] = useState(false);
  const [showCustomExerciseAdvanced, setShowCustomExerciseAdvanced] = useState(false);
  const [customExerciseDraft, setCustomExerciseDraft] = useState<CustomExerciseDraft>(
    createCustomExerciseDraft()
  );
  const [customExerciseSaving, setCustomExerciseSaving] = useState(false);
  const [customExerciseError, setCustomExerciseError] = useState<string | null>(null);
  const [pendingExerciseUndo, setPendingExerciseUndo] = useState<ExerciseRemovalUndoPayload | null>(
    null
  );
  const [editorSetFocus, setEditorSetFocus] = useState<EditorSetFocus>(null);
  const [editorDetailMode, setEditorDetailMode] = useState<'simple' | 'advanced'>('simple');
  const [editorJumpPicker, setEditorJumpPicker] = useState<'week' | 'session' | null>(null);
  const [weekCountInput, setWeekCountInput] = useState('');
  const [daysPerWeekInput, setDaysPerWeekInput] = useState('');
  const [weekCountFocused, setWeekCountFocused] = useState(false);
  const [daysPerWeekFocused, setDaysPerWeekFocused] = useState(false);
  const [workspaceView, setWorkspaceView] = useState<'builder' | 'calendar' | 'collab'>('builder');
  const [dismissedTuneUps, setDismissedTuneUps] = useState<Record<string, boolean>>({});
  const showWorkspaceTabs = FEATURES.programCalendar || FEATURES.coachCollab;

  useEffect(() => {
    let cancelled = false;
    const loadCustomExercises = async () => {
      try {
        if (!cancelled) {
          setCustomExercises(getLocalCustomExercises());
        }
        const loaded = await getCustomExercises(user?.id ?? null);
        if (!cancelled) {
          setCustomExercises(loaded);
        }
      } catch (loadError) {
        console.error('Failed to load custom exercises for program builder:', loadError);
      }
    };

    void loadCustomExercises();
    return () => {
      cancelled = true;
    };
  }, [user?.id]);

  const pickerExercises = useMemo(() => {
    const items: PickerExerciseOption[] = [];
    const seenIds = new Set<string>();

    customExercises.forEach((exercise) => {
      if (!exercise.id || seenIds.has(exercise.id)) return;
      seenIds.add(exercise.id);
      items.push({
        id: exercise.id,
        name: exercise.name,
        type: exercise.exerciseType,
        muscleGroups: exercise.primaryMuscles,
        equipment: [exercise.equipment],
        source: 'custom',
      });
    });

    defaultExercises.forEach((exercise) => {
      if (!exercise.id || seenIds.has(exercise.id)) return;
      seenIds.add(exercise.id);
      items.push({
        id: exercise.id,
        name: exercise.name,
        type: exercise.type,
        muscleGroups: exercise.muscleGroups,
        equipment: exercise.equipment ?? [],
        source: 'default',
      });
    });

    return items;
  }, [customExercises]);

  const exerciseNameById = useMemo(() => {
    const map = new Map<string, string>();
    pickerExercises.forEach((exercise) => map.set(exercise.id, exercise.name));
    return map;
  }, [pickerExercises]);

  const programList = useMemo(() => {
    const term = query.trim().toLowerCase();
    const base = allPrograms.filter((program) => {
      if (filter === 'mine') return !builtInProgramIds.has(program.id);
      if (filter === 'built-in') return builtInProgramIds.has(program.id);
      return true;
    });

    if (!term) return base;

    return base.filter((program) => {
      return (
        program.name.toLowerCase().includes(term) ||
        program.description?.toLowerCase().includes(term) ||
        program.goal?.toLowerCase().includes(term)
      );
    });
  }, [allPrograms, builtInProgramIds, filter, query]);

  const activeProgram = selectedProgram ?? null;
  const localTrainingHistorySets = useMemo(() => {
    void namespaceId;
    return getLocalTrainingHistorySets();
  }, [namespaceId]);
  const programTuneUp = useMemo(() => {
    if (!activeProgram) return null;
    const recommendation = buildProgramTuneUpRecommendation({
      program: activeProgram,
      historySets: localTrainingHistorySets,
      readiness: {
        score: readiness?.score ?? null,
        modifier: readiness?.modifier ?? null,
        source: readiness?.source ?? null,
        focusAdjustments: {
          overallModifier: readiness?.modifier ?? null,
          upperBodyModifier: readiness?.focus_adjustments.upper_body_modifier ?? null,
          lowerBodyModifier: readiness?.focus_adjustments.lower_body_modifier ?? null,
        },
      },
    });
    return recommendation?.action === 'hold_program' ? null : recommendation;
  }, [
    activeProgram,
    localTrainingHistorySets,
    readiness?.focus_adjustments.lower_body_modifier,
    readiness?.focus_adjustments.upper_body_modifier,
    readiness?.modifier,
    readiness?.score,
    readiness?.source,
  ]);
  const programTuneUpKey = programTuneUp && activeProgram ? `${activeProgram.id}:${programTuneUp.id}` : null;
  const visibleProgramTuneUp = programTuneUpKey && !dismissedTuneUps[programTuneUpKey] ? programTuneUp : null;
  const currentWeek = draft?.weeks[activeWeekIndex] ?? null;
  const currentDay = currentWeek?.days[activeDayIndex] ?? null;
  const currentDayBlocks = useMemo(() => getDayBlocks(currentDay), [currentDay]);
  const currentDayExerciseRows = useMemo(
    () => buildSessionExerciseRows(currentDayBlocks),
    [currentDayBlocks]
  );
  const blocksMissingSupersetA2 = useMemo(() => {
    const set = new Set<number>();
    currentDayBlocks.forEach((block, blockIndex) => {
      if (block.type !== 'superset') return;
      const hasA2 = block.exercises.some((exercise) => exercise.slot === 'A2');
      if (!hasA2) set.add(blockIndex);
    });
    return set;
  }, [currentDayBlocks]);
  const hasEditorSetFocus = editorSetFocus != null;
  const resolvedWeekCount = draft?.weekCount ?? draft?.weeks.length ?? 1;
  const resolvedDaysPerWeek = draft?.daysPerWeek ?? draft?.weeks[0]?.days.length ?? 1;
  const hasProgramBuilderOverlay = Boolean(editorJumpPicker || exercisePickerOpen);

  useEffect(() => {
    if (typeof document === 'undefined') return;
    if (hasProgramBuilderOverlay) {
      document.body.setAttribute('data-hide-bottom-nav', 'true');
      return () => {
        document.body.removeAttribute('data-hide-bottom-nav');
      };
    }
    document.body.removeAttribute('data-hide-bottom-nav');
  }, [hasProgramBuilderOverlay]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      const raw = window.localStorage.getItem('iron_brain_dismissed_tuneups_v1');
      if (raw) {
        setDismissedTuneUps(JSON.parse(raw) as Record<string, boolean>);
      }
    } catch {
      setDismissedTuneUps({});
    }
  }, []);

  useEffect(() => {
    if (!draft) {
      setWeekCountInput('');
      setDaysPerWeekInput('');
      return;
    }
    if (!weekCountFocused) {
      setWeekCountInput(String(resolvedWeekCount));
    }
    if (!daysPerWeekFocused) {
      setDaysPerWeekInput(String(resolvedDaysPerWeek));
    }
  }, [draft, resolvedWeekCount, resolvedDaysPerWeek, weekCountFocused, daysPerWeekFocused]);

  const filteredExercises = useMemo(() => {
    const term = exerciseQuery.trim().toLowerCase();
    if (!term) return pickerExercises.slice(0, 100);
    return pickerExercises.filter((exercise) => matchesExerciseSearch(exercise, term));
  }, [exerciseQuery, pickerExercises]);

  const currentSessionExerciseCount = useMemo(() => {
    if (!currentDay) return 0;
    return countDayExercises(currentDay);
  }, [currentDay]);
  const currentSessionSetCount = useMemo(() => {
    if (!currentDay) return 0;
    return countDaySets(currentDay);
  }, [currentDay]);
  const normalizedExerciseQuery = exerciseQuery.trim();
  const exercisePickerHeading = useMemo(() => {
    if (!exercisePickerTarget) return 'Pick Exercise';
    if (exercisePickerTarget.mode === 'set-superset-slot') {
      return `Pick ${exercisePickerTarget.slot} Exercise`;
    }
    if (exercisePickerTarget.mode === 'replace-exercise') return 'Replace Exercise';
    return 'Pick Exercise';
  }, [exercisePickerTarget]);
  const matchingExerciseByName = useMemo(() => {
    const normalizedName = normalizedExerciseQuery.toLowerCase();
    if (!normalizedName) return null;
    return (
      pickerExercises.find((exercise) => exercise.name.trim().toLowerCase() === normalizedName) ?? null
    );
  }, [normalizedExerciseQuery, pickerExercises]);
  const customExerciseName = customExerciseDraft.name.trim();
  const customExercisePrimaryMuscles = useMemo(
    () => parseMusclesFromInput(customExerciseDraft.primaryMusclesText),
    [customExerciseDraft.primaryMusclesText]
  );
  const customExerciseSecondaryMuscles = useMemo(
    () => parseMusclesFromInput(customExerciseDraft.secondaryMusclesText),
    [customExerciseDraft.secondaryMusclesText]
  );
  const canCreateCustomExercise =
    customExerciseName.length > 0 && customExercisePrimaryMuscles.length > 0;

  const toggleCustomExerciseMuscle = (
    field: 'primaryMusclesText' | 'secondaryMusclesText',
    muscle: string
  ) => {
    setCustomExerciseDraft((current) => ({
      ...current,
      [field]: toggleMuscleInputValue(current[field], muscle),
    }));
  };

  const resetCustomExerciseBuilder = (seedName = '') => {
    setShowCreateCustomExercise(false);
    setShowCustomExerciseAdvanced(false);
    setCustomExerciseDraft(createCustomExerciseDraft(seedName));
    setCustomExerciseError(null);
    setCustomExerciseSaving(false);
  };

  const openCreateEditor = () => {
    const blank = createBlankProgram();
    setDraft(blank);
    setEditorBaselineFingerprint(fingerprintProgram(blank));
    setEditorMode('create');
    setEditorError(null);
    setEditorNotice(null);
    setPendingExerciseUndo(null);
    resetCustomExerciseBuilder();
    setActiveWeekIndex(0);
    setActiveDayIndex(0);
    setEditorSetFocus(null);
    setEditorDetailMode('simple');
    setEditorJumpPicker(null);
  };

  const openEditEditor = (program: ProgramTemplate) => {
    const builtIn = builtInProgramIds.has(program.id);
    const resolved = builtIn ? resolveProgramSelection(program) : program;
    const draftProgram = normalizeProgramForSave(deepClone(resolved));
    selectProgram(resolved);
    setDraft(draftProgram);
    setEditorBaselineFingerprint(fingerprintProgram(draftProgram));
    setEditorMode('edit');
    setEditorError(null);
    setEditorNotice(
      builtIn
        ? `Built-in duplicated to "Mine". You're editing your personal copy.`
        : null
    );
    setPendingExerciseUndo(null);
    resetCustomExerciseBuilder();
    setActiveWeekIndex(0);
    setActiveDayIndex(0);
    setEditorSetFocus(null);
    setEditorDetailMode('simple');
    setEditorJumpPicker(null);
  };

  const openTuneUpEditor = (program: ProgramTemplate, recommendation: TrainingRecommendation) => {
    const builtIn = builtInProgramIds.has(program.id);
    const resolved = builtIn ? resolveProgramSelection(program) : program;
    const baselineProgram = normalizeProgramForSave(deepClone(resolved));
    const tunedProgram = normalizeProgramForSave(applyProgramTuneUp(resolved, recommendation));
    selectProgram(resolved);
    setDraft(tunedProgram);
    setEditorBaselineFingerprint(fingerprintProgram(baselineProgram));
    setEditorMode('edit');
    setEditorError(null);
    setEditorNotice(
      builtIn
        ? `Built-in duplicated to "Mine". Tune-up staged for review; save to keep it.`
        : `Tune-up staged for review; save to keep it.`
    );
    setPendingExerciseUndo(null);
    resetCustomExerciseBuilder();
    setActiveWeekIndex(0);
    setActiveDayIndex(0);
    setEditorSetFocus(null);
    setEditorDetailMode('simple');
    setEditorJumpPicker(null);
  };

  const dismissTuneUp = (key: string) => {
    setDismissedTuneUps((current) => {
      const next = { ...current, [key]: true };
      try {
        window.localStorage.setItem('iron_brain_dismissed_tuneups_v1', JSON.stringify(next));
      } catch {
        // ignore local persistence failures
      }
      return next;
    });
  };

  const resetEditorState = () => {
    if (editorSaving) return;
    setEditorMode(null);
    setDraft(null);
    setEditorBaselineFingerprint(null);
    setEditorError(null);
    setEditorNotice(null);
    setPendingExerciseUndo(null);
    setExercisePickerOpen(false);
    setExercisePickerTarget(null);
    setExerciseQuery('');
    resetCustomExerciseBuilder();
    setEditorSetFocus(null);
    setEditorDetailMode('simple');
    setEditorJumpPicker(null);
  };

  const closeEditor = async () => {
    if (editorSaving) return;
    if (draft && editorBaselineFingerprint && fingerprintProgram(draft) !== editorBaselineFingerprint) {
      const discardConfirmed = await confirm(
        'Discard Changes?',
        'You have unsaved changes in this program. Exit anyway?',
        { variant: 'danger', confirmLabel: 'Discard', cancelLabel: 'Keep Editing' }
      );
      if (!discardConfirmed) return;
    }
    resetEditorState();
  };

  const updateDraft = (updater: (current: ProgramTemplate) => ProgramTemplate) => {
    setDraft((current) => (current ? updater(current) : current));
  };

  const updateDraftWeekCount = (nextWeekCount: number) => {
    updateDraft((current) => resizeProgramStructure(current, nextWeekCount, current.daysPerWeek ?? 4));
    setActiveWeekIndex((currentIndex) => Math.max(0, Math.min(nextWeekCount - 1, currentIndex)));
    setEditorSetFocus(null);
    setEditorJumpPicker(null);
  };

  const updateDraftDaysPerWeek = (nextDaysPerWeek: number) => {
    updateDraft((current) => resizeProgramStructure(current, current.weekCount ?? current.weeks.length, nextDaysPerWeek));
    setActiveDayIndex((currentIndex) => Math.max(0, Math.min(nextDaysPerWeek - 1, currentIndex)));
    setEditorSetFocus(null);
    setEditorJumpPicker(null);
  };

  const selectEditorWeek = (index: number) => {
    if (!draft) return;
    const clampedWeek = Math.max(0, Math.min(draft.weeks.length - 1, index));
    const nextWeek = draft.weeks[clampedWeek];
    const nextDayLimit = Math.max(0, (nextWeek?.days.length ?? 1) - 1);
    setActiveWeekIndex(clampedWeek);
    setActiveDayIndex((current) => Math.max(0, Math.min(nextDayLimit, current)));
    setEditorSetFocus(null);
    setEditorJumpPicker(null);
  };

  const selectEditorSession = (index: number) => {
    if (!currentWeek) return;
    const clampedDay = Math.max(0, Math.min(currentWeek.days.length - 1, index));
    setActiveDayIndex(clampedDay);
    setEditorSetFocus(null);
    setEditorJumpPicker(null);
  };

  const stepEditorWeek = (delta: number) => {
    if (!draft) return;
    selectEditorWeek(activeWeekIndex + delta);
  };

  const stepEditorSession = (delta: number) => {
    if (!currentWeek) return;
    selectEditorSession(activeDayIndex + delta);
  };

  const updateCurrentDay = (updater: (day: DayTemplate) => DayTemplate) => {
    updateDraft((current) => {
      const week = current.weeks[activeWeekIndex];
      if (!week) return current;
      const day = week.days[activeDayIndex];
      if (!day) return current;

      const nextWeeks = current.weeks.map((entry, weekIndex) => {
        if (weekIndex !== activeWeekIndex) return entry;
        return {
          ...entry,
          days: entry.days.map((dayEntry, dayIndex) => {
            if (dayIndex !== activeDayIndex) return dayEntry;
            return updater(dayEntry);
          }),
        };
      });
      return { ...current, weeks: nextWeeks };
    });
  };

  const updateCurrentDayBlocks = (updater: (blocks: ProgramBlockTemplate[]) => ProgramBlockTemplate[]) => {
    updateCurrentDay((day) => {
      const nextBlocks = updater(cloneBlockTemplates(getDayBlocks(day)));
      return {
        ...day,
        blocks: nextBlocks,
      };
    });
  };

  const handleDuplicateWeek = (sourceWeekIndex: number) => {
    if (!draft) return;
    const existingWeeks = draft.weeks;
    if (existingWeeks.length >= 24) {
      setEditorError('Maximum of 24 weeks allowed.');
      return;
    }

    const sourceWeek = existingWeeks[sourceWeekIndex];
    if (!sourceWeek) return;

    // Clone the week, regenerating IDs inside sets and blocks if needed by the builder logic later.
    // For this context, standard deep copy is sufficient as resizeProgramStructure handles cloning similarly.
    const clonedDays = sourceWeek.days.map((day) => ({
      ...day,
      sets: day.sets ? day.sets.map(cloneSetTemplate) : [],
      blocks: cloneBlockTemplates(getDayBlocks(day)),
    }));

    const nextWeeks = [
      ...existingWeeks.slice(0, sourceWeekIndex + 1),
      {
        weekNumber: existingWeeks.length + 1, // Temporarily invalid, fixed in map below
        days: clonedDays,
      } as WeekTemplate,
      ...existingWeeks.slice(sourceWeekIndex + 1),
    ].map((week, index) => ({
      ...week,
      weekNumber: index + 1,
    }));

    const nextDraft: ProgramTemplate = {
      ...draft,
      weekCount: nextWeeks.length,
      weeks: nextWeeks,
    };

    setDraft(nextDraft);
    setWeekCountInput(String(nextWeeks.length));
    setActiveWeekIndex(sourceWeekIndex + 1);
    setEditorSetFocus(null);
    setEditorJumpPicker(null);
    setEditorError(null);
  };

  const handleDeleteWeek = (targetWeekIndex: number) => {
    if (!draft) return;
    const existingWeeks = draft.weeks;
    if (existingWeeks.length <= 1) {
      setEditorError('Program must have at least one week.');
      return;
    }

    const nextWeeks = existingWeeks
      .filter((_, index) => index !== targetWeekIndex)
      .map((week, index) => ({
        ...week,
        weekNumber: index + 1,
      }));

    const nextDraft: ProgramTemplate = {
      ...draft,
      weekCount: nextWeeks.length,
      weeks: nextWeeks,
    };

    setDraft(nextDraft);
    setWeekCountInput(String(nextWeeks.length));

    // Adjust active week if the deleted week was selected or past the deleted week
    if (activeWeekIndex === targetWeekIndex) {
      setActiveWeekIndex(Math.max(0, targetWeekIndex - 1));
    } else if (activeWeekIndex > targetWeekIndex) {
      setActiveWeekIndex(activeWeekIndex - 1);
    }

    setEditorSetFocus(null);
    setEditorJumpPicker(null);
    setEditorError(null);
  };

  const handleDeleteDay = (targetWeekIndex: number, targetDayIndex: number) => {
    if (!draft) return;
    const week = draft.weeks[targetWeekIndex];
    if (!week) return;
    if (week.days.length <= 1) {
      setEditorError('A week must have at least one day.');
      return;
    }

    updateDraft((current) => {
      const nextWeeks = current.weeks.map((entry, wIndex) => {
        if (wIndex !== targetWeekIndex) return entry;
        return {
          ...entry,
          days: entry.days.filter((_, dIndex) => dIndex !== targetDayIndex),
        };
      });
      return { ...current, weeks: nextWeeks };
    });

    if (activeWeekIndex === targetWeekIndex) {
      if (activeDayIndex === targetDayIndex) {
        setActiveDayIndex(Math.max(0, targetDayIndex - 1));
      } else if (activeDayIndex > targetDayIndex) {
        setActiveDayIndex(activeDayIndex - 1);
      }
    }

    setEditorSetFocus(null);
    setEditorError(null);
  };

  const handleSetTemplateUpdate = (
    blockIndex: number,
    exerciseIndex: number,
    setIndex: number,
    updater: (set: SetTemplate) => SetTemplate
  ) => {
    updateCurrentDayBlocks((blocks) => {
      const block = blocks[blockIndex];
      const exercise = block?.exercises[exerciseIndex];
      const sourceSet = exercise?.sets?.[setIndex];
      if (!block || !exercise || !sourceSet) return blocks;

      exercise.sets = exercise.sets.map((set, index) => {
        if (index !== setIndex) return set;
        const updated = updater(set);
        return {
          ...updated,
          exerciseId: exercise.exerciseId,
          setIndex: index + 1,
          setType: block.type === 'superset' ? 'superset' : updated.setType,
          supersetGroup: block.type === 'superset' ? updated.supersetGroup ?? block.id : undefined,
        };
      });

      return blocks;
    });
  };

  const handleAddSingleBlock = () => {
    openExercisePicker({ mode: 'append-single-block' });
  };

  const handleAddSupersetBlock = () => {
    openExercisePicker({ mode: 'append-superset-block' });
  };

  const handleMoveBlock = (blockIndex: number, direction: -1 | 1) => {
    const targetIndex = blockIndex + direction;
    if (targetIndex < 0 || targetIndex >= currentDayBlocks.length) return;

    updateCurrentDayBlocks((blocks) => {
      const next = [...blocks];
      const [moved] = next.splice(blockIndex, 1);
      if (!moved) return blocks;
      next.splice(targetIndex, 0, moved);
      return next;
    });

    setEditorSetFocus((current) => {
      if (!current) return null;
      if (current.blockIndex === blockIndex) {
        return { ...current, blockIndex: targetIndex };
      }
      if (direction === -1 && current.blockIndex >= targetIndex && current.blockIndex < blockIndex) {
        return { ...current, blockIndex: current.blockIndex + 1 };
      }
      if (direction === 1 && current.blockIndex <= targetIndex && current.blockIndex > blockIndex) {
        return { ...current, blockIndex: current.blockIndex - 1 };
      }
      return current;
    });
  };

  const handleUpdateSupersetMetadata = (
    blockIndex: number,
    updates: Partial<Pick<ProgramBlockTemplate, 'rounds' | 'restAfterRoundSeconds' | 'transitionSeconds'>>
  ) => {
    updateCurrentDayBlocks((blocks) => {
      const block = blocks[blockIndex];
      if (!block || block.type !== 'superset') return blocks;
      block.rounds =
        updates.rounds == null || !Number.isFinite(updates.rounds)
          ? block.rounds
          : Math.max(1, Math.round(updates.rounds));
      block.restAfterRoundSeconds =
        updates.restAfterRoundSeconds == null || !Number.isFinite(updates.restAfterRoundSeconds)
          ? undefined
          : Math.max(0, Math.round(updates.restAfterRoundSeconds));
      block.transitionSeconds =
        updates.transitionSeconds == null || !Number.isFinite(updates.transitionSeconds)
          ? undefined
          : Math.max(0, Math.round(updates.transitionSeconds));
      return blocks;
    });
  };

  const handleReplaceExercise = (blockIndex: number, exerciseIndex: number) => {
    openExercisePicker({ mode: 'replace-exercise', blockIndex, exerciseIndex });
  };

  const handleSetSupersetSlotExercise = (blockIndex: number, slot: ProgramSupersetSlot) => {
    openExercisePicker({ mode: 'set-superset-slot', blockIndex, slot });
  };

  const handleConvertSingleToSupersetPair = (blockIndex: number) => {
    const nextBlocks = cloneBlockTemplates(currentDayBlocks);
    const block = nextBlocks[blockIndex];
    const sourceExercise = block?.exercises[0];
    if (!block || block.type !== 'single' || !sourceExercise) return;

    const convertedSets = (sourceExercise.sets.length > 0
      ? sourceExercise.sets
      : [createDefaultSetTemplate(sourceExercise.exerciseId, 1, 'single')]
    ).map((set, index) => ({
      ...cloneSetTemplate(set),
      exerciseId: sourceExercise.exerciseId,
      setIndex: index + 1,
      setType: 'superset' as const,
      supersetGroup: block.id,
    }));

    block.type = 'superset';
    block.rounds = Math.max(1, convertedSets.length);
    block.exercises = [
      {
        ...sourceExercise,
        id: createBlockExerciseId(block.id, 'A1'),
        slot: 'A1',
        sets: convertedSets,
      },
    ];

    updateCurrentDay((day) => ({
      ...day,
      blocks: nextBlocks,
    }));
    setEditorSetFocus({ blockIndex, exerciseIndex: 0, setIndex: 0 });
    setExercisePickerOpen(true);
    setExercisePickerTarget({ mode: 'set-superset-slot', blockIndex, slot: 'A2' });
    setExerciseQuery('');
    resetCustomExerciseBuilder();
  };

  const handleBreakSupersetPair = (blockIndex: number) => {
    const nextBlocks = cloneBlockTemplates(currentDayBlocks);
    const block = nextBlocks[blockIndex];
    if (!block || block.type !== 'superset') return;

    const sourceExercises = normalizeSlotOrder(block.exercises);
    if (sourceExercises.length === 0) return;

    const replacementBlocks = sourceExercises.map((exercise) => {
      const nextBlockId = createBlockId('single');
      return {
        id: nextBlockId,
        type: 'single' as const,
        exercises: [
          {
            ...exercise,
            id: createBlockExerciseId(nextBlockId, 0),
            slot: undefined,
            sets: exercise.sets.map((set, setIndex) => ({
              ...cloneSetTemplate(set),
              exerciseId: exercise.exerciseId,
              setIndex: setIndex + 1,
              setType: set.setType === 'superset' ? 'straight' : set.setType,
              supersetGroup: undefined,
            })),
          },
        ],
      };
    });

    nextBlocks.splice(blockIndex, 1, ...replacementBlocks);

    updateCurrentDay((day) => ({
      ...day,
      blocks: nextBlocks,
    }));
    setPendingExerciseUndo(null);
    setEditorSetFocus({ blockIndex, exerciseIndex: 0, setIndex: 0 });
  };

  const handleRemoveExercise = (blockIndex: number, exerciseIndex: number) => {
    const beforeBlocks = cloneBlockTemplates(currentDayBlocks);
    const nextBlocks = cloneBlockTemplates(currentDayBlocks);
    const block = nextBlocks[blockIndex];
    const removedExercise = block?.exercises?.[exerciseIndex];
    if (!block || !removedExercise) return;

    if (block.type === 'single') {
      nextBlocks.splice(blockIndex, 1);
    } else {
      const remaining = block.exercises.filter((_, index) => index !== exerciseIndex);
      block.exercises = normalizeSlotOrder(remaining).map((exercise, index) => ({
        ...exercise,
        slot: index === 0 ? 'A1' : 'A2',
        sets: exercise.sets.map((set, setIndex) => ({
          ...set,
          exerciseId: exercise.exerciseId,
          setIndex: setIndex + 1,
          setType: 'superset',
          supersetGroup: block.id,
        })),
      }));

      if (block.exercises.length === 0) {
        nextBlocks.splice(blockIndex, 1);
      }
    }

    const removedLabel =
      exerciseNameById.get(removedExercise.exerciseId) ?? humanizeExerciseId(removedExercise.exerciseId);

    updateCurrentDay((day) => ({
      ...day,
      blocks: nextBlocks,
    }));
    setPendingExerciseUndo({
      id: createUuid(),
      weekIndex: activeWeekIndex,
      dayIndex: activeDayIndex,
      beforeBlocks,
      afterBlocksFingerprint: fingerprintBlocks(nextBlocks),
      message: `${removedLabel} removed.`,
    });
    setEditorSetFocus(null);
  };

  const handleUndoExerciseRemoval = () => {
    if (!pendingExerciseUndo || !draft) return;
    const undo = pendingExerciseUndo;
    const targetWeek = draft.weeks[undo.weekIndex];
    const targetDay = targetWeek?.days[undo.dayIndex];
    if (!targetWeek || !targetDay) {
      setPendingExerciseUndo(null);
      return;
    }

    const currentTargetBlocks = cloneBlockTemplates(getDayBlocks(targetDay));
    if (fingerprintBlocks(currentTargetBlocks) !== undo.afterBlocksFingerprint) {
      setPendingExerciseUndo(null);
      setEditorError('Undo expired because this session changed.');
      return;
    }

    const nextDraft: ProgramTemplate = {
      ...draft,
      weeks: draft.weeks.map((week, weekIndex) => {
        if (weekIndex !== undo.weekIndex) return week;
        return {
          ...week,
          days: week.days.map((day, dayIndex) => {
            if (dayIndex !== undo.dayIndex) return day;
            return {
              ...day,
              blocks: cloneBlockTemplates(undo.beforeBlocks),
            };
          }),
        };
      }),
    };

    setDraft(nextDraft);
    setActiveWeekIndex(undo.weekIndex);
    setActiveDayIndex(undo.dayIndex);
    setEditorSetFocus(null);
    setEditorError(null);
    setPendingExerciseUndo(null);
  };

  const handleAddSetToExercise = (blockIndex: number, exerciseIndex: number) => {
    let nextFocus: EditorSetFocus = null;
    updateCurrentDayBlocks((blocks) => {
      const block = blocks[blockIndex];
      const exercise = block?.exercises[exerciseIndex];
      if (!block || !exercise) return blocks;
      const previous = exercise.sets[exercise.sets.length - 1];
      const nextSet =
        previous != null
          ? {
            ...cloneSetTemplate(previous),
            setIndex: exercise.sets.length + 1,
            exerciseId: exercise.exerciseId,
            setType: block.type === 'superset' ? 'superset' : previous.setType,
            supersetGroup: block.type === 'superset' ? block.id : undefined,
          }
          : createDefaultSetTemplate(
            exercise.exerciseId,
            1,
            block.type,
            block.type === 'superset' ? block.id : undefined
          );
      exercise.sets = [...exercise.sets, nextSet];
      nextFocus = { blockIndex, exerciseIndex, setIndex: exercise.sets.length - 1 };
      return blocks;
    });
    setEditorSetFocus(nextFocus);
  };

  const handleRemoveSetRow = (blockIndex: number, exerciseIndex: number, setIndex: number) => {
    updateCurrentDayBlocks((blocks) => {
      const block = blocks[blockIndex];
      const exercise = block?.exercises[exerciseIndex];
      if (!block || !exercise || exercise.sets.length <= 1) return blocks;
      exercise.sets = exercise.sets
        .filter((_, index) => index !== setIndex)
        .map((set, index) => ({
          ...set,
          setIndex: index + 1,
          exerciseId: exercise.exerciseId,
          setType: block.type === 'superset' ? 'superset' : set.setType,
          supersetGroup: block.type === 'superset' ? block.id : undefined,
        }));
      return blocks;
    });
    setEditorSetFocus((current) => {
      if (!current) return null;
      if (current.blockIndex !== blockIndex || current.exerciseIndex !== exerciseIndex) return current;
      if (current.setIndex === setIndex) return null;
      if (current.setIndex > setIndex) return { ...current, setIndex: current.setIndex - 1 };
      return current;
    });
  };

  const openExercisePicker = (target: ExercisePickerTarget) => {
    setExercisePickerTarget(target);
    setExercisePickerOpen(true);
    setExerciseQuery('');
    resetCustomExerciseBuilder();
  };

  const applyPickedExercise = (exerciseId: string) => {
    if (!exercisePickerTarget) return;
    const target = exercisePickerTarget;
    const nextBlocks = cloneBlockTemplates(currentDayBlocks);
    let nextFocus: EditorSetFocus = null;
    let followUpPickerTarget: ExercisePickerTarget = null;

    if (target.mode === 'append-single-block') {
      nextBlocks.push(createSingleBlock(exerciseId));
      nextFocus = { blockIndex: nextBlocks.length - 1, exerciseIndex: 0, setIndex: 0 };
    } else if (target.mode === 'append-superset-block') {
      nextBlocks.push(createSupersetBlock(exerciseId));
      const nextBlockIndex = nextBlocks.length - 1;
      nextFocus = { blockIndex: nextBlockIndex, exerciseIndex: 0, setIndex: 0 };
      followUpPickerTarget = { mode: 'set-superset-slot', blockIndex: nextBlockIndex, slot: 'A2' };
    } else if (target.mode === 'set-superset-slot') {
      const block = nextBlocks[target.blockIndex];
      if (block && block.type === 'superset') {
        const slot = target.slot;
        const sorted = normalizeSlotOrder(block.exercises);
        const existingIndex = sorted.findIndex((exercise) => exercise.slot === slot);
        const rounds = Math.max(
          1,
          block.rounds ?? sorted.reduce((max, exercise) => Math.max(max, exercise.sets.length), 1)
        );
        const sets = Array.from({ length: rounds }, (_, index) =>
          createDefaultSetTemplate(exerciseId, index + 1, 'superset', block.id)
        );
        const nextExercise: ProgramBlockExerciseTemplate = {
          id: createBlockExerciseId(block.id, slot),
          exerciseId,
          slot,
          sets,
        };
        if (existingIndex === -1) {
          sorted.push(nextExercise);
        } else {
          sorted[existingIndex] = nextExercise;
        }
        block.exercises = normalizeSlotOrder(sorted)
          .slice(0, 2)
          .map((exercise, index) => ({
            ...exercise,
            slot: index === 0 ? 'A1' : 'A2',
            sets: exercise.sets.map((set, setIndex) => ({
              ...set,
              exerciseId: exercise.exerciseId,
              setIndex: setIndex + 1,
              setType: 'superset',
              supersetGroup: block.id,
            })),
          }));
        const nextExerciseIndex = block.exercises.findIndex((exercise) => exercise.slot === slot);
        nextFocus = {
          blockIndex: target.blockIndex,
          exerciseIndex: Math.max(0, nextExerciseIndex),
          setIndex: 0,
        };
      }
    } else {
      const block = nextBlocks[target.blockIndex];
      const exercise = block?.exercises[target.exerciseIndex];
      if (block && exercise) {
        exercise.exerciseId = exerciseId;
        exercise.sets = exercise.sets.map((set, index) => ({
          ...set,
          exerciseId,
          setIndex: index + 1,
          setType: block.type === 'superset' ? 'superset' : set.setType,
          supersetGroup: block.type === 'superset' ? block.id : undefined,
        }));
        nextFocus = {
          blockIndex: target.blockIndex,
          exerciseIndex: target.exerciseIndex,
          setIndex: 0,
        };
      }
    }

    updateCurrentDay((day) => ({
      ...day,
      blocks: nextBlocks,
    }));
    setEditorSetFocus(nextFocus);

    if (followUpPickerTarget) {
      setExercisePickerOpen(true);
      setExercisePickerTarget(followUpPickerTarget);
      setExerciseQuery('');
      resetCustomExerciseBuilder();
      return;
    }

    setExercisePickerOpen(false);
    setExercisePickerTarget(null);
    setExerciseQuery('');
    resetCustomExerciseBuilder();
  };

  const openCreateCustomExerciseForm = () => {
    const seedName = normalizedExerciseQuery || customExerciseDraft.name;
    if (matchingExerciseByName) {
      applyPickedExercise(matchingExerciseByName.id);
      return;
    }
    setCustomExerciseDraft(createCustomExerciseDraft(seedName));
    setCustomExerciseError(null);
    setShowCustomExerciseAdvanced(false);
    setShowCreateCustomExercise(true);
  };

  const handleCreateCustomExercise = async () => {
    const name = customExerciseName;
    if (!name) {
      setCustomExerciseError('Add a name for this exercise.');
      return;
    }
    if (customExercisePrimaryMuscles.length === 0) {
      setCustomExerciseError('Add at least one primary muscle.');
      return;
    }

    const existingByDraftName = pickerExercises.find(
      (exercise) => exercise.name.trim().toLowerCase() === name.toLowerCase()
    );
    if (existingByDraftName) {
      applyPickedExercise(existingByDraftName.id);
      return;
    }

    setCustomExerciseSaving(true);
    setCustomExerciseError(null);
    try {
      const created = await createCustomExercise(user?.id ?? null, {
        name,
        equipment: customExerciseDraft.equipment,
        exerciseType: customExerciseDraft.exerciseType,
        primaryMuscles: customExercisePrimaryMuscles,
        secondaryMuscles: parseMusclesFromInput(customExerciseDraft.secondaryMusclesText),
        movementPattern: customExerciseDraft.movementPattern || undefined,
        trackWeight: customExerciseDraft.equipment !== 'bodyweight',
        trackReps: true,
        trackTime: false,
        defaultRestSeconds: customExerciseDraft.defaultRestSeconds,
      });

      setCustomExercises((current) => {
        const exists = current.some((exercise) => exercise.id === created.id);
        if (exists) return current;
        return [...current, created];
      });
      applyPickedExercise(created.id);
    } catch (createError) {
      const message =
        createError instanceof Error ? createError.message : 'Failed to create custom exercise.';
      setCustomExerciseError(message);
    } finally {
      setCustomExerciseSaving(false);
    }
  };

  useEffect(() => {
    if (!pendingExerciseUndo || !draft) return;
    const week = draft.weeks[pendingExerciseUndo.weekIndex];
    const day = week?.days[pendingExerciseUndo.dayIndex];
    if (!day) {
      setPendingExerciseUndo(null);
      return;
    }
    const currentFingerprint = fingerprintBlocks(getDayBlocks(day));
    if (currentFingerprint !== pendingExerciseUndo.afterBlocksFingerprint) {
      setPendingExerciseUndo(null);
    }
  }, [draft, pendingExerciseUndo]);

  useEffect(() => {
    if (!pendingExerciseUndo) return;
    const timeoutId = window.setTimeout(() => {
      setPendingExerciseUndo((current) =>
        current?.id === pendingExerciseUndo.id ? null : current
      );
    }, 7000);
    return () => window.clearTimeout(timeoutId);
  }, [pendingExerciseUndo]);

  const handleSaveDraft = async () => {
    if (!draft) return;

    const normalized = normalizeProgramForSave(draft);
    if (!normalized.name.trim()) {
      setEditorError('Program needs a name.');
      return;
    }
    if (getProgramSetCount(normalized) === 0) {
      setEditorError('Add at least one set to make this launch-ready.');
      return;
    }

    setEditorSaving(true);
    setEditorError(null);
    try {
      await saveProgram(normalized);
      selectProgram(normalized);
      setEditorBaselineFingerprint(fingerprintProgram(normalized));
      resetEditorState();
    } catch (saveError) {
      const message = saveError instanceof Error ? saveError.message : 'Failed to save program';
      setEditorError(message);
    } finally {
      setEditorSaving(false);
    }
  };

  const handleSelectProgram = (program: ProgramTemplate) => {
    selectProgram(program);
  };

  const handleStartProgram = (program: ProgramTemplate) => {
    selectProgram(program);
    const progress = getProgramProgress(program, namespaceId);
    router.push(
      `/workout/new?program_id=${encodeURIComponent(program.id)}&week=${progress.weekIndex}&day=${progress.dayIndex}&cycle=${progress.cycleNumber}`
    );
  };

  const handleDuplicateProgram = async (program: ProgramTemplate) => {
    const clone = normalizeProgramForSave({
      ...deepClone(program),
      id: `userprog_${createUuid()}`,
      name: `${program.name} Copy`,
      isCustom: true,
    });
    await saveProgram(clone);
    selectProgram(clone);
  };

  const handleDeleteProgram = async (program: ProgramTemplate) => {
    if (builtInProgramIds.has(program.id)) return;
    const confirmed = await confirm(
      'Delete Program?',
      `Are you sure you want to delete "${program.name}"? This action cannot be undone.`,
      { variant: 'danger', confirmLabel: 'Delete Program', cancelLabel: 'Cancel' }
    );
    if (!confirmed) return;
    await deleteProgram(program.id);
  };

  const renderExerciseEditor = (
    block: ProgramBlockTemplate,
    blockIndex: number,
    exercise: ProgramBlockExerciseTemplate,
    exerciseIndex: number,
    slotLabel?: ProgramSupersetSlot
  ) => {
    const exerciseLabel = exerciseNameById.get(exercise.exerciseId) ?? humanizeExerciseId(exercise.exerciseId);
    const hasFocusedSet =
      hasEditorSetFocus &&
      editorSetFocus?.blockIndex === blockIndex &&
      editorSetFocus.exerciseIndex === exerciseIndex;
    const canReorderBlock =
      block.type === 'single' || slotLabel === 'A1' || (block.type === 'superset' && block.exercises.length < 2);
    const canMoveUp = blockIndex > 0;
    const canMoveDown = blockIndex < currentDayBlocks.length - 1;
    const showSupersetSettings =
      hasFocusedSet && block.type === 'superset' && (slotLabel === 'A1' || block.exercises.length < 2);
    const canBreakSupersetPair = block.type === 'superset';
    const compactSetSummary =
      exercise.sets.length === 0
        ? 'No set prescription yet.'
        : exercise.sets
          .slice(0, 2)
          .map((set, index) => `S${index + 1} ${getSetSummaryLine(set)}`)
          .join(' • ');

    return (
      <article
        key={`${block.id}-${exercise.id}-${slotLabel ?? 'single'}`}
        className={`border-b border-white/8 py-3 ${hasFocusedSet ? 'bg-white/[0.025]' : ''
          }`}
      >
        <div className="mb-2 flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="truncate text-left text-base font-bold text-zinc-100">{exerciseLabel}</p>
            <p className="mt-1 text-[10px] uppercase tracking-[0.18em] text-zinc-500">
              {slotLabel ? `${slotLabel} • ` : ''}{exercise.sets.length} {exercise.sets.length === 1 ? 'set' : 'sets'}
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-1.5">
            <button
              type="button"
              aria-label={hasFocusedSet ? 'Collapse' : 'Edit Sets'}
              onClick={() =>
                setEditorSetFocus((current) => {
                  const isCurrent =
                    current?.blockIndex === blockIndex && current.exerciseIndex === exerciseIndex;
                  if (isCurrent) return null;
                  return { blockIndex, exerciseIndex, setIndex: 0 };
                })
              }
              className={`inline-flex h-10 items-center rounded-xl border px-3 text-xs font-semibold transition-colors ${hasFocusedSet
                ? 'border-white/18 bg-white/[0.08] text-zinc-100'
                : 'border-white/10 bg-white/[0.035] text-zinc-300 hover:bg-white/[0.065] hover:text-zinc-100'
                }`}
            >
              {hasFocusedSet ? 'Done' : 'Sets'}
            </button>
            <LiquidActionMenu
              label={`Exercise actions for ${exerciseLabel}`}
              trigger={
                <span className="liquid-icon-button flex h-10 w-10 items-center justify-center rounded-full text-zinc-300">
                  <MoreHorizontal className="h-4 w-4" />
                </span>
              }
            >
              <LiquidMenuRow
                label="Replace"
                icon={<Search className="h-3.5 w-3.5" />}
                onClick={() => handleReplaceExercise(blockIndex, exerciseIndex)}
              />
              {block.type === 'single' && (
                <LiquidMenuRow
                  label="Make superset"
                  icon={<Dumbbell className="h-3.5 w-3.5" />}
                  onClick={() => handleConvertSingleToSupersetPair(blockIndex)}
                />
              )}
              {canBreakSupersetPair && (
                <LiquidMenuRow
                  label="Break superset"
                  icon={<Settings2 className="h-3.5 w-3.5" />}
                  onClick={() => handleBreakSupersetPair(blockIndex)}
                />
              )}
              {canReorderBlock && (
                <>
                  <LiquidMenuRow
                    label="Move up"
                    icon={<ChevronLeft className="h-3.5 w-3.5 rotate-90" />}
                    disabled={!canMoveUp}
                    onClick={() => handleMoveBlock(blockIndex, -1)}
                  />
                  <LiquidMenuRow
                    label="Move down"
                    icon={<ChevronRight className="h-3.5 w-3.5 rotate-90" />}
                    disabled={!canMoveDown}
                    onClick={() => handleMoveBlock(blockIndex, 1)}
                  />
                </>
              )}
              <LiquidMenuRow
                label="Remove Exercise"
                icon={<Trash2 className="h-3.5 w-3.5" />}
                danger
                aria-label="Remove Exercise"
                onClick={() => handleRemoveExercise(blockIndex, exerciseIndex)}
              >
                Remove
              </LiquidMenuRow>
            </LiquidActionMenu>
          </div>
        </div>

        {showSupersetSettings && (
          <div className="mb-3 grid gap-2 border-y border-white/8 py-2 sm:grid-cols-3">
            <div>
              <label className="text-[10px] font-bold uppercase tracking-[0.2em] text-zinc-500">
                Rounds
              </label>
              <EditableNumberInput
                min={1}
                step={1}
                value={block.rounds ?? 1}
                defaultValue={1}
                onCommit={(value) =>
                  handleUpdateSupersetMetadata(blockIndex, {
                    rounds: value == null ? 1 : value,
                  })
                }
                className="liquid-field mt-1 w-full px-2.5 py-2 text-sm"
              />
            </div>
            <div>
              <label className="text-[10px] font-bold uppercase tracking-[0.2em] text-zinc-500">
                Round Rest (s)
              </label>
              <EditableNumberInput
                min={0}
                step={5}
                value={block.restAfterRoundSeconds ?? 60}
                defaultValue={60}
                onCommit={(value) =>
                  handleUpdateSupersetMetadata(blockIndex, {
                    restAfterRoundSeconds: value == null ? undefined : value,
                  })
                }
                className="liquid-field mt-1 w-full px-2.5 py-2 text-sm"
              />
            </div>
            {editorDetailMode === 'advanced' && (
              <div>
                <label className="text-[10px] font-bold uppercase tracking-[0.2em] text-zinc-500">
                  A1→A2 Transition (s)
                </label>
                <EditableNumberInput
                  min={0}
                  step={5}
                  value={block.transitionSeconds ?? 0}
                  defaultValue={0}
                  onCommit={(value) =>
                    handleUpdateSupersetMetadata(blockIndex, {
                      transitionSeconds: value == null ? undefined : value,
                    })
                  }
                  className="liquid-field mt-1 w-full px-2.5 py-2 text-sm"
                />
              </div>
            )}
          </div>
        )}

        {!hasFocusedSet && (
          <p className="truncate border-t border-white/8 pt-2 text-[10px] uppercase tracking-[0.18em] text-zinc-500">
            {compactSetSummary}
          </p>
        )}

        {hasFocusedSet && (
          <div className="space-y-2">
            {exercise.sets.map((set, setIndex) => (
              <div key={`${exercise.id}-set-${setIndex}`} className="rounded-xl border border-white/8 bg-white/[0.025] p-3">
                <div className="mb-2 flex items-start justify-between gap-2">
                  <p className="min-w-0 text-[10px] uppercase tracking-[0.18em] text-zinc-400">
                    Set {setIndex + 1} • {getSetSummaryLine(set)}
                  </p>
                  <div className="flex shrink-0 items-center gap-2">
                    <button
                      type="button"
                      onClick={() => handleRemoveSetRow(blockIndex, exerciseIndex, setIndex)}
                      disabled={exercise.sets.length <= 1}
                      className="liquid-danger-button inline-flex h-10 items-center rounded-lg px-3 text-[10px] font-bold uppercase tracking-[0.18em] disabled:opacity-40"
                      aria-label={`Remove set ${setIndex + 1}`}
                    >
                      Remove
                    </button>
                  </div>
                </div>

                <div
                  className={`grid gap-2 ${editorDetailMode === 'advanced' ? 'grid-cols-2 sm:grid-cols-4' : 'grid-cols-2 sm:grid-cols-3'
                    }`}
                >
                  <div>
                    <label className="text-[10px] font-bold uppercase tracking-[0.2em] text-zinc-500">
                      Reps
                    </label>
                    <input
                      aria-label={`Set ${setIndex + 1} reps`}
                      value={set.prescribedReps}
                      onChange={(event) =>
                        handleSetTemplateUpdate(blockIndex, exerciseIndex, setIndex, (current) => ({
                          ...current,
                          prescribedReps: event.target.value,
                        }))
                      }
                      className="liquid-field mt-1 w-full px-2.5 py-2 text-sm"
                    />
                  </div>

                  <div>
                    <label className="text-[10px] font-bold uppercase tracking-[0.2em] text-zinc-500">
                      {getTargetLabel(set.prescriptionMethod)}
                    </label>
                    <input
                      aria-label={`Set ${setIndex + 1} target`}
                      value={getRpeOrRirValue(set)}
                      onChange={(event) =>
                        handleSetTemplateUpdate(blockIndex, exerciseIndex, setIndex, (current) =>
                          applySetTargetInput(current, event.target.value)
                        )
                      }
                      className="liquid-field mt-1 w-full px-2.5 py-2 text-sm"
                    />
                  </div>

                  <div>
                    <label className="text-[10px] font-bold uppercase tracking-[0.2em] text-zinc-500">
                      Rest (s)
                    </label>
                    <EditableNumberInput
                      min={0}
                      step={15}
                      value={set.restSeconds ?? 120}
                      defaultValue={120}
                      onCommit={(value) =>
                        handleSetTemplateUpdate(blockIndex, exerciseIndex, setIndex, (current) => ({
                          ...current,
                          restSeconds: value == null ? undefined : value,
                        }))
                      }
                      className="liquid-field mt-1 w-full px-2.5 py-2 text-sm"
                    />
                  </div>

                  {editorDetailMode === 'advanced' && (
                    <>
                      <div>
                        <label className="text-[10px] font-bold uppercase tracking-[0.2em] text-zinc-500">
                          Method
                        </label>
                        <FancySelect
                          value={set.prescriptionMethod ?? 'rpe'}
                          options={PRESCRIPTION_OPTIONS.map((method) => ({
                            value: method,
                            label: PRESCRIPTION_LABELS[method] ?? formatTokenLabel(method),
                          }))}
                          onChange={(value) =>
                            handleSetTemplateUpdate(blockIndex, exerciseIndex, setIndex, (current) => {
                              const prescriptionMethod = value as SetTemplate['prescriptionMethod'];
                              return {
                                ...current,
                                prescriptionMethod,
                                targetRPE: prescriptionMethod === 'rpe' ? current.targetRPE ?? null : null,
                                targetRIR: prescriptionMethod === 'rir' ? current.targetRIR ?? null : null,
                                targetPercentage:
                                  prescriptionMethod === 'percentage_1rm' || prescriptionMethod === 'percentage_tm'
                                    ? current.targetPercentage ?? null
                                    : null,
                                fixedWeight: prescriptionMethod === 'fixed_weight' ? current.fixedWeight ?? null : null,
                                targetSeconds: prescriptionMethod === 'time_based' ? current.targetSeconds ?? null : null,
                              };
                            })
                          }
                          ariaLabel="Prescription method"
                          buttonClassName="liquid-field mt-1 w-full px-2.5 py-2 text-sm"
                          listClassName="max-h-56 overflow-y-auto"
                        />
                      </div>

                      {block.type === 'single' && (
                        <div>
                          <label className="text-[10px] font-bold uppercase tracking-[0.2em] text-zinc-500">
                            Set Style
                          </label>
                          <FancySelect
                            value={set.setType ?? 'straight'}
                            options={ADVANCED_SET_TYPE_OPTIONS.map((setTypeOption) => ({
                              value: setTypeOption,
                              label: formatTokenLabel(setTypeOption),
                            }))}
                            onChange={(value) =>
                              handleSetTemplateUpdate(blockIndex, exerciseIndex, setIndex, (current) => ({
                                ...current,
                                setType: value as SetTemplate['setType'],
                                supersetGroup:
                                  value === 'superset' ? current.supersetGroup ?? block.id : current.supersetGroup,
                              }))
                            }
                            ariaLabel="Set style"
                            buttonClassName="liquid-field mt-1 w-full px-2.5 py-2 text-sm"
                            listClassName="max-h-56 overflow-y-auto"
                          />
                        </div>
                      )}

                      {block.type === 'superset' && (
                        <div>
                          <label className="text-[10px] font-bold uppercase tracking-[0.2em] text-zinc-500">
                            Group
                          </label>
                          <div className="liquid-field mt-1 px-2.5 py-2 text-xs font-semibold text-zinc-200">
                            Superset {slotLabel ?? ''}
                          </div>
                        </div>
                      )}

                      <div>
                        <label className="text-[10px] font-bold uppercase tracking-[0.2em] text-zinc-500">
                          Tempo
                        </label>
                        <input
                          value={set.tempo ?? ''}
                          onChange={(event) =>
                            handleSetTemplateUpdate(blockIndex, exerciseIndex, setIndex, (current) => ({
                              ...current,
                              tempo: event.target.value.trim() || undefined,
                            }))
                          }
                          placeholder="3-1-1-0"
                          className="liquid-field mt-1 w-full px-2.5 py-2 text-sm placeholder:text-zinc-600"
                        />
                      </div>

                      {set.setType === 'cluster' && block.type === 'single' && (
                        <>
                          <div>
                            <label className="text-[10px] font-bold uppercase tracking-[0.2em] text-zinc-500">
                              Cluster Reps
                            </label>
                            <input
                              value={set.clusterReps?.join(',') ?? ''}
                              onChange={(event) =>
                                handleSetTemplateUpdate(blockIndex, exerciseIndex, setIndex, (current) => {
                                  const parsed = event.target.value
                                    .split(',')
                                    .map((entry) => Number(entry.trim()))
                                    .filter((entry) => Number.isFinite(entry) && entry > 0);
                                  return {
                                    ...current,
                                    clusterReps: parsed.length > 0 ? parsed : undefined,
                                  };
                                })
                              }
                              placeholder="2,2,2"
                              className="liquid-field mt-1 w-full px-2.5 py-2 text-sm placeholder:text-zinc-600"
                            />
                          </div>
                          <div>
                            <label className="text-[10px] font-bold uppercase tracking-[0.2em] text-zinc-500">
                              Cluster Rest (s)
                            </label>
                            <EditableNumberInput
                              min={5}
                              step={5}
                              value={set.clusterRestSeconds ?? 20}
                              defaultValue={20}
                              onCommit={(value) =>
                                handleSetTemplateUpdate(blockIndex, exerciseIndex, setIndex, (current) => ({
                                  ...current,
                                  clusterRestSeconds: value == null ? undefined : value,
                                }))
                              }
                              className="liquid-field mt-1 w-full px-2.5 py-2 text-sm"
                            />
                          </div>
                        </>
                      )}
                    </>
                  )}
                </div>
              </div>
            ))}
            <div className="mt-2 space-y-2">
              <button
                type="button"
                onClick={() => handleAddSetToExercise(blockIndex, exerciseIndex)}
                className="inline-flex h-11 w-full items-center justify-center rounded-xl border border-white/10 bg-white/[0.035] px-3 text-xs font-semibold text-zinc-200 transition-colors hover:bg-white/[0.065]"
              >
                Add Set
              </button>
            </div>
          </div>
        )}
      </article>
    );
  };

  return (
    <>
      <div className="mx-auto w-full max-w-5xl space-y-6 pb-12 pt-4 sm:space-y-8 sm:pt-10">
        <header className="stagger-item px-1">
          <div className="flex items-start justify-between gap-4">
            <div className="space-y-0.5 sm:space-y-1">
              <h1 className="iron-display text-3xl text-zinc-100 sm:text-4xl">Programs</h1>
            </div>
            {workspaceView === 'builder' && (
              <button
                type="button"
                onClick={openCreateEditor}
                disabled={loading}
                className="liquid-action-button inline-flex h-11 items-center gap-2 rounded-2xl px-4 text-sm font-black italic tracking-tight text-zinc-950 transition-colors disabled:cursor-wait disabled:opacity-50"
              >
                <CirclePlus className="h-4 w-4" />
                New
              </button>
            )}
          </div>

          {showWorkspaceTabs && (
            <LiquidSegmentedControl
              value={workspaceView}
              onChange={setWorkspaceView}
              className={`mt-6 w-full max-w-md ${FEATURES.programCalendar && FEATURES.coachCollab ? 'grid-cols-3' : 'grid-cols-2'}`}
              options={[
                { value: 'builder', label: 'Builder' },
                ...(FEATURES.programCalendar ? [{ value: 'calendar' as const, label: 'Calendar' }] : []),
                ...(FEATURES.coachCollab ? [{ value: 'collab' as const, label: 'Collab' }] : []),
              ]}
            />
          )}

          {workspaceView === 'builder' && (
            <>
              <div className="liquid-field mt-5 flex items-center gap-3 px-3 py-2.5">
                <Search className="h-4 w-4 text-zinc-500" />
                <input
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="Search programs..."
                  className="w-full bg-transparent text-sm text-zinc-100 placeholder:text-zinc-600 focus:outline-none"
                />
              </div>

              <LiquidSegmentedControl
                value={filter}
                onChange={setFilter}
                className="mt-4 w-full max-w-xs grid-cols-3"
                options={[
                  { value: 'all', label: 'All' },
                  { value: 'mine', label: 'Mine' },
                  { value: 'built-in', label: 'Built-in' },
                ]}
              />
            </>
          )
          }
        </header >

        {workspaceView === 'builder' && (
          <>
            <section className="border-y border-white/8 py-4">
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-zinc-200">
                    {activeProgram?.name ?? 'No program selected'}
                  </p>
                  <p className="mt-1 text-xs text-zinc-500">
                    {activeProgram ? getFrequencyLabel(activeProgram) : 'Pick or build a program'}
                  </p>
                </div>
                {activeProgram && (
                  <button
                    type="button"
                    onClick={() => handleStartProgram(activeProgram)}
                    className={liquidButtonClass({ variant: 'action', density: 'compact', className: 'shrink-0 rounded-xl px-3' })}
                  >
                    <Play className="h-3.5 w-3.5" />
                    Start
                  </button>
                )}
              </div>
              {activeProgram && visibleProgramTuneUp && programTuneUpKey && (
                <div
                  className="mt-4 border-t border-white/8 pt-3"
                  data-testid="program-tune-up"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="mt-1 text-sm font-medium text-zinc-100">
                        {visibleProgramTuneUp.title}
                      </p>
                    </div>
                    <p className="shrink-0 text-right text-xs text-zinc-500">
                      {visibleProgramTuneUp.confidence} · {formatTuneUpSource(visibleProgramTuneUp.source)}
                    </p>
                  </div>
                  <div className="mt-3 flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => openTuneUpEditor(activeProgram, visibleProgramTuneUp)}
                      className={liquidButtonClass({ variant: 'action', density: 'compact', className: 'rounded-xl px-3' })}
                      data-testid="program-tune-up-apply"
                    >
                      Review
                    </button>
                    <button
                      type="button"
                      onClick={() => dismissTuneUp(programTuneUpKey)}
                      className="rounded-xl border border-white/10 px-3 py-2 text-sm font-medium text-zinc-400 hover:text-zinc-200"
                      data-testid="program-tune-up-dismiss"
                    >
                      Dismiss
                    </button>
                  </div>
                </div>
              )}
            </section>

            <section className="py-3 [overflow-anchor:none]">
              {loading && (
                <div className="py-6 text-sm text-zinc-500">Loading programs...</div>
              )}

              {!loading && programList.length === 0 && (
                <div className="py-10 text-center">
                  <p className="text-zinc-400">No programs found.</p>
                  <button
                    type="button"
                    onClick={openCreateEditor}
                    className="mt-4 inline-flex items-center gap-2 rounded-xl border border-zinc-700 px-4 py-2 text-sm font-medium text-zinc-200"
                  >
                    <CirclePlus className="h-4 w-4" />
                    Build from scratch
                  </button>
                </div>
              )}

              {!loading &&
                programList.map((program) => {
                  const isSelected = selectedProgram?.id === program.id;
                  const detailTokens = [
                    program.goal ? GOAL_LABELS[program.goal] ?? formatTokenLabel(program.goal) : null,
                    program.experienceLevel
                      ? EXPERIENCE_LABELS[program.experienceLevel] ?? formatTokenLabel(program.experienceLevel)
                      : null,
                  ].filter(Boolean) as string[];
                  return (
                    <motion.article
                      key={program.id}
                      className={`relative border-b border-white/8 px-1 py-3 transition-colors duration-200 sm:px-3 ${isSelected ? 'bg-white/[0.035]' : ''}`}
                    >
                      {isSelected && <span className="absolute inset-y-3 left-0 w-0.5 bg-white/55" aria-hidden="true" />}
                      <div className="flex items-center justify-between gap-3 pl-3">
                        <button
                          type="button"
                          onClick={() => handleSelectProgram(program)}
                          className="min-w-0 flex-1 text-left"
                        >
                          <p
                            className={`break-words text-lg font-medium leading-tight ${isSelected ? 'text-zinc-50' : 'text-zinc-100'}`}
                          >
                            {program.name}
                          </p>
                          <p className="mt-1 text-xs text-zinc-500">
                            {getFrequencyLabel(program)}
                          </p>
                        </button>

                        <div className="flex items-center gap-1.5">
	                          {isSelected && (
	                            <span className="hidden items-center gap-1.5 text-xs font-semibold text-zinc-300 sm:inline-flex">
	                              <Check className="h-3.5 w-3.5" />
	                              Active
	                            </span>
	                          )}
                          {!isSelected && (
                            <button
                              type="button"
                              onClick={() => handleSelectProgram(program)}
                              className="inline-flex min-h-9 items-center rounded-xl border border-white/10 bg-white/[0.035] px-3 text-xs font-semibold text-zinc-300 transition-colors hover:bg-white/[0.065] hover:text-zinc-50"
                            >
                              Set Active
                            </button>
                          )}
	                          <LiquidActionMenu
                            label={`Actions for ${program.name}`}
                            trigger={
                              <span className="liquid-icon-button flex h-9 w-9 items-center justify-center rounded-full text-zinc-300">
                                <MoreHorizontal className="h-4 w-4" />
                              </span>
                            }
                          >
                            <LiquidMenuRow
                              label="Start"
                              icon={<Play className="h-3.5 w-3.5" />}
                              onClick={() => handleStartProgram(program)}
                            />
	                            <LiquidMenuRow
	                              label={isSelected ? 'Active' : 'Set Active'}
	                              icon={<Check className="h-3.5 w-3.5" />}
                              onClick={() => handleSelectProgram(program)}
                              disabled={isSelected}
                            />
                            <LiquidMenuRow
                              label="Edit"
                              icon={<Pencil className="h-3.5 w-3.5" />}
                              onClick={() => openEditEditor(program)}
                            />
                            <LiquidMenuRow
                              label="Duplicate"
                              icon={<Copy className="h-3.5 w-3.5" />}
                              onClick={() => void handleDuplicateProgram(program)}
                            />
                            <LiquidMenuRow
                              label="Delete"
                              icon={<Trash2 className="h-3.5 w-3.5" />}
                              danger
                              disabled={builtInProgramIds.has(program.id)}
                              onClick={() => void handleDeleteProgram(program)}
                            />
                            {(program.description || detailTokens.length > 0) && (
                              <div className="mt-1 border-t border-white/8 px-3 py-2 text-xs leading-5 text-zinc-400">
                                {program.description && <p>{program.description}</p>}
                                {detailTokens.length > 0 && (
                                  <p className={program.description ? 'mt-2 text-zinc-500' : 'text-zinc-500'}>
                                    {detailTokens.join(' / ')}
                                  </p>
                                )}
                              </div>
                            )}
                          </LiquidActionMenu>
                        </div>
                      </div>
                    </motion.article>
                  );
                })}
            </section>

            {error && <p className="border-t border-zinc-900 pt-4 text-xs text-rose-400">{error}</p>}
            {cloudSaveError && (
              <p className="border-t border-zinc-900 pt-4 text-xs text-amber-400">{cloudSaveError}</p>
            )}
          </>
        )}

        {
          workspaceView === 'calendar' && FEATURES.programCalendar && (
            <ProgramsCalendarView programs={allPrograms} />
          )
        }

        {
          workspaceView === 'collab' && FEATURES.coachCollab && (
            <CoachCollabPanel programs={allPrograms} />
          )
        }
      </div >

      {
        editorMode && draft && (
          <div className="fixed inset-0 z-[70] flex flex-col bg-[#05070b] text-zinc-100">
            <div className="liquid-ambient pointer-events-none fixed inset-0 opacity-70" />
            <div className="flex-1 overflow-y-auto px-4 pb-28 pt-[calc(env(safe-area-inset-top)+0.75rem)] sm:px-6">
              <div className="mx-auto w-full max-w-5xl">
              <header className="sticky top-3 z-30">
                <div className="grid grid-cols-[auto_1fr_auto] items-center gap-2">
                  <button
                    type="button"
                    aria-label="Back"
                    onClick={closeEditor}
                    className="liquid-icon-button inline-flex h-10 w-10 items-center justify-center rounded-full text-zinc-300 transition-colors hover:text-zinc-100"
                  >
                    <ArrowLeft className="h-4 w-4" />
                  </button>
                  <p className="truncate text-center text-sm font-black uppercase italic tracking-tight text-zinc-100">
                    Builder
                  </p>
                  <button
                    type="button"
                    onClick={() => {
                      void handleSaveDraft();
                    }}
                    disabled={editorSaving}
                    className={liquidButtonClass({ variant: 'action', density: 'compact', className: 'h-10 rounded-xl px-4' })}
                  >
                    {editorSaving ? 'Saving...' : 'Done'}
                  </button>
                </div>
              </header>

              {editorNotice && (
                <div className="mt-4 rounded-xl border border-emerald-500/25 bg-emerald-500/10 px-3 py-2 text-xs font-semibold text-emerald-200">
                  {editorNotice}
                </div>
              )}

              <section className="border-b border-white/8 py-5">
                <label className="sr-only">Program name</label>
                <textarea
                  value={draft.name}
                  onChange={(event) => updateDraft((current) => ({ ...current, name: event.target.value }))}
                  placeholder="Program name"
                  rows={2}
                  className="mt-2 w-full resize-none bg-transparent text-2xl font-black italic leading-tight tracking-tight text-zinc-100 placeholder:text-zinc-700 focus:outline-none sm:text-3xl"
                />

                <textarea
                  value={draft.description ?? ''}
                  onChange={(event) => updateDraft((current) => ({ ...current, description: event.target.value }))}
                  placeholder="Description (optional)"
                  rows={2}
                  className="mt-3 w-full resize-none bg-transparent text-sm text-zinc-400 placeholder:text-zinc-700 focus:outline-none"
                />

                <div className="mt-4 space-y-3">
                  <div className="space-y-2">
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="text-xs font-semibold text-zinc-500">Weeks</label>
                        <input
                          type="number"
                          min={1}
                          max={24}
                          value={weekCountInput}
                          onFocus={() => setWeekCountFocused(true)}
                          onBlur={() => {
                            setWeekCountFocused(false);
                            const trimmed = weekCountInput.trim();
                            if (!trimmed) {
                              setWeekCountInput(String(resolvedWeekCount));
                              return;
                            }
                            const parsed = Number(trimmed);
                            if (!Number.isFinite(parsed)) {
                              setWeekCountInput(String(resolvedWeekCount));
                              return;
                            }
                            const clamped = Math.min(24, Math.max(1, parsed));
                            if (clamped !== resolvedWeekCount) {
                              updateDraftWeekCount(clamped);
                            }
                            setWeekCountInput(String(clamped));
                          }}
                          onChange={(event) => {
                            const nextValue = event.target.value;
                            if (!/^\d*$/.test(nextValue)) return;
                            setWeekCountInput(nextValue);
                            if (nextValue === '') return;
                            const parsed = Number(nextValue);
                            if (!Number.isFinite(parsed)) return;
                            const clamped = Math.min(24, Math.max(1, parsed));
                            if (clamped !== resolvedWeekCount) {
                              updateDraftWeekCount(clamped);
                            }
                          }}
                          className="liquid-field mt-2 w-full px-3 py-2.5 text-sm"
                        />
                      </div>
                      <div>
                        <label className="text-xs font-semibold text-zinc-500">Sessions/week</label>
                        <input
                          type="number"
                          min={1}
                          max={7}
                          value={daysPerWeekInput}
                          onFocus={() => setDaysPerWeekFocused(true)}
                          onBlur={() => {
                            setDaysPerWeekFocused(false);
                            const trimmed = daysPerWeekInput.trim();
                            if (!trimmed) {
                              setDaysPerWeekInput(String(resolvedDaysPerWeek));
                              return;
                            }
                            const parsed = Number(trimmed);
                            if (!Number.isFinite(parsed)) {
                              setDaysPerWeekInput(String(resolvedDaysPerWeek));
                              return;
                            }
                            const clamped = Math.min(7, Math.max(1, parsed));
                            if (clamped !== resolvedDaysPerWeek) {
                              updateDraftDaysPerWeek(clamped);
                            }
                            setDaysPerWeekInput(String(clamped));
                          }}
                          onChange={(event) => {
                            const nextValue = event.target.value;
                            if (!/^\d*$/.test(nextValue)) return;
                            setDaysPerWeekInput(nextValue);
                            if (nextValue === '') return;
                            const parsed = Number(nextValue);
                            if (!Number.isFinite(parsed)) return;
                            const clamped = Math.min(7, Math.max(1, parsed));
                            if (clamped !== resolvedDaysPerWeek) {
                              updateDraftDaysPerWeek(clamped);
                            }
                          }}
                          className="liquid-field mt-2 w-full px-3 py-2.5 text-sm"
                        />
                      </div>
                    </div>
                  </div>

                  <div className="space-y-2 border-t border-white/8 pt-3">
                    <div className="mt-2 grid grid-cols-1 gap-3 sm:grid-cols-3">
                      <FancySelect
                        value={draft.goal ?? 'general'}
                        options={GOAL_OPTIONS.map((goal) => ({
                          value: goal,
                          label: GOAL_LABELS[goal] ?? formatTokenLabel(goal),
                        }))}
                        onChange={(value) =>
                          updateDraft((current) => ({ ...current, goal: value as GoalOption }))
                        }
                        ariaLabel="Program goal"
                        buttonClassName="liquid-field px-3 py-2.5 text-xs font-semibold text-zinc-100"
                      />
                      <FancySelect
                        value={draft.experienceLevel ?? 'intermediate'}
                        options={EXPERIENCE_OPTIONS.map((level) => ({
                          value: level,
                          label: EXPERIENCE_LABELS[level] ?? formatTokenLabel(level),
                        }))}
                        onChange={(value) =>
                          updateDraft((current) => ({
                            ...current,
                            experienceLevel: value as ExperienceOption,
                          }))
                        }
                        ariaLabel="Experience level"
                        buttonClassName="liquid-field px-3 py-2.5 text-xs font-semibold text-zinc-100"
                      />
                      <FancySelect
                        value={draft.intensityMethod ?? 'rpe'}
                        options={INTENSITY_OPTIONS.map((method) => ({
                          value: method,
                          label: INTENSITY_LABELS[method] ?? formatTokenLabel(method),
                        }))}
                        onChange={(value) =>
                          updateDraft((current) => ({
                            ...current,
                            intensityMethod: value as IntensityOption,
                          }))
                        }
                        ariaLabel="Intensity method"
                        buttonClassName="liquid-field px-3 py-2.5 text-xs font-semibold text-zinc-100"
                      />
                    </div>
                  </div>
                </div>
              </section>

              <section className="border-b border-white/8 py-4">
                <div className="mb-4 space-y-2">
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => stepEditorWeek(-1)}
                      disabled={activeWeekIndex === 0}
                      className="liquid-icon-button inline-flex h-10 w-10 items-center justify-center rounded-xl text-zinc-300 disabled:opacity-35"
                      aria-label="Previous week"
                    >
                      <ChevronLeft className="h-4 w-4" />
                    </button>
                    <LiquidActionMenu
                      label="Choose week"
                      align="start"
                      width={320}
                      className="flex-1"
                      trigger={
                        <span className="liquid-field flex w-full items-center justify-center px-3 py-2.5 text-center text-sm font-semibold text-zinc-100">
                          Week {activeWeekIndex + 1}
                        </span>
                      }
                    >
                      {draft.weeks.map((week, index) => {
                        const weekSetCount = week.days.reduce((count, day) => count + countDaySets(day), 0);
                        const isActive = index === activeWeekIndex;
                        return (
                          <LiquidMenuRow
                            key={`menu-week-${week.weekNumber}`}
                            label={`Week ${index + 1}`}
                            detail={`${week.days.length} sessions / ${weekSetCount} sets`}
                            icon={isActive ? <Check className="h-3.5 w-3.5" /> : undefined}
                            onClick={() => selectEditorWeek(index)}
                          />
                        );
                      })}
                    </LiquidActionMenu>
                    <button
                      type="button"
                      onClick={() => stepEditorWeek(1)}
                      disabled={activeWeekIndex >= draft.weeks.length - 1}
                      className="liquid-icon-button inline-flex h-10 w-10 items-center justify-center rounded-xl text-zinc-300 disabled:opacity-35"
                      aria-label="Next week"
                    >
                      <ChevronRight className="h-4 w-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDuplicateWeek(activeWeekIndex)}
                      className="liquid-icon-button inline-flex h-10 w-10 items-center justify-center rounded-xl text-zinc-300"
                      aria-label="Duplicate current week"
                      title="Duplicate current week"
                    >
                      <Copy className="h-4 w-4" />
                    </button>
                    <button
                      type="button"
                      onClick={async () => {
                        if (await confirm(
                          'Delete Week?',
                          'Are you sure you want to delete this entire week? This cannot be undone.',
                          { variant: 'danger', confirmLabel: 'Delete Week' }
                        )) {

                          handleDeleteWeek(activeWeekIndex);
                        }
                      }}
                      disabled={draft.weeks.length <= 1}
                      className="liquid-icon-button inline-flex h-10 w-10 items-center justify-center rounded-xl text-zinc-300 hover:text-rose-300 disabled:opacity-35"
                      aria-label="Delete current week"
                      title="Delete current week"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                  {currentWeek && (
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => stepEditorSession(-1)}
                        disabled={activeDayIndex === 0}
                        className="liquid-icon-button inline-flex h-10 w-10 items-center justify-center rounded-xl text-zinc-300 disabled:opacity-35"
                        aria-label="Previous session"
                      >
                        <ChevronLeft className="h-4 w-4" />
                      </button>
                      <LiquidActionMenu
                        label="Choose session"
                        align="start"
                        width={320}
                        className="flex-1"
                        trigger={
                          <span className="liquid-field flex w-full items-center justify-center px-3 py-2.5 text-center text-sm font-semibold text-zinc-100">
                            {currentDay?.name?.trim() || `Day ${activeDayIndex + 1}`}
                          </span>
                        }
                      >
                        {currentWeek.days.map((day, index) => {
                          const isActive = index === activeDayIndex;
                          const dayLabel = day.name?.trim() || `Session ${index + 1}`;
                          return (
                            <LiquidMenuRow
                              key={`menu-session-${index}`}
                              label={`Session ${index + 1}`}
                              detail={`${dayLabel} / ${countDaySets(day)} sets`}
                              icon={isActive ? <Check className="h-3.5 w-3.5" /> : undefined}
                              onClick={() => selectEditorSession(index)}
                            />
                          );
                        })}
                      </LiquidActionMenu>
                      <button
                        type="button"
                        onClick={() => stepEditorSession(1)}
                        disabled={activeDayIndex >= currentWeek.days.length - 1}
                        className="liquid-icon-button inline-flex h-10 w-10 items-center justify-center rounded-xl text-zinc-300 disabled:opacity-35"
                        aria-label="Next session"
                      >
                        <ChevronRight className="h-4 w-4" />
                      </button>
                      <button
                        type="button"
                        onClick={async () => {
                          if (await confirm(
                            'Delete Session?',
                            'Are you sure you want to delete this specific day/session?',
                            { variant: 'danger', confirmLabel: 'Delete Session' }
                          )) {

                            handleDeleteDay(activeWeekIndex, activeDayIndex);
                          }
                        }}
                        disabled={currentWeek.days.length <= 1}
                        className="liquid-icon-button inline-flex h-10 w-10 items-center justify-center rounded-xl text-zinc-300 hover:text-rose-300 disabled:opacity-35"
                        aria-label="Delete current session"
                        title="Delete current session"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  )}
                </div>

                {currentWeek && (
                  <>
                    {currentDay && (
                      <>
                        <div className="mb-4 space-y-3">
                          <input
                            value={currentDay.name}
                            onChange={(event) =>
                              updateCurrentDay((day) => ({ ...day, name: event.target.value }))
                            }
                            className="w-full bg-transparent text-2xl font-black italic tracking-tight text-zinc-100 focus:outline-none"
                          />

                          <div className="flex flex-wrap items-center justify-between gap-3">
                            <div className="flex flex-wrap items-center gap-2 text-[10px] font-bold uppercase tracking-[0.18em] text-zinc-500">
                              <span>
                                {currentSessionExerciseCount} {currentSessionExerciseCount === 1 ? 'exercise' : 'exercises'}
                              </span>
                              <span className="text-zinc-700">/</span>
                              <span>
                                {currentSessionSetCount} {currentSessionSetCount === 1 ? 'set' : 'sets'}
                              </span>
                            </div>

                            <div className="flex flex-wrap items-center gap-2">
                              <button
                                type="button"
                                onClick={handleAddSingleBlock}
                                className={liquidButtonClass({ variant: 'action', density: 'compact', className: 'h-11 shrink-0 rounded-xl px-4' })}
                              >
                                <CirclePlus className="h-3.5 w-3.5" />
                                Add exercise
                              </button>
                              <LiquidActionMenu
                                label="Add options"
                                trigger={
                                  <span className="liquid-icon-button flex h-11 w-11 items-center justify-center rounded-xl text-zinc-300">
                                    <MoreHorizontal className="h-4 w-4" />
                                  </span>
                                }
                              >
                                <LiquidMenuRow
                                  label="Exercise"
                                  icon={<CirclePlus className="h-3.5 w-3.5" />}
                                  onClick={handleAddSingleBlock}
                                />
                                <LiquidMenuRow
                                  label="Superset pair"
                                  icon={<Dumbbell className="h-3.5 w-3.5" />}
                                  onClick={handleAddSupersetBlock}
                                />
                              </LiquidActionMenu>
                            </div>
                          </div>

                        </div>

                        <LiquidSegmentedControl
                          value={editorDetailMode}
                          onChange={setEditorDetailMode}
                          className="mb-4 w-full max-w-xs grid-cols-2"
                          options={[
                            { value: 'simple', label: 'Simple' },
                            { value: 'advanced', label: 'Advanced' },
                          ]}
                        />

                        <div className="space-y-3">
                          {currentDayExerciseRows.length === 0 && (
                            <div className="rounded-xl border border-dashed border-zinc-800 px-4 py-7 text-center">
                              <button
                                type="button"
                                onClick={handleAddSingleBlock}
                                className="text-sm font-semibold text-zinc-200 hover:text-white"
                              >
                                Add the first exercise
                              </button>
                            </div>
                          )}

                          {currentDayExerciseRows.map((row) => {
                            const block = currentDayBlocks[row.blockIndex];
                            if (!block) return null;
                            const isSupersetA1 = row.blockType === 'superset' && row.slot === 'A1';
                            const missingA2 = isSupersetA1 && blocksMissingSupersetA2.has(row.blockIndex);

                            return (
                              <div key={row.key} className="space-y-2">
                                {renderExerciseEditor(
                                  block,
                                  row.blockIndex,
                                  row.exercise,
                                  row.exerciseIndex,
                                  row.slot
                                )}
                                {missingA2 && (
                                  <button
                                    type="button"
                                    onClick={() => handleSetSupersetSlotExercise(row.blockIndex, 'A2')}
                                    className="w-full rounded-xl border border-dashed border-zinc-800 px-3 py-4 text-center text-[11px] font-bold uppercase tracking-[0.2em] text-zinc-400 transition-colors hover:border-zinc-700 hover:text-zinc-200"
                                  >
                                    Add A2 Exercise
                                  </button>
                                )}
                              </div>
                            );
                          })}

                        </div>
                      </>
                    )}
                  </>
                )}
              </section>

              {editorError && <p className="pt-4 text-sm text-rose-400">{editorError}</p>}
            </div>

            {pendingExerciseUndo && (
              <div className="pointer-events-none fixed inset-x-0 bottom-[calc(env(safe-area-inset-bottom)+5.6rem)] z-[140] px-4 sm:bottom-[calc(env(safe-area-inset-bottom)+1rem)] sm:px-6">
                <div className="pointer-events-auto mx-auto flex w-full max-w-5xl items-center justify-between gap-3 rounded-2xl border border-zinc-800 bg-zinc-950/95 px-3 py-2.5 shadow-2xl backdrop-blur-xl">
                  <p className="min-w-0 truncate text-xs font-semibold text-zinc-300">
                    {pendingExerciseUndo.message}
                  </p>
                  <button
                    type="button"
                    onClick={handleUndoExerciseRemoval}
                    className="inline-flex h-9 shrink-0 items-center rounded-full border border-zinc-700 px-3 text-[11px] font-bold uppercase tracking-[0.2em] text-zinc-100 transition-colors hover:border-zinc-500"
                  >
                    Undo
                  </button>
                </div>
              </div>
            )}
            </div>
          </div>
        )
      }

      {
        editorMode && draft && editorJumpPicker && (
          <div className="fixed inset-0 z-[135] bg-transparent">
            <button
              type="button"
              aria-label="Close picker"
              onClick={() => setEditorJumpPicker(null)}
              className="absolute inset-0"
            />
            <div className="liquid-sheet-panel absolute inset-x-3 top-[calc(env(safe-area-inset-top)+5rem)] mx-auto max-h-[68dvh] max-w-md overflow-hidden rounded-[1.35rem] px-4 pb-4 pt-4 sm:inset-x-auto sm:right-6 sm:w-96">
              <div className="mx-auto w-full max-w-5xl">
                <div className="mb-3 flex items-center justify-between">
                  <p className="text-xs font-bold uppercase tracking-[0.25em] text-zinc-400">
                    {editorJumpPicker === 'week' ? 'Choose week' : 'Choose session'}
                  </p>
                  <button
                    type="button"
                    onClick={() => setEditorJumpPicker(null)}
                    className="rounded-full p-2 text-zinc-500"
                    aria-label="Close jump picker"
                  >
                    <X className="h-5 w-5" />
                  </button>
                </div>

                <div className="max-h-[50dvh] overflow-y-auto space-y-1 pr-1" data-swipe-ignore="true">
                  {editorJumpPicker === 'week' &&
                    draft.weeks.map((week, index) => {
                      const weekSetCount = week.days.reduce((count, day) => count + countDaySets(day), 0);
                      const isActive = index === activeWeekIndex;
                      return (
                        <div key={`jump-week-${week.weekNumber}`} className="flex items-stretch gap-2">
                          <button
                            type="button"
                            onClick={() => selectEditorWeek(index)}
                            className={`flex-1 rounded-xl px-3 py-3 text-left transition-colors ${isActive
                              ? 'bg-white/[0.09] text-zinc-50'
                              : 'border border-white/8 bg-white/[0.025] text-zinc-200 hover:border-white/14'
                              }`}
                          >
                            <p className="text-sm font-bold">Week {index + 1}</p>
                            <p className="mt-1 text-[10px] uppercase tracking-[0.2em] text-zinc-500">
                              {week.days.length} sessions • {weekSetCount} sets
                            </p>
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDuplicateWeek(index)}
                            aria-label={`Duplicate Week ${index + 1}`}
                            title="Duplicate Week"
                            className="liquid-icon-button flex w-14 shrink-0 items-center justify-center rounded-xl text-zinc-300"
                          >
                            <Copy className="h-4 w-4" />
                          </button>
                        </div>
                      );
                    })}

                  {editorJumpPicker === 'session' &&
                    (currentWeek?.days ?? []).map((day, index) => {
                      const isActive = index === activeDayIndex;
                      const dayLabel = day.name?.trim() || `Session ${index + 1}`;
                      return (
                        <button
                          key={`jump-session-${index}`}
                          type="button"
                          onClick={() => selectEditorSession(index)}
                          className={`w-full rounded-xl px-3 py-3 text-left transition-colors ${isActive
                            ? 'bg-white/[0.09] text-zinc-50'
                            : 'border border-white/8 bg-white/[0.025] text-zinc-200 hover:border-white/14'
                            }`}
                        >
                          <p className="text-sm font-bold">Session {index + 1}</p>
                          <p className="mt-1 text-[10px] uppercase tracking-[0.2em] text-zinc-500">
                            {dayLabel} • {countDaySets(day)} sets
                          </p>
                        </button>
                      );
                    })}
                </div>
              </div>
            </div>
          </div>
        )
      }

      {
        exercisePickerOpen && (
          <div className="fixed inset-0 z-[140] bg-transparent">
            <div
              className="liquid-sheet-panel absolute inset-x-3 top-[calc(env(safe-area-inset-top)+4.5rem)] mx-auto max-h-[82dvh] max-w-2xl overflow-y-auto rounded-[1.35rem] px-4 pb-4 pt-4 sm:inset-x-auto sm:right-6 sm:w-[32rem]"
              data-program-exercise-picker-sheet="true"
              data-swipe-ignore="true"
            >
              <div className="mx-auto w-full max-w-5xl">
                <div className="mb-3 flex items-center justify-between">
                  <p className="text-xs font-bold uppercase tracking-[0.25em] text-zinc-400">
                    {exercisePickerHeading}
                  </p>
                  <button
                    type="button"
                    onClick={() => {
                      setExercisePickerOpen(false);
                      setExercisePickerTarget(null);
                      setExerciseQuery('');
                      resetCustomExerciseBuilder();
                    }}
                    className="rounded-full p-2 text-zinc-500"
                    aria-label="Close exercise picker"
                  >
                    <X className="h-5 w-5" />
                  </button>
                </div>

                <div className="mb-3 flex items-center gap-2 rounded-xl border border-zinc-800 bg-zinc-900/50 px-3 py-2">
                  <Search className="h-4 w-4 text-zinc-500" />
                  <input
                    autoFocus
                    value={exerciseQuery}
                    onChange={(event) => {
                      setExerciseQuery(event.target.value);
                      setCustomExerciseError(null);
                    }}
                    placeholder="Search exercises..."
                    className="w-full bg-transparent text-sm text-zinc-100 placeholder:text-zinc-600 focus:outline-none"
                  />
                </div>

                {normalizedExerciseQuery.length > 1 && !matchingExerciseByName && !showCreateCustomExercise && (
                  <button
                    type="button"
                    onClick={() => {
                      openCreateCustomExerciseForm();
                    }}
                    className="mb-3 flex h-11 w-full items-center justify-between rounded-xl border border-emerald-500/35 bg-emerald-500/10 px-3 text-left"
                  >
                    <span className="text-xs font-bold uppercase tracking-[0.18em] text-emerald-300">
                      {`Create "${normalizedExerciseQuery}"`}
                    </span>
                    <CirclePlus className="h-4 w-4 text-emerald-300" />
                  </button>
                )}

                {showCreateCustomExercise && (
                  <div className="mb-3 space-y-3 rounded-2xl border border-zinc-800 bg-zinc-900/20 p-3">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-zinc-400">
                        New Custom Exercise
                      </p>
                      <button
                        type="button"
                        onClick={() => resetCustomExerciseBuilder(exerciseQuery)}
                        className="rounded-full px-2 py-1 text-[10px] font-bold uppercase tracking-[0.18em] text-zinc-500 hover:text-zinc-200"
                      >
                        Back To Search
                      </button>
                    </div>

                    <div className="grid gap-2 sm:grid-cols-2">
                      <div className="sm:col-span-2">
                        <label className="text-[10px] font-bold uppercase tracking-[0.2em] text-zinc-500">
                          Exercise Name *
                        </label>
                        <input
                          aria-label="Exercise Name"
                          value={customExerciseDraft.name}
                          onChange={(event) =>
                            setCustomExerciseDraft((current) => ({
                              ...current,
                              name: event.target.value,
                            }))
                          }
                          placeholder="e.g. Incline Dumbbell Press"
                          className="mt-1 w-full rounded-lg border border-zinc-800 bg-zinc-950/60 px-3 py-2.5 text-sm text-zinc-100 placeholder:text-zinc-600 focus:border-zinc-600 focus:outline-none"
                        />
                      </div>

                      <div>
                        <label className="text-[10px] font-bold uppercase tracking-[0.2em] text-zinc-500">
                          Equipment
                        </label>
                        <FancySelect
                          value={customExerciseDraft.equipment}
                          options={CUSTOM_EXERCISE_EQUIPMENT_OPTIONS.map((equipment) => ({
                            value: equipment,
                            label: formatTokenLabel(equipment),
                          }))}
                          onChange={(value) =>
                            setCustomExerciseDraft((current) => ({
                              ...current,
                              equipment: value as CustomExercise['equipment'],
                            }))
                          }
                          ariaLabel="Custom exercise equipment"
                          buttonClassName="mt-1 w-full rounded-lg border border-zinc-800 bg-zinc-950/60 px-3 py-2.5 text-sm text-zinc-100 focus:border-zinc-600 focus:outline-none"
                          listClassName="max-h-56 overflow-y-auto"
                        />
                      </div>
                      <div>
                        <label className="text-[10px] font-bold uppercase tracking-[0.2em] text-zinc-500">
                          Lift Type *
                        </label>
                        <div className="mt-1 grid grid-cols-2 gap-2">
                          {CUSTOM_EXERCISE_TYPE_OPTIONS.map((typeOption) => (
                            <button
                              key={`custom-type-${typeOption}`}
                              type="button"
                              onClick={() =>
                                setCustomExerciseDraft((current) => ({
                                  ...current,
                                  exerciseType: typeOption,
                                }))
                              }
                              className={`h-10 rounded-lg border text-[11px] font-bold uppercase tracking-[0.2em] transition-colors ${customExerciseDraft.exerciseType === typeOption
                                ? 'border-zinc-500 bg-zinc-100 text-zinc-950'
                                : 'border-zinc-800 text-zinc-300 hover:border-zinc-700'
                                }`}
                            >
                              {formatTokenLabel(typeOption)}
                            </button>
                          ))}
                        </div>
                      </div>

                      <div className="sm:col-span-2">
                        <label className="text-[10px] font-bold uppercase tracking-[0.2em] text-zinc-500">
                          Primary Muscles *
                        </label>
                        <div className="mt-2 flex flex-wrap gap-1.5">
                          {CUSTOM_EXERCISE_MUSCLE_OPTIONS.map((muscle) => {
                            const selected = customExercisePrimaryMuscles.includes(muscle);
                            return (
                              <button
                                key={`custom-primary-${muscle}`}
                                type="button"
                                onClick={() => toggleCustomExerciseMuscle('primaryMusclesText', muscle)}
                                className={`rounded-lg border px-2.5 py-1.5 text-[10px] font-bold uppercase tracking-[0.14em] transition-colors ${selected
                                  ? 'border-emerald-500/45 bg-emerald-500/10 text-emerald-300'
                                  : 'border-zinc-800 text-zinc-400 hover:border-zinc-700 hover:text-zinc-200'
                                  }`}
                              >
                                {formatTokenLabel(muscle)}
                              </button>
                            );
                          })}
                        </div>
                        <input
                          aria-label="Primary Muscles"
                          value={customExerciseDraft.primaryMusclesText}
                          onChange={(event) =>
                            setCustomExerciseDraft((current) => ({
                              ...current,
                              primaryMusclesText: event.target.value,
                            }))
                          }
                          placeholder="Add custom muscle names"
                          className="mt-2 w-full rounded-lg border border-zinc-800 bg-zinc-950/60 px-3 py-2.5 text-sm text-zinc-100 placeholder:text-zinc-600 focus:border-zinc-600 focus:outline-none"
                        />
                        <p className="mt-1 text-[10px] uppercase tracking-[0.18em] text-zinc-600">
                          {customExercisePrimaryMuscles.length > 0
                            ? `${customExercisePrimaryMuscles.length} selected`
                            : 'Select at least one'}
                        </p>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => setShowCustomExerciseAdvanced((current) => !current)}
                      className="inline-flex h-10 w-full items-center justify-center rounded-xl border border-zinc-800 px-3 text-[10px] font-bold uppercase tracking-[0.2em] text-zinc-400 transition-colors hover:border-zinc-700 hover:text-zinc-200"
                    >
                      {showCustomExerciseAdvanced ? 'Hide Advanced Details' : 'Add Movement + Muscles (Optional)'}
                    </button>

                    {showCustomExerciseAdvanced && (
                      <div className="grid gap-2 sm:grid-cols-2">
                        <div>
                          <label className="text-[10px] font-bold uppercase tracking-[0.2em] text-zinc-500">
                            Movement Pattern
                          </label>
                          <FancySelect
                            value={customExerciseDraft.movementPattern || 'other'}
                            options={CUSTOM_EXERCISE_MOVEMENT_OPTIONS.map((movement) => ({
                              value: movement,
                              label: formatTokenLabel(movement),
                            }))}
                            onChange={(value) =>
                              setCustomExerciseDraft((current) => ({
                                ...current,
                                movementPattern:
                                  value as NonNullable<CustomExercise['movementPattern']>,
                              }))
                            }
                            ariaLabel="Custom exercise movement pattern"
                            buttonClassName="mt-1 w-full rounded-lg border border-zinc-800 bg-zinc-950/60 px-3 py-2.5 text-sm text-zinc-100 focus:border-zinc-600 focus:outline-none"
                            listClassName="max-h-56 overflow-y-auto"
                          />
                        </div>
                        <div className="sm:col-span-2">
                          <label className="text-[10px] font-bold uppercase tracking-[0.2em] text-zinc-500">
                            Secondary Muscles
                          </label>
                          <div className="mt-2 flex flex-wrap gap-1.5">
                            {CUSTOM_EXERCISE_MUSCLE_OPTIONS.map((muscle) => {
                              const selected = customExerciseSecondaryMuscles.includes(muscle);
                              return (
                                <button
                                  key={`custom-secondary-${muscle}`}
                                  type="button"
                                  onClick={() => toggleCustomExerciseMuscle('secondaryMusclesText', muscle)}
                                  className={`rounded-lg border px-2.5 py-1.5 text-[10px] font-bold uppercase tracking-[0.14em] transition-colors ${selected
                                    ? 'border-white/18 bg-white/[0.08] text-zinc-100'
                                    : 'border-zinc-800 text-zinc-400 hover:border-zinc-700 hover:text-zinc-200'
                                    }`}
                                >
                                  {formatTokenLabel(muscle)}
                                </button>
                              );
                            })}
                          </div>
                          <input
                            aria-label="Secondary Muscles"
                            value={customExerciseDraft.secondaryMusclesText}
                            onChange={(event) =>
                              setCustomExerciseDraft((current) => ({
                                ...current,
                                secondaryMusclesText: event.target.value,
                              }))
                            }
                            placeholder="Add custom secondary muscles"
                            className="mt-2 w-full rounded-lg border border-zinc-800 bg-zinc-950/60 px-3 py-2.5 text-sm text-zinc-100 placeholder:text-zinc-600 focus:border-zinc-600 focus:outline-none"
                          />
                        </div>
                      </div>
                    )}

                    {customExerciseError && <p className="text-sm text-rose-400">{customExerciseError}</p>}

                    <button
                      type="button"
                      onClick={() => {
                        void handleCreateCustomExercise();
                      }}
                      disabled={customExerciseSaving || !canCreateCustomExercise}
                      className={liquidButtonClass({ variant: 'action', density: 'compact', className: 'h-11 w-full rounded-xl px-3 disabled:cursor-not-allowed disabled:opacity-60' })}
                    >
                      {customExerciseSaving ? 'Creating...' : 'Create and Use Exercise'}
                    </button>
                  </div>
                )}

                {!showCreateCustomExercise && (
                  <div className="max-h-[45dvh] overflow-y-auto space-y-2 pr-1" data-swipe-ignore="true">
                    {filteredExercises.length === 0 && (
                      <div className="rounded-xl border border-zinc-800 bg-zinc-900/30 px-3 py-5 text-center">
                        <p className="text-sm text-zinc-300">No exercises found.</p>
                        <p className="mt-1 text-[10px] uppercase tracking-[0.2em] text-zinc-500">
                          Try another search or add a custom exercise.
                        </p>
                      </div>
                    )}
                    {filteredExercises.map((exercise) => (
                      <button
                        key={exercise.id}
                        type="button"
                        onClick={() => applyPickedExercise(exercise.id)}
                        className="w-full rounded-xl border border-zinc-800 bg-zinc-900/40 px-3 py-3 text-left transition-colors hover:border-zinc-600"
                      >
                        <p className="text-sm font-bold text-zinc-100">{exercise.name}</p>
                        <p className="mt-1 text-[10px] uppercase tracking-[0.2em] text-zinc-500">
                          {exercise.type}
                          {exercise.muscleGroups.length > 0 ? ` • ${exercise.muscleGroups.join(', ')}` : ''}
                          {exercise.equipment.length > 0 ? ` • ${exercise.equipment.join(', ')}` : ''}
                          {exercise.source !== 'default' ? ` • ${formatTokenLabel(exercise.source)}` : ''}
                        </p>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        )
      }
    </>
  );
}
