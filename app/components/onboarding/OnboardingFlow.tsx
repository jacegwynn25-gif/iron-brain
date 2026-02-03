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
    <div className="fixed inset-0 z-50 flex flex-col bg-[#0b0d14]">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(124,58,237,0.35),transparent_55%)]" />
      <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(180deg,rgba(13,17,30,0.95)_0%,rgba(15,10,28,0.98)_55%,rgba(10,12,20,1)_100%)]" />

      <div className="relative z-10 flex flex-col flex-1">
        <div className="flex justify-center gap-2 pt-12 pb-6">
          {[0, 1, 2, 3, 4].map((i) => (
            <div
              key={i}
              className={`h-2 rounded-full transition-all duration-300 ${
                i === step
                  ? 'w-8 bg-purple-500'
                  : i < step
                    ? 'w-2 bg-purple-500/50'
                    : 'w-2 bg-white/20'
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
              <div className="w-24 h-24 mx-auto mb-8 rounded-3xl bg-gradient-to-br from-purple-500 to-fuchsia-500 flex items-center justify-center shadow-xl shadow-purple-500/30">
                <Dumbbell className="w-12 h-12 text-white" />
              </div>
              <h1 className="text-4xl font-bold text-white mb-4">Iron Brain</h1>
              <p className="text-xl text-gray-300 mb-2">Train better.</p>
              <p className="text-gray-500 max-w-xs mx-auto">
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
              <p className="text-gray-400 text-center mb-8">
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
                          ? 'bg-purple-500/20 border-purple-500'
                          : 'bg-white/5 border-white/10 hover:border-white/20'
                      }`}
                    >
                      <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${
                        isSelected ? 'bg-purple-500' : 'bg-white/10'
                      }`}>
                        <Icon className={`w-6 h-6 ${isSelected ? 'text-white' : 'text-gray-400'}`} />
                      </div>
                      <div className="text-left flex-1">
                        <div className={`font-semibold ${isSelected ? 'text-white' : 'text-gray-200'}`}>
                          {goal.label}
                        </div>
                        <div className="text-sm text-gray-500">{goal.description}</div>
                      </div>
                      {isSelected && (
                        <Check className="w-6 h-6 text-purple-400" />
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
              <p className="text-gray-400 text-center mb-8">
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
                          ? 'bg-purple-500/20 border-purple-500'
                          : 'bg-white/5 border-white/10 hover:border-white/20'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <div>
                          <div className={`font-semibold ${isSelected ? 'text-white' : 'text-gray-200'}`}>
                            {exp.label}
                          </div>
                          <div className="text-sm text-gray-500">{exp.description}</div>
                        </div>
                        {isSelected && (
                          <Check className="w-6 h-6 text-purple-400" />
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
              <p className="text-gray-400 text-center mb-8">
                This enables accurate recovery tracking.
              </p>
              <div className="space-y-4">
                {/* Age */}
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Age <span className="text-red-400">*</span>
                  </label>
                  <input
                    type="number"
                    min="13"
                    max="120"
                    value={formData.age || ''}
                    onChange={(e) => setAge(parseInt(e.target.value) || null)}
                    className="w-full rounded-xl bg-white/10 border border-white/20 px-4 py-3 text-white focus:border-purple-500 focus:outline-none"
                    placeholder="Enter your age"
                  />
                </div>

                {/* Sex */}
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
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
                            ? 'border-purple-500 bg-purple-500/20 text-purple-300'
                            : 'border-white/20 bg-white/5 text-gray-400 hover:border-white/30'
                        }`}
                      >
                        {option.charAt(0).toUpperCase() + option.slice(1)}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Bodyweight (Optional) */}
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Bodyweight (kg) <span className="text-gray-500 text-xs">(optional)</span>
                  </label>
                  <input
                    type="number"
                    min="30"
                    max="300"
                    step="0.1"
                    value={formData.bodyweight || ''}
                    onChange={(e) => setBodyweight(parseFloat(e.target.value) || null)}
                    className="w-full rounded-xl bg-white/10 border border-white/20 px-4 py-3 text-white focus:border-purple-500 focus:outline-none"
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
              <p className="text-gray-400 max-w-xs mx-auto mb-8">
                Let&apos;s build something great together. Your gains start now.
              </p>
              <div className="bg-white/5 rounded-2xl p-4 text-left max-w-xs mx-auto border border-white/10">
                <div className="text-sm text-gray-400 mb-2">Your profile:</div>
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
              className="px-6 py-4 rounded-2xl bg-white/10 text-white font-semibold transition-all active:scale-[0.98]"
            >
              <ChevronLeft className="w-5 h-5" />
            </button>
          )}
          <button
            onClick={handleNext}
            disabled={!canProceed || isSaving}
            className={`flex-1 py-4 rounded-2xl font-semibold transition-all active:scale-[0.98] flex items-center justify-center gap-2 ${
              canProceed && !isSaving
                ? 'btn-primary text-white shadow-lg shadow-purple-500/20'
                : 'bg-white/10 text-gray-500'
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
