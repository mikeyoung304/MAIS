# Segment-First Browsing Quick Checklist

**Print this page and pin it to your desk during development.**

---

## Before You Code

- [ ] **Hash State:** You need two `useEffect` hooks (one for initial read, one for hashchange listener)
- [ ] **History API:** You'll call `window.history.pushState()` before state updates
- [ ] **Stock Photos:** You'll organize photos by keyword (not ID)
- [ ] **Testing:** You'll test back/forward button with real browser navigation

---

## Implementing Hash Sync

```typescript
// ✅ DO THIS:

useEffect(() => {
  // On mount: read initial hash
  const hash = window.location.hash.slice(1);
  if (hash.startsWith('segment-')) {
    const slug = hash.replace('segment-', '');
    // Find segment by slug and update React state
  }
}, []); // Empty deps - runs once

useEffect(() => {
  // Listen for hash changes (browser back/forward)
  const handleHashChange = () => {
    const newHash = window.location.hash.slice(1);
    // Parse hash and update React state
  };
  window.addEventListener('hashchange', handleHashChange);
  return () => window.removeEventListener('hashchange', handleHashChange);
}, [segments]); // Deps: things needed to parse hash

// When user clicks segment:
const handleSelectSegment = (segmentId: string) => {
  const segment = segments.find((s) => s.id === segmentId);
  if (segment) {
    // Push BEFORE setState
    window.history.pushState(null, '', `#segment-${segment.slug}`);
    setSelectedSegmentId(segmentId);
  }
};
```

- [ ] **Two useEffect hooks:** Initial read + hash listener
- [ ] **Push before setState:** History matches DOM state
- [ ] **Clean up listeners:** Return cleanup from useEffect
- [ ] **Hash format:** `#segment-{slug}` (explicit prefix)

---

## Service Worker Gotchas

- [ ] **PWA disabled in dev:** Check `next.config.js` has `disable: process.env.NODE_ENV === 'development'`
- [ ] **Use `npm run dev:fresh`:** Not `npm run dev` (clears caches before starting)
- [ ] **Still broken?** Run this in browser console:

```javascript
async function clearAllCaches() {
  const regs = await navigator.serviceWorker.getRegistrations();
  for (const r of regs) await r.unregister();
  const names = await caches.keys();
  for (const n of names) await caches.delete(n);
  localStorage.clear();
  sessionStorage.clear();
  location.reload(true);
}
clearAllCaches();
```

| Problem                    | Solution                          |
| -------------------------- | --------------------------------- |
| Old stock photo displays   | Run `clearAllCaches()` in console |
| Component says "undefined" | SW cache → run `clearAllCaches()` |
| Hard refresh doesn't help  | SW cache → unregister it manually |

---

## Stock Photo Keywords

```typescript
const SEGMENT_STOCK_PHOTOS: Record<string, string> = {
  // Corporate
  corporate: '...',
  wellness: '...',
  team: '...',

  // Wedding
  elopement: '...',
  wedding: '...',
  couple: '...',

  // Photography
  photo: '...',
  portrait: '...',
  family: '...',

  // Therapy
  therapy: '...',
  massage: '...',
  spa: '...',

  // Always include
  default: '...',
};
```

- [ ] **Keyword matching:** Check segment name, slug, description
- [ ] **Skip 'default' in loop:** Otherwise matches everything
- [ ] **Case insensitive:** Convert to lowercase
- [ ] **Use Unsplash URLs:** w=800&q=80 for performance

---

## Testing Checklist

Run through these scenarios:

| Scenario              | Steps                                      | Expected                      |
| --------------------- | ------------------------------------------ | ----------------------------- |
| **Refresh with hash** | 1. Click segment 2. Refresh page           | Segment displays (no flicker) |
| **Browser back**      | 1. Click segment 2. Click back button      | Segment list displays         |
| **Browser forward**   | 1. Back button 2. Forward button           | Segment displays again        |
| **Back button in UI** | 1. Click segment 2. Click "← All Services" | Segment list displays         |
| **Stock photo loads** | 1. Load page with segment                  | Unsplash photo visible        |
| **Image breaks**      | 1. Broken image URL                        | Gradient fallback visible     |
| **Mobile layout**     | 1. Resize to 375x812                       | Cards stack, tap-able         |

- [ ] All scenarios tested
- [ ] No console errors
- [ ] Browser back/forward works 5+ times
- [ ] Stock photos load (no 404s)
- [ ] Hash in URL matches displayed segment

---

## Commits Checklist

Before pushing code:

- [ ] No `console.log()` statements (use `logger` if needed)
- [ ] No hardcoded image URLs outside `SEGMENT_STOCK_PHOTOS`
- [ ] Prisma imports correct (`from '@prisma/client'` not relative paths)
- [ ] No `as any` type casts without justification
- [ ] Components exported properly
- [ ] Tests pass: `npm test` (or `npm run test:e2e`)

---

## Debugging Decision Tree

**Something looks wrong. What do I check first?**

```
Is hash in URL? (e.g., #segment-weddings)
├─ NO  → Component didn't call window.history.pushState()
│       → Check handleSelectSegment - does it push BEFORE setState?
│
└─ YES → Hash is correct, but UI wrong?
   ├─ Stale old component/photo?
   │  └─ Service Worker cache (see Service Worker Gotchas above)
   │
   ├─ Back button doesn't work?
   │  └─ Missing hashchange listener
   │     → Check second useEffect - is it registered?
   │
   └─ Stock photo wrong?
      └─ Keyword not matching
         → Check if keyword in SEGMENT_STOCK_PHOTOS
         → Check searchText includes keyword (case-insensitive?)
```

---

## Common Mistakes to Avoid

```typescript
// ❌ WRONG - Missing hash listener
useEffect(() => {
  // Only runs on mount - doesn't react to back button
}, []);

// ✅ CORRECT - Listen for hash changes
useEffect(() => {
  const handleHashChange = () => { /* ... */ };
  window.addEventListener('hashchange', handleHashChange);
  return () => window.removeEventListener('hashchange', handleHashChange);
}, [segments]);

// ❌ WRONG - Push after setState
const handleSelectSegment = (id) => {
  setSelectedSegmentId(id);  // Async
  window.history.pushState(...);  // Might race
};

// ✅ CORRECT - Push before setState
const handleSelectSegment = (id) => {
  window.history.pushState(...);  // Sync
  setSelectedSegmentId(id);
};

// ❌ WRONG - Default keyword always matches
for (const [keyword, url] of Object.entries(SEGMENT_STOCK_PHOTOS)) {
  if (searchText.includes(keyword)) return url;  // 'default' matches always!
}

// ✅ CORRECT - Skip default in loop
for (const [keyword, url] of Object.entries(SEGMENT_STOCK_PHOTOS)) {
  if (keyword !== 'default' && searchText.includes(keyword)) return url;
}
```

---

## Performance Tips

| Optimization                           | Benefit                        |
| -------------------------------------- | ------------------------------ |
| Use slug (not ID) for photo matching   | Stable across database changes |
| Image URL: `w=800&q=80`                | ~150KB instead of 5MB          |
| Lazy-load images with `loading="lazy"` | Faster initial page load       |
| Add alt text to all images             | SEO + accessibility            |

---

## 2-Minute Recovery Guide

**If something breaks during development:**

```bash
# Step 1: Clear everything and restart
npm run dev:fresh

# Step 2: In browser console, clear cache
async function clearAllCaches() {
  const regs = await navigator.serviceWorker.getRegistrations();
  for (const r of regs) await r.unregister();
  const names = await caches.keys();
  for (const n of names) await caches.delete(n);
  localStorage.clear();
  sessionStorage.clear();
  location.reload(true);
}
clearAllCaches();

# Step 3: Refresh browser (wait for console message)
# Page should reload with fresh code
```

---

## Reference Files

| File                                                        | Purpose                                                                    |
| ----------------------------------------------------------- | -------------------------------------------------------------------------- |
| `apps/web/src/components/tenant/SegmentPackagesSection.tsx` | Main component                                                             |
| `apps/web/next.config.js`                                   | PWA config (should have `disable: process.env.NODE_ENV === 'development'`) |
| `apps/web/package.json`                                     | Should have `"dev:fresh"` script                                           |
| `e2e/tests/storefront.spec.ts`                              | E2E tests (reference for patterns)                                         |

---

## When to Escalate

Ask for help if:

- [ ] Hash changes but UI doesn't update (likely hashchange listener missing)
- [ ] Back button goes to white page (likely hash sync issue)
- [ ] Service Worker cache won't clear (try full nuclear option: kill node, delete .next/.turbo)
- [ ] Stock photos still showing old images after clearAllCaches() (might be image CDN caching)

---

## Remember

1. **Two useEffect hooks** - one for mount, one for hashchange
2. **Push before setState** - keep history and state in sync
3. **Service Worker cache is tricky** - use `npm run dev:fresh` and clearAllCaches()
4. **Stock photos need fallbacks** - gradient CSS if image fails
5. **Test browser back/forward** - not just clicks

Good luck! 🚀
