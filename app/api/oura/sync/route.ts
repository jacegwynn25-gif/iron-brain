import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin, getSupabaseUserFromRequest } from '@/app/lib/supabase/admin';
import type { TablesInsert } from '@/app/lib/supabase/database.types';
import { getOuraConfig, OURA_API_BASE_URL, OURA_TOKEN_URL } from '@/app/lib/integrations/oura';

type DailyReadiness = {
  day: string;
  score: number | null;
};

type DailySleep = {
  day: string;
  score: number | null;
};

type SleepEntry = {
  day: string;
  type?: string | null;
  total_sleep_duration?: number | null;
  restless_periods?: number | null;
  average_hrv?: number | null;
  lowest_heart_rate?: number | null;
  average_heart_rate?: number | null;
};

type OuraCollectionResponse<T> = {
  data: T[];
  next_token: string | null;
};

export async function POST(request: NextRequest) {
  const supabase = getSupabaseAdmin();
  const user = await getSupabaseUserFromRequest(request);
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await request.json().catch(() => ({}));
    const days = typeof body.days === 'number' && body.days > 0 ? body.days : undefined;
    const startDate = typeof body.start_date === 'string' ? body.start_date : undefined;
    const endDate = typeof body.end_date === 'string' ? body.end_date : undefined;
    const mode = typeof body.mode === 'string' ? body.mode : 'incremental';

    const range = resolveDateRange({ days, startDate, endDate, mode });

    const { data: connection, error: connectionError } = await supabase
      .from('fitness_tracker_connections')
      .select('access_token, refresh_token, token_expires_at, is_active')
      .eq('user_id', user.id)
      .eq('provider', 'oura')
      .maybeSingle();

    if (connectionError) {
      throw new Error('Failed to load Oura connection');
    }

    if (!connection || !connection.is_active || !connection.access_token) {
      return NextResponse.json({ error: 'Oura connection not active' }, { status: 400 });
    }

    let accessToken = connection.access_token;
    let refreshToken = connection.refresh_token || null;

    const expiresAt = connection.token_expires_at ? new Date(connection.token_expires_at).getTime() : null;
    if (expiresAt && expiresAt <= Date.now() + 60_000 && refreshToken) {
      const refreshed = await refreshOuraToken(refreshToken);
      accessToken = refreshed.access_token;
      refreshToken = refreshed.refresh_token ?? refreshToken;

      const tokenExpiresAt = refreshed.expires_in
        ? new Date(Date.now() + refreshed.expires_in * 1000).toISOString()
        : null;

      await supabase
        .from('fitness_tracker_connections')
        .update({
          access_token: accessToken,
          refresh_token: refreshToken,
          token_expires_at: tokenExpiresAt,
          scope: refreshed.scope ?? null,
          is_active: true,
        })
        .eq('user_id', user.id)
        .eq('provider', 'oura');
    }

    const [dailyReadiness, dailySleep, sleeps] = await Promise.all([
      fetchOuraCollection<DailyReadiness>('/v2/usercollection/daily_readiness', accessToken, range),
      fetchOuraCollection<DailySleep>('/v2/usercollection/daily_sleep', accessToken, range),
      fetchOuraCollection<SleepEntry>('/v2/usercollection/sleep', accessToken, range),
    ]);

    const readinessByDay = new Map<string, number | null>();
    dailyReadiness.forEach((item) => {
      if (item.day) readinessByDay.set(item.day, item.score ?? null);
    });

    const sleepScoreByDay = new Map<string, number | null>();
    dailySleep.forEach((item) => {
      if (item.day) sleepScoreByDay.set(item.day, item.score ?? null);
    });

    const sleepByDay = new Map<string, SleepEntry>();
    sleeps.forEach((sleep) => {
      if (!sleep.day) return;
      if (sleep.type === 'deleted' || sleep.type === 'rest') return;

      const existing = sleepByDay.get(sleep.day);
      const chosen = chooseBetterSleep(existing, sleep);
      if (chosen) sleepByDay.set(sleep.day, chosen);
    });

    const allDays = new Set<string>([
      ...readinessByDay.keys(),
      ...sleepScoreByDay.keys(),
      ...sleepByDay.keys(),
    ]);

    const rows = Array.from(allDays).map((day): TablesInsert<'user_context_data'> => {
      const sleep = sleepByDay.get(day);
      const readinessScore = readinessByDay.get(day);
      const sleepScore = sleepScoreByDay.get(day);

      const row: TablesInsert<'user_context_data'> = {
        user_id: user.id,
        date: day,
        source: 'oura',
      };

      if (sleep?.total_sleep_duration != null) {
        row.sleep_hours = Number((sleep.total_sleep_duration / 3600).toFixed(1));
      }
      if (sleep?.restless_periods != null) {
        row.sleep_interruptions = sleep.restless_periods;
      }
      if (sleep?.average_hrv != null) {
        row.heart_rate_variability = sleep.average_hrv;
      }
      if (sleep?.lowest_heart_rate != null || sleep?.average_heart_rate != null) {
        row.resting_heart_rate = sleep.lowest_heart_rate ?? sleep.average_heart_rate ?? null;
      }
      if (sleepScore != null) {
        row.sleep_quality = mapSleepQuality(sleepScore);
      }
      if (readinessScore != null) {
        row.subjective_readiness = Number((readinessScore / 10).toFixed(1));
      }

      return row;
    });

    const rowsToUpsert = rows.filter((row) => Object.keys(row).length > 3);

    if (rowsToUpsert.length > 0) {
      const { error: upsertError } = await supabase
        .from('user_context_data')
        .upsert(rowsToUpsert, { onConflict: 'user_id,date' });

      if (upsertError) {
        throw new Error(`Failed to upsert context data: ${upsertError.message}`);
      }
    }

    await supabase
      .from('fitness_tracker_connections')
      .update({
        last_sync_at: new Date().toISOString(),
        last_sync_status: 'success',
        sync_error: null,
      })
      .eq('user_id', user.id)
      .eq('provider', 'oura');

    return NextResponse.json({
      ok: true,
      days_synced: rowsToUpsert.length,
      range,
    });
  } catch (error) {
    console.error('Oura sync error:', error);
    await supabase
      .from('fitness_tracker_connections')
      .update({
        last_sync_status: 'failed',
        sync_error: error instanceof Error ? error.message : 'Unknown error',
      })
      .eq('user_id', user.id)
      .eq('provider', 'oura');

    return NextResponse.json({ error: 'Failed to sync Oura data' }, { status: 500 });
  }
}

function resolveDateRange({
  days,
  startDate,
  endDate,
  mode,
}: {
  days?: number;
  startDate?: string;
  endDate?: string;
  mode: string;
}) {
  const fallbackDays = mode === 'backfill' ? 30 : 7;
  const rangeDays = days ?? fallbackDays;

  const end = endDate ? parseDate(endDate) : new Date();
  const start = startDate ? parseDate(startDate) : addDays(end, -(rangeDays - 1));

  return {
    start_date: formatDate(start),
    end_date: formatDate(end),
  };
}

function parseDate(value: string) {
  const normalized = value.length === 10 ? `${value}T00:00:00Z` : value;
  return new Date(normalized);
}

function formatDate(date: Date) {
  return date.toISOString().slice(0, 10);
}

function addDays(date: Date, days: number) {
  const copy = new Date(date.getTime());
  copy.setUTCDate(copy.getUTCDate() + days);
  return copy;
}

function mapSleepQuality(score: number) {
  if (score < 60) return 'poor';
  if (score < 75) return 'fair';
  if (score < 85) return 'good';
  return 'excellent';
}

function chooseBetterSleep(existing: SleepEntry | undefined, candidate: SleepEntry) {
  if (!existing) return candidate;

  const existingPriority = sleepTypePriority(existing.type);
  const candidatePriority = sleepTypePriority(candidate.type);

  if (candidatePriority > existingPriority) return candidate;
  if (candidatePriority < existingPriority) return existing;

  const existingDuration = existing.total_sleep_duration ?? 0;
  const candidateDuration = candidate.total_sleep_duration ?? 0;

  return candidateDuration >= existingDuration ? candidate : existing;
}

function sleepTypePriority(type?: string | null) {
  switch (type) {
    case 'long_sleep':
      return 3;
    case 'sleep':
      return 2;
    case 'late_nap':
      return 1;
    default:
      return 0;
  }
}

async function fetchOuraCollection<T>(
  path: string,
  accessToken: string,
  range: { start_date: string; end_date: string }
) {
  const collected: T[] = [];
  let nextToken: string | null = null;

  do {
    const url = new URL(`${OURA_API_BASE_URL}${path}`);
    url.searchParams.set('start_date', range.start_date);
    url.searchParams.set('end_date', range.end_date);
    if (nextToken) url.searchParams.set('next_token', nextToken);

    const response = await fetch(url, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });

    const payload = (await response.json()) as OuraCollectionResponse<T>;
    if (!response.ok) {
      throw new Error(`Oura API error (${response.status})`);
    }

    collected.push(...payload.data);
    nextToken = payload.next_token;
  } while (nextToken);

  return collected;
}

async function refreshOuraToken(refreshToken: string) {
  const { clientId, clientSecret } = getOuraConfig();

  const response = await fetch(OURA_TOKEN_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: refreshToken,
      client_id: clientId,
      client_secret: clientSecret,
    }).toString(),
  });

  const payload = await response.json();
  if (!response.ok) {
    throw new Error('Failed to refresh Oura token');
  }

  return payload as {
    access_token: string;
    refresh_token?: string;
    expires_in?: number;
    scope?: string;
  };
}
