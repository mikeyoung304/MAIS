---
status: deferred
priority: p2
issue_id: 807
tags: [code-review, agent, ux, memory, memory-bank]
dependencies: []
deferred_to: 'Phases 2-4: Session State + Memory Bank - see 2026-01-31-feat-enterprise-tenant-agent-architecture-plan.md'
---

# Weak Repetition Prevention in System Prompt

## Problem Statement

The agent was observed repeating questions during testing (e.g., asking "What do you do?" after user already answered). The repetition prevention section (lines 117-120) is only 4 lines with vague guidance.

**Why it matters:**

- Destroys user trust when agent forgets what was just said
- Makes conversation feel robotic and frustrating
- Core UX issue observed during testing

## Findings

**From Code-Philosopher agent:**

> The reported memory/repetition issue is addressed in only 4 lines, with vague guidance like "don't ask for info you already have (check the preview!)". This assumes the LLM knows HOW to track what's been asked.
>
> Missing specifics:
>
> - No explicit instruction to track asked questions in working memory
> - No instruction to check conversation history before asking
> - "Check the preview" doesn't help track what QUESTIONS were asked

**From review handoff document:**

> Known Issues: Agent repeated "What do you do?" question multiple times. Likely needs ADK session state or Agent Engine memory.

## Proposed Solutions

### Option A: Expand Repetition Prevention Section (Recommended)

**Pros:** Immediate improvement without architecture changes
**Cons:** Still relies on LLM working memory
**Effort:** Small (20 minutes)
**Risk:** Low

Add explicit tracking instructions:

```
### Repetition Prevention (CRITICAL)

Before asking ANY question, mentally check:
1. Did I already ask this exact question in this conversation?
2. Did the user already provide this information (even indirectly)?
3. Does the preview show non-placeholder content for this?

If YES to any → DO NOT ask again. Move to next missing info.
```

### Option B: Use ADK Session State

**Pros:** Programmatic tracking, more reliable
**Cons:** Requires tool changes
**Effort:** Medium (4-8 hours)
**Risk:** Low

Track asked questions and received info in `context.state`:

```typescript
const askedQuestions = context.state?.get<string[]>('askedQuestions') ?? [];
// ... after asking
context.state?.set('askedQuestions', [...askedQuestions, 'business_type']);
```

### Option C: Vertex AI Agent Engine Memory

**Pros:** Persistent across sessions, semantic recall
**Cons:** Larger effort, future phase
**Effort:** Large (1-2 weeks)
**Risk:** Medium

Use Agent Engine Memory Bank for conversation state.

## Recommended Action

**Triage Decision (2026-01-31):** Options B + C combined - ADK Session State (Phase 2) + Memory Bank (Phase 4)

**Rationale:** User identified session persistence as "Critical" and wants Agent Engine Memory ASAP. Two-tier approach:

1. **Phase 2 (Short-term):** ADK Session State tracks asked questions within a session
2. **Phase 4 (Long-term):** Memory Bank provides cross-session memory

This properly solves repetition at both levels rather than patching with prompt engineering.

## Technical Details

**Affected files:**

- `server/src/agent-v2/deploy/tenant/src/prompts/system.ts` (lines 117-120)
- Potentially: tool files for ADK state tracking

## Acceptance Criteria

- [ ] Agent never asks the same question twice in a session
- [ ] Agent uses information user already provided
- [ ] Testing confirms no repetition in onboarding flow

## Work Log

| Date       | Action                               | Learnings                   |
| ---------- | ------------------------------------ | --------------------------- |
| 2026-01-31 | Identified during testing and review | Repetition is core UX issue |

## Resources

- [A2A_SESSION_STATE_PREVENTION.md](docs/solutions/patterns/A2A_SESSION_STATE_PREVENTION.md)
- Review handoff: docs/issues/2026-01-31-tenant-agent-review-handoff.md
