# Next.js ISR Cache & API Contract Mismatch Prevention

**Date Created:** December 25, 2025
**Severity:** Medium (ISR), High (API Contracts)
**Impact:** User-facing stale data, API failures, integration breaking changes
**Status:** Prevention Strategy Documentation

---

## Executive Summary

Two distinct issues from Next.js storefront development have been identified and documented for prevention:

1. **ISR Cache Stale Data:** Next.js ISR (Incremental Static Regeneration) serves cached HTML/JSON beyond intended revalidation periods, showing outdated package information
2. **API URL Mismatches:** Client code calls incorrect API paths that don't match contract definitions, causing 404s and routing failures

**Root Causes:**

- ISR complexity not fully understood (cache layers, revalidation timing, manual cache busting)
- Contract definitions and client usage not synchronized during development
- Lack of automated validation between contracts and implementations
- Missing development workflow guidance for ISR debugging

**Prevention Strategies:**

- ISR debugging workflow with cache inspection tools
- Automated contract validation during code review
- Client-side route verification against contract definitions
- E2E test patterns to catch mismatches
- Contract-first development practices

---

## Part 1: ISR Cache Stale Data Prevention

### Problem Description

When updating tenant storefront content (packages, branding), Next.js ISR sometimes displays stale cached data instead of fresh content, even after the revalidation period has passed.

**Symptoms:**

- User updates package title in admin dashboard
- Customer navigates to storefront and sees old title
- Refreshing page doesn't immediately show new content
- Cache takes longer than `revalidate: 60` to update

**Affected Flows:**

- `/t/[slug]` - Tenant landing page (SSR with ISR)
- `/t/[slug]/book/[packageSlug]` - Package booking page (SSR with ISR)
- Package metadata generation in `generateMetadata()`

**Technical Root Causes:**

```typescript
// Line 84 in /t/[slug]/(site)/page.tsx
export const revalidate = 60;  // Revalidate every 60 seconds

// Line 114 in apps/web/src/lib/tenant.ts
next: { revalidate: 60 }  // Fetch with 60s ISR
```

ISR has multiple cache layers that interact in non-obvious ways:

1. **Static Generation Cache** - Initial build-time HTML
2. **Incremental Revalidation Cache** - In-memory cache during ISR
3. **Data Fetching Cache** - Fetch-level cache from `next` option
4. **CDN Cache** - If deployed (Vercel, Netlify)

Each layer has independent TTL logic that must align.

---

### Issue 1.1: Development Workflow - Detecting Stale Data

**When developing ISR features locally, stale data manifests differently:**

#### Local Development Behavior (Next.js 14+)

```bash
# Terminal 1: Start Next.js dev server
cd apps/web && npm run dev
# Running on http://localhost:3000

# Browser: Visit storefront
# http://localhost:3000/t/my-tenant

# In mock mode, data updates:
# Update package in mock adapter
# Refresh page... still shows old data for 60 seconds
```

**Why it happens:** In dev mode, Next.js caches in-memory between requests. The `cache: 'default'` in fetch requests respects the `revalidate: 60` from page config, not actual wall-clock time.

#### Detection Pattern

```typescript
// apps/web/src/lib/tenant.ts
// Line 114-115 - shows ISR revalidation
next: { revalidate: 60 }  // ← This is applied per-request, not globally

// This means:
// Request 1 at t=0s  → Fetches from API
// Request 2 at t=30s → Uses cached result (still valid)
// Request 3 at t=70s → Should refetch, but might return stale
```

**Why stale data occurs in development:**

1. **Cache is per-request in dev mode:** Each page request gets its own cache, but React's `cache()` wrapper deduplicates calls within a single render
2. **ISR revalidation timing is non-deterministic:** "Revalidate every 60s" doesn't mean "fetch new data at exactly 60s" - it means "this request is valid for up to 60s"
3. **Metadata generation calls the same function:** Both `generateMetadata()` and the page component call `getTenantStorefrontData()`, which are deduplicated by React's `cache()` wrapper - so they get the same cached result

#### Detecting Stale Data: Inspection Checklist

Create a simple test checklist to verify if data is stale:

```markdown
## ISR Stale Data Detection Checklist

1. **Browser DevTools - Network Tab**
   - [ ] Check Response Headers for `x-middleware-cache` or similar
   - [ ] Look for `Cache-Control` headers (what did the API return?)
   - [ ] Verify timestamps in response match expected update

2. **Server Response Headers**
   - [ ] Check `date` header in fetch response
   - [ ] Compare with local system time (off by 1+ minutes = stale)
   - [ ] On Vercel, check `x-vercel-cache` header (HIT vs MISS)

3. **API Verification**
   - [ ] Curl the backend directly: `curl http://localhost:3001/v1/packages`
   - [ ] Confirm API returns fresh data (compare timestamps)
   - [ ] Verify tenant API key is correct in headers

4. **React Cache Verification**
   ```typescript
   // In lib/tenant.ts, temporarily add logging:
   export const getTenantBySlug = cache(async (slug: string) => {
     console.log(`[CACHE] Fetching tenant: ${slug} at ${new Date().toISOString()}`);
     // ... fetch code ...
   });
   ```
   - [ ] Check console.log output - is function called each request?
   - [ ] If not called, React's cache() is reusing stale result
   - [ ] Expected: Function called every 60+ seconds in dev mode

5. **Fetch Cache Control**
   - [ ] Verify `next: { revalidate: 60 }` is set on fetch
   - [ ] For dynamic data, use `cache: 'no-store'` instead of ISR
   - [ ] Check if force-refresh needed via query param
```

---

### Issue 1.2: Manual Cache Busting Strategies

When stale data is detected, use these strategies to clear caches:

#### Strategy A: Disable ISR During Development

**For rapid prototyping**, disable ISR to see changes immediately:

```typescript
// apps/web/src/app/t/[slug]/(site)/page.tsx

// Change this:
export const revalidate = 60;

// To this (for development only):
export const revalidate = 0;  // Revalidate on every request (disables ISR)

// Or use environment variable:
export const revalidate = process.env.NODE_ENV === 'development' ? 0 : 60;
```

**When to use:** During feature development or debugging ISR issues. **Never commit with `revalidate: 0` in production routes.**

#### Strategy B: Next.js Cache Invalidation API

For Next.js 13.2+, use the on-demand revalidation API:

```typescript
// In a route handler or server action
import { revalidatePath } from 'next/cache';

export async function updatePackageBranding(tenantSlug: string) {
  // Update happens here
  await updateTenantBrandingInDb(tenantSlug);

  // Invalidate all pages for this tenant
  revalidatePath(`/t/${tenantSlug}`);
  revalidatePath(`/t/${tenantSlug}/book/[packageSlug]`);
  revalidatePath(`/t/${tenantSlug}/[...segments]`);
}
```

**Implementation:** This should be called from admin actions when tenants update content.

#### Strategy C: Query Parameter Force-Refresh

For debugging, add a query parameter to bypass cache:

```typescript
// In development, append query to URL
// http://localhost:3000/t/my-tenant?fresh=1

// Server component:
interface TenantPageProps {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ fresh?: string }>;
}

export default async function TenantPage({ params, searchParams }: TenantPageProps) {
  const { slug } = await params;
  const { fresh } = await searchParams;

  // If fresh=1, skip cache
  const cacheOption = fresh ? { revalidate: 0 } : { revalidate: 60 };
  const data = await getTenantStorefrontData(slug, cacheOption);

  return <TenantLandingPage data={data} />;
}
```

#### Strategy D: Clear Local Storage + Browser Cache

For Vercel deployments:

```bash
# 1. Clear Next.js ISR cache
rm -rf .next

# 2. Clear build artifacts
npm run clean

# 3. Rebuild and deploy
npm run build
npm run start
```

For local development:

```bash
# Kill dev server and clear next cache
pkill "next dev"
rm -rf apps/web/.next
cd apps/web && npm run dev
```

---

### Issue 1.3: ISR Development Workflow Recommendations

**Recommended workflow when working with ISR-enabled routes:**

#### Phase 1: Feature Development (Disable ISR)

```bash
# Start dev environment
npm run dev:api  # API in mock mode
cd apps/web && npm run dev  # Next.js in dev mode

# In code:
export const revalidate = 0;  // Fetch fresh on every request
```

**Why:** Rapid feedback loop, see changes instantly when API updates.

#### Phase 2: ISR Testing (Enable ISR)

After feature works with `revalidate: 0`:

```typescript
// Enable ISR for real-world testing
export const revalidate = 60;  // Revalidate every 60 seconds

// Test cycle:
// 1. Update mock data
// 2. Refresh page → should be stale (within 60s window)
// 3. Wait 60+ seconds
// 4. Refresh page → should be fresh
// 5. Verify timestamps in Network tab
```

**Test script:**

```typescript
// apps/web/src/lib/tenant.ts - add debug helper
export const debugISRCache = {
  getTenantBySlug: cache(async (slug: string) => {
    const startTime = Date.now();
    console.log(`[ISR-DEBUG] Fetching tenant ${slug} at ${new Date().toISOString()}`);

    const response = await fetch(`${API_BASE_URL}/v1/public/tenants/${encodeURIComponent(slug)}`, {
      method: 'GET',
      next: { revalidate: 60, tags: [`tenant-${slug}`] },
    });

    const elapsed = Date.now() - startTime;
    console.log(`[ISR-DEBUG] Fetch completed in ${elapsed}ms`);

    return response.json();
  }),
};
```

#### Phase 3: E2E Validation (ISR Timing)

After local testing, validate with E2E tests:

```typescript
// e2e/tests/isr-timing.spec.ts
import { test, expect } from '@playwright/test';

test('ISR revalidation timing', async ({ page }) => {
  // Visit storefront page
  await page.goto('/t/test-tenant');

  // Capture initial package title
  const initialTitle = await page.getByText(/package-title/i).textContent();

  // Verify Network header shows cache status
  const networkRequest = await page.context().request.get('/t/test-tenant');
  console.log('Cache headers:', networkRequest.headers());

  // Wait for ISR window to pass
  await page.waitForTimeout(61 * 1000);  // Wait 61 seconds

  // Reload and verify new data is fetched
  await page.reload();
  const newTitle = await page.getByText(/updated-package-title/i).textContent();

  expect(newTitle).not.toEqual(initialTitle);
});
```

---

### Issue 1.4: When to Use Cache Strategies

**Decision Tree:**

```
┌──────────────────────────────────────────┐
│ "My data needs to update in real-time"  │
└──────────────────────────────┬───────────┘
                               │
                    ┌──────────┴──────────┐
                    │                     │
        ┌───────────▼────────┐  ┌────────▼──────────┐
        │ Updates are rare   │  │ Updates happen    │
        │ (once per day)     │  │ frequently (every  │
        │ e.g., branding     │  │ minute) e.g., ads  │
        └────────────────────┘  └───────────────────┘
                    │                     │
              ┌─────▼────────┐      ┌────▼──────────┐
              │ Use ISR       │      │ Use            │
              │ revalidate:   │      │ cache: no-store│
              │ 3600 (1 hour) │      │ on fetch()    │
              └───────────────┘      └───────────────┘
```

**Recommended ISR Settings by Page Type:**

| Page | Revalidate | Reason |
|------|-----------|--------|
| `/t/[slug]` (landing) | 3600s (1h) | Branding changes rarely, tenant usually updates once daily |
| `/t/[slug]/book/[pkg]` | 300s (5m) | Package details change more often (pricing, descriptions) |
| `/t/[slug]/availability` | 60s | Availability data changes frequently (bookings) |
| `/admin/...` | 0 (disabled) | Admin pages need always-fresh data |

---

## Part 2: API URL Mismatch Prevention

### Problem Description

Client code makes API requests to URLs that don't match the contract definitions, causing 404 errors and broken features.

**Example Mismatch:**

```typescript
// Contract definition (packages/contracts/src/api.v1.ts)
getPackageBySlug: {
  method: 'GET',
  path: '/v1/packages/:slug',  // ← Correct path
  // ...
}

// Client code (apps/web/src/lib/tenant.ts)
const url = `${API_BASE_URL}/v1/packages/slug/${encodeURIComponent(packageSlug)}`;
//                                     ^^^^ ← WRONG: Extra "slug/" segment
```

**Result:** Client sends request to `/v1/packages/slug/wedding` but server expects `/v1/packages/wedding`, causing 404.

---

### Issue 2.1: Root Causes of URL Mismatches

#### 1.1A: Manual URL Construction (Most Common)

**Problem:** Building URLs as strings instead of using the type-safe client:

```typescript
// ❌ BAD - Manual URL string (error-prone)
const url = `${API_BASE_URL}/v1/packages/${slug}`;
const response = await fetch(url);

// ✅ GOOD - Use ts-rest client (type-safe)
const api = await createServerApiClient();
const response = await api.getPackageBySlug({ params: { slug } });
```

**Why it happens:**

- Fetch API feels simpler than ts-rest initially
- ts-rest requires understanding contract structure
- Developer might not know ts-rest client exists

#### 1.1B: Query Parameter vs Path Parameter Confusion

```typescript
// Contract expects path parameter:
path: '/v1/availability/unavailable'
query: z.object({
  startDate: z.string(),
  endDate: z.string(),
})

// ❌ WRONG - Treating as path parameter
const url = `/v1/availability/unavailable/${startDate}/${endDate}`;

// ✅ CORRECT - Treating as query parameter
const url = `/v1/availability/unavailable?startDate=${startDate}&endDate=${endDate}`;
```

#### 1.1C: Endpoint Name Changes Without Client Update

```typescript
// Contract changed:
- path: '/v1/availability/unavailable-dates'
+ path: '/v1/availability/unavailable'

// Client still uses old path:
const url = `${API_BASE_URL}/v1/availability/unavailable-dates?startDate=...`;
// ← Now returns 404 if endpoint was removed
```

---

### Issue 2.2: Code Review Checklist for URL Mismatches

Add these checks during code review:

#### Pre-Review: Developer Self-Check

Before submitting PR, developer should verify:

```markdown
## API URL Mismatch Self-Check

### For each API call:

- [ ] **Endpoint matches contract:** Search `packages/contracts/src/api.v1.ts` for the operation name
  - [ ] HTTP method matches (GET/POST/PUT/DELETE)
  - [ ] Path matches exactly (including `/v1` prefix)
  - [ ] Path parameters are named correctly (e.g., `:slug` not `:id`)

- [ ] **Parameter format is correct:**
  - [ ] Path parameters: `encodeURIComponent(value)` for special chars
  - [ ] Query parameters: `?key=value&key2=value2` syntax
  - [ ] Body: Matches Zod schema from contract

- [ ] **Headers are included:**
  - [ ] `X-Tenant-Key` for multi-tenant endpoints
  - [ ] `Authorization: Bearer <token>` for authenticated endpoints
  - [ ] `Content-Type: application/json` for POST/PUT

### Example Verification

```typescript
// Contract:
getPackageBySlug: {
  method: 'GET',
  path: '/v1/packages/:slug',
  pathParams: z.object({ slug: z.string() }),
}

// Client implementation check:
const url = `${API_BASE_URL}/v1/packages/${encodeURIComponent(slug)}`;
//                           ├─ ✓ Matches '/v1/packages/:slug' pattern
//                           └─ ✓ encodeURIComponent for safety

const response = await fetch(url, {
  method: 'GET',  // ✓ Matches GET in contract
  headers: {
    'X-Tenant-Key': apiKey,  // ✓ Required for public endpoints
  },
});
```
```

#### Code Review Checklist

Reviewer should verify:

```markdown
## Code Review: API URL Validation

### 1. Contract Consistency
- [ ] API call path matches `packages/contracts/src/api.v1.ts`
- [ ] HTTP method is correct (GET/POST/PUT/DELETE)
- [ ] Path parameter names match contract definition

### 2. Type Safety
- [ ] Using ts-rest client instead of manual fetch (preferred)
- [ ] If manual fetch, parameters are properly URL-encoded
- [ ] Request/response types match contract schemas

### 3. Multi-Tenant Headers
- [ ] All `/v1/public/*` and `/v1/*` endpoints include `X-Tenant-Key` header
- [ ] Tenant key is retrieved from correct context (apiKeyPublic, not apiKeySecret)
- [ ] Header name is exactly `X-Tenant-Key` (case-sensitive)

### 4. Error Handling
- [ ] 404 responses handled gracefully
- [ ] 401 responses handled for protected endpoints
- [ ] Timeout handling for slow networks

### Example Review Comments

```
// ❌ Issue: Path mismatch
const url = `/v1/packages/${slug}`;  // Contract expects '/v1/packages/:slug'
// ↑ This is actually correct! Reviewer should verify in contract file.

// ❌ Issue: Missing X-Tenant-Key
const response = await fetch(url, {
  headers: { 'Content-Type': 'application/json' }
  // ↑ Missing X-Tenant-Key for public endpoints

// ❌ Issue: Query param as path param
const url = `/v1/availability/${startDate}/${endDate}`;
// ↑ Contract expects query parameters, not path parameters
```
```

---

### Issue 2.3: Automated Contract Validation

#### Strategy: Contract Linting Script

Create a validation script that checks all fetch calls against contracts:

```bash
# scripts/validate-api-contracts.ts
import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';
import { Contracts } from '@macon/contracts';

type ContractKey = keyof typeof Contracts;

/**
 * Extract all API URLs from client code
 */
function extractClientUrls(): Map<string, string> {
  const urlPattern = /\$\{API_BASE_URL\}([\w/:\-?=&]+)/g;
  const files = execSync('find apps/web/src -name "*.ts" -o -name "*.tsx"', {
    encoding: 'utf-8',
  }).split('\n');

  const urls = new Map<string, string>();

  files.forEach(file => {
    if (!file) return;
    const content = fs.readFileSync(file, 'utf-8');
    let match;
    while ((match = urlPattern.exec(content)) !== null) {
      urls.set(match[1], file);
    }
  });

  return urls;
}

/**
 * Extract contract paths from Contracts definition
 */
function extractContractPaths(): Set<string> {
  const paths = new Set<string>();

  Object.entries(Contracts).forEach(([_key, endpoint]: any) => {
    if (endpoint.path) {
      paths.add(endpoint.path);
    }
  });

  return paths;
}

/**
 * Validate all client URLs against contracts
 */
function validateUrls() {
  const clientUrls = extractClientUrls();
  const contractPaths = extractContractPaths();

  let hasErrors = false;

  clientUrls.forEach((file, url) => {
    // Normalize URL for comparison (remove query params)
    const normalizedUrl = url.split('?')[0];

    // Check if this URL pattern exists in contracts
    let found = false;
    for (const contractPath of contractPaths) {
      // Convert contract path to regex (/v1/packages/:slug → /v1/packages/.+)
      const regex = new RegExp('^' + contractPath.replace(/:[^/]+/g, '[^/]+') + '$');
      if (regex.test(normalizedUrl)) {
        found = true;
        break;
      }
    }

    if (!found) {
      console.error(`ERROR: URL not found in contracts: ${url}`);
      console.error(`       File: ${file}`);
      hasErrors = true;
    }
  });

  if (hasErrors) {
    console.error('Some API URLs do not match contract definitions!');
    process.exit(1);
  }

  console.log('✓ All API URLs match contract definitions');
}

validateUrls();
```

#### Integration with CI/CD

Add to `package.json`:

```json
{
  "scripts": {
    "validate:contracts": "npx ts-node scripts/validate-api-contracts.ts",
    "pretest": "npm run validate:contracts",
    "prebuild": "npm run validate:contracts"
  }
}
```

This ensures contracts are validated before tests and builds.

---

### Issue 2.4: E2E Tests for Contract-Client Matching

#### Test Pattern 1: API Endpoint Discovery

```typescript
// e2e/tests/api-contract-validation.spec.ts
import { test, expect } from '@playwright/test';
import { Contracts } from '@macon/contracts';

/**
 * E2E test to verify all contract endpoints are reachable
 */
test.describe('API Contract Validation', () => {
  const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

  test('all contract paths exist on API', async ({ request }) => {
    // Get all contract definitions
    const contractEntries = Object.entries(Contracts) as any[];

    for (const [name, contract] of contractEntries) {
      // Skip webhook endpoints that require special setup
      if (name.includes('webhook') && contract.method === 'POST') {
        continue;
      }

      // Build request
      let url = `${API_URL}${contract.path}`;

      // Replace path parameters with dummy values
      url = url.replace(/:[^/]+/g, 'test-value');

      // Make request based on method
      let response;
      try {
        if (contract.method === 'GET') {
          response = await request.get(url, {
            headers: { 'X-Tenant-Key': 'pk_live_test_test' },
          });
        } else if (contract.method === 'POST') {
          response = await request.post(url, {
            headers: { 'X-Tenant-Key': 'pk_live_test_test' },
            data: {},
          });
        } else if (contract.method === 'PUT') {
          response = await request.put(url, {
            headers: { 'X-Tenant-Key': 'pk_live_test_test' },
            data: {},
          });
        } else if (contract.method === 'DELETE') {
          response = await request.delete(url, {
            headers: { 'X-Tenant-Key': 'pk_live_test_test' },
          });
        }

        // Endpoint should exist (not 404 from wrong path)
        // It might return 400 (invalid params) or 401 (auth required), but not 404
        expect(response?.status).not.toEqual(404);
        console.log(`✓ ${contract.method} ${contract.path}`);
      } catch (error) {
        console.error(`✗ ${contract.method} ${contract.path}: ${error}`);
        throw error;
      }
    }
  });
});
```

#### Test Pattern 2: Client-Contract Consistency

```typescript
// e2e/tests/storefront-api-calls.spec.ts
import { test, expect } from '@playwright/test';

test.describe('Storefront API Calls', () => {
  test('storefront loads package data from correct endpoint', async ({ page }) => {
    // Navigate to storefront
    await page.goto('/t/test-tenant');

    // Monitor network requests
    const requests: string[] = [];
    page.on('request', (request) => {
      if (request.url().includes('/v1/')) {
        requests.push(request.url());
      }
    });

    await page.waitForLoadState('networkidle');

    // Verify expected API calls were made
    const packageCalls = requests.filter(url => url.includes('/v1/packages'));
    expect(packageCalls.length).toBeGreaterThan(0);

    // Verify no 404s occurred
    const responses: number[] = [];
    for (const request of page.context().request as any) {
      const status = (request as any).status;
      if (status === 404) {
        console.error(`404 on request: ${request.url()}`);
        responses.push(404);
      }
    }

    expect(responses).not.toContain(404);
  });

  test('package detail page uses correct endpoint', async ({ page }) => {
    // Navigate to a specific package
    await page.goto('/t/test-tenant/book/wedding-package');

    // Should successfully load package
    const heading = page.getByRole('heading', { name: /wedding/i });
    await expect(heading).toBeVisible({ timeout: 10000 });

    // Verify network response was successful (not 404)
    const responses = await page.context().request.head(
      'http://localhost:3001/v1/packages/wedding-package',
      {
        headers: { 'X-Tenant-Key': 'pk_live_test_test' },
      }
    );

    expect(responses.status).toBeLessThan(400);  // Not 404, not 500
  });
});
```

---

### Issue 2.5: Contract-First Development Workflow

Recommended workflow to prevent mismatches from occurring:

#### Step 1: Define Contract First

```typescript
// packages/contracts/src/api.v1.ts
export const Contracts = c.router({
  // NEW ENDPOINT - Define BEFORE implementing
  getTenantPackageBySlug: {
    method: 'GET',
    path: '/v1/packages/:slug',  // ← Explicit path
    pathParams: z.object({
      slug: z.string(),
    }),
    responses: {
      200: PackageDtoSchema,
      404: NotFoundErrorSchema,
    },
  },
});
```

#### Step 2: Verify Client Implementation Against Contract

```typescript
// apps/web/src/lib/tenant.ts
export async function getTenantPackageBySlug(
  apiKeyPublic: string,
  packageSlug: string
): Promise<PackageData | null> {
  // ✓ Uses exact path from contract: '/v1/packages/:slug'
  const url = `${API_BASE_URL}/v1/packages/${encodeURIComponent(packageSlug)}`;

  const response = await fetch(url, {
    method: 'GET',  // ✓ Matches contract method
    headers: {
      'X-Tenant-Key': apiKeyPublic,  // ✓ Required header
    },
    next: { revalidate: 60 },  // ✓ ISR setting
  });

  // ... rest of implementation
}
```

#### Step 3: Test Endpoint Exists

```bash
# After implementing contract in Express API:
curl -H "X-Tenant-Key: pk_live_test_test" \
  http://localhost:3001/v1/packages/wedding

# Should return 200, not 404
# ✓ If 404, path mismatch between contract and implementation
```

#### Step 4: Test Client-Side Usage

```typescript
// Add to E2E tests
test('getTenantPackageBySlug fetches from correct endpoint', async () => {
  const pkg = await getTenantPackageBySlug('pk_live_test_test', 'wedding');
  expect(pkg).toBeDefined();
  expect(pkg?.slug).toBe('wedding');
});
```

---

## Part 3: Quick Reference Checklists

### Checklist: Adding a New API Endpoint

Use this when adding new endpoints to prevent mismatches:

```markdown
## New Endpoint Checklist

- [ ] **1. Contract Definition** (packages/contracts/src/api.v1.ts)
  - [ ] Export new endpoint in `Contracts` object
  - [ ] Define method, path, and parameters
  - [ ] Define response schemas with all status codes
  - [ ] Add JSDoc comments with endpoint description

- [ ] **2. Express Implementation** (server/src/routes/*.ts)
  - [ ] Implement route handler with exact path from contract
  - [ ] Return response schema exactly as defined
  - [ ] Handle all error cases defined in contract

- [ ] **3. Client Usage** (apps/web/src/lib/*.ts)
  - [ ] IF using ts-rest client: `await api.endpointName(params)`
  - [ ] IF using manual fetch: verify path matches contract exactly
  - [ ] Include all required headers (X-Tenant-Key, Authorization, etc.)
  - [ ] Handle all response types (success, 400, 401, 404, etc.)

- [ ] **4. Testing**
  - [ ] Unit test: Express route returns correct response
  - [ ] Integration test: Full flow from client to server
  - [ ] E2E test: Actual browser request to endpoint

- [ ] **5. Code Review**
  - [ ] Reviewer verifies contract path in code
  - [ ] Reviewer checks all required headers included
  - [ ] Reviewer confirms response type matches schema
```

### Checklist: Code Review for API Calls

Use during code review for any changes touching API calls:

```markdown
## API Call Code Review Checklist

For each API call in the diff:

- [ ] **Path Verification**
  - [ ] Find corresponding entry in packages/contracts/src/api.v1.ts
  - [ ] Copy exact path from contract
  - [ ] Verify path parameters match contract definition
  - [ ] If path not in contract, it's a problem

- [ ] **Parameter Verification**
  - [ ] Path params: Using `encodeURIComponent()` for safety
  - [ ] Query params: Correct syntax `?key=value&key=value`
  - [ ] Body: Type-checked against contract schema

- [ ] **Header Verification**
  - [ ] Public endpoints: Has `X-Tenant-Key` header
  - [ ] Protected endpoints: Has `Authorization: Bearer` header
  - [ ] Content-Type: `application/json` for requests

- [ ] **Error Handling**
  - [ ] Handles 404 responses gracefully
  - [ ] Handles 401 responses (redirects to login)
  - [ ] Logs other error status codes
  - [ ] Provides user-friendly error messages

- [ ] **Type Safety**
  - [ ] Response is type-checked
  - [ ] If using `any` for response, there's a comment explaining why
  - [ ] No `as any` assertions without reason

Example of thorough review comment:
```
// Good comment:
// This endpoint returns status codes 200, 404, and 500 per contract.
// Handling 404 as null (package not found), others as errors.

// Bad pattern that should be flagged:
fetch(url) // ← No error handling, assumes 200 always
  .then(r => r.json())
  .then(data => setData(data));
```
```

---

## Part 4: Testing Patterns for Prevention

### Integration Test: API Contract Consistency

```typescript
// server/test/integration/api-contract-validation.spec.ts
import { describe, it, expect } from 'vitest';
import { Contracts } from '@macon/contracts';
import type { Router as ExpressRouter } from 'express';
import { app } from '../../src/app';

describe('API Contract Consistency', () => {
  // Extract all contract paths
  const contractPaths = new Map<string, string>();
  Object.entries(Contracts).forEach(([name, config]: any) => {
    contractPaths.set(config.path.toLowerCase(), name);
  });

  // Extract all Express routes
  const expressRoutes = new Set<string>();
  function extractRoutes(router: ExpressRouter, prefix = '') {
    if (router.stack) {
      router.stack.forEach((layer: any) => {
        if (layer.route) {
          const fullPath = prefix + layer.route.path;
          expressRoutes.add(fullPath.toLowerCase());
        } else if (layer.name === 'router' && layer.handle.stack) {
          extractRoutes(layer.handle, prefix + layer.regexp.source);
        }
      });
    }
  }

  extractRoutes(app);

  it('all contract paths have Express implementations', () => {
    const missingImplementations = [];

    contractPaths.forEach((name, path) => {
      if (!expressRoutes.has(path)) {
        missingImplementations.push(`${name}: ${path}`);
      }
    });

    expect(missingImplementations).toEqual([]);
  });

  it('all Express routes have contract definitions', () => {
    const missingContracts = [];

    expressRoutes.forEach(path => {
      if (!contractPaths.has(path)) {
        missingContracts.push(path);
      }
    });

    expect(missingContracts).toEqual([]);
  });
});
```

### E2E Test: Storefront Data Freshness

```typescript
// e2e/tests/isr-cache-validation.spec.ts
import { test, expect } from '@playwright/test';

test.describe('ISR Cache Validation', () => {
  test('storefront displays fresh package data', async ({ page, context }) => {
    // Navigate to storefront
    await page.goto('/t/test-tenant');

    // Capture initial data
    const initialPackage = await page.getByText(/package-title/i).textContent();
    const initialNetworkTime = new Date();

    // Check cache headers on response
    const requests = [];
    context.on('request', (request) => {
      requests.push(request.url());
    });

    await page.waitForLoadState('networkidle');

    // Find API request to /v1/packages
    const packageRequest = requests.find(url => url.includes('/v1/packages'));
    expect(packageRequest).toBeDefined();

    // Wait for ISR window to pass
    await new Promise(resolve => setTimeout(resolve, 61 * 1000));

    // Reload page (should fetch fresh data)
    await page.reload();
    await page.waitForLoadState('networkidle');

    // Verify data was refreshed
    const reloadTime = new Date();
    expect(reloadTime.getTime() - initialNetworkTime.getTime()).toBeGreaterThan(60000);
  });
});
```

---

## Summary

**For ISR Cache Issues:**

1. Use development workflow checklist to detect stale data
2. Know when to disable ISR (`revalidate: 0`) vs enable it
3. Understand cache layers (static, incremental, fetch-level)
4. Use `revalidatePath()` for on-demand invalidation
5. Test ISR timing before deploying

**For API URL Mismatches:**

1. **Always verify paths in contracts first** - Search `packages/contracts/src/api.v1.ts`
2. **Prefer ts-rest client** over manual fetch for type safety
3. **Use contract linting script** to catch mismatches in CI
4. **Add E2E tests** that verify API endpoints are reachable
5. **Include checklist items** in code reviews for API changes

**Key Prevention Rules:**

- Contract-first: Define API in contracts BEFORE implementing
- Verify: Every API call should have a corresponding contract entry
- Test: E2E tests should verify client-server contract consistency
- Review: Code review must check path matches contract exactly

