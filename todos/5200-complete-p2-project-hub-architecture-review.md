---
status: complete
priority: p2
issue_id: '5200'
tags: [architecture, agent-v2, project-hub, review-needed]
dependencies: []
---

# Project Hub Agent Architecture Review

## Problem Statement

Project Hub is currently a **single dual-faced agent** that switches behavior based on `contextType` in session state (customer vs tenant). This design has trade-offs that need evaluation.

## Current Implementation

File: `server/src/agent-v2/deploy/project-hub/src/agent.ts`

- Single Cloud Run deployment
- One system prompt with dual personality
- Switches on `contextType: 'customer' | 'tenant'`
- Shared mediation logic for both contexts

## Concerns

### 1. Security - Context Bleed Risk

Customer and tenant share the same agent context. Risk of accidentally exposing tenant notes or business details to customers.

### 2. Complexity - Dual Personality Prompt

System prompt tries to handle both personas, making it harder to tune each independently.

### 3. Weak Tenant ID Handling

Only uses Tier 2 (plain object access) of the 4-tier pattern. Missing:

- Tier 1: state.get()
- Tier 3: userId with colon format
- Tier 4: userId direct fallback

### 4. Testing Difficulty

Hard to verify both personas work correctly in isolation.

## Alternative: Two Separate Agents

| Aspect     | Single (Current) | Two Agents     |
| ---------- | ---------------- | -------------- |
| Deployment | 1 Cloud Run      | 2 Cloud Runs   |
| Prompts    | Complex dual     | Focused single |
| Security   | Shared context   | Isolated       |
| Evolution  | Coupled          | Independent    |
| Cost       | Lower            | Higher         |

## Questions to Resolve

1. Should customer and tenant be separate agents?
2. Is the mediation logic (80% auto, <50% escalate) appropriate?
3. How should tenant ID flow in both contexts?
4. What prevents context bleed between personas?

## Recommended Action

Run `/review` on the project-hub agent with fresh context to make an architectural decision before adding more features.

## Resolution

**Review completed 2026-01-20.** Multi-agent code review identified 15 issues (4 P1, 7 P2, 4 P3).

**Questions answered:**

1. **Should customer and tenant be separate agents?** → Not yet. Phase 1 added programmatic tool gating which provides 90% of security benefits. Re-evaluate after 1 week stable.
2. **Is the mediation logic appropriate?** → Yes, now fully wired up. `shouldAlwaysEscalate()` called in `answerPrepQuestion` and `submitRequest` tools. See todo 5220 (resolved).
3. **How should tenant ID flow?** → Now uses 4-tier pattern via shared module import.
4. **What prevents context bleed?** → Now enforced by `requireContext()` guard on all 11 tools.

**See:** `todos/PLAN-project-hub-security-and-architecture.md`

## Related Files

- `server/src/agent-v2/deploy/project-hub/src/agent.ts`
- `server/src/agent-v2/shared/tenant-context.ts` (4-tier pattern reference)
