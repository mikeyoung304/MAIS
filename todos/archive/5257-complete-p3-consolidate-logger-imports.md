---
status: pending
priority: p3
issue_id: '5257'
tags: [code-review, duplication, pr-44]
dependencies: []
---

# Consolidate redundant logger imports across domain files

## Problem Statement

All 6 split files import `logger` individually. Node caches module so no performance impact, but slight duplication.

## Findings

- 6 domain route files each import logger:
  - `server/src/routes/internal-agent/booking.routes.ts`
  - `server/src/routes/internal-agent/discovery.routes.ts`
  - `server/src/routes/internal-agent/marketing.routes.ts`
  - `server/src/routes/internal-agent/projects.routes.ts`
  - `server/src/routes/internal-agent/storefront.routes.ts`
  - `server/src/routes/internal-agent/research.routes.ts`
- Node module caching eliminates performance impact
- Current pattern is explicit and clear

## Proposed Solutions

### Option 1: Re-export logger from shared module

**Approach:** Add `export { logger } from '@/lib/logger';` to internal-agent-shared.ts

**Pros:**

- Single import statement per file
- Slight reduction in duplication

**Cons:**

- Adds indirection
- Minimal benefit

**Effort:** 10 minutes

**Risk:** Low

### Option 2: Keep current pattern

**Approach:** Leave explicit logger imports as-is

**Pros:**

- Clear and explicit
- Standard pattern across codebase

**Cons:**

- Slight duplication

**Effort:** 0 minutes

**Risk:** None

## Recommended Action

**To be filled during triage.** Consider Option 2 (keep current pattern) unless shared module grows with more utilities.

## Technical Details

**Affected files:**

- All 6 domain route files listed above
- `server/src/routes/internal-agent/internal-agent-shared.ts` - potential re-export location

## Resources

- **PR:** #44

## Acceptance Criteria

- [ ] Decision made: consolidate or keep current pattern
- [ ] If consolidated: all imports updated
- [ ] If consolidated: all tests pass

## Work Log

### 2026-02-09 - Initial Discovery

**By:** Claude Code

**Actions:**

- Identified during PR #44 code review
- Confirmed Node module caching eliminates performance concern

## Notes

- Very low priority: current pattern is acceptable
- Consider only if shared module adds more utilities
- Explicit imports are clearer for security-critical code
