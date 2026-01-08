---
title: 'Parallel TODO Resolution: Storefront Section IDs Code Review'
date: 2026-01-08
category: code-review-patterns
tags:
  - parallel-resolution
  - agent-tools
  - storefront-section-ids
  - advisory-locks
  - toctou-prevention
  - defense-in-depth
  - dry-principle
problem_type: code-review-patterns
severity: P1-P3
num_findings: 8
resolution_time: 90min
---

# Parallel TODO Resolution: Storefront Section IDs

## Executive Summary

Resolved **8 code review findings** from `/workflows:review` using parallel agents in ~90 minutes. Key patterns: advisory locks for TOCTOU prevention, defense-in-depth ID generation, DRY constants/type guards.

**Commit:** `c9e07cce`
**Branch:** `feat/storefront-section-ids`
**Tests:** 102/102 passing

## Problem

After implementing section IDs for AI chatbot storefront editing, `/workflows:review` identified 8 issues:

- **2 P1 Critical:** TOCTOU race condition, missing segment validation
- **2 P2 Important:** API inconsistency, missing test coverage
- **4 P3 Quality:** Magic strings, unused type guards, missing defense-in-depth

## Solution: Parallel Agent Resolution

### Batching Strategy

```
Batch 1 (5 agents): #631, #659, #661, #662, #663
Batch 2 (3 agents): #664, #665, #666
```

**Why max 5?** Context overload with 8+ agents. 4-5 agents = 60% faster than sequential; 8+ agents = coordination overhead exceeds benefit.

### P1 #659: TOCTOU Race Condition Fix

**Problem:** `update_page_section` executor reads config, validates uniqueness, writes - but without transaction isolation. Concurrent requests pass uniqueness check against stale data.

**Solution:** Advisory lock pattern (same as booking service):

```typescript
// server/src/agent/executors/storefront-executors.ts
return await prisma.$transaction(
  async (tx) => {
    // Acquire advisory lock for this tenant's storefront edits
    const lockId = hashTenantStorefront(tenantId);
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(${lockId})`;

    // Read, validate, write within same transaction
    const { pages, slug } = await getDraftConfigWithSlug(tx, tenantId);
    // ... validation and write
  },
  { timeout: 5000, isolationLevel: 'ReadCommitted' }
);
```

```typescript
// server/src/lib/advisory-locks.ts
export function hashTenantStorefront(tenantId: string): number {
  const str = `${tenantId}:storefront:draft`;
  let hash = 2166136261; // FNV-1a offset basis
  for (let i = 0; i < str.length; i++) {
    hash ^= str.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash | 0;
}
```

### P1 #631: Segment Ownership Validation

**Problem:** Packages created without segment validation - could use segmentId from different tenant.

**Solution:** Service-layer validation with auto-assignment:

```typescript
// Auto-assign to General segment if not provided
if (!segmentId) {
  const general = await this.segmentRepo.findBySlug(tenantId, 'general');
  segmentId = general?.id ?? (await this.createDefaultSegment(tenantId));
} else {
  // Verify ownership (defense-in-depth)
  const isOwner = await this.tenantRepo.validateSegmentOwnership(tenantId, segmentId);
  if (!isOwner) throw new ValidationError('Segment not found or access denied');
}
```

### P2 #661: API Consistency (fromSectionId)

**Problem:** `reorder_page_sections` only accepted indices, while update/remove supported sectionId.

**Solution:** Added `fromSectionId` parameter with DRY helper:

```typescript
// server/src/agent/tools/utils.ts
export function resolveSectionIndex(
  sectionId: string,
  pageName: string,
  pages: PagesConfig
): SectionResolutionResult {
  const page = pages[pageName as keyof PagesConfig];
  if (!page) return { success: false, error: `Page "${pageName}" not found` };

  const foundIndex = page.sections.findIndex((s) => isSectionWithId(s) && s.id === sectionId);

  if (foundIndex !== -1) return { success: true, index: foundIndex };

  // Check other pages for helpful error
  for (const [otherPage, otherConfig] of Object.entries(pages)) {
    if (otherPage === pageName) continue;
    const idx = otherConfig.sections.findIndex((s) => isSectionWithId(s) && s.id === sectionId);
    if (idx !== -1) {
      return {
        success: false,
        error: `Section "${sectionId}" exists on page "${otherPage}", not "${pageName}"`,
      };
    }
  }

  const availableIds = page.sections.filter(isSectionWithId).map((s) => s.id);
  return {
    success: false,
    error: `Section "${sectionId}" not found. Available: ${availableIds.join(', ') || 'none'}`,
  };
}
```

### P3 Patterns: DRY and Defense-in-Depth

**#664 - Type Guard Consistency:**

```typescript
// Replaced 10 inline checks with type guard
// Before: 'id' in section && typeof section.id === 'string'
// After:  isSectionWithId(section)
```

**#665 - Server-Side ID Generation Fallback:**

```typescript
// Defense-in-depth: executor generates ID if tool forgot
if (!('id' in sectionData) || !sectionData.id) {
  const generatedId = generateSectionId(pageName, sectionData.type, existingIds);
  sectionData.id = generatedId;
  logger.warn({ tenantId, generatedId }, 'Executor generated missing section ID');
}
```

**#666 - Legacy Suffix Constant:**

```typescript
// Before: `${page}-${type}-legacy` (4 places)
// After:
export const LEGACY_ID_SUFFIX = 'legacy';
export function getLegacySectionId(page: string, type: string): string {
  return `${page}-${type}-${LEGACY_ID_SUFFIX}`;
}
```

## Prevention Strategies

### 1. TOCTOU on JSON Fields

**When it applies:** Any read-validate-write on JSON columns (landingPageConfig, etc.)

**Pattern:**

```typescript
await prisma.$transaction(async (tx) => {
  const lockId = hashResource(tenantId, resourceName);
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(${lockId})`;
  // Read, validate, write within transaction
});
```

### 2. DRY Tool Logic

**When it applies:** Same validation/resolution logic in multiple tools

**Pattern:** Extract to `server/src/agent/tools/utils.ts` immediately. Don't "plan to refactor later."

### 3. API Consistency

**When it applies:** Related tools with different parameter patterns

**Pattern:** All section-targeting tools support same parameters:

- `sectionId` (PREFERRED) - stable, human-readable
- `sectionIndex` (FALLBACK) - fragile, shifts on delete

### 4. Defense-in-Depth

**When it applies:** Critical data integrity operations

**Pattern:** Validate at multiple layers:

- Tool layer: First line of defense
- Executor layer: Catches tool bugs
- Service layer: Business rule enforcement

## Parallel Resolution Best Practices

1. **Max 5 agents** - More causes coordination overhead
2. **Dependency graph first** - Resolve dependencies before dependents
3. **Targeted tests before full suite** - 5 min targeted vs 30 min full
4. **Exclude unrelated changes** - Seed files, docs belong in separate commits
5. **Evidence freshness** - Re-validate if git state changes during session

## Files Modified

| File                                                         | Changes                             |
| ------------------------------------------------------------ | ----------------------------------- |
| `server/src/agent/executors/storefront-executors.ts`         | Advisory lock, defense-in-depth ID  |
| `server/src/agent/tools/storefront-tools.ts`                 | fromSectionId, type guard usage     |
| `server/src/agent/tools/utils.ts`                            | resolveSectionIndex, legacy helpers |
| `server/src/lib/advisory-locks.ts`                           | hashTenantStorefront()              |
| `server/src/adapters/prisma/tenant.repository.ts`            | validateSegmentOwnership()          |
| `server/test/integration/section-id-race-conditions.spec.ts` | 5 new tests                         |

## Related Documentation

- [STOREFRONT_SECTION_IDS_PREVENTION_STRATEGIES.md](../patterns/STOREFRONT_SECTION_IDS_PREVENTION_STRATEGIES.md)
- [ADR-013: Advisory Locks](../../adrs/ADR-013-advisory-locks.md)
- [circular-dependency-executor-registry](../patterns/circular-dependency-executor-registry-MAIS-20251229.md)

## Metrics

- **Resolution time:** ~90 minutes (vs ~6 hours sequential estimate)
- **Agents used:** 8 (batched 5+3)
- **Tests added:** 65+
- **Files changed:** 20
- **Lines:** +2057 / -244
