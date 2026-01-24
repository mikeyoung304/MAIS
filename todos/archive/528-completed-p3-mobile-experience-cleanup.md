---
status: complete
completed_date: '2026-01-01'
priority: p3
issue_id: '528'
tags:
  - code-review
  - mobile
  - cleanup
  - pwa
dependencies: []
---

# Mobile Experience Code Cleanup Items

## Problem Statement

A collection of medium-priority cleanup items identified during the mobile experience code review. These are "nice to have" improvements that don't affect functionality but would improve code quality and maintainability.

**Why it matters:** Technical debt accumulates if not tracked. These items improve performance, accessibility, and developer experience.

## Findings

**Source:** Mobile Experience Code Review

### 1. ~~Remove Unused PULL_TO_REFRESH_STYLES Export~~ [COMPLETED]

**Location:** `/Users/mikeyoung/CODING/MAIS/apps/web/src/hooks/usePullToRefresh.ts`

**Status:** COMPLETED - Removed unused `PULL_TO_REFRESH_STYLES` export and updated barrel file.

---

### 2. ~~Consider Removing usePinchZoomTransform Wrapper~~ [COMPLETED]

**Location:** `/Users/mikeyoung/CODING/MAIS/apps/web/src/hooks/usePinchZoom.ts`

**Status:** COMPLETED - Removed unused `usePinchZoomTransform` wrapper and updated barrel file.

---

### 3. Add Cache Size Limits in Service Worker

**Location:** `/Users/mikeyoung/CODING/MAIS/apps/web/public/sw.js`
**Lines:** 196-218

**Issue:** No maximum cache size defined. Caches could grow unbounded on devices with limited storage.

**Fix:** Implement cache eviction strategy (LRU or max entries):

```javascript
const MAX_CACHE_SIZE = 50;

async function trimCache(cacheName, maxItems) {
  const cache = await caches.open(cacheName);
  const keys = await cache.keys();
  if (keys.length > maxItems) {
    await Promise.all(keys.slice(0, keys.length - maxItems).map((key) => cache.delete(key)));
  }
}
```

---

### 4. Add Background Sync Retry Limits

**Location:** `/Users/mikeyoung/CODING/MAIS/apps/web/public/sw.js`
**Lines:** 326-331

**Issue:** Background sync retries forever if sync consistently fails. Should have max retry count.

**Fix:** Track retry count and abandon after threshold:

```javascript
const MAX_SYNC_RETRIES = 5;
// Store retry count in IndexedDB and check before retrying
```

---

### 5. Add useSafeAreaInsets to Barrel Export

**Location:** `/Users/mikeyoung/CODING/MAIS/apps/web/src/hooks/index.ts`

**Issue:** `useSafeAreaInsets` hook exists but is not exported from the hooks barrel file.

**Fix:** Add to `index.ts`:

```typescript
export { useSafeAreaInsets } from './useSafeAreaInsets';
```

---

### 6. FormFeedback Shake Animation Needs Motion Check

**Location:** `/Users/mikeyoung/CODING/MAIS/apps/web/src/components/ui/FormFeedback.tsx`
**Line:** 149

**Issue:** Shake animation on error doesn't respect `prefers-reduced-motion`.

**Fix:** Add motion-safe variant: `motion-safe:animate-shake`

---

### 7. Touch Targets Too Small in OfflineBanner and FormFeedback

**Locations:**

- `/Users/mikeyoung/CODING/MAIS/apps/web/src/components/mobile/OfflineBanner.tsx` (close button)
- `/Users/mikeyoung/CODING/MAIS/apps/web/src/components/ui/FormFeedback.tsx` (close button)

**Issue:** Close/dismiss buttons are smaller than 44x44px touch target minimum.

**Fix:** Add padding wrapper or increase hitbox size while keeping visual size.

---

### 8. Loading States Need aria-live

**Locations:**

- `/Users/mikeyoung/CODING/MAIS/apps/web/src/components/ui/ResponsiveDataTable.tsx`
- `/Users/mikeyoung/CODING/MAIS/apps/web/src/components/ui/ImageLightbox.tsx`

**Issue:** Loading states don't announce to screen readers when content loads.

**Fix:** Add `aria-live="polite"` to loading containers or use `aria-busy`:

```tsx
<div aria-live="polite" aria-busy={isLoading}>
  {isLoading ? <Spinner /> : <Content />}
</div>
```

---

## Proposed Solutions

Address items individually as time permits. Group by type:

1. **Dead code removal:** Items 1, 2 (30 min)
2. **PWA robustness:** Items 3, 4 (2 hours)
3. **Accessibility:** Items 6, 7, 8 (2 hours)
4. **DX improvement:** Item 5 (5 min)

## Recommended Action

<!-- Filled during triage -->

## Technical Details

**Affected files:**

- `apps/web/src/hooks/usePullToRefresh.ts`
- `apps/web/src/hooks/usePinchZoom.ts`
- `apps/web/src/hooks/index.ts`
- `apps/web/public/sw.js`
- `apps/web/src/components/ui/FormFeedback.tsx`
- `apps/web/src/components/ui/ResponsiveDataTable.tsx`
- `apps/web/src/components/ui/ImageLightbox.tsx`
- `apps/web/src/components/mobile/OfflineBanner.tsx`

## Acceptance Criteria

- [x] Unused exports removed
- [x] Cache size limits implemented
- [x] Background sync has retry limit
- [x] All hooks exported from barrel
- [x] Animations respect motion preferences
- [x] Touch targets meet minimums
- [x] Loading states accessible

## Work Log

| Date       | Action                                                                                                 | Learnings                                                             |
| ---------- | ------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------- |
| 2026-01-01 | Created from mobile UX code review                                                                     | Consolidated P3s                                                      |
| 2026-01-01 | Items 1 & 2 completed: removed unused exports                                                          | No consumers found                                                    |
| 2026-01-01 | Items 3-8 completed: cache limits, retry limits, barrel exports, motion-safe, touch targets, aria-live | Note: OfflineBanner.tsx and ImageLightbox.tsx don't exist in codebase |

## Resources

- [Workbox Cache Expiration](https://developer.chrome.com/docs/workbox/modules/workbox-expiration/)
- [WCAG Touch Target Size](https://www.w3.org/WAI/WCAG21/Understanding/target-size.html)
- [aria-live Regions](https://developer.mozilla.org/en-US/docs/Web/Accessibility/ARIA/ARIA_Live_Regions)
