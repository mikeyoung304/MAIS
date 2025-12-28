/**
 * Main seed orchestrator - Runs appropriate seeds based on environment
 *
 * Usage:
 *   npm run db:seed              # Auto-detect from NODE_ENV
 *   npm run db:seed:production   # Platform admin only (requires env vars)
 *   npm run db:seed:e2e          # E2E test tenant with fixed keys
 *   npm run db:seed:demo         # Rich demo data for development
 *   npm run db:seed:dev          # Platform + Demo (typical dev setup)
 *   SEED_MODE=la-petit-mariage npm exec prisma db seed  # La Petit Mariage tenant
 *   SEED_MODE=little-bit-farm npm exec prisma db seed   # Little Bit Horse Farm tenant
 *   SEED_MODE=plate npm exec prisma db seed              # Plate catering tenant
 *   SEED_MODE=handled npm exec prisma db seed             # HANDLED "Tenant Zero" (dogfooding)
 *   SEED_MODE=upgrade-tenant-pages npm exec prisma db seed  # Upgrade tenant landing pages
 *
 * Environment Variables:
 *   SEED_MODE: 'production' | 'e2e' | 'demo' | 'dev' | 'all' | 'la-petit-mariage' | 'little-bit-farm' | 'plate' | 'handled'
 *   NODE_ENV: Used as fallback if SEED_MODE not set
 *   ADMIN_EMAIL: Required for production/dev seeds
 *   ADMIN_DEFAULT_PASSWORD: Required for production/dev seeds (min 12 chars)
 *   ADMIN_NAME: Optional, defaults to 'Platform Admin'
 */

import { PrismaClient } from '../src/generated/prisma';
import { seedPlatform } from './seeds/platform';
import { seedE2E } from './seeds/e2e';
import { seedDemo } from './seeds/demo';
import { seedLaPetitMarriage } from './seeds/la-petit-mariage';
import { seedLittleBitHorseFarm } from './seeds/little-bit-horse-farm';
import { seedPlate } from './seeds/plate';
import { seedHandled } from './seeds/handled';
import { upgradeTenantPages } from './seeds/upgrade-tenant-pages';
import { logger } from '../src/lib/core/logger';

const prisma = new PrismaClient();

type SeedMode =
  | 'production'
  | 'e2e'
  | 'demo'
  | 'dev'
  | 'all'
  | 'la-petit-mariage'
  | 'little-bit-farm'
  | 'plate'
  | 'handled'
  | 'upgrade-tenant-pages';

function getSeedMode(): SeedMode {
  // Explicit SEED_MODE takes priority
  const explicitMode = process.env.SEED_MODE as SeedMode | undefined;
  if (
    explicitMode &&
    [
      'production',
      'e2e',
      'demo',
      'dev',
      'all',
      'la-petit-mariage',
      'little-bit-farm',
      'plate',
      'handled',
      'upgrade-tenant-pages',
    ].includes(explicitMode)
  ) {
    return explicitMode;
  }

  // Infer from NODE_ENV
  const nodeEnv = process.env.NODE_ENV;
  switch (nodeEnv) {
    case 'production':
      return 'production';
    case 'test':
      return 'e2e';
    default:
      // Development default: platform admin + demo data
      return 'dev';
  }
}

async function main() {
  const mode = getSeedMode();
  logger.info({ mode }, 'Running seed');

  try {
    switch (mode) {
      case 'production':
        // Production: Only platform admin, requires env vars
        await seedPlatform(prisma);
        break;

      case 'e2e':
        // E2E: Test tenant with fixed keys for automation
        await seedE2E(prisma);
        break;

      case 'demo':
        // Demo: Rich demo data only (no platform admin)
        await seedDemo(prisma);
        break;

      case 'dev':
        // Development: Platform admin + demo data
        await seedPlatform(prisma);
        await seedDemo(prisma);
        break;

      case 'all':
        // All: Everything (for local testing of all seeds)
        await seedPlatform(prisma);
        await seedE2E(prisma);
        await seedDemo(prisma);
        await seedLaPetitMarriage(prisma);
        await seedLittleBitHorseFarm(prisma);
        await seedPlate(prisma);
        await seedHandled(prisma);
        break;

      case 'la-petit-mariage':
        // La Petit Mariage: Wedding/elopement tenant only
        await seedLaPetitMarriage(prisma);
        break;

      case 'little-bit-farm':
        // Little Bit Horse Farm: Corporate wellness retreats
        await seedLittleBitHorseFarm(prisma);
        break;

      case 'plate':
        // Plate: Premium catering services
        await seedPlate(prisma);
        break;

      case 'handled':
        // HANDLED: Tenant Zero - dogfooding our own platform
        await seedHandled(prisma);
        break;

      case 'upgrade-tenant-pages':
        // Upgrade existing tenants with landing page configurations
        await upgradeTenantPages();
        break;
    }

    logger.info('Database seeded successfully');
  } catch (error) {
    logger.error({ error }, 'Seed failed');
    process.exit(1);
  }
}

main().finally(() => prisma.$disconnect());
