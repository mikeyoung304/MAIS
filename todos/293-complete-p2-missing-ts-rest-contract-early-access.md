---
status: resolved
priority: p2
issue_id: '293'
tags: [code-review, architecture, type-safety, early-access]
dependencies: []
resolved_at: 2025-12-06
resolution: 'Added EarlyAccessRequestDtoSchema and EarlyAccessResponseDtoSchema to dto.ts, requestEarlyAccess contract to api.v1.ts, updated api.ts to use ts-rest client'
---

# Missing ts-rest Contract for Early Access Endpoint

## Problem Statement

The early-access endpoint uses raw fetch instead of ts-rest contracts. This bypasses type safety and violates project rule: "Never define response types in routes or client. Always import from contracts."

**Why it matters:** No compile-time validation, inconsistent with 100% of other endpoints.

## Findings

**File:** `client/src/lib/api.ts` (lines 217-230)

```typescript
// Current: Raw fetch bypasses type safety
api.requestEarlyAccess = async (email: string) => {
  const response = await fetch(`${baseUrl}/v1/auth/early-access`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email }),
  });
  return { status: response.status, body: await response.json().catch(() => null) };
};
```

**All other endpoints use ts-rest:**

```typescript
// Example from packages/contracts/src/api.v1.ts
tenantSignup: {
  method: 'POST',
  path: '/v1/auth/signup',
  body: TenantSignupDtoSchema,
  responses: { 201: TenantSignupResponseSchema, ... }
}
```

## Proposed Solutions

### Option A: Add ts-rest Contract (Recommended)

**Pros:** Type safety, consistent patterns, runtime validation via Zod
**Cons:** Requires contract boilerplate
**Effort:** Small (30 min)
**Risk:** Low

```typescript
// packages/contracts/src/dto.ts
export const EarlyAccessRequestDtoSchema = z.object({
  email: z.string().email(),
});

export const EarlyAccessResponseDtoSchema = z.object({
  message: z.string(),
});

// packages/contracts/src/api.v1.ts
requestEarlyAccess: {
  method: 'POST',
  path: '/v1/auth/early-access',
  body: EarlyAccessRequestDtoSchema,
  responses: {
    200: EarlyAccessResponseDtoSchema,
    400: BadRequestErrorSchema,
    429: TooManyRequestsErrorSchema,
  },
}
```

## Recommended Action

Add contract definition and migrate to type-safe client.

## Technical Details

**Affected files:**

- `packages/contracts/src/dto.ts` (add schemas)
- `packages/contracts/src/api.v1.ts` (add contract)
- `client/src/lib/api.ts` (remove manual fetch)
- `server/src/routes/auth.routes.ts` (optional: use ts-rest handler)

## Acceptance Criteria

- [x] Contract defined in packages/contracts (EarlyAccessRequestDtoSchema, EarlyAccessResponseDtoSchema)
- [x] Client uses type-safe API client (api.ts updated)
- [x] Response types are inferred from contract
- [x] Build passes with new contract (npm run build --workspace=@macon/contracts passed)

## Work Log

| Date       | Action                   | Learnings                                     |
| ---------- | ------------------------ | --------------------------------------------- |
| 2025-12-06 | Created from code review | Architecture agent identified type safety gap |

## Resources

- PR commit: 9548fc3
- Pattern: See existing contracts in `packages/contracts/src/api.v1.ts`
