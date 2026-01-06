---
status: pending
priority: p3
issue_id: '635'
tags: [code-review, dry, segments, refactoring]
dependencies: ['633']
---

# Duplicate Segment Resolution Logic in Multiple Places

## Problem Statement

The pattern "find General segment or create it" is duplicated in three places:

1. `CatalogService.createPackage()` - lines 226-256
2. `executors/index.ts` - upsert_package executor - lines 126-172
3. `TenantProvisioningService` - implicitly creates segment first

**Why it matters:**

- Similar but slightly different implementations
- Bug fixes need to be applied in multiple places
- Agent executor and service layer could diverge

## Findings

### Evidence from Simplicity Reviewer

"The segment auto-assignment logic appears in THREE places with similar but slightly different approaches:

- CatalogService uses `segmentRepo.findBySlug()` and `tenantOnboardingService.createDefaultData()`
- Executor uses `prisma.segment.findUnique()` with compound unique key"

### Current Implementations

**CatalogService:**

```typescript
if (this.segmentRepo) {
  const generalSegment = await this.segmentRepo.findBySlug(tenantId, 'general');
  if (generalSegment) {
    resolvedSegmentId = generalSegment.id;
  } else if (this.tenantOnboardingService) {
    const { segment } = await this.tenantOnboardingService.createDefaultData({ tenantId });
    resolvedSegmentId = segment.id;
  }
}
```

**Agent Executor:**

```typescript
const generalSegment = await prisma.segment.findUnique({
  where: { tenantId_slug: { tenantId, slug: 'general' } },
});
if (generalSegment) {
  resolvedSegmentId = generalSegment.id;
}
```

## Proposed Solutions

### Option A: Extract to Shared Utility (Recommended)

**Pros:** DRY, consistent behavior, testable
**Cons:** New utility module
**Effort:** Small
**Risk:** Low

```typescript
// server/src/lib/segment-utils.ts
export async function resolveOrCreateGeneralSegment(
  prisma: PrismaClient,
  tenantId: string,
  onboardingService?: TenantOnboardingService
): Promise<string | null>;
```

### Option B: Have Agent Tools Call Service Layer

**Pros:** Service layer becomes single source of truth
**Cons:** Agent executors bypassing services is an established pattern
**Effort:** Medium
**Risk:** Medium (changes executor pattern)

## Recommended Action

**Option A** - Extract to shared utility

## Technical Details

**Affected Files:**

- `server/src/lib/segment-utils.ts` - New shared utility
- `server/src/services/catalog.service.ts` - Use shared utility
- `server/src/agent/executors/index.ts` - Use shared utility

## Acceptance Criteria

- [ ] Create `segment-utils.ts` with `resolveOrCreateGeneralSegment()`
- [ ] CatalogService uses shared utility
- [ ] Agent executor uses shared utility
- [ ] Consistent behavior between both code paths
- [ ] Existing tests pass

## Work Log

| Date       | Action                          | Learnings                                |
| ---------- | ------------------------------- | ---------------------------------------- |
| 2026-01-05 | Created from multi-agent review | Simplicity reviewer found 3 duplications |

## Resources

- Code Review: Tenant Provisioning Integrity PR
- Related: #633 (shared constants)
