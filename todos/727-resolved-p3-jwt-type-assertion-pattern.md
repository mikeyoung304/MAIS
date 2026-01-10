---
status: resolved
priority: p3
issue_id: '727'
tags:
  - code-review
  - typescript
  - security
dependencies: []
---

# P3: JWT Type Assertion Before Runtime Validation

## Problem Statement

The preview token validation uses `as PreviewTokenPayload` type assertion immediately after `jwt.verify()`, before validating the payload structure. While there IS subsequent runtime validation, the pattern could be improved for type safety.

## Findings

**Location:** `server/src/lib/preview-tokens.ts` (line 135)

**Current Code:**

```typescript
const payload = jwt.verify(token, config.JWT_SECRET, {
  algorithms: ['HS256'],
}) as PreviewTokenPayload;

// Subsequent runtime validation (lines 138-153)
if (!payload.tenantId || !payload.slug || !payload.type) {
  return { valid: false, error: 'malformed', message: '...' };
}
```

**Issue:**

- Type assertion happens BEFORE validation
- If `jwt.verify()` returns unexpected shape, TypeScript considers it `PreviewTokenPayload`
- Manual field checks are correct but could use Zod for consistency

**Current Mitigation:**

- Runtime checks do validate required fields
- JWT signature validation already provides some structure guarantee
- Short-lived tokens limit exposure

## Solution Implemented

Used Zod schema validation before type assertion (Option A from proposed solutions):

```typescript
// Zod schema defined at module level
const PreviewTokenPayloadSchema = z.object({
  tenantId: z.string(),
  slug: z.string(),
  type: z.literal('preview'),
  iat: z.number().optional(),
  exp: z.number().optional(),
});

// In validatePreviewToken:
const rawPayload = jwt.verify(token, config.JWT_SECRET, { algorithms: ['HS256'] });

// Validate payload structure with Zod BEFORE type assertion
const parseResult = PreviewTokenPayloadSchema.safeParse(rawPayload);
if (!parseResult.success) {
  // Check if the issue is specifically the wrong type field
  if (
    typeof rawPayload === 'object' &&
    rawPayload !== null &&
    'type' in rawPayload &&
    (rawPayload as { type: unknown }).type !== 'preview'
  ) {
    return { valid: false, error: 'wrong_type', message: `...` };
  }
  return { valid: false, error: 'malformed', message: 'Token is missing required fields' };
}

const payload = parseResult.data; // Now properly typed after validation
```

**Benefits:**

- Type safety: `payload` is only `PreviewTokenPayload` after Zod validation succeeds
- Consistent with codebase patterns (Zod is used throughout for validation)
- Maintains exact same error behavior (wrong_type vs malformed distinction preserved)
- All 12 existing tests pass

## Acceptance Criteria

- [x] Type assertion only after validation succeeds
- [x] Consistent with codebase patterns (prefer Zod)
- [x] Existing tests pass
- [x] Same error behavior for invalid tokens

## Work Log

| Date       | Action                     | Learnings                                                                                                                                                                                      |
| ---------- | -------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 2026-01-10 | Created from code review   | TypeScript reviewer identified type safety concern                                                                                                                                             |
| 2026-01-10 | Implemented Zod validation | Replaced `as PreviewTokenPayload` with `PreviewTokenPayloadSchema.safeParse()`. Added special handling to preserve `wrong_type` error for tokens with incorrect type field. All 12 tests pass. |

## Resources

- TypeScript review agent findings
- Prevention strategy: `docs/solutions/patterns/CODE_REVIEW_708_717_PREVENTION_STRATEGIES.md` (type assertion patterns)
