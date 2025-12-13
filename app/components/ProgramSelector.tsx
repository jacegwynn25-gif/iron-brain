'use client';

import { useState } from 'react';
import { Library, User, Plus } from 'lucide-react';
import { ProgramTemplate } from '../lib/types';

interface ProgramSelectorProps {
  builtInPrograms: ProgramTemplate[];
  userPrograms: ProgramTemplate[];
  selectedProgram: ProgramTemplate | null;
  onSelectProgram: (program: ProgramTemplate) => void;
  onCreateNew: () => void;
  onDeleteProgram: (programId: string) => void;
}

export default function ProgramSelector({
  builtInPrograms,
  userPrograms,
  selectedProgram,
  onSelectProgram,
  onCreateNew,
  onDeleteProgram,
}: ProgramSelectorProps) {
  const initialTab: 'builtin' | 'mine' = userPrograms.length > 0 ? 'mine' : 'builtin';
  const [activeTab, setActiveTab] = useState<'builtin' | 'mine'>(initialTab);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<string | null>(null);

  const displayPrograms = activeTab === 'builtin' ? builtInPrograms : userPrograms;

  const getProgramStats = (program: ProgramTemplate) => {
    const totalDays = program.weeks.reduce((sum, week) => sum + week.days.length, 0);
    const avgDaysPerWeek = Math.round(totalDays / program.weeks.length);
    const totalExercises = program.weeks.reduce(
      (sum, week) => sum + week.days.reduce(
        (daySum, day) => daySum + new Set(day.sets.map(s => s.exerciseId)).size,
        0
      ),
      0
    );
    const avgExercisesPerDay = Math.round(totalExercises / totalDays);

    return { totalDays, avgDaysPerWeek, totalExercises, avgExercisesPerDay, weeks: program.weeks.length };
  };

  return (
    <div className="space-y-4">
      {/* Header with Tabs */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap gap-3">
          <button
            onClick={() => setActiveTab('builtin')}
            className={`flex items-center gap-2 rounded-xl px-5 py-3 font-bold transition-all hover:scale-105 ${
              activeTab === 'builtin'
                ? 'gradient-purple text-white shadow-glow-purple'
                : 'bg-white text-zinc-700 hover:bg-zinc-100 dark:bg-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-700'
            }`}
          >
            <Library className="h-5 w-5" />
            <span>Built-in</span>
            <span className={`flex h-6 min-w-6 items-center justify-center rounded-full px-2 text-xs font-bold ${
              activeTab === 'builtin'
                ? 'bg-white/20 text-white'
                : 'bg-zinc-200 text-zinc-700 dark:bg-zinc-700 dark:text-zinc-300'
            }`}>
              {builtInPrograms.length}
            </span>
          </button>
          <button
            onClick={() => setActiveTab('mine')}
            className={`flex items-center gap-2 rounded-xl px-5 py-3 font-bold transition-all hover:scale-105 ${
              activeTab === 'mine'
                ? 'gradient-purple text-white shadow-glow-purple'
                : 'bg-white text-zinc-700 hover:bg-zinc-100 dark:bg-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-700'
            }`}
          >
            <User className="h-5 w-5" />
            <span>My Programs</span>
            <span className={`flex h-6 min-w-6 items-center justify-center rounded-full px-2 text-xs font-bold ${
              activeTab === 'mine'
                ? 'bg-white/20 text-white'
                : 'bg-zinc-200 text-zinc-700 dark:bg-zinc-700 dark:text-zinc-300'
            }`}>
              {userPrograms.length}
            </span>
          </button>
        </div>
        <button
          onClick={onCreateNew}
          className="gradient-green flex items-center justify-center gap-2 rounded-xl px-6 py-3 font-bold text-white shadow-glow-green transition-all hover:scale-105 hover:shadow-xl sm:self-auto"
        >
          <Plus className="h-5 w-5" />
          Create New
        </button>
      </div>

      {/* Program Cards Grid */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
        {displayPrograms.map((program) => {
          const stats = getProgramStats(program);
          const isSelected = selectedProgram ? selectedProgram.id === program.id : false;
          const isUserProgram = activeTab === 'mine';

          return (
            <div
              key={program.id}
              className={`group relative rounded-xl border-2 p-5 transition-all hover:shadow-lg ${
                isSelected
                  ? 'border-zinc-900 bg-zinc-50 shadow-md dark:border-zinc-50 dark:bg-zinc-800'
                  : 'border-zinc-200 bg-white hover:border-zinc-400 dark:border-zinc-700 dark:bg-zinc-900 dark:hover:border-zinc-500'
              }`}
            >
              {/* Delete Button (User Programs Only) */}
              {isUserProgram && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setShowDeleteConfirm(program.id);
                  }}
                  className="absolute right-3 top-3 rounded-lg bg-red-600 p-2 text-white opacity-0 transition-opacity hover:bg-red-700 group-hover:opacity-100"
                  title="Delete program"
                >
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                </button>
              )}

              {/* Delete Confirmation Overlay */}
              {showDeleteConfirm === program.id && (
                <div className="absolute inset-0 z-10 flex flex-col items-center justify-center rounded-xl bg-red-600 p-4 text-white">
                  <p className="mb-3 text-center text-sm font-semibold">Delete this program?</p>
                  <div className="flex gap-2">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onDeleteProgram(program.id);
                        setShowDeleteConfirm(null);
                      }}
                      className="rounded-lg bg-white px-4 py-2 text-sm font-semibold text-red-600 hover:bg-red-50"
                    >
                      Yes, Delete
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setShowDeleteConfirm(null);
                      }}
                      className="rounded-lg bg-red-700 px-4 py-2 text-sm font-semibold text-white hover:bg-red-800"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              )}

              {/* Card Content */}
              <button
                onClick={() => onSelectProgram(program)}
                className="w-full text-left"
              >
                {/* Selected Indicator */}
                {isSelected && (
                  <div className="mb-3 flex items-center gap-2 text-sm font-bold text-zinc-900 dark:text-zinc-50">
                    <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                    </svg>
                    SELECTED
                  </div>
                )}

                {/* Program Name */}
                <h3 className="mb-2 text-lg font-bold text-zinc-900 dark:text-zinc-50">
                  {program.name}
                </h3>

                {/* Program Description */}
                {program.description && (
                  <p className="mb-4 line-clamp-2 text-sm text-zinc-600 dark:text-zinc-400">
                    {program.description}
                  </p>
                )}

                {/* Program Metadata */}
                <div className="mb-4 flex flex-wrap gap-2">
                  {program.goal && (
                    <span className="rounded-full bg-blue-100 px-2.5 py-1 text-xs font-medium text-blue-800 dark:bg-blue-900/30 dark:text-blue-300">
                      {program.goal}
                    </span>
                  )}
                  {program.experienceLevel && (
                    <span className="rounded-full bg-purple-100 px-2.5 py-1 text-xs font-medium text-purple-800 dark:bg-purple-900/30 dark:text-purple-300">
                      {program.experienceLevel}
                    </span>
                  )}
                  {program.intensityMethod && (
                    <span className="rounded-full bg-green-100 px-2.5 py-1 text-xs font-medium text-green-800 dark:bg-green-900/30 dark:text-green-300">
                      {program.intensityMethod.toUpperCase()}
                    </span>
                  )}
                </div>

                {/* Program Stats */}
                <div className="grid grid-cols-2 gap-3 border-t border-zinc-200 pt-4 dark:border-zinc-700">
                  <div>
                    <p className="text-xs font-medium text-zinc-500 dark:text-zinc-400">Duration</p>
                    <p className="text-lg font-bold text-zinc-900 dark:text-zinc-50">
                      {stats.weeks} {stats.weeks === 1 ? 'Week' : 'Weeks'}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs font-medium text-zinc-500 dark:text-zinc-400">Days/Week</p>
                    <p className="text-lg font-bold text-zinc-900 dark:text-zinc-50">
                      {stats.avgDaysPerWeek}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs font-medium text-zinc-500 dark:text-zinc-400">Total Days</p>
                    <p className="text-lg font-bold text-zinc-900 dark:text-zinc-50">
                      {stats.totalDays}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs font-medium text-zinc-500 dark:text-zinc-400">Exercises</p>
                    <p className="text-lg font-bold text-zinc-900 dark:text-zinc-50">
                      {stats.totalExercises}
                    </p>
                  </div>
                </div>
              </button>
            </div>
          );
        })}

        {/* Empty State */}
        {displayPrograms.length === 0 && (
          <div className="col-span-full rounded-xl border-2 border-dashed border-zinc-300 bg-zinc-50 p-12 text-center dark:border-zinc-700 dark:bg-zinc-800">
            <svg
              className="mx-auto mb-4 h-12 w-12 text-zinc-400 dark:text-zinc-600"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            <p className="mb-2 text-lg font-semibold text-zinc-700 dark:text-zinc-300">
              No programs here yet
            </p>
            <p className="text-sm text-zinc-500 dark:text-zinc-400">
              {activeTab === 'mine'
                ? 'Create a new program or clone a built-in one to get started'
                : 'Built-in programs will appear here'}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
