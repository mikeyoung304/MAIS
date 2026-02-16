/**
 * Plate Catering seed - Premium Private Catering Services
 *
 * Use for: Production tenant setup for Plate. (platemacon.com)
 *
 * Segments:
 * 1. Weddings - Custom menus for couples' special day
 *    - The Ceremony Bite (cocktail reception) - $55/person
 *    - The Reception (full dinner service) - $125/person
 *    - The Grand Affair (multi-course plated) - $195/person
 *
 * 2. Social Events - Celebrations & gatherings
 *    - The Gathering (light bites) - $45/person
 *    - The Celebration (full buffet) - $85/person
 *    - The Experience (chef-attended stations) - $150/person
 *
 * 3. Corporate Events - Business dining excellence
 *    - The Business Lunch (boxed/buffet) - $35/person
 *    - The Executive Spread (full service) - $75/person
 *    - The Boardroom (premium plated) - $140/person
 *
 * IMPORTANT: API keys are only generated once on first seed. Re-running this seed
 * will preserve existing keys to avoid breaking environments.
 */

import type { PrismaClient, Segment, Tier, AddOn } from '../../src/generated/prisma/client';
import * as crypto from 'crypto';
import { logger } from '../../src/lib/core/logger';
import { createOrUpdateTenant } from './utils';

// Fixed slug for Plate tenant
const TENANT_SLUG = 'plate';

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
 * Create or update a tier with segment association
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
    sortOrder: number;
    photos?: Array<{ url: string; filename: string; size: number; order: number }>;
  }
): Promise<Tier> {
  const { slug, name, description, priceCents, sortOrder, photos = [] } = options;

  return prisma.tier.upsert({
    where: { tenantId_slug: { slug, tenantId } },
    update: {
      name,
      description,
      priceCents,
      segmentId,
      sortOrder,
      photos: JSON.stringify(photos),
    },
    create: {
      tenantId,
      segmentId,
      slug,
      name,
      description,
      priceCents,
      sortOrder,
      features: JSON.stringify([]),
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
 * Link add-ons to a tier
 */
async function linkAddOnsToTier(
  prisma: PrismaOrTransaction,
  tierId: string,
  addOnIds: string[]
): Promise<void> {
  await Promise.all(
    addOnIds.map((addOnId) =>
      prisma.tierAddOn.upsert({
        where: { tierId_addOnId: { tierId, addOnId } },
        update: {},
        create: { tierId, addOnId },
      })
    )
  );
}

export async function seedPlate(prisma: PrismaClient): Promise<void> {
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
    { slug: TENANT_SLUG, operations: 'segments+tiers+addons' },
    'Starting Plate seed transaction'
  );
  const startTime = Date.now();

  await prisma.$transaction(
    async (tx) => {
      // Generate or reuse API keys INSIDE transaction
      let publicKey: string;
      let secretKey: string | null = null;

      if (existingTenant) {
        publicKey = existingTenant.apiKeyPublic;
        logger.info('Plate tenant exists - updating within transaction');
      } else {
        publicKey = `pk_live_${TENANT_SLUG}_${crypto.randomBytes(8).toString('hex')}`;
        secretKey = `sk_live_${TENANT_SLUG}_${crypto.randomBytes(16).toString('hex')}`;
        logger.info('Creating new Plate tenant with generated keys');
      }

      // Create or update tenant
      // Brand colors inspired by Plate's sophisticated, warm aesthetic
      const tenant = await createOrUpdateTenant(tx, {
        slug: TENANT_SLUG,
        name: 'Plate.',
        email: 'hello@platemacon.com',
        commissionPercent: 8.0,
        apiKeyPublic: publicKey,
        apiKeySecret: secretKey ?? undefined,
        // Brand colors - sophisticated, warm, culinary
        primaryColor: '#2c2c2c', // Charcoal black
        secondaryColor: '#c4a35a', // Warm gold
        accentColor: '#8b4513', // Saddle brown
        backgroundColor: '#faf8f5', // Warm cream
      });

      publicKeyForLogging = publicKey;
      secretKeyForLogging = secretKey;

      logger.info(`Tenant ${existingTenant ? 'updated' : 'created'}: ${tenant.name}`);

      // =====================================================================
      // Delete existing tiers, add-ons, and segments for clean slate
      // =====================================================================
      await tx.tierAddOn.deleteMany({
        where: { tier: { tenantId: tenant.id } },
      });
      await tx.tier.deleteMany({
        where: { tenantId: tenant.id },
      });
      await tx.addOn.deleteMany({
        where: { tenantId: tenant.id },
      });
      await tx.segment.deleteMany({
        where: { tenantId: tenant.id },
      });

      logger.info('Cleared existing Plate tiers, add-ons, and segments');

      // =====================================================================
      // SEGMENT 1: WEDDINGS
      // =====================================================================
      const weddingsSegment = await createOrUpdateSegment(tx, tenant.id, {
        slug: 'weddings',
        name: 'Weddings',
        heroTitle: 'Your Day. Your Menu. Your Story.',
        heroSubtitle:
          'Custom menus reflecting your tastes, cultural celebrations, and the journey that brought you together.',
        description:
          'From intimate elopements to grand celebrations, Chef Mike crafts personalized wedding menus that tell your love story through food. Every dish is designed in consultation with you to create an unforgettable culinary experience.',
        metaTitle: 'Wedding Catering | Plate. Macon',
        metaDescription:
          'Premium wedding catering in Macon, Georgia. Custom menus designed by Chef Mike with 20 years of international culinary experience. From cocktail receptions to multi-course plated dinners.',
        sortOrder: 0,
      });

      logger.info(`Segment created: ${weddingsSegment.name}`);

      // Wedding tiers (3 tiers)
      const ceremonyBite = await createOrUpdateTierWithSegment(tx, tenant.id, weddingsSegment.id, {
        slug: 'ceremony-bite',
        name: 'The Ceremony Bite',
        description: `An elegant cocktail reception for couples who want memorable bites without a formal sit-down.

Includes:
• Pre-event consultation with Chef Mike
• 5 passed hors d'oeuvres selections
• 2 stationary displays (cheese & charcuterie)
• Professional service staff
• Setup and breakdown
• All serviceware and linens

Perfect for: Cocktail receptions, rehearsal dinners, or post-ceremony celebrations.
Minimum 25 guests. Pricing is per person.`,
        priceCents: 5500, // $55/person
        sortOrder: 1,
        photos: [
          {
            url: 'https://images.unsplash.com/photo-1530062845289-9109b2c9c868',
            filename: 'ceremony-bite.jpg',
            size: 0,
            order: 0,
          },
        ],
      });

      const reception = await createOrUpdateTierWithSegment(tx, tenant.id, weddingsSegment.id, {
        slug: 'reception',
        name: 'The Reception',
        description: `Full dinner service that brings restaurant-quality dining to your venue.

Everything in The Ceremony Bite, plus:
• Custom 3-course dinner menu
• Choice of plated or family-style service
• Chef-designed menu tasting (for couples)
• Personalized printed menus
• Dietary accommodation for all guests
• Extended service hours (5 hours)

Perfect for: Traditional wedding receptions, anniversary celebrations.
Minimum 50 guests. Pricing is per person.`,
        priceCents: 12500, // $125/person
        sortOrder: 2,
        photos: [
          {
            url: 'https://images.unsplash.com/photo-1519225421980-715cb0215aed',
            filename: 'reception.jpg',
            size: 0,
            order: 0,
          },
        ],
      });

      const grandAffair = await createOrUpdateTierWithSegment(tx, tenant.id, weddingsSegment.id, {
        slug: 'grand-affair',
        name: 'The Grand Affair',
        description: `The ultimate culinary celebration for couples who want nothing but the best.

Everything in The Reception, plus:
• 5-course plated dinner with wine pairings
• Amuse-bouche and intermezzo courses
• Chef's table experience during tasting
• Premium ingredients (wagyu, lobster, truffle available)
• Dedicated on-site chef throughout event
• Late-night snack station
• Day-of coordination with venue

Perfect for: Luxury weddings, milestone celebrations.
Minimum 75 guests. Pricing is per person.`,
        priceCents: 19500, // $195/person
        sortOrder: 3,
        photos: [
          {
            url: 'https://images.unsplash.com/photo-1464366400600-7168b8af9bc3',
            filename: 'grand-affair.jpg',
            size: 0,
            order: 0,
          },
        ],
      });

      logger.info(
        `Wedding tiers created: ${[ceremonyBite, reception, grandAffair].map((p) => p.name).join(', ')}`
      );

      // =====================================================================
      // SEGMENT 2: SOCIAL EVENTS
      // =====================================================================
      const socialSegment = await createOrUpdateSegment(tx, tenant.id, {
        slug: 'social-events',
        name: 'Social Events',
        heroTitle: 'Want to Create Something Memorable?',
        heroSubtitle:
          'From intimate gatherings to grand celebrations, we bring the five-star dining experience to you.',
        description:
          'Cocktail parties, anniversaries, holiday celebrations, fundraisers, and intimate dinner parties. Whatever the occasion, Chef Mike creates custom menus that make every gathering unforgettable.',
        metaTitle: 'Social Event Catering | Plate. Macon',
        metaDescription:
          'Private event catering in Macon. Cocktail parties, anniversaries, holiday celebrations, and intimate gatherings. Chef-crafted menus with international flair.',
        sortOrder: 1,
      });

      logger.info(`Segment created: ${socialSegment.name}`);

      // Social event tiers (3 tiers)
      const gathering = await createOrUpdateTierWithSegment(tx, tenant.id, socialSegment.id, {
        slug: 'gathering',
        name: 'The Gathering',
        description: `Light bites and passed appetizers for casual yet elegant entertaining.

Includes:
• Menu consultation call
• 4 passed hors d'oeuvres selections
• 1 stationary display
• Professional service staff (1 per 25 guests)
• Setup and breakdown
• 3-hour service window

Perfect for: Cocktail parties, open houses, after-work gatherings.
Minimum 15 guests. Pricing is per person.`,
        priceCents: 4500, // $45/person
        sortOrder: 1,
        photos: [
          {
            url: 'https://images.unsplash.com/photo-1414235077428-338989a2e8c0',
            filename: 'gathering.jpg',
            size: 0,
            order: 0,
          },
        ],
      });

      const celebration = await createOrUpdateTierWithSegment(tx, tenant.id, socialSegment.id, {
        slug: 'celebration',
        name: 'The Celebration',
        description: `Full buffet service with chef-curated stations for memorable entertaining.

Everything in The Gathering, plus:
• Full dinner buffet with 3 entree options
• 2 chef-attended action stations
• Fresh salad and sides
• Dessert display
• 4-hour service window
• Upgraded serviceware

Perfect for: Birthday parties, anniversaries, holiday parties.
Minimum 30 guests. Pricing is per person.`,
        priceCents: 8500, // $85/person
        sortOrder: 2,
        photos: [
          {
            url: 'https://images.unsplash.com/photo-1555244162-803834f70033',
            filename: 'celebration.jpg',
            size: 0,
            order: 0,
          },
        ],
      });

      const experience = await createOrUpdateTierWithSegment(tx, tenant.id, socialSegment.id, {
        slug: 'experience',
        name: 'The Experience',
        description: `An immersive culinary journey with chef-attended stations and plated courses.

Everything in The Celebration, plus:
• Passed hors d'oeuvres hour
• 4 chef-attended live cooking stations
• Interactive food experiences
• Plated dessert course
• Premium bar coordination
• 5-hour service window
• On-site chef presence throughout

Perfect for: Milestone birthdays, engagement parties, fundraising galas.
Minimum 40 guests. Pricing is per person.`,
        priceCents: 15000, // $150/person
        sortOrder: 3,
        photos: [
          {
            url: 'https://images.unsplash.com/photo-1504674900247-0877df9cc836',
            filename: 'experience.jpg',
            size: 0,
            order: 0,
          },
        ],
      });

      logger.info(
        `Social tiers created: ${[gathering, celebration, experience].map((p) => p.name).join(', ')}`
      );

      // =====================================================================
      // SEGMENT 3: CORPORATE EVENTS
      // =====================================================================
      const corporateSegment = await createOrUpdateSegment(tx, tenant.id, {
        slug: 'corporate-events',
        name: 'Corporate Events',
        heroTitle: 'Impress While You Accomplish.',
        heroSubtitle:
          'Full-service catering designed to complement your business agenda while impressing every guest.',
        description:
          "Board meetings, client dinners, product launches, and corporate retreats. We understand that business dining is about more than food\u2014it's about creating an environment for success.",
        metaTitle: 'Corporate Catering | Plate. Macon',
        metaDescription:
          'Corporate event catering in Macon. Business lunches, client dinners, product launches, and executive retreats. Professional service that reflects your brand.',
        sortOrder: 2,
      });

      logger.info(`Segment created: ${corporateSegment.name}`);

      // Corporate event tiers (3 tiers)
      const businessLunch = await createOrUpdateTierWithSegment(
        tx,
        tenant.id,
        corporateSegment.id,
        {
          slug: 'business-lunch',
          name: 'The Business Lunch',
          description: `Efficient, professional catering that keeps your team focused and fed.

Includes:
• Choice of boxed lunches OR buffet setup
• 2 entree options with sides
• Vegetarian option included
• Beverages (coffee, tea, water, soft drinks)
• Professional setup and cleanup
• Recyclable/compostable packaging available

Perfect for: Working lunches, team meetings, training sessions.
Minimum 10 guests. Pricing is per person.`,
          priceCents: 3500, // $35/person
          sortOrder: 1,
          photos: [
            {
              url: 'https://images.unsplash.com/photo-1567521464027-f127ff144326',
              filename: 'business-lunch.jpg',
              size: 0,
              order: 0,
            },
          ],
        }
      );

      const executiveSpread = await createOrUpdateTierWithSegment(
        tx,
        tenant.id,
        corporateSegment.id,
        {
          slug: 'executive-spread',
          name: 'The Executive Spread',
          description: `Elevated corporate dining for meetings that matter.

Everything in The Business Lunch, plus:
• Full buffet with 3 entree options
• Fresh salad station
• Dessert selection
• Premium beverage service
• Dedicated service staff
• 3-hour service window
• Branded menu cards available

Perfect for: Client meetings, board lunches, department celebrations.
Minimum 20 guests. Pricing is per person.`,
          priceCents: 7500, // $75/person
          sortOrder: 2,
          photos: [
            {
              url: 'https://images.unsplash.com/photo-1517248135467-4c7edcad34c4',
              filename: 'executive-spread.jpg',
              size: 0,
              order: 0,
            },
          ],
        }
      );

      const boardroom = await createOrUpdateTierWithSegment(tx, tenant.id, corporateSegment.id, {
        slug: 'boardroom',
        name: 'The Boardroom',
        description: `Premium plated service for executive-level entertaining.

Everything in The Executive Spread, plus:
• 3-course plated dinner
• Wine pairing available
• Chef consultation for menu customization
• Premium proteins and seasonal ingredients
• Full bar coordination
• Valet coordination available
• 4-hour service window
• Post-event cleanup to venue specifications

Perfect for: Client dinners, executive retreats, investor meetings.
Minimum 12 guests. Pricing is per person.`,
        priceCents: 14000, // $140/person
        sortOrder: 3,
        photos: [
          {
            url: 'https://images.unsplash.com/photo-1560472354-b33ff0c44a43',
            filename: 'boardroom.jpg',
            size: 0,
            order: 0,
          },
        ],
      });

      logger.info(
        `Corporate tiers created: ${[businessLunch, executiveSpread, boardroom].map((p) => p.name).join(', ')}`
      );

      // =====================================================================
      // ADD-ONS: 15 Total (Global - available to all tiers)
      // =====================================================================

      // Bar Services (4)
      const beerWineBar = await createOrUpdateAddOn(tx, tenant.id, {
        slug: 'beer-wine-bar',
        name: 'Beer & Wine Bar',
        description: 'Curated selection of wines and craft beers with bartender service',
        price: 2500, // $25/person
      });

      const fullBar = await createOrUpdateAddOn(tx, tenant.id, {
        slug: 'full-bar',
        name: 'Full Bar Service',
        description: 'Complete bar with premium spirits, mixers, and professional bartenders',
        price: 4500, // $45/person
      });

      const signatureCocktails = await createOrUpdateAddOn(tx, tenant.id, {
        slug: 'signature-cocktails',
        name: 'Signature Cocktail Menu',
        description: 'Two custom cocktails designed for your event, named for your occasion',
        price: 1200, // $12/person
      });

      const champagneToast = await createOrUpdateAddOn(tx, tenant.id, {
        slug: 'champagne-toast',
        name: 'Champagne Toast',
        description: 'Premium champagne service for toasts and celebrations',
        price: 1500, // $15/person
      });

      // Desserts & Sweets (3)
      const dessertStation = await createOrUpdateAddOn(tx, tenant.id, {
        slug: 'dessert-station',
        name: 'Dessert Station',
        description: 'Artisan dessert display with mini pastries, truffles, and petit fours',
        price: 1800, // $18/person
      });

      const lateNightSnacks = await createOrUpdateAddOn(tx, tenant.id, {
        slug: 'late-night-snacks',
        name: 'Late Night Snack Station',
        description: 'Sliders, tacos, or comfort food served late in the evening',
        price: 2200, // $22/person
      });

      const customCake = await createOrUpdateAddOn(tx, tenant.id, {
        slug: 'custom-cake',
        name: 'Custom Cake Design',
        description: 'Wedding or celebration cake from our partner bakery (priced per serving)',
        price: 1200, // $12/person
      });

      // Service Upgrades (4)
      const premiumLinens = await createOrUpdateAddOn(tx, tenant.id, {
        slug: 'premium-linens',
        name: 'Premium Linens & China',
        description: 'Upgraded table linens, fine china, and crystal glassware',
        price: 1500, // $15/person
      });

      const additionalStaff = await createOrUpdateAddOn(tx, tenant.id, {
        slug: 'additional-staff',
        name: 'Additional Service Staff',
        description: 'Extra servers for higher-touch service (per server for 4 hours)',
        price: 25000, // $250 flat
      });

      const valetCoordination = await createOrUpdateAddOn(tx, tenant.id, {
        slug: 'valet-coordination',
        name: 'Valet Coordination',
        description: 'We coordinate with local valet services for seamless arrivals',
        price: 50000, // $500 flat
      });

      const menuTasting = await createOrUpdateAddOn(tx, tenant.id, {
        slug: 'menu-tasting',
        name: 'Private Menu Tasting',
        description: 'In-home or at-venue tasting experience for up to 4 guests',
        price: 35000, // $350 flat
      });

      // Dietary & Special (4)
      const kosherMenu = await createOrUpdateAddOn(tx, tenant.id, {
        slug: 'kosher-menu',
        name: 'Kosher Menu Options',
        description: 'Kosher-certified menu items prepared according to dietary laws',
        price: 2000, // $20/person
      });

      const veganMenu = await createOrUpdateAddOn(tx, tenant.id, {
        slug: 'vegan-menu',
        name: 'Full Vegan Menu',
        description: 'Complete plant-based menu designed by Chef Mike',
        price: 0, // Included in base
      });

      const allergenMenu = await createOrUpdateAddOn(tx, tenant.id, {
        slug: 'allergen-menu',
        name: 'Allergen-Free Adaptations',
        description: 'Custom adaptations for gluten-free, nut-free, or other allergen needs',
        price: 0, // Included in base
      });

      const kidsMenu = await createOrUpdateAddOn(tx, tenant.id, {
        slug: 'kids-menu',
        name: "Kids' Menu",
        description: 'Child-friendly menu options for guests under 12',
        price: 2500, // $25/child
      });

      logger.info('Add-ons created: 15');

      // =====================================================================
      // LINK ALL ADD-ONS TO ALL TIERS
      // =====================================================================
      const allAddOnIds = [
        beerWineBar.id,
        fullBar.id,
        signatureCocktails.id,
        champagneToast.id,
        dessertStation.id,
        lateNightSnacks.id,
        customCake.id,
        premiumLinens.id,
        additionalStaff.id,
        valetCoordination.id,
        menuTasting.id,
        kosherMenu.id,
        veganMenu.id,
        allergenMenu.id,
        kidsMenu.id,
      ];

      const allTierIds = [
        ceremonyBite.id,
        reception.id,
        grandAffair.id,
        gathering.id,
        celebration.id,
        experience.id,
        businessLunch.id,
        executiveSpread.id,
        boardroom.id,
      ];

      await Promise.all(allTierIds.map((tierId) => linkAddOnsToTier(tx, tierId, allAddOnIds)));

      logger.info(
        `Add-ons linked: ${allAddOnIds.length} add-ons x ${allTierIds.length} tiers = ${allAddOnIds.length * allTierIds.length} links`
      );

      // =====================================================================
      // BLACKOUT DATES (holidays when catering is unavailable)
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
    'Plate seed transaction committed successfully'
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
  logger.info('PLATE CATERING SEED COMPLETE');
  logger.info('='.repeat(60));
  logger.info('Segments: 3 (Weddings, Social Events, Corporate Events)');
  logger.info('Tiers: 9 (3 tiers x 3 segments)');
  logger.info('Add-ons: 15 (global, linked to all tiers)');
  logger.info('TierAddOn links: 135');
  logger.info('Blackout dates: 6 (major holidays 2025-2026)');
  logger.info('='.repeat(60));
}
