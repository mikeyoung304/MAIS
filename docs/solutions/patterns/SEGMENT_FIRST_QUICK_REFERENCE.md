# Quick Reference: Segment-First Storefront UX

**Print This & Pin It** (1 minute read)

---

## The Pattern in 30 Seconds

```
Problem: Multi-segment businesses show flat package grid
         + Browser back button doesn't work

Solution: Two-stage flow with URL hash sync
          1. Show segment cards
          2. Click segment → show tiers for that segment
          3. Back button works via URL hash listening
```

---

## Critical Code

### 1. URL → State Sync (Must Have)

```typescript
useEffect(() => {
  const hash = window.location.hash.slice(1);
  if (hash.startsWith('segment-')) {
    const slug = hash.replace('segment-', '');
    const segment = segments.find((s) => s.slug === slug);
    if (segment) setSelectedSegmentId(segment.id);
  }

  const handleHashChange = () => {
    // Re-run this logic when browser back is clicked
    // ... (copy paste from above)
  };

  window.addEventListener('hashchange', handleHashChange);
  return () => window.removeEventListener('hashchange', handleHashChange);
}, [segments]);
```

**Why:** URL is the source of truth, state derives from it.

### 2. Push to History BEFORE State Update

```typescript
const handleSelectSegment = (segmentId: string) => {
  const segment = segments.find((s) => s.id === segmentId);
  if (segment) {
    window.history.pushState(null, '', `#segment-${segment.slug}`); // ← FIRST
    setSelectedSegmentId(segmentId);                                 // ← SECOND
  }
};
```

**Why:** Address bar needs to update before React renders.

### 3. Stock Photo Fallback

```typescript
const getSegmentStockPhoto = (segment: SegmentData): string => {
  const text = `${segment.name} ${segment.slug} ${segment.description || ''}`.toLowerCase();
  for (const [keyword, url] of Object.entries(SEGMENT_STOCK_PHOTOS)) {
    if (keyword !== 'default' && text.includes(keyword)) return url;
  }
  return SEGMENT_STOCK_PHOTOS.default;
};

// Use it
const imageUrl = segment.heroImage || getSegmentStockPhoto(segment);
```

**Why:** No images = no placeholder photos (better UX than blank gradients).

---

## Decision Tree: Debug Browser Back Issues

```
Browser back doesn't work?
│
├─ Is hashchange listener attached?
│  └─ No  → Add useEffect with window.addEventListener
│  └─ Yes → Move to step 2
│
├─ Is pushState called BEFORE setState?
│  └─ No  → Flip the order (pushState first!)
│  └─ Yes → Move to step 3
│
├─ Is cleanup function removing listener?
│  └─ No  → Add return () => window.removeEventListener
│  └─ Yes → Move to step 4
│
└─ Check console for errors in hashchange handler
   └─ Fix error → Browser back should work now
```

---

## Common Mistakes ❌ → Fixes ✅

| Mistake                          | Fix                                      |
| -------------------------------- | ---------------------------------------- |
| Set state THEN push to history   | Push to history FIRST, then set state    |
| Forget cleanup listener          | Add `return () => removeEventListener`   |
| Use `replaceState` not `pushState` | Use `pushState` for history entries    |
| Search keywords in title only    | Include slug + description in search     |
| No stock photo fallback          | Use `||` with `getSegmentStockPhoto()`   |
| Forget to handle empty hash (`#`) | Check for `newHash === ''`               |

---

## Testing Checklist

- [ ] Click segment → URL shows `#segment-{slug}`
- [ ] Back button → URL changes back to `#packages`
- [ ] Back button → UI re-renders (tiers become hidden)
- [ ] Forward button → URL shows `#segment-{slug}` again
- [ ] Forward button → UI re-renders (tiers show again)
- [ ] Single segment → No segment selection shown (skip step 1)
- [ ] 3 tiers → Middle tier has "Most Popular" badge
- [ ] No image → Unsplash stock photo loads
- [ ] Mobile viewport → Cards stack vertically
- [ ] Keyboard tab → Focus ring appears on cards

---

## File Locations

| What             | Where                                                |
| ---------------- | ---------------------------------------------------- |
| Implementation   | `apps/web/src/components/tenant/SegmentPackagesSection.tsx` |
| Stock photos     | `SEGMENT_STOCK_PHOTOS` constant in same file         |
| Component tests  | `apps/web/src/components/tenant/__tests__/` (create if needed) |
| E2E tests        | `apps/web/e2e/storefront.spec.ts` (if it exists)     |

---

## Copy-Paste Reference

### Full useEffect Hook

```typescript
useEffect(() => {
  // Read hash on mount
  const hash = window.location.hash.slice(1);
  if (hash.startsWith('segment-')) {
    const slug = hash.replace('segment-', '');
    const segment = segments.find((s) => s.slug === slug);
    if (segment) setSelectedSegmentId(segment.id);
  }

  // Listen for hash changes
  const handleHashChange = () => {
    const newHash = window.location.hash.slice(1);
    if (newHash.startsWith('segment-')) {
      const slug = newHash.replace('segment-', '');
      const segment = segments.find((s) => s.slug === slug);
      if (segment) setSelectedSegmentId(segment.id);
    } else if (newHash === 'packages' || newHash === '') {
      setSelectedSegmentId(null);
    }
  };

  window.addEventListener('hashchange', handleHashChange);
  return () => window.removeEventListener('hashchange', handleHashChange);
}, [segments]);
```

### Back Button Handler

```typescript
const handleBack = useCallback(() => {
  window.history.pushState(null, '', '#packages');
  setSelectedSegmentId(null);
}, []);
```

### Segment Selection Handler

```typescript
const handleSelectSegment = useCallback(
  (segmentId: string) => {
    const segment = segments.find((s) => s.id === segmentId);
    if (segment) {
      window.history.pushState(null, '', `#segment-${segment.slug}`);
      setSelectedSegmentId(segmentId);
    }
  },
  [segments]
);
```

---

## Why URL Hash?

| Aspect           | Hash (`#segment-x`)  | Path (`/segment/x`)    |
| ---------------- | -------------------- | ---------------------- |
| Server involved? | No                   | Yes (unless client app) |
| Browser back?    | ✅ Yes               | ✅ Yes                 |
| SEO impact?      | None                 | Yes                    |
| Complexity       | Simple               | More (routing)         |
| Works offline?   | ✅ Yes               | No                     |

**For storefronts: Hash is better** (client-side, no server load, simpler).

---

## Related Solutions

- **`docs/solutions/patterns/AGENT_TOOLS_PREVENTION_INDEX.md`** - Agent patterns (for admin side)
- **`docs/design/BRAND_VOICE_GUIDE.md`** - Design tokens used in cards
- **`docs/adrs/ADR-014-nextjs-app-router-migration.md`** - Why Next.js app router

---

## Need More Detail?

Read the full solution: `SEGMENT_FIRST_STOREFRONT_UX_PATTERN-MAIS-20260108.md`

**Key sections:**
- Root Cause Analysis (why it was broken)
- Stock Photo Fallback System (keyword matching)
- Performance & Accessibility
- Testing Strategy (unit + E2E)
