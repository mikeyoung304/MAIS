---
status: pending
priority: p3
issue_id: '5264'
tags: [code-review, architecture, pr-44]
dependencies: []
---

# Review vocabulary resolution endpoint placement

## Problem Statement

`/vocabulary/resolve` endpoint placement is ambiguous (marketing.routes.ts:761). Maps phrases to BlockType enums. Placed in marketing domain but it's domain vocabulary, not marketing copy.

## Findings

- Endpoint at `server/src/routes/internal-agent/marketing.routes.ts:761`
- Functionality: Maps user phrases to technical BlockType enums
- Examples: "about section" → `ABOUT`, "services" → `SERVICES`
- Seems more like domain vocabulary than marketing functionality
- Unclear which agent tools use this endpoint
- Current placement is functional, just semantically unclear

## Proposed Solutions

### Option 1: Move to discovery domain

**Approach:** Move endpoint to discovery.routes.ts if it's about discovering content structure

**Pros:**

- Better semantic fit if used for content discovery

**Cons:**

- Requires understanding actual usage first

**Effort:** 30 minutes

**Risk:** Low

### Option 2: Create dedicated vocabulary.routes.ts

**Approach:** New domain file for vocabulary/terminology resolution

**Pros:**

- Clear separation of concerns
- Room for related vocabulary endpoints

**Cons:**

- Adds another domain file
- Only one endpoint currently

**Effort:** 1 hour

**Risk:** Low

### Option 3: Keep in marketing domain

**Approach:** Leave as-is, add clarifying comment

**Pros:**

- Already works
- No refactor needed

**Cons:**

- Semantically unclear placement

**Effort:** 5 minutes

**Risk:** None

## Recommended Action

**To be filled during triage.** Research agent tool usage first, then decide placement based on affinity.

## Technical Details

**Affected files:**

- Current: `server/src/routes/internal-agent/marketing.routes.ts:761`
- Potential: `server/src/routes/internal-agent/discovery.routes.ts` (Option 1)
- Potential: `server/src/routes/internal-agent/vocabulary.routes.ts` (Option 2)

**Related components:**

- Agent tools that call `/vocabulary/resolve`
- BlockType enum definitions

**Research needed:**

- Which agent tools use this endpoint?
- What is the usage pattern?
- Are there other vocabulary-related endpoints?

## Resources

- **PR:** #44

## Acceptance Criteria

- [ ] Research agent tool usage
- [ ] Determine best domain placement
- [ ] Move endpoint if needed
- [ ] Update agent tool calls if endpoint path changes
- [ ] All tests pass

## Work Log

### 2026-02-09 - Initial Discovery

**By:** Claude Code

**Actions:**

- Identified during PR #44 code review
- Noted semantic ambiguity of placement
- Documented need to research usage patterns

## Notes

- Low priority: current placement is functional
- Semantic clarity improvement is nice-to-have
- Research usage before deciding on move
- Consider creating vocabulary domain if more endpoints added
