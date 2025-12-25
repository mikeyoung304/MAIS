---
status: ready
priority: p1
issue_id: "364"
tags: [code-review, performance, nextjs]
dependencies: []
---

# Images Not Using Next.js Image Component

## Problem Statement

TenantLandingPage and DateBookingWizard use raw `<img>` tags instead of Next.js `<Image>` component. This bypasses automatic optimization.

**Why it matters:** 50-150 KB+ wasted bandwidth per page, poor LCP scores, layout shifts (CLS).

## Findings

**File:** `apps/web/src/app/t/[slug]/TenantLandingPage.tsx`

| Line | Issue |
|------|-------|
| 80 | `<img src={pkg.photoUrl} />` (Package photo) |
| 227 | `<img src={landingConfig.about.imageUrl} />` (About section) |
| 265 | `<img src={testimonial.imageUrl} />` (Testimonials) |
| 299 | `<img src={image.url} />` (Gallery - 4+ images) |
| 381 | `<img src={tenant.branding.logoUrl} />` (Footer logo) |

**File:** `apps/web/src/components/booking/DateBookingWizard.tsx`
| Line | Issue |
|------|-------|
| 80 | `<img src={pkg.photoUrl} />` |

**next.config.js already configured:**
- Supabase and Unsplash remotePatterns are set up
- Component just ignores `next/image`

**Impact:** P1 - Poor Core Web Vitals, 50-150 KB wasted per load

## Proposed Solutions

### Option 1: Replace with Next.js Image Component (Required)
- **Description:** Change `<img>` to `<Image>` from next/image
- **Pros:** Automatic WebP, lazy loading, responsive sizing
- **Cons:** Requires specifying width/height or fill
- **Effort:** Small (1 hour)
- **Risk:** Low

**Example Fix:**
```typescript
import Image from 'next/image';

// Before
<img src={pkg.photoUrl} className="w-full h-full object-cover" />

// After
<Image
  src={pkg.photoUrl || '/placeholder-image.jpg'}
  alt={pkg.title}
  fill
  className="object-cover"
  sizes="(max-width: 768px) 100vw, 50vw"
/>
```

## Recommended Action

**FIX NOW** - Replace all `<img>` tags with Next.js `<Image>` component. This is a significant performance improvement and follows Next.js best practices. The next.config.js already has remotePatterns configured.

## Technical Details

**Files to Modify:**
- `apps/web/src/app/t/[slug]/TenantLandingPage.tsx` (5 instances)
- `apps/web/src/components/booking/DateBookingWizard.tsx` (1 instance)

**Note:** Images need width/height or fill prop. Use fill for responsive containers.

## Acceptance Criteria

- [ ] All `<img>` tags replaced with `<Image>`
- [ ] Images lazy load properly
- [ ] No layout shift on image load
- [ ] Images serve in WebP format
- [ ] LCP improved (measure before/after)

## Work Log

| Date | Action | Learnings |
|------|--------|-----------|
| 2025-12-25 | Created during code review | Performance issue found |

## Resources

- Next.js Image: https://nextjs.org/docs/app/api-reference/components/image
