---
status: ready
priority: p2
issue_id: '5192'
tags: [code-review, agent-v2, architecture, memory]
dependencies: []
---

# Module-Level Mutable State (Session Cache, Retry State)

## Problem Statement

Concierge agent uses module-level Maps for session caching and retry tracking. These have no TTL, grow unbounded, and are lost on Cloud Run cold starts.

**Why it matters:**

- Memory leak over time with many tenants
- Session cache lost on container restart (causes latency spike)
- Retry state shared across concurrent requests from same tenant

## Findings

**Location:** `server/src/agent-v2/deploy/concierge/src/agent.ts`

```typescript
// Line 258
const specialistSessions = new Map<string, string>();

// Line 482
const retryState = new Map<string, number>();
```

**Issues:**

1. No TTL - entries never expire
2. No size limit - unbounded growth
3. Cloud Run ephemeral - lost on cold start
4. `retryState` shared across concurrent requests

## Proposed Solutions

### Option A: Add TTL-Based Expiration (Recommended)

**Pros:** Solves memory leak, simple to implement
**Cons:** Still lost on cold start
**Effort:** Medium (1 hour)

```typescript
const SESSION_TTL_MS = 30 * 60 * 1000; // 30 minutes
const specialistSessions = new Map<string, { sessionId: string; createdAt: number }>();

function getSpecialistSession(key: string): string | undefined {
  const entry = specialistSessions.get(key);
  if (entry && Date.now() - entry.createdAt < SESSION_TTL_MS) {
    return entry.sessionId;
  }
  specialistSessions.delete(key);
  return undefined;
}
```

### Option B: Use External Cache (Redis)

**Pros:** Survives cold starts, shared across instances
**Cons:** Adds infrastructure dependency
**Effort:** Large (4 hours)

### Option C: Accept Current Behavior

**Pros:** No changes needed
**Cons:** Memory leak, potential issues at scale
**Effort:** None

## Technical Details

**Affected Files:**

- `server/src/agent-v2/deploy/concierge/src/agent.ts`

## Acceptance Criteria

- [ ] Session cache has TTL expiration
- [ ] Session cache has max size limit (e.g., 1000 entries)
- [ ] Retry state is request-scoped or has unique request IDs

## Work Log

| Date       | Action  | Notes                               |
| ---------- | ------- | ----------------------------------- |
| 2026-01-19 | Created | From architecture + security review |
