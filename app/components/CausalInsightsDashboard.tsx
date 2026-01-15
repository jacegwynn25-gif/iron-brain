'use client';

import { useState, useEffect } from 'react';
import { BarChart3 } from 'lucide-react';
import { getWorkoutHistory } from '../lib/storage';
import type { WorkoutSession } from '../lib/types';
import {
  testGrangerCausality,
  analyzePropensityScores,
  differenceInDifferences,
  analyzeMediationEffect,
  type GrangerCausalityResult,
  type PropensityScoreAnalysis,
  type DifferenceInDifferencesResult,
  type MediationAnalysis
} from '../lib/stats/causal-inference';

interface CausalInsights {
  grangerFatigueToPerformance?: GrangerCausalityResult;
  grangerVolumeToFatigue?: GrangerCausalityResult;
  grangerIntensityToPerformance?: GrangerCausalityResult;
  mediationVolumeThroughFatigue?: MediationAnalysis;
  propensityHighVsLowVolume?: PropensityScoreAnalysis;
  programChangeEffect?: DifferenceInDifferencesResult;
}

interface CausalInsightsDashboardProps {
  workouts?: WorkoutSession[];
}

export default function CausalInsightsDashboard({ workouts: propsWorkouts }: CausalInsightsDashboardProps) {
  const [insights, setInsights] = useState<CausalInsights | null>(null);
  const [loading, setLoading] = useState(true);
  const [dataPoints, setDataPoints] = useState(0);

  useEffect(() => {
    async function analyzeWorkouts() {
      try {
        // Use workouts from props if provided, otherwise load from storage
        const workouts = propsWorkouts || getWorkoutHistory();
        const completedWorkouts = workouts.filter(w => w.endTime);

        console.log('🔬 Causal Insights analyzing:', completedWorkouts.length, 'workouts');

        if (completedWorkouts.length < 10) {
          setLoading(false);
          return;
        }

        setDataPoints(completedWorkouts.length);

        // Extract time series data from workouts
        const fatigueTimeSeries: number[] = [];
        const performanceTimeSeries: number[] = [];
        const volumeTimeSeries: number[] = [];
        const intensityTimeSeries: number[] = [];
        const rpeTimeSeries: number[] = [];

        completedWorkouts.forEach(workout => {
          const completedSets = workout.sets.filter(s => s.completed);

          if (completedSets.length === 0) return;

          // Calculate workout-level metrics
          const avgRPE = completedSets.reduce((sum, s) => sum + (s.actualRPE || s.prescribedRPE || 7), 0) / completedSets.length;
          const totalVolume = completedSets.reduce((sum, s) => {
            const weight = s.actualWeight || s.prescribedWeight || 0;
            const reps = s.actualReps || parseInt(s.prescribedReps) || 0;
            return sum + weight * reps;
          }, 0);
          const avgIntensity = completedSets.reduce((sum, s) => sum + (s.actualWeight || s.prescribedWeight || 0), 0) / completedSets.length;

          // Estimate fatigue from RPE trajectory
          const rpeValues = completedSets.map(s => s.actualRPE || s.prescribedRPE || 7);
          const earlyRPE = rpeValues.slice(0, Math.ceil(rpeValues.length / 3)).reduce((a, b) => a + b, 0) / Math.ceil(rpeValues.length / 3);
          const lateRPE = rpeValues.slice(-Math.ceil(rpeValues.length / 3)).reduce((a, b) => a + b, 0) / Math.ceil(rpeValues.length / 3);
          const fatigue = Math.max(0, Math.min(100, (lateRPE - earlyRPE) * 15 + 30)); // 0-100 scale

          // Estimate performance (inverse of RPE, scaled by volume)
          const performance = (10 - avgRPE) * 10 * (totalVolume / 1000);

          fatigueTimeSeries.push(fatigue);
          performanceTimeSeries.push(performance);
          volumeTimeSeries.push(totalVolume);
          intensityTimeSeries.push(avgIntensity);
          rpeTimeSeries.push(avgRPE);
        });

        // Run Granger Causality Tests
        const grangerFatigueToPerformance = fatigueTimeSeries.length >= 10
          ? testGrangerCausality(fatigueTimeSeries, performanceTimeSeries, 1)
          : undefined;

        const grangerVolumeToFatigue = volumeTimeSeries.length >= 10
          ? testGrangerCausality(volumeTimeSeries, fatigueTimeSeries, 1)
          : undefined;

        const grangerIntensityToPerformance = intensityTimeSeries.length >= 10
          ? testGrangerCausality(intensityTimeSeries, performanceTimeSeries, 1)
          : undefined;

        // Run Mediation Analysis
        // Does volume affect performance THROUGH fatigue?
        const mediationVolumeThroughFatigue = volumeTimeSeries.length >= 10
          ? analyzeMediationEffect(volumeTimeSeries, fatigueTimeSeries, performanceTimeSeries)
          : undefined;

        // Run Propensity Score Analysis
        // Compare high-volume vs low-volume workouts (matched on intensity)
        const medianVolume = volumeTimeSeries.length > 0
          ? volumeTimeSeries.sort((a, b) => a - b)[Math.floor(volumeTimeSeries.length / 2)]
          : 0;

        const treatmentGroup: Array<{ outcome: number; covariates: number[] }> = [];
        const controlGroup: Array<{ outcome: number; covariates: number[] }> = [];

        completedWorkouts.forEach((workout, i) => {
          if (i >= volumeTimeSeries.length) return;

          const data = {
            outcome: performanceTimeSeries[i],
            covariates: [intensityTimeSeries[i], rpeTimeSeries[i]] // Match on intensity and RPE
          };

          if (volumeTimeSeries[i] > medianVolume) {
            treatmentGroup.push(data);
          } else {
            controlGroup.push(data);
          }
        });

        const propensityHighVsLowVolume = treatmentGroup.length >= 3 && controlGroup.length >= 3
          ? analyzePropensityScores(treatmentGroup, controlGroup)
          : undefined;

        // Run Difference-in-Differences (if there's a program change)
        // Detect if there was a significant change in training pattern
        let programChangeEffect: DifferenceInDifferencesResult | undefined;
        if (completedWorkouts.length >= 20) {
          const midpoint = Math.floor(completedWorkouts.length / 2);

          // Split workouts into before/after
          const firstHalf = performanceTimeSeries.slice(0, midpoint);
          const secondHalf = performanceTimeSeries.slice(midpoint);

          // Use fatigue as "control" (natural progression)
          const fatigueFirstHalf = fatigueTimeSeries.slice(0, midpoint);
          const fatigueSecondHalf = fatigueTimeSeries.slice(midpoint);

          if (firstHalf.length >= 5 && secondHalf.length >= 5) {
            programChangeEffect = differenceInDifferences(
              firstHalf, // Treatment before
              secondHalf, // Treatment after
              fatigueFirstHalf, // Control before
              fatigueSecondHalf // Control after
            );
          }
        }

        setInsights({
          grangerFatigueToPerformance,
          grangerVolumeToFatigue,
          grangerIntensityToPerformance,
          mediationVolumeThroughFatigue,
          propensityHighVsLowVolume,
          programChangeEffect
        });

      } catch (err) {
        console.error('Error analyzing causal insights:', err);
      } finally {
        setLoading(false);
      }
    }

    analyzeWorkouts();
  }, [propsWorkouts]);

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-900 via-purple-800 to-pink-900 text-white p-6">
        <div className="max-w-6xl mx-auto">
          <div className="text-center py-12">
            <div className="text-2xl font-bold mb-4">Analyzing Causal Relationships...</div>
            <div className="text-purple-300">Running PhD-level statistical tests</div>
          </div>
        </div>
      </div>
    );
  }

  if (!insights || dataPoints < 10) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-900 via-purple-800 to-pink-900 text-white p-6">
        <div className="max-w-6xl mx-auto">
          <div className="text-center py-12">
            <div className="mb-4 flex justify-center">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-white/10 border border-white/10">
                <BarChart3 className="h-6 w-6 text-purple-200" />
              </div>
            </div>
            <div className="text-2xl font-bold mb-4">Insufficient Data for Causal Analysis</div>
            <div className="text-purple-300 mb-6">
              Complete at least 10 workouts to unlock causal insights
            </div>
            <div className="text-purple-200">
              Current progress: {dataPoints}/10 workouts
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-900 via-purple-800 to-pink-900 text-white p-6 pb-24">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-4xl font-bold mb-2 bg-gradient-to-r from-purple-200 to-pink-200 bg-clip-text text-transparent">
            Causal Insights
          </h1>
          <p className="text-purple-200 text-lg">
            What ACTUALLY Works For You? PhD-level causal inference
          </p>
          <div className="mt-2 text-sm text-purple-300">
            Analyzed {dataPoints} workouts • Pearl (2009), Angrist & Pischke (2009)
          </div>
        </div>

        <div className="space-y-6">
          {/* Granger Causality: Fatigue → Performance */}
          {insights.grangerFatigueToPerformance && (
            <CausalCard
              title="Does Fatigue Predict Performance?"
              method="Granger Causality Test"
              result={insights.grangerFatigueToPerformance.xCausesY}
              confidence={insights.grangerFatigueToPerformance.confidence}
              interpretation={insights.grangerFatigueToPerformance.interpretation}
              details={[
                `F-statistic: ${insights.grangerFatigueToPerformance.fStatistic.toFixed(2)}`,
                `P-value: ${insights.grangerFatigueToPerformance.pValue.toFixed(3)}`,
                `Lag: 1 workout`
              ]}
            />
          )}

          {/* Granger Causality: Volume → Fatigue */}
          {insights.grangerVolumeToFatigue && (
            <CausalCard
              title="Does Volume Cause Fatigue?"
              method="Granger Causality Test"
              result={insights.grangerVolumeToFatigue.xCausesY}
              confidence={insights.grangerVolumeToFatigue.confidence}
              interpretation={insights.grangerVolumeToFatigue.interpretation}
              details={[
                `F-statistic: ${insights.grangerVolumeToFatigue.fStatistic.toFixed(2)}`,
                `P-value: ${insights.grangerVolumeToFatigue.pValue.toFixed(3)}`
              ]}
            />
          )}

          {/* Granger Causality: Intensity → Performance */}
          {insights.grangerIntensityToPerformance && (
            <CausalCard
              title="Does Intensity Predict Performance?"
              method="Granger Causality Test"
              result={insights.grangerIntensityToPerformance.xCausesY}
              confidence={insights.grangerIntensityToPerformance.confidence}
              interpretation={insights.grangerIntensityToPerformance.interpretation}
              details={[
                `F-statistic: ${insights.grangerIntensityToPerformance.fStatistic.toFixed(2)}`,
                `P-value: ${insights.grangerIntensityToPerformance.pValue.toFixed(3)}`
              ]}
            />
          )}

          {/* Mediation Analysis */}
          {insights.mediationVolumeThroughFatigue && (
            <MediationCard mediation={insights.mediationVolumeThroughFatigue} />
          )}

          {/* Propensity Score Matching */}
          {insights.propensityHighVsLowVolume && (
            <CausalCard
              title="High Volume vs Low Volume Effect"
              method="Propensity Score Matching"
              result={insights.propensityHighVsLowVolume.significant}
              confidence={insights.propensityHighVsLowVolume.confidence}
              interpretation={insights.propensityHighVsLowVolume.interpretation}
              details={[
                `Treatment effect: ${insights.propensityHighVsLowVolume.treatmentEffect.toFixed(2)}`,
                `Standard error: ${insights.propensityHighVsLowVolume.standardError.toFixed(2)}`,
                `Matched pairs: ${insights.propensityHighVsLowVolume.matchedPairs}`
              ]}
            />
          )}

          {/* Difference-in-Differences */}
          {insights.programChangeEffect && (
            <DIDCard did={insights.programChangeEffect} />
          )}
        </div>

        {/* Methodology Note */}
        <div className="mt-8 p-6 bg-white/5 backdrop-blur-sm rounded-lg border border-purple-500/30">
          <h3 className="text-lg font-bold mb-3 text-purple-200">About Causal Inference</h3>
          <div className="text-sm text-purple-300 space-y-2">
            <p>
              <strong>Granger Causality:</strong> Tests if past values of X predict future values of Y better than Y&apos;s own history.
              If yes, X may causally influence Y (Granger, 1969).
            </p>
            <p>
              <strong>Propensity Score Matching:</strong> Matches similar workouts to isolate treatment effects,
              controlling for confounding variables (Rosenbaum & Rubin, 1983).
            </p>
            <p>
              <strong>Mediation Analysis:</strong> Reveals HOW X affects Y - does it work directly or through an intermediate mechanism?
              (Baron & Kenny, 1986; Pearl, 2001).
            </p>
            <p>
              <strong>Difference-in-Differences:</strong> Estimates causal effects by comparing before/after changes,
              removing confounding from time trends (Card & Krueger, 1994).
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

// Causal Card Component
function CausalCard({
  title,
  method,
  result,
  confidence,
  interpretation,
  details
}: {
  title: string;
  method: string;
  result: boolean;
  confidence: number;
  interpretation: string;
  details: string[];
}) {
  const resultColor = result
    ? 'from-green-500/20 to-emerald-500/20 border-green-500/40'
    : 'from-gray-500/20 to-slate-500/20 border-gray-500/40';

  const resultIcon = result ? '✓' : '✗';
  const resultText = result ? 'Causal Relationship Detected' : 'No Causal Relationship';

  return (
    <div className={`p-6 rounded-lg bg-gradient-to-br ${resultColor} border backdrop-blur-sm`}>
      <div className="flex items-start justify-between mb-4">
        <div>
          <h3 className="text-xl font-bold text-white mb-1">{title}</h3>
          <p className="text-sm text-purple-300">{method}</p>
        </div>
        <div className="text-3xl">{resultIcon}</div>
      </div>

      <div className="mb-4">
        <div className="flex items-center gap-3 mb-2">
          <span className="text-sm font-semibold text-white">{resultText}</span>
          <span className="px-2 py-1 text-xs font-bold bg-white/20 rounded">
            {(confidence * 100).toFixed(0)}% confidence
          </span>
        </div>
        <div className="w-full bg-white/10 rounded-full h-2">
          <div
            className="bg-gradient-to-r from-purple-400 to-pink-400 h-2 rounded-full transition-all"
            style={{ width: `${confidence * 100}%` }}
          />
        </div>
      </div>

      <p className="text-purple-100 mb-4 text-sm leading-relaxed">{interpretation}</p>

      <div className="space-y-1">
        {details.map((detail, i) => (
          <div key={i} className="text-xs text-purple-300 font-mono">
            {detail}
          </div>
        ))}
      </div>
    </div>
  );
}

// Mediation Card Component
function MediationCard({ mediation }: { mediation: MediationAnalysis }) {
  return (
    <div className="p-6 rounded-lg bg-gradient-to-br from-indigo-500/20 to-purple-500/20 border border-indigo-500/40 backdrop-blur-sm">
      <div className="mb-4">
        <h3 className="text-xl font-bold text-white mb-1">Mediation Analysis</h3>
        <p className="text-sm text-purple-300">Does volume affect performance THROUGH fatigue?</p>
      </div>

      <div className="mb-4">
        <div className="text-center text-sm text-purple-200 font-mono mb-2">
          Volume → Fatigue → Performance
        </div>
        <div className="flex items-center justify-center gap-4 text-xs text-purple-300">
          <div>Total: {mediation.totalEffect.toFixed(2)}</div>
          <div>Direct: {mediation.directEffect.toFixed(2)}</div>
          <div>Indirect: {mediation.indirectEffect.toFixed(2)}</div>
        </div>
      </div>

      <div className="mb-4">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm text-white">Proportion Mediated</span>
          <span className="text-lg font-bold text-white">{(mediation.proportionMediated * 100).toFixed(0)}%</span>
        </div>
        <div className="w-full bg-white/10 rounded-full h-3">
          <div
            className="bg-gradient-to-r from-indigo-400 to-purple-400 h-3 rounded-full transition-all"
            style={{ width: `${mediation.proportionMediated * 100}%` }}
          />
        </div>
      </div>

      <p className="text-purple-100 text-sm leading-relaxed">{mediation.interpretation}</p>

      <div className="mt-4 p-3 bg-white/10 rounded text-xs text-purple-200">
        <strong>What this means:</strong> {mediation.proportionMediated > 0.5
          ? "Most of volume's effect operates through fatigue accumulation. Managing fatigue is key."
          : "Volume affects performance through multiple pathways, not just fatigue."}
      </div>
    </div>
  );
}

// Difference-in-Differences Card
function DIDCard({ did }: { did: DifferenceInDifferencesResult }) {
  return (
    <div className="p-6 rounded-lg bg-gradient-to-br from-cyan-500/20 to-blue-500/20 border border-cyan-500/40 backdrop-blur-sm">
      <div className="mb-4">
        <h3 className="text-xl font-bold text-white mb-1">Training Program Change Effect</h3>
        <p className="text-sm text-purple-300">Difference-in-Differences Estimator</p>
      </div>

      <div className="grid grid-cols-2 gap-4 mb-4">
        <div className="p-3 bg-white/10 rounded">
          <div className="text-xs text-purple-300 mb-1">Before Period</div>
          <div className="text-lg font-bold text-white">{did.components.treatmentBefore.toFixed(1)}</div>
        </div>
        <div className="p-3 bg-white/10 rounded">
          <div className="text-xs text-purple-300 mb-1">After Period</div>
          <div className="text-lg font-bold text-white">{did.components.treatmentAfter.toFixed(1)}</div>
        </div>
      </div>

      <div className="mb-4">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm text-white">Causal Effect (DID)</span>
          <span className={`text-xl font-bold ${did.did > 0 ? 'text-green-400' : 'text-red-400'}`}>
            {did.did > 0 ? '+' : ''}{did.did.toFixed(2)}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <span className="px-2 py-1 text-xs font-bold bg-white/20 rounded">
            {(did.confidence * 100).toFixed(0)}% confidence
          </span>
          {did.significant && (
            <span className="px-2 py-1 text-xs font-bold bg-green-500/30 text-green-200 rounded">
              Statistically Significant
            </span>
          )}
        </div>
      </div>

      <p className="text-purple-100 text-sm leading-relaxed">{did.interpretation}</p>

      <div className="mt-4 text-xs text-purple-300">
        Standard error: {did.standardError.toFixed(2)}
      </div>
    </div>
  );
}
