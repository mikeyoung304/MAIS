# NextAuth v5 getBackendToken() - Testing Strategy

**A comprehensive guide to testing JWT token retrieval across HTTP, HTTPS, and mock environments.**

---

## Overview

Testing `getBackendToken()` requires three environments:

1. **Local HTTP** (development, `authjs.session-token`)
2. **HTTPS** (staging, `__Secure-authjs.session-token`)
3. **Mocked** (unit tests, both cookie names)

This guide covers all three.

---

## Unit Tests (Mocked Environment)

### Test File Structure

**Location**: `apps/web/src/lib/__tests__/auth.test.ts`

```typescript
import { getBackendToken } from '@/lib/auth';
import { describe, it, expect, beforeEach } from 'vitest';

describe('getBackendToken', () => {
  // Tests go here
});
```

### Test Suite 1: Cookie Name Variants

**Purpose**: Verify all cookie name variants are checked

```typescript
describe('Cookie Name Variants', () => {
  it('should find token with __Secure- prefix (HTTPS)', async () => {
    // Simulate HTTPS production environment
    const request = new Request('https://example.com/api/test', {
      headers: {
        Cookie: '__Secure-authjs.session-token=valid-jwt-token',
      },
    });

    const token = await getBackendToken(request);
    expect(token).toBeTruthy();
    expect(token).toBe('decoded-backend-token');
  });

  it('should find token without prefix (HTTP)', async () => {
    // Simulate HTTP development environment
    const request = new Request('http://localhost:3000/api/test', {
      headers: {
        Cookie: 'authjs.session-token=valid-jwt-token',
      },
    });

    const token = await getBackendToken(request);
    expect(token).toBeTruthy();
    expect(token).toBe('decoded-backend-token');
  });

  it('should find legacy NextAuth v4 HTTPS cookie', async () => {
    // Backward compatibility with NextAuth v4
    const request = new Request('https://example.com/api/test', {
      headers: {
        Cookie: '__Secure-next-auth.session-token=legacy-jwt',
      },
    });

    const token = await getBackendToken(request);
    expect(token).toBeTruthy();
  });

  it('should find legacy NextAuth v4 HTTP cookie', async () => {
    const request = new Request('http://localhost:3000/api/test', {
      headers: {
        Cookie: 'next-auth.session-token=legacy-jwt',
      },
    });

    const token = await getBackendToken(request);
    expect(token).toBeTruthy();
  });
});
```

### Test Suite 2: Missing Cookies

**Purpose**: Verify graceful handling when cookie is absent

```typescript
describe('Missing Cookies', () => {
  it('should return null when no session cookie found', async () => {
    const request = new Request('https://example.com/api/test', {
      headers: {
        Cookie: 'other-cookie=value; another=data',
      },
    });

    const token = await getBackendToken(request);
    expect(token).toBeNull();
  });

  it('should return null when cookie header is empty', async () => {
    const request = new Request('https://example.com/api/test', {
      headers: {},
    });

    const token = await getBackendToken(request);
    expect(token).toBeNull();
  });

  it('should return null without request parameter (Server Component)', async () => {
    // When called without request parameter in Server Component
    // and no session exists in the system
    const token = await getBackendToken();
    expect(token).toBeNull();
  });
});
```

### Test Suite 3: Invalid Tokens

**Purpose**: Verify invalid JWTs are rejected

```typescript
describe('Invalid Tokens', () => {
  it('should return null for malformed JWT', async () => {
    const request = new Request('https://example.com/api/test', {
      headers: {
        Cookie: '__Secure-authjs.session-token=not-a-valid-jwt',
      },
    });

    const token = await getBackendToken(request);
    expect(token).toBeNull(); // JWT verification fails
  });

  it('should return null for expired JWT', async () => {
    // Create JWT with exp time in the past
    const expiredJwt = createExpiredJwt();

    const request = new Request('https://example.com/api/test', {
      headers: {
        Cookie: `__Secure-authjs.session-token=${expiredJwt}`,
      },
    });

    const token = await getBackendToken(request);
    expect(token).toBeNull();
  });

  it('should return null for JWT with wrong signature', async () => {
    // Create JWT signed with different secret
    const wrongSignedJwt = createJwtWithWrongSecret();

    const request = new Request('https://example.com/api/test', {
      headers: {
        Cookie: `__Secure-authjs.session-token=${wrongSignedJwt}`,
      },
    });

    const token = await getBackendToken(request);
    expect(token).toBeNull();
  });
});
```

### Test Suite 4: Cookie Priority Order

**Purpose**: Verify HTTPS cookie is checked before HTTP

```typescript
describe('Cookie Priority Order', () => {
  it('should prefer __Secure- variant when both exist', async () => {
    // This shouldn't happen in real browser, but if it did...
    const request = new Request('https://example.com/api/test', {
      headers: {
        Cookie: '__Secure-authjs.session-token=https-token; authjs.session-token=http-token',
      },
    });

    const token = await getBackendToken(request);
    // Should use __Secure- variant (checked first)
    expect(token).toBe('https-backend-token');
  });
});
```

---

## Integration Tests (Local HTTP)

### Test Setup

**Environment**: Local development server on HTTP

```bash
npm run dev:web  # Starts Next.js on http://localhost:3000
npm run dev:api  # Starts API on http://localhost:3001
```

### Test 1: Login → Token Storage → Retrieval

```typescript
describe('Token Storage and Retrieval (HTTP)', () => {
  beforeEach(async () => {
    // Login with test credentials
    await page.goto('http://localhost:3000/login');
    await page.fill('[name="email"]', 'test@example.com');
    await page.fill('[name="password"]', 'testpassword123');
    await page.click('[type="submit"]');

    // Wait for redirect (login success)
    await page.waitForURL('http://localhost:3000/tenant/dashboard');
  });

  it('should create authjs.session-token cookie', async () => {
    const cookies = await page.context().cookies();
    const sessionCookie = cookies.find((c) => c.name === 'authjs.session-token');

    expect(sessionCookie).toBeDefined();
    expect(sessionCookie?.httpOnly).toBe(true);
    expect(sessionCookie?.secure).toBe(false); // HTTP doesn't use Secure flag
  });

  it('should retrieve token in API route', async () => {
    // Call an API route that uses getBackendToken()
    const response = await page.request.get('http://localhost:3000/api/tenant-admin/verify-token');

    expect(response.status()).toBe(200);
    const data = await response.json();
    expect(data.authenticated).toBe(true);
  });

  it('should access protected endpoint with token', async () => {
    // Navigate to protected page that needs backend token
    const response = await page.goto('http://localhost:3000/tenant/dashboard');

    expect(response?.status()).toBe(200);
    // Page loads, meaning token was successfully retrieved
  });
});
```

### Test 2: Token Expiration (HTTP)

```typescript
describe('Token Expiration (HTTP)', () => {
  it('should reject expired token', async () => {
    // 1. Login to get token
    await loginAsTestUser();

    // 2. Manually expire the token
    const cookies = await page.context().cookies();
    const expiredJwt = expireJwt(cookies[0].value);

    await page.context().addCookies([
      {
        name: 'authjs.session-token',
        value: expiredJwt,
        domain: 'localhost',
        path: '/',
        httpOnly: true,
        sameSite: 'Lax',
      },
    ]);

    // 3. Try to access protected endpoint
    const response = await page.request.get('http://localhost:3000/api/tenant-admin/verify-token');

    expect(response.status()).toBe(401);
  });
});
```

---

## Staging Tests (HTTPS)

### Pre-Deployment Checklist

Run these tests on staging (HTTPS) before deploying to production.

### Test 1: Cookie Name on HTTPS

```bash
#!/bin/bash
# Run after deploying to staging

# 1. Open staging in browser
open https://staging.gethandled.ai

# 2. In browser console, run:
console:
  document.cookie  # Look for __Secure-authjs.session-token

# Expected output:
# __Secure-authjs.session-token=xyz...; other-cookies...

# ✓ If you see __Secure- prefix, it's correct
# ✗ If you see authjs.session-token (no prefix), something is wrong
```

### Test 2: Verify Token Retrieval Works

```bash
# Login on staging
https://staging.gethandled.ai/login
# Enter credentials, verify login succeeds

# Check API returns 200 with token
curl -X GET https://staging.gethandled.ai/api/tenant-admin/verify-token \
  -H "Cookie: $(chrome-get-cookies)" \
  -H "Content-Type: application/json"

# Expected: 200 with { authenticated: true }
# If: 401 → Token not found in getBackendToken()
```

### Test 3: Check Server Logs

```bash
# SSH to staging server
ssh user@staging.gethandled.ai

# Check logs for token lookup
tail -f /var/log/app.log | grep "getBackendToken"

# ✓ Should see: "Token found: xxx"
# ✗ If you see: "No session cookie found" → Bug is here!
```

### Test 4: Protected Page Access

```bash
# 1. Login on staging
https://staging.gethandled.ai/login

# 2. Navigate to protected pages
https://staging.gethandled.ai/tenant/dashboard
https://staging.gethandled.ai/admin/users

# ✓ Pages load successfully
# ✗ If redirected to login → Token retrieval failed
```

---

## E2E Tests (Playwright)

### Test File

**Location**: `apps/web/e2e/tests/auth-token-retrieval.spec.ts`

```typescript
import { test, expect } from '@playwright/test';

// Helper to login and verify session cookie
async function loginAndVerify(page, protocol: 'http' | 'https') {
  const baseUrl = protocol === 'http' ? 'http://localhost:3000' : 'https://staging.gethandled.ai';

  // Login
  await page.goto(`${baseUrl}/login`);
  await page.fill('[name="email"]', 'test@example.com');
  await page.fill('[name="password"]', 'test123');
  await page.click('[type="submit"]');

  // Wait for authenticated redirect
  await page.waitForURL(`${baseUrl}/tenant/dashboard`);

  return page;
}

test.describe('Token Retrieval by Protocol', () => {
  test('should retrieve token on HTTP (local)', async ({ page }) => {
    await loginAndVerify(page, 'http');

    // Check cookie name
    const cookies = await page.context().cookies();
    const sessionCookie = cookies.find((c) => c.name === 'authjs.session-token');

    expect(sessionCookie).toBeDefined();
    expect(sessionCookie?.name).toBe('authjs.session-token'); // No prefix

    // Verify API can use token
    const response = await page.request.get('http://localhost:3000/api/tenant-admin/verify-token');
    expect(response.status()).toBe(200);
  });

  test('should retrieve token on HTTPS (staging)', async ({ page }) => {
    await loginAndVerify(page, 'https');

    // Check cookie name
    const cookies = await page.context().cookies();
    const sessionCookie = cookies.find(
      (c) => c.name === '__Secure-authjs.session-token' // With prefix on HTTPS
    );

    expect(sessionCookie).toBeDefined();
    expect(sessionCookie?.name).toBe('__Secure-authjs.session-token'); // __Secure- prefix!

    // Verify API can use token
    const response = await page.request.get(
      'https://staging.gethandled.ai/api/tenant-admin/verify-token'
    );
    expect(response.status()).toBe(200);
  });

  test('should not mix HTTP and HTTPS cookies', async ({ page, browser }) => {
    // Create two isolated browser contexts
    const httpContext = await browser.newContext();
    const httpsContext = await browser.newContext();

    // Login on HTTP
    const httpPage = httpContext.pages()[0];
    await loginAndVerify(httpPage, 'http');
    const httpCookies = await httpContext.cookies();

    // Login on HTTPS
    const httpsPage = httpsContext.pages()[0];
    await loginAndVerify(httpsPage, 'https');
    const httpsCookies = await httpsContext.cookies();

    // Verify different cookie names
    const httpCookie = httpCookies.find((c) => c.name === 'authjs.session-token');
    const httpsCookie = httpsCookies.find((c) => c.name === '__Secure-authjs.session-token');

    expect(httpCookie?.name).not.toBe(httpsCookie?.name);

    // Cleanup
    await httpContext.close();
    await httpsContext.close();
  });
});

test.describe('API Routes with Token', () => {
  test('should return 401 without authentication', async ({ page }) => {
    // Don't login, just call API directly
    const response = await page.request.get('http://localhost:3000/api/tenant-admin/verify-token');

    expect(response.status()).toBe(401);
  });

  test('should return 200 with valid authentication', async ({ page }) => {
    // Login first
    await loginAndVerify(page, 'http');

    // Now API should succeed
    const response = await page.request.get('http://localhost:3000/api/tenant-admin/verify-token');

    expect(response.status()).toBe(200);
  });

  test('should handle multiple API calls with single token', async ({ page }) => {
    await loginAndVerify(page, 'http');

    // Make multiple API calls
    const responses = await Promise.all([
      page.request.get('http://localhost:3000/api/tenant-admin/users'),
      page.request.get('http://localhost:3000/api/tenant-admin/settings'),
      page.request.get('http://localhost:3000/api/tenant-admin/verify-token'),
    ]);

    // All should succeed with same token
    responses.forEach((response) => {
      expect(response.status()).toBe(200);
    });
  });
});

test.describe('Token Refresh and Expiration', () => {
  test('should handle token expiration gracefully', async ({ page }) => {
    await loginAndVerify(page, 'http');

    // Wait for token to expire (or manually expire in test)
    // ... expiration logic ...

    // Try to access API
    const response = await page.request.get('http://localhost:3000/api/tenant-admin/verify-token');

    // Should get 401, not crash
    expect(response.status()).toBe(401);
  });

  test('should refresh token on new session', async ({ page }) => {
    await loginAndVerify(page, 'http');

    const cookies1 = await page.context().cookies();
    const token1 = cookies1.find((c) => c.name === 'authjs.session-token')?.value;

    // Logout and login again
    await page.goto('http://localhost:3000/api/auth/signout');
    await loginAndVerify(page, 'http');

    const cookies2 = await page.context().cookies();
    const token2 = cookies2.find((c) => c.name === 'authjs.session-token')?.value;

    // Tokens should be different
    expect(token1).not.toBe(token2);
  });
});
```

### Running E2E Tests

```bash
# Run all auth token tests
npm run test:e2e -- e2e/tests/auth-token-retrieval.spec.ts

# Run with UI (interactive)
npm run test:e2e:ui -- e2e/tests/auth-token-retrieval.spec.ts

# Run with visible browser (headed)
npm run test:e2e:headed -- e2e/tests/auth-token-retrieval.spec.ts

# Run on specific environment
NEXT_PUBLIC_API_URL=https://staging-api.com npm run test:e2e
```

---

## Manual Testing Checklist

### Local Development (HTTP)

```bash
# 1. Start dev server
npm run dev:web

# 2. Open browser devtools
DevTools → Application → Cookies

# 3. Navigate to login
http://localhost:3000/login

# 4. Login with test credentials
Email: test@example.com
Password: test123

# 5. Verify in cookies
Check for: authjs.session-token (WITHOUT __Secure- prefix)
Value should be a long JWT string

# 6. Navigate to protected page
http://localhost:3000/tenant/dashboard

# 7. Verify page loads
Should load successfully (token found and used)

# 8. Check API route
curl -X GET http://localhost:3000/api/tenant-admin/verify-token \
  -b "authjs.session-token=<paste-cookie-value>"

Expected: 200 with { authenticated: true }
```

### Staging (HTTPS)

```bash
# 1. Deploy to staging
npm run deploy:staging

# 2. Open browser devtools
DevTools → Application → Cookies

# 3. Navigate to login
https://staging.gethandled.ai/login

# 4. Login with test credentials
Email: test@example.com
Password: test123

# 5. Verify in cookies
Check for: __Secure-authjs.session-token (WITH __Secure- prefix!)
If you see "authjs.session-token" (no prefix) → BUG!

# 6. Navigate to protected page
https://staging.gethandled.ai/tenant/dashboard

# 7. Verify page loads
Should load successfully (token found with __Secure- prefix)

# 8. Check server logs
Look for: "Token found" or "No session cookie found"

# 9. Test logout and re-login
Verify new token is issued and works
```

---

## Debugging Test Failures

### "No session cookie found"

```
Symptom: Token lookup fails, returns null
Location: Server logs show "No session cookie found"

Diagnosis:
1. Check cookie name: authjs.session-token or __Secure-authjs.session-token?
2. Verify protocol: Is it HTTP (local) or HTTPS (staging)?
3. Check getBackendToken() code: Does it check both variants?

Fix:
- Add __Secure- variant to possibleCookieNames list
- Ensure __Secure- variant is checked FIRST
- Test on actual HTTPS (not just locally)
```

### "Token retrieval returns null"

```
Symptom: Cookie exists but getBackendToken() still returns null
Location: Could be cookie lookup OR JWT validation

Diagnosis:
1. Verify cookie value is a valid JWT: jwt.io paste the cookie value
2. Check JWT expiration: exp claim should be in the future
3. Verify secret: Is AUTH_SECRET set correctly?

Fix:
- Ensure AUTH_SECRET matches between NextAuth and getToken()
- Verify JWT hasn't expired
- Check for any JWT signature validation errors in logs
```

### "API routes return 401"

```
Symptom: Protected API routes return 401 even when logged in
Location: getBackendToken() failing in API route

Diagnosis:
1. Verify request parameter is passed: export async function GET(request)
2. Check if cookie is in request headers
3. Verify getBackendToken(request) is called (not getBackendToken())

Fix:
- Always pass request parameter in API routes
- Add logging to see which cookie names are available
- Check if __Secure- variant is in the request cookies
```

---

## Test Coverage Goals

| Aspect             | Target | Coverage                                      |
| :----------------- | :----: | :-------------------------------------------- |
| Cookie name lookup |  95%   | All variants (HTTPS, HTTP, legacy)            |
| HTTPS support      |  100%  | Must include `__Secure-` variant              |
| HTTP fallback      |  100%  | Must include non-prefixed variant             |
| Token validation   |  95%   | Valid, expired, malformed, wrong signature    |
| Error handling     |  100%  | Missing cookie, null return, graceful failure |
| API route access   |  100%  | Authenticated and unauthenticated             |
| Server Component   |  90%   | With and without request parameter            |

---

## Continuous Integration

### GitHub Actions (Sample)

```yaml
name: Auth Token Tests

on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest

    services:
      postgres:
        image: postgres:15
        env:
          POSTGRES_PASSWORD: postgres

    steps:
      - uses: actions/checkout@v3

      - uses: actions/setup-node@v3
        with:
          node-version: '20'

      # Unit tests (mocked environment)
      - name: Unit Tests
        run: npm run test:unit -- auth.test.ts

      # Integration tests (local HTTP)
      - name: Integration Tests
        run: npm run test:integration -- auth-integration.test.ts

      # E2E tests (HTTP & HTTPS)
      - name: E2E Tests
        run: npm run test:e2e -- auth-token-retrieval.spec.ts

      - name: Report Coverage
        uses: codecov/codecov-action@v3
        with:
          files: ./coverage/coverage-final.json
```

---

## Pre-Deployment Verification

### Day Before Deployment

```
☐ Run all unit tests: npm test -- auth.test.ts
☐ Run all integration tests: npm run test:integration
☐ Run all E2E tests: npm run test:e2e
☐ Check test coverage: npm run test:coverage
☐ Review test results in CI
```

### Deployment Day

```
☐ Test on staging (HTTPS) manually
☐ Verify __Secure- cookie is present
☐ Test multiple API routes with token
☐ Check server logs for token lookup success
☐ Test login/logout/re-login flow
☐ Verify no "No session cookie found" errors
```

### Post-Deployment

```
☐ Monitor error logs for next 4 hours
☐ Check for "No session cookie found" errors
☐ Verify user authentication success rate
☐ Test on production (HTTPS) with real users
☐ Document any issues found
```

---

**Last Updated**: 2025-12-31
**Version**: 1.0
**Maintained By**: MAIS Team
