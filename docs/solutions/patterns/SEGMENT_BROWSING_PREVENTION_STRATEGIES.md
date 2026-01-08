# Segment-First Service Browsing Prevention Strategies

**Date:** 2026-01-08
**Severity:** P2 (UX: navigation, caching, image fallbacks)
**Category:** Frontend Patterns / SPA Navigation / Image Optimization
**Commits:** Feature implementation for SegmentPackagesSection with URL hash state and stock photo fallbacks

## Overview

This document captures prevention strategies and best practices for the **Segment-First Service Browsing** pattern implemented in `apps/web/src/components/tenant/SegmentPackagesSection.tsx`.

The feature allows customers to:
1. Browse services organized by segment (e.g., "Family Photos", "Weddings", "Engagements")
2. Click a segment to expand and view tiers/pricing within that segment
3. Use browser back/forward to navigate between segment views
4. See professional stock photos as fallback when tenants haven't uploaded hero images

During implementation, three categories of issues emerged:

1. **Service Worker Caching** - Old HTML cached, showing stale letter placeholders instead of new stock photos
2. **URL Hash Navigation** - Browser back button initially went to "dead page" before hash sync was added
3. **Prisma Import Paths** - Database client import path was wrong (`../../generated` vs `../generated`)

This document provides **prevention strategies, checklists, and test cases** to avoid these issues in future work.

---

## Category 1: URL Hash State Pattern

### Problem Summary

SPA-like navigation in Next.js needs proper state synchronization with browser history:

- **Dead page issue:** Clicking back returned to a state that wasn't rendered (segment selected but not displayed)
- **Lost state on refresh:** Customer selected a segment, refreshed page → state was lost
- **Back button confusion:** Back didn't restore the previous UI state, only the URL hash

### Root Causes

1. **One-way state binding:** React state (`selectedSegmentId`) didn't sync with URL hash
2. **Missing hash listener:** Component didn't listen for `hashchange` events (external back/forward)
3. **Partial implementation:** `window.history.pushState()` was called but not coupled to React state
4. **No initial hash read:** On mount, component ignored existing hash in URL

### Prevention Strategy

#### Pattern 1: Two-Way Hash Synchronization

**DO:** Implement bidirectional sync between React state and URL hash.

```typescript
// ✅ CORRECT - Two-way sync
export function SegmentPackagesSection({ data }: Props) {
  const [selectedSegmentId, setSelectedSegmentId] = useState<string | null>(null);

  // 1. Read initial hash on mount
  useEffect(() => {
    const hash = window.location.hash.slice(1);
    if (hash.startsWith('segment-')) {
      const slug = hash.replace('segment-', '');
      const segment = segments.find((s) => s.slug === slug);
      if (segment) {
        setSelectedSegmentId(segment.id);
      }
    }
  }, []); // Run once on mount

  // 2. Listen for external hash changes (browser back/forward)
  useEffect(() => {
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
  }, [segments]); // Listen while segments available

  // 3. Push to history when user selects via click
  const handleSelectSegment = useCallback((segmentId: string) => {
    const segment = segments.find((s) => s.id === segmentId);
    if (segment) {
      // Push BEFORE state update to ensure history is in sync
      window.history.pushState(null, '', `#segment-${segment.slug}`);
      setSelectedSegmentId(segmentId);
    }
  }, [segments]);

  // 4. Back button also updates history
  const handleBack = useCallback(() => {
    window.history.pushState(null, '', '#packages');
    setSelectedSegmentId(null);
  }, []);

  // ... rest of component
}
```

**Key Points:**

- **Two `useEffect` hooks:** One reads initial hash (mount), one listens for changes (hashchange)
- **Both depend on `segments`:** Ensures we can look up segments by slug
- **Push BEFORE setState:** History should match DOM state
- **Clean up listeners:** Return cleanup function from useEffect

#### Pattern 2: Hash Format Design

Choose a consistent hash format early:

```typescript
// ✅ GOOD - Explicit prefix, clear semantics
#segment-wedding-photography    // Clearly identifies a segment by slug
#packages                         // Back to package list

// ⚠️ AVOID - Ambiguous
#wedding                          // Could be segment or package?
#1234                             // ID not slug - breaks on data changes
#view=segment&id=abc              // Over-complex for this use case
```

**Reasoning:**
- Use **slug** (not ID) because slugs are stable (ID can change in database)
- Use **prefix** (`segment-`) to distinguish from other hash routes
- Keep format **simple** (one state per hash)

#### Pattern 3: Browser History Test Checklist

Test all navigation patterns:

```javascript
// Test case: Click segment → hash updates
// Expected: URL shows #segment-elopements, segment view displays
// Verify: React state matches URL hash

// Test case: Click "← All Services" → hash updates
// Expected: URL shows #packages, segment list displays
// Verify: Browser back now goes to elopements

// Test case: Browser back button → hash changes
// Expected: URL changes, React state updates, UI re-renders
// Verify: handleHashChange fires, setSelectedSegmentId called

// Test case: Browser forward button → hash changes
// Expected: URL changes to previous segment, UI restores
// Verify: Matches state before back was pressed

// Test case: Refresh with #segment-X in URL
// Expected: Component reads hash on mount, segment loads
// Verify: No "dead page" loading - segment displays immediately
```

#### Pattern 4: When to Use Hash vs Query Params

| Scenario | Use Hash | Use Query | Use Path |
|----------|----------|-----------|----------|
| SPA navigation (no server change) | ✅ | ❌ | ❌ |
| Filter state (preserved on refresh) | ⚠️ | ✅ | ❌ |
| Multi-step wizard | ⚠️ | ✅ | ✅ |
| SEO-critical state | ❌ | ⚠️ | ✅ |
| Page route | ❌ | ❌ | ✅ |

**For segment browsing (SPA on storefront):** Hash is correct.

---

## Category 2: Service Worker Cache Issues

### Problem Summary

Service Workers cached old JavaScript bundles, causing stale stock photo URLs and placeholder images to persist even after:
- Clearing `.next` directory
- Restarting dev server
- Hard refreshing browser (Cmd+Shift+R)
- Clearing browser cache manually

The Service Worker was serving old cached code that referenced outdated image URLs.

### Root Causes

1. **PWA Service Worker enabled in dev:** Next.js PWA Service Workers aggressively cache all JS bundles
2. **SW persists across server restarts:** Service Workers are browser-managed, not server-managed
3. **SW intercepts all requests:** Browser never reaches dev server for fresh code
4. **Stale component code:** Old bundled JS references deleted/renamed stock photos

### Prevention Strategy

#### Pattern 1: Disable PWA in Development (Recommended)

**DO:** Ensure `next.config.js` disables PWA during development:

```javascript
// ✅ CORRECT - PWA off during dev
const withPWA = require('next-pwa')({
  dest: 'public',
  disable: process.env.NODE_ENV === 'development', // Off during npm run dev
  // ... other config
});

module.exports = withPWA(nextConfig);
```

**Verify:**
```bash
# Check current config
grep -A 5 "disable:" apps/web/next.config.js

# Should show:
# disable: process.env.NODE_ENV === 'development'
```

#### Pattern 2: Service Worker Cleanup Script

Add a helper script for quick cache clearing:

```bash
#!/bin/bash
# scripts/dev-fresh.sh
# Clear all caches and restart dev server with clean slate

cd apps/web

# Kill existing dev server
pkill -f "next dev" 2>/dev/null || true

# Delete caches
rm -rf .next .turbo node_modules/.cache 2>/dev/null || true

# Start fresh
npm run dev

echo ""
echo "Dev server starting. When ready, run this in browser console:"
echo ""
echo "async function clearSWs() {"
echo "  const regs = await navigator.serviceWorker.getRegistrations();"
echo "  for (const r of regs) await r.unregister();"
echo "  const names = await caches.keys();"
echo "  for (const n of names) await caches.delete(n);"
echo "  localStorage.clear();"
echo "  sessionStorage.clear();"
echo "  location.reload(true);"
echo "}"
echo "clearSWs();"
```

Add to `apps/web/package.json`:

```json
{
  "scripts": {
    "dev": "next dev --turbo",
    "dev:fresh": "bash ../../scripts/dev-fresh.sh"
  }
}
```

**Usage:**
```bash
npm run dev:fresh  # Instead of npm run dev
```

#### Pattern 3: Service Worker Unregistration Console Script

When stale cache appears, run this in browser console:

```javascript
// Quick fix: Unregister Service Workers + clear Cache API
async function clearAllCaches() {
  // Unregister all Service Workers
  const regs = await navigator.serviceWorker.getRegistrations();
  for (const r of regs) await r.unregister();

  // Clear Cache API
  const names = await caches.keys();
  for (const n of names) await caches.delete(n);

  // Clear browser storage
  localStorage.clear();
  sessionStorage.clear();

  // Force full refresh
  location.reload(true);
}

clearAllCaches();
```

#### Pattern 4: Detection Checklist

Signs your issue is Service Worker cache (not code error):

| Sign | Check |
|------|-------|
| **Component worked before, suddenly undefined** | Yes → likely SW cache |
| **Hard refresh (Cmd+Shift+R) doesn't fix** | Yes → likely SW cache |
| **Dev server shows no errors** | Yes → likely SW cache |
| **Network tab shows old bundle dates** | Yes → check Last-Modified header |
| **Chrome DevTools → Application → Service Workers shows active SWs** | Yes → unregister them |
| **One tab broken, another tab works** | Yes → SW cache per-tab |

**If multiple signs match → Service Worker cache issue is probable.**

#### Pattern 5: Multi-Layer Cache Clearing

If quick fix doesn't work, try in order:

```bash
# Step 1: Quick browser console fix (see Pattern 3)
# In browser console, run: clearAllCaches()
# Wait 5 seconds for cache clearing to complete

# Step 2: If still broken, kill and restart dev server
pkill -f "next dev"
cd apps/web && rm -rf .next .turbo
npm run dev

# Step 3: Then run console script again in browser
# (see Pattern 3)

# Step 4: Full nuclear option
pkill -9 -f node
cd apps/web && rm -rf .next .turbo node_modules/.cache
npm run dev
# Then run console script in browser
```

---

## Category 3: Stock Photo Fallback Pattern

### Problem Summary

When tenants haven't uploaded hero images for segments, the system falls back to generic stock photos. Implementation required:

1. **Keyword matching** to select appropriate photo
2. **Image optimization** via Next.js Image component (or plain img tag)
3. **Organizing stock photos** by category
4. **Handling broken URLs** gracefully

### Prevention Strategy

#### Pattern 1: Keyword-Based Photo Selection

**DO:** Use a simple keyword-matching approach with fallback:

```typescript
const SEGMENT_STOCK_PHOTOS: Record<string, string> = {
  // Category groups
  corporate: 'https://images.unsplash.com/photo-1552664730-d307ca884978?w=800&q=80',
  wellness: 'https://images.unsplash.com/photo-1544367567-0f2fcb009e0b?w=800&q=80',
  team: 'https://images.unsplash.com/photo-1522071820081-009f0129c71c?w=800&q=80',

  elopement: 'https://images.unsplash.com/photo-1519741497674-611481863552?w=800&q=80',
  wedding: 'https://images.unsplash.com/photo-1465495976277-4387d4b0b4c6?w=800&q=80',

  photo: 'https://images.unsplash.com/photo-1554048612-b6a482bc67e5?w=800&q=80',
  portrait: 'https://images.unsplash.com/photo-1531746020798-e6953c6e8e04?w=800&q=80',

  // Default fallback
  default: 'https://images.unsplash.com/photo-1497366216548-37526070297c?w=800&q=80',
};

/**
 * Get stock photo by matching keywords in segment name/slug/description
 */
function getSegmentStockPhoto(segment: SegmentData): string {
  const searchText = `${segment.name} ${segment.slug} ${segment.description || ''}`.toLowerCase();

  // Check each keyword (skip 'default')
  for (const [keyword, url] of Object.entries(SEGMENT_STOCK_PHOTOS)) {
    if (keyword !== 'default' && searchText.includes(keyword)) {
      return url;
    }
  }

  // No match → use default
  return SEGMENT_STOCK_PHOTOS.default;
}
```

**Key Points:**
- **Order matters:** Check keywords in priority order (more specific first)
- **Skip 'default' in loop:** Otherwise default always matches
- **Case-insensitive:** Convert to lowercase for matching
- **Search multiple fields:** name, slug, AND description
- **Fallback to default:** If no keywords match

#### Pattern 2: Preference Hierarchy

**DO:** Use this priority order for images:

```typescript
function getSegmentImage(segment: SegmentData): string {
  // 1. Tenant's uploaded hero image (highest priority)
  if (segment.heroImage) {
    return segment.heroImage;
  }

  // 2. Stock photo based on keywords
  return getSegmentStockPhoto(segment);
}
```

**Reasoning:**
- Tenants always see their own images first
- Stock photos are a sensible fallback
- No configuration needed

#### Pattern 3: Image Organization by Category

Keep stock photos organized in the code for maintainability:

```typescript
const SEGMENT_STOCK_PHOTOS: Record<string, string> = {
  // === Corporate / Business / Team ===
  corporate: '...unsplash.com/photo-business...',
  wellness: '...unsplash.com/photo-wellness...',
  team: '...unsplash.com/photo-team...',
  retreat: '...unsplash.com/photo-retreat...',

  // === Wedding / Elopement ===
  elopement: '...unsplash.com/photo-elopement...',
  wedding: '...unsplash.com/photo-wedding...',
  couple: '...unsplash.com/photo-couple...',

  // === Photography ===
  photo: '...unsplash.com/photo-camera...',
  portrait: '...unsplash.com/photo-portrait...',
  family: '...unsplash.com/photo-family...',

  // === Therapy / Wellness ===
  therapy: '...unsplash.com/photo-meditation...',
  massage: '...unsplash.com/photo-massage...',
  spa: '...unsplash.com/photo-spa...',

  // === Default (always include) ===
  default: '...unsplash.com/photo-generic...',
};
```

**Benefits:**
- **Clear at a glance** what categories are covered
- **Easy to add more:** Just copy section and add keyword + URL
- **Consistent quality:** All from same source (Unsplash)
- **Comments help future maintainers**

#### Pattern 4: Stock Photo License & Attribution

**DO:** Use free, attribution-optional sources:

| Source | License | Attribution | Recommended |
|--------|---------|-------------|-------------|
| Unsplash | Creative Commons Zero (CC0) | Optional | ✅ Recommended |
| Pexels | Free | Not required | ✅ Alternative |
| Pixabay | Free for commercial | Not required | ✅ Alternative |
| Unsplash Collections | CC0 | Optional | ✅ Best for branding |

**For MAIS:** Use Unsplash Collections curated specifically for service professionals (photographers, coaches, therapists).

#### Pattern 5: Image URL Parameters

Optimize Unsplash URLs for performance:

```typescript
// ✅ GOOD - Optimized URL with size and quality
'https://images.unsplash.com/photo-1552664730-d307ca884978?w=800&q=80'

// What each parameter does:
// w=800     → Max width 800px (enough for most thumbnails)
// q=80      → JPEG quality 80% (balances size vs quality)

// ❌ AVOID - No parameters (full res, 5MB+ file size)
'https://images.unsplash.com/photo-1552664730-d307ca884978'

// ❌ AVOID - Over-optimized (looks blurry)
'https://images.unsplash.com/photo-1552664730-d307ca884978?w=400&q=40'
```

**Recommendation for segment cards:**
- `w=800&q=80` → Good balance (visible at 2x density, ~150-200KB)
- `w=400&q=80` → Mobile only (~80-100KB)

#### Pattern 6: Image Error Handling

**DO:** Gracefully handle broken URLs:

```typescript
function SegmentCard({ segment, packages, onSelect }: SegmentCardProps) {
  const imageUrl = segment.heroImage || getSegmentStockPhoto(segment);

  return (
    <button onClick={onSelect} className="...">
      <div className="relative aspect-[16/10] overflow-hidden">
        {/* Plain img tag (not Next.js Image) for stock photos */}
        <img
          src={imageUrl}
          alt={segment.name}
          className="absolute inset-0 h-full w-full object-cover"
          // If image fails to load, CSS gradient shows instead
          onError={(e) => {
            e.currentTarget.style.display = 'none';
            // Gradient below still visible
          }}
        />
        {/* Fallback gradient always present */}
        <div className="absolute inset-0 bg-gradient-to-t from-surface-alt via-surface-alt/60 to-transparent" />
      </div>
      {/* Rest of card */}
    </button>
  );
}
```

**Key Points:**
- **Fallback gradient:** Always rendered, shows if image fails
- **onError handler:** Hide img, gradient becomes visible
- **No white page:** User sees meaningful design even without image
- **Plain img vs Next.js Image:** For external Unsplash URLs, plain img is sufficient (Unsplash has CDN)

#### Pattern 7: Testing Stock Photos

Test all scenarios:

```typescript
// Test case: Segment has heroImage
// Expected: heroImage displays (not stock photo)

// Test case: Segment with "wedding" in name
// Expected: Wedding Unsplash photo displays

// Test case: Segment with "elopement" in description
// Expected: Elopement photo displays (matches keyword)

// Test case: Segment with no keyword match
// Expected: Default stock photo displays

// Test case: Stock photo URL is broken (404)
// Expected: Gradient fallback shows, card still functional

// Test case: Multiple keywords match (e.g., "wedding elopement")
// Expected: First keyword in loop wins (predictable)
```

---

## Implementation Checklist

### Before implementing segment browsing:

- [ ] **Hash Sync:** Two `useEffect` hooks (one reads on mount, one listens for changes)
- [ ] **History API:** `window.history.pushState()` called before state updates
- [ ] **Browser Testing:** Test back/forward at each step
- [ ] **Service Worker:** Verify PWA disabled in dev mode in `next.config.js`
- [ ] **Stock Photos:** Organized by category with clear keyword matching
- [ ] **Image Fallback:** Gradient visible if image fails to load
- [ ] **Imports:** Use correct Prisma import path if touching database code

### During development:

- [ ] **Run tests:** `npm run dev` then open DevTools to check Service Workers
- [ ] **Clear caches:** Use `npm run dev:fresh` instead of `npm run dev`
- [ ] **Verify hash:** Check URL hash changes when clicking segments
- [ ] **Test back button:** Use browser back/forward 5+ times
- [ ] **Mobile test:** Verify on mobile viewport (375x812)

### Before committing:

- [ ] **No console errors:** Check DevTools console for errors
- [ ] **Hash preserved:** Refresh with hash in URL → state restores
- [ ] **Stock photos load:** All stock photo URLs return 200 OK
- [ ] **Fallback gradient:** Gradient visible if image fails
- [ ] **Code review:** Verify keyword matching logic is correct

---

## Test Cases

### Test 1: URL Hash State Persistence

```gherkin
Scenario: Refresh with segment selected maintains state
  Given I'm on the storefront with multiple segments
  When I click a segment (e.g., "Weddings")
  Then URL changes to #segment-weddings
  And the segment details display

  When I refresh the page (Cmd+R)
  Then the URL still shows #segment-weddings
  And the segment details are restored immediately
  And no "back to segments" flicker occurs
```

### Test 2: Browser Back Button Navigation

```gherkin
Scenario: Back button restores segment list
  Given I'm on the segment list
  When I click "Weddings" segment
  Then URL shows #segment-weddings, segment details display

  When I click the browser back button
  Then URL changes to #packages (or empty hash)
  And the segment list displays
  And I can click another segment

  When I click the browser forward button
  Then URL shows #segment-weddings again
  And the segment details display
```

### Test 3: Back Navigation Button In UI

```gherkin
Scenario: "← All Services" button returns to list
  Given I'm viewing a segment (e.g., "Elopements")
  When I click the "← All Services" button
  Then URL changes to #packages
  And the segment list displays
  And browser back button goes back to #segment-elopements
```

### Test 4: Stock Photo Selection

```gherkin
Scenario: Stock photo matches segment keyword
  Given a segment named "Wedding Photography"
  When the page loads
  Then the segment card displays a wedding-themed Unsplash photo
  And the image URL contains "images.unsplash.com"
  And the image loads without 404 errors

  When another segment named "Family Portraits" loads
  Then a portrait-themed Unsplash photo displays
  And it's different from the wedding photo
```

### Test 5: Fallback to Default Stock Photo

```gherkin
Scenario: Unknown segment uses default photo
  Given a segment with no matching keyword (e.g., "Custom Workshops")
  When the page loads
  Then the default Unsplash photo displays
  And no console errors occur
```

### Test 6: Service Worker Cache Recovery

```gherkin
Scenario: Clearing cache shows updated stock photos
  Given I'm in development mode
  When I modify SEGMENT_STOCK_PHOTOS in code (e.g., add new URL)
  And I save the file
  And I refresh the browser (Cmd+R)
  Then I still see the old stock photo (Service Worker cache)

  When I run the clearAllCaches() script in console
  And I wait for page to reload
  Then the new stock photo displays
  And no "Element type is invalid" errors occur
```

### Test 7: Image Error Handling

```gherkin
Scenario: Broken stock photo URL shows fallback
  Given a segment with a broken Unsplash URL
  When the page loads and the image fails to load
  Then the CSS gradient fallback is visible behind the text
  And the card remains clickable
  And no console errors appear
```

### Test 8: Mobile Responsive Layout

```gherkin
Scenario: Segment cards stack on mobile
  Given I'm viewing the storefront on mobile (375x812)
  When the page loads
  Then segment cards stack vertically (1 per row)
  And each card is full width with padding

  When I click a segment on mobile
  Then the tier cards display below with appropriate spacing
  And the "← All Services" button is easily tappable (44px min)
```

---

## Common Pitfalls to Avoid

### Pitfall 1: Missing Hash Change Listener

```typescript
// ❌ WRONG - Component doesn't react to back button
export function SegmentPackagesSection() {
  const [selectedSegmentId, setSelectedSegmentId] = useState<string | null>(null);

  // Component only updates React state from clicks, not from hash changes
  // Browser back button changes URL hash, but component doesn't respond
  // → Stale UI state while URL hash is correct (dead page)
}

// ✅ CORRECT - Listen for both clicks AND hash changes
useEffect(() => {
  const handleHashChange = () => {
    const hash = window.location.hash.slice(1);
    // Parse hash and update React state accordingly
  };
  window.addEventListener('hashchange', handleHashChange);
  return () => window.removeEventListener('hashchange', handleHashChange);
}, [segments]);
```

### Pitfall 2: Pushing to History AFTER State Update

```typescript
// ❌ WRONG - History and React state can diverge
const handleSelectSegment = (segmentId: string) => {
  setSelectedSegmentId(segmentId);
  // setState is async - hash won't be set when state updates
  const segment = segments.find((s) => s.id === segmentId);
  window.history.pushState(null, '', `#segment-${segment.slug}`);
  // → Timing bug: React renders before history is updated
};

// ✅ CORRECT - Push to history BEFORE state update
const handleSelectSegment = (segmentId: string) => {
  const segment = segments.find((s) => s.id === segmentId);
  if (segment) {
    // Push to history first (synchronous)
    window.history.pushState(null, '', `#segment-${segment.slug}`);
    // Then update React state (will render with hash in place)
    setSelectedSegmentId(segmentId);
  }
};
```

### Pitfall 3: Stock Photos with ID Matching

```typescript
// ❌ WRONG - Matching by ID breaks when database changes
const SEGMENT_PHOTOS: Record<string, string> = {
  '123': 'https://...',  // This ID might change if tenant is deleted/recreated
  '456': 'https://...',
};

function getPhoto(segment) {
  return SEGMENT_PHOTOS[segment.id] || fallback;
}

// ✅ CORRECT - Match by slug (stable across database changes)
function getSegmentStockPhoto(segment: SegmentData): string {
  const searchText = `${segment.name} ${segment.slug}`.toLowerCase();
  // Check for keywords in name/slug
  // Returns URL based on content, not ID
}
```

### Pitfall 4: Service Worker Cache During Active Development

```typescript
// ❌ WRONG - Leaving PWA enabled during npm run dev
const withPWA = require('next-pwa')({
  dest: 'public',
  // PWA is enabled (default), Service Worker caches everything
});

// ✅ CORRECT - Disable PWA in development
const withPWA = require('next-pwa')({
  dest: 'public',
  disable: process.env.NODE_ENV === 'development',
});
```

### Pitfall 5: Image URL Parameters Optimization

```typescript
// ❌ WRONG - No parameters or over-optimized
'https://images.unsplash.com/photo-123'  // 5+ MB, slow load
'https://images.unsplash.com/photo-123?w=200&q=40'  // Blurry

// ✅ CORRECT - Balanced optimization
'https://images.unsplash.com/photo-123?w=800&q=80'  // ~150KB, sharp
```

### Pitfall 6: Hash Format Ambiguity

```typescript
// ❌ WRONG - Unclear what hash represents
if (hash.startsWith('wedding')) {
  // Is this a segment? A package? A category?
}

// ✅ CORRECT - Explicit prefix
if (hash.startsWith('segment-wedding')) {
  // Clear: This is a segment, not a package
}
```

---

## Quick Reference Decision Tree

```
Am I implementing segment-first browsing?
├─ YES: URL state with back/forward?
│  ├─ YES: Use hash with window.history.pushState()
│  └─ NO: Use React state only (no URL binding)
├─ Need stock photo fallbacks?
│  ├─ YES: Keyword matching (name + slug + description)
│  └─ NO: Only use tenant-provided images
├─ Testing in development?
│  ├─ YES: Run `npm run dev:fresh` (PWA off)
│  └─ NO: `npm run dev` is fine
└─ Stock photo breaks?
   ├─ YES: Run clearAllCaches() in console (Service Worker issue)
   └─ NO: Check image URL (404?)
```

---

## Related Prevention Strategies

See these documents for related patterns:

- **[turbopack-hmr-module-cache-staleness](turbopack-hmr-module-cache-staleness.md)** - Different from Service Worker, but similar symptoms (stale cached code)
- **[nextjs-client-navigation-hydration-anti-patterns](code-review-patterns/nextjs-client-navigation-hydration-anti-patterns-MAIS-20260106.md)** - Hydration errors in Next.js client navigation
- **[service-worker-cache-stale-js-bundles](dev-workflow/service-worker-cache-stale-js-bundles-MAIS-20260105.md)** - Deep dive on Service Worker cache issues
- **[impersonation-session-sync-hydration-cache](logic-errors/impersonation-session-sync-hydration-cache-MAIS-20260106.md)** - Session state sync with URL

---

## Key Insights

### Insight 1: Hash State Requires Two-Way Binding

URL hash alone isn't enough—React state must stay in sync. This requires:
1. Reading hash on mount (initial state)
2. Listening for hash changes (external navigation)
3. Pushing to history when state changes (internal navigation)

Without all three, you get inconsistencies between URL and UI.

### Insight 2: Service Worker Caching is Browser-Managed

Service Workers persist across:
- Dev server restarts
- `.next` directory deletion
- Browser page refreshes
- Hard refreshes (Cmd+Shift+R)

They only clear via explicit unregistration. This is why `npm run dev:fresh` script is essential.

### Insight 3: Stock Photos Need Smart Fallbacks

Always have a fallback plan for images:
1. Tenant hero image (best)
2. Stock photo by keyword (good)
3. CSS gradient (acceptable minimum)

Never leave a card without fallback styling.

### Insight 4: Slug-Based Matching Beats ID-Based

Use `segment.slug` for keyword matching, not `segment.id`:
- IDs change when data migrates
- Slugs are stable and human-readable
- Keywords in slug/name are predictable

---

## Summary

This prevention strategy document covers three critical areas for segment-first browsing:

1. **URL Hash State:** Two-way sync between React state and browser history
2. **Service Worker Cache:** Quick recovery and prevention strategies
3. **Stock Photo Fallbacks:** Keyword matching with sensible fallbacks

Each section includes:
- **Root causes** of the original issues
- **Prevention patterns** with code examples
- **Test cases** to verify correctness
- **Common pitfalls** to avoid
- **Quick reference** decision trees

Use this document as a checklist before implementing similar patterns, and reference it when debugging navigation or caching issues.
