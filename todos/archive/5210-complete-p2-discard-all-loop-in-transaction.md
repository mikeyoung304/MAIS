---
status: ready
priority: p2
issue_id: '5210'
tags: [code-review, performance, database, section-content-migration]
dependencies: []
---

# P2: discardAll Has O(n) Loop Inside Transaction

## Problem Statement

The `discardAll()` method iterates through sections one-by-one inside a transaction, holding the transaction open for longer than necessary.

**Why it matters:** Long-running transactions block other operations and consume connection pool resources. With 8+ sections, this creates noticeable latency.

## Findings

**Source:** Performance Oracle Agent Review

**Location:** `server/src/adapters/prisma/section-content.repository.ts`

**Evidence:**

```typescript
// Current: O(n) individual updates
await prisma.$transaction(async (tx) => {
  for (const section of draftSections) {
    await tx.sectionContent.delete({ where: { id: section.id } });
  }
});

// Better: Bulk delete
await prisma.sectionContent.deleteMany({
  where: { tenantId, isDraft: true },
});
```

**Impact:**

- 8 sections × ~5ms each = 40ms transaction hold time
- Concurrent operations blocked during transaction
- Connection pool pressure under load

## Proposed Solutions

### Option A: Use deleteMany for bulk operations (Recommended)

**Approach:** Replace loop with single bulk operation

```typescript
async discardAll(tenantId: string): Promise<void> {
  await this.prisma.sectionContent.deleteMany({
    where: { tenantId, isDraft: true }
  });
}
```

**Pros:** Single query, minimal transaction time, ~5ms total
**Cons:** Loses individual row confirmation
**Effort:** Small (30 minutes)
**Risk:** Low

### Option B: Batch delete with IN clause

**Approach:** Collect IDs first, then bulk delete

```typescript
const draftIds = draftSections.map((s) => s.id);
await prisma.sectionContent.deleteMany({
  where: { id: { in: draftIds }, tenantId },
});
```

**Pros:** Explicit ID list, still single query
**Cons:** Extra query to get IDs
**Effort:** Small
**Risk:** Low

## Recommended Action

**Option A: Use deleteMany for bulk operations** - Partition sections by operation type, batch delete new sections with `deleteMany`. Updates remain individual but transaction time reduced.

**Triaged:** 2026-02-02 | **Decision:** Fix before merge | **Rationale:** Performance quality improvement

## Technical Details

**Affected Files:**

- `server/src/adapters/prisma/section-content.repository.ts`

**Database Changes:** None

## Acceptance Criteria

- [ ] `discardAll()` uses single bulk operation
- [ ] Transaction time reduced from O(n) to O(1)
- [ ] Tenant isolation maintained in WHERE clause
- [ ] Unit tests verify bulk behavior

## Work Log

| Date       | Action                   | Learnings                              |
| ---------- | ------------------------ | -------------------------------------- |
| 2026-02-02 | Created from code review | Identified by performance-oracle agent |

## Resources

- PR: `feat/section-content-migration`
