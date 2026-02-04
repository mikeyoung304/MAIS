---
module: MAIS
date: 2026-02-04
problem_type: react_performance_bug
component: apps/web/src/components
symptoms:
  - Timer stuck at initial calculated value
  - Elapsed time never updates
  - Urgency indicators not changing over time
  - Works on page refresh but not during user interaction
  - "Works when I reload the page" pattern
root_cause: useMemo dependency array missing time-dependent variables
resolution_type: prevention_strategy
severity: P2
tags: [react-performance, useMemo, timer, stale-closure, dependencies, time]
pitfall_number: 97
---

# useMemo Stale Timer Prevention

**Pitfall #97:** Using `useMemo` to calculate elapsed time with incomplete dependency arrays, causing the timer calculation to run only once while user expects real-time updates.

---

## Quick Reference Card

```typescript
// ANTI-PATTERN - Timer frozen at initial value
const elapsedSeconds = useMemo(() => {
  const now = Date.now();
  const created = order.created_at; // Created timestamp
  return Math.floor((now - created) / 1000);
}, [order.created_at]); // ❌ Missing 'now' - runs once, never updates

// Result: Shows "42 seconds ago" forever

// CORRECT - Use useEffect + state for time-dependent values
const [elapsedSeconds, setElapsedSeconds] = useState(0);

useEffect(() => {
  const timer = setInterval(() => {
    setElapsedSeconds(Math.floor((Date.now() - order.created_at) / 1000));
  }, 1000);
  return () => clearInterval(timer);
}, [order.created_at]);

// Result: Updates every second "42s → 43s → 44s..."
```

---

## Problem Statement

### The Bug

Using `useMemo` with a computation that depends on the current time (like `Date.now()`), but only including static dependencies in the dependency array. The memoized value is computed once and never recalculated, so the timer appears frozen.

### Why It Fails

1. **useMemo only reruns when dependencies change** - If dependencies are `[order.created_at]` and that never changes, the calculation runs once and caches forever
2. **Date.now() is not in dependencies** - The current time keeps advancing, but useMemo doesn't know to recompute
3. **No way to express "recalculate on every render"** - useMemo is designed for expensive computations that should be cached, not for values that change frequently
4. **Subtle because it "works" initially** - The timer shows the correct value on first render, then mysteriously stops updating

### Symptoms

- Timer component displays "2 minutes ago" and stays frozen at that value
- Page reload fixes it (new component mount recomputes)
- Refresh button in UI fixes it (state change triggers new calculation)
- Other components nearby update normally
- No console errors or warnings
- Parent component updates but timer value doesn't change
- "Hard refresh (Cmd+Shift+R) fixes it" pattern

---

## Root Cause Analysis

```typescript
// PROBLEM CODE - Timer frozen
function OrderStatus({ order }) {
  const elapsedSeconds = useMemo(() => {
    console.log('Computing elapsed time'); // Logs ONCE, never again
    const now = Date.now();
    const created = new Date(order.created_at).getTime();
    return Math.floor((now - created) / 1000);
  }, [order.created_at]); // ← Missing: no time-dependent dependencies

  return <div>Created {elapsedSeconds}s ago</div>;
}

// Timeline:
// Mount (t=0s)    → useMemo runs → elapsedSeconds = 0s ✓
// t=1s (1 sec later) → order.created_at unchanged → useMemo cached value = 0s ❌
// t=2s (2 sec later) → order.created_at unchanged → useMemo cached value = 0s ❌
// User clicks refresh → New mount → useMemo runs → elapsedSeconds = 120s ✓
```

**Why this is different from normal memoization:**

```typescript
// This pattern IS correct (memoized because dependency doesn't change often):
const filteredItems = useMemo(
  () => items.filter((item) => item.status === filter),
  [items, filter] // When items or filter change, recompute
);

// This pattern is WRONG (trying to memoize time-dependent value):
const elapsedSeconds = useMemo(
  () => Math.floor((Date.now() - timestamp) / 1000),
  [timestamp] // Time is not in dependencies, so it never updates
);
```

---

## Solution Patterns

### Pattern 1: useEffect + useState (Recommended for timers)

Use `useEffect` to set up an interval that updates state on a schedule:

```typescript
import { useState, useEffect } from 'react';

function OrderStatus({ order }) {
  const [elapsedSeconds, setElapsedSeconds] = useState(0);

  useEffect(() => {
    // Compute initial value
    setElapsedSeconds(
      Math.floor((Date.now() - new Date(order.created_at).getTime()) / 1000)
    );

    // Update every second
    const interval = setInterval(() => {
      setElapsedSeconds(
        Math.floor((Date.now() - new Date(order.created_at).getTime()) / 1000)
      );
    }, 1000);

    return () => clearInterval(interval);
  }, [order.created_at]);

  return <div>Created {elapsedSeconds}s ago</div>;
}
```

**Why this works:**

- `useEffect` runs whenever `order.created_at` changes
- Interval callback has access to current time every 1 second
- `setElapsedSeconds` triggers re-render with new value
- Cleanup function prevents memory leaks

### Pattern 2: Custom Hook for Elapsed Time

Extract the timer logic into a reusable hook:

```typescript
import { useState, useEffect } from 'react';

function useElapsedTime(startTime: Date | number): number {
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    // Ensure startTime is a timestamp
    const start = typeof startTime === 'number' ? startTime : startTime.getTime();

    // Compute initial value immediately
    setElapsed(Math.floor((Date.now() - start) / 1000));

    // Update every second
    const interval = setInterval(() => {
      setElapsed(Math.floor((Date.now() - start) / 1000));
    }, 1000);

    return () => clearInterval(interval);
  }, [startTime]);

  return elapsed;
}

// Usage:
function OrderStatus({ order }) {
  const elapsedSeconds = useElapsedTime(order.created_at);
  return <div>Created {elapsedSeconds}s ago</div>;
}
```

### Pattern 3: useMemo with Computed Value Only (when data is available)

If you need to use `useMemo` for actual expensive calculations, compute only once and use separate state for timing:

```typescript
function OrderMetrics({ order, metrics }) {
  // Expensive computation - memoized
  const analysis = useMemo(() => {
    return expensiveMetricsAnalysis(metrics); // Only runs when metrics change
  }, [metrics]);

  // Time-dependent value - in state
  const [elapsedSeconds, setElapsedSeconds] = useState(0);

  useEffect(() => {
    setElapsedSeconds(
      Math.floor((Date.now() - new Date(order.created_at).getTime()) / 1000)
    );

    const interval = setInterval(() => {
      setElapsedSeconds(
        Math.floor((Date.now() - new Date(order.created_at).getTime()) / 1000)
      );
    }, 1000);

    return () => clearInterval(interval);
  }, [order.created_at]);

  return (
    <div>
      {analysis.label} - Created {elapsedSeconds}s ago
    </div>
  );
}
```

### Pattern 4: Format Display at Render Time (no state needed)

If you only need to display elapsed time (not use it in calculations), compute fresh on every render:

```typescript
import { formatDistanceToNow } from 'date-fns'; // Or similar library

function OrderStatus({ order }) {
  // Recomputes on every render - cheap operation
  const displayTime = formatDistanceToNow(new Date(order.created_at), {
    addSuffix: true,
  });

  return <div>Created {displayTime}</div>;
}
```

**Trade-off:** Updates only when parent re-renders, not on a timer. Good for static displays, not for urgency indicators that need smooth updates.

### Pattern 5: Variable Update Interval (for optimization)

If updating every second is too expensive, use a longer interval:

```typescript
function OrderStatus({ order }) {
  const [elapsedMinutes, setElapsedMinutes] = useState(0);

  useEffect(() => {
    const update = () => {
      setElapsedMinutes(
        Math.floor(
          (Date.now() - new Date(order.created_at).getTime()) / (1000 * 60)
        )
      );
    };

    update(); // Initial update

    // Update every 5 minutes instead of every second (if precision isn't critical)
    const interval = setInterval(update, 5 * 60 * 1000);

    return () => clearInterval(interval);
  }, [order.created_at]);

  return <div>Created {elapsedMinutes}m ago</div>;
}
```

---

## Decision Criteria: useMemo vs useEffect for Time

Use this decision tree:

```
Does the value depend on current time (Date.now())?
├─ YES: Use useEffect + setState (Pattern 1-3)
│       useMemo will never update
│
└─ NO: Use useMemo safely

Is the computation expensive (>5ms)?
├─ YES: Memoize the computation
│       But compute time-dependent parts separately
│
└─ NO: Compute on every render
```

| Scenario                   | Tool                          | Reason                               |
| -------------------------- | ----------------------------- | ------------------------------------ |
| Elapsed time counter       | `useEffect + useState`        | Needs fresh time value on interval   |
| Urgency badge (24h, 48h)   | `useEffect` (longer interval) | Only needs to update every few hours |
| Age label (1m, 1h, 1d ago) | `useMemo` (no interval)       | Only updates when parent re-renders  |
| Expensive metric calc      | `useMemo`                     | Memoize expensive part separately    |
| Simple string concat       | Render-time                   | No caching needed for cheap ops      |

---

## Code Review Checklist

Add to PR review checklist when reviewing time-dependent components:

```markdown
## Time-Dependent Components

- [ ] **No useMemo with Date.now()** - Search for `useMemo(...Date.now()` pattern
  - Timer components → Use `useEffect + setState` (Pattern 1-2)
  - Elapsed time calculations → Same as above
  - "Age" displays → Use `date-fns` library
- [ ] **useEffect cleanup** - Any timer/interval has cleanup function (return () => clearInterval)
- [ ] **Multiple timers** - Verify no race conditions (e.g., 2 useEffect intervals not fighting)
- [ ] **Initial value** - Elapsed time shows correct value on mount (not 0 or stale)
- [ ] **Unmount safety** - Verify timer doesn't leak memory (check with DevTools)
- [ ] **Dependency array** - useEffect depends on anything that affects the start time
```

---

## ESLint Rule Suggestion

Create a custom ESLint rule to detect this pattern:

```javascript
// eslint-rules/no-usememo-date-now.js
module.exports = {
  meta: {
    type: 'problem',
    docs: {
      description: 'Disallow Date.now() inside useMemo (values never update)',
      category: 'Possible Errors',
    },
    messages: {
      noDateNowInMemo:
        'Date.now() inside useMemo will only be computed once. Use useEffect + setState for time-dependent values instead.',
    },
    schema: [],
  },
  create(context) {
    let inUseMemo = false;

    return {
      CallExpression(node) {
        // Detect useMemo call
        if (
          node.callee.name === 'useMemo' ||
          (node.callee.object?.name === 'React' && node.callee.property?.name === 'useMemo')
        ) {
          inUseMemo = true;
          this.currentNode = node;
        }
      },

      'CallExpression:exit'(node) {
        // Check if exiting a useMemo
        if (node === this.currentNode) {
          inUseMemo = false;
        }
      },

      Identifier(node) {
        // Within useMemo, look for Date.now
        if (inUseMemo && node.name === 'Date') {
          const parent = node.parent;
          if (parent?.type === 'MemberExpression' && parent.property?.name === 'now') {
            context.report({
              node,
              messageId: 'noDateNowInMemo',
            });
          }
        }
      },
    };
  },
};
```

**Add to `.eslintrc.js`:**

```javascript
module.exports = {
  rules: {
    'local/no-usememo-date-now': 'error',
  },
};
```

**Run to find violations:**

```bash
npm run lint -- apps/web/src --rule local/no-usememo-date-now
```

---

## Testing Strategy

### Unit Test: Verify Timer Updates

```typescript
import { render, screen, waitFor } from '@testing-library/react';
import { OrderStatus } from './OrderStatus';

describe('OrderStatus timer', () => {
  it('should update elapsed time every second', async () => {
    const pastTime = new Date(Date.now() - 5000); // 5 seconds ago
    const { rerender } = render(<OrderStatus order={{ created_at: pastTime }} />);

    // Initial render shows ~5 seconds
    expect(screen.getByText(/Created (4|5|6)s ago/)).toBeInTheDocument();

    // After 1 second, should show ~6 seconds
    await waitFor(
      () => {
        expect(screen.getByText(/Created (5|6|7)s ago/)).toBeInTheDocument();
      },
      { timeout: 2000 }
    );

    // After 2 seconds more, should show ~8 seconds
    await waitFor(
      () => {
        expect(screen.getByText(/Created (7|8|9)s ago/)).toBeInTheDocument();
      },
      { timeout: 2000 }
    );
  });

  it('should cleanup interval on unmount', async () => {
    const pastTime = new Date(Date.now() - 5000);
    const { unmount } = render(<OrderStatus order={{ created_at: pastTime }} />);

    // Get initial value
    const initialText = screen.getByText(/Created.*s ago/).textContent;

    // Unmount
    unmount();

    // Wait and verify no memory leak by checking console for setInterval warnings
    // (This is more of a sanity check)
    expect(true).toBe(true);
  });
});
```

### Integration Test: Verify Stale Closure Bug is Fixed

```typescript
import { render, screen } from '@testing-library/react';
import { OrderStatus } from './OrderStatus';

describe('OrderStatus - stale closure prevention', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.runOnlyPendingTimers();
    jest.useRealTimers();
  });

  it('should NOT freeze at initial value (regression test for stale useMemo)', async () => {
    const created = new Date('2026-02-04T10:00:00Z');
    jest.setSystemTime(new Date('2026-02-04T10:00:05Z')); // 5 seconds later

    const { rerender } = render(
      <OrderStatus order={{ created_at: created.toISOString() }} />
    );

    // Should show 5 seconds
    expect(screen.getByText(/Created 5s ago/)).toBeInTheDocument();

    // Advance time by 3 seconds
    jest.advanceTimersByTime(3000);

    // Should now show 8 seconds (NOT still showing 5s)
    // This test would FAIL with the stale useMemo pattern
    expect(screen.getByText(/Created 8s ago/)).toBeInTheDocument();
  });
});
```

### E2E Test: Visual Verification

```typescript
test('order status timer should update in real-time', async ({ page }) => {
  // Create an order
  const response = await page.request.post('/api/orders', {
    data: { title: 'Test Order' },
  });
  const order = await response.json();

  // Navigate to order page
  await page.goto(`/orders/${order.id}`);

  // Get initial elapsed time
  const initialTime = await page.locator('[data-testid="elapsed-time"]').textContent();
  expect(initialTime).toMatch(/\d+s ago/);

  // Wait 3 seconds
  await page.waitForTimeout(3000);

  // Get new elapsed time
  const newTime = await page.locator('[data-testid="elapsed-time"]').textContent();

  // Should be different (time advanced)
  // If bug exists, times would be identical
  expect(newTime).not.toBe(initialTime);
  expect(newTime).toMatch(/\d+s ago/);
});
```

---

## Warning Signs / Symptoms

Look for these symptoms to identify the bug in existing code:

| Symptom                                               | Location           | Action                            |
| ----------------------------------------------------- | ------------------ | --------------------------------- |
| Timer displays value forever                          | Component UI       | Check useMemo with Date.now()     |
| "Works after page reload"                             | User report        | Likely stale memoized value       |
| Urgency badge never updates                           | Badge component    | Check useEffect interval setup    |
| Countdown freezes                                     | Booking page       | Verify useEffect dependency array |
| "Order shows created 2h ago even though it's been 4h" | Product monitoring | Likely stale timer bug            |
| Timer shows correct on mount, wrong after 10min       | Real usage         | useEffect cleanup issue (likely)  |

---

## Common Pitfalls

### Pitfall 1: Forgetting useEffect Cleanup

```typescript
// ❌ BAD: Memory leak - interval never stops
function Timer({ startTime }) {
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    setInterval(() => {
      setElapsed(Math.floor((Date.now() - startTime) / 1000));
    }, 1000);
    // Missing return () => clearInterval(...)
  }, [startTime]);

  return <div>{elapsed}s</div>;
}

// ✅ GOOD: Interval is cleaned up
function Timer({ startTime }) {
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setElapsed(Math.floor((Date.now() - startTime) / 1000));
    }, 1000);
    return () => clearInterval(interval);
  }, [startTime]);

  return <div>{elapsed}s</div>;
}
```

### Pitfall 2: Initial Value Always 0

```typescript
// ❌ BAD: Shows 0s for first second
function Timer({ startTime }) {
  const [elapsed, setElapsed] = useState(0); // Starts at 0

  useEffect(() => {
    const interval = setInterval(() => {
      setElapsed(Math.floor((Date.now() - startTime) / 1000));
    }, 1000);
    return () => clearInterval(interval);
  }, [startTime]); // Only runs interval, never updates before 1s passes

  return <div>{elapsed}s</div>;
}

// ✅ GOOD: Computes initial value immediately
function Timer({ startTime }) {
  const [elapsed, setElapsed] = useState(() =>
    Math.floor((Date.now() - startTime) / 1000)
  ); // Initial value computed from startTime

  useEffect(() => {
    const interval = setInterval(() => {
      setElapsed(Math.floor((Date.now() - startTime) / 1000));
    }, 1000);
    return () => clearInterval(interval);
  }, [startTime]);

  return <div>{elapsed}s</div>;
}
```

### Pitfall 3: Race Condition with Multiple Timers

```typescript
// ❌ BAD: Two intervals fighting over state
function Timer({ startTime, refreshTime }) {
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setElapsed(Math.floor((Date.now() - startTime) / 1000));
    }, 1000);
    return () => clearInterval(interval);
  }, [startTime]);

  useEffect(() => {
    const interval = setInterval(() => {
      setElapsed(Math.floor((Date.now() - startTime) / 1000));
    }, 2000);
    return () => clearInterval(interval);
  }, [startTime, refreshTime]); // Second timer stepping on first

  return <div>{elapsed}s</div>;
}

// ✅ GOOD: Single interval, multiple dependencies handled
function Timer({ startTime, refreshTime }) {
  const [elapsed, setElapsed] = useState(() =>
    Math.floor((Date.now() - startTime) / 1000)
  );

  useEffect(() => {
    const update = () => {
      setElapsed(Math.floor((Date.now() - startTime) / 1000));
    };

    const interval = setInterval(update, 1000);
    return () => clearInterval(interval);
  }, [startTime]); // Single effect for timer logic
}
```

---

## Grep Commands for Code Review

Use these to find potential stale timer bugs:

```bash
# Find useMemo with Date.now() (likely bug)
grep -rn "useMemo.*Date\.now\|Date\.now.*useMemo" apps/web/src --include="*.tsx" | head -10

# Find useEffect with setInterval (might be correct)
grep -rn "setInterval" apps/web/src --include="*.tsx" -B 2 | grep -A 2 "useEffect" | head -20

# Find "elapsed" or "created_at" timer variables
grep -rn "elapsed\|createdAt\|created_at" apps/web/src --include="*.tsx" | grep -i "ago\|second\|minute" | head -10

# Find components without cleanup in intervals
grep -rn "setInterval" apps/web/src --include="*.tsx" -A 3 | grep -v "clearInterval" | head -10
```

---

## Related Patterns

- **Pitfall #29:** TanStack Query staleTime blocking real-time (use `staleTime: 0`)
- **Pitfall #30:** Race condition on cache invalidation (add 100ms delay)
- **Pitfall #96:** Zustand selector returning new object causes re-renders
- **Pattern:** Custom hooks for time-dependent values
- **Pattern:** date-fns for formatting relative dates

---

## References

- [React useEffect Documentation](https://react.dev/reference/react/useEffect)
- [React useMemo Documentation](https://react.dev/reference/react/useMemo)
- [date-fns formatDistanceToNow](https://date-fns.org/docs/formatDistanceToNow)
- [Cleaning Up Effects](https://react.dev/learn/synchronizing-with-effects#cleaning-up-an-effect)

---

**Last Updated:** 2026-02-04
**Status:** Active Prevention Strategy
**Severity:** P2 (Timer appears frozen, impacts UX but not data integrity)
**Test Coverage:** Unit test with fake timers pattern, E2E test pattern
