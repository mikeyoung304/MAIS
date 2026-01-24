---
status: ready
priority: p3
issue_id: '5256'
tags: [code-review, performance]
dependencies: []
---

# P3: Cache Stores Encrypted Data, Decrypts on Every Hit

## Problem Statement

The cache stores encrypted data and decrypts on every cache hit. For sessions with many messages, this causes significant CPU overhead on every read.

**Why it matters:** For a session with 100+ messages, every cache hit triggers 100+ AES-256-GCM decrypt operations, defeating the purpose of caching.

## Findings

**File:** `server/src/services/session/session.service.ts:146-150`

```typescript
// Cache for future requests (store encrypted version)
if (this.config.cacheEnabled) {
  this.cache.set(sessionId, tenantId, session); // Store as-is (encrypted in DB)
}

// Then on cache hit:
const cached = this.cache.get(sessionId, tenantId);
if (cached) {
  return this.decryptSession(cached); // Decrypts every cache hit!
}
```

## Proposed Solutions

### Option A: Store decrypted data in cache (Recommended)

**Pros:** O(1) cache hits, no decryption overhead
**Cons:** Cache holds decrypted data (but it's in-memory anyway)
**Effort:** Small
**Risk:** Low

```typescript
// Store decrypted version in cache
const decrypted = this.decryptSession(session);
this.cache.set(sessionId, tenantId, decrypted);
return decrypted;
```

### Option B: Keep current behavior

**Pros:** Defense in depth
**Cons:** Performance overhead
**Effort:** None
**Risk:** None

## Recommended Action

Option A - Store decrypted data in cache. Encryption at rest applies to disk/database, not in-memory cache.

## Technical Details

**Affected files:**

- `server/src/services/session/session.service.ts`

## Acceptance Criteria

- [ ] Cache stores decrypted session data
- [ ] Cache hits return data without decryption
- [ ] Encryption still applied on database write
- [ ] Existing tests pass

## Work Log

| Date       | Action                   | Result  |
| ---------- | ------------------------ | ------- |
| 2026-01-22 | Created from code review | Pending |

## Resources

- [Encryption at Rest vs In Transit](https://en.wikipedia.org/wiki/Data_at_rest)
