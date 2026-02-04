---
status: pending
priority: p2
issue_id: 820
tags: [code-review, tech-debt, cleanup, environment-variables]
dependencies: []
---

# Tech Debt: Remove Deprecated Environment Variable Fallbacks

## Problem Statement

Code still checks for deprecated agent URLs (`BOOKING_AGENT_URL`, `PROJECT_HUB_AGENT_URL`, etc.) that were replaced during the Phase 4 agent consolidation. The fallback logic adds confusion and maintenance burden.

**Why it matters:**

- Developers may set wrong env vars thinking they're still needed
- Code suggests old agents still exist (they don't)
- 29 lines of dead fallback logic across 2 files

## Findings

**From tech-debt-validator agent:**

**File 1: `server/src/services/customer-agent.service.ts` (12 lines)**

```typescript
// Lines 113-124
function getCustomerAgentUrl(): string {
  const newUrl = process.env.CUSTOMER_AGENT_URL;
  if (newUrl) return newUrl;

  // Fallback to legacy variable (deprecated - remove after migration complete)
  const legacyUrl = process.env.BOOKING_AGENT_URL;
  if (legacyUrl) return legacyUrl;

  throw new Error('Missing required: CUSTOMER_AGENT_URL');
}
```

**File 2: `server/src/services/project-hub-agent.service.ts` (17 lines)**

```typescript
// Lines 124-140
function getCustomerAgentUrl(): string {
  const newUrl = process.env.CUSTOMER_AGENT_URL;
  if (newUrl) return newUrl;

  const legacyProjectHubUrl = process.env.PROJECT_HUB_AGENT_URL;
  if (legacyProjectHubUrl) return legacyProjectHubUrl;

  const legacyBookingUrl = process.env.BOOKING_AGENT_URL;
  if (legacyBookingUrl) return legacyBookingUrl;

  throw new Error('Missing required: CUSTOMER_AGENT_URL');
}
```

**Current Production (from SERVICE_REGISTRY.md):**

- ✅ `CUSTOMER_AGENT_URL` - Active
- ✅ `TENANT_AGENT_URL` - Active
- ✅ `RESEARCH_AGENT_URL` - Active
- ❌ `BOOKING_AGENT_URL` - Deprecated (Jan 31)
- ❌ `STOREFRONT_AGENT_URL` - Deprecated (Jan 30)
- ❌ `MARKETING_AGENT_URL` - Deprecated (Jan 30)
- ❌ `PROJECT_HUB_AGENT_URL` - Deprecated (Jan 31)
- ❌ `CONCIERGE_AGENT_URL` - Deprecated (Jan 30)

## Proposed Solutions

### Option A: Remove Fallbacks, Keep Clear Error (Recommended)

**Pros:** Clean, unambiguous, fail-fast
**Cons:** None
**Effort:** Small (15 minutes)
**Risk:** Low (verify production env vars first)

```typescript
function getCustomerAgentUrl(): string {
  const url = process.env.CUSTOMER_AGENT_URL;
  if (!url) {
    throw new Error('Missing required: CUSTOMER_AGENT_URL');
  }
  return url;
}
```

### Option B: Add Deprecation Warnings

**Pros:** Gradual transition
**Cons:** Keeps dead code longer
**Effort:** Small (10 minutes)
**Risk:** Low

Log warning when fallback is used, remove in next release.

## Recommended Action

**Before implementing:** Verify production has `CUSTOMER_AGENT_URL` and `TENANT_AGENT_URL` set in Render dashboard.

Then implement Option A.

## Technical Details

**Affected files:**

- `server/src/services/customer-agent.service.ts` (lines 113-124)
- `server/src/services/project-hub-agent.service.ts` (lines 124-140)

**Lines to remove:** 29 total

**Also update documentation:**

- 26 documentation files reference these deprecated env vars
- Update after code change

## Acceptance Criteria

- [ ] Verify production env vars are set correctly
- [ ] Remove fallback logic from both service files
- [ ] Update error messages to only mention new env vars
- [ ] Server starts successfully with new env vars only

## Work Log

| Date       | Action                         | Learnings                                          |
| ---------- | ------------------------------ | -------------------------------------------------- |
| 2026-02-04 | Verified fallbacks still exist | Migration complete (Jan 30-31) but cleanup pending |

## Resources

- `server/src/agent-v2/deploy/SERVICE_REGISTRY.md` - Agent service registry
- `docs/architecture/DELETION_MANIFEST.md` - Phase 3 env cleanup plan
