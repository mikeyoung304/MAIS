# ISR & Revalidation Decision Tree

**Date:** December 26, 2025
**Purpose:** Quick decision-making for ISR strategy on different page types
**Audience:** Developers adding new pages to corporate site or tenant storefronts

---

## Quick Decision Matrix

| Page Type           | Use Case             | Revalidate             | TTL     | Why                            |
| ------------------- | -------------------- | ---------------------- | ------- | ------------------------------ |
| Home                | Marketing hero + CTA | Time-based             | 60s     | Frequent brand updates         |
| Blog list           | Post listing         | Time-based             | 3600s   | New posts infrequent           |
| Blog post           | Individual post      | Static params          | 86400s  | Content changes rarely         |
| About               | Company info         | Time-based             | 3600s   | Occasional updates             |
| Pricing             | Service pricing      | Time-based             | 3600s   | Rarely changed                 |
| Contact             | Contact form         | On-demand              | N/A     | Form only, data sent elsewhere |
| Terms/Privacy       | Legal docs           | Static/never           | 604800s | Rarely changes                 |
| Solutions (dynamic) | Category pages       | Time-based             | 3600s   | CMS-driven content             |
| Tenant home         | User storefront      | Time-based + on-demand | 60s     | User updates frequently        |
| Product detail      | Single product       | Static params          | 3600s   | Inventory changes rare         |

---

## Decision Tree

Start here when adding a new page:

```
┌─────────────────────────────────────────┐
│  Is content in database/CMS?            │
└─────────────┬───────────────────────────┘
              │
      ┌───────┴───────┐
     YES             NO
      │               │
      ▼               ▼
┌──────────────┐  ┌──────────────────────┐
│ CMS-Driven   │  │ Hardcoded/Static    │
│ Content      │  │ Content             │
└──────┬───────┘  └──────┬───────────────┘
       │                 │
       ▼                 ▼
   Does it have      Can you
   10,000+ pages?    pre-generate
       │             all routes
    YES NO           at build?
     │   │           │        │
     │   │        YES        NO
     │   │           │        │
  Fallback  On-demand  Static Params  On-demand
  ISR       ISR        + ISR            ISR
  (via      (with      (with           (600s TTL
  `next`)   webhook)   60s TTL)        fallback)
```

---

## Detailed Guidance by Scenario

### Scenario 1: Time-Based ISR (Most Common)

**When to use:**

- Content updates infrequently
- No CMS webhook available
- Want guaranteed freshness after TTL

**Implementation:**

```typescript
export const revalidate = 3600; // Revalidate every hour

export default async function Page() {
  const content = await fetch('/api/content', {
    next: { revalidate: 3600 },
  });
  // ...
}
```

**Pros:**

- Simple, no external dependencies
- Guaranteed freshness after TTL
- Works with Vercel, self-hosted, etc.

**Cons:**

- Stale content between TTL intervals
- Wasted regenerations if content doesn't change

**Best for:**

- Blog posts (update every few days)
- About pages (update every few weeks)
- Pricing pages (update every few weeks)
- Product listings (inventory updates infrequently)

### Scenario 2: On-Demand ISR with Webhooks

**When to use:**

- Content changes frequently
- Have CMS that supports webhooks
- Need immediate cache invalidation

**Implementation:**

```typescript
// pages/blog/[slug]/page.tsx
export const revalidate = 3600; // Fallback if webhook fails

export async function generateStaticParams() {
  return getPopularBlogPosts(10);
}

export default async function BlogPostPage({ params }) {
  const post = await getPost(params.slug);
  return <article>{post.content}</article>;
}

// app/api/revalidate/blog/route.ts
export async function POST(request: NextRequest) {
  const secret = request.headers.get('x-revalidate-secret');
  if (secret !== process.env.REVALIDATE_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { slug } = await request.json();
  revalidatePath(`/blog/${slug}`);

  return NextResponse.json({ revalidated: true });
}

// CMS webhook handler calls:
// POST /api/revalidate/blog
// { slug: 'new-post' }
```

**Pros:**

- Immediate cache invalidation
- No stale content window
- Precise control per resource

**Cons:**

- Requires CMS webhook integration
- If webhook fails, falls back to TTL
- More complex setup

**Best for:**

- Frequently updated content (daily/hourly)
- CMS-driven sites (Sanity, Contentful, etc.)
- Multi-tenant platforms (tenant updates config)
- E-commerce (inventory changes)

### Scenario 3: Static Route Parameters (Build Time)

**When to use:**

- Know all routes at build time
- Routes are stable (don't change frequently)
- Want maximum performance

**Implementation:**

```typescript
// app/blog/[slug]/page.tsx
export async function generateStaticParams() {
  const posts = await getAllBlogPosts();
  return posts.map(post => ({
    slug: post.slug
  }));
}

export const revalidate = 86400; // Still use ISR as fallback

export default async function BlogPostPage({ params }) {
  const { slug } = await params;
  const post = await getPost(slug);
  return <article>{post.content}</article>;
}
```

**Pros:**

- All pages pre-generated at build time
- Zero TTFB for subsequent requests
- No regeneration delay
- Scales to thousands of routes

**Cons:**

- Longer builds if many routes
- Fallback ISR needed for new content

**Best for:**

- Blog posts (generate top 100, on-demand fallback for rest)
- Product listings (generate popular products)
- Documentation (all stable pages)

### Scenario 4: Fallback ISR (Dynamic Routes)

**When to use:**

- Can't pre-generate all routes
- New content added frequently
- Want to handle unknown routes gracefully

**Implementation:**

```typescript
// app/blog/[slug]/page.tsx
export const dynamicParams = true; // Enable fallback

export async function generateStaticParams() {
  // Pre-generate top 50 popular posts
  return getPopularPosts(50);
}

export const revalidate = 600; // 10 minutes for unknown routes

export default async function BlogPostPage({ params }) {
  const { slug } = await params;
  const post = await getPost(slug);

  if (!post) {
    notFound(); // Returns 404, not cached
  }

  return <article>{post.content}</article>;
}
```

**Flow:**

1. Build time: Generate top 50 posts
2. User visits unknown post:
   - ISR regenerates on-demand (shows loading/old version)
   - Caches for 10 minutes
   - Next visitor sees instant version
3. 404s are never cached

**Pros:**

- Handles unlimited routes
- Fast for pre-generated routes
- Graceful fallback for unknowns

**Cons:**

- Unknown routes slow on first visit
- Not suitable for real-time requirements

**Best for:**

- Large blogs (1000+ posts)
- Tenant storefronts (100+ tenants)
- E-commerce product pages
- User-generated content

---

## ISR Gotchas & Fixes

### Gotcha 1: Multiple Fetch Revalidation Times

**Problem:**

```typescript
export const revalidate = 3600; // Page revalidates every hour

export default async function Page() {
  const data1 = await fetch('/api/data', { next: { revalidate: 60 } });
  const data2 = await fetch('/api/other', { next: { revalidate: 7200 } });
}
```

**Result:** Uses **lowest TTL** → regenerates every 60 seconds (not ideal!)

**Fix:** Use consistent revalidation times

```typescript
export const revalidate = 60; // Match the most frequent update

// Or use tags for fine-grained control:
const data1 = await fetch('/api/data', { next: { tags: ['frequently-changing'] } });
const data2 = await fetch('/api/other', { next: { tags: ['rarely-changing'] } });

// Revalidate separately:
revalidateTag('frequently-changing'); // Webhook 1
revalidateTag('rarely-changing'); // Webhook 2
```

### Gotcha 2: `revalidatePath()` is Too Broad

**Problem:**

```typescript
// In your webhook handler:
revalidatePath('/blog'); // Revalidates /blog, /blog/[slug], etc.
```

**Fix:** Use exact paths

```typescript
// Be specific:
revalidatePath(`/blog/${slug}`); // Just this post
revalidatePath('/blog'); // Just the listing

// Never do this:
revalidatePath('/blog/*'); // ❌ Doesn't work with rewrites
revalidatePath('/'); // ⚠️ Regenerates entire site!
```

### Gotcha 3: Mixing Route Patterns

**Problem:**

```typescript
// app/blog/page.tsx - caches HTML
export const revalidate = 3600;

// app/blog/[slug]/page.tsx - caches separately
export const revalidate = 86400;

// User updates a post → only invalidates /blog/[slug]
// /blog listing shows old links for hours
```

**Fix:** Coordinate revalidation

```typescript
// Webhook handler:
async function handlePostUpdate(post) {
  await revalidatePath(`/blog/${post.slug}`);
  await revalidatePath('/blog'); // Also invalidate listing
}
```

### Gotcha 4: Form Actions Don't Trigger Revalidation

**Problem:**

```typescript
'use server';
export async function submitForm(data) {
  const result = await saveToDB(data);
  revalidatePath('/form'); // ❌ Doesn't work for form pages!
}
```

**Fix:** Revalidate parent route

```typescript
'use server';
export async function submitForm(data) {
  const result = await saveToDB(data);
  revalidatePath('/(marketing)'); // Revalidate entire group
  redirect('/thank-you');
}
```

### Gotcha 5: 404s Are Never Cached

**This is actually good!** But be aware:

```typescript
export const revalidate = 3600;

export default async function Page({ params }) {
  const item = await getItem(params.id);

  if (!item) {
    notFound(); // ✅ Returns 404, not cached
  }

  return <div>{item.name}</div>;
}
```

If an item is deleted, users immediately get 404 (not cached for 1 hour).

---

## Recommended Revalidation Times

### Corporate/Marketing Site

| Page         | Pattern       | TTL     | Reasoning                             |
| ------------ | ------------- | ------- | ------------------------------------- |
| Home         | Time-based    | 60s     | Frequent A/B testing, metrics updates |
| About        | Time-based    | 3600s   | Occasional copy updates               |
| Blog listing | Time-based    | 3600s   | New posts infrequent                  |
| Blog post    | Static params | 86400s  | Content rarely changes                |
| Pricing      | Time-based    | 3600s   | Pricing changes announced in advance  |
| Contact      | Never         | N/A     | Form endpoints handle requests        |
| Legal        | Static/Never  | 604800s | Changes are rare and versioned        |
| Solutions    | On-demand     | 3600s   | CMS-driven, webhook triggers updates  |

### Multi-Tenant Storefront

| Page            | Pattern                | TTL   | Reasoning                                  |
| --------------- | ---------------------- | ----- | ------------------------------------------ |
| Tenant home     | Time-based + On-demand | 60s   | Users edit frequently, webhook invalidates |
| Tenant about    | Time-based + On-demand | 3600s | Edit less frequently                       |
| Tenant services | Time-based + On-demand | 3600s | Service list updates via webhook           |
| Booking page    | Dynamic                | Never | Real-time availability required            |
| Booking success | Dynamic                | Never | Personalized confirmation                  |

### Blog/CMS Site

| Page           | Pattern       | TTL    | Reasoning                     |
| -------------- | ------------- | ------ | ----------------------------- |
| Blog list      | Time-based    | 3600s  | New posts every few days      |
| Blog post      | Static params | 86400s | Posts don't change frequently |
| Category       | Static params | 3600s  | New posts in category         |
| Author page    | Time-based    | 86400s | Author bio changes rarely     |
| Search results | Never         | N/A    | Dynamic per query             |

---

## Performance Characteristics

### Build Time Impact

```
Time to build: 2-5 seconds per 100 routes

generateStaticParams() pre-generates at build time:
- 10 routes: ~0.5s
- 100 routes: ~5s
- 1000 routes: ~50s ❌ Too slow for CI/CD

Solution: Pre-generate popular routes, use fallback ISR for others
```

### Cache Invalidation Speed

```
Method              Speed           Reliability
─────────────────────────────────────────────
Time-based ISR      ~100ms          100% (automatic)
On-demand ISR       <10ms           99% (webhook dependent)
revalidatePath()    <10ms           95% (dev errors possible)
revalidateTag()     <10ms           95% (dev errors possible)
```

---

## Testing ISR Locally

```bash
# Development (no ISR, always fresh)
npm run dev

# Production simulation (ISR works here)
npm run build
npm run start

# Check ISR in production
NEXT_PRIVATE_DEBUG_CACHE=1 npm run start

# Make a change, test revalidation
# Visit page → wait → change content → revalidate → visit again
```

---

## Monitoring ISR in Production

### What to Monitor

1. **Regeneration latency:** How long does ISR take?
2. **Cache hit rate:** Percentage of requests served from cache
3. **Stale content incidents:** How often users see outdated data
4. **Webhook delivery:** Is revalidation webhook executing?

### With Vercel Analytics

```typescript
import { recordEvent } from '@vercel/analytics';

export async function revalidateBlogPost(slug: string) {
  'use server';

  const start = Date.now();
  await revalidatePath(`/blog/${slug}`);
  const duration = Date.now() - start;

  recordEvent({
    name: 'blog_post_revalidated',
    parameters: {
      slug,
      duration,
    },
  });
}
```

### Manual Webhook Testing

```bash
# Test revalidation endpoint
curl -X POST http://localhost:3000/api/revalidate/blog \
  -H "x-revalidate-secret: your-secret" \
  -H "Content-Type: application/json" \
  -d '{"slug":"test-post"}'

# Should return:
# { "revalidated": true, "now": 1703604000000 }
```

---

## Troubleshooting

### Issue: Pages Not Revalidating

**Check list:**

1. Is `export const revalidate` set correctly?
2. Did you run `npm run build` then `npm run start`? (Dev doesn't use ISR)
3. Is the TTL too high? (Try 60s for testing)
4. Check server logs for errors

**Debug:**

```bash
NEXT_PRIVATE_DEBUG_CACHE=1 npm run start
# Look for cache logs in console
```

### Issue: Build Takes Too Long

**Problem:** Too many routes in `generateStaticParams()`

**Solution:**

```typescript
export async function generateStaticParams() {
  // Only generate top 50, rest use fallback ISR
  return getPopularRoutes(50);
}

export const dynamicParams = true; // Enable fallback
```

### Issue: Webhook Not Firing

**Check:**

1. Is webhook URL correct in CMS?
2. Is `REVALIDATE_SECRET` environment variable set?
3. Check CMS logs for webhook delivery status
4. Add logging to webhook handler

```typescript
export async function POST(request: NextRequest) {
  console.log('Webhook received:', request.headers);

  const secret = request.headers.get('x-revalidate-secret');
  console.log('Secret match:', secret === process.env.REVALIDATE_SECRET);

  // ...
}
```

---

## Decision Matrix at a Glance

**Need immediate updates?** → On-demand ISR with webhook
**Content changes occasionally?** → Time-based ISR (1-24 hours)
**Can pre-generate all routes?** → Static params + fallback ISR
**Unknown or unlimited routes?** → On-demand ISR + fallback TTL
**Real-time content?** → Dynamic rendering (no caching)
