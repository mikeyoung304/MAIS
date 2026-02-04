---
module: MAIS
date: 2026-02-02
type: quick_reference
category: react-performance
tags: [tanstack-query, cache-invalidation, race-condition, cheat-sheet]
---

# Cache Invalidation Quick Reference

**Print this and pin it to your wall!**

---

## The Problem (30-Second Version)

Frontend refetch outpaces backend database commit → UI shows stale data → Manual refresh works because humans add delay.

## The Solution

```typescript
// BEFORE: Race condition
onSuccess: () => {
  queryClient.invalidateQueries({ queryKey: [...] });
  // Refetch happens immediately - might get stale data!
}

// AFTER: Safe
onSuccess: async () => {
  await new Promise(resolve => setTimeout(resolve, 100));
  queryClient.invalidateQueries({
    queryKey: [...],
    refetchType: 'active',  // Force refetch even if inactive
  });
}
```

---

## Code Review Checklist (30 Seconds)

Look for these in `invalidateQueries()` calls:

```markdown
- [ ] 100ms delay before invalidating?
      ✅ await new Promise(resolve => setTimeout(resolve, 100));
      ❌ queryClient.invalidateQueries(...) // No delay!

- [ ] refetchType: 'active'?
      ✅ refetchType: 'active' // Force refetch
      ❌ No refetchType specified // May not refetch

- [ ] Awaited?
      ✅ await queryClient.invalidateQueries(...)
      ❌ queryClient.invalidateQueries(...) // Fire and forget

- [ ] Backend transaction complete?
      ✅ await prisma.$transaction(...); res.json(result);
      ❌ res.json(result); // Response before commit!
```

---

## Patterns to Copy-Paste

### Pattern 1: Mutation onSuccess

```typescript
const mutation = useMutation({
  mutationFn: async (data) => {
    const response = await api.update(data);
    return response.body;
  },
  onSuccess: async () => {
    // CRITICAL: 100ms delay before refetch
    await new Promise((resolve) => setTimeout(resolve, 100));

    // CRITICAL: refetchType: 'active' for real-time
    queryClient.invalidateQueries({
      queryKey: ['my-data'],
      refetchType: 'active',
    });

    logger.info('Data updated and cache refreshed');
  },
  onError: (error) => {
    logger.error('Update failed', { error });
  },
});
```

### Pattern 2: External Invalidation (Agent Tools)

```typescript
export const invalidateMyCache = (): void => {
  setTimeout(() => {
    queryClientRef.invalidateQueries({
      queryKey: ['my-data'],
      refetchType: 'active',
    });
  }, 100); // 100ms delay
};
```

### Pattern 3: Multiple Queries

```typescript
onSuccess: async () => {
  await new Promise((resolve) => setTimeout(resolve, 100));

  // Batch multiple invalidations
  await Promise.all([
    queryClient.invalidateQueries({ queryKey: ['data-1'], refetchType: 'active' }),
    queryClient.invalidateQueries({ queryKey: ['data-2'], refetchType: 'active' }),
  ]);
};
```

---

## Anti-Patterns to Avoid

```typescript
// ❌ NO DELAY - Race condition!
onSuccess: () => {
  queryClient.invalidateQueries({ queryKey: [...] });
}

// ❌ WRONG refetchType - May not refetch
onSuccess: () => {
  queryClient.invalidateQueries({
    queryKey: [...],
    refetchType: 'stale', // Only refetches if marked stale
  });
}

// ❌ NOT AWAITED - May complete out of order
onSuccess: () => {
  queryClient.invalidateQueries({ queryKey: [...] }); // No await
}

// ❌ NO REAL-TIME CONFIG - Won't stay fresh
const query = useQuery({
  queryKey: [...],
  queryFn: fetchData,
  staleTime: 60000, // TOO LONG for real-time!
});

// ❌ BACKEND RESPONSE BEFORE TRANSACTION
app.post('/api/save', (req, res) => {
  res.json({ success: true }); // Response sent!
  await prisma.save(...); // Then saved - too late!
});
```

---

## Configuration Checklist

For real-time data updates, verify query config:

```typescript
const query = useQuery({
  queryKey: ['real-time-data'],
  queryFn: fetchData,
  staleTime: 0, // ✅ Data immediately marked stale
  gcTime: 5 * 60_000, // ✅ Keep cache for 5 minutes
  refetchOnWindowFocus: false, // ✅ Don't refetch on tab change
  retry: 1, // ✅ Retry once on failure
});
```

---

## E2E Test Pattern

```typescript
test('should show fresh data after mutation', async ({ page }) => {
  // ... setup and initial state

  // Make mutation
  await page.locator('[data-testid="save"]').click();
  await page.waitForSelector('[data-testid="success"]');

  // CRITICAL: Wait for delay + refetch
  await page.waitForLoadState('networkidle');
  await new Promise((resolve) => setTimeout(resolve, 150));

  // Verify fresh data
  const text = await page.locator('[data-testid="content"]').textContent();
  expect(text).toBe('Updated Value');
});
```

---

## Detection Signals

If you see these, there's likely a race condition:

| Signal                                  | Root Cause                           | Fix                               |
| --------------------------------------- | ------------------------------------ | --------------------------------- |
| Preview shows stale data after edit     | No delay before refetch              | Add 100ms delay                   |
| Manual refresh works, auto-save doesn't | Cache refetch outpaces DB            | Add refetchType: 'active'         |
| Fast network makes it worse             | Race window smaller on fast networks | 100ms delay is baseline           |
| Flickers between old and new state      | Stale data, then fresh               | Increase delay or check staleTime |
| Agent tool changes don't show           | External invalidation missing delay  | Add delay to invalidate function  |

---

## Measurement: Is 100ms Enough?

```
Database commit time: ~10-50ms (typically)
Network round-trip: ~20-100ms (varies)
React render cycle: ~16ms (60fps)

100ms buffer = 2x worst case + margin ✅
```

Why not longer?

- 200ms = user perceives delay (noticeable)
- 50ms = risky on slow networks

100ms is the **Goldilocks zone**.

---

## Backend Best Practice

Ensure response sent AFTER transaction completes:

```typescript
// ✅ CORRECT
app.post('/api/publish', async (req, res) => {
  try {
    const result = await prisma.$transaction(async (tx) => {
      // All updates in transaction
      return tx.draft.update({ ... });
    });

    // Response sent AFTER transaction commits
    res.json({ success: true, data: result });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// ❌ WRONG
app.post('/api/publish', (req, res) => {
  res.json({ success: true }); // Sent immediately!

  prisma.$transaction(...); // Then saves - async!
});
```

---

## Grep for Violations

```bash
# Find invalidateQueries without delay
rg "invalidateQueries" apps/web/src --type ts -B 5 | grep -v "setTimeout\|new Promise"

# Find missing refetchType: 'active'
rg "invalidateQueries.*\{" apps/web/src --type ts | grep -v "refetchType"

# Find fire-and-forget (no await)
rg "queryClient\.invalidateQueries" apps/web/src --type ts | grep -v "await"
```

If any results → Fix before committing!

---

## When to Add Delay

```
Cache invalidation after mutation?
├── YES (mutation changed data on server)
│   └── ADD 100ms delay before invalidateQueries()
│
└── NO (cache was just read)
    └── Probably don't need invalidation
```

---

## FAQ

**Q: Why 100ms and not 50ms?**
A: Database commits in ~10-50ms + network variance. 100ms gives 2x safety margin without being perceptible.

**Q: Can I make it configurable?**
A: Don't. Consistent value prevents confusion. If needed, create constant: `const CACHE_INVALIDATION_DELAY = 100;`

**Q: What if backend is slow?**
A: 100ms still works (transaction starts earlier). If backend >100ms, you have bigger performance issues.

**Q: Agent tools - should they also wait?**
A: YES. Add 100ms delay in `invalidateDraftConfig()` or at call site. Document that delay is expected.

---

## Links

- **Full Details**: `docs/solutions/react-performance/CACHE_INVALIDATION_RACE_CONDITION_PREVENTION.md`
- **Pitfall #30**: Auto-save race conditions
- **TanStack Query**: https://tanstack.com/query/latest/docs/react/guides/caching
