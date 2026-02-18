/**
 * Little Bit Farm seed — Elopements, Corporate Retreats & Weekend Getaways
 *
 * Use for: Production tenant setup for Little Bit Farm (littlebit.farm)
 *
 * Pricing model:
 *   Displayed prices are "all-in" and INCLUDE Airbnb accommodation ($200/night).
 *   Checkout collects ONLY the experience portion = (display_total - airbnb_total).
 *   Airbnb booking happens separately via link after checkout.
 *
 * Segments:
 * 1. Elopements & Vow Renewals
 *    - Simple Ceremony ($1,000 all-in, $800 experience) — max 6, flat
 *    - Celebration Ceremony (From $1,700 all-in, $1,500 experience) — max 10, grazing +$25/pp
 *    - Ceremony + Open Fire Dinner (From $2,200 all-in, $2,000 experience) — max 10, dinner +$75/pp
 *
 * 2. Corporate Retreats
 *    - Focused Day ($600 all-in, $400 experience) — max 10, flat
 *    - Hosted Day Retreat ($1,200 all-in, $1,000 experience) — max 10, flat
 *    - Retreat + Fireside Dinner (From $1,800 all-in, $1,600 experience) — max 10, dinner +$75/pp
 *
 * 3. Weekend Getaway (Girls Weekend positioning)
 *    - Girls Weekend ($800 all-in, $600 experience) — max 10, flat
 *    - Girls Weekend + Dinner (From $1,200 all-in, $1,000 experience) — max 10, dinner +$75/pp
 *
 * House Rules: No parties, no amplified music, no horse riding.
 * Parking: Max 4 cars — shuttle available for larger groups.
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

// Dinner per-person rate (consistent across all segments)
const DINNER_PER_PERSON_CENTS = 7500; // $75/person

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

// Shared house rules + parking text for all segment descriptions
const HOUSE_RULES =
  'House rules: No parties, no amplified music, no horse riding. Max 4 cars on the property — we arrange nearby parking and a shuttle for larger groups.';

const AIRBNB_PRICING_NOTE =
  'All-in pricing includes Airbnb accommodation ($200/night). At checkout, you pay only the experience portion — Airbnb is booked separately via link after purchase.';

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
    { slug: TENANT_SLUG, operations: 'segment+tiers+sections' },
    'Starting Little Bit Farm seed transaction'
  );
  const startTime = Date.now();

  await prisma.$transaction(
    async (tx) => {
      // Generate or reuse API keys INSIDE transaction
      let publicKey: string;
      let secretKey: string | null = null;

      if (existingTenant) {
        publicKey = existingTenant.apiKeyPublic;
        logger.info('Little Bit Farm tenant exists - updating within transaction');
      } else {
        publicKey = `pk_live_${TENANT_SLUG}_${crypto.randomBytes(8).toString('hex')}`;
        secretKey = `sk_live_${TENANT_SLUG}_${crypto.randomBytes(16).toString('hex')}`;
        logger.info('Creating new Little Bit Farm tenant with generated keys');
      }

      // Create or update tenant
      const tenant = await createOrUpdateTenant(tx, {
        slug: TENANT_SLUG,
        name: 'Little Bit Farm',
        email: 'Adele502@gmail.com',
        commissionPercent: 5.0,
        apiKeyPublic: publicKey,
        apiKeySecret: secretKey ?? undefined,
        // Brand colors - luxury warm palette
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
        description: `${AIRBNB_PRICING_NOTE}\n\n${HOUSE_RULES}`,
        metaTitle: 'Elopements & Vow Renewals | Little Bit Farm',
        metaDescription:
          'Intimate elopement ceremonies on our farm. All-in pricing from $1,000 including accommodation. Max 10 guests.',
        sortOrder: 0,
      });

      logger.info(`Segment created: ${elopementsSegment.name}`);

      // Tier 1: Simple Ceremony — $1,000 all-in, max 6, flat
      const simpleCeremony = await createOrUpdateTierWithSegment(
        tx,
        tenant.id,
        elopementsSegment.id,
        {
          slug: 'simple-ceremony',
          name: 'Simple Ceremony',
          description: [
            'Includes:',
            '• Quiet ceremony in the pasture with horses nearby',
            '• Officiant',
            '• Simple floral setup — archway with minimal florals and 1 bouquet',
            '• Champagne toast for the couple',
            '',
            'Max 6 guests.',
          ].join('\n'),
          priceCents: 100000 - AIRBNB_COST_CENTS, // $800 experience
          displayPriceCents: 100000, // $1,000 all-in
          maxGuests: 6,
          features: [
            { text: 'Quiet ceremony in the pasture with horses nearby', highlighted: false },
            { text: 'Officiant', highlighted: false },
            {
              text: 'Simple floral setup — archway with minimal florals and 1 bouquet',
              highlighted: false,
            },
            { text: 'Champagne toast for the couple', highlighted: false },
          ],
          sortOrder: 1,
        }
      );

      // Tier 2: Celebration Ceremony — From $1,700 all-in, max 10, grazing +$25/pp
      const celebrationCeremony = await createOrUpdateTierWithSegment(
        tx,
        tenant.id,
        elopementsSegment.id,
        {
          slug: 'celebration-ceremony',
          name: 'Celebration Ceremony',
          description: [
            'Includes:',
            '• Quiet ceremony in the pasture with horses nearby',
            '• Officiant',
            '• Enhanced florals and 2 bouquets',
            '• Grazing board and 3 bottles of champagne',
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
            { text: 'Quiet ceremony in the pasture with horses nearby', highlighted: false },
            { text: 'Officiant', highlighted: false },
            { text: 'Enhanced florals and 2 bouquets', highlighted: true },
            { text: 'Grazing board and 3 bottles of champagne', highlighted: true },
          ],
          sortOrder: 2,
        }
      );

      // Tier 3: Ceremony + Open Fire Dinner — From $2,200 all-in, max 10, dinner +$75/pp
      const ceremonyDinner = await createOrUpdateTierWithSegment(
        tx,
        tenant.id,
        elopementsSegment.id,
        {
          slug: 'ceremony-open-fire-dinner',
          name: 'Ceremony + Open Fire Dinner',
          description: [
            'Includes:',
            '• Quiet ceremony in the pasture with horses nearby',
            '• Officiant',
            '• Enhanced florals and 3 bouquets',
            '• Champagne toast and charcuterie',
            '• Open fire dinner for 2 — choice of protein, salad, and veggies',
            '• Table setup with linens, flowers, candles, and dinnerware',
            '',
            'Additional dinner guests $75 each (up to 10).',
            'Max 10 guests.',
          ].join('\n'),
          priceCents: 220000 - AIRBNB_COST_CENTS, // $2,000 experience
          displayPriceCents: 220000, // $2,200 all-in
          maxGuests: 10,
          scalingRules: {
            components: [
              {
                name: 'Open Fire Dinner',
                includedGuests: 2,
                perPersonCents: DINNER_PER_PERSON_CENTS, // $75/person
                maxGuests: 10,
              },
            ],
          },
          features: [
            { text: 'Quiet ceremony in the pasture with horses nearby', highlighted: false },
            { text: 'Officiant', highlighted: false },
            { text: 'Enhanced florals and 3 bouquets', highlighted: true },
            { text: 'Champagne toast and charcuterie', highlighted: true },
            {
              text: 'Open fire dinner for 2 — choice of protein, salad, and veggies',
              highlighted: true,
            },
            {
              text: 'Table setup with linens, flowers, candles, and dinnerware',
              highlighted: true,
            },
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
        description: `${AIRBNB_PRICING_NOTE}\n\n${HOUSE_RULES}`,
        metaTitle: 'Corporate Retreats | Little Bit Farm',
        metaDescription:
          'Corporate day retreats on our farm. Meeting setup, yoga, guided horse experiences, and fireside meals. All-in pricing from $600.',
        sortOrder: 1,
      });

      logger.info(`Segment created: ${corporateSegment.name}`);

      // Tier 1: Focused Day — $600 all-in, max 10, flat
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

      // Tier 2: Hosted Day Retreat — $1,200 all-in, max 10, flat
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

      // Tier 3: Retreat + Fireside Dinner — From $1,800 all-in, max 10, dinner +$75/pp
      const retreatDinner = await createOrUpdateTierWithSegment(
        tx,
        tenant.id,
        corporateSegment.id,
        {
          slug: 'retreat-fireside-dinner',
          name: 'Retreat + Fireside Dinner',
          description: [
            'Includes:',
            '• Everything in Hosted Day Retreat',
            '• Open fire dinner prepared tableside',
            '',
            'Dinner for 2 included. Additional guests $75/person (up to 10).',
            'Max 10 guests.',
          ].join('\n'),
          priceCents: 180000 - AIRBNB_COST_CENTS, // $1,600 experience
          displayPriceCents: 180000, // $1,800 all-in
          maxGuests: 10,
          scalingRules: {
            components: [
              {
                name: 'Open Fire Dinner',
                includedGuests: 2,
                perPersonCents: DINNER_PER_PERSON_CENTS, // $75/person
                maxGuests: 10,
              },
            ],
          },
          features: [
            { text: 'Everything in Hosted Day Retreat', highlighted: false },
            { text: 'Open fire dinner prepared tableside', highlighted: true },
          ],
          sortOrder: 3,
        }
      );

      logger.info(
        `Corporate tiers: ${[focusedDay, hostedDayRetreat, retreatDinner].map((t) => t.name).join(', ')}`
      );

      // =====================================================================
      // SEGMENT 3: WEEKEND GETAWAY (Girls Weekend positioning)
      // =====================================================================
      const weekendSegment = await createOrUpdateSegment(tx, tenant.id, {
        slug: 'weekend_getaway',
        name: 'Weekend Getaway',
        heroTitle: 'Escape. Experience. Exhale.',
        heroSubtitle:
          'A weekend on the farm with your favorite people — flowers, yoga, horses, and good food.',
        description: `${AIRBNB_PRICING_NOTE}\n\n${HOUSE_RULES}`,
        metaTitle: 'Weekend Getaway | Little Bit Farm',
        metaDescription:
          'Weekend farm getaways with flowers, yoga, horse interactions, and open fire dinners. All-in pricing from $800.',
        sortOrder: 2,
      });

      logger.info(`Segment created: ${weekendSegment.name}`);

      // Tier 1: Girls Weekend — $800 all-in, max 10, flat
      const girlsWeekend = await createOrUpdateTierWithSegment(tx, tenant.id, weekendSegment.id, {
        slug: 'girls-weekend',
        name: 'Girls Weekend',
        description: [
          'Includes:',
          '• Welcome coffee, pastries, and fruit',
          '• Interaction with horses if desired',
          '• Floral design class with fresh flowers to take home OR 2 yoga classes',
          '• Light lunch',
          '• Free time for hiking or relaxing',
          '',
          'Max 10 guests.',
        ].join('\n'),
        priceCents: 80000 - AIRBNB_COST_CENTS, // $600 experience
        displayPriceCents: 80000, // $800 all-in
        maxGuests: 10,
        features: [
          { text: 'Welcome coffee, pastries, and fruit', highlighted: false },
          { text: 'Interaction with horses', highlighted: false },
          { text: 'Floral design class OR 2 yoga classes', highlighted: true },
          { text: 'Light lunch', highlighted: false },
          { text: 'Free time for hiking or relaxing', highlighted: false },
        ],
        sortOrder: 1,
      });

      // Tier 2: Girls Weekend + Dinner — From $1,200 all-in, max 10, dinner +$75/pp
      const girlsWeekendDinner = await createOrUpdateTierWithSegment(
        tx,
        tenant.id,
        weekendSegment.id,
        {
          slug: 'girls-weekend-dinner',
          name: 'Girls Weekend + Dinner',
          description: [
            'Includes:',
            '• Everything in Girls Weekend',
            '• Open fire dinner — choice of protein, salad, veggies, and wine',
            '',
            'Dinner for 2 included. Additional guests $75/person (up to 10).',
            'Max 10 guests.',
          ].join('\n'),
          priceCents: 120000 - AIRBNB_COST_CENTS, // $1,000 experience
          displayPriceCents: 120000, // $1,200 all-in
          maxGuests: 10,
          scalingRules: {
            components: [
              {
                name: 'Open Fire Dinner',
                includedGuests: 2,
                perPersonCents: DINNER_PER_PERSON_CENTS, // $75/person
                maxGuests: 10,
              },
            ],
          },
          features: [
            { text: 'Everything in Girls Weekend', highlighted: false },
            {
              text: 'Open fire dinner — choice of protein, salad, veggies, and wine',
              highlighted: true,
            },
          ],
          sortOrder: 2,
        }
      );

      logger.info(
        `Weekend tiers: ${[girlsWeekend, girlsWeekendDinner].map((t) => t.name).join(', ')}`
      );

      // =====================================================================
      // SECTION CONTENT — Storefront blocks
      // =====================================================================

      // --- HERO (order 0) ---
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
            headline: 'Where the noise stops.',
            subheadline: 'A quiet horse farm for ceremonies, retreats, and weekends away.',
            ctaText: 'Explore Experiences',
            alignment: 'center',
            backgroundImage:
              'https://images.unsplash.com/photo-1553284965-83fd3e82fa5a?w=1920&h=1080&fit=crop&q=80',
          },
        },
      });

      // --- HOW IT WORKS (order 1) ---
      await tx.sectionContent.create({
        data: {
          tenantId: tenant.id,
          blockType: 'FEATURES',
          pageName: 'home',
          order: 1,
          isDraft: false,
          publishedAt: new Date(),
          content: {
            visible: true,
            title: 'How It Works',
            subtitle: 'Four steps to your perfect farm experience',
            layout: 'cards',
            columns: 4,
            items: [
              {
                id: 'step-1',
                title: 'Choose Your Experience',
                description:
                  'Browse our ceremonies, retreats, and weekend getaways to find the right fit for your group.',
                icon: 'Sparkles',
              },
              {
                id: 'step-2',
                title: 'Book With Us',
                description:
                  'Reserve your date and experience. We handle everything on-site — setup, hosting, and coordination.',
                icon: 'CreditCard',
              },
              {
                id: 'step-3',
                title: 'Reserve Your Stay',
                description:
                  'Book your Airbnb accommodation via the link we send. The $200/night stay covers property access and insurance.',
                icon: 'Calendar',
              },
              {
                id: 'step-4',
                title: 'Show Up and Exhale',
                description:
                  'Arrive, meet the horses, and let the farm do the rest. We keep things small so it feels like yours.',
                icon: 'Star',
              },
            ],
          },
        },
      });

      // --- ABOUT (order 2) ---
      await tx.sectionContent.create({
        data: {
          tenantId: tenant.id,
          blockType: 'ABOUT',
          pageName: 'home',
          order: 2,
          isDraft: false,
          publishedAt: new Date(),
          content: {
            visible: true,
            title: 'The Story',
            body: [
              "Little Bit Farm started with a simple idea — share the horses and the property with people who'd appreciate it.",
              "The owner spent years in sales, dreaming up creative ideas for other people's businesses. Eventually she asked the obvious question: why not build something of her own?",
              "The farm is small by design. Natural. A little bit different. First-timers always say the same thing — it's the quiet that gets you. Then the horses walk over, and you realize you can actually touch them.",
              'Today the farm hosts ceremonies, retreats, and weekend getaways for people from all walks of life. The one thing they tend to have in common: a love for nature and animals, and a need to slow down.',
              "We keep things small — small groups, quiet land, no rush. It's what makes this place feel like yours.",
            ].join('\n\n'),
            image:
              'https://images.unsplash.com/photo-1598974357801-cbca100e65d3?w=800&h=600&fit=crop&q=80',
            imagePosition: 'right',
          },
        },
      });

      // --- SERVICES / Experiences (order 3) ---
      await tx.sectionContent.create({
        data: {
          tenantId: tenant.id,
          blockType: 'SERVICES',
          pageName: 'home',
          order: 3,
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

      // --- FAQ (order 4) ---
      await tx.sectionContent.create({
        data: {
          tenantId: tenant.id,
          blockType: 'FAQ',
          pageName: 'home',
          order: 4,
          isDraft: false,
          publishedAt: new Date(),
          content: {
            visible: true,
            title: 'Common Questions',
            items: [
              {
                id: 'faq-pricing',
                question: 'How does pricing work?',
                answer:
                  "Our prices are all-in and include an Airbnb stay ($200/night) that covers property access, insurance, and overnight accommodation if you'd like. You book the experience with us, then reserve your Airbnb stay via the link we send. At checkout, you pay only the experience portion.",
              },
              {
                id: 'faq-stay',
                question: 'Where do we stay?',
                answer:
                  "The farm has a cozy Airbnb that sleeps 2-3. You'll book it through Airbnb after purchasing your experience. The booking covers property access, insurance, and overnight accommodation.",
              },
              {
                id: 'faq-horses',
                question: 'Can we ride the horses?',
                answer:
                  "The horses are here to enjoy, not ride. You can groom them, walk alongside them, and spend as much time near them as you'd like. They're friendly and curious — they'll come to you.",
              },
              {
                id: 'faq-parking',
                question: 'How many cars can we bring?',
                answer:
                  "We keep the property quiet with a maximum of 4 cars in the driveway. For larger groups, we'll arrange nearby parking and a shuttle so everyone arrives stress-free.",
              },
              {
                id: 'faq-wear',
                question: 'What should I wear?',
                answer:
                  'Comfortable clothes and closed-toe shoes for walking near the horses. The farm is casual — come as you are.',
              },
              {
                id: 'faq-weather',
                question: 'What happens if it rains?',
                answer:
                  'We have covered areas on the property. Most experiences can be adapted for weather, and sometimes the rain makes it even more beautiful.',
              },
            ],
          },
        },
      });

      // --- CTA (order 5) ---
      await tx.sectionContent.create({
        data: {
          tenantId: tenant.id,
          blockType: 'CTA',
          pageName: 'home',
          order: 5,
          isDraft: false,
          publishedAt: new Date(),
          content: {
            visible: true,
            headline: 'Ready to visit?',
            subheadline: "Pick your experience and we'll handle the rest.",
            buttonText: 'Browse Experiences',
            style: 'primary',
          },
        },
      });

      logger.info(
        'Section content created: HERO, FEATURES (How It Works), ABOUT (The Story), SERVICES, FAQ, CTA'
      );

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
    'Little Bit Farm seed transaction committed successfully'
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
  logger.info('LITTLE BIT FARM SEED COMPLETE');
  logger.info('='.repeat(60));
  logger.info('Segments: 3');
  logger.info('  - Elopements & Vow Renewals (3 tiers: flat + grazing + dinner scaling)');
  logger.info('  - Corporate Retreats (3 tiers: flat + flat + dinner scaling)');
  logger.info('  - Weekend Getaway / Girls Weekend (2 tiers: flat + dinner scaling)');
  logger.info('Tiers: 8 total (3 + 3 + 2)');
  logger.info('Pricing: All-in (includes Airbnb $200/night)');
  logger.info('  Dinner scaling: $75/person beyond 2 included');
  logger.info('  Checkout charges experience portion only');
  logger.info('Section content: HERO, FEATURES (How It Works), ABOUT, SERVICES, FAQ, CTA');
  logger.info(`Blackout dates: ${6}`);
  logger.info('='.repeat(60));
}
