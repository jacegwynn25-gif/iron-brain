/**
 * Iron Brain - Evidence-Based Training Configuration
 *
 * Based on 2024/2025 research:
 * - RP Strength Volume Landmarks (Dr. Mike Israetel)
 * - Stretch-Mediated Hypertrophy (Pedrosa et al. 2023, Maeo et al. 2022)
 * - Frequency-Volume Relationship (Schoenfeld 2016, 2019)
 * - NSCA/ACSM Position Stands on Rep Ranges
 * - Juggernaut Training Systems Periodization (CWS)
 *
 * Key Principles:
 * 1. Rep ranges MUST match training goal (strength vs hypertrophy vs peaking)
 * 2. Lengthened partials > Full ROM > Shortened partials for hypertrophy
 * 3. Volume must be distributed to avoid junk volume (>10 sets/session)
 * 4. Powerlifting requires periodized blocks: Hypertrophy → Strength → Peaking
 */

// ============================================
// TRAINING GOAL TYPES
// ============================================

export type TrainingGoal = 'hypertrophy' | 'strength' | 'powerlifting' | 'peaking' | 'general';

/**
 * Goal-specific rep range guidelines based on research:
 * - NSCA: Strength = 1-6 @ 80-100% 1RM
 * - ACSM: Hypertrophy = 6-12 @ 67-85% 1RM
 * - Juggernaut: Peaking = 1-3 reps (singles, doubles, triples)
 */
export interface Range {
  min: number;
  max: number;
}

type MovementCategory = 'compound' | 'isolation';

export interface MovementRangePreference {
  compound?: Partial<Range>;
  isolation?: Partial<Range>;
}

export type RepRangePreference = MovementRangePreference;
export type RIRPreference = MovementRangePreference;

interface WeeklyRangeAdjustment {
  start: Range;
  end: Range;
}

// ============================================
// VOLUME LANDMARKS
// ============================================

export interface VolumeLandmark {
  muscle: string;
  /** Maintenance Volume - minimum to prevent atrophy */
  MV: number;
  /** Minimum Effective Volume - minimum for growth */
  MEV: number;
  /** Maximum Adaptive Volume - "sweet spot" for most lifters */
  MAV: { min: number; max: number };
  /** Maximum Recoverable Volume - ceiling before overreaching */
  MRV: number;
  /** Recovery modifier (1.0 = average, 0.8 = slow recoverer, 1.2 = fast) */
  recoveryFactor: number;
  /** Frequency recommendations based on volume */
  frequencyGuide: {
    lowVolume: number;   // sets < 12
    medVolume: number;   // sets 12-16
    highVolume: number;  // sets > 16
  };
  /** Notes for the user */
  notes: string;
}

export const VOLUME_LANDMARKS: Record<string, VolumeLandmark> = {
  // ========== PUSH MUSCLES ==========
  chest: {
    muscle: 'Chest',
    MV: 6,
    MEV: 10,
    MAV: { min: 12, max: 18 },
    MRV: 22,
    recoveryFactor: 1.0,
    frequencyGuide: { lowVolume: 2, medVolume: 2, highVolume: 3 },
    notes: 'Responds well to stretch (incline/dips). Front delts often limit pressing before chest fails.',
  },

  frontDelts: {
    muscle: 'Front Delts',
    MV: 0,
    MEV: 0, // Usually enough from pressing
    MAV: { min: 0, max: 6 },
    MRV: 12,
    recoveryFactor: 1.0,
    frequencyGuide: { lowVolume: 2, medVolume: 2, highVolume: 3 },
    notes: 'Rarely needs direct work. Chest/shoulder pressing provides sufficient stimulus.',
  },

  sideDelts: {
    muscle: 'Side Delts',
    MV: 6,
    MEV: 8,
    MAV: { min: 12, max: 20 },
    MRV: 26,
    recoveryFactor: 1.2, // Recovers fast
    frequencyGuide: { lowVolume: 2, medVolume: 3, highVolume: 4 },
    notes: 'High MRV, recovers quickly. Responds to high frequency. Prioritize behind-body lateral raises for stretch.',
  },

  rearDelts: {
    muscle: 'Rear Delts',
    MV: 4,
    MEV: 6,
    MAV: { min: 10, max: 16 },
    MRV: 20,
    recoveryFactor: 1.2,
    frequencyGuide: { lowVolume: 2, medVolume: 3, highVolume: 4 },
    notes: 'Often undertrained. Face pulls and rear delt flyes. Some volume from rows.',
  },

  triceps: {
    muscle: 'Triceps',
    MV: 4,
    MEV: 6,
    MAV: { min: 10, max: 14 },
    MRV: 18,
    recoveryFactor: 1.0,
    frequencyGuide: { lowVolume: 2, medVolume: 2, highVolume: 3 },
    notes: 'Long head responds to overhead work (stretch). Gets significant volume from pressing.',
  },

  // ========== PULL MUSCLES ==========
  back: {
    muscle: 'Back (Lats/Upper)',
    MV: 6,
    MEV: 10,
    MAV: { min: 12, max: 18 },
    MRV: 25,
    recoveryFactor: 1.0,
    frequencyGuide: { lowVolume: 2, medVolume: 2, highVolume: 3 },
    notes: 'High volume tolerance. Prioritize full stretch at bottom. Separate lat work from upper back.',
  },

  biceps: {
    muscle: 'Biceps',
    MV: 4,
    MEV: 6,
    MAV: { min: 10, max: 16 },
    MRV: 20,
    recoveryFactor: 1.1,
    frequencyGuide: { lowVolume: 2, medVolume: 3, highVolume: 4 },
    notes: 'Responds to stretch (incline curls). Gets indirect volume from pulling. Long head needs arm-behind-body work.',
  },

  // ========== LEG MUSCLES ==========
  quads: {
    muscle: 'Quadriceps',
    MV: 6,
    MEV: 8,
    MAV: { min: 12, max: 16 },
    MRV: 20,
    recoveryFactor: 0.9, // Slower recovery due to size
    frequencyGuide: { lowVolume: 2, medVolume: 2, highVolume: 3 },
    notes: 'Deep knee flexion critical for rectus femoris. Leg extensions with full stretch at bottom.',
  },

  hamstrings: {
    muscle: 'Hamstrings',
    MV: 4,
    MEV: 6,
    MAV: { min: 10, max: 14 },
    MRV: 18,
    recoveryFactor: 0.9,
    frequencyGuide: { lowVolume: 2, medVolume: 2, highVolume: 3 },
    notes: 'Two functions: knee flexion AND hip extension. Train both. RDLs for hip hinge, leg curls for knee flexion.',
  },

  glutes: {
    muscle: 'Glutes',
    MV: 4,
    MEV: 6,
    MAV: { min: 10, max: 16 },
    MRV: 20,
    recoveryFactor: 0.9,
    frequencyGuide: { lowVolume: 2, medVolume: 2, highVolume: 3 },
    notes: 'Hip thrusts, deep squats, RDLs. Responds to high stretch under load.',
  },

  calves: {
    muscle: 'Calves',
    MV: 6,
    MEV: 8,
    MAV: { min: 12, max: 16 },
    MRV: 20,
    recoveryFactor: 1.2,
    frequencyGuide: { lowVolume: 3, medVolume: 4, highVolume: 6 },
    notes: 'High frequency tolerance. Full stretch at bottom critical. Both seated (soleus) and standing (gastroc).',
  },

  // ========== CORE ==========
  abs: {
    muscle: 'Abs',
    MV: 0,
    MEV: 4,
    MAV: { min: 8, max: 16 },
    MRV: 20,
    recoveryFactor: 1.2,
    frequencyGuide: { lowVolume: 2, medVolume: 3, highVolume: 4 },
    notes: 'Often get indirect work from compounds. Direct work: weighted stretching movements (cable crunches).',
  },
};

// ============================================
// EXERCISE TIER LIST
// Based on Stretch-Mediated Hypertrophy Research
// ============================================

export type ExerciseTier = 'S' | 'A' | 'B' | 'C';

export interface ExerciseConfig {
  id: string;
  name: string;
  tier: ExerciseTier;
  primaryMuscle: string;
  secondaryMuscles: string[];
  equipment: ('barbell' | 'dumbbell' | 'cable' | 'machine' | 'bodyweight')[];
  /** Does this exercise load the muscle in a lengthened position? */
  stretchFocused: boolean;
  /** Compound = multiple joints, Isolation = single joint */
  movementType: 'compound' | 'isolation';
  /** Recommended RIR (Reps in Reserve) */
  recommendedRIR: { min: number; max: number };
  /** Default rep range (hypertrophy-focused) */
  repRange: { min: number; max: number };
  /** Notes on execution */
  executionNotes: string;
}

/**
 * TIER DEFINITIONS:
 * S = Superior stimulus. Lengthened overload, compound, high SFR.
 * A = Great choice. Either compound or isolation with good stretch.
 * B = Good option. Works but not optimal for hypertrophy.
 * C = Acceptable. Use when other options unavailable.
 */

export const EXERCISE_TIER_LIST: ExerciseConfig[] = [
  // ========== CHEST ==========
  {
    id: 'incline_db_press',
    name: 'Incline Dumbbell Press',
    tier: 'S',
    primaryMuscle: 'chest',
    secondaryMuscles: ['frontDelts', 'triceps'],
    equipment: ['dumbbell'],
    stretchFocused: true,
    movementType: 'compound',
    recommendedRIR: { min: 2, max: 3 },
    repRange: { min: 6, max: 12 },
    executionNotes: 'Let DBs stretch at bottom. 30-45 degree incline. Full ROM.',
  },
  {
    id: 'dip',
    name: 'Weighted Dip',
    tier: 'S',
    primaryMuscle: 'chest',
    secondaryMuscles: ['triceps', 'frontDelts'],
    equipment: ['bodyweight'],
    stretchFocused: true,
    movementType: 'compound',
    recommendedRIR: { min: 2, max: 3 },
    repRange: { min: 6, max: 12 },
    executionNotes: 'Forward lean for chest. Deep stretch at bottom. Add weight when possible.',
  },
  {
    id: 'cable_fly_low',
    name: 'Low Cable Fly (Incline)',
    tier: 'S',
    primaryMuscle: 'chest',
    secondaryMuscles: [],
    equipment: ['cable'],
    stretchFocused: true,
    movementType: 'isolation',
    recommendedRIR: { min: 0, max: 2 },
    repRange: { min: 10, max: 15 },
    executionNotes: 'Cables from low position. Maximum stretch at bottom. Control eccentric.',
  },
  {
    id: 'bench_tng',
    name: 'Barbell Bench Press',
    tier: 'A',
    primaryMuscle: 'chest',
    secondaryMuscles: ['frontDelts', 'triceps'],
    equipment: ['barbell'],
    stretchFocused: false, // Bar limits ROM
    movementType: 'compound',
    recommendedRIR: { min: 2, max: 3 },
    repRange: { min: 5, max: 10 },
    executionNotes: 'Touch chest. Arch slightly for safety. Good for strength progression.',
  },
  {
    id: 'db_bench_press',
    name: 'Dumbbell Bench Press',
    tier: 'A',
    primaryMuscle: 'chest',
    secondaryMuscles: ['frontDelts', 'triceps'],
    equipment: ['dumbbell'],
    stretchFocused: true,
    movementType: 'compound',
    recommendedRIR: { min: 2, max: 3 },
    repRange: { min: 6, max: 12 },
    executionNotes: 'Let DBs stretch past chest level. Retract scapula.',
  },
  {
    id: 'pec_deck',
    name: 'Pec Deck / Machine Fly',
    tier: 'B',
    primaryMuscle: 'chest',
    secondaryMuscles: [],
    equipment: ['machine'],
    stretchFocused: true,
    movementType: 'isolation',
    recommendedRIR: { min: 0, max: 2 },
    repRange: { min: 10, max: 15 },
    executionNotes: 'Stretch at bottom. Squeeze at top. Constant tension.',
  },
  {
    id: 'chest_press_machine',
    name: 'Machine Chest Press',
    tier: 'B',
    primaryMuscle: 'chest',
    secondaryMuscles: ['frontDelts', 'triceps'],
    equipment: ['machine'],
    stretchFocused: false,
    movementType: 'compound',
    recommendedRIR: { min: 1, max: 3 },
    repRange: { min: 8, max: 12 },
    executionNotes: 'Good for beginners or high fatigue days. Adjust seat for stretch.',
  },

  // ========== BACK ==========
  {
    id: 'lat_pulldown',
    name: 'Lat Pulldown (Full Stretch)',
    tier: 'S',
    primaryMuscle: 'back',
    secondaryMuscles: ['biceps', 'rearDelts'],
    equipment: ['cable'],
    stretchFocused: true,
    movementType: 'compound',
    recommendedRIR: { min: 1, max: 3 },
    repRange: { min: 8, max: 12 },
    executionNotes: 'Full stretch at top. Let scapula elevate. Controlled eccentric.',
  },
  {
    id: 'pullup',
    name: 'Pull-Up / Chin-Up',
    tier: 'S',
    primaryMuscle: 'back',
    secondaryMuscles: ['biceps', 'rearDelts'],
    equipment: ['bodyweight'],
    stretchFocused: true,
    movementType: 'compound',
    recommendedRIR: { min: 1, max: 3 },
    repRange: { min: 5, max: 12 },
    executionNotes: 'Dead hang at bottom for stretch. Add weight when needed.',
  },
  {
    id: 'cable_pullover',
    name: 'Cable Pullover',
    tier: 'S',
    primaryMuscle: 'back',
    secondaryMuscles: ['triceps'],
    equipment: ['cable'],
    stretchFocused: true,
    movementType: 'isolation',
    recommendedRIR: { min: 0, max: 2 },
    repRange: { min: 10, max: 15 },
    executionNotes: 'Maximum stretch overhead. Keep arms relatively straight. Lat isolation.',
  },
  {
    id: 'bent_over_row',
    name: 'Barbell Row',
    tier: 'A',
    primaryMuscle: 'back',
    secondaryMuscles: ['biceps', 'rearDelts', 'hamstrings'],
    equipment: ['barbell'],
    stretchFocused: false,
    movementType: 'compound',
    recommendedRIR: { min: 2, max: 3 },
    repRange: { min: 6, max: 10 },
    executionNotes: 'Hinge at hips. Pull to lower chest. Good for overall back mass.',
  },
  {
    id: 'row_cable',
    name: 'Seated Cable Row',
    tier: 'A',
    primaryMuscle: 'back',
    secondaryMuscles: ['biceps', 'rearDelts'],
    equipment: ['cable'],
    stretchFocused: true,
    movementType: 'compound',
    recommendedRIR: { min: 1, max: 3 },
    repRange: { min: 8, max: 12 },
    executionNotes: 'Allow scapula to protract at stretch. Chest-supported option reduces fatigue.',
  },
  {
    id: 'db_row',
    name: 'Dumbbell Row',
    tier: 'A',
    primaryMuscle: 'back',
    secondaryMuscles: ['biceps', 'rearDelts'],
    equipment: ['dumbbell'],
    stretchFocused: true,
    movementType: 'compound',
    recommendedRIR: { min: 1, max: 3 },
    repRange: { min: 8, max: 12 },
    executionNotes: 'Full stretch at bottom. Brace on bench. Great unilateral option.',
  },

  // ========== SHOULDERS ==========
  {
    id: 'ohp',
    name: 'Overhead Press',
    tier: 'A',
    primaryMuscle: 'frontDelts',
    secondaryMuscles: ['triceps', 'sideDelts'],
    equipment: ['barbell'],
    stretchFocused: false,
    movementType: 'compound',
    recommendedRIR: { min: 2, max: 3 },
    repRange: { min: 5, max: 10 },
    executionNotes: 'Strict press. Lockout overhead. Primary strength movement.',
  },
  {
    id: 'db_shoulder_press',
    name: 'Dumbbell Shoulder Press',
    tier: 'A',
    primaryMuscle: 'frontDelts',
    secondaryMuscles: ['triceps', 'sideDelts'],
    equipment: ['dumbbell'],
    stretchFocused: true,
    movementType: 'compound',
    recommendedRIR: { min: 2, max: 3 },
    repRange: { min: 6, max: 12 },
    executionNotes: 'Allows deeper stretch than barbell. Seated or standing.',
  },
  {
    id: 'cable_lateral_behind',
    name: 'Behind-Body Cable Lateral Raise',
    tier: 'S',
    primaryMuscle: 'sideDelts',
    secondaryMuscles: [],
    equipment: ['cable'],
    stretchFocused: true,
    movementType: 'isolation',
    recommendedRIR: { min: 0, max: 2 },
    repRange: { min: 12, max: 20 },
    executionNotes: 'Cable behind body for stretch. Single arm. The best side delt exercise per 2024 research.',
  },
  {
    id: 'lateral_raise',
    name: 'Dumbbell Lateral Raise',
    tier: 'A',
    primaryMuscle: 'sideDelts',
    secondaryMuscles: [],
    equipment: ['dumbbell'],
    stretchFocused: false,
    movementType: 'isolation',
    recommendedRIR: { min: 0, max: 2 },
    repRange: { min: 12, max: 20 },
    executionNotes: 'Slight forward lean. Lead with elbows. High frequency friendly.',
  },
  {
    id: 'face_pull',
    name: 'Face Pull',
    tier: 'A',
    primaryMuscle: 'rearDelts',
    secondaryMuscles: ['back'],
    equipment: ['cable'],
    stretchFocused: true,
    movementType: 'isolation',
    recommendedRIR: { min: 0, max: 2 },
    repRange: { min: 12, max: 20 },
    executionNotes: 'External rotation at end. Full stretch forward. Great for shoulder health.',
  },
  {
    id: 'rear_delt_fly',
    name: 'Rear Delt Fly',
    tier: 'A',
    primaryMuscle: 'rearDelts',
    secondaryMuscles: [],
    equipment: ['dumbbell', 'cable', 'machine'],
    stretchFocused: true,
    movementType: 'isolation',
    recommendedRIR: { min: 0, max: 2 },
    repRange: { min: 12, max: 20 },
    executionNotes: 'Stretch at bottom. Keep arms slightly bent. Machine version great for stability.',
  },

  // ========== ARMS ==========
  {
    id: 'incline_curl',
    name: 'Incline Dumbbell Curl',
    tier: 'S',
    primaryMuscle: 'biceps',
    secondaryMuscles: [],
    equipment: ['dumbbell'],
    stretchFocused: true,
    movementType: 'isolation',
    recommendedRIR: { min: 0, max: 2 },
    repRange: { min: 8, max: 12 },
    executionNotes: 'Arm behind body = max long head stretch. 45-60 degree incline. Best bicep exercise.',
  },
  {
    id: 'preacher_curl',
    name: 'Preacher Curl',
    tier: 'A',
    primaryMuscle: 'biceps',
    secondaryMuscles: [],
    equipment: ['barbell', 'dumbbell', 'machine'],
    stretchFocused: true,
    movementType: 'isolation',
    recommendedRIR: { min: 0, max: 2 },
    repRange: { min: 8, max: 12 },
    executionNotes: 'Great stretch at bottom. Targets short head. Control eccentric.',
  },
  {
    id: 'barbell_curl',
    name: 'Barbell Curl',
    tier: 'B',
    primaryMuscle: 'biceps',
    secondaryMuscles: [],
    equipment: ['barbell'],
    stretchFocused: false,
    movementType: 'isolation',
    recommendedRIR: { min: 1, max: 2 },
    repRange: { min: 6, max: 12 },
    executionNotes: 'Good for progressive overload. Strict form, no swinging.',
  },
  {
    id: 'tricep_overhead_cable',
    name: 'Overhead Cable Extension',
    tier: 'S',
    primaryMuscle: 'triceps',
    secondaryMuscles: [],
    equipment: ['cable'],
    stretchFocused: true,
    movementType: 'isolation',
    recommendedRIR: { min: 0, max: 2 },
    repRange: { min: 10, max: 15 },
    executionNotes: 'Deep stretch on long head. Elbows high. Best tricep exercise for hypertrophy.',
  },
  {
    id: 'skull_crusher',
    name: 'Skull Crusher / Lying Extension',
    tier: 'S',
    primaryMuscle: 'triceps',
    secondaryMuscles: [],
    equipment: ['barbell', 'dumbbell'],
    stretchFocused: true,
    movementType: 'isolation',
    recommendedRIR: { min: 1, max: 2 },
    repRange: { min: 8, max: 12 },
    executionNotes: 'Lower behind head for stretch. Ez-bar easier on wrists.',
  },
  {
    id: 'tricep_pressdown',
    name: 'Cable Pressdown',
    tier: 'B',
    primaryMuscle: 'triceps',
    secondaryMuscles: [],
    equipment: ['cable'],
    stretchFocused: false,
    movementType: 'isolation',
    recommendedRIR: { min: 0, max: 2 },
    repRange: { min: 10, max: 15 },
    executionNotes: 'Good pump finisher. Less stretch = less growth potential. Use after overhead work.',
  },

  // ========== LEGS ==========
  {
    id: 'squat',
    name: 'Back Squat (Deep)',
    tier: 'S',
    primaryMuscle: 'quads',
    secondaryMuscles: ['glutes', 'hamstrings'],
    equipment: ['barbell'],
    stretchFocused: true,
    movementType: 'compound',
    recommendedRIR: { min: 2, max: 3 },
    repRange: { min: 5, max: 10 },
    executionNotes: 'Full depth (below parallel). Stretch on rectus femoris critical. King of leg exercises.',
  },
  {
    id: 'hack_squat',
    name: 'Hack Squat (Deep)',
    tier: 'S',
    primaryMuscle: 'quads',
    secondaryMuscles: ['glutes'],
    equipment: ['machine'],
    stretchFocused: true,
    movementType: 'compound',
    recommendedRIR: { min: 1, max: 3 },
    repRange: { min: 8, max: 12 },
    executionNotes: 'Full depth. Narrow stance for quad focus. Less spinal load than barbell.',
  },
  {
    id: 'leg_extension',
    name: 'Leg Extension (Full ROM)',
    tier: 'A',
    primaryMuscle: 'quads',
    secondaryMuscles: [],
    equipment: ['machine'],
    stretchFocused: true,
    movementType: 'isolation',
    recommendedRIR: { min: 0, max: 2 },
    repRange: { min: 10, max: 15 },
    executionNotes: 'Full stretch at bottom (knee flexed). Partials in stretched position = gold.',
  },
  {
    id: 'leg_press',
    name: 'Leg Press (Deep)',
    tier: 'A',
    primaryMuscle: 'quads',
    secondaryMuscles: ['glutes', 'hamstrings'],
    equipment: ['machine'],
    stretchFocused: true,
    movementType: 'compound',
    recommendedRIR: { min: 1, max: 3 },
    repRange: { min: 8, max: 15 },
    executionNotes: 'Deep knee bend. Lower back stays on pad. Good for volume accumulation.',
  },
  {
    id: 'rdl',
    name: 'Romanian Deadlift',
    tier: 'S',
    primaryMuscle: 'hamstrings',
    secondaryMuscles: ['glutes', 'back'],
    equipment: ['barbell', 'dumbbell'],
    stretchFocused: true,
    movementType: 'compound',
    recommendedRIR: { min: 2, max: 3 },
    repRange: { min: 6, max: 10 },
    executionNotes: 'Maximum hamstring stretch. Hinge at hips. Slight knee bend. Best hip hinge.',
  },
  {
    id: 'leg_curl',
    name: 'Lying/Seated Leg Curl',
    tier: 'A',
    primaryMuscle: 'hamstrings',
    secondaryMuscles: [],
    equipment: ['machine'],
    stretchFocused: true,
    movementType: 'isolation',
    recommendedRIR: { min: 0, max: 2 },
    repRange: { min: 10, max: 15 },
    executionNotes: 'Hip flexed position (seated) = more stretch. Lying version also good.',
  },
  {
    id: 'hip_thrust',
    name: 'Hip Thrust',
    tier: 'A',
    primaryMuscle: 'glutes',
    secondaryMuscles: ['hamstrings'],
    equipment: ['barbell'],
    stretchFocused: false,
    movementType: 'compound',
    recommendedRIR: { min: 1, max: 3 },
    repRange: { min: 8, max: 12 },
    executionNotes: 'Squeeze at top. Primary glute builder. Bench at lower back level.',
  },
  {
    id: 'calf_raise_standing',
    name: 'Standing Calf Raise',
    tier: 'A',
    primaryMuscle: 'calves',
    secondaryMuscles: [],
    equipment: ['machine', 'barbell'],
    stretchFocused: true,
    movementType: 'isolation',
    recommendedRIR: { min: 0, max: 2 },
    repRange: { min: 10, max: 15 },
    executionNotes: 'Full stretch at bottom. Pause in stretched position. Targets gastroc.',
  },
  {
    id: 'calf_raise_seated',
    name: 'Seated Calf Raise',
    tier: 'A',
    primaryMuscle: 'calves',
    secondaryMuscles: [],
    equipment: ['machine'],
    stretchFocused: true,
    movementType: 'isolation',
    recommendedRIR: { min: 0, max: 2 },
    repRange: { min: 12, max: 20 },
    executionNotes: 'Knee bent = targets soleus. Full stretch critical. Higher reps work well.',
  },

  // ========== CORE ==========
  {
    id: 'cable_crunch',
    name: 'Cable Crunch (Weighted)',
    tier: 'A',
    primaryMuscle: 'abs',
    secondaryMuscles: [],
    equipment: ['cable'],
    stretchFocused: true,
    movementType: 'isolation',
    recommendedRIR: { min: 1, max: 2 },
    repRange: { min: 10, max: 15 },
    executionNotes: 'Full stretch at top. Crunch through abs, not hip flexors. Progressive overload.',
  },
  {
    id: 'hanging_leg_raise',
    name: 'Hanging Leg Raise',
    tier: 'A',
    primaryMuscle: 'abs',
    secondaryMuscles: [],
    equipment: ['bodyweight'],
    stretchFocused: true,
    movementType: 'isolation',
    recommendedRIR: { min: 1, max: 2 },
    repRange: { min: 8, max: 15 },
    executionNotes: 'Stretch at bottom. Curl pelvis up, don\'t just lift legs. Add weight when easy.',
  },
];

// ============================================
// HELPER FUNCTIONS
// ============================================

/**
 * Get exercises for a specific muscle, optionally filtered by tier
 */
export function getExercisesForMuscle(
  muscle: string,
  minTier: ExerciseTier = 'C'
): ExerciseConfig[] {
  const tierOrder: ExerciseTier[] = ['S', 'A', 'B', 'C'];
  const minTierIndex = tierOrder.indexOf(minTier);

  return EXERCISE_TIER_LIST.filter(ex => {
    const isPrimary = ex.primaryMuscle === muscle;
    const isSecondary = ex.secondaryMuscles.includes(muscle);
    const meetsMinTier = tierOrder.indexOf(ex.tier) <= minTierIndex;
    return (isPrimary || isSecondary) && meetsMinTier;
  }).sort((a, b) => tierOrder.indexOf(a.tier) - tierOrder.indexOf(b.tier));
}

/**
 * Get stretch-focused exercises (priority for hypertrophy)
 */
export function getStretchFocusedExercises(muscle: string): ExerciseConfig[] {
  return EXERCISE_TIER_LIST.filter(
    ex => (ex.primaryMuscle === muscle || ex.secondaryMuscles.includes(muscle)) && ex.stretchFocused
  );
}

/**
 * Calculate recommended weekly volume based on experience level
 */
export function getRecommendedVolume(
  muscle: string,
  experience: 'beginner' | 'intermediate' | 'advanced',
  recoveryCapacity: 'low' | 'average' | 'high' = 'average'
): { min: number; max: number; frequency: number } {
  const landmark = VOLUME_LANDMARKS[muscle];
  if (!landmark) {
    return { min: 10, max: 14, frequency: 2 }; // Default
  }

  const recoveryMod = recoveryCapacity === 'low' ? 0.8 : recoveryCapacity === 'high' ? 1.1 : 1.0;

  let min: number;
  let max: number;

  switch (experience) {
    case 'beginner':
      min = landmark.MEV;
      max = landmark.MAV.min;
      break;
    case 'intermediate':
      min = landmark.MAV.min;
      max = landmark.MAV.max;
      break;
    case 'advanced':
      min = landmark.MAV.max;
      max = Math.round(landmark.MRV * recoveryMod);
      break;
  }

  // Determine frequency based on volume
  let frequency: number;
  if (max <= 12) {
    frequency = landmark.frequencyGuide.lowVolume;
  } else if (max <= 16) {
    frequency = landmark.frequencyGuide.medVolume;
  } else {
    frequency = landmark.frequencyGuide.highVolume;
  }

  return { min, max, frequency };
}

/**
 * Check if a session has too many sets for a single muscle (junk volume)
 */
export function isJunkVolume(setsPerSession: number): boolean {
  // Research suggests >10 sets/muscle/session leads to diminishing returns
  return setsPerSession > 10;
}

const BASE_REP_RANGE_BY_GOAL: Record<TrainingGoal, Record<MovementCategory, Range>> = {
  hypertrophy: {
    compound: { min: 5, max: 12 },
    isolation: { min: 8, max: 15 },
  },
  strength: {
    compound: { min: 3, max: 6 },
    isolation: { min: 6, max: 12 },
  },
  powerlifting: {
    compound: { min: 3, max: 5 },
    isolation: { min: 8, max: 12 },
  },
  peaking: {
    compound: { min: 1, max: 3 },
    isolation: { min: 6, max: 10 },
  },
  general: {
    compound: { min: 6, max: 12 },
    isolation: { min: 8, max: 15 },
  },
};

const REP_RANGE_PROGRESSIONS: Record<TrainingGoal, WeeklyRangeAdjustment> = {
  hypertrophy: {
    start: { min: 2, max: 2 },
    end: { min: -1, max: -1 },
  },
  strength: {
    start: { min: 0, max: 0 },
    end: { min: -1, max: -2 },
  },
  powerlifting: {
    start: { min: 0, max: 0 },
    end: { min: -2, max: -3 },
  },
  peaking: {
    start: { min: -1, max: -1 },
    end: { min: -2, max: -2 },
  },
  general: {
    start: { min: 0, max: 0 },
    end: { min: -1, max: -1 },
  },
};

const BASE_RIR_BY_GOAL: Record<TrainingGoal, Record<MovementCategory, Range>> = {
  hypertrophy: {
    compound: { min: 1, max: 3 },
    isolation: { min: 0, max: 2 },
  },
  strength: {
    compound: { min: 2, max: 4 },
    isolation: { min: 1, max: 3 },
  },
  powerlifting: {
    compound: { min: 2, max: 4 },
    isolation: { min: 1, max: 3 },
  },
  peaking: {
    compound: { min: 1, max: 2 },
    isolation: { min: 1, max: 2 },
  },
  general: {
    compound: { min: 1, max: 3 },
    isolation: { min: 0, max: 2 },
  },
};

function getMovementCategory(exercise: ExerciseConfig): MovementCategory {
  return exercise.movementType === 'isolation' ? 'isolation' : 'compound';
}

function normalizeRange(range: Range): Range {
  const min = Math.max(1, Math.round(range.min));
  const max = Math.max(min, Math.round(range.max));
  return { min, max };
}

function applyPreferenceToRange(base: Range, preference?: Partial<Range>): Range {
  if (!preference) return base;
  return {
    min: preference.min ?? base.min,
    max: preference.max ?? base.max,
  };
}

function addRangeAdjustment(base: Range, adjustment: Range): Range {
  return {
    min: base.min + adjustment.min,
    max: base.max + adjustment.max,
  };
}

function interpolateRangeAdjustment(adjustment: WeeklyRangeAdjustment, progress: number): Range {
  return {
    min: adjustment.start.min + (adjustment.end.min - adjustment.start.min) * progress,
    max: adjustment.start.max + (adjustment.end.max - adjustment.start.max) * progress,
  };
}

export function getWeekProgress(weekNumber?: number, totalWeeks?: number): number {
  if (!weekNumber || !totalWeeks || totalWeeks <= 1) {
    return 0;
  }

  const clampedWeek = Math.min(Math.max(1, weekNumber), totalWeeks);
  return (clampedWeek - 1) / (totalWeeks - 1);
}

/**
 * Get intensity recommendation (RIR) based on movement type
 */
export function getIntensityRecommendation(
  movementType: 'compound' | 'isolation'
): { minRIR: number; maxRIR: number } {
  if (movementType === 'compound') {
    return { minRIR: 2, maxRIR: 3 }; // Safety buffer for heavy compounds
  }
  return { minRIR: 0, maxRIR: 1 }; // Can push closer to failure on isolations
}

/**
 * Get goal-specific rep range for an exercise
 *
 * Based on:
 * - NSCA: Strength = 1-6 reps @ 80-100% 1RM
 * - ACSM: Hypertrophy = 6-12 reps @ 67-85% 1RM
 * - Juggernaut: Peaking = 1-3 reps (singles, doubles, triples)
 * - NSCA: Endurance = 15+ reps @ <67% 1RM
 */
/**
 * Returns a goal-aware rep range, adjusted for week progress and optional user overrides.
 */
export function getRepRangeForGoal(
  exercise: ExerciseConfig,
  goal: TrainingGoal,
  options?: {
    weekNumber?: number;
    totalWeeks?: number;
    preference?: RepRangePreference;
  }
): Range {
  const movement = getMovementCategory(exercise);
  const goalRange = BASE_REP_RANGE_BY_GOAL[goal]?.[movement];
  const baseRange = goal === 'general' ? exercise.repRange : goalRange ?? exercise.repRange;

  const preferredRange = applyPreferenceToRange(
    baseRange,
    options?.preference?.[movement]
  );

  const weekProgress = getWeekProgress(options?.weekNumber, options?.totalWeeks);
  const progression = REP_RANGE_PROGRESSIONS[goal] ?? REP_RANGE_PROGRESSIONS.general;
  const adjustment = interpolateRangeAdjustment(progression, weekProgress);
  const adjustedRange = addRangeAdjustment(preferredRange, adjustment);

  return normalizeRange(adjustedRange);
}

/**
 * Get goal-specific RIR (Reps in Reserve) recommendations
 *
 * Based on:
 * - Strength/Peaking: Higher RIR (2-4) to preserve CNS
 * - Hypertrophy: Lower RIR (0-2) for metabolic stress
 */
/**
 * Returns a base RIR range for the goal with optional user overrides.
 */
export function getRIRForGoal(
  exercise: ExerciseConfig,
  goal: TrainingGoal,
  options?: {
    weekNumber?: number;
    totalWeeks?: number;
    preference?: RIRPreference;
  }
): Range {
  const movement = getMovementCategory(exercise);
  const baseRange = BASE_RIR_BY_GOAL[goal]?.[movement] ?? exercise.recommendedRIR;
  const preferredRange = applyPreferenceToRange(
    baseRange,
    options?.preference?.[movement]
  );

  return normalizeRange(preferredRange);
}

/**
 * Get goal-specific volume adjustments
 * Returns a multiplier for weekly sets
 */
export function getVolumeMultiplierForGoal(goal: TrainingGoal): number {
  switch (goal) {
    case 'strength':
      return 0.8;  // Lower volume, higher intensity
    case 'powerlifting':
      return 0.85; // Moderate volume in strength block
    case 'peaking':
      return 0.5;  // Significantly reduced volume, maintain intensity
    case 'hypertrophy':
      return 1.0;  // Full volume
    case 'general':
    default:
      return 0.9;  // Slightly reduced for balance
  }
}
