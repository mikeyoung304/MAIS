---
status: pending
priority: p2
issue_id: '5249'
tags: [code-review, data-integrity, pitfall-69]
dependencies: []
---

# P2: Version Tracking Bypass in Route Handler

## Problem Statement

The route handler defaults version to 0 if not provided by client, then overwrites it with the database version. This bypasses optimistic locking for concurrent tab scenarios.

**Why it matters:** Violates Pitfall #69: "NEVER use hardcoded optimistic lock versions."

## Findings

**File:** `server/src/routes/tenant-admin-agent.routes.ts:87-108`

```typescript
let version = providedVersion ?? 0; // Default to 0 if not provided!

if (sessionId) {
  const existingSession = await agentService.getSession(sessionId, tenantId);
  if (!existingSession) {
    // Creates new session
  } else {
    version = existingSession.version; // Overwrites client version!
  }
}
```

**Race condition scenario:**

1. Tab A reads version 5 from DB
2. Tab B reads version 5 from DB
3. Tab A sends message (route fetches fresh version 5 from DB)
4. Tab B sends message (route fetches fresh version 5 from DB)
5. No conflict detected because both get fresh version from DB!

## Proposed Solutions

### Option A: Honor client-provided version (Recommended)

**Pros:** Proper optimistic locking, detects concurrent modifications
**Cons:** Clients must track version
**Effort:** Small
**Risk:** Low

```typescript
if (providedVersion !== undefined && existingSession.version !== providedVersion) {
  return res.status(409).json({
    error: 'Concurrent modification',
    currentVersion: existingSession.version,
  });
}
```

### Option B: Keep current behavior, document limitation

**Pros:** No code change
**Cons:** Silent data races possible
**Effort:** None
**Risk:** Medium - data integrity gap

## Recommended Action

Option A - Honor client-provided version and return 409 Conflict when mismatch detected.

## Technical Details

**Affected files:**

- `server/src/routes/tenant-admin-agent.routes.ts`

**Frontend changes needed:**

- Client must store and send version with each message
- Handle 409 response by refreshing state

## Acceptance Criteria

- [ ] Client-provided version is validated against DB version
- [ ] 409 Conflict returned when version mismatch
- [ ] Response includes current version for client recovery
- [ ] Frontend updated to handle conflicts

## Work Log

| Date       | Action                   | Result  |
| ---------- | ------------------------ | ------- |
| 2026-01-22 | Created from code review | Pending |

## Resources

- [CLAUDE.md Pitfall #69](CLAUDE.md)
- [Optimistic Locking Pattern](https://www.martinfowler.com/eaaCatalog/optimisticOfflineLock.html)
