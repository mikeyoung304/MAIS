---
status: pending
priority: p1
issue_id: 9014
tags: [code-review, agent, plan-gap]
dependencies: []
---

# store_discovery_fact Response Contract Undefined After Slot Machine Removal

## Problem Statement

The current `store_discovery_fact` returns `nextAction`, `readySections`, `missingForNext`, and `slotMetrics`. The entire tenant-agent prompt is built around following `nextAction` deterministically (ASK, BUILD_FIRST_DRAFT, TRIGGER_RESEARCH).

The plan removes the slot machine but says "Agent maintains this mentally via `get_known_facts` + `get_page_structure`". This creates:

1. **No structured state for progress decisions** — the agent can't determine when to stop asking questions and start building
2. **Cold-start problem** — a new session must make 2 tool calls before it can say anything
3. **No reveal gate** — nothing prevents the agent from announcing "here's your site" when sections still have placeholder content

## Findings

- Agent-Native Reviewer P1-2 and P1-3: Reveal trigger has no deterministic validation, response contract undefined
- Agent-Native P2-2: 2 discovery fact keys (primarySegment, tiersConfigured) insufficient for session recovery

## Proposed Solutions

### Option A: Define explicit StoreFactResponse contract (Recommended)

```typescript
{
  stored: true,
  key: string,
  totalFactsKnown: number,
  currentPhase: 'NOT_STARTED' | 'BUILDING' | 'COMPLETED',
  mvpReadiness: {
    hasSegment: boolean,
    hasTiers: boolean,
    mvpSectionsReady: boolean, // from SectionContentService
    missingItems: string[],
  }
}
```

- **Effort:** Medium

### Option B: Keep minimal response + add `check_reveal_readiness` tool

- store_fact returns simple `{ stored: true }`
- New tool `check_reveal_readiness` calls SectionContentService.isPlaceholderContent()
- Agent prompt says "call check_reveal_readiness before announcing reveal"
- **Effort:** Medium

## Acceptance Criteria

- [ ] store_discovery_fact has a defined response schema
- [ ] Agent has deterministic signal for when MVP is ready for reveal
- [ ] Session recovery works without re-asking all questions

## Work Log

| Date       | Action                    | Learnings                                            |
| ---------- | ------------------------- | ---------------------------------------------------- |
| 2026-02-12 | Agent architecture review | Removing structured state needs replacement contract |
