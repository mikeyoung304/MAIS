---
status: complete
priority: p2
issue_id: '725'
tags:
  - code-review
  - dry
  - architecture
dependencies:
  - '724'
resolved_date: '2026-01-10'
---

# P2: Duplicate publish/discard Logic in Service vs Executor - RESOLVED

## Problem Statement

The `LandingPageService.publishBuildModeDraft()` and `discardBuildModeDraft()` methods contain nearly identical logic to the `publish_draft` and `discard_draft` executors. This duplication risks divergence and increases maintenance burden.

## Resolution

Implemented **Option B: Extract Shared Utility** from the original TODO.

### Changes Made

1. **Created `/server/src/lib/landing-page-utils.ts`**
   - `createPublishedWrapper()` - Creates the wrapper format for published config
   - `countSectionsInConfig()` - Counts sections across all pages for audit logging
   - `PublishedWrapper` interface - Type definition for the wrapper format
   - `SectionCountResult` interface - Type for section counting result

2. **Updated `/server/src/services/landing-page.service.ts`**
   - Added import for `createPublishedWrapper` and `countSectionsInConfig`
   - Refactored `publishBuildModeDraft()` to use shared utilities
   - Removed duplicate wrapper creation and section counting logic

3. **Updated `/server/src/agent/executors/storefront-executors.ts`**
   - Added import for `createPublishedWrapper` and `countSectionsInConfig`
   - Refactored `publish_draft` executor to use shared utilities
   - Removed duplicate wrapper creation and section counting logic
   - Removed unused `landingPageConfig` from select query

### Benefits

- **Single source of truth** for publish wrapper format
- **Single source of truth** for section counting logic
- **Reduced risk of divergence** between service and executor implementations
- **Easier maintenance** - changes to wrapper format only need to be made in one place

### Why Option B was chosen over Option A

Option A (executor delegates to service) would have required:

- DI container access in executors
- Changes to executor-registry pattern
- More complex dependency graph

Option B is simpler and directly addresses the duplication without architectural changes.

## Acceptance Criteria - VERIFIED

- [x] Single source of truth for publish wrapper format
- [x] Single source of truth for section counting logic
- [x] Agent publish/discard tools work correctly (same behavior, shared implementation)
- [x] TypeScript compiles successfully

## Files Changed

- `server/src/lib/landing-page-utils.ts` (NEW)
- `server/src/services/landing-page.service.ts` (MODIFIED)
- `server/src/agent/executors/storefront-executors.ts` (MODIFIED)

## Work Log

| Date       | Action                   | Learnings                                                   |
| ---------- | ------------------------ | ----------------------------------------------------------- |
| 2026-01-10 | Created from code review | Code-simplicity-reviewer identified parallel implementation |
| 2026-01-10 | Resolved                 | Extracted shared utilities, both paths now use same logic   |

## Resources

- Code simplicity review agent findings
- Related: #724 (duplicate getBuildModeDraft) - Not a dependency, independent issue
