# Segment-First Browsing Prevention Index

**Quick Links to All Resources:**

| Document                                                                                   | Purpose                                    | Read Time |
| ------------------------------------------------------------------------------------------ | ------------------------------------------ | --------- |
| **[SEGMENT_BROWSING_QUICK_CHECKLIST.md](SEGMENT_BROWSING_QUICK_CHECKLIST.md)**             | Print & pin—quick decision tree during dev | 2 min     |
| **[SEGMENT_BROWSING_PREVENTION_STRATEGIES.md](SEGMENT_BROWSING_PREVENTION_STRATEGIES.md)** | Deep dive—all patterns, pitfalls, examples | 20 min    |
| **[segment-browsing.spec.ts](../../e2e/tests/segment-browsing.spec.ts)**                   | E2E test suite—reference test patterns     | 10 min    |

---

## Problems Solved

During implementation of the **Segment-First Service Browsing** feature in `SegmentPackagesSection.tsx`, three categories of issues emerged:

| Problem                  | Root Cause                                       | Prevention                                        |
| ------------------------ | ------------------------------------------------ | ------------------------------------------------- |
| **URL Hash State**       | One-way binding, missing hashchange listener     | Two-way sync (read on mount + listen for changes) |
| **Service Worker Cache** | Old code cached, SW persists across dev restarts | PWA disabled in dev, `npm run dev:fresh` script   |
| **Stock Photo Fallback** | Image URLs broken or missing                     | Keyword matching + gradient fallback              |

---

## Three-Category Prevention Framework

### Category 1: URL Hash State Pattern

**Implement this pattern for SPA navigation in Next.js:**

```typescript
// 1. Read hash on mount (initialize state)
useEffect(() => {
  const hash = window.location.hash.slice(1);
  if (hash.startsWith('segment-')) {
    // Find segment by slug and update React state
  }
}, []);

// 2. Listen for hash changes (external navigation)
useEffect(() => {
  const handleHashChange = () => {
    // Parse hash and update React state
  };
  window.addEventListener('hashchange', handleHashChange);
  return () => window.removeEventListener('hashchange', handleHashChange);
}, [segments]);

// 3. Push to history on user action (internal navigation)
const handleSelectSegment = (id) => {
  window.history.pushState(null, '', `#segment-${slug}`);
  setSelectedSegmentId(id);
};
```

**Key Rules:**

- ✅ Two `useEffect` hooks (initial read + hashchange listener)
- ✅ Push to history BEFORE setState
- ✅ Clean up listeners in useEffect return
- ❌ Don't use query params for SPA state (use hash)
- ❌ Don't tie history to state alone (listen for external changes)

**Test with:**

- Refresh with hash in URL → state restores
- Browser back → segment list displays
- Browser forward → segment displays again
- Multiple back/forward cycles → state matches URL

---

### Category 2: Service Worker Cache Issues

**Quick Recovery (2 minutes):**

```bash
# Step 1: Restart dev server with clean caches
npm run dev:fresh

# Step 2: Run in browser console
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

# Step 3: Wait for reload
# Page should show fresh code and new stock photos
```

**Prevention (Before You Code):**

✅ In `apps/web/next.config.js`:

```javascript
const withPWA = require('next-pwa')({
  disable: process.env.NODE_ENV === 'development',
});
```

✅ In `apps/web/package.json`:

```json
{
  "scripts": {
    "dev": "next dev --turbo",
    "dev:fresh": "bash ../../scripts/dev-fresh.sh"
  }
}
```

✅ Create `scripts/dev-fresh.sh`:

```bash
#!/bin/bash
cd apps/web
pkill -f "next dev" 2>/dev/null || true
rm -rf .next .turbo node_modules/.cache 2>/dev/null || true
npm run dev
```

**Detection Checklist:**

| Sign                                                             | Likely?     |
| ---------------------------------------------------------------- | ----------- |
| Component worked before, now shows "undefined"                   | ✅ SW cache |
| Hard refresh doesn't fix it (Cmd+Shift+R)                        | ✅ SW cache |
| Dev server shows no errors                                       | ✅ SW cache |
| Network tab shows old bundle dates                               | ✅ SW cache |
| Chrome DevTools → Application → Service Workers shows active SWs | ✅ SW cache |

**If multiple signs match → Service Worker issue is probable.**

---

### Category 3: Stock Photo Fallback Pattern

**Pattern: Priority Hierarchy**

```typescript
// 1. Tenant's uploaded hero image (highest priority)
if (segment.heroImage) return segment.heroImage;

// 2. Stock photo based on keyword matching
return getSegmentStockPhoto(segment);

// 3. CSS gradient fallback (if image breaks)
// Always rendered behind image in markup
```

**Keyword Matching Implementation:**

```typescript
const SEGMENT_STOCK_PHOTOS: Record<string, string> = {
  // Organize by category
  corporate: 'https://images.unsplash.com/...?w=800&q=80',
  wedding: 'https://images.unsplash.com/...?w=800&q=80',
  photo: 'https://images.unsplash.com/...?w=800&q=80',
  therapy: 'https://images.unsplash.com/...?w=800&q=80',
  default: 'https://images.unsplash.com/...?w=800&q=80',
};

function getSegmentStockPhoto(segment) {
  const searchText = `${segment.name} ${segment.slug} ${segment.description || ''}`.toLowerCase();

  // Check keywords (skip 'default' in loop!)
  for (const [keyword, url] of Object.entries(SEGMENT_STOCK_PHOTOS)) {
    if (keyword !== 'default' && searchText.includes(keyword)) {
      return url;
    }
  }

  return SEGMENT_STOCK_PHOTOS.default;
}
```

**Image URL Optimization:**

- ✅ `w=800&q=80` → ~150KB, sharp at 2x density (recommended)
- ❌ No parameters → 5MB+ (too large)
- ❌ `w=400&q=40` → Blurry (over-optimized)

**Fallback Gradient:**

```jsx
<div className="relative aspect-[16/10] overflow-hidden">
  {/* Image layer (hidden if broken) */}
  <img
    src={imageUrl}
    alt={segment.name}
    className="absolute inset-0 h-full w-full object-cover"
    onError={(e) => (e.currentTarget.style.display = 'none')}
  />
  {/* Gradient layer (always visible, shows if image hidden) */}
  <div className="absolute inset-0 bg-gradient-to-t from-surface-alt via-surface-alt/60 to-transparent" />
</div>
```

---

## Implementation Checklist

Before coding segment browsing, verify:

- [ ] **Hash Sync:** Two `useEffect` hooks implemented
- [ ] **History API:** `window.history.pushState()` in right order
- [ ] **Service Worker:** PWA disabled in dev (`next.config.js`)
- [ ] **Dev Script:** `npm run dev:fresh` available
- [ ] **Stock Photos:** Organized by keyword, tested for loading
- [ ] **Fallback:** Gradient visible if image fails

During development:

- [ ] **Run tests:** E2E tests pass (see `segment-browsing.spec.ts`)
- [ ] **Check Service Workers:** DevTools → Application → Service Workers
- [ ] **Test hash:** Refresh with hash in URL → state restores
- [ ] **Test back:** Browser back/forward works 5+ times
- [ ] **Mobile:** Verify on 375x812 viewport

Before committing:

- [ ] **No console errors:** Check DevTools console
- [ ] **Stock photos load:** All URLs return 200 OK
- [ ] **Fallback works:** Gradient visible when image breaks
- [ ] **Code review:** Hash sync logic is correct
- [ ] **Tests pass:** `npm run test:e2e -- segment-browsing.spec.ts`

---

## Common Mistakes Quick Fix

| Mistake                            | Symptom                           | Fix                                                   |
| ---------------------------------- | --------------------------------- | ----------------------------------------------------- |
| Missing hash listener              | Back button doesn't work          | Add second useEffect with hashchange                  |
| Push after setState                | Hash and state sometimes mismatch | Push BEFORE setState                                  |
| Service Worker cache               | New code doesn't appear           | Run `npm run dev:fresh` + clearAllCaches() in console |
| Default keyword matches everything | Wrong stock photo displays        | Add `if (keyword !== 'default')` in loop              |
| No fallback gradient               | White space if image fails        | Add gradient div after img element                    |

---

## File References

| File                                                        | Purpose                                    |
| ----------------------------------------------------------- | ------------------------------------------ |
| `apps/web/src/components/tenant/SegmentPackagesSection.tsx` | Main component (hash state + stock photos) |
| `apps/web/next.config.js`                                   | PWA config (should disable in dev)         |
| `apps/web/package.json`                                     | Dev scripts (dev:fresh)                    |
| `e2e/tests/segment-browsing.spec.ts`                        | Comprehensive test suite                   |
| `scripts/dev-fresh.sh`                                      | Cache clearing script                      |

---

## 30-Second Decision Tree

```
Implementing segment browsing?
├─ YES: Follow QUICK_CHECKLIST.md (2 min read)
│
Something broke?
├─ URL hash not updating?
│  └─ Missing window.history.pushState() → Add before setState
├─ Back button doesn't work?
│  └─ Missing hashchange listener → Add second useEffect
├─ Old stock photo displays?
│  └─ Service Worker cache → Run npm run dev:fresh + clearAllCaches()
├─ Wrong stock photo showing?
│  └─ Keyword matching issue → Add 'if (keyword !== 'default')'
└─ Image broken, no fallback?
   └─ Missing gradient div → Add div with gradient classes after img

Need more details?
└─ Read PREVENTION_STRATEGIES.md (20 min deep dive)
```

---

## Key Insights Recap

1. **Hash sync needs bidirectionality**
   - Read on mount (initial state)
   - Listen for changes (external navigation)
   - Push on user action (internal navigation)

2. **Service Worker caching is tricky**
   - Persists across dev server restarts
   - Requires explicit unregistration
   - PWA disabled in dev prevents most issues

3. **Stock photos need smart fallbacks**
   - Tenant image first (highest priority)
   - Stock photo by keyword (second priority)
   - CSS gradient (minimum fallback)

4. **Test with real browser interactions**
   - Click, back, forward, refresh
   - Not just unit tests
   - Verify mobile responsiveness

---

## Resources

- **MDN Service Worker API:** https://developer.mozilla.org/en-US/docs/Web/API/Service_Worker_API
- **Next.js PWA Plugin:** https://github.com/shadowwalker/next-pwa
- **Unsplash Free Images:** https://unsplash.com
- **HTML History API:** https://developer.mozilla.org/en-US/docs/Web/API/History_API

---

## When to Escalate

Ask for help if:

- Hash changes but UI doesn't update after 2 minutes
- Back button goes to white page after trying all fixes
- Service Worker cache won't clear after `npm run dev:fresh` + console script
- Stock photos still showing old URLs after full cache clear

---

## Summary

This prevention index covers the **Segment-First Browsing** feature with three core patterns:

1. **URL Hash State** — Two-way sync (read + listen + push)
2. **Service Worker Cache** — PWA disabled in dev, recovery script
3. **Stock Photo Fallback** — Keyword matching + gradient

Each pattern includes:

- Problem statement (what goes wrong)
- Root cause (why it happens)
- Prevention strategy (how to avoid)
- Detection checklist (how to diagnose)
- Quick fixes (how to recover)

**Start with the 2-minute Quick Checklist. Refer to Prevention Strategies for details.**
