'use client';

import { useState } from 'react';
import { Calculator, TrendingUp, RefreshCw, Dumbbell } from 'lucide-react';
import { defaultExercises } from '../lib/programs';
import CustomExercises from './CustomExercises';

export default function Utilities() {
  const [activeTab, setActiveTab] = useState<'plates' | 'rm' | 'substitutions' | 'custom'>('plates');

  const tabs = [
    { key: 'plates', label: 'Plate Calculator', icon: Calculator },
    { key: 'rm', label: '1RM Calculator', icon: TrendingUp },
    { key: 'substitutions', label: 'Substitutions', icon: RefreshCw },
    { key: 'custom', label: 'Custom Exercises', icon: Dumbbell },
  ];

  return (
    <div className="space-y-6">
      {/* Hero Header */}
      <div className="rounded-3xl bg-gradient-to-br from-green-500 via-teal-600 to-blue-600 p-6 sm:p-10 shadow-2xl depth-effect animate-slideUp">
        <div className="flex items-center gap-3 mb-3 flex-wrap">
          <div className="rounded-xl bg-white/20 p-3 backdrop-blur-sm flex-shrink-0">
            <Calculator className="h-8 w-8 text-white" />
          </div>
          <h2 className="text-3xl sm:text-5xl font-black text-white leading-tight text-balance">
            Workout Utilities
          </h2>
        </div>
        <p className="text-base sm:text-lg font-medium text-green-100 text-balance">
          Essential tools for calculating plates, 1RM estimates, and finding exercise alternatives
        </p>
      </div>

      {/* Tabs */}
      <div className="rounded-2xl bg-white p-6 shadow-premium border-2 border-zinc-100 dark:bg-zinc-900 dark:border-zinc-800">
        <div className="flex gap-2 sm:gap-3 overflow-x-auto pb-2 scrollbar-hide animate-fadeIn flex-wrap">
          {tabs.map(({ key, label, icon: Icon }) => (
            <button
              key={key}
              onClick={() => setActiveTab(key as typeof activeTab)}
              className={`flex items-center gap-2 flex-shrink-0 rounded-xl px-4 py-3 sm:px-6 sm:py-4 font-bold transition-all hover:scale-105 shadow-md active:scale-95 ${
                activeTab === key
                  ? 'gradient-purple text-white shadow-glow-purple'
                  : 'bg-white text-zinc-700 hover:bg-zinc-100 border-2 border-zinc-200 dark:bg-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-700 dark:border-zinc-700'
              }`}
            >
              <Icon className="h-5 w-5" />
              <span className="text-sm sm:text-base">{label}</span>
            </button>
          ))}
        </div>

        {/* Plate Calculator */}
        {activeTab === 'plates' && <PlateCalculator />}

        {/* 1RM Calculator */}
        {activeTab === 'rm' && <OneRMCalculator />}

        {/* Exercise Substitutions */}
        {activeTab === 'substitutions' && <ExerciseSubstitutions />}
        {activeTab === 'custom' && <CustomExercises />}
      </div>
    </div>
  );
}

// ============================================================
// PLATE CALCULATOR
// ============================================================

function PlateCalculator() {
  const [targetWeight, setTargetWeight] = useState('');
  const [barWeight, setBarWeight] = useState('45');
  const [unit, setUnit] = useState<'lbs' | 'kg'>('lbs');

  const calculatePlates = () => {
    const target = parseFloat(targetWeight);
    const bar = parseFloat(barWeight);

    if (isNaN(target) || isNaN(bar) || target <= bar) {
      return null;
    }

    const weightToLoad = (target - bar) / 2; // Weight per side

    // Available plates (in lbs or kg)
    const availablePlates = unit === 'lbs'
      ? [45, 35, 25, 10, 5, 2.5]
      : [25, 20, 15, 10, 5, 2.5, 1.25];

    const platesNeeded: { weight: number; count: number }[] = [];
    let remaining = weightToLoad;

    for (const plate of availablePlates) {
      const count = Math.floor(remaining / plate);
      if (count > 0) {
        platesNeeded.push({ weight: plate, count });
        remaining -= plate * count;
      }
    }

    return {
      perSide: weightToLoad,
      plates: platesNeeded,
      exact: remaining < 0.1,
      difference: remaining,
    };
  };

  const result = calculatePlates();

  return (
    <div className="space-y-6 mt-6">
      <div className="grid gap-4 md:grid-cols-3">
        <div>
          <label className="mb-2 block text-sm font-bold text-zinc-700 dark:text-zinc-300">
            Target Weight
          </label>
          <input
            type="number"
            value={targetWeight}
            onChange={(e) => setTargetWeight(e.target.value)}
            placeholder="e.g., 225"
            inputMode="decimal"
            className="w-full rounded-xl border-2 border-zinc-200 bg-white px-4 py-3 text-base font-bold text-zinc-900 transition-all focus:border-purple-500 focus:outline-none focus:ring-2 focus:ring-purple-500/20 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-50"
          />
        </div>

        <div>
          <label className="mb-2 block text-sm font-bold text-zinc-700 dark:text-zinc-300">
            Bar Weight
          </label>
          <input
            type="number"
            value={barWeight}
            onChange={(e) => setBarWeight(e.target.value)}
            inputMode="decimal"
            className="w-full rounded-xl border-2 border-zinc-200 bg-white px-4 py-3 text-base font-bold text-zinc-900 transition-all focus:border-purple-500 focus:outline-none focus:ring-2 focus:ring-purple-500/20 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-50"
          />
        </div>

        <div>
          <label className="mb-2 block text-sm font-bold text-zinc-700 dark:text-zinc-300">
            Unit
          </label>
          <select
            value={unit}
            onChange={(e) => setUnit(e.target.value as 'lbs' | 'kg')}
            className="w-full rounded-xl border-2 border-zinc-200 bg-white px-4 py-3 text-base font-bold text-zinc-900 transition-all focus:border-purple-500 focus:outline-none focus:ring-2 focus:ring-purple-500/20 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-50"
          >
            <option value="lbs">Pounds (lbs)</option>
            <option value="kg">Kilograms (kg)</option>
          </select>
        </div>
      </div>

      {result && (
        <div className="rounded-xl bg-blue-50 p-6 dark:bg-blue-950/20">
          <h3 className="mb-4 text-lg font-semibold text-blue-900 dark:text-blue-100">
            Load {result.perSide.toFixed(1)} {unit} per side
          </h3>

          <div className="space-y-4">
            {result.plates.map((plate, idx) => (
              <div
                key={idx}
                className="flex items-center justify-between rounded-lg bg-white p-4 dark:bg-zinc-800"
              >
                <div className="flex items-center gap-4">
                  <div
                    className="flex h-16 w-16 items-center justify-center rounded-lg bg-blue-600 text-white"
                    style={{ height: `${Math.max(64, plate.weight * 1.5)}px` }}
                  >
                    <span className="text-lg font-bold">{plate.weight}</span>
                  </div>
                  <div>
                    <p className="font-semibold text-zinc-900 dark:text-zinc-50">
                      {plate.weight} {unit} plate
                    </p>
                    <p className="text-sm text-zinc-600 dark:text-zinc-400">
                      {plate.count} plate{plate.count > 1 ? 's' : ''} per side
                    </p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-2xl font-bold text-blue-600 dark:text-blue-400">
                    ×{plate.count}
                  </p>
                </div>
              </div>
            ))}
          </div>

          {!result.exact && (
            <p className="mt-4 text-sm text-orange-600 dark:text-orange-400">
              ⚠️ Cannot load exactly {targetWeight} {unit}. Off by {result.difference.toFixed(1)} {unit} per side.
            </p>
          )}

          <div className="mt-6 rounded-lg bg-zinc-100 p-4 dark:bg-zinc-800">
            <p className="text-sm font-medium text-zinc-700 dark:text-zinc-300">Visual Guide:</p>
            <div className="mt-2 flex items-center gap-1">
              <div className="h-2 w-20 rounded bg-zinc-400" title="Bar" />
              {result.plates.map((plate, idx) =>
                Array(plate.count)
                  .fill(null)
                  .map((_, i) => (
                    <div
                      key={`${idx}-${i}`}
                      className="rounded bg-blue-600"
                      style={{
                        height: `${Math.max(20, plate.weight * 0.8)}px`,
                        width: '12px',
                      }}
                      title={`${plate.weight} ${unit}`}
                    />
                  ))
              )}
              <div className="h-2 flex-1 rounded bg-zinc-400" title="Bar" />
              {result.plates.map((plate, idx) =>
                Array(plate.count)
                  .fill(null)
                  .map((_, i) => (
                    <div
                      key={`${idx}-${i}`}
                      className="rounded bg-blue-600"
                      style={{
                        height: `${Math.max(20, plate.weight * 0.8)}px`,
                        width: '12px',
                      }}
                      title={`${plate.weight} ${unit}`}
                    />
                  ))
              )}
              <div className="h-2 w-20 rounded bg-zinc-400" title="Bar" />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ============================================================
// 1RM CALCULATOR
// ============================================================

function OneRMCalculator() {
  const [weight, setWeight] = useState('');
  const [reps, setReps] = useState('');

  const calculate1RM = () => {
    const w = parseFloat(weight);
    const r = parseInt(reps);

    if (isNaN(w) || isNaN(r) || w <= 0 || r <= 0 || r > 20) {
      return null;
    }

    // Multiple formulas
    const epley = w * (1 + r / 30);
    const brzycki = w * (36 / (37 - r));
    const lander = (100 * w) / (101.3 - 2.67123 * r);
    const lombardi = w * Math.pow(r, 0.10);
    const mayhew = (100 * w) / (52.2 + 41.9 * Math.exp(-0.055 * r));
    const oconner = w * (1 + r / 40);
    const wathan = (100 * w) / (48.8 + 53.8 * Math.exp(-0.075 * r));

    const average = (epley + brzycki + lander + lombardi + mayhew + oconner + wathan) / 7;

    return {
      epley: Math.round(epley),
      brzycki: Math.round(brzycki),
      lander: Math.round(lander),
      lombardi: Math.round(lombardi),
      mayhew: Math.round(mayhew),
      oconner: Math.round(oconner),
      wathan: Math.round(wathan),
      average: Math.round(average),
    };
  };

  const result = calculate1RM();

  return (
    <div className="space-y-6 mt-6">
      <div className="grid gap-4 md:grid-cols-2">
        <div>
          <label className="mb-2 block text-sm font-bold text-zinc-700 dark:text-zinc-300">
            Weight Lifted
          </label>
          <input
            type="number"
            value={weight}
            onChange={(e) => setWeight(e.target.value)}
            placeholder="e.g., 185"
            inputMode="decimal"
            className="w-full rounded-xl border-2 border-zinc-200 bg-white px-4 py-3 text-base font-bold text-zinc-900 transition-all focus:border-purple-500 focus:outline-none focus:ring-2 focus:ring-purple-500/20 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-50"
          />
        </div>

        <div>
          <label className="mb-2 block text-sm font-bold text-zinc-700 dark:text-zinc-300">
            Reps Completed
          </label>
          <input
            type="number"
            value={reps}
            onChange={(e) => setReps(e.target.value)}
            placeholder="e.g., 8"
            inputMode="numeric"
            className="w-full rounded-xl border-2 border-zinc-200 bg-white px-4 py-3 text-base font-bold text-zinc-900 transition-all focus:border-purple-500 focus:outline-none focus:ring-2 focus:ring-purple-500/20 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-50"
          />
        </div>
      </div>

      {result && (
        <div className="space-y-4">
          <div className="rounded-xl bg-gradient-to-r from-blue-600 to-purple-600 p-6 text-white">
            <h3 className="mb-2 text-sm font-medium opacity-90">Estimated 1RM (Average)</h3>
            <p className="text-5xl font-bold">{result.average} lbs</p>
            <p className="mt-2 text-sm opacity-75">Based on {weight} lbs × {reps} reps</p>
          </div>

          <div className="rounded-xl bg-white p-6 dark:bg-zinc-800">
            <h3 className="mb-4 text-lg font-semibold text-zinc-900 dark:text-zinc-50">
              Formula Breakdown
            </h3>
            <div className="grid gap-3 md:grid-cols-2">
              {[
                { name: 'Epley', value: result.epley, note: 'Most common' },
                { name: 'Brzycki', value: result.brzycki, note: 'Conservative' },
                { name: 'Lander', value: result.lander, note: 'Moderate' },
                { name: 'Lombardi', value: result.lombardi, note: 'Lower reps' },
                { name: 'Mayhew', value: result.mayhew, note: 'Athletes' },
                { name: "O'Conner", value: result.oconner, note: 'Aggressive' },
                { name: 'Wathan', value: result.wathan, note: 'Higher reps' },
              ].map((formula) => (
                <div
                  key={formula.name}
                  className="rounded-lg bg-zinc-50 p-4 dark:bg-zinc-700"
                >
                  <div className="flex items-baseline justify-between">
                    <p className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
                      {formula.name}
                    </p>
                    <p className="text-xl font-bold text-zinc-900 dark:text-zinc-50">
                      {formula.value}
                    </p>
                  </div>
                  <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">{formula.note}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Percentage Table */}
          <div className="rounded-xl bg-white p-6 dark:bg-zinc-800">
            <h3 className="mb-4 text-lg font-semibold text-zinc-900 dark:text-zinc-50">
              Training Percentages
            </h3>
            <div className="grid gap-2">
              {[100, 95, 90, 85, 80, 75, 70, 65, 60].map((percentage) => (
                <div
                  key={percentage}
                  className="flex items-center justify-between rounded-lg bg-zinc-50 px-4 py-2 dark:bg-zinc-700"
                >
                  <span className="font-medium text-zinc-700 dark:text-zinc-300">
                    {percentage}%
                  </span>
                  <span className="text-lg font-bold text-zinc-900 dark:text-zinc-50">
                    {Math.round(result.average * (percentage / 100))} lbs
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ============================================================
// EXERCISE SUBSTITUTIONS
// ============================================================

function ExerciseSubstitutions() {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedExercise, setSelectedExercise] = useState<typeof defaultExercises[0] | null>(null);

  const filteredExercises = defaultExercises.filter((ex) =>
    ex.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const getSubstitutions = (exercise: typeof defaultExercises[0]) => {
    // Find exercises that target the same primary muscle groups
    return defaultExercises.filter((ex) => {
      if (ex.id === exercise.id) return false;

      // Check if they share muscle groups
      const sharedMuscles = ex.muscleGroups.filter((mg) =>
        exercise.muscleGroups.includes(mg)
      );

      return sharedMuscles.length > 0;
    });
  };

  const substitutions = selectedExercise ? getSubstitutions(selectedExercise) : [];

  return (
    <div className="space-y-6 mt-6">
      <div>
        <label className="mb-2 block text-sm font-bold text-zinc-700 dark:text-zinc-300">
          Search Exercise
        </label>
        <input
          type="text"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          placeholder="e.g., Bench Press"
          className="w-full rounded-xl border-2 border-zinc-200 bg-white px-4 py-3 text-base font-bold text-zinc-900 transition-all focus:border-purple-500 focus:outline-none focus:ring-2 focus:ring-purple-500/20 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-50"
        />
      </div>

      {searchTerm && (
        <div className="max-h-60 space-y-2 overflow-y-auto">
          {filteredExercises.slice(0, 10).map((exercise) => (
            <button
              key={exercise.id}
              onClick={() => setSelectedExercise(exercise)}
              className="w-full rounded-lg bg-zinc-50 p-4 text-left hover:bg-zinc-100 dark:bg-zinc-800 dark:hover:bg-zinc-700"
            >
              <p className="font-semibold text-zinc-900 dark:text-zinc-50">{exercise.name}</p>
              <div className="mt-1 flex flex-wrap gap-2">
                <span className="rounded-full bg-blue-100 px-2 py-0.5 text-xs text-blue-900 dark:bg-blue-900/30 dark:text-blue-100">
                  {exercise.type}
                </span>
                {exercise.equipment?.map((eq) => (
                  <span
                    key={eq}
                    className="rounded-full bg-zinc-200 px-2 py-0.5 text-xs text-zinc-700 dark:bg-zinc-700 dark:text-zinc-300"
                  >
                    {eq}
                  </span>
                ))}
              </div>
            </button>
          ))}
        </div>
      )}

      {selectedExercise && (
        <div className="space-y-4">
          <div className="rounded-xl bg-blue-50 p-6 dark:bg-blue-950/20">
            <h3 className="mb-2 text-lg font-semibold text-blue-900 dark:text-blue-100">
              Selected: {selectedExercise.name}
            </h3>
            <div className="flex flex-wrap gap-2">
              {selectedExercise.muscleGroups.map((mg) => (
                <span
                  key={mg}
                  className="rounded-full bg-blue-200 px-3 py-1 text-sm font-medium text-blue-900 dark:bg-blue-900 dark:text-blue-100"
                >
                  {mg}
                </span>
              ))}
            </div>
          </div>

          <div className="rounded-xl bg-white p-6 dark:bg-zinc-800">
            <h3 className="mb-4 text-lg font-semibold text-zinc-900 dark:text-zinc-50">
              Alternative Exercises ({substitutions.length})
            </h3>

            {substitutions.length === 0 ? (
              <p className="text-zinc-600 dark:text-zinc-400">
                No substitutions found for this exercise.
              </p>
            ) : (
              <div className="space-y-3">
                {substitutions.map((sub) => {
                  const sharedMuscles = sub.muscleGroups.filter((mg) =>
                    selectedExercise.muscleGroups.includes(mg)
                  );

                  return (
                    <div
                      key={sub.id}
                      className="rounded-lg border border-zinc-200 p-4 dark:border-zinc-700"
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <p className="font-semibold text-zinc-900 dark:text-zinc-50">
                            {sub.name}
                          </p>
                          <div className="mt-2 flex flex-wrap gap-2">
                            <span className="rounded-full bg-zinc-200 px-2 py-0.5 text-xs text-zinc-700 dark:bg-zinc-700 dark:text-zinc-300">
                              {sub.type}
                            </span>
                            {sub.equipment?.map((eq) => (
                              <span
                                key={eq}
                                className="rounded-full bg-zinc-200 px-2 py-0.5 text-xs text-zinc-700 dark:bg-zinc-700 dark:text-zinc-300"
                              >
                                {eq}
                              </span>
                            ))}
                          </div>
                        </div>
                        <div className="ml-4 rounded-full bg-green-100 px-3 py-1 text-sm font-medium text-green-900 dark:bg-green-900/30 dark:text-green-100">
                          {sharedMuscles.length}/{selectedExercise.muscleGroups.length} muscles
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
