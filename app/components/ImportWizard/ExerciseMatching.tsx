'use client';

import { useState } from 'react';
import type { ImportSession, ExerciseMatch } from '@/app/lib/importers/types';
import { getAllExercises } from '@/app/lib/programs';
import { updateExerciseMatch } from '@/app/lib/importers/exerciseMatcher';

interface ExerciseMatchingProps {
  session: ImportSession;
  onUpdate: (session: ImportSession) => void;
  onComplete: () => void;
  isProcessing: boolean;
}

export default function ExerciseMatching({
  session,
  onUpdate,
  onComplete,
  isProcessing,
}: ExerciseMatchingProps) {
  const allExercises = getAllExercises();
  const [editingMatch, setEditingMatch] = useState<string | null>(null);

  const needsReviewMatches = session.exerciseMatches?.filter((m) => m.needsReview) || [];
  const autoMatched = session.exerciseMatches?.filter((m) => !m.needsReview) || [];

  const handleMatchUpdate = (originalName: string, newExerciseId: string) => {
    if (!session.exerciseMatches) return;

    const matchIndex = session.exerciseMatches.findIndex((m) => m.originalName === originalName);
    if (matchIndex === -1) return;

    const updatedMatch = updateExerciseMatch(
      session.exerciseMatches[matchIndex],
      newExerciseId,
      allExercises
    );

    const updatedMatches = [...session.exerciseMatches];
    updatedMatches[matchIndex] = updatedMatch;

    onUpdate({
      ...session,
      exerciseMatches: updatedMatches,
    });

    setEditingMatch(null);
  };

  const getConfidenceBadge = (match: ExerciseMatch) => {
    if (match.confidence === 'exact') {
      return <span className="px-2 py-1 bg-green-900/50 text-green-400 text-xs rounded">Exact Match</span>;
    }
    if (match.confidence === 'alias') {
      return <span className="px-2 py-1 bg-blue-900/50 text-blue-400 text-xs rounded">Alias Match</span>;
    }
    if (match.confidence === 'fuzzy') {
      return (
        <span className="px-2 py-1 bg-yellow-900/50 text-yellow-400 text-xs rounded">
          {match.confidenceScore}% Match
        </span>
      );
    }
    return <span className="px-2 py-1 bg-red-900/50 text-red-400 text-xs rounded">No Match</span>;
  };

  return (
    <div className="space-y-6">
      <div className="bg-purple-800/30 rounded-lg p-4">
        <h3 className="text-lg font-semibold text-white mb-2">Exercise Matching Summary</h3>
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <span className="text-gray-400">Auto-matched:</span>
            <span className="ml-2 text-green-400 font-semibold">{autoMatched.length}</span>
          </div>
          <div>
            <span className="text-gray-400">Needs Review:</span>
            <span className="ml-2 text-yellow-400 font-semibold">{needsReviewMatches.length}</span>
          </div>
        </div>
      </div>

      {/* Needs Review Section */}
      {needsReviewMatches.length > 0 && (
        <div className="space-y-4">
          <h3 className="text-lg font-semibold text-white">Review Exercise Matches</h3>
          <p className="text-gray-400 text-sm">
            Please review these exercise matches and confirm or change them as needed.
          </p>

          <div className="space-y-3">
            {needsReviewMatches.map((match) => (
              <div
                key={match.originalName}
                className="bg-purple-800/30 rounded-lg p-4 border border-purple-700"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <span className="text-white font-medium">{match.originalName}</span>
                      {getConfidenceBadge(match)}
                    </div>

                    {editingMatch === match.originalName ? (
                      <div className="space-y-2">
                        <select
                          defaultValue={match.matchedExerciseId || ''}
                          onChange={(e) => handleMatchUpdate(match.originalName, e.target.value)}
                          className="w-full px-3 py-2 bg-purple-900/50 border border-purple-700 rounded-lg text-white"
                        >
                          <option value="">-- Select Exercise --</option>
                          {allExercises.map((ex) => (
                            <option key={ex.id} value={ex.id}>
                              {ex.name}
                            </option>
                          ))}
                        </select>
                        <button
                          onClick={() => setEditingMatch(null)}
                          className="text-sm text-gray-400 hover:text-white"
                        >
                          Cancel
                        </button>
                      </div>
                    ) : (
                      <div className="flex items-center gap-2">
                        <span className="text-gray-400">→</span>
                        <span className="text-pink-400">
                          {match.matchedExerciseName || 'No match'}
                        </span>
                        <button
                          onClick={() => setEditingMatch(match.originalName)}
                          className="ml-auto text-sm text-pink-400 hover:text-pink-300"
                        >
                          Change
                        </button>
                      </div>
                    )}

                    {/* Alternative matches */}
                    {match.alternativeMatches && match.alternativeMatches.length > 0 && (
                      <div className="mt-2 text-sm">
                        <span className="text-gray-500">Alternatives:</span>
                        <div className="flex gap-2 mt-1">
                          {match.alternativeMatches.map((alt) => (
                            <button
                              key={alt.exerciseId}
                              onClick={() => handleMatchUpdate(match.originalName, alt.exerciseId)}
                              className="px-2 py-1 bg-purple-900/50 hover:bg-purple-800/50 text-gray-300 text-xs rounded"
                            >
                              {alt.exerciseName} ({alt.score}%)
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Auto-matched Section (Collapsible) */}
      {autoMatched.length > 0 && (
        <details className="bg-purple-800/20 rounded-lg">
          <summary className="p-4 cursor-pointer text-white font-medium hover:bg-purple-800/30">
            Auto-matched Exercises ({autoMatched.length})
          </summary>
          <div className="p-4 space-y-2">
            {autoMatched.map((match) => (
              <div key={match.originalName} className="flex items-center justify-between text-sm">
                <span className="text-gray-300">{match.originalName}</span>
                <div className="flex items-center gap-2">
                  {getConfidenceBadge(match)}
                  <span className="text-gray-400">→</span>
                  <span className="text-pink-400">{match.matchedExerciseName}</span>
                </div>
              </div>
            ))}
          </div>
        </details>
      )}

      {/* Continue Button */}
      <button
        onClick={onComplete}
        disabled={isProcessing || needsReviewMatches.some((m) => !m.matchedExerciseId)}
        className="w-full py-3 bg-gradient-to-r from-pink-600 to-purple-600 hover:from-pink-700 hover:to-purple-700 disabled:from-gray-600 disabled:to-gray-700 text-white font-semibold rounded-lg transition-all disabled:cursor-not-allowed"
      >
        {isProcessing ? 'Processing...' : 'Continue to Review'}
      </button>
    </div>
  );
}
