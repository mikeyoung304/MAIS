---
status: complete
priority: p2
issue_id: '5194'
tags: [code-review, agent-v2, security, performance]
dependencies: []
---

# No Rate Limiting on Agent-to-Backend Calls

## Problem Statement

System prompt mentions rate limits ("Scraping: 100 requests/hour, Search: 200 requests/hour") but no enforcement exists in agent code.

**Why it matters:** A runaway agent or malicious prompt could overwhelm the MAIS backend with unlimited requests.

## Findings

**Location:** `server/src/agent-v2/deploy/research/src/agent.ts` (lines 183-186)

Prompt says:

```
Rate Limits:
- Scraping: 100 requests/hour
- Search: 200 requests/hour
```

But no code implements this. Each tool just calls `callMaisApi()` without any rate tracking.

## Proposed Solutions

### Option A: Client-Side Rate Counter (Recommended)

**Pros:** Protects backend, provides clear error messages
**Cons:** Lost on cold start (acceptable)
**Effort:** Medium (1 hour)

```typescript
const rateLimits = new Map<string, { count: number; resetAt: number }>();

function checkRateLimit(operation: string, limit: number): void {
  const now = Date.now();
  const hourMs = 60 * 60 * 1000;
  const entry = rateLimits.get(operation) || { count: 0, resetAt: now + hourMs };

  if (now > entry.resetAt) {
    entry.count = 0;
    entry.resetAt = now + hourMs;
  }

  if (entry.count >= limit) {
    throw new Error(
      `Rate limit exceeded for ${operation}. Resets in ${Math.ceil((entry.resetAt - now) / 60000)} minutes.`
    );
  }

  entry.count++;
  rateLimits.set(operation, entry);
}
```

### Option B: Backend-Side Enforcement

**Pros:** Centralized, survives cold starts
**Cons:** Requires backend changes
**Effort:** Large (4 hours)

## Technical Details

**Affected Files:**

- `server/src/agent-v2/deploy/research/src/agent.ts`
- All other agent files for `callMaisApi()` rate limiting

## Acceptance Criteria

- [x] Rate limits enforced per operation type
- [x] Clear error message when limit exceeded
- [x] Limits match what's documented in system prompt

## Work Log

| Date       | Action    | Notes                                                        |
| ---------- | --------- | ------------------------------------------------------------ |
| 2026-01-19 | Created   | From performance + security review                           |
| 2026-02-15 | Completed | Option A implemented — in-memory sliding window rate limiter |
