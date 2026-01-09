---
title: 'Next.js Migration E2E Test Patterns'
slug: nextjs-migration-e2e-test-patterns
category: test-failures
severity: P1
component: e2e-tests
tags:
  - playwright
  - nextjs
  - rate-limiting
  - zustand
  - e2e-testing
  - migration
created: 2026-01-09
last_updated: 2026-01-09
symptoms:
  - '429 Too Many Requests errors during E2E test runs'
  - 'Tests timeout waiting for elements that never appear'
  - 'Cannot access Zustand store via page.evaluate()'
  - 'showPreview query parameter has no effect'
  - 'Tests pass individually but fail when run in parallel'
root_cause: >
  Five distinct issues: (1) Rate limiters lacked test environment checks causing 429s,
  (2) Zustand stores not exposed on window for Playwright access,
  (3) React effect ordering caused race conditions with query params,
  (4) Tests designed for Vite SPA patterns incompatible with Next.js App Router,
  (5) NextAuth httpOnly cookies not cleared by clearCookies()
affected_files:
  - server/src/middleware/rateLimiter.ts
  - apps/web/src/stores/agent-ui-store.ts
  - apps/web/src/app/(protected)/tenant/dashboard/page.tsx
  - e2e/tests/agent-ui-control.spec.ts
  - e2e/tests/tenant-signup.spec.ts
  - e2e/fixtures/auth.fixture.ts
related_issues:
  - docs/solutions/test-failures/vitest-skipif-collection-phase-timing-MAIS-20260102.md
  - docs/solutions/patterns/phase-5-testing-and-caching-prevention-MAIS-20251231.md
---

# Next.js Migration E2E Test Patterns

## Problem

After migrating from Vite SPA to Next.js App Router, E2E tests designed for the old architecture failed with multiple distinct issues:

1. **Rate limiting (429 errors)**: `publicLimiter` and `adminLimiter` didn't have test environment overrides
2. **Store inaccessible**: Playwright couldn't access Zustand store via `page.evaluate()`
3. **Race condition**: Query param effect ran before store initialization
4. **Test pattern mismatch**: Tests expected SPA behavior, got SSR/App Router
5. **Session isolation**: `clearCookies()` doesn't clear httpOnly NextAuth cookies

## Root Cause Analysis

### Issue 1: Rate Limiting in E2E Tests

`express-rate-limit` uses in-memory `MemoryStore` by default. When Playwright runs tests in parallel, all requests share the same rate limit counter. The `signupLimiter` had an `isTestEnvironment` check, but `publicLimiter` and `adminLimiter` did not.

```typescript
// BEFORE: No test environment check
export const publicLimiter = rateLimit({
  max: 300, // Hit quickly in parallel E2E tests
});

// AFTER: Test environment bypass
const isTestEnvironment = process.env.NODE_ENV === 'test' || process.env.E2E_TEST === '1';

export const publicLimiter = rateLimit({
  max: isTestEnvironment ? 5000 : 300,
});
```

### Issue 2: Zustand Store Access

Playwright's `page.evaluate()` runs in the browser context but can't access module-scoped variables. The Zustand store needed explicit window exposure.

```typescript
// apps/web/src/stores/agent-ui-store.ts
// Expose for E2E tests
if (typeof window !== 'undefined') {
  (window as unknown as { useAgentUIStore: typeof useAgentUIStore }).useAgentUIStore =
    useAgentUIStore;
  (window as unknown as { agentUIActions: typeof agentUIActions }).agentUIActions = agentUIActions;
}
```

### Issue 3: React Effect Ordering Race Condition

In React, child component effects run BEFORE parent effects. The dashboard's `useEffect` for `showPreview` query param ran before the layout's effect that initialized the store with `tenantId`.

```typescript
// BEFORE: Race condition - effect runs before store is ready
useEffect(() => {
  if (searchParams.get('showPreview') === 'true') {
    agentUIActions.showPreview('home'); // Silently ignored - no tenantId yet!
  }
}, [searchParams]);

// AFTER: Gate on store initialization
const isStoreInitialized = useAgentUIStore(selectIsInitialized);

useEffect(() => {
  if (isStoreInitialized && searchParams.get('showPreview') === 'true') {
    agentUIActions.showPreview('home'); // Now works - tenantId is set
    window.history.replaceState({}, '', '/tenant/dashboard');
  }
}, [searchParams, isStoreInitialized]);
```

### Issue 4: Vite SPA vs Next.js App Router Patterns

| Vite SPA Pattern                       | Next.js App Router Pattern                                  |
| -------------------------------------- | ----------------------------------------------------------- |
| `waitForLoadState('domcontentloaded')` | Add `waitForTimeout(500)` for React hydration               |
| `clearCookies()` for session reset     | `browser.newContext()` for httpOnly cookie isolation        |
| Form submission via React onClick      | HTML5 validation triggers before React (use `type="email"`) |
| Client-side routing only               | SSR + client hydration (wait for interactive)               |

### Issue 5: NextAuth Session Isolation

NextAuth uses httpOnly cookies that `page.context().clearCookies()` cannot clear. Session isolation requires creating a fresh browser context:

```typescript
// BEFORE: Doesn't work for httpOnly cookies
await page.context().clearCookies();

// AFTER: Fresh context for each test
const newContext = await browser.newContext();
const newPage = await newContext.newPage();
```

## Solution

### 1. Rate Limiter Updates (server/src/middleware/rateLimiter.ts)

```typescript
// Must be at TOP of file, before any rate limiter definitions
const isTestEnvironment = process.env.NODE_ENV === 'test' || process.env.E2E_TEST === '1';

export const publicLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: isTestEnvironment ? 5000 : 300, // High limit for parallel E2E
  // ...
});

export const adminLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: isTestEnvironment ? 2000 : 120, // High limit for parallel E2E
  // ...
});
```

### 2. Store Window Exposure (apps/web/src/stores/agent-ui-store.ts)

```typescript
// At end of file - expose for E2E test access
if (typeof window !== 'undefined') {
  (window as unknown as { useAgentUIStore: typeof useAgentUIStore }).useAgentUIStore =
    useAgentUIStore;
  (window as unknown as { agentUIActions: typeof agentUIActions }).agentUIActions = agentUIActions;
}
```

### 3. Dashboard Query Param Fix (dashboard/page.tsx)

```typescript
const isStoreInitialized = useAgentUIStore(selectIsInitialized);

useEffect(() => {
  if (isStoreInitialized && searchParams.get('showPreview') === 'true') {
    agentUIActions.showPreview('home');
    window.history.replaceState({}, '', '/tenant/dashboard');
  }
}, [searchParams, isStoreInitialized]);
```

### 4. E2E Test Helper Patterns

```typescript
// Helper: Access store from Playwright
async function callAgentUIAction(
  page: Page,
  action: 'showPreview' | 'showDashboard' | 'highlightSection',
  ...args: unknown[]
): Promise<void> {
  await page.evaluate(
    ({ action, args }) => {
      const actions = (window as unknown as { agentUIActions?: Record<string, Function> })
        .agentUIActions;
      if (actions?.[action]) {
        actions[action](...args);
      }
    },
    { action, args }
  );
}

// Helper: Wait for hydration after navigation
async function goToDashboard(page: Page): Promise<void> {
  await page.goto('/tenant/dashboard');
  await page.waitForLoadState('networkidle');
  await page.waitForSelector('[data-testid="agent-panel"]', { timeout: 15000 });
}
```

## Prevention Strategies

### 1. Rate Limiter Checklist

When adding new rate limiters:

- [ ] Add `isTestEnvironment` check at file top (only define once!)
- [ ] Use `isTestEnvironment ? highLimit : productionLimit` pattern
- [ ] Set E2E limits 10-50x higher than production
- [ ] Ensure `E2E_TEST=1` is set in Playwright config

### 2. Zustand Store E2E Access Pattern

When creating stores that E2E tests need to access:

- [ ] Export store AND actions separately
- [ ] Add window exposure block at file end
- [ ] Type the window augmentation properly
- [ ] Document test access pattern in store comments

### 3. Query Param Effect Pattern

When handling URL query params that trigger actions:

- [ ] Create selector for "ready" state (e.g., `selectIsInitialized`)
- [ ] Gate effect on both param AND ready state
- [ ] Clean up URL after handling to prevent re-triggers
- [ ] Test with fresh navigation (not just page refresh)

### 4. Next.js E2E Test Patterns

| Pattern               | Implementation                                            |
| --------------------- | --------------------------------------------------------- |
| Wait for hydration    | `waitForLoadState('networkidle')` + `waitForTimeout(500)` |
| Session isolation     | `browser.newContext()` per test or test file              |
| Form submission       | Wait for hydration, then fill and submit                  |
| Store access          | Expose on window, use `page.evaluate()`                   |
| Data-testid selectors | Prefer over text selectors for SSR stability              |

### 5. Test Environment Detection

```bash
# In playwright.config.ts
process.env.E2E_TEST = '1';

# Or in test setup
export default defineConfig({
  use: {
    extraHTTPHeaders: {
      'X-E2E-Test': '1',
    },
  },
});
```

## Verification

Run the E2E tests to verify fixes:

```bash
# Run specific test files
npm run test:e2e -- e2e/tests/tenant-signup.spec.ts
npm run test:e2e -- e2e/tests/agent-ui-control.spec.ts

# Run all tests (should pass without 429 errors)
npm run test:e2e

# Run with headed browser for debugging
npm run test:e2e:headed -- e2e/tests/agent-ui-control.spec.ts
```

Expected result: 19 tests pass, 2 skipped (publish/discard buttons depend on draft state)

## Related Documentation

- [Phase 5 Testing and Caching Prevention](../patterns/phase-5-testing-and-caching-prevention-MAIS-20251231.md)
- [Vitest skipIf Collection Phase Timing](./vitest-skipif-collection-phase-timing-MAIS-20260102.md)
- [Next.js Server/Client Boundary](../best-practices/nextjs-migration-audit-server-client-boundary-MAIS-20260108.md)
