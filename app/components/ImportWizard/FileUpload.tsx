'use client';
/* eslint-disable @typescript-eslint/no-explicit-any */

import { useState, useRef } from 'react';
import type { ImportConfig, ImportError, ImportWarning } from '@/app/lib/importers/types';
import { getSupportedExtensions } from '@/app/lib/importers/formatDetector';

interface FileUploadProps {
  onFileSelect: (file: File, config: Partial<ImportConfig>) => void;
  isProcessing: boolean;
  errors?: ImportError[];
  warnings?: ImportWarning[];
}

export default function FileUpload({ onFileSelect, isProcessing, errors, warnings }: FileUploadProps) {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [programId, setProgramId] = useState('bench_specialization');
  const [programName, setProgramName] = useState('Bench Specialization');
  const [startDate, setStartDate] = useState('');
  const [mergeStrategy, setMergeStrategy] = useState<'skip_duplicates' | 'replace_all' | 'merge_by_date'>('skip_duplicates');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);

    const files = e.dataTransfer.files;
    if (files.length > 0) {
      setSelectedFile(files[0]);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      setSelectedFile(files[0]);
    }
  };

  const handleSubmit = () => {
    if (!selectedFile) return;

    // Parse date as local date to avoid timezone issues
    // Input format: "2024-11-17" should be parsed as Nov 17 in local timezone, not UTC
    let parsedStartDate: Date | undefined;
    if (startDate) {
      const [year, month, day] = startDate.split('-').map(Number);
      parsedStartDate = new Date(year, month - 1, day); // month is 0-indexed
    }

    const config: Partial<ImportConfig> = {
      programId: programId || undefined,
      programName: programName || undefined,
      startDate: parsedStartDate,
      mergeStrategy,
    };

    onFileSelect(selectedFile, config);
  };

  return (
    <div className="space-y-6">
      {/* File Drop Zone */}
      <div
        className={`rounded-2xl border-2 border-dashed p-6 sm:p-8 text-center transition-colors ${
          isDragging
            ? 'border-purple-400 bg-purple-500/10'
            : 'border-white/10 bg-white/5 hover:border-white/20'
        }`}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept={getSupportedExtensions()}
          onChange={handleFileChange}
          className="hidden"
        />

        <svg
          className="w-16 h-16 mx-auto mb-4 text-gray-400"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
          />
        </svg>

        {selectedFile ? (
          <div className="space-y-2">
            <p className="text-white font-medium">{selectedFile.name}</p>
            <p className="text-sm text-gray-400">
              {(selectedFile.size / 1024).toFixed(1)} KB
            </p>
            <button
              onClick={() => fileInputRef.current?.click()}
              className="text-purple-300 hover:text-purple-200 text-sm"
            >
              Choose a different file
            </button>
          </div>
        ) : (
          <div className="space-y-2">
            <p className="text-white font-medium">Drag and drop your file here</p>
            <p className="text-gray-400 text-sm">or</p>
            <button
              onClick={() => fileInputRef.current?.click()}
              className="btn-primary rounded-xl px-4 py-2 text-white font-semibold transition-all active:scale-[0.98]"
            >
              Choose File
            </button>
            <p className="text-gray-500 text-xs mt-2">
              Supported formats: CSV, Excel (.xlsx), JSON
            </p>
          </div>
        )}
      </div>

      {/* Configuration Options */}
      {selectedFile && (
        <div className="space-y-4 surface-panel p-4 sm:p-5">
          <h3 className="text-lg font-semibold text-white">Import Settings</h3>

          {/* Program Selection */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-zinc-300 mb-1">
                Program ID (optional)
              </label>
              <input
                type="text"
                value={programId}
                onChange={(e) => setProgramId(e.target.value)}
                placeholder="e.g., bench_specialization"
                className="w-full rounded-lg border border-white/10 bg-zinc-950/60 px-3 py-2 text-sm text-white placeholder-zinc-500 focus:border-purple-500 focus:outline-none focus:ring-2 focus:ring-purple-500/20"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-zinc-300 mb-1">
                Program Name (optional)
              </label>
              <input
                type="text"
                value={programName}
                onChange={(e) => setProgramName(e.target.value)}
                placeholder="e.g., Bench Specialization"
                className="w-full rounded-lg border border-white/10 bg-zinc-950/60 px-3 py-2 text-sm text-white placeholder-zinc-500 focus:border-purple-500 focus:outline-none focus:ring-2 focus:ring-purple-500/20"
              />
            </div>
          </div>

          {/* Start Date */}
          <div>
            <label className="block text-sm font-medium text-zinc-300 mb-1">
              Week 1 Start Date (optional)
            </label>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="w-full rounded-lg border border-white/10 bg-zinc-950/60 px-3 py-2 text-sm text-white focus:border-purple-500 focus:outline-none focus:ring-2 focus:ring-purple-500/20"
            />
            <p className="text-xs text-zinc-500 mt-1">
              If not set, workout dates will be calculated from today
            </p>
          </div>

          {/* Merge Strategy */}
          <div>
            <label className="block text-sm font-medium text-zinc-300 mb-1">
              Duplicate Handling
            </label>
            <select
              value={mergeStrategy}
              onChange={(e) => setMergeStrategy(e.target.value as any)}
              className="w-full rounded-lg border border-white/10 bg-zinc-950/60 px-3 py-2 text-sm text-white focus:border-purple-500 focus:outline-none focus:ring-2 focus:ring-purple-500/20"
            >
              <option value="skip_duplicates">Skip Duplicates (Keep Existing)</option>
              <option value="merge_by_date">Merge by Date (Replace Matching Dates)</option>
              <option value="replace_all">Replace All (Clear Existing History)</option>
            </select>
          </div>
        </div>
      )}

      {/* Errors */}
      {errors && errors.length > 0 && (
        <div className="bg-red-900/20 border border-red-700 rounded-lg p-4">
          <h4 className="text-red-400 font-semibold mb-2">Errors</h4>
          <ul className="space-y-1">
            {errors.map((error, index) => (
              <li key={index} className="text-red-300 text-sm">
                {error.message}
                {error.rowIndex !== undefined && ` (Row ${error.rowIndex})`}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Warnings */}
      {warnings && warnings.length > 0 && (
        <div>
          {/* Info messages */}
          {warnings.filter(w => w.type === 'info').length > 0 && (
            <div className="bg-blue-900/20 border border-blue-700 rounded-lg p-4 mb-4">
              <h4 className="text-blue-400 font-semibold mb-2">Import Info</h4>
              <ul className="space-y-1">
                {warnings.filter(w => w.type === 'info').map((warning, index) => (
                  <li key={index} className="text-blue-300 text-sm">
                    {warning.message}
                  </li>
                ))}
              </ul>
            </div>
          )}
          {/* Other warnings */}
          {warnings.filter(w => w.type !== 'info').length > 0 && (
            <div className="bg-yellow-900/20 border border-yellow-700 rounded-lg p-4">
              <h4 className="text-yellow-400 font-semibold mb-2">Warnings</h4>
              <ul className="space-y-1">
                {warnings.filter(w => w.type !== 'info').map((warning, index) => (
                  <li key={index} className="text-yellow-300 text-sm">
                    {warning.message}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

      {/* Submit Button */}
      <button
        onClick={handleSubmit}
        disabled={!selectedFile || isProcessing}
        className="w-full py-3 btn-primary disabled:opacity-50 text-white font-semibold rounded-lg transition-all disabled:cursor-not-allowed"
      >
        {isProcessing ? 'Processing...' : 'Continue'}
      </button>
    </div>
  );
}
