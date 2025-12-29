# feat: Implement Best Practices for Test Data Isolation

**Type:** Enhancement
**Priority:** P0
**Complexity:** High
**Estimated Phases:** 5

---

## Overview

Implement industry-standard test data isolation to prevent test tenants from polluting the development database. Currently, **84% of tenants (64/76)** are test data visible in the admin dashboard, causing confusion, incorrect metrics, and potential security concerns.

This plan establishes a comprehensive, multi-layered approach following patterns from Stripe, Vercel, and other enterprise SaaS platforms.

---

## Problem Statement

### Current State

| Metric                   | Value           | Impact              |
| ------------------------ | --------------- | ------------------- |
| Total tenants            | 76              | -                   |
| Test tenants             | 64 (84%)        | Dashboard pollution |
| Real tenants             | 12 (16%)        | Hidden in noise     |
| Cleanup pattern coverage | ~40%            | Orphaned test data  |
| Test database            | Shared with dev | Data leakage risk   |

### Root Causes

1. **No test tenant marker** - No `isTestTenant` flag in schema to identify test data
2. **Incomplete cleanup patterns** - `vitest-global-setup.ts` misses many naming conventions
3. **Shared database** - Tests run against same database as admin dashboard
4. **E2E isolation gap** - Playwright tests don't use Vitest's global setup
5. **No transaction isolation** - Integration tests commit data to shared database

### Business Impact

- Admin dashboard shows misleading metrics (76 tenants vs 12 real)
- Platform revenue stats include $0 from test tenants
- Developers waste time distinguishing test from real data
- Security risk: test API keys stored alongside production keys

---

## Proposed Solution

A 5-phase implementation following enterprise best practices:

```
Phase 1: Schema Foundation     → isTestTenant flag + migration
Phase 2: UI Filtering          → Admin dashboard hides test tenants
Phase 3: Test Infrastructure   → Separate DATABASE_URL_TEST
Phase 4: Transaction Isolation → Rollback-based test isolation
Phase 5: CI/CD Hardening       → Testcontainers for ephemeral DBs
```

---

## Technical Approach

### Architecture

```mermaid
graph TB
    subgraph "Current State"
        A[Dev Database] --> B[Admin Dashboard]
        A --> C[Integration Tests]
        A --> D[E2E Tests]
        A --> E[Unit Tests with Mocks]
    end

    subgraph "Target State"
        F[Production DB] --> G[Admin Dashboard]
        H[Test DB] --> I[Integration Tests]
        J[Ephemeral Container] --> K[E2E Tests in CI]
        L[In-Memory Mocks] --> M[Unit Tests]

        G -.->|"Toggle"| N[Show Test Tenants]
    end
```

### Database Schema Changes

```mermaid
erDiagram
    Tenant {
        string id PK
        string slug UK
        string name
        string email
        boolean isTestTenant "NEW: Default false"
        string testRunId "NEW: Optional, for cleanup"
        datetime createdAt
    }
```

---

## Implementation Phases

### Phase 1: Schema Foundation

**Goal:** Add explicit test tenant identification to the database schema.

#### Tasks

- [ ] **1.1 Add `isTestTenant` flag to Tenant model**
  - File: `server/prisma/schema.prisma`
  - Add: `isTestTenant Boolean @default(false) @map("is_test_tenant")`
  - Add: `@@index([isTestTenant])` for query performance

- [ ] **1.2 Add optional `testRunId` for cleanup association**
  - File: `server/prisma/schema.prisma`
  - Add: `testRunId String? @map("test_run_id")`
  - Purpose: Link test tenants to specific test runs for targeted cleanup

- [ ] **1.3 Create migration**
  - Command: `npx prisma migrate dev --name add_test_tenant_flag`
  - Verify: Migration creates index on `is_test_tenant`

- [ ] **1.4 Backfill existing test tenants**
  - Create: `server/prisma/migrations/backfill-test-tenants.sql`
  - Logic: Identify test tenants by slug/email/name patterns

#### Backfill Migration SQL

```sql
-- server/prisma/migrations/XX_backfill_test_tenants.sql
-- Idempotent backfill of isTestTenant flag

UPDATE "Tenant"
SET is_test_tenant = true
WHERE is_test_tenant = false
  AND (
    -- Slug patterns
    slug LIKE 'test-%'
    OR slug LIKE 'e2e-%'
    OR slug LIKE '%-test-%'
    OR slug LIKE 'hash-test-%'
    OR slug LIKE 'first-business-%'
    OR slug LIKE 'no-match-test-%'
    OR slug LIKE '%-tenant-a'
    OR slug LIKE '%-tenant-b'
    OR slug LIKE 'auth-prevention-%'
    OR slug LIKE 'consistency-test-%'
    OR slug LIKE 'forgot-test-%'
    OR slug LIKE 'whitespace-test-%'
    OR slug LIKE 'route-dup-test-%'
    OR slug LIKE 'auth-case-test-%'
    OR slug LIKE 'file-sink-test-%'
    OR slug LIKE 'notification-test-%'
    OR slug LIKE 'cancellation-flow-%'
    OR slug LIKE 'payment-flow-%'
    -- Email patterns
    OR email LIKE '%@example.com'
    OR email LIKE '%@test.com'
    -- Name patterns
    OR name LIKE 'E2E Test%'
    OR name LIKE 'Test %'
    OR name LIKE '%Test Tenant%'
  )
  -- Safety: Never flag protected tenants
  AND slug NOT IN (
    'mais',
    'handled',
    'little-bit-farm',
    'la-petit-mariage',
    'macon-headshots',
    'plate'
  );
```

#### Success Criteria

- [ ] `isTestTenant` column exists with default `false`
- [ ] Index on `isTestTenant` for query performance
- [ ] Backfill correctly identifies 64 test tenants
- [ ] Protected tenants remain `isTestTenant = false`

---

### Phase 2: UI Filtering

**Goal:** Filter test tenants from admin dashboard by default, with toggle to show.

#### Tasks

- [ ] **2.1 Update `PrismaTenantRepository.listWithStats()`**
  - File: `server/src/adapters/prisma/tenant.repository.ts`
  - Add: `includeTestTenants?: boolean` parameter
  - Default: Filter out `isTestTenant = true`

- [ ] **2.2 Update `PlatformAdminController.getAllTenants()`**
  - File: `server/src/controllers/platform-admin.controller.ts`
  - Add: Query parameter `?includeTest=true`
  - Pass through to repository

- [ ] **2.3 Update platform stats aggregation**
  - File: `server/src/controllers/platform-admin.controller.ts`
  - Filter: `WHERE isTestTenant = false` for stats
  - Return: `totalTenants`, `totalTestTenants` separately

- [ ] **2.4 Add UI toggle to admin dashboard**
  - File: `client/src/pages/admin/AdminDashboard.tsx`
  - Add: "Show test tenants" toggle (off by default)
  - Add: Badge showing "(X test tenants hidden)"

- [ ] **2.5 Update API contract**
  - File: `packages/contracts/src/admin.ts`
  - Add: `includeTestTenants` query param to schema
  - Add: `totalTestTenants` to stats response

#### Repository Implementation

```typescript
// server/src/adapters/prisma/tenant.repository.ts

async listWithStats(options: {
  includeTestTenants?: boolean;
} = {}): Promise<TenantWithStats[]> {
  const { includeTestTenants = false } = options;

  return this.prisma.tenant.findMany({
    where: includeTestTenants ? undefined : { isTestTenant: false },
    include: {
      _count: {
        select: {
          packages: true,
          bookings: true,
        },
      },
    },
    orderBy: { createdAt: 'desc' },
  });
}
```

#### Success Criteria

- [ ] Admin dashboard shows only 12 real tenants by default
- [ ] Toggle reveals all 76 tenants when enabled
- [ ] Platform stats exclude test tenant metrics
- [ ] API contract updated with proper types

---

### Phase 3: Test Infrastructure

**Goal:** Separate test database from development database.

#### Tasks

- [ ] **3.1 Create Supabase test project**
  - Action: Create new project `mais-test` in Supabase
  - Configure: Same schema, separate data
  - Document: Connection strings in README

- [ ] **3.2 Add `DATABASE_URL_TEST` to environment**
  - File: `server/.env.example`
  - File: `server/.env` (local)
  - File: GitHub Secrets (CI)

- [ ] **3.3 Update `global-prisma.ts` to prefer test URL**
  - File: `server/test/helpers/global-prisma.ts`
  - Logic: Use `DATABASE_URL_TEST` when running tests
  - Fallback: `DATABASE_URL` if not set

- [ ] **3.4 Update vitest.config.ts**
  - File: `server/vitest.config.ts`
  - Add: `env.DATABASE_URL` override to use test URL

- [ ] **3.5 Update E2E playwright.config.ts**
  - File: `e2e/playwright.config.ts`
  - Add: `DATABASE_URL_TEST` to webServer env

- [ ] **3.6 Create test database seed script**
  - File: `server/prisma/seeds/test-baseline.ts`
  - Purpose: Minimal baseline data for integration tests

#### Environment Configuration

```bash
# server/.env.example

# Test Database (Supabase test project - separate from dev)
# Create at: https://supabase.com/dashboard/new
DATABASE_URL_TEST=postgresql://postgres.[PROJECT_REF]:[PASSWORD]@aws-1-us-east-2.pooler.supabase.com:5432/postgres?pgbouncer=true

# When running tests, this URL is used instead of DATABASE_URL
# This ensures test data never pollutes your development database
```

#### Global Prisma Update

```typescript
// server/test/helpers/global-prisma.ts

function getTestDatabaseUrl(): string {
  // Prefer explicit test database
  if (process.env.DATABASE_URL_TEST) {
    return addPoolingParams(process.env.DATABASE_URL_TEST);
  }

  // Fallback to main database (legacy behavior)
  if (process.env.DATABASE_URL) {
    console.warn('[TEST] Using DATABASE_URL - consider setting DATABASE_URL_TEST');
    return addPoolingParams(process.env.DATABASE_URL);
  }

  throw new Error('No database URL configured for tests');
}
```

#### Success Criteria

- [ ] Supabase test project created and configured
- [ ] Tests use separate database when `DATABASE_URL_TEST` is set
- [ ] Warning logged when falling back to main database
- [ ] E2E tests also use test database
- [ ] CI uses test database via GitHub Secrets

---

### Phase 4: Transaction Isolation

**Goal:** Implement transaction-based isolation for integration tests to prevent data persistence.

#### Tasks

- [ ] **4.1 Create transaction isolation utility**
  - File: `server/test/helpers/transaction-isolation.ts`
  - Pattern: Wrap test in transaction, rollback after assertions

- [ ] **4.2 Create test fixture with automatic rollback**
  - File: `server/test/helpers/isolated-test.ts`
  - Export: `isolatedTest` function that wraps describe/test

- [ ] **4.3 Update integration test setup**
  - File: `server/test/helpers/integration-setup.ts`
  - Add: `withIsolation` option to `setupCompleteIntegrationTest()`

- [ ] **4.4 Migrate existing integration tests**
  - Files: `server/test/integration/*.spec.ts`
  - Update: Use new isolation pattern
  - Verify: Tests still pass

- [ ] **4.5 Document isolation patterns**
  - File: `docs/guides/TESTING.md`
  - Add: Section on transaction isolation

#### Transaction Isolation Utility

````typescript
// server/test/helpers/transaction-isolation.ts

import { PrismaClient } from '../../src/generated/prisma';
import { getTestPrisma } from './global-prisma';

/**
 * Signals that transaction should rollback (not an error)
 */
class RollbackSignal<T> extends Error {
  constructor(public readonly result: T) {
    super('RollbackSignal');
    this.name = 'RollbackSignal';
  }
}

/**
 * Run a test function within an isolated transaction that rolls back.
 *
 * This ensures test data never persists to the database, providing
 * perfect isolation between tests without cleanup overhead.
 *
 * @example
 * ```typescript
 * it('creates a booking', async () => {
 *   await withIsolatedTransaction(async (tx) => {
 *     const booking = await bookingRepo.create(tx, tenantId, data);
 *     expect(booking.id).toBeDefined();
 *     // Data is rolled back after test - no cleanup needed
 *   });
 * });
 * ```
 */
export async function withIsolatedTransaction<T>(fn: (tx: PrismaClient) => Promise<T>): Promise<T> {
  const prisma = getTestPrisma();

  try {
    return await prisma.$transaction(
      async (tx) => {
        const result = await fn(tx as unknown as PrismaClient);
        // Force rollback by throwing after successful execution
        throw new RollbackSignal(result);
      },
      {
        timeout: 30000,
        isolationLevel: 'Serializable',
      }
    );
  } catch (e) {
    if (e instanceof RollbackSignal) {
      return e.result;
    }
    throw e;
  }
}

/**
 * Create an isolated test context with transaction-based cleanup.
 *
 * @example
 * ```typescript
 * describe('BookingService', () => {
 *   const { getIsolatedContext } = createIsolatedTestContext('booking-service');
 *
 *   it('creates booking', async () => {
 *     const { prisma, tenantId } = await getIsolatedContext();
 *     // ... test code - automatically rolled back
 *   });
 * });
 * ```
 */
export function createIsolatedTestContext(testSlug: string) {
  return {
    async getIsolatedContext() {
      // Implementation with tenant creation inside transaction
    },
  };
}
````

#### Success Criteria

- [ ] Transaction isolation utility created and tested
- [ ] At least 3 integration tests migrated to new pattern
- [ ] No residual test data after transaction-isolated tests
- [ ] Performance overhead < 25% vs current approach
- [ ] Documentation updated with examples

---

### Phase 5: CI/CD Hardening

**Goal:** Implement Testcontainers for ephemeral databases in CI/CD.

#### Tasks

- [ ] **5.1 Add testcontainers dependency**
  - File: `server/package.json`
  - Add: `@testcontainers/postgresql: ^10.0.0`

- [ ] **5.2 Create CI-specific global setup**
  - File: `server/test/helpers/testcontainers-setup.ts`
  - Logic: Start PostgreSQL container, run migrations

- [ ] **5.3 Update vitest.config.ts for CI**
  - File: `server/vitest.config.ts`
  - Logic: Use testcontainers setup when `CI=true`

- [ ] **5.4 Update GitHub Actions workflow**
  - File: `.github/workflows/test.yml`
  - Add: Docker service for testcontainers
  - Remove: Supabase database dependency in CI

- [ ] **5.5 Update E2E workflow**
  - File: `.github/workflows/e2e.yml`
  - Add: PostgreSQL testcontainer setup

- [ ] **5.6 Add cleanup patterns consolidation**
  - File: `server/test/helpers/test-tenant-patterns.ts`
  - Purpose: Single source of truth for test tenant identification

#### Testcontainers Setup

```typescript
// server/test/helpers/testcontainers-setup.ts

import { PostgreSqlContainer, StartedPostgreSqlContainer } from '@testcontainers/postgresql';
import { execSync } from 'child_process';

let container: StartedPostgreSqlContainer | null = null;

/**
 * Start PostgreSQL testcontainer for CI environment.
 *
 * This provides a completely isolated, ephemeral database for each
 * CI run. The container is destroyed after tests complete.
 */
export async function startTestContainer(): Promise<string> {
  console.log('[testcontainers] Starting PostgreSQL container...');
  const startTime = Date.now();

  container = await new PostgreSqlContainer('postgres:15')
    .withDatabase('mais_test')
    .withUsername('test')
    .withPassword('test')
    .withExposedPorts(5432)
    .withStartupTimeout(60000)
    .start();

  const connectionUri = container.getConnectionUri();
  console.log(`[testcontainers] Container started in ${Date.now() - startTime}ms`);

  // Run migrations
  console.log('[testcontainers] Running Prisma migrations...');
  execSync('npx prisma migrate deploy', {
    env: { ...process.env, DATABASE_URL: connectionUri },
    stdio: 'inherit',
  });

  return connectionUri;
}

export async function stopTestContainer(): Promise<void> {
  if (container) {
    console.log('[testcontainers] Stopping PostgreSQL container...');
    await container.stop();
    container = null;
  }
}
```

#### GitHub Actions Update

```yaml
# .github/workflows/test.yml

name: Test

on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest

    steps:
      - uses: actions/checkout@v4

      - uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'

      - name: Install dependencies
        run: npm ci

      - name: Generate Prisma Client
        run: cd server && npx prisma generate

      - name: Run tests with Testcontainers
        run: npm test
        env:
          CI: true
          # No DATABASE_URL needed - testcontainers provides it
```

#### Consolidated Test Tenant Patterns

```typescript
// server/test/helpers/test-tenant-patterns.ts

/**
 * Single source of truth for identifying test tenants.
 *
 * Use this module in:
 * - vitest-global-setup.ts (pre-test cleanup)
 * - vitest-global-teardown.ts (post-test cleanup)
 * - e2e/global-teardown.ts (E2E cleanup)
 * - platform-admin.controller.ts (UI filtering)
 */

export const TEST_TENANT_PATTERNS = {
  /**
   * Slug patterns that identify test tenants
   */
  slugPatterns: {
    startsWith: [
      'test-',
      'e2e-',
      'hash-test-',
      'first-business-',
      'no-match-test-',
      'auth-prevention-',
      'consistency-test-',
      'forgot-test-',
      'whitespace-test-',
      'route-dup-test-',
      'auth-case-test-',
      'file-sink-test-',
      'notification-test-',
      'cancellation-flow-',
      'payment-flow-',
    ],
    endsWith: ['-tenant-a', '-tenant-b'],
    contains: ['-test-'],
  },

  /**
   * Email patterns that identify test tenants
   */
  emailPatterns: {
    endsWith: ['@example.com', '@test.com'],
  },

  /**
   * Name patterns that identify test tenants
   */
  namePatterns: {
    startsWith: ['Test ', 'E2E Test'],
    contains: ['Test Tenant'],
  },

  /**
   * Protected slugs that should NEVER be deleted
   */
  protectedSlugs: [
    'mais',
    'handled',
    'little-bit-farm',
    'la-petit-mariage',
    'macon-headshots',
    'plate',
  ],
} as const;

/**
 * Build Prisma WHERE clause for finding test tenants
 */
export function buildTestTenantWhereClause() {
  const { slugPatterns, emailPatterns, namePatterns, protectedSlugs } = TEST_TENANT_PATTERNS;

  return {
    OR: [
      // Flag-based (primary mechanism)
      { isTestTenant: true },

      // Slug patterns
      ...slugPatterns.startsWith.map((p) => ({ slug: { startsWith: p } })),
      ...slugPatterns.endsWith.map((p) => ({ slug: { endsWith: p } })),
      ...slugPatterns.contains.map((p) => ({ slug: { contains: p } })),

      // Email patterns
      ...emailPatterns.endsWith.map((p) => ({ email: { endsWith: p } })),

      // Name patterns
      ...namePatterns.startsWith.map((p) => ({ name: { startsWith: p } })),
      ...namePatterns.contains.map((p) => ({ name: { contains: p } })),
    ],
    // Safety: Never match protected tenants
    slug: { notIn: protectedSlugs },
  };
}
```

#### Success Criteria

- [ ] Testcontainers setup works in CI
- [ ] CI tests run against ephemeral PostgreSQL
- [ ] Container startup < 15 seconds
- [ ] No persistent data between CI runs
- [ ] Test tenant patterns consolidated to single file
- [ ] All cleanup utilities use consolidated patterns

---

## Alternative Approaches Considered

### 1. Schema-per-Test Isolation

**Approach:** Create PostgreSQL schema per test file, drop after.

**Rejected because:**

- Prisma doesn't support dynamic schema switching easily
- Supabase schema management complexity
- Higher migration overhead

### 2. In-Memory SQLite for Tests

**Approach:** Use SQLite in-memory database for all tests.

**Rejected because:**

- PostgreSQL-specific features (advisory locks, JSONB) not supported
- Schema drift between SQLite and PostgreSQL
- Already have mock mode for unit tests

### 3. Database Snapshots

**Approach:** Snapshot clean database, restore before each test.

**Rejected because:**

- Supabase doesn't support point-in-time restore for free tier
- Slow restoration time
- Complex automation

---

## Acceptance Criteria

### Functional Requirements

- [ ] Test tenants have explicit `isTestTenant = true` flag
- [ ] Admin dashboard hides test tenants by default
- [ ] Toggle available to show all tenants
- [ ] Platform stats exclude test tenant metrics
- [ ] Tests use separate database (local and CI)
- [ ] Transaction isolation prevents data persistence
- [ ] CI uses ephemeral PostgreSQL containers

### Non-Functional Requirements

- [ ] Test execution time increase < 25%
- [ ] Container startup < 15 seconds
- [ ] Zero test data in production database
- [ ] Cleanup patterns catch 100% of test tenants
- [ ] Protected tenants never deleted

### Quality Gates

- [ ] All existing tests pass with new isolation
- [ ] No TypeScript errors introduced
- [ ] Documentation updated (TESTING.md, CLAUDE.md)
- [ ] Prevention strategy added to `docs/solutions/`
- [ ] Code review approval from team

---

## Success Metrics

| Metric                   | Current | Target | Measurement                      |
| ------------------------ | ------- | ------ | -------------------------------- |
| Test tenants in dev DB   | 64      | 0      | Database query                   |
| Admin dashboard accuracy | 16%     | 100%   | Real tenants / shown tenants     |
| Test pollution rate      | 84%     | 0%     | Test tenants / total tenants     |
| CI database persistence  | 100%    | 0%     | Data between runs                |
| Cleanup pattern coverage | ~40%    | 100%   | Identified / actual test tenants |

---

## Dependencies & Prerequisites

### Technical Dependencies

- [ ] Supabase test project (requires account access)
- [ ] Docker available in CI (GitHub Actions standard runners have it)
- [ ] `@testcontainers/postgresql` package

### Team Dependencies

- [ ] Review and approval of schema changes
- [ ] CI/CD workflow modification approval
- [ ] Documentation review

### External Dependencies

- None (all services already in use)

---

## Risk Analysis & Mitigation

| Risk                            | Likelihood | Impact   | Mitigation                                     |
| ------------------------------- | ---------- | -------- | ---------------------------------------------- |
| Migration breaks existing tests | Medium     | High     | Run full test suite before merging             |
| Testcontainers slow in CI       | Low        | Medium   | Cache Docker images, parallel setup            |
| Backfill misses real tenants    | Low        | Critical | Manual review of flagged tenants before commit |
| Transaction isolation deadlocks | Medium     | Medium   | Timeout configuration, retry logic             |
| Supabase test project cost      | Low        | Low      | Free tier sufficient for test workload         |

---

## Resource Requirements

### Time Estimate

| Phase                          | Estimated Time  |
| ------------------------------ | --------------- |
| Phase 1: Schema Foundation     | 2-3 hours       |
| Phase 2: UI Filtering          | 3-4 hours       |
| Phase 3: Test Infrastructure   | 4-6 hours       |
| Phase 4: Transaction Isolation | 4-6 hours       |
| Phase 5: CI/CD Hardening       | 4-6 hours       |
| **Total**                      | **17-25 hours** |

### Infrastructure

- Supabase test project (free tier)
- GitHub Actions minutes (existing allocation)
- No additional infrastructure required

---

## Future Considerations

### Extensibility

1. **Database branching** - Neon.tech integration for preview environments
2. **Parallel test execution** - With separate database, can enable `fileParallelism`
3. **Test data factories** - Fishery/FactoryJS for consistent test data generation
4. **Snapshot testing** - Database state snapshots for complex scenarios

### Long-Term Vision

1. **Production data masking** - Copy production schema to test with anonymized data
2. **Chaos testing** - Inject failures to test resilience
3. **Performance testing** - Dedicated performance test database with realistic volume

---

## Documentation Plan

### Files to Update

- [ ] `docs/guides/TESTING.md` - Add test isolation section
- [ ] `CLAUDE.md` - Add test database configuration
- [ ] `server/.env.example` - Add `DATABASE_URL_TEST`
- [ ] `README.md` - Update development setup

### New Files to Create

- [ ] `docs/solutions/test-data-isolation/TEST_DATA_ISOLATION_GUIDE.md`
- [ ] `docs/solutions/test-data-isolation/TEST_TENANT_CONVENTIONS.md`

---

## References & Research

### Internal References

- `server/test/helpers/vitest-global-setup.ts` - Current cleanup patterns
- `server/test/helpers/integration-setup.ts` - Multi-tenant test setup
- `server/test/helpers/global-prisma.ts` - Singleton Prisma client
- `e2e/global-teardown.ts` - E2E cleanup patterns
- `server/prisma/schema.prisma` - Current Tenant model

### External References

- [Testcontainers for Node.js](https://node.testcontainers.org/)
- [Prisma Testing Guide](https://www.prisma.io/docs/orm/prisma-client/testing/integration-testing)
- [Vitest Global Setup](https://vitest.dev/config/#globalsetup)
- [Playwright Test Fixtures](https://playwright.dev/docs/test-fixtures)
- [PostgreSQL Transaction Isolation](https://www.postgresql.org/docs/current/transaction-iso.html)

### Related Work

- ADR-013: Advisory Locks for Booking
- Prevention Strategy: Schema Drift Prevention
- TESTING.md: Current test documentation

---

## Checklist Summary

```
Phase 1: Schema Foundation
  [ ] Add isTestTenant flag to Tenant model
  [ ] Add testRunId field for cleanup association
  [ ] Create and apply migration
  [ ] Backfill existing test tenants

Phase 2: UI Filtering
  [ ] Update repository with filter option
  [ ] Update controller with query param
  [ ] Update platform stats
  [ ] Add UI toggle
  [ ] Update API contract

Phase 3: Test Infrastructure
  [ ] Create Supabase test project
  [ ] Add DATABASE_URL_TEST to environments
  [ ] Update global-prisma.ts
  [ ] Update vitest.config.ts
  [ ] Update playwright.config.ts
  [ ] Create test baseline seed

Phase 4: Transaction Isolation
  [ ] Create transaction isolation utility
  [ ] Create isolated test fixture
  [ ] Update integration-setup.ts
  [ ] Migrate integration tests
  [ ] Document patterns

Phase 5: CI/CD Hardening
  [ ] Add testcontainers dependency
  [ ] Create CI-specific setup
  [ ] Update vitest.config.ts for CI
  [ ] Update GitHub Actions
  [ ] Consolidate cleanup patterns
```

---

_Plan created: 2025-12-29_
_Author: Claude Code with multi-agent research_
