# MockTenantRepository Pattern for HTTP Testing

## Problem

HTTP tests for internal agent endpoints were failing with 404 errors even when authentication and validation passed. The mock adapter system (`ADAPTERS_PRESET=mock`) didn't include a tenant repository, so any endpoint that looked up tenant data would fail.

**Symptom:** Tests showed `expect(response.status).not.toBe(404)` failures despite correct `X-Internal-Secret` headers and valid request bodies.

**Root Cause:** The dependency injection container in mock mode was missing a `tenantRepo` property, causing routes to instantiate `PrismaTenantRepository` which requires a real database connection.

## Solution

Created `MockTenantRepository` class with seeded test data and wired it through the DI system.

### 1. Mock Repository Implementation

**File:** `server/src/adapters/mock/index.ts`

```typescript
// Interface matching the subset of Tenant fields used by routes
export interface MockTenant {
  id: string;
  slug: string;
  name: string;
  email: string;
  businessName: string | null;
  // ... other fields as needed
}

// In-memory storage
const tenants = new Map<string, MockTenant>();

// Seed function called during adapter initialization
function seedTenants() {
  tenants.clear();
  tenants.set('tenant_default_legacy', {
    id: 'tenant_default_legacy',
    slug: 'test-tenant',
    name: 'Test Tenant',
    email: 'test@example.com',
    businessName: 'Test Business',
    // ...
  });
}

export class MockTenantRepository {
  async findById(id: string): Promise<MockTenant | null> {
    return tenants.get(id) || null;
  }

  async findBySlug(slug: string): Promise<MockTenant | null> {
    return Array.from(tenants.values()).find((t) => t.slug === slug) || null;
  }

  // ... other methods matching PrismaTenantRepository interface
}
```

### 2. DI Container Interface Update

**File:** `server/src/di.ts`

```typescript
export interface Container {
  // ... existing properties
  tenantRepo?: PrismaTenantRepository;
}

// In mock mode:
return {
  // ... other properties
  tenantRepo: adapters.tenantRepo as unknown as PrismaTenantRepository,
};

// In real mode:
return {
  // ... other properties
  tenantRepo,
};
```

### 3. Route Parameter Passthrough

**File:** `server/src/routes/index.ts`

```typescript
export function createV1Router(
  controllers: Controllers,
  identityService: IdentityService,
  app: Application,
  config: Config,
  services: Services,
  mailProvider: IMailProvider,
  prisma: PrismaClient,
  repositories: Repositories,
  cacheAdapter: ICacheAdapter,
  stripeAdapter: IStripeAdapter,
  tenantRepo?: PrismaTenantRepository // NEW: Optional parameter
): void {
  // Use provided repo or fall back to creating one
  const internalTenantRepo = tenantRepo ?? new PrismaTenantRepository(prismaClient);

  // Pass to routes that need it
  createInternalAgentRoutes(internalAgentRouter, config, internalTenantRepo, prismaClient);
}
```

**File:** `server/src/app.ts`

```typescript
createV1Router(
  container.controllers,
  container.services.identity,
  app,
  config,
  {
    /* services */
  },
  container.mailProvider,
  container.prisma,
  container.repositories,
  container.cacheAdapter,
  container.stripeAdapter,
  container.tenantRepo // NEW: Pass from container
);
```

### 4. Test Usage

**File:** `server/test/http/internal-agent-content-generation.http.spec.ts`

```typescript
// Use the default mock tenant ID seeded by MockTenantRepository
const TEST_TENANT_ID = 'tenant_default_legacy';

it('should generate headline for existing tenant', async () => {
  const response = await request(app)
    .post('/v1/internal/agent/content-generation/generate-headline')
    .set('X-Internal-Secret', TEST_SECRET)
    .send({
      tenantId: TEST_TENANT_ID,
      context: 'homepage hero section',
    });

  // With mock tenant, should pass auth + validation + tenant lookup
  expect(response.status).not.toBe(404);
  expect(response.status).not.toBe(403);
  expect(response.status).not.toBe(400);
});
```

## Key Insights

### Type Compatibility

MockTenantRepository doesn't implement the full Prisma model, so we use type casting:

```typescript
tenantRepo: adapters.tenantRepo as unknown as PrismaTenantRepository;
```

This works because routes only use a subset of methods (`findById`, `findBySlug`), and TypeScript's structural typing allows the mock to satisfy those calls at runtime.

### Seeded Data Convention

The `tenant_default_legacy` ID is a convention for tests. Any test needing a valid tenant should use this ID, which is guaranteed to exist when `ADAPTERS_PRESET=mock`.

### Fallback Pattern

Routes use `tenantRepo ?? new PrismaTenantRepository(prismaClient)` to maintain backward compatibility. If no mock repo is provided (e.g., in production), the real repository is created.

## Prevention Checklist

When adding new endpoints that access tenant data:

- [ ] Ensure the required repository method exists in MockTenantRepository
- [ ] Use `tenant_default_legacy` as the test tenant ID
- [ ] Test both 404 (invalid tenant) and success (valid tenant) paths
- [ ] Verify DI container passes the repository through all layers

## Related Documentation

- [Mock-First Development Pattern](../test-failures/mock-first-development-pattern.md)
- [Test Isolation Strategies](../test-failures/test-isolation-strategies.md)
- [Dependency Injection Guide](../../architecture/DEPENDENCY_INJECTION.md)

## Files Modified

| File                                | Change                                              |
| ----------------------------------- | --------------------------------------------------- |
| `server/src/adapters/mock/index.ts` | Added MockTenantRepository class and seeded data    |
| `server/src/di.ts`                  | Added tenantRepo to Container interface and returns |
| `server/src/routes/index.ts`        | Added tenantRepo parameter, fallback logic          |
| `server/src/app.ts`                 | Pass container.tenantRepo to createV1Router         |

## Tags

`testing` `mock-adapters` `dependency-injection` `http-testing` `tenant-isolation`
