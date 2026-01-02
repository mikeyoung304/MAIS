---
status: open
priority: p1
issue_id: '586'
tags: [code-review, simplicity, dead-code, agent-eval]
dependencies: []
created_at: 2026-01-02
---

# P1: Dead Code - Entire Feedback Module Unused

> **Simplicity Review:** The entire feedback module (~400 lines) is never imported anywhere in the codebase.

## Problem Statement

The entire `server/src/agent/feedback/` module is exported but never imported anywhere:

- `ReviewQueue` class - never used
- `ReviewActionService` class - never used
- `ImplicitFeedbackAnalyzer` class - never used

**Evidence:** Grep for `import.*from.*feedback` returns zero results.

Similarly, `EvalPipeline` is never instantiated:

**Evidence:** Grep for `EvalPipeline|createEvalPipeline` only shows:

- The definition file itself
- The index.ts export
- Planning documents (`.md` files)

**Impact:** ~800 lines of dead code (feedback ~400 + pipeline ~400) increases maintenance burden without providing value.

## Findings

| Reviewer          | Finding                                          |
| ----------------- | ------------------------------------------------ |
| Simplicity Review | P1: Dead Code - Entire feedback module is unused |
| Simplicity Review | P1: Dead Code - EvalPipeline is never used       |

## Proposed Solution

**Option A: Wire up the modules**
Add routes/services that use the feedback and pipeline modules:

- Create `/v1/tenant/admin/reviews` routes
- Create evaluation cron job
- Wire EvalPipeline into di.ts

**Option B: Remove until needed**
Move to `_future/` or `_wip/` directory until there's a concrete use case.

**Recommendation:** These modules were built for Phase 5 of the agent-evaluation-system plan. They should be wired up before considering complete, or explicitly marked as "implementation ready, not integrated".

## Acceptance Criteria

Either:

- [ ] Feedback module wired into routes (Option A)
- [ ] EvalPipeline wired into scheduled job (Option A)

Or:

- [ ] Modules moved to `_future/` directory (Option B)
- [ ] CLAUDE.md updated to note status

## Work Log

| Date       | Action                         | Learnings                                |
| ---------- | ------------------------------ | ---------------------------------------- |
| 2026-01-02 | Created from /workflows:review | Simplicity reviewer identified dead code |
