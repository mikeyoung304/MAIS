---
status: ready
priority: p2
issue_id: "442"
tags: [code-review, ux, error-handling, agent-tools]
dependencies: []
---

# Generic Error Messages Should Be More Specific

## Problem Statement

Several tool errors return generic messages like "Operation failed" without actionable context for the AI agent to understand and communicate to users.

**Why it matters:**
- Agent can't provide helpful error explanations
- Debugging is harder
- User experience suffers

## Findings

- **Location:** Multiple locations in `read-tools.ts` and `write-tools.ts`
- Errors often just pass through or use generic text
- Missing: what failed, why, what to try instead
- Agent needs context to help users

## Proposed Solutions

### Option A: Add Contextual Error Messages (Recommended)

**Approach:** Enhance error messages with context.

**Pros:**
- Better agent responses
- Easier debugging

**Cons:**
- More code per error path

**Effort:** Medium (2-3 hours)

**Risk:** Low

---

### Option B: Error Code System

**Approach:** Add error codes that map to detailed messages.

**Pros:**
- Consistent error format

**Cons:**
- More infrastructure

**Effort:** Large (4+ hours)

**Risk:** Low

## Recommended Action

<!-- Filled during triage -->

## Technical Details

**Affected files:**
- `server/src/agent/tools/read-tools.ts`
- `server/src/agent/tools/write-tools.ts`
- `server/src/agent/executors/index.ts`

**Database changes:** None

## Acceptance Criteria

- [ ] Error messages include context (what, why)
- [ ] Agent can explain errors to users
- [ ] Tests pass

## Work Log

### 2025-12-26 - Initial Discovery

**By:** architecture-strategist agent

**Actions:**
- Reviewed error handling patterns

**Learnings:**
- Agent-native apps need rich error context
