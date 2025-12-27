/**
 * MAIS Tenant Seed - "Tenant Zero" dogfooding
 *
 * MAIS uses its own platform as a real tenant, proving the config-driven
 * architecture works by eating our own dogfood.
 *
 * Use: SEED_MODE=mais npm exec prisma db seed
 */

import type { PrismaClient } from '../../src/generated/prisma';
import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import { logger } from '../../src/lib/core/logger';
import { createOrUpdateTenant } from './utils';

// Fixed slug for MAIS tenant
const MAIS_SLUG = 'mais';
const MAIS_EMAIL = 'hello@maconaisolutions.com';
const MAIS_PASSWORD = process.env.MAIS_ADMIN_PASSWORD || 'mais-admin-2025!';

export async function seedMAIS(prisma: PrismaClient): Promise<void> {
  const existingTenant = await prisma.tenant.findUnique({
    where: { slug: MAIS_SLUG },
  });

  let publicKeyForLogging: string;
  let secretKeyForLogging: string | null = null;

  logger.info({ slug: MAIS_SLUG }, 'Starting MAIS tenant seed');
  const startTime = Date.now();

  await prisma.$transaction(
    async (tx) => {
      let publicKey: string;
      let secretKey: string | null = null;

      if (existingTenant) {
        publicKey = existingTenant.apiKeyPublic;
        logger.info('MAIS tenant already exists - updating within transaction');
      } else {
        publicKey = `pk_live_${MAIS_SLUG}_${crypto.randomBytes(8).toString('hex')}`;
        secretKey = `sk_live_${MAIS_SLUG}_${crypto.randomBytes(16).toString('hex')}`;
        logger.info('Creating new MAIS tenant with generated keys');
      }

      const passwordHash = await bcrypt.hash(MAIS_PASSWORD, 10);

      // MAIS branding: sage green, serif fonts
      const tenant = await createOrUpdateTenant(tx, {
        slug: MAIS_SLUG,
        name: 'Macon AI Solutions',
        email: MAIS_EMAIL,
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

      // Update landing page config with the full MAIS homepage
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
                    headline: "You didn't start this to become a tech expert.",
                    subheadline: 'We handle the tech, the marketing, and the AI—so you can focus on what you actually started this for.',
                    ctaText: 'Join the Club',
                  },
                  {
                    type: 'text',
                    headline: "Running a business shouldn't require a computer science degree.",
                    content: "Website builders. Payment processors. Email marketing. Social media schedulers. CRM systems. AI tools. The tech stack keeps growing.\n\nYou didn't sign up to manage subscriptions. You signed up to build something meaningful.",
                    imagePosition: 'left',
                  },
                  {
                    type: 'features',
                    headline: 'Your growth team. On demand.',
                    subheadline: 'MAIS is a marketing firm, tech consultancy, and AI strategy partner—wrapped into one membership.',
                    features: [
                      { icon: 'Globe', title: 'Professional Storefront', description: 'A beautiful booking site that makes you look as professional as you are.' },
                      { icon: 'Calendar', title: 'Booking & Scheduling', description: "Clients pick a time, book, and pay. No back-and-forth." },
                      { icon: 'CreditCard', title: 'Automatic Payments', description: 'Deposits, invoices, and payment processing—handled.' },
                      { icon: 'Sparkles', title: 'AI Growth Assistant', description: 'Get personalized advice on growing your business, powered by AI.' },
                      { icon: 'Users', title: 'Monthly AI Masterclass', description: 'Group Zoom calls where we share the latest AI tools and strategies.' },
                      { icon: 'Phone', title: 'Real Human Support', description: 'Questions? We answer them. No chatbots, no tickets—just help.' },
                    ],
                    columns: 3,
                  },
                  {
                    type: 'pricing',
                    headline: 'Simple, honest pricing.',
                    subheadline: 'No hidden fees. No annual contracts. Cancel anytime.',
                    tiers: [
                      {
                        name: 'Starter',
                        price: '$40',
                        priceSubtext: '/month',
                        description: 'The essentials to get going',
                        features: ['Professional storefront', 'Online booking & scheduling', 'Payment processing', 'Email notifications'],
                        ctaText: 'Get Started',
                        ctaHref: '/signup?tier=starter',
                      },
                      {
                        name: 'Growth Club',
                        price: '$99',
                        priceSubtext: '/month',
                        description: 'Everything + AI community',
                        features: ['Everything in Starter', 'AI Growth Assistant', 'Monthly AI Masterclass (Zoom)', 'Custom branding', 'Priority support'],
                        ctaText: 'Join the Club',
                        ctaHref: '/signup?tier=growth',
                        isPopular: true,
                      },
                      {
                        name: 'Private Consulting',
                        price: 'Custom',
                        description: 'Hands-on AI strategy for your business',
                        features: ['Everything in Growth Club', '1-on-1 AI consulting sessions', 'Custom AI tool development', 'Marketing strategy sessions', 'Dedicated account manager'],
                        ctaText: 'Book a Call',
                        ctaHref: '/contact',
                        variant: 'enterprise',
                      },
                    ],
                    backgroundColor: 'neutral',
                  },
                  {
                    type: 'cta',
                    headline: 'Ready to stop being the IT department?',
                    subheadline: "Join business owners who've traded tech headaches for growth.",
                    ctaText: 'Join the Club',
                  },
                ],
              },
              about: {
                enabled: true,
                sections: [
                  {
                    type: 'hero',
                    headline: 'Built by entrepreneurs, for entrepreneurs.',
                    subheadline: "We've been in your shoes. That's why we built MAIS.",
                    ctaText: 'Learn More',
                  },
                  {
                    type: 'text',
                    headline: 'Our Story',
                    content: "After years of watching talented business owners drown in tech tools and marketing complexity, we decided to build what we wished existed: a partner, not another platform.\n\nMAIS isn't just software. It's a team of real humans who understand that running a business is hard enough without having to become a tech expert too.\n\nWe handle the websites, the booking systems, the payment processing, and the AI strategy—so you can focus on what you're actually good at: serving your clients and growing your business.",
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
                    subheadline: 'Everything you need to know about MAIS.',
                    ctaText: 'Contact Us',
                  },
                  {
                    type: 'faq',
                    headline: 'Frequently Asked Questions',
                    items: [
                      { question: 'What if I already have a website?', answer: 'No problem! We can integrate with your existing site or help you migrate. Most members find our storefront converts better, but we work with what you have.' },
                      { question: 'Can I cancel anytime?', answer: 'Yes. No contracts, no cancellation fees. We earn your business every month.' },
                      { question: 'What happens in the AI Masterclass?', answer: "Monthly 60-minute Zoom sessions where we demo the latest AI tools, share prompts, and answer questions. Recordings available if you can't attend live." },
                      { question: 'How is MAIS different from Squarespace or Wix?', answer: "Those are tools you use. MAIS is a team that uses tools for you. We handle setup, maintenance, and optimization—you just focus on your business." },
                      { question: 'What industries do you work with?', answer: "Photographers, coaches, consultants, therapists, trainers, event planners—any service business that books clients. If you sell your time, we can help." },
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
                    subheadline: 'Ready to see how MAIS can help your business grow?',
                    ctaText: 'Get Started',
                  },
                  {
                    type: 'contact',
                    headline: 'Get in Touch',
                    email: 'hello@maconaisolutions.com',
                    phone: '(478) 550-4786',
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

      logger.info(`MAIS tenant ${existingTenant ? 'updated' : 'created'}: ${tenant.name}`);
    },
    { timeout: 60000 }
  );

  logger.info(
    {
      slug: MAIS_SLUG,
      durationMs: Date.now() - startTime,
    },
    'MAIS seed transaction committed successfully'
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
  logger.info('MAIS TENANT ZERO - DOGFOODING COMPLETE');
  logger.info(`  Slug:     ${MAIS_SLUG}`);
  logger.info(`  URL:      /t/mais (or root / via redirect)`);
  logger.info(`  Email:    ${MAIS_EMAIL}`);
  logger.info('═══════════════════════════════════════════════════════════════');
}
