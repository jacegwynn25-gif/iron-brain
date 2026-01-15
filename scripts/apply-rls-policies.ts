#!/usr/bin/env tsx

/**
 * Apply RLS policies for analytics tables
 */

import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Missing Supabase credentials');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);
type RpcError = { code?: string; message?: string } | null;

const runQuery = (sql: string): Promise<{ error: RpcError }> => {
  const rpc = supabase.rpc as unknown as (
    fn: string,
    args: { query_text: string }
  ) => Promise<{ error: RpcError }>;
  return rpc('query', { query_text: sql });
};

async function applyPolicies() {
  console.log('🔄 Applying RLS policies for analytics tables...\n');

  const statements = [
    // Enable RLS
    'ALTER TABLE fatigue_history ENABLE ROW LEVEL SECURITY',
    'ALTER TABLE recovery_estimates ENABLE ROW LEVEL SECURITY',
    'ALTER TABLE sfr_analyses ENABLE ROW LEVEL SECURITY',
    'ALTER TABLE workout_sfr_summaries ENABLE ROW LEVEL SECURITY',

    // Fatigue history policies
    "CREATE POLICY \"Users can view own fatigue history\" ON fatigue_history FOR SELECT USING (auth.uid() = user_id)",
    "CREATE POLICY \"Users can insert own fatigue history\" ON fatigue_history FOR INSERT WITH CHECK (auth.uid() = user_id)",
    "CREATE POLICY \"Users can update own fatigue history\" ON fatigue_history FOR UPDATE USING (auth.uid() = user_id)",
    "CREATE POLICY \"Users can delete own fatigue history\" ON fatigue_history FOR DELETE USING (auth.uid() = user_id)",

    // Recovery estimates policies
    "CREATE POLICY \"Users can view own recovery estimates\" ON recovery_estimates FOR SELECT USING (auth.uid() = user_id)",
    "CREATE POLICY \"Users can insert own recovery estimates\" ON recovery_estimates FOR INSERT WITH CHECK (auth.uid() = user_id)",
    "CREATE POLICY \"Users can update own recovery estimates\" ON recovery_estimates FOR UPDATE USING (auth.uid() = user_id)",
    "CREATE POLICY \"Users can delete own recovery estimates\" ON recovery_estimates FOR DELETE USING (auth.uid() = user_id)",

    // SFR analyses policies
    "CREATE POLICY \"Users can view own SFR analyses\" ON sfr_analyses FOR SELECT USING (auth.uid() = user_id)",
    "CREATE POLICY \"Users can insert own SFR analyses\" ON sfr_analyses FOR INSERT WITH CHECK (auth.uid() = user_id)",
    "CREATE POLICY \"Users can update own SFR analyses\" ON sfr_analyses FOR UPDATE USING (auth.uid() = user_id)",
    "CREATE POLICY \"Users can delete own SFR analyses\" ON sfr_analyses FOR DELETE USING (auth.uid() = user_id)",

    // Workout SFR summaries policies
    "CREATE POLICY \"Users can view own workout SFR summaries\" ON workout_sfr_summaries FOR SELECT USING (auth.uid() = user_id)",
    "CREATE POLICY \"Users can insert own workout SFR summaries\" ON workout_sfr_summaries FOR INSERT WITH CHECK (auth.uid() = user_id)",
    "CREATE POLICY \"Users can update own workout SFR summaries\" ON workout_sfr_summaries FOR UPDATE USING (auth.uid() = user_id)",
    "CREATE POLICY \"Users can delete own workout SFR summaries\" ON workout_sfr_summaries FOR DELETE USING (auth.uid() = user_id)",
  ];

  let successCount = 0;
  let failCount = 0;

  for (const sql of statements) {
    const tableName = sql.match(/ON (\w+)/)?.[1] || sql.match(/TABLE (\w+)/)?.[1];
    const action = sql.startsWith('ALTER') ? 'Enabling RLS' : 'Creating policy';

    try {
      const { error } = await runQuery(sql);

      if (error && error.code !== '42710') { // Ignore "already exists" errors
        console.error(`❌ ${action} for ${tableName}: ${error.message}`);
        failCount++;
      } else {
        console.log(`✅ ${action} for ${tableName}`);
        successCount++;
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      console.error(`❌ ${action} for ${tableName}: ${message}`);
      failCount++;
    }
  }

  console.log(`\n📊 Summary: ${successCount} successful, ${failCount} failed`);

  if (failCount > 0) {
    console.log('\n⚠️  Some policies failed. You may need to apply them manually via Supabase dashboard.');
    console.log('SQL file: supabase/migrations/012_add_analytics_rls_policies.sql');
  } else {
    console.log('\n🎉 All RLS policies applied successfully!');
    console.log('   Users can now save and view Recovery and Efficiency data.');
  }
}

applyPolicies().catch(console.error);
