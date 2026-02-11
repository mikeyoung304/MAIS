---
status: complete
priority: p2
issue_id: '7004'
tags: [code-review, performance, agent, pr-45]
dependencies: []
---

# 7004: Parallelization — build_first_draft Waterfall + Seed Package Deletes

## Problem Statement

Two parallelization opportunities in `first-draft.ts`:

1. **Data fetching waterfall** — 4 sequential `callMaisApiTyped` calls (structure, facts, research, packages) that are fully independent
2. **Seed package deletion loop** — 3 sequential `callMaisApi` delete calls that are independent

Combined latency penalty: 4-7 serial API calls when all could run in parallel.

## Findings

### 1. Data fetching (lines 99-219)

```typescript
const structureResult = await callMaisApiTyped('/storefront/structure', ...);
const factsResult = await callMaisApiTyped('/get-discovery-facts', ...);
const researchResult = await callMaisApiTyped('/get-research-data', ...);
const listResult = await callMaisApiTyped('/content-generation/manage-packages', ...);
```

All 4 calls are independent — no data dependency between them.

### 2. Seed package deletes (lines 228-233)

```typescript
for (const pkg of defaultPackages) {
  await callMaisApi('/content-generation/manage-packages', tenantId, {
    action: 'delete',
    packageId: pkg.id,
  });
}
```

Each delete is independent.

## Recommended Action

1. **Data fetching**: Use `Promise.all` with `.catch(() => null)` for optional calls:

```typescript
const [structureResult, factsResult, researchResult, listResult] = await Promise.all([
  callMaisApiTyped('/storefront/structure', tenantId, {}, StorefrontStructureResponse),
  callMaisApiTyped('/get-discovery-facts', tenantId, {}, GetDiscoveryFactsResponse),
  callMaisApiTyped('/get-research-data', tenantId, {}, GetResearchDataResponse).catch(() => ({
    ok: false as const,
    error: 'Research unavailable',
  })),
  callMaisApiTyped(
    '/content-generation/manage-packages',
    tenantId,
    { action: 'list' },
    PackageListResponse
  ).catch(() => ({ ok: false as const, error: 'Packages unavailable' })),
]);
```

2. **Seed deletes**: Use `Promise.all`:

```typescript
await Promise.all(
  defaultPackages.map((pkg) =>
    callMaisApi('/content-generation/manage-packages', tenantId, {
      action: 'delete',
      packageId: pkg.id,
    })
  )
);
```

## Technical Details

- **Affected files:** `server/src/agent-v2/deploy/tenant/src/tools/first-draft.ts`
- **Components:** build_first_draft tool
- **Database:** No changes

## Acceptance Criteria

- [x] 4 data-fetching calls execute in parallel via Promise.all
- [x] Seed package deletes execute in parallel via Promise.all
- [x] Per-call error handling preserved (partial failure still works)
- [x] No regression in section content or ordering

## Work Log

| Date       | Action                                                    | Learnings                         |
| ---------- | --------------------------------------------------------- | --------------------------------- |
| 2026-02-11 | Created from PR #45 review                                | Found by Performance Oracle agent |
| 2026-02-11 | Expanded: added seed package delete parallelization       | Cross-agent synthesis             |
| 2026-02-11 | Implemented: Promise.all for data fetching + seed deletes | Straightforward refactor          |

## Resources

- PR #45: refactor/agent-debt-cleanup
- File: `server/src/agent-v2/deploy/tenant/src/tools/first-draft.ts`
