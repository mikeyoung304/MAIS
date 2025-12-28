/**
 * Upgrade Tenant Pages - Add optimized landing page configurations
 *
 * This script upgrades all existing tenants with rich landing page content
 * to take advantage of the new multi-page tenant sites feature.
 *
 * Run with: SEED_MODE=upgrade-tenant-pages npx prisma db seed
 */

import { PrismaClient } from '../../src/generated/prisma';
import { logger } from '../../src/lib/core/logger';

const prisma = new PrismaClient();

/**
 * Landing page configuration for La Petit Mariage
 * Wedding & elopement business at Tanglewood Art Studios
 */
const LA_PETIT_MARIAGE_CONFIG = {
  branding: {
    logoUrl: 'https://images.unsplash.com/photo-1519741497674-611481863552?w=200&h=60&fit=crop',
    fontFamily: 'Playfair Display',
    landingPage: {
      sections: {
        hero: true,
        socialProofBar: true,
        segmentSelector: true,
        about: true,
        testimonials: true,
        accommodation: false,
        gallery: true,
        faq: true,
        finalCta: true,
      },
      hero: {
        headline: 'Your Love Story, Beautifully Told.',
        subheadline:
          'Intimate elopements, micro weddings, and full celebrations at the stunning Tanglewood Art Studios in Macon, Georgia.',
        ctaText: 'Explore Packages',
        backgroundImageUrl:
          'https://images.unsplash.com/photo-1519741497674-611481863552?w=1920&q=80',
      },
      socialProofBar: {
        items: [
          { icon: 'heart', text: '500+ couples celebrated' },
          { icon: 'star', text: '4.9★ average rating' },
          { icon: 'award', text: 'Best of Weddings 2024' },
          { icon: 'calendar', text: '8+ years experience' },
        ],
      },
      about: {
        headline: 'Where Intimate Becomes Extraordinary.',
        content: `At La Petit Mariage, we believe the most meaningful celebrations are often the most intimate. Whether you're planning a "just us" elopement or a gathering of your closest family and friends, we create experiences that feel authentic to your unique love story.

Our home at Tanglewood Art Studios offers the perfect backdrop—a restored historic venue with soaring ceilings, abundant natural light, and an artistic atmosphere that photographs beautifully. From the ceremony to the final toast, every detail is handled with care so you can simply be present and enjoy your day.

We're not just wedding planners—we're storytellers, problem solvers, and your biggest cheerleaders.`,
        imageUrl: 'https://images.unsplash.com/photo-1606216794074-735e91aa2c92?w=800&q=80',
        imagePosition: 'right',
      },
      testimonials: {
        headline: 'Love Notes from Our Couples.',
        items: [
          {
            quote:
              'We wanted something intimate without sacrificing beauty. La Petit Mariage gave us the most magical day—just 12 guests, gorgeous florals, and a ceremony that had everyone in tears. It was perfect.',
            author: 'Sarah & Michael',
            role: 'Elopement, October 2024',
            rating: 5,
          },
          {
            quote:
              'The team handled every detail so we could actually enjoy our wedding. From the custom ceremony to the stunning photos, it exceeded every expectation. Worth every penny.',
            author: 'Jessica & David',
            role: 'Micro Wedding, June 2024',
            rating: 5,
          },
          {
            quote:
              'We considered eloping to avoid the stress of a big wedding. La Petit Mariage showed us we could have an intimate celebration without any of the chaos. Best decision we made.',
            author: 'Emily & James',
            role: 'Full Wedding, September 2024',
            rating: 5,
          },
          {
            quote:
              "Tanglewood is breathtaking, but it's the people that made it special. Professional, warm, and genuinely invested in making our day amazing.",
            author: 'Amanda & Chris',
            role: 'All-Inclusive Elopement, March 2024',
            rating: 5,
          },
        ],
      },
      gallery: {
        headline: "Moments We've Captured.",
        images: [
          {
            url: 'https://images.unsplash.com/photo-1519741497674-611481863552?w=600&q=80',
            alt: 'Bride and groom first look',
          },
          {
            url: 'https://images.unsplash.com/photo-1606216794074-735e91aa2c92?w=600&q=80',
            alt: 'Ceremony at Tanglewood',
          },
          {
            url: 'https://images.unsplash.com/photo-1465495976277-4387d4b0b4c6?w=600&q=80',
            alt: 'Intimate reception',
          },
          {
            url: 'https://images.unsplash.com/photo-1511285560929-80b456fea0bc?w=600&q=80',
            alt: 'Bridal portrait',
          },
          {
            url: 'https://images.unsplash.com/photo-1460978812857-470ed1c77af0?w=600&q=80',
            alt: 'Ring exchange',
          },
          {
            url: 'https://images.unsplash.com/photo-1529636798458-92182e662485?w=600&q=80',
            alt: 'First dance',
          },
          {
            url: 'https://images.unsplash.com/photo-1469371670807-013ccf25f16a?w=600&q=80',
            alt: 'Wedding details',
          },
          {
            url: 'https://images.unsplash.com/photo-1507504031003-b417219a0fde?w=600&q=80',
            alt: 'Couple portrait',
          },
        ],
        instagramHandle: 'lapetitmariage',
      },
      faq: {
        headline: "Questions? We've Got Answers.",
        items: [
          {
            question: "What's the difference between an elopement and a micro wedding?",
            answer:
              "At La Petit Mariage, elopements are for 0-12 guests and focus on the ceremony experience. Micro weddings accommodate up to 40 guests and include reception elements like toasts, cake, and dancing. Both are intimate—it's really about how you want to celebrate.",
          },
          {
            question: 'Do you only work at Tanglewood Art Studios?',
            answer:
              "Tanglewood is our home base and where most of our packages take place. However, for custom packages, we're happy to discuss other Macon-area venues. Contact us to explore options.",
          },
          {
            question: "What's included in photography?",
            answer:
              "All packages include professional photography coverage. Essential Elopement includes 1 hour, while our all-inclusive packages offer extended coverage. You'll receive high-resolution edited images within 4-6 weeks, delivered via online gallery.",
          },
          {
            question: 'Can we add guests after booking?',
            answer:
              'Guest counts are flexible up to your package limit. If you need to upgrade to accommodate more guests, we can often adjust your package. Contact us at least 2 weeks before your date to discuss changes.',
          },
          {
            question: 'What happens if it rains?',
            answer:
              'Tanglewood has beautiful indoor spaces that work perfectly for ceremonies and photos. Our packages include a rain-plan backup, and honestly, some of our most stunning photos have been on overcast or rainy days!',
          },
          {
            question: 'How far in advance should we book?',
            answer:
              'Popular dates (spring and fall weekends) book 6-12 months ahead. Weekday elopements often have availability within 2-4 weeks. We recommend reaching out as soon as you have a date in mind.',
          },
        ],
      },
      finalCta: {
        headline: 'Ready to Start Planning?',
        subheadline:
          "Let's create something beautiful together. Book a free consultation to explore your options.",
        ctaText: 'View Packages',
      },
    },
  },
  tierDisplayNames: {
    basic: 'Simple Vows',
    standard: 'Essential',
    premium: 'All-Inclusive',
    custom: 'Signature',
  },
};

/**
 * Landing page configuration for Little Bit Horse Farm
 * Corporate wellness retreats with equine-assisted experiences
 */
const LITTLE_BIT_FARM_CONFIG = {
  branding: {
    logoUrl: 'https://images.unsplash.com/photo-1553284965-83fd3e82fa5a?w=200&h=60&fit=crop',
    fontFamily: 'Inter',
    landingPage: {
      sections: {
        hero: true,
        socialProofBar: true,
        segmentSelector: true,
        about: true,
        testimonials: true,
        accommodation: false,
        gallery: true,
        faq: true,
        finalCta: true,
      },
      hero: {
        headline: 'Reset. Reconnect. Return Stronger.',
        subheadline:
          'Equine-assisted wellness retreats for teams who want more than another conference room. Ground your people in nature with horses, yoga, breathwork, and PEMF recovery.',
        ctaText: 'Explore Retreats',
        backgroundImageUrl: 'https://images.unsplash.com/photo-1553284965-83fd3e82fa5a?w=1920&q=80',
      },
      socialProofBar: {
        items: [
          { icon: 'users', text: '2,500+ professionals served' },
          { icon: 'star', text: '98% team satisfaction' },
          { icon: 'heart', text: '50+ corporate partners' },
          { icon: 'award', text: "Georgia's Top Retreat 2024" },
        ],
      },
      about: {
        headline: 'Why Horses? Why Here?',
        content: `There's something about being with horses that strips away pretense. They don't care about your title or your quarterly numbers—they respond to presence, authenticity, and calm. That's the reset your team needs.

At Little Bit Horse Farm, we've created a sanctuary just outside Atlanta where corporate teams can step away from screens, breathe deeply, and reconnect with themselves and each other. Our retreats combine equine-assisted activities with yoga, breathwork, and cutting-edge PEMF recovery technology.

This isn't team building with trust falls. It's genuine transformation—leaders who return to the office calmer, clearer, and more connected.

Whether you need a half-day reset or a full executive experience, we'll design a retreat that fits your team's needs and goals.`,
        imageUrl: 'https://images.unsplash.com/photo-1508672019048-805c876b67e2?w=800&q=80',
        imagePosition: 'left',
      },
      testimonials: {
        headline: 'What Leaders Are Saying.',
        items: [
          {
            quote:
              "I've done dozens of corporate offsites. This was the first one where people actually changed. Our leadership team still talks about the horse connection exercise six months later.",
            author: 'Jennifer M.',
            role: 'VP of People, Tech Startup',
            rating: 5,
          },
          {
            quote:
              "Skeptical at first—horses and executives? But by the end of the day, I watched my most guarded team members open up in ways I'd never seen. Transformative.",
            author: 'Marcus T.',
            role: 'CEO, Financial Services',
            rating: 5,
          },
          {
            quote:
              'The PEMF recovery was a game-changer for our team of road warriors. Everyone left feeling physically renewed, not just mentally refreshed.',
            author: 'Sarah K.',
            role: 'Director of Sales, SaaS Company',
            rating: 5,
          },
          {
            quote:
              'Finally, an offsite that delivered ROI we could measure. Team morale scores up 40%, voluntary turnover down 25% in the quarter after.',
            author: 'David L.',
            role: 'CHRO, Healthcare Organization',
            rating: 5,
          },
        ],
      },
      gallery: {
        headline: 'Life on the Farm.',
        images: [
          {
            url: 'https://images.unsplash.com/photo-1553284965-83fd3e82fa5a?w=600&q=80',
            alt: 'Horses in pasture',
          },
          {
            url: 'https://images.unsplash.com/photo-1508672019048-805c876b67e2?w=600&q=80',
            alt: 'Team yoga session',
          },
          {
            url: 'https://images.unsplash.com/photo-1450052590821-8bf91254a353?w=600&q=80',
            alt: 'Executive coaching outdoors',
          },
          {
            url: 'https://images.unsplash.com/photo-1506126613408-eca07ce68773?w=600&q=80',
            alt: 'Meditation in nature',
          },
          {
            url: 'https://images.unsplash.com/photo-1534438327276-14e5300c3a48?w=600&q=80',
            alt: 'PEMF recovery session',
          },
          {
            url: 'https://images.unsplash.com/photo-1517836357463-d25dfeac3438?w=600&q=80',
            alt: 'Breathwork practice',
          },
        ],
        instagramHandle: 'littlebithorsefarm',
      },
      faq: {
        headline: 'Your Questions, Answered.',
        items: [
          {
            question: 'Do participants need horse experience?',
            answer:
              'Absolutely not! All our equine activities are ground-based—no riding involved. We teach you how to approach and interact with horses safely. The horses do the rest. First-timers often have the most profound experiences.',
          },
          {
            question: "What's PEMF therapy and why is it included?",
            answer:
              'PEMF (Pulsed Electromagnetic Field) therapy is FDA-cleared technology used by elite athletes and NASA. It promotes cellular recovery, reduces inflammation, and enhances mental clarity. Teams consistently report feeling more energized after sessions.',
          },
          {
            question: 'How many people can you accommodate?',
            answer:
              'Our retreats require a minimum of 4 participants and can accommodate up to 25 per session. For larger groups, we can run multiple concurrent sessions or multi-day programs. Contact us for custom quotes.',
          },
          {
            question: 'What should we wear?',
            answer:
              "Comfortable clothing you can move in—think athleisure or business casual without the blazer. Closed-toe shoes are required for horse activities. We recommend layers as we'll be both indoors and outdoors.",
          },
          {
            question: 'Is there a bad time of year to visit?',
            answer:
              'Georgia has mild weather year-round. Summer retreats start early to beat the heat. Fall is our most popular season. Winter offers cozy indoor-outdoor experiences. We have covered spaces for inclement weather.',
          },
          {
            question: 'Can you customize the retreat for our specific goals?',
            answer:
              "Absolutely. The Executive Reset package includes pre-retreat intake calls and post-retreat follow-up. We'll tailor activities, discussion topics, and facilitation to address your team's specific challenges and objectives.",
          },
        ],
      },
      finalCta: {
        headline: 'Your Team Deserves This.',
        subheadline:
          'Stop burning out your best people with surface-level perks. Give them an experience that actually recharges.',
        ctaText: 'Book a Retreat',
      },
    },
  },
  tierDisplayNames: {
    basic: 'The Grounding Reset',
    standard: 'The Team Recharge',
    premium: 'The Executive Reset',
    custom: 'Custom Experience',
  },
};

/**
 * Demo tenant configuration (basic business services)
 */
const DEMO_TENANT_CONFIG = {
  branding: {
    fontFamily: 'Inter',
    landingPage: {
      sections: {
        hero: true,
        socialProofBar: true,
        segmentSelector: true,
        about: true,
        testimonials: true,
        accommodation: false,
        gallery: false,
        faq: true,
        finalCta: true,
      },
      hero: {
        headline: "Focus on Your Craft. We'll Handle the Rest.",
        subheadline:
          'Business growth services for entrepreneurs who want to spend less time on admin and more time doing what they love.',
        ctaText: 'See Our Packages',
      },
      socialProofBar: {
        items: [
          { icon: 'users', text: '200+ clients served' },
          { icon: 'star', text: '4.9★ average rating' },
          { icon: 'check', text: '95% client retention' },
        ],
      },
      about: {
        headline: 'Your Back Office, Handled.',
        content: `Running a business is hard enough without drowning in admin work. We partner with solopreneurs and small teams to handle the operational tasks that drain your energy—so you can focus on the work that matters.

From CRM setup to marketing automation, we've got you covered. Think of us as the operations team you've always wanted, without the overhead of full-time employees.`,
        imagePosition: 'right',
      },
      testimonials: {
        headline: 'What Our Clients Say.',
        items: [
          {
            quote:
              "I was spending 15 hours a week on admin tasks. Now I spend 15 minutes reviewing what they've done. Life-changing.",
            author: 'Alex Rivera',
            role: 'Photographer',
            rating: 5,
          },
          {
            quote:
              "Finally, someone who understands small business. They don't try to over-engineer solutions—they just make things work.",
            author: 'Jamie Chen',
            role: 'Consultant',
            rating: 5,
          },
        ],
      },
      faq: {
        headline: 'Common Questions.',
        items: [
          {
            question: 'How quickly can you get started?',
            answer:
              "Most clients are onboarded within a week. We'll have a kickoff call, gather your current tools and processes, and hit the ground running.",
          },
          {
            question: 'Do you work with any industry?',
            answer:
              'We specialize in service-based businesses—photographers, consultants, coaches, agencies. If you sell your expertise, we can help.',
          },
          {
            question: 'What if I already have some tools in place?',
            answer:
              "Great! We'll work with what you have. Our goal is to optimize, not overhaul. We'll only recommend changes that provide clear ROI.",
          },
        ],
      },
      finalCta: {
        headline: 'Ready to Reclaim Your Time?',
        subheadline: "Let's build a business that works for you, not the other way around.",
        ctaText: 'Get Started',
      },
    },
  },
  tierDisplayNames: {
    basic: 'Starter',
    standard: 'Growth',
    premium: 'Enterprise',
    custom: 'Custom',
  },
};

export async function upgradeTenantPages(): Promise<void> {
  logger.info('Starting tenant pages upgrade...');

  const updates = [
    { slug: 'la-petit-mariage', config: LA_PETIT_MARIAGE_CONFIG, name: 'La Petit Mariage' },
    { slug: 'little-bit-farm', config: LITTLE_BIT_FARM_CONFIG, name: 'Little Bit Horse Farm' },
  ];

  for (const { slug, config, name } of updates) {
    const tenant = await prisma.tenant.findUnique({ where: { slug } });

    if (!tenant) {
      logger.warn({ slug }, `Tenant not found, skipping: ${name}`);
      continue;
    }

    // Merge existing branding with new config
    const existingBranding =
      typeof tenant.branding === 'object' && tenant.branding !== null ? tenant.branding : {};

    await prisma.tenant.update({
      where: { slug },
      data: {
        branding: {
          ...existingBranding,
          ...config.branding,
        },
        tierDisplayNames: config.tierDisplayNames,
      },
    });

    logger.info({ slug }, `Updated tenant: ${name}`);
  }

  // Check for demo tenant with 'little-bit-farm' slug (from demo.ts seed)
  // This is different from 'little-bit-farm' used by little-bit-horse-farm.ts
  // Note: They share the same slug, so we've already updated it above

  logger.info('='.repeat(60));
  logger.info('TENANT PAGES UPGRADE COMPLETE');
  logger.info('='.repeat(60));
  logger.info(`Updated tenants: ${updates.length}`);
  logger.info('Each tenant now has:');
  logger.info('  - Rich landing page configuration');
  logger.info('  - Hero section with headline and CTA');
  logger.info('  - About section with content');
  logger.info('  - Testimonials from satisfied customers');
  logger.info('  - FAQ section for common questions');
  logger.info('  - Custom tier display names');
  logger.info('='.repeat(60));
}

// Note: This module is executed via seed.ts, not directly
