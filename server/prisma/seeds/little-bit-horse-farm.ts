/**
 * Little Bit Horse Farm seed - Corporate Wellness, Elopements & Weekend Getaways
 *
 * Use for: Production tenant setup for Little Bit Horse Farm
 *
 * Segments:
 * 1. Corporate Wellness Retreat (4+ guests)
 *    - The Grounding Reset (3.5-4 hours) - $450/person
 *    - The Team Recharge (6-7 hours) - $650/person
 *    - The Executive Reset (7-8 hours + prep/recap) - $950/person
 *
 * 2. Elopements (couples + small parties)
 *    - Just Us (couple only, 20 min) - $395
 *    - Just Us + Moments (up to 4 guests, 45 min) - $895
 *    - Tiny Circle (up to 12 guests, 90 min) - $1,595
 *
 * 3. Weekend Getaway Packages (experiences only)
 *    - Farm Reset (60 min, up to 4) - $195/group
 *    - Farm Flow (2 hrs, up to 6) - $495/group
 *    - Signature Farm Day (4 hrs, up to 8) - $895/group
 *
 * IMPORTANT: API keys are only generated once on first seed. Re-running this seed
 * will preserve existing keys to avoid breaking environments.
 */

import type { PrismaClient, Segment, Package, AddOn } from '../../src/generated/prisma/client';
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
 * Create or update an add-on (segment-scoped or global)
 */
async function createOrUpdateAddOn(
  prisma: PrismaOrTransaction,
  tenantId: string,
  options: {
    slug: string;
    name: string;
    description: string;
    price: number; // in cents
    segmentId?: string | null; // null = global, string = segment-scoped
  }
): Promise<AddOn> {
  const { slug, name, description, price, segmentId = null } = options;

  return prisma.addOn.upsert({
    where: { tenantId_slug: { slug, tenantId } },
    update: {
      name,
      description,
      price,
      segmentId,
    },
    create: {
      tenantId,
      segmentId,
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
      // ADD-ONS: Corporate Wellness (18 total, segment-scoped)
      // =====================================================================

      // Food & Hospitality (9)
      const pastryBar = await createOrUpdateAddOn(tx, tenant.id, {
        slug: 'pastry-bar',
        name: 'Arrival Pastry Bar + Fruit',
        description: 'Fresh pastries and seasonal fruit to welcome your team',
        price: 1400, // $14/person
        segmentId: wellnessSegment.id,
      });

      const coffeeTea = await createOrUpdateAddOn(tx, tenant.id, {
        slug: 'coffee-tea',
        name: 'Coffee + Tea Service',
        description: 'Premium coffee and tea station',
        price: 800, // $8/person
        segmentId: wellnessSegment.id,
      });

      const hydrationStation = await createOrUpdateAddOn(tx, tenant.id, {
        slug: 'hydration-station',
        name: 'Hydration + Snack Station',
        description: 'All-day refreshments and healthy snacks',
        price: 1200, // $12/person
        segmentId: wellnessSegment.id,
      });

      const breakfastContinental = await createOrUpdateAddOn(tx, tenant.id, {
        slug: 'breakfast-continental',
        name: 'Breakfast (Continental)',
        description: 'Light continental breakfast spread',
        price: 2000, // $20/person
        segmentId: wellnessSegment.id,
      });

      const lunchBoxed = await createOrUpdateAddOn(tx, tenant.id, {
        slug: 'lunch-boxed',
        name: 'Lunch (Boxed)',
        description: 'Individual gourmet boxed lunches',
        price: 2800, // $28/person
        segmentId: wellnessSegment.id,
      });

      const lunchBuffet = await createOrUpdateAddOn(tx, tenant.id, {
        slug: 'lunch-buffet',
        name: 'Lunch (Buffet)',
        description: 'Fresh buffet-style lunch service',
        price: 3500, // $35/person
        segmentId: wellnessSegment.id,
      });

      const lunchChef = await createOrUpdateAddOn(tx, tenant.id, {
        slug: 'lunch-chef',
        name: 'Chef-Prepared Lunch',
        description: 'Plated or boutique buffet by private chef',
        price: 5500, // $55/person
        segmentId: wellnessSegment.id,
      });

      const dinnerChef = await createOrUpdateAddOn(tx, tenant.id, {
        slug: 'dinner-chef',
        name: 'Private Chef Dinner',
        description: 'Multi-course dinner experience (from $100/person)',
        price: 10000, // $100/person
        segmentId: wellnessSegment.id,
      });

      const hospitalityEssentials = await createOrUpdateAddOn(tx, tenant.id, {
        slug: 'hospitality-essentials',
        name: 'Hospitality Essentials',
        description: 'Pastries + coffee + hydration station (saves $4/person)',
        price: 3000, // $30/person
        segmentId: wellnessSegment.id,
      });

      // Bar (1 - consolidated)
      const mocktailBar = await createOrUpdateAddOn(tx, tenant.id, {
        slug: 'mocktail-bar',
        name: 'Signature Mocktail Bar',
        description: '$250 setup fee + $22/person service (quoted separately)',
        price: 25000, // $250 base
        segmentId: wellnessSegment.id,
      });

      // Wellness Upgrades (4)
      const extraYoga = await createOrUpdateAddOn(tx, tenant.id, {
        slug: 'extra-yoga',
        name: 'Extra Yoga Session',
        description: 'Additional private yoga session',
        price: 45000, // $450 flat
        segmentId: wellnessSegment.id,
      });

      const extraBreathwork = await createOrUpdateAddOn(tx, tenant.id, {
        slug: 'extra-breathwork',
        name: 'Extra Breathwork Session',
        description: 'Additional guided breathwork session',
        price: 55000, // $550 flat
        segmentId: wellnessSegment.id,
      });

      const meditationSoundBath = await createOrUpdateAddOn(tx, tenant.id, {
        slug: 'meditation-sound-bath',
        name: 'Guided Meditation / Sound Bath',
        description: 'Deep relaxation sound healing experience',
        price: 65000, // $650 flat
        segmentId: wellnessSegment.id,
      });

      const extendedPemf = await createOrUpdateAddOn(tx, tenant.id, {
        slug: 'extended-pemf',
        name: 'Extended PEMF Block',
        description: 'Extended PEMF recovery time per person',
        price: 2500, // $25/person
        segmentId: wellnessSegment.id,
      });

      // Corporate Polish (4)
      const photoRecap = await createOrUpdateAddOn(tx, tenant.id, {
        slug: 'photo-recap',
        name: 'Photo Recap',
        description: '30 professionally edited images',
        price: 95000, // $950 flat
        segmentId: wellnessSegment.id,
      });

      const meetingKit = await createOrUpdateAddOn(tx, tenant.id, {
        slug: 'meeting-kit',
        name: 'Meeting Kit',
        description: 'Flip chart, projector, and whiteboard',
        price: 15000, // $150 flat
        segmentId: wellnessSegment.id,
      });

      const welcomeGiftsBasic = await createOrUpdateAddOn(tx, tenant.id, {
        slug: 'welcome-gifts-basic',
        name: 'Branded Welcome Gifts (Basic)',
        description: 'Curated welcome gift per person',
        price: 3500, // $35/person
        segmentId: wellnessSegment.id,
      });

      const welcomeGiftsPremium = await createOrUpdateAddOn(tx, tenant.id, {
        slug: 'welcome-gifts-premium',
        name: 'Branded Welcome Gifts (Premium)',
        description: 'Premium branded gift package per person',
        price: 6500, // $65/person
        segmentId: wellnessSegment.id,
      });

      logger.info('Corporate Wellness add-ons created: 18 (segment-scoped)');

      // =====================================================================
      // LINK CORPORATE WELLNESS ADD-ONS TO WELLNESS PACKAGES
      // =====================================================================
      const wellnessAddOnIds = [
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
        linkAddOnsToPackage(tx, groundingReset.id, wellnessAddOnIds),
        linkAddOnsToPackage(tx, teamRecharge.id, wellnessAddOnIds),
        linkAddOnsToPackage(tx, executiveReset.id, wellnessAddOnIds),
      ]);

      logger.info(
        `Wellness add-ons linked: ${wellnessAddOnIds.length} add-ons × 3 packages = 54 links`
      );

      // =====================================================================
      // SEGMENT: ELOPEMENTS
      // =====================================================================
      const elopementsSegment = await createOrUpdateSegment(tx, tenant.id, {
        slug: 'elopements',
        name: 'Elopements on the Farm',
        heroTitle: 'Simple. Calm. Beautiful.',
        heroSubtitle: 'This is an elopement—not a wedding day.',
        description:
          'Say "I do" surrounded by rolling pastures and gentle horses. Our farm offers intimate ceremony spaces for couples who want meaning without the production. No chaos, no stress—just you, your person, and a beautiful moment.',
        metaTitle: 'Farm Elopements | Little Bit Horse Farm',
        metaDescription:
          'Intimate elopement packages on our beautiful Georgia farm. From $395 for couples-only to $1,595 for small gatherings up to 12. Licensed officiant included.',
        sortOrder: 1,
      });

      logger.info(`Segment created: ${elopementsSegment.name}`);

      // =====================================================================
      // PACKAGES: 3-Tier Elopements (Simple / Sweet / Intimate)
      // =====================================================================

      // Tier 1: Just Us
      const justUs = await createOrUpdatePackageWithSegment(tx, tenant.id, elopementsSegment.id, {
        slug: 'just-us',
        name: 'Just Us',
        description: `Pure elope. No guests. No stress.

Includes:
• Private ceremony spot on the farm
• Licensed officiant
• 20-minute ceremony window
• Legal paperwork handled
• One keepsake photo (officiant assist)

Rules:
• Couple only (no guests)
• No photography included
• No setup / no lingering

Perfect for: couples who want to get married, beautifully, without turning it into a production.`,
        basePrice: 39500, // $395
        grouping: 'tier_1',
        groupingOrder: 1,
        photos: [
          {
            url: 'https://images.unsplash.com/photo-1519741497674-611481863552',
            filename: 'just-us.jpg',
            size: 0,
            order: 0,
          },
        ],
      });

      // Tier 2: Just Us + Moments (Most Popular)
      const justUsMoments = await createOrUpdatePackageWithSegment(
        tx,
        tenant.id,
        elopementsSegment.id,
        {
          slug: 'just-us-moments',
          name: 'Just Us + Moments',
          description: `Still simple—just more meaning. Our most popular elopement.

Includes:
• Up to 4 guests
• 45 minutes total on site
• Licensed officiant
• Short personalized ceremony
• Choice of ceremony spot (we guide you)
• 15 minutes reserved for photos (your photographer or phones)

Notes:
• Standing ceremony (no chairs)
• No reception, no vendors beyond officiant

Perfect for: couples who want a few loved ones and time to breathe it in.`,
          basePrice: 89500, // $895
          grouping: 'tier_2',
          groupingOrder: 2,
          photos: [
            {
              url: 'https://images.unsplash.com/photo-1606216794074-735e91aa2c92',
              filename: 'just-us-moments.jpg',
              size: 0,
              order: 0,
            },
          ],
        }
      );

      // Tier 3: Tiny Circle
      const tinyCircle = await createOrUpdatePackageWithSegment(
        tx,
        tenant.id,
        elopementsSegment.id,
        {
          slug: 'tiny-circle',
          name: 'Tiny Circle',
          description: `An intimate celebration—without becoming a wedding.

Includes:
• Up to 12 guests (hard cap)
• 90 minutes total on site
• Licensed officiant
• Fully personalized ceremony
• Simple ceremony seating
• 30 minutes reserved for professional photography
• Champagne toast (up to 14 pours)
• On-site host to keep things flowing

Notes:
• Still an elopement (no reception)
• Designed for photos + presence, not production

Perfect for: couples who want a small circle, great photos, and zero chaos.`,
          basePrice: 159500, // $1,595
          grouping: 'tier_3',
          groupingOrder: 3,
          photos: [
            {
              url: 'https://images.unsplash.com/photo-1465495976277-4387d4b0b4c6',
              filename: 'tiny-circle.jpg',
              size: 0,
              order: 0,
            },
          ],
        }
      );

      logger.info(
        `Elopement packages created: ${[justUs, justUsMoments, tinyCircle].map((p) => p.name).join(', ')}`
      );

      // =====================================================================
      // ADD-ONS: Elopements (4 total, segment-scoped)
      // =====================================================================

      const photography30 = await createOrUpdateAddOn(tx, tenant.id, {
        slug: 'elopement-photography-30',
        name: 'Photography (30 min)',
        description: 'Professional photography session (30 minutes)',
        price: 35000, // $350
        segmentId: elopementsSegment.id,
      });

      const photography60 = await createOrUpdateAddOn(tx, tenant.id, {
        slug: 'elopement-photography-60',
        name: 'Photography (60 min)',
        description: 'Extended professional photography session (60 minutes)',
        price: 60000, // $600
        segmentId: elopementsSegment.id,
      });

      const bouquetBoutonniere = await createOrUpdateAddOn(tx, tenant.id, {
        slug: 'bouquet-boutonniere',
        name: 'Bouquet + Boutonniere',
        description: 'Fresh floral bouquet and matching boutonniere',
        price: 19500, // $195
        segmentId: elopementsSegment.id,
      });

      const extraTime30 = await createOrUpdateAddOn(tx, tenant.id, {
        slug: 'elopement-extra-time',
        name: 'Extra Time (30 min)',
        description: 'Additional 30 minutes on site',
        price: 25000, // $250
        segmentId: elopementsSegment.id,
      });

      logger.info('Elopement add-ons created: 4 (segment-scoped)');

      // =====================================================================
      // LINK ELOPEMENT ADD-ONS TO ELOPEMENT PACKAGES
      // =====================================================================
      const elopementAddOnIds = [
        photography30.id,
        photography60.id,
        bouquetBoutonniere.id,
        extraTime30.id,
      ];

      await Promise.all([
        linkAddOnsToPackage(tx, justUs.id, elopementAddOnIds),
        linkAddOnsToPackage(tx, justUsMoments.id, elopementAddOnIds),
        linkAddOnsToPackage(tx, tinyCircle.id, elopementAddOnIds),
      ]);

      logger.info(
        `Elopement add-ons linked: ${elopementAddOnIds.length} add-ons × 3 packages = 12 links`
      );

      // =====================================================================
      // SEGMENT: WEEKEND GETAWAY PACKAGES
      // =====================================================================
      const weekendSegment = await createOrUpdateSegment(tx, tenant.id, {
        slug: 'weekend-getaways',
        name: 'Weekend Getaway Packages',
        heroTitle: 'Escape. Experience. Exhale.',
        heroSubtitle:
          'Half-day farm experiences for families, friends, and couples who need a reset.',
        description:
          'No overnight logistics. No complicated planning. Just show up, connect with horses, move through nature, and leave feeling lighter. Perfect for Airbnb guests, birthday groups, or anyone who needs a few hours away from screens.',
        metaTitle: 'Weekend Getaways | Little Bit Horse Farm',
        metaDescription:
          'Half-day farm experiences in Georgia. Horse interactions, guided hikes, yoga, and chef-prepared meals. From $195/group.',
        sortOrder: 2,
      });

      logger.info(`Segment created: ${weekendSegment.name}`);

      // =====================================================================
      // PACKAGES: 3-Tier Weekend Getaway (Entry / Popular / Premium)
      // =====================================================================

      // Tier 1: Farm Reset
      const farmReset = await createOrUpdatePackageWithSegment(tx, tenant.id, weekendSegment.id, {
        slug: 'farm-reset',
        name: 'Farm Reset',
        description: `Light touch. Easy yes.

Includes:
• 60-minute guided farm experience
  (choose one: horse grooming + intro, gentle farm walk, or mindfulness walk)
• Coffee + pastries on arrival or departure
• Farm map + self-guided suggestions

Group size:
• Up to 4 people included
• Additional guests +$35/person (cap at 8)

Perfect for: Airbnb guests, first-time visitors, or anyone who wants a taste of farm life.`,
        basePrice: 19500, // $195
        grouping: 'tier_1',
        groupingOrder: 1,
        photos: [
          {
            url: 'https://images.unsplash.com/photo-1534773728080-33d31da27ae5',
            filename: 'farm-reset.jpg',
            size: 0,
            order: 0,
          },
        ],
      });

      // Tier 2: Farm Flow (Most Popular)
      const farmFlow = await createOrUpdatePackageWithSegment(tx, tenant.id, weekendSegment.id, {
        slug: 'farm-flow',
        name: 'Farm Flow',
        description: `Enough structure to feel special. Our most popular weekend package.

Includes:
• 2-hour curated experience block
• Guided horse grooming + interaction
• Short guided nature hike (with or without horses)
• Optional light yoga / stretch session (all levels)
• Charcuterie board + non-alcoholic drinks
• Flexible pacing (not a strict schedule)

Group size:
• Up to 6 people included
• Additional guests +$45/person (cap at 10)

Perfect for: friends, families, couples who want to mix animals + movement + food.`,
        basePrice: 49500, // $495
        grouping: 'tier_2',
        groupingOrder: 2,
        photos: [
          {
            url: 'https://images.unsplash.com/photo-1558618666-fcd25c85cd64',
            filename: 'farm-flow.jpg',
            size: 0,
            order: 0,
          },
        ],
      });

      // Tier 3: Signature Farm Day
      const signatureFarmDay = await createOrUpdatePackageWithSegment(
        tx,
        tenant.id,
        weekendSegment.id,
        {
          slug: 'signature-farm-day',
          name: 'Signature Farm Day',
          description: `Your premium experience—still under $1k.

Includes:
• 4-hour private farm experience
• Horse grooming + guided interaction
• Guided hike (longer, scenic route)
• Private yoga or mindfulness session
• Charcuterie + drinks
• Private chef dinner OR chef-prepared picnic (weather dependent)
• On-site host throughout

Group size:
• Up to 8 people included
• Additional guests +$65/person (cap at 12)

Perfect for: birthdays, reunions, friend trips—anyone who wants a "luxury" feel without luxury logistics.`,
          basePrice: 89500, // $895
          grouping: 'tier_3',
          groupingOrder: 3,
          photos: [
            {
              url: 'https://images.unsplash.com/photo-1568736772245-26914aae0b09',
              filename: 'signature-farm-day.jpg',
              size: 0,
              order: 0,
            },
          ],
        }
      );

      logger.info(
        `Weekend packages created: ${[farmReset, farmFlow, signatureFarmDay].map((p) => p.name).join(', ')}`
      );

      // =====================================================================
      // ADD-ONS: Weekend Getaways (11 total, segment-scoped)
      // =====================================================================

      // Arrival & Comfort (3)
      const wkndCoffeePastries = await createOrUpdateAddOn(tx, tenant.id, {
        slug: 'wknd-coffee-pastries',
        name: 'Arrival Coffee + Pastries',
        description: 'Hot coffee and fresh pastries on arrival',
        price: 7500, // $75
        segmentId: weekendSegment.id,
      });

      const wkndCharcuterieUpgrade = await createOrUpdateAddOn(tx, tenant.id, {
        slug: 'wknd-charcuterie-upgrade',
        name: 'Welcome Charcuterie Upgrade',
        description: 'Premium charcuterie board with local cheeses and cured meats',
        price: 12500, // $125
        segmentId: weekendSegment.id,
      });

      const wkndFirepitBundle = await createOrUpdateAddOn(tx, tenant.id, {
        slug: 'wknd-firepit-bundle',
        name: 'Firepit Bundle',
        description: "Firepit setup with wood and s'mores kit",
        price: 9500, // $95
        segmentId: weekendSegment.id,
      });

      // Wellness (2)
      const wkndYoga = await createOrUpdateAddOn(tx, tenant.id, {
        slug: 'wknd-yoga-session',
        name: 'Private Yoga Session (60 min)',
        description: 'Private guided yoga session for your group',
        price: 15000, // $150
        segmentId: weekendSegment.id,
      });

      const wkndBreathwork = await createOrUpdateAddOn(tx, tenant.id, {
        slug: 'wknd-breathwork',
        name: 'Guided Breathwork / Meditation',
        description: 'Guided breathwork or meditation session',
        price: 12500, // $125
        segmentId: weekendSegment.id,
      });

      // Horses & Nature (3)
      const wkndExtendedHorse = await createOrUpdateAddOn(tx, tenant.id, {
        slug: 'wknd-extended-horse',
        name: 'Extended Horse Interaction (45 min)',
        description: 'Additional guided horse grooming and interaction time',
        price: 9500, // $95
        segmentId: weekendSegment.id,
      });

      const wkndGuidedHike = await createOrUpdateAddOn(tx, tenant.id, {
        slug: 'wknd-guided-hike',
        name: 'Guided Hike Add-on (45 min)',
        description: 'Additional guided nature hike through the farm',
        price: 12500, // $125
        segmentId: weekendSegment.id,
      });

      const wkndKidsHorse = await createOrUpdateAddOn(tx, tenant.id, {
        slug: 'wknd-kids-horse',
        name: 'Kids Horse Intro Session',
        description: 'Gentle horse introduction designed for children',
        price: 8500, // $85
        segmentId: weekendSegment.id,
      });

      // Food (3)
      const wkndChefDinner = await createOrUpdateAddOn(tx, tenant.id, {
        slug: 'wknd-chef-dinner',
        name: 'Private Chef Dinner (Small Group)',
        description: 'Multi-course dinner prepared by private chef (serves up to 8)',
        price: 45000, // $450
        segmentId: weekendSegment.id,
      });

      const wkndChefPicnic = await createOrUpdateAddOn(tx, tenant.id, {
        slug: 'wknd-chef-picnic',
        name: 'Chef Picnic Basket',
        description: 'Gourmet picnic basket prepared by private chef',
        price: 19500, // $195
        segmentId: weekendSegment.id,
      });

      const wkndWineAddon = await createOrUpdateAddOn(tx, tenant.id, {
        slug: 'wknd-wine-addon',
        name: 'Wine Add-on',
        description: 'Curated wine selection for your group',
        price: 9500, // $95
        segmentId: weekendSegment.id,
      });

      logger.info('Weekend Getaway add-ons created: 11 (segment-scoped)');

      // =====================================================================
      // LINK WEEKEND GETAWAY ADD-ONS TO WEEKEND PACKAGES
      // =====================================================================
      const weekendAddOnIds = [
        wkndCoffeePastries.id,
        wkndCharcuterieUpgrade.id,
        wkndFirepitBundle.id,
        wkndYoga.id,
        wkndBreathwork.id,
        wkndExtendedHorse.id,
        wkndGuidedHike.id,
        wkndKidsHorse.id,
        wkndChefDinner.id,
        wkndChefPicnic.id,
        wkndWineAddon.id,
      ];

      await Promise.all([
        linkAddOnsToPackage(tx, farmReset.id, weekendAddOnIds),
        linkAddOnsToPackage(tx, farmFlow.id, weekendAddOnIds),
        linkAddOnsToPackage(tx, signatureFarmDay.id, weekendAddOnIds),
      ]);

      logger.info(
        `Weekend add-ons linked: ${weekendAddOnIds.length} add-ons × 3 packages = 33 links`
      );

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
  logger.info('Segments: 3');
  logger.info('  • Corporate Wellness Retreats (4+ guests, per-person pricing)');
  logger.info('  • Elopements on the Farm (couples + small parties, flat-rate)');
  logger.info('  • Weekend Getaway Packages (groups, flat-rate + per-person overflow)');
  logger.info('Packages: 9 total');
  logger.info('  • Wellness: Grounding Reset, Team Recharge, Executive Reset');
  logger.info('  • Elopements: Just Us, Just Us + Moments, Tiny Circle');
  logger.info('  • Weekends: Farm Reset, Farm Flow, Signature Farm Day');
  logger.info('Add-ons: 33 total (segment-scoped)');
  logger.info('  • Wellness: 18 add-ons (food, bar, wellness, corporate polish)');
  logger.info('  • Elopements: 4 add-ons (photography, florals, extra time)');
  logger.info('  • Weekends: 11 add-ons (comfort, wellness, horses, food)');
  logger.info('PackageAddOn links: 99 (54 wellness + 12 elopement + 33 weekend)');
  logger.info('Blackout dates: 6 (major holidays 2025-2026)');
  logger.info('='.repeat(60));
}
