---
status: pending
priority: p2
issue_id: '462'
tags: [code-review, test-data-isolation, architecture, enhancement]
dependencies: []
---

# P2: Route Handlers Don't Pass `includeTestTenants` Parameter (Enhancement)

**Note:** Downgraded from P1 to P2. The core feature works - test tenants ARE hidden by default. This is an enhancement to add admin toggle capability, not a blocking bug.

## Problem Statement

The `includeTestTenants` parameter was added to `getAllTenants()` and `getStats()` controller methods, but the route handlers in `routes/index.ts` don't extract or pass this parameter from the request. The filtering logic is effectively dead code.

**Why it matters:** The feature is incomplete - there's no way for platform admins to toggle test tenant visibility via the API.

## Findings

### Discovery 1: Route handlers ignore query parameter

**Source:** Architecture Review Agent
**Location:** `server/src/routes/index.ts` lines 303-306, 337-340

```typescript
// Current - Parameter not passed through
platformGetAllTenants: async () => {
  const data = await controllers.platformAdmin.getAllTenants();
  return { status: 200 as const, body: data };
},
```

### Discovery 2: API contract missing query schema

**Source:** Architecture Review Agent
**Location:** `packages/contracts/src/api.v1.ts` lines 665-675, 746-756

The contract doesn't define an `includeTest` query parameter, so there's no type-safe way for clients to request test tenants.

### Discovery 3: Admin tenants route also affected

**Source:** Architecture Review Agent
**Location:** `server/src/routes/admin/tenants.routes.ts` line 34

Same issue - calls `listWithStats()` without passing the parameter.

## Proposed Solutions

### Solution 1: Add Query Parameter Support (Recommended)

**Effort:** Small | **Risk:** Low

1. Update contract to add query schema
2. Update route handlers to extract and pass parameter
3. Update frontend to add toggle

```typescript
// In packages/contracts/src/api.v1.ts
platformGetAllTenants: {
  method: 'GET',
  path: '/v1/admin/tenants',
  query: z.object({
    includeTest: z.enum(['true', 'false']).optional().default('false'),
  }),
  responses: { ... },
}

// In server/src/routes/index.ts
platformGetAllTenants: async ({ query }) => {
  const includeTestTenants = query?.includeTest === 'true';
  const data = await controllers.platformAdmin.getAllTenants(includeTestTenants);
  return { status: 200 as const, body: data };
},
```

### Solution 2: Remove Parameter, Always Filter

**Effort:** Tiny | **Risk:** Low

If admins never need to see test tenants, remove the parameter entirely:

- Remove `includeTestTenants` parameter from all methods
- Hardcode `{ isTestTenant: false }` filter

**Pros:** Simpler, no contract changes needed
**Cons:** Inflexible, can't debug test tenant issues

## Recommended Action

<!-- Filled during triage -->

## Technical Details

**Affected Files:**

- `packages/contracts/src/api.v1.ts` - Add query schema
- `server/src/routes/index.ts` - Pass query param to controller
- `server/src/routes/admin/tenants.routes.ts` - Pass query param to repository

**Database Changes:** None

## Acceptance Criteria

- [ ] Contract defines `includeTest` query parameter
- [ ] Route handlers extract and pass parameter to controllers
- [ ] TypeScript types are correct end-to-end
- [ ] Default behavior (no param) excludes test tenants
- [ ] Setting `?includeTest=true` shows test tenants

## Work Log

| Date       | Action                       | Outcome/Learning                               |
| ---------- | ---------------------------- | ---------------------------------------------- |
| 2025-12-29 | Code review identified issue | Dead code - parameter never reaches controller |

## Resources

- PR: Current uncommitted changes on `feat/customer-chatbot`
- Related: #462 test data isolation implementation
