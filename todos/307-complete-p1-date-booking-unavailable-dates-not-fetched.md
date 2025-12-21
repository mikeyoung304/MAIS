# P1: Missing Unavailable Dates Fetch in DateBookingWizard

## Priority: P1 Critical
## Status: pending
## Feature: DATE Booking Flow
## Category: Performance / UX

## Issue

The `unavailableDates` state is initialized as an empty array but never populated. The DayPicker calendar disables unavailable dates, but the component doesn't fetch them from the backend.

**File:** `client/src/features/storefront/DateBookingWizard.tsx:50, 239-241`

```typescript
// Line 50 - State is initialized but never updated
const [unavailableDates, setUnavailableDates] = useState<Date[]>([]);

// Line 239-241 - Used but empty
disabled={[
  { before: new Date() },
  ...unavailableDates,  // Always empty array!
]}
```

## Impact

- **Critical UX Issue:** Users can select already-booked dates
- Validation only occurs at checkout (line 148-154), causing poor UX
- Wasted API calls for dates that are already booked
- 409 conflict errors force users back to step 1

## Recommended Fix

Add a `useQuery` hook to fetch unavailable dates:

```typescript
import { api } from '@/lib/api';

// In DateBookingWizard component
const { data: unavailableDatesData } = useQuery({
  queryKey: ['unavailableDates', pkg.id],
  queryFn: async () => {
    const startDate = new Date().toISOString().split('T')[0];
    const endDate = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000)
      .toISOString().split('T')[0];

    const response = await api.getUnavailableDates({
      query: { startDate, endDate }
    });

    if (response.status === 200) {
      return response.body.dates.map(d => new Date(d));
    }
    return [];
  },
  staleTime: 5 * 60 * 1000, // 5 minutes
});

useEffect(() => {
  if (unavailableDatesData) {
    setUnavailableDates(unavailableDatesData);
  }
}, [unavailableDatesData]);
```

## Alternative

Remove the unused state and directly use the query data:

```typescript
const unavailableDates = unavailableDatesData ?? [];
```

## Testing

- Verify calendar shows unavailable dates as disabled
- Test date selection with pre-booked dates
- Verify 409 handling still works as fallback

## Review Reference
- Performance Review Finding P1 (Missing Unavailable Dates Fetch)
- Code Simplicity Review Finding P3-8 (Unused State Variable)
