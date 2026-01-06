#!/usr/bin/env tsx

/**
 * CLI tool for creating new tenants with Stripe Connect setup
 *
 * Usage:
 *   pnpm create-tenant-with-stripe --slug=acme --name="ACME Weddings" [--commission=10.0] [--country=US] [--email=owner@example.com]
 *
 * Options:
 *   --slug        URL-safe tenant identifier (required)
 *   --name        Display name for tenant (required)
 *   --commission  Platform commission percentage (optional, default: 10.0)
 *   --country     Country code for Stripe account (optional, default: US)
 *   --email       Email for Stripe account (optional)
 *
 * Example:
 *   pnpm create-tenant-with-stripe --slug=bellaweddings --name="Bella Weddings" --commission=12.5 --email=owner@bellaweddings.com
 *
 * Output:
 *   - Tenant ID
 *   - API keys (public and secret)
 *   - Stripe Connect account ID
 *   - Stripe onboarding URL
 *   - Secret key shown ONCE - save immediately!
 */

import { PrismaClient } from '../src/generated/prisma/client';
import { PrismaTenantRepository } from '../src/adapters/prisma/tenant.repository';
import { apiKeyService } from '../src/lib/api-key.service';

const prisma = new PrismaClient();
const tenantRepo = new PrismaTenantRepository(prisma);

// Import StripeConnectService if available
let StripeConnectService: any;
try {
  const module = require('../src/services/stripe-connect.service');
  StripeConnectService = module.StripeConnectService;
} catch {
  console.error('❌ Error: StripeConnectService not found');
  console.error('   Please ensure stripe-connect.service.ts is created in server/src/services/');
  process.exit(1);
}

/**
 * Parse command line arguments
 */
function parseArgs(args: string[]): {
  slug?: string;
  name?: string;
  commission?: number;
  country?: string;
  email?: string;
  password?: string;
  primaryColor?: string;
  secondaryColor?: string;
  fontFamily?: string;
} {
  const result: {
    slug?: string;
    name?: string;
    commission?: number;
    country?: string;
    email?: string;
    password?: string;
    primaryColor?: string;
    secondaryColor?: string;
    fontFamily?: string;
  } = {};

  for (const arg of args) {
    if (arg.startsWith('--slug=')) {
      result.slug = arg.split('=')[1];
    } else if (arg.startsWith('--name=')) {
      result.name = arg.split('=')[1];
    } else if (arg.startsWith('--commission=')) {
      result.commission = parseFloat(arg.split('=')[1]);
    } else if (arg.startsWith('--country=')) {
      result.country = arg.split('=')[1];
    } else if (arg.startsWith('--email=')) {
      result.email = arg.split('=')[1];
    } else if (arg.startsWith('--password=')) {
      result.password = arg.split('=')[1];
    } else if (arg.startsWith('--primaryColor=')) {
      result.primaryColor = arg.split('=')[1];
    } else if (arg.startsWith('--secondaryColor=')) {
      result.secondaryColor = arg.split('=')[1];
    } else if (arg.startsWith('--fontFamily=')) {
      result.fontFamily = arg.split('=')[1];
    }
  }

  return result;
}

/**
 * Print usage instructions
 */
function printUsage() {
  console.log(`
Usage: pnpm create-tenant-with-stripe --slug=<slug> --name=<name> [OPTIONS]

Required:
  --slug        URL-safe tenant identifier
                Examples: "bellaweddings", "acme-events", "luxury-co"
                Rules: 3-50 chars, lowercase, letters/numbers/hyphens only

  --name        Display name for tenant
                Examples: "Bella Weddings", "ACME Events", "Luxury Co."

Optional:
  --commission  Platform commission percentage (default: 10.0)
                Range: 0-100

  --country     Country code for Stripe Connect account (default: US)
                Examples: "US", "CA", "GB", "AU"

  --email       Email for Stripe Connect account
                Used for Stripe account notifications

  --password    Initial admin password for tenant dashboard
                If not provided, tenant admin features won't be accessible yet

Branding Options:
  --primaryColor    Primary brand color (hex format)
                    Example: "#7C3AED"

  --secondaryColor  Secondary brand color (hex format)
                    Example: "#DDD6FE"

  --fontFamily      Font family name
                    Examples: "Inter", "Playfair Display", "Lora"

Examples:
  Basic tenant creation:
    pnpm create-tenant-with-stripe --slug=bellaweddings --name="Bella Weddings"

  With commission and email:
    pnpm create-tenant-with-stripe --slug=acme --name="ACME Events" --commission=12.5 --email=owner@acme.com

  With branding:
    pnpm create-tenant-with-stripe --slug=luxury --name="Luxury Weddings" --primaryColor="#7C3AED" --fontFamily="Playfair Display"

  Complete setup:
    pnpm create-tenant-with-stripe --slug=bella --name="Bella Weddings" --password=secure123 --email=owner@bella.com --primaryColor="#7C3AED"

Note: Secret API key and Stripe onboarding URL will be shown ONCE - save immediately!
`);
}

/**
 * Main function
 */
async function main() {
  console.log('🔧 Tenant Creation Tool with Stripe Connect\n');

  const args = process.argv.slice(2);

  // Check for help flag
  if (args.includes('--help') || args.includes('-h')) {
    printUsage();
    process.exit(0);
  }

  const {
    slug,
    name,
    commission = 10.0,
    country = 'US',
    email,
    password,
    primaryColor,
    secondaryColor,
    fontFamily,
  } = parseArgs(args);

  // Validate required arguments
  if (!slug || !name) {
    console.error('❌ Error: Missing required arguments\n');
    printUsage();
    process.exit(1);
  }

  // Validate commission
  if (isNaN(commission) || commission < 0 || commission > 100) {
    console.error('❌ Error: commission must be a number between 0 and 100\n');
    process.exit(1);
  }

  try {
    // Check if tenant already exists
    console.log(`📋 Checking if tenant "${slug}" already exists...`);
    const existing = await tenantRepo.findBySlug(slug);
    if (existing) {
      console.error(`❌ Error: Tenant with slug "${slug}" already exists`);
      console.error(`   Tenant ID: ${existing.id}`);
      console.error(`   Name: ${existing.name}`);
      process.exit(1);
    }

    console.log(`✅ Slug "${slug}" is available\n`);

    // Step 1: Generate API keys
    console.log('🔑 Step 1/4: Generating API keys...');
    const keys = apiKeyService.generateKeyPair(slug);
    console.log('✅ API keys generated\n');

    // Step 2: Create tenant
    console.log('💾 Step 2/4: Creating tenant in database...');

    // Build branding object
    const branding: any = {};
    if (primaryColor) branding.primaryColor = primaryColor;
    if (secondaryColor) branding.secondaryColor = secondaryColor;
    if (fontFamily) branding.fontFamily = fontFamily;

    const tenant = await tenantRepo.create({
      slug,
      name,
      apiKeyPublic: keys.publicKey,
      apiKeySecret: keys.secretKeyHash,
      commissionPercent: commission,
      branding,
    });
    console.log('✅ Tenant created successfully!\n');

    // Step 3: Create Stripe Connect account
    console.log('💳 Step 3/4: Creating Stripe Connect account...');
    const stripeService = new StripeConnectService(prisma);
    const stripeAccount = await stripeService.createConnectedAccount(tenant.id, {
      country,
      email,
    });
    console.log(`✅ Stripe Connect account created: ${stripeAccount.accountId}\n`);

    // Step 4: Generate onboarding link
    console.log('🔗 Step 4/4: Generating Stripe onboarding link...');
    const onboardingLink = await stripeService.generateOnboardingLink(
      tenant.id,
      `${process.env.ADMIN_PORTAL_URL || 'http://localhost:3000'}/admin/tenants/${tenant.id}/stripe`,
      `${process.env.ADMIN_PORTAL_URL || 'http://localhost:3000'}/admin/tenants/${tenant.id}/stripe/success`
    );
    console.log('✅ Onboarding link generated\n');

    // Print results
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('📋 TENANT INFORMATION');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

    console.log('Tenant ID:    ', tenant.id);
    console.log('Slug:         ', tenant.slug);
    console.log('Name:         ', tenant.name);
    console.log('Commission:   ', `${commission}%`);
    console.log('Created:      ', tenant.createdAt.toISOString());
    console.log('Active:       ', tenant.isActive ? 'Yes' : 'No');

    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('🔑 API KEYS (SAVE THESE SECURELY)');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

    console.log('Public Key:');
    console.log(`  ${keys.publicKey}`);
    console.log('  ℹ️  Safe for client-side use (embed in widget)\n');

    console.log('Secret Key:');
    console.log(`  ${keys.secretKey}`);
    console.log('  ⚠️  SHOWN ONCE - Save immediately!');
    console.log('  ⚠️  Server-side only - NEVER expose to client\n');

    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('💳 STRIPE CONNECT');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

    console.log('Account ID:   ', stripeAccount.accountId);
    console.log('Country:      ', country);
    console.log(
      'Charges:      ',
      stripeAccount.chargesEnabled ? 'Enabled' : 'Disabled (complete onboarding)'
    );
    console.log(
      'Payouts:      ',
      stripeAccount.payoutsEnabled ? 'Enabled' : 'Disabled (complete onboarding)'
    );
    console.log(
      'Details:      ',
      stripeAccount.detailsSubmitted ? 'Submitted' : 'Pending (complete onboarding)'
    );

    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('🔗 STRIPE ONBOARDING');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

    console.log('Onboarding URL (expires in 1 hour):');
    console.log(`  ${onboardingLink.url}\n`);

    console.log('⚠️  IMPORTANT: Complete Stripe onboarding to enable payment processing');
    console.log('   1. Copy the onboarding URL above');
    console.log('   2. Open it in your browser');
    console.log('   3. Complete the Stripe Connect onboarding process');
    console.log('   4. Verify account status after completion\n');

    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

    // Print branding info if configured
    if (Object.keys(branding).length > 0) {
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      console.log('🎨 BRANDING');
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

      if (primaryColor) console.log('Primary Color:   ', primaryColor);
      if (secondaryColor) console.log('Secondary Color: ', secondaryColor);
      if (fontFamily) console.log('Font Family:     ', fontFamily);
      console.log('\n');
    }

    console.log('✅ Next Steps:');
    console.log('   1. Save the secret key in a secure password manager');
    console.log('   2. Complete Stripe onboarding using the URL above');
    console.log('   3. Verify Stripe account status after onboarding');
    console.log('   4. Provide API keys to the tenant');
    if (password) {
      console.log('   5. Tenant admin can log in with provided password');
    } else {
      console.log('   5. Set up tenant admin password (not provided)');
    }
    if (Object.keys(branding).length === 0) {
      console.log('   6. Configure branding via tenant admin dashboard');
    }
    console.log('');

    // Check account status
    console.log('💡 To check Stripe account status later, run:');
    console.log(
      `   curl -X GET http://localhost:5000/v1/admin/tenants/${tenant.id}/stripe/status \\`
    );
    console.log(`        -H "Authorization: Bearer YOUR_ADMIN_TOKEN"\n`);

    process.exit(0);
  } catch (error) {
    console.error('\n❌ Error creating tenant:\n');

    if (error instanceof Error) {
      console.error(`   ${error.message}\n`);

      // Provide helpful hints for common errors
      if (error.message.includes('slug')) {
        console.error('💡 Slug requirements:');
        console.error('   - 3-50 characters');
        console.error('   - Lowercase letters, numbers, hyphens only');
        console.error('   - Must start with letter');
        console.error('   - Cannot end with hyphen');
        console.error('   - Cannot be a reserved word (api, admin, etc.)\n');
      } else if (error.message.includes('Stripe')) {
        console.error('💡 Stripe Connect issues:');
        console.error('   - Ensure STRIPE_SECRET_KEY is set in .env');
        console.error('   - Verify Stripe API credentials are valid');
        console.error('   - Check server logs for more details\n');
      }
    } else {
      console.error(error);
    }

    process.exit(1);
  }
}

// Run main function
main()
  .catch((error) => {
    console.error('Fatal error:', error);
    process.exit(1);
  })
  .finally(() => {
    prisma.$disconnect();
  });
