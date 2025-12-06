---
status: resolved
priority: p1
issue_id: "290"
tags: [code-review, ux, error-handling, early-access, frontend]
dependencies: []
resolved_at: 2025-12-06
resolution: "Added error state management and error display UI with role='alert' in WaitlistCTASection.tsx"
---

# No Error Feedback to User on Early Access Form

## Problem Statement

The waitlist form shows no feedback when API calls fail. Users see the spinner stop but receive no indication of success or failure, leading to confusion and duplicate submissions.

**Why it matters:** Users don't know if their request was received. They may retry multiple times or think the site is broken.

## Findings

**File:** `client/src/pages/Home/WaitlistCTASection.tsx` (lines 17-30)

```typescript
const handleSubmit = async (e: React.FormEvent) => {
  e.preventDefault();
  if (!email || isSubmitting) return;

  setIsSubmitting(true);
  try {
    const response = await api.requestEarlyAccess(email);
    if (response.status === 200) {
      setSubmitted(true);
    }
    // ⚠️ NO ELSE - user sees nothing on error
  } finally {
    setIsSubmitting(false);
  }
};
```

**Affected scenarios:**
- API returns 400 (validation error) → silent failure
- API returns 429 (rate limit) → silent failure
- API returns 500 (server error) → silent failure
- Network timeout/failure → silent failure

## Proposed Solutions

### Option A: Add Error State (Recommended)
**Pros:** Complete user feedback
**Cons:** Additional state management
**Effort:** Small (20 min)
**Risk:** Low

```typescript
const [error, setError] = useState<string | null>(null);

const handleSubmit = async (e: React.FormEvent) => {
  e.preventDefault();
  if (!email || isSubmitting) return;

  setIsSubmitting(true);
  setError(null);

  try {
    const response = await api.requestEarlyAccess(email);
    if (response.status === 200) {
      setSubmitted(true);
    } else if (response.status === 429) {
      setError("Too many requests. Please try again later.");
    } else {
      setError("Something went wrong. Please try again.");
    }
  } catch (err) {
    setError("Network error. Please check your connection.");
  } finally {
    setIsSubmitting(false);
  }
};

// In JSX:
{error && (
  <div role="alert" className="mt-4 p-4 bg-white/10 rounded-2xl text-white text-sm">
    {error}
  </div>
)}
```

## Recommended Action

Implement Option A - add error state and display.

## Technical Details

**Affected files:**
- `client/src/pages/Home/WaitlistCTASection.tsx`

**Pattern reference:** `client/src/features/auth/SignupForm.tsx` (lines 141-147) shows proper error handling

## Acceptance Criteria

- [x] User sees error message on API failure (400, 429, 500)
- [x] User sees error message on network failure
- [x] Error message is accessible (role="alert")
- [x] Error clears when user tries again (setError(null) at start)
- [ ] E2E test verifies error display (deferred to P3 E2E TODO-294)

## Work Log

| Date | Action | Learnings |
|------|--------|-----------|
| 2025-12-06 | Created from code review | UX agent identified silent failure pattern |

## Resources

- PR commit: 9548fc3
- Pattern: SignupForm.tsx error handling
