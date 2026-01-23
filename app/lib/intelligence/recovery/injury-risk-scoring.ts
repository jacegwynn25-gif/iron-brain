/**
 * Injury Risk Scoring System
 *
 * Comprehensive injury risk assessment combining all recovery subsystems.
 * Predicts injury risk BEFORE it happens using multi-dimensional analysis.
 *
 * Risk Factors:
 * 1. ACWR violations (acute >> chronic load)
 * 2. Connective tissue stress accumulation
 * 3. Muscle fatigue imbalances
 * 4. Energy system depletion
 * 5. Contextual risk amplifiers (poor sleep, stress)
 * 6. Movement pattern overuse
 * 7. Joint-specific stress
 * 8. Rapid training load spikes
 *
 * Research Foundation:
 * - Gabbett (2016): ACWR and injury risk (2-4x increase at ACWR >1.5)
 * - Hulin et al. (2016): Training load spikes and injury prediction
 * - Drew & Finch (2016): The relationship between training load and injury
 * - Soligard et al. (2016): Comprehensive warm-up and injury prevention
 */

import { RecoveryState } from './decay-engine';
import { ConnectiveTissueState } from './connective-tissue';
import { detectMuscleImbalances } from './spillover-matrix';
import { EnergySystemState } from './energy-systems';

/**
 * Injury Risk Level
 */
export type InjuryRiskLevel = 'low' | 'moderate' | 'high' | 'very_high' | 'critical';

/**
 * Risk Factor - Specific identified risk
 */
export interface RiskFactor {
  category: string;
  severity: InjuryRiskLevel;
  description: string;
  contributionToRisk: number; // 0-100 (how much this factor contributes to overall risk)
  recommendation: string;
}

/**
 * Joint-Specific Injury Risk
 */
export interface JointRiskAssessment {
  joint: string;
  riskScore: number; // 0-100
  riskLevel: InjuryRiskLevel;
  primaryThreats: string[]; // e.g., ["Rotator cuff tendinosis", "Shoulder impingement"]
  contributingFactors: RiskFactor[];
}

/**
 * Overall Injury Risk Assessment
 */
export interface InjuryRiskAssessment {
  timestamp: Date;
  overallRiskScore: number; // 0-100
  overallRiskLevel: InjuryRiskLevel;
  acwr: number; // Acute:Chronic Workload Ratio
  jointRisks: JointRiskAssessment[];
  topRiskFactors: RiskFactor[];
  warnings: string[];
  recommendations: string[];
  shouldRest: boolean;
  shouldDeload: boolean;
  estimatedSafeTrainingDate: Date | null;
}

/**
 * Calculate risk level from score
 *
 * @param score - Risk score (0-100)
 * @returns Risk level category
 */
export function getRiskLevel(score: number): InjuryRiskLevel {
  if (score >= 81) return 'critical';
  if (score >= 61) return 'very_high';
  if (score >= 41) return 'high';
  if (score >= 21) return 'moderate';
  return 'low';
}

/**
 * Calculate ACWR risk contribution
 *
 * Research: ACWR >1.5 = 2-4x injury risk
 *
 * @param acwr - Acute:Chronic workload ratio
 * @returns Risk contribution (0-100)
 */
export function calculateACWRRisk(acwr: number): {
  riskContribution: number;
  riskLevel: InjuryRiskLevel;
  description: string;
} {
  let riskContribution = 0;
  let riskLevel: InjuryRiskLevel = 'low';
  let description = '';

  if (acwr >= 2.0) {
    riskContribution = 90;
    riskLevel = 'critical';
    description = `ACWR ${acwr.toFixed(2)} (Extreme - 4x injury risk)`;
  } else if (acwr >= 1.5) {
    riskContribution = 70;
    riskLevel = 'very_high';
    description = `ACWR ${acwr.toFixed(2)} (Very High - 2-3x injury risk)`;
  } else if (acwr >= 1.3) {
    riskContribution = 45;
    riskLevel = 'high';
    description = `ACWR ${acwr.toFixed(2)} (High - elevated injury risk)`;
  } else if (acwr >= 1.1) {
    riskContribution = 20;
    riskLevel = 'moderate';
    description = `ACWR ${acwr.toFixed(2)} (Moderate - slight elevation)`;
  } else if (acwr >= 0.8) {
    riskContribution = 0;
    riskLevel = 'low';
    description = `ACWR ${acwr.toFixed(2)} (Optimal - sweet spot)`;
  } else {
    riskContribution = 25;
    riskLevel = 'moderate';
    description = `ACWR ${acwr.toFixed(2)} (Low - detraining risk)`;
  }

  return { riskContribution, riskLevel, description };
}

/**
 * Calculate connective tissue risk contribution
 *
 * @param connective TissueStates - All connective tissue states
 * @returns Risk contribution (0-100)
 */
export function calculateConnectiveTissueRisk(
  connectiveTissueStates: ConnectiveTissueState[]
): {
  riskContribution: number;
  riskLevel: InjuryRiskLevel;
  atRiskStructures: ConnectiveTissueState[];
} {
  const atRiskStructures = connectiveTissueStates.filter(s => s.isAtRisk);

  if (atRiskStructures.length === 0) {
    return {
      riskContribution: 0,
      riskLevel: 'low',
      atRiskStructures: []
    };
  }

  // Average stress of at-risk structures
  const avgStress = atRiskStructures.reduce((sum, s) => sum + s.currentStress, 0) / atRiskStructures.length;

  // Risk increases with number of structures at risk
  const structureCountMultiplier = 1 + (atRiskStructures.length - 1) * 0.15;

  const riskContribution = Math.min(100, avgStress * structureCountMultiplier);
  const riskLevel = getRiskLevel(riskContribution);

  return {
    riskContribution,
    riskLevel,
    atRiskStructures
  };
}

/**
 * Calculate muscle imbalance risk contribution
 *
 * @param muscleFatigueMap - Map of muscle -> fatigue level
 * @returns Risk contribution (0-100)
 */
export function calculateMuscleImbalanceRisk(
  muscleFatigueMap: Map<string, number>
): {
  riskContribution: number;
  riskLevel: InjuryRiskLevel;
  imbalances: ReturnType<typeof detectMuscleImbalances>;
} {
  const imbalances = detectMuscleImbalances(muscleFatigueMap);

  if (imbalances.length === 0) {
    return {
      riskContribution: 0,
      riskLevel: 'low',
      imbalances: []
    };
  }

  // Calculate risk based on severity
  let totalRisk = 0;
  for (const imbalance of imbalances) {
    switch (imbalance.severity) {
      case 'high':
        totalRisk += 60;
        break;
      case 'moderate':
        totalRisk += 35;
        break;
      case 'low':
        totalRisk += 15;
        break;
    }
  }

  const riskContribution = Math.min(100, totalRisk);
  const riskLevel = getRiskLevel(riskContribution);

  return {
    riskContribution,
    riskLevel,
    imbalances
  };
}

/**
 * Calculate energy depletion risk contribution
 *
 * @param energyStates - Energy system states for relevant muscles
 * @returns Risk contribution (0-100)
 */
export function calculateEnergyDepletionRisk(
  energyStates: EnergySystemState[]
): {
  riskContribution: number;
  riskLevel: InjuryRiskLevel;
  depletedSystems: string[];
} {
  const depletedSystems: string[] = [];
  let totalDepletion = 0;

  for (const state of energyStates) {
    // Glycogen depletion is the primary risk (PCr recovers quickly)
    if (state.glycogen < 50) {
      depletedSystems.push(`${state.muscleName} glycogen (${state.glycogen.toFixed(0)}%)`);
      totalDepletion += (50 - state.glycogen);
    }
  }

  if (depletedSystems.length === 0) {
    return {
      riskContribution: 0,
      riskLevel: 'low',
      depletedSystems: []
    };
  }

  // Average depletion across depleted systems
  const avgDepletion = totalDepletion / depletedSystems.length;

  // Risk contribution (severe glycogen depletion = 40% risk contribution max)
  const riskContribution = Math.min(40, avgDepletion * 0.8);
  const riskLevel = getRiskLevel(riskContribution);

  return {
    riskContribution,
    riskLevel,
    depletedSystems
  };
}

/**
 * Calculate contextual risk amplification
 *
 * Poor sleep, stress, etc. amplify injury risk
 *
 * @param recoveryCapacity - Overall recovery capacity modifier (from context-modifiers)
 * @returns Risk amplification factor (1.0-2.0)
 */
export function calculateContextualRiskAmplification(
  recoveryCapacity: number
): {
  amplificationFactor: number;
  riskLevel: InjuryRiskLevel;
  description: string;
} {
  // Recovery capacity <0.7 = significantly elevated risk
  // Recovery capacity >1.0 = reduced risk

  let amplificationFactor = 1.0;
  let riskLevel: InjuryRiskLevel = 'low';
  let description = '';

  if (recoveryCapacity < 0.6) {
    amplificationFactor = 1.8;
    riskLevel = 'very_high';
    description = 'Severe recovery impairment (poor sleep/stress) - 80% higher injury risk';
  } else if (recoveryCapacity < 0.75) {
    amplificationFactor = 1.5;
    riskLevel = 'high';
    description = 'Moderate recovery impairment - 50% higher injury risk';
  } else if (recoveryCapacity < 0.9) {
    amplificationFactor = 1.2;
    riskLevel = 'moderate';
    description = 'Mild recovery impairment - 20% higher injury risk';
  } else if (recoveryCapacity >= 1.1) {
    amplificationFactor = 0.85;
    riskLevel = 'low';
    description = 'Enhanced recovery capacity - 15% lower injury risk';
  } else {
    amplificationFactor = 1.0;
    riskLevel = 'low';
    description = 'Normal recovery capacity';
  }

  return {
    amplificationFactor,
    riskLevel,
    description
  };
}

/**
 * Build comprehensive injury risk assessment
 *
 * @param acwr - Acute:Chronic workload ratio
 * @param recoveryState - Complete recovery state (muscles + exercises)
 * @param connectiveTissueStates - All connective tissue states
 * @param energyStates - Energy system states
 * @param recoveryCapacity - Overall recovery capacity modifier
 * @returns Complete injury risk assessment
 */
export function buildInjuryRiskAssessment(
  acwr: number,
  recoveryState: RecoveryState,
  connectiveTissueStates: ConnectiveTissueState[],
  energyStates: EnergySystemState[],
  recoveryCapacity: number
): InjuryRiskAssessment {
  const riskFactors: RiskFactor[] = [];

  // 1. ACWR Risk
  const acwrRisk = calculateACWRRisk(acwr);
  if (acwrRisk.riskContribution > 0) {
    riskFactors.push({
      category: 'Training Load Spike',
      severity: acwrRisk.riskLevel,
      description: acwrRisk.description,
      contributionToRisk: acwrRisk.riskContribution,
      recommendation: acwrRisk.riskLevel === 'critical'
        ? 'IMMEDIATE DELOAD REQUIRED - Reduce volume by 50% for 1 week'
        : 'Reduce weekly volume by 20-30% to bring ACWR into safe zone (0.8-1.3)'
    });
  }

  // 2. Connective Tissue Risk
  const ctRisk = calculateConnectiveTissueRisk(connectiveTissueStates);
  if (ctRisk.riskContribution > 20) {
    riskFactors.push({
      category: 'Connective Tissue Stress',
      severity: ctRisk.riskLevel,
      description: `${ctRisk.atRiskStructures.length} structure(s) at risk: ${ctRisk.atRiskStructures.map(s => s.structure).join(', ')}`,
      contributionToRisk: ctRisk.riskContribution,
      recommendation: 'Reduce volume for exercises stressing these structures by 40-50%. Consider 7-10 days rest.'
    });
  }

  // 3. Muscle Imbalance Risk
  const muscleFatigueMap = new Map<string, number>();
  for (const [muscleName, state] of recoveryState.muscles.entries()) {
    muscleFatigueMap.set(muscleName, state.currentFatigue);
  }
  const imbalanceRisk = calculateMuscleImbalanceRisk(muscleFatigueMap);
  if (imbalanceRisk.riskContribution > 10) {
    riskFactors.push({
      category: 'Muscle Imbalance',
      severity: imbalanceRisk.riskLevel,
      description: `${imbalanceRisk.imbalances.length} imbalance(s) detected`,
      contributionToRisk: imbalanceRisk.riskContribution,
      recommendation: imbalanceRisk.imbalances[0]?.recommendation ?? 'Address muscle imbalances with corrective exercises'
    });
  }

  // 4. Energy Depletion Risk
  const energyRisk = calculateEnergyDepletionRisk(energyStates);
  if (energyRisk.riskContribution > 15) {
    riskFactors.push({
      category: 'Energy System Depletion',
      severity: energyRisk.riskLevel,
      description: `Glycogen depletion in ${energyRisk.depletedSystems.length} muscle(s)`,
      contributionToRisk: energyRisk.riskContribution,
      recommendation: 'Consume 30-50g carbs pre-workout. Consider extra rest day for glycogen replenishment.'
    });
  }

  // 5. Contextual Risk Amplification
  const contextRisk = calculateContextualRiskAmplification(recoveryCapacity);
  if (contextRisk.amplificationFactor > 1.1) {
    riskFactors.push({
      category: 'Recovery Impairment',
      severity: contextRisk.riskLevel,
      description: contextRisk.description,
      contributionToRisk: (contextRisk.amplificationFactor - 1.0) * 50, // Convert to 0-100 scale
      recommendation: 'Prioritize sleep (8+ hours), reduce life stress, optimize nutrition.'
    });
  }

  // 6. Global Fatigue Risk
  if (recoveryState.globalFatigue > 60) {
    riskFactors.push({
      category: 'Systemic Fatigue',
      severity: getRiskLevel(recoveryState.globalFatigue),
      description: `Overall fatigue ${recoveryState.globalFatigue.toFixed(0)}% (high systemic stress)`,
      contributionToRisk: recoveryState.globalFatigue * 0.6,
      recommendation: 'Full rest day or active recovery session. Systemic fatigue too high for heavy training.'
    });
  }

  // Calculate overall risk score
  const baseRiskScore = riskFactors.reduce((sum, rf) => sum + rf.contributionToRisk * 0.2, 0);
  const amplifiedRiskScore = Math.min(100, baseRiskScore * contextRisk.amplificationFactor);

  const overallRiskLevel = getRiskLevel(amplifiedRiskScore);

  // Sort risk factors by contribution
  const topRiskFactors = [...riskFactors].sort((a, b) => b.contributionToRisk - a.contributionToRisk);

  // Build joint-specific risks
  const jointRisks: JointRiskAssessment[] = [];
  const jointGroups = new Map<string, ConnectiveTissueState[]>();

  for (const ctState of connectiveTissueStates) {
    if (!jointGroups.has(ctState.structure)) {
      jointGroups.set(ctState.structure, []);
    }
    jointGroups.get(ctState.structure)!.push(ctState);
  }

  for (const [joint, states] of jointGroups.entries()) {
    const avgRisk = states.reduce((sum, s) => sum + s.currentStress, 0) / states.length;
    const atRiskStructures = states.filter(s => s.isAtRisk);

    if (avgRisk > 40 || atRiskStructures.length > 0) {
      jointRisks.push({
        joint,
        riskScore: avgRisk,
        riskLevel: getRiskLevel(avgRisk),
        primaryThreats: atRiskStructures.map(s => s.structure),
        contributingFactors: riskFactors.filter(rf => rf.category === 'Connective Tissue Stress')
      });
    }
  }

  // Generate warnings and recommendations
  const warnings: string[] = [];
  const recommendations: string[] = [];

  if (overallRiskLevel === 'critical') {
    warnings.push('CRITICAL INJURY RISK - Training at current load is extremely dangerous');
    recommendations.push('Take 7-14 days complete rest from training');
    recommendations.push('Consider consultation with sports medicine professional');
  } else if (overallRiskLevel === 'very_high') {
    warnings.push('VERY HIGH INJURY RISK - Immediate action required');
    recommendations.push('Reduce training volume by 50% for 1-2 weeks');
    recommendations.push('Focus on recovery: sleep 8+ hours, manage stress, optimize nutrition');
  } else if (overallRiskLevel === 'high') {
    warnings.push('HIGH INJURY RISK - Training modifications needed');
    recommendations.push('Reduce volume by 30-40% or take extra rest days');
    recommendations.push('Avoid exercises stressing at-risk structures');
  } else if (overallRiskLevel === 'moderate') {
    warnings.push('Moderate injury risk detected');
    recommendations.push('Monitor closely and consider 10-20% volume reduction');
  }

  // Add top risk factor recommendations
  for (const rf of topRiskFactors.slice(0, 3)) {
    if (rf.severity !== 'low' && !recommendations.includes(rf.recommendation)) {
      recommendations.push(rf.recommendation);
    }
  }

  // Determine action flags
  const shouldRest = overallRiskLevel === 'critical' || overallRiskLevel === 'very_high';
  const shouldDeload = overallRiskLevel === 'high' || overallRiskLevel === 'moderate';

  // Estimate safe training date
  let estimatedSafeTrainingDate: Date | null = null;
  if (shouldRest) {
    const daysToRest = overallRiskLevel === 'critical' ? 14 : 7;
    estimatedSafeTrainingDate = new Date(Date.now() + daysToRest * 24 * 60 * 60 * 1000);
  }

  return {
    timestamp: new Date(),
    overallRiskScore: amplifiedRiskScore,
    overallRiskLevel,
    acwr,
    jointRisks,
    topRiskFactors,
    warnings,
    recommendations,
    shouldRest,
    shouldDeload,
    estimatedSafeTrainingDate
  };
}
