#!/usr/bin/env tsx

/**
 * Debug script to check sync status
 */

import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Missing Supabase credentials');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function debugSync() {
  console.log('🔍 Checking Supabase data...\n');

  // Get current user
  const { data: { user }, error: authError } = await supabase.auth.getUser();

  if (authError || !user) {
    console.log('❌ Not logged in. Please log in first.');
    console.log('Run this in browser console on localhost:3000 to get your user ID:');
    console.log('  const { data } = await supabase.auth.getUser(); console.log(data.user.id);');
    return;
  }

  console.log(`✅ Logged in as: ${user.email}`);
  console.log(`   User ID: ${user.id}\n`);

  // Check workout_sessions
  const { data: sessions, error: sessionsError } = await supabase
    .from('workout_sessions')
    .select('id, date, name, deleted_at')
    .eq('user_id', user.id)
    .order('date', { ascending: false });

  if (sessionsError) {
    console.error('❌ Error fetching sessions:', sessionsError);
    return;
  }

  console.log(`📊 Workout Sessions in Supabase: ${sessions?.length || 0}`);

  if (sessions && sessions.length > 0) {
    console.log('\nWorkouts:');
    sessions.forEach((s: any, i: number) => {
      const status = s.deleted_at ? '🗑️  DELETED' : '✅ ACTIVE';
      console.log(`  ${i + 1}. ${status} ${s.date} - ${s.name || 'Unnamed'}`);
      if (s.deleted_at) {
        console.log(`     Deleted at: ${s.deleted_at}`);
      }
    });
  } else {
    console.log('   ⚠️  No workouts found in database!');
    console.log('   This means auto-sync has not run yet or failed.');
  }

  // Check for deleted workouts
  const deletedCount = sessions?.filter((s: any) => s.deleted_at)?.length || 0;
  if (deletedCount > 0) {
    console.log(`\n🗑️  Found ${deletedCount} deleted workout(s)`);
    console.log('   These will reappear when you fetch from Supabase');
    console.log('   Solution: Permanently delete them from trash');
  }

  console.log('\n💡 Next Steps:');
  if ((sessions?.length || 0) === 0) {
    console.log('   1. On your phone, open browser DevTools console');
    console.log('   2. Run: syncPendingWorkouts()');
    console.log('   3. This will manually trigger the sync');
  } else {
    console.log('   1. Permanently delete workouts from trash on localhost');
    console.log('   2. Then refresh and they should stay gone');
  }
}

debugSync().catch(console.error);
