# Express Deployment Security Checklist

**Date:** 2026-01-01
**Status:** Prevention Strategy
**Severity:** P1 - Production Security
**Key Insight:** Trust proxy configuration + IP normalization patterns prevent production outages and spoofing attacks

---

## Problem Statement

Express running behind reverse proxies (Vercel, Cloudflare, AWS Load Balancer) requires explicit trust configuration to correctly identify client IPs. Without it:

1. **Rate limiting fails** - All requests appear from proxy IP (single IP hits all limits)
2. **IP spoofing possible** - Clients can forge X-Forwarded-For headers
3. **Inconsistent logging** - Admin logs show proxy IP, not actual client
4. **Security breaches** - Brute force attacks can't be detected across legitimate users

---

## Current State (MAIS)

### What's Missing

```typescript
// ❌ NO trust proxy configuration in app.ts
const app = express();
// Missing: app.set('trust proxy', ...);
```

### Partial Solutions (DRY Violation)

Two separate IP extraction implementations:

**File 1: `public-customer-chat.routes.ts` (Line 37-44)**

```typescript
keyGenerator: (req: Request) => {
  const forwarded = req.headers['x-forwarded-for'];
  if (typeof forwarded === 'string') {
    return forwarded.split(',')[0].trim(); // ⚠️ Leftmost IP
  }
  return req.ip || 'unknown';
};
```

**File 2: `public-date-booking.routes.ts` (Line 166)**

```typescript
clientIp: req.ip || req.headers['x-forwarded-for']; // ⚠️ No normalization
```

### Centralized Solution Exists

`middleware/rateLimiter.ts` has production-grade IP handling:

```typescript
// ✅ Handles IPv6 /64 prefix properly
function normalizeIp(ip: string | undefined): string {
  if (!ip) return 'unknown';
  if (ip.includes(':')) {
    const parts = ip.split(':');
    if (parts.length >= 4) {
      return parts.slice(0, 4).join(':') + '::';
    }
  }
  return ip;
}

// ✅ Used everywhere in the limiter
keyGenerator: (req) => normalizeIp(req.ip);
```

**But:** This only works IF `app.set('trust proxy', ...)` is configured at Express level.

---

## Prevention Checklist

### Pre-Deployment

- [ ] **Trust Proxy Configuration Added**
  - [ ] `app.ts` includes `app.set('trust proxy', 'loopback');` for dev
  - [ ] `app.ts` includes `app.set('trust proxy', 1);` for production (single proxy layer)
  - [ ] Or `app.set('trust proxy', 'uniqueips');` if multiple proxy layers
  - [ ] Decision documented in code comment (why that value was chosen)

- [ ] **Environment-Specific Configuration**

  ```typescript
  // In app.ts, after app creation
  if (process.env.NODE_ENV === 'production') {
    app.set('trust proxy', 1); // Vercel, Cloudflare (single proxy)
  } else {
    app.set('trust proxy', 'loopback'); // Dev/localhost
  }
  ```

- [ ] **IP Extraction Centralized**
  - [ ] No custom X-Forwarded-For header parsing in route handlers
  - [ ] All rate limiters use `normalizeIp(req.ip)` from rateLimiter.ts
  - [ ] No fallback to `req.headers['x-forwarded-for']` in logging
  - [ ] Search confirms: `grep -r "headers\['x-forwarded-for" src/` returns 0 results

### Testing (Before Merging)

- [ ] **Rate Limiting Behind Proxy**
  - [ ] Hit endpoint 100 times with same X-Forwarded-For header
  - [ ] Verify rate limit triggers after configured threshold (e.g., 5 login attempts)
  - [ ] Verify 429 response returns with proper rate limit headers
  - [ ] Verify different X-Forwarded-For values are treated as different clients

- [ ] **IPv6 Normalization**
  - [ ] Rate limiter correctly groups IPv6 /64 prefix
  - [ ] Example: `2001:db8:1234:5678::1` and `2001:db8:1234:5678::999` → same bucket
  - [ ] Example: `2001:db8:9999::1` (different /64) → different bucket
  - [ ] Test command: `npm test -- middleware/rateLimiter.spec.ts`

- [ ] **IP Logging Consistency**
  - [ ] `req.ip` used everywhere (not custom headers)
  - [ ] Request context logs show actual client IP
  - [ ] Error handler logs show actual client IP (not proxy)

### Production Monitoring

- [ ] **Rate Limit Headers Present**
  - [ ] Response headers include `RateLimit-Limit`, `RateLimit-Remaining`, `RateLimit-Reset`
  - [ ] Clients can implement proper backoff

- [ ] **Unexpected IP Patterns**
  - [ ] Monitor for single IP hitting many different rate limiters simultaneously
  - [ ] Alert if rate limit bypass attempts detected (same user across different IPs in <5s)
  - [ ] Check CloudFlare/proxy logs if many IPs map to same origin

- [ ] **No Custom Header Parsing**
  - [ ] Search codebase: no new code should manually parse X-Forwarded-For
  - [ ] Use `req.ip` everywhere after trust proxy configured

---

## Implementation Steps

### Step 1: Configure Trust Proxy (app.ts)

Add after `const app = express();`:

```typescript
// Trust proxy for IP resolution in production
// Vercel, Cloudflare, AWS ALB use single proxy layer
if (process.env.NODE_ENV === 'production') {
  app.set('trust proxy', 1);
  logger.info('Trust proxy enabled for single reverse proxy layer');
} else {
  app.set('trust proxy', 'loopback');
}
```

### Step 2: Remove Custom IP Parsing

**In `public-customer-chat.routes.ts`:**

```diff
- const publicChatRateLimiter = rateLimit({
-   keyGenerator: (req: Request) => {
-     const forwarded = req.headers['x-forwarded-for'];
-     if (typeof forwarded === 'string') {
-       return forwarded.split(',')[0].trim();
-     }
-     return req.ip || 'unknown';
-   },
- });

+ import { normalizeIp } from '../middleware/rateLimiter';
+ const publicChatRateLimiter = rateLimit({
+   keyGenerator: (req: Request) => normalizeIp(req.ip),
+ });
```

**In `public-date-booking.routes.ts`:**

```diff
- clientIp: req.ip || req.headers['x-forwarded-for'],

+ clientIp: req.ip,
```

### Step 3: Add Test Coverage

```typescript
// test/middleware/trust-proxy.spec.ts
describe('Trust Proxy Configuration', () => {
  it('should resolve client IP from X-Forwarded-For when trust proxy enabled', async () => {
    const res = await supertest(app).get('/health').set('X-Forwarded-For', '203.0.113.42');

    // Verify rate limiter sees the correct IP (203.0.113.42, not proxy IP)
    expect(res.status).toBe(200);
  });

  it('should normalize IPv6 addresses to /64 prefix', () => {
    const ip1 = normalizeIp('2001:db8:1234:5678::1');
    const ip2 = normalizeIp('2001:db8:1234:5678::999');
    expect(ip1).toBe(ip2); // Same /64 prefix
  });
});
```

### Step 4: Verify No Regressions

```bash
# Search for any remaining custom IP extraction
grep -r "x-forwarded-for" src/
grep -r "split.*','.*\[0\]" src/
grep -r "headers\['x-" src/ | grep -v "x-tenant\|x-idempotency"

# All should return 0
```

---

## Decision: Trust Proxy Value

### Vercel (Current Deployment)

- Single proxy layer: Vercel → Your App
- **Use:** `app.set('trust proxy', 1);`
- Request flow: `client → Vercel → app`

### AWS Load Balancer + CloudFlare

- Multiple layers: `client → CloudFlare → ALB → app`
- **Use:** `app.set('trust proxy', 2);` (trust 2 hops)
- Or: `app.set('trust proxy', 'uniqueips');` (let Express figure it out)

### Development (localhost)

- No proxy
- **Use:** `app.set('trust proxy', 'loopback');` (only trust localhost)

---

## Common Mistakes to Avoid

### ❌ Mistake 1: Parsing X-Forwarded-For Manually

```typescript
// WRONG - ignores trust proxy, vulnerable to spoofing
const ip = req.headers['x-forwarded-for']?.toString().split(',')[0];
```

### ❌ Mistake 2: Inconsistent IP Usage

```typescript
// WRONG - req.ip in one place, X-Forwarded-For in another
res.locals.clientIp = req.ip;
logger.info({ ip: req.headers['x-forwarded-for'] });
```

### ❌ Mistake 3: No IPv6 Normalization

```typescript
// WRONG - different IPv6 addresses won't group together
keyGenerator: (req) => req.ip;
// Result: Each IPv6 user gets their own rate limit bucket
```

### ✅ Correct Pattern

```typescript
// CORRECT - Single source of truth
app.set('trust proxy', 1); // At startup
keyGenerator: (req) => normalizeIp(req.ip); // Everywhere else
// req.ip now correctly reflects client IP after proxy
```

---

## Testing Verification

Run before deployment:

```bash
# Rate limit tests
npm test -- middleware/rateLimiter.spec.ts

# Auth tests (includes IP logging)
npm test -- routes/auth.routes.ts

# E2E with proxy headers (if available)
npm run test:e2e -- --grep "proxy\|ip\|forward"
```

---

## Links to Related Prevention Strategies

- [Authentication Form Accessibility](./auth-form-accessibility-checklist-MAIS-20251230.md)
- [NextAuth v5 Secure Cookie Prefix](./nextauth-v5-secure-cookie-prefix-production-401-MAIS-20251231.md)
- [IP Rate Limiting Public Endpoints](./todos/529-pending-p2-ip-rate-limiting-public-endpoints.md)

---

## Approval Checklist

Before deploying this fix:

- [ ] 3 reviewers agree trust proxy is misconfigured (check git blame on app.ts)
- [ ] Production logs show proxy IP, not client IP (proof of problem)
- [ ] Rate limiting test passes with X-Forwarded-For headers
- [ ] No custom IP extraction remains in codebase
- [ ] `grep -r "x-forwarded-for" src/` returns 0 results
- [ ] PR description links this prevention strategy
