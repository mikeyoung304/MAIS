---
module: MAIS
date: 2025-12-31
problem_type: prevention_strategy
component: apps/web/src/components, apps/web/src/app
phase: Frontend Development (Next.js)
symptoms:
  - Returning null/undefined during SSR instead of placeholder
  - Component renders differently on server vs client
  - Cumulative Layout Shift (CLS) from skeleton appearing after hydration
  - Visual flicker when page loads
  - "Hydration failed" console errors in Next.js
severity: P1
related_files:
  - apps/web/src/app/(protected)/tenant/dashboard/page.tsx
  - apps/web/src/components/ui/Card.tsx
  - apps/web/src/components/SkeletonLoader.tsx
tags: [nextjs, hydration, ssr, ux-patterns, performance, web-vitals]
---

# Hydration Mismatch Prevention Strategies

This document captures the root causes of hydration mismatches and provides patterns to render SSR-safe components consistently.

## Executive Summary

Hydration mismatches occur when the server renders something different from what the client renders after hydration. This breaks React's reconciliation and causes visual flicker.

**Three Common Causes:**

1. **Returning null during SSR** - Server returns nothing, client renders after loading
2. **Time-based rendering** - Server and client have different timestamps
3. **Window-dependent code** - Server can't access `window`, client can

**P1 Problems:**

- Cumulative Layout Shift (CLS) reduces Lighthouse score
- Page flickers as skeletons replace content
- Console errors confuse debugging
- Poor user experience (looks buggy)

**P2 Problems:**

- Developers waste time debugging "why does it look different?"
- Inconsistent patterns across components
- Testing doesn't catch SSR issues

---

## Issue 1: Returning Null During SSR Instead of Placeholder

### The Problem

Components that depend on client-side state often render `null` during SSR:

```typescript
// PROBLEMATIC: Returns null on server, content on client
export default function DashboardPage() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    fetchDashboardData();
  }, []);

  // During SSR: returns null
  // During client hydration: returns skeleton
  // After fetch: returns content
  if (isLoading) {
    return null;  // ❌ Server renders nothing
  }

  return <div>{/* content */}</div>;
}
```

**Timeline:**

```
Server (initial response):
  → Renders: (nothing)
  → Sends to browser

Browser (hydration):
  → Hydrates: (nothing)
  → Sees component code, renders: Skeleton
  → Browser now has skeleton, HTML was empty
  → MISMATCH! React errors

Browser (after fetch):
  → Client renders: Real content
  → Layout shift occurs (skeleton → content)
```

### Code Review Finding

**File:** `apps/web/src/app/(protected)/tenant/dashboard/page.tsx` (lines 232-236)

```typescript
<div className="text-2xl font-bold text-text-primary">
  {isLoading ? (
    <div className="h-8 w-16 animate-pulse rounded bg-neutral-700" />
  ) : (
    card.value
  )}
</div>
```

**Issue:** Component renders skeleton on client, but what was sent from server?

This pattern is actually CORRECT because it conditionally shows placeholder. But the issue happens when `isLoading` is always true on server:

```typescript
// BAD: Component always loading on server
const [isLoading, setIsLoading] = useState(true); // Initially true

// On server: isLoading is true → shows skeleton
// On client: isLoading is true → shows skeleton
// Good so far...

// But if data is fetched immediately:
useEffect(() => {
  // This runs AFTER hydration on client
  // So during hydration, server had skeleton but data was already available
}, []);
```

### The Fix

**Step 1: Distinguish between SSR rendering and post-hydration loading**

```typescript
// apps/web/src/app/(protected)/tenant/dashboard/page.tsx (improved)
'use client';

import { useEffect, useState, useCallback } from 'react';

interface DashboardStats {
  packagesCount: number;
  bookingsCount: number;
  blackoutsCount: number;
  hasStripeConnected: boolean;
}

/**
 * Tenant Dashboard
 *
 * KEY: On server/hydration, we don't have data yet.
 * Show SSR-safe placeholder, then load data on client.
 */
export default function TenantDashboardPage() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [isHydrated, setIsHydrated] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchDashboardData = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/tenant-admin/packages');
      if (!response.ok) throw new Error('Failed to fetch');

      const packages = await response.json();
      setStats({
        packagesCount: packages.length,
        // ... other stats
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
      setStats(null);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Mark as hydrated ONLY after first client render
  useEffect(() => {
    setIsHydrated(true);
    fetchDashboardData();
  }, [fetchDashboardData]);

  // During SSR and initial hydration, show consistent placeholder
  // This is what BOTH server and client will render
  const displayValue = stats?.packagesCount ?? (
    <div className="h-8 w-16 animate-pulse rounded bg-neutral-700" />
  );

  return (
    <div className="space-y-8">
      {/* Rest of component... */}

      {/* Stats Cards - SSR-safe rendering */}
      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
        {[
          { title: 'Packages', value: displayValue },
          // ... other cards
        ].map(card => (
          <Card key={card.title}>
            <CardHeader>
              <CardTitle className="text-sm font-medium">
                {card.title}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {/* ✅ Both server and client show placeholder */}
                {card.value}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Error state - explicit and SSR-safe */}
      {isHydrated && error && (
        <Card className="border-red-800 bg-red-950/50">
          <CardContent className="p-6">
            <p className="text-red-300">{error}</p>
            <Button onClick={fetchDashboardData}>Retry</Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
```

**Key improvements:**

1. **`isHydrated` flag** - Prevents client-only UI during SSR
2. **Consistent placeholder** - Server and client render same skeleton
3. **Data fetched after hydration** - Fetch only runs on client
4. **No layout shift** - Placeholder and content have same height/width

**Step 2: Create SSR-safe skeleton component**

```typescript
// apps/web/src/components/skeletons/StatSkeleton.tsx
export interface StatSkeletonProps {
  /**
   * Reserve space for content so skeleton matches final size
   * This prevents layout shift
   */
  width?: string;  // e.g., 'w-16' for 64px width
  height?: string; // e.g., 'h-8' for 32px height
  animated?: boolean;
}

export function StatSkeleton({
  width = 'w-16',
  height = 'h-8',
  animated = true,
}: StatSkeletonProps) {
  return (
    <div
      className={`
        rounded ${width} ${height}
        bg-neutral-700
        ${animated ? 'animate-pulse' : ''}
      `}
    />
  );
}

// Usage with guaranteed sizing
export function DashboardCard() {
  const [value, setValue] = useState<number | null>(null);

  return (
    <div className="text-2xl font-bold">
      {value ?? <StatSkeleton width="w-16" height="h-8" />}
    </div>
  );
}
```

**Step 3: Dimension-preserving pattern**

```typescript
// GOOD: Placeholder and content have exact same dimensions
<div className="space-y-4">
  {/* Title - always same size */}
  <h2 className="text-xl font-semibold h-6">
    {title || <StatSkeleton width="w-24" height="h-6" />}
  </h2>

  {/* Value - always 2xl bold = consistent height */}
  <div className="text-2xl font-bold h-8">
    {value ?? <StatSkeleton width="w-16" height="h-8" />}
  </div>

  {/* Description - always text-sm = consistent height */}
  <p className="text-sm text-text-muted h-5">
    {description || <StatSkeleton width="w-32" height="h-5" />}
  </p>
</div>
```

### Prevention Checklist

**For all components with client-side data loading:**

- [ ] Component shows SSR-safe placeholder by default
- [ ] Placeholder has exact same dimensions as final content
- [ ] No conditional `null` returns (always render something)
- [ ] `useEffect` doesn't affect SSR rendering
- [ ] No time-based rendering differences between server/client
- [ ] No `window`/`document` access in render code (only effects)
- [ ] Explicit `isHydrated` check before client-only UI
- [ ] No layout shift when data loads (measured with Lighthouse)

**During code review:**

- [ ] Is component returning `null` from render?
- [ ] Do placeholder and content have same size?
- [ ] Could hydration differ from server render?
- [ ] Are there `useEffect` calls that affect render output?
- [ ] Is `window` accessed outside an effect?

### Code Pattern to Follow

**GOOD: SSR-safe data component**

```typescript
'use client';

import { useEffect, useState } from 'react';
import { StatSkeleton } from '@/components/skeletons';

export function DataCard({ id }: { id: string }) {
  const [data, setData] = useState<Data | null>(null);
  const [isHydrated, setIsHydrated] = useState(false);

  useEffect(() => {
    // Mark as hydrated and fetch
    setIsHydrated(true);
    fetchData(id).then(setData);
  }, [id]);

  // Always render something - server and client agree on placeholder
  return (
    <Card>
      <CardHeader>
        <CardTitle>
          {data?.title || <StatSkeleton width="w-24" height="h-6" />}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold h-8">
          {data?.value ?? <StatSkeleton width="w-16" height="h-8" />}
        </div>

        {/* Client-only UI gated by isHydrated */}
        {isHydrated && data && (
          <p className="text-sm text-text-muted mt-2">
            Last updated: {data.updatedAt}
          </p>
        )}
      </CardContent>
    </Card>
  );
}
```

### Testing Recommendation

**Test for hydration mismatch:**

```typescript
// apps/web/__tests__/hydration.test.ts
import { render } from '@testing-library/react';
import { DashboardCard } from '@/components/dashboard-card';

describe('Hydration safety', () => {
  it('should render same content during SSR and hydration', () => {
    // Initial render (simulating SSR)
    const { container: serverRender } = render(<DashboardCard />);
    const serverHTML = serverRender.innerHTML;

    // Second render (simulating client hydration)
    const { container: clientRender } = render(<DashboardCard />);
    const clientHTML = clientRender.innerHTML;

    // Should be identical until data loads
    expect(serverHTML).toBe(clientHTML);
  });

  it('should not change after hydration', () => {
    const { container, rerender } = render(<DashboardCard />);
    const beforeHydration = container.innerHTML;

    // Simulate hydration
    rerender(<DashboardCard />);
    const afterHydration = container.innerHTML;

    expect(beforeHydration).toBe(afterHydration);
  });

  it('should reserve space for content to prevent layout shift', () => {
    const { container } = render(<DashboardCard />);
    const skeleton = container.querySelector('[class*="h-8"]');

    // Skeleton should have explicit height class
    expect(skeleton?.className).toMatch(/h-8/);
  });
});
```

**E2E test for CLS:**

```typescript
// apps/web/e2e/tests/dashboard-cls.spec.ts
import { test, expect } from '@playwright/test';

test('dashboard should have zero CLS', async ({ page }) => {
  await page.goto('/tenant/dashboard');

  // Measure Cumulative Layout Shift while page loads
  const cls = await page.evaluate(() => {
    return new Promise((resolve) => {
      let clsValue = 0;

      // Watch for layout shifts
      new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          if (!(entry as any).hadRecentInput) {
            clsValue += (entry as any).value;
          }
        }
      }).observe({ type: 'layout-shift', buffered: true });

      // Wait for page to stabilize
      setTimeout(() => resolve(clsValue), 3000);
    });
  });

  // CLS should be < 0.1 (good score is < 0.1)
  expect(Number(cls)).toBeLessThan(0.1);
});
```

---

## Issue 2: Time-Based Rendering Differences

### The Problem

Components that include timestamps or time-based logic render differently on server vs client:

```typescript
// PROBLEMATIC: Server and client have different time
export function TimeCard() {
  const now = new Date();  // Server time ≠ client time

  return <div>{now.toLocaleString()}</div>;  // Mismatch!
}
```

### The Fix

**Render time-based content only on client:**

```typescript
// GOOD: Time rendered only after hydration
'use client';

import { useEffect, useState } from 'react';

export function TimeCard() {
  const [isHydrated, setIsHydrated] = useState(false);
  const [time, setTime] = useState<string>('');

  useEffect(() => {
    setIsHydrated(true);
    setTime(new Date().toLocaleString());
  }, []);

  // Server and client both render same placeholder
  if (!isHydrated) {
    return <div className="h-6 w-32 animate-pulse bg-neutral-700" />;
  }

  // Client renders actual time
  return <div>{time}</div>;
}
```

### Prevention Checklist

- [ ] No `new Date()` in render code
- [ ] No `Math.random()` in render code
- [ ] Time-based content gated by `useEffect`
- [ ] Placeholder rendered while hydrating

---

## Issue 3: Window-Dependent Code in Render

### The Problem

Server can't access `window`, causing different renders:

```typescript
// PROBLEMATIC: Server can't access window
export function ScreenSizeCard() {
  const isDesktop = window.innerWidth > 768;  // Error on server!

  return <div>{isDesktop ? 'Desktop' : 'Mobile'}</div>;
}
```

### The Fix

**Access window only in effects:**

```typescript
// GOOD: Window accessed only on client
'use client';

import { useEffect, useState } from 'react';

export function ScreenSizeCard() {
  const [isDesktop, setIsDesktop] = useState<boolean | null>(null);

  useEffect(() => {
    // On client, detect screen size
    const handleResize = () => {
      setIsDesktop(window.innerWidth > 768);
    };

    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Server and client both show placeholder
  if (isDesktop === null) {
    return <div className="h-6 w-24 animate-pulse bg-neutral-700" />;
  }

  return <div>{isDesktop ? 'Desktop' : 'Mobile'}</div>;
}
```

### Prevention Checklist

- [ ] No `window`/`document` access in render code
- [ ] `window` accessed only in `useEffect`
- [ ] Placeholder shown until client-side code runs
- [ ] Responsive behavior doesn't affect SSR

---

## Code Review Checklist: Hydration Safety

### For All 'use client' Components

**Render Output:**

- [ ] Component returns same content during SSR and hydration
- [ ] No `null` returns from render
- [ ] No time-based rendering differences
- [ ] No `window`/`document` in render logic

**Data Loading:**

- [ ] Data fetching only in `useEffect`
- [ ] SSR-safe placeholder shown initially
- [ ] Placeholder has same dimensions as content
- [ ] No layout shift when data loads

**Client-Only Code:**

- [ ] `isHydrated` check gates client-only UI
- [ ] Effects set hydration flag
- [ ] Effects don't affect render output

### Review Questions to Ask

1. **"Could this component render differently on server vs client?"**
   - If yes: Needs hydration fix

2. **"Is this component returning null or undefined?"**
   - If yes: Should return placeholder instead

3. **"Would hydration cause a layout shift?"**
   - If yes: Placeholder needs same dimensions as content

4. **"Does this code access `window` or `document`?"**
   - If yes and in render: Must move to effect
   - If yes and in effect: Already correct

---

## Quick Reference: Hydration-Safe Pattern

```typescript
'use client';

import { useEffect, useState } from 'react';
import { StatSkeleton } from '@/components/skeletons';

export function Component() {
  // 1. Data state
  const [data, setData] = useState<Data | null>(null);

  // 2. Hydration flag
  const [isHydrated, setIsHydrated] = useState(false);

  // 3. Load data only on client (after hydration)
  useEffect(() => {
    setIsHydrated(true);
    fetchData().then(setData);
  }, []);

  // 4. Show consistent placeholder until hydrated
  if (!isHydrated) {
    return <StatSkeleton width="w-24" height="h-8" />;
  }

  // 5. Render content
  return (
    <div>
      {data ? (
        <div>{data.content}</div>
      ) : (
        <StatSkeleton width="w-24" height="h-8" />
      )}
    </div>
  );
}
```

**Key principles:**

1. **Always render something** - No null returns
2. **Match dimensions** - Placeholder = content size
3. **Fetch on client** - useEffect, not render
4. **Hydration check** - Before client-only UI
5. **No dynamic values** - No time, random, window in render

---

## Summary

| Issue                | Cause                                 | Prevention                      |
| -------------------- | ------------------------------------- | ------------------------------- |
| **Null returns**     | Component doesn't have data yet       | Always show placeholder         |
| **Different DOM**    | Conditional rendering based on state  | Use consistent placeholder      |
| **Layout shift**     | Placeholder smaller than content      | Match dimensions exactly        |
| **Time mismatch**    | Server and client have different time | Gate time code behind useEffect |
| **Window undefined** | Server can't access window            | Only use window in effects      |

**Golden Rule:** If server and client could render differently, you have a hydration issue. Always render the same content until client code runs.
