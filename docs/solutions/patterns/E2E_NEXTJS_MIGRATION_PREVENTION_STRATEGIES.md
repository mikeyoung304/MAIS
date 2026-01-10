# Prevention Strategies: E2E Test Failures After Framework Migrations

**Status:** ACTIVE
**Category:** E2E Testing, Framework Migration, Next.js
**Priority:** P1
**Created:** 2026-01-09
**Source:** Agent-First Phase 5 E2E migration learnings

---

## Executive Summary

Framework migrations (React to Next.js, SPA to SSR) introduce systematic E2E test failures due to fundamental behavioral differences. This document captures 5 key prevention patterns discovered during MAIS Next.js migration affecting 18 E2E test files.

---

## Prevention Checklist

### Before Migration

- [ ] Audit ALL rate limiters for test environment overrides
- [ ] Document all client-side stores that tests depend on
- [ ] Identify all forms that will need hydration waits
- [ ] Map React effect dependencies that change with SSR
- [ ] List all session/auth mechanisms and their cookie behaviors

### During Migration

- [ ] Add `E2E_TEST=1` check to every rate limiter (not just some)
- [ ] Expose Zustand stores on `window` for Playwright access
- [ ] Add hydration wait helper for all form interactions
- [ ] Update effect dependencies for child-before-parent order
- [ ] Use fresh browser contexts instead of cookie clearing

### After Migration

- [ ] Run full E2E suite in both serial and parallel modes
- [ ] Verify rate limiter production values still enforced
- [ ] Test with workers=1 AND workers=4 to catch race conditions
- [ ] Check all form submissions with rapid clicking

---

## Key Learning 1: Rate Limiter Pattern

**Problem:** Tests hitting HTTP 429 because only SOME rate limiters have test bypasses.

**Root Cause:** When adding new rate limiters, developers copy existing code but forget the test environment check. The `loginLimiter` had the check, but `signupLimiter` did not.

### Prevention Pattern

```typescript
// At TOP of rateLimiter.ts - SINGLE SOURCE OF TRUTH
const isTestEnvironment = process.env.NODE_ENV === 'test' || process.env.E2E_TEST === '1';

// EVERY rate limiter uses this
export const signupLimiter = rateLimit({
  max: isTestEnvironment ? 100 : 5,
  // ...
});

export const loginLimiter = rateLimit({
  max: isTestEnvironment ? 100 : 5,
  // ...
});

// NEW limiters MUST use isTestEnvironment
export const newFeatureLimiter = rateLimit({
  max: isTestEnvironment ? 500 : 20,
  // ...
});
```

### Code Review Checklist

When reviewing rate limiter changes:

- [ ] Uses `isTestEnvironment` constant (not inline check)
- [ ] Test value is >= 10x production value
- [ ] Both `NODE_ENV=test` AND `E2E_TEST=1` are checked
- [ ] Playwright config includes `E2E_TEST=1` in webServer command

### Quick Reference

| Limiter Type    | Production | Test | Check Used        |
| --------------- | ---------- | ---- | ----------------- |
| Login           | 5/15min    | 100  | isTestEnvironment |
| Signup          | 5/hour     | 100  | isTestEnvironment |
| Admin API       | 120/15min  | 2000 | isTestEnvironment |
| Public API      | 300/15min  | 5000 | isTestEnvironment |
| Upload (IP)     | 200/hour   | 500  | isTestEnvironment |
| Upload (Tenant) | 50/hour    | 500  | isTestEnvironment |
| Draft Autosave  | 120/min    | 500  | isTestEnvironment |
| Tenant Lookup   | 100/15min  | 500  | isTestEnvironment |
| Agent Chat      | 30/5min    | 500  | isTestEnvironment |
| Customer Chat   | 20/min     | 500  | isTestEnvironment |
| Webhook         | 100/min    | 500  | isTestEnvironment |

**All rate limiters now use `isTestEnvironment` (fixed 2026-01-10 in TODO #693).**

---

## Key Learning 2: Zustand Store Exposure for E2E

**Problem:** E2E tests cannot access Zustand stores to trigger actions or verify state because stores are module-scoped.

**Root Cause:** Next.js SSR boundary means `window` access must be explicit. Unlike pure React SPAs, the module closure doesn't naturally expose stores.

### Prevention Pattern

```typescript
// stores/agent-ui-store.ts

// At BOTTOM of file, after store definition
if (typeof window !== 'undefined') {
  (window as unknown as { useAgentUIStore: typeof useAgentUIStore }).useAgentUIStore =
    useAgentUIStore;
  (window as unknown as { agentUIActions: typeof agentUIActions }).agentUIActions = agentUIActions;
}
```

```typescript
// E2E test helper - type-safe window access
async function callAgentUIAction(
  page: Page,
  action: 'showPreview' | 'showDashboard' | 'highlightSection',
  ...args: unknown[]
): Promise<void> {
  await page.evaluate(
    ({ action, args }) => {
      const store = (
        window as unknown as {
          useAgentUIStore?: { getState: () => Record<string, (...args: unknown[]) => void> };
        }
      ).useAgentUIStore;

      if (store) {
        const state = store.getState();
        if (typeof state[action] === 'function') {
          state[action](...args);
        }
      }
    },
    { action, args }
  );
}
```

### Code Review Checklist

When adding/reviewing Zustand stores:

- [ ] Store exposed on `window` at bottom of file
- [ ] Uses `typeof window !== 'undefined'` guard for SSR
- [ ] E2E test helpers have type-safe wrapper functions
- [ ] Store selector tests work with exposed store

---

## Key Learning 3: React Effect Order (Child Before Parent)

**Problem:** E2E tests fail because parent component state isn't ready when child effects run, causing undefined errors or stale data.

**Root Cause:** React's `useEffect` runs bottom-up (children before parents). In SSR hydration, this ordering is even more pronounced. Parent state initialization may not complete before child tries to use it.

### Prevention Pattern

```typescript
// WRONG - Child effect depends on parent state
function ParentComponent() {
  const [data, setData] = useState(null);

  useEffect(() => {
    fetchData().then(setData);  // Parent effect runs AFTER child
  }, []);

  return <ChildComponent data={data} />;
}

function ChildComponent({ data }) {
  useEffect(() => {
    // This runs BEFORE parent's useEffect!
    processData(data);  // data is null!
  }, [data]);
}

// CORRECT - Guard against undefined in child
function ChildComponent({ data }) {
  useEffect(() => {
    if (!data) return;  // Guard for parent not ready
    processData(data);
  }, [data]);
}

// BETTER - Lift effect to parent
function ParentComponent() {
  const [data, setData] = useState(null);
  const [processed, setProcessed] = useState(null);

  useEffect(() => {
    fetchData().then(d => {
      setData(d);
      setProcessed(processData(d));  // Process in same effect
    });
  }, []);

  return <ChildComponent processed={processed} />;
}
```

### Code Review Checklist

For effect dependencies:

- [ ] Child effects guard against undefined/null parent data
- [ ] Consider lifting data processing to parent effects
- [ ] Add `data-testid` to loading states for E2E waits
- [ ] Use Suspense boundaries for async data

---

## Key Learning 4: Next.js Hydration Waits for Forms

**Problem:** Form values get cleared after typing because React hydration replaces DOM.

**Root Cause:** Next.js SSR sends HTML, then React "hydrates" it by attaching event handlers. During hydration, React may re-render components, clearing input values that were filled before hydration completed.

### Prevention Pattern

```typescript
// e2e/fixtures/auth.fixture.ts

async function waitForFormHydration(page: Page): Promise<void> {
  // Wait for page navigation to complete
  await page.goto('/signup', { waitUntil: 'networkidle' });

  // Wait for form element to be in DOM
  await page.waitForSelector('#businessName', { timeout: 10000 });

  // Wait for document to be fully parsed
  await page.waitForLoadState('domcontentloaded');

  // Brief pause for React hydration to complete
  // This allows React to attach event handlers
  await page.waitForTimeout(500);
}

// After filling form, verify values weren't cleared
await page.fill('#businessName', testTenant.businessName);
await page.fill('#email', testTenant.email);

// CRITICAL: Verify values retained after possible re-render
await page.waitForFunction(
  (expected) => {
    const input = document.querySelector<HTMLInputElement>('#businessName');
    return input?.value === expected;
  },
  testTenant.businessName,
  { timeout: 5000 }
);
```

### Code Review Checklist

For form tests:

- [ ] Uses `waitUntil: 'networkidle'` on navigation
- [ ] Waits for specific form element before interaction
- [ ] Includes hydration delay (`waitForTimeout(500)`)
- [ ] Verifies form values after filling (catch hydration clear)
- [ ] Uses `waitForFunction` for complex value assertions

### Hydration Wait Helper

```typescript
// e2e/helpers/hydration.ts

/**
 * Standard hydration wait for Next.js pages
 * Use before any form interaction
 */
export async function waitForNextJSHydration(page: Page, selector: string): Promise<void> {
  await page.waitForSelector(selector, { timeout: 10000 });
  await page.waitForLoadState('domcontentloaded');
  await page.waitForTimeout(500);
}

/**
 * Fill form with hydration-safe retry
 */
export async function fillFormField(page: Page, selector: string, value: string): Promise<void> {
  await page.fill(selector, value);

  // Verify value was retained (hydration may clear it)
  await expect(page.locator(selector)).toHaveValue(value, { timeout: 5000 });
}
```

---

## Key Learning 5: Session Isolation with NextAuth

**Problem:** Tests fail intermittently because session state leaks between tests via cookies.

**Root Cause:** NextAuth v5 uses `__Secure-` prefixed httpOnly cookies. Simple `page.context().clearCookies()` doesn't reliably clear these, and the cookies persist across test runs.

### Prevention Pattern

```typescript
// WRONG - Cookie clearing is unreliable for NextAuth
test('first test', async ({ page }) => {
  await signupUser(page, user1);
  // ...
});

test('second test', async ({ page }) => {
  await page.context().clearCookies(); // May not work!
  await signupUser(page, user2); // Might still see user1 session
});

// CORRECT - Use fresh browser context
test('prevents duplicate email registration', async ({ page, browser }) => {
  // First signup in original context
  await signupUser(page, user1);

  // Second attempt in FRESH context (clean cookies)
  const newContext = await browser.newContext();
  const newPage = await newContext.newPage();

  try {
    await signupUser(newPage, user2);
  } finally {
    await newContext.close(); // Always cleanup
  }
});
```

### Code Review Checklist

For auth-related tests:

- [ ] Uses `browser.newContext()` for session isolation (not cookie clearing)
- [ ] Closes context in finally block to prevent resource leaks
- [ ] Each test that needs clean auth state uses fresh context
- [ ] No reliance on localStorage for auth (NextAuth uses httpOnly cookies)

### Auth Fixture Pattern

```typescript
// e2e/fixtures/auth.fixture.ts

export const test = base.extend<{
  authenticatedPage: Page;
  testTenant: TestTenant;
}>({
  testTenant: async ({}, use, testInfo) => {
    // Generate unique credentials per test
    const timestamp = Date.now();
    const testHash = testInfo.title.substring(0, 10);

    const tenant: TestTenant = {
      email: `e2e-${testHash}-${timestamp}@example.com`,
      password: 'SecurePass123!',
      businessName: `E2E Test ${timestamp}`,
    };

    await use(tenant);
  },

  authenticatedPage: async ({ page, testTenant }, use) => {
    await waitForFormHydration(page);
    await performSignup(page, testTenant);
    await use(page);
    // Context cleanup is automatic with Playwright fixtures
  },
});
```

---

## Decision Tree: E2E Test Failure Diagnosis

```
Test failing after migration?
│
├─ HTTP 429 (Too Many Requests)?
│  └─ Check rate limiter uses `isTestEnvironment`
│     └─ If not: Add to rate limiter definition
│     └─ If yes: Check Playwright config has `E2E_TEST=1`
│
├─ Store/action not found in window?
│  └─ Check store has window exposure at bottom of file
│     └─ Add: if (typeof window !== 'undefined') { window.store = store }
│
├─ Undefined/null errors in effects?
│  └─ Child effect running before parent data ready
│     └─ Add guards: if (!data) return;
│     └─ Or lift processing to parent effect
│
├─ Form values disappear after typing?
│  └─ Hydration clearing values
│     └─ Add: waitForLoadState('domcontentloaded')
│     └─ Add: waitForTimeout(500) after selector wait
│     └─ Add: waitForFunction to verify value retained
│
└─ Session state leaking between tests?
   └─ NextAuth cookies not cleared
      └─ Use browser.newContext() instead of clearCookies()
      └─ Close context in finally block
```

---

## Test Patterns for Next.js E2E

### Pattern 1: Standard Page Test

```typescript
test('page loads and displays content', async ({ page }) => {
  // Navigate with full load
  await page.goto('/tenant/dashboard', { waitUntil: 'networkidle' });

  // Wait for hydration indicator (data-testid on key element)
  await page.waitForSelector('[data-testid="dashboard-loaded"]', {
    timeout: 15000,
  });

  // Assert on visible content
  await expect(page.getByRole('heading', { name: /Dashboard/i })).toBeVisible();
});
```

### Pattern 2: Form Submission Test

```typescript
test('submits form successfully', async ({ page }) => {
  // Navigate and wait for hydration
  await page.goto('/signup', { waitUntil: 'networkidle' });
  await page.waitForSelector('#businessName', { timeout: 10000 });
  await page.waitForLoadState('domcontentloaded');
  await page.waitForTimeout(500); // Hydration delay

  // Fill form
  await page.fill('#businessName', 'Test Business');
  await page.fill('#email', 'test@example.com');
  await page.fill('#password', 'SecurePass123!');

  // Verify values retained (catches hydration clear)
  await expect(page.locator('#businessName')).toHaveValue('Test Business');

  // Submit and wait for response
  const responsePromise = page.waitForResponse((r) => r.url().includes('/v1/auth/signup'), {
    timeout: 30000,
  });
  await page.click('button[type="submit"]');

  const response = await responsePromise;
  expect(response.status()).toBe(201);

  // Wait for navigation
  await page.waitForURL('**/tenant/dashboard', { timeout: 15000 });
});
```

### Pattern 3: Store Action Test

```typescript
test('agent action updates UI', async ({ authenticatedPage }) => {
  // Wait for store to be available
  await authenticatedPage.waitForSelector('[data-testid="agent-panel"]', {
    timeout: 15000,
  });

  // Trigger store action via window
  await authenticatedPage.evaluate(() => {
    const store = (window as any).useAgentUIStore;
    if (store) {
      store.getState().showPreview('home');
    }
  });

  // Assert on UI change (use expect with timeout for state update)
  await expect(authenticatedPage.locator('[data-testid="preview-panel"]')).toBeVisible({
    timeout: 5000,
  });
});
```

### Pattern 4: Session Isolation Test

```typescript
test('handles duplicate registration', async ({ page, browser }) => {
  const email = `dup-test-${Date.now()}@example.com`;

  // First registration
  await performSignup(page, { email });
  await expect(page).toHaveURL('/tenant/dashboard');

  // Second attempt in fresh context
  const freshContext = await browser.newContext();
  const freshPage = await freshContext.newPage();

  try {
    await performSignup(freshPage, { email }); // Same email

    // Should get 409 conflict
    await expect(freshPage.getByText(/already exists|already registered/i)).toBeVisible({
      timeout: 5000,
    });
  } finally {
    await freshContext.close();
  }
});
```

---

## Related Documentation

- [Visual Editor E2E Testing](../visual-editor-e2e-testing.md) - Rate limiter bypass details
- [Phase 5 Testing Prevention](./phase-5-testing-and-caching-prevention-MAIS-20251231.md) - Caching patterns
- [NextAuth v5 Cookie Prefix](../authentication-issues/nextauth-v5-secure-cookie-prefix-production-401-MAIS-20251231.md) - Session handling
- [Turbopack HMR Cache](../dev-workflow/TURBOPACK_HMR_MODULE_CACHE_STALENESS_PREVENTION.md) - Dev environment issues

---

## Quick Reference Card

```
E2E NEXT.JS MIGRATION CHECKLIST
================================

RATE LIMITERS:
  const isTestEnvironment = process.env.NODE_ENV === 'test'
                         || process.env.E2E_TEST === '1';
  max: isTestEnvironment ? 100 : 5

STORE EXPOSURE:
  if (typeof window !== 'undefined') {
    window.useMyStore = useMyStore;
  }

HYDRATION WAIT:
  await page.goto('/path', { waitUntil: 'networkidle' });
  await page.waitForSelector('#form');
  await page.waitForLoadState('domcontentloaded');
  await page.waitForTimeout(500);

FORM VALUE VERIFY:
  await page.fill('#input', value);
  await expect(page.locator('#input')).toHaveValue(value);

SESSION ISOLATION:
  const ctx = await browser.newContext();
  const newPage = await ctx.newPage();
  try { ... } finally { await ctx.close(); }

EFFECT GUARDS:
  useEffect(() => {
    if (!data) return;  // Parent not ready yet
    processData(data);
  }, [data]);
```

---

**Last Updated:** 2026-01-09
**Maintainer:** Compound Engineering Workflow
**Status:** Production Ready
