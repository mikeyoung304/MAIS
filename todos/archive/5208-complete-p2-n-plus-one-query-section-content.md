---
status: ready
priority: p2
issue_id: '5208'
tags: [code-review, performance, database, section-content-migration]
dependencies: []
---

# P2: N+1 Queries in SectionContent Operations

## Problem Statement

The `getSectionContent()` and `updateSection()` methods fetch the full section list to find a single section, creating N+1 query patterns under load.

**Why it matters:** With 8+ sections per tenant, each section operation does a full table scan. Under concurrent editing, this creates unnecessary database load.

## Findings

**Source:** Performance Oracle Agent Review

**Location:** `server/src/adapters/prisma/section-content.repository.ts`

**Evidence:**

```typescript
// Current: Fetches ALL sections, finds one
const sections = await this.findAllForTenant(tenantId);
return sections.find((s) => s.id === sectionId);

// Better: Single query with WHERE clause
return this.prisma.sectionContent.findFirst({
  where: { id: sectionId, tenantId },
});
```

**Impact:**

- 8 sections × 1 query = 8 unnecessary row reads per operation
- Concurrent editing amplifies the problem
- Blocks connection pool under load

## Proposed Solutions

### Option A: Add findById method (Recommended)

**Approach:** Add targeted query method to repository

```typescript
// In ISectionContentRepository interface
findById(tenantId: string, sectionId: string): Promise<SectionContent | null>;

// In PrismaSectionContentRepository
async findById(tenantId: string, sectionId: string): Promise<SectionContent | null> {
  return this.prisma.sectionContent.findFirst({
    where: { id: sectionId, tenantId }  // Tenant isolation maintained
  });
}
```

**Pros:** Single query, indexed lookup, maintains tenant isolation
**Cons:** Need to add method to interface and mock
**Effort:** Small (1 hour)
**Risk:** Low

### Option B: Add database index

**Approach:** Composite index on (tenantId, id)

**Pros:** Speeds up all queries
**Cons:** Index already exists (primary key), findById still needed
**Effort:** None needed
**Risk:** None

## Recommended Action

**Option A: Add findById method** - Add `findById(tenantId, sectionId)` to repository interface and implementations. Use in `getSectionContent()` and `updateSection()`.

**Triaged:** 2026-02-02 | **Decision:** Fix before merge | **Rationale:** Performance quality improvement

## Technical Details

**Affected Files:**

- `server/src/lib/ports.ts` - Add to interface
- `server/src/adapters/prisma/section-content.repository.ts`
- `server/src/adapters/mock/section-content.repository.ts`
- `server/src/services/section-content.service.ts`

**Database Changes:** None (index exists)

## Acceptance Criteria

- [ ] `findById()` method added to repository interface
- [ ] Service uses `findById()` for single-section operations
- [ ] Unit tests verify single query execution
- [ ] Mock repository implements new method

## Work Log

| Date       | Action                   | Learnings                              |
| ---------- | ------------------------ | -------------------------------------- |
| 2026-02-02 | Created from code review | Identified by performance-oracle agent |

## Resources

- PR: `feat/section-content-migration`
