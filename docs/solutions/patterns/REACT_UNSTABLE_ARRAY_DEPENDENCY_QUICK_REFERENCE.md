---
title: React Unstable Array Dependency - Quick Reference
date: 2026-01-09
category: patterns
severity: P2
component: React Components
tags: [react, useEffect, quick-reference, cheat-sheet, useMemo]
---

# React Unstable Array Dependency - Quick Reference

**Print this page and pin it to your monitor!**

## The Rule (30 seconds)

```
React compares useEffect dependencies by REFERENCE, not VALUE.

[] !== []  (even with same contents!)

New array every render = effect runs every render = BUGS

Solution: useMemo to STABILIZE array references
```

## Decision Tree

```
Array in useEffect dependency?
|
+-- Created during render? (.map, .filter, function return, etc.)
    |
    +-- NO --> Probably safe (but check parent)
    |
    +-- YES --> WRAP IN useMemo!
```

## The Pattern

```tsx
// ❌ WRONG - New array every render
const { highlights } = parseHighlights(content);
useEffect(() => {
  highlights.forEach((h) => doSomething(h));
}, [highlights]); // Runs EVERY RENDER!

// ✅ CORRECT - Stable reference
const highlights = useMemo(() => parseHighlights(content).highlights, [content]);
useEffect(() => {
  highlights.forEach((h) => doSomething(h));
}, [highlights]); // Only runs when content changes
```

## Detection Smells

| Pattern             | Example                       | Unstable? |
| ------------------- | ----------------------------- | --------- |
| Function return     | `getData().items`             | YES       |
| .map()              | `items.map(x => x.id)`        | YES       |
| .filter()           | `items.filter(x => x.active)` | YES       |
| Spread              | `[...items, newItem]`         | YES       |
| .slice()            | `items.slice(0, 5)`           | YES       |
| Literal             | `[1, 2, 3]`                   | YES       |
| State               | `const [arr] = useState()`    | NO        |
| Prop (check parent) | `function Comp({ arr })`      | MAYBE     |

## Quick Fixes

| Scenario                | Fix                                     |
| ----------------------- | --------------------------------------- |
| Parser/transform result | `useMemo(() => parse(x).result, [x])`   |
| Filtered array          | `useMemo(() => arr.filter(...), [arr])` |
| Mapped array            | `useMemo(() => arr.map(...), [arr])`    |
| Multiple sources        | Lift to parent, memoize there           |
| Can't memoize source    | `JSON.stringify(arr)` as dep key        |

## Before Committing

```bash
# Check for effect spam in console
# Add temporarily:
useEffect(() => {
  console.log('Effect ran!', arr.length);
}, [arr]);

# If it logs on every re-render, you have the bug
```

## Code Review Check

When you see useEffect with array dependency:

1. **Is the array created during render?**
   - Function call? Parser? Transform?
2. **Is it wrapped in useMemo?**
   - NO --> Request changes
   - YES --> Check useMemo dependencies are correct

## Copy-Paste Review Comment

```
Unstable array dependency - this array is created fresh every render,
causing the effect to run repeatedly.

Fix: Wrap in useMemo:
const arr = useMemo(() => transform(data), [data]);

Docs: REACT_UNSTABLE_ARRAY_DEPENDENCY_PREVENTION.md
```

## Quick Reference Card

```
+------------------------------------------+
|    UNSTABLE ARRAY DEPENDENCY FIX         |
+------------------------------------------+
|                                          |
|  [] !== []  <-- ALWAYS TRUE!             |
|                                          |
|  ❌ const arr = compute();               |
|     useEffect(..., [arr]);               |
|                                          |
|  ✅ const arr = useMemo(                 |
|       () => compute(),                   |
|       [deps]                             |
|     );                                   |
|     useEffect(..., [arr]);               |
|                                          |
+------------------------------------------+
|  WATCH FOR:                              |
|  .map() .filter() .slice() [...spread]   |
|  parseX().result  getData().items        |
+------------------------------------------+
```

## Why This Matters

- Effect runs every render
- Duplicate API calls
- Multiple timers scheduled
- Memory leaks from uncanceled effects
- Performance degradation

---

Full documentation: `REACT_UNSTABLE_ARRAY_DEPENDENCY_PREVENTION.md`
