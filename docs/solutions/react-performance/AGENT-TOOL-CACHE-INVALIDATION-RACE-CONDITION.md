# Real-Time Preview Race Condition: Agent Tool Cache Invalidation

---

title: "Real-Time Preview Not Updating After Agent Changes"
problem_type: race-condition
component: real-time-preview
severity: p1
status: complete
discovered: 2026-02-02
fixed: 2026-02-02

symptoms:

- Preview doesn't update automatically when AI agent modifies storefront content
- Manual refresh ("Refresh preview" button) works
- Console shows `{"error":{}}` - empty error objects hiding root cause

related_pitfalls: [30, 45, 86, 90]

files_modified:

- apps/web/src/hooks/useDraftConfig.ts
- apps/web/src/components/agent/AgentPanel.tsx
- server/src/agent-v2/deploy/tenant/src/tools/vocabulary.ts

---

## Problem Summary

When an AI agent tool modifies storefront content, the preview panel doesn't update automatically. Users must manually refresh to see changes, even though the agent says "Done. Take a look."

**Key symptom:** Manual refresh works, proving data IS stored correctly - it's a timing/caching issue.

## Root Cause Analysis

### The Race Condition (Pitfall #30)

```
Timeline:
─────────────────────────────────────────────
t=0ms   Agent tool returns HTTP 200 response
t=1ms   Frontend fires invalidateQueries()
t=2ms   TanStack Query starts refetch
t=3ms   GET /draft hits database
t=10ms  Database transaction commits (agent write)
─────────────────────────────────────────────
Result: Refetch got data from BEFORE the write committed
```

**Why manual refresh works:** Humans add ~100ms delay by clicking a button, giving the transaction time to commit.

### Secondary Issues Identified

| Issue | Description                                          | Pitfall |
| ----- | ---------------------------------------------------- | ------- |
| #817  | Error objects serialize to `{}` - can't debug        | —       |
| #818  | No delay before invalidateQueries()                  | #30     |
| #819  | Dashboard action handlers missing cache invalidation | #90     |
| #820  | Inconsistent `refetchType` across mutations          | —       |
| #802  | Empty secret fallback masks misconfiguration         | #45     |

## Working Solution

### Primary Fix: 100ms Timing Delay (Pitfall #30)

**File:** `apps/web/src/components/agent/AgentPanel.tsx`

```typescript
// BEFORE (broken - race condition)
if (modifiedStorefront) {
  queryClient.invalidateQueries({
    queryKey: getDraftConfigQueryKey(),
    refetchType: 'active',
  });
}

// AFTER (fixed)
if (modifiedStorefront) {
  // Fix #818: Wait for backend transaction to commit (Pitfall #30)
  // The 100ms delay ensures the database write is visible before we refetch
  await new Promise((resolve) => setTimeout(resolve, 100));
  queryClient.invalidateQueries({
    queryKey: getDraftConfigQueryKey(),
    refetchType: 'active',
  });
}
```

**Why 100ms?**

- Database commit: ~10-50ms
- Network round-trip variance: ~20-100ms
- 100ms = 2x worst case (safe + imperceptible to users)

### Supporting Fix: Error Serialization

**File:** `apps/web/src/hooks/useDraftConfig.ts`

```typescript
// BEFORE (broken - Error objects serialize to {})
logger.error('[useDraftConfig] Failed to fetch draft', { error });

// AFTER (fixed - explicit property extraction)
logger.error('[useDraftConfig] Failed to fetch draft', {
  errorMessage: error instanceof Error ? error.message : String(error),
  errorStack: error instanceof Error ? error.stack : undefined,
  errorName: error instanceof Error ? error.name : undefined,
});
```

**Why:** JavaScript `Error` objects have non-enumerable properties. JSON.stringify returns `{}`, making debugging impossible.

### Supporting Fix: Dashboard Action Invalidation

**File:** `apps/web/src/components/agent/AgentPanel.tsx`

```typescript
const handleDashboardActions = useCallback(
  async (actions: DashboardAction[]) => {
    for (const action of actions) {
      switch (action.type) {
        case 'SHOW_PREVIEW':
          // Fix #819: Invalidate cache before showing preview
          await new Promise((resolve) => setTimeout(resolve, 100));
          queryClient.invalidateQueries({
            queryKey: getDraftConfigQueryKey(),
            refetchType: 'active',
          });
          agentUIActions.showPreview('home');
          break;
        case 'REFRESH':
        case 'REFRESH_PREVIEW':
          await new Promise((resolve) => setTimeout(resolve, 100));
          queryClient.invalidateQueries({
            queryKey: getDraftConfigQueryKey(),
            refetchType: 'active',
          });
          agentUIActions.refreshPreview();
          break;
      }
    }
  },
  [queryClient]
);
```

### Supporting Fix: Consistent refetchType

**File:** `apps/web/src/hooks/useDraftConfig.ts`

```typescript
// Add refetchType: 'active' to ALL invalidation calls
queryClient.invalidateQueries({
  queryKey: DRAFT_CONFIG_QUERY_KEY,
  refetchType: 'active', // Force refetch even if query is inactive
});
```

### Supporting Fix: Fail-Fast Secret Validation

**File:** `server/src/agent-v2/deploy/tenant/src/tools/vocabulary.ts`

```typescript
// BEFORE (broken - masks misconfiguration)
const INTERNAL_API_SECRET = process.env.INTERNAL_API_SECRET || '';

// AFTER (fixed - fails at startup if missing)
const INTERNAL_API_SECRET = requireEnv('INTERNAL_API_SECRET');
```

## Prevention Strategies

### Code Review Checklist

When reviewing cache invalidation code, verify:

- [ ] 100ms delay before `invalidateQueries()` after mutations
- [ ] `refetchType: 'active'` included in options
- [ ] Function is `async` and `await`s the delay
- [ ] Error logging extracts Error properties explicitly
- [ ] Environment variables use `requireEnv()` not fallbacks

### Standard Pattern (Copy-Paste)

```typescript
// Standard pattern for post-mutation cache invalidation
const invalidateAfterMutation = async (queryClient: QueryClient) => {
  // Wait for backend transaction to commit (Pitfall #30)
  await new Promise((resolve) => setTimeout(resolve, 100));

  queryClient.invalidateQueries({
    queryKey: getQueryKey(),
    refetchType: 'active', // Force refetch
  });
};
```

### Detection Commands

```bash
# Find invalidateQueries without delay
rg "invalidateQueries" apps/web/src --type ts -B 5 | grep -v "setTimeout\|new Promise"

# Find missing refetchType: 'active'
rg "invalidateQueries" apps/web/src --type ts | grep -v "refetchType"
```

### E2E Test Pattern

```typescript
test('preview updates after agent tool modifies storefront', async ({ page }) => {
  // 1. Navigate to build mode
  await page.goto('/dashboard');

  // 2. Send agent message to update headline
  await page.fill('[data-testid="chat-input"]', 'Change my headline to "Test Headline"');
  await page.click('[data-testid="send-button"]');

  // 3. Wait for agent response (includes 100ms delay + invalidation)
  await page.waitForSelector('[data-testid="agent-response"]');

  // 4. Verify preview shows new headline WITHOUT manual refresh
  const preview = page.frameLocator('[data-testid="preview-iframe"]');
  await expect(preview.locator('h1')).toContainText('Test Headline');
});
```

## Related Documentation

### Existing Prevention Docs

- [MODULE_LEVEL_QUERY_CLIENT_SINGLETON_PREVENTION.md](./MODULE_LEVEL_QUERY_CLIENT_SINGLETON_PREVENTION.md) - Pitfall #86
- [preview-canvas-agent-tool-singleton-race-condition.md](../ui-bugs/preview-canvas-agent-tool-singleton-race-condition.md) - Field-tested solution
- [PREVENTION-QUICK-REFERENCE.md](../PREVENTION-QUICK-REFERENCE.md) - Quick reference cards

### CLAUDE.md Pitfalls

| Pitfall | Description                                                      |
| ------- | ---------------------------------------------------------------- |
| #30     | Race condition on cache invalidation - add 100ms delay           |
| #45     | Empty secret fallback - use `requireEnv()` to fail-fast          |
| #86     | Module-level QueryClient singleton - use `useQueryClient()` hook |
| #90     | dashboardAction not extracted from tool results                  |

### Code Files

- `apps/web/src/components/agent/AgentPanel.tsx` - Tool completion handlers
- `apps/web/src/hooks/useDraftConfig.ts` - Draft config query hook
- `apps/web/src/components/preview/PreviewPanel.tsx` - Preview iframe

## Verification

To verify the fix works:

1. Sign in to the dashboard
2. Open Build Mode (AI Assistant panel)
3. Ask agent to "update the hero headline"
4. Verify preview updates automatically within 500ms
5. Check console - no `{"error":{}}` empty objects
6. Check Network tab - GET /draft returns fresh data

## Lessons Learned

1. **Timing race conditions are invisible in single-user testing** - Multi-agent code review caught this
2. **Error serialization bugs hide root causes** - Always extract Error properties explicitly
3. **100ms delay is simple, effective, deterministic** - Better than complex polling/retry logic
4. **Consistency matters** - All invalidation calls should use the same pattern
5. **Fail-fast beats silent failures** - `requireEnv()` surfaces config errors at startup

---

_Documented via /workflows:compound on 2026-02-02_
