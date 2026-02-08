'use client';

import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { X } from 'lucide-react';
import { useAuth } from '../../lib/supabase/auth-context';
import { supabase } from '../../lib/supabase/client';

interface CoachMark {
  id: string;
  targetSelector: string;
  title: string;
  description: string;
  position: 'top' | 'bottom' | 'left' | 'right';
}

const coachMarks: CoachMark[] = [
  {
    id: 'start-button',
    targetSelector: '[data-coach="start-button"]',
    title: 'Start a Workout',
    description: 'Tap here to begin your training session.',
    position: 'top',
  },
  {
    id: 'programs',
    targetSelector: '[data-coach="programs-tab"]',
    title: 'Your Programs',
    description: 'Build and manage your training programs here.',
    position: 'top',
  },
  {
    id: 'history',
    targetSelector: '[data-coach="history-tab"]',
    title: 'History',
    description: 'Review finished sessions, trends, and PR progress.',
    position: 'top',
  },
];

interface CoachMarksProps {
  onComplete: () => void;
}

export default function CoachMarks({ onComplete }: CoachMarksProps) {
  const { user } = useAuth();
  const [currentIndex, setCurrentIndex] = useState(0);
  const [targetRect, setTargetRect] = useState<DOMRect | null>(null);

  const currentMark = coachMarks[currentIndex];

  useEffect(() => {
    if (!currentMark) return;

    let attempts = 0;
    const updateRect = () => {
      const target = document.querySelector(currentMark.targetSelector);
      if (target) {
        const rect = target.getBoundingClientRect();
        setTargetRect(rect);
        return true;
      }
      setTargetRect(null);
      return false;
    };

    updateRect();
    const timer = window.setInterval(() => {
      attempts += 1;
      const found = updateRect();
      if (found || attempts > 12) {
        window.clearInterval(timer);
      }
    }, 200);

    window.addEventListener('resize', updateRect);
    window.addEventListener('scroll', updateRect, true);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener('resize', updateRect);
      window.removeEventListener('scroll', updateRect, true);
    };
  }, [currentMark]);

  const persistCoachMarksComplete = async () => {
    localStorage.setItem('iron_brain_coach_marks_complete', 'true');
    if (user) {
      const { error } = await supabase.auth.updateUser({
        data: {
          coach_marks_complete: true,
        },
      });
      if (error) {
        console.error('Failed to update coach marks metadata:', error);
      }
    }
  };

  const handleNext = () => {
    if (currentIndex < coachMarks.length - 1) {
      setCurrentIndex(currentIndex + 1);
      return;
    }
    onComplete();
    persistCoachMarksComplete().catch(err => {
      console.error('Failed to persist coach marks:', err);
    });
  };

  const handleSkip = () => {
    onComplete();
    persistCoachMarksComplete().catch(err => {
      console.error('Failed to persist coach marks:', err);
    });
  };

  if (!currentMark) return null;

  const tooltipWidth = 280;
  const tooltipHeight = 150;
  const clamp = (value: number, min: number, max: number) => Math.min(Math.max(value, min), max);
  const hasTarget = Boolean(targetRect);
  const left = hasTarget && targetRect
    ? clamp(targetRect.left, 16, window.innerWidth - tooltipWidth - 16)
    : window.innerWidth / 2 - tooltipWidth / 2;
  const top = hasTarget && targetRect
    ? clamp(
        currentMark.position === 'top'
          ? targetRect.top - tooltipHeight - 16
          : targetRect.bottom + 16,
        16,
        window.innerHeight - tooltipHeight - 16
      )
    : window.innerHeight / 2 - tooltipHeight / 2;

  return (
    <div className="fixed inset-0 z-50 pointer-events-none">
      {hasTarget && targetRect && (
        <div
          className="absolute rounded-2xl ring-4 ring-purple-400/90 shadow-[0_0_35px_rgba(168,85,247,0.6)] pointer-events-none"
          style={{
            left: targetRect.left - 8,
            top: targetRect.top - 8,
            width: targetRect.width + 16,
            height: targetRect.height + 16,
          }}
        />
      )}

      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="absolute bg-white rounded-2xl p-4 shadow-xl max-w-xs pointer-events-auto"
        style={{
          left,
          top,
        }}
      >
        <button
          onClick={handleSkip}
          className="absolute top-2 right-2 text-gray-400 hover:text-gray-600"
        >
          <X className="w-5 h-5" />
        </button>
        <h3 className="font-bold text-gray-900 mb-1">{currentMark.title}</h3>
        <p className="text-sm text-gray-600 mb-4">
          {hasTarget ? currentMark.description : 'We could not find this control yet. You can still continue.'}
        </p>
        <div className="flex items-center justify-between">
          <span className="text-xs text-gray-400">
            {currentIndex + 1} of {coachMarks.length}
          </span>
          <button
            onClick={handleNext}
            className="px-4 py-2 bg-purple-600 text-white text-sm font-semibold rounded-lg"
          >
            {currentIndex < coachMarks.length - 1 ? 'Next' : 'Got it!'}
          </button>
        </div>
      </motion.div>
    </div>
  );
}
