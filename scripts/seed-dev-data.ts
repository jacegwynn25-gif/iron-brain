import type { SetLog, WorkoutSession } from '../app/lib/types';
import { createUuid } from '../app/lib/uuid';

type SeedOptions = {
  weeks?: number;
  workoutsPerWeek?: number;
  namespace?: string;
  userId?: string | null;
  saveToSupabase?: boolean;
  append?: boolean;
  clearExisting?: boolean;
  clearAll?: boolean;
};

type SeedResult = {
  workoutsCreated: number;
  namespace: string;
  savedToSupabase: boolean;
};

type WorkoutTemplate = {
  name: string;
  dayOfWeek: string;
  dayIndex: number;
  exercises: ExerciseSeed[];
};

type ExerciseSeed = {
  id: string;
  name: string;
  baseWeight: number;
  weeklyIncrease: number;
  repRange: [number, number];
  sets: number;
  targetRpe: number;
};

const STORAGE_KEY = 'iron_brain_workout_history';
const SEED_PROGRAM_ID = 'dev_seed_ppl';
const SEED_PROGRAM_NAME = 'Dev Seed PPL';

const WORKOUT_TEMPLATES: WorkoutTemplate[] = [
  {
    name: 'Push',
    dayOfWeek: 'Mon',
    dayIndex: 0,
    exercises: [
      { id: 'bench_tng', name: 'Bench Press (Touch & Go)', baseWeight: 185, weeklyIncrease: 5, repRange: [5, 8], sets: 4, targetRpe: 8 },
      { id: 'incline_bench', name: 'Incline Barbell Bench Press', baseWeight: 155, weeklyIncrease: 5, repRange: [8, 10], sets: 3, targetRpe: 7.5 },
      { id: 'db_shoulder_press', name: 'Dumbbell Shoulder Press', baseWeight: 60, weeklyIncrease: 2.5, repRange: [8, 12], sets: 3, targetRpe: 7.5 },
      { id: 'tricep_pressdown', name: 'Tricep Pressdown', baseWeight: 90, weeklyIncrease: 5, repRange: [10, 12], sets: 3, targetRpe: 8 },
      { id: 'lateral_raise', name: 'Lateral Raise', baseWeight: 20, weeklyIncrease: 2.5, repRange: [12, 15], sets: 3, targetRpe: 7.5 },
    ],
  },
  {
    name: 'Pull',
    dayOfWeek: 'Wed',
    dayIndex: 1,
    exercises: [
      { id: 'deadlift', name: 'Deadlift', baseWeight: 275, weeklyIncrease: 10, repRange: [4, 6], sets: 3, targetRpe: 8.5 },
      { id: 'bent_over_row', name: 'Bent-Over Barbell Row', baseWeight: 155, weeklyIncrease: 5, repRange: [6, 10], sets: 3, targetRpe: 8 },
      { id: 'lat_pulldown', name: 'Lat Pulldown', baseWeight: 140, weeklyIncrease: 5, repRange: [8, 12], sets: 3, targetRpe: 7.5 },
      { id: 'face_pull', name: 'Face Pull', baseWeight: 60, weeklyIncrease: 5, repRange: [12, 15], sets: 3, targetRpe: 7 },
      { id: 'db_curl', name: 'Dumbbell Curl', baseWeight: 35, weeklyIncrease: 2.5, repRange: [10, 12], sets: 3, targetRpe: 7.5 },
    ],
  },
  {
    name: 'Legs',
    dayOfWeek: 'Fri',
    dayIndex: 2,
    exercises: [
      { id: 'squat', name: 'Back Squat', baseWeight: 225, weeklyIncrease: 10, repRange: [5, 8], sets: 4, targetRpe: 8 },
      { id: 'rdl', name: 'Romanian Deadlift', baseWeight: 185, weeklyIncrease: 5, repRange: [8, 10], sets: 3, targetRpe: 7.5 },
      { id: 'leg_press', name: 'Leg Press', baseWeight: 270, weeklyIncrease: 10, repRange: [10, 12], sets: 3, targetRpe: 8 },
      { id: 'leg_curl', name: 'Leg Curl', baseWeight: 90, weeklyIncrease: 5, repRange: [10, 12], sets: 3, targetRpe: 7.5 },
      { id: 'standing_calf_raise', name: 'Standing Calf Raise', baseWeight: 135, weeklyIncrease: 5, repRange: [10, 15], sets: 3, targetRpe: 7 },
    ],
  },
  {
    name: 'Upper',
    dayOfWeek: 'Sat',
    dayIndex: 3,
    exercises: [
      { id: 'bench_backoff', name: 'Bench Press (Backoff)', baseWeight: 165, weeklyIncrease: 5, repRange: [8, 10], sets: 3, targetRpe: 8 },
      { id: 'row_neutral', name: 'Neutral-Grip Row', baseWeight: 145, weeklyIncrease: 5, repRange: [8, 10], sets: 3, targetRpe: 7.5 },
      { id: 'pullup', name: 'Pull-Up', baseWeight: 0, weeklyIncrease: 0, repRange: [6, 10], sets: 3, targetRpe: 8 },
      { id: 'db_incline_press', name: 'Incline Dumbbell Press', baseWeight: 65, weeklyIncrease: 2.5, repRange: [8, 12], sets: 3, targetRpe: 7.5 },
      { id: 'bicep_curl_cable', name: 'Cable Curl', baseWeight: 70, weeklyIncrease: 5, repRange: [10, 12], sets: 3, targetRpe: 7.5 },
    ],
  },
];

const DAY_OFFSETS = [0, 2, 4, 5];

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));
const roundTo = (value: number, increment = 2.5) => Math.round(value / increment) * increment;
const randomBetween = (min: number, max: number) => min + Math.random() * (max - min);
const randomInt = (min: number, max: number) => Math.floor(randomBetween(min, max + 1));

const formatDate = (date: Date) => date.toISOString().split('T')[0];

const startOfWeek = (date: Date) => {
  const copy = new Date(date);
  const day = copy.getDay();
  const diff = (day === 0 ? -6 : 1) - day;
  copy.setDate(copy.getDate() + diff);
  copy.setHours(0, 0, 0, 0);
  return copy;
};

const addDays = (date: Date, days: number) => {
  const copy = new Date(date);
  copy.setDate(copy.getDate() + days);
  return copy;
};

const addMinutes = (date: Date, minutes: number) => new Date(date.getTime() + minutes * 60 * 1000);

function buildSets(
  exercises: ExerciseSeed[],
  weekIndex: number,
  startTime: Date,
  fatigueBias: number
): SetLog[] {
  const sets: SetLog[] = [];
  let minuteOffset = 0;

  exercises.forEach((exercise) => {
    const baseWeight = exercise.baseWeight + exercise.weeklyIncrease * weekIndex;

    for (let i = 0; i < exercise.sets; i += 1) {
      const [minReps, maxReps] = exercise.repRange;
      const prescribedReps = minReps === maxReps ? `${minReps}` : `${minReps}-${maxReps}`;
      const targetReps = randomInt(minReps, maxReps);

      const targetRpe = clamp(
        exercise.targetRpe + weekIndex * 0.15 + (i === exercise.sets - 1 ? 0.3 : 0) + fatigueBias,
        7,
        9.5
      );

      const actualRpe = clamp(targetRpe + randomBetween(-0.2, 0.6), 7, 9.5);
      const repsPenalty = actualRpe >= 9 ? 1 : 0;
      const actualReps = clamp(targetReps - repsPenalty + randomInt(-1, 0), minReps, maxReps);

      const weightVariance = i === 0 ? 0 : 2.5;
      const actualWeight = roundTo(baseWeight + weightVariance, 2.5);
      const volumeLoad = actualWeight * actualReps;
      const e1rm = actualWeight * (1 + actualReps / 30);

      minuteOffset += 3 + Math.round(randomBetween(0, 2));

      sets.push({
        exerciseId: exercise.id,
        exerciseName: exercise.name,
        setIndex: i + 1,
        prescribedReps,
        prescribedRPE: targetRpe,
        actualWeight,
        actualReps,
        actualRPE: actualRpe,
        completed: true,
        weightUnit: 'lbs',
        loadType: 'absolute',
        e1rm: Math.round(e1rm * 10) / 10,
        volumeLoad,
        timestamp: addMinutes(startTime, minuteOffset).toISOString(),
        setType: 'straight',
      });
    }
  });

  return sets;
}

function buildWorkoutSession(
  template: WorkoutTemplate,
  weekIndex: number,
  sessionDate: Date
): WorkoutSession {
  const startHour = 17 + Math.floor(randomBetween(0, 3));
  const startMinute = Math.floor(randomBetween(0, 4)) * 15;
  const startTime = new Date(`${formatDate(sessionDate)}T${String(startHour).padStart(2, '0')}:${String(startMinute).padStart(2, '0')}:00`);
  const fatigueBias = weekIndex === 2 && template.name === 'Pull' ? 0.5 : 0;

  const sets = buildSets(template.exercises, weekIndex, startTime, fatigueBias);
  const totalVolumeLoad = sets.reduce((sum, set) => sum + (set.volumeLoad || 0), 0);
  const averageRPE = sets.length > 0
    ? sets.reduce((sum, set) => sum + (set.actualRPE || 0), 0) / sets.length
    : undefined;

  const durationMinutes = Math.round(sets.length * 3.2 + randomBetween(20, 30));
  const endTime = addMinutes(startTime, durationMinutes).toISOString();

  return {
    id: `session_${createUuid()}`,
    programId: SEED_PROGRAM_ID,
    programName: SEED_PROGRAM_NAME,
    cycleNumber: 1,
    weekNumber: weekIndex + 1,
    dayOfWeek: template.dayOfWeek,
    dayName: template.name,
    date: formatDate(sessionDate),
    startTime: startTime.toISOString(),
    endTime,
    durationMinutes,
    sets,
    totalVolumeLoad,
    averageRPE,
    sessionRPE: averageRPE ? Math.round(averageRPE) : undefined,
    bodyweight: 180 + weekIndex * 1.5,
    bodyweightUnit: 'lbs',
    notes: 'Dev seed data',
    metadata: {
      dayIndex: template.dayIndex,
    },
    createdAt: endTime,
    updatedAt: endTime,
  };
}

export function generateSeedWorkouts(weeks = 3, workoutsPerWeek = 4): WorkoutSession[] {
  const trimmedWeeks = Math.max(2, Math.min(weeks, 3));
  const trimmedWorkouts = Math.max(1, Math.min(workoutsPerWeek, WORKOUT_TEMPLATES.length));
  const templates = WORKOUT_TEMPLATES.slice(0, trimmedWorkouts);

  const today = new Date();
  const firstWeekStart = startOfWeek(addDays(today, -7 * (trimmedWeeks - 1)));

  const sessions: WorkoutSession[] = [];

  for (let weekIndex = 0; weekIndex < trimmedWeeks; weekIndex += 1) {
    templates.forEach((template, templateIndex) => {
      const offsetDays = DAY_OFFSETS[templateIndex] ?? templateIndex * 2;
      const sessionDate = addDays(firstWeekStart, weekIndex * 7 + offsetDays);
      sessions.push(buildWorkoutSession(template, weekIndex, sessionDate));
    });
  }

  return sessions;
}

const getStorageKey = (namespace: string) => `${STORAGE_KEY}__${namespace}`;

async function getLoggedInUserId(): Promise<string | null> {
  if (typeof window === 'undefined') {
    return null;
  }

  try {
    const { supabase } = await import('../app/lib/supabase/client');
    const { data } = await supabase.auth.getUser();
    return data.user?.id ?? null;
  } catch (error) {
    console.warn('Dev seed: unable to resolve logged-in user.', error);
    return null;
  }
}

export async function clearDevData(options: SeedOptions = {}): Promise<number> {
  if (typeof window === 'undefined' || typeof localStorage === 'undefined') {
    console.warn('Dev seed data can only be cleared in a browser context.');
    return 0;
  }

  const userId = options.userId ?? (await getLoggedInUserId());
  const namespace = options.namespace ?? userId ?? 'default';
  const key = getStorageKey(namespace);
  const stored = localStorage.getItem(key);

  if (!stored) {
    return 0;
  }

  const existing: WorkoutSession[] = JSON.parse(stored);
  const filtered = options.clearAll
    ? []
    : existing.filter(session => session.programId !== SEED_PROGRAM_ID);

  localStorage.setItem(key, JSON.stringify(filtered));
  return existing.length - filtered.length;
}

export async function seedDevData(options: SeedOptions = {}): Promise<SeedResult> {
  if (typeof window === 'undefined' || typeof localStorage === 'undefined') {
    console.warn('Dev seed data must be generated in a browser context.');
    return { workoutsCreated: 0, namespace: 'default', savedToSupabase: false };
  }

  const workouts = generateSeedWorkouts(options.weeks, options.workoutsPerWeek);
  const userId = options.userId ?? (await getLoggedInUserId());
  const namespace = options.namespace ?? userId ?? 'default';
  const storageKey = getStorageKey(namespace);
  const clearExisting = options.clearExisting ?? true;
  const saveToSupabase = options.saveToSupabase ?? Boolean(userId);

  if (clearExisting) {
    await clearDevData({ namespace, userId, clearAll: options.clearAll });
  }

  if (saveToSupabase && userId) {
    const { saveWorkout, setUserNamespace } = await import('../app/lib/storage');
    setUserNamespace(userId);

    for (const workout of workouts) {
      await saveWorkout(workout);
    }
  } else {
    const existing = options.append
      ? JSON.parse(localStorage.getItem(storageKey) || '[]')
      : [];
    localStorage.setItem(storageKey, JSON.stringify([...existing, ...workouts]));
  }

  console.log(`✅ Seeded ${workouts.length} workouts into ${storageKey}`);

  return {
    workoutsCreated: workouts.length,
    namespace,
    savedToSupabase: Boolean(saveToSupabase && userId),
  };
}

declare global {
  interface Window {
    seedDevData?: (options?: SeedOptions) => Promise<SeedResult>;
    clearDevData?: (options?: SeedOptions) => Promise<number>;
  }
}

if (typeof window !== 'undefined') {
  window.seedDevData = seedDevData;
  window.clearDevData = clearDevData;
  console.log('🔧 Dev seed helpers registered: window.seedDevData(), window.clearDevData()');
} else if (typeof process !== 'undefined') {
  const isDirectRun = process.argv.some((arg) => arg.includes('seed-dev-data'));
  if (isDirectRun) {
    console.log('Dev seed script loaded.');
    console.log('1) Run the app: npm run dev');
    console.log('2) Open http://localhost:3000');
    console.log('3) In DevTools console: window.seedDevData()');
    console.log('Optional: window.seedDevData({ saveToSupabase: true }) if logged in.');
    console.log('Cleanup: window.clearDevData()');
  }
}
