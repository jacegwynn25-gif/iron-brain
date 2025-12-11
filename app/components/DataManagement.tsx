'use client';

import { useState } from 'react';
import { Database, Download, Upload, Trash2, BarChart3, HardDrive } from 'lucide-react';
import { storage } from '../lib/storage';
import { WorkoutSession } from '../lib/types';
import ImportWizard from './ImportWizard/ImportWizard';

export default function DataManagement() {
  const [importing, setImporting] = useState(false);
  const [showImportWizard, setShowImportWizard] = useState(false);

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

          alert(`✅ Successfully imported ${newSessions.length} new sessions!\n${existingIds.size} duplicate sessions were skipped.`);
        } else {
          // Replace: Overwrite all data
          if (confirm('⚠️ This will DELETE all existing workout data. Are you sure?')) {
            storage.setWorkoutHistory(sessions);
            alert(`✅ Successfully replaced all data with ${sessions.length} sessions!`);
          }
        }

        // Reload page to refresh data
        window.location.reload();
      } catch (error) {
        alert(`❌ Import failed: ${error instanceof Error ? error.message : 'Invalid file format'}`);
      } finally {
        setImporting(false);
        // Reset file input
        event.target.value = '';
      }
    };

    reader.onerror = () => {
      alert('❌ Failed to read file');
      setImporting(false);
    };

    reader.readAsText(file);
  };

  // Clear all data
  const clearAllData = () => {
    if (!confirm('⚠️ DELETE ALL WORKOUT DATA?\n\nThis action cannot be undone!')) {
      return;
    }

    if (!confirm('⚠️ FINAL WARNING: All your workout history will be permanently deleted. Continue?')) {
      return;
    }

    storage.setWorkoutHistory([]);
    alert('✅ All workout data has been deleted.');
    window.location.reload();
  };

  const history = storage.getWorkoutHistory();
  const totalWorkouts = history.length;
  const totalSets = history.reduce((sum, s) => sum + s.sets.filter(set => set.completed).length, 0);
  const dataSize = new Blob([JSON.stringify(history)]).size;
  const dataSizeKB = (dataSize / 1024).toFixed(2);

  return (
    <div className="space-y-6">
      {/* Hero Header */}
      <div className="rounded-3xl bg-gradient-to-br from-orange-500 via-red-600 to-pink-600 p-10 shadow-2xl depth-effect animate-slideUp">
        <div className="flex items-center gap-3 mb-3">
          <div className="rounded-xl bg-white/20 p-3 backdrop-blur-sm">
            <Database className="h-8 w-8 text-white" />
          </div>
          <h2 className="text-5xl font-black text-white">
            Data Management
          </h2>
        </div>
        <p className="text-xl font-medium text-orange-100">
          Export, import, and manage your complete workout history
        </p>
      </div>

      {/* Data Statistics */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3 animate-fadeIn">
        <div className="rounded-2xl bg-gradient-to-br from-blue-500 to-blue-600 p-6 shadow-lg hover:scale-105 transition-all depth-effect">
          <div className="flex items-center gap-3 mb-3">
            <div className="rounded-lg bg-white/20 p-2">
              <BarChart3 className="h-6 w-6 text-white" />
            </div>
            <p className="text-sm font-bold text-blue-100">
              Total Workouts
            </p>
          </div>
          <p className="text-4xl font-black text-white">
            {totalWorkouts}
          </p>
        </div>
        <div className="rounded-2xl bg-gradient-to-br from-green-500 to-green-600 p-6 shadow-lg hover:scale-105 transition-all depth-effect">
          <div className="flex items-center gap-3 mb-3">
            <div className="rounded-lg bg-white/20 p-2">
              <Database className="h-6 w-6 text-white" />
            </div>
            <p className="text-sm font-bold text-green-100">
              Total Sets Logged
            </p>
          </div>
          <p className="text-4xl font-black text-white">
            {totalSets}
          </p>
        </div>
        <div className="rounded-2xl bg-gradient-to-br from-purple-500 to-purple-600 p-6 shadow-lg hover:scale-105 transition-all depth-effect">
          <div className="flex items-center gap-3 mb-3">
            <div className="rounded-lg bg-white/20 p-2">
              <HardDrive className="h-6 w-6 text-white" />
            </div>
            <p className="text-sm font-bold text-purple-100">
              Data Size
            </p>
          </div>
          <p className="text-4xl font-black text-white">
            {dataSizeKB} KB
          </p>
        </div>
      </div>

      {/* Export Section */}
      <div className="rounded-2xl bg-white p-8 shadow-premium border-2 border-zinc-100 dark:bg-zinc-900 dark:border-zinc-800 animate-fadeIn" style={{animationDelay: '0.1s'}}>
        <div className="flex items-center gap-3 mb-4">
          <div className="rounded-lg bg-blue-100 p-2 dark:bg-blue-900/30">
            <Download className="h-6 w-6 text-blue-600 dark:text-blue-400" />
          </div>
          <h3 className="text-2xl font-black text-zinc-900 dark:text-zinc-50">
            Export Data
          </h3>
        </div>
        <p className="mb-6 text-base font-medium text-zinc-600 dark:text-zinc-400">
          Download your workout data for backup or analysis
        </p>
        <div className="flex flex-col gap-3 sm:flex-row">
          <button
            onClick={exportToJSON}
            disabled={totalWorkouts === 0}
            className="flex-1 rounded-xl bg-gradient-to-r from-blue-500 to-blue-600 px-6 py-4 font-black text-white shadow-lg transition-all hover:scale-105 hover:shadow-xl active:scale-95 disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:scale-100 flex items-center justify-center gap-2"
          >
            <Download className="h-5 w-5" />
            Export as JSON
          </button>
          <button
            onClick={exportToCSV}
            disabled={totalWorkouts === 0}
            className="flex-1 rounded-xl bg-gradient-to-r from-green-500 to-green-600 px-6 py-4 font-black text-white shadow-lg transition-all hover:scale-105 hover:shadow-xl active:scale-95 disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:scale-100 flex items-center justify-center gap-2"
          >
            <BarChart3 className="h-5 w-5" />
            Export as CSV
          </button>
        </div>
        {totalWorkouts === 0 && (
          <p className="mt-3 text-sm font-medium text-zinc-500 dark:text-zinc-500">
            No workout data to export. Complete a workout first!
          </p>
        )}
      </div>

      {/* Import Section */}
      <div className="rounded-2xl bg-white p-8 shadow-premium border-2 border-zinc-100 dark:bg-zinc-900 dark:border-zinc-800 animate-fadeIn" style={{animationDelay: '0.2s'}}>
        <div className="flex items-center gap-3 mb-4">
          <div className="rounded-lg bg-purple-100 p-2 dark:bg-purple-900/30">
            <Upload className="h-6 w-6 text-purple-600 dark:text-purple-400" />
          </div>
          <h3 className="text-2xl font-black text-zinc-900 dark:text-zinc-50">
            Import Data
          </h3>
        </div>
        <p className="mb-6 text-base font-medium text-zinc-600 dark:text-zinc-400">
          Import workout data from CSV, Excel, or JSON files with intelligent exercise matching
        </p>

        {/* New Multi-Format Import Button */}
        <button
          onClick={() => setShowImportWizard(true)}
          className="w-full rounded-xl bg-gradient-to-r from-purple-500 to-pink-600 px-6 py-4 font-black text-white shadow-lg transition-all hover:scale-105 hover:shadow-xl active:scale-95 flex items-center justify-center gap-2 mb-4"
        >
          <Upload className="h-5 w-5" />
          Import Workouts (Multi-Format)
        </button>

        {/* Legacy JSON Import */}
        <details className="mt-4">
          <summary className="cursor-pointer text-sm font-semibold text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-200">
            Legacy JSON Import (Advanced)
          </summary>
          <label className="mt-3 flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed border-purple-300 bg-purple-50 px-6 py-8 transition-all hover:border-purple-400 hover:bg-purple-100 dark:border-purple-700 dark:bg-purple-900/10 dark:hover:border-purple-600 dark:hover:bg-purple-900/20">
            <div className="text-center">
              <Upload className="h-10 w-10 text-purple-600 dark:text-purple-400 mx-auto mb-2" />
              <p className="text-base font-bold text-purple-900 dark:text-purple-100">
                {importing ? 'Processing...' : 'Choose JSON file'}
              </p>
              <p className="mt-1 text-xs font-medium text-purple-700 dark:text-purple-300">
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

      {/* Danger Zone */}
      <div className="rounded-2xl border-2 border-red-500 bg-red-50 p-8 shadow-lg dark:border-red-600 dark:bg-red-900/20 animate-fadeIn" style={{animationDelay: '0.3s'}}>
        <div className="flex items-center gap-3 mb-4">
          <div className="rounded-lg bg-red-100 p-2 dark:bg-red-900/30">
            <Trash2 className="h-6 w-6 text-red-600 dark:text-red-400" />
          </div>
          <h3 className="text-2xl font-black text-red-900 dark:text-red-100">
            Danger Zone
          </h3>
        </div>
        <p className="mb-6 text-base font-medium text-red-800 dark:text-red-200">
          Permanently delete all workout data. This action cannot be undone!
        </p>
        <button
          onClick={clearAllData}
          disabled={totalWorkouts === 0}
          className="rounded-xl bg-gradient-to-r from-red-500 to-red-600 px-6 py-4 font-black text-white shadow-lg transition-all hover:scale-105 hover:shadow-xl active:scale-95 disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:scale-100 flex items-center gap-2"
        >
          <Trash2 className="h-5 w-5" />
          Delete All Data
        </button>
      </div>

      {/* Info Section */}
      <div className="rounded-lg bg-zinc-100 p-4 dark:bg-zinc-800">
        <h4 className="mb-2 font-semibold text-zinc-900 dark:text-zinc-50">
          💡 Tips
        </h4>
        <ul className="space-y-1 text-sm text-zinc-700 dark:text-zinc-300">
          <li>• <strong>Multi-Format Import</strong> supports CSV, Excel, and JSON with smart exercise matching</li>
          <li>• <strong>JSON format</strong> preserves all data and can be re-imported</li>
          <li>• <strong>CSV format</strong> is ideal for spreadsheet analysis (Excel, Google Sheets)</li>
          <li>• Regular backups recommended before major updates</li>
          <li>• Import wizard detects exercise names automatically and lets you review matches</li>
        </ul>
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
