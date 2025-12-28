/**
 * Migration Script: Legacy Section Config → Page-Based Config
 *
 * Migrates existing tenants from the old section-toggle system to
 * the new page-based configuration system.
 *
 * Strategy:
 * - Preserves all existing content (hero, about, testimonials, gallery, faq)
 * - Converts section visibility toggles to page-level enabled flags
 * - Uses default content for new pages if needed
 * - Dry-run mode for testing before applying changes
 *
 * Usage:
 *   npx tsx scripts/migrate-to-page-config.ts           # Dry run
 *   npx tsx scripts/migrate-to-page-config.ts --apply   # Apply changes
 */

import { PrismaClient } from '@prisma/client';
import {
  LandingPageConfig,
  DEFAULT_PAGES_CONFIG,
  PagesConfig,
  HeroSection,
  TextSection,
  FAQSection,
  GallerySection,
  TestimonialsSection,
  ContactSection,
  CTASection,
} from '@macon/contracts';

const prisma = new PrismaClient();
const DRY_RUN = !process.argv.includes('--apply');

interface LegacySectionConfig {
  hero?: boolean;
  socialProofBar?: boolean;
  segmentSelector?: boolean;
  about?: boolean;
  testimonials?: boolean;
  accommodation?: boolean;
  gallery?: boolean;
  faq?: boolean;
  finalCta?: boolean;
}

interface LegacyHeroConfig {
  headline?: string;
  subheadline?: string;
  ctaText?: string;
  backgroundImageUrl?: string;
}

interface LegacyAboutConfig {
  headline?: string;
  content?: string;
  imageUrl?: string;
}

interface LegacyFaqConfig {
  headline?: string;
  items?: Array<{ question: string; answer: string }>;
}

interface LegacyGalleryConfig {
  headline?: string;
  images?: Array<{ url: string; alt?: string }>;
  instagramHandle?: string;
}

interface LegacyTestimonialsConfig {
  headline?: string;
  items?: Array<{
    quote: string;
    author: string;
    role?: string;
    imageUrl?: string;
    rating?: number;
  }>;
}

interface LegacyFinalCtaConfig {
  headline?: string;
  subheadline?: string;
  ctaText?: string;
}

interface LegacyLandingPageConfig {
  sections?: LegacySectionConfig;
  hero?: LegacyHeroConfig;
  about?: LegacyAboutConfig;
  faq?: LegacyFaqConfig;
  gallery?: LegacyGalleryConfig;
  testimonials?: LegacyTestimonialsConfig;
  finalCta?: LegacyFinalCtaConfig;
  pages?: PagesConfig; // Already migrated if this exists
}

/**
 * Convert legacy section-based config to new page-based config
 */
function migrateConfig(legacy: LegacyLandingPageConfig | null): LandingPageConfig {
  // If already migrated (has pages field), return as-is
  if (legacy?.pages) {
    console.log('  → Already migrated, skipping');
    return legacy as LandingPageConfig;
  }

  // Start with default pages config
  const pages: PagesConfig = JSON.parse(JSON.stringify(DEFAULT_PAGES_CONFIG));

  // Convert hero section
  if (legacy?.hero) {
    const heroSection: HeroSection = {
      type: 'hero',
      headline: legacy.hero.headline || 'Welcome',
      subheadline: legacy.hero.subheadline,
      ctaText: legacy.hero.ctaText || 'View Packages',
      backgroundImageUrl: legacy.hero.backgroundImageUrl,
    };
    pages.home.sections = [heroSection, ...pages.home.sections];

    // Add CTA if final CTA was configured
    if (legacy?.finalCta) {
      const ctaSection: CTASection = {
        type: 'cta',
        headline: legacy.finalCta.headline || 'Ready to get started?',
        subheadline: legacy.finalCta.subheadline,
        ctaText: legacy.finalCta.ctaText || 'Get Started',
      };
      pages.home.sections.push(ctaSection);
    }
  }

  // Convert about section - only create if content exists
  if (legacy?.about?.content && legacy.about.content.trim()) {
    const textSection: TextSection = {
      type: 'text',
      headline: legacy.about.headline || 'About Us',
      content: legacy.about.content,
      imageUrl: legacy.about.imageUrl,
      imagePosition: 'left',
    };
    pages.about.sections = [textSection];
    pages.about.enabled = legacy.sections?.about !== false;
  } else {
    pages.about.enabled = legacy?.sections?.about !== false;
  }

  // Services page - always enabled if we have packages
  pages.services.enabled = true;

  // Convert FAQ section
  if (legacy?.faq?.items && legacy.faq.items.length > 0) {
    const faqSection: FAQSection = {
      type: 'faq',
      headline: legacy.faq.headline || 'Frequently Asked Questions',
      items: legacy.faq.items.map((item) => ({
        question: item.question,
        answer: item.answer,
      })),
    };
    pages.faq.sections = [faqSection];
    pages.faq.enabled = legacy.sections?.faq !== false;
  } else {
    pages.faq.enabled = legacy?.sections?.faq !== false;
  }

  // Convert gallery section
  if (legacy?.gallery) {
    const gallerySection: GallerySection = {
      type: 'gallery',
      headline: legacy.gallery.headline || 'Our Work',
      images: (legacy.gallery.images || []).map((img) => ({
        url: img.url,
        alt: img.alt || '',
      })),
      instagramHandle: legacy.gallery.instagramHandle,
    };
    pages.gallery.sections = [gallerySection];
    pages.gallery.enabled = legacy.sections?.gallery !== false;
  } else {
    pages.gallery.enabled = legacy?.sections?.gallery !== false;
  }

  // Convert testimonials section
  if (legacy?.testimonials?.items && legacy.testimonials.items.length > 0) {
    const testimonialsSection: TestimonialsSection = {
      type: 'testimonials',
      headline: legacy.testimonials.headline || 'What Clients Say',
      items: legacy.testimonials.items.map((item) => ({
        quote: item.quote,
        authorName: item.author,
        authorRole: item.role,
        authorPhotoUrl: item.imageUrl,
        rating: item.rating || 5,
      })),
    };
    pages.testimonials.sections = [testimonialsSection];
    pages.testimonials.enabled = legacy.sections?.testimonials !== false;
  } else {
    pages.testimonials.enabled = legacy?.sections?.testimonials !== false;
  }

  // Contact page - default content
  const contactSection: ContactSection = {
    type: 'contact',
    headline: 'Get in Touch',
  };
  pages.contact.sections = [contactSection];
  pages.contact.enabled = true;

  // Return new config with pages
  return {
    pages,
    // Keep legacy fields for backward compatibility during transition
    sections: legacy?.sections,
    hero: legacy?.hero,
    about: legacy?.about,
    testimonials: legacy?.testimonials,
    gallery: legacy?.gallery,
    faq: legacy?.faq,
    finalCta: legacy?.finalCta,
  } as LandingPageConfig;
}

async function main() {
  console.log('');
  console.log('='.repeat(60));
  console.log('Migration: Legacy Section Config → Page-Based Config');
  console.log('='.repeat(60));
  console.log('');
  console.log(
    `Mode: ${DRY_RUN ? 'DRY RUN (no changes will be made)' : 'APPLY (changes will be committed)'}`
  );
  console.log('');

  // Fetch all tenants with landing page config
  const tenants = await prisma.tenant.findMany({
    select: {
      id: true,
      slug: true,
      name: true,
      landingPageConfig: true,
    },
  });

  console.log(`Found ${tenants.length} tenant(s) to process\n`);

  let migratedCount = 0;
  let skippedCount = 0;
  let errorCount = 0;

  for (const tenant of tenants) {
    console.log(`Processing: ${tenant.name} (${tenant.slug})`);

    try {
      const legacyConfig = tenant.landingPageConfig as LegacyLandingPageConfig | null;

      // Check if already migrated
      if (legacyConfig?.pages) {
        console.log('  → Already has pages config, skipping');
        skippedCount++;
        continue;
      }

      // Migrate the config
      const newConfig = migrateConfig(legacyConfig);

      if (!DRY_RUN) {
        await prisma.tenant.update({
          where: { id: tenant.id },
          data: { landingPageConfig: newConfig as object },
        });
        console.log('  ✓ Migrated successfully');
      } else {
        console.log('  ✓ Would migrate (dry run)');
        console.log(
          `    - Pages enabled: ${Object.entries(newConfig.pages || {})
            .filter(([, v]) => v.enabled)
            .map(([k]) => k)
            .join(', ')}`
        );
      }

      migratedCount++;
    } catch (error) {
      console.error(`  ✗ Error: ${error instanceof Error ? error.message : 'Unknown error'}`);
      errorCount++;
    }
  }

  console.log('');
  console.log('='.repeat(60));
  console.log('Migration Summary');
  console.log('='.repeat(60));
  console.log(`  Total tenants: ${tenants.length}`);
  console.log(`  Migrated: ${migratedCount}`);
  console.log(`  Skipped (already migrated): ${skippedCount}`);
  console.log(`  Errors: ${errorCount}`);
  console.log('');

  if (DRY_RUN) {
    console.log('This was a DRY RUN. To apply changes, run:');
    console.log('  npx tsx scripts/migrate-to-page-config.ts --apply');
    console.log('');
  }
}

main()
  .catch((error) => {
    console.error('Migration failed:', error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
