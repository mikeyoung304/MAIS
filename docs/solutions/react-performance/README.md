# React Performance Prevention Strategies

This directory contains prevention strategies for React performance issues, particularly related to missing memoization that causes unnecessary re-renders.

---

## Documents

### 1. REACT-MEMOIZATION-PREVENTION-STRATEGY.md (Main Guide)

**892 lines | Complete Reference**

Comprehensive prevention strategy covering:

- **Code Review Checklist** (20 items) - What to look for when reviewing React PRs
- **ESLint Configuration** - How to set up rules to catch memoization issues
- **Component Templates** (5 examples) - Ready-to-use patterns for different scenarios
- **Decision Criteria** - When to use what (flowchart + decision matrix)
- **Best Practices & Anti-patterns** (6 examples each)
- **Testing Approach** - Using React DevTools Profiler to measure effectiveness
- **Common Issues & Solutions** (4 real-world scenarios)
- **Implementation Checklist** - 10-item checklist before submitting PRs

**When to read:**

- During onboarding (React developers)
- When implementing list/grid components
- When code reviewing React components
- When investigating performance issues

### 2. REACT-MEMOIZATION-QUICK-REFERENCE.md (Cheat Sheet)

**307 lines | Print & Pin**

Quick reference card with:

- **30-second decision tree** - Quick memoization decisions
- **Code patterns** (4 examples) - Most common patterns
- **Code review checklist** - Abbreviated checklist
- **Common mistakes** - Table of 7 mistakes and fixes
- **ESLint errors & fixes** - How to fix common warnings
- **React DevTools commands** - How to use Profiler
- **Quick rules** - 8 essential rules
- **Grep commands** - Self-review before commit
- **Test template** - Example tests

**When to read:**

- Before every React component commit
- During code review (faster reference)
- When debugging ESLint warnings
- Keep printed on desk

---

## Quick Start

### For New React Components

1. Read [REACT-MEMOIZATION-QUICK-REFERENCE.md](./REACT-MEMOIZATION-QUICK-REFERENCE.md) (5 min)
2. Check the **30-second decision tree**
3. Use appropriate code pattern from [REACT-MEMOIZATION-PREVENTION-STRATEGY.md](./REACT-MEMOIZATION-PREVENTION-STRATEGY.md#3-component-pattern-template-for-memoized-components) (5 min)
4. Run grep commands before commit (2 min)
5. Profile with React DevTools if performance-critical (5 min)

### For Code Review

1. Use the **Code Review Checklist** from quick reference
2. Check ESLint `react-hooks/exhaustive-deps` passes
3. Run Profiler if component is in a list or frequently re-renders
4. Reference the **Common Mistakes** table if issues found

### For Performance Debugging

1. Open React DevTools Profiler
2. Record a commit (action that triggers re-renders)
3. Look for components rendering when props didn't change
4. Check if parent has memoized callbacks (useCallback)
5. Check if list items use React.memo()
6. Reference **Common Issues & Solutions** section

---

## Key Patterns Summary

### Pattern 1: Callback Props

```tsx
// ❌ BAD: Creates new function every render
<ChildComponent onChange={(e) => setState(e.target.value)} />;

// ✅ GOOD: Stable reference
const handleChange = useCallback((e) => setState(e.target.value), []);
<ChildComponent onChange={handleChange} />;
```

### Pattern 2: Derived Values

```tsx
// ❌ BAD: New array created every render
const filtered = items.filter((i) => i.active);

// ✅ GOOD: Memoized until dependencies change
const filtered = useMemo(() => items.filter((i) => i.active), [items]);
```

### Pattern 3: List Items

```tsx
// ❌ BAD: All items re-render when any parent state changes
{
  items.map((item) => <Item key={item.id} item={item} />);
}

// ✅ GOOD: Only affected items re-render
{
  items.map((item) => <MemoizedItem key={item.id} item={item} />);
}
const MemoizedItem = React.memo(Item);
MemoizedItem.displayName = 'Item';
```

### Pattern 4: Complete Dependencies

```tsx
// ❌ BAD: Stale closure (callback never sees new prop)
const callback = useCallback(() => process(prop), []);

// ✅ GOOD: Complete dependency array
const callback = useCallback(() => process(prop), [prop]);
```

---

## ESLint Configuration

**To enable memoization rules:**

1. Update `.eslintrc.cjs` (root) to extend `plugin:react-hooks/recommended`
2. Run: `npm run lint -- client/src`
3. Fix violations with: `npm run format`

**Critical rules:**

- `react-hooks/rules-of-hooks` - Hooks only in components/hooks
- `react-hooks/exhaustive-deps` - Complete dependency arrays (warnings OK, not errors)
- `react/no-unstable-nested-components` - Move components out of render
- `react/jsx-no-useless-fragment` - Remove unnecessary `<>` fragments

---

## React DevTools Profiler Quick Start

1. Install [React Developer Tools](https://chrome.google.com/webstore/detail/react-developer-tools/fmkadmapgofadopljbjfkapdkoienihi) browser extension
2. Open DevTools → Components tab → Profiler tab
3. Click red circle to start recording
4. Perform action (click button, type input, etc.)
5. Click red circle to stop
6. Check "Render count" for unexpected re-renders

**Good result:**

- List item: 1 render (only that item changed)
- Form input: 1-2 renders (input + debounced parent)

**Bad result:**

- List item: 100 renders (all items re-rendered)
- Form input: 5+ renders (cascade through component tree)

---

## Performance Targets

| Component Type       | Target Render Time | Notes                    |
| -------------------- | ------------------ | ------------------------ |
| Simple component     | < 5ms              | Button, badge, label     |
| Complex component    | < 20ms             | Form, card, dialog       |
| List item (memoized) | < 10ms             | Per item render time     |
| List (100 items)     | < 50ms total       | Should be 1-2 re-renders |
| Commit duration      | < 16ms             | 60 FPS target            |

---

## When to Use What

| Situation                        | Tool            | Example                                 |
| -------------------------------- | --------------- | --------------------------------------- |
| Callback passed to child         | `useCallback()` | `onChange`, `onSelect`, `onDelete`      |
| Array/object computed from props | `useMemo()`     | `.filter()`, `.map()`, `{ a: b, c: d }` |
| List item (10+ items)            | `React.memo()`  | `<PackageCard>` in `items.map()`        |
| Hook returns callback            | `useCallback()` | Custom hook for handlers                |
| Hook returns computed value      | `useMemo()`     | Custom hook for derived state           |
| Simple calculation               | Skip            | `const sum = a + b`                     |

---

## Related Documents

- [Prevention Strategies Index](../PREVENTION-STRATEGIES-INDEX.md) - Navigation hub for all prevention strategies
- [React Hooks Performance & WCAG Review](../code-review-patterns/react-hooks-performance-wcag-review.md) - Hooks + accessibility patterns
- [React UI Patterns & Audit Logging](../code-review-patterns/react-ui-patterns-audit-logging-review.md) - UI patterns + logging
- [BRAND_VOICE_GUIDE.md](../../design/BRAND_VOICE_GUIDE.md) - Design system and voice
- [CLAUDE.md](../../../CLAUDE.md) - Global development standards

---

## File Locations

- Main guide: `REACT-MEMOIZATION-PREVENTION-STRATEGY.md`
- Quick reference: `REACT-MEMOIZATION-QUICK-REFERENCE.md`
- This README: `README.md`
- ESLint config: `/.eslintrc.cjs` (root)
- Client code: `/client/src/` (React components)

---

## Grep Commands for Self-Review

Run before committing React code:

```bash
# Find inline callbacks (should use useCallback)
grep -r "onChange={(e)" client/src --include="*.tsx"

# Find array methods without useMemo
grep -r "\.filter(\|\.map(" client/src --include="*.tsx" | grep -v useMemo

# Find object literals as props (should use useMemo)
grep -r "props={{ " client/src --include="*.tsx"

# Find React.memo without displayName
grep -r "React\.memo(" client/src --include="*.tsx" | grep -v displayName

# Find key={index} (should use stable ID)
grep -r "key={index}" client/src --include="*.tsx"

# Check ESLint
npm run lint -- client/src
```

---

## Implementation Progress

- [x] Prevention strategy document created
- [x] Quick reference guide created
- [x] ESLint configuration documented
- [x] Code review checklist included
- [x] Component templates provided (5 examples)
- [x] Testing approach documented (React DevTools Profiler)
- [x] Common issues & solutions documented
- [x] Decision criteria defined (flowchart + matrix)
- [x] Added to Prevention Strategies Index
- [x] This README

**Ready for:** Immediate adoption

---

## Contributing

To improve these prevention strategies:

1. Create issue describing improvement
2. Reference relevant code examples
3. Include before/after comparison
4. Update both main guide and quick reference
5. Test on real component
6. Submit PR with changes

---

**Last Updated:** 2025-12-04
**Status:** Active
**Severity:** P2 (Performance optimization)
**Version:** 1.0
