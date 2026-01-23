'use client';

import { useState, useEffect } from 'react';
import { AlertCircle } from 'lucide-react';
import type { SetTemplate, PrescriptionMethod, SetType } from '../../lib/types';
import { getUserMax } from '../../lib/maxes/maxes-service';

interface SetEditorProps {
  setData: SetTemplate;
  onChange: (updated: SetTemplate) => void;
  exerciseId: string;
  userId: string | null;
}

const PRESCRIPTION_METHODS: { value: PrescriptionMethod; label: string; description: string }[] = [
  { value: 'rpe', label: 'RPE', description: 'Rate of Perceived Exertion (6-10)' },
  { value: 'rir', label: 'RIR', description: 'Reps in Reserve (0-5+)' },
  { value: 'percentage_1rm', label: '% 1RM', description: 'Percentage of One-Rep Max' },
  { value: 'percentage_tm', label: '% TM', description: 'Percentage of Training Max' },
  { value: 'fixed_weight', label: 'Fixed Weight', description: 'Specific weight in lbs/kg' },
  { value: 'amrap', label: 'AMRAP', description: 'As Many Reps As Possible' },
  { value: 'time_based', label: 'Time', description: 'Duration in seconds' },
];

const SET_TYPES: { value: SetType; label: string }[] = [
  { value: 'straight', label: 'Straight' },
  { value: 'warmup', label: 'Warmup' },
  { value: 'superset', label: 'Superset' },
  { value: 'giant', label: 'Giant Set' },
  { value: 'drop', label: 'Drop Set' },
  { value: 'rest-pause', label: 'Rest-Pause' },
  { value: 'cluster', label: 'Cluster' },
  { value: 'amrap', label: 'AMRAP' },
  { value: 'backoff', label: 'Backoff' },
];

const SUPERSET_GROUPS = ['A', 'B', 'C', 'D'] as const;

export default function SetEditor({ setData, onChange, exerciseId, userId }: SetEditorProps) {
  const [hasMax, setHasMax] = useState(false);
  const [checkingMax, setCheckingMax] = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(false);

  const prescriptionMethod = setData.prescriptionMethod || 'rpe';
  const isPercentageBased = prescriptionMethod === 'percentage_1rm' || prescriptionMethod === 'percentage_tm';
  const setType = setData.setType || 'straight';

  // Check if user has 1RM for this exercise when using percentage methods
  useEffect(() => {
    if (!isPercentageBased) {
      setHasMax(false);
      return;
    }

    setCheckingMax(true);
    getUserMax(userId, exerciseId)
      .then(max => {
        setHasMax(!!max);
        setCheckingMax(false);
      })
      .catch(() => {
        setHasMax(false);
        setCheckingMax(false);
      });
  }, [userId, exerciseId, isPercentageBased]);

  const handleFieldChange = <K extends keyof SetTemplate>(field: K, value: SetTemplate[K]) => {
    onChange({ ...setData, [field]: value });
  };

  const handleOptionalNumberChange = (
    field: keyof SetTemplate,
    value: string,
    parser: (input: string) => number
  ) => {
    if (!value.trim()) {
      onChange({ ...setData, [field]: null });
      return;
    }
    const parsed = parser(value);
    onChange({ ...setData, [field]: Number.isNaN(parsed) ? null : parsed });
  };

  const handlePrescriptionMethodChange = (method: PrescriptionMethod) => {
    const isPercentageMethod = method === 'percentage_1rm' || method === 'percentage_tm';
    const nextPrescribedReps = method === 'amrap'
      ? 'AMRAP'
      : setData.prescribedReps?.toUpperCase() === 'AMRAP'
        ? '8'
        : setData.prescribedReps;
    // Reset all prescription-specific fields when changing method
    const updated: SetTemplate = {
      ...setData,
      prescribedReps: nextPrescribedReps || '8',
      prescriptionMethod: method,
      targetRPE: method === 'rpe' ? 8 : null,
      targetRIR: method === 'rir' ? 2 : null,
      targetPercentage: isPercentageMethod ? 80 : null,
      fixedWeight: method === 'fixed_weight' ? 135 : null,
      targetSeconds: method === 'time_based' ? 60 : null,
    };
    onChange(updated);
  };

  // Parse reps input to handle ranges
  const handleRepsChange = (value: string) => {
    const trimmed = value.trim();
    const next: SetTemplate = {
      ...setData,
      prescribedReps: value,
      minReps: undefined,
      maxReps: undefined,
    };

    if (!trimmed) {
      onChange(next);
      return;
    }

    if (trimmed.toLowerCase() === 'amrap') {
      onChange({ ...next, prescribedReps: 'AMRAP' });
      return;
    }

    if (trimmed.includes('-')) {
      const [minRaw, maxRaw] = trimmed.split('-');
      const min = parseInt(minRaw.trim(), 10);
      const max = parseInt(maxRaw.trim(), 10);
      if (!isNaN(min) && !isNaN(max)) {
        onChange({ ...next, minReps: min, maxReps: max });
        return;
      }
    } else {
      const num = parseInt(trimmed, 10);
      if (!isNaN(num)) {
        onChange(next);
        return;
      }
    }

    onChange(next);
  };

  const handleSetTypeChange = (value: SetType) => {
    const next: SetTemplate = {
      ...setData,
      setType: value,
      supersetGroup: value === 'superset'
        ? (setData.supersetGroup || 'A')
        : undefined,
    };
    onChange(next);
  };

  const handleSupersetGroupChange = (value: string) => {
    const normalized = value.trim().toUpperCase();
    onChange({
      ...setData,
      supersetGroup: normalized || 'A',
    });
  };

  return (
    <div className="space-y-4 rounded-lg border border-zinc-200 bg-zinc-50 p-4 dark:border-zinc-800 dark:bg-zinc-900">
      {/* Reps Input */}
      <div>
        <label className="block text-sm font-bold text-zinc-700 dark:text-zinc-300 mb-2">
          Reps
        </label>
        <input
          type="text"
          value={setData.prescribedReps ?? ''}
          onChange={(e) => handleRepsChange(e.target.value)}
          placeholder="e.g., 5 or 8-10 or AMRAP"
          className="w-full rounded-lg border border-zinc-300 bg-white px-4 py-2 text-zinc-900 focus:border-purple-500 focus:outline-none focus:ring-2 focus:ring-purple-500/20 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-50"
        />
        <p className="mt-1 text-xs text-zinc-500">
          Enter a single number (5), range (8-10), or AMRAP
        </p>
      </div>

      {/* Prescription Method */}
      <div>
        <label className="block text-sm font-bold text-zinc-700 dark:text-zinc-300 mb-2">
          Prescription Method
        </label>
        <select
          value={prescriptionMethod}
          onChange={(e) => handlePrescriptionMethodChange(e.target.value as PrescriptionMethod)}
          className="w-full rounded-lg border border-zinc-300 bg-white px-4 py-2 text-zinc-900 focus:border-purple-500 focus:outline-none focus:ring-2 focus:ring-purple-500/20 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-50"
        >
          {PRESCRIPTION_METHODS.map((method) => (
            <option key={method.value} value={method.value}>
              {method.label} - {method.description}
            </option>
          ))}
        </select>
      </div>

      {/* Dynamic Input Based on Prescription Method */}
      {prescriptionMethod === 'rpe' && (
        <div>
          <label className="block text-sm font-bold text-zinc-700 dark:text-zinc-300 mb-2">
            Target RPE: {setData.targetRPE ?? 8}
          </label>
          <input
            type="range"
            min="6"
            max="10"
            step="0.5"
            value={setData.targetRPE ?? 8}
            onChange={(e) => handleFieldChange('targetRPE', parseFloat(e.target.value))}
            className="w-full h-2 bg-zinc-200 rounded-lg appearance-none cursor-pointer dark:bg-zinc-700"
          />
          <div className="flex justify-between text-xs text-zinc-500 mt-1">
            <span>6 (Easy)</span>
            <span>8 (Moderate)</span>
            <span>10 (Max)</span>
          </div>
        </div>
      )}

      {prescriptionMethod === 'rir' && (
        <div>
          <label className="block text-sm font-bold text-zinc-700 dark:text-zinc-300 mb-2">
            Reps in Reserve (RIR)
          </label>
          <input
            type="number"
            min="0"
            max="5"
            value={setData.targetRIR ?? 2}
            onChange={(e) => handleOptionalNumberChange('targetRIR', e.target.value, parseInt)}
            className="w-full rounded-lg border border-zinc-300 bg-white px-4 py-2 text-zinc-900 focus:border-purple-500 focus:outline-none focus:ring-2 focus:ring-purple-500/20 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-50"
          />
          <p className="mt-1 text-xs text-zinc-500">
            0 = Max effort, 5 = Very easy
          </p>
        </div>
      )}

      {(prescriptionMethod === 'percentage_1rm' || prescriptionMethod === 'percentage_tm') && (
        <>
          <div>
            <label className="block text-sm font-bold text-zinc-700 dark:text-zinc-300 mb-2">
              Target Percentage (%)
            </label>
            <input
              type="number"
              min="30"
              max="100"
              step="5"
              value={setData.targetPercentage ?? 80}
              onChange={(e) => handleOptionalNumberChange('targetPercentage', e.target.value, parseInt)}
              className="w-full rounded-lg border border-zinc-300 bg-white px-4 py-2 text-zinc-900 focus:border-purple-500 focus:outline-none focus:ring-2 focus:ring-purple-500/20 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-50"
            />
          </div>
          {!checkingMax && !hasMax && (
            <div className="flex gap-2 rounded-lg bg-yellow-50 border border-yellow-200 p-3 dark:bg-yellow-900/20 dark:border-yellow-800">
              <AlertCircle className="h-5 w-5 text-yellow-600 dark:text-yellow-500 flex-shrink-0" />
              <p className="text-sm text-yellow-800 dark:text-yellow-200">
                No 1RM set for this exercise. You&apos;ll need to enter one in the Maxes Manager or the weight won&apos;t be calculated automatically.
              </p>
            </div>
          )}
        </>
      )}

      {prescriptionMethod === 'fixed_weight' && (
        <div>
          <label className="block text-sm font-bold text-zinc-700 dark:text-zinc-300 mb-2">
            Weight (lbs)
          </label>
          <input
            type="number"
            min="0"
            step="2.5"
            value={setData.fixedWeight ?? 135}
            onChange={(e) => handleOptionalNumberChange('fixedWeight', e.target.value, parseFloat)}
            className="w-full rounded-lg border border-zinc-300 bg-white px-4 py-2 text-zinc-900 focus:border-purple-500 focus:outline-none focus:ring-2 focus:ring-purple-500/20 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-50"
          />
        </div>
      )}

      {prescriptionMethod === 'time_based' && (
        <div>
          <label className="block text-sm font-bold text-zinc-700 dark:text-zinc-300 mb-2">
            Duration (seconds)
          </label>
          <input
            type="number"
            min="0"
            step="5"
            value={setData.targetSeconds ?? 60}
            onChange={(e) => handleOptionalNumberChange('targetSeconds', e.target.value, parseInt)}
            className="w-full rounded-lg border border-zinc-300 bg-white px-4 py-2 text-zinc-900 focus:border-purple-500 focus:outline-none focus:ring-2 focus:ring-purple-500/20 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-50"
          />
        </div>
      )}

      {prescriptionMethod === 'amrap' && (
        <div className="rounded-lg bg-blue-50 border border-blue-200 p-3 dark:bg-blue-900/20 dark:border-blue-800">
          <p className="text-sm text-blue-800 dark:text-blue-200">
            AMRAP: Perform as many reps as possible with good form.
          </p>
        </div>
      )}

      <button
        type="button"
        onClick={() => setShowAdvanced(prev => !prev)}
        className="flex items-center justify-between rounded-lg border border-zinc-200 bg-white px-3 py-2 text-xs font-semibold text-zinc-700 transition-all hover:bg-zinc-100 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-200 dark:hover:bg-zinc-700"
      >
        <span>{showAdvanced ? 'Hide advanced settings' : 'Show advanced settings'}</span>
        <span className="text-zinc-400">{showAdvanced ? '-' : '+'}</span>
      </button>

      {showAdvanced && (
        <div className="space-y-4 rounded-lg border border-dashed border-zinc-200 bg-white/50 p-4 dark:border-zinc-700 dark:bg-zinc-900/60">
          {/* Rest Time */}
          <div>
            <label className="block text-sm font-bold text-zinc-700 dark:text-zinc-300 mb-2">
              Rest Time (seconds)
            </label>
            <input
              type="number"
              min="0"
              step="15"
              value={setData.restSeconds ?? 90}
              onChange={(e) => handleOptionalNumberChange('restSeconds', e.target.value, parseInt)}
              className="w-full rounded-lg border border-zinc-300 bg-white px-4 py-2 text-zinc-900 focus:border-purple-500 focus:outline-none focus:ring-2 focus:ring-purple-500/20 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-50"
            />
          </div>

          {/* Set Type */}
          <div>
            <label className="block text-sm font-bold text-zinc-700 dark:text-zinc-300 mb-2">
              Set Type
            </label>
            <select
              value={setType}
              onChange={(e) => handleSetTypeChange(e.target.value as SetType)}
              className="w-full rounded-lg border border-zinc-300 bg-white px-4 py-2 text-zinc-900 focus:border-purple-500 focus:outline-none focus:ring-2 focus:ring-purple-500/20 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-50"
            >
              {SET_TYPES.map((type) => (
                <option key={type.value} value={type.value}>
                  {type.label}
                </option>
              ))}
            </select>
          </div>

          {setType === 'superset' && (
            <div>
              <label className="block text-sm font-bold text-zinc-700 dark:text-zinc-300 mb-2">
                Superset Group
              </label>
              <div className="flex flex-wrap gap-2">
                {SUPERSET_GROUPS.map(group => (
                  <button
                    key={group}
                    type="button"
                    onClick={() => handleSupersetGroupChange(group)}
                    className={`rounded-lg px-3 py-2 text-sm font-bold transition-all ${
                      (setData.supersetGroup || 'A') === group
                        ? 'bg-purple-600 text-white'
                        : 'bg-zinc-100 text-zinc-700 hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-700'
                    }`}
                  >
                    {group}
                  </button>
                ))}
                <input
                  type="text"
                  value={setData.supersetGroup || ''}
                  onChange={(e) => handleSupersetGroupChange(e.target.value)}
                  placeholder="Custom"
                  maxLength={3}
                  className="min-w-[96px] flex-1 rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm font-semibold text-zinc-900 focus:border-purple-500 focus:outline-none focus:ring-2 focus:ring-purple-500/20 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-50"
                />
              </div>
              <p className="mt-2 text-xs text-zinc-500">
                Sets with the same group alternate during logging.
              </p>
            </div>
          )}

          {/* Tempo (Optional) */}
          <div>
            <label className="block text-sm font-bold text-zinc-700 dark:text-zinc-300 mb-2">
              Tempo (optional)
            </label>
            <input
              type="text"
              value={setData.tempo || ''}
              onChange={(e) => handleFieldChange('tempo', e.target.value)}
              placeholder="e.g., 3-0-1-0"
              className="w-full rounded-lg border border-zinc-300 bg-white px-4 py-2 text-zinc-900 focus:border-purple-500 focus:outline-none focus:ring-2 focus:ring-purple-500/20 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-50"
            />
            <p className="mt-1 text-xs text-zinc-500">
              Format: eccentric-pause-concentric-pause (e.g., 3-0-1-0)
            </p>
          </div>

          {/* Notes (Optional) */}
          <div>
            <label className="block text-sm font-bold text-zinc-700 dark:text-zinc-300 mb-2">
              Notes (optional)
            </label>
            <input
              type="text"
              value={setData.notes || ''}
              onChange={(e) => handleFieldChange('notes', e.target.value)}
              placeholder="e.g., paused, close grip, deficit"
              className="w-full rounded-lg border border-zinc-300 bg-white px-4 py-2 text-zinc-900 focus:border-purple-500 focus:outline-none focus:ring-2 focus:ring-purple-500/20 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-50"
            />
          </div>
        </div>
      )}
    </div>
  );
}
