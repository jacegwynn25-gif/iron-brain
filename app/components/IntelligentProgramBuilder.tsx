'use client';

import { useState, useCallback, useEffect } from 'react';
import {
  ArrowLeft,
  ArrowRight,
  Brain,
  Loader2,
  Target,
  Trophy,
  X,
  Zap,
  Calendar,
  Settings,
  History,
  Focus,
  AlertTriangle
} from 'lucide-react';
import { ProgramTemplate } from '../lib/types';

// Types for the guided builder input
export interface GuidedBuilderInput {
  // Step 1: Goals
  primaryGoal: 'strength' | 'hypertrophy' | 'powerlifting' | 'general' | 'peaking' | null;
  secondaryGoals: string[];

  // Step 2: Experience
  trainingAge: number | null;
  currentLevel: 'beginner' | 'intermediate' | 'advanced' | null;

  // Step 3: Schedule
  daysPerWeek: 3 | 4 | 5 | 6 | null;
  sessionLengthMinutes: 45 | 60 | 75 | 90 | null;
  weekCount: 4 | 8 | 12 | 16 | null;

  // Step 4: Preferences
  intensityMethod: 'rpe' | 'rir' | 'percentage' | null;
  deloadFrequency: 3 | 4 | 6 | null;
  repRangePreference?: {
    compound?: { min?: number; max?: number };
    isolation?: { min?: number; max?: number };
  };
  rirPreference?: {
    compound?: { min?: number; max?: number };
    isolation?: { min?: number; max?: number };
  };

  // Step 5: History
  previousSuccesses: string[];
  plateauAreas: string[];

  // Step 6: Focus
  emphasisMuscles: string[];
  weakPoints: string[];

  // Step 7: Constraints
  injuries: string[];
  availableEquipment: ('barbell' | 'dumbbell' | 'cable' | 'machine' | 'bodyweight')[];
  mustIncludeExercises: string[];
  mustExcludeExercises: string[];
}

interface IntelligentProgramBuilderProps {
  onComplete: (program: ProgramTemplate) => void;
  onCancel: () => void;
  prefillData?: Partial<GuidedBuilderInput>;
}

const TOTAL_STEPS = 8;

const MUSCLE_GROUPS = [
  'Chest', 'Back', 'Shoulders', 'Biceps', 'Triceps',
  'Quads', 'Hamstrings', 'Glutes', 'Calves', 'Core', 'Forearms'
];

const EQUIPMENT_OPTIONS: { id: GuidedBuilderInput['availableEquipment'][number]; label: string }[] = [
  { id: 'barbell', label: 'Barbell' },
  { id: 'dumbbell', label: 'Dumbbells' },
  { id: 'cable', label: 'Cable Machine' },
  { id: 'machine', label: 'Machines' },
  { id: 'bodyweight', label: 'Bodyweight' },
];

export default function IntelligentProgramBuilder({
  onComplete,
  onCancel,
  prefillData
}: IntelligentProgramBuilderProps) {
  const [step, setStep] = useState(1);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Hide bottom nav while this modal is open
  useEffect(() => {
    localStorage.setItem('iron_brain_hide_bottom_nav', 'true');
    window.dispatchEvent(new Event('iron_brain_nav_visibility'));

    return () => {
      localStorage.removeItem('iron_brain_hide_bottom_nav');
      window.dispatchEvent(new Event('iron_brain_nav_visibility'));
    };
  }, []);

  const [formData, setFormData] = useState<GuidedBuilderInput>({
    primaryGoal: prefillData?.primaryGoal ?? null,
    secondaryGoals: prefillData?.secondaryGoals ?? [],
    trainingAge: prefillData?.trainingAge ?? null,
    currentLevel: prefillData?.currentLevel ?? null,
    daysPerWeek: prefillData?.daysPerWeek ?? null,
    sessionLengthMinutes: prefillData?.sessionLengthMinutes ?? null,
    weekCount: prefillData?.weekCount ?? null,
    intensityMethod: prefillData?.intensityMethod ?? null,
    deloadFrequency: prefillData?.deloadFrequency ?? null,
    repRangePreference: prefillData?.repRangePreference,
    rirPreference: prefillData?.rirPreference,
    previousSuccesses: prefillData?.previousSuccesses ?? [],
    plateauAreas: prefillData?.plateauAreas ?? [],
    emphasisMuscles: prefillData?.emphasisMuscles ?? [],
    weakPoints: prefillData?.weakPoints ?? [],
    injuries: prefillData?.injuries ?? [],
    availableEquipment: prefillData?.availableEquipment ?? ['barbell', 'dumbbell', 'cable', 'machine', 'bodyweight'],
    mustIncludeExercises: prefillData?.mustIncludeExercises ?? [],
    mustExcludeExercises: prefillData?.mustExcludeExercises ?? [],
  });

  const canProceed = useCallback(() => {
    switch (step) {
      case 1: return formData.primaryGoal !== null;
      case 2: return formData.currentLevel !== null;
      case 3: return formData.daysPerWeek !== null && formData.weekCount !== null;
      case 4: return formData.intensityMethod !== null;
      case 5: return true; // Optional
      case 6: return true; // Optional
      case 7: return formData.availableEquipment.length > 0;
      case 8: return true; // Review step
      default: return false;
    }
  }, [step, formData]);

  const handleNext = () => {
    if (step < TOTAL_STEPS && canProceed()) {
      setStep(step + 1);
    }
  };

  const handleBack = () => {
    if (step > 1) {
      setStep(step - 1);
    }
  };

  const handleGenerate = async () => {
    setGenerating(true);
    setError(null);

    try {
      const response = await fetch('/api/programs/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to generate program');
      }

      const { program } = await response.json();
      onComplete(program);
    } catch (err) {
      console.error('Error generating program:', err);
      setError(err instanceof Error ? err.message : 'Failed to generate program');
    } finally {
      setGenerating(false);
    }
  };

  const toggleArrayItem = <T,>(array: T[], item: T): T[] => {
    return array.includes(item)
      ? array.filter(i => i !== item)
      : [...array, item];
  };

  const renderStepContent = () => {
    switch (step) {
      case 1:
        return (
          <div className="space-y-4">
            <div className="flex items-center gap-3 mb-4">
              <div className="flex-shrink-0 w-10 h-10 rounded-full bg-purple-500/20 flex items-center justify-center">
                <Target className="h-5 w-5 text-purple-300" />
              </div>
              <div>
                <h2 className="text-lg font-bold text-white">What&apos;s Your Primary Goal?</h2>
                <p className="text-sm text-gray-400">This shapes your program structure</p>
              </div>
            </div>

            <div className="grid gap-2">
              {[
                { id: 'strength', label: 'Build Strength', desc: 'Increase your 1RM on major lifts' },
                { id: 'hypertrophy', label: 'Build Muscle', desc: 'Maximize muscle growth and size' },
                { id: 'powerlifting', label: 'Powerlifting', desc: 'Compete or peak for squat/bench/deadlift' },
                { id: 'general', label: 'General Fitness', desc: 'Balanced strength and muscle development' },
                { id: 'peaking', label: 'Peaking/Competition', desc: 'Prepare for a specific event or test' },
              ].map(({ id, label, desc }) => (
                <button
                  key={id}
                  type="button"
                  onClick={() => setFormData({ ...formData, primaryGoal: id as GuidedBuilderInput['primaryGoal'] })}
                  className={`w-full rounded-xl border p-4 text-left transition-all active:scale-[0.98] ${
                    formData.primaryGoal === id
                      ? 'border-purple-500 bg-purple-500/20 text-white'
                      : 'border-white/10 bg-white/5 text-gray-300 hover:bg-white/10'
                  }`}
                >
                  <p className="font-semibold">{label}</p>
                  <p className="text-sm text-gray-400">{desc}</p>
                </button>
              ))}
            </div>
          </div>
        );

      case 2:
        return (
          <div className="space-y-4">
            <div className="flex items-center gap-3 mb-4">
              <div className="flex-shrink-0 w-10 h-10 rounded-full bg-emerald-500/20 flex items-center justify-center">
                <Trophy className="h-5 w-5 text-emerald-300" />
              </div>
              <div>
                <h2 className="text-lg font-bold text-white">Your Experience Level</h2>
                <p className="text-sm text-gray-400">Be honest - affects volume & progression</p>
              </div>
            </div>

            <div className="grid gap-2">
              {[
                { id: 'beginner', label: 'Beginner', desc: 'Less than 1 year of consistent training', years: '0-1 years' },
                { id: 'intermediate', label: 'Intermediate', desc: 'Can progress workout to workout slowing down', years: '1-3 years' },
                { id: 'advanced', label: 'Advanced', desc: 'Need periodization to continue progressing', years: '3+ years' },
              ].map(({ id, label, desc, years }) => (
                <button
                  key={id}
                  type="button"
                  onClick={() => setFormData({ ...formData, currentLevel: id as GuidedBuilderInput['currentLevel'] })}
                  className={`w-full rounded-xl border p-4 text-left transition-all active:scale-[0.98] ${
                    formData.currentLevel === id
                      ? 'border-emerald-500 bg-emerald-500/20 text-white'
                      : 'border-white/10 bg-white/5 text-gray-300 hover:bg-white/10'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-semibold">{label}</p>
                      <p className="text-sm text-gray-400">{desc}</p>
                    </div>
                    <span className="rounded-full bg-white/10 px-3 py-1 text-xs font-medium text-gray-300">
                      {years}
                    </span>
                  </div>
                </button>
              ))}
            </div>

            <div className="mt-6">
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Training Age (years) <span className="text-gray-500">(optional)</span>
              </label>
              <input
                type="number"
                min="0"
                max="50"
                step="0.5"
                value={formData.trainingAge ?? ''}
                onChange={(e) => setFormData({
                  ...formData,
                  trainingAge: e.target.value ? parseFloat(e.target.value) : null
                })}
                placeholder="e.g., 2.5"
                className="w-full rounded-lg bg-gray-800 border border-gray-700 px-4 py-3 text-white focus:border-emerald-500 focus:outline-none"
              />
            </div>
          </div>
        );

      case 3:
        return (
          <div className="space-y-4">
            <div className="flex items-center gap-3 mb-4">
              <div className="flex-shrink-0 w-10 h-10 rounded-full bg-blue-500/20 flex items-center justify-center">
                <Calendar className="h-5 w-5 text-blue-300" />
              </div>
              <div>
                <h2 className="text-lg font-bold text-white">Your Schedule</h2>
                <p className="text-sm text-gray-400">How often can you train?</p>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-300 mb-3">
                Days Per Week <span className="text-red-400">*</span>
              </label>
              <div className="grid grid-cols-4 gap-3">
                {([3, 4, 5, 6] as const).map((days) => (
                  <button
                    key={days}
                    type="button"
                    onClick={() => setFormData({ ...formData, daysPerWeek: days })}
                    className={`rounded-xl border p-4 text-center transition-all active:scale-[0.98] ${
                      formData.daysPerWeek === days
                        ? 'border-blue-500 bg-blue-500/20 text-white'
                        : 'border-white/10 bg-white/5 text-gray-300 hover:bg-white/10'
                    }`}
                  >
                    <p className="text-2xl font-bold">{days}</p>
                    <p className="text-xs text-gray-400">days</p>
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-300 mb-3">
                Session Length <span className="text-gray-500">(optional)</span>
              </label>
              <div className="grid grid-cols-4 gap-3">
                {([45, 60, 75, 90] as const).map((mins) => (
                  <button
                    key={mins}
                    type="button"
                    onClick={() => setFormData({ ...formData, sessionLengthMinutes: mins })}
                    className={`rounded-xl border p-3 text-center transition-all active:scale-[0.98] ${
                      formData.sessionLengthMinutes === mins
                        ? 'border-blue-500 bg-blue-500/20 text-white'
                        : 'border-white/10 bg-white/5 text-gray-300 hover:bg-white/10'
                    }`}
                  >
                    <p className="font-semibold">{mins} min</p>
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-300 mb-3">
                Program Length <span className="text-red-400">*</span>
              </label>
              <div className="grid grid-cols-4 gap-3">
                {([4, 8, 12, 16] as const).map((weeks) => (
                  <button
                    key={weeks}
                    type="button"
                    onClick={() => setFormData({ ...formData, weekCount: weeks })}
                    className={`rounded-xl border p-3 text-center transition-all active:scale-[0.98] ${
                      formData.weekCount === weeks
                        ? 'border-blue-500 bg-blue-500/20 text-white'
                        : 'border-white/10 bg-white/5 text-gray-300 hover:bg-white/10'
                    }`}
                  >
                    <p className="font-semibold">{weeks}</p>
                    <p className="text-xs text-gray-400">weeks</p>
                  </button>
                ))}
              </div>
            </div>
          </div>
        );

      case 4:
        return (
          <div className="space-y-4">
            <div className="flex items-center gap-3 mb-4">
              <div className="flex-shrink-0 w-10 h-10 rounded-full bg-amber-500/20 flex items-center justify-center">
                <Settings className="h-5 w-5 text-amber-300" />
              </div>
              <div>
                <h2 className="text-lg font-bold text-white">Training Preferences</h2>
                <p className="text-sm text-gray-400">How do you track intensity?</p>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-300 mb-3">
                Intensity Method <span className="text-red-400">*</span>
              </label>
              <div className="grid gap-3">
                {[
                  { id: 'rpe', label: 'RPE (Rate of Perceived Exertion)', desc: 'Scale of 1-10 based on difficulty' },
                  { id: 'rir', label: 'RIR (Reps in Reserve)', desc: 'How many reps you had left in the tank' },
                  { id: 'percentage', label: 'Percentage of 1RM', desc: 'Traditional percentage-based training' },
                ].map(({ id, label, desc }) => (
                  <button
                    key={id}
                    type="button"
                    onClick={() => setFormData({ ...formData, intensityMethod: id as GuidedBuilderInput['intensityMethod'] })}
                    className={`w-full rounded-xl border p-4 text-left transition-all active:scale-[0.98] ${
                      formData.intensityMethod === id
                        ? 'border-amber-500 bg-amber-500/20 text-white'
                        : 'border-white/10 bg-white/5 text-gray-300 hover:bg-white/10'
                    }`}
                  >
                    <p className="font-semibold">{label}</p>
                    <p className="text-sm text-gray-400">{desc}</p>
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-300 mb-3">
                Deload Frequency <span className="text-gray-500">(optional)</span>
              </label>
              <div className="grid grid-cols-3 gap-3">
                {([3, 4, 6] as const).map((weeks) => (
                  <button
                    key={weeks}
                    type="button"
                    onClick={() => setFormData({ ...formData, deloadFrequency: weeks })}
                    className={`rounded-xl border p-3 text-center transition-all active:scale-[0.98] ${
                      formData.deloadFrequency === weeks
                        ? 'border-amber-500 bg-amber-500/20 text-white'
                        : 'border-white/10 bg-white/5 text-gray-300 hover:bg-white/10'
                    }`}
                  >
                    <p className="font-semibold">Every {weeks}</p>
                    <p className="text-xs text-gray-400">weeks</p>
                  </button>
                ))}
              </div>
            </div>
          </div>
        );

      case 5:
        return (
          <div className="space-y-4">
            <div className="flex items-center gap-3 mb-4">
              <div className="flex-shrink-0 w-10 h-10 rounded-full bg-fuchsia-500/20 flex items-center justify-center">
                <History className="h-5 w-5 text-fuchsia-300" />
              </div>
              <div>
                <h2 className="text-lg font-bold text-white">Training History</h2>
                <p className="text-sm text-gray-400">What has worked for you? (Optional)</p>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                What training approaches have worked well?
              </label>
              <textarea
                rows={3}
                value={formData.previousSuccesses.join('\n')}
                onChange={(e) => setFormData({
                  ...formData,
                  previousSuccesses: e.target.value.split('\n').filter(s => s.trim())
                })}
                placeholder="e.g., High frequency squatting, 5x5 programs, PPL split..."
                className="w-full rounded-lg bg-gray-800 border border-gray-700 px-4 py-3 text-white focus:border-fuchsia-500 focus:outline-none resize-none"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Where have you plateaued or struggled?
              </label>
              <textarea
                rows={3}
                value={formData.plateauAreas.join('\n')}
                onChange={(e) => setFormData({
                  ...formData,
                  plateauAreas: e.target.value.split('\n').filter(s => s.trim())
                })}
                placeholder="e.g., Bench press stuck at 225, calf development, pull-up strength..."
                className="w-full rounded-lg bg-gray-800 border border-gray-700 px-4 py-3 text-white focus:border-fuchsia-500 focus:outline-none resize-none"
              />
            </div>
          </div>
        );

      case 6:
        return (
          <div className="space-y-4">
            <div className="flex items-center gap-3 mb-4">
              <div className="flex-shrink-0 w-10 h-10 rounded-full bg-cyan-500/20 flex items-center justify-center">
                <Focus className="h-5 w-5 text-cyan-300" />
              </div>
              <div>
                <h2 className="text-lg font-bold text-white">Focus Areas</h2>
                <p className="text-sm text-gray-400">Muscles to emphasize? (Optional)</p>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-300 mb-3">
                Muscles to Emphasize
              </label>
              <div className="flex flex-wrap gap-2">
                {MUSCLE_GROUPS.map((muscle) => (
                  <button
                    key={muscle}
                    type="button"
                    onClick={() => setFormData({
                      ...formData,
                      emphasisMuscles: toggleArrayItem(formData.emphasisMuscles, muscle.toLowerCase())
                    })}
                    className={`rounded-full px-4 py-2 text-sm font-medium transition-all active:scale-[0.98] ${
                      formData.emphasisMuscles.includes(muscle.toLowerCase())
                        ? 'bg-cyan-500/30 text-cyan-200 border border-cyan-500/50'
                        : 'bg-white/10 text-gray-300 border border-white/10 hover:bg-white/20'
                    }`}
                  >
                    {muscle}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-300 mb-3">
                Weak Points to Address
              </label>
              <div className="flex flex-wrap gap-2">
                {MUSCLE_GROUPS.map((muscle) => (
                  <button
                    key={muscle}
                    type="button"
                    onClick={() => setFormData({
                      ...formData,
                      weakPoints: toggleArrayItem(formData.weakPoints, muscle.toLowerCase())
                    })}
                    className={`rounded-full px-4 py-2 text-sm font-medium transition-all active:scale-[0.98] ${
                      formData.weakPoints.includes(muscle.toLowerCase())
                        ? 'bg-orange-500/30 text-orange-200 border border-orange-500/50'
                        : 'bg-white/10 text-gray-300 border border-white/10 hover:bg-white/20'
                    }`}
                  >
                    {muscle}
                  </button>
                ))}
              </div>
            </div>
          </div>
        );

      case 7:
        return (
          <div className="space-y-4">
            <div className="flex items-center gap-3 mb-4">
              <div className="flex-shrink-0 w-10 h-10 rounded-full bg-red-500/20 flex items-center justify-center">
                <AlertTriangle className="h-5 w-5 text-red-300" />
              </div>
              <div>
                <h2 className="text-lg font-bold text-white">Constraints</h2>
                <p className="text-sm text-gray-400">Any limitations we should know?</p>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-300 mb-3">
                Available Equipment <span className="text-red-400">*</span>
              </label>
              <div className="flex flex-wrap gap-2">
                {EQUIPMENT_OPTIONS.map(({ id, label }) => (
                  <button
                    key={id}
                    type="button"
                    onClick={() => setFormData({
                      ...formData,
                      availableEquipment: toggleArrayItem(formData.availableEquipment, id)
                    })}
                    className={`rounded-full px-4 py-2 text-sm font-medium transition-all active:scale-[0.98] ${
                      formData.availableEquipment.includes(id)
                        ? 'bg-green-500/30 text-green-200 border border-green-500/50'
                        : 'bg-white/10 text-gray-300 border border-white/10 hover:bg-white/20'
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Current Injuries <span className="text-gray-500">(one per line)</span>
              </label>
              <textarea
                rows={2}
                value={formData.injuries.join('\n')}
                onChange={(e) => setFormData({
                  ...formData,
                  injuries: e.target.value.split('\n').filter(s => s.trim())
                })}
                placeholder="e.g., Left shoulder impingement, Lower back tightness..."
                className="w-full rounded-lg bg-gray-800 border border-gray-700 px-4 py-3 text-white focus:border-red-500 focus:outline-none resize-none"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Exercises to Avoid <span className="text-gray-500">(one per line)</span>
              </label>
              <textarea
                rows={2}
                value={formData.mustExcludeExercises.join('\n')}
                onChange={(e) => setFormData({
                  ...formData,
                  mustExcludeExercises: e.target.value.split('\n').filter(s => s.trim())
                })}
                placeholder="e.g., Behind the neck press, Upright rows..."
                className="w-full rounded-lg bg-gray-800 border border-gray-700 px-4 py-3 text-white focus:border-red-500 focus:outline-none resize-none"
              />
            </div>
          </div>
        );

      case 8:
        return (
          <div className="space-y-4">
            <div className="flex items-center gap-3 mb-4">
              <div className="flex-shrink-0 w-10 h-10 rounded-full bg-purple-500/20 flex items-center justify-center">
                <Brain className="h-5 w-5 text-purple-300" />
              </div>
              <div>
                <h2 className="text-lg font-bold text-white">Review & Generate</h2>
                <p className="text-sm text-gray-400">Confirm your selections</p>
              </div>
            </div>

            <div className="space-y-4">
              <div className="rounded-xl border border-white/10 bg-white/5 p-4">
                <h3 className="text-sm font-semibold text-gray-400 mb-2">Goal & Experience</h3>
                <div className="flex flex-wrap gap-2">
                  <span className="rounded-full bg-purple-500/20 px-3 py-1 text-sm font-medium text-purple-200 capitalize">
                    {formData.primaryGoal || 'Not set'}
                  </span>
                  <span className="rounded-full bg-emerald-500/20 px-3 py-1 text-sm font-medium text-emerald-200 capitalize">
                    {formData.currentLevel || 'Not set'}
                  </span>
                </div>
              </div>

              <div className="rounded-xl border border-white/10 bg-white/5 p-4">
                <h3 className="text-sm font-semibold text-gray-400 mb-2">Schedule</h3>
                <div className="flex flex-wrap gap-2">
                  <span className="rounded-full bg-blue-500/20 px-3 py-1 text-sm font-medium text-blue-200">
                    {formData.daysPerWeek || '?'} days/week
                  </span>
                  <span className="rounded-full bg-blue-500/20 px-3 py-1 text-sm font-medium text-blue-200">
                    {formData.weekCount || '?'} weeks
                  </span>
                  {formData.sessionLengthMinutes && (
                    <span className="rounded-full bg-blue-500/20 px-3 py-1 text-sm font-medium text-blue-200">
                      {formData.sessionLengthMinutes} min sessions
                    </span>
                  )}
                </div>
              </div>

              <div className="rounded-xl border border-white/10 bg-white/5 p-4">
                <h3 className="text-sm font-semibold text-gray-400 mb-2">Preferences</h3>
                <div className="flex flex-wrap gap-2">
                  <span className="rounded-full bg-amber-500/20 px-3 py-1 text-sm font-medium text-amber-200 uppercase">
                    {formData.intensityMethod || 'Not set'}
                  </span>
                  {formData.deloadFrequency && (
                    <span className="rounded-full bg-amber-500/20 px-3 py-1 text-sm font-medium text-amber-200">
                      Deload every {formData.deloadFrequency} weeks
                    </span>
                  )}
                </div>
              </div>

              {(formData.emphasisMuscles.length > 0 || formData.weakPoints.length > 0) && (
                <div className="rounded-xl border border-white/10 bg-white/5 p-4">
                  <h3 className="text-sm font-semibold text-gray-400 mb-2">Focus Areas</h3>
                  <div className="flex flex-wrap gap-2">
                    {formData.emphasisMuscles.map(m => (
                      <span key={m} className="rounded-full bg-cyan-500/20 px-3 py-1 text-sm font-medium text-cyan-200 capitalize">
                        {m}
                      </span>
                    ))}
                    {formData.weakPoints.map(m => (
                      <span key={m} className="rounded-full bg-orange-500/20 px-3 py-1 text-sm font-medium text-orange-200 capitalize">
                        ⚠ {m}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {formData.injuries.length > 0 && (
                <div className="rounded-xl border border-red-500/20 bg-red-500/10 p-4">
                  <h3 className="text-sm font-semibold text-red-300 mb-2">Injuries to Consider</h3>
                  <ul className="text-sm text-red-200 space-y-1">
                    {formData.injuries.map((injury, idx) => (
                      <li key={idx}>• {injury}</li>
                    ))}
                  </ul>
                </div>
              )}

              <div className="rounded-xl border border-white/10 bg-white/5 p-4">
                <h3 className="text-sm font-semibold text-gray-400 mb-2">Equipment</h3>
                <div className="flex flex-wrap gap-2">
                  {formData.availableEquipment.map(eq => (
                    <span key={eq} className="rounded-full bg-green-500/20 px-3 py-1 text-sm font-medium text-green-200 capitalize">
                      {eq}
                    </span>
                  ))}
                </div>
              </div>
            </div>

            {error && (
              <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-4">
                <p className="text-sm text-red-300">{error}</p>
              </div>
            )}
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-zinc-950">
      {/* Header - fixed at top with safe area */}
      <div
        className="flex-shrink-0 flex items-center justify-between px-4 py-3 border-b border-white/10 bg-zinc-900/95 backdrop-blur-sm"
        style={{ paddingTop: 'max(12px, env(safe-area-inset-top))' }}
      >
        <div className="flex items-center gap-3">
          <div className="rounded-xl bg-purple-500/20 p-2">
            <Brain className="h-5 w-5 text-purple-300" />
          </div>
          <div>
            <h1 className="text-lg font-bold text-white">Guided Program Builder</h1>
            <p className="text-xs text-gray-400">Step {step} of {TOTAL_STEPS}</p>
          </div>
        </div>
        <button
          onClick={onCancel}
          className="rounded-lg p-2 text-gray-400 hover:bg-white/10 hover:text-white transition-colors"
          aria-label="Close"
        >
          <X className="h-5 w-5" />
        </button>
      </div>

      {/* Progress Bar */}
      <div className="flex-shrink-0 px-4 py-2 bg-zinc-900/50">
        <div className="h-1.5 rounded-full bg-white/10">
          <div
            className="h-full rounded-full bg-gradient-to-r from-purple-500 to-fuchsia-500 transition-all duration-300"
            style={{ width: `${(step / TOTAL_STEPS) * 100}%` }}
          />
        </div>
      </div>

      {/* Scrollable Content - with bottom padding for footer */}
      <div className="flex-1 overflow-y-auto px-4 py-6 pb-4">
        <div className="max-w-lg mx-auto pb-4">
          {renderStepContent()}
        </div>
      </div>

      {/* Footer - fixed at bottom with safe area */}
      <div
        className="flex-shrink-0 flex items-center justify-between gap-3 px-4 py-4 border-t border-white/10 bg-zinc-900/95 backdrop-blur-sm"
        style={{ paddingBottom: 'max(16px, env(safe-area-inset-bottom))' }}
      >
        <button
          onClick={step === 1 ? onCancel : handleBack}
          className="flex items-center gap-2 rounded-xl bg-white/10 px-4 py-3 font-semibold text-white border border-white/10 transition-all hover:bg-white/20 active:scale-[0.98]"
        >
          <ArrowLeft className="h-4 w-4" />
          <span>{step === 1 ? 'Cancel' : 'Back'}</span>
        </button>

        {step < TOTAL_STEPS ? (
          <button
            onClick={handleNext}
            disabled={!canProceed()}
            className="flex-1 flex items-center justify-center gap-2 rounded-xl btn-primary px-6 py-3 font-semibold text-white shadow-lg shadow-purple-500/20 transition-all hover:shadow-xl active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Next
            <ArrowRight className="h-4 w-4" />
          </button>
        ) : (
          <button
            onClick={handleGenerate}
            disabled={generating}
            className="flex-1 flex items-center justify-center gap-2 rounded-xl btn-primary px-6 py-3 font-semibold text-white shadow-lg shadow-purple-500/20 transition-all hover:shadow-xl active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {generating ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Generating...
              </>
            ) : (
              <>
                <Zap className="h-4 w-4" />
                Generate
              </>
            )}
          </button>
        )}
      </div>
    </div>
  );
}
