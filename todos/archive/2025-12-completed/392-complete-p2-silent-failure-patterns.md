---
status: complete
priority: p2
issue_id: '392'
tags:
  - ux
  - error-handling
  - code-review
dependencies: []
---

# Fix Silent Failure Patterns in Dashboard and Date Selection

## Problem Statement

Several components silently swallow errors and show default/empty states instead of informing users that something went wrong. This creates confusion when the API is down or returning errors.

## Findings

**1. Dashboard Stats Silent Failure**

- **File:** `apps/web/src/app/(protected)/tenant/dashboard/page.tsx` (lines 100-107)
- **Issue:** Shows "0" for all stats when API fails
- **User sees:** Empty dashboard with zeros
- **Should see:** Error message with retry option

```typescript
// Current behavior
catch (error) {
  setStats({ packagesCount: 0, bookingsCount: 0, ... });  // Silent fail
}
```

**2. Date Availability Silent Failure**

- **File:** `apps/web/src/components/booking/DateBookingWizard.tsx` (lines 379-395)
- **Issue:** No try/catch around `checkDateAvailability()` call
- **User sees:** Date selection appears to do nothing
- **Should see:** Error toast or inline message

**3. Dashboard Slug Resolution**

- **File:** `apps/web/src/app/(protected)/tenant/dashboard/page.tsx` (lines 48-59)
- **Issue:** If slug fetch fails, links render as `/t/null`
- **User sees:** Broken navigation links
- **Should see:** Error state or loading state

## Proposed Solutions

### Option 1: Add error states to each component (Recommended)

- Add `error` state alongside `loading` state
- Show error UI when API fails
- Include retry button

**Pros:** Clear user feedback, matches UX patterns elsewhere
**Cons:** More UI states to maintain
**Effort:** Medium
**Risk:** Low

### Option 2: Use React Error Boundaries

- Let errors propagate to error.tsx
- Simpler component code

**Pros:** Less code in components
**Cons:** Full page error instead of inline
**Effort:** Small
**Risk:** Low

## Recommended Action

Option 1 - Add proper error states with retry

## Technical Details

**Example pattern:**

```typescript
const [error, setError] = useState<string | null>(null);

if (error) {
  return (
    <Card className="p-6 text-center">
      <AlertCircle className="w-8 h-8 text-red-500 mx-auto mb-2" />
      <p className="text-red-700 mb-4">{error}</p>
      <Button onClick={() => { setError(null); fetchData(); }}>
        Try Again
      </Button>
    </Card>
  );
}
```

## Acceptance Criteria

- [ ] Dashboard shows error state when API fails
- [ ] Date selection shows error when availability check fails
- [ ] Slug resolution shows error/loading state
- [ ] All error states have retry buttons
- [ ] Error messages are user-friendly

## Work Log

| Date       | Action                        | Learnings                                 |
| ---------- | ----------------------------- | ----------------------------------------- |
| 2025-12-25 | Created from multi-agent scan | Found during error handling gaps analysis |

## Resources

- UX patterns for error states
- Existing error card patterns in codebase
