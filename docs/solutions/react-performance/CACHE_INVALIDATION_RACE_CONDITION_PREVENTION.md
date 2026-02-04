---
module: MAIS
date: 2026-02-02
problem_type: performance_race_condition
component: frontend/react-query/cache-invalidation
symptoms:
  - Preview shows stale data after mutation
  - Manual refresh works (humans add natural delay)
  - Fast network makes race condition worse
  - UI flickers between old and new state
root_cause: HTTP 200 response sent before database transaction commits; frontend invalidates cache before data is visible in database
resolution_type: prevention_strategy
severity: P2
related_files:
  - apps/web/src/hooks/useDraftConfig.ts
  - apps/web/src/hooks/usePreviewToken.ts
  - apps/web/src/hooks/useOnboardingState.ts
tags: [tanstack-query, race-condition, cache-invalidation, timing-sensitive, performance]
---

# Cache Invalidation Race Condition Prevention

## Problem Overview

When a backend mutation completes (HTTP 200), the frontend immediately invalidates the TanStack Query cache via `invalidateQueries()`, triggering a refetch. However, a race condition can occur:

1. **HTTP 200 Response** - Backend returns success before transaction commits to database
2. **Immediate Refetch** - Frontend fires `invalidateQueries()` immediately
3. **Stale Data** - Refetch query executes before database has the new data
4. **UI Shows Old Data** - Refetch returns stale values from database
5. **Manual Refresh Works** - User refresh adds human delay, transaction completes by then

This is especially problematic on **fast networks** where the refetch outpaces the transaction commit.

## Root Causes

| Cause                                              | Why It Matters                            | Prevention                                      |
| -------------------------------------------------- | ----------------------------------------- | ----------------------------------------------- |
| HTTP response sent before `$transaction` completes | Backend doesn't wait for DB commit        | Ensure response sent AFTER transaction          |
| Frontend refetch happens instantly                 | Race condition window is very small       | Add 100ms delay before invalidate (Pitfall #30) |
| No artificial delay to let DB catch up             | Transaction commits are milliseconds slow | Consistent 100ms delay across all invalidations |
| Lazy loading in preview components                 | Component mounts before data is fresh     | Verify `staleTime: 0` + `refetchType: 'active'` |

## Prevention Strategies

### Strategy 1: Code Review Checklist

When reviewing cache invalidation code, look for:

````markdown
## Cache Invalidation Security & Reliability Checklist

### Before `invalidateQueries()` Calls

- [ ] **Delay Added?** Is there a 100ms delay before invalidating?
  - `await new Promise(resolve => setTimeout(resolve, 100));`
  - Without delay: Race condition on fast networks

- [ ] **Backend Transaction Complete?** Response sent AFTER transaction commits
  - ✅ `await prisma.$transaction(...)` then `res.json(result)`
  - ❌ `res.json(result)` then `await prisma.$transaction(...)`

- [ ] **Query Cache Config Correct?**
  - `staleTime: 0` - Data immediately marked stale
  - `refetchType: 'active'` - Force refetch even if component unmounted
  - Both required for real-time updates

- [ ] **No Fire-and-Forget Invalidations?**
  - `await queryClient.invalidateQueries(...)` (with await)
  - NOT `queryClient.invalidateQueries(...) // Fire and forget`

- [ ] **Mutation onSuccess Handles Delay?**
  ```typescript
  onSuccess: async () => {
    await new Promise(resolve => setTimeout(resolve, 100));
    queryClient.invalidateQueries({ queryKey: [...], refetchType: 'active' });
  }
  ```
````

- [ ] **External Invalidation Has Delay?**
  - Agent tools that call `invalidateDraftConfig()` outside React
  - Should also include delay at call site OR in the invalidation function
  - Document that 100ms delay is expected behavior

- [ ] **Stale State Not Cached?**
  - `gcTime` (formerly cacheTime) should be conservative
  - Don't cache failed/partial data longer than 30 seconds
  - Prevent stale data persisting across navigations

### Common Anti-Patterns to Flag

- ❌ `queryClient.invalidateQueries(...)` without delay → 🚩 Race condition
- ❌ `staleTime: 60000` on real-time data → 🚩 Won't refetch immediately
- ❌ `refetchType: 'stale'` (default) on inactive queries → 🚩 Background data stays stale
- ❌ `onSuccess: () => invalidate()` without await → 🚩 May complete before refetch
- ❌ Multiple mutation handlers each invalidating same query → 🚩 N invalidations = slower
- ❌ Invalidating parent + child queries separately → 🚩 Two refetches instead of one

````

### Strategy 2: Standard Pattern (Copy-Paste)

Use this pattern for all post-mutation cache invalidation:

#### Pattern A: In Mutation onSuccess

```typescript
// useDraftConfig.ts (CORRECT)
const publishMutation = useMutation({
  mutationFn: async () => {
    const response = await apiClient.publishDraft({ body: {} });
    if (response.status !== 200) {
      throw new Error('Failed to publish');
    }
    return response.body;
  },
  onSuccess: async () => {
    // CRITICAL: 100ms delay before invalidating
    // Gives backend transaction time to commit to database
    await new Promise(resolve => setTimeout(resolve, 100));

    // CRITICAL: Always use refetchType: 'active' for real-time updates
    queryClient.invalidateQueries({
      queryKey: DRAFT_CONFIG_QUERY_KEY,
      refetchType: 'active', // Force refetch even if component not mounted
    });

    logger.info('[useDraftConfig] Draft published and cache invalidated');
  },
  onError: (error) => {
    logger.error('[useDraftConfig] Publish failed', { error });
  },
});
````

#### Pattern B: External Invalidation (Agent Tools)

```typescript
// hooks/useDraftConfig.ts
export const invalidateDraftConfig = (): void => {
  if (queryClientRef) {
    // CRITICAL: 100ms delay for database commit window
    // Agent tools call this from non-React context, must handle delay internally
    setTimeout(() => {
      queryClientRef.invalidateQueries({
        queryKey: DRAFT_CONFIG_QUERY_KEY,
        refetchType: 'active',
      });
      logger.debug('[useDraftConfig] Cache invalidated after agent tool');
    }, 100);
  }
};
```

#### Pattern C: Sequential Invalidation (Multiple Queries)

```typescript
// Avoid: N separate invalidations
onSuccess: async () => {
  queryClient.invalidateQueries({ queryKey: ['draft-config'] });
  queryClient.invalidateQueries({ queryKey: ['preview-token'] });
  queryClient.invalidateQueries({ queryKey: ['onboarding-state'] });
  // 3 separate refetches!
};

// Better: Single delay, batch invalidations
onSuccess: async () => {
  await new Promise((resolve) => setTimeout(resolve, 100));

  // Batch invalidations - single refetch window
  await Promise.all([
    queryClient.invalidateQueries({ queryKey: ['draft-config'], refetchType: 'active' }),
    queryClient.invalidateQueries({ queryKey: ['preview-token'], refetchType: 'active' }),
  ]);

  logger.info('[mutations] All caches invalidated');
};
```

#### Pattern D: Hook Return for External Use

```typescript
// Return invalidate function with delay built-in
export function useDraftConfig(): UseDraftConfigResult {
  const queryClient = useQueryClient();

  // Invalidate cache with built-in delay
  const invalidate = useCallback(async () => {
    // Wait for database to commit
    await new Promise((resolve) => setTimeout(resolve, 100));

    // Invalidate with active refetch
    queryClient.invalidateQueries({
      queryKey: DRAFT_CONFIG_QUERY_KEY,
      refetchType: 'active',
    });
  }, [queryClient]);

  return {
    // ... other returns
    invalidate,
  };
}
```

### Strategy 3: ESLint Rule Idea

Create a custom ESLint rule to detect unsafe `invalidateQueries` patterns:

#### Rule: `no-undelayed-invalidate-queries`

```typescript
// eslint-rules/no-undelayed-invalidate-queries.js
module.exports = {
  meta: {
    type: 'problem',
    docs: {
      description: 'Warn when invalidateQueries lacks required delay for race condition prevention',
      category: 'Performance',
      recommended: true,
    },
    messages: {
      missingDelay:
        'invalidateQueries should be preceded by 100ms delay to prevent race conditions',
      noAwait: 'invalidateQueries should be awaited to ensure completion',
      missingRefetchType: 'Real-time updates require refetchType: "active"',
    },
  },
  create(context) {
    return {
      CallExpression(node) {
        // Check if calling invalidateQueries
        if (
          node.callee.property?.name === 'invalidateQueries' &&
          node.callee.object?.name === 'queryClient'
        ) {
          // Walk parent nodes to check for delay
          let parent = node.parent;
          let foundDelay = false;
          let foundAwait = false;

          // Look for preceding setTimeout or delay pattern
          if (parent?.type === 'AwaitExpression') {
            foundAwait = true;
          }

          // Check for sleep/delay in preceding statements
          const prevSibling = getPreviousSibling(node);
          if (
            prevSibling?.type === 'ExpressionStatement' &&
            prevSibling.expression?.type === 'AwaitExpression'
          ) {
            const awaitedExpr = prevSibling.expression.argument;
            if (
              awaitedExpr?.callee?.object?.name === 'Promise' &&
              awaitedExpr?.callee?.property?.name === 'resolve'
            ) {
              foundDelay = true;
            }
          }

          if (!foundDelay) {
            context.report({
              node,
              messageId: 'missingDelay',
              suggest: [
                {
                  messageId: 'missingDelay',
                  fix(fixer) {
                    return fixer.insertTextBefore(
                      node.parent,
                      'await new Promise(resolve => setTimeout(resolve, 100));\n'
                    );
                  },
                },
              ],
            });
          }

          if (!foundAwait && parent?.type !== 'AwaitExpression') {
            context.report({
              node,
              messageId: 'noAwait',
            });
          }

          // Check for refetchType: 'active'
          const args = node.arguments[0];
          if (args?.type === 'ObjectExpression') {
            const hasRefetchType = args.properties.some(
              (prop) => prop.key.name === 'refetchType' && prop.value.value === 'active'
            );
            if (!hasRefetchType) {
              context.report({
                node: args,
                messageId: 'missingRefetchType',
              });
            }
          }
        }
      },
    };
  },
};
```

#### Add to ESLint Config

```javascript
// .eslintrc.js
module.exports = {
  rules: {
    'custom/no-undelayed-invalidate-queries': 'warn',
  },
};
```

#### Auto-Fix with Command

```bash
npx eslint apps/web/src --rule "custom/no-undelayed-invalidate-queries: error" --fix
```

### Strategy 4: Test Approach

Write E2E tests that catch the race condition:

#### Test 1: Verify Delay is Necessary

```typescript
// e2e/tests/cache-invalidation.spec.ts
import { test, expect } from '@playwright/test';

test('should show fresh data after mutation without race condition', async ({ page }) => {
  // Setup: Login and navigate to editor
  await page.goto('/tenant/editor');
  await page.waitForLoadState('networkidle');

  // Get initial state
  const initialText = await page.locator('[data-testid="preview-headline"]').textContent();

  // Make mutation
  await page.locator('[data-testid="edit-headline"]').fill('Updated Headline');
  await page.locator('[data-testid="save-button"]').click();

  // Wait for success toast/confirmation
  await page.waitForSelector('[data-testid="save-success"]', { timeout: 5000 });

  // CRITICAL: Wait for network to settle (simulating the 100ms delay)
  // This ensures database has committed before we check preview
  await page.waitForLoadState('networkidle');
  await new Promise((resolve) => setTimeout(resolve, 150)); // Buffer for DB commit

  // Verify preview shows NEW data (not stale)
  const updatedText = await page.locator('[data-testid="preview-headline"]').textContent();
  expect(updatedText).toBe('Updated Headline');
  expect(updatedText).not.toBe(initialText);

  // CRITICAL: Verify on fast network too (race condition detector)
  // Reload page and verify persistence (eliminates stale cache as explanation)
  await page.reload();
  await page.waitForLoadState('networkidle');

  const reloadedText = await page.locator('[data-testid="preview-headline"]').textContent();
  expect(reloadedText).toBe('Updated Headline');
});
```

#### Test 2: Race Condition Under Slow Network

```typescript
test('should not show stale data on slow network', async ({ page, context }) => {
  // Simulate slow 3G network (500ms round-trip)
  await context.route('**/*', async (route) => {
    await new Promise((resolve) => setTimeout(resolve, 500));
    await route.continue();
  });

  await page.goto('/tenant/editor');
  await page.waitForLoadState('networkidle');

  const initialText = await page.locator('[data-testid="preview-headline"]').textContent();

  // Make rapid mutations
  await page.locator('[data-testid="edit-headline"]').fill('Update 1');
  await page.locator('[data-testid="save-button"]').click();
  await page.waitForSelector('[data-testid="save-success"]');

  // Don't wait for network to settle - this is the race condition test!
  // On slow network, cache refetch might outpace database commit
  // But our 100ms delay should prevent this

  await new Promise((resolve) => setTimeout(resolve, 200)); // Wait for delay + refetch to settle

  const updatedText = await page.locator('[data-testid="preview-headline"]').textContent();

  // Should NOT be stale even with slow network
  expect(updatedText).toBe('Update 1');
  expect(updatedText).not.toBe(initialText);
});
```

#### Test 3: Multiple Invalidations Don't Race

```typescript
test('should handle multiple concurrent invalidations safely', async ({ page }) => {
  await page.goto('/tenant/editor');
  await page.waitForLoadState('networkidle');

  const initialConfig = await page.locator('[data-testid="draft-config-version"]').textContent();

  // Trigger multiple mutations that would each call invalidateQueries
  const [res1, res2] = await Promise.all([
    page.locator('[data-testid="update-headline"]').click(),
    page.locator('[data-testid="update-subtitle"]').click(),
  ]);

  // Wait for both to complete
  await page.waitForSelector('[data-testid="save-success"]', { timeout: 10000 });

  // Network should settle + delay should pass
  await page.waitForLoadState('networkidle');
  await new Promise((resolve) => setTimeout(resolve, 150));

  // Should see combined updates, not partial/stale data
  const finalText = await page.locator('[data-testid="preview-full-section"]').textContent();
  expect(finalText).toContain('Updated Headline');
  expect(finalText).toContain('Updated Subtitle');

  // Version should have incremented (not stuck on old version)
  const finalVersion = await page.locator('[data-testid="draft-config-version"]').textContent();
  expect(Number(finalVersion)).toBeGreaterThan(Number(initialConfig));
});
```

#### Test 4: Agent Tool Invalidation Includes Delay

```typescript
test('should not show stale preview after agent tool modifies draft', async ({ page }) => {
  // Setup agent chat and trigger tool that modifies draft
  await page.goto('/tenant/build-mode');
  await page.waitForLoadState('networkidle');

  // Get initial preview state
  const initialPreview = await page.locator('[data-testid="live-preview"]').innerHTML();

  // Send message that triggers agent tool to modify storefront
  await page.locator('[data-testid="agent-input"]').fill('Make the headline bigger');
  await page.locator('[data-testid="agent-send"]').click();

  // Wait for tool to execute and complete
  await page.waitForSelector('[data-testid="agent-response"]', { timeout: 15000 });

  // CRITICAL: Agent invalidates cache - we need to ensure delay was applied
  // Wait for network to settle (100ms delay + network round-trip)
  await page.waitForLoadState('networkidle');
  await new Promise((resolve) => setTimeout(resolve, 200));

  // Preview should show updated content (bigger headline)
  const updatedPreview = await page.locator('[data-testid="live-preview"]').innerHTML();

  // Verify it's actually changed (not stale)
  expect(updatedPreview).not.toBe(initialPreview);

  // Verify the specific change was applied
  const headlineTag = await page.locator('[data-testid="preview-headline"]');
  const fontSize = await headlineTag.evaluate((el) => window.getComputedStyle(el).fontSize);
  expect(parseInt(fontSize)).toBeGreaterThan(16); // Verify size increased
});
```

### Strategy 5: Performance Monitoring

Add observability to detect race conditions in production:

```typescript
// lib/query-client.ts
import { QueryClient } from '@tanstack/react-query';

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 0,
      gcTime: 5 * 60_000,
      retry: 1,
    },
    mutations: {
      onSuccess: async () => {
        // Track invalidation timing for monitoring
        const invalidationStart = performance.now();

        // Delay built-in
        await new Promise((resolve) => setTimeout(resolve, 100));

        const invalidationEnd = performance.now();

        // Log timing for analysis
        if (invalidationEnd - invalidationStart > 150) {
          logger.warn('[QueryClient] Slow invalidation delay', {
            duration: invalidationEnd - invalidationStart,
          });
        }
      },
    },
  },
});

// Track cache staleness
queryClient.getObserversCount(); // Monitor active queries
queryClient.getQueryData(key); // Verify freshness

// Add metric: "Query age at invalidation"
const trackQueryAge = (queryKey: any[]) => {
  const query = queryClient.getQueryState(queryKey);
  if (query?.dataUpdatedAt) {
    const ageMs = Date.now() - query.dataUpdatedAt;
    logger.debug('[Performance] Query age at invalidation', { ageMs, queryKey });
  }
};
```

## Pitfall #30 Context

From CLAUDE.md Pitfall #30: "Race condition on cache invalidation (add 100ms delay)"

The 100ms delay is:

- **Sufficient**: Database transaction commits in <50ms typically
- **Not excessive**: User doesn't perceive 100ms
- **Consistent**: Same value everywhere prevents confusion
- **Documented**: Clear why the delay exists

## Quick Decision Tree

```
Is this code invalidating cache after a mutation?
├── YES → Should have 100ms delay before invalidateQueries()
└── NO → Review for other patterns

Does the mutation return fresh data?
├── YES → Might not need delay (client-side update possible)
└── NO → MUST have delay (need refetch from DB)

Is invalidateQueries called inside onSuccess handler?
├── YES → Add delay at start of onSuccess
└── NO → Add delay before the call site

Is this external code (agent tools, service workers)?
├── YES → Include delay in the call OR in invalidateQueries function
└── NO → Use React hook pattern
```

## Verification Checklist Before Commit

```markdown
- [ ] All `invalidateQueries()` calls have 100ms delay before
- [ ] All `invalidateQueries()` use `refetchType: 'active'`
- [ ] All `invalidateQueries()` are awaited
- [ ] Backend mutations return AFTER transaction commits
- [ ] E2E tests verify fresh data shown after mutation
- [ ] No fire-and-forget invalidations
- [ ] External invalidation functions include delay

Run before committing:
npx eslint apps/web/src --rule "custom/no-undelayed-invalidate-queries: error"
npm run test:e2e cache-invalidation
```

## Related Documentation

- **Pitfall #30**: Auto-save race condition handling → `docs/solutions/logic-errors/auto-save-race-condition-MAIS-20251204.md`
- **Pitfall #86**: Module-level QueryClient singleton → `docs/solutions/react-performance/MODULE_LEVEL_QUERY_CLIENT_SINGLETON_PREVENTION.md`
- **Real-time Preview Handoff**: Agent-first storefront → `docs/plans/2026-02-01-realtime-preview-handoff.md`
- **TanStack Query Docs**: staleTime and refetchType → https://tanstack.com/query/latest/docs/react/guides/caching

## Summary

Cache invalidation race conditions occur when:

1. Frontend refetch outpaces database commit
2. Stale data returns from refetch
3. UI shows old values temporarily

**Prevention:**

- Add 100ms delay before invalidating (gives DB time to commit)
- Use `refetchType: 'active'` to force refetch
- Keep `staleTime: 0` for real-time data
- Test on slow networks to verify timing

**Code Review Focus:**

- Look for `invalidateQueries()` without delays
- Verify backend commits before responding
- Check that external callers also include delay
- Ensure consistent 100ms value everywhere
