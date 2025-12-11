'use client';

import { useState } from 'react';
import { format } from 'date-fns';
import type { ImportSession } from '@/app/lib/importers/types';
import { getAllExercises } from '@/app/lib/programs';

interface ReviewImportProps {
  session: ImportSession;
  onConfirm: () => void;
  onBack: () => void;
  isProcessing: boolean;
}

export default function ReviewImport({ session, onConfirm, onBack, isProcessing }: ReviewImportProps) {
  const [expandedSession, setExpandedSession] = useState<string | null>(null);
  const allExercises = getAllExercises();

  const getExerciseName = (exerciseId: string) => {
    const exercise = allExercises.find((e) => e.id === exerciseId);
    return exercise?.name || exerciseId;
  };

  return (
    <div className="space-y-6">
      {/* Summary Stats */}
      <div className="bg-gradient-to-r from-pink-900/30 to-purple-900/30 rounded-lg p-6">
        <h3 className="text-xl font-bold text-white mb-4">Import Summary</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div>
            <div className="text-3xl font-bold text-pink-400">{session.totalSessions}</div>
            <div className="text-sm text-gray-400">Workout Sessions</div>
          </div>
          <div>
            <div className="text-3xl font-bold text-purple-400">{session.totalSets}</div>
            <div className="text-sm text-gray-400">Total Sets</div>
          </div>
          <div>
            <div className="text-lg font-semibold text-white">
              {session.dateRange ? format(session.dateRange.start, 'MMM d') : 'N/A'}
            </div>
            <div className="text-sm text-gray-400">Start Date</div>
          </div>
          <div>
            <div className="text-lg font-semibold text-white">
              {session.dateRange ? format(session.dateRange.end, 'MMM d, yyyy') : 'N/A'}
            </div>
            <div className="text-sm text-gray-400">End Date</div>
          </div>
        </div>

        {/* Merge Strategy Info */}
        <div className="mt-4 pt-4 border-t border-purple-700">
          <div className="text-sm text-gray-300">
            <span className="font-medium">Duplicate Handling: </span>
            {session.config.mergeStrategy === 'skip_duplicates' && 'Skip Duplicates (Keep Existing)'}
            {session.config.mergeStrategy === 'merge_by_date' && 'Merge by Date (Replace Matching Dates)'}
            {session.config.mergeStrategy === 'replace_all' && 'Replace All (Clear Existing History)'}
          </div>
        </div>
      </div>

      {/* Warnings */}
      {session.warnings.length > 0 && (
        <div className="bg-yellow-900/20 border border-yellow-700 rounded-lg p-4">
          <h4 className="text-yellow-400 font-semibold mb-2">Warnings ({session.warnings.length})</h4>
          <ul className="space-y-1 max-h-32 overflow-y-auto">
            {session.warnings.slice(0, 5).map((warning, index) => (
              <li key={index} className="text-yellow-300 text-sm">
                {warning.message}
              </li>
            ))}
            {session.warnings.length > 5 && (
              <li className="text-yellow-400 text-sm">+ {session.warnings.length - 5} more warnings</li>
            )}
          </ul>
        </div>
      )}

      {/* Workout Sessions Preview */}
      <div className="space-y-3">
        <h3 className="text-lg font-semibold text-white">Workout Sessions Preview</h3>
        <div className="max-h-96 overflow-y-auto space-y-2">
          {session.workoutSessions?.map((workout) => (
            <div
              key={workout.id}
              className="bg-purple-800/30 rounded-lg border border-purple-700 overflow-hidden"
            >
              <button
                onClick={() =>
                  setExpandedSession(expandedSession === workout.id ? null : workout.id)
                }
                className="w-full p-4 text-left hover:bg-purple-800/40 transition-colors"
              >
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-white font-medium">
                      Week {workout.weekNumber} - {workout.dayName}
                    </div>
                    <div className="text-sm text-gray-400 mt-1">
                      {format(new Date(workout.date), 'MMM d, yyyy')} • {workout.sets.length} sets
                    </div>
                  </div>
                  <svg
                    className={`w-5 h-5 text-gray-400 transition-transform ${
                      expandedSession === workout.id ? 'rotate-180' : ''
                    }`}
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M19 9l-7 7-7-7"
                    />
                  </svg>
                </div>
              </button>

              {/* Expanded Details */}
              {expandedSession === workout.id && (
                <div className="px-4 pb-4 space-y-2 border-t border-purple-700">
                  {/* Group sets by exercise */}
                  {Object.entries(
                    workout.sets.reduce((acc, set) => {
                      if (!acc[set.exerciseId]) {
                        acc[set.exerciseId] = [];
                      }
                      acc[set.exerciseId].push(set);
                      return acc;
                    }, {} as Record<string, typeof workout.sets>)
                  ).map(([exerciseId, sets]) => (
                    <div key={exerciseId} className="pt-2">
                      <div className="text-pink-400 font-medium text-sm mb-1">
                        {getExerciseName(exerciseId)}
                      </div>
                      <div className="space-y-1">
                        {sets.map((set, idx) => (
                          <div key={idx} className="text-sm text-gray-300 flex items-center gap-4">
                            <span className="text-gray-500">Set {idx + 1}:</span>
                            {set.actualWeight && set.actualReps ? (
                              <>
                                <span>{set.actualWeight} lbs × {set.actualReps} reps</span>
                                {set.actualRPE && <span className="text-gray-400">@ RPE {set.actualRPE}</span>}
                                {set.e1rm && (
                                  <span className="text-purple-400">E1RM: {Math.round(set.e1rm)} lbs</span>
                                )}
                              </>
                            ) : (
                              <span className="text-gray-500">Incomplete</span>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Action Buttons */}
      <div className="flex gap-3">
        <button
          onClick={onBack}
          disabled={isProcessing}
          className="flex-1 py-3 bg-purple-800/50 hover:bg-purple-800/70 disabled:bg-gray-700 text-white font-semibold rounded-lg transition-colors disabled:cursor-not-allowed"
        >
          Back
        </button>
        <button
          onClick={onConfirm}
          disabled={isProcessing}
          className="flex-1 py-3 bg-gradient-to-r from-pink-600 to-purple-600 hover:from-pink-700 hover:to-purple-700 disabled:from-gray-600 disabled:to-gray-700 text-white font-semibold rounded-lg transition-all disabled:cursor-not-allowed"
        >
          {isProcessing ? 'Importing...' : 'Confirm Import'}
        </button>
      </div>
    </div>
  );
}
