'use client';

import { useState } from 'react';
import { Database, Download, Upload, BarChart3, HardDrive, Trash2 } from 'lucide-react';
import { storage } from '../lib/storage';
import { WorkoutSession } from '../lib/types';
import { getTrashCount } from '../lib/trash';
import ImportWizard from './ImportWizard/ImportWizard';
import RecentlyDeleted from './RecentlyDeleted';

export default function DataManagement() {
  const [importing, setImporting] = useState(false);
  const [showImportWizard, setShowImportWizard] = useState(false);
  const [showTrash, setShowTrash] = useState(false);
  const [trashCount, setTrashCount] = useState(getTrashCount());

  // Export to JSON
  const exportToJSON = () => {
    const history = storage.getWorkoutHistory();
    const dataStr = JSON.stringify(history, null, 2);
    const dataBlob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(dataBlob);

    const link = document.createElement('a');
    link.href = url;
    link.download = `iron-brain-backup-${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  // Export to CSV
  const exportToCSV = () => {
    const history = storage.getWorkoutHistory();

    // CSV Header
    let csv = 'Date,Program,Week,Day,Exercise,Set,Prescribed Reps,Actual Reps,Prescribed RPE,Actual RPE,Weight,E1RM,Volume,Notes\n';

    // CSV Rows
    history.forEach(session => {
      session.sets.forEach(set => {
        if (!set.completed) return; // Skip incomplete sets

        const row = [
          session.date,
          session.programName,
          session.weekNumber,
          session.dayName,
          set.exerciseId,
          set.setIndex,
          set.prescribedReps || '',
          set.actualReps || '',
          set.prescribedRPE || '',
          set.actualRPE || '',
          set.actualWeight || '',
          set.e1rm || '',
          set.volumeLoad || '',
          `"${(set.notes || '').replace(/"/g, '""')}"`, // Escape quotes in notes
        ].join(',');

        csv += row + '\n';
      });
    });

    const dataBlob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(dataBlob);

    const link = document.createElement('a');
    link.href = url;
    link.download = `iron-brain-data-${new Date().toISOString().split('T')[0]}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  // Import from JSON
  const importFromJSON = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setImporting(true);
    const reader = new FileReader();

    reader.onload = (e) => {
      try {
        const content = e.target?.result as string;
        const sessions: WorkoutSession[] = JSON.parse(content);

        // Validate data structure
        if (!Array.isArray(sessions)) {
          throw new Error('Invalid data format: expected array of sessions');
        }

        // Validate each session has required fields
        sessions.forEach((session, idx) => {
          if (!session.id || !session.date || !Array.isArray(session.sets)) {
            throw new Error(`Invalid session at index ${idx}`);
          }
        });

        // Ask user how to handle import
        const choice = confirm(
          `Found ${sessions.length} workout sessions.\n\n` +
          'Click OK to MERGE with existing data.\n' +
          'Click Cancel to REPLACE all existing data.'
        );

        if (choice) {
          // Merge: Add new sessions, avoid duplicates by ID
          const existing = storage.getWorkoutHistory();
          const existingIds = new Set(existing.map(s => s.id));
          const newSessions = sessions.filter(s => !existingIds.has(s.id));

          const merged = [...existing, ...newSessions];
          storage.setWorkoutHistory(merged);

          alert(`Successfully imported ${newSessions.length} new sessions.\n${existingIds.size} duplicate sessions were skipped.`);
        } else {
          // Replace: Overwrite all data
          if (confirm('This will DELETE all existing workout data. Are you sure?')) {
            storage.setWorkoutHistory(sessions);
            alert(`Successfully replaced all data with ${sessions.length} sessions.`);
          }
        }

        // Reload page to refresh data
        window.location.reload();
      } catch (error) {
        alert(`Import failed: ${error instanceof Error ? error.message : 'Invalid file format'}`);
      } finally {
        setImporting(false);
        // Reset file input
        event.target.value = '';
      }
    };

    reader.onerror = () => {
      alert('Failed to read file');
      setImporting(false);
    };

    reader.readAsText(file);
  };

  const history = storage.getWorkoutHistory();
  const totalWorkouts = history.length;
  const totalSets = history.reduce((sum, s) => sum + s.sets.filter(set => set.completed).length, 0);
  const dataSize = new Blob([JSON.stringify(history)]).size;
  const dataSizeKB = (dataSize / 1024).toFixed(2);

  return (
    <div className="space-y-6">
      <div className="surface-card p-6 sm:p-8">
        <p className="section-label">Data</p>
        <h2 className="mt-3 text-2xl sm:text-3xl font-black text-white">Data & Backups</h2>
        <p className="mt-2 text-sm text-zinc-400">
          Export, import, and manage your workout history.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="surface-panel p-4 sm:p-5">
          <div className="flex items-center gap-2 text-zinc-300 mb-2">
            <BarChart3 className="h-5 w-5 text-blue-300" />
            <span className="text-xs font-semibold uppercase tracking-wide text-zinc-400">Total Workouts</span>
          </div>
          <p className="text-3xl font-black text-white">{totalWorkouts}</p>
        </div>
        <div className="surface-panel p-4 sm:p-5">
          <div className="flex items-center gap-2 text-zinc-300 mb-2">
            <Database className="h-5 w-5 text-emerald-300" />
            <span className="text-xs font-semibold uppercase tracking-wide text-zinc-400">Total Sets</span>
          </div>
          <p className="text-3xl font-black text-white">{totalSets}</p>
        </div>
        <div className="surface-panel p-4 sm:p-5">
          <div className="flex items-center gap-2 text-zinc-300 mb-2">
            <HardDrive className="h-5 w-5 text-purple-300" />
            <span className="text-xs font-semibold uppercase tracking-wide text-zinc-400">Data Size</span>
          </div>
          <p className="text-3xl font-black text-white">{dataSizeKB} KB</p>
        </div>
      </div>

      {/* Export Section */}
      <div className="surface-card p-6 sm:p-8">
        <div className="flex items-center gap-3 mb-4">
          <div className="rounded-lg bg-white/10 p-2">
            <Download className="h-6 w-6 text-blue-300" />
          </div>
          <h3 className="text-xl sm:text-2xl font-black text-white">
            Export Data
          </h3>
        </div>
        <p className="mb-6 text-sm sm:text-base text-zinc-400">
          Download your workout data for backup or analysis.
        </p>
        <div className="flex flex-col gap-3 sm:flex-row">
          <button
            onClick={exportToJSON}
            disabled={totalWorkouts === 0}
            className="flex-1 rounded-xl btn-primary px-4 py-3 sm:px-6 sm:py-4 text-sm sm:text-base font-semibold text-white transition-all active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50"
          >
            <Download className="h-5 w-5" />
            Export as JSON
          </button>
          <button
            onClick={exportToCSV}
            disabled={totalWorkouts === 0}
            className="flex-1 rounded-xl btn-secondary px-4 py-3 sm:px-6 sm:py-4 text-sm sm:text-base font-semibold text-white transition-all active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50"
          >
            <BarChart3 className="h-5 w-5" />
            Export as CSV
          </button>
        </div>
        {totalWorkouts === 0 && (
          <p className="mt-3 text-sm text-zinc-400">
            No workout data to export yet.
          </p>
        )}
      </div>

      {/* Import Section */}
      <div className="surface-card p-6 sm:p-8">
        <div className="flex items-center gap-3 mb-4">
          <div className="rounded-lg bg-white/10 p-2">
            <Upload className="h-6 w-6 text-purple-300" />
          </div>
          <h3 className="text-xl sm:text-2xl font-black text-white">
            Import Data
          </h3>
        </div>
        <p className="mb-6 text-sm sm:text-base text-zinc-400">
          Import workouts from CSV, Excel, or JSON.
        </p>

        {/* New Multi-Format Import Button */}
        <button
          onClick={() => setShowImportWizard(true)}
          className="w-full rounded-xl btn-primary px-4 py-3 sm:px-6 sm:py-4 text-sm sm:text-base font-semibold text-white transition-all active:scale-[0.98] flex items-center justify-center gap-2 mb-4"
        >
          <Upload className="h-5 w-5" />
          Import Workouts
        </button>

        {/* Legacy JSON Import */}
        <details className="mt-4">
          <summary className="cursor-pointer text-sm font-semibold text-zinc-400 hover:text-zinc-200">
            Legacy JSON Import (Advanced)
          </summary>
          <label className="mt-3 flex cursor-pointer flex-col items-center justify-center rounded-xl border border-dashed border-white/15 bg-white/5 px-4 py-6 sm:px-6 sm:py-8 transition-all hover:border-purple-400/60 hover:bg-white/10 text-center">
            <div className="text-center">
              <Upload className="h-10 w-10 text-purple-300 mx-auto mb-2" />
              <p className="text-base font-semibold text-white">
                {importing ? 'Processing...' : 'Choose JSON file'}
              </p>
              <p className="mt-1 text-xs font-medium text-zinc-400">
                Direct JSON import without validation
              </p>
            </div>
            <input
              type="file"
              accept=".json"
              onChange={importFromJSON}
              disabled={importing}
              className="hidden"
            />
          </label>
        </details>
      </div>

      {/* Recently Deleted Section */}
      <div className="surface-card p-6 sm:p-8">
        <div className="flex flex-wrap items-center gap-3 mb-4">
          <div className="rounded-lg bg-rose-500/15 p-2">
            <Trash2 className="h-6 w-6 text-rose-300" />
          </div>
          <div className="flex-1">
            <h3 className="text-xl sm:text-2xl font-black text-white">
              Recently Deleted
            </h3>
            <p className="text-sm text-zinc-400">
              Recover workouts deleted by mistake
              {trashCount > 0 && ` • ${trashCount} item${trashCount === 1 ? '' : 's'}`}
            </p>
          </div>
          <button
            onClick={() => setShowTrash(!showTrash)}
            className="rounded-xl border border-rose-500/40 bg-rose-500/10 px-4 py-2 text-xs font-semibold text-rose-200 transition-all hover:bg-rose-500/20"
          >
            {showTrash ? 'Close' : 'View Trash'}
          </button>
        </div>

        {showTrash && (
          <div className="mt-6">
            <RecentlyDeleted onRestore={() => {
              setTrashCount(getTrashCount());
            }} />
          </div>
        )}
      </div>

      {/* Import Wizard Modal */}
      {showImportWizard && (
        <ImportWizard
          onComplete={() => {
            setShowImportWizard(false);
            window.location.reload();
          }}
          onCancel={() => setShowImportWizard(false)}
        />
      )}
    </div>
  );
}
