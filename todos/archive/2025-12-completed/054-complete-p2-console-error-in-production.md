---
status: complete
priority: p2
issue_id: '054'
tags: [code-review, scheduling, logging, standards]
dependencies: []
---

# Multiple console.error Statements in Production Code

## Problem Statement

Several scheduling components use `console.error()` instead of the structured logger, violating the codebase logging standards defined in CLAUDE.md.

**Why this matters:** Inconsistent error reporting, errors not captured by monitoring systems, harder to debug production issues.

## Findings

### Code Locations

1. `client/src/features/scheduling/AppointmentBookingFlow.tsx:148`
2. `client/src/features/tenant-admin/scheduling/ServicesManager/index.tsx:58`
3. `client/src/features/tenant-admin/scheduling/AvailabilityRulesManager/index.tsx:43,58`
4. `client/src/features/tenant-admin/scheduling/ServicesManager/useServicesManager.ts:188,220,248`
5. `client/src/features/tenant-admin/scheduling/AvailabilityRulesManager/useAvailabilityRulesManager.ts:98,133`

### CLAUDE.md Standard

From CLAUDE.md:

> **Logging:** Use `logger`, never `console.log`

## Proposed Solutions

### Option A: Replace with Logger (Recommended)

**Effort:** Small | **Risk:** None

For server-side code, use structured logger:

```typescript
import { logger } from '@lib/core/logger';

// Instead of: console.error('Error:', error);
logger.error({ error, context }, 'Failed to create service');
```

For client-side, use error boundary or error reporting service.

## Technical Details

**Files to Update:**

- All locations listed above

## Acceptance Criteria

- [x] All console.error statements replaced with logger
- [x] Errors include relevant context (tenantId, serviceId, etc.)
- [x] Client-side errors reported to error tracking (if available)

## Work Log

| Date       | Action   | Notes                                                                                                  |
| ---------- | -------- | ------------------------------------------------------------------------------------------------------ |
| 2025-11-27 | Created  | Found during Code Quality review                                                                       |
| 2025-12-02 | Resolved | Replaced all console.error with logger.error; added proper context (component, error, serviceId, etc.) |
