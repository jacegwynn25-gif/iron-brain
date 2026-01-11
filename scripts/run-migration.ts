#!/usr/bin/env tsx

/**
 * Run SQL migrations against Supabase database
 * Usage: tsx scripts/run-migration.ts <migration-filename>
 */

import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';
import { join } from 'path';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Missing Supabase credentials');
  console.error('Required: NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY (or NEXT_PUBLIC_SUPABASE_ANON_KEY)');
  process.exit(1);
}

const migrationFile = process.argv[2] || '007_seed_program_templates.sql';
const migrationPath = join(__dirname, '../supabase/migrations', migrationFile);

console.log(`🔄 Running migration: ${migrationFile}`);

// Read SQL file
let sql: string;
try {
  sql = readFileSync(migrationPath, 'utf-8');
} catch (error) {
  console.error(`❌ Could not read migration file: ${migrationPath}`);
  process.exit(1);
}

// Create Supabase client
const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    persistSession: false,
  },
});

// Run migration
async function runMigration() {
  try {
    const { data, error } = await supabase.rpc('exec_sql', { sql_string: sql });

    if (error) {
      console.error('❌ Migration failed:', error);
      process.exit(1);
    }

    console.log('✅ Migration completed successfully!');

    // Verify program templates were inserted
    const { data: templates, error: queryError } = await supabase
      .from('program_templates')
      .select('id, name, app_metadata')
      .eq('is_system', true);

    if (queryError) {
      console.warn('⚠️ Could not verify templates:', queryError.message);
    } else {
      console.log(`\n📊 Found ${templates?.length || 0} program templates:`);
      templates?.forEach((t: any) => {
        const appId = t.app_metadata?.app_program_id || 'unknown';
        console.log(`  - ${t.name} (${appId})`);
      });
    }
  } catch (error) {
    console.error('❌ Unexpected error:', error);
    process.exit(1);
  }
}

runMigration();
