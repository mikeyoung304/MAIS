---
status: deferred
priority: p1
issue_id: "525"
tags: [code-review, agent-ecosystem, security, rate-limiting]
dependencies: []
---

# Rate Limiter Session State Not Persisted

## Problem Statement

The `ToolRateLimiter` session counts are only stored in memory. This means rate limits reset on server restart and aren't shared across server instances in a cluster.

**Why it matters:** An attacker could bypass session-level rate limits by:
- Waiting for server restart
- Hitting different server instances in a load-balanced cluster
- Creating new connections

## Findings

### Evidence from Agent-Native Reviewer (CRITICAL)

> "The `ToolRateLimiter` is instantiated once per orchestrator instance, but session counts (`sessionCounts`) are only stored in memory. If the server restarts or the request is load-balanced to a different instance, session rate limits reset."

**Location:** `server/src/agent/orchestrator/base-orchestrator.ts` (lines 198-199)

```typescript
protected readonly rateLimiter: ToolRateLimiter;
// In constructor:
this.rateLimiter = new ToolRateLimiter(config.toolRateLimits);
```

## Proposed Solutions

### Option A: Store in Database (Recommended for correctness)
**Pros:** Persistent, works across instances
**Cons:** Adds latency, database load
**Effort:** Medium
**Risk:** Low

Store rate limit state in `AgentSession` table:
```prisma
model AgentSession {
  // existing fields...
  rateLimitState Json?  // Store tool call counts
}
```

### Option B: Store in Redis (Recommended for scale)
**Pros:** Fast, shared across instances, TTL support
**Cons:** Adds Redis dependency
**Effort:** Medium
**Risk:** Low

```typescript
const key = `ratelimit:${sessionId}:${toolName}`;
await redis.incr(key);
await redis.expire(key, sessionTtlSeconds);
```

### Option C: Document as Acceptable Risk
**Pros:** No code changes
**Cons:** Security gap remains
**Effort:** None
**Risk:** Medium

If abuse is unlikely (low traffic, trusted users), document the limitation.

## Recommended Action

<!-- To be filled during triage -->

## Technical Details

**Affected Files:**
- `server/src/agent/orchestrator/rate-limiter.ts`
- `server/src/agent/orchestrator/base-orchestrator.ts`

## Acceptance Criteria

- [ ] Rate limit state persists across server restarts
- [ ] Rate limits work correctly in multi-instance deployment
- [ ] Performance impact acceptable (<10ms added latency)
- [ ] Tests pass

## Work Log

| Date | Action | Learnings |
|------|--------|-----------|
| 2026-01-01 | Created from code review | In-memory rate limiting bypassable |

## Resources

- Code review: Agent Ecosystem Phase 3-4
- Pattern: DoorDash "Budgeting the Loop"
