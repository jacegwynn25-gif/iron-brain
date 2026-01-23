import type { ProgramTemplate } from '../../lib/types';

type ProgramStats = {
  weekCount: number;
  totalDays: number;
  daysPerWeek: number;
  totalExercises: number;
};

const splitRules: Array<{ label: string; keywords: string[] }> = [
  { label: 'Upper', keywords: ['upper'] },
  { label: 'Lower', keywords: ['lower'] },
  { label: 'Push', keywords: ['push'] },
  { label: 'Pull', keywords: ['pull'] },
  { label: 'Legs', keywords: ['legs'] },
  { label: 'Full Body', keywords: ['full body', 'full'] },
  { label: 'Conditioning', keywords: ['conditioning', 'cardio'] },
  { label: 'Strength', keywords: ['strength'] },
  { label: 'Hypertrophy', keywords: ['hypertrophy'] },
  { label: 'Power', keywords: ['power'] },
];

const capitalize = (value: string) => value.charAt(0).toUpperCase() + value.slice(1);

export const getProgramStats = (program: ProgramTemplate): ProgramStats => {
  const weekCount = program.weeks.length || 1;
  const totalDays = program.weeks.reduce((sum, week) => sum + week.days.length, 0);
  const daysPerWeek = program.daysPerWeek
    ?? program.weeks.reduce((max, week) => Math.max(max, week.days.length), 0);
  const totalExercises = program.weeks.reduce(
    (sum, week) => sum + week.days.reduce(
      (daySum, day) => daySum + new Set(day.sets.map(s => s.exerciseId)).size,
      0
    ),
    0
  );

  return { weekCount, totalDays, daysPerWeek, totalExercises };
};

export const inferSplitTags = (program: ProgramTemplate): string[] => {
  const tags = new Set<string>();
  program.weeks.forEach((week) => {
    week.days.forEach((day) => {
      const name = (day.name || '').toLowerCase();
      splitRules.forEach((rule) => {
        if (rule.keywords.some((keyword) => name.includes(keyword))) {
          tags.add(rule.label);
        }
      });
    });
  });

  if (tags.size === 0) {
    if (program.goal) {
      tags.add(capitalize(program.goal));
    } else if (program.intensityMethod) {
      tags.add(program.intensityMethod.toUpperCase());
    }
  }

  return Array.from(tags).slice(0, 3);
};

export const inferSplitLabel = (program: ProgramTemplate): string => {
  const tags = inferSplitTags(program);
  const hasUpper = tags.includes('Upper');
  const hasLower = tags.includes('Lower') || tags.includes('Legs');
  const hasPush = tags.includes('Push');
  const hasPull = tags.includes('Pull');
  const hasFullBody = tags.includes('Full Body');

  if (hasUpper && hasLower) return 'Upper/Lower';
  if (hasPush && hasPull) return hasLower ? 'Push/Pull/Legs' : 'Push/Pull';
  if (hasFullBody) return 'Full Body';
  return tags[0] || 'Balanced';
};
