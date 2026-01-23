#!/usr/bin/env node

require('dotenv').config({ path: '.env.local' });

console.log('🔍 Diagnosing Supabase connectivity...\n');

// Check environment variables
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

console.log('1. Environment Variables:');
console.log('   URL:', url || '❌ Missing');
console.log('   Anon Key:', anonKey ? '✅ Set (' + anonKey.substring(0, 20) + '...)' : '❌ Missing');
console.log('   Service Key:', serviceKey ? '✅ Set' : '❌ Missing');

if (!url || !anonKey) {
  console.log('\n❌ Missing Supabase credentials!');
  process.exit(1);
}

// Test 1: Can we reach Supabase at all?
console.log('\n2. Testing Network Connectivity to:', url);
const https = require('https');
const urlObj = new URL(url);

const req = https.get({
  hostname: urlObj.hostname,
  path: '/rest/v1/',
  headers: {
    'apikey': anonKey,
    'Authorization': 'Bearer ' + anonKey
  },
  timeout: 5000
}, (res) => {
  console.log('   HTTP Status:', res.statusCode);
  if (res.statusCode === 200 || res.statusCode === 404) {
    console.log('   ✅ Can reach Supabase server\n');
    testDatabaseQuery();
  } else {
    console.log('   ⚠️  Unexpected status code');
  }
});

req.on('error', (e) => {
  console.log('   ❌ Network error:', e.message);
  console.log('\n   Possible causes:');
  console.log('   - Firewall blocking Supabase');
  console.log('   - VPN interfering');
  console.log('   - ISP blocking the domain');
  process.exit(1);
});

req.on('timeout', () => {
  console.log('   ❌ Connection timed out');
  console.log('   Supabase server is unreachable');
  req.destroy();
  process.exit(1);
});

async function testDatabaseQuery() {
  console.log('3. Testing Database Query:');
  const { createClient } = require('@supabase/supabase-js');

  const supabase = createClient(url, serviceKey);

  console.log('   Attempting simple SELECT with 5s timeout...');

  const timeout = setTimeout(() => {
    console.log('   ❌ Query timed out after 5 seconds');
    console.log('\n   This means:');
    console.log('   - Network reaches Supabase');
    console.log('   - But database queries hang');
    console.log('   - Likely RLS or database issue');
    process.exit(1);
  }, 5000);

  try {
    const { data, error } = await supabase
      .from('workout_sessions')
      .select('count')
      .limit(1);

    clearTimeout(timeout);

    if (error) {
      console.log('   ⚠️  Query failed:', error.message);
      console.log('   Code:', error.code);
    } else {
      console.log('   ✅ Query succeeded!');
      console.log('\n✅ Supabase is working correctly!');
      console.log('   The issue is likely in the app code or RLS policies.');
    }
  } catch (err) {
    clearTimeout(timeout);
    console.log('   ❌ Exception:', err.message);
  }
}
