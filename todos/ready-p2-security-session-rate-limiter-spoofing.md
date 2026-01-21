---
status: resolved
priority: p2
triage_date: '2026-01-12'
triage_by: master-architect-triage
verified: true
effort: 10min
resolved_date: '2026-01-20'
resolved_commit: 886de0c7
---

# P2: Session-Based Rate Limiter Key Spoofing

**Source:** Code Review - Security
**PR:** #28 feat/agent-system-integrity-fixes
**Date:** 2026-01-12
**Reviewer:** security-sentinel

## Issue

The `agentSessionLimiter` uses `sessionId` from `req.body` as the rate limit key. An attacker could include a random/rotating sessionId in each request to bypass the 10 messages/minute per-session limit, while still being constrained by the per-tenant limiter.

## Location

- `server/src/middleware/rateLimiter.ts:309-314`

## Current Code

```typescript
export const agentSessionLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: isTestEnvironment ? 500 : 10,
  keyGenerator: (req, res) => {
    const sessionId = (req.body as { sessionId?: string })?.sessionId;
    if (sessionId) return `session:${sessionId}`;
    const tenantId = res.locals.tenantAuth?.tenantId;
    return tenantId ? `tenant:${tenantId}` : normalizeIp(req.ip);
  },
});
```

## Attack Vector

```javascript
// Attacker sends requests with rotating sessionIds
fetch('/v1/agent/chat', { body: { sessionId: crypto.randomUUID(), message: '...' } });
```

This bypasses session-level rate limiting. The per-tenant limiter (30/5min) still applies, but the burst protection is defeated.

## Recommended Fix

Validate that the sessionId exists in the database and belongs to the authenticated tenant before using it as a rate limit key:

```typescript
keyGenerator: (req, res) => {
  const sessionId = (req.body as { sessionId?: string })?.sessionId;
  const tenantId = res.locals.tenantAuth?.tenantId;

  // Validate sessionId format (should be CUID)
  if (sessionId && typeof sessionId === 'string' && sessionId.length < 100) {
    // Use compound key to ensure tenant association
    if (tenantId) {
      return `tenant:${tenantId}:session:${sessionId}`;
    }
    return `session:${sessionId}`;
  }

  return tenantId ? `tenant:${tenantId}` : normalizeIp(req.ip);
},
```

For stronger protection, verify sessionId exists via database lookup (async keyGenerator).

## Severity Justification

P2 because it allows burst abuse of Claude API tokens, but per-tenant limiter still provides backstop protection.
