# Security Pattern DRY Normalization

**Date:** 2026-01-01
**Status:** Prevention Strategy
**Severity:** P2 - Code Quality & Maintainability
**Key Insight:** Duplicated IP normalization creates inconsistent behavior across security boundaries

---

## Problem Statement

The codebase contains two separate IP address handling implementations:

1. **Centralized (rateLimiter.ts)** - IPv6-aware normalization with /64 prefix extraction
2. **Scattered (public-customer-chat.routes.ts, public-date-booking.routes.ts)** - Manual parsing without IPv6 handling

Result: Security logic can silently diverge when updates are made to one location but not the other.

---

## Current Code State

### Location A: Correct Pattern (rateLimiter.ts)

```typescript
/**
 * Helper to normalize IP addresses for rate limiting
 * Handles IPv6 addresses properly by extracting the /64 prefix
 * This prevents IPv6 users from bypassing limits
 */
function normalizeIp(ip: string | undefined): string {
  if (!ip) return 'unknown';

  // Check if it's an IPv6 address
  if (ip.includes(':')) {
    // Extract the /64 prefix (first 4 groups) for IPv6
    const parts = ip.split(':');
    if (parts.length >= 4) {
      return parts.slice(0, 4).join(':') + '::';
    }
  }

  return ip;
}

// Used in 12+ places across all rate limiters
export const uploadLimiterIP = rateLimit({
  keyGenerator: (req) => normalizeIp(req.ip), // ✅ Correct
  validate: false,
});
```

### Location B: Incorrect Pattern (public-customer-chat.routes.ts, Line 37-44)

```typescript
// ❌ Manual X-Forwarded-For parsing (should not exist if trust proxy configured)
// ❌ No IPv6 handling
// ❌ Returns raw header value (not normalized)
const publicChatRateLimiter = rateLimit({
  keyGenerator: (req: Request) => {
    const forwarded = req.headers['x-forwarded-for'];
    if (typeof forwarded === 'string') {
      return forwarded.split(',')[0].trim();
    }
    return req.ip || 'unknown';
  },
});
```

### Location C: Inconsistent Pattern (public-date-booking.routes.ts, Line 166)

```typescript
// ❌ Logs IP without normalization
// ❌ Falls back to raw header (not through normalizeIp)
clientIp: req.ip || req.headers['x-forwarded-for'],
```

---

## Why This Is A Security Problem

### Scenario 1: IPv6 Bypass

```
User connects via IPv6: 2001:db8:1234:5678::1
User connects via IPv6: 2001:db8:1234:5678::999

Location A (normalizeIp):
  Both → "2001:db8:1234:5678::" (same bucket, shared limit)

Location B (raw parsing):
  Different raw IPs → separate buckets (bypass achieved!)
```

### Scenario 2: Trust Proxy Changes

If trust proxy configuration is added:

```
Before: X-Forwarded-For manual parsing works (wrong, but works)
After:  X-Forwarded-For parsing becomes WRONG (req.ip is now correct)

Result: Rate limiting silently breaks in public chat endpoints
```

### Scenario 3: Developer Confusion

When adding new security-sensitive endpoint:

```typescript
// New developer copies code from public-date-booking (has bug)
const newEndpointLimiter = rateLimit({
  keyGenerator: (req) => req.ip || req.headers['x-forwarded-for'], // ❌ Copies bug
});

// Instead of copying from rateLimiter (has correct pattern)
const newEndpointLimiter = rateLimit({
  keyGenerator: (req) => normalizeIp(req.ip), // ✅ Correct
});
```

---

## Prevention Checklist

### Code Review Gate

- [ ] **DRY Violation Detection**
  - [ ] Search: `grep -r "x-forwarded-for" src/ | grep -v "// Use X-Forwarded"`
  - [ ] Count: Expected 0 (all should be removed)
  - [ ] Search: `grep -r "split.*','.*\[0\]" src/`
  - [ ] Count: Expected 0 (all should use normalizeIp)

- [ ] **Centralized Import Verification**
  - [ ] All rate limiters import from `./middleware/rateLimiter.ts`
  - [ ] All use `normalizeIp` helper (not inline parsing)
  - [ ] No duplicate definitions of normalizeIp function

- [ ] **Export Verification**
  - [ ] `normalizeIp` is exported from rateLimiter.ts
  - [ ] Importable as: `import { normalizeIp } from '../middleware/rateLimiter'`
  - [ ] TypeScript shows no import errors

### Architecture Review

- [ ] **Single Source of Truth**
  - [ ] IP normalization logic lives ONLY in `middleware/rateLimiter.ts`
  - [ ] No IP parsing in route handlers
  - [ ] No IP parsing in orchestrators
  - [ ] Logging uses normalized IP (via req.ip after trust proxy configured)

- [ ] **Consistent IPv6 Handling**
  - [ ] All public endpoints extract IPv6 /64 prefix
  - [ ] All authenticated endpoints can identify users by full IPv6 (better than /64)
  - [ ] Decision documented: why /64 for public, full IP for authenticated

### Testing

- [ ] **IPv6 Normalization Tests**

  ```typescript
  // Verify function behavior
  expect(normalizeIp('2001:db8:1234:5678::1')).toBe('2001:db8:1234:5678::');
  expect(normalizeIp('2001:db8:1234:5678::999')).toBe('2001:db8:1234:5678::');
  expect(normalizeIp('203.0.113.42')).toBe('203.0.113.42');
  expect(normalizeIp(undefined)).toBe('unknown');
  ```

- [ ] **Rate Limiter Tests**

  ```typescript
  // Rate limiting should group IPv6 /64 prefix together
  const limiter = publicBookingActionsLimiter;

  // First request from 2001:db8:1234:5678::1
  // Subsequent requests from 2001:db8:1234:5678::999
  // Should share the same rate limit counter
  ```

- [ ] **No Regression Tests**

  ```typescript
  // Verify no custom X-Forwarded-For parsing
  describe('No custom IP extraction', () => {
    it('should use req.ip (after trust proxy configured)', async () => {
      const res = await supertest(app)
        .post('/v1/public/chat/message')
        .set('X-Forwarded-For', '203.0.113.42')
        .set('X-Tenant-Key', validKey);

      // Rate limiter should track this as 203.0.113.42
      // (assuming trust proxy = 1)
    });
  });
  ```

---

## Migration Path

### Phase 1: Export normalizeIp (Non-Breaking)

```typescript
// middleware/rateLimiter.ts
export function normalizeIp(ip: string | undefined): string {
  // ... existing implementation
}
```

### Phase 2: Update Imports (Safe)

```typescript
// public-customer-chat.routes.ts (BEFORE)
const publicChatRateLimiter = rateLimit({
  keyGenerator: (req: Request) => {
    const forwarded = req.headers['x-forwarded-for'];
    if (typeof forwarded === 'string') {
      return forwarded.split(',')[0].trim();
    }
    return req.ip || 'unknown';
  },
});

// public-customer-chat.routes.ts (AFTER)
import { normalizeIp } from '../middleware/rateLimiter';

const publicChatRateLimiter = rateLimit({
  keyGenerator: (req: Request) => normalizeIp(req.ip),
  validate: false,
});
```

### Phase 3: Update Logging (Safe)

```typescript
// public-date-booking.routes.ts (BEFORE)
clientIp: req.ip || req.headers['x-forwarded-for'],

// public-date-booking.routes.ts (AFTER)
clientIp: normalizeIp(req.ip),
```

### Phase 4: Verify Removal (Gate)

```bash
grep -r "x-forwarded-for" src/
# Should return 0 matches (except in comments explaining why we don't use it)

grep -r "split.*','.*\[0\]" src/
# Should return 0 matches
```

---

## Common Patterns to Avoid

### ❌ Pattern 1: Copy-Paste from Logging

```typescript
// This looks correct but is actually unsafe
const clientIp = req.ip || req.headers['x-forwarded-for'];
```

**Problem:** If X-Forwarded-For is array, this breaks. If trust proxy not configured, gets proxy IP.

### ❌ Pattern 2: Inline Normalization

```typescript
// Each limiter defines its own normalization
const customLimiter = rateLimit({
  keyGenerator: (req) => {
    const ip = req.ip || 'unknown';
    if (ip.includes(':')) {
      return ip.split(':').slice(0, 4).join(':') + '::'; // Duplication
    }
    return ip;
  },
});
```

**Problem:** If normalization logic needs to change (e.g., IPv6 changed to /48 prefix), must update in 5+ places.

### ❌ Pattern 3: Conditional Logic

```typescript
// Different handlers use different logic
const handler1 = (req) => normalizeIp(req.ip);
const handler2 = (req) => req.ip || req.headers['x-forwarded-for'];
const handler3 = (req) => req.headers['x-forwarded-for'] || req.ip;
```

**Problem:** Inconsistent behavior across endpoints. Same client sees different limits.

---

## ✅ Correct Pattern

### Single Location

```typescript
// middleware/rateLimiter.ts - THE ONLY PLACE
export function normalizeIp(ip: string | undefined): string {
  if (!ip) return 'unknown';
  if (ip.includes(':')) {
    const parts = ip.split(':');
    if (parts.length >= 4) {
      return parts.slice(0, 4).join(':') + '::';
    }
  }
  return ip;
}
```

### Everywhere Else

```typescript
// Import from single source
import { normalizeIp } from '../middleware/rateLimiter';

// Use consistently
const myLimiter = rateLimit({
  keyGenerator: (req) => normalizeIp(req.ip),
});

// In logging
logger.info({ ip: normalizeIp(req.ip) });
```

---

## Refactoring Checklist

- [ ] `normalizeIp` exported from rateLimiter.ts
- [ ] public-customer-chat.routes.ts updated (import + use normalizeIp)
- [ ] public-date-booking.routes.ts updated (use normalizeIp in logging)
- [ ] All other rate limiters verified using normalizeIp
- [ ] No duplicated IP normalization logic exists
- [ ] Test coverage for IPv6 /64 prefix extraction
- [ ] No X-Forwarded-For header parsing outside middleware
- [ ] Code comment in rateLimiter explains WHY we extract /64 (prevent IPv6 bypass)

---

## Review Checklist

**Before approving PR:**

- [ ] All X-Forwarded-For parsing removed (except comments)
- [ ] All custom IP normalization logic removed
- [ ] normalizeIp imported from single location
- [ ] Test coverage shows IPv6 grouping works
- [ ] No regression in rate limiting behavior
- [ ] PR author documented the change in commit message
- [ ] No new code patterns that duplicate this logic

---

## Deployment Impact

### Risk: Low

- No breaking changes to API
- No database changes
- No new dependencies
- Behavior improvement (more correct rate limiting)

### Rollback: Easy

- Simply revert IP extraction changes
- No data cleanup needed

### Rollforward: Required

- Rate limiting will be more accurate
- Some clients may hit limits they didn't before (correct behavior)
- Monitor rate limit logs for spike in 429 responses

---

## Monitoring After Deployment

### Metrics to Watch

- [ ] Rate limit 429 responses per endpoint
- [ ] Distribution of IPs hitting rate limits (should not be single proxy IP)
- [ ] IPv6 traffic patterns (should group by /64 prefix)

### Alert Thresholds

- Spike in 429s: > 50% increase from baseline
- Single IP source: All 429s from one IP (indicates trust proxy not working)
- Auth failures: More than normal (indicates race condition in limits)

---

## Links to Related Prevention Strategies

- [EXPRESS_DEPLOYMENT_SECURITY_CHECKLIST](./EXPRESS_DEPLOYMENT_SECURITY_CHECKLIST-MAIS-20260101.md)
- [AUTH_FORM_ACCESSIBILITY_CHECKLIST](./auth-form-accessibility-checklist-MAIS-20251230.md)
