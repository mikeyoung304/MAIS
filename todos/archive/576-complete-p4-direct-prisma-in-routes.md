---
status: deferred
priority: p4
issue_id: '576'
tags: [code-review, architecture, layering, prisma]
dependencies: []
deferred_date: '2026-01-01'
deferred_reason: 'Low priority refactor. Current code works, would refactor during feature additions.'
---

# P1: Layering Violation - Direct Prisma Usage in Routes

## Problem Statement

Multiple route handlers directly call Prisma instead of going through the service/repository layer:

```typescript
// In routes - WRONG
const tenant = await prisma.tenant.findUnique({ where: { id } });

// Should be
const tenant = await tenantService.getById(id);
```

This violates the layered architecture and creates:

- **Testing difficulty**: Can't mock Prisma in route tests
- **Coupling**: Routes tied to database schema changes
- **Duplication**: Tenant isolation logic must be repeated
- **Missing features**: No caching, auditing, or telemetry at repository layer

## Findings

**Locations (12 instances):**

- `server/src/routes/agent.routes.ts:155,206` - Direct tenant lookup
- `server/src/routes/public-customer-chat.routes.ts:84,170,183,230,315,387` - Direct session/proposal queries
- `server/src/routes/tenant-admin.routes.ts:924` - Direct tenant update

**Identified by:** Architecture Strategist agent

**Pattern observed:**

```typescript
// agent.routes.ts:155
const tenant = await container.prisma.tenant.findUnique({
  where: { id: tenantId },
  include: { packages: true },
});
```

## Proposed Solutions

### Option A: Create Missing Service Methods (Recommended)

**Pros:** Follows existing patterns, proper abstraction
**Cons:** Requires creating new service methods
**Effort:** Medium (2-3 days)
**Risk:** Low

### Option B: Extract to New Services

**Pros:** Clear separation of concerns
**Cons:** More files to maintain
**Effort:** Medium
**Risk:** Low

## Recommended Action

**Choose Option A** - Add methods to existing services

## Technical Details

**New service methods needed:**

```typescript
// TenantService (or TenantAuthService)
interface TenantService {
  getByIdWithPackages(tenantId: string): Promise<TenantWithPackages>;
}

// AgentSessionService (new or extend existing)
interface AgentSessionService {
  findBySessionIdAndTenant(sessionId: string, tenantId: string): Promise<AgentSession | null>;
  findPendingProposal(tenantId: string, sessionId: string): Promise<AgentProposal | null>;
}
```

**Affected files:**

- `server/src/services/tenant.service.ts` - Add methods
- `server/src/services/agent-session.service.ts` - Create or extend
- `server/src/routes/agent.routes.ts` - Use services
- `server/src/routes/public-customer-chat.routes.ts` - Use services
- `server/src/routes/tenant-admin.routes.ts` - Use services

**Database changes:** None

## Acceptance Criteria

- [ ] No direct `prisma.tenant`, `prisma.agentSession`, `prisma.agentProposal` in routes
- [ ] All database access goes through services/repositories
- [ ] Route tests can mock service layer
- [ ] Existing functionality unchanged
- [ ] TypeScript compilation passes

## Work Log

| Date       | Action  | Notes                                  |
| ---------- | ------- | -------------------------------------- |
| 2026-01-01 | Created | Found during comprehensive code review |

## Resources

- `server/src/lib/ports.ts` - Repository interfaces pattern
- `server/src/di.ts` - Dependency injection container
