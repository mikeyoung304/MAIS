---
status: pending
priority: p2
issue_id: '5238'
tags: [code-review, security, project-hub, timeout]
dependencies: []
created_at: 2026-01-21
pr: 31
---

# P2: Missing Fetch Timeout on Agent Communication (Pitfall #46)

> **Security Review:** Fetch calls without timeouts can hang indefinitely.

## Problem Statement

Per MAIS Pitfall #46, all fetch calls need AbortController timeouts. The fetch call to the Project Hub agent has no timeout - a slow or unresponsive agent could hang the request indefinitely.

**File:** `server/src/routes/public-project.routes.ts`
**Lines:** 351-364

**Evidence:**

```typescript
const agentResponse = await fetch(`${agentUrl}/chat`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ ... }),
  // NO TIMEOUT - can hang forever!
});
```

## Proposed Solution

```typescript
const controller = new AbortController();
const timeoutId = setTimeout(() => controller.abort(), 30000); // 30s for agents

try {
  const agentResponse = await fetch(`${agentUrl}/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ... }),
    signal: controller.signal,
  });
  // ...
} finally {
  clearTimeout(timeoutId);
}
```

**Effort:** Small (15 minutes)
**Risk:** Low

## Resources

- PR: https://github.com/mikeyoung304/MAIS/pull/31
- MAIS Pitfall #46: No fetch timeouts
