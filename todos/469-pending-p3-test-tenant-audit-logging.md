---
status: pending
priority: p3
issue_id: '469'
tags: [code-review, test-data-isolation, observability]
dependencies: []
---

# P3: Add Debug Logging When Test Tenants Are Filtered

## Problem Statement

When test tenants are excluded from stats, there's no logging or indication that some data is being filtered. This could cause confusion when debugging or when revenue appears lower than expected.

**Why it matters:** Operational visibility - admins should know data is being filtered.

## Findings

### Discovery 1: Silent filtering

**Source:** Security Review Agent
**Location:** `server/src/controllers/platform-admin.controller.ts` lines 60-61

No log message when `includeTestTenants = false` filtering is applied.

## Proposed Solutions

### Solution 1: Add Debug Logging (Recommended)

**Effort:** Tiny | **Risk:** None

```typescript
async getStats(includeTestTenants = false): Promise<PlatformStats> {
  if (!includeTestTenants) {
    logger.debug({ method: 'getStats' }, 'Excluding test tenants from platform stats');
  }
  // ... rest of method
}
```

## Recommended Action

<!-- Filled during triage -->

## Technical Details

**Affected Files:**

- `server/src/controllers/platform-admin.controller.ts`

## Acceptance Criteria

- [ ] Debug log emitted when filtering test tenants
- [ ] Log includes method name for traceability

## Work Log

| Date       | Action          | Outcome/Learning        |
| ---------- | --------------- | ----------------------- |
| 2025-12-29 | Security review | Suggested audit logging |
