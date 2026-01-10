# MAIS Corporate Website Implementation Guide

**Status:** Ready for implementation
**Scope:** Building marketing.mais.co (corporate website) using existing tenant storefront patterns
**Tech Stack:** Next.js 14 App Router, React Server Components, ISR, Section-based rendering

---

## Quick Start: 5-Step Implementation

### Step 1: Create Route Structure (5 min)

Create the following directory structure in `apps/web/src/app`:

```bash
mkdir -p "(marketing)/solutions/{ai-consulting,booking,websites,marketing}"
mkdir -p "(marketing)/blog/{loading,error}"
mkdir -p "(marketing)/legal"
```

This creates routes:

- `/` → home
- `/about` → about
- `/platform` → features
- `/pricing` → pricing
- `/solutions` → solutions hub
- `/solutions/[category]` → individual solution pages
- `/blog` → blog listing
- `/blog/[slug]` → individual blog posts
- `/contact` → contact page
- `/legal/privacy` → privacy policy
- `/legal/terms` → terms of service

### Step 2: Implement Corporate Pages Config (10 min)

Create `/Users/mikeyoung/CODING/MAIS/apps/web/src/lib/corporate-site.ts`:

```typescript
import type { Section, PagesConfig } from '@macon/contracts';
import { cache } from 'react';

/**
 * MAIS Corporate Website Content Configuration
 *
 * Uses the same section-based pattern as tenant storefronts.
 * This allows:
 * - Easy page composition with reusable sections
 * - CMS integration by swapping getCorporatePages()
 * - Consistent styling with tenant sites
 * - Easy A/B testing by swapping configs
 */

export const CORPORATE_PAGES_CONFIG: PagesConfig = {
  home: {
    enabled: true,
    sections: [
      {
        type: 'hero',
        headline: 'Transform Your Business With MAIS',
        subheadline:
          'AI-powered consulting, seamless booking, and marketing automation for entrepreneurs',
        ctaText: 'Start Free Trial',
        backgroundImageUrl: '/images/corporate/hero.jpg',
      } as any, // Cast because Section is discriminated union
      {
        type: 'text',
        headline: 'Why HANDLED?',
        content: `<p>HANDLED is a membership platform for service professionals — from photographers to therapists to personal trainers.</p>
                 <p>We combine done-for-you tech (optimized storefront, booking, AI chatbots) with done-with-you education (monthly newsletters, Zoom calls). One membership fee, everything included.</p>`,
        imageUrl: '/images/corporate/features.jpg',
        imagePosition: 'right' as const,
      } as any,
      {
        type: 'cta',
        headline: 'Ready to grow?',
        description: 'Join hundreds of successful entrepreneurs using MAIS',
        buttonText: 'See the platform',
        buttonLink: '/platform',
      } as any,
    ],
  },
  about: {
    enabled: true,
    sections: [
      {
        type: 'hero',
        headline: 'About MAIS',
        subheadline: 'Built by entrepreneurs, for entrepreneurs',
      } as any,
      {
        type: 'text',
        headline: 'Our Mission',
        content: `<p>We believe service professionals should focus on their craft, not their tech.</p>
                 <p>HANDLED combines professional websites, booking systems, and AI chatbots with ongoing education — so you can serve your clients, not wrestle with software.</p>`,
        imageUrl: '/images/corporate/mission.jpg',
        imagePosition: 'left' as const,
      } as any,
      {
        type: 'testimonials',
        headline: 'What Our Partners Say',
        testimonials: [
          {
            name: 'Sarah Chen',
            role: 'Photographer',
            content:
              'MAIS tripled my bookings in 3 months. The booking system is intuitive and my clients love it.',
            rating: 5,
            imageUrl: '/images/corporate/sarah.jpg',
          },
          {
            name: 'Marcus Johnson',
            role: 'Business Coach',
            content:
              'Finally, a platform that understood my business. The monthly membership is predictable, and I keep 100% of my bookings.',
            rating: 5,
            imageUrl: '/images/corporate/marcus.jpg',
          },
        ],
      } as any,
    ],
  },
  services: {
    enabled: true,
    sections: [
      {
        type: 'hero',
        headline: 'Our Solutions',
        subheadline: 'Everything you need to grow your business',
      } as any,
      {
        type: 'text',
        headline: 'Complete Platform',
        content: `<h3>AI Consulting</h3>
                 <p>Expert advice on business strategy, marketing, and operations.</p>
                 <h3>Professional Websites</h3>
                 <p>Beautiful, conversion-optimized websites that showcase your work.</p>
                 <h3>Seamless Booking</h3>
                 <p>Integrated scheduling with calendar sync and automatic confirmations.</p>
                 <h3>Marketing Automation</h3>
                 <p>Email campaigns, social media scheduling, and analytics.</p>`,
      } as any,
    ],
  },
  pricing: {
    enabled: true,
    sections: [
      {
        type: 'hero',
        headline: 'Simple, Predictable Pricing',
        subheadline: 'One membership fee. Everything included. No percentage of your bookings.',
      } as any,
      {
        type: 'text',
        headline: 'Membership Model',
        content: `<p>HANDLED is a straightforward membership — one monthly fee, everything included:</p>
                 <ul>
                   <li>Professional website with booking and payments</li>
                   <li>AI chatbot for 24/7 client inquiries</li>
                   <li>Monthly newsletter on AI trends that matter</li>
                   <li>Live Zoom calls with community and experts</li>
                   <li>Ongoing support when you need it</li>
                 </ul>
                 <p>You keep 100% of your bookings — we charge a membership fee, not a percentage.</p>`,
      } as any,
    ],
  },
  blog: {
    enabled: false, // Handled separately with dynamic routes
    sections: [],
  },
  contact: {
    enabled: true,
    sections: [
      {
        type: 'hero',
        headline: 'Get in Touch',
        subheadline: "Have questions? We'd love to hear from you.",
      } as any,
      {
        type: 'contact',
        email: 'hello@mais.co',
        phone: '+1-555-MAIS-CO',
        address: 'San Francisco, CA',
      } as any,
    ],
  },
  gallery: {
    enabled: false,
    sections: [],
  },
};

/**
 * Fetch corporate pages configuration
 *
 * Wrapped with React cache() to deduplicate requests within a render pass.
 * Later, swap this function to fetch from CMS.
 */
export const getCorporatePages = cache(async (): Promise<PagesConfig> => {
  // For now, return static config
  return CORPORATE_PAGES_CONFIG;

  // Later: Fetch from Sanity, Contentful, or database
  // const response = await fetch(`${process.env.CMS_URL}/pages/corporate`, {
  //   next: {
  //     revalidate: 3600,
  //     tags: ['corporate-pages']
  //   }
  // });
  // return response.json();
});

/**
 * Check if a corporate page is enabled
 */
export function isCorporatePageEnabled(pageName: string): boolean {
  const pages = CORPORATE_PAGES_CONFIG;
  return (pages as any)[pageName]?.enabled !== false;
}

/**
 * Revalidate corporate site cache (for webhooks)
 * @example
 * // Called from CMS webhook handler
 * await revalidateCorporateSite();
 */
export async function revalidateCorporateSite() {
  'use server';
  const { revalidatePath } = await import('next/cache');

  // Revalidate all corporate routes
  revalidatePath('/(marketing)', 'layout');
}

/**
 * Corporate site branding (shared with sections)
 * Pass this as 'tenant' to SectionRenderer for consistency
 */
export const CORPORATE_BRANDING = {
  id: 'handled-corp',
  name: 'HANDLED',
  slug: 'handled',
  description:
    'Membership platform for service professionals - done-for-you tech, done-with-you education',
  website: 'https://gethandled.ai',
  email: 'hello@gethandled.ai',
  phone: '+1-555-HANDLED',
  branding: {
    logoUrl: '/images/mais-logo.svg',
    primaryColor: '#16a34a', // sage green
    fontFamily: 'Poppins, system-ui, sans-serif',
  },
} as any;
```

### Step 3: Create Home Page (5 min)

Create `/Users/mikeyoung/CODING/MAIS/apps/web/src/app/(marketing)/page.tsx`:

```typescript
import type { Metadata } from 'next';
import { SectionRenderer } from '@/components/tenant/SectionRenderer';
import { getCorporatePages, CORPORATE_BRANDING } from '@/lib/corporate-site';

export const metadata: Metadata = {
  title: 'HANDLED - Done-for-you tech for service professionals',
  description: 'Optimized storefronts, booking systems, and AI chatbots for service professionals. One membership fee, everything included.',
  openGraph: {
    title: 'HANDLED - Done-for-you tech for service professionals',
    description: 'Optimized storefronts, booking systems, and AI chatbots for service professionals. One membership fee, everything included.',
    url: 'https://gethandled.ai',
    siteName: 'HANDLED',
    images: [
      {
        url: '/images/corporate/og-image.jpg',
        width: 1200,
        height: 630,
      },
    ],
  },
};

// ISR: Revalidate every hour
// On-demand revalidation via webhook: POST /api/revalidate
export const revalidate = 3600;

export default async function HomePage() {
  const pages = await getCorporatePages();
  const sections = pages.home.sections;

  return (
    <main>
      <SectionRenderer
        sections={sections}
        tenant={CORPORATE_BRANDING}
      />
    </main>
  );
}
```

### Step 4: Create Dynamic Blog Routes (10 min)

Create `/Users/mikeyoung/CODING/MAIS/apps/web/src/lib/blog.ts`:

```typescript
import { cache } from 'react';

export interface BlogPost {
  id: string;
  slug: string;
  title: string;
  excerpt: string;
  content: string;
  imageUrl?: string;
  publishedAt: Date;
  author: {
    name: string;
    imageUrl?: string;
  };
  tags: string[];
}

// For now, hardcoded blog posts
// Later: Fetch from CMS or database
const BLOG_POSTS: BlogPost[] = [
  {
    id: '1',
    slug: 'why-automation-matters',
    title: 'Why Marketing Automation Matters for Small Businesses',
    excerpt:
      'Learn how automation can save you 10+ hours per week while improving customer engagement.',
    content: `<p>Marketing automation is no longer a luxury—it's a necessity for growing businesses...</p>`,
    imageUrl: '/images/blog/automation.jpg',
    publishedAt: new Date('2025-12-20'),
    author: { name: 'Sarah Chen' },
    tags: ['marketing', 'automation', 'growth'],
  },
  {
    id: '2',
    slug: 'booking-system-checklist',
    title: 'The Ultimate Booking System Checklist',
    excerpt: "What features should your booking system have? Here's our comprehensive guide.",
    content: `<p>A good booking system does more than just take reservations...</p>`,
    imageUrl: '/images/blog/booking.jpg',
    publishedAt: new Date('2025-12-15'),
    author: { name: 'Marcus Johnson' },
    tags: ['booking', 'tools', 'operations'],
  },
];

/**
 * Get all blog posts (for listing page)
 * Cached to deduplicate multiple calls in same render
 */
export const getAllBlogPosts = cache(async (): Promise<BlogPost[]> => {
  // Later: Fetch from CMS
  // const response = await fetch(`${process.env.CMS_URL}/posts`, {
  //   next: { revalidate: 3600, tags: ['blog-posts'] }
  // });
  // return response.json();

  return BLOG_POSTS.sort(
    (a, b) => new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime()
  );
});

/**
 * Get a single blog post by slug
 */
export const getBlogPost = cache(async (slug: string): Promise<BlogPost | null> => {
  const posts = await getAllBlogPosts();
  return posts.find((p) => p.slug === slug) || null;
});

/**
 * Get all blog post slugs (for generateStaticParams)
 * Pre-generates all blog posts at build time
 */
export async function getAllBlogPostSlugs(): Promise<string[]> {
  const posts = await getAllBlogPosts();
  return posts.map((p) => p.slug);
}

/**
 * Get recent blog posts (for home page sidebar)
 */
export async function getRecentBlogPosts(limit: number = 3): Promise<BlogPost[]> {
  const posts = await getAllBlogPosts();
  return posts.slice(0, limit);
}
```

Create `/Users/mikeyoung/CODING/MAIS/apps/web/src/app/(marketing)/blog/page.tsx`:

```typescript
import type { Metadata } from 'next';
import Link from 'next/link';
import { getAllBlogPosts } from '@/lib/blog';

export const metadata: Metadata = {
  title: 'Blog - MAIS',
  description: 'Tips, insights, and stories about growing your business with AI and automation.',
};

export const revalidate = 3600; // 1 hour

export default async function BlogPage() {
  const posts = await getAllBlogPosts();

  return (
    <main className="max-w-4xl mx-auto py-20 px-6">
      <div className="mb-16">
        <h1 className="font-serif text-5xl sm:text-6xl font-bold mb-4">Blog</h1>
        <p className="text-xl text-neutral-600">
          Tips, insights, and stories about growing your business.
        </p>
      </div>

      {posts.length === 0 && (
        <p className="text-neutral-600 text-center py-20">No posts yet.</p>
      )}

      <div className="space-y-12">
        {posts.map(post => (
          <article
            key={post.id}
            className="border-b border-neutral-200 pb-12 last:border-b-0"
          >
            <Link href={`/blog/${post.slug}`} className="group">
              <h2 className="font-serif text-3xl font-bold group-hover:text-sage transition-colors mb-3">
                {post.title}
              </h2>
            </Link>

            <p className="text-neutral-600 mb-4">{post.excerpt}</p>

            <div className="flex items-center gap-4 text-sm text-neutral-500">
              <time>
                {new Date(post.publishedAt).toLocaleDateString('en-US', {
                  year: 'numeric',
                  month: 'long',
                  day: 'numeric',
                })}
              </time>
              <span>By {post.author.name}</span>
              {post.tags.length > 0 && (
                <div className="flex gap-2">
                  {post.tags.slice(0, 2).map(tag => (
                    <span
                      key={tag}
                      className="bg-neutral-100 text-neutral-700 px-2 py-1 rounded text-xs"
                    >
                      {tag}
                    </span>
                  ))}
                </div>
              )}
            </div>
          </article>
        ))}
      </div>
    </main>
  );
}
```

Create `/Users/mikeyoung/CODING/MAIS/apps/web/src/app/(marketing)/blog/[slug]/page.tsx`:

```typescript
import type { Metadata } from 'next';
import Link from 'next/link';
import { getBlogPost, getAllBlogPostSlugs } from '@/lib/blog';
import { notFound } from 'next/navigation';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const post = await getBlogPost(slug);

  if (!post) {
    return {
      title: 'Not Found',
      robots: { index: false },
    };
  }

  return {
    title: post.title,
    description: post.excerpt,
    openGraph: {
      title: post.title,
      description: post.excerpt,
      type: 'article',
      publishedTime: post.publishedAt.toISOString(),
      authors: [post.author.name],
      images: post.imageUrl ? [post.imageUrl] : [],
    },
  };
}

export async function generateStaticParams() {
  const slugs = await getAllBlogPostSlugs();
  return slugs.map(slug => ({ slug }));
}

export const revalidate = 86400; // 1 day for blog posts

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
    <main className="max-w-3xl mx-auto py-20 px-6">
      <Link
        href="/blog"
        className="text-sage hover:text-sage-700 mb-8 inline-flex items-center gap-2"
      >
        ← Back to blog
      </Link>

      <article>
        <header className="mb-12">
          <h1 className="font-serif text-5xl font-bold mb-4">{post.title}</h1>

          <div className="flex items-center gap-4 text-neutral-600 border-b border-neutral-200 pb-6">
            <time>
              {new Date(post.publishedAt).toLocaleDateString('en-US', {
                year: 'numeric',
                month: 'long',
                day: 'numeric',
              })}
            </time>
            <span>By {post.author.name}</span>
          </div>
        </header>

        {post.imageUrl && (
          <img
            src={post.imageUrl}
            alt={post.title}
            className="w-full h-auto rounded-lg mb-12"
          />
        )}

        <div
          className="prose prose-lg max-w-none"
          dangerouslySetInnerHTML={{ __html: post.content }}
        />

        {post.tags.length > 0 && (
          <footer className="mt-12 pt-6 border-t border-neutral-200">
            <div className="flex gap-2 flex-wrap">
              {post.tags.map(tag => (
                <span
                  key={tag}
                  className="bg-neutral-100 text-neutral-700 px-3 py-1 rounded-full text-sm"
                >
                  #{tag}
                </span>
              ))}
            </div>
          </footer>
        )}
      </article>
    </main>
  );
}
```

### Step 5: Add Remaining Pages (10 min)

Create `/Users/mikeyoung/CODING/MAIS/apps/web/src/app/(marketing)/about/page.tsx`:

```typescript
import type { Metadata } from 'next';
import { SectionRenderer } from '@/components/tenant/SectionRenderer';
import { getCorporatePages, CORPORATE_BRANDING, isCorporatePageEnabled } from '@/lib/corporate-site';
import { notFound } from 'next/navigation';

export const metadata: Metadata = {
  title: 'About MAIS',
  description: 'Learn about MAIS and our mission to help entrepreneurs grow.',
};

export const revalidate = 3600;

export default async function AboutPage() {
  if (!isCorporatePageEnabled('about')) {
    notFound();
  }

  const pages = await getCorporatePages();
  const sections = pages.about.sections;

  return (
    <main>
      <SectionRenderer
        sections={sections}
        tenant={CORPORATE_BRANDING}
      />
    </main>
  );
}
```

Follow the same pattern for:

- `/platform/page.tsx` (services)
- `/pricing/page.tsx` (pricing)
- `/contact/page.tsx` (contact)
- `/solutions/page.tsx` (solutions hub)
- `/legal/privacy/page.tsx` (privacy policy)
- `/legal/terms/page.tsx` (terms of service)

---

## Integration with Existing Tenant System

Your corporate website uses the **same components** as tenant storefronts:

```tsx
// Both corporate site and tenant storefronts use:
import { SectionRenderer } from '@/components/tenant/SectionRenderer';

// Pass different data, same rendering:
<SectionRenderer sections={corporatePages.home.sections} tenant={CORPORATE_BRANDING} />
<SectionRenderer sections={tenantPages.home.sections} tenant={tenantData} />
```

**Benefits:**

- Consistency across all pages
- Easy to test changes on corporate site first
- Reuse section components
- Unified brand voice

---

## Adding Webhooks for Revalidation

If you later add a CMS, create a webhook handler:

Create `/Users/mikeyoung/CODING/MAIS/apps/web/src/app/api/revalidate/corporate/route.ts`:

```typescript
import { revalidatePath, revalidateTag } from 'next/cache';
import { NextRequest, NextResponse } from 'next/server';

/**
 * Webhook endpoint for CMS to trigger cache invalidation
 * POST /api/revalidate/corporate
 * Headers: { 'x-revalidate-secret': process.env.REVALIDATE_SECRET }
 * Body: { path: '/(marketing)' } or { tag: 'corporate-pages' }
 */
export async function POST(request: NextRequest) {
  const secret = request.headers.get('x-revalidate-secret');

  if (secret !== process.env.REVALIDATE_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { path, tag } = await request.json();

    if (tag) {
      revalidateTag(tag);
    } else if (path) {
      revalidatePath(path, 'layout');
    } else {
      return NextResponse.json({ error: 'Missing path or tag' }, { status: 400 });
    }

    return NextResponse.json({
      revalidated: true,
      now: Date.now(),
      path,
      tag,
    });
  } catch (error) {
    return NextResponse.json({ error: 'Revalidation failed' }, { status: 500 });
  }
}
```

---

## Environment Variables

Add to `.env.local`:

```env
# For CMS integration (optional)
CMS_URL=https://your-cms.com
REVALIDATE_SECRET=your-secret-key-here
```

---

## Testing Locally

```bash
# Start API
npm run dev:api

# In another terminal, build and start production server
npm run --workspace=@macon/web-next build
npm run --workspace=@macon/web-next start

# Visit http://localhost:3000
```

---

## Common Patterns

### A/B Testing Pages

Swap page config without code changes:

```typescript
function getPageConfig(variant: 'a' | 'b'): PagesConfig {
  if (variant === 'b') {
    return {
      ...CORPORATE_PAGES_CONFIG,
      home: {
        ...CORPORATE_PAGES_CONFIG.home,
        sections: CORPORATE_PAGES_CONFIG.home.sections.map((s) =>
          s.type === 'hero' ? { ...s, ctaText: 'Start Your Free Trial' } : s
        ),
      },
    };
  }
  return CORPORATE_PAGES_CONFIG;
}
```

### Adding Email Signup

Add to contact section:

```typescript
{
  type: 'contact',
  email: 'hello@mais.co',
  includeNewsletter: true,
  newsletterPlaceholder: 'Enter your email',
  newsletterButtonText: 'Subscribe',
}
```

### Dynamic Blog Tags Page

Add `/blog/tags/[tag]/page.tsx`:

```typescript
export async function generateStaticParams() {
  const posts = await getAllBlogPosts();
  const tags = new Set(posts.flatMap((p) => p.tags));
  return Array.from(tags).map((tag) => ({ tag }));
}

export default async function TagPage({ params }: { params: Promise<{ tag: string }> }) {
  const { tag } = await params;
  const posts = await getAllBlogPosts();
  const filtered = posts.filter((p) => p.tags.includes(tag));

  // Render filtered posts
}
```

---

## Performance Targets

After implementation, you should see:

| Page      | TTFB   | TTI | Lighthouse |
| --------- | ------ | --- | ---------- |
| Home      | <100ms | <1s | 95+        |
| Blog list | <150ms | <1s | 90+        |
| Blog post | <150ms | <1s | 90+        |
| About     | <100ms | <1s | 95+        |

---

## Next Steps

1. **Complete implementation** of all pages (15 min)
2. **Add placeholder images** to public folder
3. **Deploy to Vercel** for free
4. **Set up CMS** (optional) - Sanity or Contentful
5. **Add analytics** - Vercel Analytics or Plausible
