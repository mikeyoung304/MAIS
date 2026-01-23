---
status: pending
priority: p2
issue_id: '5261'
tags: [code-review, security, agent-tools, pr-28]
source: PR #28 multi-agent review
---

# P2: T3 Trust Tier Enforcement is Prompt-Only

## Problem Statement

Trust tier enforcement for T3 tools relies on system prompt instructions rather than programmatic verification. The agent's adherence depends on the LLM following instructions, which is vulnerable to prompt injection.

**Why it matters:** T3 tools like `publish_draft` perform destructive/irreversible actions. Common Pitfall #49 requires programmatic confirmation verification.

## Findings

**Location:** `server/src/agent/prompts/onboarding-system-prompt.ts` (lines 230-243)

**Current enforcement:**

```typescript
// Trust tiers documented in prompt only
**T1 (just do it):** get_market_research, list_section_ids, get_*...
**T2 (do it, "say wait to undo"):** update_page_section, remove_page_section...
**T3 (ask first):** publish_draft
```

**Gap:** No `confirmationReceived: boolean` parameter in T3 tool execution to verify user actually confirmed.

## Proposed Solutions

### Option A: Add Confirmation Parameter to T3 Tools (Recommended)

**Pros:** Programmatic enforcement, matches Pitfall #49 pattern
**Cons:** Requires tool schema update
**Effort:** Medium (30 min)

```typescript
// In publish_draft tool schema
const PublishDraftSchema = z.object({
  confirmationReceived: z.boolean().describe('Must be true - user explicitly confirmed publish'),
});

// In executor
if (trustTier === 'T3' && !payload.confirmationReceived) {
  throw new ValidationError('T3 action requires explicit user confirmation');
}
```

### Option B: Two-Phase Commit Pattern

**Pros:** More robust, audit trail
**Cons:** More complex, may be over-engineering
**Effort:** Large (2 hours)

Create a `PendingAction` table that stores T3 proposals awaiting confirmation.

## Technical Details

**Affected files:**

- `server/src/agent/tools/storefront-tools.ts` (publish_draft schema)
- `server/src/agent/executors/storefront-executors.ts` (validation)
- `server/src/agent/prompts/onboarding-system-prompt.ts` (document change)

**Related patterns:**

- Common Pitfall #49: T3 without confirmation param
- `docs/solutions/patterns/DUAL_CONTEXT_AGENT_TOOL_ISOLATION_PREVENTION.md`

## Acceptance Criteria

- [ ] T3 tools require `confirmationReceived: true` in params
- [ ] Executor rejects T3 calls without confirmation
- [ ] System prompt updated to explain confirmation requirement
- [ ] Test for rejection without confirmation

## Work Log

| Date       | Action                                   | Learnings                                                      |
| ---------- | ---------------------------------------- | -------------------------------------------------------------- |
| 2026-01-22 | Identified during PR #28 security review | Prompt-based security is defense-in-depth, not primary control |

## Resources

- PR #28: Agent system integrity fixes
- Security review agent finding P2-1
- Common Pitfall #49 in CLAUDE.md
