'use client';

import { Brain, Dumbbell, Pencil, X, Sparkles } from 'lucide-react';

export type CreationChoice = 'template' | 'manual' | 'intelligent';

interface ProgramCreationChoiceProps {
  onSelect: (choice: CreationChoice) => void;
  onClose: () => void;
}

export default function ProgramCreationChoice({ onSelect, onClose }: ProgramCreationChoiceProps) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
      <div
        className="w-full max-w-lg rounded-2xl surface-card shadow-2xl overflow-hidden animate-slideUp"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="relative p-6 border-b border-white/10 bg-white/5">
          <button
            onClick={onClose}
            className="absolute top-4 right-4 rounded-lg p-2 text-gray-400 hover:bg-white/10 hover:text-white transition-colors"
            aria-label="Close"
          >
            <X className="h-5 w-5" />
          </button>
          <div className="flex items-center gap-3 mb-2">
            <div className="rounded-xl bg-purple-500/20 p-3">
              <Sparkles className="h-6 w-6 text-purple-300" />
            </div>
            <div>
              <h2 className="text-2xl font-bold text-white">Create Your Program</h2>
              <p className="text-sm text-gray-400">Choose how you want to build your training program</p>
            </div>
          </div>
        </div>

        {/* Options */}
        <div className="p-6 space-y-4">
          {/* Option 1: Built-in Templates */}
          <button
            onClick={() => onSelect('template')}
            className="w-full group rounded-xl surface-panel p-5 text-left transition-all hover:bg-white/10 hover:border-purple-500/30 active:scale-[0.98]"
          >
            <div className="flex items-start gap-4">
              <div className="rounded-xl bg-blue-500/20 p-3 group-hover:bg-blue-500/30 transition-colors">
                <Dumbbell className="h-6 w-6 text-blue-300" />
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="text-lg font-semibold text-white mb-1">Use Built-in Template</h3>
                <p className="text-sm text-gray-400">
                  Browse proven programs from experts. Great for beginners or anyone wanting a structured approach.
                </p>
                <div className="mt-3 flex flex-wrap gap-2">
                  <span className="rounded-full bg-blue-500/10 px-2 py-1 text-xs font-medium text-blue-300">
                    PPL
                  </span>
                  <span className="rounded-full bg-blue-500/10 px-2 py-1 text-xs font-medium text-blue-300">
                    5/3/1
                  </span>
                  <span className="rounded-full bg-blue-500/10 px-2 py-1 text-xs font-medium text-blue-300">
                    Upper/Lower
                  </span>
                  <span className="rounded-full bg-blue-500/10 px-2 py-1 text-xs font-medium text-blue-300">
                    +more
                  </span>
                </div>
              </div>
            </div>
          </button>

          {/* Option 2: Manual Builder */}
          <button
            onClick={() => onSelect('manual')}
            className="w-full group rounded-xl surface-panel p-5 text-left transition-all hover:bg-white/10 hover:border-purple-500/30 active:scale-[0.98]"
          >
            <div className="flex items-start gap-4">
              <div className="rounded-xl bg-emerald-500/20 p-3 group-hover:bg-emerald-500/30 transition-colors">
                <Pencil className="h-6 w-6 text-emerald-300" />
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="text-lg font-semibold text-white mb-1">Build from Scratch</h3>
                <p className="text-sm text-gray-400">
                  Full control over every detail. Build your program from scratch with complete customization.
                </p>
                <div className="mt-3 flex flex-wrap gap-2">
                  <span className="rounded-full bg-emerald-500/10 px-2 py-1 text-xs font-medium text-emerald-300">
                    Custom Days
                  </span>
                  <span className="rounded-full bg-emerald-500/10 px-2 py-1 text-xs font-medium text-emerald-300">
                    Any Exercise
                  </span>
                  <span className="rounded-full bg-emerald-500/10 px-2 py-1 text-xs font-medium text-emerald-300">
                    Full Flexibility
                  </span>
                </div>
              </div>
            </div>
          </button>

          {/* Option 3: Guided Builder */}
          <button
            onClick={() => onSelect('intelligent')}
            className="w-full group rounded-xl border border-purple-500/30 bg-gradient-to-br from-purple-900/20 to-fuchsia-900/20 p-5 text-left transition-all hover:from-purple-900/30 hover:to-fuchsia-900/30 hover:border-purple-500/50 active:scale-[0.98]"
          >
            <div className="flex items-start gap-4">
              <div className="rounded-xl bg-purple-500/30 p-3 group-hover:bg-purple-500/40 transition-colors">
                <Brain className="h-6 w-6 text-purple-300" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <h3 className="text-lg font-semibold text-white">Guided Builder</h3>
                  <span className="rounded-full bg-purple-500/30 px-2 py-0.5 text-xs font-bold text-purple-200">
                    NEW
                  </span>
                </div>
                <p className="text-sm text-gray-400">
                  Answer a few questions about your goals, experience, and preferences. We&apos;ll assemble a program you can edit.
                </p>
                <div className="mt-3 flex flex-wrap gap-2">
                  <span className="rounded-full bg-purple-500/20 px-2 py-1 text-xs font-medium text-purple-300">
                    Guided
                  </span>
                  <span className="rounded-full bg-purple-500/20 px-2 py-1 text-xs font-medium text-purple-300">
                    Science-Based
                  </span>
                  <span className="rounded-full bg-purple-500/20 px-2 py-1 text-xs font-medium text-purple-300">
                    Auto-Periodized
                  </span>
                </div>
              </div>
            </div>
          </button>
        </div>

        {/* Footer */}
        <div className="px-6 pb-6">
          <p className="text-center text-xs text-gray-500">
            You can edit your program later in the Program Builder.
          </p>
        </div>
      </div>
    </div>
  );
}
