---
status: complete
priority: p2
issue_id: "362"
tags: [code-review, typescript, type-safety]
dependencies: []
---

# Placeholder Contracts in API Client

## Problem Statement

The API client uses placeholder contracts with `as never` cast instead of importing actual contracts from `@macon/contracts`. This bypasses TypeScript validation entirely.

**Why it matters:** No compile-time type checking for API calls. Runtime failures won't be caught until production.

## Findings

**File:** `apps/web/src/lib/api.ts` (lines 65-75, 129-135)

```typescript
const placeholderContract = {
  getHealth: {
    method: 'GET' as const,
    path: '/health',
    responses: { 200: null as unknown },  // ❌ null as unknown
  },
};

return initClient(placeholderContract as never, {  // ❌ 'as never' bypasses types
  // ...
});
```

**Impact:** P1 - Type safety completely bypassed for API calls

## Proposed Solutions

### Option 1: Import Actual Contracts (Required)
- **Description:** Import and use contracts from `@macon/contracts`
- **Pros:** Full type safety, catches API mismatches at compile time
- **Cons:** May need to ensure contracts are exported correctly
- **Effort:** Small (30 min)
- **Risk:** Low

**Fix:**
```typescript
import { contract } from '@macon/contracts';

export async function createServerApiClient() {
  // ... auth logic
  return initClient(contract, { baseUrl: API_URL, ... });
}
```

## Recommended Action

**FIX NOW** - `as never` bypasses TypeScript entirely, creating silent bugs. Either properly type the contracts or remove the unused API client. Type safety is non-negotiable for quality code.

## Technical Details

**Files to Modify:**
- `apps/web/src/lib/api.ts` - Replace placeholder with real contracts
- May need to verify `@macon/contracts` exports

**Verification:**
```bash
npm run typecheck --workspace=@macon/web-next
# Should catch any API call type mismatches
```

## Acceptance Criteria

- [ ] Placeholder contract removed
- [ ] Real contract imported from @macon/contracts
- [ ] TypeScript validates all API calls
- [ ] Build passes with strict mode

## Work Log

| Date | Action | Learnings |
|------|--------|-----------|
| 2025-12-25 | Created during code review | Type safety bypassed in API client |

## Resources

- ts-rest documentation: https://ts-rest.com/docs/intro
- @macon/contracts: packages/contracts/src/
