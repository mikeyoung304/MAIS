---
status: resolved
priority: p1
issue_id: "295"
tags: [code-review, architecture, validation, early-access]
dependencies: []
resolved_at: 2025-12-06
resolution: "Replaced manual regex with EarlyAccessRequestDtoSchema.safeParse() in auth.routes.ts. Zod .email() now validates format and blocks CRLF injection."
---

# Zod Validation Contract Not Enforced on Backend Route

## Problem Statement

The `/v1/auth/early-access` endpoint has a ts-rest contract with Zod validation defined, but the backend route uses raw Express with manual regex validation instead. This means the Zod `.email()` validation never runs on the server.

**Why it matters:** The Zod schema would catch CRLF injection, enforce RFC 5321 email format, and validate max length (254 chars). The current regex `/^[^\s@]+@[^\s@]+\.[^\s@]+$/` is weaker and doesn't validate these cases.

## Findings

**Contract defined (packages/contracts/src/api.v1.ts:279-290):**
```typescript
requestEarlyAccess: {
  method: 'POST',
  path: '/v1/auth/early-access',
  body: EarlyAccessRequestDtoSchema,  // Zod validation here
  responses: { 200: ..., 400: ..., 429: ..., 500: ... }
}
```

**Route implementation (server/src/routes/auth.routes.ts:793-868):**
```typescript
router.post('/early-access', signupLimiter, async (req, res, next) => {
  // Uses manual regex, NOT Zod schema
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    throw new ValidationError('Invalid email format');
  }
  // ...
});
```

**Gap:** The route is NOT wired through `tsRestExpress()` or any Zod validation.

## Proposed Solutions

### Option A: Add Zod Validation at Route Start (Recommended)
**Pros:** Quick fix, uses existing schema
**Cons:** Manual parse call
**Effort:** Small (15 min)
**Risk:** Low

```typescript
import { EarlyAccessRequestDtoSchema } from '@macon/contracts';

router.post('/early-access', signupLimiter, async (req, res, next) => {
  try {
    const { email } = EarlyAccessRequestDtoSchema.parse(req.body);
    // Remove manual regex validation - Zod handles it
    const normalizedEmail = email.toLowerCase().trim();
    // ...
  } catch (error) {
    if (error instanceof z.ZodError) {
      throw new ValidationError(error.errors[0].message);
    }
    throw error;
  }
});
```

### Option B: Wire Route Through tsRestExpress
**Pros:** Full contract enforcement, consistent with other endpoints
**Cons:** Larger refactor, changes route registration
**Effort:** Medium (1 hour)
**Risk:** Medium

```typescript
import { tsRestExpress } from '@ts-rest/express';
const earlyAccessRouter = tsRestExpress(contract.requestEarlyAccess, {
  handler: async ({ body }) => {
    // body is already validated by Zod
    const { email } = body;
    // ...
  }
});
```

### Option C: Remove Unused Zod Schema (Simplification)
**Pros:** Removes dead code, keeps current validation
**Cons:** Loses potential validation benefits
**Effort:** Small (10 min)
**Risk:** Low

Remove `EarlyAccessRequestDtoSchema` from dto.ts if not going to use it.

## Recommended Action

Implement Option A - add Zod parse at route start for immediate validation improvement with minimal refactor.

## Technical Details

**Affected files:**
- `server/src/routes/auth.routes.ts` (lines 793-868)
- `packages/contracts/src/dto.ts` (lines 197-207)
- `packages/contracts/src/api.v1.ts` (lines 279-290)

## Acceptance Criteria

- [x] Zod schema validates email format on backend
- [x] CRLF injection blocked by Zod `.email()` validation
- [x] Email length enforced (max 254 chars)
- [x] Existing tests still pass (7/7 early-access tests)
- [x] Manual regex validation removed (DRY)

## Work Log

| Date | Action | Learnings |
|------|--------|-----------|
| 2025-12-06 | Created from code review | Security-sentinel and architecture agents identified validation gap |

## Resources

- Commit: b787c49
- Related TODO: TODO-293 (marked resolved but contract not enforced)
