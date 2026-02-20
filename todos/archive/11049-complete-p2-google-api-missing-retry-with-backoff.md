---
issue_id: 11049
status: pending
priority: p2
tags: [reliability, google-calendar, performance]
effort: Small
---

# P2: Google API Calls Missing Retry with Exponential Backoff

## Problem Statement

Google Calendar API calls have no retry logic for transient errors. A single transient 429 (rate limit) or 5xx (server error) from Google fails the entire booking or availability flow immediately. Given that Google APIs occasionally return transient errors, this makes the booking system fragile in a way that is entirely avoidable.

## Findings

- All Google API calls in `gcal.adapter.ts` are single-attempt with no retry wrapper.
- Google's own best practices recommend exponential backoff with jitter for 429 and 5xx responses.
- A single transient failure propagates as a hard error to the user (e.g., "Failed to create booking").
- This is especially impactful during booking confirmation — the highest-stakes moment in the user flow.

## Proposed Solutions

Add a `withRetry` utility wrapper that:

- Retries on 429 and 5xx status codes only (not 4xx client errors).
- Uses exponential backoff: `baseDelay * 2^attempt + jitter`.
- Caps at 3 attempts maximum.
- Logs each retry attempt with `logger.warn`.

```typescript
async function withRetry<T>(fn: () => Promise<T>, maxAttempts = 3): Promise<T> {
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (err) {
      if (attempt === maxAttempts - 1 || !isRetryable(err)) throw err;
      const delay = Math.min(1000 * 2 ** attempt + Math.random() * 100, 10_000);
      await sleep(delay);
    }
  }
}
```

Wrap all outbound Google API calls in `gcal.adapter.ts` with this utility.

## Acceptance Criteria

- [ ] A `withRetry` utility exists (in adapter or shared lib).
- [ ] All Google Calendar API calls in `gcal.adapter.ts` are wrapped with retry.
- [ ] Retry triggers on 429 and 5xx responses only.
- [ ] Maximum 3 attempts with exponential backoff + jitter.
- [ ] Each retry attempt is logged with attempt number and delay.
- [ ] 4xx errors are not retried (fast-fail on client errors).
- [ ] Unit tests cover: success on first attempt, success on retry, exhausted retries.

## Work Log

_(empty)_
