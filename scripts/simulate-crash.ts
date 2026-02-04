import { config as loadEnv } from 'dotenv';
import { createClient } from '@supabase/supabase-js';

loadEnv({ path: '.env.local' });
loadEnv();

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  throw new Error('Missing Supabase env vars: NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY (or NEXT_PUBLIC_SUPABASE_ANON_KEY).');
}

const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: {
    persistSession: false,
    autoRefreshToken: false,
  },
});

async function main(): Promise<void> {
  const { data: lastSession, error: lastSessionError } = await supabase
    .from('workout_sessions')
    .select('user_id, end_time, created_at')
    .not('user_id', 'is', null)
    .order('end_time', { ascending: false, nullsFirst: false })
    .order('created_at', { ascending: false, nullsFirst: false })
    .limit(1)
    .maybeSingle();

  if (lastSessionError) {
    throw new Error(`Failed to fetch recent workout session: ${lastSessionError.message}`);
  }

  const userId = lastSession?.user_id;
  if (!userId) {
    throw new Error('No workout_sessions rows with a non-null user_id were found.');
  }

  const nowIso = new Date().toISOString();

  const insertPayload: Record<string, unknown> = {
    user_id: userId,
    sleep_hours: 4,
    calorie_balance: 'deficit',
    date: nowIso,
    recovery_score: 35,
  };

  const insertResult = await supabase
    .from('user_context_data')
    .insert(insertPayload)
    .select('id, user_id, date, sleep_hours, calorie_balance')
    .single();

  if (insertResult.error && insertResult.error.message.includes('recovery_score')) {
    // Fallback for schemas that store readiness as subjective_readiness.
    const fallbackPayload: Record<string, unknown> = {
      user_id: userId,
      sleep_hours: 4,
      calorie_balance: 'deficit',
      date: nowIso,
      subjective_readiness: 3.5,
    };

    const fallbackResult = await supabase
      .from('user_context_data')
      .insert(fallbackPayload)
      .select('id, user_id, date, sleep_hours, calorie_balance, subjective_readiness')
      .single();

    if (fallbackResult.error) {
      throw new Error(`Failed to insert simulated crash context: ${fallbackResult.error.message}`);
    }

    console.log('Inserted simulated crash context row (fallback to subjective_readiness):');
    console.log(fallbackResult.data);
    return;
  }

  if (insertResult.error) {
    throw new Error(`Failed to insert simulated crash context: ${insertResult.error.message}`);
  }

  const insertedRow = insertResult.data;
  console.log('Inserted simulated crash context row:');
  console.log(insertedRow);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
