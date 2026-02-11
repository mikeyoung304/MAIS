---
status: complete
priority: p2
issue_id: '7007'
tags: [code-review, cleanup, pr-45]
dependencies: []
---

# 7007: Dead Imports + Minor Code Fixes (8 One-Liners)

## Problem Statement

Wave 3→4 migration left behind dead imports and a few minor inconsistencies. These are all trivial 1-line fixes but collectively they create noise and confusion.

## Fixes Required

### 1. `storefront-read.ts:87` — Wrong response schema

Change `GenericRecordResponse` → `StorefrontStructureResponse` (import it from `api-responses.ts`).
Same endpoint `/storefront/structure` already uses `StorefrontStructureResponse` in `first-draft.ts` and `refinement.ts`.

### 2. `vocabulary.ts:18` — Dead import

Remove `callMaisApi as _callMaisApi` from imports. Never used.

### 3. `draft.ts:19` — Dead import

Remove `callMaisApi` from imports. Only `callMaisApiTyped` is used for typed calls. Check if `callMaisApi` is actually used in this file for the fire-and-forget seed deletes — if so, keep it. If not, remove.

### 4. `marketing.ts:44` — Dead import

Remove `callMaisApiTyped` from imports. Marketing tools are local/instruction-only with no backend calls.

### 5. `refinement.ts:33` — Unnecessary alias

Change `GenerateVariantsResponse as GenerateVariantsApiResponseSchema` → just `GenerateVariantsResponse`. No local name collision exists.

### 6. `utils.ts:242` — Wrong log level

Change `logger.warn` → `logger.error` for response shape mismatch. A contract violation between agent and monolith is an error, not a warning.

### 7. `discovery.service.ts:238-258` — Double DB write

Merge the two sequential `tenantRepo.update()` calls (fact storage + phase advancement) into one:

```typescript
const updateData: Record<string, unknown> = { branding: { ...branding, discoveryFacts } };
if (slotResult.phaseAdvanced) {
  updateData.onboardingPhase = slotResult.currentPhase;
}
await this.tenantRepo.update(tenantId, updateData);
```

### 8. `refinement.ts` — `type ToolContext` import

Verify this import is actually used. If the helper functions `getState`/`saveState` use it, keep it. If not, remove.

## Technical Details

- **Affected files:** `storefront-read.ts`, `vocabulary.ts`, `draft.ts`, `marketing.ts`, `refinement.ts`, `utils.ts`, `discovery.service.ts`
- **All in:** `server/src/agent-v2/deploy/tenant/src/tools/` and `server/src/services/`
- **Database:** No changes

## Acceptance Criteria

- [ ] Zero dead imports in tenant agent tool files
- [ ] `get_page_structure` uses `StorefrontStructureResponse` not `GenericRecordResponse`
- [ ] Response shape mismatch logged at error level
- [ ] storeFact performs single DB write (merged fact + phase update)
- [ ] `npm run --workspace=server typecheck` passes

## Work Log

| Date       | Action                     | Learnings                                                                  |
| ---------- | -------------------------- | -------------------------------------------------------------------------- |
| 2026-02-11 | Created from PR #45 review | Found by Pattern Recognition + Code Simplicity + Performance Oracle agents |

## Resources

- PR #45: refactor/agent-debt-cleanup
