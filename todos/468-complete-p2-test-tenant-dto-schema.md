---
status: complete
priority: p2
issue_id: '468'
tags: [code-review, test-data-isolation, types]
dependencies: []
---

# P2: Missing `isTestTenant` in TenantDto Schema

## Problem Statement

The `TenantWithStats` interface in the repository was updated with `isTestTenant: boolean`, but the `TenantDtoSchema` in contracts was NOT updated. This creates a type mismatch between backend and frontend.

**Why it matters:** Frontend won't receive `isTestTenant` in API responses, or type checking may fail silently.

## Findings

### Discovery 1: TenantDtoSchema missing field

**Source:** Code Quality Review Agent
**Location:** `packages/contracts/src/dto.ts` around lines 575-589

The schema defines tenant fields but doesn't include `isTestTenant`.

### Discovery 2: getAllTenants doesn't return isTestTenant

**Source:** Code Quality Review Agent
**Location:** `server/src/controllers/platform-admin.controller.ts` lines 32-45

The mapping doesn't include `isTestTenant: tenant.isTestTenant`.

## Proposed Solutions

### Solution 1: Update Contract and Controller (Recommended)

**Effort:** Small | **Risk:** Low

1. Add to TenantDtoSchema:

```typescript
export const TenantDtoSchema = z.object({
  id: z.string(),
  slug: z.string(),
  // ... other fields
  isTestTenant: z.boolean(), // ADD THIS
  createdAt: z.string(),
  updatedAt: z.string(),
});
```

2. Add to getAllTenants mapping:

```typescript
return tenants.map((tenant) => ({
  // ... other fields
  isTestTenant: tenant.isTestTenant, // ADD THIS
}));
```

## Recommended Action

<!-- Filled during triage -->

## Technical Details

**Affected Files:**

- `packages/contracts/src/dto.ts` - TenantDtoSchema
- `server/src/controllers/platform-admin.controller.ts` - getAllTenants mapping

**Database Changes:** None

## Acceptance Criteria

- [x] TenantDtoSchema includes isTestTenant field
- [x] getAllTenants response includes isTestTenant
- [x] TypeScript compilation passes
- [ ] Frontend receives isTestTenant in response (verified via API contract)

## Work Log

| Date       | Action              | Outcome/Learning                                                                |
| ---------- | ------------------- | ------------------------------------------------------------------------------- |
| 2025-12-29 | Code quality review | Contract/implementation mismatch                                                |
| 2025-12-29 | Fix applied         | Added isTestTenant to TenantDtoSchema and controller mapping. Typecheck passes. |

## Resources

- `packages/contracts/src/dto.ts`
