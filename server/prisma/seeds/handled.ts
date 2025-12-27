/**
 * HANDLED Tenant Seed - "Tenant Zero" dogfooding
 *
 * HANDLED uses its own platform as a real tenant, proving the config-driven
 * architecture works by eating our own dogfood.
 *
 * Use: SEED_MODE=handled npm exec prisma db seed
 */

import type { PrismaClient } from '../../src/generated/prisma';
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

      // HANDLED branding: sage green, serif fonts
      const tenant = await createOrUpdateTenant(tx, {
        slug: HANDLED_SLUG,
        name: 'Handled',
        email: HANDLED_EMAIL,
        passwordHash,
        commissionPercent: 0, // Self - no commission
        apiKeyPublic: publicKey,
        apiKeySecret: secretKey ?? undefined,
        primaryColor: '#7B9E87', // sage
        secondaryColor: '#ffffff',
        accentColor: '#7B9E87',
        backgroundColor: '#ffffff',
        fontFamily: 'Georgia, serif',
        isActive: true,
      });

      // Update landing page config with the full HANDLED homepage
      await tx.tenant.update({
        where: { id: tenant.id },
        data: {
          landingPageConfig: {
            pages: {
              home: {
                enabled: true,
                sections: [
                  {
                    type: 'hero',
                    headline: "The tech is moving fast. You don't have to.",
                    subheadline:
                      "Done-for-you websites, booking, and AI — plus monthly updates on what's actually worth knowing. For service pros who'd rather stay ahead than burn out.",
                    ctaText: 'Get Handled',
                    ctaSecondary: 'See How It Works',
                  },
                  {
                    type: 'text',
                    headline: "You didn't start your business to debug a website.",
                    content:
                      "You became a photographer because you see the world differently. A therapist because you help people heal. A coach because you unlock potential.\n\nNot because you wanted to spend your evenings comparing payment processors, watching website tutorials, or figuring out which AI tools are actually worth using.\n\nThe tech keeps changing. Every week there's something new you 'should' be learning. It's exhausting. And it's stealing time from the work that actually matters.",
                    imagePosition: 'left',
                  },
                  {
                    type: 'features',
                    headline: 'We handle the tech. We keep you current. You stay focused.',
                    subheadline: 'A membership that combines done-for-you tech with done-with-you education.',
                    features: [
                      {
                        icon: 'Globe',
                        title: 'Website That Works',
                        description: 'We build it. We maintain it. You never touch it. Just show up and look professional.',
                      },
                      {
                        icon: 'Calendar',
                        title: 'Booking & Payments',
                        description: 'Clients book and pay online. You get a notification. No back-and-forth emails.',
                      },
                      {
                        icon: 'Sparkles',
                        title: 'AI That Actually Helps',
                        description: 'A chatbot trained on your business. Answers questions, handles scheduling, works while you sleep.',
                      },
                      {
                        icon: 'Mail',
                        title: 'Monthly Newsletter',
                        description: "What's worth knowing in AI and tech this month. Curated. No fluff. Actually useful.",
                      },
                      {
                        icon: 'Users',
                        title: 'Monthly Zoom Calls',
                        description: "Real talk with other pros about what's working. No pitch. Just 'here's what we're seeing.'",
                      },
                      {
                        icon: 'Phone',
                        title: 'Humans Who Answer',
                        description: 'Questions? We answer them. No chatbots, no tickets. Just help from people who give a shit.',
                      },
                    ],
                    columns: 3,
                  },
                  {
                    type: 'pricing',
                    headline: 'Pick your level of handled.',
                    subheadline: 'No contracts. No hidden fees. Cancel anytime.',
                    tiers: [
                      {
                        name: 'Handled',
                        price: '$49',
                        priceSubtext: '/month',
                        description: 'The essentials',
                        features: ['Professional website', 'Online booking', 'Payment processing', 'Email notifications'],
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
                    backgroundColor: 'neutral',
                  },
                  {
                    type: 'faq',
                    headline: 'Questions? Answers.',
                    items: [
                      {
                        question: 'What kind of businesses is this for?',
                        answer:
                          "Photographers, coaches, therapists, consultants, trainers, wedding planners — anyone who sells their time and expertise. If you're great at what you do but tired of managing tech, we're for you.",
                      },
                      {
                        question: 'Do I need to know anything about tech?',
                        answer: "Nope. That's the point. We handle the tech so you don't have to become a tech person.",
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
                          "No. We train it on your voice, your services, your style. It sounds like a helpful version of you — not a generic bot.",
                      },
                      {
                        question: 'Can I cancel anytime?',
                        answer: 'Yes. No contracts, no cancellation fees, no guilt trips. We earn your business every month.',
                      },
                    ],
                  },
                  {
                    type: 'cta',
                    headline: 'Ready to stop being your own IT department?',
                    subheadline: "Join service pros who'd rather focus on being great at their job.",
                    ctaText: 'Get Handled',
                  },
                ],
              },
              about: {
                enabled: true,
                sections: [
                  {
                    type: 'hero',
                    headline: "We're an AI company. We're not sorry about it.",
                    subheadline: 'But we use AI to help you, not replace you.',
                    ctaText: 'Learn More',
                  },
                  {
                    type: 'text',
                    headline: 'Our Story',
                    content:
                      "We watched talented service pros—photographers, coaches, therapists—drown in tech they never signed up for. Website builders. Payment processors. The AI tool of the week.\n\nThey didn't need more tools. They needed someone to handle the tools for them.\n\nSo we built Handled. Done-for-you tech, plus done-with-you education so you actually understand what's changing and why it matters.\n\nWe're the shortcut. Not hand-holding. Not dismissive. Just useful.",
                    imagePosition: 'right',
                  },
                ],
              },
              services: {
                enabled: true,
                sections: [],
              },
              faq: {
                enabled: true,
                sections: [
                  {
                    type: 'hero',
                    headline: 'Questions? We have answers.',
                    subheadline: 'Everything you need to know about Handled.',
                    ctaText: 'Contact Us',
                  },
                  {
                    type: 'faq',
                    headline: 'Frequently Asked Questions',
                    items: [
                      {
                        question: 'What if I already have a website?',
                        answer:
                          "We can work with it or help you migrate. Most members find our sites convert better, but we'll figure out what makes sense for you.",
                      },
                      {
                        question: 'Can I cancel anytime?',
                        answer: 'Yes. No contracts, no cancellation fees, no guilt trips. We earn your business every month.',
                      },
                      {
                        question: 'What happens on the monthly Zoom calls?',
                        answer:
                          "We share what's new in AI and tech that's actually worth knowing. Members share what's working for them. No sales pitch. Just useful conversation.",
                      },
                      {
                        question: "How is Handled different from Squarespace or Wix?",
                        answer:
                          "Those are tools you use. Handled is a team that uses tools for you. We handle setup, maintenance, and optimization—you just focus on your business.",
                      },
                      {
                        question: 'What industries do you work with?',
                        answer:
                          'Photographers, coaches, consultants, therapists, trainers, event planners—any service business that books clients. If you sell your time, we can help.',
                      },
                    ],
                  },
                ],
              },
              contact: {
                enabled: true,
                sections: [
                  {
                    type: 'hero',
                    headline: "Let's talk.",
                    subheadline: 'Ready to see how Handled can help your business grow?',
                    ctaText: 'Get Started',
                  },
                  {
                    type: 'contact',
                    headline: 'Get in Touch',
                    email: 'hello@gethandled.ai',
                  },
                ],
              },
              gallery: {
                enabled: false,
                sections: [],
              },
              testimonials: {
                enabled: false,
                sections: [],
              },
            },
          },
        },
      });

      publicKeyForLogging = publicKey;
      secretKeyForLogging = secretKey;

      logger.info(`HANDLED tenant ${existingTenant ? 'updated' : 'created'}: ${tenant.name}`);
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
  logger.info(`  URL:      /t/handled (or root / via redirect)`);
  logger.info(`  Email:    ${HANDLED_EMAIL}`);
  logger.info('═══════════════════════════════════════════════════════════════');
}
