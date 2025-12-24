---
status: wontfix
priority: p2
issue_id: '300'
tags: [code-review, architecture, layering, early-access]
dependencies: []
resolution_date: 2025-12-06
resolution_rationale: |
  YAGNI - Single upsert operation for non-tenant-scoped feature.
  Creating repository + service layer pattern for ONE database call
  is over-engineering. Revisit if early-access grows beyond 3+ operations.
---

# Direct Prisma Usage in Route Handler

## Problem Statement

The early-access route handler (`/v1/auth/early-access`) directly calls `prisma.earlyAccessRequest.create()` instead of going through a service or repository layer. This violates the project's layered architecture pattern.

**Why it matters:**

1. Bypasses business logic layer, making testing harder
2. Inconsistent with other endpoints that use service layer
3. Cannot easily swap implementations (mock vs real)
4. Logic spread across route handler instead of isolated in service

## Findings

**File:** `server/src/routes/auth.routes.ts` (lines ~822-830)

```typescript
router.post('/early-access', signupLimiter, async (req, res, next) => {
  // ... validation ...

  // Direct Prisma call in route handler - violates layered architecture
  await prisma.earlyAccessRequest.create({
    data: {
      email: normalizedEmail,
      source: source || 'website',
      ipAddress: req.ip,
    },
  });

  // ... email sending ...
});
```

**Expected pattern (from CLAUDE.md):**

```
routes/          → HTTP handlers (thin, validation only)
  ↓
services/        → Business logic
  ↓
adapters/        → External integrations (prisma, ...)
```

## Proposed Solutions

### Option A: Create EarlyAccessService (Recommended)

**Pros:** Consistent with architecture, testable, single responsibility
**Cons:** More files to maintain
**Effort:** Medium (45 min)
**Risk:** Low

```typescript
// server/src/services/early-access.service.ts
export class EarlyAccessService {
  constructor(
    private readonly earlyAccessRepo: EarlyAccessRepository,
    private readonly emailProvider: EmailProvider,
    private readonly config: Config
  ) {}

  async requestEarlyAccess(data: {
    email: string;
    source: string;
    ipAddress: string;
  }): Promise<void> {
    const normalizedEmail = data.email.toLowerCase().trim();

    await this.earlyAccessRepo.create({
      email: normalizedEmail,
      source: data.source,
      ipAddress: data.ipAddress,
    });

    await this.sendNotificationEmail(normalizedEmail);
  }
}
```

### Option B: Add to Existing AuthService

**Pros:** Reuses existing service, less new code
**Cons:** May bloat AuthService
**Effort:** Small (20 min)
**Risk:** Low

```typescript
// In server/src/services/auth.service.ts
async requestEarlyAccess(data: EarlyAccessData): Promise<void> {
  // Move logic from route handler
}
```

### Option C: Accept Current Pattern (Document Exception)

**Pros:** No code changes
**Cons:** Technical debt, inconsistent patterns
**Effort:** Minimal
**Risk:** Low (short-term), Medium (long-term)

## Recommended Action

Implement Option B - add method to existing AuthService since early-access is authentication-adjacent.

## Technical Details

**Affected files:**

- `server/src/routes/auth.routes.ts` (refactor to use service)
- `server/src/services/auth.service.ts` (add method)
- `server/src/adapters/prisma/early-access.repository.ts` (create if needed)
- `server/src/lib/ports.ts` (add repository interface)
- `server/src/di.ts` (wire dependencies)

## Acceptance Criteria

- [ ] Route handler only does validation and delegates to service
- [ ] Service handles business logic (normalize, persist, notify)
- [ ] Repository handles database operations
- [ ] Mock repository created for testing
- [ ] Existing tests pass
- [ ] New unit tests for service

## Work Log

| Date       | Action                   | Learnings                                             |
| ---------- | ------------------------ | ----------------------------------------------------- |
| 2025-12-06 | Created from code review | Architecture-strategist identified layering violation |

## Resources

- CLAUDE.md: Layered Architecture section
- Pattern reference: `server/src/services/booking.service.ts`
