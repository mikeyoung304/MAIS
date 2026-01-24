---
status: ready
priority: p2
issue_id: '5200'
tags: [code-review, agent-v2, performance, resilience]
dependencies: []
---

# Retry Logic Without Exponential Backoff

## Problem Statement

Concierge's retry logic uses fixed/immediate retries without exponential backoff. If a specialist is overloaded, immediate retries worsen the situation.

**Why it matters:** Retry storms can cascade failures and delay recovery.

## Findings

**Location:** `server/src/agent-v2/deploy/concierge/src/agent.ts` (lines 482-497)

```typescript
const MAX_RETRIES = 2;
const retryState = new Map<string, number>();

function shouldRetry(taskKey: string): boolean {
  const currentRetries = retryState.get(taskKey) || 0;
  if (currentRetries >= MAX_RETRIES) return false;
  retryState.set(taskKey, currentRetries + 1);
  return true;
}
```

No delay between retries. No exponential backoff. No jitter.

## Proposed Solutions

### Option A: Add Exponential Backoff (Recommended)

**Pros:** Industry standard, prevents retry storms
**Cons:** Slightly slower recovery for transient errors
**Effort:** Small (30 min)

```typescript
async function withBackoff<T>(fn: () => Promise<T>, maxRetries = 3, baseDelayMs = 500): Promise<T> {
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      if (attempt === maxRetries) throw error;

      const delay = baseDelayMs * Math.pow(2, attempt);
      const jitter = Math.random() * 0.3 * delay; // 0-30% jitter
      await sleep(delay + jitter);
    }
  }
  throw new Error('Unreachable');
}
```

### Option B: Use Existing Library

**Pros:** Battle-tested implementation
**Cons:** Adds dependency
**Effort:** Small (20 min)

Use `p-retry` or similar library.

## Technical Details

**Affected Files:**

- `server/src/agent-v2/deploy/concierge/src/agent.ts`

## Acceptance Criteria

- [ ] Retries use exponential backoff (500ms, 1s, 2s)
- [ ] Jitter prevents thundering herd
- [ ] MAX_RETRIES remains configurable

## Work Log

| Date       | Action  | Notes                   |
| ---------- | ------- | ----------------------- |
| 2026-01-19 | Created | From performance review |
