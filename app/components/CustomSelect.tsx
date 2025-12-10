'use client';

import { useState, useRef, useEffect } from 'react';
import { ChevronDown, Check } from 'lucide-react';

interface Option {
  value: string;
  label: string;
  icon?: React.ReactNode;
}

interface CustomSelectProps {
  value: string;
  onChange: (value: string) => void;
  options: Option[];
  placeholder?: string;
  label?: string;
  className?: string;
}

export default function CustomSelect({
  value,
  onChange,
  options,
  placeholder = 'Select an option',
  label,
  className = '',
}: CustomSelectProps) {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const selectedOption = options.find(opt => opt.value === value);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  return (
    <div className={`relative ${className}`} ref={dropdownRef}>
      {label && (
        <label className="mb-2 block text-sm font-medium text-zinc-700 dark:text-zinc-300">
          {label}
        </label>
      )}

      {/* Trigger Button */}
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="group relative w-full rounded-xl border border-zinc-200 bg-white px-4 py-3.5 text-left shadow-sm transition-all hover:border-zinc-300 focus:border-purple-500 focus:outline-none focus:ring-2 focus:ring-purple-500/20 dark:border-zinc-800 dark:bg-zinc-900 dark:hover:border-zinc-700"
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            {selectedOption?.icon && (
              <span className="text-zinc-500 dark:text-zinc-400">
                {selectedOption.icon}
              </span>
            )}
            <span className={`font-medium ${selectedOption ? 'text-zinc-900 dark:text-zinc-50' : 'text-zinc-500 dark:text-zinc-400'}`}>
              {selectedOption?.label || placeholder}
            </span>
          </div>
          <ChevronDown
            className={`h-5 w-5 text-zinc-400 transition-transform ${isOpen ? 'rotate-180' : ''}`}
          />
        </div>
      </button>

      {/* Dropdown Menu */}
      {isOpen && (
        <div className="absolute z-[9999] mt-2 w-full animate-slideInRight rounded-xl border border-zinc-200 bg-white shadow-premium dark:border-zinc-800 dark:bg-zinc-900">
          <div className="max-h-64 overflow-y-auto p-1.5">
            {options.map((option) => {
              const isSelected = option.value === value;

              return (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => {
                    onChange(option.value);
                    setIsOpen(false);
                  }}
                  className={`group flex w-full items-center justify-between rounded-lg px-3 py-2.5 text-left transition-all ${
                    isSelected
                      ? 'bg-purple-50 text-purple-900 dark:bg-purple-900/20 dark:text-purple-100'
                      : 'text-zinc-700 hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-800'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    {option.icon && (
                      <span className={isSelected ? 'text-purple-600 dark:text-purple-400' : 'text-zinc-500 dark:text-zinc-400'}>
                        {option.icon}
                      </span>
                    )}
                    <span className="font-medium">{option.label}</span>
                  </div>
                  {isSelected && (
                    <Check className="h-4 w-4 text-purple-600 dark:text-purple-400" />
                  )}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
