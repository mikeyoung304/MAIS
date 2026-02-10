---
status: pending
priority: p3
issue_id: '5261'
tags: [code-review, testing, pr-44]
dependencies: []
---

# Test aggregator mount order and add runtime assertions

## Problem Statement

Aggregator mount order has undocumented path conflict risk in internal-agent.routes.ts:44-51. Comment explains order matters but unclear WHY. Either real Express subtlety or misleading comment.

## Findings

- Mount order comment at `server/src/routes/internal-agent/internal-agent.routes.ts:44-51`
- Comment says "order matters for path matching"
- Unclear if this is real Express behavior or outdated comment
- No test coverage for mount order
- No runtime assertion to fail-fast if order is wrong

## Proposed Solutions

### Option 1: Test and document

**Approach:**

1. Write test that reverses mount order
2. Verify if order actually matters
3. If yes: add runtime assertion and detailed comment
4. If no: remove misleading comment

**Pros:**

- Clarifies actual behavior
- Adds test coverage
- Removes ambiguity

**Cons:**

- Requires investigation time

**Effort:** 1 hour

**Risk:** Low

### Option 2: Add runtime assertion now

**Approach:** Add assertion that verifies mount order, assume comment is correct

**Pros:**

- Fail-fast if order changes
- Quick solution

**Cons:**

- Doesn't verify if assertion is needed

**Effort:** 15 minutes

**Risk:** Low

## Recommended Action

**To be filled during triage.** Recommend Option 1 (test and document) for clarity.

## Technical Details

**Affected files:**

- `server/src/routes/internal-agent/internal-agent.routes.ts:44-51` - aggregator mount logic

**Related components:**

- Express router path matching
- All domain route handlers

**Test scenarios:**

- Mount domains in different orders
- Verify path matching behavior
- Check for conflicts

## Resources

- **PR:** #44
- **Express docs:** Router mounting and path precedence

## Acceptance Criteria

- [ ] Test written for mount order
- [ ] Behavior documented (matters or doesn't matter)
- [ ] If matters: runtime assertion added
- [ ] If doesn't matter: misleading comment removed
- [ ] All tests pass

## Work Log

### 2026-02-09 - Initial Discovery

**By:** Claude Code

**Actions:**

- Identified during PR #44 code review
- Found ambiguous comment about mount order
- No test coverage for path conflict scenarios

## Notes

- Low priority: system works currently
- Clarification would improve maintainability
- Express routing behavior should be tested, not assumed
