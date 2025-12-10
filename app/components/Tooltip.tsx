'use client';

import { useState } from 'react';
import { HelpCircle } from 'lucide-react';

interface TooltipProps {
  content: string;
  children?: React.ReactNode;
  className?: string;
}

export default function Tooltip({ content, children, className = '' }: TooltipProps) {
  const [isVisible, setIsVisible] = useState(false);

  return (
    <div className="relative inline-block">
      <button
        type="button"
        onMouseEnter={() => setIsVisible(true)}
        onMouseLeave={() => setIsVisible(false)}
        onClick={() => setIsVisible(!isVisible)}
        className={`inline-flex items-center justify-center text-zinc-400 hover:text-purple-600 dark:hover:text-purple-400 transition-colors ${className}`}
        aria-label="Help"
      >
        {children || <HelpCircle className="h-4 w-4" />}
      </button>

      {isVisible && (
        <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 z-[10000] animate-fadeIn">
          <div className="relative rounded-lg bg-zinc-900 px-3 py-2 text-sm font-medium text-white shadow-xl max-w-xs dark:bg-zinc-100 dark:text-zinc-900">
            {content}
            {/* Arrow */}
            <div className="absolute top-full left-1/2 -translate-x-1/2 -mt-px">
              <div className="border-4 border-transparent border-t-zinc-900 dark:border-t-zinc-100"></div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
