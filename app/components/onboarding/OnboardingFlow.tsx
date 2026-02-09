'use client';

import { motion, AnimatePresence } from 'framer-motion';
import {
  ChevronRight,
  ChevronLeft,
  Dumbbell,
  TrendingUp,
  Target,
  Zap,
  Check,
  Loader2,
} from 'lucide-react';
import { useOnboarding, type Goal, type Experience } from '../../lib/hooks/useOnboarding';

interface OnboardingFlowProps {
  onComplete: () => void;
}

const goals = [
  { id: 'strength', label: 'Build Strength', description: 'Lift heavier weights', icon: Dumbbell },
  { id: 'muscle', label: 'Build Muscle', description: 'Maximize hypertrophy', icon: TrendingUp },
  { id: 'fitness', label: 'General Fitness', description: 'Overall health and conditioning', icon: Zap },
  { id: 'sport', label: 'Sport Performance', description: 'Athletic training', icon: Target },
];

const experiences = [
  { id: 'beginner', label: 'Beginner', description: 'Less than 1 year of training' },
  { id: 'intermediate', label: 'Intermediate', description: '1-3 years of consistent training' },
  { id: 'advanced', label: 'Advanced', description: '3+ years, understand programming' },
];

export default function OnboardingFlow({ onComplete }: OnboardingFlowProps) {
  const {
    step,
    formData,
    error,
    isSaving,
    canProceed,
    advance,
    back,
    setGoal,
    setExperience,
    setAge,
    setSex,
    setBodyweight,
    save,
  } = useOnboarding();

  const handleNext = async () => {
    if (step < 4) {
      advance();
      return;
    }

    // Final step - save and complete
    const success = await save();
    if (success) {
      onComplete();
    }
  };

  const handleBack = () => {
    back();
  };

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-zinc-950">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(16,185,129,0.22),transparent_55%)]" />
      <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(180deg,rgba(9,13,22,0.95)_0%,rgba(10,14,24,0.98)_55%,rgba(9,10,16,1)_100%)]" />

      <div className="relative z-10 flex flex-col flex-1">
        <div className="flex justify-center gap-2 pt-12 pb-6">
          {[0, 1, 2, 3, 4].map((i) => (
            <div
              key={i}
              className={`h-2 rounded-full transition-all duration-300 ${
                i === step
                  ? 'w-8 bg-emerald-400'
                  : i < step
                    ? 'w-2 bg-emerald-400/50'
                    : 'w-2 bg-zinc-700'
              }`}
            />
          ))}
        </div>

        <div className="flex-1 px-6 overflow-y-auto">
          <AnimatePresence mode="wait">
          {step === 0 && (
            <motion.div
              key="welcome"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="text-center py-12"
            >
              <div className="mx-auto mb-8 flex h-24 w-24 items-center justify-center rounded-3xl border border-cyan-400/40 bg-gradient-to-br from-cyan-500 to-emerald-500 shadow-xl shadow-cyan-500/20">
                <Dumbbell className="w-12 h-12 text-white" />
              </div>
              <h1 className="text-4xl font-bold text-white mb-4">Iron Brain</h1>
              <p className="mb-2 text-xl text-zinc-300">Train better.</p>
              <p className="mx-auto max-w-xs text-zinc-500">
                Evidence-based training guidance that adapts to you.
              </p>
            </motion.div>
          )}

          {step === 1 && (
            <motion.div
              key="goal"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="py-8"
            >
              <h2 className="text-2xl font-bold text-white mb-2 text-center">
                What&apos;s your main goal?
              </h2>
              <p className="text-center text-zinc-400 mb-8">
                We&apos;ll tailor recommendations to match.
              </p>
              <div className="space-y-3">
                {goals.map((goal) => {
                  const Icon = goal.icon;
                  const isSelected = formData.goal === goal.id;
                  return (
                    <button
                      key={goal.id}
                      onClick={() => setGoal(goal.id as Goal)}
                        className={`w-full p-4 rounded-2xl border-2 transition-all flex items-center gap-4 ${
                        isSelected
                          ? 'border-emerald-400/50 bg-emerald-500/10'
                          : 'border-zinc-800 bg-zinc-950/40 hover:border-zinc-700'
                      }`}
                    >
                      <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${
                        isSelected ? 'bg-emerald-500/80' : 'bg-zinc-900'
                      }`}>
                        <Icon className={`w-6 h-6 ${isSelected ? 'text-white' : 'text-zinc-400'}`} />
                      </div>
                      <div className="text-left flex-1">
                        <div className={`font-semibold ${isSelected ? 'text-white' : 'text-zinc-200'}`}>
                          {goal.label}
                        </div>
                        <div className="text-sm text-zinc-500">{goal.description}</div>
                      </div>
                      {isSelected && (
                        <Check className="w-6 h-6 text-emerald-300" />
                      )}
                    </button>
                  );
                })}
              </div>
            </motion.div>
          )}

          {step === 2 && (
            <motion.div
              key="experience"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="py-8"
            >
              <h2 className="text-2xl font-bold text-white mb-2 text-center">
                Your experience level?
              </h2>
              <p className="text-zinc-400 text-center mb-8">
                This helps us calibrate volume recommendations.
              </p>
              <div className="space-y-3">
                {experiences.map((exp) => {
                  const isSelected = formData.experience === exp.id;
                  return (
                    <button
                      key={exp.id}
                      onClick={() => setExperience(exp.id as Experience)}
                      className={`w-full p-4 rounded-2xl border-2 transition-all text-left ${
                        isSelected
                          ? 'border-emerald-400/50 bg-emerald-500/10'
                          : 'border-zinc-800 bg-zinc-950/40 hover:border-zinc-700'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <div>
                          <div className={`font-semibold ${isSelected ? 'text-white' : 'text-zinc-200'}`}>
                            {exp.label}
                          </div>
                          <div className="text-sm text-zinc-500">{exp.description}</div>
                        </div>
                        {isSelected && (
                          <Check className="w-6 h-6 text-emerald-300" />
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>
            </motion.div>
          )}

          {step === 3 && (
            <motion.div
              key="demographics"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="py-8"
            >
              <h2 className="text-2xl font-bold text-white mb-2 text-center">
                A few more details
              </h2>
              <p className="text-zinc-400 text-center mb-8">
                This enables accurate recovery tracking.
              </p>
              <div className="space-y-4">
                {/* Age */}
                <div>
                  <label className="block text-sm font-medium text-zinc-300 mb-2">
                    Age <span className="text-red-400">*</span>
                  </label>
                  <input
                    type="number"
                    min="13"
                    max="120"
                    value={formData.age || ''}
                    onChange={(e) => setAge(parseInt(e.target.value) || null)}
                    className="w-full rounded-xl border border-zinc-800 bg-zinc-950/50 px-4 py-3 text-white focus:border-emerald-400 focus:outline-none"
                    placeholder="Enter your age"
                  />
                </div>

                {/* Sex */}
                <div>
                  <label className="block text-sm font-medium text-zinc-300 mb-2">
                    Sex <span className="text-red-400">*</span>
                  </label>
                  <div className="grid grid-cols-3 gap-2">
                    {(['male', 'female', 'other'] as const).map((option) => (
                      <button
                        key={option}
                        type="button"
                        onClick={() => setSex(option)}
                        className={`rounded-xl border-2 px-4 py-3 font-medium transition-all ${
                          formData.sex === option
                            ? 'border-emerald-400/50 bg-emerald-500/10 text-emerald-200'
                            : 'border-zinc-800 bg-zinc-950/50 text-zinc-400 hover:border-zinc-700'
                        }`}
                      >
                        {option.charAt(0).toUpperCase() + option.slice(1)}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Bodyweight (Optional) */}
                <div>
                  <label className="block text-sm font-medium text-zinc-300 mb-2">
                    Bodyweight (kg) <span className="text-zinc-500 text-xs">(optional)</span>
                  </label>
                  <input
                    type="number"
                    min="30"
                    max="300"
                    step="0.1"
                    value={formData.bodyweight || ''}
                    onChange={(e) => setBodyweight(parseFloat(e.target.value) || null)}
                    className="w-full rounded-xl border border-zinc-800 bg-zinc-950/50 px-4 py-3 text-white focus:border-emerald-400 focus:outline-none"
                    placeholder="e.g. 75"
                  />
                </div>
              </div>
            </motion.div>
          )}

          {step === 4 && (
            <motion.div
              key="ready"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="text-center py-12"
            >
              <div className="w-20 h-20 mx-auto mb-6 rounded-full bg-gradient-to-br from-emerald-400 to-green-500 flex items-center justify-center shadow-xl shadow-emerald-500/30">
                <Check className="w-10 h-10 text-white" strokeWidth={3} />
              </div>
              <h2 className="text-2xl font-bold text-white mb-2">You&apos;re All Set!</h2>
              <p className="text-zinc-400 max-w-xs mx-auto mb-8">
                Let&apos;s build something great together. Your gains start now.
              </p>
              <div className="mx-auto max-w-xs rounded-2xl border border-zinc-800 bg-zinc-950/50 p-4 text-left">
                <div className="text-sm text-zinc-400 mb-2">Your profile:</div>
                <div className="text-white font-medium">
                  {goals.find(g => g.id === formData.goal)?.label} • {experiences.find(e => e.id === formData.experience)?.label}
                </div>
              </div>
            </motion.div>
          )}
          </AnimatePresence>
        </div>

        <div className="px-6 pb-8 pt-4 safe-bottom">
          {error && (
            <div className="mb-4 p-3 rounded-xl bg-red-500/20 border border-red-500/30 text-red-300 text-sm">
              {error.message}
            </div>
          )}
          <div className="flex gap-3">
          {step > 0 && (
            <button
              onClick={handleBack}
              className="rounded-2xl border border-zinc-800 bg-zinc-950/50 px-6 py-4 font-semibold text-zinc-200 transition-all active:scale-[0.98]"
            >
              <ChevronLeft className="w-5 h-5" />
            </button>
          )}
          <button
            onClick={handleNext}
            disabled={!canProceed || isSaving}
            className={`flex-1 py-4 rounded-2xl font-semibold transition-all active:scale-[0.98] flex items-center justify-center gap-2 ${
              canProceed && !isSaving
                ? 'bg-emerald-500 text-zinc-950 shadow-lg shadow-emerald-500/20'
                : 'border border-zinc-800 bg-zinc-950/50 text-zinc-500'
            }`}
          >
            {isSaving ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                Saving...
              </>
            ) : step === 4 ? (
              'Get Started'
            ) : (
              <>
                Continue
                <ChevronRight className="w-5 h-5" />
              </>
            )}
          </button>
          </div>
        </div>
      </div>
    </div>
  );
}
