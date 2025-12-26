---
status: complete
priority: p1
issue_id: "406"
tags:
  - code-review
  - performance
  - next-js
  - locked-template-system
dependencies: []
---

# HeroSection Bypasses Next.js Image Optimization

## Problem Statement

The HeroSection component uses inline CSS `backgroundImage` for hero images, completely bypassing Next.js Image optimization. This significantly impacts Largest Contentful Paint (LCP) for tenant storefronts.

**Why This Matters:**
- No automatic WebP/AVIF conversion (larger file sizes)
- No responsive image sizing (wastes bandwidth)
- No lazy loading optimization
- Full-resolution images loaded regardless of viewport
- Direct impact on Core Web Vitals and SEO

## Findings

**Location:** `apps/web/src/components/tenant/sections/HeroSection.tsx` (lines 28-37)

**Evidence:**
```typescript
style={
  hasBackground
    ? {
        backgroundImage: `linear-gradient(rgba(0,0,0,0.4), rgba(0,0,0,0.4)), url(${backgroundImageUrl})`,
        backgroundSize: 'cover',
        backgroundPosition: 'center',
      }
    : undefined
}
```

**Impact:**
- Hero images are typically the LCP element
- Unoptimized hero images can add 500ms+ to page load
- Tenant storefront performance directly affects conversions

**Agent:** Performance Oracle

## Proposed Solutions

### Solution 1: Use Next.js Image with CSS Overlay (Recommended)

Replace inline background with Next.js Image component + absolute positioned overlay.

```tsx
<section className="relative py-32 md:py-40 overflow-hidden">
  {hasBackground && (
    <>
      <Image
        src={backgroundImageUrl!}
        alt=""
        fill
        priority
        className="object-cover"
        sizes="100vw"
      />
      <div className="absolute inset-0 bg-black/40" />
    </>
  )}
  <div className="relative z-10 mx-auto max-w-4xl px-6 text-center">
    {/* Content */}
  </div>
</section>
```

**Pros:**
- Full Next.js image optimization (WebP, responsive, lazy)
- Gradient overlay via CSS instead of inline
- `priority` prop ensures LCP optimization
- Major performance improvement

**Cons:**
- Slightly more complex markup
- May need layout adjustments

**Effort:** Small
**Risk:** Low (CSS-only visual change)

### Solution 2: Use `next/image` with blurDataURL

Add blur placeholder for perceived performance.

**Pros:**
- Better perceived loading experience
- All benefits of Solution 1

**Cons:**
- Requires generating blur placeholders
- Additional complexity

**Effort:** Medium
**Risk:** Low

## Recommended Action

**APPROVED**: Solution 1 - Use Next.js Image with CSS overlay for gradient.

## Technical Details

**Affected Files:**
- `apps/web/src/components/tenant/sections/HeroSection.tsx`

**Database Changes:** None

## Acceptance Criteria

- [ ] Hero background uses Next.js `Image` component with `fill`
- [ ] `priority` prop added for above-the-fold loading
- [ ] `sizes="100vw"` for proper responsive sizing
- [ ] Gradient overlay rendered via CSS, not inline style
- [ ] Visual output matches current design
- [ ] Lighthouse LCP score improves or stays same
- [ ] TypeScript passes (`npm run typecheck`)

## Work Log

| Date | Action | Learnings |
|------|--------|-----------|
| 2025-12-25 | Created from code review | Performance analysis identified LCP impact |

## Resources

- Next.js Image docs: https://nextjs.org/docs/app/api-reference/components/image
- Pattern: `apps/web/src/components/tenant/sections/TextSection.tsx` (uses Image correctly)
