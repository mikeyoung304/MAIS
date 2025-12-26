---
status: complete
priority: p1
issue_id: "388"
tags:
  - code-review
  - schema-drift
  - data-integrity
dependencies: []
---

# AddOn Mapper Bugs - Hardcoded Null and Silent Fallback

## Problem Statement

The AddOn mapper in `catalog.repository.ts` has two bugs that cause data loss and silent failures:

1. **Description always null**: Line 693 hardcodes `description: null` even if Prisma has description data
2. **PackageId silent fallback**: Line 691 uses `addOn.packages[0]?.packageId || ''` which silently returns empty string if no packages relation exists

## Findings

**Location:** `server/src/adapters/prisma/catalog.repository.ts:683-697`

```typescript
private toDomainAddOn(addOn: { ... }): AddOn {
  return {
    id: addOn.id,
    packageId: addOn.packages[0]?.packageId || '',  // BUG: Silent fallback
    title: addOn.name,
    description: null,  // BUG: Hardcoded null, ignores Prisma data
    priceCents: addOn.price,
    photoUrl: undefined,
  };
}
```

**Impact:**
- Services expecting AddOn descriptions get null even when data exists
- Booking creation could fail with cryptic error if packageId is empty string

## Proposed Solutions

### Option 1: Fix mapper to use actual data (Recommended)
- Map `description: addOn.description ?? null`
- Throw error if `packages` relation is empty instead of silent fallback

**Pros:** Data integrity preserved, fails fast on bad data
**Cons:** May expose existing data issues
**Effort:** Small
**Risk:** Low

### Option 2: Add validation layer
- Keep mapper simple, add validation in service layer
- Log warning for missing packageId

**Pros:** Separation of concerns
**Cons:** More code, validation spread across layers
**Effort:** Medium
**Risk:** Low

## Recommended Action

Option 1 - Fix the mapper directly

## Technical Details

**Affected files:**
- `server/src/adapters/prisma/catalog.repository.ts`

**Affected components:**
- AddOn display in storefronts
- Package details with add-ons
- Booking flow add-on selection

## Acceptance Criteria

- [x] AddOn mapper maps description from Prisma data
- [x] AddOn mapper throws error if packages relation is empty
- [ ] Unit test covers both cases
- [x] Existing tests still pass

## Work Log

| Date | Action | Learnings |
|------|--------|-----------|
| 2025-12-25 | Created from multi-agent scan | Found during schema/entity drift analysis |
| 2025-12-25 | Fixed both bugs | Added description param, throw on empty packages |

## Resources

- Agent report: Schema-to-Entity Drift Analysis
- Related: Package name→title mapping
