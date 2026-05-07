#!/usr/bin/env node

/**
 * Automated Stripe Support Setup
 *
 * This script uses the Stripe API to:
 * 1. Create a webhook endpoint for local development
 * 2. Update .env.local with the webhook secret
 *
 * Support checkout uses dynamic one-time Checkout line items, so no fixed Price
 * objects are required.
 */

const Stripe = require('stripe');
const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env.local') });

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

async function setupStripeProducts() {
  console.log('🚀 Setting up Stripe support webhook...\n');

  try {
    console.log('🔗 Creating webhook endpoint...');
    console.log('⚠️  NOTE: You need to run ngrok first: ngrok http 3000');
    console.log('    Then update the URL below and re-run this script.\n');

    const webhookUrl = process.env.WEBHOOK_URL || 'https://example.ngrok.io/api/webhooks/stripe';

    let webhookEndpoint;
    try {
      webhookEndpoint = await stripe.webhookEndpoints.create({
        url: webhookUrl,
        enabled_events: [
          'checkout.session.completed',
        ],
        description: 'Iron Brain support webhook endpoint'
      });
      console.log(`✅ Created webhook: ${webhookEndpoint.id}`);
      console.log(`📝 Webhook secret: ${webhookEndpoint.secret}\n`);
    } catch (webhookError) {
      console.log(`⚠️  Could not create webhook (likely URL issue): ${webhookError.message}`);
      console.log('   You can create this manually in the Stripe Dashboard later.\n');
    }

    console.log('📝 Updating .env.local...');
    const envPath = path.join(__dirname, '..', '.env.local');
    let envContent = fs.readFileSync(envPath, 'utf8');

    if (webhookEndpoint) {
      envContent = envContent.replace(
        /STRIPE_WEBHOOK_SECRET=.*/,
        `STRIPE_WEBHOOK_SECRET=${webhookEndpoint.secret}`
      );
    }

    fs.writeFileSync(envPath, envContent);
    console.log('✅ Updated .env.local\n');

    // 5. Summary
    console.log('═══════════════════════════════════════════════════════');
    console.log('🎉 Stripe support setup complete!\n');
    console.log('Support checkout creates dynamic one-time Checkout line items.');

    if (webhookEndpoint) {
      console.log(`\nWebhook Endpoint:`);
      console.log(`  • URL: ${webhookUrl}`);
      console.log(`  • Secret: ${webhookEndpoint.secret}`);
    } else {
      console.log(`\n⚠️  Webhook setup incomplete:`);
      console.log(`  1. Start ngrok: ngrok http 3000`);
      console.log(`  2. Set WEBHOOK_URL env var to your ngrok URL`);
      console.log(`  3. Re-run this script OR create webhook manually in dashboard`);
    }

    console.log('\nNext Steps:');
    console.log('  1. Restart your dev server: npm run dev');
    console.log('  2. Test support flow with card: 4242 4242 4242 4242');
    console.log('  3. Check Stripe Dashboard: https://dashboard.stripe.com/test/payments');
    console.log('═══════════════════════════════════════════════════════\n');

  } catch (error) {
    console.error('❌ Error setting up Stripe:', error.message);
    console.error('\nFull error:', error);
    process.exit(1);
  }
}

setupStripeProducts();
