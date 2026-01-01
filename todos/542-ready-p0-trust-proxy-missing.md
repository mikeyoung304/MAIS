---
status: ready
priority: p0
issue_id: "542"
tags: [code-review, security, rate-limiting, express]
dependencies: []
---

# Trust Proxy Configuration Missing

## Problem Statement

The rate limiter in `public-customer-chat.routes.ts` uses `X-Forwarded-For` header to extract client IPs, but Express `trust proxy` setting is not enabled. Behind reverse proxies (Vercel, Cloudflare, AWS ALB), this makes rate limiting ineffective.

## Findings

**Security Sentinel:**
> "IP rate limiter uses `X-Forwarded-For` header without enabling Express `trust proxy` setting. This makes the rate limiter ineffective behind reverse proxies."

**Evidence:**
```typescript
// public-customer-chat.routes.ts:37-44
keyGenerator: (req: Request) => {
  const forwarded = req.headers['x-forwarded-for'];
  if (typeof forwarded === 'string') {
    return forwarded.split(',')[0].trim(); // Won't work without trust proxy
  }
  return req.ip || 'unknown';
}
```

**Impact:**
- All requests from proxy appear to originate from proxy IP
- Rate limiting applies globally instead of per-client
- Production deployment on Vercel is affected

## Proposed Solutions

### Option A: Add trust proxy setting (Recommended)
Add `app.set('trust proxy', 1)` to `server/src/app.ts` before middleware.

**Pros:** Simple one-line fix, enables req.ip to work correctly
**Cons:** None
**Effort:** Small (5 min)
**Risk:** Low

### Option B: Use express-rate-limit built-in handling
Remove custom keyGenerator, let express-rate-limit handle IP extraction with trust proxy enabled.

**Pros:** Cleaner code, battle-tested IP extraction
**Cons:** Still requires trust proxy setting
**Effort:** Small (10 min)
**Risk:** Low

## Recommended Action

Option A - Add `app.set('trust proxy', 1)` to app.ts

## Technical Details

**Affected Files:**
- `server/src/app.ts` - Add trust proxy setting
- `server/src/routes/public-customer-chat.routes.ts` - Currently has custom keyGenerator

## Acceptance Criteria

- [ ] `app.set('trust proxy', 1)` added to app.ts
- [ ] Rate limiter correctly identifies client IPs behind proxy
- [ ] Verified in Vercel deployment

## Work Log

| Date | Action | Learnings |
|------|--------|-----------|
| 2026-01-01 | Created from code review | Trust proxy required for X-Forwarded-For |

## Resources

- [Express trust proxy docs](https://expressjs.com/en/guide/behind-proxies.html)
- [express-rate-limit proxy handling](https://github.com/express-rate-limit/express-rate-limit#extracting-a-specific-ip-address-from-a-header)
