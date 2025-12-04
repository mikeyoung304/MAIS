---
status: complete
priority: p1
issue_id: '025'
tags: [code-review, architecture, performance, database]
dependencies: []
---

# Multiple PrismaClient Instantiations - Resource Leak Risk

## Problem Statement

Multiple independent `PrismaClient` instances are created in route files and router setup, violating the singleton pattern. This can exhaust database connection pools, especially in serverless environments.

**Why this matters:** Each PrismaClient creates its own connection pool (default: 20 connections). Multiple instances can exhaust PostgreSQL's max connection limit (100) and cause memory leaks.

## Findings

### Problematic Pattern

**Multiple instantiations found:**

- `server/src/routes/admin/tenants.routes.ts:20` - `const prisma = new PrismaClient();`
- `server/src/routes/admin/stripe.routes.ts` - `const prisma = new PrismaClient();`
- `server/src/routes/index.ts:67` - `const prisma = new PrismaClient();`

### Current DI Container

`server/src/di.ts` already creates a singleton:

```typescript
const prisma = new PrismaClient();
// ... used for adapters
```

But routes bypass this and create their own instances.

### Impact

- Each instance = 20 connection pool
- 3+ instances = 60+ connections before any requests
- Serverless cold starts multiply this
- Connection pool contention under load
- Memory leak as old instances never disconnected

## Proposed Solutions

### Option A: Inject Singleton from DI Container (Recommended)

**Effort:** Medium | **Risk:** Low

1. Export prisma from DI container:

```typescript
// di.ts
export const container = {
  prisma,  // Single instance
  ...
};
```

2. Update route factories to accept prisma:

```typescript
// routes/admin/tenants.routes.ts
export function createTenantsRouter(prisma: PrismaClient) {
  // Use injected instance
}
```

3. Wire in index.ts:

```typescript
import { container } from '../di';
const tenantsRouter = createTenantsRouter(container.prisma);
```

**Pros:**

- Single connection pool
- Consistent with DI pattern
- Testable (can inject mock)

**Cons:**

- Requires refactoring route factories

### Option B: Global Singleton Module

**Effort:** Small | **Risk:** Low

Create `server/src/lib/prisma.ts`:

```typescript
import { PrismaClient } from '@prisma/client';
export const prisma = new PrismaClient();
```

All files import from this module.

**Pros:**

- Minimal code changes
- Node.js module caching ensures singleton

**Cons:**

- Less explicit than DI
- Harder to test

## Recommended Action

Implement **Option A** for consistency with existing DI architecture.

## Technical Details

**Files to Update:**

- `server/src/di.ts` - Export prisma instance
- `server/src/routes/admin/tenants.routes.ts` - Remove local PrismaClient, accept as param
- `server/src/routes/admin/stripe.routes.ts` - Remove local PrismaClient, accept as param
- `server/src/routes/index.ts` - Remove local PrismaClient, use from DI

**Verification:**

```typescript
// In tests
const originalInstances = process.env.PRISMA_INSTANCES;
// After server start
expect(Number(process.env.PRISMA_INSTANCES)).toBe(1);
```

## Acceptance Criteria

- [ ] Single PrismaClient instance in entire application
- [ ] All routes use injected/shared instance
- [ ] Graceful shutdown disconnects the single instance
- [ ] No new `new PrismaClient()` in route files
- [ ] Tests pass with mock prisma injection

## Work Log

| Date       | Action  | Notes                                  |
| ---------- | ------- | -------------------------------------- |
| 2025-11-27 | Created | Found during comprehensive code review |

## Resources

- Architecture Strategist analysis
- Prisma connection management docs
- PostgreSQL max_connections = 100 default
