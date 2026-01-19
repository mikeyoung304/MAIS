# TODO 5187 Resolution Summary: Request Timeouts on Specialist Agent Calls

## Problem

All `fetch()` calls from agents to MAIS backend and between agents had no timeout. A hanging specialist could cascade to full system failure.

## Solution Implemented

Added `AbortController`-based timeouts to all `fetch()` calls across all agent deployments.

## Changes Made

### 1. Timeout Configuration (All Agents)

Added timeout constants to all agent files:

- **BACKEND_API**: 15s for MAIS backend calls
- **SPECIALIST_DEFAULT**: 30s for marketing/storefront agents
- **SPECIALIST_RESEARCH**: 90s for research agent (web scraping)
- **METADATA_SERVICE**: 5s for GCP metadata service

### 2. fetchWithTimeout Helper (All Agents)

Added helper function to all agents:

```typescript
async function fetchWithTimeout(
  url: string,
  options: RequestInit,
  timeoutMs: number
): Promise<Response> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    return await fetch(url, {
      ...options,
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timeoutId);
  }
}
```

### 3. Updated Agents

#### Booking Agent (`/server/src/agent-v2/deploy/booking/src/agent.ts`)

- ✅ Updated `callMaisApi()` to use `fetchWithTimeout()` with `TIMEOUTS.BACKEND_API`
- ✅ Added `AbortError` handling in catch block

#### Research Agent (`/server/src/agent-v2/deploy/research/src/agent.ts`)

- ✅ Updated `callMaisApi()` to use `fetchWithTimeout()` with `TIMEOUTS.BACKEND_API`
- ✅ Added `AbortError` handling in catch block

#### Marketing Agent (`/server/src/agent-v2/deploy/marketing/src/agent.ts`)

- ✅ Updated `callMaisApi()` to use `fetchWithTimeout()` with `TIMEOUTS.BACKEND_API`
- ✅ Added `AbortError` handling in catch block

#### Storefront Agent (`/server/src/agent-v2/deploy/storefront/src/agent.ts`)

- ✅ Updated `callMaisApi()` to use `fetchWithTimeout()` with `TIMEOUTS.BACKEND_API`
- ✅ Added `AbortError` handling in catch block

#### Project-Hub Agent (`/server/src/agent-v2/deploy/project-hub/src/agent.ts`)

- ✅ Updated `callBackendAPI()` to use `fetchWithTimeout()` with `TIMEOUTS.BACKEND_API`
- ℹ️ Uses throw-based error handling (AbortErrors propagate to callers)

#### Concierge Agent (`/server/src/agent-v2/deploy/concierge/src/agent.ts`)

- ✅ Updated `callMaisApi()` to use `fetchWithTimeout()` with `TIMEOUTS.BACKEND_API`
- ✅ Updated `getAuthHeaders()` metadata service call with `TIMEOUTS.METADATA_SERVICE`
- ✅ Updated `getOrCreateSpecialistSession()` to use `fetchWithTimeout()` with `TIMEOUTS.SPECIALIST_DEFAULT`
- ✅ Updated `callSpecialistAgent()` to use dynamic timeout selection:
  - **90s** for `research_specialist` (web scraping)
  - **30s** for other specialists (marketing, storefront)
- ✅ Updated retry logic to use appropriate timeouts
- ✅ Added `AbortError` handling in all catch blocks

## Error Handling Pattern

All agents now handle `AbortError` consistently:

```typescript
} catch (error) {
  if (error instanceof Error && error.name === 'AbortError') {
    logger.error({}, '[AgentName] Backend API timeout after ${TIMEOUTS.BACKEND_API}ms');
    return { ok: false, error: 'Request timed out. Please try again.' };
  }
  logger.error({ error: error instanceof Error ? error.message : String(error) }, '[AgentName] Network error');
  return { ok: false, error: 'Network error - could not reach backend' };
}
```

## Verification

✅ **TypeScript compilation**: All changes pass `npm run typecheck`

✅ **Timeout values**:

- 15s backend calls (fast, synchronous operations)
- 30s specialist agents (LLM generation, moderate complexity)
- 90s research agent (web scraping, highest latency)
- 5s metadata service (local network, should be instant)

## Files Modified

1. `/server/src/agent-v2/deploy/concierge/src/agent.ts`
2. `/server/src/agent-v2/deploy/booking/src/agent.ts`
3. `/server/src/agent-v2/deploy/research/src/agent.ts`
4. `/server/src/agent-v2/deploy/marketing/src/agent.ts`
5. `/server/src/agent-v2/deploy/storefront/src/agent.ts`
6. `/server/src/agent-v2/deploy/project-hub/src/agent.ts`

## Prevention

This implements **Pitfall #46: No fetch timeouts** from `CLAUDE.md` and prevents cascading failures from hanging network requests.

Future agents should:

1. Always use `fetchWithTimeout()` instead of raw `fetch()`
2. Include timeout constants with appropriate values
3. Handle `AbortError` explicitly in catch blocks
4. Choose timeout values based on operation type (backend/specialist/research)
