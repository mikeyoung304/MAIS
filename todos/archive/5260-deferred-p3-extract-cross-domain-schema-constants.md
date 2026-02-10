---
status: pending
priority: p3
issue_id: '5260'
tags: [code-review, architecture, pr-44]
dependencies: ['5244']
---

# Extract cross-domain Zod schema constants to shared module

## Problem Statement

Each domain still has 6-9 domain-specific Zod schemas. Shared module (internal-agent-shared.ts:161) could extract common Zod utility constants if patterns emerge.

## Findings

- Each domain file defines 6-9 schemas:
  - Request validation schemas
  - Response schemas
  - Domain-specific types
- Most schemas are domain-specific, not duplicates
- Shared module exists at `server/src/routes/internal-agent/internal-agent-shared.ts:161`
- Current duplication may be domain-specific, not true duplication

## Proposed Solutions

### Option 1: Wait for patterns to solidify

**Approach:** Monitor for genuine cross-domain schema patterns. Extract only when clear duplication emerges.

**Pros:**

- Avoids premature abstraction
- Maintains domain clarity
- Easier to understand domain-specific schemas

**Cons:**

- Might miss consolidation opportunity

**Effort:** 0 minutes

**Risk:** None

### Option 2: Extract common schema utilities now

**Approach:** Identify and extract common Zod patterns to shared module

**Pros:**

- Reduces duplication if patterns exist

**Cons:**

- Premature if schemas are truly domain-specific
- Could reduce clarity

**Effort:** 2-3 hours

**Risk:** Medium (could reduce clarity)

## Recommended Action

**To be filled during triage.** Recommend Option 1 (wait for patterns). Wait for #5244 to identify genuine shared patterns.

## Technical Details

**Affected files:**

- All 6 domain route files with schema definitions
- `server/src/routes/internal-agent/internal-agent-shared.ts:161` - potential extraction target

**Dependencies:**

- DEPENDS ON #5244 (schema pattern analysis) - wait for analysis to complete

## Resources

- **PR:** #44
- **Related:** #5244 (schema pattern analysis)

## Acceptance Criteria

- [ ] #5244 complete - schema patterns analyzed
- [ ] Decision made: extract or keep domain-specific
- [ ] If extracted: tests verify behavior unchanged

## Work Log

### 2026-02-09 - Initial Discovery

**By:** Claude Code

**Actions:**

- Identified during PR #44 code review
- Counted 6-9 schemas per domain file
- Noted current duplication may be domain-specific
- Flagged dependency on #5244

## Notes

- Low priority: current pattern maintains domain clarity
- DEPENDS ON #5244 - schema pattern analysis must complete first
- Premature extraction could reduce code clarity
- Wait for genuine cross-domain patterns to emerge
