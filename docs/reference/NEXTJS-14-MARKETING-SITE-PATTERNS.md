# Next.js 14 App Router: Modern Marketing Website Patterns

**Date:** December 26, 2025
**Version:** 1.0
**Scope:** Multi-page marketing sites using Next.js 14 App Router with ISR, config-driven architecture, and reusable components

---

## Table of Contents

1. [ISR Patterns & Best Practices](#isr-patterns--best-practices)
2. [Multi-Page Site Structure](#multi-page-site-structure)
3. [Reusable Component Architecture](#reusable-component-architecture)
4. [Config-Driven Multi-Page Sites](#config-driven-multi-page-sites)
5. [Caching Strategies](#caching-strategies)
6. [Implementation Patterns](#implementation-patterns)
7. [MAIS Corporate Website Pattern](#mais-corporate-website-pattern)

---

## ISR Patterns & Best Practices

### What is ISR?

**Incremental Static Regeneration** allows you to update static content without rebuilding the entire site. It's the perfect middle ground between pure static (fast but stale) and fully dynamic (fresh but slow).

**Key Benefits:**
- Update static content without rebuild → deployment
- Reduce server load with prerendered pages
- Automatic `cache-control` headers
- Handle large content volumes without long build times
- Perfect for marketing sites with infrequent updates

### ISR Pattern 1: Time-Based Revalidation

Simplest pattern for marketing sites. Cache expires after TTL, regenerates on next request.

```tsx
// app/blog/[slug]/page.tsx
export const revalidate = 3600; // Revalidate every hour

export default async function BlogPostPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const post = await fetch(`/api/posts/${slug}`, {
    next: { revalidate: 3600 }, // or rely on export const
  });

  return <article>{/* ... */}</article>;
}

// For dynamic routes, pre-generate popular pages at build time
export async function generateStaticParams() {
  const popularPosts = await fetch('/api/posts/popular').then(r => r.json());
  return popularPosts.map(post => ({ slug: post.slug }));
}
```

**Recommended TTL Values:**

| Use Case | TTL | Example |
|----------|-----|---------|
| Real-time dashboards | Not recommended | Use dynamic rendering instead |
| Frequently changing content | 60 seconds | Stock prices, live feeds |
| Regular updates | 3600 seconds (1 hour) | Blog posts, product catalogs |
| Rarely changing | 86400 seconds (1 day) | Marketing copy, documentation |
| Static pages | 604800 seconds (1 week) | About, contact, legal pages |

**For marketing sites, recommended pattern:**
- Home/hero section: 60-300 seconds (frequent brand updates)
- About/services: 3600 seconds (1 hour)
- Blog/case studies: 3600 seconds (1 hour)
- Legal/contact: 86400 seconds (1 day)

### ISR Pattern 2: On-Demand Revalidation with `revalidatePath`

Precise control—invalidate cache immediately when content changes (e.g., CMS webhook).

```tsx
// app/api/revalidate/route.ts
import { revalidatePath } from 'next/cache';
import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  const secret = request.headers.get('x-revalidate-secret');

  if (secret !== process.env.REVALIDATE_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const path = request.nextUrl.searchParams.get('path');

  if (!path) {
    return NextResponse.json({ error: 'Missing path' }, { status: 400 });
  }

  revalidatePath(path);

  return NextResponse.json({
    revalidated: true,
    now: Date.now(),
    path
  });
}
```

**Usage (from webhook handler):**
```typescript
// Called from tenant config update webhook
const event = await webhookProvider.validateWebhook(req);

if (event.type === 'tenant.config.updated') {
  const tenantId = event.data.tenantId;

  // Revalidate all paths for this tenant
  await fetch('https://yourdomain.com/api/revalidate', {
    method: 'POST',
    headers: { 'x-revalidate-secret': process.env.REVALIDATE_SECRET! },
    body: JSON.stringify({ path: `/t/${tenantId}` }),
  });
}
```

**When to use:**
- CMS-driven content (webhook on save)
- Frequent content updates
- Need immediate cache invalidation
- Multi-tenant sites with tenant-specific changes

### ISR Pattern 3: On-Demand Revalidation with `revalidateTag`

Fine-grained control using fetch tags. Invalidate specific data without affecting other pages.

```tsx
// app/blog/page.tsx
export default async function BlogListPage() {
  const posts = await fetch('https://api.example.com/posts', {
    next: { tags: ['posts'] }, // Tag this fetch
  });

  return <div>{/* render posts */}</div>;
}

// app/api/posts/route.ts (POST handler to create post)
'use server'
import { revalidateTag } from 'next/cache';

export async function createPost(data: PostData) {
  const post = await prisma.post.create({ data });
  revalidateTag('posts'); // Revalidate all fetches tagged 'posts'
  return post;
}
```

**When to use:**
- Multiple pages share the same data
- Want to avoid revalidating entire paths
- Complex data dependencies
- Fine-grained cache control per data source

### ISR Best Practices from Vercel

1. **Set reasonable revalidation times** - Avoid very short intervals (< 10 seconds)
   - Defeats ISR purpose (unnecessary regenerations)
   - Increases server load
   - Use dynamic rendering for real-time needs

2. **Prefer on-demand over time-based**
   - More efficient for content management
   - Immediate cache updates
   - Reduces stale content window

3. **Handle regeneration failures gracefully**
   - If regeneration fails, stale page is served
   - Next request triggers retry
   - Users still get content (better than 500 error)

4. **Test locally with production build**
   ```bash
   npm run build  # Generate optimized bundle
   npm run start  # Run production server with ISR
   ```

5. **Debug ISR in production**
   ```bash
   # Enable debug logging (set in production deploy)
   NEXT_PRIVATE_DEBUG_CACHE=1
   ```

6. **Use exact paths for revalidation**
   ```tsx
   // CORRECT: Exact path
   revalidatePath('/t/photographer-slug')

   // AVOID: Patterns (doesn't work with rewrites)
   revalidatePath('/t/*') // ❌ Won't work
   revalidatePath('/') // ⚠️ Revalidates entire site
   ```

7. **Combine TTL with on-demand**
   ```tsx
   export const revalidate = 3600; // Default 1 hour fallback

   // Webhook can invalidate sooner
   // If webhook fails, falls back to 1 hour TTL
   ```

---

## Multi-Page Site Structure

### File-System Based Routing

Next.js uses **folders and files** to define routes. No separate router configuration needed.

```
app/
├── (marketing)/              # Route group (doesn't affect URLs)
│   ├── layout.tsx           # Shared layout: nav, footer
│   ├── page.tsx             # / (home)
│   ├── about/
│   │   ├── page.tsx         # /about
│   │   ├── loading.tsx      # Loading state
│   │   └── error.tsx        # Error boundary
│   ├── services/
│   │   ├── page.tsx         # /services
│   │   ├── loading.tsx
│   │   └── error.tsx
│   ├── blog/
│   │   ├── page.tsx         # /blog
│   │   └── [slug]/
│   │       ├── page.tsx     # /blog/[slug]
│   │       ├── error.tsx
│   │       └── loading.tsx
│   ├── pricing/page.tsx     # /pricing
│   ├── contact/page.tsx     # /contact
│   └── legal/
│       ├── privacy/page.tsx # /legal/privacy
│       └── terms/page.tsx   # /legal/terms
│
├── (admin)/                 # Different layout for admin
│   ├── layout.tsx           # Admin-specific layout
│   ├── dashboard/page.tsx   # /dashboard
│   └── settings/page.tsx    # /settings
│
└── layout.tsx              # Root layout (required!)
```

### Route Groups: Organizing Without URL Impact

Route groups use parentheses `(groupName)` for organization. The parentheses don't appear in URLs.

**Reasons to use route groups:**

1. **Separate layouts** - Marketing pages vs admin pages with different layouts
2. **Logical organization** - Group by team, feature, or section
3. **Avoid URL depth** - Keep routes clean without extra path segments

**Example: MAIS Marketing vs Admin**

```
app/
├── (marketing)/           # Public marketing site
│   ├── layout.tsx        # Nav + Footer layout
│   ├── page.tsx          # /
│   ├── about/page.tsx    # /about
│   └── blog/page.tsx     # /blog
│
├── (admin)/              # Protected admin portal
│   ├── layout.tsx        # Sidebar layout + auth required
│   ├── dashboard/page.tsx    # /dashboard
│   └── tenants/page.tsx      # /tenants
│
├── api/                  # API routes (shared)
│   └── webhooks/route.ts
│
└── layout.tsx           # Root layout
```

**⚠️ Important caveat:** Different root layouts trigger full page reloads on navigation
- Navigating from `/blog` (marketing layout) to `/dashboard` (admin layout) reloads entire page
- Not an issue for marketing sites (users don't navigate between sections constantly)

### Nested Layouts Pattern

Layouts automatically nest in the folder hierarchy. Perfect for multi-page sites.

```
app/
├── layout.tsx              # Root: HTML, body, providers
├── (marketing)/
│   ├── layout.tsx         # Adds: Nav, Footer
│   ├── blog/
│   │   ├── layout.tsx     # Adds: Sidebar navigation
│   │   ├── page.tsx       # Wraps content
│   │   └── [slug]/
│   │       ├── page.tsx   # /blog/[slug]
│   │       └── error.tsx
│   └── about/page.tsx     # /about
```

**Render hierarchy:** Root → Marketing → Blog → Page

This means:
- Root layout applied to all routes
- Marketing layout wraps all `/marketing/*` routes
- Blog layout wraps all `/marketing/blog/*` routes
- Page content rendered within all ancestor layouts

---

## Reusable Component Architecture

### Section-Based Component System

The most scalable pattern for marketing sites. Define a few reusable section types, then compose pages from them.

**Benefits:**
- Easy to add new pages (just compose sections)
- Consistent styling and behavior
- Easy to edit or add sections to existing pages
- Works perfectly with config-driven CMS

**7 Core Section Types (Recommended):**

```typescript
// packages/contracts/src/schemas/section.schema.ts
export type SectionType =
  | 'hero'
  | 'text'
  | 'gallery'
  | 'testimonials'
  | 'faq'
  | 'contact'
  | 'cta';

// Each section is a discriminated union
export type Section =
  | HeroSection
  | TextSection
  | GallerySection
  | TestimonialsSection
  | FAQSection
  | ContactSection
  | CTASection;

export interface HeroSection {
  type: 'hero';
  headline: string;
  subheadline?: string;
  ctaText?: string;
  backgroundImageUrl?: string;
}

export interface TextSection {
  type: 'text';
  headline?: string;
  content: string;
  imageUrl?: string;
  imagePosition?: 'left' | 'right';
}

export interface GallerySection {
  type: 'gallery';
  headline?: string;
  images: Array<{
    url: string;
    alt: string;
    caption?: string;
  }>;
  instagramLink?: string;
}

export interface TestimonialsSection {
  type: 'testimonials';
  headline?: string;
  testimonials: Array<{
    name: string;
    role: string;
    content: string;
    rating?: number;
    imageUrl?: string;
  }>;
}

export interface FAQSection {
  type: 'faq';
  headline?: string;
  items: Array<{
    question: string;
    answer: string;
  }>;
}

export interface ContactSection {
  type: 'contact';
  headline?: string;
  email?: string;
  phone?: string;
  address?: string;
}

export interface CTASection {
  type: 'cta';
  headline: string;
  description?: string;
  buttonText: string;
  buttonLink: string;
  backgroundColor?: string;
}
```

### SectionRenderer: Dynamic Section Dispatcher

A single component that renders any section type based on its discriminated union type.

```tsx
// components/SectionRenderer.tsx
import type { Section, TenantPublicDto } from '@macon/contracts';
import { HeroSection } from './sections/HeroSection';
import { TextSection } from './sections/TextSection';
import { GallerySection } from './sections/GallerySection';
import { TestimonialsSection } from './sections/TestimonialsSection';
import { FAQSection } from './sections/FAQSection';
import { ContactSection } from './sections/ContactSection';
import { CTASection } from './sections/CTASection';

interface SectionRendererProps {
  sections: Section[];
  tenant: TenantPublicDto;
  basePath?: string;
}

export function SectionRenderer({
  sections,
  tenant,
  basePath = '',
}: SectionRendererProps) {
  return (
    <>
      {sections.map((section, index) => {
        switch (section.type) {
          case 'hero':
            return (
              <HeroSection
                key={`hero-${index}`}
                {...section}
                tenant={tenant}
                basePath={basePath}
              />
            );
          case 'text':
            return (
              <TextSection
                key={`text-${index}`}
                {...section}
                tenant={tenant}
              />
            );
          case 'gallery':
            return (
              <GallerySection
                key={`gallery-${index}`}
                {...section}
                tenant={tenant}
              />
            );
          case 'testimonials':
            return (
              <TestimonialsSection
                key={`testimonials-${index}`}
                {...section}
                tenant={tenant}
              />
            );
          case 'faq':
            return (
              <FAQSection
                key={`faq-${index}`}
                {...section}
                tenant={tenant}
              />
            );
          case 'contact':
            return (
              <ContactSection
                key={`contact-${index}`}
                {...section}
                tenant={tenant}
              />
            );
          case 'cta':
            return (
              <CTASection
                key={`cta-${index}`}
                {...section}
                tenant={tenant}
                basePath={basePath}
              />
            );
          default:
            const _exhaustive: never = section;
            return _exhaustive;
        }
      })}
    </>
  );
}
```

**Why this pattern?**
- Type-safe: TypeScript ensures all section types are handled
- Exhaustiveness checking: Compiler error if new type added and not handled
- Easy to extend: Add new section type → add case → done
- Reusable: One component handles all rendering logic

### Individual Section Components

Each section component handles its own rendering, styling, and interactivity.

```tsx
// components/sections/HeroSection.tsx
'use client';

import { useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import type { HeroSection as HeroSectionType, TenantPublicDto } from '@macon/contracts';

interface HeroSectionProps extends HeroSectionType {
  tenant: TenantPublicDto;
  basePath?: string;
}

export function HeroSection({
  headline,
  subheadline,
  ctaText = 'Get Started',
  backgroundImageUrl,
  tenant,
  basePath = '',
}: HeroSectionProps) {
  return (
    <section className="relative min-h-[500px] md:min-h-[600px] flex items-center justify-center overflow-hidden">
      {/* Background image */}
      {backgroundImageUrl && (
        <div className="absolute inset-0 -z-10">
          <Image
            src={backgroundImageUrl}
            alt="Hero background"
            fill
            className="object-cover"
            priority // First image on page is likely hero
          />
          {/* Dark overlay for contrast */}
          <div className="absolute inset-0 bg-black/40" />
        </div>
      )}

      {/* Content */}
      <div className="relative z-10 text-center px-6 py-32 max-w-4xl">
        <h1 className="text-4xl sm:text-5xl md:text-6xl font-serif font-bold text-white leading-tight mb-6">
          {headline}
        </h1>

        {subheadline && (
          <p className="text-lg sm:text-xl text-white/90 mb-8 max-w-2xl mx-auto">
            {subheadline}
          </p>
        )}

        <Link
          href={`${basePath}/contact`}
          className="inline-block bg-sage hover:bg-sage-600 text-white px-10 py-4 rounded-full font-semibold transition-all duration-300 hover:shadow-xl hover:-translate-y-0.5"
        >
          {ctaText}
        </Link>
      </div>
    </section>
  );
}
```

**Section component best practices:**
- Keep sections **focused and self-contained**
- Accept all config via props (no data fetching in sections)
- Use `'use client'` only if interactive (HeroSection doesn't need it unless tracking clicks)
- Optimize images with Next.js `<Image>` component
- Use Tailwind for consistent styling
- Pass `tenant` data for branding context

---

## Config-Driven Multi-Page Sites

### The Config Pattern

Instead of hardcoding page layouts, define them as configuration. Perfect for:
- CMS-driven sites
- SaaS platforms with customizable branding
- Multi-tenant applications

### Pages Config Schema

```typescript
// packages/contracts/src/schemas/landing-page.schema.ts
import { z } from 'zod';

export type PageName = 'home' | 'about' | 'services' | 'pricing' | 'blog' | 'contact' | 'gallery';

export interface PageConfig {
  enabled: boolean;
  sections: Section[];
  customMeta?: {
    title?: string;
    description?: string;
    keywords?: string[];
  };
}

export type PagesConfig = Record<PageName, PageConfig>;

export const DEFAULT_PAGES_CONFIG: PagesConfig = {
  home: {
    enabled: true,
    sections: [
      {
        type: 'hero',
        headline: 'Welcome to Your Business',
        subheadline: 'Professional services for your needs',
        ctaText: 'Learn More',
      },
    ],
  },
  about: {
    enabled: true,
    sections: [
      {
        type: 'text',
        headline: 'About Us',
        content: 'We are committed to excellence...',
      },
    ],
  },
  services: {
    enabled: true,
    sections: [],
  },
  pricing: {
    enabled: false,
    sections: [],
  },
  blog: {
    enabled: false,
    sections: [],
  },
  contact: {
    enabled: true,
    sections: [
      {
        type: 'contact',
        email: 'hello@example.com',
      },
    ],
  },
  gallery: {
    enabled: false,
    sections: [],
  },
};
```

### Converting Legacy Config to Pages Format

When migrating from old config to new page-based format:

```typescript
// lib/tenant.ts
import { cache } from 'react';
import type { LandingPageConfig, PagesConfig, Section } from '@macon/contracts';

export function normalizeToPages(config: LandingPageConfig | null | undefined): PagesConfig {
  // If already migrated to pages format, return as-is
  if (config?.pages) {
    return config.pages;
  }

  // Start with defaults
  const pages = JSON.parse(JSON.stringify(DEFAULT_PAGES_CONFIG)) as PagesConfig;

  if (!config) return pages;

  // Convert legacy hero → home page hero section
  if (config.hero) {
    pages.home.sections = [
      {
        type: 'hero',
        headline: config.hero.headline || 'Welcome',
        subheadline: config.hero.subheadline,
        ctaText: config.hero.ctaText || 'Get Started',
        backgroundImageUrl: config.hero.backgroundImageUrl,
      },
    ];
  }

  // Convert legacy about
  if (config.about?.content) {
    pages.about.sections = [
      {
        type: 'text',
        headline: config.about.headline || 'About Us',
        content: config.about.content,
        imageUrl: config.about.imageUrl,
        imagePosition: 'left',
      },
    ];
    pages.about.enabled = config.sections?.about !== false;
  }

  // ... more conversions for gallery, testimonials, etc.

  return pages;
}
```

### Reading Config in Pages

```tsx
// app/(marketing)/about/page.tsx
import { SectionRenderer } from '@/components/SectionRenderer';
import { getTenantStorefrontData } from '@/lib/tenant';
import { normalizeToPages, isPageEnabled } from '@/lib/tenant';
import { notFound } from 'next/navigation';

interface AboutPageProps {
  params: Promise<{ slug?: string }>;
}

export default async function AboutPage({ params }: AboutPageProps) {
  const { slug } = await params;

  // Fetch tenant and config
  const data = await getTenantStorefrontData(slug);
  const { tenant } = data;

  // Check if about page is enabled
  const config = tenant.branding?.landingPage as LandingPageConfig | undefined;
  if (!isPageEnabled(config, 'about')) {
    notFound();
  }

  // Normalize to pages format and get sections
  const pages = normalizeToPages(config);
  const sections = pages.about.sections;

  return (
    <main>
      <SectionRenderer
        sections={sections}
        tenant={tenant}
        basePath={`/t/${slug}`}
      />
    </main>
  );
}

// ISR: Revalidate every 60 seconds
export const revalidate = 60;
```

### Enabling/Disabling Pages Dynamically

Tenant can control which pages are visible without code changes:

```json
{
  "tenant": {
    "branding": {
      "landingPage": {
        "pages": {
          "home": { "enabled": true },
          "about": { "enabled": true },
          "services": { "enabled": true },
          "pricing": { "enabled": false },
          "blog": { "enabled": false },
          "gallery": { "enabled": true },
          "contact": { "enabled": true }
        }
      }
    }
  }
}
```

---

## Caching Strategies

### Four-Layer Caching in Next.js

Next.js implements multiple caching layers that work together:

```
Request → Request Memoization → Data Cache → Full Route Cache → Router Cache
         (per-request)          (persistent)  (build-time)       (browser)
```

### Layer 1: Request Memoization

Automatically deduplicates identical fetch requests within a single render pass.

```tsx
// Only fetches once, second call uses memoized result
async function getAuthor(id: string) {
  const res = await fetch(`/api/authors/${id}`);
  return res.json();
}

export default async function Page() {
  const author1 = await getAuthor('123'); // MISS
  const author2 = await getAuthor('123'); // HIT (memoized)

  // Component tree receives same object instance
  return <div>Works within single render only</div>;
}
```

**Important:** Only works within a single render pass. Cleared on each request.

### Layer 2: Data Cache (Persistent)

Persists fetch results across server requests until explicitly revalidated.

**Time-based revalidation:**
```tsx
// Cache for 1 hour
const posts = await fetch('https://api.example.com/posts', {
  next: { revalidate: 3600 }
});
```

**Tag-based revalidation:**
```tsx
// Tag the fetch
const posts = await fetch('https://api.example.com/posts', {
  next: { tags: ['posts'] }
});

// Later, revalidate all 'posts' tagged fetches
revalidateTag('posts');
```

**No caching:**
```tsx
// Always fresh
const data = await fetch('https://api.example.com/data', {
  cache: 'no-store'
});
```

### Layer 3: Full Route Cache

Caches entire HTML + React Server Component payload at build time or deploy time.

**Statically rendered (build time):**
- No dynamic data fetches
- No cookies/headers/searchParams
- `export const revalidate = 60` (ISR)

**Dynamically rendered (skips cache):**
- Uses cookies, headers, or searchParams
- Calls `dynamic = 'force-dynamic'`
- Contains `no-store` fetches

**For marketing sites:**
```tsx
// Static (cacheable)
export default async function About() {
  const content = await fetch('/api/about', { next: { revalidate: 86400 } });
  return <div>...</div>;
}

// Dynamic (not cached)
import { cookies } from 'next/headers';

export default async function Dashboard() {
  const user = (await cookies()).get('user');
  return <div>Hello {user}</div>;
}
```

### Layer 4: Router Cache (Client-Side)

In-memory browser cache of RSC payloads. Automatically managed by Next.js.

**Duration:**
- Static pages: 5 minutes
- Dynamic pages: Session duration (not cached by default)

**Invalidation:**
```tsx
'use client';
import { useRouter } from 'next/navigation';

function RefreshButton() {
  const router = useRouter();
  return (
    <button onClick={() => router.refresh()}>
      Refresh (clears Router Cache only)
    </button>
  );
}
```

**Note:** `router.refresh()` is client-side only. To invalidate server cache, use Server Actions:
```typescript
'use server'
import { revalidatePath } from 'next/cache';

export async function revalidateAbout() {
  revalidatePath('/about'); // Invalidates Data Cache + Full Route Cache
}
```

### Recommended Caching Strategy for Marketing Sites

```tsx
// app/(marketing)/about/page.tsx
import { cache } from 'react';
import { revalidatePath } from 'next/cache';

// Wrap data fetches with React cache() for deduplication
const getTenantConfig = cache(async (slug: string) => {
  return fetch(`/api/tenants/${slug}/config`, {
    next: {
      revalidate: 3600, // 1 hour for data cache
      tags: ['tenant-config']
    }
  });
});

export const revalidate = 3600; // ISR: Regenerate every hour

export default async function AboutPage() {
  const config = await getTenantConfig('my-business');

  return <div>{/* render */}</div>;
}

// Server Action for webhook revalidation
export async function revalidateOnConfigChange(slug: string) {
  'use server';
  revalidatePath(`/t/${slug}`);
}
```

**Caching flow:**
1. First request → fetch, cache data, render, cache HTML
2. Subsequent requests (< 1 hour) → serve cached HTML instantly
3. Webhook arrives → `revalidateOnConfigChange()` clears cache
4. Next request after webhook → regenerate HTML, cache again
5. After 1 hour (no webhook) → automatic regeneration on next request

---

## Implementation Patterns

### Pattern 1: Tenant Storefront with ISR

Perfect for multi-tenant SaaS where each tenant gets a customizable storefront.

**Route structure:**
```
app/
├── (marketing)/
│   ├── layout.tsx              # Root marketing layout
│   ├── page.tsx                # / (landing page)
│   ├── t/
│   │   └── [slug]/
│   │       ├── layout.tsx      # Tenant-specific layout
│   │       ├── page.tsx        # /t/[slug] (home)
│   │       ├── about/page.tsx  # /t/[slug]/about
│   │       ├── services/page.tsx
│   │       ├── contact/page.tsx
│   │       └── error.tsx
│   └── ...
└── layout.tsx                   # Root layout
```

**Implementation:**
```tsx
// app/(marketing)/t/[slug]/page.tsx
import type { Metadata } from 'next';
import { SectionRenderer } from '@/components/SectionRenderer';
import { getTenantStorefrontData, normalizeToPages } from '@/lib/tenant';
import { notFound } from 'next/navigation';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;

  try {
    const { tenant } = await getTenantStorefrontData(slug);
    const heroSection = normalizeToPages(tenant.branding?.landingPage)?. home.sections[0];

    return {
      title: tenant.name,
      description: heroSection?.subheadline || `Book with ${tenant.name}`,
    };
  } catch {
    return { title: 'Not Found', robots: { index: false } };
  }
}

export async function generateStaticParams() {
  // Pre-generate popular tenants at build time
  // For large sites, omit this to use on-demand ISR
  return [{ slug: 'demo-tenant' }];
}

export const revalidate = 60; // ISR: 60 seconds

export default async function TenantPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;

  try {
    const { tenant } = await getTenantStorefrontData(slug);
    const pages = normalizeToPages(tenant.branding?.landingPage);
    const sections = pages.home.sections;

    return (
      <main>
        <SectionRenderer
          sections={sections}
          tenant={tenant}
          basePath={`/t/${slug}`}
        />
      </main>
    );
  } catch (error) {
    notFound();
  }
}
```

### Pattern 2: Corporate Marketing Site with Fixed Routes

For your own marketing site (not multi-tenant), define routes explicitly.

**Route structure:**
```
app/
├── (marketing)/
│   ├── layout.tsx           # Nav + Footer
│   ├── page.tsx             # /
│   ├── about/
│   │   ├── page.tsx         # /about
│   │   ├── loading.tsx
│   │   └── error.tsx
│   ├── services/page.tsx    # /services
│   ├── pricing/page.tsx     # /pricing
│   ├── blog/
│   │   ├── page.tsx         # /blog (listing)
│   │   └── [slug]/
│   │       ├── page.tsx     # /blog/[slug]
│   │       └── error.tsx
│   ├── contact/page.tsx     # /contact
│   └── legal/
│       ├── privacy/page.tsx # /legal/privacy
│       └── terms/page.tsx   # /legal/terms
└── layout.tsx               # Root
```

**Implementation:**
```tsx
// app/(marketing)/layout.tsx
import { MarketingNav } from '@/components/marketing/MarketingNav';
import { MarketingFooter } from '@/components/marketing/MarketingFooter';

export default function MarketingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col min-h-screen">
      <MarketingNav />
      <main className="flex-1">{children}</main>
      <MarketingFooter />
    </div>
  );
}

// app/(marketing)/page.tsx (Home with sections)
import { SectionRenderer } from '@/components/SectionRenderer';
import { getHomepageConfig } from '@/lib/homepage';

export const revalidate = 3600; // 1 hour

export default async function HomePage() {
  const sections = await getHomepageConfig();

  return (
    <main>
      <SectionRenderer sections={sections} tenant={{}} />
    </main>
  );
}

// app/(marketing)/blog/page.tsx (Blog listing)
import { getAllBlogPosts } from '@/lib/blog';
import Link from 'next/link';

export const revalidate = 3600;

export default async function BlogPage() {
  const posts = await getAllBlogPosts();

  return (
    <main className="max-w-4xl mx-auto py-20">
      <h1 className="text-5xl font-serif mb-12">Blog</h1>
      <div className="space-y-8">
        {posts.map(post => (
          <article key={post.id}>
            <Link href={`/blog/${post.slug}`}>
              <h2 className="text-3xl font-serif hover:text-sage transition-colors">
                {post.title}
              </h2>
            </Link>
            <p className="text-neutral-600 mt-2">{post.excerpt}</p>
            <time className="text-sm text-neutral-500">
              {new Date(post.publishedAt).toLocaleDateString()}
            </time>
          </article>
        ))}
      </div>
    </main>
  );
}

// app/(marketing)/blog/[slug]/page.tsx (Blog post)
import { getBlogPost, getAllBlogPostSlugs } from '@/lib/blog';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const post = await getBlogPost(slug);

  if (!post) return { title: 'Not Found' };

  return {
    title: post.title,
    description: post.excerpt,
    openGraph: {
      title: post.title,
      description: post.excerpt,
      images: post.imageUrl ? [post.imageUrl] : [],
    },
  };
}

export async function generateStaticParams() {
  const posts = await getAllBlogPostSlugs();
  return posts.map(slug => ({ slug }));
}

export const revalidate = 86400; // Daily for blog posts

export default async function BlogPostPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const post = await getBlogPost(slug);

  if (!post) {
    notFound();
  }

  return (
    <article className="max-w-3xl mx-auto py-20">
      <header>
        <h1 className="text-5xl font-serif mb-4">{post.title}</h1>
        <time className="text-neutral-600">
          {new Date(post.publishedAt).toLocaleDateString()}
        </time>
      </header>
      <div className="prose prose-lg mt-12">{post.html}</div>
    </article>
  );
}
```

### Pattern 3: Dynamic Pages with Fallback

For truly dynamic content where you can't pre-generate all routes at build time.

```tsx
// app/posts/[slug]/page.tsx
export const dynamicParams = true; // Enable on-demand ISR

export async function generateStaticParams() {
  // Generate top 10 most popular posts at build time
  const popular = await getPopularPosts(10);
  return popular.map(post => ({ slug: post.slug }));
}

export const revalidate = 60; // ISR: 60 seconds

export default async function PostPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const post = await getPost(slug);

  if (!post) notFound();

  return <article>{/* ... */}</article>;
}
```

**Flow:**
1. Build time: Generate 10 most popular posts
2. User visits unknown post → generate on demand (60 sec wait)
3. Cache for 60 seconds
4. Next visitor → instant (cached)

---

## MAIS Corporate Website Pattern

### Recommended Structure for MAIS Website

Goal: Use same section-based architecture as tenant storefronts for your corporate website.

**Route structure:**
```
app/
├── (marketing)/
│   ├── layout.tsx                # Marketing layout
│   ├── page.tsx                  # / (home)
│   ├── about/page.tsx            # /about
│   ├── platform/page.tsx         # /platform (features)
│   ├── pricing/page.tsx          # /pricing
│   ├── solutions/
│   │   ├── page.tsx              # /solutions
│   │   └── [category]/
│   │       └── page.tsx          # /solutions/[category]
│   ├── blog/
│   │   ├── page.tsx              # /blog
│   │   └── [slug]/
│   │       ├── page.tsx          # /blog/[slug]
│   │       ├── loading.tsx
│   │       └── error.tsx
│   ├── contact/page.tsx          # /contact
│   └── legal/
│       ├── privacy/page.tsx      # /legal/privacy
│       └── terms/page.tsx        # /legal/terms
│
├── (admin)/                      # Existing admin routes
│   ├── dashboard/page.tsx        # /dashboard
│   └── ...
│
└── layout.tsx                    # Root
```

### Config-Driven Approach

Store corporate website config in code (or database):

```typescript
// lib/corporate-site.ts
import type { Section, PagesConfig } from '@macon/contracts';

export const CORPORATE_PAGES_CONFIG: PagesConfig = {
  home: {
    enabled: true,
    sections: [
      {
        type: 'hero',
        headline: 'Transform Your Business With MAIS',
        subheadline: 'AI-powered consulting, seamless booking, and marketing automation for entrepreneurs',
        ctaText: 'Start Free Trial',
        backgroundImageUrl: '/images/hero-bg.jpg',
      },
      {
        type: 'text',
        headline: 'Why MAIS?',
        content: 'MAIS is a business growth club...',
        imageUrl: '/images/why-mais.jpg',
        imagePosition: 'right',
      },
      {
        type: 'cta',
        headline: 'Ready to grow?',
        description: 'Join hundreds of successful entrepreneurs',
        buttonText: 'Start your journey',
        buttonLink: '/platform',
      },
    ],
  },
  about: {
    enabled: true,
    sections: [
      {
        type: 'hero',
        headline: 'About MAIS',
        subheadline: 'Built by entrepreneurs, for entrepreneurs',
      },
      {
        type: 'text',
        headline: 'Our Story',
        content: 'MAIS was founded...',
        imageUrl: '/images/team.jpg',
        imagePosition: 'left',
      },
      {
        type: 'testimonials',
        headline: 'What Our Partners Say',
        testimonials: [
          {
            name: 'Jane Doe',
            role: 'Photographer',
            content: 'MAIS transformed my booking process',
            rating: 5,
            imageUrl: '/images/jane.jpg',
          },
        ],
      },
    ],
  },
  services: {
    enabled: true,
    sections: [
      {
        type: 'hero',
        headline: 'Our Services',
      },
      // ... service cards rendered as gallery or text sections
    ],
  },
  // ... other pages
};

// Fetch hook (similar to tenant fetching)
export async function getCorporatePages() {
  // Could also fetch from CMS/database
  return CORPORATE_PAGES_CONFIG;
}

export function isCorporatePageEnabled(pageName: string): boolean {
  const pages = CORPORATE_PAGES_CONFIG;
  return (pages as any)?.[pageName]?.enabled !== false;
}
```

### Implementation

```tsx
// app/(marketing)/page.tsx
import { SectionRenderer } from '@/components/SectionRenderer';
import { getCorporatePages } from '@/lib/corporate-site';

export const revalidate = 3600; // ISR: 1 hour

export default async function HomePage() {
  const pages = await getCorporatePages();
  const sections = pages.home.sections;

  return (
    <main>
      <SectionRenderer sections={sections} tenant={{}} />
    </main>
  );
}

// app/(marketing)/about/page.tsx
import type { Metadata } from 'next';
import { SectionRenderer } from '@/components/SectionRenderer';
import { getCorporatePages, isCorporatePageEnabled } from '@/lib/corporate-site';
import { notFound } from 'next/navigation';

export const revalidate = 3600;

export const metadata: Metadata = {
  title: 'About MAIS',
  description: 'Learn about MAIS and our mission to help entrepreneurs grow',
};

export default async function AboutPage() {
  if (!isCorporatePageEnabled('about')) {
    notFound();
  }

  const pages = await getCorporatePages();
  const sections = pages.about.sections;

  return (
    <main>
      <SectionRenderer sections={sections} tenant={{}} />
    </main>
  );
}
```

### Adding a CMS Layer (Optional)

Later, you could fetch config from a CMS instead:

```typescript
// lib/corporate-site.ts
import { cache } from 'react';

const getCorporatePagesFromCMS = cache(async () => {
  // Fetch from your CMS (Sanity, Contentful, etc.)
  const response = await fetch(`${process.env.CMS_URL}/pages/corporate`, {
    next: {
      revalidate: 3600,
      tags: ['corporate-pages']
    }
  });

  return response.json() as Promise<PagesConfig>;
});

export async function getCorporatePages() {
  return getCorporatePagesFromCMS();
}

// CMS webhook handler
export async function revalidateCorporatePages() {
  'use server';
  revalidateTag('corporate-pages');
}
```

---

## Key Takeaways

### For Multi-Page Marketing Sites:

1. **Use ISR with 1-hour TTL** as default for most marketing pages
2. **Combine with on-demand revalidation** for CMS/config updates
3. **Structure with route groups** to separate marketing, admin, and API routes
4. **Use nested layouts** for consistent nav/footer across sections
5. **Implement section-based rendering** with SectionRenderer pattern
6. **Store config as code** (or fetch from CMS) rather than hardcoding
7. **Add `generateStaticParams()`** only for high-traffic routes (pre-generates at build)
8. **Use dynamic routes with fallback** for content you can't pre-generate
9. **Optimize images** with Next.js `<Image>` component
10. **Cache fetch requests** with `next: { revalidate, tags }`

### Performance Characteristics:

| Page Type | Strategy | TTFB | Cache Hit |
|-----------|----------|------|-----------|
| Home | ISR 60s | <100ms | instant |
| Blog list | ISR 3600s | <100ms | instant |
| Blog post | ISR 3600s + generateStaticParams | <100ms | instant |
| Dynamic tenant | ISR 60s + on-demand | <200ms | instant |
| Real-time data | SSR (no cache) | ~1000ms | never |

### When to Use Each Pattern:

- **Time-based ISR** → Blog posts, product listings, static marketing copy
- **On-demand ISR** → CMS-driven content, user-generated config
- **Dynamic rendering** → Real-time data, user-specific content, protected pages
- **Pre-generated static** → Marketing site home, pricing, about pages

---

## References

- [Next.js ISR Documentation](https://nextjs.org/docs/app/building-your-application/rendering/incremental-static-regeneration)
- [Next.js Caching Guide](https://nextjs.org/docs/app/building-your-application/caching)
- [Next.js Data Fetching](https://nextjs.org/docs/app/building-your-application/data-fetching)
- [Next.js Route Groups](https://nextjs.org/docs/app/building-your-application/routing/route-groups)
- [Next.js App Router Documentation](https://nextjs.org/docs/app/building-your-application/routing)

