---
status: closed
priority: p3
issue_id: '729'
tags:
  - code-review
  - architecture
  - technical-debt
dependencies: []
triage_notes: "WON'T FIX: Intentional technical decision. Both draft systems are documented in LandingPageService header. Unification is not worth the risk and effort for minimal gain."
closed_at: '2026-01-26'
---

# P3: Two Draft Systems Add Architectural Complexity

## Problem Statement

The codebase has two separate draft systems for landing page configuration:

1. **Build Mode (AI Tools):** Uses `landingPageConfigDraft` column
2. **Visual Editor (REST API):** Uses wrapper format in `landingPageConfig` with `{ draft, published }` structure

This is documented technical debt that adds complexity.

## Findings

**Location:** `server/src/services/landing-page.service.ts` (documented in header, lines 1-27)

**Current Documentation:**

```typescript
/**
 * This service is the SINGLE SOURCE OF TRUTH for all landing page operations.
 * It handles both draft systems:
 *
 * 1. **Build Mode (AI Tools)**: Uses separate `landingPageConfigDraft` column
 * 2. **Visual Editor (REST API)**: Uses wrapper format in `landingPageConfig`
 */
```

**Complexity Points:**

- Two different publish mechanisms
- Two different draft storage formats
- Potential confusion about which system to use
- Publish format duplication (service vs executor)

**Why This Exists:**

- Visual Editor draft system predates Build Mode
- Build Mode needed separate column to avoid conflicts
- Both serve different UX flows

## Proposed Solutions

### Option A: Maintain Status Quo with Better Docs (Current)

**Effort:** N/A
**Risk:** Low

Keep as-is, ensure documentation is clear. The TODO-704 comment acknowledges this is intentional consolidation.

### Option B: Future Unification (Deferred)

**Effort:** Large (multi-day)
**Risk:** Medium

Eventually migrate to single draft system:

1. Choose one storage format (probably separate column)
2. Migrate visual editor to use `landingPageConfigDraft`
3. Remove wrapper format from `landingPageConfig`
4. Update all read paths

This is significant work and should be planned separately.

## Recommended Action

<!-- Filled during triage -->

Mark as "deferred" - acknowledged tech debt, not blocking.

## Technical Details

**Affected Files:**

- `server/src/services/landing-page.service.ts`
- `server/src/agent/executors/storefront-executors.ts`
- `server/src/adapters/prisma/tenant.repository.ts`
- `apps/web/src/lib/tenant.ts`

## Acceptance Criteria

- [ ] Decision documented on whether to unify
- [ ] If unifying: migration plan created
- [ ] If not: close as "won't fix" with rationale

## Work Log

| Date       | Action                   | Learnings                                                |
| ---------- | ------------------------ | -------------------------------------------------------- |
| 2026-01-10 | Created from code review | Code-simplicity-reviewer identified as complexity source |

## Resources

- Code simplicity review agent findings
- `TODO-704` comment in landing-page.service.ts
- ADR candidate if decision is made to change
