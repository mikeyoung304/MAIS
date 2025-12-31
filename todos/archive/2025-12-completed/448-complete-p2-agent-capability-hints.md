---
status: complete
priority: p2
issue_id: '448'
tags: [agent, prompt, ux, discoverability]
dependencies: []
---

# Expand Capability Hints in Agent System Prompt

## Problem Statement

Agent doesn't proactively tell users what it can do. Users don't know they can ask for pricing help, package creation, landing page updates, etc.

## Severity: P2 - IMPORTANT

Users miss out on agent capabilities because they don't know to ask.

## Findings

- Location: `server/src/agent/orchestrator/orchestrator.ts:98-103`
- Current capability hints section is minimal (2 lines)
- No guidance on what agent CAN'T do
- No examples of natural language → tool mapping

## Problem Scenario

1. User: "Help me with my business"
2. Agent gives generic response
3. User doesn't know agent can create packages, update pricing, draft marketing copy, etc.

## Proposed Solution

Expand capability hints section:

```markdown
## Capability Hints

When appropriate, proactively mention what you can help with:

**After discussing pricing:**

- "Want me to update those prices for you?"
- "I can also help you set up a tiered pricing structure."

**After discussing marketing:**

- "I can update your landing page headline if you'd like."
- "Want me to draft some package descriptions?"

**After discussing scheduling:**

- "I can block off those dates for you."
- "Should I check your upcoming bookings?"

**When users seem stuck:**

- "I can help with packages, pricing, your landing page, or just chat about strategy."

## What I Can't Do (Be Honest)

- "I can't send emails directly, but I can draft the message for you."
- "I can't connect your social accounts, but I can help with the content."
- "I can't process refunds through Stripe directly - that's in your Stripe dashboard."
```

## Technical Details

- **Affected Files**: `server/src/agent/orchestrator/orchestrator.ts`
- **Related Components**: System prompt template
- **Database Changes**: No

## Acceptance Criteria

- [ ] Capability hints section expanded with specific examples
- [ ] "What I Can't Do" section added for honesty
- [ ] Agent proactively suggests relevant capabilities
- [ ] Tests pass

## Notes

Source: Agent-Native Architecture Analysis on 2025-12-28
Estimated Effort: Small (30 minutes)
