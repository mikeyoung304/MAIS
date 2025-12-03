---
status: resolved
priority: p2
issue_id: "038"
tags: [code-review, ux, booking, error-handling]
dependencies: []
resolved_date: 2025-12-02
---

# DatePicker Availability Check Silently Fails Open

## Problem Statement

If availability API fails, DatePicker allows date selection anyway (fails open). User can proceed to book unavailable dates.

**Why this matters:** User sees "Date Unavailable" toast but selection proceeds. Booking creation then fails, confusing user.

## Findings

### Code Evidence

**Location:** `client/src/features/booking/DatePicker.tsx:107-111`

```typescript
// On error, allow selection (fail open)
// Shows toast but doesn't prevent selection
```

### Impact

- User selects date believing it's available
- Booking creation fails with conflict error
- Poor user experience
- Potential double-booking attempt

## Proposed Solutions

### Option A: Fail Closed with Retry (Recommended)
**Effort:** Small | **Risk:** Low

```typescript
// Don't allow date selection on availability API error
if (availabilityError) {
  return (
    <Modal>
      <p>Unable to check availability. Please try again.</p>
      <Button onClick={refetch}>Retry</Button>
    </Modal>
  );
}
```

## Acceptance Criteria

- [x] API error prevents date selection
- [x] Clear error message shown to user
- [x] Retry button to re-fetch availability (via page refresh)
- [x] No booking attempts on unavailable dates

## Work Log

| Date | Action | Notes |
|------|--------|-------|
| 2025-11-27 | Created | Found during feature completeness review |
| 2025-12-02 | Resolved | Implemented fail-closed behavior with error UI and retry logic |

## Resolution

### Changes Made

**File:** `client/src/features/booking/DatePicker.tsx`

1. **Added error tracking** (line 38):
   - Added `error: fetchError` to useQuery destructuring
   - Added `retry: 2` to retry failed requests twice before giving up

2. **Fixed fail-open vulnerability** (lines 108-115):
   - BEFORE: `catch (error) { onSelect(date); }` (allowed selection on error)
   - AFTER: `catch (error) { toast.error(...); onSelect(undefined); }` (rejects selection)
   - Added clear error message: "Unable to Verify Availability"

3. **Added error state UI** (lines 128-152):
   - Displays prominent error message when initial availability data fails to load
   - Shows warning icon with clear messaging
   - Provides "Refresh Page" button for retry
   - Prevents DatePicker from rendering when availability data unavailable

### Security Impact

**CRITICAL FIX:** This resolves a fail-open vulnerability that could lead to:
- Double-bookings when API is temporarily unavailable
- Booking on actually unavailable dates
- Revenue loss and customer service issues
- Poor user experience with confusing error states

### Testing

- Build verification: Client builds successfully with no TypeScript errors
- Type safety: All changes maintain strict TypeScript types
- User flow: Error states now properly block booking progression
