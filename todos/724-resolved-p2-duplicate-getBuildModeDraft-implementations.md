---
status: resolved
priority: p2
issue_id: '724'
tags:
  - code-review
  - dry
  - architecture
dependencies: []
---

# P2: Duplicate getBuildModeDraft Implementations in Service vs Utils

## Problem Statement

The `LandingPageService.getBuildModeDraft()` and `LandingPageService.getBuildModeDraftWithSlug()` methods are nearly identical to `getDraftConfig()` and `getDraftConfigWithSlug()` in `agent/tools/utils.ts`. This violates DRY principles and creates maintenance burden.

## Findings

**Location:**

- `server/src/services/landing-page.service.ts` (lines 299-347, 359-426)
- `server/src/agent/tools/utils.ts` (lines 152-207, 249-328)

**Duplication:**
Both implementations:

1. Query tenant by ID
2. Check for draft config, validate with Zod
3. Fall back to live config, validate with Zod
4. Fall back to `DEFAULT_PAGES_CONFIG`
5. Return pages config with `hasDraft` flag

**Key Differences:**

- Service throws `NotFoundError`, utilities throw generic `Error`
- Service doesn't include `rawDraftConfig`/`rawLiveConfig` in base method
- ~95% code similarity

**Impact:**

- Maintenance burden: Changes must be made in two places
- Risk of divergence: Subtle differences could cause bugs
- Cognitive load: Developers must understand two implementations

## Resolution

**Approach:** Option A - Delete Unused Service Methods

Verified that `LandingPageService.getBuildModeDraft()` and `getBuildModeDraftWithSlug()` were NOT called from production code - only from tests. Agent tools use `utils.ts` directly because they need `PrismaClient` for transaction patterns (TOCTOU prevention).

**Changes Made:**

1. Removed `getBuildModeDraft()` method from `landing-page.service.ts`
2. Removed `getBuildModeDraftWithSlug()` method from `landing-page.service.ts`
3. Removed unused type exports `BuildModeDraftResult` and `BuildModeDraftWithSlugResult`
4. Removed unused imports (`DEFAULT_PAGES_CONFIG`, `PagesConfig`)
5. Added comment documenting `agent/tools/utils.ts` as canonical implementation
6. Removed corresponding tests from `landing-page.service.test.ts`
7. Cleaned up unused test imports (`NotFoundError`, `DEFAULT_PAGES_CONFIG`)

**Canonical Implementation:**

- `getDraftConfig()` and `getDraftConfigWithSlug()` in `server/src/agent/tools/utils.ts`
- These accept `PrismaClient` directly for transaction support (TOCTOU prevention)
- Types: `DraftConfigResult`, `DraftConfigWithSlugResult`

## Technical Details

**Affected Files:**

- `server/src/services/landing-page.service.ts` - Removed ~128 lines
- `server/test/services/landing-page.service.test.ts` - Removed ~82 lines of tests

**Components:**

- Landing page service
- Agent tool utilities

## Acceptance Criteria

- [x] Single source of truth for draft config retrieval logic
- [x] Agent tools continue to work correctly
- [x] No regression in validation behavior
- [x] Existing tests pass

## Work Log

| Date       | Action                   | Learnings                                                                        |
| ---------- | ------------------------ | -------------------------------------------------------------------------------- |
| 2026-01-10 | Created from code review | Code-simplicity-reviewer and architecture-strategist both identified duplication |
| 2026-01-10 | Resolved via Option A    | Service methods were unused; utils.ts needs PrismaClient for transactions        |

## Resources

- Code simplicity review agent findings
- Architecture review agent findings
