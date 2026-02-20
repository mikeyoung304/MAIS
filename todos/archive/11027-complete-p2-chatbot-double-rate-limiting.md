---
status: pending
priority: p2
issue_id: '11027'
tags: [code-review, customer-agent, chatbot, rate-limiting]
dependencies: []
---

# 11027: Double Rate Limiting on Chat Routes

## Problem Statement

The `/v1/public/chat/*` routes are rate-limited twice — once at the router level and
once at the mount point. This wastes a middleware slot on every request and makes the
effective limits unpredictable. Whichever limit is hit first wins, but both counters
increment, so a user consuming their budget against the inner limiter also drains the
outer one.

## Findings

**File:** `server/src/routes/public-customer-chat.routes.ts:55`

```typescript
// Inner limiter — applied to all routes inside this router
router.use(publicChatRateLimiter); // 50 req / 15 min per IP
```

**File:** `server/src/routes/index.ts:681` (mount point)

```typescript
// Outer limiter — also applied to all /v1/public/chat/* routes
app.use('/v1/public/chat', customerChatLimiter, publicCustomerChatRoutes);
```

Both limiters run on every request. The outer `customerChatLimiter` is the authoritative
one (closest to the network edge). The inner `publicChatRateLimiter` is redundant.

## Proposed Solutions

### Option A — Remove inner limiter (Recommended)

Delete the `router.use(publicChatRateLimiter)` line from `public-customer-chat.routes.ts`.
The outer `customerChatLimiter` in `index.ts` is sufficient.

**Pros:** Simple, correct, eliminates the confusion.
**Cons:** None — the outer limiter already provides the same protection.
**Effort:** Trivial
**Risk:** None

### Option B — Remove outer limiter at mount point

Keep the inner one, remove the outer one from `index.ts`.

**Pros:** Keeps the rate limiting config collocated with the route file.
**Cons:** Less visible — requires reading the route file to know what rate limiting applies.
**Effort:** Trivial
**Risk:** None

## Recommended Action

Option A — keep rate limiting at the mount point where it's visible to the router
configuration. The inner router limiter was likely added defensively but is now redundant.

## Acceptance Criteria

- [ ] Only one rate limiter applies to `/v1/public/chat/*` requests
- [ ] Rate limit behavior unchanged (same limits, same keys)
- [ ] Typecheck passes: `npm run --workspace=server typecheck`

## Work Log

- 2026-02-20: Found during customer chatbot end-to-end review.
