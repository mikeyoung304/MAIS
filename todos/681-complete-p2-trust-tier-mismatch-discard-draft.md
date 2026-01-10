---
status: resolved
priority: p2
issue_id: '681'
tags: [code-review, agent-first-architecture, trust-tiers, consistency]
dependencies: []
---

# P2: Trust Tier Mismatch - `discard_draft` T3 vs T2

## Problem Statement

The capability registry marks `discard_draft` as T3 (requires approval) but the backend tool is T2 (soft-confirm). This inconsistency could cause UX confusion where frontend expects hard-confirm dialog but backend auto-confirms.

**Why This Matters:**

- Inconsistent user experience between UI expectations and backend behavior
- Security concern: discarding deletes work (irreversible) - should be T3
- Documentation doesn't match implementation

## Findings

**Agent:** Agent-Native Reviewer

**Locations:**

- Capability registry: `apps/web/src/lib/agent-capabilities.ts` (lines 244-248) - **T3**
- Backend tool: `server/src/agent/tools/storefront-tools.ts` (line 818) - **T2**

## Proposed Solutions

### Option A: Upgrade backend to T3 (Recommended)

- Change `discardDraftTool` trustTier from T2 to T3
- Add `requiresApproval: true` to tool definition
- **Pros:** Consistent, safe (discard is irreversible)
- **Cons:** More friction for users
- **Effort:** Small
- **Risk:** Low

### Option B: Downgrade capability to T2

- Change capability registry to T2
- **Pros:** Matches current behavior
- **Cons:** Less safe, may not match user expectations
- **Effort:** Small
- **Risk:** Medium (data loss potential)

## Recommended Action

**Option A** - Upgrade backend to T3. Discarding work is irreversible and should require explicit confirmation.

## Technical Details

**Affected Files:**

- `server/src/agent/tools/storefront-tools.ts`

## Acceptance Criteria

- [ ] Backend tool and capability registry have same trust tier
- [ ] Discard operation requires explicit user confirmation
- [ ] Tests verify T3 behavior

## Work Log

| Date       | Action                     | Outcome        |
| ---------- | -------------------------- | -------------- |
| 2026-01-09 | Created during code review | Initial filing |

## Resources

- PR: Agent-First Dashboard Architecture (Phases 1-5)
