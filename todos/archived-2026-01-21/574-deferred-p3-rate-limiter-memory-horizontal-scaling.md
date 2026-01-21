---
status: deferred
priority: p3
issue_id: '574'
tags: [code-review, architecture, scaling, redis]
dependencies: []
deferred_date: '2026-01-01'
deferred_reason: 'Only relevant when scaling horizontally. Single instance sufficient for current load.'
---

# P1: In-Memory Rate Limiter Blocks Horizontal Scaling

## Problem Statement

The AI agent's `ToolRateLimiter` stores per-session rate limits in **in-memory Maps**:

```typescript
private turnCounts: Map<string, number> = new Map();
private sessionCounts: Map<string, number> = new Map();
```

When running multiple API instances behind a load balancer:

- Each instance maintains its own counts
- Rate limits are effectively multiplied by instance count
- Users could bypass rate limits by hitting different instances

This is a **scalability blocker** for the AI agent features.

## Findings

**Location:** `/Users/mikeyoung/CODING/MAIS/server/src/agent/orchestrator/rate-limiter.ts:62-63`

**Identified by:** Architecture Strategist agent

**Impact:**

- Cannot horizontally scale AI agent features
- Rate limits ineffective in multi-instance deployment
- Potential for abuse if running multiple instances

## Proposed Solutions

### Option A: Redis-Based Rate Limiting (Recommended)

**Pros:** Distributed, accurate across instances, uses existing Redis infrastructure
**Cons:** Slight latency increase for rate checks
**Effort:** Medium (1-2 days)
**Risk:** Low

```typescript
// Use CacheServicePort for distributed rate limiting
private async incrementCount(sessionId: string, type: 'turn' | 'session'): Promise<number> {
  const key = `rate:${sessionId}:${type}`;
  return await this.cache.increment(key, 1, TTL_SECONDS);
}
```

### Option B: Token Bucket in Redis

**Pros:** More sophisticated rate limiting, smooths bursts
**Cons:** More complex implementation
**Effort:** Large
**Risk:** Medium

### Option C: External Rate Limiter (e.g., Cloudflare)

**Pros:** No code changes, scales infinitely
**Cons:** Requires infrastructure changes, less granular control
**Effort:** Medium
**Risk:** Low

## Recommended Action

**Choose Option A** - Migrate to Redis-based rate limiting using existing `CacheServicePort`

## Technical Details

**Affected files:**

- `server/src/agent/orchestrator/rate-limiter.ts` - Main changes
- `server/src/di.ts` - Inject cache service

**Database changes:** None (uses Redis)

## Acceptance Criteria

- [ ] Rate limits enforced across all instances
- [ ] Uses atomic Redis operations (INCR with TTL)
- [ ] Fallback to in-memory if Redis unavailable
- [ ] Rate limit keys include session ID: `rate:${sessionId}:${toolName}`
- [ ] All rate limiter tests pass
- [ ] Load testing confirms correct behavior with multiple instances

## Work Log

| Date       | Action  | Notes                                  |
| ---------- | ------- | -------------------------------------- |
| 2026-01-01 | Created | Found during comprehensive code review |

## Resources

- `server/src/agent/orchestrator/rate-limiter.ts` - Current implementation
- `server/src/lib/ports.ts` - CacheServicePort interface
