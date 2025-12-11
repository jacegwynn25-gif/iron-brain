'use client';

import { useState } from 'react';
import type { ImportSession, ImportConfig } from '@/app/lib/importers/types';
import { workoutImporter } from '@/app/lib/importers';
import { parseLocalDate } from '@/app/lib/dateUtils';
import FileUpload from './FileUpload';
import ExerciseMatching from './ExerciseMatching';
import ReviewImport from './ReviewImport';

interface ImportWizardProps {
  onComplete: () => void;
  onCancel: () => void;
}

export default function ImportWizard({ onComplete, onCancel }: ImportWizardProps) {
  const [session, setSession] = useState<ImportSession | null>(null);
  const [step, setStep] = useState<'upload' | 'matching' | 'review' | 'complete'>('upload');
  const [isProcessing, setIsProcessing] = useState(false);

  const handleFileSelect = async (file: File, config: Partial<ImportConfig>) => {
    setIsProcessing(true);

    try {
      console.log('Starting import for file:', file.name, 'size:', file.size);
      const newSession = await workoutImporter.startImport(file, config);
      console.log('Import session created:', newSession.state, 'errors:', newSession.errors.length);
      setSession(newSession);

      if (newSession.state === 'error') {
        console.error('Import errors:', newSession.errors);
        // Stay on upload step, show errors
        setStep('upload');
      } else if (newSession.state === 'reviewing') {
        // Check if exercise matching is needed
        const needsReview = newSession.exerciseMatches?.some((m) => m.needsReview) || false;
        console.log('Exercise matches need review:', needsReview);
        if (needsReview) {
          setStep('matching');
        } else {
          // Auto-proceed to review
          const transformed = await workoutImporter.transformSessions(newSession);
          setSession(transformed);
          setStep('review');
        }
      }
    } catch (error: any) {
      console.error('Import failed with exception:', error);
      // Create error session to show in UI
      setSession({
        id: 'error',
        state: 'error',
        fileName: file.name,
        fileSize: file.size,
        format: 'unknown',
        config: { mergeStrategy: 'skip_duplicates' },
        errors: [{
          type: 'parse',
          message: error.message || 'An unexpected error occurred during import'
        }],
        warnings: [],
        createdAt: new Date(),
      });
      setStep('upload');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleMatchingComplete = async () => {
    if (!session) return;

    setIsProcessing(true);
    try {
      const transformed = await workoutImporter.transformSessions(session);
      setSession(transformed);
      setStep('review');
    } catch (error: any) {
      console.error('Transform failed:', error);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleImportConfirm = async () => {
    if (!session) return;

    setIsProcessing(true);
    try {
      const completed = await workoutImporter.completeImport(session);
      setSession(completed);

      if (completed.state === 'complete' && !completed.errors.length) {
        setStep('complete');
        // Delay to show success message
        setTimeout(() => {
          onComplete();
        }, 1500);
      }
    } catch (error: any) {
      console.error('Import completion failed:', error);
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-gradient-to-br from-purple-900/90 to-pink-900/90 backdrop-blur-sm rounded-lg shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-auto">
        {/* Header */}
        <div className="sticky top-0 bg-purple-900/95 backdrop-blur-sm p-6 border-b border-purple-700">
          <div className="flex items-center justify-between">
            <h2 className="text-2xl font-bold text-white">Import Workout History</h2>
            <button
              onClick={onCancel}
              className="text-gray-400 hover:text-white transition-colors"
              disabled={isProcessing}
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* Progress Steps */}
          <div className="flex items-center gap-4 mt-4">
            <div className={`flex items-center gap-2 ${step === 'upload' ? 'text-pink-400' : 'text-gray-400'}`}>
              <div className={`w-8 h-8 rounded-full flex items-center justify-center border-2 ${step === 'upload' ? 'border-pink-400 bg-pink-400/20' : 'border-gray-600'}`}>
                1
              </div>
              <span className="text-sm font-medium">Upload</span>
            </div>
            <div className="flex-1 h-0.5 bg-gray-700"></div>
            <div className={`flex items-center gap-2 ${step === 'matching' ? 'text-pink-400' : 'text-gray-400'}`}>
              <div className={`w-8 h-8 rounded-full flex items-center justify-center border-2 ${step === 'matching' ? 'border-pink-400 bg-pink-400/20' : 'border-gray-600'}`}>
                2
              </div>
              <span className="text-sm font-medium">Match Exercises</span>
            </div>
            <div className="flex-1 h-0.5 bg-gray-700"></div>
            <div className={`flex items-center gap-2 ${step === 'review' || step === 'complete' ? 'text-pink-400' : 'text-gray-400'}`}>
              <div className={`w-8 h-8 rounded-full flex items-center justify-center border-2 ${step === 'review' || step === 'complete' ? 'border-pink-400 bg-pink-400/20' : 'border-gray-600'}`}>
                3
              </div>
              <span className="text-sm font-medium">Review & Import</span>
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="p-6">
          {step === 'upload' && (
            <FileUpload
              onFileSelect={handleFileSelect}
              isProcessing={isProcessing}
              errors={session?.errors}
              warnings={session?.warnings}
            />
          )}

          {step === 'matching' && session && (
            <ExerciseMatching
              session={session}
              onUpdate={setSession}
              onComplete={handleMatchingComplete}
              isProcessing={isProcessing}
            />
          )}

          {step === 'review' && session && (
            <ReviewImport
              session={session}
              onConfirm={handleImportConfirm}
              onBack={() => setStep('matching')}
              isProcessing={isProcessing}
            />
          )}

          {step === 'complete' && session && (
            <div className="text-center py-12">
              <div className="w-16 h-16 bg-green-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
                <svg className="w-8 h-8 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <h3 className="text-2xl font-bold text-white mb-2">Import Successful!</h3>
              <p className="text-gray-300 mb-4">
                Imported {session.totalSessions} workout sessions with {session.totalSets} total sets.
              </p>
              {session.dateRange && (
                <p className="text-sm text-gray-400 mb-4">
                  Date range: {parseLocalDate(session.dateRange.start as any).toLocaleDateString()} - {parseLocalDate(session.dateRange.end as any).toLocaleDateString()}
                </p>
              )}
              <div className="bg-purple-800/30 rounded-lg p-4 max-w-md mx-auto">
                <div className="flex items-start gap-3 text-left">
                  <svg className="w-5 h-5 text-purple-400 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <div>
                    <p className="text-purple-200 font-medium text-sm">Smart Resume Active</p>
                    <p className="text-purple-300 text-xs mt-1">
                      The app will automatically detect your last completed workout and select the next day in your program.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
