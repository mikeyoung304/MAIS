---
status: pending
priority: p2
issue_id: '725'
tags:
  - code-review
  - dry
  - architecture
dependencies:
  - '724'
---

# P2: Duplicate publish/discard Logic in Service vs Executor

## Problem Statement

The `LandingPageService.publishBuildModeDraft()` and `discardBuildModeDraft()` methods contain nearly identical logic to the `publish_draft` and `discard_draft` executors. This duplication risks divergence and increases maintenance burden.

## Findings

**Location:**

- `server/src/services/landing-page.service.ts` (lines 466-521, 533-560)
- `server/src/agent/executors/storefront-executors.ts` (lines 566-640, 646-688)

**Duplication in publishBuildModeDraft:**
Both implementations:

1. Query tenant to get draft
2. Check if draft exists, throw error if not
3. Count sections for audit log
4. Build wrapper format with `published` property
5. Update both `landingPageConfig` and clear `landingPageConfigDraft`
6. Log the operation
7. Return result with preview URL

**Duplication in discardBuildModeDraft:**
Both implementations:

1. Query tenant to check draft exists
2. Throw error if no draft
3. Clear `landingPageConfigDraft`
4. Log the operation
5. Return success result

**Impact:**

- Changes to publish format must be made in two places
- Wrapper format `{ draft, published }` defined in two locations
- Risk of format divergence causing silent failures

## Proposed Solutions

### Option A: Executor Delegates to Service (Recommended)

**Effort:** Medium (45 min)
**Risk:** Medium

Modify executors to call service methods:

```typescript
// In storefront-executors.ts
const publishDraftExecutor = async (tenantId: string, _params: unknown) => {
  // Get service from DI container
  const landingPageService = container.get<LandingPageService>('landingPageService');
  const result = await landingPageService.publishBuildModeDraft(tenantId);
  return {
    action: result.action,
    previewUrl: result.previewUrl,
    note: result.note,
  };
};
```

**Pros:**

- Single source of truth
- Service can add validation/audit logic in one place

**Cons:**

- Requires DI container access in executors
- May need executor-registry pattern adjustment

### Option B: Extract Shared Utility

**Effort:** Medium (30 min)
**Risk:** Low

Extract the publish wrapper format logic to a utility:

```typescript
// In lib/landing-page-utils.ts
export function createPublishedWrapper(draftConfig: LandingPageConfig) {
  return {
    draft: null,
    draftUpdatedAt: null,
    published: draftConfig,
    publishedAt: new Date().toISOString(),
  };
}
```

Both service and executor import this utility.

## Recommended Action

<!-- Filled during triage -->

## Technical Details

**Affected Files:**

- `server/src/services/landing-page.service.ts`
- `server/src/agent/executors/storefront-executors.ts`
- Potentially: `server/src/lib/landing-page-utils.ts` (new file)

**Components:**

- Landing page service
- Storefront executors
- AI tool execution flow

## Acceptance Criteria

- [ ] Single source of truth for publish wrapper format
- [ ] Single source of truth for discard logic
- [ ] Agent publish/discard tools work correctly
- [ ] REST API publish/discard work correctly (when implemented)
- [ ] Existing tests pass

## Work Log

| Date       | Action                   | Learnings                                                   |
| ---------- | ------------------------ | ----------------------------------------------------------- |
| 2026-01-10 | Created from code review | Code-simplicity-reviewer identified parallel implementation |

## Resources

- Code simplicity review agent findings
- Related: #724 (duplicate getBuildModeDraft)
