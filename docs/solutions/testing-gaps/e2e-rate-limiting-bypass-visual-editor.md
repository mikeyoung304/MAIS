---
title: "E2E Rate Limiting Bypass for Visual Editor Testing"
category: testing-gaps
severity: P2
component: visual-editor, rate-limiter, e2e-testing
symptoms:
  - "E2E tests failing with HTTP 429 (Too Many Requests)"
  - "Signup rate limit exceeded after 5 test runs"
  - "Visual editor lacking E2E test coverage"
  - "Tests interfering with each other due to shared auth state"
tags:
  - visual-editor
  - e2e-testing
  - rate-limiting
  - playwright
  - test-isolation
  - auth-caching
date_solved: 2025-12-02
commit: 3e9a0b8
---

# E2E Rate Limiting Bypass for Visual Editor Testing

## Problem Summary

E2E tests were failing with HTTP 429 errors because the signup endpoint's rate limiter applied production limits (5 signups/hour) without test environment awareness. Additionally, the visual editor feature lacked comprehensive E2E test coverage.

## Symptoms

- E2E tests pass on first run, fail on subsequent runs
- Error: "Too many signup attempts. Please try again in an hour."
- Visual editor workflows (edit, publish, discard) untested
- Rate limit state persists between test runs

## Root Cause Analysis

The `signupLimiter` in `server/src/middleware/rateLimiter.ts` only checked `NODE_ENV === 'test'` for rate limit bypass. However, E2E tests run with `NODE_ENV=development` while the server uses real adapters, causing production rate limits to apply.

```typescript
// BEFORE: Only unit tests bypassed
max: process.env.NODE_ENV === 'test' ? 100 : 5,
```

## Solution

### 1. Environment-Aware Rate Limiter

**File:** `server/src/middleware/rateLimiter.ts`

```typescript
// Check if we're in a test environment (unit tests OR E2E tests)
const isTestEnvironment = process.env.NODE_ENV === 'test' || process.env.E2E_TEST === '1';

export const signupLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  // Allow more signups in test environment for testing
  max: isTestEnvironment ? 100 : 5,
  standardHeaders: true,
  legacyHeaders: false,
  handler: (_req: Request, res: Response) =>
    res.status(429).json({
      error: 'too_many_signup_attempts',
      message: 'Too many signup attempts. Please try again in an hour.',
    }),
});
```

### 2. Playwright Configuration

**File:** `e2e/playwright.config.ts`

```typescript
webServer: {
  command: 'ADAPTERS_PRESET=real E2E_TEST=1 VITE_API_URL=http://localhost:3001 VITE_APP_MODE=mock VITE_E2E=1 VITE_TENANT_API_KEY=pk_live_mais-e2e_0000000000000000 npm run dev:e2e',
  cwd: '..',
  url: 'http://localhost:5173',
  reuseExistingServer: !process.env.CI,
  timeout: 120 * 1000,
},
```

### 3. E2E Test Pattern with Auth Caching

**File:** `e2e/tests/visual-editor.spec.ts`

```typescript
import { test, expect, type Page } from '@playwright/test';

// Serial execution to share tenant across tests
test.describe.configure({ mode: 'serial' });

// Module-level state for auth caching
let isSetup = false;
let authToken: string | null = null;
let tenantSlug: string | null = null;

async function ensureLoggedIn(page: Page): Promise<void> {
  if (!isSetup) {
    // First test: signup and cache token
    const timestamp = Date.now();
    const randomSuffix = Math.random().toString(36).substring(2, 8);
    const businessName = `Visual Editor E2E ${timestamp}`;
    const email = `ve-e2e-${timestamp}-${randomSuffix}@example.com`;

    await page.goto('/signup');
    await page.getByLabel('Business Name').fill(businessName);
    await page.getByLabel('Email').fill(email);
    await page.getByLabel('Password', { exact: true }).fill('SecurePass123!');
    await page.getByLabel('Confirm Password').fill('SecurePass123!');

    const responsePromise = page.waitForResponse(
      (response) => response.url().includes('/v1/auth/signup')
    );
    await page.getByRole('button', { name: 'Create Account' }).click();

    const response = await responsePromise;
    if (response.status() === 429) {
      throw new Error('Rate limited - increase E2E_TEST limit or wait');
    }

    await page.waitForURL('**/tenant/dashboard', { timeout: 15000 });

    // Cache auth for subsequent tests
    authToken = await page.evaluate(() => localStorage.getItem('tenantToken'));
    tenantSlug = await page.evaluate(() => localStorage.getItem('tenantSlug'));
    isSetup = true;
  } else if (authToken) {
    // Subsequent tests: restore cached auth
    await page.goto('/');
    await page.evaluate(
      ({ token, slug }) => {
        localStorage.setItem('tenantToken', token!);
        if (slug) localStorage.setItem('tenantSlug', slug);
      },
      { token: authToken, slug: tenantSlug }
    );
  }
}
```

## Verification Steps

```bash
# 1. Run E2E tests (should not hit rate limits)
npm run test:e2e -- e2e/tests/visual-editor.spec.ts

# 2. Verify rate limiter config
grep -A5 "isTestEnvironment" server/src/middleware/rateLimiter.ts

# 3. Verify Playwright config has E2E_TEST=1
grep "E2E_TEST" e2e/playwright.config.ts
```

## Test Coverage Added

The visual editor E2E test suite covers:

| Test Case | Description |
|-----------|-------------|
| Dashboard loads | Verifies packages display after login |
| Title editing | Inline edit package title |
| Price editing | Inline edit package price |
| Description editing | Inline edit package description |
| Auto-save | Changes persist after page reload |
| Publish all | Publish workflow with confirmation |
| Discard all | Discard workflow with confirmation |
| Loading states | Verify loading indicators |
| Escape cancels | ESC key cancels inline edit |

## Prevention Strategies

### 1. Rate Limiter Checklist for New Endpoints

- [ ] Add `isTestEnvironment` check for test-heavy endpoints
- [ ] Document rate limits in endpoint comments
- [ ] Add E2E test for rate limit error handling

### 2. E2E Test Patterns

- [ ] Use serial mode for tests sharing auth state
- [ ] Cache auth tokens at module level
- [ ] Generate unique identifiers per test run
- [ ] Handle 429 errors gracefully with clear messages

### 3. Code Review Checklist

- [ ] New rate-limited endpoints support E2E_TEST bypass
- [ ] E2E tests don't rely on specific rate limit values
- [ ] Test cleanup doesn't affect rate limit state

## Related Documentation

- [Login Rate Limiting](/server/LOGIN_RATE_LIMITING.md) - Rate limiting patterns
- [Visual Editor Code Review](/docs/code-review/useVisualEditor-INDEX.md) - Hook analysis
- [Playwright MCP Setup](/.claude/PLAYWRIGHT_MCP_SETUP.md) - E2E configuration
- [Testing Prevention Strategies](/docs/solutions/TESTING-PREVENTION-STRATEGIES.md) - Coverage patterns

## Files Changed

| File | Change |
|------|--------|
| `server/src/middleware/rateLimiter.ts` | Added `E2E_TEST=1` environment check |
| `e2e/playwright.config.ts` | Added `E2E_TEST=1` to webServer command |
| `e2e/tests/visual-editor.spec.ts` | NEW - 331 lines of E2E tests |
| `plans/fix-usevisualeditor-remaining-bugs.md` | NEW - Implementation plan |

## Lessons Learned

1. **Environment detection matters**: `NODE_ENV` alone isn't sufficient for E2E tests running against real servers
2. **Auth caching reduces flakiness**: Single signup + token reuse is more reliable than per-test auth
3. **Serial execution for shared state**: When tests share auth, serial mode prevents race conditions
4. **Verify before fixing**: 2 of 3 "bugs" were already fixed - always read the actual code first
