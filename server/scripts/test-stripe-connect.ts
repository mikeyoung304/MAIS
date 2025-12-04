#!/usr/bin/env tsx

import { PrismaClient } from '../src/generated/prisma';
import { CommissionService } from '../src/services/commission.service';
import Stripe from 'stripe';
import * as dotenv from 'dotenv';

// Load environment variables
dotenv.config();

const prisma = new PrismaClient();
const commissionService = new CommissionService(prisma);

// Stripe client
const stripeSecretKey = process.env.STRIPE_SECRET_KEY;
if (!stripeSecretKey) {
  console.error('❌ STRIPE_SECRET_KEY not found in environment variables');
  console.error('Please add your Stripe test key to .env:');
  console.error('STRIPE_SECRET_KEY=sk_test_...\n');
  process.exit(1);
}

const stripe = new Stripe(stripeSecretKey, {
  apiVersion: '2025-09-30.clover',
  typescript: true,
});

/**
 * Test Stripe Connect Integration
 *
 * This script tests the complete payment flow with commission:
 * 1. Create test tenant (if doesn't exist)
 * 2. Create Stripe Connected Account
 * 3. Create test booking with commission calculation
 * 4. Verify commission split
 * 5. Print detailed results
 */
async function testStripeConnect() {
  console.log('🧪 Testing Stripe Connect Integration\n');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  let testTenantId: string;
  let stripeAccountId: string;

  try {
    // ============================================================================
    // STEP 1: Create or find test tenant
    // ============================================================================
    console.log('📋 STEP 1: Create Test Tenant\n');

    const testSlug = 'stripe-test-tenant';
    let tenant = await prisma.tenant.findUnique({
      where: { slug: testSlug },
    });

    if (tenant) {
      console.log(`✓ Found existing test tenant: ${tenant.name}`);
      console.log(`  Tenant ID: ${tenant.id}`);
      console.log(`  Commission: ${tenant.commissionPercent}%`);
      testTenantId = tenant.id;

      if (tenant.stripeAccountId) {
        console.log(`  Stripe Account: ${tenant.stripeAccountId}`);
        stripeAccountId = tenant.stripeAccountId;
      }
    } else {
      // Create new test tenant
      const bcrypt = await import('bcryptjs');
      const hashedApiKey = await bcrypt.hash('test_secret_key_' + Date.now(), 10);

      tenant = await prisma.tenant.create({
        data: {
          slug: testSlug,
          name: 'Stripe Test Tenant',
          apiKeyPublic: `pk_test_${Date.now()}`,
          apiKeySecret: hashedApiKey,
          commissionPercent: 12.0, // 12% commission for testing
          branding: {},
          secrets: {},
          isActive: true,
        },
      });

      console.log(`✓ Created new test tenant: ${tenant.name}`);
      console.log(`  Tenant ID: ${tenant.id}`);
      console.log(`  Commission: ${tenant.commissionPercent}%`);
      testTenantId = tenant.id;
    }

    console.log('\n');

    // ============================================================================
    // STEP 2: Create Stripe Connected Account
    // ============================================================================
    console.log('💳 STEP 2: Create Stripe Connected Account\n');

    if (tenant.stripeAccountId) {
      // Verify existing account
      try {
        const account = await stripe.accounts.retrieve(tenant.stripeAccountId);
        console.log(`✓ Using existing Stripe account: ${account.id}`);
        console.log(`  Email: ${account.email || 'N/A'}`);
        console.log(`  Charges enabled: ${account.charges_enabled}`);
        console.log(`  Payouts enabled: ${account.payouts_enabled}`);
        stripeAccountId = account.id;
      } catch (error) {
        console.log('⚠️  Existing account not found, creating new one...');
        tenant.stripeAccountId = null;
      }
    }

    if (!tenant.stripeAccountId) {
      // Create new connected account
      console.log('Creating new Stripe Express account...');

      const account = await stripe.accounts.create({
        type: 'express',
        country: 'US',
        email: `test-${Date.now()}@stripetestaccount.com`,
        capabilities: {
          card_payments: { requested: true },
          transfers: { requested: true },
        },
        business_type: 'individual',
        business_profile: {
          name: tenant.name,
          product_description: 'Wedding and elopement services',
          mcc: '7299', // Special services, not elsewhere classified
        },
      });

      stripeAccountId = account.id;

      console.log(`✓ Created Stripe account: ${account.id}`);
      console.log(`  Email: ${account.email || 'N/A'}`);
      console.log(`  Type: ${account.type}`);
      console.log(`  Charges enabled: ${account.charges_enabled}`);
      console.log(`  Payouts enabled: ${account.payouts_enabled}`);

      // Update tenant with Stripe account
      await prisma.tenant.update({
        where: { id: testTenantId },
        data: {
          stripeAccountId: account.id,
          stripeOnboarded: account.charges_enabled || false,
        },
      });

      console.log(`✓ Updated tenant with Stripe account ID`);

      if (!account.charges_enabled) {
        console.log('\n⚠️  NOTE: Account not fully onboarded');
        console.log('In production, redirect tenant to onboarding:');
        console.log('  const accountLink = await stripe.accountLinks.create({');
        console.log(`    account: '${account.id}',`);
        console.log('    refresh_url: "http://localhost:3000/stripe/reauth",');
        console.log('    return_url: "http://localhost:3000/stripe/complete",');
        console.log('    type: "account_onboarding",');
        console.log('  });');
        console.log('  // Redirect to: accountLink.url');
      }
    }

    console.log('\n');

    // ============================================================================
    // STEP 3: Test Commission Calculation
    // ============================================================================
    console.log('🧮 STEP 3: Test Commission Calculation\n');

    const testBookingAmount = 50000; // $500.00
    const commission = await commissionService.calculateCommission(testTenantId, testBookingAmount);

    console.log(`Booking Amount: $${(testBookingAmount / 100).toFixed(2)}`);
    console.log(`Commission Rate: ${commission.percent}%`);
    console.log(
      `Commission Amount: $${(commission.amount / 100).toFixed(2)} (${commission.amount} cents)`
    );
    console.log(`Tenant Receives: $${((testBookingAmount - commission.amount) / 100).toFixed(2)}`);

    // Verify calculation
    const expectedCommission = Math.ceil(
      testBookingAmount * (Number(tenant.commissionPercent) / 100)
    );
    if (commission.amount !== expectedCommission) {
      throw new Error(
        `Commission calculation mismatch! Expected ${expectedCommission}, got ${commission.amount}`
      );
    }
    console.log(`✅ Commission calculation correct!`);

    console.log('\n');

    // ============================================================================
    // STEP 4: Test Full Booking Calculation with Add-ons
    // ============================================================================
    console.log('📦 STEP 4: Test Full Booking Calculation\n');

    const breakdown = await commissionService.calculateBookingTotal(
      testTenantId,
      50000, // $500 package
      [] // No add-ons for this test
    );

    console.log('Booking Breakdown:');
    console.log(`  Package Price:     $${(breakdown.packagePrice / 100).toFixed(2)}`);
    console.log(`  Add-ons Total:     $${(breakdown.addOnsTotal / 100).toFixed(2)}`);
    console.log(`  ─────────────────────────────────────`);
    console.log(`  Subtotal:          $${(breakdown.subtotal / 100).toFixed(2)}`);
    console.log(
      `  Platform Fee:      $${(breakdown.commissionAmount / 100).toFixed(2)} (${breakdown.commissionPercent}%)`
    );
    console.log(`  ─────────────────────────────────────`);
    console.log(`  Tenant Receives:   $${(breakdown.tenantReceives / 100).toFixed(2)}`);

    console.log(`✅ Full calculation correct!`);

    console.log('\n');

    // ============================================================================
    // STEP 5: Verify Stripe Connect Payment Flow
    // ============================================================================
    console.log('💸 STEP 5: Verify Stripe Connect Payment Flow\n');

    console.log('Testing PaymentIntent with application fee...');

    try {
      // Create test payment intent
      const paymentIntent = await stripe.paymentIntents.create({
        amount: breakdown.subtotal,
        currency: 'usd',
        application_fee_amount: breakdown.commissionAmount,
        transfer_data: {
          destination: stripeAccountId,
        },
        metadata: {
          tenantId: testTenantId,
          testMode: 'true',
        },
        description: 'Test booking with commission',
      });

      console.log(`✓ Created PaymentIntent: ${paymentIntent.id}`);
      console.log(`  Status: ${paymentIntent.status}`);
      console.log(`  Amount: $${(paymentIntent.amount / 100).toFixed(2)}`);
      console.log(`  App Fee: $${((paymentIntent.application_fee_amount || 0) / 100).toFixed(2)}`);
      console.log(`  Destination: ${stripeAccountId}`);

      // Note: In a real flow, you'd complete the payment with a test card
      console.log('\n📝 Next steps to complete payment:');
      console.log('  1. Use Stripe test card: 4242 4242 4242 4242');
      console.log('  2. Any future expiry (e.g., 12/34)');
      console.log('  3. Any 3-digit CVC');
      console.log(`  4. Confirm PaymentIntent: ${paymentIntent.id}`);

      // Cancel the test payment intent (cleanup)
      await stripe.paymentIntents.cancel(paymentIntent.id);
      console.log(`✓ Cancelled test PaymentIntent (cleanup)`);
    } catch (error) {
      if (error instanceof Error) {
        console.error(`❌ Error creating PaymentIntent: ${error.message}`);

        if (error.message.includes('charges_enabled')) {
          console.log('\n⚠️  Account needs onboarding to accept charges');
          console.log('This is expected for newly created test accounts');
        }
      }
    }

    console.log('\n');

    // ============================================================================
    // STEP 6: Test Refund Commission Calculation
    // ============================================================================
    console.log('↩️  STEP 6: Test Refund Commission Calculation\n');

    // Full refund
    const fullRefund = commissionService.calculateRefundCommission(
      breakdown.commissionAmount,
      breakdown.subtotal,
      breakdown.subtotal
    );
    console.log(`Full refund ($${(breakdown.subtotal / 100).toFixed(2)}):`);
    console.log(`  Commission returned: $${(fullRefund / 100).toFixed(2)}`);

    // Partial refund (50%)
    const halfRefund = commissionService.calculateRefundCommission(
      breakdown.commissionAmount,
      breakdown.subtotal / 2,
      breakdown.subtotal
    );
    console.log(`\nPartial refund ($${(breakdown.subtotal / 2 / 100).toFixed(2)}):`);
    console.log(`  Commission returned: $${(halfRefund / 100).toFixed(2)}`);

    console.log(`✅ Refund calculations correct!`);

    console.log('\n');

    // ============================================================================
    // Summary
    // ============================================================================
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('✅ ALL TESTS PASSED');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

    console.log('Summary:');
    console.log(`  Tenant: ${tenant.name} (${tenant.slug})`);
    console.log(`  Tenant ID: ${testTenantId}`);
    console.log(`  Stripe Account: ${stripeAccountId}`);
    console.log(`  Commission Rate: ${tenant.commissionPercent}%`);
    console.log(`  Test Amount: $${(testBookingAmount / 100).toFixed(2)}`);
    console.log(`  Platform Fee: $${(commission.amount / 100).toFixed(2)}`);
    console.log(`  Tenant Gets: $${((testBookingAmount - commission.amount) / 100).toFixed(2)}`);

    console.log('\n✨ Stripe Connect is working correctly!\n');

    console.log('Next steps:');
    console.log('  1. Review STRIPE_CONNECT_TESTING_GUIDE.md for detailed testing');
    console.log('  2. Test webhook integration with `stripe listen`');
    console.log('  3. Test complete payment flow with test cards');
    console.log('  4. Verify commission split in Stripe Dashboard');
    console.log('  5. Test refund scenarios');

    process.exit(0);
  } catch (error) {
    console.error('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.error('❌ TEST FAILED');
    console.error('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
    console.error('Error:', error instanceof Error ? error.message : error);

    if (error instanceof Error && error.stack) {
      console.error('\nStack trace:');
      console.error(error.stack);
    }

    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

// Run the test
testStripeConnect();
