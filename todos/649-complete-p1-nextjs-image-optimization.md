---
status: complete
priority: p1
issue_id: 649
tags: [code-review, performance, nextjs, images, lcp]
dependencies: []
---

# External Images Without Next.js Image Optimization

## Problem Statement

The component uses native `<img>` tag with external Unsplash URLs instead of Next.js `<Image>`. This causes significant performance issues affecting Core Web Vitals.

**Why it matters:**

- No lazy loading (all images load immediately, even below the fold)
- No blur placeholder (causes layout shift - CLS)
- No automatic format optimization (WebP/AVIF)
- No responsive srcset generation
- Bypasses Next.js image optimization proxy

## Findings

**Location:** `/Users/mikeyoung/CODING/MAIS/apps/web/src/components/tenant/SegmentPackagesSection.tsx`

- Lines 121-126 (img tag usage)
- Lines 28-62 (Unsplash URLs)

**Current code:**

```tsx
{
  /* eslint-disable-next-line @next/next/no-img-element */
}
<img
  src={imageUrl}
  alt={segment.name}
  className="absolute inset-0 h-full w-full object-cover transition-transform duration-700 group-hover:scale-105"
/>;
```

**Issues:**

1. ESLint warning is suppressed rather than fixing the root cause
2. Images can be 800px wide from Unsplash (unnecessary for small cards)
3. No lazy loading on below-fold segment cards
4. No blur placeholder during load

**Source:** performance-oracle agent, security-sentinel agent

## Proposed Solutions

### Option 1: Use Next.js Image Component (Recommended)

Replace `<img>` with Next.js `<Image>`:

```tsx
import Image from 'next/image';

<Image
  src={imageUrl}
  alt={segment.name}
  fill
  sizes="(max-width: 768px) 100vw, 33vw"
  loading="lazy"
  placeholder="blur"
  blurDataURL="data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iODAwIiBoZWlnaHQ9IjUwMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iMTAwJSIgaGVpZ2h0PSIxMDAlIiBmaWxsPSIjMjEyMTIxIi8+PC9zdmc+"
  className="object-cover transition-transform duration-700 group-hover:scale-105"
/>;
```

Also add to `next.config.js`:

```js
images: {
  remotePatterns: [{ protocol: 'https', hostname: 'images.unsplash.com' }];
}
```

**Pros:**

- Automatic format optimization (WebP/AVIF)
- Responsive srcset generation
- Lazy loading by default
- Blur placeholder
- Better LCP and CLS scores

**Cons:**

- Need to configure remote patterns
- Slight increase in complexity

**Effort:** Medium (20 min)
**Risk:** Low

### Option 2: Keep img but Add Loading Attributes

Minimal change - add loading="lazy" and explicit dimensions:

```tsx
<img
  src={imageUrl}
  alt={segment.name}
  loading="lazy"
  decoding="async"
  width={800}
  height={500}
  className="..."
/>
```

**Pros:**

- Minimal change
- Some performance benefit

**Cons:**

- No format optimization
- No blur placeholder
- Still downloading full-size images

**Effort:** Small (5 min)
**Risk:** Low

## Recommended Action

Option 1 - Use Next.js Image component

## Technical Details

**Affected files:**

- `apps/web/src/components/tenant/SegmentPackagesSection.tsx`
- `apps/web/next.config.js` (add remote patterns)

**Next.js config addition:**

```js
// next.config.js
module.exports = {
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'images.unsplash.com',
      },
    ],
  },
};
```

## Acceptance Criteria

- [ ] Native `<img>` replaced with Next.js `<Image>`
- [ ] Unsplash domain added to next.config.js remote patterns
- [ ] Images lazy load below the fold
- [ ] Blur placeholder shows during load
- [ ] ESLint warning removed (not suppressed)
- [ ] Visual appearance unchanged

## Work Log

| Date       | Action                   | Learnings                                  |
| ---------- | ------------------------ | ------------------------------------------ |
| 2026-01-08 | Created from code review | Next.js Image critical for Core Web Vitals |

## Resources

- Next.js Image: https://nextjs.org/docs/app/api-reference/components/image
- Code review: Segment-first browsing implementation
