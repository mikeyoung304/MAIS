# Next.js 14 Marketing Site Documentation Index

**Date:** December 26, 2025
**Scope:** Modern marketing website patterns for MAIS platform and corporate site
**Tech Stack:** Next.js 14 App Router, React Server Components, ISR, TypeScript

---

## Documentation Overview

This research package provides complete guidance for building multi-page marketing websites using Next.js 14 App Router, drawing from Vercel's official documentation and MAIS's existing tenant storefront patterns.

### Files in This Package

| Document                                 | Purpose                                                                                          | Audience                         | Read Time       |
| ---------------------------------------- | ------------------------------------------------------------------------------------------------ | -------------------------------- | --------------- |
| **NEXTJS-14-MARKETING-SITE-PATTERNS.md** | Comprehensive reference covering ISR, multi-page structures, components, and config-driven sites | Architects, lead devs            | 30 min          |
| **CORPORATE-WEBSITE-IMPLEMENTATION.md**  | Step-by-step guide to build marketing.mais.co using tenant pattern                               | Developers implementing features | 20 min          |
| **ISR-REVALIDATION-DECISIONS.md**        | Decision tree and detailed guidance for choosing revalidation strategy                           | Developers building pages        | 15 min          |
| **NEXTJS-14-QUICK-REFERENCE.md**         | Cheat sheet with code examples for common patterns                                               | All developers                   | 10 min (lookup) |

---

## Quick Start (Choose Your Role)

### I'm an Architect/Tech Lead

**Goal:** Understand the overall approach

**Read in order:**

1. Section: "ISR Patterns & Best Practices" in **NEXTJS-14-MARKETING-SITE-PATTERNS.md**
2. Section: "Multi-Page Site Structure" in **NEXTJS-14-MARKETING-SITE-PATTERNS.md**
3. Section: "Reusable Component Architecture" in **NEXTJS-14-MARKETING-SITE-PATTERNS.md**

**Time:** 15 minutes

**Takeaway:** Next.js 14 uses time-based ISR with fallback on-demand invalidation. Multi-page sites use route groups for logical organization, nested layouts for consistent nav/footer, and section-based rendering for page composition.

---

### I'm Building the MAIS Corporate Website

**Goal:** Implement marketing.mais.co

**Follow this path:**

1. Read **CORPORATE-WEBSITE-IMPLEMENTATION.md** - complete step-by-step guide
2. Use **NEXTJS-14-QUICK-REFERENCE.md** as lookup during implementation
3. Reference **ISR-REVALIDATION-DECISIONS.md** when deciding page caching strategy

**Time:** 1-2 hours for basic implementation

**Setup:**

- 5 min: Create route structure (Step 1)
- 10 min: Add config file (Step 2)
- 15 min: Implement pages (Steps 3-5)
- Optional: Add CMS integration, webhooks, analytics

---

### I'm Adding a New Page to Existing Site

**Goal:** Add a page consistently with current architecture

**Quick path:**

1. Look up page type in **ISR-REVALIDATION-DECISIONS.md** decision matrix
2. Find code example in **NEXTJS-14-QUICK-REFERENCE.md**
3. Copy pattern, adjust for your content
4. Reference section-based rendering in **NEXTJS-14-MARKETING-SITE-PATTERNS.md** if needed

**Time:** 10 minutes

---

### I'm Troubleshooting Caching/ISR Issues

**Goal:** Debug cache behavior

**Read:**

1. **ISR-REVALIDATION-DECISIONS.md** - Section "ISR Gotchas & Fixes"
2. **ISR-REVALIDATION-DECISIONS.md** - Section "Troubleshooting"
3. Reference "Caching Strategies" in **NEXTJS-14-MARKETING-SITE-PATTERNS.md** if needed

**Time:** 5-10 minutes

---

## Key Concepts at a Glance

### ISR (Incremental Static Regeneration)

**What:** Revalidate and regenerate static pages without full rebuild

**When to use:** Content updates infrequently (hourly to weekly)

**How:** Export `export const revalidate = 3600` (TTL in seconds)

**Patterns:**

- Time-based: Set TTL, regenerate on next request after expiry
- On-demand: Webhook triggers `revalidatePath()` immediately
- Fallback: Combine both (on-demand with time-based fallback)

**See:** ISR-REVALIDATION-DECISIONS.md for decision tree

---

### Multi-Page Structure

**Root layout (required):**

```
app/layout.tsx → <html><body>{children}</body></html>
```

**Route groups:** Organize without affecting URLs

```
app/(marketing)/page.tsx → /
app/(admin)/dashboard/page.tsx → /dashboard
```

**Nested layouts:** Shared header/footer per section

```
app/(marketing)/layout.tsx → Adds nav + footer
  ├── page.tsx → /
  └── about/page.tsx → /about
```

**Special files:**

- `page.tsx` - Route content
- `layout.tsx` - Shared wrapper
- `error.tsx` - Error boundary
- `loading.tsx` - Suspense fallback
- `not-found.tsx` - 404 handler

**See:** NEXTJS-14-QUICK-REFERENCE.md for structure examples

---

### Section-Based Rendering

**Pattern:** Compose pages from reusable sections (hero, text, gallery, etc.)

**Benefits:**

- Easy to add/edit sections without code changes
- Consistent styling
- Works with config-driven CMS
- Same pattern as tenant storefronts

**7 core section types:**

- `hero` - Hero banner with CTA
- `text` - Rich text + image
- `gallery` - Image grid
- `testimonials` - Customer quotes
- `faq` - Accordion
- `contact` - Contact form
- `cta` - Call-to-action

**Implementation:**

```tsx
<SectionRenderer sections={pages.home.sections} tenant={brandingData} />
```

**See:** NEXTJS-14-MARKETING-SITE-PATTERNS.md section "Reusable Component Architecture"

---

### Config-Driven Pages

**Pattern:** Define pages as configuration instead of hardcoding

**Benefits:**

- Easy CMS integration
- No code deploy needed for content changes
- A/B testing without code
- Matches existing tenant storefront pattern

**Implementation:**

```typescript
export const CORPORATE_PAGES_CONFIG: PagesConfig = {
  home: {
    enabled: true,
    sections: [...]
  },
  about: {
    enabled: true,
    sections: [...]
  },
};

export async function getCorporatePages() {
  return CORPORATE_PAGES_CONFIG;
}
```

**Later:** Swap `getCorporatePages()` to fetch from Sanity, Contentful, or database

**See:** NEXTJS-14-MARKETING-SITE-PATTERNS.md section "Config-Driven Multi-Page Sites"

---

### Caching Layers

Next.js implements 4 caching layers:

1. **Request memoization** (per-request, automatic)
   - Deduplicates identical fetches in single render

2. **Data cache** (persistent)
   - Survives across requests until revalidation
   - Controlled with `next.revalidate` or `next.tags`

3. **Full Route Cache** (build-time or ISR)
   - HTML + React payload cached and served
   - Skipped if route uses cookies/headers/dynamic APIs

4. **Router Cache** (browser, client-side)
   - In-memory cache of visited routes
   - 5 minutes for static, session-based for dynamic

**For marketing sites:** Use Time-based ISR (layer 3) with optional on-demand invalidation (layer 2)

**See:** NEXTJS-14-MARKETING-SITE-PATTERNS.md section "Caching Strategies"

---

## Decision Trees

### Choosing ISR Strategy

```
Is content in database/CMS?
  ├─ YES: Do you have webhook support?
  │   ├─ YES: Use on-demand ISR with fallback TTL
  │   └─ NO: Use time-based ISR
  └─ NO: Use time-based ISR
```

### Choosing TTL

```
How often does content change?
  ├─ Real-time (minutes): ❌ Don't use ISR, use dynamic rendering
  ├─ Frequently (hourly): 60-300 seconds
  ├─ Regular (daily): 3600 seconds (1 hour)
  ├─ Occasional (weekly): 86400 seconds (1 day)
  └─ Rarely (monthly): 604800 seconds (1 week)
```

### Choosing Route Strategy

```
How many routes do you have?
  ├─ < 100 (known at build): Use generateStaticParams()
  ├─ 100-1000 (mostly known): Use generateStaticParams() + fallback ISR
  └─ > 1000 (dynamic): Use on-demand ISR only
```

**See:** ISR-REVALIDATION-DECISIONS.md for detailed decision matrix

---

## Real-World Examples

### Example 1: Blog Site

**Structure:**

- Home page (ISR 60s)
- Blog list (ISR 3600s)
- Blog post (Static params + 86400s)

**Why:**

- Home updates frequently (hero/nav changes)
- Blog list updates daily (new posts)
- Blog posts rarely change (only corrections)

**Code:**

```typescript
// Home: Frequent updates
export const revalidate = 60;

// Blog list: Daily updates
export const revalidate = 3600;

// Blog post: Generate all at build, revalidate daily
export async function generateStaticParams() {
  return getAllBlogPostSlugs();
}
export const revalidate = 86400;
```

---

### Example 2: Multi-Tenant Storefront (MAIS)

**Structure:**

- Tenant home (ISR 60s + on-demand)
- Tenant about (ISR 3600s + on-demand)
- Tenant services (ISR 3600s + on-demand)

**Why:**

- Users edit frequently
- Need quick cache invalidation
- Fallback ISR handles webhook failures

**Implementation:**

```typescript
export const revalidate = 60; // Fallback

export default async function TenantPage({ params }) {
  const { slug } = await params;
  const { tenant } = await getTenantData(slug);

  return <SectionRenderer sections={pages.home.sections} />;
}

// Webhook triggers:
// POST /api/revalidate
// { path: '/t/photographer-slug' }
```

---

### Example 3: Corporate Site (MAIS)

**Structure:**

- Home (ISR 60s)
- About (ISR 3600s)
- Blog (static params + 86400s)
- Contact (no cache, form submits elsewhere)

**Why:**

- Home: A/B testing, metrics
- About: Occasional edits
- Blog: Content rarely changes
- Contact: Form-only, no cache needed

**Code:** See **CORPORATE-WEBSITE-IMPLEMENTATION.md**

---

## Performance Targets

### Lighthouse Scores

| Page      | Target | Notes                            |
| --------- | ------ | -------------------------------- |
| Home      | 95+    | Hero image optimized, minimal JS |
| Blog list | 90+    | Many images, pagination OK       |
| Blog post | 90+    | Text-heavy, one image            |
| About     | 95+    | Mostly text and images           |

### Time to First Byte (TTFB)

| Scenario             | Target | Achieved              |
| -------------------- | ------ | --------------------- |
| Cached (ISR hit)     | <100ms | ISR + CDN             |
| Warm regeneration    | <500ms | ISR after TTL         |
| Cold (first request) | <1s    | Build time acceptable |

### Cache Hit Rate

**Target:** > 95% for marketing sites (high repeat traffic)

**Measure with Vercel Analytics:**

```typescript
import { recordEvent } from '@vercel/analytics';

recordEvent({
  name: 'cache_hit',
  parameters: { path: pathname },
});
```

---

## Migration Path: From Tenant to Corporate

**MAIS's tenant system already uses this architecture:**

- Section-based rendering ✅
- ISR (60s) ✅
- Config-driven pages ✅
- Multi-page sites ✅

**To build corporate site, reuse:**

1. `SectionRenderer` component (in tenant/components)
2. Section type schemas (in contracts)
3. ISR pattern (60s baseline)
4. Config structure (PagesConfig)

**New additions:**

1. Corporate-specific config file
2. Blog system with dynamic routes
3. Page-specific customizations

**No refactoring needed!** Just reuse existing components with different data.

---

## Recommended Reading Order

**If you have 30 minutes:**

1. NEXTJS-14-MARKETING-SITE-PATTERNS.md - Overview (15 min)
2. NEXTJS-14-QUICK-REFERENCE.md - Cheat sheet (5 min)
3. ISR-REVALIDATION-DECISIONS.md - Decision matrix (10 min)

**If you have 2 hours:**

1. NEXTJS-14-MARKETING-SITE-PATTERNS.md - Full read (45 min)
2. CORPORATE-WEBSITE-IMPLEMENTATION.md - Implementation guide (45 min)
3. ISR-REVALIDATION-DECISIONS.md - Deep dive (30 min)

**If implementing immediately:**

1. CORPORATE-WEBSITE-IMPLEMENTATION.md - Step by step (follow along, code)
2. NEXTJS-14-QUICK-REFERENCE.md - Lookup during implementation
3. ISR-REVALIDATION-DECISIONS.md - When making cache decisions

---

## Key Takeaways

### For Architects

✅ Next.js 14 App Router is production-ready for marketing sites
✅ ISR provides excellent performance (fast) and freshness (weekly+)
✅ On-demand ISR with webhooks handles frequent updates (CMS-driven)
✅ Section-based rendering scales from 1 to 100+ sites
✅ Unified pattern between corporate and tenant sites

### For Developers

✅ Use `export const revalidate` for time-based ISR (60s-7d)
✅ Use `revalidatePath()` in Server Actions for on-demand
✅ Use route groups `(marketing)` to organize without URL impact
✅ Always await `params` and `searchParams` (Promises!)
✅ Compose pages from reusable sections, not one-off components

### For Product

✅ Launch corporate site with 50+ pages no problem
✅ Add/edit pages without code deploy (config-driven)
✅ Update all branded pages in < 2 minutes (CMS)
✅ A/B test homepage variants without code
✅ Serve cached pages to millions (Vercel edge network)

---

## External Resources

- **[Next.js Official Docs](https://nextjs.org/docs)** - Complete reference
- **[Vercel Blog](https://vercel.com/blog)** - Latest patterns and best practices
- **[React Docs](https://react.dev)** - Server Components, Suspense
- **[Web Vitals Guide](https://web.dev/vitals/)** - Performance metrics

---

## Questions? Common Issues

**Q: Should I use Vercel or self-host?**
A: Vercel handles ISR beautifully, but self-hosting works too. Vercel's edge network and analytics are worth it for marketing sites.

**Q: How long does build take with 100+ pages?**
A: With `generateStaticParams()` on ~50 popular routes, 2-5 minutes. Fallback ISR handles unknown routes.

**Q: Can I use a CMS?**
A: Yes! Swap `getCorporatePages()` to fetch from Sanity, Contentful, etc. Add webhook for on-demand revalidation.

**Q: How do I handle user authentication?**
A: Use NextAuth.js v5 (included in current setup). Protected pages go in `(admin)` route group.

**Q: Can I run the same code for corporate and tenant sites?**
A: Yes! That's the entire design. One set of components, different data sources.

---

## Next Steps

1. **For immediate use:**
   - Follow CORPORATE-WEBSITE-IMPLEMENTATION.md
   - Deploy to Vercel
   - Monitor cache hits with analytics

2. **For future optimization:**
   - Add CMS (Sanity recommended)
   - Set up webhook revalidation
   - Implement Analytics
   - Add search functionality

3. **For scaling:**
   - Add personalization via cookies
   - Implement A/B testing framework
   - Set up monitoring dashboard
   - Build admin UI for content management

---

## Document Versions

| Version | Date       | Changes                  |
| ------- | ---------- | ------------------------ |
| 1.0     | 2025-12-26 | Initial research package |

---

**Created:** December 26, 2025
**For:** MAIS Platform (Macon AI Solutions)
**Author:** Claude Code Research
**Status:** Production-Ready
