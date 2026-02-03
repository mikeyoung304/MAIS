---
status: ready
priority: p2
issue_id: '5202'
tags: [code-review, testing, duplication]
dependencies: []
---

# Duplicate Booking Tests

## Problem Statement

`booking-flow.spec.ts` (150 lines) and `booking-mock.spec.ts` (185 lines) test nearly identical flows, wasting CI time.

## Findings

Both tests:

1. Navigate from home to first package
2. Select date with identical locator
3. Fill contact details
4. Click checkout
5. Verify success

**Redundant code:** ~100 lines

## Proposed Solutions

### Option A: Consolidate (Recommended)

Merge into single `booking.spec.ts`:

```typescript
test.describe('Booking Flow', () => {
  test('complete booking from homepage');
  test('validation prevents incomplete checkout');
});

test.describe('Mock Mode Verification', () => {
  test('date unavailable after booking');
});
```

**Effort:** Small (1 hour) | **Risk:** Low

## Acceptance Criteria

- [ ] Single booking test file
- [ ] No redundant test logic
- [ ] Same coverage maintained
