#!/usr/bin/env node

const { createClient } = require('@supabase/supabase-js');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(supabaseUrl, serviceRoleKey);

async function checkSubscriptionTables() {
  console.log('🔍 Checking if subscription system is set up...\\n');

  try {
    // Check app_settings table
    const { data: settings, error: settingsError } = await supabase
      .from('app_settings')
      .select('*')
      .eq('id', 'singleton')
      .single();

    if (settingsError) {
      console.log('❌ app_settings table not found or migration not applied');
      console.log('   Run migration: 003_subscription_system.sql\\n');
      console.log('Error:', settingsError.message);
      return false;
    }

    console.log('✅ app_settings table exists');
    console.log(`   Lifetime slots: ${settings.lifetime_slots_remaining}/${settings.lifetime_slots_total}\\n`);

    // Check subscription_events table
    const { error: eventsError } = await supabase
      .from('subscription_events')
      .select('count')
      .limit(1);

    if (eventsError) {
      console.log('❌ subscription_events table not found');
      console.log('Error:', eventsError.message);
      return false;
    }

    console.log('✅ subscription_events table exists\\n');

    // Check user_profiles for subscription columns
    const { data: profiles, error: profilesError } = await supabase
      .from('user_profiles')
      .select('id, is_pro, subscription_tier')
      .limit(1);

    if (profilesError) {
      console.log('❌ user_profiles missing subscription columns');
      console.log('Error:', profilesError.message);
      return false;
    }

    console.log('✅ user_profiles has subscription columns\\n');

    console.log('🎉 Subscription system is fully set up!\\n');
    return true;
  } catch (error) {
    console.error('Unexpected error:', error);
    return false;
  }
}

checkSubscriptionTables();
