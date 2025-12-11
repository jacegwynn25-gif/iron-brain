'use client';

import { useState } from 'react';
import { WorkoutSession, SetLog } from '../lib/types';
import { defaultExercises } from '../lib/programs';
import { storage } from '../lib/storage';
import { parseLocalDate } from '../lib/dateUtils';

interface WorkoutHistoryProps {
  workoutHistory: WorkoutSession[];
  onHistoryUpdate: () => void;
}

export default function WorkoutHistory({ workoutHistory, onHistoryUpdate }: WorkoutHistoryProps) {
  const [expandedSessions, setExpandedSessions] = useState<Set<string>>(new Set());

  const toggleSession = (sessionId: string) => {
    const newExpanded = new Set(expandedSessions);
    if (newExpanded.has(sessionId)) {
      newExpanded.delete(sessionId);
    } else {
      newExpanded.add(sessionId);
    }
    setExpandedSessions(newExpanded);
  };

  const getExerciseName = (exerciseId: string): string => {
    const exercise = defaultExercises.find(ex => ex.id === exerciseId);
    return exercise?.name || exerciseId;
  };

  const getExercisePRs = (exerciseId: string) => {
    const prs = storage.getPersonalRecords(exerciseId);
    return prs;
  };

  const checkIfPR = (set: SetLog, exerciseId: string): { type: string; icon: string } | null => {
    const prs = getExercisePRs(exerciseId);
    if (!prs) return null;

    const setDate = set.timestamp || '';
    const { maxWeight, maxReps, maxE1RM } = prs;

    // Check if this set IS the PR (within same day)
    if (
      maxWeight &&
      set.actualWeight === maxWeight.weight &&
      set.actualReps === maxWeight.reps &&
      setDate.startsWith(maxWeight.date.split('T')[0])
    ) {
      return { type: 'Weight PR', icon: '🏆' };
    }

    if (
      maxReps &&
      set.actualWeight === maxReps.weight &&
      set.actualReps === maxReps.reps &&
      setDate.startsWith(maxReps.date.split('T')[0])
    ) {
      return { type: 'Rep PR', icon: '🔥' };
    }

    if (
      maxE1RM &&
      set.e1rm === maxE1RM.e1rm &&
      setDate.startsWith(maxE1RM.date.split('T')[0])
    ) {
      return { type: 'E1RM PR', icon: '💪' };
    }

    return null;
  };

  const groupSetsByExercise = (sets: SetLog[]) => {
    const grouped: { [exerciseId: string]: SetLog[] } = {};
    for (const set of sets) {
      if (!grouped[set.exerciseId]) {
        grouped[set.exerciseId] = [];
      }
      grouped[set.exerciseId].push(set);
    }
    return grouped;
  };

  const calculateSessionStats = (session: WorkoutSession) => {
    const completedSets = session.sets.filter(s => s.completed);
    const totalVolume = completedSets.reduce((sum, set) => {
      return sum + ((set.actualWeight || 0) * (set.actualReps || 0));
    }, 0);
    const avgRPE = completedSets.length > 0
      ? completedSets.reduce((sum, set) => sum + (set.actualRPE || 0), 0) / completedSets.length
      : 0;

    return { totalVolume, avgRPE };
  };

  const deleteSession = (sessionId: string) => {
    if (!confirm('Delete this workout? This cannot be undone.')) return;
    storage.deleteWorkoutSession(sessionId);
    onHistoryUpdate();
  };

  if (workoutHistory.length === 0) {
    return (
      <div className="rounded-xl border-2 border-dashed border-zinc-300 bg-zinc-50 p-12 text-center dark:border-zinc-700 dark:bg-zinc-800">
        <svg
          className="mx-auto mb-4 h-16 w-16 text-zinc-400 dark:text-zinc-600"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
        </svg>
        <h3 className="mb-2 text-xl font-bold text-zinc-700 dark:text-zinc-300">
          No Workouts Yet
        </h3>
        <p className="text-sm text-zinc-500 dark:text-zinc-400">
          Complete your first workout to see it here with detailed analytics and PR tracking.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* Header with Stats */}
      <div className="rounded-xl bg-gradient-to-r from-purple-500 to-pink-500 p-6 text-white shadow-lg dark:from-purple-700 dark:to-pink-700">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-3xl font-black">
              Workout History
            </h2>
            <p className="mt-1 text-sm font-medium opacity-90">
              {workoutHistory.length} {workoutHistory.length === 1 ? 'session' : 'sessions'} completed
            </p>
          </div>
          <div className="text-right">
            <p className="text-4xl font-black">
              {workoutHistory.reduce((sum, s) => sum + calculateSessionStats(s).totalVolume, 0).toLocaleString()}
            </p>
            <p className="text-xs font-semibold opacity-80">lbs total volume</p>
          </div>
        </div>
      </div>

      <div className="space-y-4">
        {workoutHistory.slice().reverse().map((session, sessionIdx) => {
          const isExpanded = expandedSessions.has(session.id);
          const stats = calculateSessionStats(session);
          const groupedSets = groupSetsByExercise(session.sets);
          const exerciseIds = Object.keys(groupedSets);

          return (
            <div
              key={session.id}
              className="group overflow-hidden rounded-xl border-2 border-zinc-200 bg-gradient-to-br from-white to-zinc-50 shadow-md transition-all hover:shadow-xl dark:border-zinc-800 dark:from-zinc-900 dark:to-zinc-900/50 animate-fadeIn"
              style={{ animationDelay: `${sessionIdx * 50}ms` }}
            >
              {/* Session Header */}
              <div
                className="cursor-pointer bg-gradient-to-r from-purple-500/10 to-pink-500/10 p-6 transition-all hover:from-purple-500/20 hover:to-pink-500/20 dark:from-purple-900/20 dark:to-pink-900/20 dark:hover:from-purple-900/30 dark:hover:to-pink-900/30"
                onClick={() => toggleSession(session.id)}
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-3">
                      <h3 className="text-2xl font-black text-zinc-900 dark:text-zinc-50">
                        {session.dayName}
                      </h3>
                      <span className="rounded-full bg-gradient-to-r from-purple-600 to-pink-600 px-3 py-1 text-xs font-bold text-white shadow-sm">
                        {session.programName}
                      </span>
                    </div>

                    {/* Date */}
                    <div className="mb-4 flex items-center gap-2 text-sm font-medium text-zinc-600 dark:text-zinc-400">
                      <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                      </svg>
                      {parseLocalDate(session.date).toLocaleDateString('en-US', {
                        weekday: 'long',
                        month: 'long',
                        day: 'numeric',
                        year: 'numeric',
                      })}
                    </div>

                    {/* Stats Cards */}
                    <div className="grid grid-cols-3 gap-3">
                      <div className="rounded-lg bg-gradient-to-br from-blue-50 to-cyan-50 border-2 border-blue-200 p-3 dark:from-blue-900/20 dark:to-cyan-900/20 dark:border-blue-800">
                        <p className="text-xs font-semibold uppercase tracking-wide text-blue-700 dark:text-blue-400">
                          Sets
                        </p>
                        <p className="mt-1 text-2xl font-black text-blue-900 dark:text-blue-100">
                          {session.sets.filter(s => s.completed).length}
                        </p>
                      </div>

                      <div className="rounded-lg bg-gradient-to-br from-purple-50 to-pink-50 border-2 border-purple-200 p-3 dark:from-purple-900/20 dark:to-pink-900/20 dark:border-purple-800">
                        <p className="text-xs font-semibold uppercase tracking-wide text-purple-700 dark:text-purple-400">
                          Volume
                        </p>
                        <p className="mt-1 text-2xl font-black text-purple-900 dark:text-purple-100">
                          {Math.round(stats.totalVolume / 1000)}k
                        </p>
                      </div>

                      {stats.avgRPE > 0 && (
                        <div className="rounded-lg bg-gradient-to-br from-orange-50 to-red-50 border-2 border-orange-200 p-3 dark:from-orange-900/20 dark:to-red-900/20 dark:border-orange-800">
                          <p className="text-xs font-semibold uppercase tracking-wide text-orange-700 dark:text-orange-400">
                            Avg RPE
                          </p>
                          <p className="mt-1 text-2xl font-black text-orange-900 dark:text-orange-100">
                            {stats.avgRPE.toFixed(1)}
                          </p>
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="flex flex-col items-end gap-3">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        deleteSession(session.id);
                      }}
                      className="rounded-lg bg-red-100 p-2.5 text-red-600 shadow-sm transition-all hover:bg-red-200 hover:shadow-md dark:bg-red-900/30 dark:text-red-400 dark:hover:bg-red-900/50"
                      title="Delete workout"
                    >
                      <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    </button>
                    <div className="rounded-full bg-white p-2 shadow-sm dark:bg-zinc-800">
                      <svg
                        className={`h-6 w-6 text-zinc-600 dark:text-zinc-400 transition-transform ${isExpanded ? 'rotate-180' : ''}`}
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                      >
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                      </svg>
                    </div>
                  </div>
                </div>
              </div>

              {/* Expanded Details */}
              {isExpanded && (
                <div className="border-t-2 border-zinc-200 bg-gradient-to-br from-zinc-50 to-white p-6 dark:border-zinc-800 dark:from-zinc-800/50 dark:to-zinc-900 animate-slideDown">
                  <div className="space-y-5">
                    {exerciseIds.map((exerciseId, exIdx) => {
                      const exerciseSets = groupedSets[exerciseId];
                      const completedSets = exerciseSets.filter(s => s.completed);
                      if (completedSets.length === 0) return null;

                      const exerciseName = getExerciseName(exerciseId);
                      const exerciseVolume = completedSets.reduce(
                        (sum, set) => sum + ((set.actualWeight || 0) * (set.actualReps || 0)),
                        0
                      );

                      return (
                        <div
                          key={exerciseId}
                          className="rounded-xl border-2 border-zinc-200 bg-gradient-to-br from-white to-zinc-50 p-5 shadow-sm dark:border-zinc-700 dark:from-zinc-900 dark:to-zinc-900/50"
                          style={{ animationDelay: `${exIdx * 100}ms` }}
                        >
                          <div className="mb-4 flex items-center justify-between">
                            <h4 className="text-xl font-black text-zinc-900 dark:text-zinc-50">
                              {exerciseName}
                            </h4>
                            <div className="rounded-lg bg-gradient-to-r from-purple-100 to-pink-100 px-4 py-2 dark:from-purple-900/30 dark:to-pink-900/30">
                              <p className="text-xs font-semibold uppercase tracking-wide text-purple-700 dark:text-purple-400">
                                Volume
                              </p>
                              <p className="text-lg font-black text-purple-900 dark:text-purple-100">
                                {exerciseVolume.toLocaleString()} lbs
                              </p>
                            </div>
                          </div>

                          <div className="space-y-2">
                            {completedSets.map((set, idx) => {
                              const pr = checkIfPR(set, exerciseId);

                              return (
                                <div
                                  key={`${exerciseId}-${set.setIndex}-${idx}-${set.timestamp || idx}`}
                                  className="group flex items-center justify-between rounded-lg border-2 border-zinc-200 bg-white px-4 py-3 shadow-sm transition-all hover:border-purple-300 hover:shadow-md dark:border-zinc-700 dark:bg-zinc-800 dark:hover:border-purple-700"
                                >
                                  <div className="flex items-center gap-4">
                                    <span className="flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br from-zinc-200 to-zinc-300 text-sm font-bold text-zinc-700 dark:from-zinc-700 dark:to-zinc-600 dark:text-zinc-300">
                                      {set.setIndex}
                                    </span>
                                    <div className="flex items-center gap-3 text-sm">
                                      <span className="font-black text-zinc-900 dark:text-zinc-50">
                                        {set.actualWeight} lbs
                                      </span>
                                      <span className="text-zinc-400 dark:text-zinc-600">×</span>
                                      <span className="font-black text-zinc-900 dark:text-zinc-50">
                                        {set.actualReps} reps
                                      </span>
                                      {set.actualRPE && (
                                        <>
                                          <span className="text-zinc-400 dark:text-zinc-600">@</span>
                                          <span className="rounded-full bg-orange-100 px-2 py-0.5 text-xs font-bold text-orange-800 dark:bg-orange-900/30 dark:text-orange-300">
                                            RPE {set.actualRPE}
                                          </span>
                                        </>
                                      )}
                                    </div>
                                  </div>

                                  <div className="flex items-center gap-2">
                                    {set.e1rm && (
                                      <span className="rounded-full bg-gradient-to-r from-blue-100 to-cyan-100 border border-blue-300 px-3 py-1 text-xs font-bold text-blue-800 dark:from-blue-900/30 dark:to-cyan-900/30 dark:border-blue-700 dark:text-blue-300">
                                        {Math.round(set.e1rm)} E1RM
                                      </span>
                                    )}
                                    {pr && (
                                      <span
                                        className="flex items-center gap-1.5 rounded-full bg-gradient-to-r from-amber-400 to-yellow-400 border-2 border-amber-500 px-3 py-1 text-xs font-black text-amber-900 shadow-md animate-pulse dark:from-amber-600 dark:to-yellow-600 dark:border-amber-700 dark:text-amber-100"
                                        title={pr.type}
                                      >
                                        <span className="text-base">{pr.icon}</span>
                                        <span>PR!</span>
                                      </span>
                                    )}
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {session.notes && (
                    <div className="mt-4 rounded-lg bg-amber-50 p-3 dark:bg-amber-900/20">
                      <p className="text-sm font-medium text-amber-900 dark:text-amber-300">
                        Notes: {session.notes}
                      </p>
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
