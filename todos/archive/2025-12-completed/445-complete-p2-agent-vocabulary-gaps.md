---
status: complete
priority: p2
issue_id: '445'
tags: [agent, prompt, ux, vocabulary]
dependencies: []
---

# Add Domain Vocabulary Section to Agent System Prompt

## Problem Statement

System prompt doesn't explain domain vocabulary. Users say "storefront" but agent doesn't know that means landing page. Same for "sessions", "deposit", "balance due".

## Severity: P2 - IMPORTANT

Users get confused responses when using natural language that doesn't match system terminology.

## Findings

- Location: `server/src/agent/orchestrator/orchestrator.ts:38-160`
- Current system prompt has no vocabulary mapping
- Users use terms like "storefront", "sessions", "deposit" naturally

## Problem Scenario

1. User: "Update my storefront"
2. Agent: "I'm not sure what storefront you're referring to"
3. User frustrated - they mean landing page

## Proposed Solution

Add vocabulary section to system prompt:

```markdown
## Vocabulary

When users say...

- "storefront" or "my website" → they mean their landing page at /t/{slug}
- "sessions" or "appointments" → they mean their packages (time-based services)
- "deposit" → they mean the upfront percentage (depositPercent setting)
- "balance due" → they mean days before event to collect remainder (balanceDueDays)
- "clients" or "customers" → people who have booked with them
- "offerings" or "services" → their packages
```

## Technical Details

- **Affected Files**: `server/src/agent/orchestrator/orchestrator.ts`
- **Related Components**: System prompt template
- **Database Changes**: No

## Acceptance Criteria

- [ ] Vocabulary section added to SYSTEM_PROMPT_TEMPLATE
- [ ] Maps: storefront, sessions, deposit, balance due, clients, offerings
- [ ] Agent correctly interprets these terms in conversation
- [ ] Tests pass

## Notes

Source: Agent-Native Architecture Analysis on 2025-12-28
Estimated Effort: Small (30 minutes)
