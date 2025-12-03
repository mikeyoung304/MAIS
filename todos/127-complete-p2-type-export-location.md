---
status: complete
priority: p2
issue_id: "127"
tags: [code-review, architecture, types, pr-12]
dependencies: []
resolution: DEFERRED - Type is feature-local and co-location with hook is acceptable
---

# SegmentWithPackages Type Defined in Wrong Location

## Problem Statement

The `SegmentWithPackages` type is defined and exported from `useDashboardData.ts` (a hook file), but it represents a domain concept that should live in the contracts or types layer.

**Why it matters:**
- Types in hook files are harder to import elsewhere
- Creates dependency on hook file just for types
- Violates separation of concerns
- May cause circular import issues as codebase grows

## Findings

**Source:** Architecture Strategist agent review of PR #12

**File:** `client/src/features/tenant-admin/TenantDashboard/useDashboardData.ts`
**Lines:** 18-20

**Current Code:**
```typescript
export type SegmentWithPackages = SegmentDto & {
  packages: PackageDto[];
};
```

## Proposed Solutions

### Solution 1: Move to Client Types File (Recommended)
Create or use existing client types file:
```typescript
// client/src/types/tenant-admin.ts
import type { SegmentDto, PackageDto } from '@macon/contracts';

export type SegmentWithPackages = SegmentDto & {
  packages: PackageDto[];
};
```

Then import in hook:
```typescript
import type { SegmentWithPackages } from '@/types/tenant-admin';
```

**Pros:** Proper separation, reusable across features
**Cons:** New file (or addition to existing)
**Effort:** Small (10 minutes)
**Risk:** Low

### Solution 2: Add to Contracts Package
If this type is used across client and server, add to `@macon/contracts`.

**Pros:** Shared across entire codebase
**Cons:** May be overkill for client-only type
**Effort:** Medium (20 minutes)
**Risk:** Low

## Recommended Action

Implement Solution 1 if type is client-only. Implement Solution 2 if server also needs this type.

## Technical Details

**Affected Files:**
- `client/src/features/tenant-admin/TenantDashboard/useDashboardData.ts` (remove type)
- `client/src/types/tenant-admin.ts` (add type, create if needed)
- All files importing `SegmentWithPackages` (update import path)

## Acceptance Criteria

- [ ] Type moved to appropriate types file
- [ ] All imports updated
- [ ] TypeScript passes
- [ ] No circular dependencies

## Work Log

| Date | Action | Notes |
|------|--------|-------|
| 2025-12-01 | Created | From PR #12 code review |

## Resources

- PR: https://github.com/mikeyoung304/MAIS/pull/12

