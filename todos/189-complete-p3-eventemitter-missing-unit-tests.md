---
status: complete
priority: p3
issue_id: "189"
tags: [code-review, testing, events]
dependencies: []
---

# EventEmitter Missing Unit Tests

## Problem Statement

The `InProcessEventEmitter` class has comprehensive type definitions but no dedicated unit tests for runtime behavior. Current tests only mock the emitter interface in service tests.

## Findings

**Location:** `server/src/lib/core/events.ts`

**Missing Test Coverage:**
- Error isolation (one handler error doesn't affect others)
- Multiple handlers for same event
- Async handler execution
- `clearAll()` method
- Handler registration and execution order

**Current Test Approach:**
- Services mock `EventEmitter` interface
- No tests for `InProcessEventEmitter` implementation
- `event-emitter-type-safety.ts` (in docs/examples/) is documentation, not runtime tests

**Risk Assessment:**
- Impact: Low (implementation is straightforward)
- Likelihood: Low (pattern is well-established)

## Proposed Solutions

### Solution 1: Add dedicated unit tests (Recommended)
- Create `test/lib/events.test.ts`
- Test runtime behavior
- **Pros:** Complete coverage
- **Cons:** Additional test maintenance
- **Effort:** Medium (1-2 hours)
- **Risk:** None

## Recommended Action

Implement **Solution 1** for confidence in event system.

## Technical Details

**Proposed Test File (`server/test/lib/events.test.ts`):**
```typescript
import { describe, it, expect, vi } from 'vitest';
import { InProcessEventEmitter, BookingEvents } from '../../src/lib/core/events';

describe('InProcessEventEmitter', () => {
  it('should call all handlers for an event', async () => {
    const emitter = new InProcessEventEmitter();
    const handler1 = vi.fn();
    const handler2 = vi.fn();

    emitter.subscribe(BookingEvents.PAID, handler1);
    emitter.subscribe(BookingEvents.PAID, handler2);

    await emitter.emit(BookingEvents.PAID, {
      bookingId: 'test',
      email: 'test@test.com',
      // ... other required fields
    });

    expect(handler1).toHaveBeenCalledTimes(1);
    expect(handler2).toHaveBeenCalledTimes(1);
  });

  it('should isolate handler errors', async () => {
    const emitter = new InProcessEventEmitter();
    const errorHandler = vi.fn().mockRejectedValue(new Error('Handler error'));
    const successHandler = vi.fn();

    emitter.subscribe(BookingEvents.PAID, errorHandler);
    emitter.subscribe(BookingEvents.PAID, successHandler);

    await emitter.emit(BookingEvents.PAID, { /* payload */ });

    expect(successHandler).toHaveBeenCalled(); // Still called despite error
  });

  it('should clear all handlers', () => {
    const emitter = new InProcessEventEmitter();
    const handler = vi.fn();

    emitter.subscribe(BookingEvents.PAID, handler);
    emitter.clearAll();

    // Verify handlers cleared (internal state check)
    expect(emitter['handlers'].size).toBe(0);
  });
});
```

## Acceptance Criteria

- [ ] Unit test file created for InProcessEventEmitter
- [ ] Tests cover: multiple handlers, error isolation, clearAll
- [ ] All tests pass
- [ ] Coverage report shows events.ts tested

## Work Log

| Date | Action | Notes |
|------|--------|-------|
| 2025-12-03 | Created | Found during code review of commit 45024e6 |

## Resources

- Commit: 45024e6 (introduced type-safe EventEmitter)
- Related: TODO-177 (completed - added type safety)
