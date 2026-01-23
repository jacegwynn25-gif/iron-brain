'use client';

import { useState } from 'react';
import { supabase } from '../../lib/supabase/client';
import { useAuth } from '../../lib/supabase/auth-context';
import { Moon, Utensils, Brain, Check } from 'lucide-react';

interface CheckInData {
  date: string;
  // Sleep
  sleepHours: number | null;
  sleepQuality: 'poor' | 'fair' | 'good' | 'excellent' | null;
  sleepInterruptions: number;
  // Nutrition
  proteinIntake: number | null;
  carbIntake: number | null;
  calorieBalance: 'deficit' | 'maintenance' | 'surplus' | null;
  hydrationLevel: 'poor' | 'fair' | 'good' | 'excellent' | null;
  // Stress
  workStress: number;
  lifeStress: number;
  perceivedStress: number;
}

interface DailyCheckInFormProps {
  onComplete?: () => void;
}

export default function DailyCheckInForm({ onComplete }: DailyCheckInFormProps) {
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [formData, setFormData] = useState<CheckInData>({
    date: new Date().toISOString().split('T')[0],
    sleepHours: null,
    sleepQuality: null,
    sleepInterruptions: 0,
    proteinIntake: null,
    carbIntake: null,
    calorieBalance: null,
    hydrationLevel: null,
    workStress: 5,
    lifeStress: 5,
    perceivedStress: 5
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    if (!user?.id) {
      setError('You must be logged in to log check-in data');
      setLoading(false);
      return;
    }

    try {
      const { error: insertError } = await supabase
        .from('user_context_data')
        .upsert({
          user_id: user.id,
          date: formData.date,
          sleep_hours: formData.sleepHours,
          sleep_quality: formData.sleepQuality,
          sleep_interruptions: formData.sleepInterruptions,
          protein_intake: formData.proteinIntake,
          carb_intake: formData.carbIntake,
          calorie_balance: formData.calorieBalance,
          hydration_level: formData.hydrationLevel,
          work_stress: formData.workStress,
          life_stress: formData.lifeStress,
          perceived_stress: formData.perceivedStress,
          source: 'manual'
        }, {
          onConflict: 'user_id,date'
        });

      if (insertError) throw insertError;

      setSuccess(true);
      setTimeout(() => {
        if (onComplete) onComplete();
      }, 1500);
    } catch (err) {
      console.error('Error saving check-in data:', err);
      setError(err instanceof Error ? err.message : 'Failed to save check-in data');
    } finally {
      setLoading(false);
    }
  };

  if (success) {
    return (
      <div className="max-w-2xl mx-auto text-center py-12">
        <div className="w-20 h-20 mx-auto mb-6 rounded-full bg-gradient-to-br from-emerald-400 to-green-500 flex items-center justify-center shadow-xl shadow-emerald-500/30">
          <Check className="w-10 h-10 text-white" strokeWidth={3} />
        </div>
        <h2 className="text-2xl font-bold text-white mb-2">Check-In Complete!</h2>
        <p className="text-gray-400">
          Your recovery data has been logged for today.
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="max-w-2xl mx-auto space-y-8">
      <div className="rounded-xl bg-gradient-to-br from-blue-900/20 to-purple-900/20 border border-blue-500/30 p-6">
        <h2 className="text-2xl font-bold text-white mb-2">Daily Check-In</h2>
        <p className="text-blue-200">
          Log your sleep, nutrition, and stress levels to optimize recovery tracking.
        </p>
      </div>

      {error && (
        <div className="rounded-lg bg-red-500/10 border border-red-500/30 p-4">
          <p className="text-red-300 text-sm">{error}</p>
        </div>
      )}

      {/* Sleep Section */}
      <div className="rounded-xl bg-gray-900/50 border border-gray-800 p-6 space-y-4">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-lg bg-indigo-500/20 flex items-center justify-center">
            <Moon className="w-5 h-5 text-indigo-400" />
          </div>
          <h3 className="text-lg font-semibold text-white">Sleep</h3>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-300 mb-2">
            Hours Slept
          </label>
          <input
            type="number"
            min="0"
            max="24"
            step="0.5"
            value={formData.sleepHours || ''}
            onChange={(e) => setFormData({ ...formData, sleepHours: parseFloat(e.target.value) || null })}
            className="w-full rounded-lg bg-gray-800 border border-gray-700 px-4 py-2 text-white focus:border-purple-500 focus:outline-none"
            placeholder="e.g. 8.0"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-300 mb-2">
            Sleep Quality
          </label>
          <div className="grid grid-cols-4 gap-2">
            {(['poor', 'fair', 'good', 'excellent'] as const).map((quality) => (
              <button
                key={quality}
                type="button"
                onClick={() => setFormData({ ...formData, sleepQuality: quality })}
                className={`rounded-lg border px-3 py-2 text-sm font-medium transition-all ${
                  formData.sleepQuality === quality
                    ? 'border-indigo-500 bg-indigo-500/20 text-indigo-300'
                    : 'border-gray-700 bg-gray-800 text-gray-400 hover:border-gray-600'
                }`}
              >
                {quality.charAt(0).toUpperCase() + quality.slice(1)}
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-300 mb-2">
            Sleep Interruptions
          </label>
          <input
            type="number"
            min="0"
            max="20"
            value={formData.sleepInterruptions}
            onChange={(e) => setFormData({ ...formData, sleepInterruptions: parseInt(e.target.value) || 0 })}
            className="w-full rounded-lg bg-gray-800 border border-gray-700 px-4 py-2 text-white focus:border-purple-500 focus:outline-none"
            placeholder="Number of times you woke up"
          />
        </div>
      </div>

      {/* Nutrition Section */}
      <div className="rounded-xl bg-gray-900/50 border border-gray-800 p-6 space-y-4">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-lg bg-green-500/20 flex items-center justify-center">
            <Utensils className="w-5 h-5 text-green-400" />
          </div>
          <h3 className="text-lg font-semibold text-white">Nutrition</h3>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-300 mb-2">
            Protein Intake (g/kg bodyweight)
          </label>
          <input
            type="number"
            min="0"
            max="10"
            step="0.1"
            value={formData.proteinIntake || ''}
            onChange={(e) => setFormData({ ...formData, proteinIntake: parseFloat(e.target.value) || null })}
            className="w-full rounded-lg bg-gray-800 border border-gray-700 px-4 py-2 text-white focus:border-purple-500 focus:outline-none"
            placeholder="e.g. 2.0"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-300 mb-2">
            Carb Intake (g/kg bodyweight)
          </label>
          <input
            type="number"
            min="0"
            max="20"
            step="0.1"
            value={formData.carbIntake || ''}
            onChange={(e) => setFormData({ ...formData, carbIntake: parseFloat(e.target.value) || null })}
            className="w-full rounded-lg bg-gray-800 border border-gray-700 px-4 py-2 text-white focus:border-purple-500 focus:outline-none"
            placeholder="e.g. 4.0"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-300 mb-2">
            Calorie Balance
          </label>
          <div className="grid grid-cols-3 gap-2">
            {(['deficit', 'maintenance', 'surplus'] as const).map((balance) => (
              <button
                key={balance}
                type="button"
                onClick={() => setFormData({ ...formData, calorieBalance: balance })}
                className={`rounded-lg border px-3 py-2 text-sm font-medium transition-all ${
                  formData.calorieBalance === balance
                    ? 'border-green-500 bg-green-500/20 text-green-300'
                    : 'border-gray-700 bg-gray-800 text-gray-400 hover:border-gray-600'
                }`}
              >
                {balance.charAt(0).toUpperCase() + balance.slice(1)}
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-300 mb-2">
            Hydration Level
          </label>
          <div className="grid grid-cols-4 gap-2">
            {(['poor', 'fair', 'good', 'excellent'] as const).map((level) => (
              <button
                key={level}
                type="button"
                onClick={() => setFormData({ ...formData, hydrationLevel: level })}
                className={`rounded-lg border px-3 py-2 text-sm font-medium transition-all ${
                  formData.hydrationLevel === level
                    ? 'border-green-500 bg-green-500/20 text-green-300'
                    : 'border-gray-700 bg-gray-800 text-gray-400 hover:border-gray-600'
                }`}
              >
                {level.charAt(0).toUpperCase() + level.slice(1)}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Stress Section */}
      <div className="rounded-xl bg-gray-900/50 border border-gray-800 p-6 space-y-4">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-lg bg-amber-500/20 flex items-center justify-center">
            <Brain className="w-5 h-5 text-amber-400" />
          </div>
          <h3 className="text-lg font-semibold text-white">Stress Levels</h3>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-300 mb-2">
            Work Stress (0-10)
          </label>
          <input
            type="range"
            min="0"
            max="10"
            value={formData.workStress}
            onChange={(e) => setFormData({ ...formData, workStress: parseInt(e.target.value) })}
            className="w-full accent-amber-500"
          />
          <div className="flex justify-between text-xs text-gray-500 mt-1">
            <span>Low</span>
            <span className="text-white font-medium">{formData.workStress}</span>
            <span>High</span>
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-300 mb-2">
            Life Stress (0-10)
          </label>
          <input
            type="range"
            min="0"
            max="10"
            value={formData.lifeStress}
            onChange={(e) => setFormData({ ...formData, lifeStress: parseInt(e.target.value) })}
            className="w-full accent-amber-500"
          />
          <div className="flex justify-between text-xs text-gray-500 mt-1">
            <span>Low</span>
            <span className="text-white font-medium">{formData.lifeStress}</span>
            <span>High</span>
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-300 mb-2">
            Overall Perceived Stress (0-10)
          </label>
          <input
            type="range"
            min="0"
            max="10"
            value={formData.perceivedStress}
            onChange={(e) => setFormData({ ...formData, perceivedStress: parseInt(e.target.value) })}
            className="w-full accent-amber-500"
          />
          <div className="flex justify-between text-xs text-gray-500 mt-1">
            <span>Low</span>
            <span className="text-white font-medium">{formData.perceivedStress}</span>
            <span>High</span>
          </div>
        </div>
      </div>

      {/* Submit Button */}
      <button
        type="submit"
        disabled={loading}
        className="w-full rounded-xl btn-primary px-6 py-4 font-bold text-white shadow-lg shadow-blue-500/30 hover:shadow-xl hover:scale-[1.02] transition-all active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {loading ? 'Saving...' : 'Save Check-In'}
      </button>
    </form>
  );
}
