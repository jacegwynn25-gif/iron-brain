'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import {
  ArrowDown,
  ArrowLeft,
  ArrowUp,
  Check,
  ChevronLeft,
  ChevronRight,
  CirclePlus,
  Play,
  Save,
  Search,
  Trash2,
  X,
} from 'lucide-react';
import { defaultExercises } from '@/app/lib/programs';
import { getCustomExercises } from '@/app/lib/exercises/custom-exercises';
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
import EditableNumberInput from '@/app/components/ui/EditableNumberInput';
import FancySelect from '@/app/components/ui/FancySelect';

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
  source: 'default' | 'custom' | 'quick';
};

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

function slugifyExerciseName(name: string): string {
  const base = name.toLowerCase().trim().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '');
  return base || `custom_${createUuid().slice(0, 8)}`;
}

function createUniqueQuickExerciseId(name: string, existingIds: Set<string>): string {
  const baseSlug = slugifyExerciseName(name);
  const prefixBase = baseSlug.startsWith('custom_') ? baseSlug : `custom_${baseSlug}`;
  let candidate = prefixBase;
  let index = 1;

  while (existingIds.has(candidate)) {
    candidate = `${prefixBase}_${index}`;
    index += 1;
  }

  return candidate;
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
  const targetLabel = targetValue ? `${getTargetLabel(method)} ${targetValue}` : 'No target';
  const reps = set.prescribedReps?.trim() || '--';
  const rest = `${set.restSeconds ?? 120}s rest`;
  const modeLabel = set.setType ? formatTokenLabel(set.setType) : null;
  const tempoLabel = set.tempo?.trim() ? `Tempo ${set.tempo.trim()}` : null;
  const clusterLabel =
    set.setType === 'cluster' && set.clusterReps && set.clusterReps.length > 0
      ? `${set.clusterReps.length} clusters`
      : null;
  return [reps + ' reps', methodLabel, targetLabel, rest, modeLabel, tempoLabel, clusterLabel]
    .filter(Boolean)
    .join(' • ');
}

export default function ProgramsPage() {
  const router = useRouter();
  const { user } = useAuth();
  const {
    selectedProgram,
    allPrograms,
    builtInProgramIds,
    loading,
    error,
    selectProgram,
    saveProgram,
    deleteProgram,
    resolveProgramSelection,
  } = useProgramContext();
  const namespaceId = user?.id ?? 'guest';

  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<ProgramFilter>('all');
  const [editorMode, setEditorMode] = useState<EditorMode>(null);
  const [draft, setDraft] = useState<ProgramTemplate | null>(null);
  const [editorSaving, setEditorSaving] = useState(false);
  const [editorError, setEditorError] = useState<string | null>(null);
  const [editorNotice, setEditorNotice] = useState<string | null>(null);
  const [activeWeekIndex, setActiveWeekIndex] = useState(0);
  const [activeDayIndex, setActiveDayIndex] = useState(0);
  const [detailsProgramId, setDetailsProgramId] = useState<string | null>(null);
  const [exercisePickerOpen, setExercisePickerOpen] = useState(false);
  const [exercisePickerTarget, setExercisePickerTarget] = useState<ExercisePickerTarget>(null);
  const [exerciseQuery, setExerciseQuery] = useState('');
  const [customExercises, setCustomExercises] = useState<CustomExercise[]>([]);
  const [quickCustomExerciseNames, setQuickCustomExerciseNames] = useState<Record<string, string>>({});
  const [editorSetFocus, setEditorSetFocus] = useState<EditorSetFocus>(null);
  const [editorDetailMode, setEditorDetailMode] = useState<'simple' | 'advanced'>('simple');
  const [editorJumpPicker, setEditorJumpPicker] = useState<'week' | 'session' | null>(null);
  const [weekCountInput, setWeekCountInput] = useState('');
  const [daysPerWeekInput, setDaysPerWeekInput] = useState('');
  const [weekCountFocused, setWeekCountFocused] = useState(false);
  const [daysPerWeekFocused, setDaysPerWeekFocused] = useState(false);
  const prefersReducedMotion = useReducedMotion();

  useEffect(() => {
    let cancelled = false;
    const loadCustomExercises = async () => {
      try {
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

    Object.entries(quickCustomExerciseNames).forEach(([exerciseId, exerciseName]) => {
      if (!exerciseId || seenIds.has(exerciseId)) return;
      seenIds.add(exerciseId);
      items.push({
        id: exerciseId,
        name: exerciseName,
        type: 'custom',
        muscleGroups: [],
        equipment: [],
        source: 'quick',
      });
    });

    return items;
  }, [customExercises, quickCustomExerciseNames]);

  const exerciseNameById = useMemo(() => {
    const map = new Map<string, string>();
    pickerExercises.forEach((exercise) => map.set(exercise.id, exercise.name));
    Object.entries(quickCustomExerciseNames).forEach(([exerciseId, exerciseName]) =>
      map.set(exerciseId, exerciseName)
    );
    return map;
  }, [pickerExercises, quickCustomExerciseNames]);

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
  const currentWeek = draft?.weeks[activeWeekIndex] ?? null;
  const currentDay = currentWeek?.days[activeDayIndex] ?? null;
  const currentDayBlocks = useMemo(() => getDayBlocks(currentDay), [currentDay]);
  const hasEditorSetFocus = editorSetFocus != null;
  const resolvedWeekCount = draft?.weekCount ?? draft?.weeks.length ?? 1;
  const resolvedDaysPerWeek = draft?.daysPerWeek ?? draft?.weeks[0]?.days.length ?? 1;
  const hasProgramBuilderOverlay = Boolean(editorMode || editorJumpPicker || exercisePickerOpen);

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

  const openCreateEditor = () => {
    setDraft(createBlankProgram());
    setEditorMode('create');
    setEditorError(null);
    setEditorNotice(null);
    setQuickCustomExerciseNames({});
    setDetailsProgramId(null);
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
    setEditorMode('edit');
    setEditorError(null);
    setEditorNotice(
      builtIn
        ? `Built-in duplicated to "Mine". You're editing your personal copy.`
        : null
    );
    setQuickCustomExerciseNames({});
    setActiveWeekIndex(0);
    setActiveDayIndex(0);
    setDetailsProgramId(null);
    setEditorSetFocus(null);
    setEditorDetailMode('simple');
    setEditorJumpPicker(null);
  };

  const closeEditor = () => {
    if (editorSaving) return;
    setEditorMode(null);
    setDraft(null);
    setEditorError(null);
    setEditorNotice(null);
    setExercisePickerOpen(false);
    setExercisePickerTarget(null);
    setExerciseQuery('');
    setQuickCustomExerciseNames({});
    setEditorSetFocus(null);
    setEditorDetailMode('simple');
    setEditorJumpPicker(null);
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

  const handleRemoveBlock = (blockIndex: number) => {
    updateCurrentDayBlocks((blocks) => blocks.filter((_, index) => index !== blockIndex));
    setEditorSetFocus((current) => {
      if (!current) return null;
      if (current.blockIndex === blockIndex) return null;
      if (current.blockIndex > blockIndex) {
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

  const handleRemoveExercise = (blockIndex: number, exerciseIndex: number) => {
    updateCurrentDayBlocks((blocks) => {
      const block = blocks[blockIndex];
      if (!block) return blocks;

      if (block.type === 'single') {
        blocks.splice(blockIndex, 1);
        return blocks;
      }

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
        blocks.splice(blockIndex, 1);
      }

      return blocks;
    });
    setEditorSetFocus(null);
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

  const handleDuplicateSetRow = (blockIndex: number, exerciseIndex: number, setIndex: number) => {
    let nextFocus: EditorSetFocus = null;
    updateCurrentDayBlocks((blocks) => {
      const block = blocks[blockIndex];
      const exercise = block?.exercises[exerciseIndex];
      const sourceSet = exercise?.sets[setIndex];
      if (!block || !exercise || !sourceSet) return blocks;

      const duplicated = cloneSetTemplate(sourceSet);
      const insertionIndex = setIndex + 1;
      const nextSets = [...exercise.sets];
      nextSets.splice(insertionIndex, 0, {
        ...duplicated,
        exerciseId: exercise.exerciseId,
        setIndex: insertionIndex + 1,
        setType: block.type === 'superset' ? 'superset' : duplicated.setType,
        supersetGroup: block.type === 'superset' ? block.id : undefined,
      });
      exercise.sets = nextSets.map((set, index) => ({ ...set, setIndex: index + 1 }));
      nextFocus = { blockIndex, exerciseIndex, setIndex: insertionIndex };
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
  };

  const applyPickedExercise = (exerciseId: string) => {
    if (!exercisePickerTarget) return;
    let nextFocus: EditorSetFocus = null;
    updateCurrentDayBlocks((blocks) => {
      if (exercisePickerTarget.mode === 'append-single-block') {
        blocks.push(createSingleBlock(exerciseId));
        nextFocus = { blockIndex: blocks.length - 1, exerciseIndex: 0, setIndex: 0 };
        return blocks;
      }

      if (exercisePickerTarget.mode === 'append-superset-block') {
        blocks.push(createSupersetBlock(exerciseId));
        nextFocus = { blockIndex: blocks.length - 1, exerciseIndex: 0, setIndex: 0 };
        return blocks;
      }

      if (exercisePickerTarget.mode === 'set-superset-slot') {
        const block = blocks[exercisePickerTarget.blockIndex];
        if (!block || block.type !== 'superset') return blocks;
        const slot = exercisePickerTarget.slot;
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
        const exerciseIndex = block.exercises.findIndex((exercise) => exercise.exerciseId === exerciseId);
        nextFocus = {
          blockIndex: exercisePickerTarget.blockIndex,
          exerciseIndex: Math.max(0, exerciseIndex),
          setIndex: 0,
        };
        return blocks;
      }

      const block = blocks[exercisePickerTarget.blockIndex];
      const exercise = block?.exercises[exercisePickerTarget.exerciseIndex];
      if (!block || !exercise) return blocks;

      exercise.exerciseId = exerciseId;
      exercise.sets = exercise.sets.map((set, index) => ({
        ...set,
        exerciseId,
        setIndex: index + 1,
        setType: block.type === 'superset' ? 'superset' : set.setType,
        supersetGroup: block.type === 'superset' ? block.id : undefined,
      }));
      nextFocus = {
        blockIndex: exercisePickerTarget.blockIndex,
        exerciseIndex: exercisePickerTarget.exerciseIndex,
        setIndex: 0,
      };
      return blocks;
    });
    setEditorSetFocus(nextFocus);

    setExercisePickerOpen(false);
    setExercisePickerTarget(null);
    setExerciseQuery('');
  };

  const createCustomExerciseFromQuery = () => {
    const trimmed = exerciseQuery.trim();
    if (!trimmed) return;
    const existingByName = pickerExercises.find(
      (exercise) => exercise.name.trim().toLowerCase() === trimmed.toLowerCase()
    );
    if (existingByName) {
      applyPickedExercise(existingByName.id);
      return;
    }

    const existingIds = new Set(pickerExercises.map((exercise) => exercise.id));
    const customExerciseId = createUniqueQuickExerciseId(trimmed, existingIds);
    setQuickCustomExerciseNames((current) => {
      if (current[customExerciseId] === trimmed) return current;
      return {
        ...current,
        [customExerciseId]: trimmed,
      };
    });
    applyPickedExercise(customExerciseId);
  };

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
      closeEditor();
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
    const confirmed = window.confirm(`Delete "${program.name}"?`);
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

    return (
      <article
        key={`${block.id}-${exercise.id}-${slotLabel ?? 'single'}`}
        className={`rounded-2xl border border-zinc-900/90 bg-zinc-900/25 p-3 ${
          hasFocusedSet ? 'border-cyan-400/30' : ''
        }`}
      >
        <div className="mb-3 flex items-start justify-between gap-3">
          <div className="min-w-0">
            <button
              type="button"
              onClick={() => handleReplaceExercise(blockIndex, exerciseIndex)}
              className="truncate text-left text-sm font-bold text-zinc-100"
            >
              {exerciseLabel}
            </button>
            <p className="mt-1 text-[10px] uppercase tracking-[0.18em] text-zinc-500">
              {slotLabel ? `${slotLabel} • ` : ''}{exercise.sets.length} {exercise.sets.length === 1 ? 'set' : 'sets'}
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-1">
            <button
              type="button"
              onClick={() => handleAddSetToExercise(blockIndex, exerciseIndex)}
              className="inline-flex h-8 items-center rounded-full px-2.5 text-[10px] font-bold uppercase tracking-[0.2em] text-zinc-500 transition-colors hover:bg-zinc-900/80 hover:text-zinc-200"
            >
              Add Set
            </button>
            <button
              type="button"
              onClick={() => handleRemoveExercise(blockIndex, exerciseIndex)}
              className="inline-flex h-8 w-8 items-center justify-center rounded-full text-zinc-600 transition-colors hover:bg-rose-500/10 hover:text-rose-400"
              aria-label={`Remove ${exerciseLabel}`}
            >
              <Trash2 className="h-4 w-4" />
            </button>
          </div>
        </div>

        <div className="space-y-2">
          {exercise.sets.map((set, setIndex) => {
            const isFocusedRow =
              editorSetFocus?.blockIndex === blockIndex &&
              editorSetFocus.exerciseIndex === exerciseIndex &&
              editorSetFocus.setIndex === setIndex;

            return (
              <div
                key={`${exercise.id}-set-${setIndex}`}
                className={`border-b border-zinc-900/80 pb-2 last:border-b-0 transition-all duration-200 ${
                  isFocusedRow ? 'border-cyan-400/25' : ''
                } ${hasEditorSetFocus && !isFocusedRow ? 'opacity-40 blur-[1px] saturate-50' : ''}`}
              >
                <div className="mb-2 flex items-start justify-between gap-2">
                  <p className="min-w-0 text-[10px] uppercase tracking-[0.18em] text-zinc-400">
                    Set {setIndex + 1} • {getSetSummaryLine(set)}
                  </p>
                  <div className="flex shrink-0 items-center gap-1">
                    <button
                      type="button"
                      onClick={() =>
                        setEditorSetFocus((current) => {
                          if (
                            current?.blockIndex === blockIndex &&
                            current.exerciseIndex === exerciseIndex &&
                            current.setIndex === setIndex
                          ) {
                            return null;
                          }
                          return { blockIndex, exerciseIndex, setIndex };
                        })
                      }
                      className={`inline-flex h-7 items-center rounded-full px-2.5 text-[10px] font-bold uppercase tracking-[0.2em] transition-colors ${
                        isFocusedRow
                          ? 'bg-cyan-500/10 text-cyan-300'
                          : 'text-zinc-500 hover:bg-zinc-900/80 hover:text-zinc-200'
                      }`}
                    >
                      {isFocusedRow ? 'Done' : 'Edit'}
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDuplicateSetRow(blockIndex, exerciseIndex, setIndex)}
                      className="inline-flex h-7 items-center rounded-full px-2 text-[10px] font-bold uppercase tracking-[0.2em] text-zinc-600 transition-colors hover:bg-zinc-900/80 hover:text-zinc-200"
                      aria-label={`Duplicate set ${setIndex + 1}`}
                    >
                      Copy
                    </button>
                    <button
                      type="button"
                      onClick={() => handleRemoveSetRow(blockIndex, exerciseIndex, setIndex)}
                      className="inline-flex h-7 w-7 items-center justify-center rounded-full text-zinc-600 transition-colors hover:bg-rose-500/10 hover:text-rose-400"
                      aria-label={`Remove set ${setIndex + 1}`}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>

                {isFocusedRow && (
                  <div
                    className={`grid gap-2 ${
                      editorDetailMode === 'advanced' ? 'grid-cols-2 sm:grid-cols-4' : 'grid-cols-2'
                    }`}
                  >
                    <div>
                      <label className="text-[10px] font-bold uppercase tracking-[0.2em] text-zinc-500">
                        Reps
                      </label>
                      <input
                        value={set.prescribedReps}
                        onChange={(event) =>
                          handleSetTemplateUpdate(blockIndex, exerciseIndex, setIndex, (current) => ({
                            ...current,
                            prescribedReps: event.target.value,
                          }))
                        }
                        className="mt-1 w-full rounded-lg border border-zinc-800 bg-zinc-950/60 px-2.5 py-2 text-sm text-zinc-100 focus:border-zinc-600 focus:outline-none"
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
                        className="mt-1 w-full rounded-lg border border-zinc-800 bg-zinc-950/60 px-2.5 py-2 text-sm text-zinc-100 focus:border-zinc-600 focus:outline-none"
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
                              handleSetTemplateUpdate(blockIndex, exerciseIndex, setIndex, (current) => ({
                                ...current,
                                prescriptionMethod: value as SetTemplate['prescriptionMethod'],
                              }))
                            }
                            ariaLabel="Prescription method"
                            buttonClassName="mt-1 w-full rounded-lg border border-zinc-800 bg-zinc-950/60 px-2.5 py-2 text-sm text-zinc-100 focus:border-zinc-600 focus:outline-none"
                            listClassName="max-h-56 overflow-y-auto"
                          />
                        </div>

                        <div>
                          <label className="text-[10px] font-bold uppercase tracking-[0.2em] text-zinc-500">
                            {getTargetLabel(set.prescriptionMethod)}
                          </label>
                          <input
                            value={getRpeOrRirValue(set)}
                            onChange={(event) => {
                              const raw = event.target.value.trim();
                              const value = raw === '' ? null : Number(raw);
                              handleSetTemplateUpdate(blockIndex, exerciseIndex, setIndex, (current) => {
                                const base = {
                                  ...current,
                                  targetRPE: null,
                                  targetRIR: null,
                                  targetPercentage: null,
                                  fixedWeight: null,
                                  targetSeconds: null,
                                };
                                if (value == null || Number.isNaN(value)) return base;
                                if (current.prescriptionMethod === 'rpe') return { ...base, targetRPE: value };
                                if (current.prescriptionMethod === 'rir') return { ...base, targetRIR: value };
                                if (
                                  current.prescriptionMethod === 'percentage_1rm' ||
                                  current.prescriptionMethod === 'percentage_tm'
                                ) {
                                  return { ...base, targetPercentage: value };
                                }
                                if (current.prescriptionMethod === 'fixed_weight') {
                                  return { ...base, fixedWeight: value };
                                }
                                if (current.prescriptionMethod === 'time_based') {
                                  return { ...base, targetSeconds: value };
                                }
                                return base;
                              });
                            }}
                            className="mt-1 w-full rounded-lg border border-zinc-800 bg-zinc-950/60 px-2.5 py-2 text-sm text-zinc-100 focus:border-zinc-600 focus:outline-none"
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
                              buttonClassName="mt-1 w-full rounded-lg border border-zinc-800 bg-zinc-950/60 px-2.5 py-2 text-sm text-zinc-100 focus:border-zinc-600 focus:outline-none"
                              listClassName="max-h-56 overflow-y-auto"
                            />
                          </div>
                        )}

                        {block.type === 'superset' && (
                          <div>
                            <label className="text-[10px] font-bold uppercase tracking-[0.2em] text-zinc-500">
                              Block Mode
                            </label>
                            <div className="mt-1 rounded-lg border border-violet-400/30 bg-violet-500/10 px-2.5 py-2 text-xs font-bold uppercase tracking-[0.18em] text-violet-200">
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
                            className="mt-1 w-full rounded-lg border border-zinc-800 bg-zinc-950/60 px-2.5 py-2 text-sm text-zinc-100 placeholder:text-zinc-600 focus:border-zinc-600 focus:outline-none"
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
                                className="mt-1 w-full rounded-lg border border-zinc-800 bg-zinc-950/60 px-2.5 py-2 text-sm text-zinc-100 placeholder:text-zinc-600 focus:border-zinc-600 focus:outline-none"
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
                                className="mt-1 w-full rounded-lg border border-zinc-800 bg-zinc-950/60 px-2.5 py-2 text-sm text-zinc-100 focus:border-zinc-600 focus:outline-none"
                              />
                            </div>
                          </>
                        )}
                      </>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </article>
    );
  };

  return (
    <>
      <div className="mx-auto w-full max-w-5xl pb-8 pt-6 sm:pt-10">
        <header className="border-b border-zinc-900 pb-6">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-[0.35em] text-zinc-500">Builder</p>
              <h1 className="mt-2 text-3xl font-black italic tracking-tight text-zinc-100 sm:text-4xl">Programs</h1>
            </div>
            <button
              type="button"
              onClick={openCreateEditor}
              className="inline-flex items-center gap-2 rounded-2xl bg-emerald-500 px-4 py-2.5 text-xs font-black uppercase tracking-[0.22em] text-zinc-950 shadow-lg shadow-emerald-500/20 transition-colors hover:bg-emerald-400"
            >
              <CirclePlus className="h-4 w-4" />
              New
            </button>
          </div>

          <div className="mt-5 flex items-center gap-3 border-b border-zinc-900 pb-4">
            <Search className="h-4 w-4 text-zinc-500" />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search programs..."
              className="w-full bg-transparent text-sm text-zinc-100 placeholder:text-zinc-600 focus:outline-none"
            />
          </div>

          <div className="mt-4 flex gap-2">
            {(['all', 'mine', 'built-in'] as const).map((option) => (
              <button
                key={option}
                type="button"
                onClick={() => setFilter(option)}
                className={`rounded-full px-3 py-1.5 text-[10px] font-bold uppercase tracking-[0.2em] transition-colors ${
                  filter === option
                    ? 'bg-zinc-100 text-zinc-950'
                    : 'border border-zinc-800 text-zinc-400 hover:text-zinc-200'
                }`}
              >
                {option === 'built-in' ? 'Built-In' : option}
              </button>
            ))}
          </div>
        </header>

        <section className="border-b border-zinc-900 py-6">
          <p className="text-[10px] font-bold uppercase tracking-[0.3em] text-zinc-500">Active Program</p>
          <div className="mt-3 flex items-start justify-between gap-4">
            <div>
              <p className="break-words text-2xl font-black text-zinc-100">
                {activeProgram?.name ?? 'No Program Selected'}
              </p>
              <p className="mt-2 text-xs uppercase tracking-[0.22em] text-zinc-500">
                {activeProgram ? getFrequencyLabel(activeProgram) : 'Pick or build a program'}
              </p>
            </div>
            {activeProgram && (
              <button
                type="button"
                onClick={() => handleStartProgram(activeProgram)}
                className="inline-flex items-center gap-2 rounded-xl border border-zinc-700 px-3 py-2 text-[10px] font-bold uppercase tracking-[0.22em] text-zinc-200 hover:border-zinc-500"
              >
                <Play className="h-3.5 w-3.5" />
                Start
              </button>
            )}
          </div>
        </section>

        <section className="py-4 [overflow-anchor:none]">
          {loading && (
            <div className="py-6 text-xs uppercase tracking-[0.25em] text-zinc-500">Loading Programs...</div>
          )}

          {!loading && programList.length === 0 && (
            <div className="py-10 text-center">
              <p className="text-zinc-400">No programs found.</p>
              <button
                type="button"
                onClick={openCreateEditor}
                className="mt-4 inline-flex items-center gap-2 rounded-xl border border-zinc-700 px-4 py-2 text-xs font-bold uppercase tracking-[0.2em] text-zinc-200"
              >
                <CirclePlus className="h-4 w-4" />
                Build from Scratch
              </button>
            </div>
          )}

          {!loading &&
            programList.map((program) => {
              const isSelected = selectedProgram?.id === program.id;
              const detailsOpen = detailsProgramId === program.id;
              const detailsId = `program-details-${program.id}`;
              const detailTokens = [
                program.goal ? GOAL_LABELS[program.goal] ?? formatTokenLabel(program.goal) : null,
                program.experienceLevel
                  ? EXPERIENCE_LABELS[program.experienceLevel] ?? formatTokenLabel(program.experienceLevel)
                  : null,
              ].filter(Boolean) as string[];
              return (
                <motion.article
                  key={program.id}
                  className={`relative px-3 py-4 transition-[opacity,border-color,box-shadow,background-color] duration-200 sm:px-4 ${
                    detailsOpen
                      ? 'z-[90] rounded-3xl border border-cyan-400/35 bg-zinc-950/70 shadow-[0_0_35px_-20px_rgba(6,182,212,0.65)]'
                      : 'z-[30] border-b border-zinc-900'
                  }`}
                >
                  <div className="flex items-center justify-between gap-3">
                    <button
                      type="button"
                      onClick={() => handleSelectProgram(program)}
                      className="min-w-0 flex-1 text-left"
                    >
                      <p
                        className={`break-words text-lg font-black leading-tight ${isSelected ? 'text-emerald-300' : 'text-zinc-100'}`}
                      >
                        {program.name}
                      </p>
                      <p className="mt-1 text-[10px] uppercase tracking-[0.22em] text-zinc-500">
                        {getFrequencyLabel(program)}
                      </p>
                    </button>

                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => handleSelectProgram(program)}
                        className={`inline-flex h-9 items-center justify-center rounded-full px-3 text-[10px] font-bold uppercase tracking-[0.22em] transition-colors ${
                          isSelected
                            ? 'bg-emerald-500/10 text-emerald-300'
                            : 'text-zinc-400 hover:bg-zinc-900/80 hover:text-zinc-200'
                        }`}
                      >
                        {isSelected ? 'Selected' : 'Use'}
                      </button>
                      <button
                        type="button"
                        onClick={() => setDetailsProgramId((current) => (current === program.id ? null : program.id))}
                        className={`inline-flex h-9 items-center justify-center rounded-full px-3 text-[10px] font-bold uppercase tracking-[0.22em] transition-colors ${
                          detailsOpen
                            ? 'bg-cyan-500/10 text-cyan-300'
                            : 'text-zinc-400 hover:bg-zinc-900/80 hover:text-zinc-200'
                        }`}
                        aria-expanded={detailsOpen}
                        aria-controls={detailsId}
                      >
                        {detailsOpen ? 'Hide' : 'Details'}
                      </button>
                    </div>
                  </div>
                  {isSelected && (
                    <div className="mt-2 flex items-center gap-2 text-[10px] uppercase tracking-[0.18em] text-emerald-300">
                      <Check className="h-3.5 w-3.5" />
                      Selected
                    </div>
                  )}

                  <AnimatePresence initial={false} mode="wait">
                    {detailsOpen && (
                      <motion.div
                        key={`details-${program.id}`}
                        id={detailsId}
                        initial={prefersReducedMotion ? { opacity: 1, height: 'auto' } : { opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        exit={prefersReducedMotion ? { opacity: 1, height: 0 } : { opacity: 0, height: 0 }}
                        transition={{
                          opacity: { duration: prefersReducedMotion ? 0 : 0.18 },
                          height: {
                            duration: prefersReducedMotion ? 0 : 0.28,
                            ease: [0.25, 0.8, 0.2, 1],
                          },
                        }}
                        className="mt-4 overflow-hidden"
                      >
                        <motion.div
                          initial={prefersReducedMotion ? { y: 0 } : { y: 10 }}
                          animate={{ y: 0 }}
                          exit={prefersReducedMotion ? { y: 0 } : { y: 6 }}
                          transition={{
                            duration: prefersReducedMotion ? 0 : 0.22,
                            ease: [0.25, 0.8, 0.2, 1],
                          }}
                          className="border-t border-cyan-400/20 pt-4"
                        >
                          <p className="text-[10px] font-bold uppercase tracking-[0.3em] text-zinc-500">Program Details</p>

                          {program.description && (
                            <p className="mt-4 text-sm text-zinc-400">{program.description}</p>
                          )}

                          {detailTokens.length > 0 && (
                            <p className="mt-4 text-[10px] font-bold uppercase tracking-[0.22em] text-zinc-400">
                              {detailTokens.join(' • ')}
                            </p>
                          )}

                          <div className="mt-5 flex flex-wrap items-center gap-x-4 gap-y-2">
                            <button
                              type="button"
                              onClick={() => {
                                handleStartProgram(program);
                                setDetailsProgramId(null);
                              }}
                              className="inline-flex h-10 items-center rounded-full bg-emerald-500/10 px-3 text-[11px] font-black uppercase tracking-[0.24em] text-emerald-300 transition-colors hover:bg-emerald-500/15 hover:text-emerald-200"
                            >
                              Start
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                openEditEditor(program);
                                setDetailsProgramId(null);
                              }}
                              className="inline-flex h-10 items-center rounded-full px-2 text-[11px] font-bold uppercase tracking-[0.22em] text-zinc-300 transition-colors hover:bg-zinc-900/80 hover:text-zinc-100"
                            >
                              Edit
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                void handleDuplicateProgram(program);
                                setDetailsProgramId(null);
                              }}
                              className="inline-flex h-10 items-center rounded-full px-2 text-[11px] font-bold uppercase tracking-[0.22em] text-zinc-300 transition-colors hover:bg-zinc-900/80 hover:text-zinc-100"
                            >
                              Duplicate
                            </button>
                            <button
                              type="button"
                              disabled={builtInProgramIds.has(program.id)}
                              onClick={() => {
                                void handleDeleteProgram(program);
                                setDetailsProgramId(null);
                              }}
                              className="inline-flex h-10 items-center rounded-full px-2 text-[11px] font-bold uppercase tracking-[0.22em] text-rose-400 transition-colors hover:bg-rose-500/10 hover:text-rose-300 disabled:opacity-35"
                            >
                              Delete
                            </button>
                          </div>
                        </motion.div>
                      </motion.div>
                    )}
                  </AnimatePresence>

                </motion.article>
              );
            })}
        </section>

        {error && <p className="border-t border-zinc-900 pt-4 text-xs text-rose-400">{error}</p>}
      </div>

      <button
        type="button"
        aria-label="Close program details"
        onClick={() => setDetailsProgramId(null)}
        aria-hidden={!detailsProgramId}
        tabIndex={detailsProgramId ? 0 : -1}
        className={`fixed inset-0 z-[80] backdrop-blur-[28px] transition-opacity duration-200 ${
          detailsProgramId
            ? 'pointer-events-auto bg-black/60 opacity-100'
            : 'pointer-events-none bg-black/0 opacity-0'
        }`}
      />

      {editorMode && draft && (
        <div className="fixed inset-0 z-[120] flex flex-col bg-zinc-950">
          <div className="flex-1 overflow-y-auto px-4 pb-6 pt-[calc(env(safe-area-inset-top)+0.75rem)] sm:px-6">
            <header className="border-b border-zinc-900 pb-4">
              <div className="flex items-center justify-between">
                <button
                  type="button"
                  onClick={closeEditor}
                  className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-[0.22em] text-zinc-400"
                >
                  <ArrowLeft className="h-4 w-4" />
                  Close
                </button>
                <p className="text-[10px] font-bold uppercase tracking-[0.3em] text-zinc-500">
                  {editorMode === 'create' ? 'Create Program' : 'Edit Program'}
                </p>
              </div>
            </header>

            {editorNotice && (
              <div className="mt-4 rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-xs font-semibold text-emerald-300">
                {editorNotice}
              </div>
            )}

            <section className="border-b border-zinc-900 py-6">
              <label className="text-[10px] font-bold uppercase tracking-[0.25em] text-zinc-500">Program Name</label>
              <input
                value={draft.name}
                onChange={(event) => updateDraft((current) => ({ ...current, name: event.target.value }))}
                placeholder="Program name"
                className="mt-2 w-full bg-transparent text-3xl font-black italic tracking-tight text-zinc-100 placeholder:text-zinc-700 focus:outline-none"
              />

              <textarea
                value={draft.description ?? ''}
                onChange={(event) => updateDraft((current) => ({ ...current, description: event.target.value }))}
                placeholder="Description (optional)"
                rows={2}
                className="mt-3 w-full resize-none bg-transparent text-sm text-zinc-400 placeholder:text-zinc-700 focus:outline-none"
              />

              <div className="mt-4 grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[10px] font-bold uppercase tracking-[0.2em] text-zinc-500">Weeks</label>
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
                    className="mt-2 w-full rounded-xl border border-zinc-800 bg-zinc-900/40 px-3 py-2 text-sm text-zinc-100 focus:border-zinc-600 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-bold uppercase tracking-[0.2em] text-zinc-500">Sessions / Week</label>
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
                    className="mt-2 w-full rounded-xl border border-zinc-800 bg-zinc-900/40 px-3 py-2 text-sm text-zinc-100 focus:border-zinc-600 focus:outline-none"
                  />
                </div>
              </div>

              <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
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
                  buttonClassName="rounded-xl border border-zinc-800 bg-zinc-900/40 px-3 py-2 text-xs font-bold uppercase tracking-[0.2em] text-zinc-100 focus:border-zinc-600 focus:outline-none"
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
                  buttonClassName="rounded-xl border border-zinc-800 bg-zinc-900/40 px-3 py-2 text-xs font-bold uppercase tracking-[0.2em] text-zinc-100 focus:border-zinc-600 focus:outline-none"
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
                  buttonClassName="rounded-xl border border-zinc-800 bg-zinc-900/40 px-3 py-2 text-xs font-bold uppercase tracking-[0.2em] text-zinc-100 focus:border-zinc-600 focus:outline-none"
                />
              </div>
            </section>

            <section className="border-b border-zinc-900 py-6">
              <div className="mb-5 space-y-2">
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => stepEditorWeek(-1)}
                    disabled={activeWeekIndex === 0}
                    className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-zinc-800 text-zinc-400 transition-colors hover:text-zinc-200 disabled:opacity-35"
                    aria-label="Previous week"
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => setEditorJumpPicker('week')}
                    className="flex-1 rounded-full border border-zinc-800 px-3 py-2 text-center text-[10px] font-bold uppercase tracking-[0.22em] text-zinc-200 transition-colors hover:border-zinc-700"
                  >
                    Week {activeWeekIndex + 1} of {draft.weeks.length}
                  </button>
                  <button
                    type="button"
                    onClick={() => stepEditorWeek(1)}
                    disabled={activeWeekIndex >= draft.weeks.length - 1}
                    className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-zinc-800 text-zinc-400 transition-colors hover:text-zinc-200 disabled:opacity-35"
                    aria-label="Next week"
                  >
                    <ChevronRight className="h-4 w-4" />
                  </button>
                </div>
                {currentWeek && (
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => stepEditorSession(-1)}
                      disabled={activeDayIndex === 0}
                      className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-zinc-800 text-zinc-400 transition-colors hover:text-zinc-200 disabled:opacity-35"
                      aria-label="Previous session"
                    >
                      <ChevronLeft className="h-4 w-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => setEditorJumpPicker('session')}
                      className="flex-1 rounded-full border border-zinc-800 px-3 py-2 text-center text-[10px] font-bold uppercase tracking-[0.22em] text-zinc-200 transition-colors hover:border-zinc-700"
                    >
                      Session {activeDayIndex + 1} of {currentWeek.days.length}
                    </button>
                    <button
                      type="button"
                      onClick={() => stepEditorSession(1)}
                      disabled={activeDayIndex >= currentWeek.days.length - 1}
                      className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-zinc-800 text-zinc-400 transition-colors hover:text-zinc-200 disabled:opacity-35"
                      aria-label="Next session"
                    >
                      <ChevronRight className="h-4 w-4" />
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

                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <div className="flex flex-wrap items-center gap-2 text-[10px] font-bold uppercase tracking-[0.2em] text-zinc-500">
                            <span className="rounded-full border border-zinc-800 px-2.5 py-1">
                              {currentSessionExerciseCount} {currentSessionExerciseCount === 1 ? 'exercise' : 'exercises'}
                            </span>
                            <span className="rounded-full border border-zinc-800 px-2.5 py-1">
                              {currentSessionSetCount} {currentSessionSetCount === 1 ? 'set' : 'sets'}
                            </span>
                          </div>

                          <div className="flex flex-wrap items-center gap-2">
                            <button
                              type="button"
                              onClick={handleAddSingleBlock}
                              className="inline-flex shrink-0 items-center gap-2 rounded-xl border border-emerald-500/40 bg-emerald-500/10 px-3 py-2 text-[10px] font-bold uppercase tracking-[0.2em] text-emerald-300 transition-colors hover:border-emerald-500/60 hover:bg-emerald-500/15"
                            >
                              <CirclePlus className="h-3.5 w-3.5" />
                              Add Single
                            </button>
                            <button
                              type="button"
                              onClick={handleAddSupersetBlock}
                              className="inline-flex shrink-0 items-center gap-2 rounded-xl border border-violet-500/40 bg-violet-500/10 px-3 py-2 text-[10px] font-bold uppercase tracking-[0.2em] text-violet-300 transition-colors hover:border-violet-500/60 hover:bg-violet-500/15"
                            >
                              <CirclePlus className="h-3.5 w-3.5" />
                              Add Superset
                            </button>
                          </div>
                        </div>

                        <p className="text-[10px] uppercase tracking-[0.18em] text-zinc-500">
                          Build this session as ordered blocks. Superset blocks run A1, then A2, then round rest.
                        </p>
                      </div>

                      <div className="mb-4 flex items-center justify-between gap-2">
                        <div className="flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => setEditorDetailMode('simple')}
                            className={`rounded-full px-3 py-1.5 text-[10px] font-bold uppercase tracking-[0.2em] ${
                              editorDetailMode === 'simple'
                                ? 'bg-zinc-100 text-zinc-950'
                                : 'text-zinc-500 hover:text-zinc-300'
                            }`}
                          >
                            Simple
                          </button>
                          <button
                            type="button"
                            onClick={() => setEditorDetailMode('advanced')}
                            className={`rounded-full px-3 py-1.5 text-[10px] font-bold uppercase tracking-[0.2em] ${
                              editorDetailMode === 'advanced'
                                ? 'bg-zinc-100 text-zinc-950'
                                : 'text-zinc-500 hover:text-zinc-300'
                            }`}
                          >
                            Advanced
                          </button>
                        </div>
                        {hasEditorSetFocus && (
                          <button
                            type="button"
                            onClick={() => setEditorSetFocus(null)}
                            className="text-[10px] font-bold uppercase tracking-[0.2em] text-cyan-300 hover:text-cyan-200"
                          >
                            Exit Focus
                          </button>
                        )}
                      </div>

                      <div className="space-y-3">
                        {currentDayBlocks.length === 0 && (
                          <div className="grid gap-2 sm:grid-cols-2">
                            <button
                              type="button"
                              onClick={handleAddSingleBlock}
                              className="w-full rounded-2xl border border-dashed border-zinc-800 px-4 py-7 text-center text-sm font-bold uppercase tracking-[0.2em] text-zinc-500 transition-colors hover:border-emerald-500/45 hover:text-emerald-300"
                            >
                              Add First Single Block
                            </button>
                            <button
                              type="button"
                              onClick={handleAddSupersetBlock}
                              className="w-full rounded-2xl border border-dashed border-zinc-800 px-4 py-7 text-center text-sm font-bold uppercase tracking-[0.2em] text-zinc-500 transition-colors hover:border-violet-500/45 hover:text-violet-300"
                            >
                              Add First Superset Block
                            </button>
                          </div>
                        )}

                        {currentDayBlocks.map((block, blockIndex) => {
                          const blockTypeLabel = block.type === 'superset' ? 'Superset' : 'Single';
                          const blockSetCount = countBlockSets([block]);
                          const blockExerciseCount = block.exercises.length;
                          const canMoveUp = blockIndex > 0;
                          const canMoveDown = blockIndex < currentDayBlocks.length - 1;

                          return (
                            <article
                              key={`${block.id}-${blockIndex}`}
                              className="rounded-2xl border border-zinc-900 bg-zinc-950/35 p-3"
                            >
                              <div className="mb-3 flex items-start justify-between gap-3">
                                <div>
                                  <p className="text-[11px] font-black uppercase tracking-[0.24em] text-zinc-300">
                                    Block {blockIndex + 1}
                                  </p>
                                  <p className="mt-1 text-[10px] uppercase tracking-[0.18em] text-zinc-500">
                                    {blockTypeLabel} • {blockExerciseCount} {blockExerciseCount === 1 ? 'exercise' : 'exercises'} • {blockSetCount} {blockSetCount === 1 ? 'set' : 'sets'}
                                  </p>
                                </div>

                                <div className="flex items-center gap-1">
                                  <button
                                    type="button"
                                    onClick={() => handleMoveBlock(blockIndex, -1)}
                                    disabled={!canMoveUp}
                                    className="inline-flex h-8 w-8 items-center justify-center rounded-full text-zinc-500 transition-colors hover:bg-zinc-900/80 hover:text-zinc-200 disabled:opacity-30"
                                    aria-label="Move block up"
                                  >
                                    <ArrowUp className="h-4 w-4" />
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => handleMoveBlock(blockIndex, 1)}
                                    disabled={!canMoveDown}
                                    className="inline-flex h-8 w-8 items-center justify-center rounded-full text-zinc-500 transition-colors hover:bg-zinc-900/80 hover:text-zinc-200 disabled:opacity-30"
                                    aria-label="Move block down"
                                  >
                                    <ArrowDown className="h-4 w-4" />
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => handleRemoveBlock(blockIndex)}
                                    className="inline-flex h-8 w-8 items-center justify-center rounded-full text-zinc-600 transition-colors hover:bg-rose-500/10 hover:text-rose-400"
                                    aria-label="Remove block"
                                  >
                                    <Trash2 className="h-4 w-4" />
                                  </button>
                                </div>
                              </div>

                              {block.type === 'superset' && (
                                <div className={`mb-3 grid gap-2 ${editorDetailMode === 'advanced' ? 'grid-cols-3' : 'grid-cols-2'}`}>
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
                                      className="mt-1 w-full rounded-lg border border-zinc-800 bg-zinc-950/60 px-2.5 py-2 text-sm text-zinc-100 focus:border-zinc-600 focus:outline-none"
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
                                      className="mt-1 w-full rounded-lg border border-zinc-800 bg-zinc-950/60 px-2.5 py-2 text-sm text-zinc-100 focus:border-zinc-600 focus:outline-none"
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
                                        className="mt-1 w-full rounded-lg border border-zinc-800 bg-zinc-950/60 px-2.5 py-2 text-sm text-zinc-100 focus:border-zinc-600 focus:outline-none"
                                      />
                                    </div>
                                  )}
                                </div>
                              )}

                              {block.type === 'single' && (
                                <>
                                  {block.exercises[0] ? (
                                    renderExerciseEditor(block, blockIndex, block.exercises[0], 0)
                                  ) : (
                                    <button
                                      type="button"
                                      onClick={() => handleReplaceExercise(blockIndex, 0)}
                                      className="w-full rounded-xl border border-dashed border-zinc-800 px-3 py-4 text-center text-[11px] font-bold uppercase tracking-[0.2em] text-zinc-400 transition-colors hover:border-zinc-700 hover:text-zinc-200"
                                    >
                                      Pick Exercise
                                    </button>
                                  )}
                                </>
                              )}

                              {block.type === 'superset' && (
                                <div className="space-y-2">
                                  {(['A1', 'A2'] as const).map((slot) => {
                                    const slotExercise = block.exercises.find((exercise) => exercise.slot === slot);
                                    const slotExerciseIndex = slotExercise
                                      ? block.exercises.findIndex((exercise) => exercise.id === slotExercise.id)
                                      : -1;
                                    if (!slotExercise || slotExerciseIndex === -1) {
                                      return (
                                        <button
                                          key={`${block.id}-${slot}-add`}
                                          type="button"
                                          onClick={() => handleSetSupersetSlotExercise(blockIndex, slot)}
                                          className="w-full rounded-xl border border-dashed border-zinc-800 px-3 py-4 text-center text-[11px] font-bold uppercase tracking-[0.2em] text-zinc-400 transition-colors hover:border-violet-500/45 hover:text-violet-200"
                                        >
                                          Add {slot}
                                        </button>
                                      );
                                    }
                                    return renderExerciseEditor(
                                      block,
                                      blockIndex,
                                      slotExercise,
                                      slotExerciseIndex,
                                      slot
                                    );
                                  })}
                                </div>
                              )}
                            </article>
                          );
                        })}

                        {currentDayBlocks.length > 0 && (
                          <div className="grid gap-2 sm:grid-cols-2">
                            <button
                              type="button"
                              onClick={handleAddSingleBlock}
                              className="w-full rounded-xl border border-dashed border-zinc-800 px-3 py-3 text-center text-[11px] font-bold uppercase tracking-[0.2em] text-zinc-400 transition-colors hover:border-emerald-500/45 hover:text-emerald-200"
                            >
                              Add Single Block
                            </button>
                            <button
                              type="button"
                              onClick={handleAddSupersetBlock}
                              className="w-full rounded-xl border border-dashed border-zinc-800 px-3 py-3 text-center text-[11px] font-bold uppercase tracking-[0.2em] text-zinc-400 transition-colors hover:border-violet-500/45 hover:text-violet-200"
                            >
                              Add Superset Block
                            </button>
                          </div>
                        )}
                      </div>
                    </>
                  )}
                </>
              )}
            </section>

            {editorError && <p className="pt-4 text-sm text-rose-400">{editorError}</p>}
          </div>

          <footer className="shrink-0 border-t border-zinc-800 bg-zinc-950/95 px-4 pb-[calc(env(safe-area-inset-bottom)+1rem)] pt-3 backdrop-blur-xl sm:px-6">
            <div className="mx-auto flex w-full max-w-5xl items-center gap-3">
              <button
                type="button"
                onClick={closeEditor}
                className="flex-1 rounded-2xl border border-zinc-800 py-3 text-xs font-bold uppercase tracking-[0.22em] text-zinc-300"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  void handleSaveDraft();
                }}
                disabled={editorSaving}
                className="flex-[2] rounded-2xl bg-emerald-500 py-3 text-xs font-black uppercase tracking-[0.25em] text-zinc-950 shadow-lg shadow-emerald-500/20 disabled:opacity-60"
              >
                <span className="inline-flex items-center gap-2">
                  <Save className="h-4 w-4" />
                  {editorSaving ? 'Saving...' : 'Save Program'}
                </span>
              </button>
            </div>
          </footer>
        </div>
      )}

      {editorMode && draft && editorJumpPicker && (
        <div className="fixed inset-0 z-[135] bg-black/65 backdrop-blur-md">
          <button
            type="button"
            aria-label="Close picker"
            onClick={() => setEditorJumpPicker(null)}
            className="absolute inset-0"
          />
          <div className="absolute inset-x-0 bottom-0 rounded-t-3xl border-t border-zinc-800 bg-zinc-950 px-4 pb-[calc(env(safe-area-inset-bottom)+1.2rem)] pt-4 sm:px-6">
            <div className="mx-auto w-full max-w-5xl">
              <div className="mb-3 flex items-center justify-between">
                <p className="text-xs font-bold uppercase tracking-[0.25em] text-zinc-400">
                  {editorJumpPicker === 'week' ? 'Jump To Week' : 'Jump To Session'}
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

              <div className="max-h-[46dvh] overflow-y-auto space-y-1 pr-1" data-swipe-ignore="true">
                {editorJumpPicker === 'week' &&
                  draft.weeks.map((week, index) => {
                    const weekSetCount = week.days.reduce((count, day) => count + countDaySets(day), 0);
                    const isActive = index === activeWeekIndex;
                    return (
                      <button
                        key={`jump-week-${week.weekNumber}`}
                        type="button"
                        onClick={() => selectEditorWeek(index)}
                        className={`w-full rounded-xl px-3 py-3 text-left transition-colors ${
                          isActive
                            ? 'bg-cyan-500/10 text-cyan-200'
                            : 'border border-zinc-800 bg-zinc-900/40 text-zinc-200 hover:border-zinc-700'
                        }`}
                      >
                        <p className="text-sm font-bold">Week {index + 1}</p>
                        <p className="mt-1 text-[10px] uppercase tracking-[0.2em] text-zinc-500">
                          {week.days.length} sessions • {weekSetCount} sets
                        </p>
                      </button>
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
                        className={`w-full rounded-xl px-3 py-3 text-left transition-colors ${
                          isActive
                            ? 'bg-emerald-500/10 text-emerald-200'
                            : 'border border-zinc-800 bg-zinc-900/40 text-zinc-200 hover:border-zinc-700'
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
      )}

      {exercisePickerOpen && (
        <div className="fixed inset-0 z-[140] bg-black/70 backdrop-blur-sm">
          <div className="absolute inset-x-0 bottom-0 rounded-t-3xl border-t border-zinc-800 bg-zinc-950 px-4 pb-[calc(env(safe-area-inset-bottom)+1.2rem)] pt-4 sm:px-6">
            <div className="mx-auto w-full max-w-5xl">
              <div className="mb-3 flex items-center justify-between">
                <p className="text-xs font-bold uppercase tracking-[0.25em] text-zinc-400">Pick Exercise</p>
                <button
                  type="button"
                  onClick={() => {
                    setExercisePickerOpen(false);
                    setExercisePickerTarget(null);
                    setExerciseQuery('');
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
                  onChange={(event) => setExerciseQuery(event.target.value)}
                  placeholder="Search exercises..."
                  className="w-full bg-transparent text-sm text-zinc-100 placeholder:text-zinc-600 focus:outline-none"
                />
              </div>

              {exerciseQuery.trim().length > 1 && (
                <button
                  type="button"
                  onClick={createCustomExerciseFromQuery}
                  className="mb-3 flex w-full items-center justify-between rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-left"
                >
                  <span className="text-xs font-bold uppercase tracking-[0.2em] text-emerald-300">
                    Use &quot;{exerciseQuery.trim()}&quot;
                  </span>
                  <CirclePlus className="h-4 w-4 text-emerald-300" />
                </button>
              )}

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
            </div>
          </div>
        </div>
      )}
    </>
  );
}
