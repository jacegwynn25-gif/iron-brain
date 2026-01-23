import { VOLUME_LANDMARKS } from '../../lib/intelligence/config';
import { analyzeProgramVolume } from '../../lib/intelligence/builder';

type AnalysisResult = ReturnType<typeof analyzeProgramVolume>;

interface VolumeInsightsProps {
  analysis: AnalysisResult;
  uniqueExerciseCount: number;
}

function formatMuscleName(key: string) {
  const landmark = VOLUME_LANDMARKS[key];
  if (landmark) {
    return landmark.muscle;
  }
  return key.charAt(0).toUpperCase() + key.slice(1);
}

function getStatus(sets: number, key: string) {
  const landmark = VOLUME_LANDMARKS[key];
  if (!landmark) {
    return { label: 'No target', tone: 'text-zinc-500' };
  }
  if (sets < landmark.MEV) {
    return { label: 'Below MEV', tone: 'text-rose-600' };
  }
  if (sets > landmark.MRV) {
    return { label: 'Above MRV', tone: 'text-amber-600' };
  }
  return { label: 'In range', tone: 'text-emerald-600' };
}

export default function VolumeInsights({ analysis, uniqueExerciseCount }: VolumeInsightsProps) {
  const muscleVolumes = Array.from(analysis.weeklyVolumeByMuscle.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 6);

  return (
    <div className="rounded-3xl border border-zinc-200 bg-white/90 p-6 shadow-lg dark:border-zinc-800 dark:bg-zinc-900/80">
      <div className="flex flex-col gap-1">
        <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-300">
          Research-backed volume check
        </p>
        <h3 className="text-lg font-black text-zinc-900 dark:text-zinc-50">
          Volume Snapshot
        </h3>
        <p className="text-sm text-zinc-500 dark:text-zinc-300">
          MEV/MAV/MRV targets are pulled from RP Strength volume landmarks. Keep sets within the sweet spot or you might be undertraining/overreaching.
        </p>
      </div>

      <div className="mt-5 grid gap-4 md:grid-cols-3">
        <div className="rounded-2xl bg-zinc-100 p-4 text-sm text-zinc-700 dark:bg-zinc-800 dark:text-zinc-200">
          <p className="text-xs uppercase tracking-wide text-zinc-500 dark:text-zinc-400">This week</p>
          <p className="text-2xl font-black text-zinc-900 dark:text-zinc-50">{analysis.totalSetsPerWeek}</p>
          <p className="text-xs text-zinc-500 dark:text-zinc-400">Total sets</p>
        </div>
        <div className="rounded-2xl bg-white/70 p-4 text-sm text-zinc-700 shadow-inner dark:bg-zinc-900/70 dark:text-zinc-200">
          <p className="text-xs uppercase tracking-wide text-zinc-500 dark:text-zinc-400">Warnings</p>
          <p className="text-2xl font-black text-amber-500">{analysis.warnings.length}</p>
          <p className="text-xs text-zinc-500 dark:text-zinc-400">Potential issues</p>
        </div>
        <div className="rounded-2xl bg-white/70 p-4 text-sm text-zinc-700 shadow-inner dark:bg-zinc-900/70 dark:text-zinc-200">
          <p className="text-xs uppercase tracking-wide text-zinc-500 dark:text-zinc-400">Exercises</p>
          <p className="text-2xl font-black text-purple-500">{uniqueExerciseCount}</p>
          <p className="text-xs text-zinc-500 dark:text-zinc-400">Unique movements</p>
        </div>
      </div>

      {muscleVolumes.length > 0 ? (
        <div className="mt-6 grid gap-3 md:grid-cols-2">
          {muscleVolumes.map(([muscle, sets]) => {
            const status = getStatus(sets, muscle);
            const landmark = VOLUME_LANDMARKS[muscle];
            return (
              <div key={muscle} className="rounded-2xl border border-zinc-200 bg-zinc-50 p-4 dark:border-zinc-800 dark:bg-zinc-900">
                <div className="flex items-center justify-between text-sm font-semibold">
                  <span className="text-zinc-900 dark:text-zinc-50">{formatMuscleName(muscle)}</span>
                  <span className={`${status.tone} text-xs font-semibold`}>{status.label}</span>
                </div>
                <p className="text-2xl font-black text-zinc-900 dark:text-zinc-50">{sets} sets</p>
                {landmark && (
                  <p className="text-xs uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
                    MEV {landmark.MEV} • MRV {landmark.MRV}
                  </p>
                )}
              </div>
            );
          })}
        </div>
      ) : (
        <p className="mt-6 rounded-2xl border border-dashed border-zinc-200 bg-zinc-50 px-4 py-3 text-xs text-zinc-500 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-400">
          Add exercises to a day to see how each muscle stacks up against MEV/MRV.
        </p>
      )}

      {analysis.warnings.length > 0 && (
        <div className="mt-6 rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700 dark:border-rose-700/40 dark:bg-rose-900/40 dark:text-rose-200">
          <p className="font-semibold">Warnings</p>
          <ul className="mt-2 space-y-1 list-disc pl-5 text-xs">
            {analysis.warnings.map((warning, index) => (
              <li key={index}>{warning}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
