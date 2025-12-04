---
status: complete
priority: p2
issue_id: "032"
tags: [code-review, devops, monitoring, sentry]
dependencies: []
resolved_date: 2025-12-02
---

# Sentry Sample Rates Too Low - Missing 90% of Traces

## Problem Statement

Sentry tracing and profiling sample rates default to 0.1 (10%), meaning 90% of traces are never captured. This creates blind spots in production monitoring.

**Why this matters:** Cannot debug performance issues or track error patterns without adequate sampling.

## Findings

### Code Evidence

**Location:** `server/src/lib/errors/sentry.ts:42-43`

```typescript
tracesSampleRate: config?.tracesSampleRate || 0.1,      // 10%
profilesSampleRate: config?.profilesSampleRate || 0.1,   // 10%
```

### Additional Issues

- `beforeSend` only filters `isOperational` errors
- 404s and 429s go to Sentry, creating noise
- Health check failures may spam Sentry

## Proposed Solutions

### Option A: Increase Rates and Add Filtering (Recommended)
**Effort:** Small | **Risk:** Low

```typescript
tracesSampleRate: config?.tracesSampleRate || 0.5,  // 50%
profilesSampleRate: config?.profilesSampleRate || 0.1,

beforeSend(event, hint) {
  if (event.request?.url?.includes('/health')) return null;
  if (event.statusCode === 404) return null;
  if (event.statusCode === 429) return null;
  // ... existing filtering
}
```

## Acceptance Criteria

- [x] Trace sample rate increased to 50% (server + client)
- [x] Health check requests filtered out
- [x] 404/429 responses not sent to Sentry
- [x] Environment variable override works

## Work Log

| Date | Action | Notes |
|------|--------|-------|
| 2025-11-27 | Created | Found during DevOps analysis |
| 2025-12-02 | Resolved | Server config already updated, applied same changes to client |

## Resolution Summary

**Changes Applied:**

1. **Server (`server/src/lib/errors/sentry.ts`):**
   - ✅ Already updated with tracesSampleRate: 0.5 (50%)
   - ✅ Already filtering health checks, 404s, and 429s
   - ✅ Environment variable overrides working via SentryConfig

2. **Client (`client/src/lib/sentry.ts`):**
   - ✅ Updated tracesSampleRate from 0.1 → 0.5 (50%)
   - ✅ Added comment explaining monitoring coverage improvement
   - ✅ Environment variable overrides already supported

**Impact:**
- 5x improvement in trace capture rate (10% → 50%)
- Reduced noise from operational events (health checks, 404s, 429s)
- Better production observability for performance debugging
- No breaking changes to existing functionality
