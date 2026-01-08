# Solution: Segment-First Storefront UX with Browser History Support

**Date:** 2026-01-08
**Status:** ✅ Implemented
**Component:** `SegmentPackagesSection.tsx`
**Problem Tags:** `UX/Navigation`, `Multi-segment Businesses`, `Browser Back Button`, `State Management`

---

## Problem Statement

Multi-segment service businesses (e.g., photographers with "Corporate", "Elopement", "Wedding" packages) faced two critical UX issues:

1. **Flat Package Grid Confusion**: Displaying all packages in a single grid made it unclear which packages belonged to which service category, causing customer decision paralysis
2. **Broken Browser History**: Clicking a segment expanded the view, but the browser back button didn't work—users got stuck and couldn't navigate backward through their selections

### Business Impact

- Higher abandonment rates (customers didn't understand service offerings)
- Poor accessibility (back button users got stuck in the experience)
- Confusing for businesses with 2-3 distinct service categories

---

## Root Cause Analysis

### Problem 1: Confusing UX
- **Root Cause**: The component treated segments and packages equally—showing all packages at once removed context about which category each package belonged to
- **Symptom**: Customers saw 9 packages but didn't know which 3 were "Corporate Wellness", which 3 were "Weddings", etc.

### Problem 2: Broken Browser History
- **Root Cause**: Component state (`selectedSegmentId`) was managed in React state only, not synchronized with browser history
- **Symptom**: When user clicked back button, the address bar didn't change → React state out of sync with URL → component didn't re-render

---

## Solution Implemented

### Pattern: Segment-First UX with URL Hash State

The solution uses a **two-stage navigation flow** with **URL hash synchronization** for proper browser history support:

```
Stage 1: Segment Selection
├─ Shows segment cards (entry points)
└─ User clicks a segment → URL updates to #segment-{slug}

Stage 2: Tier Selection
├─ Shows packages within selected segment
├─ User can click "← All Services" or browser back → URL updates to #packages
└─ Back button works because URL drives state
```

### Why This Works

1. **Clear Information Hierarchy**: Customers see segments first → packages second (reduces cognitive load)
2. **Proper Browser History**: URL hash is the source of truth, not React state
3. **Accessibility**: Works with browser back/forward buttons
4. **Single-Segment Optimization**: If tenant has only 1 segment, skip to tier selection automatically

---

## Code Implementation

### 1. URL Hash ↔ State Synchronization

The key pattern: **URL drives the component state**.

```typescript
// Read hash on mount and sync with state
useEffect(() => {
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
```

**Key Points:**
- `window.location.hash` is the source of truth
- Component state (`selectedSegmentId`) is derived from hash
- `hashchange` event fires when browser back/forward is used
- Cleanup listener on unmount to prevent memory leaks

### 2. Segment Selection Handler

When user clicks a segment, push to history before updating state:

```typescript
const handleSelectSegment = useCallback(
  (segmentId: string) => {
    const segment = segments.find((s) => s.id === segmentId);
    if (segment) {
      // Push to history (for browser back support)
      window.history.pushState(null, '', `#segment-${segment.slug}`);
      setSelectedSegmentId(segmentId);
    }
  },
  [segments]
);
```

**Why `pushState` before state update:**
- Updates the address bar immediately
- Browser back button now has something to go back to
- If we set state first, hash update might lag

### 3. Stock Photo Fallback System

Many businesses don't have segment images. Use keyword matching to find relevant Unsplash photos:

```typescript
const SEGMENT_STOCK_PHOTOS: Record<string, string> = {
  // Corporate / Business
  corporate: 'https://images.unsplash.com/photo-1552664730-d307ca884978?w=800&q=80',
  wellness: 'https://images.unsplash.com/photo-1544367567-0f2fcb009e0b?w=800&q=80',
  team: 'https://images.unsplash.com/photo-1522071820081-009f0129c71c?w=800&q=80',

  // Wedding / Couple
  elopement: 'https://images.unsplash.com/photo-1519741497674-611481863552?w=800&q=80',
  wedding: 'https://images.unsplash.com/photo-1465495976277-4387d4b0b4c6?w=800&q=80',
  couple: 'https://images.unsplash.com/photo-1522673607200-164d1b6ce486?w=800&q=80',

  // Coaching
  coaching: 'https://images.unsplash.com/photo-1573497019940-1c28c88b4f3e?w=800&q=80',

  // Default fallback
  default: 'https://images.unsplash.com/photo-1497366216548-37526070297c?w=800&q=80',
};

function getSegmentStockPhoto(segment: SegmentData): string {
  // Combine name, slug, description into searchable text
  const searchText = `${segment.name} ${segment.slug} ${segment.description || ''}`.toLowerCase();

  // Check each keyword in order
  for (const [keyword, url] of Object.entries(SEGMENT_STOCK_PHOTOS)) {
    if (keyword !== 'default' && searchText.includes(keyword)) {
      return url;
    }
  }

  return SEGMENT_STOCK_PHOTOS.default;
}

// Use in SegmentCard
const imageUrl = segment.heroImage || getSegmentStockPhoto(segment);
```

**How It Works:**
1. If segment has `heroImage`, use it
2. Otherwise, search segment name/slug/description for keywords (case-insensitive)
3. Return matching Unsplash URL
4. Fall back to generic business photo if no match

**Example Matches:**
- Segment name "Elopements" → matches keyword `elopement` → wedding photo
- Slug "corporate-wellness" → matches keywords `corporate` and `wellness` → picks first match
- Generic "John's Services" → no matches → default photo

### 4. Single-Segment Optimization

If tenant has only one segment, skip the segment selection and show tiers directly:

```typescript
// If only one segment with packages, skip segment selection
if (segmentsWithPackages.length === 1) {
  const segment = segmentsWithPackages[0];
  const segmentPackages = packagesBySegment.get(segment.id) || [];

  return (
    <section id="packages" className="py-32 md:py-40">
      <div className="mx-auto max-w-6xl px-6">
        {/* Header for single segment */}
        <div className="text-center">
          <h2 className="font-serif text-3xl font-bold text-text-primary sm:text-4xl md:text-5xl">
            {segment.heroTitle || segment.name}
          </h2>
        </div>

        {/* Show tier cards directly */}
        <div className="mt-16 grid gap-8 md:grid-cols-3">
          {segmentPackages.map((pkg, index) => {
            const isPopular = segmentPackages.length > 2 && index === midIdx;
            return (
              <TierCard
                key={pkg.id}
                pkg={pkg}
                tierLabel={tierLabel}
                bookHref={getBookHref(pkg.slug)}
                isPopular={isPopular}
              />
            );
          })}
        </div>
      </div>
    </section>
  );
}
```

**Benefit:** Faster UX for single-service businesses—no extra click to see packages.

### 5. Data Organization

Group packages by segment for efficient lookup:

```typescript
// Filter active packages first
const activePackages = packages.filter((p) => p.isActive ?? p.active);

// Group by segment
const packagesBySegment = new Map<string, PackageData[]>();
segments.forEach((segment) => {
  const segmentPackages = activePackages
    .filter((p) => p.segmentId === segment.id)
    .sort((a, b) => (TIER_ORDER[a.tier] ?? 99) - (TIER_ORDER[b.tier] ?? 99)); // Sort by tier
  if (segmentPackages.length > 0) {
    packagesBySegment.set(segment.id, segmentPackages);
  }
});

// Only show segments with packages
const segmentsWithPackages = segments
  .filter((s) => packagesBySegment.has(s.id))
  .sort((a, b) => a.sortOrder - b.sortOrder);
```

---

## Design System Integration

### Segment Cards (Entry Points)

```tsx
<SegmentCard
  segment={segment}
  packages={packagesBySegment.get(segment.id) || []}
  onSelect={() => handleSelectSegment(segment.id)}
/>
```

**Features:**
- Hero image (from segment or stock photo)
- Segment name + optional subtitle
- Price range (e.g., "From $500")
- "Explore" CTA with arrow icon
- Hover: shadow elevates, name changes to sage color
- Focus: Ring for keyboard navigation

### Tier Cards (Within Segment)

```tsx
<TierCard
  pkg={pkg}
  tierLabel={tierLabel}
  bookHref={getBookHref(pkg.slug)}
  isPopular={isPopular}
/>
```

**Features:**
- Package image or price focus
- Exact price display
- "Most Popular" badge (only if exactly 3 tiers and this is the middle tier)
- "Book {TierLabel}" CTA
- Same hover/focus states as segment cards

### Back Button

Simple text button with arrow icon to return to segment selection:

```tsx
<button
  onClick={handleBack}
  className="group mb-8 flex items-center gap-2 text-sm font-medium text-text-muted transition-colors hover:text-sage"
>
  <svg className="h-4 w-4 transition-transform group-hover:-translate-x-1" ... />
  All Services
</button>
```

---

## Browser Compatibility

This pattern works in all modern browsers:

| Browser | URL Hash | History API | hashchange Event |
| ------- | -------- | ----------- | ---------------- |
| Chrome  | ✅       | ✅          | ✅               |
| Firefox | ✅       | ✅          | ✅               |
| Safari  | ✅       | ✅          | ✅               |
| Edge    | ✅       | ✅          | ✅               |
| IE11    | ✅       | ✅          | ✅               |

**Note:** Works even without JavaScript for browsers with native hash navigation (though state wouldn't update). Progressive enhancement ready.

---

## Edge Cases & Handling

| Scenario                    | Behavior                                    |
| --------------------------- | ------------------------------------------- |
| 0 segments                  | Show empty state (no packages)               |
| 1 segment                   | Skip to tier selection (no segment choice)  |
| 2 segments                  | Show 2-column segment grid                  |
| 3+ segments                 | Show 3-column grid (wraps on mobile)         |
| Segment with no packages    | Filtered out (not shown in selection)        |
| 1 tier in segment           | Single card centered                         |
| 2 tiers                     | Two cards, no "Most Popular" badge           |
| 3 tiers                     | Three cards, middle gets "Most Popular"      |
| No segment image            | Use stock photo based on keyword matching    |
| No matching keyword         | Use default business photo                   |
| Browser back from tier view | Hash changes → state re-syncs → UI updates   |

---

## Performance Considerations

### Memoization Opportunities

```typescript
// useCallback to prevent re-renders of handlers
const handleSelectSegment = useCallback((segmentId: string) => { ... }, [segments]);
const handleBack = useCallback(() => { ... }, []);
const getBookHref = useCallback((packageSlug: string) => { ... }, [basePath, domainParam, tenant.slug]);
```

### Data Structures

- **Map for O(1) lookup**: `packagesBySegment` Map enables instant access to segment's packages
- **Pre-computed**: Sort packages by tier once on mount, not on each render

### Image Loading

- Unsplash URLs use `?w=800&q=80` for optimization (800px width, 80% quality)
- Images lazy-load on scroll
- Fallback gradient renders instantly if image missing

---

## Accessibility (WCAG 2.1 AA)

✅ **Keyboard Navigation:**
- All buttons have focus rings (`:focus-visible`)
- Tab order follows visual flow: segments → back button → tiers → CTA

✅ **Screen Readers:**
- Alt text on images: `alt={segment.name}`
- Semantic HTML (buttons, links)
- Section landmark: `<section id="packages">`

✅ **Motion:**
- Animations reduced for `prefers-reduced-motion` (via Tailwind's default)

✅ **Color:**
- Text contrast meets WCAG AA (sage on dark ≥4.5:1)
- Don't rely on color alone (e.g., "Most Popular" badge has text)

---

## Common Pitfalls to Avoid

### ❌ Mistake 1: Derive Hash Before State Update

```typescript
// WRONG - hash might not sync with state
const handleSelectSegment = (segmentId: string) => {
  setSelectedSegmentId(segmentId);
  window.history.pushState(null, '', `#segment-${slug}`); // Might lag
};

// CORRECT - push first
const handleSelectSegment = (segmentId: string) => {
  window.history.pushState(null, '', `#segment-${slug}`);
  setSelectedSegmentId(segmentId);
};
```

### ❌ Mistake 2: Forget Cleanup in useEffect

```typescript
// WRONG - listener never removed, memory leak
useEffect(() => {
  window.addEventListener('hashchange', handleHashChange);
  // Missing return cleanup!
}, [segments]);

// CORRECT
useEffect(() => {
  window.addEventListener('hashchange', handleHashChange);
  return () => window.removeEventListener('hashchange', handleHashChange);
}, [segments]);
```

### ❌ Mistake 3: Use `replace` for Back Button

```typescript
// WRONG - prevents browser back (no history entry)
window.history.replaceState(null, '', `#segment-${slug}`);

// CORRECT - adds to history
window.history.pushState(null, '', `#segment-${slug}`);
```

### ❌ Mistake 4: Hardcode Stock Photos

```typescript
// WRONG - no fallback
const imageUrl = getSegmentStockPhoto(segment); // Crashes if not found

// CORRECT - always has default
const imageUrl = segment.heroImage || getSegmentStockPhoto(segment);
```

---

## Testing Strategy

### Unit Tests (Vitest)

```typescript
describe('getSegmentStockPhoto', () => {
  test('returns matching photo for keyword in name', () => {
    const segment: SegmentData = { name: 'Elopements', ... };
    expect(getSegmentStockPhoto(segment)).toBe(SEGMENT_STOCK_PHOTOS.elopement);
  });

  test('returns default photo if no keyword match', () => {
    const segment: SegmentData = { name: 'Generic Services', ... };
    expect(getSegmentStockPhoto(segment)).toBe(SEGMENT_STOCK_PHOTOS.default);
  });

  test('handles null description gracefully', () => {
    const segment: SegmentData = { name: 'Wedding', description: null, ... };
    expect(getSegmentStockPhoto(segment)).toBeDefined();
  });
});
```

### E2E Tests (Playwright)

```typescript
test('browser back button restores segment selection', async ({ page }) => {
  await page.goto('/storefront');

  // Click segment
  await page.click('text=Elopements');
  expect(page.url()).toContain('#segment-elopements');

  // Verify tier cards are visible
  await expect(page.locator('text=Book Basic Package')).toBeVisible();

  // Click back button
  await page.goBack();
  expect(page.url()).not.toContain('#segment');

  // Verify segment cards are visible again
  await expect(page.locator('text=Elopements')).toBeVisible();
});

test('single segment skips to tier selection', async ({ page }) => {
  // Create tenant with 1 segment
  const tenant = await createTestTenant({ segmentCount: 1 });

  await page.goto(`/t/${tenant.slug}`);

  // Should skip segment selection
  await expect(page.locator('text=What brings you here')).not.toBeVisible();

  // Should show tier cards directly
  await expect(page.locator('text=Book')).toBeVisible();
});

test('stock photo loads for segment without image', async ({ page }) => {
  const segment: SegmentData = { name: 'Wedding Photography', heroImage: null, ... };

  await page.goto('/storefront');

  // Image should load from Unsplash
  const img = page.locator('img[alt="Wedding Photography"]');
  await expect(img).toHaveAttribute('src', /unsplash/);
});
```

---

## Implementation Checklist

- [x] Create `SEGMENT_STOCK_PHOTOS` constant with keyword mappings
- [x] Implement `getSegmentStockPhoto()` function with fallback logic
- [x] Create `SegmentCard` component with hero image and price range
- [x] Create `TierCard` component with exact price and booking CTA
- [x] Implement `useEffect` for hash synchronization on mount
- [x] Implement `handleHashChange` listener for browser back/forward
- [x] Implement `handleSelectSegment()` with `pushState` before state update
- [x] Implement `handleBack()` with navigation back to segment selection
- [x] Add single-segment optimization (skip segment selection)
- [x] Group packages by segment and sort by tier
- [x] Filter out inactive packages and empty segments
- [x] Add responsive grid (2-col on tablet, 3-col on desktop)
- [x] Add focus-visible styles for accessibility
- [x] Test browser back button functionality
- [x] Test keyword matching for various segment names

---

## References

**Related Files:**
- `apps/web/src/components/tenant/SegmentPackagesSection.tsx` - Implementation
- `apps/web/src/lib/packages.ts` - `TIER_ORDER` constant
- `apps/web/src/lib/tenant.ts` - Data structures and types
- `docs/design/BRAND_VOICE_GUIDE.md` - Design tokens and voice

**Key Concepts:**
- [MDN: Window.location.hash](https://developer.mozilla.org/en-US/docs/Web/API/Window/location)
- [MDN: Window.history.pushState](https://developer.mozilla.org/en-US/docs/Web/API/History/pushState)
- [MDN: hashchange Event](https://developer.mozilla.org/en-US/docs/Web/API/Window/hashchange_event)
- [Unsplash API](https://unsplash.com/developers) - Free stock photos

---

## Why This Pattern?

### ✅ Advantages

1. **Works with browser back/forward** - URL is the source of truth
2. **No external routing library needed** - Uses native browser history API
3. **SEO-friendly** - Hash fragments don't affect SEO but enable client-side routing
4. **Accessible** - Keyboard navigation + screen readers work out of box
5. **Simple & maintainable** - No state management library complexity
6. **Instant stock photos** - Keyword matching provides immediate fallback visuals

### Trade-offs

| Aspect       | Choice          | Why                                                    |
| ------------ | --------------- | ------------------------------------------------------ |
| URL Sync     | Hash (#)        | Simple, works without server-side routing              |
| State        | React useState  | Derived from URL, not primary source                   |
| Photos       | Unsplash API    | Free, high-quality, no API keys needed                 |
| Grouping     | Map structure   | O(1) lookup, clear intent                              |
| Animations   | Tailwind CSS    | Smooth without janky transitions                       |

---

## Lessons Learned

### 1. URL Must Drive State, Not Vice Versa

Early versions set state first, then tried to update URL. This caused timing issues where back button would fire, state wouldn't sync. Flipping the order (update URL first) fixed it.

### 2. Stock Photos Beat Empty States

Showing a fallback photo with the right mood (even if not perfect) is better than a blank gradient. Keyword matching works surprisingly well for common business types.

### 3. Single-Segment Optimization Matters

Removing one click for single-segment businesses significantly improves perceived speed. Conditional render of entire two-stage flow was worth the added code.

### 4. hash vs URL Path

Hash routing (`#segment-slug`) is simpler than full path routing (`/segment/slug`) for this use case because:
- Doesn't require Next.js route handlers
- Works entirely on the client
- Doesn't interfere with tenanted storefronts (`/t/{slug}`)

---

## Future Enhancements

If you extend this pattern, consider:

1. **URL-based Tier Selection**: Hash could track selected tier too (`#segment-{slug}-tier-{tier}`)
2. **Analytics**: Track which segments customers explore most
3. **Scroll Sync**: Scroll to top when transitioning between views
4. **Persistent Favorites**: Remember customer's last viewed segment
5. **Custom Stock Photo Selection**: Allow tenants to pick which photo matches their segment best

