---
module: MAIS
date: 2025-12-04
problem_type: react_performance_issue
component: client/src
severity: P2
tags: [quick-reference, react-performance, memoization, checklist]
---

# React Memoization Quick Reference

Print this. Pin this. Read before every React component commit.

---

## 30-Second Decision Tree

```
Does component receive callback prop?
├─ YES → useCallback() ✅
└─ NO ↓

Is component in a list (10+ items)?
├─ YES → React.memo() ✅
└─ NO ↓

Are you computing values from props/state?
├─ .filter/.map/.sort → useMemo() ✅
├─ Object literal → useMemo() ✅
└─ NO ↓

Does custom hook return callback/computed value?
├─ Callback → useCallback() ✅
├─ Value → useMemo() ✅
└─ NO → Skip (don't over-optimize)
```

---

## Code Patterns

### Pattern 1: Callback Props

```tsx
// ❌ BAD: Creates new function every render
<ChildComponent onChange={(e) => setState(e.target.value)} />

// ✅ GOOD: Stable reference
const handleChange = useCallback((e) => setState(e.target.value), []);
<ChildComponent onChange={handleChange} />
```

### Pattern 2: List Items

```tsx
// ❌ BAD: All 100 items re-render when any parent state changes
{packages.map(pkg => <PackageCard key={pkg.id} package={pkg} />)}

// ✅ GOOD: Only affected items re-render
{packages.map(pkg => (
  <MemoizedPackageCard key={pkg.id} package={pkg} />
))}

const MemoizedPackageCard = React.memo(function PackageCard({ package }) {
  return <div>{package.title}</div>;
});
MemoizedPackageCard.displayName = 'PackageCard';
```

### Pattern 3: Derived Values

```tsx
// ❌ BAD: New array created every render
const available = dates.filter(d => !unavailable.includes(d));

// ✅ GOOD: Memoized until dependencies change
const available = useMemo(
  () => dates.filter(d => !unavailable.includes(d)),
  [dates, unavailable]
);
```

### Pattern 4: Object Props

```tsx
// ❌ BAD: New object every render, breaks React.memo
<Item user={{ id, name }} />

// ✅ GOOD: Memoize the object
const user = useMemo(() => ({ id, name }), [id, name]);
<Item user={user} />

// ✅ BETTER: Use primitives instead
<Item userId={id} userName={name} />
```

---

## Code Review Checklist

Before approving React component PRs:

**Callbacks:**
- [ ] `onChange={(e) => ...}` converted to `useCallback()`?
- [ ] `onSelect={(item) => ...}` converted to `useCallback()`?
- [ ] Dependency array complete (ESLint passes)?

**Derived Values:**
- [ ] `.filter()` wrapped in `useMemo()`?
- [ ] `.map()` wrapped in `useMemo()`?
- [ ] `.sort()` wrapped in `useMemo()`?

**List Components:**
- [ ] Components in `map()` wrapped in `React.memo()`?
- [ ] Has `displayName` for DevTools?

**Dependencies:**
- [ ] All used variables in deps array?
- [ ] No missing deps warnings from ESLint?
- [ ] No infinite loops from deps?

**Performance:**
- [ ] Profiled with React DevTools?
- [ ] No unexpected cascading re-renders?
- [ ] Render time < 50ms per component?

---

## Common Mistakes

| Mistake | Problem | Fix |
|---------|---------|-----|
| `const cb = () => {}` in JSX | New function every render | Wrap in `useCallback()` |
| `.filter()` in render | New array every render | Wrap in `useMemo()` |
| `{ a, b }` object prop | New object every render | Wrap in `useMemo()` |
| `React.memo()` no displayName | Hard to debug | Add `Component.displayName = 'Name'` |
| `useCallback([], [])` | Stale dependency | Add all used variables to array |
| Over-memoizing | Slow code, false optimization | Only memoize when needed |
| `key={index}` | Lost component state | Use stable ID: `key={item.id}` |

---

## ESLint Errors & Fixes

**Error: "missing dependency"**
```tsx
// ❌ Missing 'value'
const handleChange = useCallback(() => {
  setState(value);
}, []);

// ✅ Fix: Add to deps
const handleChange = useCallback(() => {
  setState(value);
}, [value]);
```

**Error: "inline function"** (from custom rule)
```tsx
// ❌ Inline in JSX
<Button onClick={() => handleClick()} />

// ✅ Extract to useCallback
const handleClick = useCallback(() => { ... }, []);
<Button onClick={handleClick} />
```

---

## React DevTools Profiler Commands

```javascript
// Start recording (Profiler tab)
// 1. Click red circle
// 2. Perform action
// 3. Click red circle again

// Check render count
// Select component → "Render count" shows how many times it rendered

// Find slow components
// Look for "Commit" > 16ms (60 FPS threshold)
// Or individual component renders > 50ms

// Check if memo works
// Profiler should show component NOT rendering if props didn't change
// If it renders anyway, missing useCallback on parent
```

---

## Quick Rules

1. **Callback → child**: `useCallback()`
2. **List item (10+)**: `React.memo()`
3. **Computed value**: `useMemo()`
4. **Hook returns callback**: `useCallback()`
5. **Hook returns value**: `useMemo()`
6. **Simple op (<1ms)**: Skip memoization
7. **All memos need deps**: Complete dependency arrays
8. **All memos need displayName**: For React DevTools

---

## Grep Commands (Run Before Commit)

```bash
# Find inline callbacks (should be useCallback)
grep -r "onChange={(e)" client/src --include="*.tsx" | wc -l

# Find array methods without useMemo
grep -r "\.filter(\|\.map(" client/src --include="*.tsx" | grep -v useMemo | wc -l

# Find missing displayName
grep -r "React\.memo(" client/src --include="*.tsx" | grep -v displayName | wc -l

# Find key={index} (should use stable ID)
grep -r "key={index}\|key={i}" client/src --include="*.tsx" | wc -l

# Check if zero issues
npm run lint -- client/src
```

---

## Test Template

```tsx
import { render, screen } from '@testing-library/react';
import { Profiler } from 'react';

test('component does not re-render on parent update', () => {
  let renderCount = 0;

  function TestComponent() {
    renderCount++;
    return <div>Rendered {renderCount} times</div>;
  }

  const MemoComponent = React.memo(TestComponent);

  const { rerender } = render(<MemoComponent prop="value1" />);
  expect(renderCount).toBe(1);

  // Re-render with same props
  rerender(<MemoComponent prop="value1" />);
  expect(renderCount).toBe(1);  // Should NOT increment

  // Re-render with new props
  rerender(<MemoComponent prop="value2" />);
  expect(renderCount).toBe(2);  // Should increment
});

test('callback is stable across renders', () => {
  const mockFn = jest.fn();
  let renderCount = 0;

  function Component() {
    renderCount++;
    const callback = useCallback(() => mockFn(), [mockFn]);
    return <button onClick={callback}>Click</button>;
  }

  const { rerender } = render(<Component />);
  const btn1 = screen.getByRole('button');

  rerender(<Component />);
  const btn2 = screen.getByRole('button');

  // Button should be same reference if callback is stable
  expect(btn1 === btn2).toBe(true);
});
```

---

## When NOT to Memoize

- Simple arithmetic: `const sum = a + b`
- String concat: `const text = "Hello " + name`
- Primitive comparisons: `const is = a === b`
- Single render: `<SingleItem />`
- Props change every render anyway: Skip (doesn't help)

---

## File Locations

**Current status:**
- Main guide: `/docs/solutions/react-performance/REACT-MEMOIZATION-PREVENTION-STRATEGY.md`
- This quick reference: `/docs/solutions/react-performance/REACT-MEMOIZATION-QUICK-REFERENCE.md`
- ESLint config: `.eslintrc.cjs` (root)
- Client ESLint: `client/` (uses root config)

---

## Related Docs

- [Full Prevention Strategy](./REACT-MEMOIZATION-PREVENTION-STRATEGY.md)
- [React Hooks Performance & WCAG](./code-review-patterns/react-hooks-performance-wcag-review.md)
- [CLAUDE.md - Development Standards](../../CLAUDE.md)

---

**Print This** | **Pin This** | **Read Before Commit**

Last Updated: 2025-12-04
