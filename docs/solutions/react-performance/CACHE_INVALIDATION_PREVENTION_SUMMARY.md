---
module: MAIS
date: 2026-02-02
type: prevention_summary
category: react-performance
tags: [tanstack-query, cache-invalidation, race-condition, prevention]
---

# Cache Invalidation Race Condition: Prevention Strategies

## Problem Summary

Real-time preview race condition: Frontend refetch outpaces backend database commit, causing UI to display stale data.

**Impact**: Users see old content after editing, must manually refresh for updates to appear.

## Root Causes

1. HTTP 200 response sent before `$transaction` completes
2. Frontend calls `invalidateQueries()` immediately on success
3. Refetch query executes before new data reaches database
4. Manual refresh works only because humans add natural delay

## Four Prevention Strategies Developed

### Strategy 1: Code Review Checklist

**What to look for when reviewing cache invalidation code:**

```markdown
CACHE INVALIDATION SECURITY CHECKLIST

Before invalidateQueries() Calls:

- [ ] Is 100ms delay present?
- [ ] Backend transaction complete before response?
- [ ] refetchType: 'active' configured?
- [ ] No fire-and-forget invalidations?
- [ ] Mutation handlers include delay?
- [ ] External invalidation has delay?
- [ ] Query config: staleTime: 0?

Common Anti-Patterns to Flag:

- invalidateQueries() without delay → 🚩 Race condition
- staleTime: 60000 on real-time data → 🚩 Won't refetch
- refetchType: 'stale' (default) → 🚩 Background data stays stale
- onSuccess: () => invalidate() without await → 🚩 May complete out of order
```

**See:** `docs/solutions/react-performance/CACHE_INVALIDATION_RACE_CONDITION_PREVENTION.md` → "Strategy 1: Code Review Checklist"

---

### Strategy 2: Standard Patterns (Copy-Paste)

**Ready-to-use patterns for all invalidation scenarios:**

#### Pattern A: In Mutation onSuccess

```typescript
onSuccess: async () => {
  await new Promise(resolve => setTimeout(resolve, 100));
  queryClient.invalidateQueries({
    queryKey: QUERY_KEY,
    refetchType: 'active',
  });
},
```

#### Pattern B: External Invalidation (Agent Tools)

```typescript
export const invalidateDraftConfig = (): void => {
  if (queryClientRef) {
    setTimeout(() => {
      queryClientRef.invalidateQueries({
        queryKey: DRAFT_CONFIG_QUERY_KEY,
        refetchType: 'active',
      });
    }, 100);
  }
};
```

#### Pattern C: Sequential Invalidation

```typescript
onSuccess: async () => {
  await new Promise(resolve => setTimeout(resolve, 100));
  await Promise.all([
    queryClient.invalidateQueries({ queryKey: ['data-1'], refetchType: 'active' }),
    queryClient.invalidateQueries({ queryKey: ['data-2'], refetchType: 'active' }),
  ]);
},
```

#### Pattern D: Hook Return for External Use

```typescript
const invalidate = useCallback(async () => {
  await new Promise((resolve) => setTimeout(resolve, 100));
  queryClient.invalidateQueries({
    queryKey: QUERY_KEY,
    refetchType: 'active',
  });
}, [queryClient]);
```

**See:** `docs/solutions/react-performance/CACHE_INVALIDATION_RACE_CONDITION_PREVENTION.md` → "Strategy 2: Standard Pattern (Copy-Paste)"

---

### Strategy 3: ESLint Rule

**Custom ESLint rule to detect unsafe invalidateQueries patterns:**

#### Rule: `no-undelayed-invalidate-queries`

Detects and auto-fixes:

- Missing 100ms delay before invalidateQueries()
- Missing `refetchType: 'active'`
- Fire-and-forget (non-awaited) calls

```javascript
// .eslintrc.js
module.exports = {
  rules: {
    'custom/no-undelayed-invalidate-queries': 'warn',
  },
};
```

```bash
# Run to find violations
npx eslint apps/web/src --rule "custom/no-undelayed-invalidate-queries: error" --fix
```

**See:** `docs/solutions/react-performance/CACHE_INVALIDATION_RACE_CONDITION_PREVENTION.md` → "Strategy 3: ESLint Rule Idea"

---

### Strategy 4: E2E Test Patterns

**Four test scenarios that catch race conditions:**

#### Test 1: Verify Delay is Necessary

```typescript
test('should show fresh data after mutation without race condition', async ({ page }) => {
  // Mutation → wait for success → wait for network + delay
  // Verify preview shows NEW data, not stale
});
```

#### Test 2: Race Condition Under Slow Network

```typescript
test('should not show stale data on slow network', async ({ page, context }) => {
  // Simulate 3G (500ms latency)
  // Make mutation → DON'T wait for network
  // Verify delay prevents race condition
});
```

#### Test 3: Multiple Concurrent Invalidations

```typescript
test('should handle multiple concurrent invalidations safely', async ({ page }) => {
  // Trigger 2+ mutations simultaneously
  // Verify combined updates visible, not partial/stale
  // Verify version incremented correctly
});
```

#### Test 4: Agent Tool Invalidation

```typescript
test('should not show stale preview after agent tool modifies draft', async ({ page }) => {
  // Send agent message that triggers tool
  // Tool modifies draft and calls invalidateDraftConfig()
  // Verify delay was applied by external invalidation
  // Verify preview shows updated content
});
```

**See:** `docs/solutions/react-performance/CACHE_INVALIDATION_RACE_CONDITION_PREVENTION.md` → "Strategy 4: Test Approach"

---

## Why 100ms?

| Component          | Time      | Margin               |
| ------------------ | --------- | -------------------- |
| Database commit    | ~10-50ms  |                      |
| Network round-trip | ~20-100ms |                      |
| 100ms total buffer |           | **2x worst case** ✅ |

- **Too short (50ms)**: Risky on slow networks
- **Too long (200ms)**: User perceives delay (noticeable)
- **100ms**: Goldilocks zone - safe and imperceptible

---

## Performance Monitoring

Add observability to track invalidation timing:

```typescript
onSuccess: async () => {
  const start = performance.now();
  await new Promise(resolve => setTimeout(resolve, 100));
  const delay = performance.now() - start;

  queryClient.invalidateQueries({ ... });

  if (delay > 150) {
    logger.warn('[Performance] Slow invalidation', { delay });
  }
};
```

---

## Decision Tree

```
Is this code invalidating cache after a mutation?
├── YES → Add 100ms delay before invalidateQueries()
└── NO → Skip invalidation

Does mutation return fresh data?
├── YES → Might not need delay
└── NO → MUST have delay

Is code inside onSuccess handler?
├── YES → Add delay at start of handler
└── NO → Add delay before call site

Is this external (agent tools, service workers)?
├── YES → Include delay in function
└── NO → Use React hook pattern
```

---

## Related Pitfalls

| Pitfall | Issue                                | Prevention                                   |
| ------- | ------------------------------------ | -------------------------------------------- |
| #30     | Race condition on cache invalidation | Add 100ms delay (THIS DOCUMENT)              |
| #86     | Module-level QueryClient singleton   | Use global instance or hook                  |
| #20     | Stale data displayed in preview      | Set `staleTime: 0` + `refetchType: 'active'` |

---

## Verification Checklist

Before committing code:

```bash
# Find all invalidateQueries calls
rg "invalidateQueries" apps/web/src --type ts -B 5

# Check for delays
# (Manually verify each has: await new Promise(resolve => setTimeout(resolve, 100));)

# Check for refetchType: 'active'
rg "invalidateQueries" apps/web/src --type ts | rg -v "refetchType"

# Run ESLint check
npx eslint apps/web/src --rule "custom/no-undelayed-invalidate-queries: error"

# Run E2E tests
npm run test:e2e cache-invalidation

# Run type check
npm run typecheck
```

---

## Quick Links

| Resource                                                                                                 | Purpose                               |
| -------------------------------------------------------------------------------------------------------- | ------------------------------------- |
| [CACHE_INVALIDATION_RACE_CONDITION_PREVENTION.md](./CACHE_INVALIDATION_RACE_CONDITION_PREVENTION.md)     | **Full detailed guide** (594 lines)   |
| [CACHE_INVALIDATION_QUICK_REFERENCE.md](./CACHE_INVALIDATION_QUICK_REFERENCE.md)                         | **30-second cheat sheet** (309 lines) |
| [PREVENTION-QUICK-REFERENCE.md](../PREVENTION-QUICK-REFERENCE.md)                                        | **Main prevention index**             |
| [auto-save-race-condition-MAIS-20251204.md](../logic-errors/auto-save-race-condition-MAIS-20251204.md)   | **Related: Auto-save patterns**       |
| [MODULE_LEVEL_QUERY_CLIENT_SINGLETON_PREVENTION.md](./MODULE_LEVEL_QUERY_CLIENT_SINGLETON_PREVENTION.md) | **Related: QueryClient management**   |

---

## Implementation Roadmap

### Phase 1: Audit (1 hour)

```bash
# Find all current invalidateQueries calls
rg "invalidateQueries" apps/web/src --type ts -l

# Count violations
rg "invalidateQueries" apps/web/src --type ts -B 5 | grep -v "setTimeout" | wc -l

# Document findings
# Priority 1: useDraftConfig, usePreviewToken, useOnboardingState
# Priority 2: Other hooks and external invalidation
```

### Phase 2: Fix (2-4 hours)

1. Add 100ms delay to all `invalidateQueries()` calls
2. Add `refetchType: 'active'` to all invalidations
3. Verify backend transactions complete before response
4. Update external invalidation functions

### Phase 3: Test (1 hour)

1. Write E2E tests for each fixed hook
2. Run under slow network simulation
3. Verify manual refresh no longer needed
4. Check for any new flakiness in existing tests

### Phase 4: Documentation (30 minutes)

1. Update code comments with Pitfall #30 reference
2. Add links to prevention documents
3. Update CLAUDE.md if needed
4. Communicate pattern to team

---

## Common Questions

**Q: Why not use optimistic updates instead?**
A: Optimistic updates are for UI responsiveness. This delay is for backend data sync. Both can coexist.

**Q: Can I use 50ms instead?**
A: Risky on slow networks. Stick to 100ms - imperceptible to users but safe for all conditions.

**Q: What if my backend is very fast (<10ms)?**
A: 100ms still works and adds no user-perceptible delay. Consistency is more valuable than optimization.

**Q: Should query client be global or instance?**
A: Use global instance at app root for external callers (agent tools). Use `useQueryClient()` hook inside React components.

**Q: Do I need the delay for every mutation?**
A: Yes - any mutation that modifies server state should have delay before cache invalidation. Be consistent.

---

## Success Criteria

Prevention strategies are working when:

- [ ] No stale data in preview after mutations
- [ ] Manual refresh no longer needed
- [ ] Fast network doesn't cause race condition
- [ ] E2E tests pass on all network speeds
- [ ] Code review catches missing delays
- [ ] ESLint rule auto-fixes violations
- [ ] Documentation is clear and accessible

---

## Last Updated

2026-02-02

## Contact

Questions about cache invalidation? Check:

1. Quick reference → [CACHE_INVALIDATION_QUICK_REFERENCE.md](./CACHE_INVALIDATION_QUICK_REFERENCE.md)
2. Full guide → [CACHE_INVALIDATION_RACE_CONDITION_PREVENTION.md](./CACHE_INVALIDATION_RACE_CONDITION_PREVENTION.md)
3. Existing patterns → Search `docs/solutions/` for similar code
4. Pitfall #30 → CLAUDE.md race condition section
