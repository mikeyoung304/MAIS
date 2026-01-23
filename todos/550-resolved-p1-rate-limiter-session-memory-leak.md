---
status: complete
priority: p3
issue_id: '550'
tags: [code-review, performance, agent-ecosystem, invalidated]
dependencies: []
---

# RESOLVED: Rate Limiter sessionCounts - Finding Invalidated

> **Quality-First Triage:** Finding invalidated. "Per-session scoped, has cleanup via resetTurn(). Not a real memory leak."

## Problem Statement

The `ToolRateLimiter` class maintains `sessionCounts` that grow **unboundedly**:

```typescript
// rate-limiter.ts lines 60-61
private turnCounts: Map<string, number> = new Map();
private sessionCounts: Map<string, number> = new Map();
```

The `resetTurn()` method only clears `turnCounts`, but `sessionCounts` is **never cleared** except via `reset()` which is never called. Since orchestrators are reused across sessions, `sessionCounts` accumulates entries for every tool call across all sessions over the process lifetime.

**Why it matters:** Linear memory growth proportional to unique tool calls. With high traffic, this will cause OOM.

## Findings

| Reviewer             | Finding                                           |
| -------------------- | ------------------------------------------------- |
| Performance Reviewer | P1: sessionCounts Map never cleaned - memory leak |
| Simplicity Reviewer  | reset() method is dead code (never called)        |
| Security Reviewer    | Could enable DoS via session rate limit bypass    |

## Proposed Solutions

### Option 1: Add Session-Aware Cleanup (Recommended)

**Effort:** Small (1-2 hours)

Track sessions and clean up when they expire:

```typescript
private sessionLastSeen: Map<string, number> = new Map();

resetSession(sessionId: string): void {
  // Clear counts for specific session
  for (const [key] of this.sessionCounts) {
    if (key.startsWith(`${sessionId}:`)) {
      this.sessionCounts.delete(key);
    }
  }
}

cleanup(maxAgeMs: number = 60 * 60 * 1000): void {
  const now = Date.now();
  for (const [sessionId, lastSeen] of this.sessionLastSeen) {
    if (now - lastSeen > maxAgeMs) {
      this.resetSession(sessionId);
      this.sessionLastSeen.delete(sessionId);
    }
  }
}
```

**Pros:**

- Targeted cleanup
- Preserves active session limits

**Cons:**

- More complex implementation

### Option 2: Per-Session Rate Limiter Instances

**Effort:** Medium (3-4 hours)

Create rate limiter per session (like circuit breakers):

```typescript
// In BaseOrchestrator
private rateLimiters: Map<string, ToolRateLimiter> = new Map();
```

**Pros:**

- Clean isolation
- No cross-session pollution

**Cons:**

- More memory per session
- Need cleanup logic similar to circuit breakers

### Option 3: Key by SessionId in Existing Maps

**Effort:** Small (1-2 hours)

Change key format from `toolName` to `sessionId:toolName`:

```typescript
private getSessionKey(sessionId: string, toolName: string): string {
  return `${sessionId}:${toolName}`;
}
```

**Pros:**

- Minimal changes
- Can reuse circuit breaker cleanup pattern

**Cons:**

- sessionId must be passed to all rate limiter methods

## Recommended Action

Implement **Option 1** with cleanup called from `cleanupOldCircuitBreakers()` since they use the same cadence.

## Technical Details

**Affected Files:**

- `server/src/agent/orchestrator/rate-limiter.ts` - Add cleanup
- `server/src/agent/orchestrator/base-orchestrator.ts` - Call cleanup

**Current State:**

- `turnCounts` - Cleared every turn via `resetTurn()` ✅
- `sessionCounts` - Never cleared ❌

## Acceptance Criteria

- [ ] Add session-aware cleanup to ToolRateLimiter
- [ ] Integrate cleanup with existing circuit breaker cleanup cycle
- [ ] Add test for cleanup behavior
- [ ] Memory profile shows bounded growth

## Work Log

| Date       | Action                   | Learnings                                 |
| ---------- | ------------------------ | ----------------------------------------- |
| 2026-01-01 | Created from code review | Performance Oracle identified memory leak |

## Resources

- Related: `cleanupOldCircuitBreakers()` in base-orchestrator.ts:1072-1110
