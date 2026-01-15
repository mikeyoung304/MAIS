---
title: 'Express Trust Proxy Configuration & IP Spoofing in Rate Limiting'
category: security-issues
severity: P0+P1
component: rate-limiter, express, ip-verification, authentication
symptoms:
  - 'Rate limiter ineffective behind reverse proxies (Vercel, Cloudflare)'
  - 'All requests appear to come from proxy IP'
  - 'Attackers can bypass rate limits by injecting fake IPs'
  - 'X-Forwarded-For header ignored in production'
tags:
  - rate-limiting
  - express-configuration
  - ip-spoofing
  - security
  - proxy-handling
date_solved: 2026-01-01
related_todos:
  - '542-ready-p0-trust-proxy-missing.md'
  - '543-ready-p1-rate-limit-ip-spoofing.md'
---

# Express Trust Proxy Configuration & IP Spoofing in Rate Limiting

## Executive Summary

Two critical security issues discovered in code review:

1. **P0 - Trust Proxy Missing:** Express `trust proxy` setting is not configured, making rate limiting completely ineffective behind reverse proxies (Vercel, Cloudflare, AWS ALB)

2. **P1 - IP Spoofing Vulnerability:** Rate limiter extracts the leftmost IP from `X-Forwarded-For` header, which is client-controlled and spoofable, allowing attackers to bypass rate limits entirely

**Combined Impact:** Rate limiting provides zero security in production. Attackers can:

- Rotate fake IPs to bypass signup/login rate limits
- Brute-force booking tokens without detection
- DDoS endpoints with different fake IPs per request

---

## Problem 1: Trust Proxy Not Configured (P0)

### Root Cause

Express doesn't parse `X-Forwarded-For` headers without the `trust proxy` setting. Behind reverse proxies, all requests appear to come from the proxy's IP.

### Current State

**File:** `server/src/app.ts`

```typescript
// MISSING - trust proxy not set
export function createApp(
  config: Config,
  container: Container,
  startTime: number
): express.Application {
  const app = express();

  // ... middleware setup ...
  app.use(skipIfHealth); // Rate limiting applied, but to WRONG ip
}
```

### Attack Impact

**Scenario:** Attacker on Vercel (production host)

```
Attacker IP: 192.168.1.100 (home network)
  ↓
Makes request to storefronts.gethandled.ai
  ↓
Vercel reverse proxy adds:
  X-Forwarded-For: 192.168.1.100

Rate limiter sees:
  req.ip = 76.123.45.67 (Vercel's IP)

Result: Rate limit applies to all Vercel traffic globally
```

### Solution: Add Trust Proxy Setting

**File:** `server/src/app.ts` (add before middleware)

```typescript
export function createApp(
  config: Config,
  container: Container,
  startTime: number
): express.Application {
  const app = express();

  // ✅ CRITICAL: Enable trust proxy BEFORE middleware
  // This tells Express to:
  // 1. Parse X-Forwarded-For header
  // 2. Populate req.ip from rightmost IP in chain
  // 3. Set req.protocol/req.secure from X-Forwarded-Proto
  app.set('trust proxy', 1); // Trust first (closest) proxy hop

  // Sentry request tracking (MUST be first)
  app.use(sentryRequestHandler());

  // ... rest of middleware ...
}
```

### Why This Works

- `trust proxy: 1` tells Express: "The first proxy hop is trustworthy"
- Express now extracts IP from `X-Forwarded-For` and populates `req.ip`
- All rate limiters using `req.ip` now work correctly
- Rightmost IP in XFF chain is closest to client (hardest to spoof)

### Verification

```bash
# After adding trust proxy setting
npm run dev:api

# Test with spoofed X-Forwarded-For
curl -H "X-Forwarded-For: 1.2.3.4, 5.6.7.8, 192.168.1.100" \
     http://localhost:3001/health

# Should see: req.ip = 192.168.1.100 (rightmost)
# NOT: req.ip = 1.2.3.4 (spoofed leftmost)
```

---

## Problem 2: IP Spoofing in Rate Limiter (P1)

### Root Cause

Custom `keyGenerator` in rate limiter extracts **leftmost** IP from `X-Forwarded-For`:

**File:** `server/src/middleware/rateLimiter.ts` (lines not explicitly shown, but referenced in todos)

```typescript
// VULNERABLE - Uses leftmost IP (spoofable)
keyGenerator: (req: Request) => {
  const forwarded = req.headers['x-forwarded-for'];
  if (typeof forwarded === 'string') {
    return forwarded.split(',')[0].trim(); // ❌ WRONG - attacker controls this
  }
  return req.ip || 'unknown';
};
```

### Attack Vector

**Brute Force Signup with IP Rotation:**

```http
POST /v1/auth/signup
X-Forwarded-For: 1.1.1.1  ← Fake IP #1
X-Tenant-Key: pk_live_...
{ ... signup payload ... }

POST /v1/auth/signup
X-Forwarded-For: 2.2.2.2  ← Fake IP #2
X-Tenant-Key: pk_live_...
{ ... signup payload ... }

POST /v1/auth/signup
X-Forwarded-For: 3.3.3.3  ← Fake IP #3
X-Tenant-Key: pk_live_...
{ ... signup payload ... }
```

Each request looks like it comes from a different client, bypassing the 5 signups/hour limit entirely.

### Why Leftmost IP Is Spoofable

```
X-Forwarded-For chain flows left-to-right as it traverses proxies:

Client (attacker) sends:
  X-Forwarded-For: <attacker-injected-ip>, <attacker-real-ip>

Cloudflare adds its IP:
  X-Forwarded-For: <attacker-injected-ip>, <attacker-real-ip>, cloudflare-ip

Your server receives:
  X-Forwarded-For: 1.2.3.4 (FAKE!), 5.6.7.8 (FAKE!), <actual-attacker-ip>

Leftmost = attacker-controlled ❌
Rightmost = actual-attacker-ip (appended by trusted proxy) ✅
```

### Current Rate Limiting Code

**File:** `server/src/middleware/rateLimiter.ts`

The rate limiter implementations use `normalizeIp(req.ip)`:

```typescript
function normalizeIp(ip: string | undefined): string {
  if (!ip) return 'unknown';
  if (ip.includes(':')) {
    const parts = ip.split(':');
    if (parts.length >= 4) {
      return parts.slice(0, 4).join(':') + '::'; // IPv6 /64 prefix
    }
  }
  return ip;
}

// Used in public chat limiter:
export const customerChatLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: isTestEnvironment ? 500 : 20,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => normalizeIp(req.ip), // ✅ Uses req.ip (good once trust proxy is set)
  validate: false,
  handler: (_req: Request, res: Response) => {
    res.status(429).json({
      error: 'too_many_requests',
      message: 'Too many messages. Please wait a moment before sending more.',
    });
  },
});
```

**Issue:** The code currently relies on `req.ip`, which won't be populated correctly without `trust proxy` setting.

### Solution: Ensure Trust Proxy + Clean keyGenerators

Once `app.set('trust proxy', 1)` is added, `req.ip` will automatically contain the rightmost IP from XFF chain. All existing `keyGenerator: (req) => normalizeIp(req.ip)` patterns become secure.

**No additional changes needed** to individual limiters—they already have the right implementation pattern. The fix is purely adding the trust proxy setting.

**Verification Pattern:**

```typescript
// Current (correct once trust proxy is set):
export const customerChatLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 20,
  keyGenerator: (req) => normalizeIp(req.ip), // ✅ Safe once trust proxy enabled
  handler: ...
});
```

---

## Implementation Plan

### Step 1: Add Trust Proxy Setting (5 min)

**File:** `server/src/app.ts`

Add single line after `const app = express()`:

```typescript
app.set('trust proxy', 1);
```

### Step 2: Verify Rate Limiters

Review all rate limiters to ensure they use `normalizeIp(req.ip)` pattern:

**Files to check:**

- `server/src/middleware/rateLimiter.ts` - All limiter configurations

**Pattern (correct):**

```typescript
keyGenerator: (req) => normalizeIp(req.ip); // ✅ Uses req.ip, not XFF header
```

**Pattern (vulnerable - if any exist):**

```typescript
keyGenerator: (req) => {
  return req.headers['x-forwarded-for']?.split(',')[0]; // ❌ Direct XFF parsing
};
```

### Step 3: Testing

```bash
# 1. Start API server
npm run dev:api

# 2. Test trust proxy is working
curl -H "X-Forwarded-For: 1.2.3.4, 192.168.1.100" http://localhost:3001/health

# Check logs for req.ip = 192.168.1.100 (should be rightmost)

# 3. Run rate limiter tests
npm test -- server/test/middleware/rateLimiter.spec.ts

# 4. Test signup rate limiting
npm run test:e2e -- e2e/tests/auth-signup.spec.ts
```

### Step 4: Deploy

- [ ] Add `app.set('trust proxy', 1)` to `server/src/app.ts`
- [ ] Run full test suite: `npm test`
- [ ] Verify on staging/production: confirm rate limiting effective
- [ ] Monitor logs for IP extraction correctness

---

## Why Both Issues Matter Together

### Scenario: Attack Without Both Fixes

**With ONLY trust proxy (not rate limiter fix):**

```
Attacker tries:
  GET /v1/booking/token/ABC123
  X-Forwarded-For: 1.2.3.4

Attacker retries:
  GET /v1/booking/token/ABC123
  X-Forwarded-For: 2.3.4.5

Each request sees different IP, bypasses per-IP rate limit
Rate limit doesn't block token enumeration attack
```

### Scenario: Fixed (Both in Place)

**With trust proxy + req.ip based limiters:**

```
Attacker tries:
  GET /v1/booking/token/ABC123
  X-Forwarded-For: 1.2.3.4, 192.168.1.100
  (Vercel appends:) X-Forwarded-For: 1.2.3.4, 192.168.1.100, 76.45.67.89

Rate limiter sees: req.ip = 76.45.67.89 (rightmost, from Vercel)

Attacker retries with different fake IP:
  X-Forwarded-For: 9.9.9.9, 192.168.1.100

Rate limiter sees: req.ip = 76.45.67.89 (SAME - Vercel's IP appended by proxy)

Third request: HTTP 429 - Rate limited! ✅
```

---

## Code Review Checklist

Before merging rate-limiting or proxy-related code:

- [ ] `app.set('trust proxy', 1)` present in `server/src/app.ts`
- [ ] All rate limiters use `keyGenerator: (req) => normalizeIp(req.ip)`
- [ ] No custom `X-Forwarded-For` header parsing (let Express handle it)
- [ ] IPv6 addresses normalized to /64 prefix (see `normalizeIp()`)
- [ ] Test environment bypass uses `isTestEnvironment` check
- [ ] Rate limiter tests verify correct IP extraction

---

## Prevention Strategies

### 1. New Rate Limiter Checklist

When adding a new rate limiter:

```typescript
// ✅ CORRECT
export const newLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: isTestEnvironment ? 500 : 50, // Test bypass
  keyGenerator: (req) => normalizeIp(req.ip), // Uses req.ip, not headers
  handler: (req, res) => {
    /* error handler */
  },
});

// ❌ WRONG - Don't do this:
// - Don't parse X-Forwarded-For directly
// - Don't use req.headers['x-forwarded-for']
// - Don't check NODE_ENV === 'test' (use isTestEnvironment)
```

### 2. Security Review Checklist

When reviewing proxy or auth code:

- [ ] Is `app.set('trust proxy', ...)` configured? Check `server/src/app.ts`
- [ ] Are rate limiters using `req.ip` or custom header parsing?
- [ ] Do custom IPs use rightmost (not leftmost) value?
- [ ] Is `normalizeIp()` used for IPv6 addresses?

### 3. Testing Pattern

```typescript
// server/test/middleware/rateLimiter.spec.ts
test('should correctly extract IP from X-Forwarded-For', async () => {
  const req = createMockRequest({
    headers: {
      'x-forwarded-for': '1.2.3.4, 192.168.1.100, 76.45.67.89',
    },
  });

  // With trust proxy enabled, req.ip should be rightmost
  expect(req.ip).toBe('76.45.67.89');
  expect(normalizeIp(req.ip)).toBe('76.45.67.89');
});
```

---

## Related Documentation

- [Express Trust Proxy Docs](https://expressjs.com/en/guide/behind-proxies.html)
- [express-rate-limit GitHub](https://github.com/express-rate-limit/express-rate-limit)
- [OWASP IP Spoofing](https://owasp.org/www-community/attacks/IP_Address_Spoofing)
- [X-Forwarded-For Header Risks](https://en.wikipedia.org/wiki/X-Forwarded-For)
- [E2E Rate Limiting Testing](e2e-rate-limiting-bypass-visual-editor.md)

---

## Implementation Status

| Task                              | Status | Effort | Risk |
| --------------------------------- | ------ | ------ | ---- |
| Add `app.set('trust proxy', 1)`   | READY  | 5 min  | Low  |
| Review rate limiter keyGenerators | READY  | 10 min | Low  |
| Test on staging                   | READY  | 30 min | Low  |
| Deploy to production              | READY  | 10 min | Low  |

---

## Files Affected

- `server/src/app.ts` - Add trust proxy setting (1 line)
- `server/src/middleware/rateLimiter.ts` - Verify all use `normalizeIp(req.ip)`
- `server/test/middleware/rateLimiter.spec.ts` - Verify tests
- Documentation only - No other code changes needed

---

## Key Insight

**Don't reinvent proxy IP extraction. Let Express handle it with `trust proxy`, then use `req.ip` everywhere.** The existing `normalizeIp()` pattern is correct—it just needs the foundational Express setting to work properly.

Trust proxy is a one-line fix that enables the entire rate limiting system to work securely in production.
