---
status: complete
priority: p2
issue_id: '344'
tags: [code-review, security, information-disclosure]
dependencies: []
---

# Security: PackageNotAvailableError Exposes Package ID

## Problem Statement

The `PackageNotAvailableError` constructor includes the package ID in the error message returned to clients, enabling package ID enumeration attacks.

**Why it matters:** An attacker could enumerate valid package IDs by attempting bookings and observing which IDs return "not available" versus "not found" errors. This is a minor IDOR enumeration vector.

## Findings

**File:** `server/src/lib/errors/business.ts:173-178`

```typescript
export class PackageNotAvailableError extends PackageError {
  constructor(packageId: string) {
    super(`Package ${packageId} is not available`, 'PACKAGE_NOT_AVAILABLE');
  }
}
```

**Agent:** security-sentinel

## Proposed Solutions

### Option A: Generic error message (Recommended)

- **Pros:** No information disclosure, simple change
- **Cons:** Less debugging info in error response
- **Effort:** Small
- **Risk:** Low

```typescript
export class PackageNotAvailableError extends PackageError {
  constructor(packageId: string) {
    super('The requested package is not available for booking', 'PACKAGE_NOT_AVAILABLE');
    // Log internally for debugging
    logger.debug({ packageId }, 'Package not available');
  }
}
```

### Option B: Log-only package ID

- **Pros:** Maintains debugging capability
- **Cons:** Slightly more complex
- **Effort:** Small
- **Risk:** Low

## Recommended Action

Option A - Change error message to be generic.

## Technical Details

- **Affected files:** `server/src/lib/errors/business.ts`
- **Components:** Error handling, booking flow
- **Database changes:** None

## Acceptance Criteria

- [ ] Error message does not expose package ID to client
- [ ] Package ID is logged internally for debugging
- [ ] Existing tests pass

## Work Log

| Date       | Action                   | Learnings                       |
| ---------- | ------------------------ | ------------------------------- |
| 2024-12-24 | Created from code review | security-sentinel agent finding |

## Resources

- Related: P1-172 tenant ID disclosure fix pattern
- Similar: `server/src/services/booking.service.ts:163` (correct pattern)
