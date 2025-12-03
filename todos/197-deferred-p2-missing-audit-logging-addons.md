---
status: deferred
priority: p2
issue_id: "197"
tags: [code-review, audit, consistency]
dependencies: []
deferred_reason: "YAGNI - Audit logs not yet production-critical per DHH review"
---

# Missing Audit Logging for Add-On Operations

## Problem Statement

Package CRUD operations include audit logging (lines 203-216, 252-265, 294-306 in catalog.service.ts), but add-on CRUD operations do NOT. This creates an incomplete audit trail.

### Why It Matters
- Inconsistent audit trail for tenant configuration changes
- Can't track who created/modified/deleted add-ons
- Compliance risk for tenant admin actions
- Harder to debug issues

## Findings

**Source:** Security Review, Architecture Review, Code Quality Review

**Evidence:**
```typescript
// Package creation HAS audit logging (lines 203-216)
if (this.auditService && auditCtx) {
  await this.auditService.trackLegacyChange({
    changeType: 'package_crud',
    operation: 'create',
    // ...
  });
}

// Add-on creation has NO audit logging (lines 317-335)
async createAddOn(tenantId: string, data: CreateAddOnInput): Promise<AddOn> {
  // ... no audit logging
}
```

**Location:** `server/src/services/catalog.service.ts:317-395`

## Proposed Solutions

### Option A: Add Audit Logging (Matches Package Pattern)
**Pros:** Consistent with packages, complete audit trail
**Cons:** More code, requires updating method signatures
**Effort:** Medium (30 minutes)
**Risk:** Low

1. Update method signatures:
```typescript
async createAddOn(
  tenantId: string,
  data: CreateAddOnInput,
  auditCtx?: AuditContext
): Promise<AddOn>

async updateAddOn(
  tenantId: string,
  id: string,
  data: UpdateAddOnInput,
  auditCtx?: AuditContext
): Promise<AddOn>

async deleteAddOn(
  tenantId: string,
  id: string,
  auditCtx?: AuditContext
): Promise<void>
```

2. Add audit logging in each method following package pattern.

### Option B: Defer (YAGNI)
**Pros:** Ship faster
**Cons:** Inconsistent behavior, technical debt
**Effort:** None
**Risk:** Medium - audit requirements may grow

DHH review suggests this might be over-engineering if no one uses audit logs yet.

## Recommended Action

Option A if audit logs are actually used; Option B if they're not production-critical yet.

## Technical Details

**Affected Files:**
- `server/src/services/catalog.service.ts`
- `server/src/routes/tenant-admin.routes.ts` (pass auditCtx)

**Database Changes:** None (audit table already exists)

## Acceptance Criteria

- [ ] `createAddOn` has audit logging
- [ ] `updateAddOn` has audit logging with before/after snapshots
- [ ] `deleteAddOn` has audit logging with before snapshot
- [ ] Routes construct and pass auditCtx
- [ ] Audit logs appear in database after operations

## Work Log

| Date | Action | Learnings |
|------|--------|-----------|
| 2025-12-03 | Created from code review | Match audit patterns across entity types |
| 2025-12-03 | DEFERRED: Following DHH review YAGNI principle | Defer features until actually needed |

## Resources

- Package audit pattern: lines 203-216 in catalog.service.ts
