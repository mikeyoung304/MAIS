# Research-Optimized Locked Template System (Simplified)

> Transform tenant storefronts into Apple-like premium experiences with research-backed design - shipped in 2 days, not 3 phases.

**Type:** ✨ Enhancement
**Priority:** P0 - Core Platform Feature
**Estimated Effort:** 2 days
**Status:** Ready for Implementation

---

## Overview

Evolve the existing tenant storefront system into a locked template where tenants customize content but not structure. Following DHH's principle: **evolution over revolution**.

### What We're Building

1. **Page-level toggles** - Enable/disable entire pages (not sections)
2. **Dynamic navigation** - Nav updates based on enabled pages
3. **All 7 pages ON by default** - Research-backed page set
4. **Flexible section schema** - One schema, multiple section types
5. **Mock data for new tenants** - Good defaults out of the box

### What We're NOT Building (Yet)

- ❌ Photo auto-processing (let Next.js handle it)
- ❌ New `pageConfig` field (evolve existing `landingPageConfig`)
- ❌ Service classes (use pure functions)
- ❌ 7 separate page schemas (use 1 flexible schema)

---

## Technical Approach

### Step 1: Evolve the Schema (Morning)

**File:** `packages/contracts/src/landing-page.ts`

```typescript
import { z } from 'zod';

// Flexible section-based schema
const SectionSchema = z.discriminatedUnion('type', [
  z.object({
    type: z.literal('hero'),
    headline: z.string().min(1).max(60),
    subheadline: z.string().max(150).optional(),
    ctaText: z.string().max(30).default('View Packages'),
    backgroundImageUrl: z.string().url().optional(),
  }),
  z.object({
    type: z.literal('text'),
    headline: z.string().max(60).optional(),
    content: z.string().min(1).max(2000),
    imageUrl: z.string().url().optional(),
    imagePosition: z.enum(['left', 'right']).default('left'),
  }),
  z.object({
    type: z.literal('gallery'),
    headline: z.string().max(60).default('Our Work'),
    images: z.array(z.object({
      url: z.string().url(),
      alt: z.string().max(200),
    })).min(1).max(50),
    instagramHandle: z.string().max(30).optional(),
  }),
  z.object({
    type: z.literal('testimonials'),
    headline: z.string().max(60).default('What Clients Say'),
    items: z.array(z.object({
      quote: z.string().min(10).max(300),
      authorName: z.string().min(1).max(100),
      authorRole: z.string().max(50).optional(),
      authorPhotoUrl: z.string().url().optional(),
      rating: z.number().min(1).max(5).default(5),
    })).min(1).max(12),
  }),
  z.object({
    type: z.literal('faq'),
    headline: z.string().max(60).default('FAQ'),
    items: z.array(z.object({
      question: z.string().min(1).max(200),
      answer: z.string().min(1).max(1000),
    })).min(1).max(20),
  }),
  z.object({
    type: z.literal('contact'),
    headline: z.string().max(60).default('Get in Touch'),
    email: z.string().email().optional(),
    phone: z.string().max(20).optional(),
    address: z.string().max(300).optional(),
    hours: z.string().max(500).optional(),
  }),
  z.object({
    type: z.literal('cta'),
    headline: z.string().max(60),
    subheadline: z.string().max(150).optional(),
    ctaText: z.string().max(30).default('Get Started'),
  }),
]);

export type Section = z.infer<typeof SectionSchema>;

// Page configuration - replaces old section toggles
const PageSchema = z.object({
  enabled: z.boolean().default(true),
  sections: z.array(SectionSchema),
});

// Updated landing page config
export const LandingPageConfigSchema = z.object({
  pages: z.object({
    home: PageSchema.extend({ enabled: z.literal(true) }), // Always enabled
    about: PageSchema,
    services: PageSchema,
    faq: PageSchema,
    contact: PageSchema,
    gallery: PageSchema,
    testimonials: PageSchema,
  }),
});

export type LandingPageConfig = z.infer<typeof LandingPageConfigSchema>;
```

### Step 2: Update Navigation (30 min)

**File:** `apps/web/src/components/tenant/navigation.ts`

```typescript
import type { LandingPageConfig } from '@macon/contracts';

const PAGE_ORDER = ['home', 'about', 'services', 'gallery', 'testimonials', 'faq', 'contact'] as const;

const PAGE_LABELS: Record<string, string> = {
  home: 'Home',
  about: 'About',
  services: 'Services',
  gallery: 'Gallery',
  testimonials: 'Testimonials',
  faq: 'FAQ',
  contact: 'Contact',
};

export interface NavItem {
  label: string;
  path: string;
}

export function getNavigationItems(config: LandingPageConfig): NavItem[] {
  return PAGE_ORDER
    .filter(page => config.pages[page]?.enabled)
    .map(page => ({
      label: PAGE_LABELS[page],
      path: page === 'home' ? '' : `/${page}`,
    }));
}

// Legacy export for backward compatibility during transition
export const NAV_ITEMS = getNavigationItems(getDefaultConfig());
```

### Step 3: Handle Disabled Pages (30 min)

**File:** `apps/web/src/app/t/[slug]/(site)/about/page.tsx` (and other pages)

```typescript
import { notFound } from 'next/navigation';
import { getTenantBySlug } from '@/lib/tenant';

export default async function AboutPage({ params }: Props) {
  const { slug } = await params;
  const tenant = await getTenantBySlug(slug);

  if (!tenant) {
    notFound();
  }

  const config = tenant.branding?.landingPage as LandingPageConfig;

  // Check if page is enabled
  if (!config?.pages?.about?.enabled) {
    // Return 410 Gone for disabled pages
    notFound(); // Next.js handles this gracefully
  }

  return <AboutPageContent tenant={tenant} sections={config.pages.about.sections} />;
}
```

### Step 4: Create Section Renderer (1 hour)

**File:** `apps/web/src/components/tenant/SectionRenderer.tsx` (NEW)

```typescript
import type { Section } from '@macon/contracts';
import { HeroSection } from './sections/HeroSection';
import { TextSection } from './sections/TextSection';
import { GallerySection } from './sections/GallerySection';
import { TestimonialsSection } from './sections/TestimonialsSection';
import { FAQSection } from './sections/FAQSection';
import { ContactSection } from './sections/ContactSection';
import { CTASection } from './sections/CTASection';

const SECTION_COMPONENTS = {
  hero: HeroSection,
  text: TextSection,
  gallery: GallerySection,
  testimonials: TestimonialsSection,
  faq: FAQSection,
  contact: ContactSection,
  cta: CTASection,
} as const;

interface Props {
  sections: Section[];
  tenant: TenantPublicDto;
}

export function SectionRenderer({ sections, tenant }: Props) {
  return (
    <main>
      {sections.map((section, index) => {
        const Component = SECTION_COMPONENTS[section.type];
        return <Component key={index} {...section} tenant={tenant} />;
      })}
    </main>
  );
}
```

### Step 5: Update TenantNav to Use Dynamic Navigation (30 min)

**File:** `apps/web/src/components/tenant/TenantNav.tsx`

```typescript
// Change from:
import { NAV_ITEMS } from './navigation';

// To:
import { getNavigationItems } from './navigation';

export function TenantNav({ tenant, basePath }: Props) {
  const config = tenant.branding?.landingPage as LandingPageConfig;
  const navItems = useMemo(
    () => getNavigationItems(config),
    [config]
  );

  // ... rest of component uses navItems instead of NAV_ITEMS
}
```

### Step 6: Default Content for New Tenants (30 min)

**File:** `packages/contracts/src/landing-page.ts` (add to existing)

```typescript
export const DEFAULT_LANDING_PAGE_CONFIG: LandingPageConfig = {
  pages: {
    home: {
      enabled: true,
      sections: [
        {
          type: 'hero',
          headline: 'Welcome to Our Studio',
          subheadline: 'Professional services tailored to your needs',
          ctaText: 'View Packages',
        },
        {
          type: 'cta',
          headline: 'Ready to get started?',
          subheadline: 'Book your session today',
          ctaText: 'View Packages',
        },
      ],
    },
    about: {
      enabled: true,
      sections: [
        {
          type: 'text',
          headline: 'About Us',
          content: 'We are passionate professionals dedicated to delivering exceptional service.',
          imagePosition: 'left',
        },
      ],
    },
    services: {
      enabled: true,
      sections: [], // Services page pulls from packages, not sections
    },
    faq: {
      enabled: true,
      sections: [
        {
          type: 'faq',
          headline: 'Frequently Asked Questions',
          items: [
            { question: 'How do I book?', answer: 'Browse our services and complete the booking form.' },
            { question: 'What is your cancellation policy?', answer: 'Cancel up to 48 hours before for a full refund.' },
            { question: 'Do you offer custom packages?', answer: 'Yes! Contact us to discuss your needs.' },
          ],
        },
      ],
    },
    contact: {
      enabled: true,
      sections: [
        {
          type: 'contact',
          headline: 'Get in Touch',
        },
      ],
    },
    gallery: {
      enabled: true,
      sections: [
        {
          type: 'gallery',
          headline: 'Our Work',
          images: [],
        },
      ],
    },
    testimonials: {
      enabled: true,
      sections: [
        {
          type: 'testimonials',
          headline: 'What Clients Say',
          items: [
            { quote: 'Wonderful experience!', authorName: 'Happy Client', rating: 5 },
          ],
        },
      ],
    },
  },
};
```

### Step 7: Migration Script (1 hour)

**File:** `server/scripts/migrate-to-page-config.ts`

```typescript
import { PrismaClient } from '@prisma/client';
import { DEFAULT_LANDING_PAGE_CONFIG } from '@macon/contracts';

const prisma = new PrismaClient();

async function migrate() {
  const tenants = await prisma.tenant.findMany();

  console.log(`Migrating ${tenants.length} tenants...`);

  for (const tenant of tenants) {
    const oldConfig = tenant.landingPageConfig as any;

    // Start with defaults
    const newConfig = structuredClone(DEFAULT_LANDING_PAGE_CONFIG);

    // Migrate existing hero content
    if (oldConfig?.hero) {
      newConfig.pages.home.sections[0] = {
        type: 'hero',
        headline: oldConfig.hero.headline || 'Welcome',
        subheadline: oldConfig.hero.subheadline,
        ctaText: oldConfig.hero.ctaText || 'View Packages',
        backgroundImageUrl: oldConfig.hero.backgroundImageUrl,
      };
    }

    // Migrate about content
    if (oldConfig?.about) {
      newConfig.pages.about.sections[0] = {
        type: 'text',
        headline: oldConfig.about.headline || 'About',
        content: oldConfig.about.content || '',
        imageUrl: oldConfig.about.imageUrl,
        imagePosition: oldConfig.about.imagePosition || 'left',
      };
    }

    // Migrate FAQ
    if (oldConfig?.faq?.items?.length > 0) {
      newConfig.pages.faq.sections[0] = {
        type: 'faq',
        headline: oldConfig.faq.headline || 'FAQ',
        items: oldConfig.faq.items,
      };
    }

    // Migrate testimonials
    if (oldConfig?.testimonials?.items?.length > 0) {
      newConfig.pages.testimonials.sections[0] = {
        type: 'testimonials',
        headline: oldConfig.testimonials.headline || 'Testimonials',
        items: oldConfig.testimonials.items.map((t: any) => ({
          quote: t.quote,
          authorName: t.author,
          authorRole: t.role,
          authorPhotoUrl: t.imageUrl,
          rating: t.rating || 5,
        })),
      };
    }

    // Migrate gallery
    if (oldConfig?.gallery?.images?.length > 0) {
      newConfig.pages.gallery.sections[0] = {
        type: 'gallery',
        headline: oldConfig.gallery.headline || 'Gallery',
        images: oldConfig.gallery.images,
        instagramHandle: oldConfig.gallery.instagramHandle,
      };
    }

    // Preserve page visibility from old section toggles
    if (oldConfig?.sections) {
      newConfig.pages.about.enabled = oldConfig.sections.about ?? true;
      newConfig.pages.faq.enabled = oldConfig.sections.faq ?? true;
      newConfig.pages.gallery.enabled = oldConfig.sections.gallery ?? true;
      newConfig.pages.testimonials.enabled = oldConfig.sections.testimonials ?? true;
    }

    await prisma.tenant.update({
      where: { id: tenant.id },
      data: { landingPageConfig: newConfig },
    });

    console.log(`✓ Migrated: ${tenant.slug}`);
  }

  console.log('Migration complete!');
}

migrate()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
```

### Step 8: Clean Up Dead Code (30 min)

**Remove:**
- `AccommodationSectionConfigSchema` from landing-page.ts
- `accommodation` from valid sections in routes
- Old section toggle logic in `TenantLandingPage.tsx`

**Update:**
- `TenantLandingPage.tsx` to use new `SectionRenderer`
- API contracts if needed

---

## Files to Create/Modify

| File | Action | Effort |
|------|--------|--------|
| `packages/contracts/src/landing-page.ts` | UPDATE - new schema | 1 hour |
| `apps/web/src/components/tenant/navigation.ts` | UPDATE - dynamic nav | 30 min |
| `apps/web/src/components/tenant/SectionRenderer.tsx` | NEW | 30 min |
| `apps/web/src/components/tenant/sections/*.tsx` | NEW - 7 small components | 1 hour |
| `apps/web/src/components/tenant/TenantNav.tsx` | UPDATE - use dynamic nav | 30 min |
| `apps/web/src/components/tenant/TenantFooter.tsx` | UPDATE - use dynamic nav | 15 min |
| `apps/web/src/app/t/[slug]/(site)/*/page.tsx` | UPDATE - check enabled | 30 min |
| `server/scripts/migrate-to-page-config.ts` | NEW | 1 hour |

**Total: ~6 hours of focused work**

---

## Acceptance Criteria

- [ ] All 7 pages render correctly
- [ ] Page toggles enable/disable pages
- [ ] Navigation dynamically updates based on enabled pages
- [ ] Home page cannot be disabled
- [ ] Disabled pages return 404 (Next.js notFound)
- [ ] Existing tenants migrated with content preserved
- [ ] New tenants get default content
- [ ] All existing tests pass

---

## Testing Strategy

1. **Before migration:** Test on staging with copy of prod data
2. **After migration:** Spot check 5 tenants manually
3. **Regression:** Run existing E2E tests
4. **New tests:** Add tests for page toggle logic

---

## Rollback Plan

If something goes wrong:
1. The migration only updates `landingPageConfig` JSON
2. Old data structure still works with old code
3. Revert code, old config still renders
4. No schema migration = no database rollback needed

---

## What's NOT in This Plan (Future Work)

1. **Photo auto-processing** - Defer until we see evidence of need
2. **Admin UI for page toggles** - Add to tenant dashboard later
3. **Industry-specific templates** - Future enhancement
4. **A/B testing** - Future enhancement

---

## References

### Reviewer Feedback Applied

- ✅ DHH: Evolve existing schema, don't add new field
- ✅ DHH: Skip photo processing for now
- ✅ DHH: This could ship in 2 days
- ✅ Simplicity: Use flexible section schema (1 instead of 7)
- ✅ Simplicity: Pure functions, not service classes
- ✅ Kieran: Test thoroughly on staging

### Research Backing

- [CXL CTA Research](https://cxl.com/blog/which-color-converts-the-best/) - Page structure
- [Apple HIG](https://developer.apple.com/design/human-interface-guidelines/) - Locked design philosophy
- Existing: `docs/design/BRAND_VOICE_GUIDE.md`

---

*Simplified based on DHH, Kieran, and Code Simplicity reviews*
*Last updated: December 2025*
