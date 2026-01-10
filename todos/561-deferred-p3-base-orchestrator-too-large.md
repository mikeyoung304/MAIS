---
status: deferred
priority: p3
issue_id: '561'
deferred_reason: Pure refactoring with no functional impact - invest in security/data issues first
deferred_until: When adding major agent features that would benefit from the split
tags: [code-review, simplicity, agent-ecosystem, refactoring, quality-first-triage]
dependencies: ['548']
---

# P1: base-orchestrator.ts (1100 lines) Should Be Split

> **Quality-First Triage Upgrade:** P3 → P1. "7 distinct responsibilities in one file. Violates SRP. Exponentially harder changes."

## Problem Statement

The `base-orchestrator.ts` file is doing too much at 1,111 lines:

- Session management (lines 282-374)
- Chat processing (lines 379-575)
- Proposal execution (lines 584-704)
- Message building (lines 709-728)
- Response processing with tool calls (lines 733-997)
- Session updates (lines 1002-1045)
- Circuit breaker cleanup (lines 1072-1110)

**Why it matters:** Large files are harder to navigate, test, and maintain.

## Findings

| Reviewer            | Finding                  |
| ------------------- | ------------------------ |
| Simplicity Reviewer | P2: File should be split |

## Proposed Solutions

### Option 1: Extract to Focused Modules

**Effort:** Medium (4-6 hours)

Extract into focused modules:

- `session-manager.ts` - Session CRUD (~100 lines)
- `proposal-executor.ts` - Proposal execution (~150 lines)
- `tool-processor.ts` - Tool call processing (~250 lines)

This would leave `base-orchestrator.ts` at ~600 lines focused on orchestration flow.

**Pros:**

- Each file has single responsibility
- Easier to test in isolation
- Clearer architecture

**Cons:**

- Significant refactor
- More imports to manage

### Option 2: Keep As-Is (for now)

**Effort:** None

The file follows a clear flow and is well-organized with sections.

**Pros:**

- No refactor risk
- Everything in one place for context

**Cons:**

- Will only grow larger

## Recommended Action

**DEFERRED** - Pure refactoring with no functional impact. Better to invest time in fixing security/data issues first.

Rationale: While the file is large (1419 lines), it's well-organized and functional. This is technical debt, not a correctness issue. Defer until adding major agent features that would benefit from the split.

## Technical Details

**Affected Files:**

- `server/src/agent/orchestrator/base-orchestrator.ts`
- New files if split

**Suggested Extraction:**
| New File | Lines | Responsibility |
|----------|-------|----------------|
| `session-manager.ts` | ~100 | getOrCreateSession, getSession, updateSession |
| `proposal-executor.ts` | ~150 | executeConfirmedProposals, proposal handling |
| `tool-processor.ts` | ~250 | processResponse, tool execution loop |

## Acceptance Criteria

- [ ] If implemented: Extract session management
- [ ] If implemented: Extract proposal execution
- [ ] If implemented: Extract tool processing
- [ ] All tests pass
- [ ] No behavior changes

## Work Log

| Date       | Action                   | Learnings                                    |
| ---------- | ------------------------ | -------------------------------------------- |
| 2026-01-01 | Created from code review | Simplicity Reviewer flagged as P2, marked P3 |
| 2026-01-10 | **Triage: DEFERRED** | Pure refactoring - no functional impact. Revisit when adding major agent features. |

## Resources

- Single Responsibility Principle
