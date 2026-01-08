---
title: React Hooks Early Return - Quick Reference
date: 2026-01-08
category: patterns
severity: P1
component: React Components
tags: [react, hooks, quick-reference, cheat-sheet]
---

# React Hooks Early Return - Quick Reference

**Print this page and pin it to your monitor!**

## The Rule (30 seconds)

```
HOOKS MUST be called in the SAME ORDER every render.

Early return BEFORE hooks = different order = BUILD FAILURE

Solution: ALL hooks FIRST, THEN early returns
```

## Decision Tree

```
Adding an early return to a component?
|
+-- Are there hooks (useState, useEffect, useMemo, etc.) in this file?
    |
    +-- NO --> Add your return anywhere
    |
    +-- YES --> Are ALL hooks ABOVE where you want to return?
        |
        +-- YES --> Safe to add return
        |
        +-- NO --> MOVE HOOKS UP FIRST, then add return
```

## The Pattern

```tsx
// ❌ WRONG - Return before hooks
function Component({ data }) {
  if (!data) return null;           // Early return
  const [x, setX] = useState(0);    // Hook AFTER return = BROKEN
  return <div>{x}</div>;
}

// ✅ CORRECT - Hooks before returns
function Component({ data }) {
  const [x, setX] = useState(0);    // Hook FIRST
  if (!data) return null;           // Return AFTER hooks
  return <div>{x}</div>;
}
```

## Handling Undefined Data in Hooks

```tsx
// ✅ Use optional chaining and nullish coalescing
const [selected, setSelected] = useState(data?.[0] ?? null);
const filtered = useMemo(() => data?.filter(x => x.active) ?? [], [data]);

// ✅ Guard in useEffect
useEffect(() => {
  if (!data) return;  // Guard inside, not before
  processData(data);
}, [data]);
```

## Before Committing

```bash
# ALWAYS run both
npm run lint
npm run build
```

If lint passes but build fails, you likely have a hooks violation.

## Quick Fixes

| Scenario | Fix |
|----------|-----|
| Adding empty state | Move hooks up, add `?? null` to initializers |
| Adding loading state | Move hooks up, guard inside useEffect |
| Adding error handling | Move hooks up, conditional render in JSX |
| Adding auth check | Move hooks up, early return after |

## ESLint Rule

```json
{
  "plugins": ["react-hooks"],
  "rules": {
    "react-hooks/rules-of-hooks": "error"
  }
}
```

## Code Review Check

When you see an early return in a PR:

1. Ctrl+F for: `useState`, `useEffect`, `useMemo`, `useCallback`, `useRef`
2. Are any BELOW the return? --> Request changes
3. Are all ABOVE the return? --> Approve

## Copy-Paste Review Comment

```
Hooks must be called before any early returns.
Move all useState/useEffect/useMemo calls above this return.
Use optional chaining (?.) for undefined data in hook initializers.
```

## Quick Reference Card

```
+------------------------------------------+
|        REACT HOOKS ORDER RULE            |
+------------------------------------------+
|  1. ALL HOOKS FIRST                      |
|     useState, useEffect, useMemo, etc.   |
|                                          |
|  2. THEN EARLY RETURNS                   |
|     if (!data) return null;              |
|                                          |
|  3. THEN RENDER                          |
|     return <Component />;                |
+------------------------------------------+
|  NEVER: return before useState           |
|  NEVER: return before useEffect          |
|  NEVER: return before useMemo            |
+------------------------------------------+
```

## Why Local Works But Vercel Fails

- Different ESLint versions
- Different strictness settings
- Vercel runs production build (stricter)

**Solution:** Run `npm run build` locally, not just `npm run dev`.

---

Full documentation: `REACT_HOOKS_EARLY_RETURN_PREVENTION.md`
