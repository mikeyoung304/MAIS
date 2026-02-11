# Fix store_discovery_fact Tool Description Contradiction

**Priority:** P1
**Files:** `server/src/agent-v2/deploy/tenant/src/tools/discovery.ts`
**Blocked by:** Nothing
**Plan:** `docs/plans/2026-02-11-refactor-agent-debt-cleanup-plan.md`

## Problem

The `store_discovery_fact` tool description (~line 41-42) says:

> "after storing, immediately call update_section to apply it"

But the system prompt's Slot Machine Protocol says:

> "After every store_discovery_fact call, the backend returns a nextAction telling you what to do. Follow it."

These contradict each other. During onboarding, the correct behavior is to follow the slot machine's `nextAction` (which could be ASK, BUILD_FIRST_DRAFT, TRIGGER_RESEARCH, etc.) — NOT immediately call update_section.

The tool description predates the slot machine protocol and was never updated.

## Fix

In `discovery.ts`, find the `store_discovery_fact` FunctionTool description string. Replace the instruction about "immediately call update_section" with:

```
After storing, the response includes a nextAction from the slot machine.
Follow nextAction deterministically:
- ASK: Ask the question from missingForNext[0]
- BUILD_FIRST_DRAFT: Call build_first_draft to build MVP sections
- TRIGGER_RESEARCH: Call delegate_to_research
- OFFER_REFINEMENT: Invite feedback on the draft
```

Also check the `storeDiscoveryFactTool` error response shape. It currently returns `{ stored: false, error: '...' }` instead of the standard `{ success: false, error: '...' }`. Fix to be consistent with all other tools.

## Verification

```bash
npm run --workspace=server typecheck
```
