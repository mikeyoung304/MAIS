---
status: pending
priority: p1
issue_id: 801
tags: [code-review, agent, prompt-engineering, pitfall-37]
dependencies: []
---

# Prompt Examples Use Forbidden Words (Pitfall #37)

## Problem Statement

The tenant-agent system prompt contains example responses that use forbidden vocabulary. Per Pitfall #37, LLMs copy example responses verbatim, causing the agent to violate its own rules.

**Why it matters:**

- Agent will say "Updated in your draft" despite "draft" being forbidden
- Agent will say "Check your preview" despite "preview" being forbidden
- Self-sabotaging prompt creates inconsistent user experience

## Findings

**From Code-Philosopher agent:**

> Line 303: "Done! Updated in your draft." - Uses "draft" (forbidden) and exclamation (forbidden enthusiasm)
> Line 476: "Done. Check your preview." - Uses "preview" (forbidden)
> Line 363: "In your unpublished draft..." - Says "draft" while forbidding it

**From UX-Voice-Specialist agent:**

> The prompt contains examples that use the exact forbidden vocabulary it bans. The LLM may pattern-match these verbatim.

**Specific violations:**

| Line | Example Text                           | Violation                  |
| ---- | -------------------------------------- | -------------------------- |
| 303  | "Done! Updated in your draft."         | Uses "draft" + exclamation |
| 363  | "In your unpublished draft..."         | Uses "draft"               |
| 427  | "Ready to look at your about section?" | Uses "section"             |
| 476  | "Done. Check your preview."            | Uses "preview"             |

## Proposed Solutions

### Option A: Fix the Examples (Recommended)

**Pros:** Quick fix, eliminates self-contradiction
**Cons:** None
**Effort:** Small (15 minutes)
**Risk:** Low

Replace:

- Line 303: "Done! Updated in your draft." → "Done. Take a look."
- Line 363: "In your unpublished draft..." → "In your changes..." or "What visitors won't see yet..."
- Line 427: "Ready to look at your about section?" → "What's your story?"
- Line 476: "Done. Check your preview." → "Done. Take a look."

### Option B: Restructure Forbidden Words Section

**Pros:** More robust long-term solution
**Cons:** Requires careful rewrite
**Effort:** Medium (1 hour)
**Risk:** Low

Change from table format to action-oriented rules that don't include example "sayings."

## Recommended Action

<!-- Filled during triage -->

## Technical Details

**Affected files:**

- `server/src/agent-v2/deploy/tenant/src/prompts/system.ts`

**Lines to fix:** 303, 363, 427, 476

## Acceptance Criteria

- [ ] No example responses in system prompt use forbidden words
- [ ] All "take a look" patterns use approved vocabulary
- [ ] No exclamation marks in example responses
- [ ] Agent deployed and tested to verify no jargon leakage

## Work Log

| Date       | Action                                    | Learnings                                       |
| ---------- | ----------------------------------------- | ----------------------------------------------- |
| 2026-01-31 | Identified during multi-agent code review | Prompt self-contradicts on forbidden vocabulary |

## Resources

- [CLAUDE.md Pitfall #37](CLAUDE.md) - LLM pattern-matching prompts
- [VOICE_QUICK_REFERENCE.md](docs/design/VOICE_QUICK_REFERENCE.md) - Brand voice rules
