---
status: pending
priority: p2
issue_id: "184"
tags: [code-review, architecture, memory-leak]
dependencies: []
---

# EventEmitter Missing Unsubscribe Method

## Problem Statement

The `EventEmitter` interface has `subscribe()` and `clearAll()` methods but no way to unsubscribe individual handlers. This could cause memory leaks if:
1. Handlers are added dynamically
2. Components/services need to remove specific handlers
3. Long-running processes accumulate handlers

## Findings

**Location:** `server/src/lib/core/events.ts`

**Current Interface:**
```typescript
export interface EventEmitter {
  subscribe<K extends keyof AllEventPayloads>(
    event: K,
    handler: EventHandler<AllEventPayloads[K]>
  ): void;  // ❌ Returns nothing

  emit<K extends keyof AllEventPayloads>(
    event: K,
    payload: AllEventPayloads[K]
  ): Promise<void>;

  clearAll(): void;  // Only way to remove handlers is ALL of them
}
```

**Risk Assessment:**
- Impact: Medium (potential memory leaks in long-running processes)
- Likelihood: Low (current usage is static subscriptions in di.ts)

## Proposed Solutions

### Solution 1: Return unsubscribe function from subscribe (Recommended)
- `subscribe()` returns a cleanup function
- Pattern matches React's `useEffect` cleanup
- **Pros:** Standard pattern, easy to use
- **Cons:** Minor API change
- **Effort:** Small (30 minutes)
- **Risk:** Low

### Solution 2: Add explicit unsubscribe method
- Add `unsubscribe(event, handler)` method
- Requires handler reference to unsubscribe
- **Pros:** More explicit API
- **Cons:** Requires storing handler reference
- **Effort:** Small (30 minutes)
- **Risk:** Low

## Recommended Action

Implement **Solution 1** - standard pattern in JavaScript ecosystem.

## Technical Details

**Affected Files:**
- `server/src/lib/core/events.ts`

**Proposed Change:**
```typescript
export interface EventEmitter {
  subscribe<K extends keyof AllEventPayloads>(
    event: K,
    handler: EventHandler<AllEventPayloads[K]>
  ): () => void;  // Returns unsubscribe function

  // ... rest unchanged
}

// Implementation
subscribe<K extends keyof AllEventPayloads>(
  event: K,
  handler: EventHandler<AllEventPayloads[K]>
): () => void {
  if (!this.handlers.has(event)) {
    this.handlers.set(event, []);
  }
  this.handlers.get(event)!.push(handler as EventHandler<unknown>);

  // Return unsubscribe function
  return () => {
    const handlers = this.handlers.get(event);
    if (handlers) {
      const index = handlers.indexOf(handler as EventHandler<unknown>);
      if (index > -1) {
        handlers.splice(index, 1);
      }
    }
  };
}
```

## Acceptance Criteria

- [ ] `subscribe()` returns unsubscribe function
- [ ] Unsubscribe function removes specific handler
- [ ] No TypeScript errors
- [ ] Tests added for unsubscribe functionality

## Work Log

| Date | Action | Notes |
|------|--------|-------|
| 2025-12-03 | Created | Found during code review of commit 45024e6 |

## Resources

- Commit: 45024e6 (introduced type-safe EventEmitter)
- Related: TODO-177 (completed - added type safety)
