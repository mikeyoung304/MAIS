---
status: resolved
resolution_date: 2025-12-06
priority: p2
issue_id: '303'
tags: [code-review, frontend, ux, early-access, consistency]
dependencies: []
---

# HeroSection Waitlist Form is Mock-Only (No API Call)

## Problem Statement

The HeroSection component has a waitlist form that looks functional but doesn't actually call the API. It only shows a local success state without persisting the request. Meanwhile, the WaitlistCTASection form at the bottom of the page does call the API.

**Why it matters:**

1. Users who submit via hero form think they're signed up but aren't
2. Inconsistent behavior between two identical-looking forms
3. Loss of early access signups from users who don't scroll down

## Findings

**HeroSection form behavior:**

```typescript
// client/src/pages/Home/HeroSection.tsx
const handleSubmit = (e: React.FormEvent) => {
  e.preventDefault();
  setSubmitted(true); // Only sets local state, no API call!
};
```

**WaitlistCTASection form behavior:**

```typescript
// client/src/pages/Home/WaitlistCTASection.tsx
const handleSubmit = async (e: React.FormEvent) => {
  e.preventDefault();
  const result = await api.requestEarlyAccess({ body: { email } });
  // Handles response, persists to database
};
```

**User experience impact:**

- Hero form: Submit → "Welcome" message → **NOT saved**
- CTA form: Submit → "Welcome" message → **Saved to database**

## Proposed Solutions

### Option A: Wire HeroSection to API (Recommended)

**Pros:** Both forms work identically, no lost signups
**Cons:** Duplicate form logic (can extract to hook)
**Effort:** Small (20 min)
**Risk:** Low

```typescript
// In HeroSection.tsx - mirror WaitlistCTASection logic
const handleSubmit = async (e: React.FormEvent) => {
  e.preventDefault();
  setIsLoading(true);
  setError(null);

  try {
    const result = await api.requestEarlyAccess({ body: { email } });
    if (result.status === 200) {
      setSubmitted(true);
    } else if (result.status === 429) {
      setError('Too many requests. Please try again later.');
    } else {
      setError(
        'body' in result && 'error' in result.body ? result.body.error : 'Something went wrong'
      );
    }
  } catch (err) {
    setError('Network error. Please check your connection.');
  } finally {
    setIsLoading(false);
  }
};
```

### Option B: Extract Shared Hook

**Pros:** DRY, single source of truth
**Cons:** More refactoring
**Effort:** Medium (45 min)
**Risk:** Low

```typescript
// client/src/hooks/useWaitlistForm.ts
export function useWaitlistForm() {
  const [email, setEmail] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    // Shared logic
  };

  return { email, setEmail, submitted, isLoading, error, handleSubmit };
}

// Both components use the hook
const { email, setEmail, submitted, isLoading, error, handleSubmit } = useWaitlistForm();
```

### Option C: Remove HeroSection Form

**Pros:** Single form, no confusion
**Cons:** Removes above-the-fold CTA
**Effort:** Small (10 min)
**Risk:** Medium (UX impact)

## Recommended Action

Implement Option B - extract shared hook for consistency and DRY code.

## Technical Details

**Affected files:**

- `client/src/pages/Home/HeroSection.tsx` (wire to API or use hook)
- `client/src/pages/Home/WaitlistCTASection.tsx` (use hook)
- `client/src/hooks/useWaitlistForm.ts` (create shared hook)

## Acceptance Criteria

- [ ] Both forms call the API on submit
- [ ] Both forms handle errors identically
- [ ] Both forms show loading state
- [ ] E2E tests verify both forms work
- [ ] No duplicate form submission logic

## Work Log

| Date       | Action                   | Learnings                                         |
| ---------- | ------------------------ | ------------------------------------------------- |
| 2025-12-06 | Created from code review | Architecture-strategist identified mock-only form |

## Resources

- Related: TODO-301 (duplicate form selectors)
- Related: TODO-302 (E2E route mocking)

## Resolution

**Status:** Resolved on 2025-12-06

**Implementation Summary:**
Created a shared `useWaitlistForm` hook and wired both HeroSection and WaitlistCTASection components to call the real API on form submission. Both forms now have consistent behavior and properly persist signups to the database.

**Files Modified:**

- `client/src/hooks/useWaitlistForm.ts` - Created new shared hook with unified form logic
- `client/src/pages/Home/HeroSection.tsx` - Integrated useWaitlistForm hook
- `client/src/pages/Home/WaitlistCTASection.tsx` - Integrated useWaitlistForm hook

**Implementation Details:**

**useWaitlistForm Hook:**

```typescript
export function useWaitlistForm() {
  const [email, setEmail] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);

    try {
      const result = await api.requestEarlyAccess({ body: { email } });
      if (result.status === 200) {
        setSubmitted(true);
        setEmail('');
      } else if (result.status === 429) {
        setError('Too many requests. Please try again later.');
      } else {
        setError(
          'body' in result && 'error' in result.body ? result.body.error : 'Something went wrong'
        );
      }
    } catch (err) {
      setError('Network error. Please check your connection.');
    } finally {
      setIsLoading(false);
    }
  };

  return { email, setEmail, submitted, isLoading, error, handleSubmit };
}
```

**HeroSection Integration:**

```typescript
// Now calls real API instead of just setting local state
const { email, setEmail, submitted, isLoading, error, handleSubmit } = useWaitlistForm();
// Form properly persists signups to database
```

**WaitlistCTASection Integration:**

```typescript
// Refactored to use shared hook
const { email, setEmail, submitted, isLoading, error, handleSubmit } = useWaitlistForm();
// Consistent behavior with HeroSection
```

**Benefits:**

- No more mock-only forms - both persist to database
- Eliminates lost signups from users who submit via hero form
- DRY code - single source of truth for form logic
- Consistent behavior across both forms
- Error handling works identically on both forms
- Loading states synchronized

**User Experience Improvements:**

- Hero form (above the fold): Now captures and saves signups
- CTA form (below the fold): Behavior unchanged (already worked)
- Both show identical success, error, and loading states
- No more confusion about which form actually saves the data

**Test Coverage:**
E2E tests verify both forms now correctly call the API and persist to the database.
