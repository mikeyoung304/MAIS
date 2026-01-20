---
status: completed
priority: p1
issue_id: '5205'
tags: [code-review, session-bootstrap, security, architecture]
dependencies: []
---

# No Validation That Onboarding Prerequisites Are Met

## Problem Statement

The `/complete-onboarding` endpoint accepts any tenantId and marks onboarding complete without validating that the tenant has actually completed the required steps (packages created, storefront published, etc.).

**Why it matters:** A malicious or buggy agent could mark onboarding complete prematurely, potentially affecting billing tier transitions or onboarding metrics.

## Findings

**Location:** `server/src/routes/internal-agent.routes.ts:401-433`

**Current Code:**

```typescript
// No validation that prerequisites are met
await tenantRepo.update(tenantId, {
  onboardingPhase: 'COMPLETED',
  onboardingCompletedAt: new Date(),
});
```

The agent provides `packagesCreated` in the request, but it's not validated server-side.

**Reviewer:** Architecture Strategist (P1)

## Proposed Solutions

### Option A: Validate Package Count (Recommended)

**Pros:** Simple, prevents premature completion
**Cons:** Requires extra DB query
**Effort:** Small
**Risk:** Low

```typescript
// Check prerequisites
const packages = await catalogRepo.getAllPackages(tenantId);
if (packages.length === 0) {
  return res.status(400).json({
    error: 'Cannot complete onboarding without at least one package',
    suggestion: 'Create service packages first',
  });
}
```

### Option B: Validate Multiple Prerequisites

**Pros:** More thorough, ensures real completion
**Cons:** More complex, may block legitimate edge cases
**Effort:** Medium
**Risk:** Medium

Check: packages exist, landingPageConfig has content, branding set.

### Option C: Trust Agent, Log for Auditing

**Pros:** Simple, no blocking
**Cons:** Doesn't prevent the issue
**Effort:** Small
**Risk:** High

## Recommended Action

<!-- Filled during triage -->

## Technical Details

**Affected Files:**

- `server/src/routes/internal-agent.routes.ts`

**Affected Components:**

- /complete-onboarding endpoint
- CatalogRepository (for package count check)

**Dependencies:**

- catalogService must be available in route deps

## Acceptance Criteria

- [ ] Server validates at least one package exists before allowing completion
- [ ] Clear error message returned if prerequisites not met
- [ ] Logged when completion is blocked due to missing prerequisites

## Work Log

| Date       | Action                         | Learnings                                     |
| ---------- | ------------------------------ | --------------------------------------------- |
| 2026-01-20 | Created from /workflows:review | Architecture reviewer identified security gap |

## Resources

- PR: feature/session-bootstrap-onboarding
- Review: Architecture Strategist
