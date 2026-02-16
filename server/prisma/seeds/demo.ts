/**
 * Demo seed - Creates rich demo data for local development
 *
 * Use for: Local development, demos, screenshots
 * Creates realistic looking data with multiple tiers, add-ons, etc.
 *
 * IMPORTANT: API keys are only generated once on first seed. Re-running this seed
 * will preserve existing keys to avoid breaking local development environments.
 */

import type { PrismaClient } from '../../src/generated/prisma/client';
import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import { logger } from '../../src/lib/core/logger';
import {
  createOrUpdateTenant,
  createOrUpdateTiers,
  createOrUpdateAddOns,
  linkAddOnsToTier,
} from './utils';

// Fixed slug for demo tenant
// Note: Changed from 'little-bit-farm' to avoid conflict with little-bit-horse-farm.ts seed
// which also uses that slug for a different business (corporate wellness retreats)
const DEMO_SLUG = 'demo-business';
// Demo credentials (publicly known - for demo purposes only)
const DEMO_EMAIL = 'demo@handled-demo.com';
const DEMO_PASSWORD = 'demo123!';

export async function seedDemo(prisma: PrismaClient): Promise<void> {
  // Check if demo tenant already exists (outside transaction for read-only check)
  const existingTenant = await prisma.tenant.findUnique({
    where: { slug: DEMO_SLUG },
  });

  // Variables to capture keys for logging after successful commit
  let publicKeyForLogging: string;
  let secretKeyForLogging: string | null = null;

  // Wrap all seed operations in a transaction to prevent partial data on failure
  logger.info({ slug: DEMO_SLUG, operations: 16 }, 'Starting seed transaction');
  const startTime = Date.now();

  await prisma.$transaction(
    async (tx) => {
      // Generate or reuse API keys INSIDE transaction
      let publicKey: string;
      let secretKey: string | null = null;

      if (existingTenant) {
        // Tenant exists - preserve keys
        publicKey = existingTenant.apiKeyPublic;
        logger.info('Demo tenant already exists - updating within transaction');
      } else {
        // New tenant - generate keys inside transaction to avoid waste on rollback
        publicKey = `pk_live_${DEMO_SLUG}_${crypto.randomBytes(8).toString('hex')}`;
        secretKey = `sk_live_${DEMO_SLUG}_${crypto.randomBytes(16).toString('hex')}`;
        logger.info('Creating new demo tenant with generated keys');
      }

      // Hash demo password for tenant admin login
      const passwordHash = await bcrypt.hash(DEMO_PASSWORD, 10);

      // Create or update tenant using shared utility
      const tenant = await createOrUpdateTenant(tx, {
        slug: DEMO_SLUG,
        name: 'Demo Business Services',
        email: DEMO_EMAIL,
        passwordHash, // Enable dashboard login with demo credentials
        commissionPercent: 5.0,
        apiKeyPublic: publicKey,
        apiKeySecret: secretKey ?? undefined,
        primaryColor: '#1a365d',
        secondaryColor: '#fb923c',
        accentColor: '#38b2ac',
        backgroundColor: '#ffffff',
      });

      // Capture keys for logging after successful commit
      publicKeyForLogging = publicKey;
      secretKeyForLogging = secretKey;

      if (existingTenant) {
        logger.info(`Demo tenant updated (keys preserved): ${tenant.name}`);
      } else {
        logger.info(`Demo tenant created: ${tenant.name}`);
      }

      // Create a default segment for demo tiers
      const segment = await tx.segment.upsert({
        where: { tenantId_slug: { tenantId: tenant.id, slug: 'general' } },
        update: {},
        create: {
          tenantId: tenant.id,
          slug: 'general',
          name: 'General',
          heroTitle: 'Our Services',
          description: 'Business growth services for entrepreneurs',
          sortOrder: 0,
          active: true,
        },
      });

      // Create realistic tiers using shared utility
      const [starter, growth, enterprise] = await createOrUpdateTiers(tx, tenant.id, segment.id, [
        {
          slug: 'starter',
          name: 'Starter',
          description:
            'Essential business services to get you started. Perfect for solopreneurs ready to focus on their craft.',
          priceCents: 25000,
          sortOrder: 1,
          photos: [
            {
              url: 'https://images.unsplash.com/photo-1553877522-43269d4ea984',
              filename: 'starter.jpg',
              size: 0,
              order: 0,
            },
          ],
        },
        {
          slug: 'growth',
          name: 'Growth',
          description: 'Full-service support for growing businesses. Scale with confidence.',
          priceCents: 50000,
          sortOrder: 2,
          photos: [
            {
              url: 'https://images.unsplash.com/photo-1460925895917-afdab827c52f',
              filename: 'growth.jpg',
              size: 0,
              order: 0,
            },
          ],
        },
        {
          slug: 'enterprise',
          name: 'Enterprise',
          description:
            'Comprehensive solutions for established businesses. Your complete back office.',
          priceCents: 100000,
          sortOrder: 3,
          photos: [
            {
              url: 'https://images.unsplash.com/photo-1497366216548-37526070297c',
              filename: 'enterprise.jpg',
              size: 0,
              order: 0,
            },
          ],
        },
      ]);

      logger.info(`Demo tiers created: ${[starter, growth, enterprise].length}`);

      // Create add-ons using shared utility
      const [socialMedia, emailMarketing, crmSetup, dedicatedManager] = await createOrUpdateAddOns(
        tx,
        tenant.id,
        [
          {
            slug: 'social-media-management',
            name: 'Social Media Management',
            description: 'Monthly social media content and posting',
            price: 15000,
          },
          {
            slug: 'email-marketing',
            name: 'Email Marketing',
            description: 'Automated email sequences and campaigns',
            price: 10000,
          },
          {
            slug: 'crm-setup',
            name: 'CRM Setup & Training',
            description: 'Custom CRM configuration and onboarding',
            price: 25000,
          },
          {
            slug: 'dedicated-account-manager',
            name: 'Dedicated Account Manager',
            description: 'Personal point of contact for all your needs',
            price: 50000,
          },
        ]
      );

      // Link add-ons to tiers using shared utility
      await Promise.all([
        linkAddOnsToTier(tx, starter.id, [socialMedia.id, emailMarketing.id]),
        linkAddOnsToTier(tx, growth.id, [socialMedia.id, crmSetup.id]),
        linkAddOnsToTier(tx, enterprise.id, [dedicatedManager.id, crmSetup.id]),
      ]);

      logger.info(
        `Demo add-ons created and linked: ${[socialMedia, emailMarketing, crmSetup, dedicatedManager].length}`
      );

      // Create sample blackout dates
      const christmas = new Date('2025-12-25T00:00:00Z');
      const newYears = new Date('2026-01-01T00:00:00Z');

      await Promise.all([
        tx.blackoutDate.upsert({
          where: { tenantId_date: { date: christmas, tenantId: tenant.id } },
          update: {},
          create: { date: christmas, reason: 'Christmas Holiday', tenantId: tenant.id },
        }),
        tx.blackoutDate.upsert({
          where: { tenantId_date: { date: newYears, tenantId: tenant.id } },
          update: {},
          create: { date: newYears, reason: 'New Years Day', tenantId: tenant.id },
        }),
      ]);

      logger.info('Demo blackout dates created');
    },
    { timeout: 60000 }
  ); // 60 second timeout for large seed operations

  logger.info(
    {
      slug: DEMO_SLUG,
      durationMs: Date.now() - startTime,
    },
    'Seed transaction committed successfully'
  );

  // Log keys AFTER successful transaction commit
  if (existingTenant) {
    logger.info(`Public Key: ${publicKeyForLogging}`);
    logger.info('Secret key unchanged - using existing value');
  } else {
    logger.info(`Public Key: ${publicKeyForLogging}`);
    logger.warn(`Secret Key: ${secretKeyForLogging}`);
    logger.warn('SAVE THESE KEYS - they will not be regenerated on subsequent seeds!');
  }

  // Log demo credentials for easy access
  logger.info('═══════════════════════════════════════════════════════════════');
  logger.info('DEMO LOGIN CREDENTIALS (for testing only)');
  logger.info(`  Email:    ${DEMO_EMAIL}`);
  logger.info(`  Password: ${DEMO_PASSWORD}`);
  logger.info('  URL:      /login?demo=true (auto-fills credentials)');
  logger.info('═══════════════════════════════════════════════════════════════');

  logger.info('Demo seed completed successfully (all operations committed)');
}
