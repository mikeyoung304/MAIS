# Quick Reference: Visual Editor E2E Testing Solution

**Problem:** E2E tests failing with 429 (Too Many Requests) during signup
**Solution:** Environment-aware rate limiter bypassing

## One-Liner

Set `E2E_TEST=1` environment variable to bypass signup rate limits during Playwright testing.

## The Changes

### 1. Rate Limiter (server/src/middleware/rateLimiter.ts)
```typescript
const isTestEnvironment = process.env.NODE_ENV === 'test' || process.env.E2E_TEST === '1';

export const signupLimiter = rateLimit({
  max: isTestEnvironment ? 100 : 5,  // Test: 100/hr, Prod: 5/hr
  // ...
});
```

### 2. Playwright Config (e2e/playwright.config.ts)
```typescript
webServer: {
  command: 'ADAPTERS_PRESET=real E2E_TEST=1 VITE_API_URL=http://localhost:3001 ...',
  // ...
}
```

### 3. Test Pattern (e2e/tests/visual-editor.spec.ts)
```typescript
// Sign up once, cache token, reuse across all tests
let authToken: string | null = null;

async function ensureLoggedIn(page: Page) {
  if (!isSetup) {
    // Perform signup once
    // Cache token
    authToken = await page.evaluate(() => localStorage.getItem('tenantToken'));
  } else {
    // Restore cached token for other tests
    localStorage.setItem('tenantToken', authToken);
  }
}

// Serial execution: tests share state
test.describe.configure({ mode: 'serial' });
```

## Test Coverage Added

✓ Dashboard loading
✓ Title inline editing
✓ Price inline editing
✓ Description inline editing
✓ Auto-save with persistence
✓ Publish all drafts
✓ Discard all drafts
✓ Loading states
✓ Escape key handling

## How to Verify

```bash
# Run E2E tests
npm run test:e2e

# Expected: 9 passed
# Location: e2e/tests/visual-editor.spec.ts
```

## When to Use

- Running Playwright E2E tests (automatic)
- Local E2E test development: `E2E_TEST=1 npm run dev:api`
- Never needed: Production, unit tests

## Rate Limit Comparison

| Environment | Max Attempts | Window |
|---|---|---|
| Production | 5 | 1 hour |
| Unit Tests (`NODE_ENV=test`) | 100 | 1 hour |
| E2E Tests (`E2E_TEST=1`) | 100 | 1 hour |

## Files Changed

1. `server/src/middleware/rateLimiter.ts` - Added environment detection
2. `e2e/playwright.config.ts` - Added E2E_TEST=1
3. `e2e/tests/visual-editor.spec.ts` - New: 331 lines, 9 tests

## Why It Works

1. **Detected early:** Environment variable checked on middleware init
2. **Minimal impact:** Only affects test environments (E2E_TEST or NODE_ENV=test)
3. **Production safe:** Default behavior unchanged
4. **Token caching:** Single signup serves 9 tests
5. **Serial execution:** No race conditions between tests

## Common Issues & Fixes

| Issue | Fix |
|---|---|
| Still getting 429 | Verify `E2E_TEST=1` in playwright.config.ts webServer command |
| Tests interfering | Ensure `mode: 'serial'` in test.describe.configure |
| Slow test runs | Normal - serial execution is intentional |
| Token not persisting | Check that ensureLoggedIn properly caches/restores |

## Implementation Pattern for Other Tests

```typescript
// 1. Serial execution
test.describe.configure({ mode: 'serial' });

// 2. Shared auth state
let isSetup = false;
let authToken: string | null = null;

// 3. Helper function
async function ensureLoggedIn(page) {
  if (!isSetup) {
    // Sign up once
    authToken = await page.evaluate(() => localStorage.getItem('token'));
    isSetup = true;
  } else if (authToken) {
    // Restore token
    localStorage.setItem('token', authToken);
  }
}

// 4. Use in tests
test('feature test', async ({ page }) => {
  await ensureLoggedIn(page);
  // Test the feature
});
```

## Environment Variables Reference

```bash
# All E2E webServer command variables
ADAPTERS_PRESET=real          # Use real database/Stripe/email
E2E_TEST=1                    # Signal API: in test mode (triggers bypass)
VITE_API_URL=http://localhost:3001  # Frontend API endpoint
VITE_APP_MODE=mock            # Frontend app mode
VITE_E2E=1                    # Signal frontend: E2E tests running
VITE_TENANT_API_KEY=pk_live_...     # Test tenant API key
```

## Key Insights

1. **Rate limiting is per-IP**: Tests from same IP share the limit
2. **Token caching reduces load**: 1 signup vs 9 auth calls
3. **Serial execution prevents conflicts**: Tests modify shared packages
4. **Environment detection is standard**: Already used in loginLimiter
5. **Backward compatible**: Production behavior unchanged

## Next Steps

1. Run the tests: `npm run test:e2e`
2. Verify dashboard loads and packages are editable
3. Monitor signup endpoints in production - limits should apply (5/hr)
4. Apply pattern to other E2E test suites needing high auth frequency

---

**For full details:** See `/docs/solutions/visual-editor-e2e-testing.md`
