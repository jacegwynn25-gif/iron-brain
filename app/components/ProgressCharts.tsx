'use client';

import { useState, useMemo } from 'react';
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';
import { TrendingUp, Activity, Zap, Trophy, Heart, Calendar, BarChart3 } from 'lucide-react';
import { defaultExercises } from '../lib/programs';
import { analytics } from '../lib/analytics';
import { storage } from '../lib/storage';
import CustomSelect from './CustomSelect';
import HelpTooltip from './Tooltip';

export default function ProgressCharts() {
  const [selectedExercise, setSelectedExercise] = useState<string>('bench_tng');
  const [viewMode, setViewMode] = useState<'e1rm' | 'volume' | 'rpe' | 'prs' | 'recovery' | 'calendar'>('e1rm');

  // Get all exercises that have workout history
  const exercisesWithHistory = useMemo(() => {
    const history = storage.getWorkoutHistory();
    const exerciseIds = new Set<string>();

    history.forEach(session => {
      session.sets.forEach(set => {
        if (set.completed) {
          exerciseIds.add(set.exerciseId);
        }
      });
    });

    return defaultExercises.filter(ex => exerciseIds.has(ex.id));
  }, []);

  const selectedExerciseData = defaultExercises.find(ex => ex.id === selectedExercise);

  // Data for charts
  const e1rmData = useMemo(() => {
    return analytics.getE1RMProgression(selectedExercise).map(point => ({
      ...point,
      dateFormatted: new Date(point.date).toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
      }),
    }));
  }, [selectedExercise]);

  const volumeData = useMemo(() => {
    return analytics.getVolumeProgression(selectedExercise).map(point => ({
      ...point,
      dateFormatted: new Date(point.date).toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
      }),
    }));
  }, [selectedExercise]);

  const weeklyVolumeData = useMemo(() => {
    return analytics.getWeeklyVolumeProgression(selectedExercise).map(point => ({
      ...point,
      weekFormatted: new Date(point.weekStart).toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
      }),
    }));
  }, [selectedExercise]);

  const rpeConsistency = useMemo(() => {
    return analytics.analyzeRPEConsistency(selectedExercise);
  }, [selectedExercise]);

  const sessionRPETrend = useMemo(() => {
    return analytics.getSessionRPETrend().map(point => ({
      ...point,
      dateFormatted: new Date(point.date).toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
      }),
    }));
  }, []);

  const recentPRs = useMemo(() => {
    if (!selectedExerciseData) return [];
    return analytics.detectNewPRs(selectedExercise, selectedExerciseData.name);
  }, [selectedExercise, selectedExerciseData]);

  const personalRecords = useMemo(() => {
    return storage.getPersonalRecords(selectedExercise);
  }, [selectedExercise]);

  const calendarData = useMemo(() => {
    return analytics.getTrainingCalendar(90); // Last 90 days
  }, []);

  const recoveryMetrics = useMemo(() => {
    return analytics.analyzeRecovery();
  }, []);

  const deloadAnalysis = useMemo(() => {
    return analytics.analyzeDeloadNeed();
  }, []);

  const muscleRecovery = useMemo(() => {
    return analytics.getRecoveryMetrics();
  }, []);

  // Chart colors
  const COLORS = {
    primary: '#18181b', // zinc-900
    success: '#16a34a', // green-600
    warning: '#eab308', // yellow-500
    danger: '#dc2626', // red-600
    info: '#0ea5e9', // sky-500
  };

  const PIE_COLORS = ['#18181b', '#3f3f46', '#71717a', '#a1a1aa', '#d4d4d8'];

  if (exercisesWithHistory.length === 0) {
    return (
      <div className="rounded-xl bg-white p-12 text-center dark:bg-zinc-900">
        <p className="text-zinc-600 dark:text-zinc-400">
          No workout data available yet. Complete some workouts to see analytics!
        </p>
      </div>
    );
  }

  const viewModeConfig = [
    { key: 'e1rm', label: 'E1RM Progression', icon: TrendingUp },
    { key: 'volume', label: 'Volume Trends', icon: Activity },
    { key: 'rpe', label: 'RPE Analysis', icon: Zap },
    { key: 'prs', label: 'Personal Records', icon: Trophy },
    { key: 'recovery', label: 'Recovery', icon: Heart },
    { key: 'calendar', label: 'Training Calendar', icon: Calendar },
  ];

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="rounded-3xl bg-gradient-to-br from-blue-500 via-blue-600 to-purple-600 p-10 shadow-2xl depth-effect animate-slideUp">
        <div className="flex items-center gap-3 mb-3">
          <div className="rounded-xl bg-white/20 p-3 backdrop-blur-sm">
            <BarChart3 className="h-8 w-8 text-white" />
          </div>
          <h2 className="text-5xl font-black text-white">
            Progress Analytics
          </h2>
        </div>
        <p className="text-xl font-medium text-blue-100">
          Detailed performance tracking and insights powered by your workout data
        </p>
      </div>

      {/* Exercise Selector */}
      <div className="rounded-2xl bg-gradient-to-br from-white via-blue-50/20 to-white p-6 shadow-premium border-2 border-zinc-100 dark:from-zinc-900 dark:via-blue-950/10 dark:to-zinc-900 dark:border-zinc-800 depth-effect animate-fadeIn" style={{overflow: 'visible'}}>
        <CustomSelect
          value={selectedExercise}
          onChange={(value) => setSelectedExercise(value)}
          options={exercisesWithHistory.map(ex => ({
            value: ex.id,
            label: ex.name
          }))}
          label="Select Exercise to Analyze"
          className="w-full"
        />
      </div>

      {/* View Mode Tabs */}
      <div className="flex gap-3 overflow-x-auto pb-2 animate-fadeIn" style={{animationDelay: '0.1s'}}>
        {viewModeConfig.map(({ key, label, icon: Icon }) => (
          <button
            key={key}
            onClick={() => setViewMode(key as typeof viewMode)}
            className={`group flex items-center gap-2 flex-shrink-0 rounded-xl px-6 py-4 text-sm font-bold transition-all hover:scale-105 shadow-md ${
              viewMode === key
                ? 'gradient-purple text-white shadow-glow-purple'
                : 'bg-white text-zinc-700 hover:bg-zinc-100 border-2 border-zinc-200 dark:bg-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-700 dark:border-zinc-700'
            }`}
          >
            <Icon className={`h-5 w-5 ${viewMode === key ? 'text-white' : 'text-zinc-500 group-hover:text-zinc-700 dark:text-zinc-400 dark:group-hover:text-zinc-200'}`} />
            {label}
          </button>
        ))}
      </div>

      {/* E1RM Progression Chart */}
      {viewMode === 'e1rm' && (
        <div className="rounded-2xl bg-gradient-to-br from-white via-purple-50/10 to-white p-8 shadow-premium border-2 border-zinc-100 dark:from-zinc-900 dark:via-purple-950/5 dark:to-zinc-900 dark:border-zinc-800 depth-effect animate-fadeIn">
          <div className="flex items-center gap-3 mb-6">
            <div className="rounded-xl bg-purple-100 p-3 dark:bg-purple-900/30">
              <TrendingUp className="h-6 w-6 text-purple-600 dark:text-purple-400" />
            </div>
            <h3 className="text-3xl font-black text-zinc-900 dark:text-zinc-50 flex items-center gap-2">
              Estimated 1RM Progression
              <HelpTooltip content="E1RM (Estimated 1-Rep Max) predicts the maximum weight you could lift for one rep based on your actual performance. Calculated using the Epley formula: weight × (1 + reps/30)" />
            </h3>
          </div>
          <p className="mb-6 text-lg font-medium text-zinc-600 dark:text-zinc-400">
            {selectedExerciseData?.name}
          </p>

          {e1rmData.length === 0 ? (
            <div className="rounded-xl bg-gradient-to-br from-zinc-100 to-zinc-50 p-12 text-center dark:from-zinc-800 dark:to-zinc-800/50">
              <p className="text-lg font-medium text-zinc-600 dark:text-zinc-400">
                No E1RM data available for this exercise yet.
              </p>
            </div>
          ) : (
            <>
              <ResponsiveContainer width="100%" height={400}>
                <LineChart data={e1rmData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e4e4e7" />
                  <XAxis
                    dataKey="dateFormatted"
                    stroke="#71717a"
                    style={{ fontSize: '12px' }}
                  />
                  <YAxis stroke="#71717a" style={{ fontSize: '12px' }} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: '#18181b',
                      border: 'none',
                      borderRadius: '8px',
                      color: '#fafafa',
                    }}
                    formatter={(value: number, name: string) => {
                      if (name === 'e1rm') return [`${value.toFixed(1)} lbs`, 'E1RM'];
                      return [value, name];
                    }}
                  />
                  <Legend />
                  <Line
                    type="monotone"
                    dataKey="e1rm"
                    stroke={COLORS.primary}
                    strokeWidth={3}
                    dot={{ fill: COLORS.primary, r: 5 }}
                    activeDot={{ r: 7 }}
                  />
                </LineChart>
              </ResponsiveContainer>

              {/* Stats Summary */}
              <div className="mt-6 grid grid-cols-3 gap-4">
                <div className="rounded-lg bg-zinc-100 p-4 dark:bg-zinc-800">
                  <p className="text-xs text-zinc-500 dark:text-zinc-400">Current E1RM</p>
                  <p className="mt-1 text-2xl font-bold text-zinc-900 dark:text-zinc-50">
                    {e1rmData[e1rmData.length - 1]?.e1rm.toFixed(1)} lbs
                  </p>
                </div>
                <div className="rounded-lg bg-zinc-100 p-4 dark:bg-zinc-800">
                  <p className="text-xs text-zinc-500 dark:text-zinc-400">Starting E1RM</p>
                  <p className="mt-1 text-2xl font-bold text-zinc-900 dark:text-zinc-50">
                    {e1rmData[0]?.e1rm.toFixed(1)} lbs
                  </p>
                </div>
                <div className="rounded-lg bg-zinc-100 p-4 dark:bg-zinc-800">
                  <p className="text-xs text-zinc-500 dark:text-zinc-400">Total Gain</p>
                  <p className="mt-1 text-2xl font-bold text-green-600">
                    +
                    {(
                      e1rmData[e1rmData.length - 1]?.e1rm - e1rmData[0]?.e1rm || 0
                    ).toFixed(1)}{' '}
                    lbs
                  </p>
                </div>
              </div>
            </>
          )}
        </div>
      )}

      {/* Volume Trends */}
      {viewMode === 'volume' && (
        <div className="space-y-6">
          {/* Per-Session Volume */}
          <div className="rounded-2xl bg-gradient-to-br from-white via-green-50/10 to-white p-8 shadow-premium border-2 border-zinc-100 dark:from-zinc-900 dark:via-green-950/5 dark:to-zinc-900 dark:border-zinc-800 depth-effect animate-fadeIn">
            <div className="flex items-center gap-3 mb-6">
              <div className="rounded-xl bg-green-100 p-3 dark:bg-green-900/30">
                <Activity className="h-6 w-6 text-green-600 dark:text-green-400" />
              </div>
              <h3 className="text-3xl font-black text-zinc-900 dark:text-zinc-50">
                Volume Per Session - {selectedExerciseData?.name}
              </h3>
            </div>

            {volumeData.length === 0 ? (
              <div className="rounded-lg bg-zinc-100 p-8 text-center dark:bg-zinc-800">
                <p className="text-zinc-600 dark:text-zinc-400">
                  No volume data available for this exercise yet.
                </p>
              </div>
            ) : (
              <>
                <ResponsiveContainer width="100%" height={400}>
                  <BarChart data={volumeData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e4e4e7" />
                    <XAxis
                      dataKey="dateFormatted"
                      stroke="#71717a"
                      style={{ fontSize: '12px' }}
                    />
                    <YAxis stroke="#71717a" style={{ fontSize: '12px' }} />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: '#18181b',
                        border: 'none',
                        borderRadius: '8px',
                        color: '#fafafa',
                      }}
                      formatter={(value: number, name: string) => {
                        if (name === 'totalVolume')
                          return [`${value.toLocaleString()} lbs`, 'Total Volume'];
                        if (name === 'sets') return [value, 'Sets'];
                        return [value, name];
                      }}
                    />
                    <Legend />
                    <Bar dataKey="totalVolume" fill={COLORS.primary} radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>

                {/* Volume Stats */}
                <div className="mt-6 grid grid-cols-3 gap-4">
                  <div className="rounded-lg bg-zinc-100 p-4 dark:bg-zinc-800">
                    <p className="text-xs text-zinc-500 dark:text-zinc-400">Avg Volume/Session</p>
                    <p className="mt-1 text-2xl font-bold text-zinc-900 dark:text-zinc-50">
                      {(
                        volumeData.reduce((sum, d) => sum + d.totalVolume, 0) / volumeData.length
                      ).toLocaleString(undefined, { maximumFractionDigits: 0 })}{' '}
                      lbs
                    </p>
                  </div>
                  <div className="rounded-lg bg-zinc-100 p-4 dark:bg-zinc-800">
                    <p className="text-xs text-zinc-500 dark:text-zinc-400">Avg Sets/Session</p>
                    <p className="mt-1 text-2xl font-bold text-zinc-900 dark:text-zinc-50">
                      {(volumeData.reduce((sum, d) => sum + d.sets, 0) / volumeData.length).toFixed(
                        1
                      )}
                    </p>
                  </div>
                  <div className="rounded-lg bg-zinc-100 p-4 dark:bg-zinc-800">
                    <p className="text-xs text-zinc-500 dark:text-zinc-400">Total Sessions</p>
                    <p className="mt-1 text-2xl font-bold text-zinc-900 dark:text-zinc-50">
                      {volumeData.length}
                    </p>
                  </div>
                </div>
              </>
            )}
          </div>

          {/* Weekly Volume */}
          <div className="rounded-xl bg-white p-6 dark:bg-zinc-900">
            <h3 className="mb-4 text-lg font-semibold text-zinc-900 dark:text-zinc-50">
              Weekly Volume Progression
            </h3>

            {weeklyVolumeData.length === 0 ? (
              <div className="rounded-lg bg-zinc-100 p-8 text-center dark:bg-zinc-800">
                <p className="text-zinc-600 dark:text-zinc-400">Not enough data for weekly view.</p>
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={250}>
                <LineChart data={weeklyVolumeData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e4e4e7" />
                  <XAxis
                    dataKey="weekFormatted"
                    stroke="#71717a"
                    style={{ fontSize: '12px' }}
                  />
                  <YAxis stroke="#71717a" style={{ fontSize: '12px' }} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: '#18181b',
                      border: 'none',
                      borderRadius: '8px',
                      color: '#fafafa',
                    }}
                    formatter={(value: number) => [`${value.toLocaleString()} lbs`, 'Weekly Volume']}
                  />
                  <Legend />
                  <Line
                    type="monotone"
                    dataKey="totalVolume"
                    stroke={COLORS.info}
                    strokeWidth={3}
                    dot={{ fill: COLORS.info, r: 5 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>
      )}

      {/* RPE Analysis */}
      {viewMode === 'rpe' && (
        <div className="space-y-6">
          {/* RPE Consistency for Selected Exercise */}
          {rpeConsistency && (
            <div className="rounded-2xl bg-gradient-to-br from-white via-yellow-50/10 to-white p-8 shadow-premium border-2 border-zinc-100 dark:from-zinc-900 dark:via-yellow-950/5 dark:to-zinc-900 dark:border-zinc-800 depth-effect animate-fadeIn">
              <div className="flex items-center gap-3 mb-6">
                <div className="rounded-xl bg-yellow-100 p-3 dark:bg-yellow-900/30">
                  <Zap className="h-6 w-6 text-yellow-600 dark:text-yellow-400" />
                </div>
                <h3 className="text-3xl font-black text-zinc-900 dark:text-zinc-50">
                  RPE Consistency - {selectedExerciseData?.name}
                </h3>
              </div>

              <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
                <div className="rounded-lg bg-zinc-100 p-4 dark:bg-zinc-800">
                  <p className="text-xs text-zinc-500 dark:text-zinc-400">Avg Prescribed RPE</p>
                  <p className="mt-1 text-2xl font-bold text-zinc-900 dark:text-zinc-50">
                    {rpeConsistency.avgPrescribedRPE.toFixed(1)}
                  </p>
                </div>
                <div className="rounded-lg bg-zinc-100 p-4 dark:bg-zinc-800">
                  <p className="text-xs text-zinc-500 dark:text-zinc-400">Avg Actual RPE</p>
                  <p className="mt-1 text-2xl font-bold text-zinc-900 dark:text-zinc-50">
                    {rpeConsistency.avgActualRPE.toFixed(1)}
                  </p>
                </div>
                <div className="rounded-lg bg-zinc-100 p-4 dark:bg-zinc-800">
                  <p className="text-xs text-zinc-500 dark:text-zinc-400">Avg Deviation</p>
                  <p
                    className={`mt-1 text-2xl font-bold ${
                      rpeConsistency.avgDeviation > 0.5
                        ? 'text-red-600'
                        : rpeConsistency.avgDeviation < -0.5
                          ? 'text-blue-600'
                          : 'text-green-600'
                    }`}
                  >
                    {rpeConsistency.avgDeviation > 0 ? '+' : ''}
                    {rpeConsistency.avgDeviation.toFixed(1)}
                  </p>
                </div>
                <div className="rounded-lg bg-zinc-100 p-4 dark:bg-zinc-800">
                  <p className="text-xs text-zinc-500 dark:text-zinc-400">Consistency</p>
                  <p
                    className={`mt-1 text-xl font-bold capitalize ${
                      rpeConsistency.consistency === 'excellent'
                        ? 'text-green-600'
                        : rpeConsistency.consistency === 'good'
                          ? 'text-blue-600'
                          : rpeConsistency.consistency === 'fair'
                            ? 'text-yellow-600'
                            : 'text-red-600'
                    }`}
                  >
                    {rpeConsistency.consistency}
                  </p>
                </div>
              </div>

              <div className="mt-4 rounded-lg bg-zinc-100 p-4 dark:bg-zinc-800">
                <p className="text-sm text-zinc-700 dark:text-zinc-300">
                  {rpeConsistency.avgDeviation > 0.5 ? (
                    <span>
                      You consistently <strong>overshoot</strong> your target RPE by{' '}
                      {rpeConsistency.avgDeviation.toFixed(1)} points. Consider reducing weights
                      slightly to hit prescribed intensity.
                    </span>
                  ) : rpeConsistency.avgDeviation < -0.5 ? (
                    <span>
                      You consistently <strong>undershoot</strong> your target RPE by{' '}
                      {Math.abs(rpeConsistency.avgDeviation).toFixed(1)} points. You may be able to
                      push harder or increase weight.
                    </span>
                  ) : (
                    <span>
                      Great job! You&apos;re consistently hitting your prescribed RPE targets. This
                      indicates good self-awareness and load management.
                    </span>
                  )}
                </p>
              </div>
            </div>
          )}

          {/* Session RPE Trend */}
          <div className="rounded-xl bg-white p-6 dark:bg-zinc-900">
            <h3 className="mb-4 text-lg font-semibold text-zinc-900 dark:text-zinc-50">
              Session RPE Trend (All Workouts)
            </h3>

            {sessionRPETrend.length === 0 ? (
              <div className="rounded-lg bg-zinc-100 p-8 text-center dark:bg-zinc-800">
                <p className="text-zinc-600 dark:text-zinc-400">
                  No RPE data available across sessions yet.
                </p>
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={250}>
                <LineChart data={sessionRPETrend}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e4e4e7" />
                  <XAxis
                    dataKey="dateFormatted"
                    stroke="#71717a"
                    style={{ fontSize: '12px' }}
                  />
                  <YAxis domain={[0, 10]} stroke="#71717a" style={{ fontSize: '12px' }} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: '#18181b',
                      border: 'none',
                      borderRadius: '8px',
                      color: '#fafafa',
                    }}
                    formatter={(value: number) => [value.toFixed(1), 'Session Avg RPE']}
                  />
                  <Legend />
                  <Line
                    type="monotone"
                    dataKey="avgRPE"
                    stroke={COLORS.warning}
                    strokeWidth={2}
                    dot={{ fill: COLORS.warning, r: 4 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>
      )}

      {/* Personal Records */}
      {viewMode === 'prs' && (
        <div className="space-y-6">
          {/* Recent PRs */}
          {recentPRs.length > 0 && (
            <div className="rounded-2xl bg-gradient-to-r from-green-500 to-emerald-600 p-8 text-white shadow-2xl depth-effect animate-slideUp">
              <div className="flex items-center gap-3 mb-6">
                <div className="rounded-xl bg-white/20 p-3 backdrop-blur-sm">
                  <Trophy className="h-8 w-8 text-white" />
                </div>
                <h3 className="text-3xl font-black">
                  New PRs in Last 7 Days!
                </h3>
              </div>
              <div className="grid gap-3 md:grid-cols-2">
                {recentPRs.map((pr, idx) => (
                  <div key={idx} className="rounded-xl bg-white/20 p-4 backdrop-blur hover:scale-105 transition-all">
                    <p className="text-lg font-black">{pr.type.replace('_', ' ').toUpperCase()}</p>
                    <p className="text-base font-medium mt-1">{pr.details}</p>
                    <p className="text-sm opacity-90 mt-2">
                      {new Date(pr.date).toLocaleDateString('en-US', {
                        month: 'short',
                        day: 'numeric',
                        year: 'numeric',
                      })}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* All-Time PRs */}
          {personalRecords && (
            <div className="rounded-2xl bg-gradient-to-br from-white via-orange-50/10 to-white p-8 shadow-premium border-2 border-zinc-100 dark:from-zinc-900 dark:via-orange-950/5 dark:to-zinc-900 dark:border-zinc-800 depth-effect animate-fadeIn">
              <div className="flex items-center gap-3 mb-6">
                <div className="rounded-xl bg-orange-100 p-3 dark:bg-orange-900/30">
                  <Trophy className="h-6 w-6 text-orange-600 dark:text-orange-400" />
                </div>
                <h3 className="text-3xl font-black text-zinc-900 dark:text-zinc-50">
                  All-Time Personal Records - {selectedExerciseData?.name}
                </h3>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div className="rounded-lg border-2 border-zinc-200 p-4 dark:border-zinc-700">
                  <p className="text-sm font-medium text-zinc-500 dark:text-zinc-400">
                    Max Weight
                  </p>
                  <p className="mt-2 text-3xl font-bold text-zinc-900 dark:text-zinc-50">
                    {personalRecords.maxWeight.weight} lbs
                  </p>
                  <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
                    {personalRecords.maxWeight.reps} reps
                  </p>
                  <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
                    {new Date(personalRecords.maxWeight.date).toLocaleDateString()}
                  </p>
                </div>

                <div className="rounded-lg border-2 border-zinc-200 p-4 dark:border-zinc-700">
                  <p className="text-sm font-medium text-zinc-500 dark:text-zinc-400">Max Reps</p>
                  <p className="mt-2 text-3xl font-bold text-zinc-900 dark:text-zinc-50">
                    {personalRecords.maxReps.reps} reps
                  </p>
                  <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
                    @ {personalRecords.maxReps.weight} lbs
                  </p>
                  <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
                    {new Date(personalRecords.maxReps.date).toLocaleDateString()}
                  </p>
                </div>

                <div className="rounded-lg border-2 border-green-200 bg-green-50 p-4 dark:border-green-800 dark:bg-green-950">
                  <p className="text-sm font-medium text-green-700 dark:text-green-300">
                    Max E1RM
                  </p>
                  <p className="mt-2 text-3xl font-bold text-green-900 dark:text-green-50">
                    {personalRecords.maxE1RM.e1rm.toFixed(1)} lbs
                  </p>
                  <p className="mt-1 text-sm text-green-700 dark:text-green-300">
                    {personalRecords.maxE1RM.weight}lbs × {personalRecords.maxE1RM.reps}
                  </p>
                  <p className="mt-1 text-xs text-green-600 dark:text-green-400">
                    {new Date(personalRecords.maxE1RM.date).toLocaleDateString()}
                  </p>
                </div>

                <div className="rounded-lg border-2 border-zinc-200 p-4 dark:border-zinc-700">
                  <p className="text-sm font-medium text-zinc-500 dark:text-zinc-400">
                    Max Volume (Single Set)
                  </p>
                  <p className="mt-2 text-3xl font-bold text-zinc-900 dark:text-zinc-50">
                    {personalRecords.maxVolume.volume.toLocaleString()} lbs
                  </p>
                  <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
                    {personalRecords.maxVolume.weight}lbs × {personalRecords.maxVolume.reps}
                  </p>
                  <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
                    {new Date(personalRecords.maxVolume.date).toLocaleDateString()}
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Recovery & Fatigue */}
      {viewMode === 'recovery' && (
        <div className="space-y-6">
          {/* Deload Analysis */}
          <div className={`rounded-2xl border-2 p-8 shadow-lg depth-effect animate-slideUp ${
            deloadAnalysis.severity === 'critical'
              ? 'border-red-500 bg-red-50 dark:border-red-600 dark:bg-red-900/20'
              : deloadAnalysis.severity === 'high'
                ? 'border-orange-500 bg-orange-50 dark:border-orange-600 dark:bg-orange-900/20'
                : deloadAnalysis.severity === 'moderate'
                  ? 'border-yellow-500 bg-yellow-50 dark:border-yellow-600 dark:bg-yellow-900/20'
                  : 'bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800'
          }`}>
            <div className="mb-6 flex items-center justify-between flex-wrap gap-4">
              <div className="flex items-center gap-3">
                <div className={`rounded-xl p-3 ${
                  deloadAnalysis.shouldDeload
                    ? 'bg-red-100 dark:bg-red-900/30'
                    : 'bg-green-100 dark:bg-green-900/30'
                }`}>
                  <Heart className={`h-6 w-6 ${
                    deloadAnalysis.shouldDeload
                      ? 'text-red-600 dark:text-red-400'
                      : 'text-green-600 dark:text-green-400'
                  }`} />
                </div>
                <h3 className="text-3xl font-black text-zinc-900 dark:text-zinc-50">
                  Deload Analysis
                </h3>
              </div>
              <div className={`rounded-xl px-6 py-3 text-base font-black shadow-md ${
                deloadAnalysis.shouldDeload
                  ? 'bg-red-600 text-white'
                  : 'bg-green-600 text-white'
              }`}>
                {deloadAnalysis.shouldDeload ? 'DELOAD NEEDED' : 'GOOD TO TRAIN'}
              </div>
            </div>

            <div className="mb-4 grid gap-4 sm:grid-cols-3">
              <div className="rounded-lg bg-white/50 p-3 dark:bg-zinc-800/50">
                <p className="text-xs font-medium text-zinc-600 dark:text-zinc-400">Fatigue Score</p>
                <p className="mt-1 text-2xl font-bold text-zinc-900 dark:text-zinc-50">
                  {deloadAnalysis.accumulatedFatigue}/100
                </p>
              </div>
              <div className="rounded-lg bg-white/50 p-3 dark:bg-zinc-800/50">
                <p className="text-xs font-medium text-zinc-600 dark:text-zinc-400">Weeks Training</p>
                <p className="mt-1 text-2xl font-bold text-zinc-900 dark:text-zinc-50">
                  {deloadAnalysis.weeksSinceDeload}
                </p>
              </div>
              <div className="rounded-lg bg-white/50 p-3 dark:bg-zinc-800/50">
                <p className="text-xs font-medium text-zinc-600 dark:text-zinc-400">Severity</p>
                <p className="mt-1 text-2xl font-bold capitalize text-zinc-900 dark:text-zinc-50">
                  {deloadAnalysis.severity}
                </p>
              </div>
            </div>

            <div className="mb-4">
              <p className="text-sm font-medium text-zinc-900 dark:text-zinc-50">
                {deloadAnalysis.reason}
              </p>
            </div>

            {deloadAnalysis.indicators.length > 0 && (
              <div className="mb-4">
                <p className="mb-2 text-xs font-semibold text-zinc-700 dark:text-zinc-300">
                  INDICATORS:
                </p>
                <ul className="space-y-1 text-sm text-zinc-700 dark:text-zinc-300">
                  {deloadAnalysis.indicators.map((indicator, idx) => (
                    <li key={idx} className="flex gap-2">
                      <span>•</span>
                      <span>{indicator}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            <div className="rounded-lg bg-white p-3 dark:bg-zinc-800">
              <p className="mb-2 text-xs font-semibold text-zinc-700 dark:text-zinc-300">
                RECOMMENDATIONS:
              </p>
              <ul className="space-y-1 text-sm text-zinc-700 dark:text-zinc-300">
                {deloadAnalysis.recommendations.map((rec, idx) => (
                  <li key={idx}>{rec}</li>
                ))}
              </ul>
            </div>
          </div>

          {/* Muscle Group Recovery */}
          <div className="rounded-xl bg-white p-6 dark:bg-zinc-900">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">
                Muscle Group Recovery
              </h3>
              <div className={`rounded-full px-3 py-1 text-xs font-bold ${
                muscleRecovery.overallReadiness === 'high'
                  ? 'bg-green-100 text-green-900 dark:bg-green-900/30 dark:text-green-100'
                  : muscleRecovery.overallReadiness === 'medium'
                    ? 'bg-yellow-100 text-yellow-900 dark:bg-yellow-900/30 dark:text-yellow-100'
                    : 'bg-red-100 text-red-900 dark:bg-red-900/30 dark:text-red-100'
              }`}>
                Overall: {muscleRecovery.overallReadiness.toUpperCase()}
              </div>
            </div>

            <div className="mb-4 grid gap-3 sm:grid-cols-2">
              <div className="rounded-lg bg-zinc-100 p-3 dark:bg-zinc-800">
                <p className="text-xs font-medium text-zinc-600 dark:text-zinc-400">
                  Days Since Last Workout
                </p>
                <p className="mt-1 text-2xl font-bold text-zinc-900 dark:text-zinc-50">
                  {muscleRecovery.daysSinceLastWorkout}
                </p>
              </div>
              <div className="rounded-lg bg-zinc-100 p-3 dark:bg-zinc-800">
                <p className="text-xs font-medium text-zinc-600 dark:text-zinc-400">
                  Consecutive Training Days
                </p>
                <p className="mt-1 text-2xl font-bold text-zinc-900 dark:text-zinc-50">
                  {muscleRecovery.consecutiveTrainingDays}
                </p>
              </div>
            </div>

            <div className="space-y-2">
              {muscleRecovery.muscleGroups.map((muscle) => (
                <div
                  key={muscle.muscleGroup}
                  className="flex items-center justify-between rounded-lg border border-zinc-200 p-3 dark:border-zinc-700"
                >
                  <div className="flex-1">
                    <p className="font-medium capitalize text-zinc-900 dark:text-zinc-50">
                      {muscle.muscleGroup}
                    </p>
                    <p className="text-xs text-zinc-600 dark:text-zinc-400">
                      {muscle.recommendation}
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="text-right">
                      <p className="text-xs text-zinc-600 dark:text-zinc-400">
                        {muscle.daysSinceLastTrained === 999 ? 'Never' : `${muscle.daysSinceLastTrained}d ago`}
                      </p>
                    </div>
                    <div className={`rounded-full px-3 py-1 text-xs font-bold ${
                      muscle.status === 'fresh'
                        ? 'bg-green-100 text-green-900 dark:bg-green-900/30 dark:text-green-100'
                        : muscle.status === 'recovered'
                          ? 'bg-blue-100 text-blue-900 dark:bg-blue-900/30 dark:text-blue-100'
                          : 'bg-orange-100 text-orange-900 dark:bg-orange-900/30 dark:text-orange-100'
                    }`}>
                      {muscle.status.toUpperCase()}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Recovery Tips */}
          <div className="rounded-xl bg-white p-6 dark:bg-zinc-900">
            <h3 className="mb-4 text-lg font-semibold text-zinc-900 dark:text-zinc-50">
              Recovery Optimization Tips
            </h3>
            <div className="space-y-3 text-sm text-zinc-700 dark:text-zinc-300">
              <div className="flex items-start gap-3">
                <span className="text-lg">💤</span>
                <div>
                  <p className="font-semibold">Prioritize Sleep</p>
                  <p className="text-zinc-600 dark:text-zinc-400">
                    Aim for 7-9 hours of quality sleep. Track sleep quality in workout notes.
                  </p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <span className="text-lg">🍗</span>
                <div>
                  <p className="font-semibold">Nutrition & Hydration</p>
                  <p className="text-zinc-600 dark:text-zinc-400">
                    Adequate protein (0.8-1g/lb bodyweight) and hydration support recovery.
                  </p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <span className="text-lg">📉</span>
                <div>
                  <p className="font-semibold">Deload Weeks</p>
                  <p className="text-zinc-600 dark:text-zinc-400">
                    Every 4-6 weeks, reduce volume/intensity by 40-50% for recovery.
                  </p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <span className="text-lg">🔄</span>
                <div>
                  <p className="font-semibold">Active Recovery</p>
                  <p className="text-zinc-600 dark:text-zinc-400">
                    Light cardio, stretching, or mobility work on rest days.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Training Calendar/Heatmap */}
      {viewMode === 'calendar' && (
        <div className="rounded-2xl bg-gradient-to-br from-white via-indigo-50/10 to-white p-8 shadow-premium border-2 border-zinc-100 dark:from-zinc-900 dark:via-indigo-950/5 dark:to-zinc-900 dark:border-zinc-800 depth-effect animate-fadeIn">
          <div className="flex items-center gap-3 mb-6">
            <div className="rounded-xl bg-indigo-100 p-3 dark:bg-indigo-900/30">
              <Calendar className="h-6 w-6 text-indigo-600 dark:text-indigo-400" />
            </div>
            <h3 className="text-3xl font-black text-zinc-900 dark:text-zinc-50">
              Training Calendar - Last 90 Days
            </h3>
          </div>

          {/* Stats Summary */}
          <div className="mb-6 grid grid-cols-2 gap-4 md:grid-cols-4">
            <div className="rounded-lg bg-zinc-100 p-4 dark:bg-zinc-800">
              <p className="text-sm text-zinc-600 dark:text-zinc-400">Total Workouts</p>
              <p className="text-2xl font-bold text-zinc-900 dark:text-zinc-50">
                {calendarData.filter(d => d.workoutCount > 0).length}
              </p>
            </div>
            <div className="rounded-lg bg-zinc-100 p-4 dark:bg-zinc-800">
              <p className="text-sm text-zinc-600 dark:text-zinc-400">Total Sets</p>
              <p className="text-2xl font-bold text-zinc-900 dark:text-zinc-50">
                {calendarData.reduce((sum, d) => sum + d.totalSets, 0)}
              </p>
            </div>
            <div className="rounded-lg bg-zinc-100 p-4 dark:bg-zinc-800">
              <p className="text-sm text-zinc-600 dark:text-zinc-400">Current Streak</p>
              <p className="text-2xl font-bold text-zinc-900 dark:text-zinc-50">
                {(() => {
                  let streak = 0;
                  for (let i = calendarData.length - 1; i >= 0; i--) {
                    if (calendarData[i].workoutCount > 0) streak++;
                    else break;
                  }
                  return streak;
                })()}{' '}
                days
              </p>
            </div>
            <div className="rounded-lg bg-zinc-100 p-4 dark:bg-zinc-800">
              <p className="text-sm text-zinc-600 dark:text-zinc-400">Total Volume</p>
              <p className="text-2xl font-bold text-zinc-900 dark:text-zinc-50">
                {(calendarData.reduce((sum, d) => sum + d.totalVolume, 0) / 1000).toFixed(1)}k lbs
              </p>
            </div>
          </div>

          {/* Heatmap Grid */}
          <div className="overflow-x-auto">
            <div className="inline-block min-w-full">
              <div className="mb-4 flex items-center gap-2 text-sm text-zinc-600 dark:text-zinc-400">
                <span>Less</span>
                <div className="flex gap-1">
                  <div className="h-3 w-3 rounded-sm bg-zinc-200 dark:bg-zinc-700" title="No activity" />
                  <div className="h-3 w-3 rounded-sm bg-green-200 dark:bg-green-900" title="Low" />
                  <div className="h-3 w-3 rounded-sm bg-green-400 dark:bg-green-700" title="Medium" />
                  <div className="h-3 w-3 rounded-sm bg-green-600 dark:bg-green-500" title="High" />
                  <div className="h-3 w-3 rounded-sm bg-green-800 dark:bg-green-300" title="Very High" />
                </div>
                <span>More</span>
              </div>

              {/* Group days by week */}
              <div className="grid gap-2" style={{ gridTemplateColumns: 'repeat(13, minmax(0, 1fr))' }}>
                {(() => {
                  const weeks: CalendarDay[][] = [];
                  for (let i = 0; i < calendarData.length; i += 7) {
                    weeks.push(calendarData.slice(i, i + 7));
                  }
                  return weeks.map((week, weekIdx) => (
                    <div key={weekIdx} className="flex flex-col gap-1">
                      {week.map((day) => {
                        const bgColor =
                          day.intensity === 'none'
                            ? 'bg-zinc-200 dark:bg-zinc-700'
                            : day.intensity === 'low'
                              ? 'bg-green-200 dark:bg-green-900'
                              : day.intensity === 'medium'
                                ? 'bg-green-400 dark:bg-green-700'
                                : day.intensity === 'high'
                                  ? 'bg-green-600 dark:bg-green-500'
                                  : 'bg-green-800 dark:bg-green-300';

                        return (
                          <div
                            key={day.date}
                            className={`h-3 w-full rounded-sm ${bgColor} transition-all hover:ring-2 hover:ring-blue-500`}
                            title={`${day.date}\n${day.workoutCount} workout${day.workoutCount !== 1 ? 's' : ''}\n${day.totalSets} sets\n${day.totalVolume.toLocaleString()} lbs volume`}
                          />
                        );
                      })}
                    </div>
                  ));
                })()}
              </div>

              {/* Month labels */}
              <div className="mt-2 flex justify-between text-xs text-zinc-600 dark:text-zinc-400">
                {(() => {
                  const months: string[] = [];
                  const today = new Date();
                  for (let i = 2; i >= 0; i--) {
                    const date = new Date(today);
                    date.setMonth(date.getMonth() - i);
                    months.push(
                      date.toLocaleDateString('en-US', { month: 'short' })
                    );
                  }
                  return months.map((month, idx) => <span key={idx}>{month}</span>);
                })()}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
