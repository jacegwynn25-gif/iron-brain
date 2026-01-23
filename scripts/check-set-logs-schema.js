#!/usr/bin/env node

/**
 * Check the schema of set_logs table to find INTEGER columns that should be NUMERIC
 */

require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceKey) {
  console.error('❌ Missing Supabase credentials');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, serviceKey);

async function checkSchema() {
  console.log('\n🔍 Checking set_logs table schema...\n');

  try {
    // Query PostgreSQL system catalogs to get column types
    const { data, error } = await supabase.rpc('exec_sql', {
      sql: `
        SELECT
          column_name,
          data_type,
          numeric_precision,
          numeric_scale
        FROM information_schema.columns
        WHERE table_schema = 'public'
        AND table_name = 'set_logs'
        AND column_name IN (
          'prescribed_reps', 'prescribed_rpe', 'prescribed_rir',
          'actual_reps', 'actual_rpe', 'actual_rir',
          'rest_seconds', 'actual_seconds', 'volume_load',
          'set_index', 'order_index'
        )
        ORDER BY column_name;
      `
    });

    if (error) {
      console.log('⚠️ exec_sql not available, trying direct query...\n');

      // Fallback: Just try to describe the table
      const { data: tableData, error: tableError } = await supabase
        .from('set_logs')
        .select('*')
        .limit(1);

      if (tableError) {
        console.error('❌ Cannot query table:', tableError.message);
      } else {
        console.log('Sample row to infer types:');
        console.log(JSON.stringify(tableData, null, 2));
      }
    } else {
      console.log('📊 Column Types:\n');

      const problems = [];

      (data || []).forEach(col => {
        const type = col.data_type;
        const name = col.column_name;

        // Check for problematic INTEGER types
        const shouldBeNumeric = ['prescribed_rpe', 'prescribed_rir', 'actual_rpe', 'actual_rir'];
        const shouldBeInteger = ['prescribed_reps', 'actual_reps', 'rest_seconds', 'actual_seconds', 'volume_load', 'set_index', 'order_index'];

        let status = '✅';
        let note = '';

        if (shouldBeNumeric.includes(name) && type === 'integer') {
          status = '❌';
          note = ' (PROBLEM: Should be NUMERIC for decimals)';
          problems.push({
            column: name,
            currentType: type,
            suggestedType: 'NUMERIC(4,2)'
          });
        } else if (shouldBeInteger.includes(name) && type !== 'integer') {
          status = '⚠️';
          note = ` (Expected INTEGER, got ${type})`;
        }

        console.log(`${status} ${name.padEnd(20)} : ${type}${note}`);
      });

      if (problems.length > 0) {
        console.log('\n🔧 FIXES NEEDED:\n');

        problems.forEach(p => {
          console.log(`ALTER TABLE set_logs ALTER COLUMN ${p.column} TYPE ${p.suggestedType};`);
        });

        console.log('\n📝 Run these SQL commands in Supabase Studio to fix the schema.');
      } else {
        console.log('\n✅ Schema looks correct!');
        console.log('The issue might be elsewhere...');
      }
    }

  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

checkSchema();
