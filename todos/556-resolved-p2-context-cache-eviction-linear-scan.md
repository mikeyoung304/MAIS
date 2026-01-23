---
status: complete
priority: p2
issue_id: '556'
tags: [code-review, performance, agent-ecosystem]
dependencies: []
resolved_at: 2026-01-01
resolution: 'Refactored context cache to true O(1) LRU using Map insertion order. get() now deletes+re-inserts to move to end. evictOldest() uses keys().next().value for O(1). Added 3 LRU behavior tests.'
---

# P2: Context Cache Eviction is O(n) Linear Scan

## Problem Statement

The `evictOldest()` method iterates over the entire cache to find the oldest entry:

```typescript
// context-cache.ts:142-157
private evictOldest(): void {
  let oldestKey: string | null = null;
  let oldestTime = Infinity;

  for (const [key, entry] of this.cache) {  // O(n) scan
    if (entry.cachedAt < oldestTime) {
      oldestTime = entry.cachedAt;
      oldestKey = key;
    }
  }
  // ...
}
```

At 1000 entries (maxEntries), this becomes noticeable. A proper LRU implementation using a doubly-linked list would be O(1).

**Why it matters:** Occasional latency spikes when cache reaches capacity during high-traffic periods.

## Findings

| Reviewer             | Finding                                           |
| -------------------- | ------------------------------------------------- |
| Performance Reviewer | P2: Cache eviction is O(n), causes latency spikes |

## Proposed Solutions

### Option 1: Use Map Insertion Order (Simple LRU)

**Effort:** Small (1 hour)

Map maintains insertion order in JS. On access, delete and re-insert to move to end:

```typescript
get(key: string): CachedContext | undefined {
  const entry = this.cache.get(key);
  if (entry) {
    // Move to end (most recently used)
    this.cache.delete(key);
    this.cache.set(key, entry);
  }
  return entry;
}

private evictOldest(): void {
  // First key is oldest (O(1))
  const oldestKey = this.cache.keys().next().value;
  if (oldestKey) this.cache.delete(oldestKey);
}
```

**Pros:**

- O(1) eviction
- Uses built-in Map behavior
- Minimal code change

**Cons:**

- Slightly more complex get()

### Option 2: Use Third-Party LRU Library

**Effort:** Small (30 minutes)

Use `lru-cache` or `quick-lru`:

```typescript
import LRU from 'lru-cache';
private cache = new LRU<string, CachedContext>({ max: 1000, ttl: 5 * 60 * 1000 });
```

**Pros:**

- Battle-tested implementation
- Built-in TTL support

**Cons:**

- New dependency

## Recommended Action

Implement **Option 1** (Map insertion order) for zero new dependencies.

## Technical Details

**Affected Files:**

- `server/src/agent/context/context-cache.ts`

**Current Performance:**

- O(n) eviction where n = maxEntries (1000)
- Called when cache is full and new entry added

**After Fix:**

- O(1) eviction

## Acceptance Criteria

- [ ] Refactor evictOldest() to O(1)
- [ ] Update get() to move accessed entries to end
- [ ] Existing tests pass
- [ ] Add test for LRU eviction order

## Work Log

| Date       | Action                   | Learnings                        |
| ---------- | ------------------------ | -------------------------------- |
| 2026-01-01 | Created from code review | Performance Oracle flagged as P2 |

## Resources

- Map insertion order: https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Map
