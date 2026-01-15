'use client';

import { useEffect, useState } from 'react';
import { Play, Trash2, X } from 'lucide-react';
import type { ActiveSessionState } from '../lib/workout/active-session';

interface ResumeWorkoutModalProps {
  activeSession: ActiveSessionState;
  onResume: () => void;
  onDiscard: () => void;
  onClose: () => void;
}

export default function ResumeWorkoutModal({
  activeSession,
  onResume,
  onDiscard,
  onClose,
}: ResumeWorkoutModalProps) {
  const { session } = activeSession;
  const completedSets = session.sets.filter(s => s.completed).length;
  const [timeAgoText, setTimeAgoText] = useState('Just now');

  useEffect(() => {
    const lastUpdated = new Date(activeSession.lastUpdated);
    const minutesAgo = Math.floor((Date.now() - lastUpdated.getTime()) / (1000 * 60));
    const text = minutesAgo < 1
      ? 'Just now'
      : minutesAgo < 60
        ? `${minutesAgo} min ago`
        : `${Math.floor(minutesAgo / 60)}h ago`;
    setTimeAgoText(text);
  }, [activeSession.lastUpdated]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
      <div className="bg-white/5 backdrop-blur-xl rounded-2xl p-6 max-w-sm w-full border border-white/10 shadow-xl">
        <div className="flex items-start justify-between mb-4">
          <div className="w-12 h-12 rounded-xl bg-purple-500/20 flex items-center justify-center">
            <Play className="w-6 h-6 text-purple-300" />
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <h2 className="text-xl font-semibold text-white mb-2">
          Resume Workout?
        </h2>

        <p className="text-gray-400 text-sm mb-4">
          You have an unfinished workout from {timeAgoText}.
        </p>

        <div className="bg-white/5 rounded-xl p-4 mb-6 border border-white/10">
          <div className="text-white font-semibold mb-1">{session.dayName || session.programName || 'Workout'}</div>
          <div className="text-sm text-gray-400">
            {completedSets} sets completed • {session.programName || 'Custom session'}
          </div>
        </div>

        <div className="flex gap-3">
          <button
            onClick={onDiscard}
            className="flex-1 py-3 px-4 rounded-xl bg-white/10 text-gray-300 font-medium flex items-center justify-center gap-2 hover:bg-white/15 transition-all active:scale-[0.98]"
          >
            <Trash2 className="w-4 h-4" />
            Discard
          </button>
          <button
            onClick={onResume}
            className="flex-1 py-3 px-4 rounded-xl bg-gradient-to-r from-purple-600 to-fuchsia-500 text-white font-semibold flex items-center justify-center gap-2 shadow-lg shadow-purple-500/20 transition-all active:scale-[0.98]"
          >
            <Play className="w-4 h-4" />
            Resume
          </button>
        </div>
      </div>
    </div>
  );
}
