import { supabase } from '../supabase/client';
import type { Json } from '../supabase/database.types';

type UiEventPayload = {
  name: string;
  source?: string;
  properties?: Record<string, unknown>;
};

type QueuedUiEvent = {
  name: string;
  source: string;
  properties: Json;
  path: string;
  sessionId: string;
  timestamp: string;
};

const QUEUE_KEY = 'iron_brain_ui_event_queue_v1';
const SESSION_KEY = 'iron_brain_ui_event_session_v1';
const MAX_QUEUE_SIZE = 200;
let warnedOnce = false;

const safeParseQueue = (raw: string | null): QueuedUiEvent[] => {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw) as QueuedUiEvent[];
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((event) => event && typeof event.name === 'string');
  } catch {
    return [];
  }
};

const getSessionId = (): string => {
  if (typeof window === 'undefined') return 'server';
  const existing = localStorage.getItem(SESSION_KEY);
  if (existing) return existing;
  const generated = typeof crypto !== 'undefined' && crypto.randomUUID
    ? crypto.randomUUID()
    : `sess_${Math.random().toString(36).slice(2, 10)}`;
  localStorage.setItem(SESSION_KEY, generated);
  return generated;
};

const readQueue = (): QueuedUiEvent[] => {
  if (typeof window === 'undefined') return [];
  return safeParseQueue(localStorage.getItem(QUEUE_KEY));
};

const writeQueue = (queue: QueuedUiEvent[]) => {
  if (typeof window === 'undefined') return;
  const trimmed = queue.slice(-MAX_QUEUE_SIZE);
  localStorage.setItem(QUEUE_KEY, JSON.stringify(trimmed));
};

const toJson = (value: unknown): Json => {
  try {
    return JSON.parse(JSON.stringify(value)) as Json;
  } catch {
    return {} as Json;
  }
};

const buildQueuedEvent = (payload: UiEventPayload): QueuedUiEvent => {
  return {
    name: payload.name,
    source: payload.source ?? 'programs',
    properties: toJson(payload.properties ?? {}),
    path: typeof window !== 'undefined' ? window.location.pathname : 'unknown',
    sessionId: getSessionId(),
    timestamp: new Date().toISOString(),
  };
};

const flushUiEvents = async (userId?: string | null) => {
  if (!userId || typeof window === 'undefined') return;
  const queue = readQueue();
  if (queue.length === 0) return;

  const rows = queue.map((event) => ({
    user_id: userId,
    event_name: event.name,
    event_source: event.source,
    session_id: event.sessionId,
    path: event.path,
    properties: event.properties,
    created_at: event.timestamp,
  }));

  const { error } = await supabase.from('ui_events').insert(rows);
  if (error) {
    if (!warnedOnce) {
      console.warn('UI analytics flush failed:', error.message);
      warnedOnce = true;
    }
    return;
  }

  writeQueue([]);
};

export const trackUiEvent = async (payload: UiEventPayload, userId?: string | null) => {
  if (typeof window === 'undefined') return;
  const nextQueue = [...readQueue(), buildQueuedEvent(payload)];
  writeQueue(nextQueue);

  if (userId) {
    await flushUiEvents(userId);
  }
};
