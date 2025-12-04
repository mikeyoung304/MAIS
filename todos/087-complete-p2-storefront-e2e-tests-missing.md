---
status: complete
priority: p2
issue_id: "087"
tags:
  - code-review
  - testing
  - e2e
  - storefront
dependencies: []
resolution: "Created comprehensive e2e/tests/storefront.spec.ts with tests for navigation, tier display, responsive layout, and image handling"
completed_date: "2025-11-30"
---

# Missing E2E Tests for Storefront Components

## Problem Statement

The storefront refactoring introduces significant new functionality with NO test coverage:
- 1-segment auto-skip navigation
- "Most Popular" badge conditional logic (only when 3 tiers)
- Image fallback handling
- Responsive grid layouts

Without tests, regressions could go undetected.

## Findings

### Discovery
Test coverage analysis found zero tests for:

1. **TierCard API change** - `highlighted` replaced with `totalTierCount`
2. **Badge logic** - Only shows when exactly 3 tiers AND middle tier
3. **Navigation** - 0-segment redirect, 1-segment skip, 2+ segment display
4. **Image fallback** - Gradient when heroImage/photoUrl null
5. **Grid layout** - Responsive columns based on item count

### Current Test Files
- `e2e/tests/booking-flow.spec.ts` - Uses legacy `/` route, not `/storefront`
- `e2e/tests/booking-mock.spec.ts` - Mock mode testing
- No storefront-specific test file exists

### Impact
- High risk of regressions
- No confidence in conditional logic
- Edge cases untested

## Proposed Solutions

### Solution 1: Create comprehensive E2E test file (RECOMMENDED)

Create `e2e/tests/storefront.spec.ts` with these scenarios:

```typescript
test.describe('Storefront', () => {
  test.describe('Segment Navigation', () => {
    test('0 segments redirects to /tiers');
    test('1 segment auto-skips to /s/{slug}');
    test('2+ segments shows segment selector');
    test('back button works after 1-segment skip');
  });

  test.describe('Tier Display', () => {
    test('3 tiers shows Most Popular badge on middle');
    test('2 tiers shows NO badge');
    test('1 tier shows single centered card');
  });

  test.describe('Image Handling', () => {
    test('missing heroImage shows gradient fallback');
    test('missing photoUrl shows gradient fallback');
  });

  test.describe('Grid Layout', () => {
    test('1 item centered with max-w-2xl');
    test('2 items in 2-column grid');
    test('3+ items in 3-column grid');
  });
});
```

**Pros:**
- Comprehensive coverage
- Documents expected behavior
- Catches regressions

**Cons:**
- Requires test data setup
- Adds CI time

**Effort:** Medium (2-3 hours)
**Risk:** Low

### Solution 2: Add minimal smoke tests

Cover only critical paths: navigation and badge logic.

**Pros:**
- Faster to implement
- Covers highest-risk areas

**Cons:**
- Edge cases still untested

**Effort:** Small (1 hour)
**Risk:** Medium

## Recommended Action

<!-- To be filled during triage -->

## Technical Details

### Affected Files
- `e2e/tests/storefront.spec.ts` (NEW)

### Components
- StorefrontHome
- TierSelector
- TierCard
- SegmentCard
- ChoiceCardBase

### Database Changes
None (may need test fixtures)

## Acceptance Criteria

- [ ] E2E test file created
- [ ] 0/1/2+ segment navigation tested
- [ ] Badge logic tested (3 tiers vs fewer)
- [ ] Image fallback tested
- [ ] All tests pass in CI
- [ ] Tests documented with clear descriptions

## Work Log

| Date | Action | Learnings |
|------|--------|-----------|
| 2025-11-29 | Created during code review | Test coverage analysis found zero storefront tests |

## Resources

- Playwright docs: https://playwright.dev/docs/intro
- Existing E2E patterns: `e2e/tests/booking-flow.spec.ts`
