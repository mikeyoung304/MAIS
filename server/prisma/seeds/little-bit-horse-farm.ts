/**
 * littlebit.farm seed — Elopements, Corporate Retreats & Weekend Getaways
 *
 * Use for: Production tenant setup for littlebit.farm
 *
 * Pricing model:
 *   Displayed prices are "all-in" and INCLUDE Airbnb accommodation ($200/night).
 *   Checkout collects ONLY the experience portion = (display_total - airbnb_total).
 *   Airbnb booking happens separately via link after checkout.
 *
 * Segments:
 * 1. Elopements & Vow Renewals
 *    - Simple Ceremony ($1,000 all-in, $800 experience) — max 6
 *    - Celebration Ceremony ($1,700 all-in, $1,500 experience) — max 10
 *    - Ceremony + Private Chef Dinner ($2,500 all-in, $2,300 experience) — max 10
 *
 * 2. Corporate Retreats
 *    - Focused Day ($600 all-in, $400 experience) — max 10
 *    - Hosted Day Retreat ($1,200 all-in, $1,000 experience) — max 10
 *    - Retreat + Meal ($1,800 all-in, $1,600 experience) — max 10
 *
 * 3. Weekend Getaway
 *    - Hosted Stay ($500 all-in, $300 experience) — max 10
 *    - Guided Getaway ($1,000 all-in, $800 experience) — max 10
 *    - Curated Weekend ($1,600 all-in, $1,400 experience) — max 10
 *
 * House Rules: No parties, no amplified music, no horse riding.
 *
 * IMPORTANT: API keys are only generated once on first seed. Re-running this seed
 * will preserve existing keys to avoid breaking environments.
 */

import type { PrismaClient, Segment, Tier } from '../../src/generated/prisma/client';
import * as crypto from 'crypto';
import { logger } from '../../src/lib/core/logger';
import { createOrUpdateTenant } from './utils';

// Fixed slug for littlebit.farm tenant
const TENANT_SLUG = 'littlebit-farm';

// Airbnb cost in cents (fixed $200/night)
const AIRBNB_COST_CENTS = 20000;

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
 * Create or update a tier with full field support
 * Supports displayPriceCents, maxGuests, scalingRules, and features
 */
async function createOrUpdateTierWithSegment(
  prisma: PrismaOrTransaction,
  tenantId: string,
  segmentId: string,
  options: {
    slug: string;
    name: string;
    description: string;
    priceCents: number;
    displayPriceCents?: number;
    maxGuests?: number;
    scalingRules?: {
      components: Array<{
        name: string;
        includedGuests: number;
        perPersonCents: number;
        maxGuests?: number;
      }>;
    } | null;
    features?: Array<{ text: string; highlighted: boolean }>;
    sortOrder: number;
    photos?: Array<{ url: string; filename: string; size: number; order: number }>;
  }
): Promise<Tier> {
  const {
    slug,
    name,
    description,
    priceCents,
    displayPriceCents,
    maxGuests,
    scalingRules,
    features = [],
    sortOrder,
    photos = [],
  } = options;

  const data = {
    name,
    description,
    priceCents,
    displayPriceCents: displayPriceCents ?? null,
    maxGuests: maxGuests ?? null,
    scalingRules: scalingRules ?? undefined,
    segmentId,
    sortOrder,
    photos,
    features,
  };

  return prisma.tier.upsert({
    where: { tenantId_slug: { slug, tenantId } },
    update: data,
    create: {
      tenantId,
      slug,
      ...data,
    },
  });
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
    { slug: TENANT_SLUG, operations: 'segment+tiers' },
    'Starting littlebit.farm seed transaction'
  );
  const startTime = Date.now();

  await prisma.$transaction(
    async (tx) => {
      // Generate or reuse API keys INSIDE transaction
      let publicKey: string;
      let secretKey: string | null = null;

      if (existingTenant) {
        publicKey = existingTenant.apiKeyPublic;
        logger.info('littlebit.farm tenant exists - updating within transaction');
      } else {
        publicKey = `pk_live_${TENANT_SLUG}_${crypto.randomBytes(8).toString('hex')}`;
        secretKey = `sk_live_${TENANT_SLUG}_${crypto.randomBytes(16).toString('hex')}`;
        logger.info('Creating new littlebit.farm tenant with generated keys');
      }

      // Create or update tenant
      const tenant = await createOrUpdateTenant(tx, {
        slug: TENANT_SLUG,
        name: 'littlebit.farm',
        email: 'Adele502@gmail.com',
        commissionPercent: 5.0,
        apiKeyPublic: publicKey,
        apiKeySecret: secretKey ?? undefined,
        // Brand colors - luxury warm palette (uses new defaults showcase)
        primaryColor: '#1C1917', // Warm stone-black
        secondaryColor: '#A78B5A', // Muted gold
        accentColor: '#5A7C65', // Deep sage (WCAG AA)
        backgroundColor: '#FAFAF7', // Warm ivory
      });

      publicKeyForLogging = publicKey;
      secretKeyForLogging = secretKey;

      logger.info(`Tenant ${existingTenant ? 'updated' : 'created'}: ${tenant.name}`);

      // =====================================================================
      // Clean slate — delete existing data
      // =====================================================================
      await tx.tierAddOn.deleteMany({ where: { tier: { tenantId: tenant.id } } });
      await tx.tier.deleteMany({ where: { tenantId: tenant.id } });
      await tx.addOn.deleteMany({ where: { tenantId: tenant.id } });
      // Delete section content before segments (FK constraint)
      await tx.sectionContent.deleteMany({ where: { tenantId: tenant.id } });
      await tx.segment.deleteMany({ where: { tenantId: tenant.id } });

      logger.info('Cleared existing data for clean slate');

      // =====================================================================
      // SEGMENT 1: ELOPEMENTS & VOW RENEWALS
      // =====================================================================
      const elopementsSegment = await createOrUpdateSegment(tx, tenant.id, {
        slug: 'elopements',
        name: 'Elopements & Vow Renewals',
        heroTitle: 'Simple. Calm. Beautiful.',
        heroSubtitle:
          'Intimate ceremonies on the farm — just you, your person, and a beautiful moment.',
        description:
          'All-in pricing includes Airbnb accommodation ($200/night). At checkout, you pay only the experience portion — Airbnb is booked separately via link after purchase.\n\nHouse rules: No parties, no amplified music, no horse riding.',
        metaTitle: 'Elopements & Vow Renewals | littlebit.farm',
        metaDescription:
          'Intimate elopement ceremonies on our farm. All-in pricing from $1,000 including accommodation. Max 10 guests.',
        sortOrder: 0,
      });

      logger.info(`Segment created: ${elopementsSegment.name}`);

      // Tier 1: Simple Ceremony — $1,000 all-in, max 6
      const simpleCeremony = await createOrUpdateTierWithSegment(
        tx,
        tenant.id,
        elopementsSegment.id,
        {
          slug: 'simple-ceremony',
          name: 'Simple Ceremony',
          description: [
            'Includes:',
            '• Quiet ceremony on the property',
            '• Officiant',
            '• Simple floral setup (ceremony arch + minimal florals)',
            '• Champagne toast for the couple',
            '',
            'Max 6 guests.',
          ].join('\n'),
          priceCents: 100000 - AIRBNB_COST_CENTS, // $800 experience
          displayPriceCents: 100000, // $1,000 all-in
          maxGuests: 6,
          features: [
            { text: 'Quiet ceremony on the property', highlighted: false },
            { text: 'Officiant', highlighted: false },
            { text: 'Simple floral setup (ceremony arch + minimal florals)', highlighted: false },
            { text: 'Champagne toast for the couple', highlighted: false },
          ],
          sortOrder: 1,
        }
      );

      // Tier 2: Celebration Ceremony — $1,700 all-in, max 10
      const celebrationCeremony = await createOrUpdateTierWithSegment(
        tx,
        tenant.id,
        elopementsSegment.id,
        {
          slug: 'celebration-ceremony',
          name: 'Celebration Ceremony',
          description: [
            'Includes:',
            '• Everything in Simple Ceremony',
            '• Champagne + grazing board for your group',
            '• Enhanced floral design (fuller ceremony arch + upgraded personal florals)',
            '',
            'Grazing includes 2 people, +$25 per additional guest (up to 10).',
            'Max 10 guests.',
          ].join('\n'),
          priceCents: 170000 - AIRBNB_COST_CENTS, // $1,500 experience
          displayPriceCents: 170000, // $1,700 all-in
          maxGuests: 10,
          scalingRules: {
            components: [
              {
                name: 'Grazing Board',
                includedGuests: 2,
                perPersonCents: 2500, // $25/person
                maxGuests: 10,
              },
            ],
          },
          features: [
            { text: 'Everything in Simple Ceremony', highlighted: false },
            { text: 'Champagne + grazing board for your group', highlighted: true },
            { text: 'Enhanced floral design (fuller arch + upgraded florals)', highlighted: true },
          ],
          sortOrder: 2,
        }
      );

      // Tier 3: Ceremony + Private Chef Dinner — $2,500 all-in, max 10
      const ceremonyDinner = await createOrUpdateTierWithSegment(
        tx,
        tenant.id,
        elopementsSegment.id,
        {
          slug: 'ceremony-chef-dinner',
          name: 'Ceremony + Private Chef Dinner',
          description: [
            'Includes:',
            '• Everything in Celebration Ceremony',
            '• Private chef dinner',
            '• Guests may bring their own photographer (photography not included)',
            '',
            'Dinner is priced per person (defaults to 2 people). $110/person for 2–10.',
            'Max 10 guests.',
          ].join('\n'),
          priceCents: 250000 - AIRBNB_COST_CENTS, // $2,300 experience
          displayPriceCents: 250000, // $2,500 all-in
          maxGuests: 10,
          scalingRules: {
            components: [
              {
                name: 'Private Chef Dinner',
                includedGuests: 2,
                perPersonCents: 11000, // $110/person
                maxGuests: 10,
              },
            ],
          },
          features: [
            { text: 'Everything in Celebration Ceremony', highlighted: false },
            { text: 'Private chef dinner', highlighted: true },
            { text: 'BYO photographer welcome (photography not included)', highlighted: false },
          ],
          sortOrder: 3,
        }
      );

      logger.info(
        `Elopement tiers: ${[simpleCeremony, celebrationCeremony, ceremonyDinner].map((t) => t.name).join(', ')}`
      );

      // =====================================================================
      // SEGMENT 2: CORPORATE RETREATS
      // =====================================================================
      const corporateSegment = await createOrUpdateSegment(tx, tenant.id, {
        slug: 'corporate_retreats',
        name: 'Corporate Retreats',
        heroTitle: 'Reset. Reconnect. Return Stronger.',
        heroSubtitle: 'Day retreats on the farm — horses, yoga, nature, and great food.',
        description:
          'All-in pricing includes Airbnb accommodation ($200/night). At checkout, you pay only the experience portion — Airbnb is booked separately via link after purchase.\n\nHouse rules: No parties, no amplified music, no horse riding.',
        metaTitle: 'Corporate Retreats | littlebit.farm',
        metaDescription:
          'Corporate day retreats on our farm. Meeting setup, yoga, guided horse experiences, and private chef meals. All-in pricing from $600.',
        sortOrder: 1,
      });

      logger.info(`Segment created: ${corporateSegment.name}`);

      // Tier 1: Focused Day — $600 all-in, max 10
      const focusedDay = await createOrUpdateTierWithSegment(tx, tenant.id, corporateSegment.id, {
        slug: 'focused-day',
        name: 'Focused Day',
        description: [
          'Includes:',
          '• Day retreat on the property',
          '• Setup for meetings, yoga, or discussion',
          '• Quiet-use guidelines',
          '• Light horse experience: grooming + guided horse walk',
          '',
          'Max 10 guests.',
        ].join('\n'),
        priceCents: 60000 - AIRBNB_COST_CENTS, // $400 experience
        displayPriceCents: 60000, // $600 all-in
        maxGuests: 10,
        features: [
          { text: 'Day retreat on the property', highlighted: false },
          { text: 'Setup for meetings, yoga, or discussion', highlighted: false },
          { text: 'Quiet-use guidelines', highlighted: false },
          { text: 'Light horse experience: grooming + guided horse walk', highlighted: false },
        ],
        sortOrder: 1,
      });

      // Tier 2: Hosted Day Retreat — $1,200 all-in, max 10
      const hostedDayRetreat = await createOrUpdateTierWithSegment(
        tx,
        tenant.id,
        corporateSegment.id,
        {
          slug: 'hosted-day-retreat',
          name: 'Hosted Day Retreat',
          description: [
            'Includes:',
            '• Everything in Focused Day',
            '• Coffee + pastries + grazing board',
            '• One guided experience (choose one): yoga OR trail walk OR extended horse time',
            '',
            'Max 10 guests.',
          ].join('\n'),
          priceCents: 120000 - AIRBNB_COST_CENTS, // $1,000 experience
          displayPriceCents: 120000, // $1,200 all-in
          maxGuests: 10,
          features: [
            { text: 'Everything in Focused Day', highlighted: false },
            { text: 'Coffee + pastries + grazing board', highlighted: true },
            {
              text: 'One guided experience: yoga OR trail walk OR extended horse time',
              highlighted: true,
            },
          ],
          sortOrder: 2,
        }
      );

      // Tier 3: Retreat + Meal — $1,800 all-in, max 10
      const retreatMeal = await createOrUpdateTierWithSegment(tx, tenant.id, corporateSegment.id, {
        slug: 'retreat-meal',
        name: 'Retreat + Meal',
        description: [
          'Includes:',
          '• Everything in Hosted Day Retreat',
          '• Private chef lunch or dinner',
          '',
          'Meal priced per person (defaults to 2 people). $90/person for 2; $70–$120/person for 3–10 (menu dependent).',
          'Max 10 guests.',
        ].join('\n'),
        priceCents: 180000 - AIRBNB_COST_CENTS, // $1,600 experience
        displayPriceCents: 180000, // $1,800 all-in
        maxGuests: 10,
        scalingRules: {
          components: [
            {
              name: 'Private Chef Meal',
              includedGuests: 2,
              perPersonCents: 9000, // $90/person (base rate)
              maxGuests: 10,
            },
          ],
        },
        features: [
          { text: 'Everything in Hosted Day Retreat', highlighted: false },
          { text: 'Private chef lunch or dinner', highlighted: true },
        ],
        sortOrder: 3,
      });

      logger.info(
        `Corporate tiers: ${[focusedDay, hostedDayRetreat, retreatMeal].map((t) => t.name).join(', ')}`
      );

      // =====================================================================
      // SEGMENT 3: WEEKEND GETAWAY
      // =====================================================================
      const weekendSegment = await createOrUpdateSegment(tx, tenant.id, {
        slug: 'weekend_getaway',
        name: 'Weekend Getaway',
        heroTitle: 'Escape. Experience. Exhale.',
        heroSubtitle: 'Farm experiences for families, friends, and couples who need a reset.',
        description:
          'All-in pricing includes Airbnb accommodation ($200/night). At checkout, you pay only the experience portion — Airbnb is booked separately via link after purchase.\n\nHouse rules: No parties, no amplified music, no horse riding.',
        metaTitle: 'Weekend Getaway | littlebit.farm',
        metaDescription:
          'Weekend farm getaways with guided experiences, horse interactions, yoga, and private chef meals. All-in pricing from $500.',
        sortOrder: 2,
      });

      logger.info(`Segment created: ${weekendSegment.name}`);

      // Tier 1: Hosted Stay — $500 all-in, max 10
      const hostedStay = await createOrUpdateTierWithSegment(tx, tenant.id, weekendSegment.id, {
        slug: 'hosted-stay',
        name: 'Hosted Stay',
        description: [
          'Includes:',
          '• Welcome experience',
          '• One horse experience: grooming + guided horse walk',
          '• Light hosting and arrival curation',
          '',
          'Max 10 guests.',
        ].join('\n'),
        priceCents: 50000 - AIRBNB_COST_CENTS, // $300 experience
        displayPriceCents: 50000, // $500 all-in
        maxGuests: 10,
        features: [
          { text: 'Welcome experience', highlighted: false },
          { text: 'One horse experience: grooming + guided horse walk', highlighted: false },
          { text: 'Light hosting and arrival curation', highlighted: false },
        ],
        sortOrder: 1,
      });

      // Tier 2: Guided Getaway — $1,000 all-in, max 10
      const guidedGetaway = await createOrUpdateTierWithSegment(tx, tenant.id, weekendSegment.id, {
        slug: 'guided-getaway',
        name: 'Guided Getaway',
        description: [
          'Includes:',
          '• Everything in Hosted Stay',
          '• Two guided experiences (choose any two): yoga, trail hike, extended horse time, wreath making OR bouquet design',
          '',
          'Floral workshop includes materials for 2 people, +$60 per additional participant.',
          'Max 10 guests.',
        ].join('\n'),
        priceCents: 100000 - AIRBNB_COST_CENTS, // $800 experience
        displayPriceCents: 100000, // $1,000 all-in
        maxGuests: 10,
        scalingRules: {
          components: [
            {
              name: 'Floral Workshop',
              includedGuests: 2,
              perPersonCents: 6000, // $60/person
              maxGuests: 10,
            },
          ],
        },
        features: [
          { text: 'Everything in Hosted Stay', highlighted: false },
          { text: 'Two guided experiences (choose any two)', highlighted: true },
        ],
        sortOrder: 2,
      });

      // Tier 3: Curated Weekend — $1,600 all-in, max 10
      const curatedWeekend = await createOrUpdateTierWithSegment(tx, tenant.id, weekendSegment.id, {
        slug: 'curated-weekend',
        name: 'Curated Weekend',
        description: [
          'Includes:',
          '• Everything in Guided Getaway',
          '• Curated weekend flow planned for you',
          '• One premium floral workshop (wreath OR bouquet design)',
          '• Private chef lunch or dinner',
          '',
          'Floral workshop includes materials for 2 people, +$60 per additional participant.',
          'Meal priced per person (defaults to 2 people). $90/person for 2; $60–$150/person for 3–10 (menu dependent).',
          'Max 10 guests.',
        ].join('\n'),
        priceCents: 160000 - AIRBNB_COST_CENTS, // $1,400 experience
        displayPriceCents: 160000, // $1,600 all-in
        maxGuests: 10,
        scalingRules: {
          components: [
            {
              name: 'Floral Workshop',
              includedGuests: 2,
              perPersonCents: 6000, // $60/person
              maxGuests: 10,
            },
            {
              name: 'Private Chef Meal',
              includedGuests: 2,
              perPersonCents: 9000, // $90/person (base rate)
              maxGuests: 10,
            },
          ],
        },
        features: [
          { text: 'Everything in Guided Getaway', highlighted: false },
          { text: 'Curated weekend flow planned for you', highlighted: true },
          { text: 'One premium floral workshop (wreath OR bouquet design)', highlighted: true },
          { text: 'Private chef lunch or dinner', highlighted: true },
        ],
        sortOrder: 3,
      });

      logger.info(
        `Weekend tiers: ${[hostedStay, guidedGetaway, curatedWeekend].map((t) => t.name).join(', ')}`
      );

      // =====================================================================
      // SECTION CONTENT — Storefront blocks
      // =====================================================================
      await tx.sectionContent.create({
        data: {
          tenantId: tenant.id,
          blockType: 'HERO',
          pageName: 'home',
          order: 0,
          isDraft: false,
          publishedAt: new Date(),
          content: {
            visible: true,
            headline: 'littlebit.farm',
            subheadline: 'Ceremonies, retreats, and getaways on a quiet farm.',
            ctaText: 'Explore Experiences',
            alignment: 'center',
          },
        },
      });

      await tx.sectionContent.create({
        data: {
          tenantId: tenant.id,
          blockType: 'ABOUT',
          pageName: 'home',
          order: 1,
          isDraft: false,
          publishedAt: new Date(),
          content: {
            visible: true,
            title: 'How It Works',
            body: "All prices shown are all-in and include Airbnb accommodation ($200/night). At checkout, you book and pay for the experience portion only. After checkout, you'll receive a link to book the Airbnb separately.\n\nMax group size is 10 (6 for Simple Ceremony elopements). House rules: no parties, no amplified music, no horse riding.",
            imagePosition: 'right',
          },
        },
      });

      await tx.sectionContent.create({
        data: {
          tenantId: tenant.id,
          blockType: 'SERVICES',
          pageName: 'home',
          order: 2,
          isDraft: false,
          publishedAt: new Date(),
          content: {
            visible: true,
            title: 'Experiences',
            subtitle: 'Choose the experience that fits your group',
            layout: 'cards',
            showPricing: true,
          },
        },
      });

      logger.info('Section content created: HERO, ABOUT (How It Works), SERVICES');

      // =====================================================================
      // BLACKOUT DATES (holidays)
      // =====================================================================
      const holidays = [
        { date: new Date('2026-03-01'), reason: 'Maintenance' },
        { date: new Date('2026-07-04'), reason: 'Independence Day' },
        { date: new Date('2026-11-26'), reason: 'Thanksgiving' },
        { date: new Date('2026-12-24'), reason: 'Christmas Eve' },
        { date: new Date('2026-12-25'), reason: 'Christmas Day' },
        { date: new Date('2026-12-31'), reason: "New Year's Eve" },
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
    { slug: TENANT_SLUG, durationMs: Date.now() - startTime },
    'littlebit.farm seed transaction committed successfully'
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
  logger.info('LITTLEBIT.FARM SEED COMPLETE');
  logger.info('='.repeat(60));
  logger.info('Segments: 3');
  logger.info('  - Elopements & Vow Renewals (max 6–10, flat + scaling)');
  logger.info('  - Corporate Retreats (max 10, flat + scaling)');
  logger.info('  - Weekend Getaway (max 10, flat + scaling)');
  logger.info('Tiers: 9 total (3 per segment)');
  logger.info('Pricing: All-in (includes Airbnb $200/night)');
  logger.info('  Checkout charges experience portion only');
  logger.info('Section content: HERO, ABOUT (How It Works), SERVICES');
  logger.info(`Blackout dates: ${6}`);
  logger.info('='.repeat(60));
}
