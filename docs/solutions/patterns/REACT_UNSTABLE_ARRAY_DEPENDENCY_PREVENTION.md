---
title: React Unstable Array Dependency Prevention
date: 2026-01-09
category: patterns
severity: P2
component: React Components
symptoms:
  - useEffect runs on every render despite unchanged data
  - Duplicate side effects (API calls, highlight callbacks, timers)
  - Performance degradation in components with effects
  - Multiple timeouts scheduled for same action
root_cause: Arrays created during render are new references every time
resolution_type: prevention_strategy
tags: [react, useEffect, performance, arrays, useMemo, reference-equality]
---

# React Unstable Array Dependency Prevention

**Impact:** P2 - Performance degradation, duplicate side effects, hard-to-debug re-renders

**Root Cause:** React compares useEffect dependencies by reference, not value. An array created during render is always a "new" array to React, even if its contents are identical.

---

## The Pattern That Breaks

```tsx
// In a parent component or render loop:
function MessageList({ messages }) {
  return messages.map((message) => {
    // ❌ WRONG - New array created every render
    const parseResult = parseHighlights(message.content);
    const highlights = parseResult.highlights; // New array each time!

    return (
      <Message key={message.id}>
        <HighlightTrigger highlights={highlights} />
      </Message>
    );
  });
}

// In the child component:
function HighlightTrigger({ highlights, onSectionHighlight }) {
  useEffect(() => {
    // This runs EVERY RENDER because highlights is always "new"
    highlights.forEach((id, i) => {
      setTimeout(() => onSectionHighlight(id), i * 500);
    });
  }, [highlights, onSectionHighlight]); // highlights is always !== previous

  return null;
}
```

**Why this happens:**

1. `parseHighlights()` returns a new array object each call
2. `[]` !== `[]` in JavaScript (reference comparison)
3. React sees "new" dependency on every parent re-render
4. Effect re-runs, scheduling duplicate timeouts/callbacks

---

## Why React Uses Reference Equality

```javascript
// JavaScript reference comparison
const a = [1, 2, 3];
const b = [1, 2, 3];

a === b; // false - different objects in memory
a === a; // true - same reference

// What React does internally (simplified)
function hasDepChanged(prev, next) {
  return prev !== next; // Reference comparison!
}
```

---

## Detection Patterns

Look for these code smells during code review:

### 1. Parser/Transform Returns in Render

```tsx
// ❌ SMELL: Function returns array in render path
const { highlights } = parseHighlights(content); // New array each render
```

### 2. Array Methods That Create New Arrays

```tsx
// ❌ SMELL: These all return new arrays
const filtered = items.filter((x) => x.active);
const mapped = items.map((x) => x.id);
const sliced = items.slice(0, 5);
const spread = [...items, newItem];
```

### 3. Object/Array Literals in Dependencies

```tsx
// ❌ SMELL: Inline array/object in dependency
useEffect(() => { ... }, [{ key: value }]);  // Object literal = new ref
useEffect(() => { ... }, [[1, 2, 3]]);       // Array literal = new ref
```

### 4. Destructured Function Returns

```tsx
// ❌ SMELL: Destructuring creates new reference
const { data, highlights } = someFunction(); // highlights is new each call
```

---

## Fix Options

### Option 1: useMemo to Stabilize Array (Recommended)

```tsx
function MessageList({ messages }) {
  return messages.map((message) => {
    // ✅ CORRECT - Memoize the array
    const highlights = useMemo(
      () => parseHighlights(message.content).highlights,
      [message.content] // Only recalculate when content changes
    );

    return (
      <Message key={message.id}>
        <HighlightTrigger highlights={highlights} />
      </Message>
    );
  });
}
```

**Best for:** Most cases. Preserves reference when dependencies unchanged.

### Option 2: Lift and Memoize at Parent Level

```tsx
function MessageList({ messages }) {
  // ✅ CORRECT - Parse once, memoize result
  const messageHighlights = useMemo(
    () =>
      messages.map((m) => ({
        id: m.id,
        highlights: parseHighlights(m.content).highlights,
      })),
    [messages]
  );

  return messageHighlights.map(({ id, highlights }) => (
    <Message key={id}>
      <HighlightTrigger highlights={highlights} />
    </Message>
  ));
}
```

**Best for:** When multiple children share the computation.

### Option 3: JSON.stringify for Deep Comparison (Use Sparingly)

```tsx
function HighlightTrigger({ highlights, onSectionHighlight }) {
  // ✅ Works but has overhead - use for small arrays only
  const highlightsKey = JSON.stringify(highlights);

  useEffect(() => {
    const parsedHighlights = JSON.parse(highlightsKey);
    parsedHighlights.forEach((id, i) => {
      setTimeout(() => onSectionHighlight(id), i * 500);
    });
  }, [highlightsKey, onSectionHighlight]);

  return null;
}
```

**Best for:** Rare cases where memoization at source isn't possible.

**Caveat:** JSON.stringify has performance cost and doesn't preserve order for objects.

### Option 4: Track by Stable ID Instead of Array

```tsx
function HighlightTrigger({ highlights, messageId, onSectionHighlight }) {
  // ✅ CORRECT - Use stable identifier instead of array
  const processedRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    // Only process highlights we haven't seen for this message
    const newHighlights = highlights.filter(
      (id) => !processedRef.current.has(`${messageId}-${id}`)
    );

    newHighlights.forEach((id, i) => {
      processedRef.current.add(`${messageId}-${id}`);
      setTimeout(() => onSectionHighlight(id), i * 500);
    });
  }, [highlights, messageId, onSectionHighlight]);

  return null;
}
```

**Best for:** When effect should only run once per unique item, not per render.

### Option 5: Move Effect to Parent

```tsx
function MessageList({ messages, onSectionHighlight }) {
  // ✅ CORRECT - Single effect at parent level
  const allHighlights = useMemo(
    () => messages.flatMap((m) => parseHighlights(m.content).highlights),
    [messages]
  );

  useEffect(() => {
    allHighlights.forEach((id, i) => {
      setTimeout(() => onSectionHighlight(id), i * 500);
    });
  }, [allHighlights, onSectionHighlight]);

  return messages.map((m) => <Message key={m.id} content={m.content} />);
}
```

**Best for:** When effect naturally belongs at container level.

---

## Quick Decision Tree

```
Array in useEffect dependency?
|
+-- Is array created during render? (function call, .map, .filter, etc.)
    |
    +-- NO (prop or state) --> Usually safe, check parent
    |
    +-- YES --> Stabilize it!
        |
        +-- Can memoize at creation point?
            |
            +-- YES --> Use useMemo at source
            |
            +-- NO --> Can lift to parent?
                |
                +-- YES --> Lift and memoize there
                |
                +-- NO --> Use JSON.stringify or track by ID
```

---

## Code Review Checklist

When reviewing PRs with useEffect dependencies:

- [ ] **Check array sources:** Are any dependencies created during render?
- [ ] **Search for transforms:** `.map()`, `.filter()`, `.slice()`, spread `[...x]`
- [ ] **Check function returns:** Do any functions return arrays used in deps?
- [ ] **Verify memoization:** Are dynamic arrays wrapped in useMemo?
- [ ] **Test for duplicates:** Does the effect run multiple times unexpectedly?

### Copy-Paste Review Comment

````markdown
**Unstable Array Dependency**

This array is created fresh on every render, causing the useEffect to run
repeatedly even when the data hasn't changed.

**Fix:** Wrap in useMemo at the source:

```tsx
const highlights = useMemo(() => parseHighlights(content).highlights, [content]);
```
````

See: `docs/solutions/patterns/REACT_UNSTABLE_ARRAY_DEPENDENCY_PREVENTION.md`

````

---

## Testing for This Issue

### 1. Console Log Test

```tsx
useEffect(() => {
  console.log('Effect ran!', highlights);
  // If this logs on every parent re-render, you have the issue
}, [highlights]);
````

### 2. Ref Counter Test

```tsx
const renderCount = useRef(0);
const effectCount = useRef(0);

renderCount.current++;

useEffect(() => {
  effectCount.current++;
  console.log(`Render: ${renderCount.current}, Effect: ${effectCount.current}`);
  // If effect count equals render count, dependency is unstable
}, [highlights]);
```

### 3. React DevTools Profiler

1. Open React DevTools > Profiler
2. Record while interacting with the app
3. Check for "Why did this render?" on the component
4. Look for "Hook 2 changed" (or similar) every render

---

## Common Scenarios

### Scenario 1: Parsing Message Content

```tsx
// ❌ WRONG
function ChatMessage({ content }) {
  const { mentions } = parseMentions(content); // New array each render

  useEffect(() => {
    mentions.forEach((m) => highlightUser(m));
  }, [mentions]); // Runs every render!
}

// ✅ CORRECT
function ChatMessage({ content }) {
  const mentions = useMemo(() => parseMentions(content).mentions, [content]);

  useEffect(() => {
    mentions.forEach((m) => highlightUser(m));
  }, [mentions]); // Only runs when content changes
}
```

### Scenario 2: Filtering Props

```tsx
// ❌ WRONG
function UserList({ users, activeFilter }) {
  const activeUsers = users.filter((u) => u.active === activeFilter); // New array!

  useEffect(() => {
    trackActiveUsers(activeUsers);
  }, [activeUsers]); // Runs every render!
}

// ✅ CORRECT
function UserList({ users, activeFilter }) {
  const activeUsers = useMemo(
    () => users.filter((u) => u.active === activeFilter),
    [users, activeFilter]
  );

  useEffect(() => {
    trackActiveUsers(activeUsers);
  }, [activeUsers]); // Only runs when users or filter changes
}
```

### Scenario 3: Derived State from Multiple Props

```tsx
// ❌ WRONG
function Dashboard({ sales, returns }) {
  const metrics = calculateMetrics(sales, returns); // New object!

  useEffect(() => {
    reportMetrics(metrics);
  }, [metrics]); // Runs every render!
}

// ✅ CORRECT
function Dashboard({ sales, returns }) {
  const metrics = useMemo(() => calculateMetrics(sales, returns), [sales, returns]);

  useEffect(() => {
    reportMetrics(metrics);
  }, [metrics]); // Only runs when sales or returns change
}
```

---

## ESLint Rules

The `react-hooks/exhaustive-deps` rule will warn about missing dependencies but won't catch unstable references. You need manual review or a custom rule.

### Custom ESLint Rule Pattern (Conceptual)

```javascript
// A custom rule could warn on:
// - Array literal in dependency array
// - Function call result directly in dependency array
// - .map/.filter/.slice result in dependency array

// Example warning:
// "Array created during render used in useEffect dependency.
//  Consider wrapping in useMemo."
```

---

## Performance Comparison

| Approach        | Memory | CPU                | Correctness | Use When                     |
| --------------- | ------ | ------------------ | ----------- | ---------------------------- |
| No fix (broken) | Low    | High (effect spam) | Broken      | Never                        |
| useMemo         | Low    | Low                | Correct     | Default choice               |
| JSON.stringify  | Medium | Medium             | Correct     | Can't memoize at source      |
| Track by ID     | Low    | Low                | Correct     | Run-once semantics needed    |
| Lift to parent  | Low    | Low                | Correct     | Multiple children share data |

---

## Related Documentation

- [React Hooks Early Return Prevention](./REACT_HOOKS_EARLY_RETURN_PREVENTION.md)
- [React Query Deduplication](./REACT_QUERY_DEDUPLICATION_PREVENTION.md)
- [TanStack Query API Deduplication](../performance-issues/tanstack-query-api-deduplication-useOnboardingState-MAIS-20260108.md)

---

## Quick Reference Card

```
+--------------------------------------------------+
|      REACT UNSTABLE ARRAY DEPENDENCY             |
+--------------------------------------------------+
|                                                  |
|  [] !== []  <-- Different references!            |
|                                                  |
|  ❌ WRONG:                                       |
|  const arr = getData();  // New array each time  |
|  useEffect(() => {}, [arr]);  // Runs every time |
|                                                  |
|  ✅ CORRECT:                                     |
|  const arr = useMemo(() => getData(), [deps]);   |
|  useEffect(() => {}, [arr]);  // Stable ref      |
|                                                  |
+--------------------------------------------------+
|  DETECTION:                                      |
|  - Function returns in render path               |
|  - .map(), .filter(), .slice(), [...spread]      |
|  - Destructured { array } from function          |
+--------------------------------------------------+
|  FIXES (in preference order):                    |
|  1. useMemo at source                            |
|  2. Lift to parent and memoize                   |
|  3. JSON.stringify (small arrays only)           |
|  4. Track by stable ID instead                   |
+--------------------------------------------------+
```

---

**Last Updated:** 2026-01-09
**Maintainer:** MAIS Engineering
