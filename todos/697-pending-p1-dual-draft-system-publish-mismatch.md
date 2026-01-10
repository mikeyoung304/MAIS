---
status: pending
priority: p1
issue_id: '697'
tags: [code-review, architecture, data-integrity, landing-page]
dependencies: []
---

# Dual Draft System: Publish Executor Doesn't Use Wrapper Format

## Problem Statement

The codebase has **two incompatible draft systems** for landing page configuration:

1. **System A (Agent/Build Mode)**: Uses separate `landingPageConfigDraft` column
2. **System B (Repository/Admin API)**: Uses wrapper format `{draft, published}` inside `landingPageConfig`

The `publish_draft` executor copies from System A directly to `landingPageConfig`, bypassing the wrapper format that `findBySlugPublic` expects. Result: AI says content is "live" but public storefront shows placeholders.

**User Impact:** Users are told their changes are published when they actually can't see them on the live site.

## Findings

### Root Cause Chain

1. AI writes to `landingPageConfigDraft` via storefront executors
2. `publish_draft` executor copies `landingPageConfigDraft` → `landingPageConfig` (direct copy)
3. `findBySlugPublic()` → `extractPublishedLandingPage()` looks for `landingPageConfig.published`
4. Since step 2 wrote direct config (not wrapper), `published` field doesn't exist
5. Fallback to legacy format parsing fails or returns null
6. Public API returns empty branding: `{}`

### Evidence

**Executor (storefront-executors.ts:606-613):**

```typescript
await prisma.tenant.update({
  where: { id: tenantId },
  data: {
    landingPageConfig: tenant.landingPageConfigDraft, // Direct copy!
    landingPageConfigDraft: Prisma.DbNull,
  },
});
```

**Repository expects wrapper (tenant.repository.ts:710-722):**

```typescript
private extractPublishedLandingPage(config: unknown): LandingPageConfig | null {
  const wrapper = this.getLandingPageWrapper(config);
  if (wrapper.published) { // Expects this field!
    return LandingPageConfigSchema.safeParse(wrapper.published)...
  }
}
```

## Proposed Solutions

### Option A: Fix Executor to Use Wrapper Format (Recommended)

**Pros:** Minimal change, fixes immediate bug
**Cons:** Maintains dual-system complexity
**Effort:** Small (1-2 hours)
**Risk:** Low

```typescript
// publish_draft executor fix
const newWrapper = {
  draft: null,
  draftUpdatedAt: null,
  published: tenant.landingPageConfigDraft,
  publishedAt: new Date().toISOString(),
};
await prisma.tenant.update({
  data: {
    landingPageConfig: newWrapper,
    landingPageConfigDraft: Prisma.DbNull,
  },
});
```

### Option B: Consolidate to System A (Separate Columns)

**Pros:** Cleaner architecture, no wrapper complexity
**Cons:** Requires migration, updates to repository methods
**Effort:** Large (1-2 days)
**Risk:** Medium

- Update `extractPublishedLandingPage` to read directly from `landingPageConfig`
- Migrate repository publish/discard methods to use separate column
- Deprecate wrapper-based methods

### Option C: Create LandingPageService Abstraction

**Pros:** Single source of truth, clean API
**Cons:** Significant refactor
**Effort:** Large (2-3 days)
**Risk:** Medium

- Create service that encapsulates all read/write operations
- Both AI tools and repository use the same service
- Handles format translation internally

## Recommended Action

**Option A** - Fix the immediate bug by updating the executor to write wrapper format.

Then follow up with Option C as a separate todo (create LandingPageService).

## Technical Details

### Affected Files

- `server/src/agent/executors/storefront-executors.ts` (lines 606-613)
- `server/src/adapters/prisma/tenant.repository.ts` (lines 710-722, 937-976)
- `server/src/agent/tools/utils.ts` (getDraftConfig functions)

### Testing Required

- [ ] E2E: AI creates draft → publishes → public storefront shows content
- [ ] Unit: publish_draft executor writes wrapper format
- [ ] Unit: extractPublishedLandingPage reads wrapper format
- [ ] Integration: Full publish flow with both AI and admin API paths

## Acceptance Criteria

- [ ] After AI publishes, public storefront shows the published content
- [ ] `branding.landingPage` is present in public tenant API response
- [ ] No "Invalid tenant data" validation warnings in logs
- [ ] Both AI and admin API publish paths result in same data format

## Work Log

| Date       | Action                                      | Learnings                                          |
| ---------- | ------------------------------------------- | -------------------------------------------------- |
| 2026-01-10 | Code review discovered dual-system mismatch | Executor writes direct, repository expects wrapper |

## Resources

- Related PR: N/A (bug in existing code)
- Architecture review findings: agent a31637a
- Data integrity review: agent a4342eb
