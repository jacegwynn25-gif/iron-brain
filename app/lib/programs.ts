import { ProgramTemplate, Exercise } from './types';

export const defaultExercises: Exercise[] = [
  // ========================================
  // BARBELL EXERCISES
  // ========================================

  // BARBELL - CHEST
  {
    id: 'bench_tng',
    name: 'Bench Press (Touch & Go)',
    type: 'compound',
    muscleGroups: ['chest', 'triceps', 'shoulders'],
    equipment: ['barbell'],
  },
  {
    id: 'bench_paused',
    name: 'Paused Bench Press',
    type: 'compound',
    muscleGroups: ['chest', 'triceps', 'shoulders'],
    equipment: ['barbell'],
  },
  {
    id: 'bench_tempo',
    name: 'Tempo Bench Press',
    type: 'compound',
    muscleGroups: ['chest', 'triceps', 'shoulders'],
    equipment: ['barbell'],
  },
  {
    id: 'bench_close_grip',
    name: 'Close-Grip Bench Press',
    type: 'compound',
    muscleGroups: ['triceps', 'chest', 'shoulders'],
    equipment: ['barbell'],
  },
  {
    id: 'bench_backoff',
    name: 'Bench Press (Backoff)',
    type: 'compound',
    muscleGroups: ['chest', 'triceps', 'shoulders'],
    equipment: ['barbell'],
  },
  {
    id: 'incline_bench',
    name: 'Incline Barbell Bench Press',
    type: 'compound',
    muscleGroups: ['chest', 'shoulders', 'triceps'],
    equipment: ['barbell'],
  },
  {
    id: 'decline_bench',
    name: 'Decline Barbell Bench Press',
    type: 'compound',
    muscleGroups: ['chest', 'triceps', 'shoulders'],
    equipment: ['barbell'],
  },

  // BARBELL - BACK
  {
    id: 'deadlift',
    name: 'Deadlift',
    type: 'compound',
    muscleGroups: ['back', 'hamstrings', 'glutes', 'lower back'],
    equipment: ['barbell'],
  },
  {
    id: 'rdl',
    name: 'Romanian Deadlift',
    type: 'compound',
    muscleGroups: ['hamstrings', 'glutes', 'lower back'],
    equipment: ['barbell'],
  },
  {
    id: 'bent_over_row',
    name: 'Bent-Over Barbell Row',
    type: 'compound',
    muscleGroups: ['back', 'lats', 'biceps', 'lower back'],
    equipment: ['barbell'],
  },
  {
    id: 'pendlay_row',
    name: 'Pendlay Row',
    type: 'compound',
    muscleGroups: ['back', 'lats', 'biceps'],
    equipment: ['barbell'],
  },
  {
    id: 'tbar_row',
    name: 'T-Bar Row',
    type: 'compound',
    muscleGroups: ['back', 'lats', 'biceps'],
    equipment: ['barbell'],
  },

  // BARBELL - SHOULDERS
  {
    id: 'ohp',
    name: 'Overhead Press',
    type: 'compound',
    muscleGroups: ['shoulders', 'triceps', 'upper back'],
    equipment: ['barbell'],
  },
  {
    id: 'push_press',
    name: 'Push Press',
    type: 'compound',
    muscleGroups: ['shoulders', 'triceps', 'quads'],
    equipment: ['barbell'],
  },
  {
    id: 'seated_ohp',
    name: 'Seated Overhead Press',
    type: 'compound',
    muscleGroups: ['shoulders', 'triceps'],
    equipment: ['barbell'],
  },
  {
    id: 'upright_row',
    name: 'Barbell Upright Row',
    type: 'compound',
    muscleGroups: ['shoulders', 'upper back'],
    equipment: ['barbell'],
  },

  // BARBELL - LEGS
  {
    id: 'squat',
    name: 'Back Squat',
    type: 'compound',
    muscleGroups: ['quads', 'glutes', 'hamstrings'],
    equipment: ['barbell'],
  },
  {
    id: 'front_squat',
    name: 'Front Squat',
    type: 'compound',
    muscleGroups: ['quads', 'glutes', 'abs'],
    equipment: ['barbell'],
  },
  {
    id: 'good_morning',
    name: 'Good Morning',
    type: 'compound',
    muscleGroups: ['hamstrings', 'glutes', 'lower back'],
    equipment: ['barbell'],
  },
  {
    id: 'hip_thrust',
    name: 'Barbell Hip Thrust',
    type: 'compound',
    muscleGroups: ['glutes', 'hamstrings'],
    equipment: ['barbell'],
  },
  {
    id: 'lunge_barbell',
    name: 'Barbell Lunge',
    type: 'compound',
    muscleGroups: ['quads', 'glutes', 'hamstrings'],
    equipment: ['barbell'],
  },

  // BARBELL - ARMS
  {
    id: 'barbell_curl',
    name: 'Barbell Curl',
    type: 'isolation',
    muscleGroups: ['biceps'],
    equipment: ['barbell'],
  },
  {
    id: 'ez_curl',
    name: 'EZ Bar Curl',
    type: 'isolation',
    muscleGroups: ['biceps'],
    equipment: ['barbell'],
  },
  {
    id: 'skull_crusher',
    name: 'Skull Crusher (Lying Tricep Extension)',
    type: 'isolation',
    muscleGroups: ['triceps'],
    equipment: ['barbell'],
  },

  // ========================================
  // DUMBBELL EXERCISES
  // ========================================

  // DUMBBELL - CHEST
  {
    id: 'db_bench_press',
    name: 'Dumbbell Bench Press',
    type: 'compound',
    muscleGroups: ['chest', 'triceps', 'shoulders'],
    equipment: ['dumbbell'],
  },
  {
    id: 'db_incline_press',
    name: 'Dumbbell Incline Press',
    type: 'compound',
    muscleGroups: ['chest', 'shoulders', 'triceps'],
    equipment: ['dumbbell'],
  },
  {
    id: 'db_fly',
    name: 'Dumbbell Fly',
    type: 'isolation',
    muscleGroups: ['chest'],
    equipment: ['dumbbell'],
  },
  {
    id: 'db_incline_fly',
    name: 'Dumbbell Incline Fly',
    type: 'isolation',
    muscleGroups: ['chest'],
    equipment: ['dumbbell'],
  },

  // DUMBBELL - BACK
  {
    id: 'db_row',
    name: 'Dumbbell Row',
    type: 'compound',
    muscleGroups: ['back', 'lats', 'biceps'],
    equipment: ['dumbbell'],
  },
  {
    id: 'db_pullover',
    name: 'Dumbbell Pullover',
    type: 'compound',
    muscleGroups: ['lats', 'chest', 'triceps'],
    equipment: ['dumbbell'],
  },

  // DUMBBELL - SHOULDERS
  {
    id: 'db_shoulder_press',
    name: 'Dumbbell Shoulder Press',
    type: 'compound',
    muscleGroups: ['shoulders', 'triceps'],
    equipment: ['dumbbell'],
  },
  {
    id: 'lateral_raise',
    name: 'Lateral Raise',
    type: 'isolation',
    muscleGroups: ['shoulders'],
    equipment: ['dumbbell'],
  },
  {
    id: 'front_raise',
    name: 'Front Raise',
    type: 'isolation',
    muscleGroups: ['shoulders'],
    equipment: ['dumbbell'],
  },
  {
    id: 'rear_delt_fly',
    name: 'Rear Delt Fly',
    type: 'isolation',
    muscleGroups: ['rear delts', 'upper back'],
    equipment: ['dumbbell'],
  },
  {
    id: 'arnold_press',
    name: 'Arnold Press',
    type: 'compound',
    muscleGroups: ['shoulders', 'triceps'],
    equipment: ['dumbbell'],
  },

  // DUMBBELL - LEGS
  {
    id: 'db_goblet_squat',
    name: 'Goblet Squat',
    type: 'compound',
    muscleGroups: ['quads', 'glutes'],
    equipment: ['dumbbell'],
  },
  {
    id: 'db_lunge',
    name: 'Dumbbell Lunge',
    type: 'compound',
    muscleGroups: ['quads', 'glutes', 'hamstrings'],
    equipment: ['dumbbell'],
  },
  {
    id: 'db_rdl',
    name: 'Dumbbell Romanian Deadlift',
    type: 'compound',
    muscleGroups: ['hamstrings', 'glutes', 'lower back'],
    equipment: ['dumbbell'],
  },
  {
    id: 'bulgarian_split_squat',
    name: 'Bulgarian Split Squat',
    type: 'compound',
    muscleGroups: ['quads', 'glutes'],
    equipment: ['dumbbell'],
  },

  // DUMBBELL - ARMS
  {
    id: 'db_curl',
    name: 'Dumbbell Curl',
    type: 'isolation',
    muscleGroups: ['biceps'],
    equipment: ['dumbbell'],
  },
  {
    id: 'bicep_curl_hammer',
    name: 'Hammer Curl',
    type: 'isolation',
    muscleGroups: ['biceps'],
    equipment: ['dumbbell'],
  },
  {
    id: 'db_concentration_curl',
    name: 'Concentration Curl',
    type: 'isolation',
    muscleGroups: ['biceps'],
    equipment: ['dumbbell'],
  },
  {
    id: 'db_tricep_kickback',
    name: 'Dumbbell Tricep Kickback',
    type: 'isolation',
    muscleGroups: ['triceps'],
    equipment: ['dumbbell'],
  },
  {
    id: 'db_overhead_extension',
    name: 'Dumbbell Overhead Extension',
    type: 'isolation',
    muscleGroups: ['triceps'],
    equipment: ['dumbbell'],
  },

  // ========================================
  // CABLE EXERCISES
  // ========================================

  // CABLE - CHEST
  {
    id: 'cable_fly',
    name: 'Cable Fly',
    type: 'isolation',
    muscleGroups: ['chest'],
    equipment: ['cable'],
  },
  {
    id: 'cable_crossover',
    name: 'Cable Crossover',
    type: 'isolation',
    muscleGroups: ['chest'],
    equipment: ['cable'],
  },

  // CABLE - BACK
  {
    id: 'lat_pulldown',
    name: 'Lat Pulldown',
    type: 'compound',
    muscleGroups: ['lats', 'biceps', 'upper back'],
    equipment: ['cable'],
  },
  {
    id: 'row_cable',
    name: 'Cable Row',
    type: 'compound',
    muscleGroups: ['upper back', 'lats', 'biceps'],
    equipment: ['cable'],
  },
  {
    id: 'cable_pullover',
    name: 'Cable Pullover',
    type: 'isolation',
    muscleGroups: ['lats', 'triceps'],
    equipment: ['cable'],
  },
  {
    id: 'face_pull',
    name: 'Face Pull',
    type: 'isolation',
    muscleGroups: ['rear delts', 'upper back'],
    equipment: ['cable'],
  },

  // CABLE - ARMS
  {
    id: 'tricep_pressdown',
    name: 'Tricep Pressdown',
    type: 'isolation',
    muscleGroups: ['triceps'],
    equipment: ['cable'],
  },
  {
    id: 'tricep_overhead_cable',
    name: 'Overhead Cable Extension',
    type: 'isolation',
    muscleGroups: ['triceps'],
    equipment: ['cable'],
  },
  {
    id: 'bicep_curl_cable',
    name: 'Cable Curl',
    type: 'isolation',
    muscleGroups: ['biceps'],
    equipment: ['cable'],
  },

  // ========================================
  // MACHINE EXERCISES
  // ========================================

  // MACHINE - CHEST
  {
    id: 'chest_press_machine',
    name: 'Machine Chest Press',
    type: 'compound',
    muscleGroups: ['chest', 'triceps', 'shoulders'],
    equipment: ['machine'],
  },
  {
    id: 'pec_deck',
    name: 'Pec Deck Fly',
    type: 'isolation',
    muscleGroups: ['chest'],
    equipment: ['machine'],
  },

  // MACHINE - BACK
  {
    id: 'row_machine',
    name: 'Machine Row',
    type: 'compound',
    muscleGroups: ['upper back', 'lats', 'biceps'],
    equipment: ['machine'],
  },
  {
    id: 'row_chest_supported',
    name: 'Chest-Supported Row',
    type: 'compound',
    muscleGroups: ['upper back', 'lats', 'biceps'],
    equipment: ['machine'],
  },
  {
    id: 'row_neutral',
    name: 'Neutral Grip Row',
    type: 'compound',
    muscleGroups: ['upper back', 'lats', 'biceps'],
    equipment: ['machine'],
  },
  {
    id: 'pulldown_neutral',
    name: 'Neutral Grip Pulldown',
    type: 'compound',
    muscleGroups: ['lats', 'biceps', 'upper back'],
    equipment: ['cable'],
  },

  // MACHINE - SHOULDERS
  {
    id: 'shoulder_press_machine',
    name: 'Machine Shoulder Press',
    type: 'compound',
    muscleGroups: ['shoulders', 'triceps'],
    equipment: ['machine'],
  },
  {
    id: 'lateral_raise_machine',
    name: 'Machine Lateral Raise',
    type: 'isolation',
    muscleGroups: ['shoulders'],
    equipment: ['machine'],
  },
  {
    id: 'rear_delt_machine',
    name: 'Machine Rear Delt Fly',
    type: 'isolation',
    muscleGroups: ['rear delts', 'upper back'],
    equipment: ['machine'],
  },

  // MACHINE - LEGS
  {
    id: 'leg_press',
    name: 'Leg Press',
    type: 'compound',
    muscleGroups: ['quads', 'glutes', 'hamstrings'],
    equipment: ['machine'],
  },
  {
    id: 'leg_extension',
    name: 'Leg Extension',
    type: 'isolation',
    muscleGroups: ['quads'],
    equipment: ['machine'],
  },
  {
    id: 'leg_curl',
    name: 'Leg Curl',
    type: 'isolation',
    muscleGroups: ['hamstrings'],
    equipment: ['machine'],
  },
  {
    id: 'smith_squat',
    name: 'Smith Machine Squat',
    type: 'compound',
    muscleGroups: ['quads', 'glutes'],
    equipment: ['machine'],
  },
  {
    id: 'hack_squat',
    name: 'Hack Squat',
    type: 'compound',
    muscleGroups: ['quads', 'glutes'],
    equipment: ['machine'],
  },
  {
    id: 'seated_calf_raise',
    name: 'Seated Calf Raise',
    type: 'isolation',
    muscleGroups: ['calves'],
    equipment: ['machine'],
  },
  {
    id: 'standing_calf_raise',
    name: 'Standing Calf Raise',
    type: 'isolation',
    muscleGroups: ['calves'],
    equipment: ['machine'],
  },

  // MACHINE - ARMS
  {
    id: 'bicep_curl_preacher',
    name: 'Machine Preacher Curl',
    type: 'isolation',
    muscleGroups: ['biceps'],
    equipment: ['machine'],
  },
  {
    id: 'tricep_dip_machine',
    name: 'Machine Tricep Dip',
    type: 'compound',
    muscleGroups: ['triceps', 'chest'],
    equipment: ['machine'],
  },

  // ========================================
  // BODYWEIGHT EXERCISES
  // ========================================

  {
    id: 'pullup',
    name: 'Pull-Up',
    type: 'compound',
    muscleGroups: ['lats', 'biceps', 'upper back'],
    equipment: ['bodyweight'],
  },
  {
    id: 'chinup',
    name: 'Chin-Up',
    type: 'compound',
    muscleGroups: ['lats', 'biceps', 'upper back'],
    equipment: ['bodyweight'],
  },
  {
    id: 'dip',
    name: 'Dip',
    type: 'compound',
    muscleGroups: ['triceps', 'chest', 'shoulders'],
    equipment: ['bodyweight'],
  },
  {
    id: 'pushup',
    name: 'Push-Up',
    type: 'compound',
    muscleGroups: ['chest', 'triceps', 'shoulders'],
    equipment: ['bodyweight'],
  },
  {
    id: 'inverted_row',
    name: 'Inverted Row',
    type: 'compound',
    muscleGroups: ['back', 'biceps'],
    equipment: ['bodyweight'],
  },

  // BODYWEIGHT - ABS/CORE
  {
    id: 'plank',
    name: 'Plank',
    type: 'isolation',
    muscleGroups: ['abs'],
    equipment: ['bodyweight'],
  },
  {
    id: 'hanging_leg_raise',
    name: 'Hanging Leg Raise',
    type: 'isolation',
    muscleGroups: ['abs'],
    equipment: ['bodyweight'],
  },
  {
    id: 'ab_wheel',
    name: 'Ab Wheel Rollout',
    type: 'isolation',
    muscleGroups: ['abs'],
    equipment: ['bodyweight'],
  },
];

const benchSpecialization5D: ProgramTemplate = {
  id: 'bench_spec_5d_v1',
  name: '5-Day Bench Specialization',
  description: '4-week bench-focused program with technique work, volume, and accessories',
  weeks: [
    // ========== WEEK 1 ==========
    {
      weekNumber: 1,
      days: [
        {
          dayOfWeek: 'Mon',
          name: 'Technique Bench + Triceps + Upper Back',
          sets: [
            { exerciseId: 'bench_tempo', setIndex: 1, prescribedReps: '5', targetRPE: 7, notes: 'tempo 3-0-0' },
            { exerciseId: 'bench_tempo', setIndex: 2, prescribedReps: '5', targetRPE: 7, notes: 'tempo 3-0-0' },
            { exerciseId: 'tricep_pressdown', setIndex: 1, prescribedReps: '10', targetRPE: 8, notes: null },
            { exerciseId: 'tricep_pressdown', setIndex: 2, prescribedReps: '10', targetRPE: 8, notes: null },
            { exerciseId: 'tricep_overhead_cable', setIndex: 1, prescribedReps: '10', targetRPE: 8, notes: null },
            { exerciseId: 'row_chest_supported', setIndex: 1, prescribedReps: '8-10', targetRPE: 7, notes: null },
            { exerciseId: 'row_chest_supported', setIndex: 2, prescribedReps: '8-10', targetRPE: 7, notes: null },
            { exerciseId: 'lateral_raise', setIndex: 1, prescribedReps: '12-15', targetRPE: 6, notes: null },
          ],
        },
        {
          dayOfWeek: 'Tue',
          name: 'Lower Body',
          sets: [
            { exerciseId: 'leg_press', setIndex: 1, prescribedReps: '4-6', targetRPE: 8, notes: null },
            { exerciseId: 'rdl', setIndex: 1, prescribedReps: '6-7', targetRPE: 7, notes: null },
            { exerciseId: 'leg_curl', setIndex: 1, prescribedReps: '8-10', targetRPE: 7, notes: null },
            { exerciseId: 'bicep_curl_preacher', setIndex: 1, prescribedReps: '8-10', targetRPE: 8.5, notes: null },
            { exerciseId: 'bicep_curl_preacher', setIndex: 2, prescribedReps: '8-10', targetRPE: 8.5, notes: null },
            { exerciseId: 'bicep_curl_cable', setIndex: 1, prescribedReps: '10-12', targetRPE: 8, notes: null },
          ],
        },
        {
          dayOfWeek: 'Wed',
          name: 'Volume Bench + Accessories',
          sets: [
            { exerciseId: 'bench_close_grip', setIndex: 1, prescribedReps: '5-6', targetRPE: 7.5, notes: null },
            { exerciseId: 'bench_close_grip', setIndex: 2, prescribedReps: '5-6', targetRPE: 7.5, notes: null },
            { exerciseId: 'bench_backoff', setIndex: 1, prescribedReps: '5', targetRPE: 7, notes: 'regular grip' },
            { exerciseId: 'shoulder_press_machine', setIndex: 1, prescribedReps: '6-8', targetRPE: 7.5, notes: null },
            { exerciseId: 'lateral_raise', setIndex: 1, prescribedReps: '12-15', targetRPE: 7, notes: null },
            { exerciseId: 'row_neutral', setIndex: 1, prescribedReps: '6-8', targetRPE: 7.5, notes: 'pulldown or row' },
            { exerciseId: 'row_neutral', setIndex: 2, prescribedReps: '6-8', targetRPE: 7.5, notes: 'pulldown or row' },
          ],
        },
        {
          dayOfWeek: 'Thu',
          name: 'Upper Back + Arms',
          sets: [
            { exerciseId: 'lat_pulldown', setIndex: 1, prescribedReps: '8-10', targetRPE: 7, notes: null },
            { exerciseId: 'lat_pulldown', setIndex: 2, prescribedReps: '8-10', targetRPE: 7, notes: null },
            { exerciseId: 'row_chest_supported', setIndex: 1, prescribedReps: '8-10', targetRPE: 7, notes: null },
            { exerciseId: 'rear_delt_fly', setIndex: 1, prescribedReps: '12-15', targetRPE: 6.5, notes: null },
            { exerciseId: 'bicep_curl_cable', setIndex: 1, prescribedReps: '10-12', targetRPE: 7, notes: 'cable or hammer' },
          ],
        },
        {
          dayOfWeek: 'Sat',
          name: 'Heavy Bench + Light Lower',
          sets: [
            { exerciseId: 'bench_tng', setIndex: 1, prescribedReps: '4', targetRPE: 8, notes: 'heavy' },
            { exerciseId: 'bench_backoff', setIndex: 1, prescribedReps: '3-4', targetRPE: 7, notes: null },
            { exerciseId: 'row_chest_supported', setIndex: 1, prescribedReps: '6-8', targetRPE: 7.5, notes: null },
            { exerciseId: 'row_chest_supported', setIndex: 2, prescribedReps: '6-8', targetRPE: 7.5, notes: null },
            { exerciseId: 'lat_pulldown', setIndex: 1, prescribedReps: '7-8', targetRPE: 7.5, notes: null },
            { exerciseId: 'lat_pulldown', setIndex: 2, prescribedReps: '7-8', targetRPE: 7.5, notes: null },
            { exerciseId: 'leg_press', setIndex: 1, prescribedReps: '5-6', targetRPE: 7, notes: 'light' },
          ],
        },
      ],
    },
    // ========== WEEK 2 ==========
    {
      weekNumber: 2,
      days: [
        {
          dayOfWeek: 'Mon',
          name: 'Technique Bench + Triceps + Upper Back',
          sets: [
            { exerciseId: 'bench_tempo', setIndex: 1, prescribedReps: '5', targetRPE: 7.5, notes: 'tempo 3-0-0' },
            { exerciseId: 'bench_tempo', setIndex: 2, prescribedReps: '5', targetRPE: 7.5, notes: 'tempo 3-0-0' },
            { exerciseId: 'tricep_pressdown', setIndex: 1, prescribedReps: '10', targetRPE: 8, notes: null },
            { exerciseId: 'tricep_pressdown', setIndex: 2, prescribedReps: '10', targetRPE: 8, notes: null },
            { exerciseId: 'tricep_overhead_cable', setIndex: 1, prescribedReps: '10', targetRPE: 8, notes: null },
            { exerciseId: 'row_chest_supported', setIndex: 1, prescribedReps: '8-10', targetRPE: 7.5, notes: null },
            { exerciseId: 'row_chest_supported', setIndex: 2, prescribedReps: '8-10', targetRPE: 7.5, notes: null },
            { exerciseId: 'lateral_raise', setIndex: 1, prescribedReps: '12-15', targetRPE: 6.5, notes: null },
          ],
        },
        {
          dayOfWeek: 'Tue',
          name: 'Lower Body',
          sets: [
            { exerciseId: 'leg_press', setIndex: 1, prescribedReps: '4-6', targetRPE: 8, notes: null },
            { exerciseId: 'rdl', setIndex: 1, prescribedReps: '6-7', targetRPE: 7.5, notes: null },
            { exerciseId: 'leg_curl', setIndex: 1, prescribedReps: '8-10', targetRPE: 7.5, notes: null },
            { exerciseId: 'bicep_curl_preacher', setIndex: 1, prescribedReps: '8-10', targetRPE: 8.5, notes: null },
            { exerciseId: 'bicep_curl_preacher', setIndex: 2, prescribedReps: '8-10', targetRPE: 8.5, notes: null },
            { exerciseId: 'bicep_curl_cable', setIndex: 1, prescribedReps: '10-12', targetRPE: 8, notes: null },
          ],
        },
        {
          dayOfWeek: 'Wed',
          name: 'Volume Bench + Accessories',
          sets: [
            { exerciseId: 'bench_close_grip', setIndex: 1, prescribedReps: '5-6', targetRPE: 8, notes: null },
            { exerciseId: 'bench_close_grip', setIndex: 2, prescribedReps: '5-6', targetRPE: 8, notes: null },
            { exerciseId: 'bench_backoff', setIndex: 1, prescribedReps: '5', targetRPE: 7.5, notes: 'regular grip' },
            { exerciseId: 'shoulder_press_machine', setIndex: 1, prescribedReps: '6-8', targetRPE: 8, notes: null },
            { exerciseId: 'lateral_raise', setIndex: 1, prescribedReps: '12-15', targetRPE: 7, notes: null },
            { exerciseId: 'row_neutral', setIndex: 1, prescribedReps: '6-8', targetRPE: 8, notes: 'pulldown or row' },
            { exerciseId: 'row_neutral', setIndex: 2, prescribedReps: '6-8', targetRPE: 8, notes: 'pulldown or row' },
          ],
        },
        {
          dayOfWeek: 'Thu',
          name: 'Upper Back + Arms',
          sets: [
            { exerciseId: 'lat_pulldown', setIndex: 1, prescribedReps: '8-10', targetRPE: 7.5, notes: null },
            { exerciseId: 'lat_pulldown', setIndex: 2, prescribedReps: '8-10', targetRPE: 7.5, notes: null },
            { exerciseId: 'row_chest_supported', setIndex: 1, prescribedReps: '8-10', targetRPE: 7, notes: null },
            { exerciseId: 'rear_delt_fly', setIndex: 1, prescribedReps: '12-15', targetRPE: 6.5, notes: null },
            { exerciseId: 'bicep_curl_cable', setIndex: 1, prescribedReps: '10-12', targetRPE: 7.5, notes: 'cable or hammer' },
          ],
        },
        {
          dayOfWeek: 'Sat',
          name: 'Heavy Bench + Light Lower',
          sets: [
            { exerciseId: 'bench_tng', setIndex: 1, prescribedReps: '4', targetRPE: 8.5, notes: 'heavy' },
            { exerciseId: 'bench_backoff', setIndex: 1, prescribedReps: '3-4', targetRPE: 7.5, notes: null },
            { exerciseId: 'row_chest_supported', setIndex: 1, prescribedReps: '6-8', targetRPE: 8, notes: null },
            { exerciseId: 'row_chest_supported', setIndex: 2, prescribedReps: '6-8', targetRPE: 8, notes: null },
            { exerciseId: 'lat_pulldown', setIndex: 1, prescribedReps: '7-8', targetRPE: 7.5, notes: null },
            { exerciseId: 'lat_pulldown', setIndex: 2, prescribedReps: '7-8', targetRPE: 7.5, notes: null },
            { exerciseId: 'leg_press', setIndex: 1, prescribedReps: '5-6', targetRPE: 7, notes: 'light' },
          ],
        },
      ],
    },
    // ========== WEEK 3 (Peak) ==========
    {
      weekNumber: 3,
      days: [
        {
          dayOfWeek: 'Mon',
          name: 'Technique Bench + Triceps + Upper Back',
          sets: [
            { exerciseId: 'bench_tempo', setIndex: 1, prescribedReps: '5', targetRPE: 8, notes: 'tempo 3-0-0' },
            { exerciseId: 'bench_tempo', setIndex: 2, prescribedReps: '5', targetRPE: 8, notes: 'tempo 3-0-0' },
            { exerciseId: 'tricep_pressdown', setIndex: 1, prescribedReps: '10', targetRPE: 8.5, notes: null },
            { exerciseId: 'tricep_pressdown', setIndex: 2, prescribedReps: '10', targetRPE: 8.5, notes: null },
            { exerciseId: 'tricep_overhead_cable', setIndex: 1, prescribedReps: '10', targetRPE: 8.5, notes: null },
            { exerciseId: 'row_chest_supported', setIndex: 1, prescribedReps: '8-10', targetRPE: 8, notes: null },
            { exerciseId: 'row_chest_supported', setIndex: 2, prescribedReps: '8-10', targetRPE: 8, notes: null },
            { exerciseId: 'lateral_raise', setIndex: 1, prescribedReps: '12-15', targetRPE: 7, notes: null },
          ],
        },
        {
          dayOfWeek: 'Tue',
          name: 'Lower Body',
          sets: [
            { exerciseId: 'leg_press', setIndex: 1, prescribedReps: '4-6', targetRPE: 8, notes: null },
            { exerciseId: 'rdl', setIndex: 1, prescribedReps: '6-7', targetRPE: 7.5, notes: null },
            { exerciseId: 'leg_curl', setIndex: 1, prescribedReps: '8-10', targetRPE: 7.5, notes: null },
            { exerciseId: 'bicep_curl_preacher', setIndex: 1, prescribedReps: '8-10', targetRPE: 8.5, notes: null },
            { exerciseId: 'bicep_curl_preacher', setIndex: 2, prescribedReps: '8-10', targetRPE: 8.5, notes: null },
            { exerciseId: 'bicep_curl_cable', setIndex: 1, prescribedReps: '10-12', targetRPE: 8, notes: null },
          ],
        },
        {
          dayOfWeek: 'Wed',
          name: 'Volume Bench + Accessories',
          sets: [
            { exerciseId: 'bench_close_grip', setIndex: 1, prescribedReps: '4-5', targetRPE: 8.5, notes: null },
            { exerciseId: 'bench_close_grip', setIndex: 2, prescribedReps: '4-5', targetRPE: 8.5, notes: null },
            { exerciseId: 'bench_backoff', setIndex: 1, prescribedReps: '4', targetRPE: 8, notes: 'regular grip' },
            { exerciseId: 'shoulder_press_machine', setIndex: 1, prescribedReps: '5-6', targetRPE: 8, notes: null },
            { exerciseId: 'lateral_raise', setIndex: 1, prescribedReps: '12-15', targetRPE: 7, notes: null },
            { exerciseId: 'row_neutral', setIndex: 1, prescribedReps: '6-8', targetRPE: 8, notes: 'pulldown or row' },
            { exerciseId: 'row_neutral', setIndex: 2, prescribedReps: '6-8', targetRPE: 8, notes: 'pulldown or row' },
          ],
        },
        {
          dayOfWeek: 'Thu',
          name: 'Upper Back + Arms',
          sets: [
            { exerciseId: 'lat_pulldown', setIndex: 1, prescribedReps: '8-10', targetRPE: 7.5, notes: null },
            { exerciseId: 'lat_pulldown', setIndex: 2, prescribedReps: '8-10', targetRPE: 8, notes: null },
            { exerciseId: 'row_chest_supported', setIndex: 1, prescribedReps: '8-10', targetRPE: 7.5, notes: null },
            { exerciseId: 'rear_delt_fly', setIndex: 1, prescribedReps: '12-15', targetRPE: 6.5, notes: null },
            { exerciseId: 'bicep_curl_cable', setIndex: 1, prescribedReps: '10-12', targetRPE: 7.5, notes: 'cable or hammer' },
          ],
        },
        {
          dayOfWeek: 'Sat',
          name: 'Heavy Bench + Light Lower',
          sets: [
            { exerciseId: 'bench_tng', setIndex: 1, prescribedReps: '4', targetRPE: 9, notes: 'heavy - peak' },
            { exerciseId: 'bench_backoff', setIndex: 1, prescribedReps: '3', targetRPE: 7.5, notes: null },
            { exerciseId: 'row_chest_supported', setIndex: 1, prescribedReps: '6-8', targetRPE: 8, notes: null },
            { exerciseId: 'row_chest_supported', setIndex: 2, prescribedReps: '6-8', targetRPE: 8, notes: null },
            { exerciseId: 'lat_pulldown', setIndex: 1, prescribedReps: '7-8', targetRPE: 7.5, notes: null },
            { exerciseId: 'lat_pulldown', setIndex: 2, prescribedReps: '7-8', targetRPE: 7.5, notes: null },
            { exerciseId: 'leg_press', setIndex: 1, prescribedReps: '5-6', targetRPE: 7, notes: 'light' },
          ],
        },
      ],
    },
    // ========== WEEK 4 (Deload) ==========
    {
      weekNumber: 4,
      days: [
        {
          dayOfWeek: 'Mon',
          name: 'Technique Bench + Triceps + Upper Back',
          sets: [
            { exerciseId: 'bench_tempo', setIndex: 1, prescribedReps: '5', targetRPE: 6.5, notes: 'tempo 3-0-0' },
            { exerciseId: 'tricep_pressdown', setIndex: 1, prescribedReps: '10', targetRPE: 6, notes: null },
            { exerciseId: 'tricep_overhead_cable', setIndex: 1, prescribedReps: '10', targetRPE: 6, notes: null },
            { exerciseId: 'row_chest_supported', setIndex: 1, prescribedReps: '8-10', targetRPE: 6, notes: null },
            { exerciseId: 'lateral_raise', setIndex: 1, prescribedReps: '12-15', targetRPE: 6, notes: null },
          ],
        },
        {
          dayOfWeek: 'Tue',
          name: 'Lower Body',
          sets: [
            { exerciseId: 'leg_press', setIndex: 1, prescribedReps: '4-6', targetRPE: 6, notes: null },
            { exerciseId: 'rdl', setIndex: 1, prescribedReps: '6-7', targetRPE: 6, notes: null },
            { exerciseId: 'leg_curl', setIndex: 1, prescribedReps: '8-10', targetRPE: 6, notes: null },
            { exerciseId: 'bicep_curl_preacher', setIndex: 1, prescribedReps: '8-10', targetRPE: 6, notes: null },
            { exerciseId: 'bicep_curl_cable', setIndex: 1, prescribedReps: '10-12', targetRPE: 6, notes: null },
          ],
        },
        {
          dayOfWeek: 'Wed',
          name: 'Volume Bench + Accessories',
          sets: [
            { exerciseId: 'bench_close_grip', setIndex: 1, prescribedReps: '5', targetRPE: 6.5, notes: null },
            { exerciseId: 'bench_backoff', setIndex: 1, prescribedReps: '4-5', targetRPE: 6, notes: 'regular grip' },
            { exerciseId: 'shoulder_press_machine', setIndex: 1, prescribedReps: '6-8', targetRPE: 6, notes: null },
            { exerciseId: 'lateral_raise', setIndex: 1, prescribedReps: '12-15', targetRPE: 6, notes: null },
            { exerciseId: 'row_neutral', setIndex: 1, prescribedReps: '6-8', targetRPE: 6, notes: 'pulldown or row' },
          ],
        },
        {
          dayOfWeek: 'Thu',
          name: 'Upper Back + Arms',
          sets: [
            { exerciseId: 'lat_pulldown', setIndex: 1, prescribedReps: '8-10', targetRPE: 6, notes: null },
            { exerciseId: 'row_chest_supported', setIndex: 1, prescribedReps: '8-10', targetRPE: 6, notes: null },
            { exerciseId: 'rear_delt_fly', setIndex: 1, prescribedReps: '12-15', targetRPE: 6, notes: null },
            { exerciseId: 'bicep_curl_cable', setIndex: 1, prescribedReps: '10-12', targetRPE: 6, notes: 'cable or hammer' },
          ],
        },
        {
          dayOfWeek: 'Sat',
          name: 'Heavy Bench + Light Lower',
          sets: [
            { exerciseId: 'bench_tng', setIndex: 1, prescribedReps: '3', targetRPE: 8, notes: 'taper' },
            { exerciseId: 'bench_backoff', setIndex: 1, prescribedReps: '2-3', targetRPE: 6.5, notes: null },
            { exerciseId: 'row_chest_supported', setIndex: 1, prescribedReps: '6-8', targetRPE: 6, notes: null },
            { exerciseId: 'row_chest_supported', setIndex: 2, prescribedReps: '6-8', targetRPE: 6, notes: null },
            { exerciseId: 'lat_pulldown', setIndex: 1, prescribedReps: '7-8', targetRPE: 6, notes: null },
            { exerciseId: 'lat_pulldown', setIndex: 2, prescribedReps: '7-8', targetRPE: 6, notes: null },
            { exerciseId: 'leg_press', setIndex: 1, prescribedReps: '5-6', targetRPE: 6, notes: 'light' },
          ],
        },
      ],
    },
  ],
};

// ========================================
// PHUL (Power Hypertrophy Upper Lower)
// ========================================

const phul4Day: ProgramTemplate = {
  id: 'phul_4day_v1',
  name: 'PHUL (Power Hypertrophy Upper Lower)',
  description: '4-day split focusing on power (strength) and hypertrophy (size) across upper/lower days',
  goal: 'hypertrophy',
  experienceLevel: 'intermediate',
  daysPerWeek: 4,
  weekCount: 12,
  intensityMethod: 'rpe',
  weeks: [
    {
      weekNumber: 1,
      days: [
        {
          dayOfWeek: 'Mon',
          name: 'Upper Power',
          sets: [
            // Bench Press - 3-4 sets of 3-5 reps
            { exerciseId: 'bench_tng', setIndex: 1, prescribedReps: '3-5', targetRPE: 8, notes: 'power focus' },
            { exerciseId: 'bench_tng', setIndex: 2, prescribedReps: '3-5', targetRPE: 8, notes: null },
            { exerciseId: 'bench_tng', setIndex: 3, prescribedReps: '3-5', targetRPE: 8, notes: null },

            // Barbell Row - 3-4 sets of 3-5 reps
            { exerciseId: 'bent_over_row', setIndex: 1, prescribedReps: '3-5', targetRPE: 8, notes: null },
            { exerciseId: 'bent_over_row', setIndex: 2, prescribedReps: '3-5', targetRPE: 8, notes: null },
            { exerciseId: 'bent_over_row', setIndex: 3, prescribedReps: '3-5', targetRPE: 8, notes: null },

            // Overhead Press - 3-4 sets of 5-8 reps
            { exerciseId: 'ohp', setIndex: 1, prescribedReps: '5-8', targetRPE: 7.5, notes: null },
            { exerciseId: 'ohp', setIndex: 2, prescribedReps: '5-8', targetRPE: 7.5, notes: null },
            { exerciseId: 'ohp', setIndex: 3, prescribedReps: '5-8', targetRPE: 7.5, notes: null },

            // Pullups - 3-4 sets of 6-10 reps
            { exerciseId: 'pullup', setIndex: 1, prescribedReps: '6-10', targetRPE: 7.5, notes: 'add weight if needed' },
            { exerciseId: 'pullup', setIndex: 2, prescribedReps: '6-10', targetRPE: 7.5, notes: null },
            { exerciseId: 'pullup', setIndex: 3, prescribedReps: '6-10', targetRPE: 7.5, notes: null },

            // Barbell Curl - 2-3 sets of 6-10 reps
            { exerciseId: 'barbell_curl', setIndex: 1, prescribedReps: '6-10', targetRPE: 7, notes: null },
            { exerciseId: 'barbell_curl', setIndex: 2, prescribedReps: '6-10', targetRPE: 7, notes: null },

            // Skull Crushers - 2-3 sets of 6-10 reps
            { exerciseId: 'skull_crusher', setIndex: 1, prescribedReps: '6-10', targetRPE: 7, notes: null },
            { exerciseId: 'skull_crusher', setIndex: 2, prescribedReps: '6-10', targetRPE: 7, notes: null },
          ],
        },
        {
          dayOfWeek: 'Tue',
          name: 'Lower Power',
          sets: [
            // Squat - 3-4 sets of 3-5 reps
            { exerciseId: 'squat', setIndex: 1, prescribedReps: '3-5', targetRPE: 8, notes: 'power focus' },
            { exerciseId: 'squat', setIndex: 2, prescribedReps: '3-5', targetRPE: 8, notes: null },
            { exerciseId: 'squat', setIndex: 3, prescribedReps: '3-5', targetRPE: 8, notes: null },

            // Deadlift - 3-4 sets of 3-5 reps
            { exerciseId: 'deadlift', setIndex: 1, prescribedReps: '3-5', targetRPE: 8, notes: null },
            { exerciseId: 'deadlift', setIndex: 2, prescribedReps: '3-5', targetRPE: 8, notes: null },
            { exerciseId: 'deadlift', setIndex: 3, prescribedReps: '3-5', targetRPE: 8, notes: null },

            // Leg Press - 3-5 sets of 10-15 reps
            { exerciseId: 'leg_press', setIndex: 1, prescribedReps: '10-15', targetRPE: 7.5, notes: null },
            { exerciseId: 'leg_press', setIndex: 2, prescribedReps: '10-15', targetRPE: 7.5, notes: null },
            { exerciseId: 'leg_press', setIndex: 3, prescribedReps: '10-15', targetRPE: 7.5, notes: null },

            // Leg Curl - 3-4 sets of 6-10 reps
            { exerciseId: 'leg_curl', setIndex: 1, prescribedReps: '6-10', targetRPE: 7.5, notes: null },
            { exerciseId: 'leg_curl', setIndex: 2, prescribedReps: '6-10', targetRPE: 7.5, notes: null },
            { exerciseId: 'leg_curl', setIndex: 3, prescribedReps: '6-10', targetRPE: 7.5, notes: null },

            // Calf Raises - 4 sets of 6-10 reps
            { exerciseId: 'standing_calf_raise', setIndex: 1, prescribedReps: '6-10', targetRPE: 7, notes: null },
            { exerciseId: 'standing_calf_raise', setIndex: 2, prescribedReps: '6-10', targetRPE: 7, notes: null },
            { exerciseId: 'standing_calf_raise', setIndex: 3, prescribedReps: '6-10', targetRPE: 7, notes: null },
            { exerciseId: 'standing_calf_raise', setIndex: 4, prescribedReps: '6-10', targetRPE: 7, notes: null },
          ],
        },
        {
          dayOfWeek: 'Thu',
          name: 'Upper Hypertrophy',
          sets: [
            // Incline Bench - 3-4 sets of 8-12 reps
            { exerciseId: 'incline_bench', setIndex: 1, prescribedReps: '8-12', targetRPE: 7.5, notes: 'hypertrophy focus' },
            { exerciseId: 'incline_bench', setIndex: 2, prescribedReps: '8-12', targetRPE: 7.5, notes: null },
            { exerciseId: 'incline_bench', setIndex: 3, prescribedReps: '8-12', targetRPE: 7.5, notes: null },

            // DB Bench Press - 3-4 sets of 8-12 reps
            { exerciseId: 'db_bench_press', setIndex: 1, prescribedReps: '8-12', targetRPE: 7.5, notes: null },
            { exerciseId: 'db_bench_press', setIndex: 2, prescribedReps: '8-12', targetRPE: 7.5, notes: null },
            { exerciseId: 'db_bench_press', setIndex: 3, prescribedReps: '8-12', targetRPE: 7.5, notes: null },

            // Lat Pulldown - 3-4 sets of 8-12 reps
            { exerciseId: 'lat_pulldown', setIndex: 1, prescribedReps: '8-12', targetRPE: 7.5, notes: null },
            { exerciseId: 'lat_pulldown', setIndex: 2, prescribedReps: '8-12', targetRPE: 7.5, notes: null },
            { exerciseId: 'lat_pulldown', setIndex: 3, prescribedReps: '8-12', targetRPE: 7.5, notes: null },

            // Cable Row - 3-4 sets of 8-12 reps
            { exerciseId: 'row_cable', setIndex: 1, prescribedReps: '8-12', targetRPE: 7.5, notes: null },
            { exerciseId: 'row_cable', setIndex: 2, prescribedReps: '8-12', targetRPE: 7.5, notes: null },
            { exerciseId: 'row_cable', setIndex: 3, prescribedReps: '8-12', targetRPE: 7.5, notes: null },

            // DB Shoulder Press - 3-4 sets of 8-12 reps
            { exerciseId: 'db_shoulder_press', setIndex: 1, prescribedReps: '8-12', targetRPE: 7.5, notes: null },
            { exerciseId: 'db_shoulder_press', setIndex: 2, prescribedReps: '8-12', targetRPE: 7.5, notes: null },
            { exerciseId: 'db_shoulder_press', setIndex: 3, prescribedReps: '8-12', targetRPE: 7.5, notes: null },

            // Lateral Raises - 3-4 sets of 10-15 reps
            { exerciseId: 'lateral_raise', setIndex: 1, prescribedReps: '10-15', targetRPE: 7, notes: null },
            { exerciseId: 'lateral_raise', setIndex: 2, prescribedReps: '10-15', targetRPE: 7, notes: null },
            { exerciseId: 'lateral_raise', setIndex: 3, prescribedReps: '10-15', targetRPE: 7, notes: null },

            // Tricep Pressdown - 3-4 sets of 10-15 reps
            { exerciseId: 'tricep_pressdown', setIndex: 1, prescribedReps: '10-15', targetRPE: 7, notes: null },
            { exerciseId: 'tricep_pressdown', setIndex: 2, prescribedReps: '10-15', targetRPE: 7, notes: null },
            { exerciseId: 'tricep_pressdown', setIndex: 3, prescribedReps: '10-15', targetRPE: 7, notes: null },

            // DB Curl - 3-4 sets of 10-15 reps
            { exerciseId: 'db_curl', setIndex: 1, prescribedReps: '10-15', targetRPE: 7, notes: null },
            { exerciseId: 'db_curl', setIndex: 2, prescribedReps: '10-15', targetRPE: 7, notes: null },
            { exerciseId: 'db_curl', setIndex: 3, prescribedReps: '10-15', targetRPE: 7, notes: null },
          ],
        },
        {
          dayOfWeek: 'Fri',
          name: 'Lower Hypertrophy',
          sets: [
            // Front Squat - 3-4 sets of 8-12 reps
            { exerciseId: 'front_squat', setIndex: 1, prescribedReps: '8-12', targetRPE: 7.5, notes: 'hypertrophy focus' },
            { exerciseId: 'front_squat', setIndex: 2, prescribedReps: '8-12', targetRPE: 7.5, notes: null },
            { exerciseId: 'front_squat', setIndex: 3, prescribedReps: '8-12', targetRPE: 7.5, notes: null },

            // Romanian Deadlift - 3-4 sets of 8-12 reps
            { exerciseId: 'rdl', setIndex: 1, prescribedReps: '8-12', targetRPE: 7.5, notes: null },
            { exerciseId: 'rdl', setIndex: 2, prescribedReps: '8-12', targetRPE: 7.5, notes: null },
            { exerciseId: 'rdl', setIndex: 3, prescribedReps: '8-12', targetRPE: 7.5, notes: null },

            // Hack Squat - 3-4 sets of 8-12 reps
            { exerciseId: 'hack_squat', setIndex: 1, prescribedReps: '8-12', targetRPE: 7.5, notes: null },
            { exerciseId: 'hack_squat', setIndex: 2, prescribedReps: '8-12', targetRPE: 7.5, notes: null },
            { exerciseId: 'hack_squat', setIndex: 3, prescribedReps: '8-12', targetRPE: 7.5, notes: null },

            // Leg Curl - 3-4 sets of 10-15 reps
            { exerciseId: 'leg_curl', setIndex: 1, prescribedReps: '10-15', targetRPE: 7, notes: null },
            { exerciseId: 'leg_curl', setIndex: 2, prescribedReps: '10-15', targetRPE: 7, notes: null },
            { exerciseId: 'leg_curl', setIndex: 3, prescribedReps: '10-15', targetRPE: 7, notes: null },

            // Leg Extension - 3-4 sets of 10-15 reps
            { exerciseId: 'leg_extension', setIndex: 1, prescribedReps: '10-15', targetRPE: 7, notes: null },
            { exerciseId: 'leg_extension', setIndex: 2, prescribedReps: '10-15', targetRPE: 7, notes: null },
            { exerciseId: 'leg_extension', setIndex: 3, prescribedReps: '10-15', targetRPE: 7, notes: null },

            // Seated Calf Raises - 4 sets of 10-15 reps
            { exerciseId: 'seated_calf_raise', setIndex: 1, prescribedReps: '10-15', targetRPE: 7, notes: null },
            { exerciseId: 'seated_calf_raise', setIndex: 2, prescribedReps: '10-15', targetRPE: 7, notes: null },
            { exerciseId: 'seated_calf_raise', setIndex: 3, prescribedReps: '10-15', targetRPE: 7, notes: null },
            { exerciseId: 'seated_calf_raise', setIndex: 4, prescribedReps: '10-15', targetRPE: 7, notes: null },
          ],
        },
      ],
    },
  ],
};

// ========================================
// Upper/Lower 4-Day Split
// ========================================

const upperLower4Day: ProgramTemplate = {
  id: 'upper_lower_4day_v1',
  name: 'Upper/Lower 4-Day Split',
  description: 'Classic 4-day upper/lower split for balanced strength and size gains',
  goal: 'general',
  experienceLevel: 'intermediate',
  daysPerWeek: 4,
  weekCount: 12,
  intensityMethod: 'rpe',
  weeks: [
    {
      weekNumber: 1,
      days: [
        {
          dayOfWeek: 'Mon',
          name: 'Upper A',
          sets: [
            { exerciseId: 'bench_tng', setIndex: 1, prescribedReps: '6-8', targetRPE: 7.5, notes: null },
            { exerciseId: 'bench_tng', setIndex: 2, prescribedReps: '6-8', targetRPE: 7.5, notes: null },
            { exerciseId: 'bench_tng', setIndex: 3, prescribedReps: '6-8', targetRPE: 7.5, notes: null },
            { exerciseId: 'bench_tng', setIndex: 4, prescribedReps: '6-8', targetRPE: 7.5, notes: null },

            { exerciseId: 'bent_over_row', setIndex: 1, prescribedReps: '6-8', targetRPE: 7.5, notes: null },
            { exerciseId: 'bent_over_row', setIndex: 2, prescribedReps: '6-8', targetRPE: 7.5, notes: null },
            { exerciseId: 'bent_over_row', setIndex: 3, prescribedReps: '6-8', targetRPE: 7.5, notes: null },
            { exerciseId: 'bent_over_row', setIndex: 4, prescribedReps: '6-8', targetRPE: 7.5, notes: null },

            { exerciseId: 'db_shoulder_press', setIndex: 1, prescribedReps: '8-10', targetRPE: 7.5, notes: null },
            { exerciseId: 'db_shoulder_press', setIndex: 2, prescribedReps: '8-10', targetRPE: 7.5, notes: null },
            { exerciseId: 'db_shoulder_press', setIndex: 3, prescribedReps: '8-10', targetRPE: 7.5, notes: null },

            { exerciseId: 'lat_pulldown', setIndex: 1, prescribedReps: '8-10', targetRPE: 7, notes: null },
            { exerciseId: 'lat_pulldown', setIndex: 2, prescribedReps: '8-10', targetRPE: 7, notes: null },
            { exerciseId: 'lat_pulldown', setIndex: 3, prescribedReps: '8-10', targetRPE: 7, notes: null },

            { exerciseId: 'ez_curl', setIndex: 1, prescribedReps: '10-12', targetRPE: 7, notes: null },
            { exerciseId: 'ez_curl', setIndex: 2, prescribedReps: '10-12', targetRPE: 7, notes: null },

            { exerciseId: 'tricep_pressdown', setIndex: 1, prescribedReps: '10-12', targetRPE: 7, notes: null },
            { exerciseId: 'tricep_pressdown', setIndex: 2, prescribedReps: '10-12', targetRPE: 7, notes: null },
          ],
        },
        {
          dayOfWeek: 'Tue',
          name: 'Lower A',
          sets: [
            { exerciseId: 'squat', setIndex: 1, prescribedReps: '6-8', targetRPE: 7.5, notes: null },
            { exerciseId: 'squat', setIndex: 2, prescribedReps: '6-8', targetRPE: 7.5, notes: null },
            { exerciseId: 'squat', setIndex: 3, prescribedReps: '6-8', targetRPE: 7.5, notes: null },
            { exerciseId: 'squat', setIndex: 4, prescribedReps: '6-8', targetRPE: 7.5, notes: null },

            { exerciseId: 'rdl', setIndex: 1, prescribedReps: '8-10', targetRPE: 7.5, notes: null },
            { exerciseId: 'rdl', setIndex: 2, prescribedReps: '8-10', targetRPE: 7.5, notes: null },
            { exerciseId: 'rdl', setIndex: 3, prescribedReps: '8-10', targetRPE: 7.5, notes: null },

            { exerciseId: 'leg_press', setIndex: 1, prescribedReps: '10-12', targetRPE: 7, notes: null },
            { exerciseId: 'leg_press', setIndex: 2, prescribedReps: '10-12', targetRPE: 7, notes: null },
            { exerciseId: 'leg_press', setIndex: 3, prescribedReps: '10-12', targetRPE: 7, notes: null },

            { exerciseId: 'leg_curl', setIndex: 1, prescribedReps: '10-12', targetRPE: 7, notes: null },
            { exerciseId: 'leg_curl', setIndex: 2, prescribedReps: '10-12', targetRPE: 7, notes: null },
            { exerciseId: 'leg_curl', setIndex: 3, prescribedReps: '10-12', targetRPE: 7, notes: null },

            { exerciseId: 'standing_calf_raise', setIndex: 1, prescribedReps: '12-15', targetRPE: 7, notes: null },
            { exerciseId: 'standing_calf_raise', setIndex: 2, prescribedReps: '12-15', targetRPE: 7, notes: null },
            { exerciseId: 'standing_calf_raise', setIndex: 3, prescribedReps: '12-15', targetRPE: 7, notes: null },
          ],
        },
        {
          dayOfWeek: 'Thu',
          name: 'Upper B',
          sets: [
            { exerciseId: 'ohp', setIndex: 1, prescribedReps: '6-8', targetRPE: 7.5, notes: null },
            { exerciseId: 'ohp', setIndex: 2, prescribedReps: '6-8', targetRPE: 7.5, notes: null },
            { exerciseId: 'ohp', setIndex: 3, prescribedReps: '6-8', targetRPE: 7.5, notes: null },
            { exerciseId: 'ohp', setIndex: 4, prescribedReps: '6-8', targetRPE: 7.5, notes: null },

            { exerciseId: 'pullup', setIndex: 1, prescribedReps: '6-10', targetRPE: 7.5, notes: 'add weight if needed' },
            { exerciseId: 'pullup', setIndex: 2, prescribedReps: '6-10', targetRPE: 7.5, notes: null },
            { exerciseId: 'pullup', setIndex: 3, prescribedReps: '6-10', targetRPE: 7.5, notes: null },
            { exerciseId: 'pullup', setIndex: 4, prescribedReps: '6-10', targetRPE: 7.5, notes: null },

            { exerciseId: 'db_incline_press', setIndex: 1, prescribedReps: '8-10', targetRPE: 7.5, notes: null },
            { exerciseId: 'db_incline_press', setIndex: 2, prescribedReps: '8-10', targetRPE: 7.5, notes: null },
            { exerciseId: 'db_incline_press', setIndex: 3, prescribedReps: '8-10', targetRPE: 7.5, notes: null },

            { exerciseId: 'row_cable', setIndex: 1, prescribedReps: '8-10', targetRPE: 7, notes: null },
            { exerciseId: 'row_cable', setIndex: 2, prescribedReps: '8-10', targetRPE: 7, notes: null },
            { exerciseId: 'row_cable', setIndex: 3, prescribedReps: '8-10', targetRPE: 7, notes: null },

            { exerciseId: 'lateral_raise', setIndex: 1, prescribedReps: '12-15', targetRPE: 7, notes: null },
            { exerciseId: 'lateral_raise', setIndex: 2, prescribedReps: '12-15', targetRPE: 7, notes: null },
            { exerciseId: 'lateral_raise', setIndex: 3, prescribedReps: '12-15', targetRPE: 7, notes: null },

            { exerciseId: 'hammer_curl', setIndex: 1, prescribedReps: '10-12', targetRPE: 7, notes: null },
            { exerciseId: 'bicep_curl_hammer', setIndex: 2, prescribedReps: '10-12', targetRPE: 7, notes: null },

            { exerciseId: 'db_overhead_extension', setIndex: 1, prescribedReps: '10-12', targetRPE: 7, notes: null },
            { exerciseId: 'db_overhead_extension', setIndex: 2, prescribedReps: '10-12', targetRPE: 7, notes: null },
          ],
        },
        {
          dayOfWeek: 'Fri',
          name: 'Lower B',
          sets: [
            { exerciseId: 'deadlift', setIndex: 1, prescribedReps: '5-6', targetRPE: 7.5, notes: null },
            { exerciseId: 'deadlift', setIndex: 2, prescribedReps: '5-6', targetRPE: 7.5, notes: null },
            { exerciseId: 'deadlift', setIndex: 3, prescribedReps: '5-6', targetRPE: 7.5, notes: null },

            { exerciseId: 'front_squat', setIndex: 1, prescribedReps: '8-10', targetRPE: 7.5, notes: null },
            { exerciseId: 'front_squat', setIndex: 2, prescribedReps: '8-10', targetRPE: 7.5, notes: null },
            { exerciseId: 'front_squat', setIndex: 3, prescribedReps: '8-10', targetRPE: 7.5, notes: null },

            { exerciseId: 'bulgarian_split_squat', setIndex: 1, prescribedReps: '10-12', targetRPE: 7, notes: 'per leg' },
            { exerciseId: 'bulgarian_split_squat', setIndex: 2, prescribedReps: '10-12', targetRPE: 7, notes: 'per leg' },
            { exerciseId: 'bulgarian_split_squat', setIndex: 3, prescribedReps: '10-12', targetRPE: 7, notes: 'per leg' },

            { exerciseId: 'leg_extension', setIndex: 1, prescribedReps: '12-15', targetRPE: 7, notes: null },
            { exerciseId: 'leg_extension', setIndex: 2, prescribedReps: '12-15', targetRPE: 7, notes: null },
            { exerciseId: 'leg_extension', setIndex: 3, prescribedReps: '12-15', targetRPE: 7, notes: null },

            { exerciseId: 'seated_calf_raise', setIndex: 1, prescribedReps: '12-15', targetRPE: 7, notes: null },
            { exerciseId: 'seated_calf_raise', setIndex: 2, prescribedReps: '12-15', targetRPE: 7, notes: null },
            { exerciseId: 'seated_calf_raise', setIndex: 3, prescribedReps: '12-15', targetRPE: 7, notes: null },
          ],
        },
      ],
    },
  ],
};

// ========================================
// WENDLER 5/3/1 (4-Week Cycle)
// ========================================

const wendler531: ProgramTemplate = {
  id: 'wendler_531_v1',
  name: 'Wendler 5/3/1',
  description: 'Classic 4-week cycle featuring the big 4 lifts with 5/3/1 progression and BBB assistance work',
  goal: 'strength',
  experienceLevel: 'intermediate',
  daysPerWeek: 4,
  weekCount: 4,
  intensityMethod: 'rpe',
  weeks: [
    // ========== WEEK 1: 5s Week ==========
    {
      weekNumber: 1,
      days: [
        {
          dayOfWeek: 'Mon',
          name: 'Squat Day (5s)',
          sets: [
            // Main work: 5/5/5+ @ 65%/75%/85%
            { exerciseId: 'squat', setIndex: 1, prescribedReps: '5', targetRPE: 6, notes: '~65% warmup' },
            { exerciseId: 'squat', setIndex: 2, prescribedReps: '5', targetRPE: 7, notes: '~75%' },
            { exerciseId: 'squat', setIndex: 3, prescribedReps: '5+', targetRPE: 8, notes: '~85% AMRAP' },

            // BBB: 5x10 @ 50%
            { exerciseId: 'squat', setIndex: 4, prescribedReps: '10', targetRPE: 5, notes: 'BBB ~50%' },
            { exerciseId: 'squat', setIndex: 5, prescribedReps: '10', targetRPE: 5, notes: 'BBB ~50%' },
            { exerciseId: 'squat', setIndex: 6, prescribedReps: '10', targetRPE: 5, notes: 'BBB ~50%' },
            { exerciseId: 'squat', setIndex: 7, prescribedReps: '10', targetRPE: 5, notes: 'BBB ~50%' },
            { exerciseId: 'squat', setIndex: 8, prescribedReps: '10', targetRPE: 5, notes: 'BBB ~50%' },

            // Accessories
            { exerciseId: 'leg_curl', setIndex: 1, prescribedReps: '10-15', targetRPE: 7, notes: null },
            { exerciseId: 'leg_curl', setIndex: 2, prescribedReps: '10-15', targetRPE: 7, notes: null },
            { exerciseId: 'leg_curl', setIndex: 3, prescribedReps: '10-15', targetRPE: 7, notes: null },

            { exerciseId: 'ab_wheel', setIndex: 1, prescribedReps: '10-15', targetRPE: 7, notes: null },
            { exerciseId: 'ab_wheel', setIndex: 2, prescribedReps: '10-15', targetRPE: 7, notes: null },
          ],
        },
        {
          dayOfWeek: 'Tue',
          name: 'Bench Day (5s)',
          sets: [
            // Main work: 5/5/5+ @ 65%/75%/85%
            { exerciseId: 'bench_tng', setIndex: 1, prescribedReps: '5', targetRPE: 6, notes: '~65% warmup' },
            { exerciseId: 'bench_tng', setIndex: 2, prescribedReps: '5', targetRPE: 7, notes: '~75%' },
            { exerciseId: 'bench_tng', setIndex: 3, prescribedReps: '5+', targetRPE: 8, notes: '~85% AMRAP' },

            // BBB: 5x10 @ 50%
            { exerciseId: 'bench_tng', setIndex: 4, prescribedReps: '10', targetRPE: 5, notes: 'BBB ~50%' },
            { exerciseId: 'bench_tng', setIndex: 5, prescribedReps: '10', targetRPE: 5, notes: 'BBB ~50%' },
            { exerciseId: 'bench_tng', setIndex: 6, prescribedReps: '10', targetRPE: 5, notes: 'BBB ~50%' },
            { exerciseId: 'bench_tng', setIndex: 7, prescribedReps: '10', targetRPE: 5, notes: 'BBB ~50%' },
            { exerciseId: 'bench_tng', setIndex: 8, prescribedReps: '10', targetRPE: 5, notes: 'BBB ~50%' },

            // Accessories
            { exerciseId: 'db_row', setIndex: 1, prescribedReps: '10-15', targetRPE: 7, notes: null },
            { exerciseId: 'db_row', setIndex: 2, prescribedReps: '10-15', targetRPE: 7, notes: null },
            { exerciseId: 'db_row', setIndex: 3, prescribedReps: '10-15', targetRPE: 7, notes: null },

            { exerciseId: 'face_pull', setIndex: 1, prescribedReps: '15-20', targetRPE: 6, notes: null },
            { exerciseId: 'face_pull', setIndex: 2, prescribedReps: '15-20', targetRPE: 6, notes: null },
          ],
        },
        {
          dayOfWeek: 'Thu',
          name: 'Deadlift Day (5s)',
          sets: [
            // Main work: 5/5/5+ @ 65%/75%/85%
            { exerciseId: 'deadlift', setIndex: 1, prescribedReps: '5', targetRPE: 6, notes: '~65% warmup' },
            { exerciseId: 'deadlift', setIndex: 2, prescribedReps: '5', targetRPE: 7, notes: '~75%' },
            { exerciseId: 'deadlift', setIndex: 3, prescribedReps: '5+', targetRPE: 8, notes: '~85% AMRAP' },

            // BBB: 5x10 @ 50%
            { exerciseId: 'deadlift', setIndex: 4, prescribedReps: '10', targetRPE: 5, notes: 'BBB ~50%' },
            { exerciseId: 'deadlift', setIndex: 5, prescribedReps: '10', targetRPE: 5, notes: 'BBB ~50%' },
            { exerciseId: 'deadlift', setIndex: 6, prescribedReps: '10', targetRPE: 5, notes: 'BBB ~50%' },
            { exerciseId: 'deadlift', setIndex: 7, prescribedReps: '10', targetRPE: 5, notes: 'BBB ~50%' },
            { exerciseId: 'deadlift', setIndex: 8, prescribedReps: '10', targetRPE: 5, notes: 'BBB ~50%' },

            // Accessories
            { exerciseId: 'hanging_leg_raise', setIndex: 1, prescribedReps: '10-15', targetRPE: 7, notes: null },
            { exerciseId: 'hanging_leg_raise', setIndex: 2, prescribedReps: '10-15', targetRPE: 7, notes: null },
            { exerciseId: 'hanging_leg_raise', setIndex: 3, prescribedReps: '10-15', targetRPE: 7, notes: null },
          ],
        },
        {
          dayOfWeek: 'Fri',
          name: 'OHP Day (5s)',
          sets: [
            // Main work: 5/5/5+ @ 65%/75%/85%
            { exerciseId: 'ohp', setIndex: 1, prescribedReps: '5', targetRPE: 6, notes: '~65% warmup' },
            { exerciseId: 'ohp', setIndex: 2, prescribedReps: '5', targetRPE: 7, notes: '~75%' },
            { exerciseId: 'ohp', setIndex: 3, prescribedReps: '5+', targetRPE: 8, notes: '~85% AMRAP' },

            // BBB: 5x10 @ 50%
            { exerciseId: 'ohp', setIndex: 4, prescribedReps: '10', targetRPE: 5, notes: 'BBB ~50%' },
            { exerciseId: 'ohp', setIndex: 5, prescribedReps: '10', targetRPE: 5, notes: 'BBB ~50%' },
            { exerciseId: 'ohp', setIndex: 6, prescribedReps: '10', targetRPE: 5, notes: 'BBB ~50%' },
            { exerciseId: 'ohp', setIndex: 7, prescribedReps: '10', targetRPE: 5, notes: 'BBB ~50%' },
            { exerciseId: 'ohp', setIndex: 8, prescribedReps: '10', targetRPE: 5, notes: 'BBB ~50%' },

            // Accessories
            { exerciseId: 'lat_pulldown', setIndex: 1, prescribedReps: '10-15', targetRPE: 7, notes: null },
            { exerciseId: 'lat_pulldown', setIndex: 2, prescribedReps: '10-15', targetRPE: 7, notes: null },
            { exerciseId: 'lat_pulldown', setIndex: 3, prescribedReps: '10-15', targetRPE: 7, notes: null },

            { exerciseId: 'lateral_raise', setIndex: 1, prescribedReps: '15-20', targetRPE: 6, notes: null },
            { exerciseId: 'lateral_raise', setIndex: 2, prescribedReps: '15-20', targetRPE: 6, notes: null },
          ],
        },
      ],
    },
    // ========== WEEK 2: 3s Week ==========
    {
      weekNumber: 2,
      days: [
        {
          dayOfWeek: 'Mon',
          name: 'Squat Day (3s)',
          sets: [
            // Main work: 3/3/3+ @ 70%/80%/90%
            { exerciseId: 'squat', setIndex: 1, prescribedReps: '3', targetRPE: 6.5, notes: '~70% warmup' },
            { exerciseId: 'squat', setIndex: 2, prescribedReps: '3', targetRPE: 7.5, notes: '~80%' },
            { exerciseId: 'squat', setIndex: 3, prescribedReps: '3+', targetRPE: 8.5, notes: '~90% AMRAP' },

            // BBB: 5x10 @ 50%
            { exerciseId: 'squat', setIndex: 4, prescribedReps: '10', targetRPE: 5, notes: 'BBB ~50%' },
            { exerciseId: 'squat', setIndex: 5, prescribedReps: '10', targetRPE: 5, notes: 'BBB ~50%' },
            { exerciseId: 'squat', setIndex: 6, prescribedReps: '10', targetRPE: 5, notes: 'BBB ~50%' },
            { exerciseId: 'squat', setIndex: 7, prescribedReps: '10', targetRPE: 5, notes: 'BBB ~50%' },
            { exerciseId: 'squat', setIndex: 8, prescribedReps: '10', targetRPE: 5, notes: 'BBB ~50%' },

            // Accessories
            { exerciseId: 'leg_curl', setIndex: 1, prescribedReps: '10-15', targetRPE: 7, notes: null },
            { exerciseId: 'leg_curl', setIndex: 2, prescribedReps: '10-15', targetRPE: 7, notes: null },
            { exerciseId: 'leg_curl', setIndex: 3, prescribedReps: '10-15', targetRPE: 7, notes: null },

            { exerciseId: 'ab_wheel', setIndex: 1, prescribedReps: '10-15', targetRPE: 7, notes: null },
            { exerciseId: 'ab_wheel', setIndex: 2, prescribedReps: '10-15', targetRPE: 7, notes: null },
          ],
        },
        {
          dayOfWeek: 'Tue',
          name: 'Bench Day (3s)',
          sets: [
            // Main work: 3/3/3+ @ 70%/80%/90%
            { exerciseId: 'bench_tng', setIndex: 1, prescribedReps: '3', targetRPE: 6.5, notes: '~70% warmup' },
            { exerciseId: 'bench_tng', setIndex: 2, prescribedReps: '3', targetRPE: 7.5, notes: '~80%' },
            { exerciseId: 'bench_tng', setIndex: 3, prescribedReps: '3+', targetRPE: 8.5, notes: '~90% AMRAP' },

            // BBB: 5x10 @ 50%
            { exerciseId: 'bench_tng', setIndex: 4, prescribedReps: '10', targetRPE: 5, notes: 'BBB ~50%' },
            { exerciseId: 'bench_tng', setIndex: 5, prescribedReps: '10', targetRPE: 5, notes: 'BBB ~50%' },
            { exerciseId: 'bench_tng', setIndex: 6, prescribedReps: '10', targetRPE: 5, notes: 'BBB ~50%' },
            { exerciseId: 'bench_tng', setIndex: 7, prescribedReps: '10', targetRPE: 5, notes: 'BBB ~50%' },
            { exerciseId: 'bench_tng', setIndex: 8, prescribedReps: '10', targetRPE: 5, notes: 'BBB ~50%' },

            // Accessories
            { exerciseId: 'db_row', setIndex: 1, prescribedReps: '10-15', targetRPE: 7, notes: null },
            { exerciseId: 'db_row', setIndex: 2, prescribedReps: '10-15', targetRPE: 7, notes: null },
            { exerciseId: 'db_row', setIndex: 3, prescribedReps: '10-15', targetRPE: 7, notes: null },

            { exerciseId: 'face_pull', setIndex: 1, prescribedReps: '15-20', targetRPE: 6, notes: null },
            { exerciseId: 'face_pull', setIndex: 2, prescribedReps: '15-20', targetRPE: 6, notes: null },
          ],
        },
        {
          dayOfWeek: 'Thu',
          name: 'Deadlift Day (3s)',
          sets: [
            // Main work: 3/3/3+ @ 70%/80%/90%
            { exerciseId: 'deadlift', setIndex: 1, prescribedReps: '3', targetRPE: 6.5, notes: '~70% warmup' },
            { exerciseId: 'deadlift', setIndex: 2, prescribedReps: '3', targetRPE: 7.5, notes: '~80%' },
            { exerciseId: 'deadlift', setIndex: 3, prescribedReps: '3+', targetRPE: 8.5, notes: '~90% AMRAP' },

            // BBB: 5x10 @ 50%
            { exerciseId: 'deadlift', setIndex: 4, prescribedReps: '10', targetRPE: 5, notes: 'BBB ~50%' },
            { exerciseId: 'deadlift', setIndex: 5, prescribedReps: '10', targetRPE: 5, notes: 'BBB ~50%' },
            { exerciseId: 'deadlift', setIndex: 6, prescribedReps: '10', targetRPE: 5, notes: 'BBB ~50%' },
            { exerciseId: 'deadlift', setIndex: 7, prescribedReps: '10', targetRPE: 5, notes: 'BBB ~50%' },
            { exerciseId: 'deadlift', setIndex: 8, prescribedReps: '10', targetRPE: 5, notes: 'BBB ~50%' },

            // Accessories
            { exerciseId: 'hanging_leg_raise', setIndex: 1, prescribedReps: '10-15', targetRPE: 7, notes: null },
            { exerciseId: 'hanging_leg_raise', setIndex: 2, prescribedReps: '10-15', targetRPE: 7, notes: null },
            { exerciseId: 'hanging_leg_raise', setIndex: 3, prescribedReps: '10-15', targetRPE: 7, notes: null },
          ],
        },
        {
          dayOfWeek: 'Fri',
          name: 'OHP Day (3s)',
          sets: [
            // Main work: 3/3/3+ @ 70%/80%/90%
            { exerciseId: 'ohp', setIndex: 1, prescribedReps: '3', targetRPE: 6.5, notes: '~70% warmup' },
            { exerciseId: 'ohp', setIndex: 2, prescribedReps: '3', targetRPE: 7.5, notes: '~80%' },
            { exerciseId: 'ohp', setIndex: 3, prescribedReps: '3+', targetRPE: 8.5, notes: '~90% AMRAP' },

            // BBB: 5x10 @ 50%
            { exerciseId: 'ohp', setIndex: 4, prescribedReps: '10', targetRPE: 5, notes: 'BBB ~50%' },
            { exerciseId: 'ohp', setIndex: 5, prescribedReps: '10', targetRPE: 5, notes: 'BBB ~50%' },
            { exerciseId: 'ohp', setIndex: 6, prescribedReps: '10', targetRPE: 5, notes: 'BBB ~50%' },
            { exerciseId: 'ohp', setIndex: 7, prescribedReps: '10', targetRPE: 5, notes: 'BBB ~50%' },
            { exerciseId: 'ohp', setIndex: 8, prescribedReps: '10', targetRPE: 5, notes: 'BBB ~50%' },

            // Accessories
            { exerciseId: 'lat_pulldown', setIndex: 1, prescribedReps: '10-15', targetRPE: 7, notes: null },
            { exerciseId: 'lat_pulldown', setIndex: 2, prescribedReps: '10-15', targetRPE: 7, notes: null },
            { exerciseId: 'lat_pulldown', setIndex: 3, prescribedReps: '10-15', targetRPE: 7, notes: null },

            { exerciseId: 'lateral_raise', setIndex: 1, prescribedReps: '15-20', targetRPE: 6, notes: null },
            { exerciseId: 'lateral_raise', setIndex: 2, prescribedReps: '15-20', targetRPE: 6, notes: null },
          ],
        },
      ],
    },
    // ========== WEEK 3: 5/3/1 Week ==========
    {
      weekNumber: 3,
      days: [
        {
          dayOfWeek: 'Mon',
          name: 'Squat Day (5/3/1)',
          sets: [
            // Main work: 5/3/1+ @ 75%/85%/95%
            { exerciseId: 'squat', setIndex: 1, prescribedReps: '5', targetRPE: 7, notes: '~75%' },
            { exerciseId: 'squat', setIndex: 2, prescribedReps: '3', targetRPE: 8, notes: '~85%' },
            { exerciseId: 'squat', setIndex: 3, prescribedReps: '1+', targetRPE: 9, notes: '~95% AMRAP' },

            // BBB: 5x10 @ 50%
            { exerciseId: 'squat', setIndex: 4, prescribedReps: '10', targetRPE: 5, notes: 'BBB ~50%' },
            { exerciseId: 'squat', setIndex: 5, prescribedReps: '10', targetRPE: 5, notes: 'BBB ~50%' },
            { exerciseId: 'squat', setIndex: 6, prescribedReps: '10', targetRPE: 5, notes: 'BBB ~50%' },
            { exerciseId: 'squat', setIndex: 7, prescribedReps: '10', targetRPE: 5, notes: 'BBB ~50%' },
            { exerciseId: 'squat', setIndex: 8, prescribedReps: '10', targetRPE: 5, notes: 'BBB ~50%' },

            // Accessories
            { exerciseId: 'leg_curl', setIndex: 1, prescribedReps: '10-15', targetRPE: 7, notes: null },
            { exerciseId: 'leg_curl', setIndex: 2, prescribedReps: '10-15', targetRPE: 7, notes: null },
            { exerciseId: 'leg_curl', setIndex: 3, prescribedReps: '10-15', targetRPE: 7, notes: null },

            { exerciseId: 'ab_wheel', setIndex: 1, prescribedReps: '10-15', targetRPE: 7, notes: null },
            { exerciseId: 'ab_wheel', setIndex: 2, prescribedReps: '10-15', targetRPE: 7, notes: null },
          ],
        },
        {
          dayOfWeek: 'Tue',
          name: 'Bench Day (5/3/1)',
          sets: [
            // Main work: 5/3/1+ @ 75%/85%/95%
            { exerciseId: 'bench_tng', setIndex: 1, prescribedReps: '5', targetRPE: 7, notes: '~75%' },
            { exerciseId: 'bench_tng', setIndex: 2, prescribedReps: '3', targetRPE: 8, notes: '~85%' },
            { exerciseId: 'bench_tng', setIndex: 3, prescribedReps: '1+', targetRPE: 9, notes: '~95% AMRAP' },

            // BBB: 5x10 @ 50%
            { exerciseId: 'bench_tng', setIndex: 4, prescribedReps: '10', targetRPE: 5, notes: 'BBB ~50%' },
            { exerciseId: 'bench_tng', setIndex: 5, prescribedReps: '10', targetRPE: 5, notes: 'BBB ~50%' },
            { exerciseId: 'bench_tng', setIndex: 6, prescribedReps: '10', targetRPE: 5, notes: 'BBB ~50%' },
            { exerciseId: 'bench_tng', setIndex: 7, prescribedReps: '10', targetRPE: 5, notes: 'BBB ~50%' },
            { exerciseId: 'bench_tng', setIndex: 8, prescribedReps: '10', targetRPE: 5, notes: 'BBB ~50%' },

            // Accessories
            { exerciseId: 'db_row', setIndex: 1, prescribedReps: '10-15', targetRPE: 7, notes: null },
            { exerciseId: 'db_row', setIndex: 2, prescribedReps: '10-15', targetRPE: 7, notes: null },
            { exerciseId: 'db_row', setIndex: 3, prescribedReps: '10-15', targetRPE: 7, notes: null },

            { exerciseId: 'face_pull', setIndex: 1, prescribedReps: '15-20', targetRPE: 6, notes: null },
            { exerciseId: 'face_pull', setIndex: 2, prescribedReps: '15-20', targetRPE: 6, notes: null },
          ],
        },
        {
          dayOfWeek: 'Thu',
          name: 'Deadlift Day (5/3/1)',
          sets: [
            // Main work: 5/3/1+ @ 75%/85%/95%
            { exerciseId: 'deadlift', setIndex: 1, prescribedReps: '5', targetRPE: 7, notes: '~75%' },
            { exerciseId: 'deadlift', setIndex: 2, prescribedReps: '3', targetRPE: 8, notes: '~85%' },
            { exerciseId: 'deadlift', setIndex: 3, prescribedReps: '1+', targetRPE: 9, notes: '~95% AMRAP' },

            // BBB: 5x10 @ 50%
            { exerciseId: 'deadlift', setIndex: 4, prescribedReps: '10', targetRPE: 5, notes: 'BBB ~50%' },
            { exerciseId: 'deadlift', setIndex: 5, prescribedReps: '10', targetRPE: 5, notes: 'BBB ~50%' },
            { exerciseId: 'deadlift', setIndex: 6, prescribedReps: '10', targetRPE: 5, notes: 'BBB ~50%' },
            { exerciseId: 'deadlift', setIndex: 7, prescribedReps: '10', targetRPE: 5, notes: 'BBB ~50%' },
            { exerciseId: 'deadlift', setIndex: 8, prescribedReps: '10', targetRPE: 5, notes: 'BBB ~50%' },

            // Accessories
            { exerciseId: 'hanging_leg_raise', setIndex: 1, prescribedReps: '10-15', targetRPE: 7, notes: null },
            { exerciseId: 'hanging_leg_raise', setIndex: 2, prescribedReps: '10-15', targetRPE: 7, notes: null },
            { exerciseId: 'hanging_leg_raise', setIndex: 3, prescribedReps: '10-15', targetRPE: 7, notes: null },
          ],
        },
        {
          dayOfWeek: 'Fri',
          name: 'OHP Day (5/3/1)',
          sets: [
            // Main work: 5/3/1+ @ 75%/85%/95%
            { exerciseId: 'ohp', setIndex: 1, prescribedReps: '5', targetRPE: 7, notes: '~75%' },
            { exerciseId: 'ohp', setIndex: 2, prescribedReps: '3', targetRPE: 8, notes: '~85%' },
            { exerciseId: 'ohp', setIndex: 3, prescribedReps: '1+', targetRPE: 9, notes: '~95% AMRAP' },

            // BBB: 5x10 @ 50%
            { exerciseId: 'ohp', setIndex: 4, prescribedReps: '10', targetRPE: 5, notes: 'BBB ~50%' },
            { exerciseId: 'ohp', setIndex: 5, prescribedReps: '10', targetRPE: 5, notes: 'BBB ~50%' },
            { exerciseId: 'ohp', setIndex: 6, prescribedReps: '10', targetRPE: 5, notes: 'BBB ~50%' },
            { exerciseId: 'ohp', setIndex: 7, prescribedReps: '10', targetRPE: 5, notes: 'BBB ~50%' },
            { exerciseId: 'ohp', setIndex: 8, prescribedReps: '10', targetRPE: 5, notes: 'BBB ~50%' },

            // Accessories
            { exerciseId: 'lat_pulldown', setIndex: 1, prescribedReps: '10-15', targetRPE: 7, notes: null },
            { exerciseId: 'lat_pulldown', setIndex: 2, prescribedReps: '10-15', targetRPE: 7, notes: null },
            { exerciseId: 'lat_pulldown', setIndex: 3, prescribedReps: '10-15', targetRPE: 7, notes: null },

            { exerciseId: 'lateral_raise', setIndex: 1, prescribedReps: '15-20', targetRPE: 6, notes: null },
            { exerciseId: 'lateral_raise', setIndex: 2, prescribedReps: '15-20', targetRPE: 6, notes: null },
          ],
        },
      ],
    },
    // ========== WEEK 4: Deload Week ==========
    {
      weekNumber: 4,
      days: [
        {
          dayOfWeek: 'Mon',
          name: 'Squat Deload',
          sets: [
            // Deload: 5/5/5 @ 40%/50%/60%
            { exerciseId: 'squat', setIndex: 1, prescribedReps: '5', targetRPE: 4, notes: 'Deload ~40%' },
            { exerciseId: 'squat', setIndex: 2, prescribedReps: '5', targetRPE: 5, notes: 'Deload ~50%' },
            { exerciseId: 'squat', setIndex: 3, prescribedReps: '5', targetRPE: 6, notes: 'Deload ~60%' },

            // Light accessories
            { exerciseId: 'leg_curl', setIndex: 1, prescribedReps: '10-12', targetRPE: 5, notes: 'light' },
            { exerciseId: 'leg_curl', setIndex: 2, prescribedReps: '10-12', targetRPE: 5, notes: 'light' },

            { exerciseId: 'plank', setIndex: 1, prescribedReps: '30-60', targetRPE: 5, notes: 'seconds' },
          ],
        },
        {
          dayOfWeek: 'Tue',
          name: 'Bench Deload',
          sets: [
            // Deload: 5/5/5 @ 40%/50%/60%
            { exerciseId: 'bench_tng', setIndex: 1, prescribedReps: '5', targetRPE: 4, notes: 'Deload ~40%' },
            { exerciseId: 'bench_tng', setIndex: 2, prescribedReps: '5', targetRPE: 5, notes: 'Deload ~50%' },
            { exerciseId: 'bench_tng', setIndex: 3, prescribedReps: '5', targetRPE: 6, notes: 'Deload ~60%' },

            // Light accessories
            { exerciseId: 'db_row', setIndex: 1, prescribedReps: '10-12', targetRPE: 5, notes: 'light' },
            { exerciseId: 'db_row', setIndex: 2, prescribedReps: '10-12', targetRPE: 5, notes: 'light' },

            { exerciseId: 'face_pull', setIndex: 1, prescribedReps: '15-20', targetRPE: 4, notes: 'light' },
          ],
        },
        {
          dayOfWeek: 'Thu',
          name: 'Deadlift Deload',
          sets: [
            // Deload: 5/5/5 @ 40%/50%/60%
            { exerciseId: 'deadlift', setIndex: 1, prescribedReps: '5', targetRPE: 4, notes: 'Deload ~40%' },
            { exerciseId: 'deadlift', setIndex: 2, prescribedReps: '5', targetRPE: 5, notes: 'Deload ~50%' },
            { exerciseId: 'deadlift', setIndex: 3, prescribedReps: '5', targetRPE: 6, notes: 'Deload ~60%' },

            // Light accessories
            { exerciseId: 'hanging_leg_raise', setIndex: 1, prescribedReps: '8-10', targetRPE: 5, notes: 'light' },
            { exerciseId: 'hanging_leg_raise', setIndex: 2, prescribedReps: '8-10', targetRPE: 5, notes: 'light' },
          ],
        },
        {
          dayOfWeek: 'Fri',
          name: 'OHP Deload',
          sets: [
            // Deload: 5/5/5 @ 40%/50%/60%
            { exerciseId: 'ohp', setIndex: 1, prescribedReps: '5', targetRPE: 4, notes: 'Deload ~40%' },
            { exerciseId: 'ohp', setIndex: 2, prescribedReps: '5', targetRPE: 5, notes: 'Deload ~50%' },
            { exerciseId: 'ohp', setIndex: 3, prescribedReps: '5', targetRPE: 6, notes: 'Deload ~60%' },

            // Light accessories
            { exerciseId: 'lat_pulldown', setIndex: 1, prescribedReps: '10-12', targetRPE: 5, notes: 'light' },
            { exerciseId: 'lat_pulldown', setIndex: 2, prescribedReps: '10-12', targetRPE: 5, notes: 'light' },

            { exerciseId: 'lateral_raise', setIndex: 1, prescribedReps: '12-15', targetRPE: 4, notes: 'light' },
          ],
        },
      ],
    },
  ],
};

// ========================================
// STARTING STRENGTH (3-Day Linear Progression)
// ========================================

const startingStrength: ProgramTemplate = {
  id: 'starting_strength_v1',
  name: 'Starting Strength',
  description: 'Classic beginner program with A/B workout split featuring the main compound lifts and linear progression',
  goal: 'strength',
  experienceLevel: 'beginner',
  daysPerWeek: 3,
  weekCount: 12,
  intensityMethod: 'rpe',
  weeks: [
    {
      weekNumber: 1,
      days: [
        {
          dayOfWeek: 'Mon',
          name: 'Workout A',
          sets: [
            // Squat 3x5
            { exerciseId: 'squat', setIndex: 1, prescribedReps: '5', targetRPE: 7.5, notes: 'add 5-10 lbs per session' },
            { exerciseId: 'squat', setIndex: 2, prescribedReps: '5', targetRPE: 7.5, notes: null },
            { exerciseId: 'squat', setIndex: 3, prescribedReps: '5', targetRPE: 7.5, notes: null },

            // Bench Press 3x5
            { exerciseId: 'bench_tng', setIndex: 1, prescribedReps: '5', targetRPE: 7.5, notes: 'add 5 lbs per session' },
            { exerciseId: 'bench_tng', setIndex: 2, prescribedReps: '5', targetRPE: 7.5, notes: null },
            { exerciseId: 'bench_tng', setIndex: 3, prescribedReps: '5', targetRPE: 7.5, notes: null },

            // Deadlift 1x5
            { exerciseId: 'deadlift', setIndex: 1, prescribedReps: '5', targetRPE: 8, notes: 'add 10 lbs per session' },
          ],
        },
        {
          dayOfWeek: 'Wed',
          name: 'Workout B',
          sets: [
            // Squat 3x5
            { exerciseId: 'squat', setIndex: 1, prescribedReps: '5', targetRPE: 7.5, notes: 'add 5-10 lbs per session' },
            { exerciseId: 'squat', setIndex: 2, prescribedReps: '5', targetRPE: 7.5, notes: null },
            { exerciseId: 'squat', setIndex: 3, prescribedReps: '5', targetRPE: 7.5, notes: null },

            // Overhead Press 3x5
            { exerciseId: 'ohp', setIndex: 1, prescribedReps: '5', targetRPE: 7.5, notes: 'add 2.5-5 lbs per session' },
            { exerciseId: 'ohp', setIndex: 2, prescribedReps: '5', targetRPE: 7.5, notes: null },
            { exerciseId: 'ohp', setIndex: 3, prescribedReps: '5', targetRPE: 7.5, notes: null },

            // Power Clean 5x3 (or Barbell Row substitute)
            { exerciseId: 'bent_over_row', setIndex: 1, prescribedReps: '5', targetRPE: 7.5, notes: 'add 5 lbs per session' },
            { exerciseId: 'bent_over_row', setIndex: 2, prescribedReps: '5', targetRPE: 7.5, notes: null },
            { exerciseId: 'bent_over_row', setIndex: 3, prescribedReps: '5', targetRPE: 7.5, notes: null },
          ],
        },
        {
          dayOfWeek: 'Fri',
          name: 'Workout A',
          sets: [
            // Squat 3x5
            { exerciseId: 'squat', setIndex: 1, prescribedReps: '5', targetRPE: 7.5, notes: 'add 5-10 lbs per session' },
            { exerciseId: 'squat', setIndex: 2, prescribedReps: '5', targetRPE: 7.5, notes: null },
            { exerciseId: 'squat', setIndex: 3, prescribedReps: '5', targetRPE: 7.5, notes: null },

            // Bench Press 3x5
            { exerciseId: 'bench_tng', setIndex: 1, prescribedReps: '5', targetRPE: 7.5, notes: 'add 5 lbs per session' },
            { exerciseId: 'bench_tng', setIndex: 2, prescribedReps: '5', targetRPE: 7.5, notes: null },
            { exerciseId: 'bench_tng', setIndex: 3, prescribedReps: '5', targetRPE: 7.5, notes: null },

            // Deadlift 1x5
            { exerciseId: 'deadlift', setIndex: 1, prescribedReps: '5', targetRPE: 8, notes: 'add 10 lbs per session' },
          ],
        },
      ],
    },
  ],
};

// ========================================
// STRONGLIFTS 5X5 (3-Day Linear Progression)
// ========================================

const strongLifts5x5: ProgramTemplate = {
  id: 'stronglifts_5x5_v1',
  name: 'StrongLifts 5x5',
  description: 'Beginner-friendly 3-day program alternating between two workouts with simple 5x5 progression',
  goal: 'strength',
  experienceLevel: 'beginner',
  daysPerWeek: 3,
  weekCount: 12,
  intensityMethod: 'rpe',
  weeks: [
    {
      weekNumber: 1,
      days: [
        {
          dayOfWeek: 'Mon',
          name: 'Workout A',
          sets: [
            // Squat 5x5
            { exerciseId: 'squat', setIndex: 1, prescribedReps: '5', targetRPE: 7, notes: 'add 5 lbs per session' },
            { exerciseId: 'squat', setIndex: 2, prescribedReps: '5', targetRPE: 7, notes: null },
            { exerciseId: 'squat', setIndex: 3, prescribedReps: '5', targetRPE: 7, notes: null },
            { exerciseId: 'squat', setIndex: 4, prescribedReps: '5', targetRPE: 7, notes: null },
            { exerciseId: 'squat', setIndex: 5, prescribedReps: '5', targetRPE: 7, notes: null },

            // Bench Press 5x5
            { exerciseId: 'bench_tng', setIndex: 1, prescribedReps: '5', targetRPE: 7, notes: 'add 5 lbs per session' },
            { exerciseId: 'bench_tng', setIndex: 2, prescribedReps: '5', targetRPE: 7, notes: null },
            { exerciseId: 'bench_tng', setIndex: 3, prescribedReps: '5', targetRPE: 7, notes: null },
            { exerciseId: 'bench_tng', setIndex: 4, prescribedReps: '5', targetRPE: 7, notes: null },
            { exerciseId: 'bench_tng', setIndex: 5, prescribedReps: '5', targetRPE: 7, notes: null },

            // Barbell Row 5x5
            { exerciseId: 'bent_over_row', setIndex: 1, prescribedReps: '5', targetRPE: 7, notes: 'add 5 lbs per session' },
            { exerciseId: 'bent_over_row', setIndex: 2, prescribedReps: '5', targetRPE: 7, notes: null },
            { exerciseId: 'bent_over_row', setIndex: 3, prescribedReps: '5', targetRPE: 7, notes: null },
            { exerciseId: 'bent_over_row', setIndex: 4, prescribedReps: '5', targetRPE: 7, notes: null },
            { exerciseId: 'bent_over_row', setIndex: 5, prescribedReps: '5', targetRPE: 7, notes: null },
          ],
        },
        {
          dayOfWeek: 'Wed',
          name: 'Workout B',
          sets: [
            // Squat 5x5
            { exerciseId: 'squat', setIndex: 1, prescribedReps: '5', targetRPE: 7, notes: 'add 5 lbs per session' },
            { exerciseId: 'squat', setIndex: 2, prescribedReps: '5', targetRPE: 7, notes: null },
            { exerciseId: 'squat', setIndex: 3, prescribedReps: '5', targetRPE: 7, notes: null },
            { exerciseId: 'squat', setIndex: 4, prescribedReps: '5', targetRPE: 7, notes: null },
            { exerciseId: 'squat', setIndex: 5, prescribedReps: '5', targetRPE: 7, notes: null },

            // Overhead Press 5x5
            { exerciseId: 'ohp', setIndex: 1, prescribedReps: '5', targetRPE: 7, notes: 'add 2.5 lbs per session' },
            { exerciseId: 'ohp', setIndex: 2, prescribedReps: '5', targetRPE: 7, notes: null },
            { exerciseId: 'ohp', setIndex: 3, prescribedReps: '5', targetRPE: 7, notes: null },
            { exerciseId: 'ohp', setIndex: 4, prescribedReps: '5', targetRPE: 7, notes: null },
            { exerciseId: 'ohp', setIndex: 5, prescribedReps: '5', targetRPE: 7, notes: null },

            // Deadlift 1x5
            { exerciseId: 'deadlift', setIndex: 1, prescribedReps: '5', targetRPE: 8, notes: 'add 10 lbs per session' },
          ],
        },
        {
          dayOfWeek: 'Fri',
          name: 'Workout A',
          sets: [
            // Squat 5x5
            { exerciseId: 'squat', setIndex: 1, prescribedReps: '5', targetRPE: 7, notes: 'add 5 lbs per session' },
            { exerciseId: 'squat', setIndex: 2, prescribedReps: '5', targetRPE: 7, notes: null },
            { exerciseId: 'squat', setIndex: 3, prescribedReps: '5', targetRPE: 7, notes: null },
            { exerciseId: 'squat', setIndex: 4, prescribedReps: '5', targetRPE: 7, notes: null },
            { exerciseId: 'squat', setIndex: 5, prescribedReps: '5', targetRPE: 7, notes: null },

            // Bench Press 5x5
            { exerciseId: 'bench_tng', setIndex: 1, prescribedReps: '5', targetRPE: 7, notes: 'add 5 lbs per session' },
            { exerciseId: 'bench_tng', setIndex: 2, prescribedReps: '5', targetRPE: 7, notes: null },
            { exerciseId: 'bench_tng', setIndex: 3, prescribedReps: '5', targetRPE: 7, notes: null },
            { exerciseId: 'bench_tng', setIndex: 4, prescribedReps: '5', targetRPE: 7, notes: null },
            { exerciseId: 'bench_tng', setIndex: 5, prescribedReps: '5', targetRPE: 7, notes: null },

            // Barbell Row 5x5
            { exerciseId: 'bent_over_row', setIndex: 1, prescribedReps: '5', targetRPE: 7, notes: 'add 5 lbs per session' },
            { exerciseId: 'bent_over_row', setIndex: 2, prescribedReps: '5', targetRPE: 7, notes: null },
            { exerciseId: 'bent_over_row', setIndex: 3, prescribedReps: '5', targetRPE: 7, notes: null },
            { exerciseId: 'bent_over_row', setIndex: 4, prescribedReps: '5', targetRPE: 7, notes: null },
            { exerciseId: 'bent_over_row', setIndex: 5, prescribedReps: '5', targetRPE: 7, notes: null },
          ],
        },
      ],
    },
  ],
};

// ========================================
// PUSH/PULL/LEGS (6-Day Split)
// ========================================

const pushPullLegs: ProgramTemplate = {
  id: 'ppl_6day_v1',
  name: 'Push/Pull/Legs (PPL)',
  description: '6-day high-volume bodybuilding split with push (chest/shoulders/triceps), pull (back/biceps), and leg days',
  goal: 'hypertrophy',
  experienceLevel: 'intermediate',
  daysPerWeek: 6,
  weekCount: 12,
  intensityMethod: 'rpe',
  weeks: [
    {
      weekNumber: 1,
      days: [
        {
          dayOfWeek: 'Mon',
          name: 'Push A',
          sets: [
            // Bench Press 4x5
            { exerciseId: 'bench_tng', setIndex: 1, prescribedReps: '5', targetRPE: 8, notes: 'strength focus' },
            { exerciseId: 'bench_tng', setIndex: 2, prescribedReps: '5', targetRPE: 8, notes: null },
            { exerciseId: 'bench_tng', setIndex: 3, prescribedReps: '5', targetRPE: 8, notes: null },
            { exerciseId: 'bench_tng', setIndex: 4, prescribedReps: '5', targetRPE: 8, notes: null },

            // Overhead Press 3x8-12
            { exerciseId: 'ohp', setIndex: 1, prescribedReps: '8-12', targetRPE: 7.5, notes: null },
            { exerciseId: 'ohp', setIndex: 2, prescribedReps: '8-12', targetRPE: 7.5, notes: null },
            { exerciseId: 'ohp', setIndex: 3, prescribedReps: '8-12', targetRPE: 7.5, notes: null },

            // Incline DB Press 3x8-12
            { exerciseId: 'db_incline_press', setIndex: 1, prescribedReps: '8-12', targetRPE: 7.5, notes: null },
            { exerciseId: 'db_incline_press', setIndex: 2, prescribedReps: '8-12', targetRPE: 7.5, notes: null },
            { exerciseId: 'db_incline_press', setIndex: 3, prescribedReps: '8-12', targetRPE: 7.5, notes: null },

            // Lateral Raises 3x15-20
            { exerciseId: 'lateral_raise', setIndex: 1, prescribedReps: '15-20', targetRPE: 7, notes: null },
            { exerciseId: 'lateral_raise', setIndex: 2, prescribedReps: '15-20', targetRPE: 7, notes: null },
            { exerciseId: 'lateral_raise', setIndex: 3, prescribedReps: '15-20', targetRPE: 7, notes: null },

            // Tricep Pressdown 3x12-15
            { exerciseId: 'tricep_pressdown', setIndex: 1, prescribedReps: '12-15', targetRPE: 7, notes: null },
            { exerciseId: 'tricep_pressdown', setIndex: 2, prescribedReps: '12-15', targetRPE: 7, notes: null },
            { exerciseId: 'tricep_pressdown', setIndex: 3, prescribedReps: '12-15', targetRPE: 7, notes: null },

            // Overhead Extension 3x12-15
            { exerciseId: 'tricep_overhead_cable', setIndex: 1, prescribedReps: '12-15', targetRPE: 7, notes: null },
            { exerciseId: 'tricep_overhead_cable', setIndex: 2, prescribedReps: '12-15', targetRPE: 7, notes: null },
            { exerciseId: 'tricep_overhead_cable', setIndex: 3, prescribedReps: '12-15', targetRPE: 7, notes: null },
          ],
        },
        {
          dayOfWeek: 'Tue',
          name: 'Pull A',
          sets: [
            // Deadlift 3x5
            { exerciseId: 'deadlift', setIndex: 1, prescribedReps: '5', targetRPE: 8, notes: 'strength focus' },
            { exerciseId: 'deadlift', setIndex: 2, prescribedReps: '5', targetRPE: 8, notes: null },
            { exerciseId: 'deadlift', setIndex: 3, prescribedReps: '5', targetRPE: 8, notes: null },

            // Pullups 3x8-12
            { exerciseId: 'pullup', setIndex: 1, prescribedReps: '8-12', targetRPE: 7.5, notes: 'add weight if needed' },
            { exerciseId: 'pullup', setIndex: 2, prescribedReps: '8-12', targetRPE: 7.5, notes: null },
            { exerciseId: 'pullup', setIndex: 3, prescribedReps: '8-12', targetRPE: 7.5, notes: null },

            // Cable Row 3x8-12
            { exerciseId: 'row_cable', setIndex: 1, prescribedReps: '8-12', targetRPE: 7.5, notes: null },
            { exerciseId: 'row_cable', setIndex: 2, prescribedReps: '8-12', targetRPE: 7.5, notes: null },
            { exerciseId: 'row_cable', setIndex: 3, prescribedReps: '8-12', targetRPE: 7.5, notes: null },

            // Face Pulls 3x15-20
            { exerciseId: 'face_pull', setIndex: 1, prescribedReps: '15-20', targetRPE: 7, notes: null },
            { exerciseId: 'face_pull', setIndex: 2, prescribedReps: '15-20', targetRPE: 7, notes: null },
            { exerciseId: 'face_pull', setIndex: 3, prescribedReps: '15-20', targetRPE: 7, notes: null },

            // Barbell Curl 4x8-12
            { exerciseId: 'barbell_curl', setIndex: 1, prescribedReps: '8-12', targetRPE: 7, notes: null },
            { exerciseId: 'barbell_curl', setIndex: 2, prescribedReps: '8-12', targetRPE: 7, notes: null },
            { exerciseId: 'barbell_curl', setIndex: 3, prescribedReps: '8-12', targetRPE: 7, notes: null },
            { exerciseId: 'barbell_curl', setIndex: 4, prescribedReps: '8-12', targetRPE: 7, notes: null },

            // Hammer Curl 3x12-15
            { exerciseId: 'bicep_curl_hammer', setIndex: 1, prescribedReps: '12-15', targetRPE: 7, notes: null },
            { exerciseId: 'bicep_curl_hammer', setIndex: 2, prescribedReps: '12-15', targetRPE: 7, notes: null },
            { exerciseId: 'bicep_curl_hammer', setIndex: 3, prescribedReps: '12-15', targetRPE: 7, notes: null },
          ],
        },
        {
          dayOfWeek: 'Wed',
          name: 'Legs A',
          sets: [
            // Squat 4x5
            { exerciseId: 'squat', setIndex: 1, prescribedReps: '5', targetRPE: 8, notes: 'strength focus' },
            { exerciseId: 'squat', setIndex: 2, prescribedReps: '5', targetRPE: 8, notes: null },
            { exerciseId: 'squat', setIndex: 3, prescribedReps: '5', targetRPE: 8, notes: null },
            { exerciseId: 'squat', setIndex: 4, prescribedReps: '5', targetRPE: 8, notes: null },

            // Romanian Deadlift 3x8-12
            { exerciseId: 'rdl', setIndex: 1, prescribedReps: '8-12', targetRPE: 7.5, notes: null },
            { exerciseId: 'rdl', setIndex: 2, prescribedReps: '8-12', targetRPE: 7.5, notes: null },
            { exerciseId: 'rdl', setIndex: 3, prescribedReps: '8-12', targetRPE: 7.5, notes: null },

            // Leg Press 3x12-15
            { exerciseId: 'leg_press', setIndex: 1, prescribedReps: '12-15', targetRPE: 7.5, notes: null },
            { exerciseId: 'leg_press', setIndex: 2, prescribedReps: '12-15', targetRPE: 7.5, notes: null },
            { exerciseId: 'leg_press', setIndex: 3, prescribedReps: '12-15', targetRPE: 7.5, notes: null },

            // Leg Curl 3x12-15
            { exerciseId: 'leg_curl', setIndex: 1, prescribedReps: '12-15', targetRPE: 7, notes: null },
            { exerciseId: 'leg_curl', setIndex: 2, prescribedReps: '12-15', targetRPE: 7, notes: null },
            { exerciseId: 'leg_curl', setIndex: 3, prescribedReps: '12-15', targetRPE: 7, notes: null },

            // Calf Raises 4x15-20
            { exerciseId: 'standing_calf_raise', setIndex: 1, prescribedReps: '15-20', targetRPE: 7, notes: null },
            { exerciseId: 'standing_calf_raise', setIndex: 2, prescribedReps: '15-20', targetRPE: 7, notes: null },
            { exerciseId: 'standing_calf_raise', setIndex: 3, prescribedReps: '15-20', targetRPE: 7, notes: null },
            { exerciseId: 'standing_calf_raise', setIndex: 4, prescribedReps: '15-20', targetRPE: 7, notes: null },
          ],
        },
        {
          dayOfWeek: 'Thu',
          name: 'Push B',
          sets: [
            // Overhead Press 4x5
            { exerciseId: 'ohp', setIndex: 1, prescribedReps: '5', targetRPE: 8, notes: 'strength focus' },
            { exerciseId: 'ohp', setIndex: 2, prescribedReps: '5', targetRPE: 8, notes: null },
            { exerciseId: 'ohp', setIndex: 3, prescribedReps: '5', targetRPE: 8, notes: null },
            { exerciseId: 'ohp', setIndex: 4, prescribedReps: '5', targetRPE: 8, notes: null },

            // Bench Press 3x8-12
            { exerciseId: 'bench_tng', setIndex: 1, prescribedReps: '8-12', targetRPE: 7.5, notes: null },
            { exerciseId: 'bench_tng', setIndex: 2, prescribedReps: '8-12', targetRPE: 7.5, notes: null },
            { exerciseId: 'bench_tng', setIndex: 3, prescribedReps: '8-12', targetRPE: 7.5, notes: null },

            // DB Shoulder Press 3x10-15
            { exerciseId: 'db_shoulder_press', setIndex: 1, prescribedReps: '10-15', targetRPE: 7, notes: null },
            { exerciseId: 'db_shoulder_press', setIndex: 2, prescribedReps: '10-15', targetRPE: 7, notes: null },
            { exerciseId: 'db_shoulder_press', setIndex: 3, prescribedReps: '10-15', targetRPE: 7, notes: null },

            // Cable Fly 3x12-15
            { exerciseId: 'cable_fly', setIndex: 1, prescribedReps: '12-15', targetRPE: 7, notes: null },
            { exerciseId: 'cable_fly', setIndex: 2, prescribedReps: '12-15', targetRPE: 7, notes: null },
            { exerciseId: 'cable_fly', setIndex: 3, prescribedReps: '12-15', targetRPE: 7, notes: null },

            // Lateral Raises 3x15-20
            { exerciseId: 'lateral_raise', setIndex: 1, prescribedReps: '15-20', targetRPE: 7, notes: null },
            { exerciseId: 'lateral_raise', setIndex: 2, prescribedReps: '15-20', targetRPE: 7, notes: null },
            { exerciseId: 'lateral_raise', setIndex: 3, prescribedReps: '15-20', targetRPE: 7, notes: null },

            // Skull Crushers 3x10-12
            { exerciseId: 'skull_crusher', setIndex: 1, prescribedReps: '10-12', targetRPE: 7, notes: null },
            { exerciseId: 'skull_crusher', setIndex: 2, prescribedReps: '10-12', targetRPE: 7, notes: null },
            { exerciseId: 'skull_crusher', setIndex: 3, prescribedReps: '10-12', targetRPE: 7, notes: null },
          ],
        },
        {
          dayOfWeek: 'Fri',
          name: 'Pull B',
          sets: [
            // Barbell Row 4x5
            { exerciseId: 'bent_over_row', setIndex: 1, prescribedReps: '5', targetRPE: 8, notes: 'strength focus' },
            { exerciseId: 'bent_over_row', setIndex: 2, prescribedReps: '5', targetRPE: 8, notes: null },
            { exerciseId: 'bent_over_row', setIndex: 3, prescribedReps: '5', targetRPE: 8, notes: null },
            { exerciseId: 'bent_over_row', setIndex: 4, prescribedReps: '5', targetRPE: 8, notes: null },

            // Lat Pulldown 3x8-12
            { exerciseId: 'lat_pulldown', setIndex: 1, prescribedReps: '8-12', targetRPE: 7.5, notes: null },
            { exerciseId: 'lat_pulldown', setIndex: 2, prescribedReps: '8-12', targetRPE: 7.5, notes: null },
            { exerciseId: 'lat_pulldown', setIndex: 3, prescribedReps: '8-12', targetRPE: 7.5, notes: null },

            // Chest-Supported Row 3x10-15
            { exerciseId: 'row_chest_supported', setIndex: 1, prescribedReps: '10-15', targetRPE: 7, notes: null },
            { exerciseId: 'row_chest_supported', setIndex: 2, prescribedReps: '10-15', targetRPE: 7, notes: null },
            { exerciseId: 'row_chest_supported', setIndex: 3, prescribedReps: '10-15', targetRPE: 7, notes: null },

            // Rear Delt Fly 3x15-20
            { exerciseId: 'rear_delt_fly', setIndex: 1, prescribedReps: '15-20', targetRPE: 7, notes: null },
            { exerciseId: 'rear_delt_fly', setIndex: 2, prescribedReps: '15-20', targetRPE: 7, notes: null },
            { exerciseId: 'rear_delt_fly', setIndex: 3, prescribedReps: '15-20', targetRPE: 7, notes: null },

            // Preacher Curl 3x10-12
            { exerciseId: 'bicep_curl_preacher', setIndex: 1, prescribedReps: '10-12', targetRPE: 7, notes: null },
            { exerciseId: 'bicep_curl_preacher', setIndex: 2, prescribedReps: '10-12', targetRPE: 7, notes: null },
            { exerciseId: 'bicep_curl_preacher', setIndex: 3, prescribedReps: '10-12', targetRPE: 7, notes: null },

            // Cable Curl 3x12-15
            { exerciseId: 'bicep_curl_cable', setIndex: 1, prescribedReps: '12-15', targetRPE: 7, notes: null },
            { exerciseId: 'bicep_curl_cable', setIndex: 2, prescribedReps: '12-15', targetRPE: 7, notes: null },
            { exerciseId: 'bicep_curl_cable', setIndex: 3, prescribedReps: '12-15', targetRPE: 7, notes: null },
          ],
        },
        {
          dayOfWeek: 'Sat',
          name: 'Legs B',
          sets: [
            // Front Squat 3x8-12
            { exerciseId: 'front_squat', setIndex: 1, prescribedReps: '8-12', targetRPE: 7.5, notes: null },
            { exerciseId: 'front_squat', setIndex: 2, prescribedReps: '8-12', targetRPE: 7.5, notes: null },
            { exerciseId: 'front_squat', setIndex: 3, prescribedReps: '8-12', targetRPE: 7.5, notes: null },

            // Hack Squat 3x12-15
            { exerciseId: 'hack_squat', setIndex: 1, prescribedReps: '12-15', targetRPE: 7.5, notes: null },
            { exerciseId: 'hack_squat', setIndex: 2, prescribedReps: '12-15', targetRPE: 7.5, notes: null },
            { exerciseId: 'hack_squat', setIndex: 3, prescribedReps: '12-15', targetRPE: 7.5, notes: null },

            // Bulgarian Split Squat 3x10-15
            { exerciseId: 'bulgarian_split_squat', setIndex: 1, prescribedReps: '10-15', targetRPE: 7, notes: 'per leg' },
            { exerciseId: 'bulgarian_split_squat', setIndex: 2, prescribedReps: '10-15', targetRPE: 7, notes: 'per leg' },
            { exerciseId: 'bulgarian_split_squat', setIndex: 3, prescribedReps: '10-15', targetRPE: 7, notes: 'per leg' },

            // Leg Extension 3x12-15
            { exerciseId: 'leg_extension', setIndex: 1, prescribedReps: '12-15', targetRPE: 7, notes: null },
            { exerciseId: 'leg_extension', setIndex: 2, prescribedReps: '12-15', targetRPE: 7, notes: null },
            { exerciseId: 'leg_extension', setIndex: 3, prescribedReps: '12-15', targetRPE: 7, notes: null },

            // Seated Calf Raises 4x15-20
            { exerciseId: 'seated_calf_raise', setIndex: 1, prescribedReps: '15-20', targetRPE: 7, notes: null },
            { exerciseId: 'seated_calf_raise', setIndex: 2, prescribedReps: '15-20', targetRPE: 7, notes: null },
            { exerciseId: 'seated_calf_raise', setIndex: 3, prescribedReps: '15-20', targetRPE: 7, notes: null },
            { exerciseId: 'seated_calf_raise', setIndex: 4, prescribedReps: '15-20', targetRPE: 7, notes: null },
          ],
        },
      ],
    },
  ],
};

// ========================================
// BRO SPLIT (5-Day Bodybuilding)
// ========================================

const broSplit: ProgramTemplate = {
  id: 'bro_split_5day_v1',
  name: 'Bro Split',
  description: 'Classic 5-day bodybuilding split training one muscle group per day with high volume',
  goal: 'hypertrophy',
  experienceLevel: 'intermediate',
  daysPerWeek: 5,
  weekCount: 12,
  intensityMethod: 'rpe',
  weeks: [
    {
      weekNumber: 1,
      days: [
        {
          dayOfWeek: 'Mon',
          name: 'Chest Day',
          sets: [
            // Bench Press 4x8-12
            { exerciseId: 'bench_tng', setIndex: 1, prescribedReps: '8-12', targetRPE: 7.5, notes: null },
            { exerciseId: 'bench_tng', setIndex: 2, prescribedReps: '8-12', targetRPE: 7.5, notes: null },
            { exerciseId: 'bench_tng', setIndex: 3, prescribedReps: '8-12', targetRPE: 7.5, notes: null },
            { exerciseId: 'bench_tng', setIndex: 4, prescribedReps: '8-12', targetRPE: 7.5, notes: null },

            // Incline DB Press 4x8-12
            { exerciseId: 'db_incline_press', setIndex: 1, prescribedReps: '8-12', targetRPE: 7.5, notes: null },
            { exerciseId: 'db_incline_press', setIndex: 2, prescribedReps: '8-12', targetRPE: 7.5, notes: null },
            { exerciseId: 'db_incline_press', setIndex: 3, prescribedReps: '8-12', targetRPE: 7.5, notes: null },
            { exerciseId: 'db_incline_press', setIndex: 4, prescribedReps: '8-12', targetRPE: 7.5, notes: null },

            // Decline Bench 3x10-12
            { exerciseId: 'decline_bench', setIndex: 1, prescribedReps: '10-12', targetRPE: 7, notes: null },
            { exerciseId: 'decline_bench', setIndex: 2, prescribedReps: '10-12', targetRPE: 7, notes: null },
            { exerciseId: 'decline_bench', setIndex: 3, prescribedReps: '10-12', targetRPE: 7, notes: null },

            // Cable Fly 3x12-15
            { exerciseId: 'cable_fly', setIndex: 1, prescribedReps: '12-15', targetRPE: 7, notes: null },
            { exerciseId: 'cable_fly', setIndex: 2, prescribedReps: '12-15', targetRPE: 7, notes: null },
            { exerciseId: 'cable_fly', setIndex: 3, prescribedReps: '12-15', targetRPE: 7, notes: null },

            // DB Fly 3x12-15
            { exerciseId: 'db_fly', setIndex: 1, prescribedReps: '12-15', targetRPE: 7, notes: null },
            { exerciseId: 'db_fly', setIndex: 2, prescribedReps: '12-15', targetRPE: 7, notes: null },
            { exerciseId: 'db_fly', setIndex: 3, prescribedReps: '12-15', targetRPE: 7, notes: null },
          ],
        },
        {
          dayOfWeek: 'Tue',
          name: 'Back Day',
          sets: [
            // Deadlift 4x6-8
            { exerciseId: 'deadlift', setIndex: 1, prescribedReps: '6-8', targetRPE: 7.5, notes: null },
            { exerciseId: 'deadlift', setIndex: 2, prescribedReps: '6-8', targetRPE: 7.5, notes: null },
            { exerciseId: 'deadlift', setIndex: 3, prescribedReps: '6-8', targetRPE: 7.5, notes: null },
            { exerciseId: 'deadlift', setIndex: 4, prescribedReps: '6-8', targetRPE: 7.5, notes: null },

            // Pullups 4x8-12
            { exerciseId: 'pullup', setIndex: 1, prescribedReps: '8-12', targetRPE: 7.5, notes: 'add weight if needed' },
            { exerciseId: 'pullup', setIndex: 2, prescribedReps: '8-12', targetRPE: 7.5, notes: null },
            { exerciseId: 'pullup', setIndex: 3, prescribedReps: '8-12', targetRPE: 7.5, notes: null },
            { exerciseId: 'pullup', setIndex: 4, prescribedReps: '8-12', targetRPE: 7.5, notes: null },

            // Barbell Row 4x8-12
            { exerciseId: 'bent_over_row', setIndex: 1, prescribedReps: '8-12', targetRPE: 7.5, notes: null },
            { exerciseId: 'bent_over_row', setIndex: 2, prescribedReps: '8-12', targetRPE: 7.5, notes: null },
            { exerciseId: 'bent_over_row', setIndex: 3, prescribedReps: '8-12', targetRPE: 7.5, notes: null },
            { exerciseId: 'bent_over_row', setIndex: 4, prescribedReps: '8-12', targetRPE: 7.5, notes: null },

            // Cable Row 3x10-12
            { exerciseId: 'row_cable', setIndex: 1, prescribedReps: '10-12', targetRPE: 7, notes: null },
            { exerciseId: 'row_cable', setIndex: 2, prescribedReps: '10-12', targetRPE: 7, notes: null },
            { exerciseId: 'row_cable', setIndex: 3, prescribedReps: '10-12', targetRPE: 7, notes: null },

            // Lat Pulldown 3x12-15
            { exerciseId: 'lat_pulldown', setIndex: 1, prescribedReps: '12-15', targetRPE: 7, notes: null },
            { exerciseId: 'lat_pulldown', setIndex: 2, prescribedReps: '12-15', targetRPE: 7, notes: null },
            { exerciseId: 'lat_pulldown', setIndex: 3, prescribedReps: '12-15', targetRPE: 7, notes: null },
          ],
        },
        {
          dayOfWeek: 'Wed',
          name: 'Shoulder Day',
          sets: [
            // Overhead Press 4x8-12
            { exerciseId: 'ohp', setIndex: 1, prescribedReps: '8-12', targetRPE: 7.5, notes: null },
            { exerciseId: 'ohp', setIndex: 2, prescribedReps: '8-12', targetRPE: 7.5, notes: null },
            { exerciseId: 'ohp', setIndex: 3, prescribedReps: '8-12', targetRPE: 7.5, notes: null },
            { exerciseId: 'ohp', setIndex: 4, prescribedReps: '8-12', targetRPE: 7.5, notes: null },

            // DB Shoulder Press 4x10-12
            { exerciseId: 'db_shoulder_press', setIndex: 1, prescribedReps: '10-12', targetRPE: 7.5, notes: null },
            { exerciseId: 'db_shoulder_press', setIndex: 2, prescribedReps: '10-12', targetRPE: 7.5, notes: null },
            { exerciseId: 'db_shoulder_press', setIndex: 3, prescribedReps: '10-12', targetRPE: 7.5, notes: null },
            { exerciseId: 'db_shoulder_press', setIndex: 4, prescribedReps: '10-12', targetRPE: 7.5, notes: null },

            // Lateral Raises 4x12-15
            { exerciseId: 'lateral_raise', setIndex: 1, prescribedReps: '12-15', targetRPE: 7, notes: null },
            { exerciseId: 'lateral_raise', setIndex: 2, prescribedReps: '12-15', targetRPE: 7, notes: null },
            { exerciseId: 'lateral_raise', setIndex: 3, prescribedReps: '12-15', targetRPE: 7, notes: null },
            { exerciseId: 'lateral_raise', setIndex: 4, prescribedReps: '12-15', targetRPE: 7, notes: null },

            // Front Raises 3x12-15
            { exerciseId: 'front_raise', setIndex: 1, prescribedReps: '12-15', targetRPE: 7, notes: null },
            { exerciseId: 'front_raise', setIndex: 2, prescribedReps: '12-15', targetRPE: 7, notes: null },
            { exerciseId: 'front_raise', setIndex: 3, prescribedReps: '12-15', targetRPE: 7, notes: null },

            // Face Pulls 3x15-20
            { exerciseId: 'face_pull', setIndex: 1, prescribedReps: '15-20', targetRPE: 7, notes: null },
            { exerciseId: 'face_pull', setIndex: 2, prescribedReps: '15-20', targetRPE: 7, notes: null },
            { exerciseId: 'face_pull', setIndex: 3, prescribedReps: '15-20', targetRPE: 7, notes: null },
          ],
        },
        {
          dayOfWeek: 'Thu',
          name: 'Arms Day',
          sets: [
            // Barbell Curl 4x8-12
            { exerciseId: 'barbell_curl', setIndex: 1, prescribedReps: '8-12', targetRPE: 7.5, notes: null },
            { exerciseId: 'barbell_curl', setIndex: 2, prescribedReps: '8-12', targetRPE: 7.5, notes: null },
            { exerciseId: 'barbell_curl', setIndex: 3, prescribedReps: '8-12', targetRPE: 7.5, notes: null },
            { exerciseId: 'barbell_curl', setIndex: 4, prescribedReps: '8-12', targetRPE: 7.5, notes: null },

            // Skull Crushers 4x8-12
            { exerciseId: 'skull_crusher', setIndex: 1, prescribedReps: '8-12', targetRPE: 7.5, notes: null },
            { exerciseId: 'skull_crusher', setIndex: 2, prescribedReps: '8-12', targetRPE: 7.5, notes: null },
            { exerciseId: 'skull_crusher', setIndex: 3, prescribedReps: '8-12', targetRPE: 7.5, notes: null },
            { exerciseId: 'skull_crusher', setIndex: 4, prescribedReps: '8-12', targetRPE: 7.5, notes: null },

            // Hammer Curl 3x10-12
            { exerciseId: 'bicep_curl_hammer', setIndex: 1, prescribedReps: '10-12', targetRPE: 7, notes: null },
            { exerciseId: 'bicep_curl_hammer', setIndex: 2, prescribedReps: '10-12', targetRPE: 7, notes: null },
            { exerciseId: 'bicep_curl_hammer', setIndex: 3, prescribedReps: '10-12', targetRPE: 7, notes: null },

            // Tricep Pressdown 3x10-12
            { exerciseId: 'tricep_pressdown', setIndex: 1, prescribedReps: '10-12', targetRPE: 7, notes: null },
            { exerciseId: 'tricep_pressdown', setIndex: 2, prescribedReps: '10-12', targetRPE: 7, notes: null },
            { exerciseId: 'tricep_pressdown', setIndex: 3, prescribedReps: '10-12', targetRPE: 7, notes: null },

            // Preacher Curl 3x12-15
            { exerciseId: 'bicep_curl_preacher', setIndex: 1, prescribedReps: '12-15', targetRPE: 7, notes: null },
            { exerciseId: 'bicep_curl_preacher', setIndex: 2, prescribedReps: '12-15', targetRPE: 7, notes: null },
            { exerciseId: 'bicep_curl_preacher', setIndex: 3, prescribedReps: '12-15', targetRPE: 7, notes: null },

            // Overhead Cable Extension 3x12-15
            { exerciseId: 'tricep_overhead_cable', setIndex: 1, prescribedReps: '12-15', targetRPE: 7, notes: null },
            { exerciseId: 'tricep_overhead_cable', setIndex: 2, prescribedReps: '12-15', targetRPE: 7, notes: null },
            { exerciseId: 'tricep_overhead_cable', setIndex: 3, prescribedReps: '12-15', targetRPE: 7, notes: null },
          ],
        },
        {
          dayOfWeek: 'Fri',
          name: 'Leg Day',
          sets: [
            // Squat 4x8-12
            { exerciseId: 'squat', setIndex: 1, prescribedReps: '8-12', targetRPE: 7.5, notes: null },
            { exerciseId: 'squat', setIndex: 2, prescribedReps: '8-12', targetRPE: 7.5, notes: null },
            { exerciseId: 'squat', setIndex: 3, prescribedReps: '8-12', targetRPE: 7.5, notes: null },
            { exerciseId: 'squat', setIndex: 4, prescribedReps: '8-12', targetRPE: 7.5, notes: null },

            // Romanian Deadlift 4x8-12
            { exerciseId: 'rdl', setIndex: 1, prescribedReps: '8-12', targetRPE: 7.5, notes: null },
            { exerciseId: 'rdl', setIndex: 2, prescribedReps: '8-12', targetRPE: 7.5, notes: null },
            { exerciseId: 'rdl', setIndex: 3, prescribedReps: '8-12', targetRPE: 7.5, notes: null },
            { exerciseId: 'rdl', setIndex: 4, prescribedReps: '8-12', targetRPE: 7.5, notes: null },

            // Leg Press 3x12-15
            { exerciseId: 'leg_press', setIndex: 1, prescribedReps: '12-15', targetRPE: 7, notes: null },
            { exerciseId: 'leg_press', setIndex: 2, prescribedReps: '12-15', targetRPE: 7, notes: null },
            { exerciseId: 'leg_press', setIndex: 3, prescribedReps: '12-15', targetRPE: 7, notes: null },

            // Leg Curl 3x12-15
            { exerciseId: 'leg_curl', setIndex: 1, prescribedReps: '12-15', targetRPE: 7, notes: null },
            { exerciseId: 'leg_curl', setIndex: 2, prescribedReps: '12-15', targetRPE: 7, notes: null },
            { exerciseId: 'leg_curl', setIndex: 3, prescribedReps: '12-15', targetRPE: 7, notes: null },

            // Leg Extension 3x12-15
            { exerciseId: 'leg_extension', setIndex: 1, prescribedReps: '12-15', targetRPE: 7, notes: null },
            { exerciseId: 'leg_extension', setIndex: 2, prescribedReps: '12-15', targetRPE: 7, notes: null },
            { exerciseId: 'leg_extension', setIndex: 3, prescribedReps: '12-15', targetRPE: 7, notes: null },

            // Calf Raises 4x15-20
            { exerciseId: 'standing_calf_raise', setIndex: 1, prescribedReps: '15-20', targetRPE: 7, notes: null },
            { exerciseId: 'standing_calf_raise', setIndex: 2, prescribedReps: '15-20', targetRPE: 7, notes: null },
            { exerciseId: 'standing_calf_raise', setIndex: 3, prescribedReps: '15-20', targetRPE: 7, notes: null },
            { exerciseId: 'standing_calf_raise', setIndex: 4, prescribedReps: '15-20', targetRPE: 7, notes: null },
          ],
        },
      ],
    },
  ],
};

// ========================================
// GZCLP (GZCL Linear Progression)
// ========================================

const gzclp: ProgramTemplate = {
  id: 'gzclp_4day_v1',
  name: 'GZCLP',
  description: 'Tier-based linear progression with T1 (heavy 5x3+), T2 (moderate 3x10), and T3 (light 3x15+) exercises',
  goal: 'strength',
  experienceLevel: 'beginner',
  daysPerWeek: 4,
  weekCount: 12,
  intensityMethod: 'rpe',
  weeks: [
    {
      weekNumber: 1,
      days: [
        {
          dayOfWeek: 'Mon',
          name: 'Day 1 (Squat/Bench)',
          sets: [
            // T1: Squat 5x3+
            { exerciseId: 'squat', setIndex: 1, prescribedReps: '3', targetRPE: 7.5, notes: 'T1 main lift' },
            { exerciseId: 'squat', setIndex: 2, prescribedReps: '3', targetRPE: 7.5, notes: 'T1 main lift' },
            { exerciseId: 'squat', setIndex: 3, prescribedReps: '3', targetRPE: 7.5, notes: 'T1 main lift' },
            { exerciseId: 'squat', setIndex: 4, prescribedReps: '3', targetRPE: 7.5, notes: 'T1 main lift' },
            { exerciseId: 'squat', setIndex: 5, prescribedReps: '3+', targetRPE: 8, notes: 'T1 AMRAP' },

            // T2: Bench Press 3x10
            { exerciseId: 'bench_tng', setIndex: 1, prescribedReps: '10', targetRPE: 7, notes: 'T2 secondary' },
            { exerciseId: 'bench_tng', setIndex: 2, prescribedReps: '10', targetRPE: 7, notes: 'T2 secondary' },
            { exerciseId: 'bench_tng', setIndex: 3, prescribedReps: '10', targetRPE: 7, notes: 'T2 secondary' },

            // T3: Lat Pulldown 3x15+
            { exerciseId: 'lat_pulldown', setIndex: 1, prescribedReps: '15+', targetRPE: 6.5, notes: 'T3 accessory' },
            { exerciseId: 'lat_pulldown', setIndex: 2, prescribedReps: '15+', targetRPE: 6.5, notes: 'T3 accessory' },
            { exerciseId: 'lat_pulldown', setIndex: 3, prescribedReps: '15+', targetRPE: 6.5, notes: 'T3 accessory' },
          ],
        },
        {
          dayOfWeek: 'Tue',
          name: 'Day 2 (OHP/Deadlift)',
          sets: [
            // T1: Overhead Press 5x3+
            { exerciseId: 'ohp', setIndex: 1, prescribedReps: '3', targetRPE: 7.5, notes: 'T1 main lift' },
            { exerciseId: 'ohp', setIndex: 2, prescribedReps: '3', targetRPE: 7.5, notes: 'T1 main lift' },
            { exerciseId: 'ohp', setIndex: 3, prescribedReps: '3', targetRPE: 7.5, notes: 'T1 main lift' },
            { exerciseId: 'ohp', setIndex: 4, prescribedReps: '3', targetRPE: 7.5, notes: 'T1 main lift' },
            { exerciseId: 'ohp', setIndex: 5, prescribedReps: '3+', targetRPE: 8, notes: 'T1 AMRAP' },

            // T2: Deadlift 3x10
            { exerciseId: 'deadlift', setIndex: 1, prescribedReps: '10', targetRPE: 7, notes: 'T2 secondary' },
            { exerciseId: 'deadlift', setIndex: 2, prescribedReps: '10', targetRPE: 7, notes: 'T2 secondary' },
            { exerciseId: 'deadlift', setIndex: 3, prescribedReps: '10', targetRPE: 7, notes: 'T2 secondary' },

            // T3: DB Row 3x15+
            { exerciseId: 'db_row', setIndex: 1, prescribedReps: '15+', targetRPE: 6.5, notes: 'T3 accessory' },
            { exerciseId: 'db_row', setIndex: 2, prescribedReps: '15+', targetRPE: 6.5, notes: 'T3 accessory' },
            { exerciseId: 'db_row', setIndex: 3, prescribedReps: '15+', targetRPE: 6.5, notes: 'T3 accessory' },
          ],
        },
        {
          dayOfWeek: 'Thu',
          name: 'Day 3 (Bench/Squat)',
          sets: [
            // T1: Bench Press 5x3+
            { exerciseId: 'bench_tng', setIndex: 1, prescribedReps: '3', targetRPE: 7.5, notes: 'T1 main lift' },
            { exerciseId: 'bench_tng', setIndex: 2, prescribedReps: '3', targetRPE: 7.5, notes: 'T1 main lift' },
            { exerciseId: 'bench_tng', setIndex: 3, prescribedReps: '3', targetRPE: 7.5, notes: 'T1 main lift' },
            { exerciseId: 'bench_tng', setIndex: 4, prescribedReps: '3', targetRPE: 7.5, notes: 'T1 main lift' },
            { exerciseId: 'bench_tng', setIndex: 5, prescribedReps: '3+', targetRPE: 8, notes: 'T1 AMRAP' },

            // T2: Squat 3x10
            { exerciseId: 'squat', setIndex: 1, prescribedReps: '10', targetRPE: 7, notes: 'T2 secondary' },
            { exerciseId: 'squat', setIndex: 2, prescribedReps: '10', targetRPE: 7, notes: 'T2 secondary' },
            { exerciseId: 'squat', setIndex: 3, prescribedReps: '10', targetRPE: 7, notes: 'T2 secondary' },

            // T3: DB Fly 3x15+
            { exerciseId: 'db_fly', setIndex: 1, prescribedReps: '15+', targetRPE: 6.5, notes: 'T3 accessory' },
            { exerciseId: 'db_fly', setIndex: 2, prescribedReps: '15+', targetRPE: 6.5, notes: 'T3 accessory' },
            { exerciseId: 'db_fly', setIndex: 3, prescribedReps: '15+', targetRPE: 6.5, notes: 'T3 accessory' },
          ],
        },
        {
          dayOfWeek: 'Fri',
          name: 'Day 4 (Deadlift/OHP)',
          sets: [
            // T1: Deadlift 5x3+
            { exerciseId: 'deadlift', setIndex: 1, prescribedReps: '3', targetRPE: 7.5, notes: 'T1 main lift' },
            { exerciseId: 'deadlift', setIndex: 2, prescribedReps: '3', targetRPE: 7.5, notes: 'T1 main lift' },
            { exerciseId: 'deadlift', setIndex: 3, prescribedReps: '3', targetRPE: 7.5, notes: 'T1 main lift' },
            { exerciseId: 'deadlift', setIndex: 4, prescribedReps: '3', targetRPE: 7.5, notes: 'T1 main lift' },
            { exerciseId: 'deadlift', setIndex: 5, prescribedReps: '3+', targetRPE: 8, notes: 'T1 AMRAP' },

            // T2: Overhead Press 3x10
            { exerciseId: 'ohp', setIndex: 1, prescribedReps: '10', targetRPE: 7, notes: 'T2 secondary' },
            { exerciseId: 'ohp', setIndex: 2, prescribedReps: '10', targetRPE: 7, notes: 'T2 secondary' },
            { exerciseId: 'ohp', setIndex: 3, prescribedReps: '10', targetRPE: 7, notes: 'T2 secondary' },

            // T3: Lateral Raises 3x15+
            { exerciseId: 'lateral_raise', setIndex: 1, prescribedReps: '15+', targetRPE: 6.5, notes: 'T3 accessory' },
            { exerciseId: 'lateral_raise', setIndex: 2, prescribedReps: '15+', targetRPE: 6.5, notes: 'T3 accessory' },
            { exerciseId: 'lateral_raise', setIndex: 3, prescribedReps: '15+', targetRPE: 6.5, notes: 'T3 accessory' },
          ],
        },
      ],
    },
  ],
};

// Export all available programs
export const allPrograms: ProgramTemplate[] = [
  benchSpecialization5D,
  phul4Day,
  upperLower4Day,
  wendler531,
  startingStrength,
  strongLifts5x5,
  pushPullLegs,
  broSplit,
  gzclp,
];

// Get all exercises including custom ones from localStorage
export function getAllExercises(): Exercise[] {
  const customExercisesJson = typeof window !== 'undefined'
    ? localStorage.getItem('iron_brain_custom_exercises')
    : null;

  const customExercises: Exercise[] = customExercisesJson
    ? JSON.parse(customExercisesJson)
    : [];

  return [...defaultExercises, ...customExercises];
}
