import { supabase } from '../supabase/client';
import type { Json } from '../supabase/database.types';
import type { DayTemplate, ProgramTemplate } from '../types';

export type ProgramProgress = {
  cycleNumber: number;
  weekIndex: number;
  dayIndex: number;
  updatedAt?: string;
  lastCompletedAt?: string;
};

type ProgramProgressMap = Record<string, ProgramProgress>;

const STORAGE_KEY_PREFIX = 'iron_brain_program_progress';

type JsonRecord = Record<string, unknown>;

function normalizeNamespace(namespaceId?: string | null): string {
  if (!namespaceId || namespaceId === 'guest' || namespaceId === 'default') return 'default';
  return namespaceId;
}

function getStorageKey(namespaceId?: string | null): string {
  return `${STORAGE_KEY_PREFIX}__${normalizeNamespace(namespaceId)}`;
}

function getProgramWeekCount(program: ProgramTemplate): number {
  return Math.max(1, program.weeks.length || program.weekCount || 1);
}

function getProgramDaysCount(program: ProgramTemplate, weekIndex: number): number {
  const week = program.weeks[weekIndex] ?? program.weeks[0];
  return Math.max(1, week?.days.length || program.daysPerWeek || 1);
}

function parseJsonRecord(value: unknown): JsonRecord {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  return value as JsonRecord;
}

function parseProgressMap(namespaceId?: string | null): ProgramProgressMap {
  if (typeof window === 'undefined') return {};
  try {
    const raw = localStorage.getItem(getStorageKey(namespaceId));
    if (!raw) return {};
    const parsed = JSON.parse(raw) as ProgramProgressMap;
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch (error) {
    console.error('Failed to parse program progress map:', error);
    return {};
  }
}

function persistProgressMap(namespaceId: string | null | undefined, map: ProgramProgressMap): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(getStorageKey(namespaceId), JSON.stringify(map));
  } catch (error) {
    console.error('Failed to persist program progress map:', error);
  }
}

function normalizeProgress(program: ProgramTemplate, progress?: ProgramProgress | null): ProgramProgress {
  const fallback: ProgramProgress = {
    cycleNumber: 1,
    weekIndex: 0,
    dayIndex: 0,
  };
  const base = progress ?? fallback;
  const weekCount = getProgramWeekCount(program);
  const safeWeekIndex = Math.min(weekCount - 1, Math.max(0, Number(base.weekIndex) || 0));
  const dayCount = getProgramDaysCount(program, safeWeekIndex);
  const safeDayIndex = Math.min(dayCount - 1, Math.max(0, Number(base.dayIndex) || 0));
  const safeCycle = Math.max(1, Number(base.cycleNumber) || 1);

  return {
    cycleNumber: safeCycle,
    weekIndex: safeWeekIndex,
    dayIndex: safeDayIndex,
    updatedAt: base.updatedAt,
    lastCompletedAt: base.lastCompletedAt,
  };
}

function isMoreRecentProgress(next: ProgramProgress, previous?: ProgramProgress): boolean {
  if (!previous) return true;
  const nextTime = next.updatedAt ? Date.parse(next.updatedAt) : NaN;
  const prevTime = previous.updatedAt ? Date.parse(previous.updatedAt) : NaN;

  if (Number.isFinite(nextTime) && Number.isFinite(prevTime)) {
    return nextTime >= prevTime;
  }
  if (Number.isFinite(nextTime)) return true;
  return false;
}

function extractAppProgramId(row: {
  custom_settings?: Json | null;
  program_templates?: { app_program_id?: string | null } | Array<{ app_program_id?: string | null }> | null;
}): string | null {
  const customSettings = parseJsonRecord(row.custom_settings);
  const fromCustom = typeof customSettings.app_program_id === 'string' ? customSettings.app_program_id : null;
  if (fromCustom) return fromCustom;

  const relation = row.program_templates;
  if (Array.isArray(relation)) {
    const relationValue = relation[0];
    if (relationValue?.app_program_id) return relationValue.app_program_id;
    return null;
  }
  if (relation?.app_program_id) return relation.app_program_id;
  return null;
}

function mapCloudRowToProgress(row: {
  current_cycle?: number | null;
  current_week?: number | null;
  updated_at?: string | null;
  custom_settings?: Json | null;
}): ProgramProgress {
  const customSettings = parseJsonRecord(row.custom_settings);
  const fromSettingsWeekIndex =
    typeof customSettings.week_index === 'number' ? customSettings.week_index : undefined;
  const fromSettingsDayIndex =
    typeof customSettings.day_index === 'number' ? customSettings.day_index : undefined;
  const fromSettingsCycle =
    typeof customSettings.cycle_number === 'number' ? customSettings.cycle_number : undefined;
  const fromSettingsCompleted =
    typeof customSettings.last_completed_at === 'string' ? customSettings.last_completed_at : undefined;

  const cycleNumber = Math.max(1, Number(row.current_cycle ?? fromSettingsCycle ?? 1) || 1);
  const weekFromDb = row.current_week == null ? undefined : Number(row.current_week) - 1;
  const weekIndex = Math.max(0, Number(weekFromDb ?? fromSettingsWeekIndex ?? 0) || 0);
  const dayIndex = Math.max(0, Number(fromSettingsDayIndex ?? 0) || 0);
  const updatedAt = row.updated_at ?? (typeof customSettings.updated_at === 'string' ? customSettings.updated_at : undefined);

  return {
    cycleNumber,
    weekIndex,
    dayIndex,
    updatedAt: updatedAt || undefined,
    lastCompletedAt: fromSettingsCompleted,
  };
}

export function getProgramProgress(
  program: ProgramTemplate,
  namespaceId?: string | null,
  fallbackProgress?: ProgramProgress | null
): ProgramProgress {
  const map = parseProgressMap(namespaceId);
  const fromStorage = map[program.id];
  return normalizeProgress(program, fromStorage ?? fallbackProgress ?? null);
}

export function setProgramProgress(
  program: ProgramTemplate,
  progress: ProgramProgress,
  namespaceId?: string | null
): ProgramProgress {
  const normalized = normalizeProgress(program, {
    ...progress,
    updatedAt: new Date().toISOString(),
  });
  const map = parseProgressMap(namespaceId);
  map[program.id] = normalized;
  persistProgressMap(namespaceId, map);
  return normalized;
}

export function setProgramProgressMap(
  namespaceId: string | null | undefined,
  nextMap: ProgramProgressMap
): ProgramProgressMap {
  const current = parseProgressMap(namespaceId);
  const merged: ProgramProgressMap = { ...current };

  for (const [programId, progress] of Object.entries(nextMap)) {
    const previous = merged[programId];
    if (isMoreRecentProgress(progress, previous)) {
      merged[programId] = progress;
    }
  }

  persistProgressMap(namespaceId, merged);
  return merged;
}

export async function hydrateProgramProgressFromCloud(
  userId: string,
  namespaceId?: string | null
): Promise<ProgramProgressMap> {
  if (!userId) return parseProgressMap(namespaceId);

  try {
    const { data, error } = await supabase
      .from('user_programs')
      .select('current_cycle,current_week,custom_settings,updated_at,program_templates(app_program_id)')
      .eq('user_id', userId)
      .order('updated_at', { ascending: false });

    if (error) {
      console.error('Failed to hydrate program progress from cloud:', error);
      return parseProgressMap(namespaceId);
    }

    const cloudMap: ProgramProgressMap = {};
    (data ?? []).forEach((row) => {
      const appProgramId = extractAppProgramId(row);
      if (!appProgramId) return;
      const progress = mapCloudRowToProgress(row);
      if (isMoreRecentProgress(progress, cloudMap[appProgramId])) {
        cloudMap[appProgramId] = progress;
      }
    });

    return setProgramProgressMap(namespaceId, cloudMap);
  } catch (error) {
    console.error('Unexpected program progress hydration error:', error);
    return parseProgressMap(namespaceId);
  }
}

async function findProgramTemplateId(appProgramId: string): Promise<string | null> {
  const { data, error } = await supabase
    .from('program_templates')
    .select('id')
    .eq('app_program_id', appProgramId)
    .limit(1);

  if (error) {
    console.error('Failed to resolve template id for app program id:', error);
    return null;
  }

  return data?.[0]?.id ?? null;
}

async function findExistingUserProgram(
  userId: string,
  appProgramId: string,
  templateId: string | null
): Promise<{ id: string; custom_settings: Json | null; program_template_id: string | null } | null> {
  if (templateId) {
    const { data, error } = await supabase
      .from('user_programs')
      .select('id,custom_settings,program_template_id')
      .eq('user_id', userId)
      .eq('program_template_id', templateId)
      .limit(1);

    if (!error && data?.[0]) {
      return data[0];
    }
  }

  const { data, error } = await supabase
    .from('user_programs')
    .select('id,custom_settings,program_template_id')
    .eq('user_id', userId)
    .contains('custom_settings', { app_program_id: appProgramId })
    .limit(1);

  if (error) {
    console.error('Failed to lookup existing user_program progress row:', error);
    return null;
  }

  return data?.[0] ?? null;
}

export async function syncProgramProgressToCloud(
  userId: string,
  program: ProgramTemplate,
  progress: ProgramProgress,
  namespaceId?: string | null
): Promise<void> {
  if (!userId) return;

  const normalized = setProgramProgress(program, progress, namespaceId);
  const nowIso = new Date().toISOString();
  const appProgramId = program.id;
  const templateId = await findProgramTemplateId(appProgramId);
  const existing = await findExistingUserProgram(userId, appProgramId, templateId);
  const existingSettings = parseJsonRecord(existing?.custom_settings);
  const mergedSettings: JsonRecord = {
    ...existingSettings,
    app_program_id: appProgramId,
    week_index: normalized.weekIndex,
    day_index: normalized.dayIndex,
    cycle_number: normalized.cycleNumber,
    updated_at: nowIso,
    last_completed_at: normalized.lastCompletedAt ?? null,
  };

  if (existing?.id) {
    const { error } = await supabase
      .from('user_programs')
      .update({
        current_cycle: normalized.cycleNumber,
        current_week: normalized.weekIndex + 1,
        custom_settings: mergedSettings as Json,
        status: 'active',
        updated_at: nowIso,
      })
      .eq('id', existing.id)
      .eq('user_id', userId);

    if (error) {
      console.error('Failed to update program progress in cloud:', error);
    }
    return;
  }

  const { error } = await supabase.from('user_programs').insert({
    user_id: userId,
    program_template_id: templateId,
    current_cycle: normalized.cycleNumber,
    current_week: normalized.weekIndex + 1,
    status: 'active',
    started_at: nowIso,
    custom_settings: mergedSettings as Json,
    updated_at: nowIso,
  });

  if (error) {
    console.error('Failed to insert program progress in cloud:', error);
  }
}

export function advanceProgramProgress(
  program: ProgramTemplate,
  currentProgress: ProgramProgress,
  namespaceId?: string | null
): ProgramProgress {
  const normalized = normalizeProgress(program, currentProgress);
  const weekCount = getProgramWeekCount(program);
  const dayCount = getProgramDaysCount(program, normalized.weekIndex);

  let nextCycle = normalized.cycleNumber;
  let nextWeekIndex = normalized.weekIndex;
  let nextDayIndex = normalized.dayIndex + 1;

  if (nextDayIndex >= dayCount) {
    nextDayIndex = 0;
    nextWeekIndex += 1;
  }

  if (nextWeekIndex >= weekCount) {
    nextWeekIndex = 0;
    nextCycle += 1;
  }

  return setProgramProgress(
    program,
    {
      cycleNumber: nextCycle,
      weekIndex: nextWeekIndex,
      dayIndex: nextDayIndex,
      lastCompletedAt: new Date().toISOString(),
    },
    namespaceId
  );
}

export function resolveProgramDay(
  program: ProgramTemplate,
  progress: ProgramProgress
): {
  cycleNumber: number;
  weekIndex: number;
  dayIndex: number;
  weekNumber: number;
  day: DayTemplate | null;
} {
  const normalized = normalizeProgress(program, progress);
  const week = program.weeks[normalized.weekIndex] ?? program.weeks[0] ?? null;
  const day = week?.days[normalized.dayIndex] ?? week?.days[0] ?? null;
  return {
    cycleNumber: normalized.cycleNumber,
    weekIndex: normalized.weekIndex,
    dayIndex: normalized.dayIndex,
    weekNumber: week?.weekNumber ?? normalized.weekIndex + 1,
    day,
  };
}

