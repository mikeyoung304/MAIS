/**
 * La Petit Mariage seed - Wedding & Elopement packages at Tanglewood Art Studios
 *
 * Use for: Production tenant setup for La Petit Mariage wedding business
 *
 * Segments:
 * 1. Elopements at Tanglewood Art Studios (0-12 guests)
 * 2. Micro Weddings at Tanglewood (up to ~40 guests)
 * 3. Full Weddings at Tanglewood (50-120+ guests)
 *
 * IMPORTANT: API keys are only generated once on first seed. Re-running this seed
 * will preserve existing keys to avoid breaking environments.
 */

import type { PrismaClient, Segment, Package, AddOn} from '../../src/generated/prisma';
import { BookingType } from '../../src/generated/prisma';
import * as crypto from 'crypto';
import { logger } from '../../src/lib/core/logger';
import { createOrUpdateTenant } from './utils';

// Fixed slug for La Petit Mariage tenant
const TENANT_SLUG = 'la-petit-mariage';

/**
 * Transaction client type for seed operations
 * Matches the type from utils.ts for consistency
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
    bookingType?: BookingType;
  }
): Promise<Package> {
  const {
    slug,
    name,
    description,
    basePrice,
    grouping,
    groupingOrder,
    photos = [],
    bookingType = BookingType.DATE,
  } = options;

  // Runtime validation: ensure bookingType is a valid enum member
  if (!Object.values(BookingType).includes(bookingType)) {
    throw new Error(`Invalid bookingType: ${bookingType}`);
  }

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
      bookingType,
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
      bookingType,
    },
  });
}

/**
 * Create or update an add-on with optional segment scoping
 */
async function createOrUpdateAddOnWithSegment(
  prisma: PrismaOrTransaction,
  tenantId: string,
  segmentId: string | null,
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

export async function seedLaPetitMarriage(prisma: PrismaClient): Promise<void> {
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
    { slug: TENANT_SLUG, operations: 'segments+packages+addons' },
    'Starting La Petit Mariage seed transaction'
  );
  const startTime = Date.now();

  await prisma.$transaction(
    async (tx) => {
      // Generate or reuse API keys INSIDE transaction
      let publicKey: string;
      let secretKey: string | null = null;

      if (existingTenant) {
        publicKey = existingTenant.apiKeyPublic;
        logger.info('La Petit Mariage tenant exists - updating within transaction');
      } else {
        publicKey = `pk_live_${TENANT_SLUG}_${crypto.randomBytes(8).toString('hex')}`;
        secretKey = `sk_live_${TENANT_SLUG}_${crypto.randomBytes(16).toString('hex')}`;
        logger.info('Creating new La Petit Mariage tenant with generated keys');
      }

      // Create or update tenant
      const tenant = await createOrUpdateTenant(tx, {
        slug: TENANT_SLUG,
        name: 'La Petit Mariage',
        email: 'info@elopetomaconga.com',
        commissionPercent: 8.0, // Wedding industry standard
        apiKeyPublic: publicKey,
        apiKeySecret: secretKey ?? undefined,
        // Brand colors from elopetomaconga.com
        primaryColor: '#3b4672', // Navy blue (text/headings)
        secondaryColor: '#c1c7dc', // Lavender (hero background)
        accentColor: '#1e2339', // Dark navy (dark sections)
        backgroundColor: '#ffffff', // White
      });

      publicKeyForLogging = publicKey;
      secretKeyForLogging = secretKey;

      logger.info(`Tenant ${existingTenant ? 'updated' : 'created'}: ${tenant.name}`);

      // =====================================================================
      // SEGMENT 1: ELOPEMENTS AT TANGLEWOOD ART STUDIOS (0-12 guests)
      // =====================================================================
      const elopementSegment = await createOrUpdateSegment(tx, tenant.id, {
        slug: 'elopements',
        name: 'Elopements at Tanglewood Art Studios',
        heroTitle: 'Say "I Do" Your Way',
        heroSubtitle: 'Intimate ceremonies for 0-12 guests at Tanglewood Art Studios',
        description: `A short, sweet celebration of your love at our beautiful Tanglewood Art Studios.
Whether it's just the two of you or a handful of your closest people, we'll create a
meaningful ceremony that reflects your unique story. Simple, heartfelt, and unforgettable.`,
        metaTitle: 'Elopement Packages | La Petit Mariage at Tanglewood',
        metaDescription:
          'Intimate elopement ceremonies for 0-12 guests at Tanglewood Art Studios. From $200. Photography, custom ceremonies, and more.',
        sortOrder: 0,
      });

      logger.info(`Segment created: ${elopementSegment.name}`);

      // Elopement Packages
      const simpleVows = await createOrUpdatePackageWithSegment(
        tx,
        tenant.id,
        elopementSegment.id,
        {
          slug: 'simple-vows',
          name: 'Simple Vows',
          description: `A short, sweet "just us" ceremony.

• 30-minute simple ceremony at Tanglewood Art Studios
• Choice of secular or spiritual wording
• Guidance on marriage license + quick timeline review

Perfect for couples who want to keep it simple and meaningful.`,
          basePrice: 20000, // $200
          grouping: 'tier_1',
          groupingOrder: 1,
        }
      );

      const essentialElopement = await createOrUpdatePackageWithSegment(
        tx,
        tenant.id,
        elopementSegment.id,
        {
          slug: 'essential-elopement',
          name: 'Essential Elopement',
          description: `Our most popular elopement experience.

• Personalized ceremony at Tanglewood for up to 12 guests
• 1 hour of photography (ceremony + portraits)
• Semi-custom ceremony script based on your story
• Marriage license + timeline support

Everything you need for a beautiful, intimate celebration.`,
          basePrice: 59500, // $595
          grouping: 'tier_2',
          groupingOrder: 2,
        }
      );

      const allInclusiveElopement = await createOrUpdatePackageWithSegment(
        tx,
        tenant.id,
        elopementSegment.id,
        {
          slug: 'all-inclusive-elopement',
          name: 'All-Inclusive Elopement',
          description: `Show up dressed; we'll handle the rest.

• Everything in Essential Elopement
• Fully custom ceremony script
• One symbolic ritual (Unity Candle, Sand, or Handfasting)
• Extra photo time (up to 90 minutes total)
• Keepsake vow books + select prints

The ultimate stress-free elopement experience.`,
          basePrice: 79500, // $795
          grouping: 'tier_3',
          groupingOrder: 3,
        }
      );

      logger.info(
        `Elopement packages created: ${[simpleVows, essentialElopement, allInclusiveElopement].length}`
      );

      // =====================================================================
      // SEGMENT 2: MICRO WEDDINGS AT TANGLEWOOD (up to ~40 guests)
      // =====================================================================
      const microWeddingSegment = await createOrUpdateSegment(tx, tenant.id, {
        slug: 'micro-weddings',
        name: 'Micro Weddings at Tanglewood',
        heroTitle: 'Small Guest List, Big Love',
        heroSubtitle: 'Intimate weddings for up to 40 guests',
        description: `Invite your nearest and dearest for a celebration that feels personal and
meaningful. Our micro wedding packages give you all the beauty of a traditional
wedding, scaled down to focus on what matters most—your love story.`,
        metaTitle: 'Micro Wedding Packages | La Petit Mariage at Tanglewood',
        metaDescription:
          'Intimate micro weddings for up to 40 guests at Tanglewood. From $1,500. Full coordination, photography, and florals included.',
        sortOrder: 1,
      });

      logger.info(`Segment created: ${microWeddingSegment.name}`);

      // Micro Wedding Packages
      const ceremonyAndPortraits = await createOrUpdatePackageWithSegment(
        tx,
        tenant.id,
        microWeddingSegment.id,
        {
          slug: 'ceremony-and-portraits-micro',
          name: 'Ceremony & Portraits',
          description: `An intimate wedding with your closest people.

• Ceremony setup at Tanglewood (up to ~40 guests)
• Simple florals for ceremony + personals
• 2 hours of photography (ceremony + group portraits)
• Ceremony coordination and lineup

Perfect for couples planning their own reception elsewhere.`,
          basePrice: 150000, // $1,500
          grouping: 'tier_1',
          groupingOrder: 1,
        }
      );

      const microCelebration = await createOrUpdatePackageWithSegment(
        tx,
        tenant.id,
        microWeddingSegment.id,
        {
          slug: 'micro-celebration',
          name: 'Micro Celebration',
          description: `A small wedding that still feels like a full day.

• Everything in Ceremony & Portraits
• "Mini reception" time for cake, toasts, and photos
• 4 hours of photography total
• Basic décor + reception tables for cake/gifts/guestbook
• Timeline creation + day-of coordination

All the magic of a wedding day, thoughtfully scaled down.`,
          basePrice: 250000, // $2,500
          grouping: 'tier_2',
          groupingOrder: 2,
        }
      );

      const allInclusiveMicro = await createOrUpdatePackageWithSegment(
        tx,
        tenant.id,
        microWeddingSegment.id,
        {
          slug: 'all-inclusive-micro',
          name: 'All-Inclusive Micro',
          description: `All the essentials of a traditional wedding, scaled down.

• Ceremony + reception at Tanglewood
• 6 hours of photography
• Upgraded florals + décor
• Simple catering (heavy hors d'oeuvres / buffet) via preferred partners
• Full vendor coordination + day-of management

Everything handled, so you can simply enjoy your day.`,
          basePrice: 350000, // $3,500
          grouping: 'tier_3',
          groupingOrder: 3,
        }
      );

      logger.info(
        `Micro wedding packages created: ${[ceremonyAndPortraits, microCelebration, allInclusiveMicro].length}`
      );

      // =====================================================================
      // SEGMENT 3: FULL WEDDINGS AT TANGLEWOOD (50-120+ guests)
      // =====================================================================
      const fullWeddingSegment = await createOrUpdateSegment(tx, tenant.id, {
        slug: 'full-weddings',
        name: 'Full Weddings at Tanglewood',
        heroTitle: 'The Complete Experience',
        heroSubtitle: 'Grand celebrations for 50-120+ guests',
        description: `Your dream wedding, fully realized. From ceremony to last dance, our full
wedding packages provide comprehensive support and stunning execution. Let us
handle the details while you focus on making memories.`,
        metaTitle: 'Full Wedding Packages | La Petit Mariage at Tanglewood',
        metaDescription:
          'Complete wedding packages for 50-120+ guests at Tanglewood. From $2,500. Full coordination, photography, florals, and more.',
        sortOrder: 2,
      });

      logger.info(`Segment created: ${fullWeddingSegment.name}`);

      // Full Wedding Packages
      const ceremonyPortraitsFull = await createOrUpdatePackageWithSegment(
        tx,
        tenant.id,
        fullWeddingSegment.id,
        {
          slug: 'ceremony-and-portraits-full',
          name: 'Ceremony & Portraits',
          description: `For couples planning their own reception elsewhere.

• Ceremony at Tanglewood
• Basic ceremony florals + personals
• Up to 4 hours of photography
• Ceremony planning + coordination

A beautiful start to your celebration.`,
          basePrice: 250000, // $2,500
          grouping: 'tier_1',
          groupingOrder: 1,
        }
      );

      const classicWeddingDay = await createOrUpdatePackageWithSegment(
        tx,
        tenant.id,
        fullWeddingSegment.id,
        {
          slug: 'classic-wedding-day',
          name: 'Classic Wedding Day',
          description: `The full wedding experience, handled.

• Ceremony + reception at Tanglewood
• Up to 8 hours of photography
• Core florals + décor for ceremony and reception
• Detailed timeline + vendor coordination
• Day-of coordinator on site

Everything you need for your perfect day.`,
          basePrice: 450000, // $4,500
          grouping: 'tier_2',
          groupingOrder: 2,
        }
      );

      const signatureAllInclusive = await createOrUpdatePackageWithSegment(
        tx,
        tenant.id,
        fullWeddingSegment.id,
        {
          slug: 'signature-all-inclusive',
          name: 'Signature All-Inclusive',
          description: `White-glove support from "we're engaged" to "last dance."

• Everything in Classic Wedding Day
• Upgraded florals and décor throughout
• Hair & makeup for the couple (and select VIPs)
• Extra photo coverage + highlight-style video
• Transportation / logistics assistance for your wedding party
• Option to add engagement or day-after session

The ultimate wedding experience, fully handled.`,
          basePrice: 750000, // $7,500
          grouping: 'tier_3',
          groupingOrder: 3,
        }
      );

      logger.info(
        `Full wedding packages created: ${[ceremonyPortraitsFull, classicWeddingDay, signatureAllInclusive].length}`
      );

      // =====================================================================
      // ADD-ONS: Global (available to all segments)
      // =====================================================================
      const extraPhotoHour = await createOrUpdateAddOnWithSegment(tx, tenant.id, null, {
        slug: 'extra-photography-hour',
        name: 'Extra Photography Hour',
        description: 'Additional hour of professional photography coverage.',
        price: 30000, // $300
      });

      const secondPhotographer = await createOrUpdateAddOnWithSegment(tx, tenant.id, null, {
        slug: 'second-photographer',
        name: 'Second Photographer',
        description: 'A second photographer to capture every angle and moment.',
        price: 50000, // $500
      });

      const fullVideoCoverage = await createOrUpdateAddOnWithSegment(tx, tenant.id, null, {
        slug: 'full-video-coverage',
        name: 'Full Video Coverage',
        description: 'Comprehensive video coverage of your ceremony and celebration.',
        price: 200000, // $2,000
      });

      const ceremonyFilm = await createOrUpdateAddOnWithSegment(tx, tenant.id, null, {
        slug: 'ceremony-only-film',
        name: 'Ceremony-Only Film',
        description: 'Beautiful cinematic coverage of your ceremony.',
        price: 75000, // $750
      });

      const hairMakeup = await createOrUpdateAddOnWithSegment(tx, tenant.id, null, {
        slug: 'hair-and-makeup',
        name: 'Hair & Makeup Services',
        description: 'Professional hair and makeup for the couple.',
        price: 35000, // $350
      });

      const additionalHairMakeup = await createOrUpdateAddOnWithSegment(tx, tenant.id, null, {
        slug: 'additional-hair-makeup',
        name: 'Additional Hair & Makeup',
        description: 'Hair and makeup for bridesmaids, mothers, or other VIPs (per person).',
        price: 15000, // $150
      });

      const enhancedFlorals = await createOrUpdateAddOnWithSegment(tx, tenant.id, null, {
        slug: 'enhanced-florals',
        name: 'Enhanced Florals',
        description: 'Upgraded floral arrangements including ceremony arch and centerpieces.',
        price: 80000, // $800
      });

      const floralInstallation = await createOrUpdateAddOnWithSegment(tx, tenant.id, null, {
        slug: 'floral-installation',
        name: 'Floral Installation',
        description: 'Stunning floral installation piece for ceremony or reception.',
        price: 150000, // $1,500
      });

      const liveMusicCeremony = await createOrUpdateAddOnWithSegment(tx, tenant.id, null, {
        slug: 'live-music-ceremony',
        name: 'Live Music (Ceremony)',
        description: 'Live musician for your ceremony (guitar, violin, or harp).',
        price: 40000, // $400
      });

      const djSoundSystem = await createOrUpdateAddOnWithSegment(tx, tenant.id, null, {
        slug: 'dj-sound-system',
        name: 'DJ & Sound System',
        description: 'Professional DJ services and sound system for your reception.',
        price: 100000, // $1,000
      });

      const unityCandle = await createOrUpdateAddOnWithSegment(tx, tenant.id, null, {
        slug: 'unity-candle-ritual',
        name: 'Unity Candle Ritual',
        description: 'Beautiful unity candle ceremony with custom candles to keep.',
        price: 7500, // $75
      });

      const sandCeremony = await createOrUpdateAddOnWithSegment(tx, tenant.id, null, {
        slug: 'sand-ceremony',
        name: 'Sand Ceremony',
        description: 'Symbolic sand ceremony with custom colors and keepsake vessel.',
        price: 7500, // $75
      });

      const handfasting = await createOrUpdateAddOnWithSegment(tx, tenant.id, null, {
        slug: 'handfasting-ritual',
        name: 'Handfasting Ritual',
        description: 'Traditional handfasting ceremony with beautiful cords to keep.',
        price: 7500, // $75
      });

      const dinnerReservation = await createOrUpdateAddOnWithSegment(tx, tenant.id, null, {
        slug: 'dinner-reservation',
        name: 'Dinner Reservation Coordination',
        description: "We'll coordinate a special dinner reservation at a local restaurant.",
        price: 5000, // $50
      });

      const picnicExperience = await createOrUpdateAddOnWithSegment(tx, tenant.id, null, {
        slug: 'picnic-experience',
        name: 'Picnic Experience',
        description: 'Beautiful curated picnic setup for an intimate celebration.',
        price: 25000, // $250
      });

      const privateChef = await createOrUpdateAddOnWithSegment(tx, tenant.id, null, {
        slug: 'private-chef-experience',
        name: 'Private Chef Experience',
        description: 'Private chef to create a custom menu for your celebration.',
        price: 150000, // $1,500
      });

      const heirloomAlbum = await createOrUpdateAddOnWithSegment(tx, tenant.id, null, {
        slug: 'heirloom-album',
        name: 'Heirloom Album',
        description: 'Beautifully crafted heirloom album with your wedding photos.',
        price: 75000, // $750
      });

      const printSet = await createOrUpdateAddOnWithSegment(tx, tenant.id, null, {
        slug: 'print-set',
        name: 'Print Set',
        description: 'Curated set of fine art prints from your wedding day.',
        price: 35000, // $350
      });

      const wallArt = await createOrUpdateAddOnWithSegment(tx, tenant.id, null, {
        slug: 'wall-art-canvas',
        name: 'Wall Art / Canvas',
        description: 'Large format canvas or framed wall art of your favorite image.',
        price: 50000, // $500
      });

      const engagementSession = await createOrUpdateAddOnWithSegment(tx, tenant.id, null, {
        slug: 'engagement-session',
        name: 'Engagement Session',
        description: '1-hour engagement photo session at location of your choice.',
        price: 45000, // $450
      });

      const dayAfterSession = await createOrUpdateAddOnWithSegment(tx, tenant.id, null, {
        slug: 'day-after-session',
        name: 'Day-After Session',
        description: 'Relaxed photo session the day after your wedding.',
        price: 40000, // $400
      });

      logger.info('Global add-ons created: 21');

      // =====================================================================
      // LINK ADD-ONS TO PACKAGES
      // =====================================================================

      // Simple Vows - minimal add-ons
      await linkAddOnsToPackage(tx, simpleVows.id, [
        unityCandle.id,
        sandCeremony.id,
        handfasting.id,
      ]);

      // Essential Elopement - photography + rituals + dining
      await linkAddOnsToPackage(tx, essentialElopement.id, [
        extraPhotoHour.id,
        ceremonyFilm.id,
        unityCandle.id,
        sandCeremony.id,
        handfasting.id,
        dinnerReservation.id,
        picnicExperience.id,
        printSet.id,
      ]);

      // All-Inclusive Elopement - more comprehensive
      await linkAddOnsToPackage(tx, allInclusiveElopement.id, [
        extraPhotoHour.id,
        ceremonyFilm.id,
        fullVideoCoverage.id,
        hairMakeup.id,
        enhancedFlorals.id,
        liveMusicCeremony.id,
        dinnerReservation.id,
        picnicExperience.id,
        privateChef.id,
        heirloomAlbum.id,
        printSet.id,
        wallArt.id,
      ]);

      // Micro Wedding: Ceremony & Portraits
      await linkAddOnsToPackage(tx, ceremonyAndPortraits.id, [
        extraPhotoHour.id,
        secondPhotographer.id,
        ceremonyFilm.id,
        hairMakeup.id,
        additionalHairMakeup.id,
        enhancedFlorals.id,
        liveMusicCeremony.id,
        unityCandle.id,
        sandCeremony.id,
        handfasting.id,
        printSet.id,
      ]);

      // Micro Celebration - fuller set
      await linkAddOnsToPackage(tx, microCelebration.id, [
        extraPhotoHour.id,
        secondPhotographer.id,
        ceremonyFilm.id,
        fullVideoCoverage.id,
        hairMakeup.id,
        additionalHairMakeup.id,
        enhancedFlorals.id,
        floralInstallation.id,
        liveMusicCeremony.id,
        djSoundSystem.id,
        unityCandle.id,
        sandCeremony.id,
        handfasting.id,
        heirloomAlbum.id,
        printSet.id,
        wallArt.id,
      ]);

      // All-Inclusive Micro - all add-ons
      await linkAddOnsToPackage(tx, allInclusiveMicro.id, [
        extraPhotoHour.id,
        secondPhotographer.id,
        fullVideoCoverage.id,
        hairMakeup.id,
        additionalHairMakeup.id,
        enhancedFlorals.id,
        floralInstallation.id,
        liveMusicCeremony.id,
        djSoundSystem.id,
        unityCandle.id,
        sandCeremony.id,
        handfasting.id,
        privateChef.id,
        heirloomAlbum.id,
        printSet.id,
        wallArt.id,
        engagementSession.id,
        dayAfterSession.id,
      ]);

      // Full Wedding: Ceremony & Portraits
      await linkAddOnsToPackage(tx, ceremonyPortraitsFull.id, [
        extraPhotoHour.id,
        secondPhotographer.id,
        ceremonyFilm.id,
        hairMakeup.id,
        additionalHairMakeup.id,
        enhancedFlorals.id,
        liveMusicCeremony.id,
        unityCandle.id,
        sandCeremony.id,
        handfasting.id,
        printSet.id,
      ]);

      // Classic Wedding Day - comprehensive
      await linkAddOnsToPackage(tx, classicWeddingDay.id, [
        extraPhotoHour.id,
        secondPhotographer.id,
        ceremonyFilm.id,
        fullVideoCoverage.id,
        hairMakeup.id,
        additionalHairMakeup.id,
        enhancedFlorals.id,
        floralInstallation.id,
        liveMusicCeremony.id,
        djSoundSystem.id,
        unityCandle.id,
        sandCeremony.id,
        handfasting.id,
        heirloomAlbum.id,
        printSet.id,
        wallArt.id,
        engagementSession.id,
      ]);

      // Signature All-Inclusive - all add-ons available
      await linkAddOnsToPackage(tx, signatureAllInclusive.id, [
        extraPhotoHour.id,
        secondPhotographer.id,
        fullVideoCoverage.id,
        additionalHairMakeup.id,
        enhancedFlorals.id,
        floralInstallation.id,
        liveMusicCeremony.id,
        djSoundSystem.id,
        unityCandle.id,
        sandCeremony.id,
        handfasting.id,
        privateChef.id,
        heirloomAlbum.id,
        printSet.id,
        wallArt.id,
        dayAfterSession.id,
      ]);

      logger.info('Add-ons linked to packages');

      // =====================================================================
      // BLACKOUT DATES (holidays)
      // =====================================================================
      const holidays2025 = [
        { date: new Date('2025-12-24T00:00:00Z'), reason: 'Christmas Eve' },
        { date: new Date('2025-12-25T00:00:00Z'), reason: 'Christmas Day' },
        { date: new Date('2025-12-31T00:00:00Z'), reason: "New Year's Eve" },
      ];

      const holidays2026 = [
        { date: new Date('2026-01-01T00:00:00Z'), reason: "New Year's Day" },
        { date: new Date('2026-07-04T00:00:00Z'), reason: 'Independence Day' },
        { date: new Date('2026-11-26T00:00:00Z'), reason: 'Thanksgiving' },
        { date: new Date('2026-12-24T00:00:00Z'), reason: 'Christmas Eve' },
        { date: new Date('2026-12-25T00:00:00Z'), reason: 'Christmas Day' },
        { date: new Date('2026-12-31T00:00:00Z'), reason: "New Year's Eve" },
      ];

      await Promise.all(
        [...holidays2025, ...holidays2026].map((holiday) =>
          tx.blackoutDate.upsert({
            where: { tenantId_date: { date: holiday.date, tenantId: tenant.id } },
            update: { reason: holiday.reason },
            create: { date: holiday.date, reason: holiday.reason, tenantId: tenant.id },
          })
        )
      );

      logger.info(`Blackout dates created: ${holidays2025.length + holidays2026.length}`);
    },
    { timeout: 120000 } // 2-minute timeout for comprehensive seed
  );

  logger.info(
    {
      slug: TENANT_SLUG,
      durationMs: Date.now() - startTime,
    },
    'La Petit Mariage seed transaction committed successfully'
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
  logger.info('LA PETIT MARIAGE SEED COMPLETE');
  logger.info('='.repeat(60));
  logger.info('Segments: 3 (Elopements, Micro Weddings, Full Weddings)');
  logger.info('Packages: 9 (3 per segment)');
  logger.info('Add-ons: 21 (global, linked to relevant packages)');
  logger.info('Blackout dates: 9 (major holidays 2025-2026)');
  logger.info('='.repeat(60));
}
