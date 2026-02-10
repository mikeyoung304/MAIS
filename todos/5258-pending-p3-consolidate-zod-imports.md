---
status: pending
priority: p3
issue_id: '5258'
tags: [code-review, duplication, pr-44]
dependencies: []
---

# Consolidate redundant Zod imports across domain files

## Problem Statement

Five domain files import `z` from 'zod'. Node caching eliminates redundant loading, but slight duplication.

## Findings

- 5 domain route files each import Zod:
  - `server/src/routes/internal-agent/booking.routes.ts`
  - `server/src/routes/internal-agent/discovery.routes.ts`
  - `server/src/routes/internal-agent/marketing.routes.ts`
  - `server/src/routes/internal-agent/projects.routes.ts`
  - `server/src/routes/internal-agent/storefront.routes.ts`
- Node module caching eliminates performance impact
- Standard pattern across entire codebase

## Proposed Solutions

### Option 1: Re-export Zod from shared module

**Approach:** Add `export { z } from 'zod';` to internal-agent-shared.ts

**Pros:**

- Single import per file
- Slight duplication reduction

**Cons:**

- Adds indirection
- Non-standard pattern for Zod

**Effort:** 10 minutes

**Risk:** Low

### Option 2: Keep current pattern

**Approach:** Leave explicit Zod imports as-is

**Pros:**

- Standard across entire codebase
- Clear and explicit
- IDE autocomplete works better

**Cons:**

- Slight duplication

**Effort:** 0 minutes

**Risk:** None

## Recommended Action

**To be filled during triage.** Recommend Option 2 (keep current pattern) - explicit Zod imports are standard.

## Technical Details

**Affected files:**

- 5 domain route files listed above
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
- Noted standard pattern across codebase

## Notes

- Very low priority: current pattern is standard
- Consider only if shared module adds Zod utility constants
- Explicit imports are standard for widely-used libraries like Zod
