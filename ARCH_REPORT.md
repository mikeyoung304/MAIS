# MAIS Architecture Analysis Report

**Date:** 2025-12-26
**Analyst:** Agent C1 - Architecture & North Star Convergence Auditor
**Reference:** Compound Engineering Plugin Patterns

---

## Executive Summary

MAIS demonstrates a **well-structured modular monolith** with strong multi-tenant isolation patterns. The architecture follows layered principles (routes -> services -> adapters) with clear dependency injection via `server/src/di.ts`. However, several architectural violations and technical debt items require attention.

**Overall Health:** GOOD with improvement opportunities

| Category               | Status     | Priority Issues                    |
| ---------------------- | ---------- | ---------------------------------- |
| Module Boundaries      | Good       | Minor coupling concerns            |
| Layer Discipline       | Needs Work | 12 routes import adapters directly |
| Multi-Tenant Isolation | Excellent  | All queries properly scoped        |
| API Contract Alignment | Good       | Minor contract coverage gaps       |
| North Star Convergence | Moderate   | YAGNI violations, complexity       |

---

## 1. Module Boundary Analysis

### Current Module Structure

```
server/src/
├── routes/          # HTTP layer (thin handlers)
├── services/        # Business logic (domain services)
├── adapters/        # External integrations
│   ├── prisma/      # Database repositories
│   ├── mock/        # In-memory implementations
│   ├── gcal.adapter.ts
│   ├── postmark.adapter.ts
│   └── stripe.adapter.ts
├── lib/             # Shared utilities & interfaces
│   ├── ports.ts     # Repository interfaces (CRITICAL)
│   ├── entities.ts  # Domain models
│   └── core/        # Config, logger, events
├── middleware/      # Express middleware
└── di.ts            # Dependency injection container
```

### Findings

**Strengths:**

- Clear separation of concerns with dedicated directories
- Repository pattern properly abstracts data access
- DI container (`di.ts`) centralizes wiring
- Mock adapters enable testing without external dependencies

**Concerns:**

1. **Controller Pattern Inconsistency**
   - Some routes use controllers (e.g., `packages.routes.ts` -> `PackagesController`)
   - Most routes contain inline business logic
   - Recommendation: Standardize on either thin routes + services OR controllers

2. **Service Dependencies**
   - `upload.service.ts` uses singleton pattern (TODO 065 notes this)
   - File: `/Users/mikeyoung/CODING/MAIS/server/src/services/upload.service.ts:4`

3. **Landing Page Domain Sprawl**
   - Configuration split across:
     - `packages/contracts/src/landing-page.ts`
     - `server/src/services/landing-page.service.ts`
     - `apps/web/src/lib/tenant.ts` (normalizeToPages)
   - Consider consolidating transformation logic

---

## 2. Layer Violation Analysis

### Critical Finding: Routes Importing Adapters Directly

**Severity: P1 (High)**

The following routes bypass the service layer by importing adapter implementations directly:

| File                                | Line  | Import                                             |
| ----------------------------------- | ----- | -------------------------------------------------- |
| `stripe-connect-webhooks.routes.ts` | 17    | `PrismaTenantRepository`                           |
| `auth.routes.ts`                    | 12    | `PrismaTenantRepository`                           |
| `index.ts`                          | 32    | `PrismaTenantRepository, PrismaBlackoutRepository` |
| `public-tenant.routes.ts`           | 19    | `PrismaTenantRepository`                           |
| `admin/stripe.routes.ts`            | 13    | `PrismaTenantRepository`                           |
| `admin/tenants.routes.ts`           | 15    | `PrismaTenantRepository`                           |
| `tenant-admin-calendar.routes.ts`   | 10-11 | `PrismaTenantRepository, TenantCalendarConfig`     |
| `tenant.routes.ts`                  | 7     | `PrismaTenantRepository`                           |
| `tenant-admin-deposits.routes.ts`   | 12    | `PrismaTenantRepository`                           |
| `tenant-admin.routes.ts`            | 23    | `PrismaTenantRepository`                           |
| `dev.routes.ts`                     | 8     | `getMockState, resetMockState`                     |

**Impact:**

- Breaks clean architecture principles
- Makes testing harder (routes depend on concrete implementations)
- Violates Compound Engineering pattern-recognition-specialist guidance

**Recommendation:**

1. Routes should only receive services via DI
2. Create `TenantService` to encapsulate tenant operations
3. Inject repositories into services, not routes

### Direct Prisma Usage in Routes

**Severity: P1 (High)**

File: `/Users/mikeyoung/CODING/MAIS/server/src/routes/tenant-admin.routes.ts:906-915`

```typescript
// Type assertion needed because BlackoutRepository interface doesn't expose prisma
const prismaClient = (blackoutRepo as unknown as { prisma: unknown }).prisma as {...};
const fullBlackouts = await prismaClient.blackoutDate.findMany({
  where: { tenantId },
  orderBy: { date: 'asc' },
  select: { id: true, date: true, reason: true },
});
```

**Issues:**

- Unsafe type casting to access internal Prisma client
- Bypasses repository abstraction
- Leaks implementation details into route layer

**Recommendation:**

- Add `getBlackoutsWithIds(tenantId: string)` to `BlackoutRepository` interface
- Implement in `PrismaBlackoutRepository`

---

## 3. Multi-Tenant Isolation Audit

### Summary: EXCELLENT

Multi-tenant data isolation is properly implemented throughout the codebase.

### Verification Results

1. **Repository Pattern Enforcement**
   - All repository interfaces in `ports.ts` require `tenantId` as first parameter
   - Example: `getPackages(tenantId: string): Promise<Package[]>`
   - 309 occurrences of `tenantId` across 9 adapter files

2. **Query Scoping**
   - All `findMany`, `findFirst`, `findUnique` calls include `tenantId` in WHERE clause
   - No global queries without tenant scoping found (except for admin tenant listing)

3. **Cache Key Isolation**
   - Cache keys properly prefixed with tenant context
   - Example from `catalog.service.ts:416-417`:
     ```typescript
     const cacheKey = `catalog:${tenantId}:segment:${segmentId}:packages`;
     ```

4. **Middleware Protection**
   - `server/src/middleware/tenant.ts` properly validates tenant on each request
   - `resolveTenant()` rejects requests without valid `X-Tenant-Key`
   - Inactive tenants blocked with 403 response

### Positive Patterns Observed

- `cachedOperation()` helper includes tenantId in all keys
- Segment-scoped queries include both `tenantId` AND `segmentId`
- JSDoc comments document multi-tenant requirements

---

## 4. API Contract Alignment

### Contract Coverage Analysis

**Contracts Location:** `packages/contracts/src/`

| Domain           | Contract File                           | Route Implementation                  | Alignment |
| ---------------- | --------------------------------------- | ------------------------------------- | --------- |
| Landing Page     | `tenant-admin/landing-page.contract.ts` | `tenant-admin-landing-page.routes.ts` | Aligned   |
| Packages/Catalog | `dto.ts` (schemas only)                 | `packages.routes.ts`                  | Partial   |
| Booking          | `dto.ts` (schemas only)                 | `bookings.routes.ts`                  | Partial   |
| Auth             | `dto.ts` (schemas only)                 | `auth.routes.ts`                      | Partial   |

### Findings

1. **Missing ts-rest Contract Definitions**
   - Only `landingPageAdminContract` uses full ts-rest router pattern
   - Other routes use raw Express handlers with Zod validation
   - Contracts exist as schemas but not as ts-rest routers

2. **DTO Schema Coverage**
   - Well-defined schemas for Package, Booking, Availability, etc.
   - Error response schemas comprehensive (400-500 codes)
   - Customer name validation with Unicode support

3. **Response Type Alignment**
   - `mapPackageToDto()` mapper ensures entity->DTO transformation
   - Some routes return raw Prisma objects instead of DTOs

### Recommendation

- Extend ts-rest contract pattern to all major domains
- Ensure all route responses go through DTO mappers

---

## 5. North Star Convergence Analysis

### Reference: Compound Engineering Plugin Patterns

Comparing MAIS against the Compound Engineering conventions:

### Pattern Recognition Specialist Findings

| Pattern             | Status     | Notes                                |
| ------------------- | ---------- | ------------------------------------ |
| TODO/FIXME tracking | 50+ TODOs  | See Technical Debt section           |
| Naming conventions  | Consistent | kebab-case files, PascalCase classes |
| Code duplication    | Low        | Good use of shared utilities         |
| Layer separation    | Needs work | Routes importing adapters            |

### Code Simplicity Reviewer Findings

| Concern              | File                         | Issue                                      |
| -------------------- | ---------------------------- | ------------------------------------------ |
| Over-abstraction     | `ports.ts`                   | Some interfaces have single implementation |
| `any` type usage     | 40+ files                    | 1373 occurrences (many in tests)           |
| Complex type casting | `tenant-admin.routes.ts:906` | Unsafe Prisma access                       |

### YAGNI Violations

1. **Unused extensibility points**
   - `CacheServicePort` optional in many services but always provided
   - Audit context system partially implemented

2. **Premature abstractions**
   - Some repository interfaces wrap simple CRUD

### Security Sentinel Findings

**Positive:**

- Rate limiting implemented on auth endpoints
- Input validation via Zod schemas
- XSS prevention in landing page service

**Areas for review:**

- `err: any` catch patterns (e.g., `domain-verification.service.ts:164`)
- Console.log usage in some services (40 occurrences)

### Data Integrity Guardian Findings

**Positive:**

- Advisory locks for double-booking prevention
- Webhook idempotency via database deduplication
- Transaction boundaries for critical operations

---

## 6. Technical Debt Inventory

### High-Priority TODOs

| ID       | File                                     | Description                   |
| -------- | ---------------------------------------- | ----------------------------- |
| TODO-065 | `upload.service.ts:4`                    | Singleton breaks DI pattern   |
| TODO-059 | `scheduling-availability.service.ts:384` | Timezone library alternatives |
| TODO-241 | `landing-page.service.ts:12`             | Architecture consistency      |
| TODO-329 | `public-date-booking.routes.ts`          | Idempotency via header        |
| TODO-278 | Multiple                                 | Custom webhook subscriptions  |

### `any` Type Usage

**Non-test files with `any`:**

- `health-check.service.ts:59,96,170` - Accessing private adapter properties
- `domain-verification.service.ts:164` - Error catch
- `adapters/prisma/tenant.repository.ts` - branding JSON handling

---

## 7. Refactoring Priorities

### P0 (Critical - Fix Immediately)

1. **Extract TenantService**
   - Routes should not import `PrismaTenantRepository` directly
   - Create `TenantService` with tenant CRUD operations
   - Inject via DI container

2. **Fix BlackoutRepository interface leak**
   - Add `getBlackoutsWithIds()` method to interface
   - Remove unsafe type casting in `tenant-admin.routes.ts`

### P1 (High - Next Sprint)

1. **Eliminate direct adapter imports in routes**
   - Audit all 12 files importing from `../adapters`
   - Create appropriate service wrappers
   - Update DI container

2. **Replace console.log with logger**
   - 40 occurrences across source files
   - Use structured logger from `lib/core/logger`

3. **Reduce `any` types in production code**
   - Create proper interfaces for adapter internals accessed by health check
   - Use unknown + type guards instead of `err: any`

### P2 (Medium - Backlog)

1. **Standardize controller pattern**
   - Decide: thin routes + services OR controllers
   - Apply consistently across all route files

2. **Expand ts-rest contract coverage**
   - Add contracts for booking, catalog, availability
   - Generate client types from contracts

3. **Consolidate landing page transformation logic**
   - Single source of truth for legacy->pages migration
   - Share between server and Next.js

4. **Address singleton in upload service**
   - Refactor to DI pattern
   - Enable proper testing

---

## 8. Next.js Architecture Review

### Positive Patterns

- **Error boundaries:** 29 error.tsx files covering all dynamic routes
- **Loading states:** 18 loading.tsx files for suspense
- **React cache():** Properly used in `getTenantBySlug`, `getTenantStorefrontData`
- **Type-safe API client:** Uses ts-rest contracts

### Areas for Improvement

1. **Missing loading states in protected routes**
   - `(protected)/tenant/*` pages need loading.tsx files

2. **Domain validation**
   - Good: `validateDomain()` function with proper checks
   - TODO at line 285: Implement domain lookup endpoint

---

## 9. Recommended Architecture Roadmap

### Phase 1: Clean Architecture Compliance (1 week)

- [ ] Create TenantService
- [ ] Fix BlackoutRepository interface
- [ ] Update DI container
- [ ] Remove direct adapter imports from routes

### Phase 2: Type Safety Improvements (1 week)

- [ ] Audit and fix `any` usage
- [ ] Replace console.log with logger
- [ ] Add health check adapter interfaces

### Phase 3: Contract Expansion (2 weeks)

- [ ] Add booking contract
- [ ] Add catalog contract
- [ ] Add availability contract
- [ ] Generate client types

### Phase 4: Documentation & Standards (Ongoing)

- [ ] Document architecture decisions as ADRs
- [ ] Create contribution guidelines
- [ ] Establish code review checklist

---

## Appendix: File References

### Key Architecture Files

| File                                                           | Purpose                        |
| -------------------------------------------------------------- | ------------------------------ |
| `/Users/mikeyoung/CODING/MAIS/server/src/di.ts`                | Dependency injection container |
| `/Users/mikeyoung/CODING/MAIS/server/src/lib/ports.ts`         | Repository interfaces          |
| `/Users/mikeyoung/CODING/MAIS/server/src/lib/entities.ts`      | Domain models                  |
| `/Users/mikeyoung/CODING/MAIS/server/src/middleware/tenant.ts` | Multi-tenant resolution        |
| `/Users/mikeyoung/CODING/MAIS/packages/contracts/src/index.ts` | API contracts                  |

### Files Requiring Immediate Attention

| File                                                                     | Line    | Issue                  |
| ------------------------------------------------------------------------ | ------- | ---------------------- |
| `/Users/mikeyoung/CODING/MAIS/server/src/routes/tenant-admin.routes.ts`  | 906-915 | Prisma bypass          |
| `/Users/mikeyoung/CODING/MAIS/server/src/routes/auth.routes.ts`          | 12      | Direct adapter import  |
| `/Users/mikeyoung/CODING/MAIS/server/src/routes/admin/tenants.routes.ts` | 15      | Direct adapter import  |
| `/Users/mikeyoung/CODING/MAIS/server/src/services/upload.service.ts`     | 4       | Singleton anti-pattern |

---

_Report generated by Agent C1 following Compound Engineering review patterns_
