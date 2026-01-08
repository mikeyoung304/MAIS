---
title: Segment-First Service Browsing UX for Tenant Storefronts
category: patterns
tags:
  - storefront
  - customer-experience
  - navigation
  - url-state-management
  - browser-history
  - react-client-component
  - stock-photos
severity: medium
component: SegmentPackagesSection.tsx
symptoms:
  - flat-package-grid-confusing-customers
  - browser-back-button-dead-page
  - missing-service-category-organization
  - placeholder-images-unprofessional
date_solved: 2026-01-08
---

# Segment-First Service Browsing UX Pattern

## Problem Statement

Multi-segment tenant storefronts (like Little Bit Horse Farm with Corporate Wellness, Elopements, and Weekend Getaway segments) displayed a confusing flat grid of all packages. Customers couldn't easily understand the service categories or navigate between them.

**Symptoms:**

1. Flat package grid overwhelms customers with all packages at once
2. Browser back button went to "dead page" after selecting a segment
3. Package categories weren't explicit (customers had to infer from package names)
4. Missing images showed letter placeholders (C, E, W) instead of professional photos

## Root Cause Analysis

### Issue 1: Flat Grid UX

The original `TenantLandingPage.tsx` rendered all packages in a single grid sorted by tier, ignoring segment boundaries. For businesses with multiple service categories, this created cognitive overload.

### Issue 2: Browser Back Button "Dead Page"

Initial implementation used React `useState` without URL synchronization. When users clicked a segment, the state changed but the URL didn't. Pressing browser back navigated away from the page entirely instead of returning to segment selection.

### Issue 3: Missing Segment Images

The Segment model has a `heroImage` field, but many segments had no image set. Without a fallback system, segments displayed letter placeholders based on the first character of the segment name.

## Solution

### 1. Segment-First UX Pattern

Created `SegmentPackagesSection.tsx` - a client component that shows segments as clickable entry points:

```
Customer Journey:
┌─────────────────────────────────────────────────────────────┐
│  "What brings you here?"                                     │
│                                                              │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐       │
│  │ Corporate    │  │ Elopements   │  │ Weekend      │       │
│  │ Wellness     │  │              │  │ Getaway      │       │
│  │ From $299    │  │ From $499    │  │ From $199    │       │
│  │   Explore →  │  │   Explore →  │  │   Explore →  │       │
│  └──────────────┘  └──────────────┘  └──────────────┘       │
└─────────────────────────────────────────────────────────────┘
                           ↓ Click
┌─────────────────────────────────────────────────────────────┐
│  ← All Services                                              │
│                                                              │
│  "Corporate Wellness Retreats"                               │
│  "Transform your team with nature-based experiences"         │
│                                                              │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐       │
│  │ Half Day     │  │ Full Day     │  │ Multi-Day    │       │
│  │ $299         │  │ $499  ⭐     │  │ $899         │       │
│  │   Book →     │  │   Book →     │  │   Book →     │       │
│  └──────────────┘  └──────────────┘  └──────────────┘       │
└─────────────────────────────────────────────────────────────┘
```

### 2. URL Hash State for Browser History

**Critical Pattern:** URL must be the source of truth, not React state.

```typescript
// SegmentPackagesSection.tsx

const [selectedSegmentId, setSelectedSegmentId] = useState<string | null>(null);

// Sync with URL hash for browser back/forward support
useEffect(() => {
  // Read initial hash on mount
  const hash = window.location.hash.slice(1); // Remove #
  if (hash.startsWith('segment-')) {
    const slug = hash.replace('segment-', '');
    const segment = segments.find((s) => s.slug === slug);
    if (segment) {
      setSelectedSegmentId(segment.id);
    }
  }

  // Listen for hash changes (browser back/forward)
  const handleHashChange = () => {
    const newHash = window.location.hash.slice(1);
    if (newHash.startsWith('segment-')) {
      const slug = newHash.replace('segment-', '');
      const segment = segments.find((s) => s.slug === slug);
      if (segment) {
        setSelectedSegmentId(segment.id);
      }
    } else if (newHash === 'packages' || newHash === '') {
      setSelectedSegmentId(null);
    }
  };

  window.addEventListener('hashchange', handleHashChange);
  return () => window.removeEventListener('hashchange', handleHashChange);
}, [segments]);

// Handle segment selection - update URL FIRST, then state
const handleSelectSegment = useCallback(
  (segmentId: string) => {
    const segment = segments.find((s) => s.id === segmentId);
    if (segment) {
      // Push to history so browser back works
      window.history.pushState(null, '', `#segment-${segment.slug}`);
      setSelectedSegmentId(segmentId);
    }
  },
  [segments]
);

// Handle back to segments
const handleBack = useCallback(() => {
  // Push to history so browser forward works
  window.history.pushState(null, '', '#packages');
  setSelectedSegmentId(null);
}, []);
```

**URL States:**

- `#packages` or no hash → Segment selection view
- `#segment-{slug}` → Expanded segment with tier cards

### 3. Stock Photo Fallback System

Keyword-based matching for professional fallback images:

```typescript
const SEGMENT_STOCK_PHOTOS: Record<string, string> = {
  // Corporate / Business / Team
  corporate: 'https://images.unsplash.com/photo-1552664730-d307ca884978?w=800&q=80',
  wellness: 'https://images.unsplash.com/photo-1544367567-0f2fcb009e0b?w=800&q=80',
  team: 'https://images.unsplash.com/photo-1522071820081-009f0129c71c?w=800&q=80',
  retreat: 'https://images.unsplash.com/photo-1506126613408-eca07ce68773?w=800&q=80',

  // Wedding / Elopement
  elopement: 'https://images.unsplash.com/photo-1519741497674-611481863552?w=800&q=80',
  wedding: 'https://images.unsplash.com/photo-1465495976277-4387d4b0b4c6?w=800&q=80',

  // Weekend / Getaway / Experience
  weekend: 'https://images.unsplash.com/photo-1501785888041-af3ef285b470?w=800&q=80',
  farm: 'https://images.unsplash.com/photo-1500382017468-9049fed747ef?w=800&q=80',
  horse: 'https://images.unsplash.com/photo-1553284965-83fd3e82fa5a?w=800&q=80',

  // Default fallback
  default: 'https://images.unsplash.com/photo-1497366216548-37526070297c?w=800&q=80',
};

function getSegmentStockPhoto(segment: SegmentData): string {
  // Search segment name, slug, and description for keywords
  const searchText = `${segment.name} ${segment.slug} ${segment.description || ''}`.toLowerCase();

  // Check each keyword in priority order
  for (const [keyword, url] of Object.entries(SEGMENT_STOCK_PHOTOS)) {
    if (keyword !== 'default' && searchText.includes(keyword)) {
      return url;
    }
  }

  return SEGMENT_STOCK_PHOTOS.default;
}

// Usage: prioritize tenant image, fall back to stock photo
const imageUrl = segment.heroImage || getSegmentStockPhoto(segment);
```

## Why It Works

### URL Hash Pattern Benefits

1. **Browser history integration:** Back/forward buttons work naturally
2. **Shareable URLs:** `example.com/t/little-bit-farm#segment-corporate-wellness` links directly to a segment
3. **SEO-friendly:** Hash fragments don't affect server-side rendering
4. **No page reloads:** Client-side navigation is instant

### Two-Way Binding Critical Order

```
User clicks segment card:
  1. window.history.pushState() → URL updates
  2. setSelectedSegmentId() → React renders

Browser back button:
  1. URL hash changes (browser)
  2. hashchange event fires
  3. Handler reads hash → setSelectedSegmentId()
```

**Common Mistake:** Setting state before pushState causes the URL to lag behind the UI.

## Files Changed

| File                                                        | Change                                         |
| ----------------------------------------------------------- | ---------------------------------------------- |
| `apps/web/src/components/tenant/SegmentPackagesSection.tsx` | NEW (464 lines) - Main component               |
| `apps/web/src/components/tenant/TenantLandingPage.tsx`      | Replaced tier grid with SegmentPackagesSection |
| `apps/web/src/lib/tenant.ts`                                | Added SegmentData interface                    |
| `server/src/lib/prisma.ts`                                  | Fixed Prisma client import path                |

## Prevention Strategies

### 1. URL Hash State Pattern Checklist

- [ ] Read initial hash on component mount
- [ ] Add hashchange event listener with cleanup
- [ ] Call `pushState` BEFORE `setState` on user interaction
- [ ] Handle empty hash case (return to default view)
- [ ] Validate hash content before using (check segment exists)

### 2. Service Worker Cache Issues

During development, stale service worker cache caused old HTML to render instead of new component:

**Recovery Steps:**

```bash
# Clear Next.js caches
rm -rf .next .turbo node_modules/.cache

# In browser DevTools Console:
# Unregister service workers
const regs = await navigator.serviceWorker.getRegistrations();
for (const reg of regs) await reg.unregister();

# Clear browser caches
const keys = await caches.keys();
for (const key of keys) await caches.delete(key);

# Restart dev server
npm run dev
```

### 3. Stock Photo Best Practices

- Use Next.js `<Image>` component for optimization (currently using `<img>` - see todo #649)
- Add `images.unsplash.com` to `next.config.js` remote patterns
- Include `alt` text for accessibility
- Consider `loading="lazy"` for below-fold images

## Testing Checklist

- [ ] Click segment → URL changes to `#segment-{slug}`
- [ ] Browser back → Returns to segment selection, URL changes to `#packages`
- [ ] Browser forward → Returns to selected segment
- [ ] Direct URL navigation → Correct segment pre-selected
- [ ] Single-segment tenant → Skip segment selection, show tiers directly
- [ ] No packages → Show "Services coming soon" empty state
- [ ] Stock photos → Display correctly based on segment keywords

## Related Documentation

- [ADR-014: Next.js App Router Migration](../../adrs/ADR-014-nextjs-app-router-migration.md)
- [Brand Voice Guide](../../design/BRAND_VOICE_GUIDE.md)
- [Build Mode Storefront Editor Patterns](build-mode-storefront-editor-patterns-MAIS-20260105.md)
- [Next.js Client Navigation Hydration Anti-Patterns](../code-review-patterns/nextjs-client-navigation-hydration-anti-patterns-MAIS-20260106.md)

## Code Review Findings

This implementation was reviewed and has 14 findings tracked in todos/:

- **P1 (5):** Type duplication, DRY violations, accessibility gaps, image optimization
- **P2 (6):** Performance optimization, agent parity, reduced motion, empty states
- **P3 (3):** Component decomposition, minor accessibility, config centralization

See `todos/645-658-pending-*.md` for details.
