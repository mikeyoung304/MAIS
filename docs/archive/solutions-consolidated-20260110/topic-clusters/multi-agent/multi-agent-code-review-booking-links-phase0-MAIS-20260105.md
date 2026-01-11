---
title: Multi-Agent Code Review Pattern for Multi-Tenant Security Validation
slug: multi-agent-code-review-booking-links-phase0-MAIS-20260105
category: code-review-patterns
problem_type: code_review_methodology
severity: critical
component: agent-tools
symptoms:
  - Missing tenantId in database where clauses for delete/update operations
  - Executor tools not registered in REQUIRED_EXECUTOR_TOOLS constant
  - Duplicate utility functions across modules causing N+1 queries
  - TOCTOU race conditions on service deletion with associated data
root_cause: Manual code review insufficient for catching multi-tenant isolation gaps; parallel specialized agents with enterprise quality voting required to surface critical security and integrity issues
created: 2026-01-05
project: MAIS
tags:
  - multi-tenant-security
  - code-review
  - parallel-agents
  - data-integrity
  - toctou
  - executor-registration
  - booking-links
---

# Multi-Agent Code Review Pattern for Multi-Tenant Security Validation

## Problem Statement

During Phase 0 implementation of the booking-links feature, standard code review practices missed critical security and data integrity issues. The implementation passed TypeScript compilation and unit tests but contained:

1. **Missing tenantId** in delete/update where clauses (security vulnerability)
2. **Missing REQUIRED_EXECUTOR_TOOLS** registration (silent proposal failures)
3. **Duplicate getTenantInfo** function (DRY violation + N+1 queries)
4. **TOCTOU race condition** on service delete (data integrity)

## Solution: Multi-Agent Code Review Workflow

### Step 1: Launch Specialized Reviewers in Parallel

Use `/workflows:review` to launch 5 specialized agents simultaneously:

| Agent                      | Focus Area                            | What It Catches                            |
| -------------------------- | ------------------------------------- | ------------------------------------------ |
| `security-sentinel`        | Multi-tenant isolation, auth patterns | Missing tenantId, cross-tenant access      |
| `performance-oracle`       | N+1 queries, batch operations         | Sequential inserts, duplicate queries      |
| `architecture-strategist`  | DRY violations, abstraction patterns  | Code duplication, missing shared utilities |
| `code-simplicity-reviewer` | Code clarity, dead code               | Unused variables, overly complex logic     |
| `data-integrity-guardian`  | Race conditions, data consistency     | TOCTOU, missing transactions               |

### Step 2: Synthesize Findings into Structured Todos

Each finding becomes a todo file with:

````markdown
---
status: pending
priority: p2
issue_id: NNN
tags: [code-review, security, booking-links]
---

# Problem Title

## Problem Statement

[Clear description of the issue]

## Findings

**Source:** [which agent found it]
**Evidence:**

```typescript
// Code showing the problem
```
````

## Proposed Solutions

### Option 1: [Recommended approach]

### Option 2: [Alternative]

## Recommended Action

[Final decision with implementation details]

````

### Step 3: Triage Voting with Quality Standards

Launch triage voting agents with explicit quality mandate:

> "We are only concerned with quality. We do not cut corners for MVP. We create the final system with enterprise-grade architecture."

Voting categories:
- **MUST FIX NOW (P0/P1)** - Security vulnerabilities, data corruption risks
- **FIX BEFORE PRODUCTION** - UX issues, missing validation
- **DEFER TO PHASE 1** - Optimizations, nice-to-haves

---

## Critical Patterns Discovered

### Pattern 1: Tenant Isolation in Mutations (Defense-in-Depth)

**Anti-Pattern Found:**
```typescript
// booking-link-executors.ts - DELETE OPERATION
await prisma.service.delete({
  where: { id: serviceId },  // MISSING: tenantId - SECURITY VULNERABILITY
});
````

**Correct Pattern:**

```typescript
// Defense in depth - ALWAYS include tenantId
const deleted = await prisma.service.deleteMany({
  where: { id: serviceId, tenantId },
});

if (deleted.count === 0) {
  throw new ResourceNotFoundError('Service', serviceId);
}
```

### Pattern 2: REQUIRED_EXECUTOR_TOOLS Registry

**Anti-Pattern Found:**

```typescript
// executor-registry.ts - Missing new tools
const REQUIRED_EXECUTOR_TOOLS = [
  'upsert_package',
  // MISSING: 'manage_bookable_service', 'manage_working_hours', 'manage_date_overrides'
] as const;
```

**Correct Pattern:**

```typescript
// Every T2/T3 tool MUST be registered
const REQUIRED_EXECUTOR_TOOLS = [
  'upsert_package',
  'manage_bookable_service', // NEW
  'manage_working_hours', // NEW
  'manage_date_overrides', // NEW
] as const;
```

### Pattern 3: TOCTOU Prevention with Transaction Locks

**Anti-Pattern Found:**

```typescript
// Check OUTSIDE transaction
const upcomingBookings = await prisma.booking.count({
  where: { serviceId, tenantId, date: { gte: new Date() } },
});
if (upcomingBookings > 0) throw new ValidationError(...);

// Delete in separate operation - RACE CONDITION WINDOW
await prisma.service.delete({ where: { id: serviceId } });
```

**Correct Pattern (ADR-013):**

```typescript
await prisma.$transaction(async (tx) => {
  // Lock row first
  await tx.$executeRaw`SELECT id FROM "Service" WHERE id = ${serviceId} FOR UPDATE`;

  // Check within same transaction
  const upcomingBookings = await tx.booking.count({
    where: { serviceId, tenantId, date: { gte: new Date() } },
  });
  if (upcomingBookings > 0) throw new ValidationError(...);

  // Safe to delete within same transaction
  await tx.service.delete({ where: { id: serviceId, tenantId } });
});
```

### Pattern 4: Shared Utility Extraction (DRY)

**Anti-Pattern Found:**

```typescript
// booking-link-tools.ts:77-100 (22 lines)
async function getTenantInfo(prisma, tenantId) { ... }

// booking-link-executors.ts:90-112 (22 lines) - DUPLICATE
async function getTenantInfo(prisma, tenantId) { ... }
```

**Correct Pattern:**

```typescript
// server/src/agent/shared/tenant-context.ts
export async function getTenantInfo(
  prisma: PrismaClient,
  tenantId: string
): Promise<TenantInfo | null> {
  // Single source of truth
}

// Usage in both files
import { getTenantInfo } from '../shared/tenant-context';
```

---

## Prevention Strategies

### Pre-Commit Checklist for Agent Tools

```markdown
## Agent Tool Pre-Commit Checklist

### Security

- [ ] All database queries include `tenantId` in where clause
- [ ] No cross-tenant data access possible

### Registration

- [ ] T2 tools added to `REQUIRED_EXECUTOR_TOOLS`
- [ ] Executor registered in `registerAllExecutors()`

### Code Quality

- [ ] No duplicate utilities (check `agent/shared/`)
- [ ] No circular dependencies (`npx madge --circular server/src/`)

### Concurrency

- [ ] Delete operations use transactions with row locks
- [ ] TOCTOU scenarios addressed
```

### Automated Checks

```bash
# Check for mutations without tenantId
grep -rn "prisma\.\w\+\.\(delete\|update\)" server/src/ | \
  grep -v "tenantId" | grep -v "\.test\."

# Check circular dependencies
npx madge --circular server/src/

# Validate executor registry at startup
npm run validate-executors
```

### Key Review Questions

| Category     | Question                                       |
| ------------ | ---------------------------------------------- |
| Security     | Does every database mutation include tenantId? |
| Registration | Are all T2 tools in REQUIRED_EXECUTOR_TOOLS?   |
| DRY          | Is there duplicate logic to extract?           |
| Concurrency  | Can this race with concurrent requests?        |

---

## Results from Booking Links Review

### Issues Found: 8 Total

| ID  | Issue                             | Initial | Final  | Decision         |
| --- | --------------------------------- | ------- | ------ | ---------------- |
| 617 | Missing tenantId in delete/update | P2      | **P1** | MUST FIX         |
| 618 | Missing REQUIRED_EXECUTOR_TOOLS   | P2      | **P1** | MUST FIX         |
| 619 | Duplicate getTenantInfo           | P2      | **P1** | MUST FIX         |
| 620 | TOCTOU race on delete             | P2      | **P1** | MUST FIX         |
| 621 | Schema fields not in DB           | P3      | P3     | Fix before prod  |
| 622 | Hardcoded timezone                | P3      | P3     | Fix before prod  |
| 623 | Batch insert working hours        | P3      | P3     | Defer to Phase 1 |
| 624 | Date range validation             | P3      | P3     | Fix before prod  |

### Escalation Rationale

All P2 issues escalated to P1 because:

- **617**: Security vulnerability - tenant isolation is non-negotiable
- **618**: Silent failures - proposals confirm but never execute
- **619**: Maintenance burden + N+1 queries in hot path
- **620**: Data integrity - orphaned bookings possible

---

## Related Documentation

- [mais-critical-patterns.md](../patterns/mais-critical-patterns.md) - 10 critical patterns all agents must know
- [ADR-013: Advisory Locks](../../adrs/ADR-013-postgresql-advisory-locks.md) - TOCTOU prevention
- [circular-dependency-executor-registry](../patterns/circular-dependency-executor-registry-MAIS-20251229.md) - Registry pattern
- [chatbot-proposal-execution-flow](../logic-errors/chatbot-proposal-execution-flow-MAIS-20251229.md) - T2 execution flow
- [express-route-ordering-auth-fallback](express-route-ordering-auth-fallback-security-MAIS-20260102.md) - Defense-in-depth

---

## Summary

Multi-agent code review with specialized reviewers catches issues that single-reviewer approaches miss. The key innovations:

1. **Parallel specialized agents** - Each focuses on their domain expertise
2. **Structured todo synthesis** - Findings become actionable work items
3. **Quality-first triage voting** - No MVP shortcuts, enterprise standards
4. **Pattern extraction** - Solutions become reusable prevention strategies

Use `/workflows:review` before every merge to production.
