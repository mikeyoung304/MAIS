# Plan: Fix E2E Test Migration for Next.js

**Status:** Ready for Implementation
**Priority:** P1 (Blocks Phase 5 testing)
**Branch:** `test/agent-first-phase-5`
**Estimated Effort:** Medium (1-2 days)

## Overview

The E2E test suite was designed for the Vite SPA client and has not been fully migrated to work with the Next.js 14 App Router application. Tests timeout waiting for signup API responses because:

1. **UI Mismatches:** Tests expect old Vite UI (confirmPassword field, old copy, old redirect targets)
2. **Auth Token Architecture Change:** NextAuth.js v5 uses httpOnly cookies, not localStorage
3. **Redirect Target Change:** Next.js redirects to `/tenant/build`, not `/tenant/dashboard`

## Problem Analysis

### Root Cause Investigation

| Component            | Vite SPA (Old)                                 | Next.js (Current)              | Impact                           |
| -------------------- | ---------------------------------------------- | ------------------------------ | -------------------------------- |
| Signup form fields   | businessName, email, password, confirmPassword | businessName, email, password  | Tests fail filling missing field |
| Signup page heading  | "Sign Up"                                      | "Let's build your storefront." | Selector mismatch                |
| Post-signup redirect | `/tenant/dashboard`                            | `/tenant/build`                | `waitForURL` timeout             |
| Token storage        | `localStorage.tenantToken`                     | NextAuth httpOnly cookie       | Token retrieval returns null     |
| Session management   | Manual JWT                                     | NextAuth.js v5 credentials     | Different auth flow              |

### Affected Files

**Primary (High Priority):**
| File | Issue | Lines |
|------|-------|-------|
| `e2e/fixtures/auth.fixture.ts` | Wrong redirect target, localStorage token | 85, 88 |
| `e2e/tests/tenant-signup.spec.ts` | confirmPassword field, old copy, old redirect | 44, 50, 64, 230 |
| `e2e/tests/agent-ui-control.spec.ts` | Uses broken auth fixture | 23 |

**Secondary (Medium Priority):**
| File | Issue |
|------|-------|
| `e2e/tests/visual-editor.spec.ts` | Uses auth fixture |
| `e2e/tests/landing-page-editor.spec.ts` | Uses auth fixture |
| `e2e/tests/booking-management.spec.ts` | May use auth fixture |

### Why waitForResponse Times Out

The `page.waitForResponse('/v1/auth/signup')` at `auth.fixture.ts:69` times out because:

1. **Form submission fails silently** - The test tries to fill `#confirmPassword` which doesn't exist
2. **Click targets wrong button** - Looking for "Create Account" but actual text is tier-specific (e.g., "Get Handled")
3. **No error thrown** - Playwright waits for a response that will never come

The API server works correctly (confirmed via curl), but the browser never sends the request.

## Proposed Solution

### Phase 1: Fix Auth Fixture (Immediate - Unblocks Testing)

Update `e2e/fixtures/auth.fixture.ts` to work with Next.js:

```typescript
// e2e/fixtures/auth.fixture.ts

/**
 * Authenticated page - signs up and logs in before each test
 * Updated for Next.js App Router + NextAuth.js v5
 */
authenticatedPage: async ({ page, testTenant }, use) => {
  // Navigate to signup
  await page.goto('/signup');

  // Wait for Next.js signup form (updated selector)
  await page.waitForSelector('#businessName', { timeout: 10000 });

  // Fill signup form (NO confirmPassword - removed in Next.js)
  await page.fill('#businessName', testTenant.businessName);
  await page.fill('#email', testTenant.email);
  await page.fill('#password', testTenant.password);

  // Submit - use form submit button (text varies by tier)
  const responsePromise = page.waitForResponse(
    (response) => response.url().includes('/v1/auth/signup'),
    { timeout: 30000 }
  );
  await page.click('button[type="submit"]');

  const response = await responsePromise;
  if (response.status() === 429) {
    throw new Error('Rate limited - run tests with lower parallelism or wait');
  }
  if (response.status() !== 201) {
    const body = await response.text();
    throw new Error(`Signup failed with status ${response.status()}: ${body}`);
  }

  // Wait for redirect to BUILD MODE (not dashboard!)
  await page.waitForURL('/tenant/build', { timeout: 15000 });

  // NextAuth.js v5 uses httpOnly cookies - token not accessible via JS
  // We verify auth by checking we're on a protected page
  testTenant.token = 'nextauth-session'; // Placeholder - actual token in cookie

  await use(page);
},
```

**Key Changes:**

1. **Line 85:** `/tenant/dashboard` → `/tenant/build`
2. **Line 73:** Use `button[type="submit"]` instead of text matcher
3. **Line 88:** Remove localStorage retrieval (NextAuth uses httpOnly cookies)
4. **Remove confirmPassword field fill**

### Phase 2: Fix tenant-signup.spec.ts

Update the signup tests to match Next.js UI:

```typescript
// Changes needed in e2e/tests/tenant-signup.spec.ts

// Test 1 (line 34-35): Update expected heading
await expect(page.getByRole('heading', { name: /build your storefront/i })).toBeVisible();
// Remove: await expect(page.getByText(/Create your business account/i)).toBeVisible();

// Test 1 (line 44, and all tests): Remove confirmPassword
// REMOVE: await page.fill('#confirmPassword', testPassword);
// REMOVE: await expect(page.locator('#confirmPassword')).toHaveValue(testPassword);

// Test 1 (line 53): Update button selector
const submitButton = page.getByRole('button', { type: 'submit' });
// Or: page.locator('button[type="submit"]')

// Test 1 (line 64): Update redirect target
await expect(page).toHaveURL('/tenant/build', { timeout: 10000 });

// Test 5 (lines 170-198): REMOVE ENTIRE TEST
// Password confirmation was removed in Next.js migration

// Test 12 (line 407): Remove confirmPassword error check
// REMOVE: await expect(page.getByText(/confirm your password/i)).toBeVisible();
```

### Phase 3: Add Pre-Seeded Test Tenant (Alternative Approach)

For faster, more reliable tests, add a pre-seeded test tenant:

```typescript
// e2e/fixtures/seeded-auth.fixture.ts

import { test as base, Page } from '@playwright/test';

const SEEDED_TENANT = {
  email: 'e2e-seeded-tenant@example.com',
  password: 'E2ETestPassword123!',
  slug: 'e2e-seeded-tenant',
  businessName: 'E2E Seeded Tenant',
};

export const test = base.extend<{
  seededAuthPage: Page;
}>({
  seededAuthPage: async ({ page }, use) => {
    // Login instead of signup (tenant already exists)
    await page.goto('/login');
    await page.fill('#email', SEEDED_TENANT.email);
    await page.fill('#password', SEEDED_TENANT.password);

    const responsePromise = page.waitForResponse(
      (response) => response.url().includes('/v1/auth/login'),
      { timeout: 10000 }
    );
    await page.click('button[type="submit"]');

    const response = await responsePromise;
    if (response.status() !== 200) {
      throw new Error('Login failed - ensure seeded tenant exists');
    }

    await page.waitForURL('/tenant/**', { timeout: 10000 });
    await use(page);
  },
});
```

**Database seed script addition:**

```typescript
// server/prisma/seed.ts - Add to existing seed

// E2E Test Tenant (never deleted)
const e2eTenant = await prisma.tenant.upsert({
  where: { email: 'e2e-seeded-tenant@example.com' },
  update: {},
  create: {
    email: 'e2e-seeded-tenant@example.com',
    passwordHash: await hashPassword('E2ETestPassword123!'),
    businessName: 'E2E Seeded Tenant',
    slug: 'e2e-seeded-tenant',
    onboardingPhase: 'COMPLETED',
    // ... other required fields
  },
});
```

### Phase 4: Update agent-ui-control.spec.ts

```typescript
// e2e/tests/agent-ui-control.spec.ts

// Option A: Switch to seeded fixture for speed
import { test, expect } from '../fixtures/seeded-auth.fixture';

// Option B: Keep signup fixture but update dashboard helper
async function goToDashboard(page: Page): Promise<void> {
  // After login/signup, we land on /tenant/build
  // Navigate to dashboard explicitly
  await page.goto('/tenant/dashboard');
  await page.waitForLoadState('networkidle');
  await page.waitForSelector('[data-testid="agent-panel"]', { timeout: 15000 });
}
```

## Implementation Plan

### Task Breakdown

| #   | Task                                                       | File                    | Priority | Depends On |
| --- | ---------------------------------------------------------- | ----------------------- | -------- | ---------- |
| 1   | Fix auth fixture redirect + selectors                      | `auth.fixture.ts`       | P0       | -          |
| 2   | Remove confirmPassword from all tests                      | Multiple                | P0       | 1          |
| 3   | Update button selectors to `button[type="submit"]`         | Multiple                | P0       | 1          |
| 4   | Update expected URLs `/tenant/dashboard` → `/tenant/build` | Multiple                | P0       | 1          |
| 5   | Remove/update password confirmation test                   | `tenant-signup.spec.ts` | P1       | 2          |
| 6   | Update heading/copy assertions                             | `tenant-signup.spec.ts` | P1       | 2          |
| 7   | Create seeded-auth fixture (optional)                      | New file                | P2       | 1          |
| 8   | Add E2E seed tenant to database                            | `seed.ts`               | P2       | 7          |
| 9   | Create Next.js E2E Testing Guide                           | `docs/`                 | P2       | 1-6        |
| 10  | Run full E2E suite, fix regressions                        | All                     | P1       | 1-6        |

### Execution Order

```
Phase 1 (Day 1 Morning):
├── Task 1: Fix auth.fixture.ts
├── Task 2: Remove confirmPassword fills
├── Task 3: Update button selectors
└── Task 4: Update redirect URLs

Phase 2 (Day 1 Afternoon):
├── Task 5: Fix password confirmation test
├── Task 6: Update heading assertions
└── Task 10: Run full suite, fix regressions

Phase 3 (Day 2 - Optional):
├── Task 7: Create seeded-auth fixture
├── Task 8: Add seed tenant
└── Task 9: Create testing guide
```

## Acceptance Criteria

- [ ] `npm run test:e2e -- e2e/tests/agent-ui-control.spec.ts` passes (11 tests)
- [ ] `npm run test:e2e -- e2e/tests/tenant-signup.spec.ts` passes (updated tests)
- [ ] Auth fixture successfully signs up new tenants
- [ ] No `waitForResponse` timeouts on signup API
- [ ] Tests work with `--workers=1` and `--workers=4`

## Success Metrics

| Metric                         | Before | After             |
| ------------------------------ | ------ | ----------------- |
| agent-ui-control tests passing | 0/11   | 11/11             |
| tenant-signup tests passing    | 0/12   | 10/10 (2 removed) |
| Auth fixture signup success    | 0%     | 100%              |
| E2E suite pass rate            | ~30%   | >90%              |

## Risk Assessment

| Risk                         | Likelihood | Impact | Mitigation                          |
| ---------------------------- | ---------- | ------ | ----------------------------------- |
| Other tests depend on old UI | Medium     | Medium | Run full suite after fixture fix    |
| Rate limiting in parallel    | Low        | Low    | Already addressed with `E2E_TEST=1` |
| NextAuth session issues      | Low        | High   | Use storageState caching            |
| CI environment differences   | Medium     | Medium | Test in CI early                    |

## Testing Strategy

```bash
# Phase 1 validation (after fixture fix)
npm run test:e2e:headed -- e2e/tests/agent-ui-control.spec.ts -g "shows preview" --debug

# Phase 2 validation (after all fixes)
npm run test:e2e -- e2e/tests/tenant-signup.spec.ts
npm run test:e2e -- e2e/tests/agent-ui-control.spec.ts

# Full suite validation
npm run test:e2e
```

## References

### Internal Documentation

- `docs/solutions/visual-editor-e2e-testing.md` - Rate limiting patterns
- `docs/solutions/code-review-patterns/nextjs-migration-lessons-learned-MAIS-20251225.md` - Migration lessons
- `docs/solutions/patterns/phase-5-testing-and-caching-prevention-MAIS-20251231.md` - Testing pitfalls
- `todos/693-pending-p2-e2e-auth-fixture-nextjs-migration.md` - Original issue

### External Documentation

- [Playwright Auth Best Practices](https://playwright.dev/docs/auth)
- [NextAuth.js v5 Testing](https://authjs.dev/guides/testing)
- [Next.js E2E Testing Guide](https://nextjs.org/docs/app/guides/testing)

### Key File References

| File                                 | Purpose        | Key Lines       |
| ------------------------------------ | -------------- | --------------- |
| `e2e/fixtures/auth.fixture.ts`       | Auth fixture   | 69-72, 85, 88   |
| `apps/web/src/app/signup/page.tsx`   | Signup UI      | 168, 197        |
| `e2e/tests/tenant-signup.spec.ts`    | Signup tests   | 44, 64, 170-198 |
| `e2e/tests/agent-ui-control.spec.ts` | Agent UI tests | 23              |

---

## ERD: No Schema Changes Required

This is a test infrastructure fix - no database schema changes needed.

---

## Appendix: Full Diff Preview

### auth.fixture.ts Changes

```diff
- // Fill signup form (Note: confirmPassword was removed in Next.js migration)
+ // Fill signup form (Next.js removed confirmPassword field)
  await page.fill('#businessName', testTenant.businessName);
  await page.fill('#email', testTenant.email);
  await page.fill('#password', testTenant.password);

- // Submit and wait for response
+ // Submit - use type=submit selector (button text varies by tier)
  const responsePromise = page.waitForResponse(
    (response) => response.url().includes('/v1/auth/signup'),
    { timeout: 30000 }
  );
- await page.click('button[type="submit"]');
+ await page.click('button[type="submit"]');

  const response = await responsePromise;
  // ... error handling unchanged ...

- // Wait for redirect to dashboard
- await page.waitForURL('/tenant/dashboard', { timeout: 15000 });
+ // Wait for redirect to Build Mode (Next.js change)
+ await page.waitForURL('/tenant/build', { timeout: 15000 });

- // Cache token for reference
- testTenant.token = await page.evaluate(() => localStorage.getItem('tenantToken'));
+ // NextAuth.js v5 uses httpOnly cookies - token not in localStorage
+ // Auth is validated by successful navigation to protected route
+ testTenant.token = 'nextauth-httponly-session';
```

### tenant-signup.spec.ts Test Removal

```diff
- /**
-  * Test 5: Validation Errors - Password Mismatch
-  *
-  * Verifies password confirmation validation.
-  */
- test('validates password confirmation matches', async ({ page }) => {
-   // ... entire test removed - confirmPassword field no longer exists
- });
```
