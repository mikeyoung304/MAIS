---
status: complete
priority: p2
issue_id: '627'
tags: [code-review, performance, build-mode, database]
dependencies: []
---

# N+1 Query Pattern in Tools and Executors

## Problem Statement

Every storefront tool and executor calls both `getDraftConfig()` AND `getTenantSlug()` separately, resulting in 2 database queries per operation to the same tenant table.

**What's broken:** Excessive database queries
**Why it matters:** Doubles DB load for every Build Mode operation

## Findings

### Source: Performance Oracle

**Files:**

- `server/src/agent/tools/storefront-tools.ts` (e.g., lines 198, 225)
- `server/src/agent/executors/storefront-executors.ts` (all 8 executors)
- `server/src/agent/tools/utils.ts`

**Current Pattern (3 queries per operation):**

```typescript
const { pages, hasDraft } = await getDraftConfig(prisma, tenantId);  // Query 1
// ... modification logic ...
await saveDraftConfig(prisma, tenantId, updatedPages);               // Query 2
const slug = await getTenantSlug(prisma, tenantId);                  // Query 3
```

## Proposed Solutions

### Option A: Combined helper function (Recommended)

**Description:** Create a combined function that fetches config and slug in one query

```typescript
export async function getDraftConfigWithSlug(
  prisma: PrismaClient,
  tenantId: string
): Promise<{ pages: PagesConfig; hasDraft: boolean; slug: string | null }> {
  const tenant = await prisma.tenant.findUnique({
    where: { id: tenantId },
    select: {
      landingPageConfig: true,
      landingPageConfigDraft: true,
      slug: true,  // Get slug in same query
    },
  });
  // ... derive pages and hasDraft
  return { pages, hasDraft, slug: tenant?.slug ?? null };
}
```

- **Pros:** 33% fewer queries, no API changes needed
- **Cons:** New helper function to maintain
- **Effort:** Medium (1-2 hours to update all tools/executors)
- **Risk:** Low

## Technical Details

**Affected Files:**

- `server/src/agent/tools/utils.ts` - Add new helper
- `server/src/agent/tools/storefront-tools.ts` - Update 8 tools
- `server/src/agent/executors/storefront-executors.ts` - Update 7 executors

## Acceptance Criteria

- [ ] Combined helper created
- [ ] All tools use combined helper
- [ ] All executors use combined helper
- [ ] Tests still pass
- [ ] Query count reduced from 3 to 2 per operation

## Work Log

| Date       | Action                                 | Learnings                                 |
| ---------- | -------------------------------------- | ----------------------------------------- |
| 2026-01-05 | Created from multi-agent code review  | Fetch related data in single query        |
