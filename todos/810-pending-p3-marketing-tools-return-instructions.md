---
status: pending
priority: p3
issue_id: 810
tags: [code-review, agent, architecture, documentation]
dependencies: []
---

# Document Marketing Tools "Agent-Native" Exception to Pitfall #47

## Problem Statement

The `generate_copy` and `improve_section_copy` tools return instructions for the LLM rather than actual results. This violates Pitfall #47 ("Tools return instructions") but is intentional "agent-native" architecture.

**Why it matters:**

- Creates confusion when reviewing against ADK guidelines
- Other developers may "fix" this thinking it's a bug
- Prevention documentation doesn't acknowledge this exception

## Findings

**From ADK-Compliance agent:**

> Per `ADK_AGENT_DEVELOPMENT_QUICK_REFERENCE.md` (Commandment #5): "Tools Must Return Results, Not Instructions"
>
> But `generate_copy` tool returns:
>
> ```typescript
> return {
>   success: true,
>   action: 'GENERATE_COPY',
>   instructions, // ← Instructions for LLM to interpret
>   nextStep: 'Generate the copy based on the instructions above...',
> };
> ```
>
> The comments in `marketing.ts` acknowledge this as an intentional "agent-native" design choice... This is a valid architectural choice for the unified agent (eliminates backend round-trip).

**From Architecture-Strategist agent:**

> Status: **By design / Acceptable** - The system prompt explicitly instructs the agent to use these instructions to generate copy.

## Proposed Solutions

### Option A: Document the Exception (Recommended)

**Pros:** Prevents future confusion, maintains code hygiene
**Cons:** None
**Effort:** Small (15 minutes)
**Risk:** Low

Add exception clause to:

1. `ADK_AGENT_DEVELOPMENT_QUICK_REFERENCE.md`
2. Comments in `marketing.ts`

### Option B: Refactor to Use ADK's LlmAgent.generate()

**Pros:** More ADK-native approach
**Cons:** May not be necessary, added complexity
**Effort:** Medium (2-4 hours)
**Risk:** Low

## Recommended Action

<!-- Filled during triage -->

## Technical Details

**Affected files:**

- `docs/solutions/patterns/ADK_AGENT_DEVELOPMENT_QUICK_REFERENCE.md`
- `server/src/agent-v2/deploy/tenant/src/tools/marketing.ts`

## Acceptance Criteria

- [ ] ADK Quick Reference documents the agent-native exception
- [ ] marketing.ts comments explain why this pattern is used
- [ ] Future developers won't "fix" this as a bug

## Work Log

| Date       | Action                                  | Learnings                                 |
| ---------- | --------------------------------------- | ----------------------------------------- |
| 2026-01-31 | Identified during ADK compliance review | Intentional exception needs documentation |

## Resources

- [ADK_AGENT_DEVELOPMENT_QUICK_REFERENCE.md](docs/solutions/patterns/ADK_AGENT_DEVELOPMENT_QUICK_REFERENCE.md)
- ADK-Compliance agent findings
