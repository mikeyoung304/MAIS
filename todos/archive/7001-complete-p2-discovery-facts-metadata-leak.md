---
status: complete
priority: p2
issue_id: '7001'
tags: [code-review, security, data-integrity, pr-45]
dependencies: []
---

# 7001: Discovery Facts Leaks \_researchTriggered Metadata to Agent

## Problem Statement

`DiscoveryService.getDiscoveryFacts()` returns the full `discoveryFacts` object from `tenant.branding` without filtering out internal `_`-prefixed metadata keys (like `_researchTriggered`). This leaks implementation details to the agent, which may confuse the LLM or cause it to reference internal state in conversation.

**Impact:** Low-to-medium. The agent sees keys it shouldn't and may hallucinate or leak them to the end-user. Not a security vulnerability per se, but a data hygiene issue.

## Findings

### Agent: Data Integrity Guardian + Security Sentinel

- **File:** `server/src/services/discovery.service.ts`, lines 298-300
- **Evidence:** `getDiscoveryFacts()` does `return { success: true, facts: branding?.discoveryFacts || {} }` — no filtering
- The `_researchTriggered` flag is stored in the same `discoveryFacts` JSON field and gets returned to the agent
- Agent prompt doesn't instruct it to ignore `_`-prefixed keys

### Proposed Solutions

**Option A: Filter `_`-prefixed keys in getDiscoveryFacts (Recommended)**

- Add `Object.fromEntries(Object.entries(facts).filter(([k]) => !k.startsWith('_')))` before returning
- Pros: Simple 1-line fix, no schema change needed
- Cons: Fragile convention (relies on `_` prefix)
- Effort: Small
- Risk: Low

**Option B: Store metadata in separate JSON field**

- Move `_researchTriggered` out of `discoveryFacts` into `branding.metadata` or a dedicated column
- Pros: Clean separation, no prefix convention needed
- Cons: Requires migration, changes storeFact logic
- Effort: Medium
- Risk: Medium (migration + all consumers)

**Option C: Zod schema for facts response**

- Define a typed schema that explicitly lists which facts keys are valid
- Pros: Type-safe, self-documenting
- Cons: Schema must be updated when new fact types are added
- Effort: Medium
- Risk: Low

## Recommended Action

Option A — filter `_`-prefixed keys. Simplest fix with immediate effect.

## Technical Details

- **Affected files:** `server/src/services/discovery.service.ts`
- **Components:** DiscoveryService, tenant-agent discovery tools
- **Database:** No changes needed

## Acceptance Criteria

- [ ] `getDiscoveryFacts()` strips all `_`-prefixed keys before returning
- [ ] Agent never sees `_researchTriggered` or other internal metadata
- [ ] Existing tests updated to verify filtering

## Work Log

| Date       | Action                     | Learnings                                                   |
| ---------- | -------------------------- | ----------------------------------------------------------- |
| 2026-02-11 | Created from PR #45 review | Found by Data Integrity Guardian + Security Sentinel agents |

## Resources

- PR #45: refactor/agent-debt-cleanup
- File: `server/src/services/discovery.service.ts:298-300`
