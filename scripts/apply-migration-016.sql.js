#!/usr/bin/env node

/**
 * Apply migration 016 to Supabase using direct SQL execution
 *
 * This script reads the migration file and provides instructions
 * for applying it via Supabase Studio SQL Editor
 */

const fs = require('fs');
const path = require('path');

const migrationPath = path.join(__dirname, '../supabase/migrations/016_recovery_system.sql');

if (!fs.existsSync(migrationPath)) {
  console.error(`❌ Migration file not found: ${migrationPath}`);
  process.exit(1);
}

const migrationSQL = fs.readFileSync(migrationPath, 'utf8');

console.log('\n📦 Migration 016: Recovery System\n');
console.log('='.repeat(70));
console.log('\n⚠️  This migration must be run via Supabase Studio SQL Editor\n');
console.log('Steps:');
console.log('1. Go to: https://supabase.com/dashboard/project/YOUR_PROJECT_ID/sql/new');
console.log('2. Copy the SQL below');
console.log('3. Paste into the SQL editor');
console.log('4. Click "Run" to execute\n');
console.log('='.repeat(70));
console.log('\n📋 COPY THIS SQL:\n');
console.log(migrationSQL);
console.log('\n' + '='.repeat(70));
console.log('\nAfter running the migration, the following tables will be created:');
console.log('- fatigue_events');
console.log('- recovery_snapshots\n');
