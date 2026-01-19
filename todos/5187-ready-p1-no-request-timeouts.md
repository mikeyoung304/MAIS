---
status: ready
priority: p1
issue_id: '5187'
tags: [code-review, agent-v2, reliability, resilience]
dependencies: []
---

# No Request Timeouts on Specialist Agent Calls

## Problem Statement

All `fetch()` calls from the Concierge to specialist agents and from agents to the MAIS backend have no timeout configuration. If a specialist agent hangs (e.g., Research agent waiting for a slow scrape), the Concierge will hang indefinitely, blocking the user's chat session and potentially exhausting connection pools.

**Why it matters:** A single slow or unresponsive specialist can cascade into a full system failure. Users experience infinite loading states with no feedback. Cloud Run will eventually kill the request (default 5 min), but that's far too long for a chat experience.

## Findings

**Source:** Agent-v2 code review

**Location 1 - Concierge sendToSpecialist:**
`/Users/mikeyoung/CODING/MAIS/server/src/agent-v2/deploy/concierge/src/agent.ts:350-441`

```typescript
async function callSpecialistAgent(
  agentUrl: string,
  agentName: string,
  message: string,
  tenantId: string,
  _parentSessionId: string
): Promise<{ ok: boolean; response?: string; error?: string }> {
  try {
    const specialistSessionId = await getOrCreateSpecialistSession(agentUrl, agentName, tenantId);
    // ...

    // NO TIMEOUT - will hang indefinitely if specialist doesn't respond
    const response = await fetch(`${agentUrl}/run`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        appName: agentName,
        userId: tenantId,
        sessionId: specialistSessionId,
        newMessage: { role: 'user', parts: [{ text: message }] },
        state: { tenantId },
      }),
    });
    // ...
  }
}
```

**Location 2 - All agents' callMaisApi:**
Multiple files (booking, research, marketing, storefront, concierge):

```typescript
async function callMaisApi(
  endpoint: string,
  tenantId: string,
  params: Record<string, unknown> = {}
): Promise<{ ok: boolean; data?: unknown; error?: string }> {
  try {
    // NO TIMEOUT - will hang indefinitely
    const response = await fetch(`${MAIS_API_URL}${AGENT_API_PATH}${endpoint}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Internal-Secret': INTERNAL_API_SECRET,
      },
      body: JSON.stringify({ tenantId, ...params }),
    });
    // ...
  }
}
```

**Location 3 - getAuthHeaders metadata fetch:**
`/Users/mikeyoung/CODING/MAIS/server/src/agent-v2/deploy/concierge/src/agent.ts:264-287`

```typescript
async function getAuthHeaders(agentUrl: string): Promise<Record<string, string>> {
  // NO TIMEOUT - metadata service usually fast but can hang
  const tokenResponse = await fetch(metadataUrl, {
    headers: { 'Metadata-Flavor': 'Google' },
  });
  // ...
}
```

**Impact Scenario:**

1. User asks "Research my competitors"
2. Concierge delegates to Research specialist
3. Research specialist tries to scrape a slow/unresponsive website
4. Research agent hangs on fetch() to scrape endpoint
5. Concierge hangs waiting for Research response
6. User sees infinite loading spinner
7. After 5 minutes, Cloud Run kills the request
8. User gets generic error, loses chat context

## Proposed Solutions

### Solution 1: AbortController with Per-Operation Timeouts (Recommended)

**Approach:** Add AbortController timeouts to all fetch calls with operation-appropriate durations

```typescript
// Utility function
function fetchWithTimeout(url: string, options: RequestInit, timeoutMs: number): Promise<Response> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  return fetch(url, {
    ...options,
    signal: controller.signal,
  }).finally(() => clearTimeout(timeoutId));
}

// Usage in callSpecialistAgent
const SPECIALIST_TIMEOUTS = {
  marketing: 30_000, // 30s - text generation
  storefront: 30_000, // 30s - structure changes
  research: 90_000, // 90s - web scraping is slow
};

const response = await fetchWithTimeout(
  `${agentUrl}/run`,
  { method: 'POST', headers, body: JSON.stringify(payload) },
  SPECIALIST_TIMEOUTS[agentName as keyof typeof SPECIALIST_TIMEOUTS] || 30_000
);

// Usage in callMaisApi
const response = await fetchWithTimeout(
  `${MAIS_API_URL}${AGENT_API_PATH}${endpoint}`,
  { method: 'POST', headers, body: JSON.stringify({ tenantId, ...params }) },
  15_000 // 15s for backend calls
);

// Usage in getAuthHeaders
const tokenResponse = await fetchWithTimeout(
  metadataUrl,
  { headers: { 'Metadata-Flavor': 'Google' } },
  5_000 // 5s for metadata service
);
```

**Pros:**

- Standard web API (AbortController)
- Operation-specific timeouts
- Clean error handling with AbortError
- No external dependencies

**Cons:**

- Must update every fetch call
- Need to handle AbortError specifically

**Effort:** 1 hour

### Solution 2: Wrapper with Retry Logic

**Approach:** Add retry with exponential backoff on timeout

```typescript
async function fetchWithRetry(
  url: string,
  options: RequestInit,
  config: {
    timeoutMs: number;
    maxRetries: number;
    backoffMs: number;
  }
): Promise<Response> {
  let lastError: Error | null = null;

  for (let attempt = 0; attempt <= config.maxRetries; attempt++) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), config.timeoutMs);

      const response = await fetch(url, {
        ...options,
        signal: controller.signal,
      });

      clearTimeout(timeoutId);
      return response;
    } catch (error) {
      lastError = error as Error;
      if (attempt < config.maxRetries) {
        await new Promise((r) => setTimeout(r, config.backoffMs * (attempt + 1)));
      }
    }
  }

  throw lastError;
}
```

**Pros:**

- Automatic retry on transient failures
- Exponential backoff prevents thundering herd
- Single wrapper handles both timeout and retry

**Cons:**

- More complex
- Longer total wait time with retries
- May retry non-idempotent operations

**Effort:** 2 hours

### Solution 3: Promise.race with Fallback Response

**Approach:** Race the fetch against a timeout promise, return graceful fallback

```typescript
async function fetchWithFallback<T>(
  fetchPromise: Promise<Response>,
  timeoutMs: number,
  fallback: T
): Promise<T | Response> {
  const timeoutPromise = new Promise<T>((resolve) => {
    setTimeout(() => resolve(fallback), timeoutMs);
  });

  return Promise.race([fetchPromise, timeoutPromise]);
}

// Usage
const response = await fetchWithFallback(
  fetch(`${agentUrl}/run`, { method: 'POST', headers, body }),
  30_000,
  { ok: false, error: 'Specialist timed out - try again?' }
);
```

**Pros:**

- Graceful degradation
- No AbortController complexity
- Returns fallback instead of throwing

**Cons:**

- Original request continues in background (resource leak)
- Fallback may not be appropriate for all operations
- Doesn't actually cancel the hanging request

**Effort:** 30 minutes

## Recommended Action

**Implement Solution 1** with operation-specific timeouts:

- Backend API calls: 15 seconds
- Marketing/Storefront specialists: 30 seconds
- Research specialist: 90 seconds (web scraping is slow)
- Metadata service: 5 seconds

Also update error handling to show user-friendly timeout messages.

## Technical Details

**Affected Files:**

- `/Users/mikeyoung/CODING/MAIS/server/src/agent-v2/deploy/concierge/src/agent.ts`
  - `getAuthHeaders` (lines 264-287)
  - `getOrCreateSpecialistSession` (lines 293-344)
  - `callSpecialistAgent` (lines 350-441)
  - `callMaisApi` (lines 228-255)
- `/Users/mikeyoung/CODING/MAIS/server/src/agent-v2/deploy/booking/src/agent.ts` - `callMaisApi`
- `/Users/mikeyoung/CODING/MAIS/server/src/agent-v2/deploy/research/src/agent.ts` - `callMaisApi`
- `/Users/mikeyoung/CODING/MAIS/server/src/agent-v2/deploy/marketing/src/agent.ts` - `callMaisApi`
- `/Users/mikeyoung/CODING/MAIS/server/src/agent-v2/deploy/storefront/src/agent.ts` - `callMaisApi`

**Related Components:**

- Cloud Run request timeout (default 5 min)
- ADK agent execution timeout
- User chat experience

**Database Schema:** No changes required

## Acceptance Criteria

- [ ] All fetch() calls use AbortController with appropriate timeout
- [ ] Timeout values are configurable via constants (not magic numbers)
- [ ] Error messages distinguish timeout from other failures
- [ ] Test: Simulate slow specialist response (mock 60s delay) - request times out at 30s
- [ ] Test: Simulate slow backend response - request times out at 15s
- [ ] Test: Metadata service timeout doesn't block agent startup
- [ ] User sees "Taking longer than expected..." message, not infinite spinner
- [ ] Add observability: log when timeouts occur with operation context

## Work Log

| Date       | Action                          | Learnings                                    |
| ---------- | ------------------------------- | -------------------------------------------- |
| 2026-01-19 | Issue identified in code review | No timeouts on any network calls in agent-v2 |

## Resources

- **MDN Documentation:** [AbortController](https://developer.mozilla.org/en-US/docs/Web/API/AbortController)
- **Related Pattern:** Circuit breaker for repeated timeouts
- **Cloud Run Docs:** [Request timeout configuration](https://cloud.google.com/run/docs/configuring/request-timeout)
- **Related Issue:** #574 (rate limiter memory for horizontal scaling)
