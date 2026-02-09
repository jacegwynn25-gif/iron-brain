'use client';

import { useState } from 'react';
import { supabase } from '../../lib/supabase/client';
import { useAuth } from '../../lib/supabase/auth-context';
import { useUnitPreference } from '../../lib/hooks/useUnitPreference';

interface DemographicsFormData {
  age: number | null;
  sex: 'male' | 'female' | 'other' | null;
  trainingAge: number | null;
  athleticBackground: 'beginner' | 'intermediate' | 'advanced' | 'elite' | null;
  bodyweight: number | null;
  height: number | null;
  currentInjuries: string[];
  chronicConditions: string[];
}

interface DemographicsFormProps {
  onComplete: () => void;
}

export default function DemographicsForm({ onComplete }: DemographicsFormProps) {
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const {
    unitSystem,
    setUnitSystem,
    displayWeight,
    displayHeight,
    parseWeightInput,
    parseHeightInput,
    weightUnit,
    heightUnit,
    weightRange,
    heightRange,
  } = useUnitPreference();
  const [formData, setFormData] = useState<DemographicsFormData>({
    age: null,
    sex: null,
    trainingAge: null,
    athleticBackground: null,
    bodyweight: null,
    height: null,
    currentInjuries: [],
    chronicConditions: []
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    if (!user?.id) {
      setError('You must be logged in to complete onboarding');
      setLoading(false);
      return;
    }

    // Validate required fields
    if (!formData.age || !formData.sex || !formData.trainingAge || !formData.athleticBackground) {
      setError('Please fill in all required fields');
      setLoading(false);
      return;
    }

    try {
      const { error: insertError } = await supabase
        .from('user_demographics')
        .upsert({
          user_id: user.id,
          age: formData.age,
          sex: formData.sex,
          training_age: formData.trainingAge,
          athletic_background: formData.athleticBackground,
          bodyweight: formData.bodyweight,
          height: formData.height,
          current_injuries: formData.currentInjuries,
          chronic_conditions: formData.chronicConditions
        }, {
          onConflict: 'user_id'
        });

      if (insertError) throw insertError;

      onComplete();
    } catch (err) {
      console.error('Error saving demographics:', err);
      setError(err instanceof Error ? err.message : 'Failed to save demographics');
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="max-w-2xl mx-auto space-y-7 pb-16">
      <div className="border-b border-zinc-900 pb-6">
        <h2 className="text-2xl font-bold text-white mb-2">Welcome to Iron Brain</h2>
        <p className="text-zinc-400">
          Help us personalize your training by providing some basic information.
          This enables accurate recovery tracking and injury prevention.
        </p>
      </div>

      {error && (
        <div className="rounded-lg border border-rose-500/30 bg-rose-500/10 p-4">
          <p className="text-sm text-rose-300">{error}</p>
        </div>
      )}

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
          onChange={(e) => setFormData({ ...formData, age: parseInt(e.target.value) || null })}
          className="w-full rounded-lg bg-zinc-950/50 border border-zinc-800 px-4 py-2 text-white focus:border-emerald-400 focus:outline-none"
          required
        />
      </div>

      {/* Sex */}
      <div>
        <label className="block text-sm font-medium text-zinc-300 mb-2">
          Sex <span className="text-red-400">*</span>
        </label>
        <div className="grid grid-cols-3 gap-3">
          {(['male', 'female', 'other'] as const).map((option) => (
            <button
              key={option}
              type="button"
              onClick={() => setFormData({ ...formData, sex: option })}
              className={`rounded-lg border px-4 py-3 font-medium transition-all ${
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

      {/* Training Age */}
      <div>
        <label className="block text-sm font-medium text-zinc-300 mb-2">
          Training Age (years) <span className="text-red-400">*</span>
        </label>
        <p className="text-xs text-zinc-500 mb-2">
          How many years have you been training consistently?
        </p>
        <input
          type="number"
          min="0"
          max="50"
          step="0.5"
          value={formData.trainingAge || ''}
          onChange={(e) => setFormData({ ...formData, trainingAge: parseFloat(e.target.value) || null })}
          className="w-full rounded-lg bg-zinc-950/50 border border-zinc-800 px-4 py-2 text-white focus:border-emerald-400 focus:outline-none"
          required
        />
      </div>

      {/* Athletic Background */}
      <div>
        <label className="block text-sm font-medium text-zinc-300 mb-2">
          Athletic Background <span className="text-red-400">*</span>
        </label>
        <div className="grid grid-cols-2 gap-3">
          {(['beginner', 'intermediate', 'advanced', 'elite'] as const).map((level) => (
            <button
              key={level}
              type="button"
              onClick={() => setFormData({ ...formData, athleticBackground: level })}
              className={`rounded-lg border px-4 py-3 font-medium transition-all ${
                formData.athleticBackground === level
                  ? 'border-emerald-400/50 bg-emerald-500/10 text-emerald-200'
                  : 'border-zinc-800 bg-zinc-950/50 text-zinc-400 hover:border-zinc-700'
              }`}
            >
              {level.charAt(0).toUpperCase() + level.slice(1)}
            </button>
          ))}
        </div>
      </div>

      {/* Unit System Toggle */}
      <div>
        <label className="block text-sm font-medium text-zinc-300 mb-2">
          Measurement System
        </label>
        <div className="grid grid-cols-2 gap-3">
          <button
            type="button"
            onClick={() => setUnitSystem('metric')}
            className={`rounded-lg border px-4 py-3 font-medium transition-all ${
              unitSystem === 'metric'
                ? 'border-emerald-400/50 bg-emerald-500/10 text-emerald-200'
                : 'border-zinc-800 bg-zinc-950/50 text-zinc-400 hover:border-zinc-700'
            }`}
          >
            Metric (kg, cm)
          </button>
          <button
            type="button"
            onClick={() => setUnitSystem('imperial')}
            className={`rounded-lg border px-4 py-3 font-medium transition-all ${
              unitSystem === 'imperial'
                ? 'border-emerald-400/50 bg-emerald-500/10 text-emerald-200'
                : 'border-zinc-800 bg-zinc-950/50 text-zinc-400 hover:border-zinc-700'
            }`}
          >
            Imperial (lbs, in)
          </button>
        </div>
      </div>

      {/* Bodyweight (Optional) */}
      <div>
        <label className="block text-sm font-medium text-zinc-300 mb-2">
          Bodyweight ({weightUnit}) <span className="text-zinc-500 text-xs">(optional)</span>
        </label>
        <input
          type="number"
          min={weightRange.min}
          max={weightRange.max}
          step="0.1"
          value={displayWeight(formData.bodyweight)}
          onChange={(e) => {
            const value = parseFloat(e.target.value);
            if (isNaN(value)) {
              setFormData({ ...formData, bodyweight: null });
            } else {
              setFormData({ ...formData, bodyweight: parseWeightInput(value) });
            }
          }}
          className="w-full rounded-lg bg-zinc-950/50 border border-zinc-800 px-4 py-2 text-white focus:border-emerald-400 focus:outline-none"
        />
      </div>

      {/* Height (Optional) */}
      <div>
        <label className="block text-sm font-medium text-zinc-300 mb-2">
          Height ({heightUnit}) <span className="text-zinc-500 text-xs">(optional)</span>
        </label>
        {unitSystem === 'imperial' && (
          <p className="text-xs text-zinc-500 mb-2">
            Tip: 5 feet = 60 inches, 6 feet = 72 inches
          </p>
        )}
        <input
          type="number"
          min={heightRange.min}
          max={heightRange.max}
          step="0.1"
          value={displayHeight(formData.height)}
          onChange={(e) => {
            const value = parseFloat(e.target.value);
            if (isNaN(value)) {
              setFormData({ ...formData, height: null });
            } else {
              setFormData({ ...formData, height: parseHeightInput(value) });
            }
          }}
          className="w-full rounded-lg bg-zinc-950/50 border border-zinc-800 px-4 py-2 text-white focus:border-emerald-400 focus:outline-none"
        />
      </div>

      {/* Current Injuries (Optional) */}
      <div>
        <label className="block text-sm font-medium text-zinc-300 mb-2">
          Current Injuries <span className="text-zinc-500 text-xs">(optional)</span>
        </label>
        <p className="text-xs text-zinc-500 mb-2">
          List any active injuries (e.g., &quot;Left shoulder impingement&quot;)
        </p>
        <textarea
          rows={3}
          value={formData.currentInjuries.join('\n')}
          onChange={(e) => setFormData({
            ...formData,
            currentInjuries: e.target.value.split('\n').filter(s => s.trim())
          })}
          placeholder="One injury per line"
          className="w-full rounded-lg bg-zinc-950/50 border border-zinc-800 px-4 py-2 text-white focus:border-emerald-400 focus:outline-none resize-none"
        />
      </div>

      {/* Chronic Conditions (Optional) */}
      <div>
        <label className="block text-sm font-medium text-zinc-300 mb-2">
          Chronic Health Conditions <span className="text-zinc-500 text-xs">(optional)</span>
        </label>
        <p className="text-xs text-zinc-500 mb-2">
          Any chronic conditions that affect training (e.g., &quot;Type 2 Diabetes&quot;)
        </p>
        <textarea
          rows={3}
          value={formData.chronicConditions.join('\n')}
          onChange={(e) => setFormData({
            ...formData,
            chronicConditions: e.target.value.split('\n').filter(s => s.trim())
          })}
          placeholder="One condition per line"
          className="w-full rounded-lg bg-zinc-950/50 border border-zinc-800 px-4 py-2 text-white focus:border-emerald-400 focus:outline-none resize-none"
        />
      </div>

      {/* Submit Button */}
      <button
        type="submit"
        disabled={loading}
        className="w-full rounded-xl bg-emerald-500 px-6 py-4 font-black uppercase tracking-[0.22em] text-zinc-950 shadow-lg shadow-emerald-500/20 transition-all hover:bg-emerald-400 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50"
      >
        {loading ? 'Saving...' : 'Complete Setup'}
      </button>
    </form>
  );
}
