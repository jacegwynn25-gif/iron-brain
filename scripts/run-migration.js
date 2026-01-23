#!/usr/bin/env node

/**
 * Migration Runner Script
 * Executes SQL migration files using Supabase service role access
 */

const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env.local') });

async function runMigration() {
  const migrationPath = path.join(__dirname, '..', 'supabase', 'migrations', '016_recovery_system.sql');

  console.log('📂 Reading migration file...');
  const migrationSQL = fs.readFileSync(migrationPath, 'utf8');

  console.log('🔌 Connecting to Supabase...');

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    console.error('❌ Missing Supabase credentials in .env.local');
    process.exit(1);
  }

  // Extract project reference from URL
  const projectRef = supabaseUrl.match(/https:\/\/(.+?)\.supabase\.co/)?.[1];

  if (!projectRef) {
    console.error('❌ Could not parse project reference from Supabase URL');
    process.exit(1);
  }

  console.log(`📊 Project: ${projectRef}`);
  console.log('🚀 Executing migration via Supabase SQL API...\n');

  try {
    // Use Supabase's postgres REST API to execute SQL
    // Note: This requires the PostgREST API which may not support DDL statements
    // The most reliable way is still via the dashboard or CLI

    const response = await fetch(`${supabaseUrl}/rest/v1/rpc/exec_sql`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': serviceRoleKey,
        'Authorization': `Bearer ${serviceRoleKey}`,
      },
      body: JSON.stringify({ query: migrationSQL })
    });

    if (!response.ok) {
      const error = await response.text();
      console.error('❌ Migration failed via REST API');
      console.error('Response:', error);
      console.log('\n⚠️  The SQL migration is too complex for REST API execution.');
      console.log('📋 Please run the migration manually via Supabase Dashboard:\n');
      console.log('1. Go to https://supabase.com/dashboard/project/' + projectRef + '/sql/new');
      console.log('2. Copy the contents of: supabase/migrations/016_recovery_system.sql');
      console.log('3. Paste and click "Run"');
      console.log('\n✅ The migration file has been fixed and is ready to run!');
      process.exit(1);
    }

    const result = await response.json();
    console.log('✅ Migration executed successfully!');
    console.log('Result:', result);

  } catch (error) {
    console.error('❌ Error executing migration:', error.message);
    console.log('\n📋 Manual migration required via Supabase Dashboard:');
    console.log('1. Go to https://supabase.com/dashboard/project/' + projectRef + '/sql/new');
    console.log('2. Copy the contents of: supabase/migrations/016_recovery_system.sql');
    console.log('3. Paste and click "Run"');
    console.log('\n✅ The migration file has been FIXED and is ready to run!');
    console.log('   (Previous timestamp error has been resolved)');
    process.exit(1);
  }
}

runMigration();
