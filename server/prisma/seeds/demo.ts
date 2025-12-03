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
import { apiKeyService } from '../../src/lib/api-key.service';
import crypto from 'crypto';
import { logger } from '../../src/lib/core/logger';

// Fixed slug for demo tenant
const DEMO_SLUG = 'little-bit-farm';

export async function seedDemo(prisma: PrismaClient): Promise<void> {
  // Check if demo tenant already exists
  const existingTenant = await prisma.tenant.findUnique({
    where: { slug: DEMO_SLUG },
  });

  let tenant;
  let publicKey: string;
  let secretKey: string | null = null;

  if (existingTenant) {
    // Tenant exists - preserve keys, only update non-sensitive fields
    tenant = await prisma.tenant.update({
      where: { slug: DEMO_SLUG },
      data: {
        name: 'Little Bit Farm',
        email: 'demo@example.com',
        commissionPercent: 5.0,
        primaryColor: '#1a365d',
        secondaryColor: '#fb923c',
        accentColor: '#38b2ac',
        backgroundColor: '#ffffff',
        branding: { fontFamily: 'Inter, system-ui, sans-serif' },
        isActive: true,
      },
    });

    publicKey = tenant.apiKeyPublic;
    logger.info(`Demo tenant updated (keys preserved): ${tenant.name}`);
    logger.info(`Public Key: ${publicKey}`);
    logger.info('Secret key unchanged - using existing value');
  } else {
    // New tenant - generate keys
    publicKey = `pk_live_${DEMO_SLUG}_${crypto.randomBytes(8).toString('hex')}`;
    secretKey = `sk_live_${DEMO_SLUG}_${crypto.randomBytes(16).toString('hex')}`;

    tenant = await prisma.tenant.create({
      data: {
        slug: DEMO_SLUG,
        name: 'Little Bit Farm',
        email: 'demo@example.com',
        commissionPercent: 5.0,
        apiKeyPublic: publicKey,
        apiKeySecret: apiKeyService.hashSecretKey(secretKey),
        stripeAccountId: null,
        stripeOnboarded: false,
        isActive: true,
        primaryColor: '#1a365d',
        secondaryColor: '#fb923c',
        accentColor: '#38b2ac',
        backgroundColor: '#ffffff',
        branding: { fontFamily: 'Inter, system-ui, sans-serif' },
      },
    });

    logger.info(`Demo tenant created: ${tenant.name}`);
    logger.info(`Public Key: ${publicKey}`);
    logger.warn(`Secret Key: ${secretKey}`);
    logger.warn('SAVE THESE KEYS - they will not be regenerated on subsequent seeds!');
  }

  // Create realistic packages
  const [starter, growth, enterprise] = await Promise.all([
    prisma.package.upsert({
      where: { tenantId_slug: { slug: 'starter', tenantId: tenant.id } },
      update: {},
      create: {
        slug: 'starter',
        name: 'Starter Package',
        description: 'Essential business services to get you started. Perfect for solopreneurs ready to focus on their craft.',
        basePrice: 25000,
        photos: JSON.stringify([{
          url: 'https://images.unsplash.com/photo-1553877522-43269d4ea984',
          filename: 'starter.jpg',
          size: 0,
          order: 0,
        }]),
        tenantId: tenant.id,
      },
    }),
    prisma.package.upsert({
      where: { tenantId_slug: { slug: 'growth', tenantId: tenant.id } },
      update: {},
      create: {
        slug: 'growth',
        name: 'Growth Package',
        description: 'Full-service support for growing businesses. Scale with confidence.',
        basePrice: 50000,
        photos: JSON.stringify([{
          url: 'https://images.unsplash.com/photo-1460925895917-afdab827c52f',
          filename: 'growth.jpg',
          size: 0,
          order: 0,
        }]),
        tenantId: tenant.id,
      },
    }),
    prisma.package.upsert({
      where: { tenantId_slug: { slug: 'enterprise', tenantId: tenant.id } },
      update: {},
      create: {
        slug: 'enterprise',
        name: 'Enterprise Package',
        description: 'Comprehensive solutions for established businesses. Your complete back office.',
        basePrice: 100000,
        photos: JSON.stringify([{
          url: 'https://images.unsplash.com/photo-1497366216548-37526070297c',
          filename: 'enterprise.jpg',
          size: 0,
          order: 0,
        }]),
        tenantId: tenant.id,
      },
    }),
  ]);

  logger.info(`Demo packages created: ${[starter, growth, enterprise].length}`);

  // Create add-ons
  const [socialMedia, emailMarketing, crmSetup, dedicatedManager] = await Promise.all([
    prisma.addOn.upsert({
      where: { tenantId_slug: { slug: 'social-media-management', tenantId: tenant.id } },
      update: {},
      create: {
        tenantId: tenant.id,
        slug: 'social-media-management',
        name: 'Social Media Management',
        description: 'Monthly social media content and posting',
        price: 15000,
      },
    }),
    prisma.addOn.upsert({
      where: { tenantId_slug: { slug: 'email-marketing', tenantId: tenant.id } },
      update: {},
      create: {
        tenantId: tenant.id,
        slug: 'email-marketing',
        name: 'Email Marketing',
        description: 'Automated email sequences and campaigns',
        price: 10000,
      },
    }),
    prisma.addOn.upsert({
      where: { tenantId_slug: { slug: 'crm-setup', tenantId: tenant.id } },
      update: {},
      create: {
        tenantId: tenant.id,
        slug: 'crm-setup',
        name: 'CRM Setup & Training',
        description: 'Custom CRM configuration and onboarding',
        price: 25000,
      },
    }),
    prisma.addOn.upsert({
      where: { tenantId_slug: { slug: 'dedicated-account-manager', tenantId: tenant.id } },
      update: {},
      create: {
        tenantId: tenant.id,
        slug: 'dedicated-account-manager',
        name: 'Dedicated Account Manager',
        description: 'Personal point of contact for all your needs',
        price: 50000,
      },
    }),
  ]);

  // Link add-ons to packages
  await Promise.all([
    prisma.packageAddOn.upsert({
      where: { packageId_addOnId: { packageId: starter.id, addOnId: socialMedia.id } },
      update: {},
      create: { packageId: starter.id, addOnId: socialMedia.id },
    }),
    prisma.packageAddOn.upsert({
      where: { packageId_addOnId: { packageId: starter.id, addOnId: emailMarketing.id } },
      update: {},
      create: { packageId: starter.id, addOnId: emailMarketing.id },
    }),
    prisma.packageAddOn.upsert({
      where: { packageId_addOnId: { packageId: growth.id, addOnId: socialMedia.id } },
      update: {},
      create: { packageId: growth.id, addOnId: socialMedia.id },
    }),
    prisma.packageAddOn.upsert({
      where: { packageId_addOnId: { packageId: growth.id, addOnId: crmSetup.id } },
      update: {},
      create: { packageId: growth.id, addOnId: crmSetup.id },
    }),
    prisma.packageAddOn.upsert({
      where: { packageId_addOnId: { packageId: enterprise.id, addOnId: dedicatedManager.id } },
      update: {},
      create: { packageId: enterprise.id, addOnId: dedicatedManager.id },
    }),
    prisma.packageAddOn.upsert({
      where: { packageId_addOnId: { packageId: enterprise.id, addOnId: crmSetup.id } },
      update: {},
      create: { packageId: enterprise.id, addOnId: crmSetup.id },
    }),
  ]);

  logger.info(`Demo add-ons created and linked: ${[socialMedia, emailMarketing, crmSetup, dedicatedManager].length}`);

  // Create sample blackout dates
  const christmas = new Date('2025-12-25T00:00:00Z');
  const newYears = new Date('2026-01-01T00:00:00Z');

  await Promise.all([
    prisma.blackoutDate.upsert({
      where: { tenantId_date: { date: christmas, tenantId: tenant.id } },
      update: {},
      create: { date: christmas, reason: 'Christmas Holiday', tenantId: tenant.id },
    }),
    prisma.blackoutDate.upsert({
      where: { tenantId_date: { date: newYears, tenantId: tenant.id } },
      update: {},
      create: { date: newYears, reason: 'New Years Day', tenantId: tenant.id },
    }),
  ]);

  logger.info('Demo blackout dates created');
}
