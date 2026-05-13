import { buildExerciseCatalog, resolveExerciseDisplayName } from '../exercises/catalog';
import { defaultExercises } from '../programs';
import type { CustomExercise, UserMax, WeightUnit, WorkoutSession } from '../types';
import { convertWeight } from '../units';

export type CoachProfileRecord = {
  displayName?: string | null;
  username?: string | null;
  experienceLevel?: string | null;
  bio?: string | null;
};

export type CoachDemographicsRecord = {
  age?: number | null;
  sex?: 'male' | 'female' | 'other' | null;
  athleticBackground?: string | null;
  trainingAge?: number | null;
  bodyweightKg?: number | null;
  heightCm?: number | null;
  currentInjuries?: string[] | null;
  chronicConditions?: string[] | null;
};

export type CoachContextRecord = {
  date: string;
  sleepHours?: number | null;
  sleepQuality?: 'poor' | 'fair' | 'good' | 'excellent' | null;
  proteinIntake?: number | null;
  calorieBalance?: 'deficit' | 'maintenance' | 'surplus' | null;
  subjectiveReadiness?: number | null;
};

export type CoachExportInput = {
  email?: string | null;
  authMetadata?: Record<string, unknown> | null;
  preferredWeightUnit: WeightUnit;
  profile?: CoachProfileRecord | null;
  demographics?: CoachDemographicsRecord | null;
  latestContextEntries?: CoachContextRecord[];
  workouts: WorkoutSession[];
  customExercises: CustomExercise[];
  maxes: UserMax[];
};

type WorkingWeightEntry = {
  exerciseId: string;
  exerciseName: string;
  weight: number;
  unit: WeightUnit;
  reps: number | null;
  rpe: number | null;
  loggedOn: string;
};

export type CoachExportBundle = {
  athleteName: string;
  goalLabel: string;
  experienceLabel: string;
  currentProgramLabel: string;
  scheduleLabel: string;
  equipmentLabel: string;
  workoutsWithSets: number;
  customExerciseCount: number;
  missingFields: string[];
  dataWarnings: string[];
  systemPrompt: string;
  exercisePreferenceDraft: string;
  liftLogSnapshot: string;
  promptStack: string;
  combinedExport: string;
};

const GOAL_LABEL_MAP: Record<string, string> = {
  muscle: 'Hypertrophy',
  hypertrophy: 'Hypertrophy',
  strength: 'Strength',
  fitness: 'General Fitness',
  general: 'General Fitness',
  sport: 'Sport Performance',
  powerlifting: 'Powerlifting',
  peaking: 'Peaking',
};

const EXPERIENCE_LABEL_MAP: Record<string, string> = {
  beginner: 'Beginner',
  intermediate: 'Intermediate',
  advanced: 'Advanced',
  elite: 'Elite',
};

function getSortTime(workout: WorkoutSession): number {
  return new Date(workout.endTime || workout.startTime || workout.date).getTime();
}

function titleCase(value: string): string {
  return value
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function asString(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

function inferName(input: CoachExportInput): string {
  const displayName = asString(input.profile?.displayName);
  if (displayName) return displayName;

  const username = asString(input.profile?.username);
  if (username) return username;

  const email = asString(input.email);
  if (email) {
    const prefix = email.split('@')[0]?.trim();
    if (prefix) return prefix;
  }

  return 'Athlete';
}

function resolveGoalLabel(input: CoachExportInput): string {
  const rawGoal = asString(input.authMetadata?.user_goal) ?? 'general';
  return GOAL_LABEL_MAP[rawGoal.toLowerCase()] ?? titleCase(rawGoal);
}

function resolveExperienceDetails(input: CoachExportInput): { chosen: string; warning: string | null } {
  const authExperience = asString(input.authMetadata?.experience_level);
  const profileExperience = asString(input.profile?.experienceLevel);
  const demographicExperience = asString(input.demographics?.athleticBackground);

  const normalized = [authExperience, profileExperience, demographicExperience]
    .filter((value): value is string => Boolean(value))
    .map((value) => value.toLowerCase());

  const unique = Array.from(new Set(normalized));
  const chosenRaw = authExperience ?? profileExperience ?? demographicExperience ?? 'intermediate';
  const chosen = EXPERIENCE_LABEL_MAP[chosenRaw.toLowerCase()] ?? titleCase(chosenRaw);

  if (unique.length <= 1) {
    return { chosen, warning: null };
  }

  const warning = `Experience data conflicts across records: auth=${authExperience ?? 'missing'}, profile=${profileExperience ?? 'missing'}, demographics=${demographicExperience ?? 'missing'}.`;
  return { chosen, warning };
}

function formatBodyMetric(
  value: number | null | undefined,
  sourceUnit: 'kg' | 'cm',
  preferredWeightUnit: WeightUnit
): string {
  if (value == null) return 'Unknown';
  if (sourceUnit === 'kg') {
    const converted = preferredWeightUnit === 'kg' ? value : convertWeight(value, 'kg', 'lbs');
    return `${converted.toFixed(1)} ${preferredWeightUnit}`;
  }

  const inches = value * 0.393701;
  return `${value.toFixed(0)} cm (${inches.toFixed(1)} in)`;
}

function inferScheduleLabel(workouts: WorkoutSession[]): string {
  if (workouts.length === 0) return 'Unknown';

  const sorted = [...workouts].sort((a, b) => getSortTime(b) - getSortTime(a));
  const cutoff = sorted[0] ? new Date(sorted[0].date) : new Date();
  cutoff.setDate(cutoff.getDate() - 28);

  const recentDates = new Set(
    sorted
      .filter((workout) => new Date(workout.date) >= cutoff)
      .map((workout) => workout.date)
  );

  if (recentDates.size === 0) return 'Unknown';

  const frequency = recentDates.size / 4;
  const rounded = Math.max(1, Math.min(7, Math.round(frequency)));
  return `About ${rounded} days/week (inferred from recent session history)`;
}

function inferEquipmentLabel(input: CoachExportInput): string {
  const equipment = new Set<string>();
  const defaultExerciseMap = new Map(defaultExercises.map((exercise) => [exercise.id, exercise]));

  input.customExercises.forEach((exercise) => equipment.add(exercise.equipment));
  input.workouts.forEach((workout) => {
    workout.sets.forEach((set) => {
      defaultExerciseMap.get(set.exerciseId)?.equipment?.forEach((item) => equipment.add(item));
    });
  });

  const list = Array.from(equipment);
  if (list.length === 0) return 'Unknown';

  const hasCableOrMachine = list.includes('cable') || list.includes('machine');
  const hasFreeWeights = list.includes('barbell') || list.includes('dumbbell');

  if (hasCableOrMachine && hasFreeWeights) {
    return 'Likely commercial gym (inferred from logged equipment usage)';
  }

  if (hasFreeWeights && !hasCableOrMachine) {
    return 'Likely free-weight setup (inferred from logged equipment usage)';
  }

  if (list.includes('bodyweight') && list.length === 1) {
    return 'Bodyweight-only setup (inferred from logged equipment usage)';
  }

  return `Inferred equipment access: ${list.map(titleCase).join(', ')}`;
}

function collectWorkingWeights(input: CoachExportInput): WorkingWeightEntry[] {
  const catalog = buildExerciseCatalog(defaultExercises, input.customExercises);
  const byExercise = new Map<string, WorkingWeightEntry>();
  const sorted = [...input.workouts].sort((a, b) => getSortTime(b) - getSortTime(a));

  for (const workout of sorted) {
    for (const set of workout.sets) {
      if (!set.completed || set.actualWeight == null || set.actualWeight <= 0) continue;
      if (!set.exerciseId || byExercise.has(set.exerciseId)) continue;

      const sourceUnit = set.weightUnit ?? input.preferredWeightUnit;
      const convertedWeight =
        sourceUnit === input.preferredWeightUnit
          ? set.actualWeight
          : convertWeight(set.actualWeight, sourceUnit, input.preferredWeightUnit);

      byExercise.set(set.exerciseId, {
        exerciseId: set.exerciseId,
        exerciseName: resolveExerciseDisplayName(set.exerciseId, {
          catalog,
          cachedName: set.exerciseName,
        }),
        weight: convertedWeight,
        unit: input.preferredWeightUnit,
        reps: set.actualReps ?? null,
        rpe: set.actualRPE ?? null,
        loggedOn: workout.date,
      });
    }
  }

  return Array.from(byExercise.values()).slice(0, 12);
}

function formatWorkingWeightsSection(entries: WorkingWeightEntry[]): string {
  if (entries.length === 0) {
    return '- No recent set-level working weights found yet. Use Week 1 as a calibration week.';
  }

  return entries
    .map((entry) => {
      const repText = entry.reps != null ? `${entry.reps} reps` : 'reps not logged';
      const rpeText = entry.rpe != null ? `RPE ${entry.rpe}` : 'RPE not logged';
      return `- ${entry.exerciseName}: ${entry.weight.toFixed(1)} ${entry.unit} (${repText}, ${rpeText}, logged ${entry.loggedOn})`;
    })
    .join('\n');
}

function collectPerformedExercises(input: CoachExportInput): Array<{ name: string; source: string }> {
  const catalog = buildExerciseCatalog(defaultExercises, input.customExercises);
  const seen = new Set<string>();
  const items: Array<{ name: string; source: string }> = [];

  [...input.workouts]
    .sort((a, b) => getSortTime(b) - getSortTime(a))
    .forEach((workout) => {
      workout.sets.forEach((set) => {
        if (!set.exerciseId || seen.has(set.exerciseId)) return;
        seen.add(set.exerciseId);
        items.push({
          name: resolveExerciseDisplayName(set.exerciseId, {
            catalog,
            cachedName: set.exerciseName,
          }),
          source: 'logged session',
        });
      });
    });

  input.customExercises.forEach((exercise) => {
    if (seen.has(exercise.id)) return;
    seen.add(exercise.id);
    items.push({
      name: exercise.name,
      source: 'custom exercise library',
    });
  });

  return items.slice(0, 24);
}

function formatExercisePreferenceDraft(input: CoachExportInput, missingFields: string[]): string {
  const performedExercises = collectPerformedExercises(input);
  const customExerciseLines = input.customExercises.length
    ? input.customExercises
      .slice()
      .sort((a, b) => a.name.localeCompare(b.name))
      .map((exercise) => {
        const muscles = exercise.primaryMuscles.length > 0 ? exercise.primaryMuscles.join(', ') : 'unspecified muscles';
        return `- ${exercise.name} | ${exercise.equipment} | ${muscles}`;
      })
      .join('\n')
    : '- No custom exercises saved yet.';

  const performedLines = performedExercises.length
    ? performedExercises.map((exercise) => `- ${exercise.name} (${exercise.source})`).join('\n')
    : '- No exercises inferred from workout history yet.';

  const missingPreferenceLines = missingFields
    .filter((item) => item.toLowerCase().includes('exercise') || item.toLowerCase().includes('equipment'))
    .map((item) => `- ${item}`)
    .join('\n');

  return [
    '=====================================',
    'EXERCISE PREFERENCE DRAFT',
    '=====================================',
    '',
    'This file is inferred from Iron Brain data. Anything not listed still needs explicit confirmation.',
    '',
    'KNOWN INCLUDED EXERCISES',
    performedLines,
    '',
    'CUSTOM EXERCISES SAVED IN APP',
    customExerciseLines,
    '',
    'STILL NEEDS CONFIRMATION',
    missingPreferenceLines || '- Explicit favorite exercises, hated exercises, and substitutions are still missing.',
    '',
    '=====================================',
    'END OF DRAFT',
    '=====================================',
  ].join('\n');
}

function formatRecentMaxes(maxes: UserMax[], preferredWeightUnit: WeightUnit): string {
  if (maxes.length === 0) return '- No max records saved yet.';

  return maxes
    .slice()
    .sort((a, b) => new Date(b.testedAt).getTime() - new Date(a.testedAt).getTime())
    .slice(0, 6)
    .map((max) => {
      const convertedWeight =
        max.unit === preferredWeightUnit ? max.weight : convertWeight(max.weight, max.unit, preferredWeightUnit);
      return `- ${max.exerciseName}: ${convertedWeight.toFixed(1)} ${preferredWeightUnit} (${max.estimatedOrTested}, ${max.testedAt})`;
    })
    .join('\n');
}

function formatSessionLines(workout: WorkoutSession, preferredWeightUnit: WeightUnit): string[] {
  const lines = workout.sets
    .filter((set) => set.completed)
    .slice(0, 20)
    .map((set) => {
      const sourceUnit = set.weightUnit ?? preferredWeightUnit;
      const weight =
        set.actualWeight == null
          ? 'bodyweight / unlogged'
          : `${(sourceUnit === preferredWeightUnit
            ? set.actualWeight
            : convertWeight(set.actualWeight, sourceUnit, preferredWeightUnit)
          ).toFixed(1)} ${preferredWeightUnit}`;
      const reps = set.actualReps ?? '—';
      const rpe = set.actualRPE ?? '—';
      const exerciseName = set.exerciseName || set.exerciseId || 'Unknown Exercise';
      return `${exerciseName} | 1 x ${reps} | ${weight} | ${rpe}`;
    });

  if (lines.length === 0) {
    return ['No set-level exercise logs stored for this session.'];
  }

  return lines;
}

function formatLiftLogSnapshot(input: CoachExportInput, workingWeights: WorkingWeightEntry[]): string {
  const sessionsWithSets = [...input.workouts]
    .sort((a, b) => getSortTime(b) - getSortTime(a))
    .filter((workout) => workout.sets.length > 0)
    .slice(0, 5);

  const sessionBlocks = sessionsWithSets.length
    ? sessionsWithSets
      .map((workout) => {
        const header = `[${workout.date}] — ${workout.dayName || workout.programName || 'Workout'}`;
        const subheader = `Program: ${workout.programName || 'Unassigned'} | Duration: ${workout.durationMinutes ?? '—'} min`;
        const lines = formatSessionLines(workout, input.preferredWeightUnit).join('\n');
        return `${header}\n${subheader}\n\nExercise | Sets x Reps | Weight | RPE\n----------------------------------------------------------\n${lines}`;
      })
      .join('\n\n----------------------------------------------------------\n\n')
    : 'No set-level workout history found yet.';

  return [
    '=====================================',
    'LIFT LOG SNAPSHOT',
    '=====================================',
    '',
    'CURRENT WORKING WEIGHTS',
    formatWorkingWeightsSection(workingWeights),
    '',
    'RECENT MAXES',
    formatRecentMaxes(input.maxes, input.preferredWeightUnit),
    '',
    'RECENT SESSIONS',
    sessionBlocks,
    '',
    '=====================================',
    'END OF SNAPSHOT',
    '=====================================',
  ].join('\n');
}

function formatPromptStack(_input: CoachExportInput, bundle: Pick<CoachExportBundle, 'athleteName' | 'goalLabel' | 'scheduleLabel'>): string {
  const scheduleHint = bundle.scheduleLabel.startsWith('Unknown') ? '4' : bundle.scheduleLabel.match(/\d+/)?.[0] ?? '4';

  return [
    '1. First-pass data check',
    `Read my coach system prompt, exercise preference draft, and lift log snapshot. Summarize what you know for certain about ${bundle.athleteName}, what you are inferring, what data conflicts exist, and ask only for the missing information that materially affects programming.`,
    '',
    '2. Build the program',
    `Based on my profile, goal (${bundle.goalLabel}), exercise preferences, and lift log, build me a full ${scheduleHint}-day training program. Use explicit working weights when the log supports them, use Week 1 as calibration where data is missing, and keep the response concise with tables.`,
    '',
    '3. Next session',
    'Using my most recent session history and recovery context, give me my next session with exercises, sets, reps, target RPE, and specific starting weights where you have enough evidence.',
    '',
    '4. Swap an exercise',
    'I want to swap out [exercise]. Use my known preferences, equipment access, injuries, and current block to give me the best substitute and update the plan going forward.',
    '',
    '5. Deload week',
    'I need a deload. Based on my current training and recovery data, give me a full deload week that keeps the same movement patterns but reduces fatigue correctly.',
    '',
    '6. Plateau review',
    'My [lift] has stalled. Use my log to explain why it has stalled, what evidence supports that view, and give me a 3-week plan to break through it.',
  ].join('\n');
}

function collectMissingFields(input: CoachExportInput, dataWarnings: string[]): string[] {
  const missing: string[] = [];
  const hasGoal = Boolean(asString(input.authMetadata?.user_goal));
  const hasExperience = Boolean(
    asString(input.authMetadata?.experience_level) ||
    asString(input.profile?.experienceLevel) ||
    asString(input.demographics?.athleticBackground)
  );
  const hasBodyMetrics = input.demographics?.bodyweightKg != null && input.demographics?.heightCm != null;
  const hasInjuries = Array.isArray(input.demographics?.currentInjuries);
  const hasNutritionPhase = input.latestContextEntries?.some((entry) => entry.calorieBalance || entry.proteinIntake != null) ?? false;

  if (!hasGoal) missing.push('Primary goal is not stored explicitly.');
  if (!hasExperience) missing.push('Current experience level is missing.');
  if (!hasBodyMetrics) missing.push('Current bodyweight and/or height is missing.');
  if (!hasInjuries) missing.push('Injury / limitation status has not been confirmed.');
  missing.push('Explicit planned training schedule and session length are not stored; only recent workout frequency can be inferred.');
  missing.push('Explicit exercise likes, hated lifts, and substitution preferences are not stored.');
  missing.push('Equipment access is inferred from exercise history, not explicitly stored.');
  if (!hasNutritionPhase) missing.push('Current nutrition phase, calories, and protein target are not stored clearly enough for coaching.');
  dataWarnings.forEach((warning) => {
    if (warning.toLowerCase().includes('experience')) {
      missing.push('Experience level needs confirmation because account records disagree.');
    }
  });

  return Array.from(new Set(missing));
}

function collectDataWarnings(input: CoachExportInput): string[] {
  const warnings: string[] = [];
  const experienceDetails = resolveExperienceDetails(input);
  if (experienceDetails.warning) warnings.push(experienceDetails.warning);

  const workoutUnits = new Set(input.workouts.flatMap((workout) => workout.sets.map((set) => set.weightUnit).filter(Boolean)));
  const maxUnits = new Set(input.maxes.map((max) => max.unit));
  const combinedUnits = new Set([...workoutUnits, ...maxUnits]);
  if (combinedUnits.size > 1) {
    warnings.push('Weight data uses mixed units across logs/maxes. Normalize before treating any one value as definitive.');
  }

  const sessionsWithSets = input.workouts.filter((workout) => workout.sets.length > 0).length;
  if (sessionsWithSets < 3) {
    warnings.push('Very little set-level workout history is available, so working weights should be treated as provisional.');
  }

  return warnings;
}

function buildSystemPrompt(input: CoachExportInput, workingWeights: WorkingWeightEntry[], missingFields: string[], dataWarnings: string[]): string {
  const athleteName = inferName(input);
  const goalLabel = resolveGoalLabel(input);
  const experienceDetails = resolveExperienceDetails(input);
  const injuries = (input.demographics?.currentInjuries ?? []).filter(Boolean);
  const latestContext = input.latestContextEntries?.[0];
  const recentWorkout = [...input.workouts].sort((a, b) => getSortTime(b) - getSortTime(a))[0];
  const currentProgram = recentWorkout?.programName || 'Unknown';

  const profileLines = [
    `Name: ${athleteName}`,
    `Goal: ${goalLabel}`,
    `Training experience: ${experienceDetails.chosen}`,
    `Training age: ${input.demographics?.trainingAge != null ? `${input.demographics.trainingAge} years` : 'Unknown'}`,
    `Age / sex: ${input.demographics?.age ?? 'Unknown'} / ${input.demographics?.sex ?? 'Unknown'}`,
    `Bodyweight: ${formatBodyMetric(input.demographics?.bodyweightKg, 'kg', input.preferredWeightUnit)}`,
    `Height: ${formatBodyMetric(input.demographics?.heightCm, 'cm', input.preferredWeightUnit)}`,
    `Schedule: ${inferScheduleLabel(input.workouts)}`,
    `Equipment access: ${inferEquipmentLabel(input)}`,
    `Injuries or limitations: ${injuries.length > 0 ? injuries.join(', ') : 'None recorded'}`,
    `Current program: ${currentProgram}`,
  ];

  if (latestContext) {
    profileLines.push(
      `Latest recovery check-in (${latestContext.date}): sleep ${latestContext.sleepHours ?? '—'}h, sleep quality ${latestContext.sleepQuality ?? '—'}, readiness ${latestContext.subjectiveReadiness ?? '—'}/10`
    );
  }

  return [
    'IDENTITY',
    '',
    `You are a personal trainer AI built for ${athleteName}. You are direct, evidence-based, and practical. No fluff. Use the athlete data below as the source of truth, distinguish clearly between facts and inferences, and only ask follow-up questions when the missing information materially affects training decisions.`,
    '',
    '-------------------------------------',
    'ATHLETE PROFILE',
    '-------------------------------------',
    profileLines.join('\n'),
    '',
    '-------------------------------------',
    'CURRENT WORKING WEIGHTS',
    '-------------------------------------',
    'These are the latest logged working sets, not 1RMs. Use them as starting references and confirm anything that looks off.',
    formatWorkingWeightsSection(workingWeights),
    '',
    '-------------------------------------',
    'PROGRAMMING RULES',
    '-------------------------------------',
    '- Use logged working sets as baselines whenever history supports them.',
    '- Treat missing or contradictory data as a calibration issue, not a reason to hallucinate certainty.',
    '- Ask only for missing details that materially change exercise selection, loading, recovery, or scheduling.',
    '- Default to concise responses and use tables for programming.',
    '- When data conflicts exist, call them out explicitly and request a single correction from the athlete.',
    '',
    '-------------------------------------',
    'KNOWN DATA GAPS',
    '-------------------------------------',
    missingFields.map((item) => `- ${item}`).join('\n') || '- None',
    '',
    '-------------------------------------',
    'DATA WARNINGS',
    '-------------------------------------',
    dataWarnings.map((item) => `- ${item}`).join('\n') || '- None',
    '',
    '=====================================',
    'END OF SYSTEM PROMPT',
    '=====================================',
  ].join('\n');
}

export function buildCoachExport(input: CoachExportInput): CoachExportBundle {
  const athleteName = inferName(input);
  const goalLabel = resolveGoalLabel(input);
  const experienceDetails = resolveExperienceDetails(input);
  const workingWeights = collectWorkingWeights(input);
  const dataWarnings = collectDataWarnings(input);
  const missingFields = collectMissingFields(input, dataWarnings);
  const recentWorkout = [...input.workouts].sort((a, b) => getSortTime(b) - getSortTime(a))[0];

  const systemPrompt = buildSystemPrompt(input, workingWeights, missingFields, dataWarnings);
  const exercisePreferenceDraft = formatExercisePreferenceDraft(input, missingFields);
  const liftLogSnapshot = formatLiftLogSnapshot(input, workingWeights);
  const promptStack = formatPromptStack(input, {
    athleteName,
    goalLabel,
    scheduleLabel: inferScheduleLabel(input.workouts),
  });

  const combinedExport = [
    systemPrompt,
    '',
    exercisePreferenceDraft,
    '',
    liftLogSnapshot,
    '',
    'PROMPT STACK',
    '=====================================',
    promptStack,
  ].join('\n');

  return {
    athleteName,
    goalLabel,
    experienceLabel: experienceDetails.chosen,
    currentProgramLabel: recentWorkout?.programName || 'Unknown',
    scheduleLabel: inferScheduleLabel(input.workouts),
    equipmentLabel: inferEquipmentLabel(input),
    workoutsWithSets: input.workouts.filter((workout) => workout.sets.length > 0).length,
    customExerciseCount: input.customExercises.length,
    missingFields,
    dataWarnings,
    systemPrompt,
    exercisePreferenceDraft,
    liftLogSnapshot,
    promptStack,
    combinedExport,
  };
}
