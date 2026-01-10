---
status: pending
priority: p2
issue_id: '726'
tags:
  - code-review
  - typescript
  - contracts
dependencies: []
---

# P2: Missing Shared Contract for Preview Token Response

## Problem Statement

The preview token response type is defined separately in frontend and backend without a shared contract in `@macon/contracts`. If the response shape changes, TypeScript won't catch the mismatch at compile time.

## Findings

**Frontend Definition:**
`apps/web/src/hooks/usePreviewToken.ts` (lines 28-31)

```typescript
interface PreviewTokenResponse {
  token: string;
  expiresAt: string;
}
```

**Backend Response:**
`server/src/routes/tenant-admin.routes.ts` (lines 1949-1952)

```typescript
res.json({
  token,
  expiresAt,
});
```

**Risk:**

- If backend adds/removes fields, frontend type doesn't update
- No compile-time validation of API contract
- Inconsistent with other API contracts that use `@macon/contracts`

**Existing Pattern:** Other DTOs like `TenantPublicDto` are defined in contracts:

```typescript
// packages/contracts/src/dto.ts
export const TenantPublicDtoSchema = z.object({...});
export type TenantPublicDto = z.infer<typeof TenantPublicDtoSchema>;
```

## Proposed Solutions

### Option A: Add to Contracts Package (Recommended)

**Effort:** Small (20 min)
**Risk:** Low

Add schema to `packages/contracts/src/dto.ts`:

```typescript
// In packages/contracts/src/dto.ts
export const PreviewTokenResponseSchema = z.object({
  token: z.string(),
  expiresAt: z.string().datetime(),
});

export type PreviewTokenResponse = z.infer<typeof PreviewTokenResponseSchema>;
```

Update frontend hook:

```typescript
// In apps/web/src/hooks/usePreviewToken.ts
import { PreviewTokenResponse } from '@macon/contracts';

// Remove local interface definition, use import
```

Update backend route:

```typescript
// In server/src/routes/tenant-admin.routes.ts
import { PreviewTokenResponseSchema } from '@macon/contracts';

// Optionally validate response (defense-in-depth)
const response = PreviewTokenResponseSchema.parse({ token, expiresAt });
res.json(response);
```

### Option B: Add Type Export Only

**Effort:** Tiny (10 min)
**Risk:** Low

Export just the type without Zod validation:

```typescript
// In packages/contracts/src/types.ts
export interface PreviewTokenResponse {
  token: string;
  expiresAt: string;
}
```

Less comprehensive but faster to implement.

## Recommended Action

<!-- Filled during triage -->

## Technical Details

**Affected Files:**

- `packages/contracts/src/dto.ts`
- `apps/web/src/hooks/usePreviewToken.ts`
- `server/src/routes/tenant-admin.routes.ts`

**Components:**

- Contracts package
- Preview token hook
- Tenant admin routes

## Acceptance Criteria

- [ ] `PreviewTokenResponse` type exported from `@macon/contracts`
- [ ] Frontend imports type from contracts
- [ ] Backend optionally validates response shape
- [ ] TypeScript compilation catches mismatches
- [ ] Existing tests pass

## Work Log

| Date       | Action                   | Learnings                                       |
| ---------- | ------------------------ | ----------------------------------------------- |
| 2026-01-10 | Created from code review | TypeScript reviewer identified missing contract |

## Resources

- TypeScript review agent findings
- Existing patterns in `packages/contracts/src/dto.ts`
