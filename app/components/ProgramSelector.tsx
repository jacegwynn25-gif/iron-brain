'use client';

import { useEffect, useState } from 'react';
import { CheckCircle2, FileText, Library, Trash2, User } from 'lucide-react';
import { ProgramTemplate } from '../lib/types';

interface ProgramSelectorProps {
  builtInPrograms: ProgramTemplate[];
  userPrograms: ProgramTemplate[];
  selectedProgram: ProgramTemplate | null;
  onSelectProgram: (program: ProgramTemplate) => void;
  onDeleteProgram: (programId: string) => void;
  preferredTab?: 'builtin' | 'mine';
  variant?: 'compact' | 'grid' | 'list';
}

export default function ProgramSelector({
  builtInPrograms,
  userPrograms,
  selectedProgram,
  onSelectProgram,
  onDeleteProgram,
  preferredTab,
  variant = 'grid',
}: ProgramSelectorProps) {
  const initialTab: 'builtin' | 'mine' = preferredTab ?? (userPrograms.length > 0 ? 'mine' : 'builtin');
  const [activeTab, setActiveTab] = useState<'builtin' | 'mine'>(initialTab);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<string | null>(null);

  const displayPrograms = activeTab === 'builtin' ? builtInPrograms : userPrograms;
  const isList = variant === 'list';
  const gridClassName = isList
    ? 'space-y-2'
    : variant === 'compact'
      ? 'grid grid-cols-1 gap-4'
      : 'grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3';
  const cardBaseClass = isList
    ? 'rounded-xl surface-panel px-3 py-3 transition-all'
    : 'rounded-2xl surface-panel p-4 sm:p-5 backdrop-blur-xl transition-all';
  const cardSelectedClass = isList
    ? 'border-purple-500/40 bg-white/10 shadow-md shadow-purple-500/10'
    : 'border-purple-500/40 bg-white/10 shadow-lg shadow-purple-500/20';
  const cardHoverClass = isList ? 'hover:bg-white/10' : 'hover:bg-white/10';

  useEffect(() => {
    if (preferredTab) {
      setActiveTab(preferredTab);
    }
  }, [preferredTab]);

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
      <div className="flex flex-wrap gap-3">
        <button
          onClick={() => setActiveTab('builtin')}
          className={`flex items-center gap-2 rounded-xl px-4 py-2 font-semibold transition-all active:scale-[0.98] ${
            activeTab === 'builtin'
              ? 'bg-white/10 text-white border border-white/10'
              : 'bg-white/5 text-gray-400 hover:bg-white/10 hover:text-white'
          }`}
        >
          <Library className="h-5 w-5" />
          <span>Built-in</span>
          <span className={`flex h-6 min-w-6 items-center justify-center rounded-full px-2 text-xs font-semibold ${
            activeTab === 'builtin'
              ? 'bg-purple-500/20 text-purple-200'
              : 'bg-white/10 text-gray-300'
          }`}>
            {builtInPrograms.length}
          </span>
        </button>
        <button
          onClick={() => setActiveTab('mine')}
          className={`flex items-center gap-2 rounded-xl px-4 py-2 font-semibold transition-all active:scale-[0.98] ${
            activeTab === 'mine'
              ? 'bg-white/10 text-white border border-white/10'
              : 'bg-white/5 text-gray-400 hover:bg-white/10 hover:text-white'
          }`}
        >
          <User className="h-5 w-5" />
          <span>My Programs</span>
          <span className={`flex h-6 min-w-6 items-center justify-center rounded-full px-2 text-xs font-semibold ${
            activeTab === 'mine'
              ? 'bg-purple-500/20 text-purple-200'
              : 'bg-white/10 text-gray-300'
          }`}>
            {userPrograms.length}
          </span>
        </button>
      </div>

      {/* Program Cards Grid */}
      <div className={gridClassName}>
        {displayPrograms.map((program) => {
          const stats = getProgramStats(program);
          const isSelected = selectedProgram ? selectedProgram.id === program.id : false;
          const isUserProgram = activeTab === 'mine';
          const metaLine = `${stats.weeks} wk • ${stats.avgDaysPerWeek} days/wk • ${stats.totalExercises} exercises`;

          return (
            <div
              key={program.id}
              className={`group relative ${cardBaseClass} ${
                isSelected
                  ? cardSelectedClass
                  : `${cardHoverClass}`
              }`}
            >
              {/* Delete Button (User Programs Only) */}
              {isUserProgram && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setShowDeleteConfirm(program.id);
                  }}
                  className="absolute right-3 top-3 rounded-lg bg-red-500/20 p-2 text-red-200 opacity-0 transition-all hover:bg-red-500/30 group-hover:opacity-100 active:scale-[0.98]"
                  title="Delete program"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              )}

              {/* Delete Confirmation Overlay */}
              {showDeleteConfirm === program.id && (
                <div className="absolute inset-0 z-10 flex flex-col items-center justify-center rounded-2xl bg-zinc-950/90 p-4 text-white backdrop-blur">
                  <p className="mb-3 text-center text-sm font-semibold text-gray-200">Delete this program?</p>
                  <div className="flex gap-2">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onDeleteProgram(program.id);
                        setShowDeleteConfirm(null);
                      }}
                      className="rounded-xl bg-red-500/20 px-4 py-2 text-sm font-semibold text-red-200 hover:bg-red-500/30 active:scale-[0.98]"
                    >
                      Yes, delete
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setShowDeleteConfirm(null);
                      }}
                      className="rounded-xl bg-white/10 px-4 py-2 text-sm font-semibold text-white hover:bg-white/20 active:scale-[0.98]"
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
                  <div className="mb-3 flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-purple-200">
                    <CheckCircle2 className="h-4 w-4" />
                    Selected
                  </div>
                )}

                {/* Program Name */}
                <h3 className={`mb-2 font-semibold text-white ${isList ? 'text-base' : 'text-lg'}`}>
                  {program.name}
                </h3>

                {/* Program Description */}
                {program.description && !isList && (
                  <p className="mb-4 line-clamp-2 text-sm text-gray-400">
                    {program.description}
                  </p>
                )}
                {isList && (
                  <p className="mb-3 text-xs text-gray-400">
                    {metaLine}
                  </p>
                )}

                {/* Program Metadata */}
                <div className={`flex flex-wrap gap-2 ${isList ? 'mb-2' : 'mb-4'}`}>
                  {program.goal && (
                    <span className="rounded-full bg-purple-500/20 px-2.5 py-1 text-xs font-medium text-purple-200">
                      {program.goal}
                    </span>
                  )}
                  {program.experienceLevel && (
                    <span className="rounded-full bg-blue-500/20 px-2.5 py-1 text-xs font-medium text-blue-200">
                      {program.experienceLevel}
                    </span>
                  )}
                  {program.intensityMethod && (
                    <span className="rounded-full bg-emerald-500/20 px-2.5 py-1 text-xs font-medium text-emerald-200">
                      {program.intensityMethod.toUpperCase()}
                    </span>
                  )}
                </div>

                {/* Program Stats */}
                {!isList && (
                  <div className="grid grid-cols-2 gap-3 border-t border-white/10 pt-4">
                    <div>
                      <p className="text-xs font-medium text-gray-500">Duration</p>
                      <p className="text-lg font-semibold text-white">
                        {stats.weeks} {stats.weeks === 1 ? 'Week' : 'Weeks'}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs font-medium text-gray-500">Days/Week</p>
                      <p className="text-lg font-semibold text-white">
                        {stats.avgDaysPerWeek}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs font-medium text-gray-500">Total Days</p>
                      <p className="text-lg font-semibold text-white">
                        {stats.totalDays}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs font-medium text-gray-500">Exercises</p>
                      <p className="text-lg font-semibold text-white">
                        {stats.totalExercises}
                      </p>
                    </div>
                  </div>
                )}
              </button>
            </div>
          );
        })}

        {/* Empty State */}
        {displayPrograms.length === 0 && (
          <div className="col-span-full rounded-2xl surface-panel p-8 text-center backdrop-blur-xl">
            <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-white/10">
              <FileText className="h-6 w-6 text-gray-300" />
            </div>
            <p className="mb-2 text-lg font-semibold text-white">
              No programs here yet
            </p>
            <p className="text-sm text-gray-400">
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
