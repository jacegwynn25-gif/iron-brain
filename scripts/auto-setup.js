#!/usr/bin/env node

/**
 * Automated Setup Script
 * Checks migration status and runs post-migration steps automatically
 */

const { createClient } = require('@supabase/supabase-js');
const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const projectRef = 'nwqqasofqwoinzrcjivo';

const supabase = createClient(supabaseUrl, serviceRoleKey);

async function checkMigrationStatus() {
  console.log('🔍 Checking if migration 016 has been applied...\n');

  try {
    // Try to query one of the new tables
    const { data, error } = await supabase
      .from('fatigue_events')
      .select('id')
      .limit(1);

    if (error) {
      if (error.code === '42P01') {
        // Table doesn't exist
        return false;
      }
      throw error;
    }

    return true;
  } catch (error) {
    return false;
  }
}

async function runPostMigrationSteps() {
  console.log('✅ Migration detected! Running post-migration steps...\n');

  // Step 1: Regenerate database types
  console.log('📝 Step 1: Regenerating TypeScript types...');
  try {
    execSync(
      `npx supabase gen types typescript --project-id ${projectRef} > app/lib/supabase/types.ts`,
      { stdio: 'inherit' }
    );
    console.log('✅ Types regenerated successfully\n');
  } catch (error) {
    console.error('❌ Failed to regenerate types:', error.message);
    console.log('   You may need to run: npx supabase login first\n');
    return false;
  }

  // Step 2: Remove type assertions
  console.log('🧹 Step 2: Removing type assertions...');
  try {
    execSync('chmod +x scripts/remove-type-assertions.sh', { stdio: 'inherit' });
    execSync('./scripts/remove-type-assertions.sh', { stdio: 'inherit' });
    console.log('✅ Type assertions removed\n');
  } catch (error) {
    console.error('⚠️  Type assertion removal had issues (may be okay):', error.message);
  }

  // Step 3: Verify build
  console.log('🔨 Step 3: Verifying build...');
  try {
    execSync('npm run build', { stdio: 'inherit' });
    console.log('✅ Build successful!\n');
  } catch (error) {
    console.error('❌ Build failed - there may be type errors to fix');
    return false;
  }

  console.log('🎉 POST-MIGRATION SETUP COMPLETE!\n');
  console.log('Next steps:');
  console.log('1. Seed test data (see TEST-DATA-SEEDING.md)');
  console.log('2. Run dev server: npm run dev');
  console.log('3. Test recovery assessment in browser\n');

  return true;
}

async function main() {
  console.log('🚀 Iron Brain - Automated Setup\n');
  console.log('='.repeat(50) + '\n');

  const migrationApplied = await checkMigrationStatus();

  if (!migrationApplied) {
    console.log('⚠️  Migration 016 has NOT been applied yet.\n');
    console.log('📋 REQUIRED: Run migration via Supabase Dashboard:\n');
    console.log(`1. Go to: https://supabase.com/dashboard/project/${projectRef}/sql/new`);
    console.log('2. Copy contents of: supabase/migrations/019_recovery_system.sql');
    console.log('3. Paste and click "Run"\n');
    console.log('✅ The migration file has been FIXED (timestamp error resolved)');
    console.log('   It should run successfully now!\n');
    console.log('After migration succeeds, run this script again:');
    console.log('   node scripts/auto-setup.js\n');
    process.exit(0);
  }

  const success = await runPostMigrationSteps();
  process.exit(success ? 0 : 1);
}

main();
