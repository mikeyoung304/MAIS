---
status: pending
priority: p1
issue_id: '756'
tags: [agent-v2, routing, concierge, enterprise-ai]
dependencies: []
---

# Content Update Requests Misrouted to Marketing Specialist

## Problem Statement

When a user provides **exact text** for a content update (e.g., "here's my about section: [text]"), the Concierge agent incorrectly routes to Marketing Specialist instead of Storefront Specialist.

**Evidence:** During E2E testing on production (gethandled.ai):

- User said: "here's my about section: [text], mine is perfect just ship it"
- Agent showed **"Marketing ✓"** badge instead of "Storefront ✓"
- Agent asked for feedback instead of saving
- Agent claimed "Done. Your changes are now live" but preview still showed placeholder content

This violates the documented routing rules in `agent.ts` lines 164-178.

## Findings

### Expected Behavior (from code)

```
**CONTENT UPDATE** (→ Storefront):
- "Update the about section with: [text]"  ← User provides exact text

**CONTENT GENERATION** (→ Marketing):
- "Make the about section more engaging"  ← User wants rewrites
```

### Observed Behavior

- User provided exact text → Routed to Marketing
- Marketing generated options instead of saving user's text
- Agent confirmed success without verification

### Root Cause Hypothesis

1. **LLM Interpretation Failure**: The phrase "here's my about section" may be interpreted as "improve this" rather than "use this exactly"
2. **Prompt Ambiguity**: The decision tree relies on LLM interpretation, not deterministic parsing
3. **Missing User Intent Signal**: No explicit "EXACT" or "USE THIS" keyword pattern matching

### Location

- Decision tree: `server/src/agent-v2/deploy/concierge/src/agent.ts:119-162`
- Content vs Generation rules: `server/src/agent-v2/deploy/concierge/src/agent.ts:164-178`

## Proposed Solutions

### Option 1: Add Explicit Routing Keywords (Recommended)

Add specific keyword detection before LLM decision:

- If message contains "here's my", "use this", "exact text", "just save", "just ship" → Force Storefront
- Bypass LLM decision tree for explicit intent signals

- **Pros**: Deterministic, fast, no false positives
- **Cons**: Requires maintenance of keyword list
- **Effort**: Small (2 hours)
- **Risk**: Low

### Option 2: Add Confidence Threshold

Require LLM to express routing confidence; if ambiguous, ask user:

- "Should I save this exactly, or generate improved versions?"

- **Pros**: Handles edge cases
- **Cons**: Adds friction, slows UX
- **Effort**: Medium (4 hours)
- **Risk**: Medium (user frustration)

### Option 3: Dual-Path Execution

When content is provided, always try Storefront first, fall back to Marketing if rejected

- **Pros**: Self-healing
- **Cons**: Wasteful, complex, harder to debug
- **Effort**: Large (8 hours)
- **Risk**: High (unexpected behavior)

## Recommended Action

**Option 1** - Add explicit routing keywords in `agent.ts` before the LLM decision tree.

## Technical Details

- **Affected Files**:
  - `server/src/agent-v2/deploy/concierge/src/agent.ts`
- **Related Components**: Concierge hub, Storefront specialist
- **Database Changes**: No

## Acceptance Criteria

- [ ] User-provided exact text routes to Storefront 100% of the time
- [ ] "Here's my [section]: [text]" pattern always triggers content UPDATE not generation
- [ ] Agent confirms actual save, not just delegation
- [ ] E2E test validates About section update saves correctly

## Work Log

### 2026-01-27 - Issue Identified

**By:** Claude Code Review
**Actions:**

- Discovered during production E2E snap observation
- Agent showed "Marketing ✓" badge for content update request
- Root cause identified as LLM decision tree interpretation failure

**Learnings:**

- LLM-based routing is probabilistic, not deterministic
- Need explicit intent signals for critical paths

## Resources

- E2E test screenshots: `.playwright-mcp/admin-dashboard.png`
- Agent routing code: `server/src/agent-v2/deploy/concierge/src/agent.ts:119-178`
- ADK routing patterns: `docs/solutions/patterns/ADK_A2A_PREVENTION_INDEX.md`

## Notes

Source: `/workflows:review` session on 2026-01-27
Priority: P1 because silent data loss - user thinks content saved but it wasn't
