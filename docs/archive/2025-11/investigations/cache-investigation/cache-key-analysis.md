# Cache Key Generation Analysis

This document shows EXACTLY how cache keys are generated in both caching layers, with evidence from the codebase.

## Layer 1: HTTP Cache Middleware (VULNERABLE)

**File:** `/src/middleware/cache.ts`

### Key Generation Code

```typescript
// Lines 40-45: Default key generator
const keyGenerator =
  options.keyGenerator ||
  ((req: Request) => {
    // Default: use method + path + query string
    return `${req.method}:${req.path}:${JSON.stringify(req.query)}`;
  });
```

### Example Keys Generated

| Tenant   | Request                                | Generated Cache Key                          | Unique? |
| -------- | -------------------------------------- | -------------------------------------------- | ------- |
| Tenant A | `GET /v1/packages`                     | `GET:/v1/packages:{}`                        | ❌ NO   |
| Tenant B | `GET /v1/packages`                     | `GET:/v1/packages:{}`                        | ❌ NO   |
| Tenant A | `GET /v1/packages/intimate`            | `GET:/v1/packages/intimate:{}`               | ❌ NO   |
| Tenant B | `GET /v1/packages/intimate`            | `GET:/v1/packages/intimate:{}`               | ❌ NO   |
| Tenant A | `GET /v1/availability?date=2025-12-25` | `GET:/v1/availability:{"date":"2025-12-25"}` | ❌ NO   |
| Tenant B | `GET /v1/availability?date=2025-12-25` | `GET:/v1/availability:{"date":"2025-12-25"}` | ❌ NO   |

**Result:** All tenants share the same cache keys! 🔥

### Why tenantId is NOT in the Key

**Problem 1: Middleware Execution Order**

```typescript
// src/app.ts

// Step 1: HTTP cache middleware runs FIRST
app.use('/v1/packages', cacheMiddleware({ ttl: 300 }));

// Step 2: Body parsing
app.use(express.json());

// Step 3: Request logging
app.use(requestLogger);

// Step 4: Routes are mounted
createV1Router(controllers, identityService, app);
// Inside createV1Router:
// Step 5: Tenant middleware runs (too late!)
globalMiddleware: [
  (req, res, next) => {
    if (req.path.startsWith('/v1/packages')) {
      tenantMiddleware(req, res, next); // Sets req.tenantId
    }
  },
];
```

When HTTP cache middleware runs, `req.tenantId` doesn't exist yet!

**Problem 2: Cache Key Generated Before Tenant Resolution**

```typescript
// src/middleware/cache.ts, lines 54-76

return (req: Request, res: Response, next: NextFunction): void => {
  if (req.method !== 'GET') {
    next();
    return;
  }

  const key = keyGenerator(req); // ⚠️ Key generated here - no tenantId available!

  const cachedResponse = cache.get<...>(key);

  if (cachedResponse) {
    // Return cached response immediately
    // Tenant middleware NEVER RUNS!
    res.status(cachedResponse.status);
    res.setHeader('X-Cache', 'HIT');
    res.json(cachedResponse.body);
    return; // ⚠️ Early return - rest of middleware chain skipped!
  }

  // Cache miss - continue to tenant middleware
  next();
};
```

## Layer 2: Application Cache (SECURE)

**File:** `/src/lib/cache.ts` (CacheService)
**Usage:** `/src/services/catalog.service.ts`

### Key Generation Code

```typescript
// catalog.service.ts, line 47
const cacheKey = `catalog:${tenantId}:all-packages`;

// catalog.service.ts, line 86
const cacheKey = `catalog:${tenantId}:package:${slug}`;
```

### Example Keys Generated

| Tenant                  | Request                     | Generated Cache Key               | Unique? |
| ----------------------- | --------------------------- | --------------------------------- | ------- |
| Tenant A (ID: `abc123`) | `GET /v1/packages`          | `catalog:abc123:all-packages`     | ✅ YES  |
| Tenant B (ID: `xyz789`) | `GET /v1/packages`          | `catalog:xyz789:all-packages`     | ✅ YES  |
| Tenant A (ID: `abc123`) | `GET /v1/packages/intimate` | `catalog:abc123:package:intimate` | ✅ YES  |
| Tenant B (ID: `xyz789`) | `GET /v1/packages/intimate` | `catalog:xyz789:package:intimate` | ✅ YES  |

**Result:** Each tenant gets unique cache keys! ✅

### Why tenantId IS in the Key

**Request Flow:**

```
1. Request arrives: GET /v1/packages
   Headers: { 'X-Tenant-Key': 'pk_live_tenant_abc' }

2. HTTP Cache Middleware
   → Generates key: "GET:/v1/packages:{}"
   → If HIT: Returns cached data (BUG - could be wrong tenant!)
   → If MISS: Continues to next middleware

3. Tenant Middleware (resolveTenant)
   → Extracts API key from header: 'pk_live_tenant_abc'
   → Queries database: SELECT * FROM tenants WHERE apiKeyPublic = 'pk_live_tenant_abc'
   → Finds tenant: { id: 'abc123', name: 'Alice Photography', ... }
   → Sets: req.tenantId = 'abc123'
   → Sets: req.tenant = { id: 'abc123', ... }

4. Route Handler (packages.routes.ts)
   → Calls: catalogService.getAllPackages(req.tenantId)
   → tenantId = 'abc123'

5. CatalogService.getAllPackages(tenantId)
   → Generates cache key: `catalog:${tenantId}:all-packages`
   → Key = "catalog:abc123:all-packages"
   → Checks cache with this tenant-specific key
   → If HIT: Returns cached data (correct - tenant-specific!)
   → If MISS: Queries database with WHERE tenantId = 'abc123'
```

## Cache Instrumentation

### How to See Cache Keys in Logs

**Application Cache:**

Enable debug logging in development:

```typescript
// src/lib/cache.ts, lines 41-45
logger.debug({ key }, 'Cache HIT');
// Example log:
// {"key":"catalog:abc123:all-packages","msg":"Cache HIT"}

logger.debug({ key }, 'Cache MISS');
// Example log:
// {"key":"catalog:abc123:all-packages","msg":"Cache MISS"}

logger.debug({ key, ttl }, 'Cache SET');
// Example log:
// {"key":"catalog:abc123:all-packages","ttl":900,"msg":"Cache SET"}
```

**HTTP Cache:**

Check response headers:

```bash
curl -v -H "X-Tenant-Key: pk_live_test" http://localhost:3000/v1/packages

# Look for:
# X-Cache: HIT    (response came from HTTP cache)
# X-Cache: MISS   (response went to backend)
```

And check server logs:

```typescript
// src/middleware/cache.ts, lines 60, 79
logger.debug({ key, ttl }, 'Cache hit');
// Example log:
// {"key":"GET:/v1/packages:{}","ttl":300,"msg":"Cache hit"}

logger.debug({ key, ttl }, 'Cache miss');
// Example log:
// {"key":"GET:/v1/packages:{}","ttl":300,"msg":"Cache miss"}
```

## Real-World Example

### Scenario: Two Tenants Request Packages

**Tenant A:** Alice's Photography (ID: `alice_123`)
**Tenant B:** Bob's Weddings (ID: `bob_456`)

**Timeline:**

```
T+0s: Alice's client requests packages
  Request: GET /v1/packages
  Header: X-Tenant-Key: pk_live_alice

  HTTP Cache:
    Key: "GET:/v1/packages:{}"
    Status: MISS
    Action: Continue to backend

  Tenant Middleware:
    Resolves: tenantId = "alice_123"

  App Cache:
    Key: "catalog:alice_123:all-packages"
    Status: MISS
    Action: Query database

  Database:
    Query: SELECT * FROM packages WHERE tenantId = 'alice_123'
    Result: [
      { id: 'pkg1', title: 'Intimate Ceremony', priceCents: 50000 },
      { id: 'pkg2', title: 'Grand Wedding', priceCents: 150000 }
    ]

  App Cache:
    SET "catalog:alice_123:all-packages" = [...] (TTL: 900s)

  HTTP Cache:
    SET "GET:/v1/packages:{}" = [...] (TTL: 300s)

  Response to Alice:
    [
      { id: 'pkg1', title: 'Intimate Ceremony', priceCents: 50000 },
      { id: 'pkg2', title: 'Grand Wedding', priceCents: 150000 }
    ]
    Headers: { X-Cache: MISS }

T+10s: Bob's client requests packages
  Request: GET /v1/packages
  Header: X-Tenant-Key: pk_live_bob

  HTTP Cache:
    Key: "GET:/v1/packages:{}"  ← SAME KEY AS ALICE!
    Status: HIT ← Found Alice's cached data!
    Action: Return cached data immediately

  🔥 BUG: Tenant middleware NEVER RUNS
  🔥 BUG: App cache NEVER CHECKED
  🔥 BUG: Database NEVER QUERIED

  Response to Bob:
    [
      { id: 'pkg1', title: 'Intimate Ceremony', priceCents: 50000 },  ← Alice's package!
      { id: 'pkg2', title: 'Grand Wedding', priceCents: 150000 }      ← Alice's package!
    ]
    Headers: { X-Cache: HIT }

  🔥 SECURITY BREACH: Bob sees Alice's packages and pricing!
```

## Cache Statistics

### Application Cache Stats

```typescript
// Get stats
const stats = cacheService.getStats();

// Example output:
{
  hits: 145,
  misses: 23,
  keys: 15,
  totalRequests: 168,
  hitRate: '86.31%'
}

// Keys in cache (examples):
[
  'catalog:alice_123:all-packages',
  'catalog:alice_123:package:intimate',
  'catalog:bob_456:all-packages',
  'catalog:bob_456:package:grand-wedding',
  'catalog:charlie_789:all-packages',
  ...
]
```

Each tenant has separate cache entries! ✅

### HTTP Cache Stats

```typescript
// Get stats
const stats = getCacheStats();

// Keys in cache (examples):
[
  'GET:/v1/packages:{}',                                    ← Shared by ALL tenants! ❌
  'GET:/v1/packages/intimate:{}',                          ← Shared by ALL tenants! ❌
  'GET:/v1/availability:{"date":"2025-12-25"}',           ← Shared by ALL tenants! ❌
  ...
]
```

All tenants share the same cache entries! ❌

## Conclusion

**HTTP Cache Keys:** Do NOT include tenantId → Cross-tenant data leakage
**App Cache Keys:** DO include tenantId → Tenant-isolated (secure)

**Solution:** Remove HTTP cache, rely on application cache.
