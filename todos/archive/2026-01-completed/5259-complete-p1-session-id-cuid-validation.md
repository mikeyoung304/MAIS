---
status: complete
priority: p1
issue_id: '5259'
tags: [code-review, security, rate-limiting, pr-28]
source: PR #28 multi-agent review
---

# P1: Session ID Length Validation Allows Injection

## Problem Statement

The `agentSessionLimiter` validates sessionId using only a length check (`sessionId.length < 100`) which could allow maliciously crafted session IDs containing injection characters.

**Why it matters:** While the compound key pattern prevents cross-tenant spoofing, malformed session IDs could potentially cause rate limiter store corruption or bypass attempts.

## Findings

**Location:** `server/src/middleware/rateLimiter.ts` (lines 310-327)

**Current validation:**

```typescript
// Only checks length, not format
if (sessionId && typeof sessionId === 'string' && sessionId.length < 100) {
  if (tenantId) {
    return `tenant:${tenantId}:session:${sessionId}`;
  }
  return `session:${sessionId}`;
}
```

**Risk:** An attacker could inject special characters (colons, newlines, control characters) that might be interpreted by the underlying rate limiter store.

## Proposed Solutions

### Option A: Add CUID Pattern Validation (Recommended)

**Pros:** Validates actual format, matches MAIS ID convention
**Cons:** Rejects valid sessionIds with different formats
**Effort:** Small (5 min)

```typescript
// MAIS uses CUIDs for IDs
const CUID_PATTERN = /^c[a-z0-9]{24}$/;

if (sessionId && typeof sessionId === 'string' && CUID_PATTERN.test(sessionId)) {
  if (tenantId) {
    return `tenant:${tenantId}:session:${sessionId}`;
  }
  return `session:${sessionId}`;
}
```

### Option B: Character Whitelist

**Pros:** More flexible, allows non-CUID formats
**Cons:** More complex regex
**Effort:** Small (5 min)

```typescript
// Alphanumeric + hyphen only, max 50 chars
const SAFE_ID_PATTERN = /^[a-zA-Z0-9-]{1,50}$/;
```

## Technical Details

**Affected files:**

- `server/src/middleware/rateLimiter.ts`

**Related patterns:**

- Common Pitfall #24: UUID validation on CUID fields
- Session ID format in chat contracts

## Acceptance Criteria

- [ ] Session IDs validated against CUID pattern (or safe character whitelist)
- [ ] Invalid session IDs fall back gracefully (no crash)
- [ ] Add logging when sessionId validation fails
- [ ] Rate limiter tests cover malformed sessionIds

## Work Log

| Date       | Action                                   | Learnings                                                |
| ---------- | ---------------------------------------- | -------------------------------------------------------- |
| 2026-01-22 | Identified during PR #28 security review | Length check alone insufficient for injection prevention |

## Resources

- PR #28: Agent system integrity fixes
- Security review agent finding P1-1
