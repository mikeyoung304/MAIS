# E2E Test Investigation & Fixes

**Date**: 2025-11-14
**Status**: In Progress - Critical issues identified and partially resolved

---

## Investigation Summary

Used parallel subagent investigations to analyze E2E test failures across three dimensions:

1. Admin login redirect failures (5 tests)
2. Package loading failures (4 tests)
3. Environment variable propagation

---

## Root Causes Identified

### 1. **API Client URL Construction Bug** ✅ FIXED

**File**: `client/src/lib/api.ts:97`

**Problem**:

```typescript
const response = await fetch(path, {
  // ❌ path is relative like "/v1/packages"
  method,
  headers: requestHeaders,
  body: body,
});
```

**Fix Applied**:

```typescript
const fullUrl = `${baseUrl}${path}`; // ✅ Construct full URL
const response = await fetch(fullUrl, {
  method,
  headers: requestHeaders,
  body: body,
});
```

---

### 2. **Admin Credentials Mismatch** ✅ FIXED

**Files**:

- `e2e/tests/admin-flow.spec.ts` (5 occurrences)
- `server/.env`
- `server/prisma/seed.ts`

**Problem**:

- Tests used: `admin@elope.com` / `admin123`
- Seed created: `admin@example.com` / `admin` (default)
- Seed requires: >= 12 characters (OWASP 2023)

**Fix Applied**:

```bash
# server/.env
ADMIN_DEFAULT_PASSWORD=admin123admin  # 13 characters

# e2e/tests/admin-flow.spec.ts (all 5 instances)
await page.fill('#email', 'admin@example.com');
await page.fill('#password', 'admin123admin');
```

**Database Re-seeded**: ✅ Confirmed with output:

```
✅ Created test tenant: Elope E2E Test Tenant (elope-e2e)
```

---

### 3. **Server Adapter Configuration Mismatch** ✅ FIXED

**File**: `e2e/playwright.config.ts`

**Problem**:

- Client used: `VITE_APP_MODE=mock` (client-side variable)
- Server needs: `ADAPTERS_PRESET` (server-side variable)
- Server defaulted to mock adapters, but tenant validation still checked Prisma database

**Fix Applied**:

```typescript
webServer: {
  command: 'ADAPTERS_PRESET=real VITE_API_URL=http://localhost:3001 VITE_APP_MODE=mock VITE_E2E=1 VITE_TENANT_API_KEY=pk_live_elope-e2e_000000000000 npm run dev:e2e',
  //        ^^^^^^^^^^^^^^^^^^^ Added this
  cwd: '..',
  url: 'http://localhost:5173',
  reuseExistingServer: !process.env.CI,
  timeout: 120 * 1000,
},
```

---

## Subagent Investigation Findings

### Subagent 1: Admin Login Flow Analysis

**Findings**:

- Redirect URL is CORRECT (`/admin/dashboard`)
- Login flow: User submits → API returns token → AuthContext updates state → useEffect triggers navigate()
- **Issue**: Race condition - State update delays may cause `waitForURL()` timeout
- ProtectedRoute shows loading state initially

**Recommendation**: Tests may need longer timeout or different wait strategy

---

### Subagent 2: Package Loading Analysis

**Findings**:

- API endpoint: `GET /v1/packages` (ts-rest contract)
- React Query hook: `usePackages()` with query key `["packages"]`
- Component: `CatalogGrid.tsx` with three conditional states:
  1. Loading: Shows "Loading packages..."
  2. Error: Shows "Error loading packages: {message}"
  3. Empty: Shows "No packages available"
  4. Success: Renders package grid with `<Link to="/package/{slug}">`

**Critical Finding**:

- Server middleware `resolveTenant()` validates `X-Tenant-Key` header
- If tenant not found/inactive → 401/403 error → packages don't render
- E2E tenant exists in database (`pk_live_elope-e2e_000000000000`)

---

### Subagent 3: Environment Variable Propagation

**Findings**:

- ✅ Concurrently DOES pass env vars to child processes
- ✅ Vite automatically exposes `VITE_*` variables (no `loadEnv()` needed)
- ✅ Shell env vars have highest priority over `.env` files
- ✅ Playwright config approach is CORRECT

**Recommendation**: Add type safety

```typescript
// client/src/vite-env.d.ts
interface ImportMetaEnv {
  readonly VITE_API_URL: string;
  readonly VITE_APP_MODE: string;
  readonly VITE_STRIPE_PUBLISHABLE_KEY: string;
  readonly VITE_TENANT_API_KEY?: string; // NEW
  readonly VITE_E2E?: string; // NEW
}
```

---

## Current Test Status

**Result**: Still 9/9 failing (as of final test run)

**Hypothesis**: Playwright's `reuseExistingServer: !process.env.CI` is reusing old servers that don't have the fixes applied. The error "ECONNREFUSED ::1:3001" suggests API server isn't starting at all.

**Test Failures**:

1. **Admin Login (5 tests)**: Timeout waiting for `/admin/dashboard` redirect (10s)
2. **Booking Flow (2 tests)**: Packages not found - `locator('a[href*="/package/"]')` not visible
3. **Mock Booking (2 tests)**: API server connection refused (::1:3001)

---

## Next Steps

### Immediate (Required)

1. ✅ **Kill all Playwright/dev servers**: Ensure clean state
2. ⬜ **Verify API server starts**: Check logs for startup errors
3. ⬜ **Test admin login manually**: Verify credentials work in browser
4. ⬜ **Test packages endpoint**: `curl -H "X-Tenant-Key: pk_live_elope-e2e_000000000000" http://localhost:3001/v1/packages`

### Short-term (Phase 1)

1. ⬜ **Add E2E test documentation**: Document test setup requirements
2. ⬜ **Improve test wait strategies**: Use more resilient waits for dynamic content
3. ⬜ **Add debug logging**: Console logs in tests to see actual vs expected state

### Long-term (Post-E2E)

1. ⬜ **Fix Customer/Venue tenantId** (DATA CORRUPTION RISK) - Priority 1
2. ⬜ **Implement subdomain routing** - Required for 3-tenant launch
3. ⬜ **Fix `/v1/tenant/info` endpoint** - Dashboard shows "Not Set" errors

---

## Files Modified This Session

### Fixed

1. `/Users/mikeyoung/CODING/Elope/client/src/lib/api.ts` - API URL construction
2. `/Users/mikeyoung/CODING/Elope/e2e/tests/admin-flow.spec.ts` - Admin credentials (5 instances)
3. `/Users/mikeyoung/CODING/Elope/e2e/playwright.config.ts` - Server adapter preset
4. `/Users/mikeyoung/CODING/Elope/server/.env` - Admin password

### Created

1. `/Users/mikeyoung/CODING/Elope/.claude/MULTI_TENANT_READINESS_ASSESSMENT.md` (457 lines)
2. `/Users/mikeyoung/CODING/Elope/.claude/E2E_TEST_INVESTIGATION.md` (this file)

---

## Infrastructure Completed (Previous Session)

✅ CI/CD Pipeline (`.github/workflows/ci.yml`)
✅ Pre-commit Hooks (`.husky/pre-commit`)
✅ Test Coverage Configuration (`server/vitest.config.ts`)
✅ Test Templates (`server/test/templates/*.ts`)
✅ Test Documentation (`server/test/README.md`, 4,647 lines)

---

## Success Metrics

- [x] Multi-tenant architecture analysis complete
- [x] Root causes identified via subagent investigations
- [x] API client bug fixed
- [x] Admin credentials fixed
- [x] Server adapter configuration fixed
- [ ] E2E tests passing ← **Blocked**: Server startup issues
- [ ] Ready for Phase 1 multi-tenant fixes

---

**Recommendation**: Commit current fixes and continue investigation in fresh session with clean server state.
