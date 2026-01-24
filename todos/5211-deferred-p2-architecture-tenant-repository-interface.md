---
status: deferred
priority: p2
issue_id: '5211'
tags: [code-review, architecture, di, ports-adapters]
dependencies: []
---

# TenantRepository Lacks Port Interface Abstraction

## Problem Statement

`TenantRepository` is a concrete Prisma implementation without a corresponding port interface. This violates the ports & adapters pattern used elsewhere in the codebase, making it harder to:

- Swap implementations (e.g., for testing)
- Mock in unit tests
- Add caching layer

**Why it matters:** Inconsistent DI patterns lead to testing difficulties and architectural drift.

## Findings

**Location:** `server/src/adapters/prisma/tenant.repository.ts`

**Current Pattern:**

```typescript
// Direct concrete class usage
import { TenantRepository } from './adapters/prisma/tenant.repository';
const repo = new TenantRepository(prisma);
```

**Expected Pattern (from other services):**

```typescript
// Port interface in lib/ports.ts
interface ITenantRepository {
  findById(id: string): Promise<Tenant | null>;
  findBySlug(slug: string): Promise<Tenant | null>;
  // ...
}

// Adapter implements port
class PrismaTenantRepository implements ITenantRepository {
  // ...
}
```

**Also Found:** Some code bypasses DI container with direct instantiation

**Reviewer:** Architecture Strategist (AS-001, AS-002)

## Proposed Solutions

### Option A: Add Port Interface (Recommended)

**Pros:** Consistent architecture, better testability
**Cons:** Interface maintenance
**Effort:** Small
**Risk:** Low

```typescript
// server/src/lib/ports.ts
export interface ITenantRepository {
  findById(id: string): Promise<TenantEntity | null>;
  findBySlug(slug: string): Promise<TenantEntity | null>;
  findBySlugPublic(slug: string): Promise<TenantPublicDto | null>;
  listActive(): Promise<TenantEntity[]>;
  // ...
}

// server/src/adapters/prisma/tenant.repository.ts
export class PrismaTenantRepository implements ITenantRepository {
  // existing implementation
}

// server/src/adapters/mock/tenant.repository.ts
export class MockTenantRepository implements ITenantRepository {
  // in-memory implementation for tests
}
```

### Option B: Keep Concrete, Add Factory

**Pros:** Less refactoring
**Cons:** Still couples to Prisma
**Effort:** Small
**Risk:** Medium

## Recommended Action

<!-- Filled during triage -->

## Technical Details

**Affected Files:**

- `server/src/lib/ports.ts` (add interface)
- `server/src/adapters/prisma/tenant.repository.ts` (implement interface)
- `server/src/di.ts` (update bindings)
- Test files that mock TenantRepository

**Existing Ports Pattern:**

```typescript
// From lib/ports.ts
export interface ICalendarAdapter { ... }
export interface IPaymentAdapter { ... }
export interface IEmailAdapter { ... }
```

## Acceptance Criteria

- [ ] ITenantRepository interface defined in ports.ts
- [ ] PrismaTenantRepository implements interface
- [ ] DI container uses interface type
- [ ] MockTenantRepository created for tests
- [ ] All direct instantiations go through DI

## Work Log

| Date       | Action                         | Learnings                                    |
| ---------- | ------------------------------ | -------------------------------------------- |
| 2026-01-24 | Created from /workflows:review | Architecture reviewer found DI inconsistency |

## Resources

- Review: Architecture Strategist
- DI Pattern: `server/src/di.ts`
- Ports: `server/src/lib/ports.ts`
