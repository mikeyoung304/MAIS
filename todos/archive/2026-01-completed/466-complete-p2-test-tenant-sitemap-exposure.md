---
status: complete
priority: p2
issue_id: '466'
tags: [code-review, test-data-isolation, security]
dependencies: []
---

# P2: `listActive()` Exposes Test Tenants in Sitemap

## Problem Statement

The `listActive()` method used for sitemap generation doesn't filter test tenants. Test tenant slugs may appear in public sitemaps, exposing internal test data to search engines.

**Why it matters:** SEO exposure of test tenants, potential information disclosure.

## Findings

### Discovery 1: Missing filter in listActive()

**Source:** Architecture Review Agent
**Location:** `server/src/adapters/prisma/tenant.repository.ts` lines 295-301

```typescript
async listActive(): Promise<{ slug: string; updatedAt: Date }[]> {
  return await this.prisma.tenant.findMany({
    where: { isActive: true },
    // Missing: isTestTenant: false
  });
}
```

## Proposed Solutions

### Solution 1: Add isTestTenant Filter (Recommended)

**Effort:** Tiny | **Risk:** None

```typescript
async listActive(): Promise<{ slug: string; updatedAt: Date }[]> {
  return await this.prisma.tenant.findMany({
    where: {
      isActive: true,
      isTestTenant: false,  // ADD THIS
    },
    select: { slug: true, updatedAt: true },
    orderBy: { updatedAt: 'desc' },
  });
}
```

## Recommended Action

<!-- Filled during triage -->

## Technical Details

**Affected Files:**

- `server/src/adapters/prisma/tenant.repository.ts` - `listActive()` method

**Database Changes:** None

## Acceptance Criteria

- [x] listActive() filters out test tenants
- [x] Sitemap only contains real tenant slugs
- [x] robots.txt not affected

## Work Log

| Date       | Action              | Outcome/Learning                                            |
| ---------- | ------------------- | ----------------------------------------------------------- |
| 2025-12-29 | Architecture review | Sitemap exposes test tenant slugs                           |
| 2025-12-29 | Fixed               | Added `isTestTenant: false` filter to `listActive()` method |

## Resources

- Sitemap route: Check `/sitemap.xml` endpoint
