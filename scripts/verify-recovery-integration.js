#!/usr/bin/env node

/**
 * Verification script for recovery system integration
 *
 * Checks:
 * 1. Database connection
 * 2. fatigue_events table has data
 * 3. recovery_snapshots table exists
 * 4. Old vs new system data counts
 */

require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  console.error('❌ Missing Supabase credentials in .env.local');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function verify() {
  console.log('\n🔍 Recovery System Integration Verification\n');
  console.log('='.repeat(60));

  try {
    // Check 1: Old system data count
    console.log('\n1️⃣  Checking OLD recovery system...');
    const { data: oldSessions, error: oldError } = await supabase
      .from('workout_sessions')
      .select('id, completed_at', { count: 'exact', head: false })
      .not('completed_at', 'is', null)
      .order('completed_at', { ascending: false })
      .limit(5);

    if (oldError) {
      console.error('   ❌ Error fetching old sessions:', oldError.message);
    } else {
      console.log(`   ✅ Old system: ${oldSessions?.length || 0} recent completed sessions`);
      if (oldSessions && oldSessions.length > 0) {
        console.log('   Most recent:', oldSessions[0].completed_at);
      }
    }

    // Check 2: New system data count
    console.log('\n2️⃣  Checking NEW recovery system...');
    const { data: newEvents, error: newError, count: eventCount } = await supabase
      .from('fatigue_events')
      .select('timestamp, exercise_name, sets, reps, weight, rpe', { count: 'exact', head: false })
      .order('timestamp', { ascending: false })
      .limit(10);

    if (newError) {
      console.error('   ❌ Error fetching fatigue events:', newError.message);
    } else {
      console.log(`   ✅ New system: ${eventCount || 0} total fatigue events`);
      if (newEvents && newEvents.length > 0) {
        console.log(`   Most recent event: ${newEvents[0].exercise_name} - ${newEvents[0].sets}x${newEvents[0].reps} @ ${newEvents[0].weight}lbs (RPE ${newEvents[0].rpe})`);
        console.log(`   Timestamp: ${newEvents[0].timestamp}`);

        console.log('\n   Recent events:');
        newEvents.forEach((event, i) => {
          console.log(`   ${i + 1}. ${event.exercise_name} - ${event.sets}x${event.reps} @ ${event.weight}lbs (RPE ${event.rpe})`);
        });
      } else {
        console.log('   ⚠️  No fatigue events found');
        console.log('   💡 Log a workout to populate the new system');
      }
    }

    // Check 3: Recovery snapshots
    console.log('\n3️⃣  Checking recovery snapshots...');
    const { data: snapshots, error: snapshotError, count: snapshotCount } = await supabase
      .from('recovery_snapshots')
      .select('snapshot_timestamp, overall_recovery', { count: 'exact', head: false })
      .order('snapshot_timestamp', { ascending: false })
      .limit(5);

    if (snapshotError) {
      console.error('   ❌ Error fetching snapshots:', snapshotError.message);
    } else {
      console.log(`   ✅ Recovery snapshots: ${snapshotCount || 0} total`);
      if (snapshots && snapshots.length > 0) {
        console.log(`   Most recent: ${snapshots[0].snapshot_timestamp} (${Math.round(snapshots[0].overall_recovery)}% recovered)`);
      }
    }

    // Check 4: Integration status
    console.log('\n4️⃣  Integration Status:');
    const oldCount = oldSessions?.length || 0;
    const newCount = eventCount || 0;

    if (oldCount > 0 && newCount === 0) {
      console.log('   ⚠️  OLD SYSTEM ONLY - New system not receiving data');
      console.log('   💡 Action: Log a new workout to verify bridge function works');
    } else if (newCount > 0 && oldCount > 0) {
      console.log('   ✅ BOTH SYSTEMS ACTIVE - Integration working!');
      console.log(`   📊 Old system: ${oldCount} sessions | New system: ${newCount} events`);
    } else if (newCount > 0 && oldCount === 0) {
      console.log('   ✅ NEW SYSTEM ONLY - Using new recovery system');
    } else {
      console.log('   ⚠️  NO DATA - Log a workout to test the system');
    }

    console.log('\n' + '='.repeat(60));
    console.log('\n✅ Verification complete!\n');

    if (newCount === 0) {
      console.log('📝 Next step: Log a workout at http://localhost:3000/start');
      console.log('   Then run this script again to verify integration\n');
    } else {
      console.log('📝 Next step: Visit http://localhost:3000/recovery to see dashboard\n');
    }

  } catch (error) {
    console.error('\n❌ Verification failed:', error);
    process.exit(1);
  }
}

verify();
