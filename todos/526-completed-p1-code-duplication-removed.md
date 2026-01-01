---
status: pending
priority: p1
issue_id: "526"
tags: [code-review, agent-ecosystem, refactoring, tech-debt]
dependencies: ["524"]
---

# Massive Code Duplication Between Legacy and New Orchestrators

## Problem Statement

There's ~1300 lines of duplicated code between the legacy `orchestrator.ts` (1340 lines) and the new `base-orchestrator.ts` (993 lines). Both contain identical implementations of core methods.

**Why it matters:**
- Double maintenance burden - bugs fixed in one may not be fixed in the other
- Inconsistent behavior between routes using different orchestrators
- Increases cognitive load for developers

## Findings

### Evidence from Pattern Recognition (CRITICAL)

> "`orchestrator.ts` (1340 lines) duplicates almost all of `base-orchestrator.ts` (993 lines). Both contain identical implementations of:
> - `parseChatMessages()` (lines 56-69 in orchestrator.ts, 144-157 in base)
> - `withTimeout()` (lines 315-336 in orchestrator.ts, 162-183 in base)
> - `processResponse()` method (~200 lines duplicated)
> - `SYSTEM_PROMPT_TEMPLATE` (261 lines duplicated)
> - `WRITE_TOOLS` set (identical in both files)"

### Duplicated Components

| Component | orchestrator.ts | base-orchestrator.ts |
|-----------|-----------------|---------------------|
| parseChatMessages() | lines 56-69 | lines 144-157 |
| withTimeout() | lines 315-336 | lines 162-183 |
| processResponse() | ~200 lines | ~200 lines |
| SYSTEM_PROMPT_TEMPLATE | 261 lines | N/A (in admin) |
| WRITE_TOOLS | identical | identical |

## Proposed Solutions

### Option A: Complete Migration and Delete Legacy (Recommended)
**Pros:** Eliminates duplication, single source of truth
**Cons:** Breaking change if anything depends on legacy
**Effort:** Medium
**Risk:** Medium (needs testing)

1. Complete migration (see #524)
2. Delete `server/src/agent/orchestrator/orchestrator.ts`
3. Delete `server/src/agent/customer/customer-orchestrator.ts`
4. Remove legacy exports from `index.ts`

### Option B: Mark as Deprecated
**Pros:** Non-breaking, gradual transition
**Cons:** Duplication remains temporarily
**Effort:** Small
**Risk:** Low

Add `@deprecated` JSDoc and console warnings.

## Recommended Action

<!-- To be filled during triage -->

## Technical Details

**Files to Delete (after migration):**
- `server/src/agent/orchestrator/orchestrator.ts` (1340 lines)
- `server/src/agent/customer/customer-orchestrator.ts` (698 lines)

**Total Lines to Remove:** ~2000 lines of duplicated code

## Acceptance Criteria

- [ ] Only one orchestrator implementation exists
- [ ] All routes use the new orchestrator hierarchy
- [ ] Legacy files deleted or clearly deprecated
- [ ] No duplicate code
- [ ] Tests pass

## Work Log

| Date | Action | Learnings |
|------|--------|-----------|
| 2026-01-01 | Created from code review | Duplication creates maintenance burden |

## Resources

- Code review: Agent Ecosystem Phase 3-4
- Dependency: #524 (migrate routes first)
