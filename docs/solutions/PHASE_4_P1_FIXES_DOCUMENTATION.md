# Phase 4 P1 Fixes: Type Safety, Auth State, and Hydration

**Date:** 2025-12-31
**Status:** Three P1 critical fixes preventing type errors, runtime crashes, and CLS violations
**Impact:** Onboarding flow type safety, authentication state tracking, hydration mismatch prevention

---

## Overview

Three critical P1 fixes were applied to Phase 4 onboarding to address type consolidation, auth state tracking, and hydration skeleton rendering. These fixes prevent runtime type errors, distinguish authentication states, and eliminate Cumulative Layout Shift (CLS) during SSR.

---

## Fix 1: Type Consolidation – OnboardingPhase Import

### Problem

The `OnboardingProgress` component had a local type definition for `OnboardingPhase` instead of using the canonical definition from `@macon/contracts`. This created:

- Duplicate type definitions across the codebase
- Risk of type divergence when contracts are updated
- Maintenance burden tracking multiple definitions

**Symptom:** Type mismatch errors if contracts are updated without updating local definition.

### Solution

Remove local type definition and import from `@macon/contracts` (the single source of truth for API contracts).

**File:** `/Users/mikeyoung/CODING/MAIS/apps/web/src/components/onboarding/OnboardingProgress.tsx`

**Change:**

```typescript
// BEFORE (lines 1-6)
'use client';

import { useState } from 'react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';

// Local type definition (duplicate!)
type OnboardingPhase =
  | 'NOT_STARTED'
  | 'DISCOVERY'
  | 'MARKET_RESEARCH'
  | 'SERVICES'
  | 'MARKETING'
  | 'COMPLETED'
  | 'SKIPPED';

// AFTER (lines 1-6)
('use client');

import { useState } from 'react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import type { OnboardingPhase } from '@macon/contracts';
```

### Key Points

- Uses `import type` (TypeScript-only import, removed at compile time)
- Leverages `@macon/contracts` as single source of truth
- Prevents type divergence issues
- No runtime impact—purely a compile-time improvement

### References

- **File:** `apps/web/src/components/onboarding/OnboardingProgress.tsx:6`
- **Pattern:** Contract-driven type safety (see `CLAUDE.md` → Type-Safe API Contracts)

---

## Fix 2: Auth State Tracking – useOnboardingState Hook

### Problem

The `useOnboardingState` hook silently returned `null` when receiving a 401 (Unauthorized) response. This created ambiguity:

- Consumer couldn't distinguish "user not logged in" from "loading" or "error"
- Components couldn't properly render conditional UI based on auth state
- Silent failures made debugging difficult

**Symptom:** Auth pages would render with null state, unable to show "login required" messaging.

### Solution

Add an explicit `isAuthenticated` state with three-state logic:

- `null` = initial/loading state
- `true` = user authenticated, state loaded
- `false` = user not authenticated (401 response)

**File:** `/Users/mikeyoung/CODING/MAIS/apps/web/src/hooks/useOnboardingState.ts`

**Changes:**

```typescript
// Line 47: Add new state variable
const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null);

// Lines 52-79: Update fetchState function
const fetchState = useCallback(async () => {
  setIsLoading(true);
  setError(null);

  try {
    const response = await fetch(`${API_PROXY}/onboarding-state`);

    if (!response.ok) {
      if (response.status === 401) {
        // User is not authenticated - track this explicitly
        setIsAuthenticated(false); // Line 62: Set to false on 401
        setState(null);
        return;
      }
      throw new Error('Failed to fetch onboarding state');
    }

    setIsAuthenticated(true); // Line 69: Set to true on success
    const data = await response.json();
    setState(data);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    setError(message);
    setState(null);
  } finally {
    setIsLoading(false);
  }
}, []);

// Lines 134: Export isAuthenticated in return object
return {
  // ... other state
  isAuthenticated, // Consumers can now check auth state explicitly
  // ...
};
```

### Consumer Usage

```typescript
const { state, isAuthenticated, isLoading } = useOnboardingState();

if (isLoading) {
  return <Skeleton />;
}

if (isAuthenticated === false) {
  return <RedirectToLogin />;
}

if (isAuthenticated === true && state) {
  return <OnboardingFlow state={state} />;
}
```

### Key Points

- Three-state boolean: `null | true | false`
- `null` = loading/initial
- `true` = authenticated and ready
- `false` = unauthenticated (401)
- Allows consumers to render appropriate UI for each state
- Distinguishes network errors from auth failures

### References

- **File:** `apps/web/src/hooks/useOnboardingState.ts:47,62-63,69,134`
- **Pattern:** Explicit state tracking for authentication (see `docs/solutions/authentication-issues/`)

---

## Fix 3: Hydration Skeleton – GrowthAssistantPanel

### Problem

The `GrowthAssistantPanel` returned `null` during SSR, causing:

- Hydration mismatch between server render (null) and client render (full panel)
- Cumulative Layout Shift (CLS) when panel suddenly appears after hydration
- Poor user experience with visible layout reflow

**Symptom:** Page layout jumps/shifts when panel renders client-side after hydration.

### Solution

Return a skeleton element during SSR that matches the final panel layout, with `aria-busy="true"` to indicate loading state.

**File:** `/Users/mikeyoung/CODING/MAIS/apps/web/src/components/agent/GrowthAssistantPanel.tsx`

**Changes:**

```typescript
// Lines 43-59: Add hydration check
const [isMounted, setIsMounted] = useState(false);

// Prevent hydration mismatch
useEffect(() => {
  setIsMounted(true);
}, []);

// Lines 81-112: Return skeleton during SSR
if (!isMounted) {
  return (
    <aside
      className={cn(
        'fixed right-0 top-0 h-screen z-40',
        'w-[400px] max-w-[90vw]',
        'flex flex-col bg-surface-alt border-l border-neutral-700 shadow-lg',
        className
      )}
      role="complementary"
      aria-label="Growth Assistant"
      aria-busy="true"  // Indicates loading state to screen readers
    >
      {/* Skeleton header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-neutral-700 bg-surface-alt shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-xl bg-neutral-700 animate-pulse" />
          <div className="space-y-1">
            <div className="h-4 w-32 bg-neutral-700 rounded animate-pulse" />
            <div className="h-3 w-20 bg-neutral-700 rounded animate-pulse" />
          </div>
        </div>
      </div>

      {/* Skeleton chat area */}
      <div className="flex-1 p-4 space-y-3">
        <div className="h-16 bg-neutral-700 rounded-lg animate-pulse" />
        <div className="h-12 bg-neutral-700 rounded-lg animate-pulse" />
      </div>
    </aside>
  );
}

// Return full panel after hydration (lines 114+)
return (
  <>
    {/* Collapsed state toggle button */}
    {/* Full panel content */}
  </>
);
```

### Skeleton Design

**Layout Match:** Skeleton exactly replicates final panel structure:

- Fixed right-side positioning
- Same dimensions (400px width, full height)
- Same color/border styling
- Placeholder blocks for header icon, title, and chat area

**Loading Indicators:**

- `aria-busy="true"` for accessibility
- `animate-pulse` on placeholder blocks for visual feedback
- `bg-neutral-700` matching panel background

### Core Pattern

```typescript
export function Component() {
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);  // Client-side only
  }, []);

  // SSR renders skeleton
  if (!isMounted) {
    return <SkeletonMatchingLayout {...props} />;
  }

  // Client renders actual component
  return <ActualComponent {...props} />;
}
```

### Why This Works

1. **SSR:** Server renders skeleton → HTML matches client expectations
2. **Hydration:** Client hydrates skeleton without changes → no mismatch
3. **First paint:** Skeleton appears immediately with loading state
4. **After hydration:** `isMounted` becomes `true`, component re-renders to interactive version
5. **No layout shift:** Skeleton maintains exact layout of final component

### Key Points

- Prevents hydration mismatch errors
- Eliminates CLS by reserving space during SSR
- Uses `aria-busy="true"` for accessibility
- Placeholder blocks use `animate-pulse` for visual feedback
- Should match final layout dimensions and spacing exactly

### References

- **File:** `apps/web/src/components/agent/GrowthAssistantPanel.tsx:81-112`
- **Pattern:** Hydration skeleton pattern (Next.js App Router best practice)
- **Performance:** Reduces CLS score, improves Core Web Vitals

---

## Implementation Checklist

When applying similar fixes in future work:

### Type Consolidation

- [ ] Identify local type duplicates in codebase
- [ ] Locate canonical definition in `@macon/contracts`
- [ ] Replace local type with `import type { Type } from '@macon/contracts'`
- [ ] Test that consumers receive correct types
- [ ] Remove old type definitions

### Auth State Tracking

- [ ] Add `isAuthenticated: boolean | null` state
- [ ] Set to `false` on 401 responses
- [ ] Set to `true` on successful authentication
- [ ] Keep `null` during loading
- [ ] Export new state in hook return
- [ ] Update consumers to handle three-state logic

### Hydration Skeleton

- [ ] Add `isMounted` state with `useState(false)`
- [ ] Call `setIsMounted(true)` in `useEffect`
- [ ] Return skeleton during `!isMounted`
- [ ] Match skeleton layout to actual component exactly
- [ ] Add `aria-busy="true"` to skeleton
- [ ] Use `animate-pulse` on placeholder blocks
- [ ] Return full component after hydration

---

## Testing Recommendations

### Fix 1: Type Consolidation

```bash
# Verify no local OnboardingPhase definitions remain
grep -r "type OnboardingPhase" apps/web/src --include="*.tsx" --include="*.ts"

# Should only find: apps/web/src/hooks/useOnboardingState.ts
# (which imports from contracts)
```

### Fix 2: Auth State Tracking

```typescript
// Test 401 handling
test('should set isAuthenticated to false on 401', async () => {
  // Mock fetch to return 401
  const { result } = renderHook(() => useOnboardingState());

  await waitFor(() => {
    expect(result.current.isAuthenticated).toBe(false);
    expect(result.current.state).toBeNull();
  });
});

// Test success path
test('should set isAuthenticated to true on success', async () => {
  // Mock fetch to return 200 + data
  const { result } = renderHook(() => useOnboardingState());

  await waitFor(() => {
    expect(result.current.isAuthenticated).toBe(true);
    expect(result.current.state).toBeDefined();
  });
});
```

### Fix 3: Hydration Skeleton

```bash
# Run E2E test to verify no hydration errors
npm run test:e2e -- e2e/tests/onboarding-panel.spec.ts

# Check Core Web Vitals
npm run test:e2e -- --record  # Lighthouse audit

# Verify skeleton appears in network throttled mode
npm run dev:web  # Open DevTools → Network → Slow 3G
```

---

## Related Documentation

- **Type Safety:** `docs/solutions/best-practices/ts-rest-any-type-library-limitations-MAIS-20251204.md`
- **Authentication:** `docs/solutions/authentication-issues/nextauth-v5-secure-cookie-prefix-production-401-MAIS-20251231.md`
- **Hydration Patterns:** Next.js App Router best practices
- **Schema Contracts:** `packages/contracts/src/schemas/`

---

## Summary

These three P1 fixes establish:

1. **Single source of truth** for types via contracts imports
2. **Explicit auth state tracking** to distinguish loading/unauthenticated/authenticated
3. **CLS prevention** through hydration skeleton matching final layout

All three fixes follow Next.js App Router and Next.js best practices for server/client component boundaries and hydration safety.
