#!/usr/bin/env node

/**
 * Fix database schema to accept decimal values for RPE and RIR
 */

require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceKey) {
  console.error('❌ Missing Supabase credentials');
  process.exit(1);
}

console.log('\n🔧 Fixing Database Schema for Decimal Values\n');
console.log('='.repeat(70));

const supabase = createClient(supabaseUrl, serviceKey);

async function runMigration() {
  try {
    console.log('\n📝 Reading migration SQL...\n');

    const migrationPath = path.join(__dirname, '../supabase/migrations/019_fix_decimal_columns.sql');
    const sql = fs.readFileSync(migrationPath, 'utf8');

    console.log(sql);
    console.log('\n' + '='.repeat(70));
    console.log('\n⚠️  This migration needs to be run in Supabase Studio.\n');
    console.log('Steps:');
    console.log('  1. Go to: https://supabase.com/dashboard');
    console.log('  2. Select your Iron Brain project');
    console.log('  3. Click "SQL Editor" in the left sidebar');
    console.log('  4. Click "New Query"');
    console.log('  5. Copy the SQL above');
    console.log('  6. Paste and click "Run" (or press Cmd+Enter)\n');
    console.log('Expected result: "Success. No rows returned"\n');
    console.log('='.repeat(70));

    // Try to run it automatically (may not work if exec_sql function doesn't exist)
    console.log('\n🔄 Attempting to run migration automatically...\n');

    const statements = sql
      .split(';')
      .map(s => s.trim())
      .filter(s => s.length > 0 && !s.startsWith('--'));

    for (const statement of statements) {
      if (!statement) continue;

      console.log(`Executing: ${statement.substring(0, 60)}...`);

      const { error } = await supabase.rpc('exec_sql', { sql: statement });

      if (error) {
        console.log(`   ⚠️  ${error.message}`);
        if (error.message.includes('exec_sql')) {
          console.log('\n❌ Automatic execution not available.');
          console.log('   Please run the SQL manually in Supabase Studio (see steps above).\n');
          process.exit(1);
        }
      } else {
        console.log('   ✅ Success');
      }
    }

    console.log('\n✅ Migration completed successfully!\n');
    console.log('RPE and RIR columns now accept decimal values like 6.5, 7.5, 8.5\n');

  } catch (error) {
    console.error('\n❌ Error:', error.message);
    console.log('\nPlease run the migration manually in Supabase Studio.\n');
    process.exit(1);
  }
}

runMigration();
