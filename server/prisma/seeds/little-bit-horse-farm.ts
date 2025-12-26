/**
 * Little Bit Horse Farm seed - Corporate Wellness Retreats
 *
 * Use for: Production tenant setup for Little Bit Horse Farm
 *
 * Segments:
 * 1. Corporate Wellness Retreat (4+ guests)
 *    - The Grounding Reset (3.5-4 hours) - $450/person
 *    - The Team Recharge (6-7 hours) - $650/person
 *    - The Executive Reset (7-8 hours + prep/recap) - $950/person
 *
 * IMPORTANT: API keys are only generated once on first seed. Re-running this seed
 * will preserve existing keys to avoid breaking environments.
 */

import type { PrismaClient, Segment, Package, AddOn } from '../../src/generated/prisma';
import * as crypto from 'crypto';
import { logger } from '../../src/lib/core/logger';
import { createOrUpdateTenant } from './utils';

// Fixed slug for Little Bit Horse Farm tenant
const TENANT_SLUG = 'little-bit-farm';

/**
 * Transaction client type for seed operations
 */
type PrismaOrTransaction =
  | PrismaClient
  | Omit<PrismaClient, '$transaction' | '$connect' | '$disconnect' | '$on' | '$use' | '$extends'>;

/**
 * Create or update a segment
 */
async function createOrUpdateSegment(
  prisma: PrismaOrTransaction,
  tenantId: string,
  options: {
    slug: string;
    name: string;
    heroTitle: string;
    heroSubtitle?: string;
    heroImage?: string;
    description?: string;
    metaTitle?: string;
    metaDescription?: string;
    sortOrder?: number;
    active?: boolean;
  }
): Promise<Segment> {
  const {
    slug,
    name,
    heroTitle,
    heroSubtitle,
    heroImage,
    description,
    metaTitle,
    metaDescription,
    sortOrder = 0,
    active = true,
  } = options;

  return prisma.segment.upsert({
    where: { tenantId_slug: { slug, tenantId } },
    update: {
      name,
      heroTitle,
      heroSubtitle,
      heroImage,
      description,
      metaTitle,
      metaDescription,
      sortOrder,
      active,
    },
    create: {
      tenantId,
      slug,
      name,
      heroTitle,
      heroSubtitle,
      heroImage,
      description,
      metaTitle,
      metaDescription,
      sortOrder,
      active,
    },
  });
}

/**
 * Create or update a package with segment association
 */
async function createOrUpdatePackageWithSegment(
  prisma: PrismaOrTransaction,
  tenantId: string,
  segmentId: string,
  options: {
    slug: string;
    name: string;
    description: string;
    basePrice: number; // in cents
    grouping?: string;
    groupingOrder?: number;
    photos?: Array<{ url: string; filename: string; size: number; order: number }>;
  }
): Promise<Package> {
  const { slug, name, description, basePrice, grouping, groupingOrder, photos = [] } = options;

  return prisma.package.upsert({
    where: { tenantId_slug: { slug, tenantId } },
    update: {
      name,
      description,
      basePrice,
      segmentId,
      grouping,
      groupingOrder,
      photos: JSON.stringify(photos),
    },
    create: {
      tenantId,
      segmentId,
      slug,
      name,
      description,
      basePrice,
      grouping,
      groupingOrder,
      photos: JSON.stringify(photos),
    },
  });
}

/**
 * Create or update an add-on (global - no segment scoping)
 */
async function createOrUpdateAddOn(
  prisma: PrismaOrTransaction,
  tenantId: string,
  options: {
    slug: string;
    name: string;
    description: string;
    price: number; // in cents
  }
): Promise<AddOn> {
  const { slug, name, description, price } = options;

  return prisma.addOn.upsert({
    where: { tenantId_slug: { slug, tenantId } },
    update: {
      name,
      description,
      price,
      segmentId: null, // Global - available to all segments
    },
    create: {
      tenantId,
      segmentId: null, // Global - available to all segments
      slug,
      name,
      description,
      price,
    },
  });
}

/**
 * Link add-ons to a package
 */
async function linkAddOnsToPackage(
  prisma: PrismaOrTransaction,
  packageId: string,
  addOnIds: string[]
): Promise<void> {
  await Promise.all(
    addOnIds.map((addOnId) =>
      prisma.packageAddOn.upsert({
        where: { packageId_addOnId: { packageId, addOnId } },
        update: {},
        create: { packageId, addOnId },
      })
    )
  );
}

export async function seedLittleBitHorseFarm(prisma: PrismaClient): Promise<void> {
  // Production guard - prevent accidental data destruction
  if (process.env.NODE_ENV === 'production' && process.env.ALLOW_PRODUCTION_SEED !== 'true') {
    throw new Error('Production seed blocked. Set ALLOW_PRODUCTION_SEED=true to override.');
  }

  // Check if tenant already exists (outside transaction for read-only check)
  const existingTenant = await prisma.tenant.findUnique({
    where: { slug: TENANT_SLUG },
  });

  // Variables to capture keys for logging after successful commit
  let publicKeyForLogging: string;
  let secretKeyForLogging: string | null = null;

  logger.info(
    { slug: TENANT_SLUG, operations: 'segment+packages+addons' },
    'Starting Little Bit Horse Farm seed transaction'
  );
  const startTime = Date.now();

  await prisma.$transaction(
    async (tx) => {
      // Generate or reuse API keys INSIDE transaction
      let publicKey: string;
      let secretKey: string | null = null;

      if (existingTenant) {
        publicKey = existingTenant.apiKeyPublic;
        logger.info('Little Bit Horse Farm tenant exists - updating within transaction');
      } else {
        publicKey = `pk_live_${TENANT_SLUG}_${crypto.randomBytes(8).toString('hex')}`;
        secretKey = `sk_live_${TENANT_SLUG}_${crypto.randomBytes(16).toString('hex')}`;
        logger.info('Creating new Little Bit Horse Farm tenant with generated keys');
      }

      // Create or update tenant
      const tenant = await createOrUpdateTenant(tx, {
        slug: TENANT_SLUG,
        name: 'Little Bit Horse Farm',
        email: 'hello@littlebithorsefarm.com',
        commissionPercent: 5.0,
        apiKeyPublic: publicKey,
        apiKeySecret: secretKey ?? undefined,
        // Brand colors - earthy, calming tones
        primaryColor: '#4a5568', // Warm gray
        secondaryColor: '#68d391', // Sage green
        accentColor: '#9f7aea', // Soft purple
        backgroundColor: '#faf5f0', // Warm cream
        // Tier display names - customize how tiers appear in storefront
        tierDisplayNames: {
          tier_1: 'The Grounding Reset',
          tier_2: 'The Team Recharge',
          tier_3: 'The Executive Reset',
        },
      });

      publicKeyForLogging = publicKey;
      secretKeyForLogging = secretKey;

      logger.info(`Tenant ${existingTenant ? 'updated' : 'created'}: ${tenant.name}`);

      // =====================================================================
      // Delete existing packages and add-ons for clean slate
      // =====================================================================
      await tx.packageAddOn.deleteMany({
        where: { package: { tenantId: tenant.id } },
      });
      await tx.package.deleteMany({
        where: { tenantId: tenant.id },
      });
      await tx.addOn.deleteMany({
        where: { tenantId: tenant.id },
      });
      await tx.segment.deleteMany({
        where: { tenantId: tenant.id },
      });

      logger.info('Cleared existing LBHF packages, add-ons, and segments');

      // =====================================================================
      // SEGMENT: CORPORATE WELLNESS RETREAT
      // =====================================================================
      const wellnessSegment = await createOrUpdateSegment(tx, tenant.id, {
        slug: 'corporate-wellness-retreat',
        name: 'Corporate Wellness Retreats',
        heroTitle: 'Reset. Reconnect. Return Stronger.',
        heroSubtitle:
          'Equine-assisted wellness experiences for teams who want more than another conference room.',
        description:
          'Ground your team in nature with horses, yoga, breathwork, and PEMF recovery. Our farm offers a sanctuary for corporate teams seeking genuine connection and reset.',
        metaTitle: 'Corporate Wellness Retreats | Little Bit Horse Farm',
        metaDescription:
          'Equine-assisted corporate wellness retreats in Georgia. Half-day to full-day experiences with horses, yoga, breathwork, and PEMF recovery. From $450/person.',
        sortOrder: 0,
      });

      logger.info(`Segment created: ${wellnessSegment.name}`);

      // =====================================================================
      // PACKAGES: 3-Tier Corporate Wellness (Good / Better / Best)
      // =====================================================================

      // Good: The Grounding Reset
      const groundingReset = await createOrUpdatePackageWithSegment(
        tx,
        tenant.id,
        wellnessSegment.id,
        {
          slug: 'grounding-reset',
          name: 'The Grounding Reset',
          description: `Your team needs air—not another Zoom call.

Includes:
• Arrival + Intention Setting
• Meet the Horses + safety + herd basics
• Guided Grooming + Connection Session
• Private yoga session (all-levels)
• PEMF recovery rotations
• Rain-plan indoor backup

Minimum 4 participants. Pricing is per person.
Duration: 3.5-4 hours`,
          basePrice: 45000, // $450
          grouping: 'tier_1',
          groupingOrder: 1,
          photos: [
            {
              url: 'https://images.unsplash.com/photo-1553284965-83fd3e82fa5a',
              filename: 'grounding-reset.jpg',
              size: 0,
              order: 0,
            },
          ],
        }
      );

      // Better: The Team Recharge
      const teamRecharge = await createOrUpdatePackageWithSegment(
        tx,
        tenant.id,
        wellnessSegment.id,
        {
          slug: 'team-recharge',
          name: 'The Team Recharge',
          description: `A real retreat without overnight logistics.

Everything in The Grounding Reset, plus:
• Yoga + Breathwork (two distinct modalities)
• Guided Nature Reset (mindful walk with prompts)
• Team Experience (choose: Foraged Wreath/Nature Craft OR Pasture Reflection)
• Expanded PEMF window

Minimum 4 participants. Pricing is per person.
Duration: 6-7 hours`,
          basePrice: 65000, // $650
          grouping: 'tier_2',
          groupingOrder: 2,
          photos: [
            {
              url: 'https://images.unsplash.com/photo-1508672019048-805c876b67e2',
              filename: 'team-recharge.jpg',
              size: 0,
              order: 0,
            },
          ],
        }
      );

      // Best: The Executive Reset
      const executiveReset = await createOrUpdatePackageWithSegment(
        tx,
        tenant.id,
        wellnessSegment.id,
        {
          slug: 'executive-reset',
          name: 'The Executive Reset',
          description: `Leave with calm minds and Monday-ready decisions.

Everything in The Team Recharge, plus:
• Pre-offsite intake survey + call (15-20 min)
• "Leadership in the Herd" (ground-based leadership + presence)
• Quiet Strategy Block (facilitated priorities/norms/next steps)
• Post-offsite 1-page recap (commitments, owners, timelines)
• Highest-touch pacing + longest PEMF access

Minimum 4 participants. Pricing is per person.
Duration: 7-8 hours + prep/recap`,
          basePrice: 95000, // $950
          grouping: 'tier_3',
          groupingOrder: 3,
          photos: [
            {
              url: 'https://images.unsplash.com/photo-1450052590821-8bf91254a353',
              filename: 'executive-reset.jpg',
              size: 0,
              order: 0,
            },
          ],
        }
      );

      logger.info(
        `Packages created: ${[groundingReset, teamRecharge, executiveReset].map((p) => p.name).join(', ')}`
      );

      // =====================================================================
      // ADD-ONS: 18 Total (Global - available to all packages)
      // =====================================================================

      // Food & Hospitality (9)
      const pastryBar = await createOrUpdateAddOn(tx, tenant.id, {
        slug: 'pastry-bar',
        name: 'Arrival Pastry Bar + Fruit',
        description: 'Fresh pastries and seasonal fruit to welcome your team',
        price: 1400, // $14/person
      });

      const coffeeTea = await createOrUpdateAddOn(tx, tenant.id, {
        slug: 'coffee-tea',
        name: 'Coffee + Tea Service',
        description: 'Premium coffee and tea station',
        price: 800, // $8/person
      });

      const hydrationStation = await createOrUpdateAddOn(tx, tenant.id, {
        slug: 'hydration-station',
        name: 'Hydration + Snack Station',
        description: 'All-day refreshments and healthy snacks',
        price: 1200, // $12/person
      });

      const breakfastContinental = await createOrUpdateAddOn(tx, tenant.id, {
        slug: 'breakfast-continental',
        name: 'Breakfast (Continental)',
        description: 'Light continental breakfast spread',
        price: 2000, // $20/person
      });

      const lunchBoxed = await createOrUpdateAddOn(tx, tenant.id, {
        slug: 'lunch-boxed',
        name: 'Lunch (Boxed)',
        description: 'Individual gourmet boxed lunches',
        price: 2800, // $28/person
      });

      const lunchBuffet = await createOrUpdateAddOn(tx, tenant.id, {
        slug: 'lunch-buffet',
        name: 'Lunch (Buffet)',
        description: 'Fresh buffet-style lunch service',
        price: 3500, // $35/person
      });

      const lunchChef = await createOrUpdateAddOn(tx, tenant.id, {
        slug: 'lunch-chef',
        name: 'Chef-Prepared Lunch',
        description: 'Plated or boutique buffet by private chef',
        price: 5500, // $55/person
      });

      const dinnerChef = await createOrUpdateAddOn(tx, tenant.id, {
        slug: 'dinner-chef',
        name: 'Private Chef Dinner',
        description: 'Multi-course dinner experience (from $100/person)',
        price: 10000, // $100/person
      });

      const hospitalityEssentials = await createOrUpdateAddOn(tx, tenant.id, {
        slug: 'hospitality-essentials',
        name: 'Hospitality Essentials',
        description: 'Pastries + coffee + hydration station (saves $4/person)',
        price: 3000, // $30/person
      });

      // Bar (1 - consolidated)
      const mocktailBar = await createOrUpdateAddOn(tx, tenant.id, {
        slug: 'mocktail-bar',
        name: 'Signature Mocktail Bar',
        description: '$250 setup fee + $22/person service (quoted separately)',
        price: 25000, // $250 base
      });

      // Wellness Upgrades (4)
      const extraYoga = await createOrUpdateAddOn(tx, tenant.id, {
        slug: 'extra-yoga',
        name: 'Extra Yoga Session',
        description: 'Additional private yoga session',
        price: 45000, // $450 flat
      });

      const extraBreathwork = await createOrUpdateAddOn(tx, tenant.id, {
        slug: 'extra-breathwork',
        name: 'Extra Breathwork Session',
        description: 'Additional guided breathwork session',
        price: 55000, // $550 flat
      });

      const meditationSoundBath = await createOrUpdateAddOn(tx, tenant.id, {
        slug: 'meditation-sound-bath',
        name: 'Guided Meditation / Sound Bath',
        description: 'Deep relaxation sound healing experience',
        price: 65000, // $650 flat
      });

      const extendedPemf = await createOrUpdateAddOn(tx, tenant.id, {
        slug: 'extended-pemf',
        name: 'Extended PEMF Block',
        description: 'Extended PEMF recovery time per person',
        price: 2500, // $25/person
      });

      // Corporate Polish (4)
      const photoRecap = await createOrUpdateAddOn(tx, tenant.id, {
        slug: 'photo-recap',
        name: 'Photo Recap',
        description: '30 professionally edited images',
        price: 95000, // $950 flat
      });

      const meetingKit = await createOrUpdateAddOn(tx, tenant.id, {
        slug: 'meeting-kit',
        name: 'Meeting Kit',
        description: 'Flip chart, projector, and whiteboard',
        price: 15000, // $150 flat
      });

      const welcomeGiftsBasic = await createOrUpdateAddOn(tx, tenant.id, {
        slug: 'welcome-gifts-basic',
        name: 'Branded Welcome Gifts (Basic)',
        description: 'Curated welcome gift per person',
        price: 3500, // $35/person
      });

      const welcomeGiftsPremium = await createOrUpdateAddOn(tx, tenant.id, {
        slug: 'welcome-gifts-premium',
        name: 'Branded Welcome Gifts (Premium)',
        description: 'Premium branded gift package per person',
        price: 6500, // $65/person
      });

      logger.info('Add-ons created: 18');

      // =====================================================================
      // LINK ALL ADD-ONS TO ALL PACKAGES
      // =====================================================================
      const allAddOnIds = [
        pastryBar.id,
        coffeeTea.id,
        hydrationStation.id,
        breakfastContinental.id,
        lunchBoxed.id,
        lunchBuffet.id,
        lunchChef.id,
        dinnerChef.id,
        hospitalityEssentials.id,
        mocktailBar.id,
        extraYoga.id,
        extraBreathwork.id,
        meditationSoundBath.id,
        extendedPemf.id,
        photoRecap.id,
        meetingKit.id,
        welcomeGiftsBasic.id,
        welcomeGiftsPremium.id,
      ];

      await Promise.all([
        linkAddOnsToPackage(tx, groundingReset.id, allAddOnIds),
        linkAddOnsToPackage(tx, teamRecharge.id, allAddOnIds),
        linkAddOnsToPackage(tx, executiveReset.id, allAddOnIds),
      ]);

      logger.info(`Add-ons linked: ${allAddOnIds.length} add-ons × 3 packages = 54 links`);

      // =====================================================================
      // BLACKOUT DATES (holidays)
      // Use date-only strings to avoid timezone interpretation issues
      // =====================================================================
      const holidays = [
        { date: new Date('2025-12-24'), reason: 'Christmas Eve' },
        { date: new Date('2025-12-25'), reason: 'Christmas Day' },
        { date: new Date('2025-12-31'), reason: "New Year's Eve" },
        { date: new Date('2026-01-01'), reason: "New Year's Day" },
        { date: new Date('2026-07-04'), reason: 'Independence Day' },
        { date: new Date('2026-11-26'), reason: 'Thanksgiving' },
      ];

      await Promise.all(
        holidays.map((holiday) =>
          tx.blackoutDate.upsert({
            where: { tenantId_date: { date: holiday.date, tenantId: tenant.id } },
            update: { reason: holiday.reason },
            create: { date: holiday.date, reason: holiday.reason, tenantId: tenant.id },
          })
        )
      );

      logger.info(`Blackout dates created: ${holidays.length}`);
    },
    { timeout: 120000 } // 2-minute timeout
  );

  logger.info(
    {
      slug: TENANT_SLUG,
      durationMs: Date.now() - startTime,
    },
    'Little Bit Horse Farm seed transaction committed successfully'
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

  // Summary
  logger.info('='.repeat(60));
  logger.info('LITTLE BIT HORSE FARM SEED COMPLETE');
  logger.info('='.repeat(60));
  logger.info('Segments: 1 (Corporate Wellness Retreats)');
  logger.info('Packages: 3 (Good/Better/Best tiers)');
  logger.info('Add-ons: 18 (global, linked to all packages)');
  logger.info('PackageAddOn links: 54');
  logger.info('Blackout dates: 6 (major holidays 2025-2026)');
  logger.info('='.repeat(60));
}
