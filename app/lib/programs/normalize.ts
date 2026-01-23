'use client';

import type { ProgramTemplate } from '../types';

const LEGACY_GENERATED_PATTERN = /\bA\.?I\.?\s*-?\s*generated\b/gi;
const LEGACY_AI_PATTERN = /\bA\.?I\.?\b/gi;

function cleanText(value: string): string {
  return value
    .replace(LEGACY_GENERATED_PATTERN, '')
    .replace(LEGACY_AI_PATTERN, '')
    .replace(/\(\s*\)/g, '')
    .replace(/\s{2,}/g, ' ')
    .replace(/^[\s\-–—:]+/, '')
    .replace(/[\s\-–—:]+$/, '')
    .trim();
}

function normalizeAuthor(author?: string): string | undefined {
  if (!author) return undefined;
  const cleaned = cleanText(author);
  if (!cleaned) return 'Iron Brain';
  if (LEGACY_AI_PATTERN.test(author)) return 'Iron Brain';
  return cleaned;
}

export function normalizeProgramMetadata(program: ProgramTemplate): {
  program: ProgramTemplate;
  changed: boolean;
} {
  const cleanedName = cleanText(program.name);
  const cleanedDescription = program.description ? cleanText(program.description) : undefined;
  const cleanedAuthor = normalizeAuthor(program.author);

  const normalized: ProgramTemplate = {
    ...program,
    name: cleanedName || 'Training Program',
    description: cleanedDescription || undefined,
    author: cleanedAuthor,
  };

  const changed =
    normalized.name !== program.name ||
    normalized.description !== program.description ||
    normalized.author !== program.author;

  return { program: normalized, changed };
}

export function normalizePrograms(programs: ProgramTemplate[]): {
  programs: ProgramTemplate[];
  changedPrograms: ProgramTemplate[];
} {
  const changedPrograms: ProgramTemplate[] = [];
  const normalized = programs.map((program) => {
    const result = normalizeProgramMetadata(program);
    if (result.changed) {
      changedPrograms.push(result.program);
    }
    return result.program;
  });

  return { programs: normalized, changedPrograms };
}
