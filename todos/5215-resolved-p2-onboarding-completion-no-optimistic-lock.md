---
status: resolved
priority: p2
issue_id: '5215'
tags: [code-review, session-bootstrap, data-integrity, race-condition]
dependencies: []
---

# Onboarding Completion Lacks Optimistic Locking

## Problem Statement

The `/complete-onboarding` endpoint updates `onboardingPhase` without checking the current phase. This could allow completing onboarding multiple times or from an unexpected state.

**Why it matters:** Race conditions where multiple completion requests execute simultaneously. Metrics skewed by re-completions.

## Findings

**Location:** `server/src/routes/internal-agent.routes.ts:401-433`

**Current Code:**

```typescript
// No check of current phase
await tenantRepo.update(tenantId, {
  onboardingPhase: 'COMPLETED',
  onboardingCompletedAt: new Date(),
});
```

**Missing:** Verification of current state before update.

**Reviewer:** Data Integrity Guardian (P2)

## Proposed Solutions

### Option A: Add State Check (Recommended)

**Pros:** Prevents re-completion, idempotent with feedback
**Cons:** Extra DB read
**Effort:** Small
**Risk:** Low

```typescript
const tenant = await tenantRepo.findById(tenantId);
if (!tenant) {
  return res.status(404).json({ error: 'Tenant not found' });
}

if (tenant.onboardingPhase === 'COMPLETED') {
  return res.json({
    success: true,
    wasAlreadyComplete: true,
    message: 'Onboarding was already completed',
    completedAt: tenant.onboardingCompletedAt,
  });
}

// Now safe to update
await tenantRepo.update(tenantId, { ... });
```

### Option B: Use WHERE Clause

**Pros:** Atomic check-and-update
**Cons:** Requires raw SQL or Prisma updateMany
**Effort:** Medium
**Risk:** Low

```sql
UPDATE Tenant SET onboardingPhase = 'COMPLETED'
WHERE id = :tenantId AND onboardingPhase != 'COMPLETED'
```

## Recommended Action

<!-- Filled during triage -->

## Technical Details

**Affected Files:**

- `server/src/routes/internal-agent.routes.ts`

**Response Change:**
Add `wasAlreadyComplete` field to indicate if this was a re-completion.

## Acceptance Criteria

- [ ] Endpoint checks current phase before updating
- [ ] Response indicates if already completed
- [ ] Metrics not skewed by duplicate calls

## Work Log

| Date       | Action                         | Learnings                                    |
| ---------- | ------------------------------ | -------------------------------------------- |
| 2026-01-20 | Created from /workflows:review | Data Integrity reviewer noted race condition |

## Resources

- PR: feature/session-bootstrap-onboarding
- Review: Data Integrity Guardian
