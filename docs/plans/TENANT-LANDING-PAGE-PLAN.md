# Tenant Landing Page - Implementation Plan

## Overview

Transform the tenant storefront from a simple segment selector into a full landing page with configurable sections that optimize for conversions. Each section is optional and manageable via the tenant admin dashboard.

## Architecture

### Data Storage

**Extend existing `Tenant.branding` JSON field** to include landing page configuration:

```typescript
interface TenantBranding {
  // Existing fields
  primaryColor?: string;
  secondaryColor?: string;
  accentColor?: string;
  backgroundColor?: string;
  fontFamily?: string;
  logoUrl?: string;

  // NEW: Landing page configuration
  landingPage?: {
    // Section visibility toggles
    sections: {
      hero: boolean;
      socialProofBar: boolean;
      segmentSelector: boolean; // Always true by default
      about: boolean;
      testimonials: boolean;
      accommodation: boolean;
      gallery: boolean;
      faq: boolean;
      finalCta: boolean;
    };

    // Hero Section
    hero?: {
      headline: string;
      subheadline: string;
      ctaText: string;
      backgroundImageUrl?: string;
    };

    // Social Proof Bar
    socialProofBar?: {
      items: Array<{
        icon: 'star' | 'calendar' | 'users' | 'award';
        text: string;
      }>;
    };

    // About Section
    about?: {
      headline: string;
      content: string; // Markdown supported
      imageUrl?: string;
      imagePosition: 'left' | 'right';
    };

    // Testimonials
    testimonials?: {
      headline: string;
      items: Array<{
        quote: string;
        author: string;
        role?: string;
        imageUrl?: string;
        rating: number; // 1-5
      }>;
    };

    // Accommodation/Airbnb Section
    accommodation?: {
      headline: string;
      description: string;
      imageUrl?: string;
      ctaText: string;
      ctaUrl: string; // Airbnb link
      highlights: string[]; // "Sleeps 6", "Full kitchen", etc.
    };

    // Gallery
    gallery?: {
      headline: string;
      images: Array<{
        url: string;
        alt: string;
      }>;
      instagramHandle?: string;
    };

    // FAQ
    faq?: {
      headline: string;
      items: Array<{
        question: string;
        answer: string; // Markdown supported
      }>;
    };

    // Final CTA
    finalCta?: {
      headline: string;
      subheadline: string;
      ctaText: string;
    };
  };
}
```

### Component Structure

```
client/src/features/storefront/landing/
├── LandingPage.tsx              # Main orchestrator
├── sections/
│   ├── HeroSection.tsx          # Full-width hero with CTA
│   ├── SocialProofBar.tsx       # Trust badges/stats
│   ├── SegmentSelector.tsx      # Existing segment cards (refactored)
│   ├── AboutSection.tsx         # Story/about with image
│   ├── TestimonialsSection.tsx  # Client testimonials carousel
│   ├── AccommodationSection.tsx # Airbnb/stay promotion
│   ├── GallerySection.tsx       # Photo grid + Instagram
│   ├── FaqSection.tsx           # Accordion FAQ
│   └── FinalCtaSection.tsx      # Bottom CTA
├── components/
│   ├── TestimonialCard.tsx      # Individual testimonial
│   ├── FaqItem.tsx              # Accordion item
│   └── GalleryGrid.tsx          # Photo grid
└── hooks/
    └── useLandingPageConfig.ts  # Fetch/manage config
```

### Admin Dashboard Extension

```
client/src/features/tenant-admin/landing/
├── LandingPageEditor.tsx        # Main editor page
├── sections/
│   ├── SectionToggle.tsx        # Enable/disable sections
│   ├── HeroEditor.tsx           # Edit hero content
│   ├── AboutEditor.tsx          # Edit about content
│   ├── TestimonialsEditor.tsx   # Manage testimonials
│   ├── AccommodationEditor.tsx  # Edit Airbnb section
│   ├── GalleryEditor.tsx        # Manage gallery images
│   └── FaqEditor.tsx            # Manage FAQ items
└── components/
    ├── ImageUploader.tsx        # Reusable image upload
    └── MarkdownEditor.tsx       # Simple markdown input
```

## Implementation Phases

### Phase 1: Core Infrastructure (Day 1)
1. Update `TenantBrandingDtoSchema` in contracts with landing page types
2. Create API endpoints:
   - `GET /v1/tenant-admin/landing` - Fetch landing config
   - `PUT /v1/tenant-admin/landing` - Update landing config
3. Create `useLandingPageConfig` hook
4. Create `LandingPage.tsx` orchestrator component

### Phase 2: Section Components (Day 1-2)
1. **HeroSection** - Full-width background, headline, CTA button
2. **SocialProofBar** - Horizontal bar with trust indicators
3. **AboutSection** - Two-column layout (image + text)
4. **TestimonialsSection** - Card carousel with ratings
5. **AccommodationSection** - Feature card with CTA
6. **GallerySection** - Responsive grid + Instagram link
7. **FaqSection** - Accordion with expand/collapse
8. **FinalCtaSection** - Repeat CTA at bottom

### Phase 3: Admin Editor (Day 2-3)
1. Add "Landing Page" tab to tenant dashboard
2. Section toggle grid (enable/disable)
3. Inline editors for each section
4. Live preview capability
5. Image upload integration (reuse existing)

### Phase 4: Polish & Testing (Day 3)
1. Responsive design testing
2. A11y audit (keyboard nav, screen readers)
3. Performance optimization (lazy load images)
4. Default content generation for new tenants

## API Changes

### New Endpoints

```typescript
// GET /v1/tenant-admin/landing
// Returns current landing page configuration
{
  sections: { hero: true, about: true, ... },
  hero: { headline: "...", ... },
  ...
}

// PUT /v1/tenant-admin/landing
// Update landing page configuration
// Body: Partial<LandingPageConfig>
```

### Public Endpoint Update

Extend `GET /v1/public/tenants/:slug` response to include landing page config:

```typescript
{
  id: "...",
  slug: "little-bit-farm",
  name: "Little Bit Farm",
  apiKeyPublic: "pk_live_...",
  branding: {
    primaryColor: "#1a365d",
    // ...existing fields...
    landingPage: {
      sections: { hero: true, ... },
      hero: { headline: "Your Story Starts Here", ... },
      // ...
    }
  }
}
```

## Default Content (Little Bit Farm)

### Hero
- **Headline**: "Your Story Starts Here"
- **Subheadline**: "Intimate celebrations, peaceful retreats, and unforgettable getaways on our family farm"
- **CTA**: "Explore Experiences"

### Social Proof Bar
- "★★★★★ 50+ Happy Guests"
- "Est. 2020"
- "Family Owned"

### About
- **Headline**: "Welcome to Little Bit Farm"
- **Content**:
  ```
  Nestled in the rolling hills of [location], Little Bit Farm is a family-owned
  venue where modern meets rustic charm. Our 50-acre property features historic
  barns, scenic pastures, and friendly farm animals who love meeting guests.

  Whether you're planning an intimate wedding celebration, a rejuvenating
  wellness retreat, or a weekend escape from city life, we create personalized
  experiences that feel like coming home.
  ```

### Testimonials
1. "The most magical day of our lives. The team went above and beyond to make our micro-wedding absolutely perfect." - Sarah & James M., Wedding 2024
2. "I came for a wellness retreat and left feeling completely renewed. The equine therapy session was life-changing." - Amanda R., Retreat Guest
3. "Our family weekend getaway exceeded all expectations. The kids couldn't stop talking about the goats!" - The Johnson Family, Weekend Guests

### Accommodation
- **Headline**: "Extend Your Stay"
- **Description**: "Book our cozy farmhouse cottage for the complete Little Bit Farm experience. Wake up to pastoral views, enjoy farm-fresh breakfast, and have the grounds to yourself."
- **CTA**: "View on Airbnb"
- **Highlights**: ["Sleeps 6", "Full Kitchen", "Private Hot Tub", "Farm-Fresh Breakfast"]

### FAQ
1. **How far in advance should I book?**
   Popular dates book 6-12 months in advance for weddings, 2-4 weeks for wellness retreats and getaways.

2. **What's included in the packages?**
   Each package includes venue access, setup/breakdown, and coordinator support. Add-ons like catering, photography, and florals are available separately.

3. **Are your animals friendly?**
   Yes! Our mini donkeys, goats, and alpacas love meeting guests. They're gentle and supervised during any animal encounters.

4. **Do you accommodate dietary restrictions?**
   Absolutely. Our catering partners offer vegetarian, vegan, gluten-free, and allergy-friendly options.

5. **What's the cancellation policy?**
   Full refund up to 60 days before your event. 50% refund between 30-60 days. Within 30 days, credit toward future booking.

6. **Is there parking on-site?**
   Yes, we have free parking for up to 30 vehicles with easy access to the venue areas.

### Final CTA
- **Headline**: "Ready to Start Planning?"
- **Subheadline**: "Let's create something unforgettable together"
- **CTA**: "Explore Packages"

## Files to Create/Modify

### New Files
- `client/src/features/storefront/landing/LandingPage.tsx`
- `client/src/features/storefront/landing/sections/*.tsx` (8 section components)
- `client/src/features/storefront/landing/hooks/useLandingPageConfig.ts`
- `client/src/features/tenant-admin/landing/LandingPageEditor.tsx`
- `client/src/features/tenant-admin/landing/sections/*.tsx` (7 editor components)
- `packages/contracts/src/landing-page.ts` (types/schemas)
- `server/src/routes/landing.routes.ts` (API endpoints)

### Modified Files
- `packages/contracts/src/dto.ts` - Extend branding schema
- `packages/contracts/src/api.v1.ts` - Add landing endpoints
- `client/src/pages/StorefrontHome.tsx` - Use LandingPage component
- `client/src/features/tenant-admin/TenantDashboard/index.tsx` - Add landing tab
- `server/src/routes/tenant-admin.routes.ts` - Mount landing routes

## Migration Strategy

1. **No database migration needed** - Uses existing `branding` JSON field
2. **Backwards compatible** - Old tenants show current behavior (segment selector only)
3. **Opt-in activation** - Tenants enable sections via dashboard
4. **Default templates** - New tenants get starter content they can customize

## Success Metrics

- Section render time < 100ms each
- Total page load < 2s on 3G
- All sections pass WCAG 2.1 AA
- Mobile-responsive at all breakpoints
- Admin can configure in < 5 minutes
