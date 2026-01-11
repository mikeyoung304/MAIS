---
title: P1 Frontend Review Fixes - Phase 4 Onboarding
category: patterns
tags: [type-safety, hydration, authentication, react-hooks, ssr, code-review]
severity: P1
components: [OnboardingProgress, useOnboardingState, GrowthAssistantPanel]
date: 2025-12-31
status: resolved
---

# P1 Frontend Review Fixes - Phase 4 Onboarding

Three P1 issues identified during code review of the Agent-Powered Tenant Onboarding Phase 4 implementation.

## Summary

| Issue           | File                       | Root Cause                             | Fix Time |
| --------------- | -------------------------- | -------------------------------------- | -------- |
| Duplicate type  | `OnboardingProgress.tsx`   | Local type instead of contracts import | 30 sec   |
| Silent 401      | `useOnboardingState.ts`    | No auth state tracking                 | 2 min    |
| Hydration flash | `GrowthAssistantPanel.tsx` | Null return during SSR                 | 3 min    |

---

## Fix 1: Type Consolidation

### Problem

`OnboardingPhase` type was duplicated locally instead of importing from `@macon/contracts`:

```typescript
// ❌ WRONG - Local duplicate
export type OnboardingPhase =
  | 'NOT_STARTED'
  | 'DISCOVERY'
  | 'MARKET_RESEARCH'
  | 'SERVICES'
  | 'MARKETING'
  | 'COMPLETED'
  | 'SKIPPED';
```

### Solution

Import from the canonical source:

```typescript
// ✅ CORRECT - Single source of truth
import type { OnboardingPhase } from '@macon/contracts';
```

### Files Changed

- `apps/web/src/components/onboarding/OnboardingProgress.tsx:6`
- `apps/web/src/hooks/useOnboardingState.ts:4`

### Prevention

**Code Review Question:** "Is this type defined elsewhere in `@macon/contracts`?"

**Checklist:**

- [ ] All shared types imported from `@macon/contracts`
- [ ] No local type definitions that duplicate contracts
- [ ] `npm run typecheck` passes after import change

---

## Fix 2: Auth State Tracking

### Problem

The hook silently returned `null` on 401 without tracking authentication state:

```typescript
// ❌ WRONG - Silent failure
if (response.status === 401) {
  setState(null);
  return; // Consumer can't tell why state is null
}
```

### Solution

Add explicit `isAuthenticated` tristate:

```typescript
// ✅ CORRECT - Explicit auth tracking
const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null);

// In fetch handler:
if (response.status === 401) {
  setIsAuthenticated(false); // Explicitly track "not logged in"
  setState(null);
  return;
}

setIsAuthenticated(true); // User is authenticated
const data = await response.json();
setState(data);

// Return in hook:
return {
  // ...other values
  isAuthenticated, // null = loading, true = auth'd, false = 401
};
```

### Files Changed

- `apps/web/src/hooks/useOnboardingState.ts:47,62-63,69,134`

### Prevention

**Code Review Question:** "What happens when this API returns 401?"

**Checklist:**

- [ ] 401 responses set explicit error/auth state
- [ ] Consumers can distinguish "loading" vs "error" vs "no data"
- [ ] Auth failures are trackable (for debugging, analytics)

---

## Fix 3: Hydration Skeleton

### Problem

Returning `null` during SSR causes Cumulative Layout Shift (CLS):

```typescript
// ❌ WRONG - Causes layout shift
if (!isMounted) {
  return null; // Server: nothing, Client: full panel = FLASH
}
```

### Solution

Return a skeleton matching the panel dimensions:

```typescript
// ✅ CORRECT - Skeleton prevents CLS
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
      aria-busy="true"
    >
      {/* Skeleton header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-neutral-700">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-xl bg-neutral-700 animate-pulse" />
          <div className="space-y-1">
            <div className="h-4 w-32 bg-neutral-700 rounded animate-pulse" />
            <div className="h-3 w-20 bg-neutral-700 rounded animate-pulse" />
          </div>
        </div>
      </div>
      {/* Skeleton content */}
      <div className="flex-1 p-4 space-y-3">
        <div className="h-16 bg-neutral-700 rounded-lg animate-pulse" />
        <div className="h-12 bg-neutral-700 rounded-lg animate-pulse" />
      </div>
    </aside>
  );
}
```

### Key Points

1. **Same dimensions** - Skeleton matches final layout (w-[400px], h-screen)
2. **Same position** - Fixed right-0 top-0 matches final
3. **aria-busy="true"** - Accessibility: screen readers know content loading
4. **animate-pulse** - Visual feedback that content is loading

### Files Changed

- `apps/web/src/components/agent/GrowthAssistantPanel.tsx:81-112`

### Prevention

**Code Review Question:** "Could this render differently on server vs client?"

**Checklist:**

- [ ] No `return null` in hydration guards
- [ ] Skeleton matches content dimensions
- [ ] No `window`, `document`, `Date.now()` in initial render
- [ ] Client-only code gated by `useEffect` + state

---

## Testing Verification

All fixes verified with:

```bash
npm run typecheck  # ✅ Passed
npm test           # ✅ 1303 tests passed
```

---

## Related Documentation

- [mais-critical-patterns.md](./mais-critical-patterns.md) - Required reading for type safety
- [nextjs-migration-lessons-learned-MAIS-20251225.md](../code-review-patterns/nextjs-migration-lessons-learned-MAIS-20251225.md) - SSR/hydration patterns
- [ts-rest-any-type-library-limitations-MAIS-20251204.md](../best-practices/ts-rest-any-type-library-limitations-MAIS-20251204.md) - When `any` is acceptable

---

## Quick Reference

### Before Every Commit

```
□ Types from @macon/contracts (not local)?
□ 401s tracked explicitly (not silent)?
□ SSR returns skeleton (not null)?
```

### Code Review Template

```markdown
## P1 Frontend Checks

- [ ] No duplicate types (use contracts)
- [ ] Auth errors explicit (isAuthenticated state)
- [ ] SSR-safe (skeleton, not null)
```
