/**
 * Supabase Setup Verification Script
 * Run this to check if your Supabase connection is working
 */

import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';
import { join } from 'path';

// Load .env.local file
const envPath = join(process.cwd(), '.env.local');
const envFile = readFileSync(envPath, 'utf-8');
const envVars: Record<string, string> = {};

envFile.split('\n').forEach(line => {
  const match = line.match(/^([^#=]+)=(.*)$/);
  if (match) {
    const key = match[1].trim();
    const value = match[2].trim();
    envVars[key] = value;
  }
});

const supabaseUrl = envVars.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = envVars.NEXT_PUBLIC_SUPABASE_ANON_KEY;

console.log('\n🔍 Verifying Supabase Setup...\n');

// Check 1: Environment variables
console.log('✓ Checking environment variables...');
if (!supabaseUrl) {
  console.error('❌ NEXT_PUBLIC_SUPABASE_URL is missing!');
  process.exit(1);
}
if (!supabaseKey) {
  console.error('❌ NEXT_PUBLIC_SUPABASE_ANON_KEY is missing!');
  process.exit(1);
}

// Check 2: Key format
console.log('✓ Checking key format...');
if (!supabaseKey.startsWith('eyJ')) {
  console.error('❌ Your ANON_KEY doesn\'t look right!');
  console.error('   It should start with "eyJ..." (JWT token)');
  console.error('   Current value starts with:', supabaseKey.substring(0, 20));
  process.exit(1);
}

// Check 3: Connection
console.log('✓ Testing connection...');
const supabase = createClient(supabaseUrl, supabaseKey);

(async () => {
  try {
    // Try to fetch exercises (should work even without auth)
    const { data, error } = await supabase
      .from('exercises')
      .select('id, name')
      .limit(1);

    if (error) {
      console.error('❌ Database connection failed!');
      console.error('   Error:', error.message);
      console.error('\n💡 Did you run the migrations?');
      process.exit(1);
    }

    console.log('✓ Database connection successful!');

    if (data && data.length > 0) {
      console.log('✓ Found exercises in database:', data[0].name);
    } else {
      console.warn('⚠️  No exercises found. Did you run migration 003?');
    }

    console.log('\n🎉 Everything looks good! Your Supabase setup is complete.\n');
  } catch (err) {
    console.error('❌ Unexpected error:', err);
    process.exit(1);
  }
})();
