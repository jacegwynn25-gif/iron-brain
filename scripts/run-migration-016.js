#!/usr/bin/env node

/**
 * Run migration 016 (recovery system) on Supabase
 */

require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Missing Supabase credentials');
  console.error('   NEXT_PUBLIC_SUPABASE_URL:', !!supabaseUrl);
  console.error('   SUPABASE_SERVICE_ROLE_KEY:', !!supabaseServiceKey);
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function runMigration() {
  console.log('\n📦 Running Migration 016: Recovery System\n');
  console.log('='.repeat(60));

  // Read migration file
  const migrationPath = path.join(__dirname, '../supabase/migrations/016_recovery_system.sql');

  if (!fs.existsSync(migrationPath)) {
    console.error(`❌ Migration file not found: ${migrationPath}`);
    process.exit(1);
  }

  const migrationSQL = fs.readFileSync(migrationPath, 'utf8');

  console.log(`\n✅ Loaded migration file (${migrationSQL.length} bytes)`);
  console.log('\n📝 Executing SQL...\n');

  try {
    // Execute the migration SQL
    const { data, error } = await supabase.rpc('exec_sql', { sql: migrationSQL });

    if (error) {
      // If exec_sql doesn't exist, try direct execution (this will likely fail but gives better error)
      console.error('❌ Migration failed:', error.message);
      console.error('\n⚠️  Note: You may need to run this migration via Supabase Studio SQL Editor');
      console.error('   URL: https://supabase.com/dashboard/project/YOUR_PROJECT/sql');
      console.error('\n   Copy the SQL from: supabase/migrations/016_recovery_system.sql');
      process.exit(1);
    }

    console.log('✅ Migration completed successfully!\n');

    // Verify tables were created
    console.log('🔍 Verifying tables...\n');

    const tables = ['fatigue_events', 'recovery_snapshots'];

    for (const table of tables) {
      const { count, error: countError } = await supabase
        .from(table)
        .select('*', { count: 'exact', head: true });

      if (countError) {
        console.log(`   ❌ ${table}: ${countError.message}`);
      } else {
        console.log(`   ✅ ${table}: table exists (${count || 0} rows)`);
      }
    }

    console.log('\n' + '='.repeat(60));
    console.log('\n✨ Migration 016 complete!\n');
    console.log('Next steps:');
    console.log('1. Test workout logging at http://localhost:3000/start');
    console.log('2. Verify recovery dashboard at http://localhost:3000/recovery\n');

  } catch (error) {
    console.error('\n❌ Unexpected error:', error);
    process.exit(1);
  }
}

runMigration();
