/**
 * Macon Headshots seed — Headshot Photography in Macon, GA
 *
 * Use for: Production tenant setup for Macon Headshots (maconheadshots)
 *
 * Pricing model:
 *   1 Segment: Headshot Photography
 *   3 Tiers:
 *     - Individual Session ($200, DATE 60min, flat)
 *     - Group In-Studio ($500 base for 3 people, DATE 120min, +$100/person)
 *     - On-Location ($1,500 minimum, DATE, 10 headshots included, +$100/headshot)
 *
 * Single-segment mode — frontend auto-skips segment selection.
 *
 * IMPORTANT: API keys are only generated once on first seed. Re-running this seed
 * will preserve existing keys to avoid breaking environments.
 */

import type { PrismaClient } from '../../src/generated/prisma/client';
import * as crypto from 'crypto';
import { logger } from '../../src/lib/core/logger';
import {
  createOrUpdateTenant,
  createOrUpdateSegment,
  createOrUpdateTierWithSegment,
} from './utils';

const TENANT_SLUG = 'maconheadshots';

export async function seedMaconHeadshots(prisma: PrismaClient): Promise<void> {
  // Production guard - prevent accidental data destruction
  if (process.env.NODE_ENV === 'production' && process.env.ALLOW_PRODUCTION_SEED !== 'true') {
    throw new Error('Production seed blocked. Set ALLOW_PRODUCTION_SEED=true to override.');
  }

  let publicKeyForLogging: string;
  let secretKeyForLogging: string | null = null;

  logger.info(
    { slug: TENANT_SLUG, operations: 'segment+tiers+sections' },
    'Starting Macon Headshots seed transaction'
  );
  const startTime = Date.now();

  await prisma.$transaction(
    async (tx) => {
      // Read existing tenant INSIDE transaction to prevent stale reads (#11006)
      const existingTenant = await tx.tenant.findUnique({
        where: { slug: TENANT_SLUG },
      });

      // Generate or reuse API keys
      let publicKey: string;
      let secretKey: string | null = null;

      if (existingTenant) {
        publicKey = existingTenant.apiKeyPublic;
        logger.info('Macon Headshots tenant exists - updating within transaction');
      } else {
        publicKey = `pk_live_${TENANT_SLUG}_${crypto.randomBytes(8).toString('hex')}`;
        secretKey = `sk_live_${TENANT_SLUG}_${crypto.randomBytes(16).toString('hex')}`;
        logger.info('Creating new Macon Headshots tenant with generated keys');
      }

      // Create or update tenant
      const tenant = await createOrUpdateTenant(tx, {
        slug: TENANT_SLUG,
        name: 'Macon Headshots',
        email: 'mike@maconheadshots.com',
        commissionPercent: 5.0,
        apiKeyPublic: publicKey,
        apiKeySecret: secretKey ?? undefined,
        primaryColor: '#1C1917', // Warm stone-black
        secondaryColor: '#A78B5A', // Muted gold
        accentColor: '#5A7C65', // Deep sage
        backgroundColor: '#FAFAF7', // Warm ivory
      });

      publicKeyForLogging = publicKey;
      secretKeyForLogging = secretKey;

      logger.info(`Tenant ${existingTenant ? 'updated' : 'created'}: ${tenant.name}`);

      // =====================================================================
      // Clean slate — delete existing data (with booking safety guard)
      // =====================================================================
      const bookingCount = await tx.booking.count({
        where: { tier: { tenantId: tenant.id } },
      });

      if (bookingCount > 0) {
        logger.warn(
          { bookingCount, tenantId: tenant.id },
          'Bookings exist — skipping destructive deleteMany, using upsert-only mode'
        );
        await tx.sectionContent.deleteMany({ where: { tenantId: tenant.id } });
      } else {
        await tx.tierAddOn.deleteMany({ where: { tier: { tenantId: tenant.id } } });
        await tx.tier.deleteMany({ where: { tenantId: tenant.id } });
        await tx.addOn.deleteMany({ where: { tenantId: tenant.id } });
        await tx.sectionContent.deleteMany({ where: { tenantId: tenant.id } });
        await tx.segment.deleteMany({ where: { tenantId: tenant.id } });
        logger.info('Cleared existing data for clean slate');
      }

      // =====================================================================
      // SEGMENT: Headshot Photography (single segment — auto-skip)
      // =====================================================================
      const headshotsSegment = await createOrUpdateSegment(tx, tenant.id, {
        slug: 'headshots',
        name: 'Headshot Photography',
        heroTitle: 'Premier Headshot Photography',
        heroSubtitle: 'Serving Macon, Middle Georgia, and Beyond',
        heroImage:
          'https://images.unsplash.com/photo-1604881991720-f91add269bed?w=1200&h=800&fit=crop&q=80',
        metaTitle: 'Headshot Photography | Macon Headshots',
        metaDescription:
          'Professional headshot photography in Macon, GA. Individual, group, and on-location sessions. Transform the un-photogenic into unforgettable.',
        sortOrder: 0,
      });

      logger.info(`Segment created: ${headshotsSegment.name}`);

      // =====================================================================
      // TIER 1: Individual Session — $200, DATE 60min, flat
      // =====================================================================
      const individualTier = await createOrUpdateTierWithSegment(
        tx,
        tenant.id,
        headshotsSegment.id,
        {
          slug: 'individual',
          name: 'Individual Session',
          description: [
            'A relaxed, one-on-one headshot session with no time limit.',
            '',
            'Includes:',
            '• Live image review during shoot',
            '• Expression coaching throughout',
            '• Multiple outfits welcome',
            '• 5-7 day retouching turnaround',
            '• Images purchased separately ($100 each)',
          ].join('\n'),
          priceCents: 20000, // $200
          bookingType: 'DATE',
          durationMinutes: 60,
          photos: [
            {
              url: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=800&h=600&fit=crop&q=80',
              filename: 'individual-session.jpg',
              size: 120000,
              order: 0,
            },
          ],
          features: [
            { text: 'No time limit', highlighted: false },
            { text: 'Live image review', highlighted: false },
            { text: 'Expression coaching', highlighted: false },
            { text: 'Multiple outfits welcome', highlighted: false },
            { text: '5-7 day retouching turnaround', highlighted: false },
            { text: 'Images purchased separately ($100 each)', highlighted: true },
          ],
          sortOrder: 1,
        }
      );

      // =====================================================================
      // TIER 2: Group In-Studio — $500 base (3 people), DATE 120min, +$100/person
      // =====================================================================
      const groupTier = await createOrUpdateTierWithSegment(tx, tenant.id, headshotsSegment.id, {
        slug: 'group',
        name: 'Group In-Studio',
        description: [
          'Group headshot session for teams, departments, or friend groups.',
          '',
          '3 people included in base price. +$100 per additional person.',
          '',
          'Includes:',
          '• 1 retouched headshot per person',
          '• Come together or schedule separately',
          '• Live review & expression coaching',
        ].join('\n'),
        priceCents: 50000, // $500
        bookingType: 'DATE',
        durationMinutes: 120,
        scalingRules: {
          components: [
            {
              name: 'Additional Person',
              includedGuests: 3,
              perPersonCents: 10000, // $100/person
            },
          ],
        },
        photos: [
          {
            url: 'https://images.unsplash.com/photo-1600880292203-757bb62b4baf?w=800&h=600&fit=crop&q=80',
            filename: 'group-session.jpg',
            size: 130000,
            order: 0,
          },
        ],
        features: [
          { text: '3 people included', highlighted: true },
          { text: '+$100 per additional person', highlighted: false },
          { text: '1 retouched headshot per person', highlighted: true },
          { text: 'Come together or schedule separately', highlighted: false },
          { text: 'Live review & expression coaching', highlighted: false },
        ],
        sortOrder: 2,
      });

      // =====================================================================
      // TIER 3: On-Location — $1,500 minimum, DATE, 10 headshots included, +$100/headshot
      // =====================================================================
      const onLocationTier = await createOrUpdateTierWithSegment(
        tx,
        tenant.id,
        headshotsSegment.id,
        {
          slug: 'on-location',
          name: 'On-Location',
          description: [
            'Professional studio brought to your office, campus, or event venue.',
            '',
            '10 headshots included in base price. +$100 per additional headshot.',
            '',
            'Includes:',
            '• Full studio setup at your location',
            '• Group photos & portraits available',
            '• Complete setup & teardown',
          ].join('\n'),
          priceCents: 150000, // $1,500
          bookingType: 'DATE',
          durationMinutes: null,
          scalingRules: {
            components: [
              {
                name: 'Additional Headshot',
                includedGuests: 10,
                perPersonCents: 10000, // $100/headshot
              },
            ],
          },
          photos: [
            {
              url: 'https://images.unsplash.com/photo-1497366216548-37526070297c?w=800&h=600&fit=crop&q=80',
              filename: 'on-location.jpg',
              size: 140000,
              order: 0,
            },
          ],
          features: [
            { text: 'Professional studio brought to your location', highlighted: true },
            { text: '10 headshots included', highlighted: true },
            { text: '+$100 per additional headshot', highlighted: false },
            { text: 'Group photos & portraits', highlighted: false },
            { text: 'Full setup & teardown', highlighted: false },
          ],
          sortOrder: 3,
        }
      );

      logger.info(
        `Tiers created: ${[individualTier, groupTier, onLocationTier].map((t) => t.name).join(', ')}`
      );

      // =====================================================================
      // SECTION CONTENT — 6 storefront blocks (all published)
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
            headline: 'Premier Headshot Photography',
            subheadline: 'Serving Macon, Middle Georgia, and Beyond',
            ctaText: 'See Options',
            alignment: 'center',
            backgroundImage:
              'https://images.unsplash.com/photo-1604881991720-f91add269bed?w=1920&h=1080&fit=crop&q=80',
          },
        },
      });

      // --- ABOUT (order 1) ---
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
            title: 'Your Hype Man Behind the Camera',
            image:
              'https://images.unsplash.com/photo-1542038784456-1ea8e935640e?w=800&h=600&fit=crop&q=80',
            body: [
              'Most people walk in saying the same thing: "I\'m not photogenic." That\'s where I come in.',
              "I'm Mike — a headshot photographer who specializes in transforming the un-photogenic into unforgettable. My job isn't just to take your photo. It's to coach you through every expression, every angle, until we land on the shot that makes you say \"that's me.\"",
              'Every session is relaxed, guided, and judgment-free. You get live review so nothing is a mystery. And when we find the shot — you know it.',
              "Whether you're updating LinkedIn, launching a business, or just want a photo that actually looks like you on a good day — I've got you.",
            ].join('\n\n'),
            imagePosition: 'right',
          },
        },
      });

      // --- FEATURES / How It Works (order 2) ---
      await tx.sectionContent.create({
        data: {
          tenantId: tenant.id,
          blockType: 'FEATURES',
          pageName: 'home',
          order: 2,
          isDraft: false,
          publishedAt: new Date(),
          content: {
            visible: true,
            title: 'How It Works',
            subtitle: 'Three steps to a headshot you actually like',
            layout: 'cards',
            columns: 3,
            items: [
              {
                id: 'step-schedule',
                title: 'Schedule',
                description:
                  'Pick your session type and book a time that works. Individual, group, or on-location — your call.',
                icon: 'Calendar',
              },
              {
                id: 'step-shoot',
                title: 'Shoot',
                description:
                  'Show up, relax, and let me coach you through it. Live review on a big screen so you see every shot in real time.',
                icon: 'Camera',
              },
              {
                id: 'step-select',
                title: 'Select',
                description:
                  'Review your retouched images and pick the ones you love. Delivered digitally, ready for LinkedIn, your website, or print.',
                icon: 'Star',
              },
            ],
          },
        },
      });

      // --- SERVICES (order 3) ---
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
            title: 'Our Sessions',
            subtitle: 'Pick the session that fits your needs',
            layout: 'cards',
            showPricing: true,
          },
        },
      });

      // --- TESTIMONIALS (order 4) ---
      await tx.sectionContent.create({
        data: {
          tenantId: tenant.id,
          blockType: 'TESTIMONIALS',
          pageName: 'home',
          order: 4,
          isDraft: false,
          publishedAt: new Date(),
          content: {
            visible: true,
            title: 'What Clients Say',
            layout: 'grid',
            items: [
              {
                id: 'testimonial-comfort',
                authorName: 'Sarah M.',
                authorRole: 'Real Estate Agent',
                image:
                  'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=400&h=400&fit=crop&q=80',
                quote:
                  "I've avoided professional photos my entire career. Mike made it painless — actually fun. The coaching made all the difference.",
                rating: 5,
              },
              {
                id: 'testimonial-quality',
                authorName: 'James T.',
                authorRole: 'Attorney',
                image:
                  'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=400&h=400&fit=crop&q=80',
                quote:
                  'The live review during the shoot was a game-changer. I could see exactly what we were getting and left confident in every shot.',
                rating: 5,
              },
              {
                id: 'testimonial-turnaround',
                authorName: 'Dr. Priya K.',
                authorRole: 'Physician',
                image:
                  'https://images.unsplash.com/photo-1580489944761-15a19d654956?w=400&h=400&fit=crop&q=80',
                quote:
                  'Booked on Monday, shot on Wednesday, retouched images by the following Tuesday. Fast, professional, and the results speak for themselves.',
                rating: 5,
              },
            ],
          },
        },
      });

      // --- GALLERY (order 5) ---
      await tx.sectionContent.create({
        data: {
          tenantId: tenant.id,
          blockType: 'GALLERY',
          pageName: 'home',
          order: 5,
          isDraft: false,
          publishedAt: new Date(),
          content: {
            visible: true,
            title: 'Recent Work',
            subtitle: 'A selection of headshots from recent sessions',
            layout: 'grid',
            columns: 3,
            items: [
              {
                id: 'gallery-1',
                image:
                  'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=600&h=600&fit=crop&q=80',
                alt: 'Professional headshot — corporate woman',
              },
              {
                id: 'gallery-2',
                image:
                  'https://images.unsplash.com/photo-1560250097-0b93528c311a?w=600&h=600&fit=crop&q=80',
                alt: 'Professional headshot — business man',
              },
              {
                id: 'gallery-3',
                image:
                  'https://images.unsplash.com/photo-1580489944761-15a19d654956?w=600&h=600&fit=crop&q=80',
                alt: 'Professional headshot — creative portrait',
              },
              {
                id: 'gallery-4',
                image:
                  'https://images.unsplash.com/photo-1519085360753-af0119f7cbe7?w=600&h=600&fit=crop&q=80',
                alt: 'Professional headshot — executive portrait',
              },
              {
                id: 'gallery-5',
                image:
                  'https://images.unsplash.com/photo-1594744803329-e58b31de8bf5?w=600&h=600&fit=crop&q=80',
                alt: 'Professional headshot — natural light portrait',
              },
              {
                id: 'gallery-6',
                image:
                  'https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?w=600&h=600&fit=crop&q=80',
                alt: 'Professional headshot — studio portrait',
              },
            ],
          },
        },
      });

      // --- FAQ (order 6) ---
      await tx.sectionContent.create({
        data: {
          tenantId: tenant.id,
          blockType: 'FAQ',
          pageName: 'home',
          order: 6,
          isDraft: false,
          publishedAt: new Date(),
          content: {
            visible: true,
            title: 'Common Questions',
            items: [
              {
                id: 'faq-what-to-wear',
                question: 'What should I wear to my session?',
                answer:
                  'Solid colors photograph best — avoid busy patterns and large logos. Bring 2-3 outfit options and we can decide together on the day. Jewel tones, navy, and earth tones are always safe bets.',
              },
              {
                id: 'faq-how-long',
                question: 'How long does a session take?',
                answer:
                  'Individual sessions are about 60 minutes with no hard time limit — we shoot until we get the shot. Group sessions run about 120 minutes depending on headcount.',
              },
              {
                id: 'faq-how-many-images',
                question: 'How many final images do I get?',
                answer:
                  'The session fee covers the shoot and expression coaching. Retouched images are purchased separately at $100 each. Most clients pick 2-4 favorites. Group and on-location sessions include 1 retouched image per person.',
              },
              {
                id: 'faq-turnaround',
                question: 'How quickly will I get my retouched images?',
                answer:
                  'Standard turnaround is 5-7 business days. Rush delivery (2-3 business days) is available for an additional fee — just ask when booking.',
              },
              {
                id: 'faq-not-photogenic',
                question: "What if I'm not photogenic?",
                answer:
                  "That is literally my specialty. Every session includes real-time expression coaching — I'll guide you through angles, expressions, and posture until we find what works. Most clients are surprised by their own photos.",
              },
            ],
          },
        },
      });

      // --- CONTACT (order 7) ---
      await tx.sectionContent.create({
        data: {
          tenantId: tenant.id,
          blockType: 'CONTACT',
          pageName: 'home',
          order: 7,
          isDraft: false,
          publishedAt: new Date(),
          content: {
            visible: true,
            title: 'Base Camp Macon — 1080 3rd Street, Macon, GA',
            email: 'mike@maconheadshots.com',
            phone: '504-417-8242',
            showForm: true,
            formFields: ['name', 'email', 'phone', 'message'],
          },
        },
      });

      // --- CTA (order 8) ---
      await tx.sectionContent.create({
        data: {
          tenantId: tenant.id,
          blockType: 'CTA',
          pageName: 'home',
          order: 8,
          isDraft: false,
          publishedAt: new Date(),
          content: {
            visible: true,
            headline: 'Ready for a Headshot You Actually Like?',
            subheadline:
              'Book your session today. Individual, group, and on-location options available.',
            ctaText: 'See Options',
          },
        },
      });

      logger.info(
        'Section content created: HERO, ABOUT, FEATURES, SERVICES, TESTIMONIALS, GALLERY, FAQ, CONTACT, CTA'
      );

      // =====================================================================
      // BLACKOUT DATES (standard 2026 holidays)
      // =====================================================================
      const holidays = [
        { date: new Date('2026-07-04'), reason: 'Independence Day' },
        { date: new Date('2026-11-26'), reason: 'Thanksgiving' },
        { date: new Date('2026-12-25'), reason: 'Christmas Day' },
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
    'Macon Headshots seed transaction committed successfully'
  );

  // Log keys AFTER successful transaction commit
  if (secretKeyForLogging) {
    logger.info(`Public Key: ${publicKeyForLogging}`);
    logger.warn(`Secret Key: ${secretKeyForLogging}`);
    logger.warn('SAVE THESE KEYS - they will not be regenerated on subsequent seeds!');
  } else {
    logger.info(`Public Key: ${publicKeyForLogging}`);
    logger.info('Secret key unchanged - using existing value');
  }

  // Summary
  logger.info('='.repeat(60));
  logger.info('MACON HEADSHOTS SEED COMPLETE');
  logger.info('='.repeat(60));
  logger.info('Segments: 1');
  logger.info('  - Headshot Photography (3 tiers)');
  logger.info('Tiers: 3 total');
  logger.info('  - Individual Session: $200 (DATE, 60min, flat)');
  logger.info('  - Group In-Studio: From $500 (DATE, 120min, +$100/person beyond 3)');
  logger.info('  - On-Location: From $1,500 (DATE, +$100/headshot beyond 10)');
  logger.info(
    'Section content: HERO, ABOUT, FEATURES, SERVICES, TESTIMONIALS, GALLERY, FAQ, CONTACT, CTA'
  );
  logger.info(`Blackout dates: ${3}`);
  logger.info('='.repeat(60));
}
