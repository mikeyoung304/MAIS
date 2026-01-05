---
status: resolved
priority: p1
issue_id: '622'
tags: [code-review, security, build-mode, agent-tools]
dependencies: []
---

# Missing publish_draft and discard_draft from REQUIRED_EXECUTOR_TOOLS

## Problem Statement

The tools `publish_draft` and `discard_draft` have registered executors but are NOT listed in `REQUIRED_EXECUTOR_TOOLS`. This means server startup validation will not catch if these executors are accidentally removed.

**What's broken:** Startup validation incomplete for critical operations
**Why it matters:** Silent runtime failures if executors accidentally removed

## Findings

### Source: Architecture Strategist + Agent-Native Reviewer

**File:** `/server/src/agent/proposals/executor-registry.ts` (lines 84-90)

**Current Code:**

```typescript
// Storefront Build Mode
'update_page_section',
'remove_page_section',
'reorder_page_sections',
'toggle_page_enabled',
'update_storefront_branding',
// MISSING: 'publish_draft', 'discard_draft'
```

**Evidence:**

- `publish_draft` executor registered at `storefront-executors.ts:399`
- `discard_draft` executor registered at `storefront-executors.ts:448`
- Neither appears in REQUIRED_EXECUTOR_TOOLS
- Violates project's P0 prevention pattern from CLAUDE.md

## Proposed Solutions

### Option A: Add missing entries (Recommended)

**Description:** Add both tools to REQUIRED_EXECUTOR_TOOLS array

```typescript
// Storefront Build Mode
'update_page_section',
'remove_page_section',
'reorder_page_sections',
'toggle_page_enabled',
'update_storefront_branding',
'publish_draft',      // ADD
'discard_draft',      // ADD
```

- **Pros:** 2-line fix, matches existing pattern
- **Cons:** None
- **Effort:** Small (2 minutes)
- **Risk:** None

## Technical Details

**Affected Files:**

- `server/src/agent/proposals/executor-registry.ts`

## Acceptance Criteria

- [ ] `publish_draft` added to REQUIRED_EXECUTOR_TOOLS
- [ ] `discard_draft` added to REQUIRED_EXECUTOR_TOOLS
- [ ] Server still starts successfully
- [ ] Existing tests pass

## Work Log

| Date       | Action                               | Learnings                                                        |
| ---------- | ------------------------------------ | ---------------------------------------------------------------- |
| 2026-01-05 | Created from multi-agent code review | Pattern: All write tools MUST be in REQUIRED_EXECUTOR_TOOLS list |

## Resources

- Prevention strategy: `docs/solutions/patterns/BOOKING_LINKS_PHASE_0_PREVENTION_STRATEGIES.md`
- Executor registry: `server/src/agent/proposals/executor-registry.ts`
