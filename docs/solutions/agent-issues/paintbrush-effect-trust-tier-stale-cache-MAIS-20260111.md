# Paintbrush Effect: Trust Tier Mismatch + Stale Cache

**Date:** 2026-01-11
**Severity:** P1 Critical
**Commits:** `ecd60e5f`, `1ddcdc99`
**Status:** RESOLVED

## Problem

The "paintbrush effect" - where AI agent changes should appear in real-time in the preview panel - was completely broken. Users would ask the agent to change content, the agent would confirm success, but the preview never updated.

## Root Cause Analysis

This was a **double-layered bug** requiring both issues to be fixed:

### Bug 1: Trust Tier Mismatch (P1)

Tools declared `trustTier: 'T1'` in their definition but passed `'T2'` to `createProposal()`:

```typescript
// Tool definition said T1
export const updatePageSectionTool: AgentTool = {
  name: 'update_page_section',
  trustTier: 'T1', // ← Says T1 here
  // ...
  async execute(context, params) {
    // But createProposal was called with T2!
    return createProposal(context, 'update_page_section', operation, 'T2', payload, preview);
    //                                                                 ↑ Wrong!
  },
};
```

The orchestrator's auto-execute logic checks `result.trustTier` (from the proposal), not the tool definition:

```typescript
// base-orchestrator.ts line 1132
if (result.trustTier === 'T1' && !result.requiresApproval) {
  // Auto-execute - but this never ran because trustTier was 'T2'!
}
```

**Result:** Proposals were created with status `PENDING` but never executed. No database write occurred.

### Bug 2: TanStack Query staleTime (P1)

Even if the proposal HAD executed, the frontend wouldn't show updates:

```typescript
// useDraftConfig.ts
const query = useQuery({
  queryKey: DRAFT_CONFIG_QUERY_KEY,
  staleTime: 30_000, // ← 30 seconds! Data considered "fresh"
});
```

When `invalidateQueries()` was called, TanStack Query saw the data was still "fresh" and didn't refetch for up to 30 seconds.

### Bug 3: Race Condition (P2)

PostgreSQL transactions with `ReadCommitted` isolation + connection pooling (Supabase Session Pooler) could cause the refetch to hit the database before the write transaction was visible.

## Solution

### Fix 1: Align Trust Tier in createProposal Calls

Changed 3 locations in `server/src/agent/tools/storefront-tools.ts`:

```typescript
// Before
return createProposal(context, 'update_page_section', operation, 'T2', payload, preview);

// After
return createProposal(context, 'update_page_section', operation, 'T1', payload, preview);
```

Affected tools:

- `update_page_section` (line 284)
- `remove_page_section` (line 407)
- `update_storefront_branding` (lines 736-743)

### Fix 2: Set staleTime to 0

Changed `apps/web/src/hooks/useDraftConfig.ts`:

```typescript
// Before
staleTime: 30_000, // 30 seconds

// After
staleTime: 0, // Real-time updates: agent tools modify config, refetch immediately
```

Also added `refetchType: 'active'` to the invalidation:

```typescript
export const invalidateDraftConfig = (): void => {
  if (queryClientRef) {
    queryClientRef.invalidateQueries({
      queryKey: DRAFT_CONFIG_QUERY_KEY,
      refetchType: 'active', // Force refetch even if query is inactive
    });
  }
};
```

### Fix 3: Add Delay Before Cache Invalidation

Changed `apps/web/src/components/agent/AgentPanel.tsx`:

```typescript
onToolComplete={() => {
  // P2-FIX: Small delay ensures PostgreSQL transaction is visible before refetch
  setTimeout(() => {
    invalidateDraftConfig();
  }, 100);
}}
```

## Verification

Tested end-to-end with Playwright MCP:

1. Logged into tenant dashboard
2. Asked AI: "Change the hero headline to 'Transform Your Life Today'"
3. Agent executed `update_page_section` tool (auto-executed as T1)
4. Preview updated in real-time showing new headline
5. Save/Shred buttons appeared for draft management

## Prevention Strategies

### 1. Trust Tier Consistency Check

When defining agent tools with proposals, ensure the `trustTier` in the tool definition matches the tier passed to `createProposal()`:

```typescript
// CORRECT - both say T1
export const myTool: AgentTool = {
  trustTier: 'T1',
  async execute(context, params) {
    return createProposal(context, 'my_tool', op, 'T1', payload, preview);
    //                                            ↑ Must match tool definition
  },
};
```

### 2. Real-Time Features Need staleTime: 0

For any feature requiring real-time updates (agent-driven changes, collaborative editing, live previews), use `staleTime: 0`:

```typescript
const query = useQuery({
  queryKey: ['my-data'],
  staleTime: 0, // Required for real-time features
});
```

### 3. Race Condition Prevention with Delays

When invalidating cache after database writes, add a small delay to ensure transaction visibility across connection pools:

```typescript
onWriteComplete(() => {
  setTimeout(() => {
    invalidateCache();
  }, 100); // 100ms covers typical commit propagation
});
```

## Related Files

- `server/src/agent/tools/storefront-tools.ts` - Tool definitions and createProposal calls
- `server/src/agent/orchestrator/base-orchestrator.ts` - T1 auto-execute logic (line 1132)
- `apps/web/src/hooks/useDraftConfig.ts` - TanStack Query configuration
- `apps/web/src/components/agent/AgentPanel.tsx` - Cache invalidation callback

## Key Insight

The bug was hard to find because each layer looked correct in isolation:

1. Tools appeared to work (proposal created, no errors)
2. Cache invalidation code ran (no warnings logged)
3. The actual failure was a **mismatch between layers** - the tool said T1, but the proposal said T2

Always trace the full flow when debugging real-time features: **Tool → Proposal → Executor → DB → Cache → Refetch → UI**
