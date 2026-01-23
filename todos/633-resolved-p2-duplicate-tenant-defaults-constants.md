---
status: complete
priority: p2
issue_id: '633'
tags: [code-review, dry, tenant-provisioning, refactoring]
dependencies: []
---

# Duplicate DEFAULT_SEGMENT and DEFAULT_PACKAGE_TIERS Constants

## Problem Statement

The `DEFAULT_SEGMENT` and `DEFAULT_PACKAGE_TIERS` constants are duplicated identically in two services:

- `server/src/services/tenant-provisioning.service.ts` (lines 28-61)
- `server/src/services/tenant-onboarding.service.ts` (lines 15-48)

**Why it matters:**

- DRY violation - changes must be made in two places
- Risk of drift - constants could become inconsistent over time
- Maintenance burden - harder to update default packages/segments

## Findings

### Evidence from Multiple Reviewers

**TypeScript Reviewer:** "Both services define identical `DEFAULT_SEGMENT` and `DEFAULT_PACKAGE_TIERS` constants... If defaults change (e.g., new tier names, different descriptions), updates must be made in two places."

**DHH Reviewer:** "The service duplicates the `DEFAULT_SEGMENT` and `DEFAULT_PACKAGE_TIERS` constants from `TenantOnboardingService`"

**Simplicity Reviewer:** "The `DEFAULT_SEGMENT` and `DEFAULT_PACKAGE_TIERS` constants are 100% identical between the two files"

**Location:**

```typescript
// IDENTICAL in both files:
const DEFAULT_SEGMENT = {
  name: 'General',
  slug: 'general',
  heroTitle: 'Our Services',
  description: 'Your main service offerings',
} as const;

const DEFAULT_PACKAGE_TIERS = {
  BASIC: { slug: 'basic-package', name: 'Basic Package', ... },
  STANDARD: { slug: 'standard-package', name: 'Standard Package', ... },
  PREMIUM: { slug: 'premium-package', name: 'Premium Package', ... },
} as const;
```

## Proposed Solutions

### Option A: Extract to Shared Constants File (Recommended)

**Pros:** Clean separation, single source of truth, easy to import
**Cons:** One more file to maintain
**Effort:** Small
**Risk:** Low

Create `server/src/lib/tenant-defaults.ts`:

```typescript
export const DEFAULT_SEGMENT = {
  name: 'General',
  slug: 'general',
  heroTitle: 'Our Services',
  description: 'Your main service offerings',
} as const;

export const DEFAULT_PACKAGE_TIERS = { ... } as const;
```

Then import in both services.

### Option B: Consolidate Services

**Pros:** Removes duplication entirely
**Cons:** Larger refactor, services have different purposes
**Effort:** Medium
**Risk:** Medium

Merge `TenantOnboardingService` into `TenantProvisioningService`.

## Recommended Action

**Option A** - Extract to shared constants file

## Technical Details

**Affected Files:**

- `server/src/services/tenant-provisioning.service.ts` - Import from shared
- `server/src/services/tenant-onboarding.service.ts` - Import from shared
- `server/src/lib/tenant-defaults.ts` - New file

## Acceptance Criteria

- [x] Create `server/src/lib/tenant-defaults.ts` with exported constants
- [x] Update `TenantProvisioningService` to import from shared file
- [x] Update `TenantOnboardingService` to import from shared file
- [x] Remove duplicate constant definitions
- [x] Existing tests pass

## Work Log

| Date       | Action                                  | Learnings                             |
| ---------- | --------------------------------------- | ------------------------------------- |
| 2026-01-05 | Created from multi-agent review         | DRY violation found by 4 reviewers    |
| 2026-01-05 | Resolved: Created shared constants file | Extracted to `lib/tenant-defaults.ts` |

## Resources

- Code Review: Tenant Provisioning Integrity PR
- Pattern: Shared constants in lib/
