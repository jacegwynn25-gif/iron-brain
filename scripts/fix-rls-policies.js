#!/usr/bin/env node

/**
 * Fix RLS policies for fatigue_events table
 * This fixes the 406 errors by adding missing policies
 */

require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Missing Supabase credentials in .env.local');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  db: { schema: 'public' },
  auth: { persistSession: false }
});

async function fixRLS() {
  console.log('\n🔧 Fixing RLS Policies for Recovery System\n');
  console.log('='.repeat(60));

  try {
    console.log('\n📝 Creating RLS policies for fatigue_events...\n');

    // Drop existing policies if any
    const dropPolicies = [
      `DROP POLICY IF EXISTS "Users can view own fatigue events" ON fatigue_events;`,
      `DROP POLICY IF EXISTS "Users can insert own fatigue events" ON fatigue_events;`,
      `DROP POLICY IF EXISTS "Users can update own fatigue events" ON fatigue_events;`,
      `DROP POLICY IF EXISTS "Users can delete own fatigue events" ON fatigue_events;`
    ];

    for (const sql of dropPolicies) {
      const { error } = await supabase.rpc('exec_sql', { sql });
      if (error && !error.message.includes('does not exist')) {
        console.log(`   ⚠️  ${error.message}`);
      }
    }

    // Create new policies
    const policies = [
      {
        name: 'SELECT',
        sql: `CREATE POLICY "Users can view own fatigue events" ON fatigue_events FOR SELECT USING (auth.uid() = user_id);`
      },
      {
        name: 'INSERT',
        sql: `CREATE POLICY "Users can insert own fatigue events" ON fatigue_events FOR INSERT WITH CHECK (auth.uid() = user_id);`
      },
      {
        name: 'UPDATE',
        sql: `CREATE POLICY "Users can update own fatigue events" ON fatigue_events FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);`
      },
      {
        name: 'DELETE',
        sql: `CREATE POLICY "Users can delete own fatigue events" ON fatigue_events FOR DELETE USING (auth.uid() = user_id);`
      }
    ];

    for (const policy of policies) {
      const { error } = await supabase.rpc('exec_sql', { sql: policy.sql });
      if (error) {
        console.log(`   ❌ ${policy.name}: ${error.message}`);
      } else {
        console.log(`   ✅ ${policy.name} policy created`);
      }
    }

    console.log('\n✨ RLS policies updated!\n');
    console.log('Testing access...\n');

    // Test that tables are accessible
    const { data, error } = await supabase
      .from('fatigue_events')
      .select('count')
      .limit(1);

    if (error) {
      console.log(`   ❌ Still getting error: ${error.message}`);
      console.log('\n   You may need to run the SQL manually in Supabase Studio:');
      console.log('   https://supabase.com/dashboard/project/YOUR_PROJECT/sql\n');
      const migrationSQL = fs.readFileSync(
        path.join(__dirname, '../supabase/migrations/017_fix_fatigue_events_rls.sql'),
        'utf8'
      );
      console.log(migrationSQL);
    } else {
      console.log('   ✅ Tables are accessible!\n');
    }

    console.log('='.repeat(60));
    console.log('\n🎉 Fix complete! Try logging a workout now.\n');

  } catch (error) {
    console.error('\n❌ Error:', error.message);
    console.log('\n📋 Manual fix: Run this SQL in Supabase Studio SQL Editor:\n');
    const migrationSQL = fs.readFileSync(
      path.join(__dirname, '../supabase/migrations/017_fix_fatigue_events_rls.sql'),
      'utf8'
    );
    console.log(migrationSQL);
    process.exit(1);
  }
}

fixRLS();
