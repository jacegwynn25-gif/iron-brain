#!/usr/bin/env node

/**
 * Apply RLS fix directly to Supabase
 */

require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Missing credentials');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

const policies = [
  `DROP POLICY IF EXISTS "Users can view own fatigue events" ON fatigue_events;`,
  `DROP POLICY IF EXISTS "Users can insert own fatigue events" ON fatigue_events;`,
  `DROP POLICY IF EXISTS "Users can update own fatigue events" ON fatigue_events;`,
  `DROP POLICY IF EXISTS "Users can delete own fatigue events" ON fatigue_events;`,
  `CREATE POLICY "Users can view own fatigue events" ON fatigue_events FOR SELECT USING (auth.uid() = user_id);`,
  `CREATE POLICY "Users can insert own fatigue events" ON fatigue_events FOR INSERT WITH CHECK (auth.uid() = user_id);`,
  `CREATE POLICY "Users can update own fatigue events" ON fatigue_events FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);`,
  `CREATE POLICY "Users can delete own fatigue events" ON fatigue_events FOR DELETE USING (auth.uid() = user_id);`
];

async function fix() {
  console.log('\n🔧 Applying RLS fix...\n');

  for (const sql of policies) {
    const { error } = await supabase.rpc('exec_sql', { sql });
    if (error) {
      console.error('❌ Failed:', error.message);
      console.log('\n📋 Please run this SQL manually in Supabase Studio:');
      console.log(policies.join('\n'));
      process.exit(1);
    }
  }

  console.log('✅ RLS policies applied!\n');
}

fix();
