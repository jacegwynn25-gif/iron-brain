/**
 * Cross-Muscle Fatigue Spillover Matrix
 *
 * Models how fatigue in one muscle affects adjacent and synergistic muscles.
 * This captures biomechanical relationships beyond direct exercise involvement.
 *
 * Examples:
 * - Fatigued triceps increase shoulder stabilizer demand → front delt fatigue
 * - Fatigued quads shift load to hamstrings → increased hamstring strain
 * - Fatigued abs reduce spinal stability → increased erector spinae load
 *
 * Research Foundation:
 * - McGill (2007): Core stability and load transfer
 * - Schoenfeld (2010): Muscle synergies in compound movements
 * - Sahrmann (2002): Movement system impairment syndromes
 * - Hodges & Richardson (1996): Core muscle recruitment patterns
 */

/**
 * Spillover Type - Mechanism of fatigue transfer
 */
export type SpilloverMechanism =
  | 'synergist' // Muscles work together in movement (e.g., chest + triceps in press)
  | 'antagonist' // Opposing muscle must stabilize (e.g., biceps stabilize during tricep work)
  | 'stabilizer' // Muscle stabilizes during movement (e.g., abs during squat)
  | 'kinetic_chain' // Force transfer through kinetic chain (e.g., glutes → hamstrings → calves)
  | 'postural' // Postural compensation (e.g., weak abs → overactive erector spinae)
  | 'neural'; // Shared neural pathways (e.g., close proximity in motor cortex)

/**
 * Spillover Relationship
 */
export interface SpilloverRelationship {
  targetMuscle: string; // Muscle receiving spillover fatigue
  percentage: number; // 0-100 (how much fatigue transfers)
  mechanism: SpilloverMechanism;
  bidirectional: boolean; // Does fatigue flow both ways?
}

/**
 * Complete Spillover Matrix
 *
 * Key: Source muscle (the muscle that is fatigued)
 * Value: Array of muscles that receive spillover fatigue
 *
 * Percentage Guidelines:
 * - 50-100%: Direct synergist (works together in most movements)
 * - 30-50%: Strong kinetic chain or stabilizer relationship
 * - 10-30%: Moderate relationship (shared exercises, postural compensation)
 * - <10%: Weak relationship (indirect or rare interaction)
 */
export const SPILLOVER_MATRIX: Record<string, SpilloverRelationship[]> = {
  // ==================== CHEST ====================
  'Chest': [
    { targetMuscle: 'Front Delts', percentage: 40, mechanism: 'synergist', bidirectional: true },
    { targetMuscle: 'Triceps', percentage: 50, mechanism: 'synergist', bidirectional: false },
    { targetMuscle: 'Lats', percentage: 15, mechanism: 'stabilizer', bidirectional: true },
    { targetMuscle: 'Abs', percentage: 20, mechanism: 'stabilizer', bidirectional: false }
  ],

  // ==================== BACK ====================
  'Lats': [
    { targetMuscle: 'Biceps', percentage: 45, mechanism: 'synergist', bidirectional: false },
    { targetMuscle: 'Upper Back', percentage: 60, mechanism: 'synergist', bidirectional: true },
    { targetMuscle: 'Rear Delts', percentage: 35, mechanism: 'synergist', bidirectional: true },
    { targetMuscle: 'Forearms', percentage: 30, mechanism: 'synergist', bidirectional: false },
    { targetMuscle: 'Erector Spinae', percentage: 25, mechanism: 'stabilizer', bidirectional: true },
    { targetMuscle: 'Abs', percentage: 20, mechanism: 'stabilizer', bidirectional: false }
  ],

  'Upper Back': [
    { targetMuscle: 'Lats', percentage: 50, mechanism: 'synergist', bidirectional: true },
    { targetMuscle: 'Rear Delts', percentage: 60, mechanism: 'synergist', bidirectional: true },
    { targetMuscle: 'Traps', percentage: 70, mechanism: 'synergist', bidirectional: true },
    { targetMuscle: 'Biceps', percentage: 30, mechanism: 'synergist', bidirectional: false },
    { targetMuscle: 'Erector Spinae', percentage: 40, mechanism: 'kinetic_chain', bidirectional: true }
  ],

  'Erector Spinae': [
    { targetMuscle: 'Lower Back', percentage: 90, mechanism: 'synergist', bidirectional: true },
    { targetMuscle: 'Glutes', percentage: 50, mechanism: 'kinetic_chain', bidirectional: true },
    { targetMuscle: 'Hamstrings', percentage: 45, mechanism: 'kinetic_chain', bidirectional: true },
    { targetMuscle: 'Abs', percentage: 60, mechanism: 'antagonist', bidirectional: true },
    { targetMuscle: 'Upper Back', percentage: 35, mechanism: 'postural', bidirectional: false }
  ],

  'Lower Back': [
    { targetMuscle: 'Erector Spinae', percentage: 100, mechanism: 'synergist', bidirectional: true },
    { targetMuscle: 'Glutes', percentage: 40, mechanism: 'kinetic_chain', bidirectional: true },
    { targetMuscle: 'Hamstrings', percentage: 35, mechanism: 'kinetic_chain', bidirectional: true }
  ],

  // ==================== SHOULDERS ====================
  'Front Delts': [
    { targetMuscle: 'Chest', percentage: 35, mechanism: 'synergist', bidirectional: true },
    { targetMuscle: 'Side Delts', percentage: 40, mechanism: 'synergist', bidirectional: true },
    { targetMuscle: 'Triceps', percentage: 45, mechanism: 'synergist', bidirectional: false },
    { targetMuscle: 'Upper Back', percentage: 25, mechanism: 'stabilizer', bidirectional: false }
  ],

  'Side Delts': [
    { targetMuscle: 'Front Delts', percentage: 30, mechanism: 'synergist', bidirectional: true },
    { targetMuscle: 'Rear Delts', percentage: 30, mechanism: 'synergist', bidirectional: true },
    { targetMuscle: 'Traps', percentage: 50, mechanism: 'synergist', bidirectional: true },
    { targetMuscle: 'Upper Back', percentage: 20, mechanism: 'stabilizer', bidirectional: false }
  ],

  'Rear Delts': [
    { targetMuscle: 'Side Delts', percentage: 25, mechanism: 'synergist', bidirectional: true },
    { targetMuscle: 'Upper Back', percentage: 70, mechanism: 'synergist', bidirectional: true },
    { targetMuscle: 'Lats', percentage: 30, mechanism: 'stabilizer', bidirectional: false },
    { targetMuscle: 'Traps', percentage: 40, mechanism: 'synergist', bidirectional: true }
  ],

  'Traps': [
    { targetMuscle: 'Upper Back', percentage: 80, mechanism: 'synergist', bidirectional: true },
    { targetMuscle: 'Rear Delts', percentage: 35, mechanism: 'synergist', bidirectional: true },
    { targetMuscle: 'Erector Spinae', percentage: 60, mechanism: 'kinetic_chain', bidirectional: true },
    { targetMuscle: 'Forearms', percentage: 40, mechanism: 'synergist', bidirectional: false }
  ],

  // ==================== ARMS ====================
  'Biceps': [
    { targetMuscle: 'Forearms', percentage: 60, mechanism: 'synergist', bidirectional: false },
    { targetMuscle: 'Lats', percentage: 20, mechanism: 'synergist', bidirectional: false },
    { targetMuscle: 'Upper Back', percentage: 15, mechanism: 'stabilizer', bidirectional: false },
    { targetMuscle: 'Triceps', percentage: 10, mechanism: 'antagonist', bidirectional: true }
  ],

  'Triceps': [
    { targetMuscle: 'Chest', percentage: 30, mechanism: 'synergist', bidirectional: false },
    { targetMuscle: 'Front Delts', percentage: 35, mechanism: 'synergist', bidirectional: false },
    { targetMuscle: 'Biceps', percentage: 10, mechanism: 'antagonist', bidirectional: true },
    { targetMuscle: 'Forearms', percentage: 25, mechanism: 'stabilizer', bidirectional: false }
  ],

  'Forearms': [
    { targetMuscle: 'Biceps', percentage: 15, mechanism: 'kinetic_chain', bidirectional: false },
    { targetMuscle: 'Triceps', percentage: 10, mechanism: 'stabilizer', bidirectional: false },
    { targetMuscle: 'Lats', percentage: 20, mechanism: 'kinetic_chain', bidirectional: false }
  ],

  // ==================== LEGS ====================
  'Quads': [
    { targetMuscle: 'Glutes', percentage: 55, mechanism: 'synergist', bidirectional: true },
    { targetMuscle: 'Hamstrings', percentage: 40, mechanism: 'antagonist', bidirectional: true },
    { targetMuscle: 'Abs', percentage: 30, mechanism: 'stabilizer', bidirectional: false },
    { targetMuscle: 'Erector Spinae', percentage: 35, mechanism: 'stabilizer', bidirectional: false },
    { targetMuscle: 'Calves', percentage: 25, mechanism: 'kinetic_chain', bidirectional: false }
  ],

  'Glutes': [
    { targetMuscle: 'Hamstrings', percentage: 70, mechanism: 'synergist', bidirectional: true },
    { targetMuscle: 'Quads', percentage: 45, mechanism: 'synergist', bidirectional: true },
    { targetMuscle: 'Erector Spinae', percentage: 60, mechanism: 'kinetic_chain', bidirectional: true },
    { targetMuscle: 'Lower Back', percentage: 50, mechanism: 'kinetic_chain', bidirectional: true },
    { targetMuscle: 'Abs', percentage: 35, mechanism: 'stabilizer', bidirectional: false }
  ],

  'Hamstrings': [
    { targetMuscle: 'Glutes', percentage: 75, mechanism: 'synergist', bidirectional: true },
    { targetMuscle: 'Quads', percentage: 35, mechanism: 'antagonist', bidirectional: true },
    { targetMuscle: 'Erector Spinae', percentage: 50, mechanism: 'kinetic_chain', bidirectional: true },
    { targetMuscle: 'Lower Back', percentage: 45, mechanism: 'kinetic_chain', bidirectional: true },
    { targetMuscle: 'Calves', percentage: 30, mechanism: 'kinetic_chain', bidirectional: false }
  ],

  'Calves': [
    { targetMuscle: 'Hamstrings', percentage: 20, mechanism: 'kinetic_chain', bidirectional: false },
    { targetMuscle: 'Quads', percentage: 15, mechanism: 'kinetic_chain', bidirectional: false }
  ],

  // ==================== CORE ====================
  'Abs': [
    { targetMuscle: 'Obliques', percentage: 80, mechanism: 'synergist', bidirectional: true },
    { targetMuscle: 'Erector Spinae', percentage: 50, mechanism: 'antagonist', bidirectional: true },
    { targetMuscle: 'Lower Back', percentage: 40, mechanism: 'postural', bidirectional: false },
    { targetMuscle: 'Quads', percentage: 15, mechanism: 'stabilizer', bidirectional: false }
  ],

  'Obliques': [
    { targetMuscle: 'Abs', percentage: 70, mechanism: 'synergist', bidirectional: true },
    { targetMuscle: 'Erector Spinae', percentage: 40, mechanism: 'antagonist', bidirectional: true },
    { targetMuscle: 'Lower Back', percentage: 35, mechanism: 'postural', bidirectional: false }
  ]
};

/**
 * Calculate spillover fatigue from source muscle to all affected muscles
 *
 * @param sourceMuscle - Muscle that is fatigued
 * @param sourceFatigue - Fatigue level of source muscle (0-100)
 * @returns Map of target muscle -> spillover fatigue amount
 */
export function calculateSpilloverFatigue(
  sourceMuscle: string,
  sourceFatigue: number
): Map<string, number> {
  const spilloverMap = new Map<string, number>();

  const relationships = SPILLOVER_MATRIX[sourceMuscle];
  if (!relationships) return spilloverMap;

  for (const relationship of relationships) {
    const spilloverAmount = sourceFatigue * (relationship.percentage / 100);
    spilloverMap.set(relationship.targetMuscle, spilloverAmount);
  }

  return spilloverMap;
}

/**
 * Calculate total spillover fatigue received by a muscle from all sources
 *
 * @param targetMuscle - Muscle receiving spillover
 * @param muscleFatigueMap - Map of all muscle fatigue levels
 * @returns Total spillover fatigue (0-100)
 */
export function calculateTotalSpilloverReceived(
  targetMuscle: string,
  muscleFatigueMap: Map<string, number>
): number {
  let totalSpillover = 0;

  // Check each source muscle for spillover to target
  for (const [sourceMuscle, sourceFatigue] of muscleFatigueMap.entries()) {
    if (sourceMuscle === targetMuscle) continue; // Skip self

    const relationships = SPILLOVER_MATRIX[sourceMuscle];
    if (!relationships) continue;

    for (const relationship of relationships) {
      if (relationship.targetMuscle === targetMuscle) {
        const spilloverAmount = sourceFatigue * (relationship.percentage / 100);
        totalSpillover += spilloverAmount;
      }
    }
  }

  return Math.min(100, totalSpillover);
}

/**
 * Calculate adjusted muscle fatigue including spillover
 *
 * @param muscleName - Target muscle
 * @param directFatigue - Fatigue from direct training (0-100)
 * @param muscleFatigueMap - Map of all muscle fatigue levels
 * @returns Total fatigue (direct + spillover)
 */
export function calculateTotalMuscleFatigue(
  muscleName: string,
  directFatigue: number,
  muscleFatigueMap: Map<string, number>
): number {
  const spilloverReceived = calculateTotalSpilloverReceived(muscleName, muscleFatigueMap);

  // Total fatigue = direct + spillover (but spillover has diminishing returns)
  // Use square root to model diminishing effect: spillover contributes less when direct fatigue is high
  const spilloverContribution = spilloverReceived * Math.sqrt(1 - directFatigue / 100);

  const totalFatigue = directFatigue + spilloverContribution;

  return Math.min(100, totalFatigue);
}

/**
 * Identify muscle imbalances that increase injury risk
 *
 * Checks for dangerous fatigue imbalances:
 * - Quads >> Hamstrings (knee injury risk)
 * - Chest >> Upper Back (shoulder impingement risk)
 * - Abs << Erector Spinae (lower back injury risk)
 *
 * @param muscleFatigueMap - Map of all muscle fatigue levels
 * @returns Array of imbalance warnings
 */
export function detectMuscleImbalances(
  muscleFatigueMap: Map<string, number>
): {
  imbalanceType: string;
  severity: 'low' | 'moderate' | 'high';
  description: string;
  recommendation: string;
}[] {
  const imbalances: {
    imbalanceType: string;
    severity: 'low' | 'moderate' | 'high';
    description: string;
    recommendation: string;
  }[] = [];

  // Helper to check imbalance ratio
  const checkImbalance = (
    muscle1: string,
    muscle2: string,
    muscle1Name: string,
    muscle2Name: string,
    dangerThreshold: number,
    injuryRisk: string
  ) => {
    const fatigue1 = muscleFatigueMap.get(muscle1) ?? 0;
    const fatigue2 = muscleFatigueMap.get(muscle2) ?? 0;

    if (fatigue2 === 0) return; // No data

    const ratio = fatigue1 / fatigue2;

    if (ratio >= dangerThreshold * 1.5) {
      imbalances.push({
        imbalanceType: `${muscle1Name}/${muscle2Name} Imbalance`,
        severity: 'high',
        description: `${muscle1Name} fatigue is ${ratio.toFixed(1)}x higher than ${muscle2Name}`,
        recommendation: `High risk of ${injuryRisk}. Prioritize ${muscle2Name} training and reduce ${muscle1Name} volume.`
      });
    } else if (ratio >= dangerThreshold) {
      imbalances.push({
        imbalanceType: `${muscle1Name}/${muscle2Name} Imbalance`,
        severity: 'moderate',
        description: `${muscle1Name} fatigue is ${ratio.toFixed(1)}x higher than ${muscle2Name}`,
        recommendation: `Moderate risk of ${injuryRisk}. Add ${muscle2Name} accessory work.`
      });
    } else if (ratio >= dangerThreshold * 0.8) {
      imbalances.push({
        imbalanceType: `${muscle1Name}/${muscle2Name} Imbalance`,
        severity: 'low',
        description: `${muscle1Name} fatigue is ${ratio.toFixed(1)}x higher than ${muscle2Name}`,
        recommendation: `Minor imbalance. Monitor ${muscle2Name} training frequency.`
      });
    }
  };

  // Check common imbalance patterns
  checkImbalance('Quads', 'Hamstrings', 'Quad', 'Hamstring', 1.5, 'ACL/knee injury');
  checkImbalance('Chest', 'Upper Back', 'Chest', 'Upper Back', 1.4, 'shoulder impingement');
  checkImbalance('Erector Spinae', 'Abs', 'Erector Spinae', 'Ab', 1.3, 'lower back strain');
  checkImbalance('Front Delts', 'Rear Delts', 'Front Delt', 'Rear Delt', 1.5, 'rotator cuff injury');

  return imbalances.sort((a, b) => {
    const severityOrder = { high: 3, moderate: 2, low: 1 };
    return severityOrder[b.severity] - severityOrder[a.severity];
  });
}

/**
 * Get synergistic muscle groups for training split optimization
 *
 * Returns muscles that should be trained together (high spillover = train same day)
 *
 * @param muscleName - Source muscle
 * @returns Array of synergistic muscles
 */
export function getSynergisticMuscles(muscleName: string): string[] {
  const relationships = SPILLOVER_MATRIX[muscleName];
  if (!relationships) return [];

  return relationships
    .filter(r => r.mechanism === 'synergist' && r.percentage >= 40)
    .map(r => r.targetMuscle);
}

/**
 * Get antagonist muscle groups for superset optimization
 *
 * Returns muscles that oppose each other (good for supersets)
 *
 * @param muscleName - Source muscle
 * @returns Array of antagonist muscles
 */
export function getAntagonistMuscles(muscleName: string): string[] {
  const relationships = SPILLOVER_MATRIX[muscleName];
  if (!relationships) return [];

  return relationships
    .filter(r => r.mechanism === 'antagonist')
    .map(r => r.targetMuscle);
}
