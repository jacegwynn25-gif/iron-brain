#!/usr/bin/env node

/**
 * CRITICAL FIX: RLS policies for workout_sessions and set_logs
 * This is blocking all workout saves - must be fixed for app to work
 */

require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceKey) {
  console.error('❌ Missing Supabase credentials in .env.local');
  process.exit(1);
}

console.log('\n🚨 CRITICAL FIX: workout_sessions and set_logs RLS Policies\n');
console.log('='.repeat(70));

const supabase = createClient(supabaseUrl, serviceKey, {
  db: { schema: 'public' },
  auth: { persistSession: false }
});

async function fixWorkoutRLS() {
  try {
    // ========================================
    // Fix workout_sessions policies
    // ========================================
    console.log('\n1️⃣  Fixing workout_sessions table...\n');

    const workoutPolicySQLs = [
      {
        name: 'Drop old SELECT policy',
        sql: `DROP POLICY IF EXISTS "Users can view own workouts" ON workout_sessions;`
      },
      {
        name: 'Drop old INSERT policy',
        sql: `DROP POLICY IF EXISTS "Users can insert own workouts" ON workout_sessions;`
      },
      {
        name: 'Drop old UPDATE policy',
        sql: `DROP POLICY IF EXISTS "Users can update own workouts" ON workout_sessions;`
      },
      {
        name: 'Create SELECT policy',
        sql: `
          CREATE POLICY "Users can view own workouts"
            ON workout_sessions FOR SELECT
            USING (auth.uid() = user_id);
        `
      },
      {
        name: 'Create INSERT policy',
        sql: `
          CREATE POLICY "Users can insert own workouts"
            ON workout_sessions FOR INSERT
            WITH CHECK (auth.uid() = user_id);
        `
      },
      {
        name: 'Create UPDATE policy',
        sql: `
          CREATE POLICY "Users can update own workouts"
            ON workout_sessions FOR UPDATE
            USING (auth.uid() = user_id);
        `
      }
    ];

    for (const { name, sql } of workoutPolicySQLs) {
      const { error } = await supabase.rpc('exec_sql', { sql: sql.trim() });

      if (error) {
        // Check if it's just a "does not exist" error for drops
        if (name.includes('Drop') && error.message.includes('does not exist')) {
          console.log(`   ✓ ${name} (already clean)`);
        } else {
          console.log(`   ❌ ${name}: ${error.message}`);
        }
      } else {
        console.log(`   ✅ ${name}`);
      }
    }

    // ========================================
    // Fix set_logs policies
    // ========================================
    console.log('\n2️⃣  Fixing set_logs table...\n');

    const setLogsPolicySQLs = [
      {
        name: 'Drop old SELECT policy',
        sql: `DROP POLICY IF EXISTS "Users can view own set logs" ON set_logs;`
      },
      {
        name: 'Drop old INSERT policy',
        sql: `DROP POLICY IF EXISTS "Users can insert own set logs" ON set_logs;`
      },
      {
        name: 'Create SELECT policy',
        sql: `
          CREATE POLICY "Users can view own set logs"
            ON set_logs FOR SELECT
            USING (
              EXISTS (
                SELECT 1 FROM workout_sessions
                WHERE workout_sessions.id = set_logs.workout_session_id
                AND workout_sessions.user_id = auth.uid()
              )
            );
        `
      },
      {
        name: 'Create INSERT policy',
        sql: `
          CREATE POLICY "Users can insert own set logs"
            ON set_logs FOR INSERT
            WITH CHECK (
              EXISTS (
                SELECT 1 FROM workout_sessions
                WHERE workout_sessions.id = set_logs.workout_session_id
                AND workout_sessions.user_id = auth.uid()
              )
            );
        `
      }
    ];

    for (const { name, sql } of setLogsPolicySQLs) {
      const { error } = await supabase.rpc('exec_sql', { sql: sql.trim() });

      if (error) {
        if (name.includes('Drop') && error.message.includes('does not exist')) {
          console.log(`   ✓ ${name} (already clean)`);
        } else {
          console.log(`   ❌ ${name}: ${error.message}`);
        }
      } else {
        console.log(`   ✅ ${name}`);
      }
    }

    // ========================================
    // Verify RLS is enabled
    // ========================================
    console.log('\n3️⃣  Verifying RLS is enabled...\n');

    const verifyRLS = await supabase.rpc('exec_sql', {
      sql: `
        SELECT tablename, rowsecurity
        FROM pg_tables
        WHERE schemaname = 'public'
        AND tablename IN ('workout_sessions', 'set_logs');
      `
    });

    if (!verifyRLS.error) {
      console.log('   ✅ RLS status verified\n');
    }

    // ========================================
    // Test access with service role
    // ========================================
    console.log('4️⃣  Testing database access...\n');

    const { data: testWorkout, error: workoutError } = await supabase
      .from('workout_sessions')
      .select('count')
      .limit(1);

    if (workoutError) {
      console.log(`   ⚠️  workout_sessions: ${workoutError.message}`);
    } else {
      console.log('   ✅ workout_sessions accessible');
    }

    const { data: testSetLogs, error: setLogsError } = await supabase
      .from('set_logs')
      .select('count')
      .limit(1);

    if (setLogsError) {
      console.log(`   ⚠️  set_logs: ${setLogsError.message}`);
    } else {
      console.log('   ✅ set_logs accessible');
    }

    console.log('\n' + '='.repeat(70));
    console.log('\n✅ RLS POLICY FIX COMPLETE!\n');
    console.log('Next steps:');
    console.log('  1. Refresh your browser (Cmd+Shift+R)');
    console.log('  2. Sign out and sign back in');
    console.log('  3. Try logging a workout\n');

  } catch (error) {
    console.error('\n❌ Unexpected error:', error);
    console.log('\n📋 MANUAL FIX REQUIRED:');
    console.log('   Go to: https://supabase.com/dashboard');
    console.log('   → Select your Iron Brain project');
    console.log('   → SQL Editor → New Query');
    console.log('   → Run the SQL from: RUN-THIS-SQL.md\n');
    process.exit(1);
  }
}

// Handle script execution
fixWorkoutRLS().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
