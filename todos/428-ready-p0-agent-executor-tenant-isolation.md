---
status: ready
priority: p0
issue_id: '428'
tags: [security, multi-tenant, agent, critical]
dependencies: []
---

# CRITICAL: Agent Executor Missing Tenant Isolation on Writes

## Problem Statement

The agent proposal executors in `server/src/agent/executors/index.ts` perform update/delete operations WITHOUT verifying the resource belongs to the tenant. An attacker who obtains another tenant's resource ID could manipulate that resource through the agent.

## Severity: P0 - CRITICAL SECURITY

Cross-tenant data manipulation vulnerability. Tenant A could theoretically modify Tenant B's packages, bookings, or blackout dates.

## Findings

- Location: `server/src/agent/executors/index.ts`
- Vulnerable operations: Package update (line 38-48), Package deactivation (line 89-92), Booking cancellation (line 274-282)
- Root cause: `where: { id: resourceId }` without `tenantId` filter

## Vulnerable Code Examples

### Package Update (lines 38-48)

```typescript
const updated = await prisma.package.update({
  where: { id: packageId },  // MISSING: tenantId filter
  data: { ... },
});
```

### Package Deactivation (lines 89-92)

```typescript
const deleted = await prisma.package.update({
  where: { id: packageId }, // MISSING: tenantId filter
  data: { active: false },
});
```

### Booking Cancellation (lines 274-282)

```typescript
const updated = await prisma.booking.update({
  where: { id: bookingId },  // MISSING: tenantId filter
  data: { status: 'CANCELED', ... },
});
```

## Attack Scenario

1. Attacker has account on Tenant A
2. Attacker discovers package ID from Tenant B (e.g., via shared URL, API enumeration)
3. Attacker asks agent: "Update package pkg_TenantB_123 with title 'HACKED'"
4. Agent creates proposal, attacker confirms
5. Executor runs: `prisma.package.update({ where: { id: 'pkg_TenantB_123' } })`
6. Tenant B's package is modified by Tenant A

## Proposed Solution

### Pattern 1: Use `updateMany` with tenant filter (Recommended)

```typescript
const updated = await prisma.package.updateMany({
  where: {
    id: packageId,
    tenantId  // CRITICAL: Multi-tenant isolation
  },
  data: { ... },
});

if (updated.count === 0) {
  throw new Error('Package not found or unauthorized');
}
```

### Pattern 2: Verify ownership before update

```typescript
const existing = await prisma.package.findFirst({
  where: { id: packageId, tenantId }
});
if (!existing) throw new Error('Package not found');

// Now safe to update
await prisma.package.update({
  where: { id: packageId },
  data: { ... },
});
```

## Technical Details

- **Affected Files**: `server/src/agent/executors/index.ts`
- **All Operations to Fix**:
  - `executeUpdatePackage` (line 35)
  - `executeDeactivatePackage` (line 86)
  - `executeCreateBlackout` (line 139)
  - `executeDeleteBlackout` (line 166)
  - `executeCancelBooking` (line 271)
  - `executeUpdateBranding` (line 194)
  - `executeUpdateLandingPage` (line 233)
- **Test Coverage**: Add tests verifying cross-tenant access is rejected

## Acceptance Criteria

- [ ] All executor functions include `tenantId` in where clause
- [ ] Attempting to modify another tenant's resource returns "not found"
- [ ] Integration test: Cross-tenant package update returns 404/unauthorized
- [ ] Integration test: Cross-tenant booking cancellation returns 404/unauthorized
- [ ] Audit: Every `prisma.*.update()` and `prisma.*.delete()` has tenantId filter

## Review Sources

- Architecture Strategist: P0 - CRITICAL - Multi-Tenant Isolation Bypass

## Notes

Source: Parallel code review session on 2025-12-26
The read tools and write tools (proposal creation) are correctly tenant-scoped.
Only the executor (proposal execution) is missing isolation.
