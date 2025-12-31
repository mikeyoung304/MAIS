---
status: resolved
resolution_date: 2025-12-06
priority: p2
issue_id: '302'
tags: [code-review, testing, e2e, playwright, mocking, early-access]
dependencies: ['301']
---

# E2E Route Mocking Not Intercepting API Calls

## Problem Statement

The E2E tests use `page.route('**/v1/auth/early-access', ...)` to mock API responses, but the interception may not be working correctly. Tests expecting mocked error responses may receive actual API responses instead.

**Why it matters:** Tests designed to verify error handling may pass/fail inconsistently, providing false confidence or false failures.

## Findings

**E2E Test File:** `e2e/tests/early-access-waitlist.spec.ts`

```typescript
test('should display server error message on 500', async ({ page }) => {
  // Route interception setup
  await page.route('**/v1/auth/early-access', async (route) => {
    await route.fulfill({
      status: 500,
      contentType: 'application/json',
      body: JSON.stringify({ error: 'Internal server error' }),
    });
  });

  // ... test continues
});
```

**Potential issues:**

1. **Timing:** Route must be registered BEFORE navigation
2. **URL pattern:** `**/v1/auth/early-access` may not match actual request URL
3. **Request method:** May need to filter by POST method
4. **API client:** ts-rest may use different request format

**Debugging needed:**

```typescript
// Add logging to verify interception
await page.route('**/v1/auth/early-access', async (route) => {
  console.log('Intercepted:', route.request().url());
  // ...
});
```

## Proposed Solutions

### Option A: Verify and Fix Route Pattern (Recommended)

**Pros:** Minimal changes, addresses root cause
**Cons:** May require debugging
**Effort:** Small (30 min)
**Risk:** Low

```typescript
test('should display server error message on 500', async ({ page }) => {
  // Register route BEFORE navigation
  await page.route('**/v1/auth/early-access', async (route) => {
    const request = route.request();
    if (request.method() === 'POST') {
      await route.fulfill({
        status: 500,
        contentType: 'application/json',
        body: JSON.stringify({ error: 'Internal server error' }),
      });
    } else {
      await route.continue();
    }
  });

  await page.goto('/');
  // ... rest of test
});
```

### Option B: Use Full URL Pattern

**Pros:** More explicit matching
**Cons:** Hardcodes localhost URL
**Effort:** Small (15 min)
**Risk:** Low

```typescript
await page.route('http://localhost:3001/v1/auth/early-access', async (route) => {
  // ...
});
```

### Option C: Use Network Interception with Verification

**Pros:** Confirms interception working
**Cons:** More verbose tests
**Effort:** Medium (45 min)
**Risk:** Low

```typescript
let intercepted = false;
await page.route('**/v1/auth/early-access', async (route) => {
  intercepted = true;
  await route.fulfill({ status: 500, ... });
});

// After test action
expect(intercepted).toBe(true);
```

## Recommended Action

1. First, debug to confirm the issue exists (add logging)
2. Implement Option A with proper method filtering
3. Add verification that route was intercepted

## Technical Details

**Affected files:**

- `e2e/tests/early-access-waitlist.spec.ts` (fix route interception)

**Tests potentially affected:**

- `should display server error message on 500`
- `should display rate limit message on 429`
- `should display bad request error on 400`
- `should handle network errors gracefully`

## Acceptance Criteria

- [ ] Route interception confirmed working (with logging)
- [ ] Error handling tests verify mocked responses
- [ ] All 12 E2E tests pass consistently
- [ ] Tests fail correctly when API not mocked
- [ ] CI passes 5 consecutive runs

## Work Log

| Date       | Action                   | Learnings                                         |
| ---------- | ------------------------ | ------------------------------------------------- |
| 2025-12-06 | Created from code review | Testing-expert identified potential mock failures |

## Resources

- Playwright Network Mocking: https://playwright.dev/docs/network#handle-requests
- Related: TODO-301 (flaky selectors)

## Resolution

**Status:** Resolved on 2025-12-06

**Implementation Summary:**
Fixed route mocking in E2E tests by implementing proper method filtering and interception verification. Route interception now reliably intercepts API calls with correct status and response handling.

**Files Modified:**

- `e2e/tests/early-access-waitlist.spec.ts` - Fixed route mocking with method filtering and verification

**Changes Made:**

1. **Added method filtering** - Only intercept POST requests:

```typescript
await page.route('**/v1/auth/early-access', async (route) => {
  const request = route.request();
  if (request.method() === 'POST') {
    await route.fulfill({
      status: 500,
      contentType: 'application/json',
      body: JSON.stringify({ error: 'Internal server error' }),
    });
  } else {
    await route.continue();
  }
});
```

2. **Added interception verification** - Confirm routes are being intercepted:

```typescript
let routeIntercepted = false;
await page.route('**/v1/auth/early-access', async (route) => {
  routeIntercepted = true;
  // Handle mocked response
});
// Later: expect(routeIntercepted).toBe(true);
```

3. **Updated form selectors** - Use specific `data-testid` attributes (from TODO-301):

```typescript
const ctaForm = page.getByTestId('cta-waitlist-form');
// Improved targeting prevents selector timing issues
```

4. **Proper route registration timing** - Routes registered before navigation to ensure early interception:

```typescript
// Register route BEFORE navigation
await page.route('**/v1/auth/early-access', ...);
await page.goto('/');
```

**Error Scenarios Now Verified:**

- 500 Internal Server Error - Mocked response confirmed
- 429 Rate Limit - Proper error message display
- 400 Bad Request - Form validation error handling
- Network errors - Graceful error recovery

**Test Coverage:**
All error handling tests now pass with confirmed route interception. Error paths properly verify mocked responses instead of relying on live API.
