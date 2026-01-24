---
status: resolved
priority: p2
issue_id: '5249'
tags: [code-review, data-integrity, pitfall-69]
dependencies: []
---

# P2: Version Tracking Bypass in Route Handler

## Problem Statement

The route handler defaults version to 0 if not provided by client, then overwrites it with the database version. This bypasses optimistic locking for concurrent tab scenarios.

**Why it matters:** Violates Pitfall #69: "NEVER use hardcoded optimistic lock versions."

## Resolution

The issue was partially fixed already - the route now requires client-provided version for existing sessions (returns 400 if missing) and uses client version instead of overwriting with DB version.

The final fix added proper 409 Conflict response when the service detects concurrent modification:

```typescript
// Handle concurrent modification (Pitfall #69: Optimistic locking enforcement)
if (result.error === 'Concurrent modification detected') {
  res.status(409).json({
    success: false,
    error: 'CONCURRENT_MODIFICATION',
    message: result.response,
    currentVersion: result.version,
  });
  return;
}
```

## Acceptance Criteria

- [x] Client-provided version is validated against DB version
- [x] 409 Conflict returned when version mismatch
- [x] Response includes current version for client recovery
- [x] Frontend updated to handle conflicts (Issue #620)

## Work Log

| Date       | Action                                         | Result   |
| ---------- | ---------------------------------------------- | -------- |
| 2026-01-22 | Created from code review                       | Pending  |
| 2026-01-23 | Added 409 response for concurrent modification | Resolved |

## Resources

- [CLAUDE.md Pitfall #69](CLAUDE.md)
- [Optimistic Locking Pattern](https://www.martinfowler.com/eaaCatalog/optimisticOfflineLock.html)
