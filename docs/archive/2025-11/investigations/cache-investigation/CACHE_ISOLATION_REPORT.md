# Cache Isolation Security Analysis

**Date:** 2025-11-06
**Severity:** CRITICAL - Cross-Tenant Data Leakage
**Status:** CONFIRMED

## Executive Summary

The application has **duplicate caching at two levels**, and the HTTP-level cache does NOT include `tenantId` in its cache keys, causing **cross-tenant data leakage**. Two different tenants making identical requests (e.g., `GET /v1/packages`) receive the same cached response, exposing Tenant A's data to Tenant B.

## Root Cause Analysis

### 1. Dual-Layer Caching Architecture

The application implements caching at TWO levels:

#### Layer 1: Application-Level Cache (CORRECT - Tenant-Isolated)

- **File:** `/src/lib/cache.ts` (CacheService)
- **Usage:** `catalog.service.ts`, `availability.service.ts`
- **Key Format:** `catalog:${tenantId}:all-packages` ✅
- **Status:** **SECURE** - Includes tenantId in keys
- **TTL:** 900 seconds (15 minutes)

#### Layer 2: HTTP-Level Cache (VULNERABLE - Not Tenant-Isolated)

- **File:** `/src/middleware/cache.ts` (cacheMiddleware)
- **Usage:** Applied globally to `/v1/packages` and `/v1/availability`
- **Key Format:** `GET:/v1/packages:{}` ❌
- **Status:** **INSECURE** - Does NOT include tenantId
- **TTL:** 300 seconds (5 minutes) for packages, 120 seconds (2 minutes) for availability

### 2. How the Vulnerability Works

```typescript
// src/middleware/cache.ts (lines 40-45)
const keyGenerator =
  options.keyGenerator ||
  ((req: Request) => {
    // Default: use method + path + query string
    return `${req.method}:${req.path}:${JSON.stringify(req.query)}`;
  });
```

**Problem:** The cache key generator does NOT access `req.tenantId` or `req.headers['x-tenant-key']`.

### 3. Request Flow Demonstrating the Bug

```
Request 1: Tenant A (X-Tenant-Key: pk_live_tenant_alice)
  → GET /v1/packages
  → HTTP Cache Key: "GET:/v1/packages:{}"
  → Cache MISS
  → Tenant Middleware: req.tenantId = "tenant_alice_id"
  → CatalogService: Uses cache key "catalog:tenant_alice_id:all-packages"
  → App-level Cache MISS
  → Database query (WHERE tenantId = 'tenant_alice_id')
  → Returns [Package1_Alice, Package2_Alice]
  → App-level cache SET: "catalog:tenant_alice_id:all-packages" = [...]
  → HTTP cache SET: "GET:/v1/packages:{}" = [Package1_Alice, Package2_Alice]
  → Response: [Package1_Alice, Package2_Alice]

Request 2: Tenant B (X-Tenant-Key: pk_live_tenant_bob)
  → GET /v1/packages
  → HTTP Cache Key: "GET:/v1/packages:{}" (SAME AS TENANT A!)
  → Cache HIT (returns Tenant A's data)
  → Response: [Package1_Alice, Package2_Alice] ❌ LEAK!
  → Tenant middleware never runs
  → CatalogService never runs
  → Database never queried
```

## Evidence from Code

### 1. HTTP Cache Middleware (Vulnerable)

**File:** `/src/middleware/cache.ts`

```typescript
// Line 54: Cache key generated WITHOUT tenant context
const key = keyGenerator(req);

// Lines 40-45: Default key generator ignores tenantId
(req: Request) => {
  return `${req.method}:${req.path}:${JSON.stringify(req.query)}`;
};
```

### 2. Application Setup

**File:** `/src/app.ts`

```typescript
// Lines 81-86: HTTP cache middleware applied GLOBALLY to public routes
// BEFORE tenant middleware runs!

// Apply caching middleware to public catalog endpoints
app.use('/v1/packages', cacheMiddleware({ ttl: 300 }));
app.use('/v1/availability', cacheMiddleware({ ttl: 120 }));

// ... later in routes/index.ts ...

// Tenant middleware only runs when route handler executes
globalMiddleware: [
  (req, res, next) => {
    if (req.path.startsWith('/v1/packages')) {
      tenantMiddleware(req, res, next); // Too late - HTTP cache already checked!
    }
  },
];
```

### 3. Middleware Execution Order

The critical issue is **middleware execution order**:

1. **HTTP Cache Middleware** runs FIRST (`app.use('/v1/packages', cacheMiddleware(...))`)
   - Checks cache with key: `GET:/v1/packages:{}`
   - If HIT, returns cached response immediately
   - **Tenant middleware never executes!**

2. **Tenant Middleware** runs LATER (in `globalMiddleware`)
   - Only runs if HTTP cache was MISS
   - Sets `req.tenantId` for controller to use

3. **Controller/Service** uses application-level cache
   - Uses correct tenant-scoped key: `catalog:${tenantId}:all-packages`
   - But this only matters on HTTP cache MISS

## Security Impact

### Severity: CRITICAL

**Affected Endpoints:**

- `GET /v1/packages` (all packages)
- `GET /v1/packages/:slug` (package details)
- `GET /v1/availability?date=YYYY-MM-DD` (availability check)
- `GET /v1/availability/unavailable?startDate=...&endDate=...` (date ranges)

**Data Exposure:**

- Package catalogs (titles, descriptions, pricing)
- Add-ons and pricing
- Availability calendars
- Blackout dates

**Business Impact:**

- Tenant A's customers see Tenant B's packages and pricing
- Booking widget shows wrong packages
- Pricing information leaked between competitors
- Compliance violations (data isolation requirements)

## Proof of Concept

Run the test script to verify the vulnerability:

```bash
# Terminal 1: Start the server
npm run dev

# Terminal 2: Run the test
npx ts-node test-cache-isolation.ts
```

**Expected output:**

```
🔥 CRITICAL BUG DETECTED:
   Tenant B received Tenant A's cached data!
   This is a SECURITY VULNERABILITY - cross-tenant data leakage.

🔥 CACHE LEAK CONFIRMED:
   Tenant B request was a cache HIT (should be MISS)
   Tenant B is receiving cached data from another tenant!
```

## Recommended Fix

### Option 1: Remove HTTP-Level Caching (RECOMMENDED)

**Rationale:**

- Application-level cache already includes tenantId
- Duplicate caching adds complexity without benefit
- Simpler architecture = fewer security bugs

**Changes Required:**

```typescript
// src/app.ts - REMOVE these lines:
app.use('/v1/packages', cacheMiddleware({ ttl: 300 }));
app.use('/v1/availability', cacheMiddleware({ ttl: 120 }));
```

**Pros:**

- Eliminates vulnerability completely
- Reduces code complexity
- Application-level cache is already sufficient
- No middleware ordering issues

**Cons:**

- None (application cache already handles caching correctly)

### Option 2: Fix HTTP Cache to Include TenantId

**Rationale:**

- Keep HTTP caching but fix the key generator
- Requires extracting tenantId from header

**Changes Required:**

```typescript
// src/app.ts - Update cache middleware configuration
app.use(
  '/v1/packages',
  cacheMiddleware({
    ttl: 300,
    keyGenerator: (req: Request) => {
      // Extract tenant key from header
      const tenantKey = req.headers['x-tenant-key'] || 'unknown';
      return `${req.method}:${req.path}:${JSON.stringify(req.query)}:${tenantKey}`;
    },
  })
);
```

**Pros:**

- Keeps HTTP-level caching
- Fixes the security issue

**Cons:**

- Duplicate caching still exists (two layers)
- More complex cache invalidation
- Tenant middleware runs anyway (HTTP cache doesn't save much)
- Cache keys are longer (includes full API key)

### Option 3: Hybrid Approach

**Rationale:**

- Remove HTTP cache for tenant-specific routes
- Keep HTTP cache for truly public routes (health, docs)

**Changes Required:**

```typescript
// src/app.ts - Remove cache from tenant routes
// DELETE:
// app.use('/v1/packages', cacheMiddleware({ ttl: 300 }));
// app.use('/v1/availability', cacheMiddleware({ ttl: 120 }));

// KEEP cache for public routes (if any exist):
app.use('/v1/public-catalog', cacheMiddleware({ ttl: 600 }));
```

## Implementation Plan

### Recommended: Option 1 (Remove HTTP Cache)

**Step 1: Remove HTTP Cache Middleware**

```typescript
// src/app.ts
// REMOVE lines 81-86:
-app.use('/v1/packages', cacheMiddleware({ ttl: 300 }));
-app.use('/v1/availability', cacheMiddleware({ ttl: 120 }));
```

**Step 2: Verify Application Cache Still Works**

- Application cache in `catalog.service.ts` already has correct tenant isolation
- No changes needed to service layer

**Step 3: Update Tests**

- Remove any tests expecting `X-Cache: HIT` header
- Update cache testing to use application cache stats

**Step 4: Deploy and Monitor**

- Deploy to staging
- Run `test-cache-isolation.ts` to verify fix
- Monitor cache hit rates from application cache
- Verify no performance degradation

## Verification Steps

After implementing the fix:

1. **Run Test Script:**

   ```bash
   npx ts-node test-cache-isolation.ts
   ```

   Expected: ✅ Cache isolation working correctly

2. **Manual Testing:**

   ```bash
   # Request as Tenant A
   curl -H "X-Tenant-Key: pk_live_tenant_alice" http://localhost:3000/v1/packages

   # Request as Tenant B (should get different data)
   curl -H "X-Tenant-Key: pk_live_tenant_bob" http://localhost:3000/v1/packages
   ```

3. **Check Cache Headers:**
   - Responses should NOT have `X-Cache: HIT` header
   - Application-level cache still works (check logs)

4. **Performance Testing:**
   - Verify response times are still acceptable
   - Application cache should provide sufficient performance

## Additional Findings

### Browser/CDN Caching

Checked for HTTP cache headers that could cause browser caching:

**Status:** NOT FOUND - No cache-control headers are being set.

The application does NOT set any of these headers:

- `Cache-Control`
- `ETag`
- `Last-Modified`
- `Expires`

**Recommendation:** This is CORRECT for multi-tenant data. Do NOT add browser caching for tenant-specific endpoints.

### Cache Statistics

Both cache layers provide statistics:

```typescript
// Application-level cache (src/lib/cache.ts)
cacheService.getStats(); // Returns hits, misses, hitRate

// HTTP-level cache (src/middleware/cache.ts)
getCacheStats(); // Returns cache statistics
```

After removing HTTP cache, use application cache stats for monitoring.

## Conclusion

The application has a **critical security vulnerability** where HTTP-level caching does not respect tenant isolation. Two tenants making identical requests receive identical cached responses, leaking data across tenant boundaries.

**Recommended Solution:** Remove HTTP-level caching entirely (Option 1). The application-level cache already provides correct tenant isolation and sufficient performance.

**Priority:** IMMEDIATE - This is a P0 security issue affecting data isolation.

## References

**Vulnerable Files:**

- `/src/middleware/cache.ts` - HTTP cache without tenant isolation
- `/src/app.ts` - Global cache middleware application

**Secure Files:**

- `/src/lib/cache.ts` - Application cache (tenant-isolated)
- `/src/services/catalog.service.ts` - Correct cache key usage

**Test Files:**

- `/test-cache-isolation.ts` - Proof of concept test
