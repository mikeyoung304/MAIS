---
title: "Paintbrush Effect Double Failure: Trust Tier Mismatch + staleTime"
date: 2026-01-11
category: agent-issues
severity: P1
symptoms:
  - Agent changes don't appear in preview panel
  - No error messages (silent failure)
  - Cache invalidation runs but preview stays stale
  - "Preview Connection Failed" may appear
root_cause: |
  Two independent bugs that both needed to be fixed:
  1. Tools declare trustTier: 'T1' but pass 'T2' to createProposal() - proposals never execute
  2. TanStack Query staleTime of 30 seconds prevents refetch even after invalidation
components:
  - server/src/agent/tools/storefront-tools.ts
  - apps/web/src/hooks/useDraftConfig.ts
  - Proposal execution flow
  - TanStack Query cache
related_patterns:
  - chatbot-proposal-execution-flow-MAIS-20251229
  - multi-agent-parallel-code-review-workflow-MAIS-20260109
  - DUAL_DRAFT_SYSTEM_PREVENTION_STRATEGIES
---

# Paintbrush Effect Double Failure

## Problem Summary

The "paintbrush effect" was not working - AI agent changes were not appearing in the preview panel. Users expected real-time updates when speaking to the agent, but the preview remained stale.

## Symptoms

1. Agent tool executes (no errors in console)
2. Proposal is created (visible in database)
3. Cache invalidation runs (no warnings)
4. Preview doesn't update
5. "Preview Connection Failed" may appear

## Why It Was Hard to Find

This was a **double failure** - two independent bugs that both needed to be fixed:

1. **Each layer looked correct in isolation:**
   - Tools returned success responses
   - Proposals were created without errors
   - Cache invalidation ran without warnings
   - Preview component rendered correctly

2. **No error messages:**
   - T2 proposals with soft-confirm don't throw errors - they just wait
   - Stale cache doesn't warn - it's "working as designed"

3. **Symptoms pointed elsewhere:**
   - "Preview not updating" suggested preview/iframe issue
   - "Changes not showing" suggested database write issue

## Root Cause 1: Trust Tier Mismatch

**File:** `server/src/agent/tools/storefront-tools.ts`

Tools declare `trustTier: 'T1'` (auto-confirm) but pass `'T2'` (soft-confirm) to `createProposal()`:

```typescript
// Tool declares T1
{
  name: 'update_page_section',
  trustTier: 'T1',  // ← Claims T1 (auto-execute)
}

// But passes T2 to createProposal
const proposal = await createProposal({
  trustTier: 'T2',  // ← BUG: Creates T2 proposal (requires confirmation)
});
```

**Impact:** Proposals are created with status `PENDING` instead of `CONFIRMED`. The T1 auto-execute block in `processResponse()` is skipped because `result.trustTier === 'T2'`. No database write ever occurs.

**Fix:**

```diff
const proposal = await createProposal({
-  trustTier: 'T2',
+  trustTier: 'T1',
  // ...
});
```

Apply at lines: 284, 303, 407, 661, 736-743

## Root Cause 2: TanStack Query staleTime

**File:** `apps/web/src/hooks/useDraftConfig.ts`

The hook has `staleTime: 30_000` (30 seconds):

```typescript
staleTime: 30_000, // Too long for real-time updates
```

And invalidation doesn't force refetch:

```typescript
queryClientRef.invalidateQueries({ queryKey: DRAFT_CONFIG_QUERY_KEY });
// Missing: refetchType: 'active'
```

**Impact:** Even when `invalidateQueries()` is called, TanStack Query considers data "fresh" and doesn't refetch. User sees stale preview for up to 30 seconds.

**Fix:**

```diff
- staleTime: 30_000,
+ staleTime: 0,

queryClientRef.invalidateQueries({
  queryKey: DRAFT_CONFIG_QUERY_KEY,
+ refetchType: 'active'
});
```

## Investigation Methodology

This bug was found using **multi-agent parallel review** with 6 specialized agents:

| Agent             | Finding                         |
| ----------------- | ------------------------------- |
| 🏗️ Architecture   | Trust tier mismatch (P1)        |
| ⚡ Performance    | staleTime blocks refetch (P1)   |
| 🔒 Security       | Proxy security is sound         |
| 📊 Data Integrity | Data format is correct          |
| 📝 TypeScript     | Paths are correct at all layers |
| 🧹 Simplicity     | HMR fragility (P3)              |

Key insight: Architecture found the backend bug, Performance found the frontend bug. Neither would have found both.

## Prevention Strategies

### 1. Type-Level Validation

Add validation in `createProposal()` to verify tier matches tool definition:

```typescript
function createProposal({ toolName, trustTier, ... }) {
  const toolDef = getToolDefinition(toolName);
  if (toolDef.trustTier !== trustTier) {
    throw new Error(`Trust tier mismatch: ${toolName} declares ${toolDef.trustTier} but received ${trustTier}`);
  }
}
```

### 2. E2E Test for Full Flow

```typescript
test('paintbrush effect: agent changes appear in preview', async ({ page }) => {
  // 1. Navigate to build mode
  await page.goto('/tenant/build');

  // 2. Send message to agent
  await page.fill('[data-testid="agent-input"]', 'Change headline to "Test"');
  await page.click('[data-testid="send-button"]');

  // 3. Wait for preview to update
  await expect(page.frameLocator('iframe').locator('h1')).toContainText('Test', {
    timeout: 5000,
  });
});
```

### 3. Code Review Checklist

When reviewing agent tool PRs, verify:

- [ ] `trustTier` in tool definition matches `createProposal()` call
- [ ] If tool modifies data, cache invalidation is wired up
- [ ] `staleTime` is appropriate for the use case (0 for real-time)

## Related Documentation

- [Trust Tier System](../patterns/chatbot-proposal-execution-flow-MAIS-20251229.md)
- [Multi-Agent Parallel Review](../methodology/multi-agent-parallel-code-review-workflow-MAIS-20260109.md)
- [Dual Draft System Prevention](../patterns/DUAL_DRAFT_SYSTEM_PREVENTION_STRATEGIES.md)

## Key Insight

When debugging "changes don't appear" bugs in agent-driven systems:

1. **Trace the full pipeline:** Tool declaration → createProposal → executor → database → cache invalidation → query refetch → render
2. **Check for mismatches:** Declared behavior vs actual behavior
3. **Verify cache actually refetches:** `staleTime > 0` means invalidation marks as stale but doesn't refetch until next access
4. **Use multi-agent review:** Specialized agents find non-overlapping issues
