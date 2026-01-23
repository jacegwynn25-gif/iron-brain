#!/usr/bin/env node

const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(supabaseUrl, serviceRoleKey);

async function fetchCompleteSchema() {
  console.log('🔍 Querying database for complete schema...\n');

  // Query information_schema to get all tables
  const { data: tables, error: tablesError } = await supabase
    .from('information_schema.tables')
    .select('table_name')
    .eq('table_schema', 'public')
    .neq('table_type', 'VIEW');

  if (tablesError) {
    console.error('Error fetching tables:', tablesError);
    return;
  }

  console.log('Tables found:', tables?.map(t => t.table_name));

  // Query information_schema to get all functions
  const { data: functions, error: funcsError } = await supabase.rpc('show_limit');

  console.log('\\nAttempting to list RPC functions...');
  console.log('Result:', functions, funcsError);
}

fetchCompleteSchema();
