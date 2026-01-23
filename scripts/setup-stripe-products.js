#!/usr/bin/env node

/**
 * Automated Stripe Product Setup
 *
 * This script uses the Stripe API to:
 * 1. Create Iron Pro Lifetime product ($149 one-time)
 * 2. Create Iron Pro Monthly product ($12.99/month)
 * 3. Create webhook endpoint for local development
 * 4. Update .env.local with the new IDs
 */

const Stripe = require('stripe');
const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env.local') });

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

async function setupStripeProducts() {
  console.log('🚀 Setting up Stripe products and webhooks...\n');

  try {
    // 1. Create Lifetime Product
    console.log('📦 Creating Iron Pro Lifetime product...');
    const lifetimeProduct = await stripe.products.create({
      name: 'Iron Pro Lifetime',
      description: 'Lifetime access to Iron Brain Pro features - never pay again',
      metadata: {
        tier: 'pro_lifetime'
      }
    });
    console.log(`✅ Created product: ${lifetimeProduct.id}`);

    const lifetimePrice = await stripe.prices.create({
      product: lifetimeProduct.id,
      unit_amount: 14900, // $149.00
      currency: 'usd',
      nickname: 'Founding Member Lifetime Access'
    });
    console.log(`✅ Created price: ${lifetimePrice.id}\n`);

    // 2. Create Monthly Product
    console.log('📦 Creating Iron Pro Monthly product...');
    const monthlyProduct = await stripe.products.create({
      name: 'Iron Pro Monthly',
      description: 'Monthly subscription to Iron Brain Pro features',
      metadata: {
        tier: 'pro_monthly'
      }
    });
    console.log(`✅ Created product: ${monthlyProduct.id}`);

    const monthlyPrice = await stripe.prices.create({
      product: monthlyProduct.id,
      unit_amount: 1299, // $12.99
      currency: 'usd',
      recurring: {
        interval: 'month'
      },
      nickname: 'Iron Pro Monthly Subscription'
    });
    console.log(`✅ Created price: ${monthlyPrice.id}\n`);

    // 3. Create Webhook Endpoint (for local development with ngrok)
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
          'customer.subscription.deleted',
          'customer.subscription.updated'
        ],
        description: 'Iron Brain Pro webhook endpoint'
      });
      console.log(`✅ Created webhook: ${webhookEndpoint.id}`);
      console.log(`📝 Webhook secret: ${webhookEndpoint.secret}\n`);
    } catch (webhookError) {
      console.log(`⚠️  Could not create webhook (likely URL issue): ${webhookError.message}`);
      console.log('   You can create this manually in the Stripe Dashboard later.\n');
    }

    // 4. Update .env.local
    console.log('📝 Updating .env.local...');
    const envPath = path.join(__dirname, '..', '.env.local');
    let envContent = fs.readFileSync(envPath, 'utf8');

    // Replace placeholder values
    envContent = envContent.replace(
      /STRIPE_PRICE_ID_LIFETIME=.*/,
      `STRIPE_PRICE_ID_LIFETIME=${lifetimePrice.id}`
    );
    envContent = envContent.replace(
      /STRIPE_PRICE_ID_MONTHLY=.*/,
      `STRIPE_PRICE_ID_MONTHLY=${monthlyPrice.id}`
    );

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
    console.log('🎉 Stripe setup complete!\n');
    console.log('Products Created:');
    console.log(`  • Iron Pro Lifetime: $149 (${lifetimePrice.id})`);
    console.log(`  • Iron Pro Monthly: $12.99/mo (${monthlyPrice.id})`);

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
    console.log('  2. Test payment flow with card: 4242 4242 4242 4242');
    console.log('  3. Check Stripe Dashboard: https://dashboard.stripe.com/test/payments');
    console.log('═══════════════════════════════════════════════════════\n');

  } catch (error) {
    console.error('❌ Error setting up Stripe:', error.message);
    console.error('\nFull error:', error);
    process.exit(1);
  }
}

setupStripeProducts();
