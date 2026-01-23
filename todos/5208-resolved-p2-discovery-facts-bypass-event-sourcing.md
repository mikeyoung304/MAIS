---
status: complete
priority: p2
issue_id: '5208'
tags: [code-review, session-bootstrap, architecture, event-sourcing, tech-debt]
dependencies: []
---

# Discovery Facts Bypass Event Sourcing Pattern

## Problem Statement

The `/store-discovery-fact` endpoint stores facts directly in `tenant.branding.discoveryFacts` JSON rather than using the existing OnboardingEvent table and event sourcing pattern. This creates two sources of truth.

**Why it matters:** Data inconsistencies between event-sourced AdvisorMemory and branding.discoveryFacts. Harder to audit and debug.

## Findings

**Location:** `server/src/routes/internal-agent.routes.ts:457-511`

**Acknowledgment in Code (lines 473-483):**

```typescript
// NOTE: This stores in branding.discoveryFacts as an interim solution.
// The "proper" event-sourced approach would be to:
// 1. Create a DISCOVERY_FACT_UPDATED event type
// 2. Emit events to OnboardingEvent table
// 3. Project back via AdvisorMemoryService
// For now, this simpler approach lets us ship faster while maintaining
// a clear path to the ideal architecture.
```

**Bootstrap Merge Logic (line 346-349):**

```typescript
// Merge branding discovery facts (takes precedence)
if (brandingDiscoveryFacts) {
  Object.assign(discoveryData, brandingDiscoveryFacts);
}
```

**Reviewers:** Architecture Strategist (P2), Data Integrity Guardian (P2)

## Proposed Solutions

### Option A: Document and Accept (Short-term)

**Pros:** No code changes, ships faster
**Cons:** Tech debt remains
**Effort:** Small
**Risk:** Low

Add to CLAUDE.md pitfalls and ensure all branding updates preserve discoveryFacts.

### Option B: Migrate to Event Sourcing (Long-term)

**Pros:** Single source of truth, audit trail
**Cons:** Larger refactor
**Effort:** Large
**Risk:** Medium

Create DISCOVERY_FACT_STORED event type, emit via AdvisorMemoryService.

## Recommended Action

<!-- Filled during triage -->

## Technical Details

**Affected Files:**

- `server/src/routes/internal-agent.routes.ts`
- `server/src/agent/onboarding/advisor-memory.service.ts`

**Two Data Sources:**

1. `OnboardingEvent` table → projected via `AdvisorMemoryRepository`
2. `Tenant.branding.discoveryFacts` → direct JSON storage

## Acceptance Criteria

- [ ] Pattern documented in CLAUDE.md (pitfall #XX)
- [ ] All branding update operations preserve discoveryFacts key
- [ ] OR: Migrated to event sourcing with single source of truth

## Work Log

| Date       | Action                         | Learnings                                   |
| ---------- | ------------------------------ | ------------------------------------------- |
| 2026-01-20 | Created from /workflows:review | Architecture reviewer noted hybrid approach |

## Resources

- PR: feature/session-bootstrap-onboarding
- Reviews: Architecture Strategist, Data Integrity Guardian
