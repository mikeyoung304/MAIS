/**
 * HANDLED Tenant Seed - "Tenant Zero" dogfooding
 *
 * HANDLED uses its own platform as a real tenant, proving the config-driven
 * architecture works by eating our own dogfood.
 *
 * Phase 5.2: Uses SectionContent table instead of legacy landingPageConfig JSON.
 * This matches how TenantProvisioningService creates new tenants.
 *
 * Use: SEED_MODE=handled npm exec prisma db seed
 */

import type { PrismaClient, Prisma, BlockType } from '../../src/generated/prisma/client';
import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import { logger } from '../../src/lib/core/logger';
import { createOrUpdateTenant } from './utils';

// Fixed slug for HANDLED tenant
const HANDLED_SLUG = 'handled';
const HANDLED_EMAIL = 'hello@gethandled.ai';

// Password from env or fallback for development
function getHandledPassword(): string {
  const isProduction = process.env.NODE_ENV === 'production';
  const envPassword = process.env.HANDLED_ADMIN_PASSWORD;
  if (isProduction && !envPassword) {
    throw new Error('HANDLED_ADMIN_PASSWORD environment variable is required in production');
  }
  return envPassword || 'handled-admin-2025!';
}

/**
 * HANDLED-specific section content for the home page storefront
 *
 * This content is written to the SectionContent table, which is the
 * single source of truth for storefront sections (Phase 5.2 architecture).
 */
const HANDLED_SECTION_CONTENT: Record<
  BlockType,
  { order: number; content: Record<string, unknown> } | null
> = {
  HERO: {
    order: 0,
    content: {
      visible: true,
      headline: "The tech is moving fast. You don't have to.",
      subheadline:
        "Done-for-you websites, booking, and AI — plus monthly updates on what's actually worth knowing. For service pros who'd rather stay ahead than burn out.",
      ctaText: 'Get Handled',
      ctaSecondary: 'See How It Works',
      alignment: 'center',
    },
  },
  ABOUT: {
    order: 1,
    content: {
      visible: true,
      title: "You didn't start your business to debug a website.",
      body: "You became a photographer because you see the world differently. A therapist because you help people heal. A coach because you unlock potential.\n\nNot because you wanted to spend your evenings comparing payment processors, watching website tutorials, or figuring out which AI tools are actually worth using.\n\nThe tech keeps changing. Every week there's something new you 'should' be learning. It's exhausting. And it's stealing time from the work that actually matters.",
      imagePosition: 'left',
    },
  },
  FEATURES: {
    order: 2,
    content: {
      visible: true,
      title: 'We handle the tech. We keep you current. You stay focused.',
      subtitle: 'A membership that combines done-for-you tech with done-with-you education.',
      items: [
        {
          icon: 'Globe',
          title: 'Website That Works',
          description:
            'We build it. We maintain it. You never touch it. Just show up and look professional.',
        },
        {
          icon: 'Calendar',
          title: 'Booking & Payments',
          description:
            'Clients book and pay online. You get a notification. No back-and-forth emails.',
        },
        {
          icon: 'Sparkles',
          title: 'AI That Actually Helps',
          description:
            'A chatbot trained on your business. Answers questions, handles scheduling, works while you sleep.',
        },
        {
          icon: 'Mail',
          title: 'Monthly Newsletter',
          description:
            "What's worth knowing in AI and tech this month. Curated. No fluff. Actually useful.",
        },
        {
          icon: 'Users',
          title: 'Monthly Zoom Calls',
          description:
            "Real talk with other pros about what's working. No pitch. Just 'here's what we're seeing.'",
        },
        {
          icon: 'Phone',
          title: 'Humans Who Answer',
          description:
            'Questions? We answer them. No chatbots, no tickets. Just help from people who give a shit.',
        },
      ],
      columns: 3,
      layout: 'grid',
    },
  },
  PRICING: {
    order: 3,
    content: {
      visible: true,
      title: 'Pick your level of handled.',
      subtitle: 'No contracts. No hidden fees. Cancel anytime.',
      tiers: [
        {
          name: 'Handled',
          price: '$49',
          priceSubtext: '/month',
          description: 'The essentials',
          features: [
            'Professional website',
            'Online booking',
            'Payment processing',
            'Email notifications',
          ],
          ctaText: 'Get Started',
          ctaHref: '/signup?tier=handled',
        },
        {
          name: 'Fully Handled',
          price: '$149',
          priceSubtext: '/month',
          description: 'The full membership',
          features: [
            'Everything in Handled',
            'AI chatbot for your business',
            'Monthly newsletter',
            'Monthly Zoom calls',
            'Priority support',
          ],
          ctaText: 'Join Now',
          ctaHref: '/signup?tier=fully-handled',
          isPopular: true,
        },
        {
          name: 'Completely Handled',
          price: 'Custom',
          description: 'White glove',
          features: [
            'Everything in Fully Handled',
            '1-on-1 strategy sessions',
            'Custom integrations',
            'Dedicated account manager',
          ],
          ctaText: 'Book a Call',
          ctaHref: '/contact',
          variant: 'enterprise',
        },
      ],
      showComparison: false,
      backgroundColor: 'neutral',
    },
  },
  FAQ: {
    order: 4,
    content: {
      visible: true,
      title: 'Questions? Answers.',
      items: [
        {
          question: 'What kind of businesses is this for?',
          answer:
            "Photographers, coaches, therapists, consultants, trainers, wedding planners — anyone who sells their time and expertise. If you're great at what you do but tired of managing tech, we're for you.",
        },
        {
          question: 'Do I need to know anything about tech?',
          answer:
            "Nope. That's the point. We handle the tech so you don't have to become a tech person.",
        },
        {
          question: 'What if I already have a website?',
          answer:
            "We can work with it or help you migrate. Most members find our sites convert better, but we'll figure out what makes sense for you.",
        },
        {
          question: 'What happens on the monthly Zoom calls?',
          answer:
            "We share what's new in AI and tech that's actually worth knowing. Members share what's working for them. No sales pitch. Just useful conversation with people in the same boat.",
        },
        {
          question: 'Is the AI chatbot going to sound like a robot?',
          answer:
            'No. We train it on your voice, your services, your style. It sounds like a helpful version of you — not a generic bot.',
        },
        {
          question: 'Can I cancel anytime?',
          answer:
            'Yes. No contracts, no cancellation fees, no guilt trips. We earn your business every month.',
        },
      ],
    },
  },
  CTA: {
    order: 5,
    content: {
      visible: true,
      headline: 'Ready to stop being your own IT department?',
      subheadline: "Join service pros who'd rather focus on being great at their job.",
      buttonText: 'Get Handled',
      style: 'primary',
    },
  },
  CONTACT: {
    order: 6,
    content: {
      visible: true,
      title: 'Get in Touch',
      email: 'hello@gethandled.ai',
      showForm: true,
      formFields: ['name', 'email', 'message'],
    },
  },
  // Sections not used on HANDLED home page
  SERVICES: null, // HANDLED uses FEATURES instead for service showcase
  TESTIMONIALS: null, // Not yet active
  GALLERY: null, // Not applicable for HANDLED
  CUSTOM: null, // Not used
};

export async function seedHandled(prisma: PrismaClient): Promise<void> {
  const existingTenant = await prisma.tenant.findUnique({
    where: { slug: HANDLED_SLUG },
  });

  let publicKeyForLogging: string;
  let secretKeyForLogging: string | null = null;

  logger.info({ slug: HANDLED_SLUG }, 'Starting HANDLED tenant seed');
  const startTime = Date.now();

  await prisma.$transaction(
    async (tx) => {
      let publicKey: string;
      let secretKey: string | null = null;

      if (existingTenant) {
        publicKey = existingTenant.apiKeyPublic;
        logger.info('HANDLED tenant already exists - updating within transaction');
      } else {
        publicKey = `pk_live_${HANDLED_SLUG}_${crypto.randomBytes(8).toString('hex')}`;
        secretKey = `sk_live_${HANDLED_SLUG}_${crypto.randomBytes(16).toString('hex')}`;
        logger.info('Creating new HANDLED tenant with generated keys');
      }

      const passwordHash = await bcrypt.hash(getHandledPassword(), 10);

      // HANDLED branding: Electric Sage (brand refresh 2025-12-28)
      const tenant = await createOrUpdateTenant(tx, {
        slug: HANDLED_SLUG,
        name: 'Handled',
        email: HANDLED_EMAIL,
        passwordHash,
        commissionPercent: 0, // Self - no commission
        apiKeyPublic: publicKey,
        apiKeySecret: secretKey ?? undefined,
        primaryColor: '#45B37F', // Electric Sage - brighter, confident
        secondaryColor: '#ffffff',
        accentColor: '#45B37F',
        backgroundColor: '#ffffff',
        fontFamily: 'Georgia, serif',
        isActive: true,
      });

      // Phase 5.2: Create SectionContent rows instead of landingPageConfig JSON
      // Delete existing sections first (idempotent seed)
      await tx.sectionContent.deleteMany({
        where: { tenantId: tenant.id },
      });

      // Create section content for each block type
      const sectionPromises: Promise<unknown>[] = [];
      const blockTypes = Object.keys(HANDLED_SECTION_CONTENT) as BlockType[];

      for (const blockType of blockTypes) {
        const config = HANDLED_SECTION_CONTENT[blockType];
        if (!config) continue; // Skip null sections (not used on HANDLED)

        sectionPromises.push(
          tx.sectionContent.create({
            data: {
              tenantId: tenant.id,
              segmentId: null, // Tenant-level (shared across segments)
              blockType,
              pageName: 'home',
              content: config.content as Prisma.InputJsonValue,
              order: config.order,
              isDraft: false, // Start as published
              publishedAt: new Date(),
            },
          })
        );
      }

      const createdSections = await Promise.all(sectionPromises);

      publicKeyForLogging = publicKey;
      secretKeyForLogging = secretKey;

      logger.info(
        {
          tenantId: tenant.id,
          sectionsCreated: createdSections.length,
        },
        `HANDLED tenant ${existingTenant ? 'updated' : 'created'}: ${tenant.name}`
      );
    },
    { timeout: 60000 }
  );

  logger.info(
    {
      slug: HANDLED_SLUG,
      durationMs: Date.now() - startTime,
    },
    'HANDLED seed transaction committed successfully'
  );

  if (existingTenant) {
    logger.info(`Public Key: ${publicKeyForLogging}`);
    logger.info('Secret key unchanged - using existing value');
  } else {
    logger.info(`Public Key: ${publicKeyForLogging}`);
    logger.warn(`Secret Key: ${secretKeyForLogging}`);
    logger.warn('SAVE THESE KEYS - they will not be regenerated on subsequent seeds!');
  }

  logger.info('═══════════════════════════════════════════════════════════════');
  logger.info('HANDLED TENANT ZERO - DOGFOODING COMPLETE');
  logger.info(`  Slug:     ${HANDLED_SLUG}`);
  logger.info(`  URL:      /t/handled (tenant storefront)`);
  logger.info(`  Email:    ${HANDLED_EMAIL}`);
  logger.info('  Note:     Company homepage is static at / (not a tenant)');
  logger.info('═══════════════════════════════════════════════════════════════');
}
