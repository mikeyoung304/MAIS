---
status: pending
priority: p1
issue_id: '11033'
tags: [code-review, google-calendar, performance, reliability, booking]
---

# No HTTP Timeout on Any Google API Call — Hangs Node.js Event Loop

## Problem Statement

All 5 `fetch()` call sites that communicate with Google APIs have no timeout. If Google has a brownout or is slow, the booking request hangs indefinitely and blocks the Node.js event loop. This is on the booking critical path — a tenant's customers cannot book during a Google outage.

## Findings

- **Flagged by:** performance-oracle
- `server/src/adapters/gcal.adapter.ts` — 2 fetch calls, no timeout
- `server/src/adapters/google-calendar-sync.adapter.ts` — 2 fetch calls, no timeout
- `server/src/lib/gcal.jwt.ts` — 1 fetch call for token exchange, no timeout
- Fix: add `signal: AbortSignal.timeout(10_000)` to each fetch

## Proposed Solutions

### Option A: Add AbortSignal.timeout to Each Call (30 min)

```typescript
const response = await fetch(url, {
  signal: AbortSignal.timeout(10_000), // 10s timeout
  ...
});
```

- **Effort:** Small
- **Risk:** Low

## Recommended Action

Option A. Ship immediately.

## Acceptance Criteria

- [ ] All 5 fetch() calls in Google Calendar adapters have 10s timeout
- [ ] Timeout surfaces as a specific error type (not generic failure)
- [ ] Booking flow gracefully handles calendar timeout (proceed without calendar check rather than blocking)

## Work Log

- 2026-02-20: Flagged by performance-oracle. 5 call sites identified.
