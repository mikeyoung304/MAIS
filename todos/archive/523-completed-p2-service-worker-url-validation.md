---
status: complete
priority: p2
issue_id: '523'
tags:
  - code-review
  - security
  - pwa
  - mobile
dependencies: []
completed_date: '2026-01-01'
---

# Missing URL Validation in Service Worker

## Problem Statement

The `CACHE_URLS` message handler in the service worker accepts arbitrary URLs without validating they are same-origin. This could be exploited to cache malicious content.

**Why it matters:** An attacker with XSS could send a message to cache arbitrary URLs from other origins, potentially enabling cache poisoning attacks.

## Findings

**Source:** Mobile Experience Code Review

**Location:** `/Users/mikeyoung/CODING/MAIS/apps/web/public/sw.js`

**Lines:** 376-379

**Evidence:** URLs are cached without origin validation:

```javascript
self.addEventListener('message', (event) => {
  if (event.data.type === 'CACHE_URLS') {
    const urls = event.data.urls; // No validation
    caches.open(CACHE_NAME).then((cache) => {
      cache.addAll(urls); // Arbitrary URLs cached
    });
  }
});
```

## Solution Applied

**Implemented Solution 1: Same-Origin Validation**

Added `isSameOrigin()` helper function and updated `cacheUrls()` to filter URLs:

```javascript
/**
 * Check if a URL is same-origin (security validation).
 * Prevents caching arbitrary external URLs.
 */
function isSameOrigin(url) {
  try {
    const parsed = new URL(url, self.location.origin);
    return parsed.origin === self.location.origin;
  } catch {
    return false;
  }
}

/**
 * Cache specific URLs.
 * Only caches same-origin URLs for security.
 */
async function cacheUrls(urls) {
  // Filter to only same-origin URLs (security: prevent caching arbitrary external URLs)
  const safeUrls = urls.filter((url) => {
    const safe = isSameOrigin(url);
    if (!safe) {
      log('Rejected non-same-origin URL:', url);
    }
    return safe;
  });

  if (safeUrls.length === 0) {
    log('No valid same-origin URLs to cache');
    return;
  }

  const cache = await caches.open(STATIC_CACHE);
  await cache.addAll(safeUrls);
  log('Cached URLs:', safeUrls.length);
}
```

## Acceptance Criteria

- [x] URLs validated as same-origin before caching
- [x] Invalid/malformed URLs rejected gracefully (try/catch in isSameOrigin)
- [x] Legitimate caching operations still work (same-origin URLs pass through)
- [x] Console warning logged for rejected URLs (log() call for rejected URLs)

## Work Log

| Date       | Action                             | Learnings                  |
| ---------- | ---------------------------------- | -------------------------- |
| 2026-01-01 | Created from mobile UX code review | Cache poisoning prevention |
| 2026-01-01 | Implemented same-origin validation | URL API handles edge cases |

## Resources

- [Service Worker Security](https://web.dev/service-worker-lifecycle/)
- [OWASP Service Worker Security](https://owasp.org/www-community/attacks/Cache_Poisoning)
