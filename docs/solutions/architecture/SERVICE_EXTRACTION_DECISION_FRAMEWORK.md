# Service Extraction Decision Framework

**Date:** 2026-02-15
**Context:** Overnight P2 debt cleanup (todo #576 — direct Prisma in routes)
**Outcome:** Extracted 10 Prisma calls to services, deliberately kept ~25 in place

---

## The Question

When should you extract a Prisma call from a route handler into a service?

## Decision Matrix

| Factor                 | Extract                                                        | Keep in Route                |
| ---------------------- | -------------------------------------------------------------- | ---------------------------- |
| **Reusability**        | Query used by 2+ routes or tests                               | Single-use query             |
| **Business logic**     | Multi-step: lookup → validate → mutate → event                 | Single findFirst/findUnique  |
| **State transitions**  | Changes entity state (skip onboarding, complete reveal)        | Reads data for HTTP response |
| **Multi-table chains** | Joins across 2+ tables (session → payment → booking → project) | Single-table lookup          |
| **Existing service**   | Service already owns the domain (ProjectHub owns projects)     | No natural service home      |
| **Route complexity**   | Route handler >100 lines with mixed concerns                   | Route is thin CRUD wrapper   |

## When NOT to Extract

**Internal agent CRUD routes** (e.g., `internal-agent-content-tiers.routes.ts`) should stay as-is when:

1. The route IS the service layer — thin switch/case over CRUD actions
2. A separate CatalogService already exists with **different validation rules** (slug uniqueness, segment auto-assignment vs. max-per-segment enforcement, auto sortOrder)
3. Merging would mean reconciling divergent business logic — high risk of subtle behavioral changes
4. The route already follows all security patterns (tenant scoping, bounded queries)

**Key signal:** If extracting would create a service method that's just a 1:1 wrapper around a single Prisma call with no business logic, the extraction adds indirection without value.

## What We Extracted (Phase 3-5)

### TenantOnboardingService (5 new methods)

```
isChatEnabled(tenantId)       ← replaces 1 Prisma call in middleware
getTenantChatInfo(tenantId)   ← replaces 1 Prisma call in health check
getTenantName(tenantId)       ← replaces 1 Prisma call in session creation
skipOnboarding(tenantId)      ← replaces 2 Prisma calls (read + write state transition)
completeReveal(tenantId)      ← replaces 2 Prisma calls (idempotent read + write)
```

**Why these were good extractions:**

- `skipOnboarding` encapsulates a state machine transition (check phase → validate → update)
- `completeReveal` has idempotency logic (check before write)
- Chat methods are reused across middleware, health check, and session routes

### ProjectHubService (4 new methods)

```
findProjectByBooking(tenantId, bookingId)           ← single-table lookup
findProjectByPaymentSession(tenantId, sessionId)    ← 2-table chain (payment → project)
findProjectForAuth(tenantId, projectId)             ← lightweight auth check
getTenantPublicInfo(tenantId)                       ← replaces 2 identical queries
```

**Why these were good extractions:**

- `findProjectByPaymentSession` chains 2 queries — genuine business logic
- `getTenantPublicInfo` was duplicated in 2 route handlers
- All methods are testable independently of Express

### What We Kept In-Place

- Agent tier CRUD (13 Prisma calls) — routes are already clean switch/case handlers
- Agent addon CRUD (10 Prisma calls) — same reasoning
- Timeline query — route has different ordering than service method
- Project detail view — complex include/select specific to HTTP response shape

## Route Factory DI Pattern

When extracting, route factories evolve from single-param to deps object:

```typescript
// Before
export function createPublicCustomerChatRoutes(prisma: PrismaClient): Router;

// After
interface PublicCustomerChatDeps {
  prisma: PrismaClient;
  tenantOnboarding: TenantOnboardingService;
}
export function createPublicCustomerChatRoutes(deps: PublicCustomerChatDeps): Router;
```

This pattern:

- Keeps backward compatibility easy (add optional deps)
- Makes dependencies explicit at the call site in `routes/index.ts`
- Matches the existing Container → Services → Routes DI flow
