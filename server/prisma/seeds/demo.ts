/**
 * Demo seed - Creates rich demo data for local development
 *
 * Use for: Local development, demos, screenshots
 * Creates realistic looking data with multiple packages, add-ons, etc.
 *
 * IMPORTANT: API keys are only generated once on first seed. Re-running this seed
 * will preserve existing keys to avoid breaking local development environments.
 */

import { PrismaClient } from '../../src/generated/prisma';
import crypto from 'crypto';
import { logger } from '../../src/lib/core/logger';
import {
  createOrUpdateTenant,
  createOrUpdatePackages,
  createOrUpdateAddOns,
  linkAddOnsToPackage,
} from './utils';

// Fixed slug for demo tenant
const DEMO_SLUG = 'little-bit-farm';

export async function seedDemo(prisma: PrismaClient): Promise<void> {
  // Check if demo tenant already exists (outside transaction for read-only check)
  const existingTenant = await prisma.tenant.findUnique({
    where: { slug: DEMO_SLUG },
  });

  let publicKey: string;
  let secretKey: string | null = null;

  if (existingTenant) {
    // Tenant exists - preserve keys
    publicKey = existingTenant.apiKeyPublic;
    logger.info('Demo tenant already exists - updating within transaction');
  } else {
    // New tenant - generate keys
    publicKey = `pk_live_${DEMO_SLUG}_${crypto.randomBytes(8).toString('hex')}`;
    secretKey = `sk_live_${DEMO_SLUG}_${crypto.randomBytes(16).toString('hex')}`;
    logger.info('Creating new demo tenant with generated keys');
  }

  // Wrap all seed operations in a transaction to prevent partial data on failure
  await prisma.$transaction(async (tx) => {
    // Create or update tenant using shared utility
    const tenant = await createOrUpdateTenant(tx, {
      slug: DEMO_SLUG,
      name: 'Little Bit Farm',
      email: 'demo@example.com',
      commissionPercent: 5.0,
      apiKeyPublic: publicKey,
      apiKeySecret: secretKey ?? undefined,
      primaryColor: '#1a365d',
      secondaryColor: '#fb923c',
      accentColor: '#38b2ac',
      backgroundColor: '#ffffff',
    });

    if (existingTenant) {
      logger.info(`Demo tenant updated (keys preserved): ${tenant.name}`);
      logger.info(`Public Key: ${publicKey}`);
      logger.info('Secret key unchanged - using existing value');
    } else {
      logger.info(`Demo tenant created: ${tenant.name}`);
      logger.info(`Public Key: ${publicKey}`);
      logger.warn(`Secret Key: ${secretKey}`);
      logger.warn('SAVE THESE KEYS - they will not be regenerated on subsequent seeds!');
    }

    // Create realistic packages using shared utility
    const [starter, growth, enterprise] = await createOrUpdatePackages(
      tx,
      tenant.id,
      [
        {
          slug: 'starter',
          name: 'Starter Package',
          description: 'Essential business services to get you started. Perfect for solopreneurs ready to focus on their craft.',
          basePrice: 25000,
          photos: [{
            url: 'https://images.unsplash.com/photo-1553877522-43269d4ea984',
            filename: 'starter.jpg',
            size: 0,
            order: 0,
          }],
        },
        {
          slug: 'growth',
          name: 'Growth Package',
          description: 'Full-service support for growing businesses. Scale with confidence.',
          basePrice: 50000,
          photos: [{
            url: 'https://images.unsplash.com/photo-1460925895917-afdab827c52f',
            filename: 'growth.jpg',
            size: 0,
            order: 0,
          }],
        },
        {
          slug: 'enterprise',
          name: 'Enterprise Package',
          description: 'Comprehensive solutions for established businesses. Your complete back office.',
          basePrice: 100000,
          photos: [{
            url: 'https://images.unsplash.com/photo-1497366216548-37526070297c',
            filename: 'enterprise.jpg',
            size: 0,
            order: 0,
          }],
        },
      ]
    );

    logger.info(`Demo packages created: ${[starter, growth, enterprise].length}`);

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

    // Link add-ons to packages using shared utility
    await Promise.all([
      linkAddOnsToPackage(tx, starter.id, [socialMedia.id, emailMarketing.id]),
      linkAddOnsToPackage(tx, growth.id, [socialMedia.id, crmSetup.id]),
      linkAddOnsToPackage(tx, enterprise.id, [dedicatedManager.id, crmSetup.id]),
    ]);

    logger.info(`Demo add-ons created and linked: ${[socialMedia, emailMarketing, crmSetup, dedicatedManager].length}`);

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
  }, { timeout: 60000 }); // 60 second timeout for large seed operations

  logger.info('Demo seed completed successfully (all operations committed)');
}
