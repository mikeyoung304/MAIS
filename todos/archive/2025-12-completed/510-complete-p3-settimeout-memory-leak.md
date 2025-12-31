# P3: Potential Memory Leak with setTimeout

## Status

- **Priority:** P3 (Low - Code Quality)
- **Status:** ready
- **Created:** 2025-12-30
- **Source:** `/workflows:review` - TypeScript Reviewer

## Problem

Multiple components use `setTimeout` without cleanup, which could cause React warnings about state updates on unmounted components.

**Files:**

- `apps/web/src/app/(protected)/admin/tenants/new/page.tsx` (line 48)
- `apps/web/src/app/(protected)/admin/tenants/[id]/EditTenantForm.tsx` (line 60)

```typescript
setTimeout(() => setCopied(false), 2000);
setTimeout(() => setSuccess(null), 3000);
```

## Impact

Low - these are short timeouts and the race condition is unlikely. But in strict mode double-renders or during fast navigation, React may warn.

## Solution

Use cleanup in useEffect or a mounted ref:

```typescript
const isMounted = useRef(true);

useEffect(() => {
  return () => {
    isMounted.current = false;
  };
}, []);

// Then in handler:
setTimeout(() => {
  if (isMounted.current) setCopied(false);
}, 2000);
```

Or use a custom hook like `useSafeTimeout`.

## Tags

`react`, `memory-leak`, `cleanup`
