# Hosted Website Template - Complete Implementation Plan

**Status:** Approved (Post-Review)
**Created:** 2025-12-25
**Priority:** High
**Estimated Duration:** 6-8 weeks (Enterprise Quality)
**Review Date:** 2025-12-25
**Reviewers:** DHH-Style, Senior Engineer, Code Simplicity

---

## Executive Summary

Migrate MAIS frontend from Vite/React to Next.js, enabling SEO-optimized, multi-page tenant websites with custom domain support. Each tenant starts with an "optimal" website template based on conversion best practices and the MAIS brand voice guide.

### Architecture Decision
```
┌─────────────────────────────────────────────────────────────┐
│                         Vercel                               │
│  ┌─────────────────────────────────────────────────────────┐│
│  │              Next.js App (NEW)                          ││
│  │  • SSR/SSG for SEO                                      ││
│  │  • Custom domain support                                ││
│  │  • Multi-page tenant sites                              ││
│  └─────────────────────────────────────────────────────────┘│
│              ↓ API calls (ts-rest)                          │
└─────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────┐
│                    Render (UNCHANGED)                        │
│              Express API + Prisma + PostgreSQL               │
└─────────────────────────────────────────────────────────────┘
```

### Key Decisions Made
| Decision | Choice | Rationale |
|----------|--------|-----------|
| Migration scope | Full Next.js | SEO critical, quality over speed |
| API migration | Keep Express | Well-architected, working, low risk |
| Config storage | Extend `landingPageConfig` | Avoid duplicate systems |
| URL structure | Keep `/t/:slug` | Already exists, works |
| Tier system | Use existing `grouping` field | No schema changes needed |
| Custom domains | Include in initial scope | Core feature for tenants |

---

## Optimal Tenant Website Template

Based on research and MAIS Brand Voice Guide, each tenant site follows these principles:

### Conversion Best Practices (Research)
| Principle | Implementation |
|-----------|---------------|
| Single focus per page | One clear CTA per section |
| Remove navigation clutter | Minimal nav, clear hierarchy |
| Social proof | Testimonials, trust signals prominent |
| Mobile-first | 60%+ traffic is mobile |
| Contrasting CTAs | Sage buttons on neutral backgrounds |
| Lead magnet | Free consultation / inquiry form |

**Target conversion rate:** 6-10% (industry benchmark)

### MAIS Brand Voice Application
| Element | Pattern |
|---------|---------|
| Headlines | Serif, 3-6 words, period at end |
| Copy | Transformation over features |
| Spacing | `py-32 md:py-40` sections minimum |
| Colors | 80% neutral, 20% sage accent |
| Cards | `rounded-3xl shadow-lg` |
| Buttons | `rounded-full` with hover elevation |
| CTAs | Action-oriented, not pushy |

### Default Page Structure

#### Home Page (Landing)
```
1. Hero Section
   - Transformation headline (serif)
   - One-sentence subhead
   - Primary CTA button
   - Optional: Background image

2. Trust Bar (optional)
   - 3-5 trust signals/stats
   - Icons + short text

3. Segment Picker (if multiple segments)
   - Visual cards for each service line
   - Click to filter tier cards

4. Tier Cards (3-Tier Storefront)
   - Essential / Popular / Premium
   - Price anchoring
   - Feature bullets
   - Book Now CTA per tier

5. Social Proof
   - 2-3 testimonials
   - Star ratings
   - Client photos (optional)

6. FAQ Section
   - 5-8 common questions
   - Accordion pattern

7. Final CTA Section
   - Emotional close question
   - Secondary CTA
   - Sage background

8. Footer
   - Contact info
   - Social links
   - Copyright
```

#### Services Page
```
- Service categories with descriptions
- Package cards with pricing
- Booking CTAs
```

#### About Page
```
- Founder story (identity-focused)
- Mission/values
- Team photo (optional)
- Credentials/awards
```

#### FAQ Page
```
- Expanded FAQ list
- Categorized by topic
- Search (future)
```

#### Contact Page
```
- Contact form (inquiry mode)
- Location/hours
- Social links
- Map embed (optional)
```

---

## Technical Architecture

### Next.js App Structure
```
apps/web/                          # Next.js app (NEW)
├── app/
│   ├── (marketing)/              # MAIS platform pages
│   │   ├── page.tsx              # Homepage
│   │   ├── login/page.tsx
│   │   ├── signup/page.tsx
│   │   └── ...
│   │
│   ├── (tenant)/                 # Tenant storefront pages
│   │   └── t/[slug]/
│   │       ├── page.tsx          # Tenant home
│   │       ├── about/page.tsx
│   │       ├── services/page.tsx
│   │       ├── faq/page.tsx
│   │       ├── contact/page.tsx
│   │       ├── s/[segment]/
│   │       │   └── page.tsx      # Segment tiers
│   │       └── book/
│   │           ├── page.tsx      # Appointment booking
│   │           └── date/[pkg]/page.tsx
│   │
│   ├── (admin)/                  # Protected admin pages
│   │   ├── admin/
│   │   │   └── dashboard/page.tsx
│   │   └── tenant/
│   │       ├── dashboard/page.tsx
│   │       ├── landing-page/page.tsx
│   │       └── ...
│   │
│   ├── api/                      # Optional: BFF endpoints
│   │   └── revalidate/route.ts   # ISR revalidation
│   │
│   └── layout.tsx
│
├── components/
│   ├── ui/                       # Ported from client/src/components/ui
│   ├── tenant-site/              # Tenant website modules
│   │   ├── HeroSection.tsx
│   │   ├── TrustBar.tsx
│   │   ├── SegmentPicker.tsx
│   │   ├── TierCards.tsx
│   │   ├── Testimonials.tsx
│   │   ├── FaqSection.tsx
│   │   ├── FinalCta.tsx
│   │   └── Footer.tsx
│   └── ...
│
├── lib/
│   ├── api.ts                    # ts-rest client (SSR-aware)
│   ├── tenant-resolver.ts        # Domain → tenant lookup
│   └── ...
│
├── middleware.ts                 # Custom domain resolution
└── next.config.js
```

### Custom Domain Flow
```typescript
// middleware.ts
export function middleware(request: NextRequest) {
  const hostname = request.headers.get('host') || '';

  // Skip for known MAIS domains
  if (hostname.includes('maconaisolutions.com') ||
      hostname.includes('vercel.app') ||
      hostname.includes('localhost')) {
    return NextResponse.next();
  }

  // Custom domain - rewrite to tenant route
  // Tenant lookup happens in page component
  const url = request.nextUrl.clone();
  url.pathname = `/t/_domain${url.pathname}`;
  url.searchParams.set('domain', hostname);
  return NextResponse.rewrite(url);
}
```

### Database Schema Addition
```prisma
model TenantDomain {
  id        String   @id @default(cuid())
  tenantId  String
  domain    String   @unique  // e.g., "www.janephotography.com"
  verified  Boolean  @default(false)
  isPrimary Boolean  @default(false)
  createdAt DateTime @default(now())

  tenant    Tenant   @relation(fields: [tenantId], references: [id])

  @@index([tenantId])
}
```

### SEO Implementation
```typescript
// app/t/[slug]/page.tsx
export async function generateMetadata({ params }): Promise<Metadata> {
  const tenant = await getTenantPublic(params.slug);

  return {
    title: tenant.name,
    description: tenant.siteConfig?.metaDescription ||
      `Book services with ${tenant.name}`,
    openGraph: {
      title: tenant.name,
      description: tenant.siteConfig?.metaDescription,
      images: [tenant.branding?.ogImage || '/default-og.jpg'],
    },
    robots: {
      index: true,
      follow: true,
    },
  };
}
```

---

## Extended Landing Page Config Schema

Extend existing `landingPageConfig` with new fields:

```typescript
// packages/contracts/src/landing-page.ts (additions)

export const SiteMetaConfigSchema = z.object({
  title: z.string().max(60).optional(),
  description: z.string().max(160).optional(),
  ogImage: SafeImageUrlOptionalSchema,
});

export const NavigationItemSchema = z.object({
  label: z.string().max(30),
  href: z.string(),
  enabled: z.boolean().default(true),
});

export const TrustBarItemSchema = z.object({
  icon: z.enum(['star', 'calendar', 'users', 'award', 'heart', 'check', 'camera']),
  value: z.string().max(20),  // "500+"
  label: z.string().max(50),  // "Happy Clients"
});

export const TrustBarConfigSchema = z.object({
  items: z.array(TrustBarItemSchema).max(5),
});

export const SegmentPickerConfigSchema = z.object({
  headline: z.string().max(100).optional(),
  subheadline: z.string().max(200).optional(),
  defaultSegmentSlug: z.string().optional(),
});

export const TierCardsConfigSchema = z.object({
  headline: z.string().max(100).optional(),
  subheadline: z.string().max(200).optional(),
  ctaText: z.string().max(30).default('Book Now'),
  showPrices: z.boolean().default(true),
  emphasisTier: z.enum(['tier_1', 'tier_2', 'tier_3']).default('tier_2'),
});

// Extended LandingPageConfigSchema
export const ExtendedLandingPageConfigSchema = LandingPageConfigSchema.extend({
  // Site-wide settings
  meta: SiteMetaConfigSchema.optional(),
  navigation: z.array(NavigationItemSchema).optional(),

  // New section configs
  trustBar: TrustBarConfigSchema.optional(),
  segmentPicker: SegmentPickerConfigSchema.optional(),
  tierCards: TierCardsConfigSchema.optional(),

  // Multi-page configs
  pages: z.object({
    about: z.object({
      enabled: z.boolean().default(false),
      headline: z.string().optional(),
      content: z.string().optional(),  // Markdown
      imageUrl: SafeImageUrlOptionalSchema,
    }).optional(),
    services: z.object({
      enabled: z.boolean().default(true),
      headline: z.string().optional(),
    }).optional(),
    faq: z.object({
      enabled: z.boolean().default(false),
    }).optional(),
    contact: z.object({
      enabled: z.boolean().default(true),
      headline: z.string().optional(),
      showForm: z.boolean().default(true),
      showMap: z.boolean().default(false),
    }).optional(),
  }).optional(),

  // Booking behavior
  booking: z.object({
    mode: z.enum(['instant', 'inquiry']).default('instant'),
    inquiryFormFields: z.array(z.string()).optional(),
  }).optional(),

  // Schema version for future migrations
  schemaVersion: z.number().default(2),
});
```

---

## Phased Implementation (Enterprise Timeline: 6-8 Weeks)

### Phase 1: Next.js Foundation (Week 1-2)
**Goal:** Solid Next.js foundation with SSR-aware infrastructure

**Week 1 Tasks:**
1. Create Next.js 14 app in `apps/web/`
2. Configure npm workspace integration (`@macon/contracts`, `@macon/shared`)
3. Set up Tailwind with existing config + design tokens
4. Port base UI components from `client/src/components/ui/`
5. Set up basic routing structure
6. Deploy to Vercel (staging)

**Week 2 Tasks:**
7. Configure ts-rest client for SSR (cookie-based auth)
8. Set up NextAuth.js with credentials provider
9. Implement session validation with Express API
10. Configure React Query for SSR (dehydration/hydration)
11. Create `NEXT_PUBLIC_*` env migration from `VITE_*`

**Files:**
```
apps/web/
├── app/
│   ├── layout.tsx
│   ├── page.tsx
│   └── api/auth/[...nextauth]/route.ts
├── components/ui/          # Ported from client/
├── lib/
│   ├── api.ts              # SSR-aware ts-rest client
│   ├── auth.ts             # NextAuth config
│   └── query-client.ts     # React Query SSR setup
├── tailwind.config.js
├── next.config.js
└── package.json
```

**Acceptance:**
- [ ] Next.js app builds and deploys to Vercel staging
- [ ] API calls work from both server and client components
- [ ] NextAuth login/logout functional
- [ ] Session persists across page refreshes
- [ ] All UI components render correctly

---

### Phase 2: Tenant Landing Page (Week 3)
**Goal:** Working tenant homepage with SSR

**Approach:** Build monolith first, extract components later (per reviewer feedback)

**Tasks:**
1. Create `/t/[slug]/page.tsx` with full SSR data fetching
2. Build `TenantLandingPage.tsx` as single monolithic component
3. Implement all sections inline (Hero, TrustBar, Segments, Tiers, Testimonials, FAQ, CTA, Footer)
4. Wire up tenant branding (colors, fonts, logo)
5. Connect tier cards to booking flow
6. Add SEO metadata (`generateMetadata`)
7. Mobile-responsive implementation
8. Validate against Brand Voice Guide

**Files:**
```
apps/web/app/t/[slug]/
├── page.tsx                    # SSR data fetching + metadata
├── TenantLandingPage.tsx       # Monolithic page component
└── loading.tsx                 # Suspense fallback
```

**Acceptance:**
- [ ] `/t/:slug` renders full landing page with real tenant data
- [ ] Segment picker filters tier cards (client-side state)
- [ ] Tier CTAs link to booking flow
- [ ] Mobile responsive (test on real devices)
- [ ] Lighthouse Performance > 90
- [ ] Matches Brand Voice Guide patterns

---

### Phase 3: Component Extraction + Multi-Page (Week 4)
**Goal:** Clean component architecture, additional pages

**Tasks:**
1. Extract components from monolith based on actual repetition:
   - `HeroSection`, `TierCards`, `FaqSection`, etc.
2. Create About page template
3. Create Services page template
4. Create FAQ page (expanded)
5. Create Contact page with form
6. Implement tenant navigation component
7. Add page-level metadata for each page

**Files:**
```
apps/web/
├── components/tenant-site/
│   ├── HeroSection.tsx
│   ├── TierCards.tsx
│   ├── FaqSection.tsx
│   ├── TestimonialsSection.tsx
│   ├── FinalCta.tsx
│   ├── TenantNav.tsx
│   ├── TenantFooter.tsx
│   └── index.ts
├── app/t/[slug]/
│   ├── about/page.tsx
│   ├── services/page.tsx
│   ├── faq/page.tsx
│   └── contact/page.tsx
```

**Acceptance:**
- [ ] All 5 tenant pages render with consistent layout
- [ ] Navigation between pages works
- [ ] Components are reusable and well-typed
- [ ] Each page has proper SEO metadata

---

### Phase 4: Admin Migration (Week 5)
**Goal:** Full admin dashboard in Next.js

**Tasks:**
1. Port tenant admin dashboard
2. Port tenant branding editor
3. Port tenant package manager
4. Port tenant scheduling pages
5. Port landing page editor
6. Port platform admin dashboard
7. Port platform tenant management
8. Implement admin impersonation flow with NextAuth
9. Protected route middleware

**Files:**
```
apps/web/app/
├── (admin)/
│   ├── tenant/
│   │   ├── dashboard/page.tsx
│   │   ├── branding/page.tsx
│   │   ├── packages/page.tsx
│   │   ├── scheduling/page.tsx
│   │   └── landing-page/page.tsx
│   └── admin/
│       ├── dashboard/page.tsx
│       └── tenants/page.tsx
├── middleware.ts               # Auth protection
```

**Acceptance:**
- [ ] Tenant admin login and dashboard functional
- [ ] All tenant admin features working
- [ ] Platform admin impersonation working
- [ ] Protected routes redirect unauthenticated users

---

### Phase 5: Booking Flow Migration (Week 6)
**Goal:** Complete booking journey in Next.js

**Tasks:**
1. Port appointment booking page
2. Port date booking page
3. Port booking wizard/steps
4. Port Stripe checkout integration
5. Port booking success page
6. Port booking management (reschedule/cancel)
7. Test complete booking flow end-to-end

**Files:**
```
apps/web/app/t/[slug]/book/
├── page.tsx                    # Appointment booking
├── date/[packageSlug]/page.tsx # Date booking
└── success/page.tsx            # Confirmation

apps/web/app/bookings/
└── manage/page.tsx             # Customer self-service
```

**Acceptance:**
- [ ] Complete booking flow works (browse → select → pay)
- [ ] Stripe checkout integration functional
- [ ] Booking confirmation emails sent
- [ ] Customer can reschedule/cancel via link

---

### Phase 6: Custom Domains + Polish (Week 7-8)
**Goal:** Production-ready with custom domains

**Week 7 Tasks:**
1. Add `TenantDomain` model + migration
2. Add domain verification fields (`verificationToken`, `verifiedAt`)
3. Create DNS verification service (TXT record checking)
4. Implement background job for verification polling
5. Create domain management UI in tenant admin
6. Create Next.js middleware for domain resolution
7. Configure Vercel for custom domains (Pro account)

**Week 8 Tasks:**
8. Add ISR revalidation webhook to Express
9. Implement full SEO (sitemap, robots.txt per tenant)
10. Add Vercel Analytics integration
11. Comprehensive E2E test suite
12. Performance optimization (ISR tuning, image optimization)
13. Documentation and runbooks
14. Production deployment and DNS cutover

**Files:**
```
server/
├── prisma/schema.prisma        # TenantDomain model
├── src/services/domain-verification.service.ts
└── src/routes/internal.routes.ts  # Revalidation webhook

apps/web/
├── middleware.ts               # Domain resolution
├── app/sitemap.ts              # Dynamic sitemap
├── app/robots.ts               # Dynamic robots.txt
└── app/t/[slug]/
    └── domain-setup/page.tsx   # Domain management UI
```

**Acceptance:**
- [ ] Custom domain serves tenant site correctly
- [ ] SSL works automatically (Vercel)
- [ ] DNS verification flow works end-to-end
- [ ] SEO metadata renders server-side
- [ ] Sitemap includes all tenant pages
- [ ] Google Search Console verification passes
- [ ] Analytics events fire correctly
- [ ] All E2E tests pass
- [ ] Lighthouse scores: Performance 90+, SEO 100, Accessibility 90+
- [ ] Production deployment successful

---

## Widget Strategy

The current widget (`widget.html` + `widget-main.tsx`) is for iframe embedding on external sites.

**Recommendation:** Convert to a lightweight embed script:

```html
<!-- Tenant embeds this on their existing site -->
<script src="https://app.maconaisolutions.com/embed.js"
        data-tenant="little-bit-farm"
        data-mode="booking-button">
</script>
```

**Options:**
1. **Booking Button** - Floats, opens modal
2. **Inline Calendar** - Embeds availability picker
3. **Full Widget** - Complete booking flow in iframe

**Implementation:** Defer to Phase 5 (post-launch). Current widget continues working during migration.

---

## Risk Mitigation

| Risk | Mitigation |
|------|------------|
| Breaking existing client | Keep Vite client running during migration, switch DNS at end |
| API compatibility | No API changes needed - Express stays unchanged |
| Auth token handling | Same JWT strategy, adapt for SSR (cookies vs localStorage) |
| Performance regression | Use ISR for tenant pages, aggressive caching |
| Custom domain SSL | Vercel handles automatically |
| SEO not improving | Test with Google Search Console before launch |

---

## Success Metrics

### Technical Quality
| Metric | Target |
|--------|--------|
| Lighthouse Performance | 90+ |
| Lighthouse SEO | 100 |
| Lighthouse Accessibility | 90+ |
| Time to First Byte (TTFB) | < 200ms |
| Largest Contentful Paint | < 2.5s |
| Cumulative Layout Shift | < 0.1 |
| Test Coverage | > 80% |
| E2E Test Pass Rate | 100% |

### User Experience
| Metric | Target |
|--------|--------|
| Custom domain setup time | < 5 minutes |
| Tenant site conversion rate | 6-10% |
| Page load (mobile 3G) | < 3s |
| Booking flow completion | > 70% |

### Enterprise Stability
| Metric | Target |
|--------|--------|
| Uptime | 99.9% |
| Error rate | < 0.1% |
| Mean time to recovery | < 15 minutes |
| Zero data leakage between tenants | 100% |

---

## Sources

- [High-Converting Landing Pages - Shopify](https://www.shopify.com/blog/high-converting-landing-pages)
- [25 Landing Page Best Practices - Landingi](https://landingi.com/landing-page/41-best-practices/)
- [Photographer Landing Page Examples - Landingi](https://landingi.com/landing-page/photographer-examples/)
- [Photography Landing Page Tips - Pixieset](https://blog.pixieset.com/blog/best-landing-pages/)
- MAIS Brand Voice Guide (`docs/design/BRAND_VOICE_GUIDE.md`)

---

## Next Steps

1. **Your approval** on this plan
2. Create feature branch: `feat/nextjs-migration`
3. Begin Phase 1: Next.js foundation
4. Daily check-ins on progress

---

## Resolved Decisions

| Question | Decision | Rationale |
|----------|----------|-----------|
| Auth | **NextAuth.js (Auth.js)** | Industry standard, handles OAuth, sessions, CSRF |
| ISR timing | **On-demand + 60s fallback** | Revalidate on tenant save, 60s stale-while-revalidate |
| Domain verification | **DNS TXT record** | Industry standard (Google, Vercel, Cloudflare all use this) |
| Analytics | **Vercel Analytics** | Built-in, privacy-first, free tier, zero config |

---

## Review Feedback & Responses

### Reviewer Verdicts
| Reviewer | Verdict | Core Concern |
|----------|---------|--------------|
| DHH-Style | 🟡 YELLOW | Over-engineered, ship faster |
| Senior Engineer | 🟡 YELLOW | Timeline unrealistic (6-7 weeks actual) |
| Code Simplicity | 🟡 YELLOW | Scope creep, defer custom domains |

### Response: Enterprise Quality Over Speed

After review, the decision is to prioritize **enterprise-grade stability** over rapid shipping:

| Reviewer Concern | Our Response |
|-----------------|--------------|
| "Defer custom domains" | **KEEP** - Core value proposition, build it right |
| "Keep admin in Vite" | **MIGRATE ALL** - One codebase, unified tooling, long-term maintainability |
| "4 weeks unrealistic" | **ACCEPT 6-8 weeks** - Quality over speed |
| "Schema extensions premature" | **KEEP BUT SIMPLIFY** - Build extensible foundation, but start with minimal required fields |
| "NextAuth overkill" | **PROCEED** - Enterprise auth with OAuth/SSO readiness for future |

### Addressed Technical Concerns (Senior Engineer)

1. **Auth Migration Complexity**
   - Budget 5 days specifically for NextAuth integration
   - Migrate impersonation flow to NextAuth callbacks
   - Express API will validate NextAuth session tokens

2. **ISR Revalidation Webhook**
   - Add Express endpoint: `POST /v1/internal/revalidate`
   - Secured with shared secret
   - Called after tenant saves landingPageConfig

3. **Custom Domain Infrastructure**
   - Vercel Pro account required ($20/mo) - approved
   - `TenantDomain` model with verification fields
   - Background job for DNS verification polling
   - Domain conflict prevention (unique constraint + rate limiting)

4. **Component Port Complexity**
   - Budget extra time for React Router → Next.js navigation
   - SSR-aware API client with cookie-based auth
   - Explicit hydration strategy for React Query

5. **Schema Migration for Existing Tenants**
   - Add `schemaVersion` field
   - Migration function to upgrade v1 → v2 configs
   - Backwards-compatible defaults

### Addressed Simplicity Concerns

1. **Schema Extensions**
   - Keep extensible structure but start with minimal fields
   - Add configuration options only when tenants request them
   - Avoid premature abstraction in components

2. **Build Monolith First**
   - Week 2: Build working `TenantLandingPage.tsx` monolith
   - Week 3: Extract components only after page works end-to-end
   - This prevents wrong abstractions
