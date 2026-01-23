---
status: complete
priority: p1
issue_id: '5244'
tags: [code-review, security, performance, pitfall-46]
dependencies: []
triage_batch: 2
triage_decision: RESOLVE - Create fetchWithTimeout utility, apply to 4 locations
---

# P1: Missing Fetch Timeouts on ADK Agent Calls

## Problem Statement

Multiple `fetch()` calls to the Concierge agent (ADK Cloud Run) have no timeout. Per CLAUDE.md Pitfall #46: "All `fetch()` calls need `AbortController` timeouts; 15s backend, 30s agents."

**Why it matters:** A slow or unresponsive external service could cause request handlers to hang indefinitely, exhausting connection pools and causing denial of service.

## Findings

**Files with missing timeouts:**

1. `server/src/services/vertex-agent.service.ts:139-154` - Session creation
2. `server/src/services/vertex-agent.service.ts:323-342` - Send message to /run
3. `server/src/services/vertex-agent.service.ts:461-476` - sendMessageToADK helper
4. `server/src/services/vertex-agent.service.ts:611-622` - createADKSession

**Example of missing timeout:**

```typescript
const response = await fetch(
  `${CONCIERGE_AGENT_URL}/apps/agent/users/${encodeURIComponent(adkUserId)}/sessions`,
  {
    method: 'POST',
    headers: { ... },
    body: JSON.stringify({ state: { tenantId } }),
  }
);  // No timeout - could hang indefinitely
```

**Flagged by:**

- Security reviewer: P3 - Availability concern
- Architecture reviewer: P2 - Missing fetch timeouts
- TypeScript reviewer: P2 - Missing fetch timeout

## Proposed Solutions

### Option A: AbortController with 30s timeout (Recommended)

**Pros:** Standard pattern, matches project conventions for agent calls
**Cons:** Adds boilerplate to each fetch call
**Effort:** Small
**Risk:** Low

```typescript
const controller = new AbortController();
const timeoutId = setTimeout(() => controller.abort(), 30_000);

try {
  const response = await fetch(url, {
    signal: controller.signal,
    method: 'POST',
    headers: { ... },
    body: JSON.stringify({ ... }),
  });
  // ... handle response
} finally {
  clearTimeout(timeoutId);
}
```

### Option B: Create a fetchWithTimeout utility

**Pros:** DRY, consistent timeout handling
**Cons:** Additional abstraction
**Effort:** Small
**Risk:** Low

```typescript
async function fetchWithTimeout(url: string, options: RequestInit, timeoutMs: number) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } finally {
    clearTimeout(timeoutId);
  }
}
```

## Recommended Action

Option B - Create a utility function and use it consistently across all ADK fetch calls.

## Technical Details

**Affected files:**

- `server/src/services/vertex-agent.service.ts` (4 locations)

**Timeout values per project convention:**

- Backend calls: 15s
- Agent calls: 30s
- Scraping: 90s

## Acceptance Criteria

- [ ] All fetch calls in vertex-agent.service.ts have AbortController timeouts
- [ ] Timeout is 30 seconds for agent calls
- [ ] AbortError is caught and returned as user-friendly error message
- [ ] Existing tests pass

## Work Log

| Date       | Action                   | Result  |
| ---------- | ------------------------ | ------- |
| 2026-01-22 | Created from code review | Pending |

## Resources

- [CLAUDE.md Pitfall #46](CLAUDE.md)
- [MDN AbortController](https://developer.mozilla.org/en-US/docs/Web/API/AbortController)
