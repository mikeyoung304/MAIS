# Add Typed API Response Schemas for Agent ↔ MAIS Contract

**Priority:** P2
**Files:** New: `server/src/agent-v2/deploy/tenant/src/types/api-responses.ts`, updates across tool files
**Blocked by:** 6005 (shared constants), 6006 (tool wrapper pattern)
**Plan:** `docs/plans/2026-02-11-refactor-agent-debt-cleanup-plan.md`

## Problem

Every API response from `callMaisApi` is typed as `{ ok: boolean; data?: unknown }`. Tools cast `data` with `as` — 22+ untyped casts across the codebase. If the backend changes a response shape, the agent silently gets wrong data.

Two tools (`first-draft.ts` and `refinement.ts`) cast the SAME endpoint (`/storefront/structure`) to DIFFERENT shapes — one of them is wrong (fixed in todo 6002).

## Fix

### 1. Create response type definitions

**New file:** `server/src/agent-v2/deploy/tenant/src/types/api-responses.ts`

Define Zod schemas for every API response the agent consumes:

```typescript
import { z } from 'zod';

// /storefront/structure
export const StorefrontStructureResponse = z.object({
  sections: z.array(
    z.object({
      id: z.string(),
      page: z.string(),
      type: z.string(),
      headline: z.string(),
      hasPlaceholder: z.boolean(),
    })
  ),
  totalCount: z.number(),
  hasDraft: z.boolean(),
  previewUrl: z.string().optional(),
});

// /storefront/section
export const SectionContentResponse = z.object({
  sectionId: z.string(),
  type: z.string(),
  content: z.record(z.unknown()),
  // ... other fields
});

// /get-discovery-facts
export const DiscoveryFactsResponse = z.object({
  facts: z.record(z.unknown()),
  factCount: z.number(),
  factKeys: z.array(z.string()),
});

// /store-discovery-fact
export const StoreFactResponse = z.object({
  stored: z.boolean(),
  key: z.string(),
  value: z.unknown(),
  totalFactsKnown: z.number(),
  nextAction: z.string(),
  // ... slot machine fields
});

// /get-research-data
export const ResearchDataResponse = z.object({
  hasData: z.boolean(),
  researchData: z
    .object({
      competitorPricing: z
        .object({
          low: z.number(),
          high: z.number(),
          currency: z.string(),
          summary: z.string(),
        })
        .optional(),
      marketPositioning: z.array(z.string()).optional(),
      localDemand: z.string().optional(),
      insights: z.array(z.string()).optional(),
    })
    .nullable(),
});

// /content-generation/manage-packages
export const ManagePackagesResponse = z.object({
  packages: z
    .array(
      z.object({
        id: z.string(),
        name: z.string(),
        priceInDollars: z.number(),
      })
    )
    .optional(),
  // ... varies by action
});

// /storefront/update-section
export const UpdateSectionResponse = z.object({
  success: z.boolean(),
  sectionId: z.string(),
  visibility: z.string(),
  verified: z.boolean().optional(),
  dashboardAction: z
    .object({
      type: z.string(),
      sectionId: z.string().optional(),
    })
    .optional(),
});

// Export inferred types
export type StorefrontStructure = z.infer<typeof StorefrontStructureResponse>;
export type SectionContent = z.infer<typeof SectionContentResponse>;
// ... etc
```

### 2. Add typed `callMaisApiTyped` to utils.ts (or update callMaisApi)

```typescript
/**
 * Call MAIS API with response validation.
 * Parses response with Zod schema — returns typed data instead of unknown.
 */
export async function callMaisApiTyped<T>(
  endpoint: string,
  tenantId: string,
  params: Record<string, unknown>,
  responseSchema: z.ZodType<T>
): Promise<{ ok: true; data: T } | { ok: false; error: string }> {
  const result = await callMaisApi(endpoint, tenantId, params);
  if (!result.ok) return { ok: false, error: result.error ?? 'Request failed' };

  const parsed = responseSchema.safeParse(result.data);
  if (!parsed.success) {
    logger.warn({ endpoint, errors: parsed.error.format() }, '[API] Response shape mismatch');
    return { ok: false, error: `Response validation failed: ${parsed.error.message}` };
  }
  return { ok: true, data: parsed.data };
}
```

### 3. Update tool files to use typed calls

Replace all `as` casts with `callMaisApiTyped`:

Before:

```typescript
const result = await callMaisApi('/storefront/structure', tenantId, {});
const data = result.data as { sections: Array<{...}> };
```

After:

```typescript
const result = await callMaisApiTyped(
  '/storefront/structure',
  tenantId,
  {},
  StorefrontStructureResponse
);
if (!result.ok) return { success: false, error: result.error };
const { sections, totalCount, hasDraft } = result.data; // Fully typed!
```

### 4. Priority: Start with the most-used endpoints

1. `/storefront/structure` (used by first-draft, refinement, storefront-read)
2. `/get-discovery-facts` (used by first-draft, discovery)
3. `/storefront/update-section` (used by storefront-write)
4. `/content-generation/manage-packages` (used by packages, first-draft)
5. `/get-research-data` (used by first-draft, research)

## Verification

```bash
npm run --workspace=server typecheck
# Verify no more `as` casts on API data:
grep -r "result\.data as" server/src/agent-v2/deploy/tenant/src/tools/
# Should return 0 matches
```
