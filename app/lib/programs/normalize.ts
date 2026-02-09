'use client';

import type { ProgramTemplate } from '../types';
import { normalizeProgramStructure } from './structure';

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
  const structureNormalized = normalizeProgramStructure(program);
  const baseProgram = structureNormalized.program;
  const cleanedName = cleanText(baseProgram.name);
  const cleanedDescription = baseProgram.description ? cleanText(baseProgram.description) : undefined;
  const cleanedAuthor = normalizeAuthor(baseProgram.author);

  const normalized: ProgramTemplate = {
    ...baseProgram,
    name: cleanedName || 'Training Program',
    description: cleanedDescription || undefined,
    author: cleanedAuthor,
  };

  const changed =
    structureNormalized.changed ||
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
