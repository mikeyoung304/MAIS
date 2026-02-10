---
status: pending
priority: p3
issue_id: '5259'
tags: [code-review, future-enhancement, pr-44]
dependencies: ['5245']
---

# Monitor helper functions scoped to single file for extraction

## Problem Statement

Helper functions defined as file-scoped in booking.routes.ts:64 and marketing.routes.ts:106. If they grow or need sharing across domains, should extract to utils.

## Findings

- File-scoped helper functions:
  - `server/src/routes/internal-agent/booking.routes.ts:64`
  - `server/src/routes/internal-agent/marketing.routes.ts:106`
- Current scope is appropriate for single-use functions
- No duplication detected yet
- Functions are simple and domain-specific

## Proposed Solutions

### Option 1: Monitor for duplication

**Approach:** Wait for duplication or growth before extracting. Add comment noting to extract if needed elsewhere.

**Pros:**

- Avoids premature abstraction
- Current scope is clear
- Simpler to understand

**Cons:**

- Might miss extraction opportunity

**Effort:** 0 minutes

**Risk:** None

### Option 2: Proactively extract

**Approach:** Extract to shared utilities now

**Pros:**

- Ready if needed elsewhere

**Cons:**

- Premature abstraction
- Reduces clarity if only used in one place

**Effort:** 30 minutes

**Risk:** Low

## Recommended Action

**To be filled during triage.** Recommend Option 1 (monitor). Extract only if duplication appears or functions grow complex.

## Technical Details

**Affected files:**

- `server/src/routes/internal-agent/booking.routes.ts:64` - helper function
- `server/src/routes/internal-agent/marketing.routes.ts:106` - helper function

**Dependencies:**

- Wait for #5245 (schema centralization) to complete before evaluating extraction

## Resources

- **PR:** #44
- **Related:** #5245 (schema centralization)

## Acceptance Criteria

- [ ] Monitor helper functions during future changes
- [ ] Extract if duplication appears
- [ ] Extract if functions grow complex (>20 lines)

## Work Log

### 2026-02-09 - Initial Discovery

**By:** Claude Code

**Actions:**

- Identified during PR #44 code review
- Noted current scope is appropriate
- Documented to monitor for future extraction need

## Notes

- Very low priority: current pattern is good
- Extract only if clear benefit emerges
- DEPENDS ON #5245 - wait for schema patterns to solidify
