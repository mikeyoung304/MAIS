---
status: deferred
priority: p3
issue_id: '160'
tags: [code-review, performance, mvp-gaps, reminders, optimization]
dependencies: []
---

# Batch Email Sending for Reminders (DEFERRED)

## Problem Statement

Reminders are sent individually via Postmark API. Postmark supports batch sending up to 500 emails per call.

**Original expectation:**

- 10 reminders = 10 API calls = ~5 seconds
- Batch would reduce to ~0.5 seconds
- Better scalability

## Decision: DEFER (Premature Optimization)

### Analysis Summary

This is **premature optimization** for the following reasons:

**1. Low Real-World Volume**

- MVP: ~5 active tenants with minimal reminder volume
- Typical batch size: 10 (default), max 100 per request
- No production metrics indicate reminders are a bottleneck

**2. Lazy Evaluation Pattern**

- Reminders only process on-demand when tenant admin visits dashboard
- Not critical path (non-blocking)
- Not triggered by cron jobs or background tasks
- User won't perceive 2-5 second vs 0.5 second difference in admin UI

**3. Architecture Incompatibility**

- Current design uses event-driven model (one event per reminder)
- Postmark batch API requires collecting multiple emails first
- Batch implementation would require:
  - Event aggregation/buffering layer
  - Retry logic for partial batch failures
  - Deferred email sending (breaks synchronous event model)

**4. Minimal Expected Gain**

- Theoretical: 4-10x faster (2-5s → 0.5s for 10 reminders)
- Practical: User sees response in ~1s either way (HTTP latency dominates)
- Not user-facing performance issue

### When to Revisit

Batch optimization becomes worthwhile if/when:

- Production data shows >100 daily reminders across tenants
- Moving to scheduled reminders (cron-based) instead of lazy evaluation
- Implementing background job queue (Bull/BullMQ for retry, scheduling)
- Postmark API rate limits become a concern
- Combined with Phase 2 feature work (TODO #039 - reminder queue system)

### Related TODOs

- **TODO #039:** Graceful shutdown timeout (queues)
- **TODO #095:** Rate limit timing enumeration (API throttling discussion)
- **DECISION:** Use lazy evaluation + in-memory events (MVP pattern)

### Implementation Notes (for future reference)

If this becomes necessary, the changes would be:

**PostmarkMailAdapter (new method):**

```typescript
async sendBatch(emails: Array<{ to: string; payload: ReminderPayload }>): Promise<void> {
  // Use Postmark's /email/batch endpoint
  // https://postmarkapp.com/developer/api/email-api#send-batch
}
```

**Reminder service (refactor required):**

- Collect events before emitting batch send
- Handle partial failures (failed emails in batch)
- Maintain individual success/failure tracking per reminder

**Trade-offs:**

- Adds event buffering complexity
- Changes error handling semantics
- Requires transaction-like retry logic

## Status Timeline

- **Created:** Initial review identified as "nice-to-have"
- **Deferred:** Optimization not needed for MVP (2025-12-03)
- **Next Review:** When reminder volume exceeds 100/day or moving to background queue architecture

## Acceptance Criteria (DEFERRED - Not implementing)

- [x] Analysis complete: Premature optimization confirmed
- [x] Decision documented: Defer until production metrics justify it
- [x] Related work identified: TODO #039, #095, scheduler implementation
