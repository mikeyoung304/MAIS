---
status: pending
priority: p2
issue_id: '5179'
tags: [code-review, performance, dos, rate-limiting, agent-system]
dependencies: []
---

# Missing Rate Limiting for Agent Read Tools (DoS Risk)

## Problem Statement

Agent read tools (`get_packages`, `get_bookings`, `get_customers`) execute expensive database queries without per-tool rate limiting. Malicious tenants can flood the system with read queries, exhausting database connections and degrading performance for all users.

**Why it matters:** Without rate limiting:

- Single malicious tenant can DoS entire platform
- Database connection pool exhaustion
- Increased infrastructure costs (auto-scaling triggers)
- Poor experience for legitimate users

## Findings

**Source:** Security Sentinel agent review (agent ID: a9f11fa)

**Current Rate Limits:**

- Upload endpoints: 200/hour per IP, 50/hour per tenant ✅
- Draft autosave: 60/hour per tenant ✅
- **Agent chat endpoint: NONE** ❌

**Vulnerable Endpoints:**

- `POST /api/tenant-admin/agent/chat` (admin agent)
- `POST /api/customer-chat` (customer agent)
- `POST /api/onboarding-agent/chat` (onboarding agent)

**Exploit Scenario:**

```javascript
// Attacker script - flood get_customers tool
for (let i = 0; i < 10000; i++) {
  await fetch('/api/tenant-admin/agent/chat', {
    method: 'POST',
    body: JSON.stringify({
      message: 'Show me all customers',
      sessionId: 'attack-session',
    }),
  });
}

// Each call executes:
// 1. prisma.customer.findMany() - full table scan
// 2. prisma.booking.groupBy() - aggregation query
// 3. No rate limit → 10,000 queries flood database
```

**Attack Impact:**

```
Time 0s:  Attacker starts flood
Time 5s:  Database connection pool saturated (100/100 connections)
Time 10s: Legitimate users see "connection timeout" errors
Time 30s: Auto-scaling triggers (increased costs)
Time 60s: Platform degraded for ALL tenants
```

**Current Mitigation:** Tool rate limiting exists per-session but NO HTTP-level rate limiting

**Existing Tool Limits (per session):**

```typescript
// From DEFAULT_TOOL_RATE_LIMITS
get_packages: { maxPerTurn: 5, maxPerSession: 50 }
get_bookings: { maxPerTurn: 3, maxPerSession: 30 }
get_customers: { maxPerTurn: 3, maxPerSession: 20 }
```

**Problem:** Attacker can create infinite sessions to bypass session limits!

## Proposed Solutions

### Solution 1: HTTP-Level Rate Limiter for Agent Chat (Recommended)

**Approach:** Add express-rate-limit middleware to agent endpoints

```typescript
// server/src/middleware/rateLimiter.ts

export const agentChatLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute window
  max: 30, // 30 agent messages per minute per tenant
  keyGenerator: (req) => {
    // Rate limit by tenant (from JWT)
    const tenantId = req.locals?.tenantAuth?.tenantId || req.ip;
    return `agent-chat:${tenantId}`;
  },
  skip: (req) => {
    // Bypass in test environment
    return process.env.NODE_ENV === 'test' || process.env.E2E_TEST === '1';
  },
  message: {
    error: 'Too many agent messages. Please slow down and try again in a minute.',
  },
  standardHeaders: true,
  legacyHeaders: false,
});
```

**Apply to Routes:**

```typescript
// server/src/routes/tenant-admin.routes.ts
router.post('/agent/chat', agentChatLimiter, async (req, res) => {
  // Agent orchestrator...
});

// server/src/routes/customer.routes.ts
router.post('/customer-chat', agentChatLimiter, async (req, res) => {
  // Customer agent...
});
```

**Pros:**

- Simple to implement
- Works across all agent types
- Prevents session creation flood
- Standard HTTP rate limiting

**Cons:**

- Applies to ALL agent messages (read + write)

**Effort:** 30 minutes
**Risk:** LOW

### Solution 2: Separate Limits for Read vs Write Tools

**Approach:** Higher limit for read tools, stricter for write tools

```typescript
export const agentReadLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 50, // 50 read operations/minute
  // ...
});

export const agentWriteLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 20, // 20 write operations/minute
  // ...
});
```

**Implementation:**

- Detect tool type from request body
- Apply appropriate limiter dynamically

**Pros:**

- More granular control
- Doesn't penalize read-heavy legitimate usage

**Cons:**

- More complex implementation
- Requires parsing request body for rate limit decision

**Effort:** 1-2 hours
**Risk:** MEDIUM

### Solution 3: Database Query Timeout + Connection Limits

**Approach:** Add hard limits at database level

```typescript
// prisma/schema.prisma
datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

// Add to Prisma client instantiation
const prisma = new PrismaClient({
  datasources: {
    db: {
      url: process.env.DATABASE_URL + '?connection_limit=10&pool_timeout=5',
    },
  },
});
```

**Pros:**

- Hard ceiling on resource usage
- Protects database regardless of application logic

**Cons:**

- Doesn't prevent the attack, only limits damage
- May cause legitimate queries to time out

**Effort:** 15 minutes
**Risk:** MEDIUM - May affect legitimate traffic

## Recommended Action

**Implement Solution 1 immediately**, then monitor metrics for 1 week.

**If needed:** Add Solution 3 as additional safety layer.

**Defer:** Solution 2 (complex, marginal benefit over Solution 1)

## Technical Details

**Affected Files:**

- `/Users/mikeyoung/CODING/MAIS/server/src/routes/tenant-admin.routes.ts` (admin agent endpoint)
- `/Users/mikeyoung/CODING/MAIS/server/src/routes/customer.routes.ts` (customer agent endpoint)
- `/Users/mikeyoung/CODING/MAIS/server/src/agent/onboarding/index.ts` (onboarding agent endpoint)

**Metrics to Monitor:**

```prometheus
# Add these to agent metrics
agent_http_rate_limit_hits_total{endpoint, tenant_id}
agent_tool_query_duration_seconds{tool_name, quantile}
database_connection_pool_usage{status}
```

**Testing:**

- Load test: 100 concurrent requests to `/agent/chat`
- Verify: Rate limiter blocks after 30/minute
- Verify: 429 status code with helpful error message

## Acceptance Criteria

- [ ] HTTP rate limiter added to all agent chat endpoints
- [ ] Limit: 30 messages/minute per tenant
- [ ] Test environment bypass: `E2E_TEST=1` skips rate limit
- [ ] Load test: 100 concurrent requests → 429 after 30 succeed
- [ ] Metrics: Track rate limit hits by tenant
- [ ] Error message: User-friendly explanation + retry guidance
- [ ] Documentation: Rate limits in API docs

## Work Log

| Date       | Action                                        | Learnings                                     |
| ---------- | --------------------------------------------- | --------------------------------------------- |
| 2026-01-11 | Security audit identified missing rate limits | Agent endpoints have no HTTP-level protection |

## Resources

- **Security Review:** Security Sentinel agent (ID: a9f11fa)
- **Existing Pattern:** `server/src/middleware/rateLimiter.ts` (upload rate limits)
- **Tool Limits:** `server/src/agent/orchestrator/rate-limiter.ts:DEFAULT_TOOL_RATE_LIMITS`
- **Related:** Known Pitfall #21 (E2E tests need rate limit bypass)
