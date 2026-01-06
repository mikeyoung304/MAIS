#!/usr/bin/env tsx

/**
 * CLI tool for creating new tenants
 *
 * Usage:
 *   pnpm create-tenant --slug=acme --name="ACME Weddings" [--commission=10.0]
 *
 * Options:
 *   --slug        URL-safe tenant identifier (required)
 *   --name        Display name for tenant (required)
 *   --commission  Platform commission percentage (optional, default: 10.0)
 *
 * Example:
 *   pnpm create-tenant --slug=bellaweddings --name="Bella Weddings" --commission=12.5
 *
 * Output:
 *   - Tenant ID
 *   - API keys (public and secret)
 *   - ⚠️ Secret key shown ONCE - save immediately!
 */

import { PrismaClient } from '../src/generated/prisma/client';
import { PrismaTenantRepository } from '../src/adapters/prisma/tenant.repository';
import { apiKeyService } from '../src/lib/api-key.service';

const prisma = new PrismaClient();
const tenantRepo = new PrismaTenantRepository(prisma);

/**
 * Parse command line arguments
 */
function parseArgs(args: string[]): {
  slug?: string;
  name?: string;
  commission?: number;
} {
  const result: { slug?: string; name?: string; commission?: number } = {};

  for (const arg of args) {
    if (arg.startsWith('--slug=')) {
      result.slug = arg.split('=')[1];
    } else if (arg.startsWith('--name=')) {
      result.name = arg.split('=')[1];
    } else if (arg.startsWith('--commission=')) {
      result.commission = parseFloat(arg.split('=')[1]);
    }
  }

  return result;
}

/**
 * Print usage instructions
 */
function printUsage() {
  console.log(`
Usage: pnpm create-tenant --slug=<slug> --name=<name> [--commission=10.0]

Options:
  --slug        URL-safe tenant identifier (required)
                Examples: "bellaweddings", "acme-events", "luxury-co"
                Rules: 3-50 chars, lowercase, letters/numbers/hyphens only

  --name        Display name for tenant (required)
                Examples: "Bella Weddings", "ACME Events", "Luxury Co."

  --commission  Platform commission percentage (optional, default: 10.0)
                Range: 0-100

Examples:
  pnpm create-tenant --slug=bellaweddings --name="Bella Weddings"
  pnpm create-tenant --slug=acme --name="ACME Events" --commission=12.5

⚠️  Secret API key will be shown ONCE - save it immediately!
`);
}

/**
 * Main function
 */
async function main() {
  console.log('🔧 Tenant Creation Tool\n');

  const args = process.argv.slice(2);

  // Check for help flag
  if (args.includes('--help') || args.includes('-h')) {
    printUsage();
    process.exit(0);
  }

  const { slug, name, commission = 10.0 } = parseArgs(args);

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
    console.log('🔑 Generating API keys...');

    // Generate API key pair
    const keys = apiKeyService.generateKeyPair(slug);

    console.log('✅ API keys generated\n');
    console.log('💾 Creating tenant in database...');

    // Create tenant
    const tenant = await tenantRepo.create({
      slug,
      name,
      apiKeyPublic: keys.publicKey,
      apiKeySecret: keys.secretKeyHash,
      commissionPercent: commission,
      branding: {},
    });

    console.log('✅ Tenant created successfully!\n');

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

    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

    console.log('✅ Next Steps:');
    console.log('   1. Save the secret key in a secure password manager');
    console.log('   2. Provide both keys to the tenant');
    console.log('   3. Configure Stripe Connect for payment processing');
    console.log('   4. Set up branding via admin API\n');

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
