# Fix refinement.ts Wrong API Response Cast

**Priority:** P1
**Files:** `server/src/agent-v2/deploy/tenant/src/tools/refinement.ts`
**Blocked by:** Nothing
**Plan:** `docs/plans/2026-02-11-refactor-agent-debt-cleanup-plan.md`

## Problem

The `get_next_incomplete_section` tool in `refinement.ts` casts the `/storefront/structure` API response to a DIFFERENT shape than what the endpoint actually returns. This causes a silent runtime failure during guided refinement.

### What the endpoint returns (flat array):

```typescript
// From internal-agent-storefront.routes.ts line 137-145
{
  sections: Array<{ id: string; page: string; type: string; headline: string; hasPlaceholder: boolean }>,
  totalCount: number,
  hasDraft: boolean
}
```

### What refinement.ts expects (nested pages — WRONG):

```typescript
// refinement.ts ~line 609
const pages = structureResult.data as Array<{
  pageName: string;
  sections: Array<{ sectionId: string; type: string; headline?: string }>;
}>;
```

### What first-draft.ts uses (flat — CORRECT):

```typescript
// first-draft.ts line 122
const structureData = structureResult.data as {
  sections: Array<{
    id: string;
    page: string;
    type: string;
    headline: string;
    hasPlaceholder: boolean;
  }>;
  totalCount: number;
  hasDraft: boolean;
};
```

## Fix

In `refinement.ts`, find the `get_next_incomplete_section` tool's execute function (around line 580-650). Change the `as` cast to match the actual flat response shape:

```typescript
const structureData = structureResult.data as {
  sections: Array<{
    id: string;
    page: string;
    type: string;
    headline: string;
    hasPlaceholder: boolean;
  }>;
  totalCount: number;
  hasDraft: boolean;
};
```

Then update the code that iterates over the result — it currently expects `pages[].sections[]` nesting but should iterate over `structureData.sections` directly. The field names also differ: `sectionId` → `id`, and there's no `pageName` wrapper.

## Also Fix

While in refinement.ts, clean up two other items:

1. **Delete `createInitialState` local duplicate** (~line 54) — import from `types/guided-refinement.ts` instead, OR delete the one in types/ (it's the unused one — check which is actually called)
2. **Delete `createEmptyVariantSet` dead export** from `types/guided-refinement.ts` — never called anywhere

## Verification

```bash
npm run --workspace=server typecheck
```
