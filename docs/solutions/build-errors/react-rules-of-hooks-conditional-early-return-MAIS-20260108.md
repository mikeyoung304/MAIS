---
module: MAIS
date: 2026-01-08
problem_type: build_failure
component: apps/web/src/components/tenant/SegmentPackagesSection.tsx
symptoms:
  - Vercel/Render build fails with "React Hook useCallback is called conditionally"
  - Local dev server works fine (React doesn't enforce Rules of Hooks in dev)
  - Error only surfaces during production build
root_cause: Empty state early return placed BEFORE useCallback hooks, violating Rules of Hooks
resolution_type: code_fix
severity: P1
tags: [react, hooks, rules-of-hooks, build-errors, early-return, useCallback, vercel, empty-state]
related_todos: [654]
---

# React Rules of Hooks: Conditional Early Return Build Failure

## Problem Summary

Vercel production build failed with React Rules of Hooks violation. An empty state early return was added BEFORE `useCallback` hooks, causing hooks to be called conditionally. Local dev mode doesn't enforce this rule, so the error only appeared in production builds.

## Exact Error Message

```
Error: React Hook "useCallback" is called conditionally. React Hooks must be called in the exact same order in every component render. Did you accidentally call a React Hook after an early return?
```

## Why This Happened

When implementing empty state handling (TODO #654), the natural instinct was to add an early return at the "decision point" - right after computing whether there are segments with packages:

```typescript
// ❌ WRONG: Early return BEFORE hooks
const segmentsWithPackages = useMemo(() => /* ... */, [deps]);

// This early return was added here...
if (segmentsWithPackages.length === 0) {
  return <EmptyState />;  // ← PROBLEM: Exits before useCallback hooks below
}

// ...but these hooks are defined AFTER the return
const getBookHref = useCallback(() => /* ... */, [deps]);
const handleSelectSegment = useCallback(() => /* ... */, [deps]);
const handleBack = useCallback(() => /* ... */, [deps]);
```

**The trap:** This pattern looks logical - "check if empty, return early, then set up handlers." But React requires ALL hooks to run on EVERY render, in the same order.

## The Anti-Pattern

```typescript
// ❌ ANTI-PATTERN: Early return before hooks
function MyComponent({ data }) {
  const [state, setState] = useState(null);

  const processedData = useMemo(() => process(data), [data]);

  // WRONG: Returning before all hooks are called
  if (processedData.length === 0) {
    return <EmptyState />;
  }

  // These hooks won't run when processedData is empty!
  const handleClick = useCallback(() => {/* ... */}, []);
  const handleSubmit = useCallback(() => {/* ... */}, []);

  return <Component onClick={handleClick} />;
}
```

## The Correct Pattern

```typescript
// ✅ CORRECT: All hooks before any conditional returns
function MyComponent({ data }) {
  const [state, setState] = useState(null);

  const processedData = useMemo(() => process(data), [data]);

  // ALL hooks defined first - even if not used in every code path
  const handleClick = useCallback(() => {/* ... */}, []);
  const handleSubmit = useCallback(() => {/* ... */}, []);

  // Derived state (not hooks) can come after
  const selectedItem = state ? data.find(d => d.id === state) : null;

  // THEN early returns are safe
  if (processedData.length === 0) {
    return <EmptyState />;
  }

  return <Component onClick={handleClick} />;
}
```

## The Fix Applied

**Commit:** `99933fcb` - fix(storefront): move hooks before early returns (Rules of Hooks)

```diff
-  // Empty state - no segments have active packages
-  if (segmentsWithPackages.length === 0) {
-    return <EmptyState />;
-  }
-
-  // Get booking link
+  // Get booking link - must be before any conditional returns (React Rules of Hooks)
   const getBookHref = useCallback(/* ... */);

-  // Get selected segment and its packages
-  const selectedSegment = /* ... */;
-  const selectedPackages = /* ... */;
-
   // Handle segment selection - update URL hash for browser history
+  // Must be before any conditional returns (React Rules of Hooks)
   const handleSelectSegment = useCallback(/* ... */);

-  // Handle back to segments
+  // Handle back to segments - must be before any conditional returns (React Rules of Hooks)
   const handleBack = useCallback(/* ... */);

+  // Get selected segment and its packages (derived state, not a hook)
+  const selectedSegment = /* ... */;
+  const selectedPackages = /* ... */;
+
+  // Empty state - no segments have active packages
+  // This must come AFTER all hooks are called (React Rules of Hooks)
+  if (segmentsWithPackages.length === 0) {
+    return <EmptyState />;
+  }
```

## Key Changes

1. **Moved all `useCallback` hooks** to BEFORE the empty state early return
2. **Added comments** explaining WHY they must be before returns (prevents future regressions)
3. **Separated derived state** from hooks with clear comments distinguishing them
4. **Annotated the early return** with a comment noting it must come AFTER hooks

## Prevention Strategy

### 1. Mental Model: Hooks Section vs Logic Section

Structure components with clear sections:

```typescript
function MyComponent(props) {
  // ═══════════════════════════════════════════════
  // SECTION 1: ALL HOOKS (must run every render)
  // ═══════════════════════════════════════════════
  const [state, setState] = useState();
  const memoValue = useMemo(() => {}, []);
  const callback = useCallback(() => {}, []);
  const ref = useRef();

  useEffect(() => {}, []);

  // ═══════════════════════════════════════════════
  // SECTION 2: DERIVED STATE (plain JS, no hooks)
  // ═══════════════════════════════════════════════
  const derivedValue = state ? transform(state) : null;
  const isValid = checkCondition(props);

  // ═══════════════════════════════════════════════
  // SECTION 3: EARLY RETURNS (safe after hooks)
  // ═══════════════════════════════════════════════
  if (isEmpty) return <Empty />;
  if (isLoading) return <Loading />;
  if (isError) return <Error />;

  // ═══════════════════════════════════════════════
  // SECTION 4: MAIN RENDER
  // ═══════════════════════════════════════════════
  return <Main />;
}
```

### 2. Code Review Checklist Addition

When reviewing React components, check:

- [ ] Are ALL hooks defined before ANY conditional returns?
- [ ] Do early returns come AFTER the hooks section?
- [ ] Are derived state calculations (not hooks) clearly separated?

### 3. ESLint Rule

The `react-hooks/rules-of-hooks` ESLint rule catches this. Ensure it's enabled:

```json
{
  "rules": {
    "react-hooks/rules-of-hooks": "error",
    "react-hooks/exhaustive-deps": "warn"
  }
}
```

**Note:** ESLint may not catch ALL cases, especially when the early return is complex. The production build is the final authority.

### 4. Comment Convention

When adding early returns to existing components, add this comment pattern:

```typescript
// This must come AFTER all hooks are called (React Rules of Hooks)
if (condition) {
  return <EarlyReturn />;
}
```

## Why Local Dev Didn't Catch This

React's development mode performs some Rules of Hooks checks, but the exhaustive check happens during production builds. This is why:

- `npm run dev` (Next.js dev server) - Works fine
- `npm run build` (Production build) - Fails with hook error

**Lesson:** Always run `npm run build` locally before pushing to verify production compatibility.

## Quick Verification

```bash
# Build locally to catch hook errors before CI
cd apps/web && npm run build

# If using Turbopack dev, this won't catch hook issues
# Production build is the source of truth
```

## Related Documentation

- [React Rules of Hooks](https://react.dev/reference/rules/rules-of-hooks) - Official docs
- [Empty State Handling Pattern](../patterns/empty-state-handling-MAIS-20260108.md) - If exists
- [TypeScript Unused Variables Build Failure](./typescript-unused-variables-build-failure-MAIS-20251227.md) - Similar "local passes, prod fails" pattern

## Summary

| Aspect           | Details                                                   |
| ---------------- | --------------------------------------------------------- |
| **Error**        | "React Hook useCallback is called conditionally"          |
| **Cause**        | Early return placed before `useCallback` hooks            |
| **Fix**          | Move ALL hooks before ANY conditional returns             |
| **Prevention**   | Structure: Hooks → Derived State → Early Returns → Render |
| **Verification** | `npm run build` locally before pushing                    |
