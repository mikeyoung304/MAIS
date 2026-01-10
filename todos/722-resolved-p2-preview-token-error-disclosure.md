---
status: resolved
priority: p2
issue_id: '722'
tags:
  - code-review
  - security
  - preview-system
dependencies: []
---

# P2: Information Disclosure in Preview Token Error Messages

## Problem Statement

When preview token validation fails, the error message and code are returned to the client, revealing details about why validation failed. This allows attackers to distinguish between different failure modes.

## Findings

**Location:** `server/src/routes/public-tenant.routes.ts` (lines 160-166)

**Current Code:**

```typescript
return res.status(401).json({
  error: tokenResult.message,
  code: tokenResult.error, // 'expired', 'invalid', 'wrong_type', 'malformed', 'tenant_mismatch'
});
```

**Risk:** An attacker can distinguish between:

- `expired` - Token was valid but expired (confirms token format was correct)
- `invalid` - Bad signature (confirms token was tampered)
- `tenant_mismatch` - Token valid for different tenant (information leak about multi-tenancy)
- `malformed` - Token structure incorrect

**Security Best Practice:** Authentication error messages should not reveal specific failure reasons.

## Proposed Solutions

### Option A: Generic Error Message (Recommended)

**Effort:** Small (10 min)
**Risk:** Low

Return a generic error for all validation failures:

```typescript
if (!tokenResult.valid) {
  logger.info({ slug, error: tokenResult.error }, 'Preview token validation failed');
  return res.status(401).json({
    error: 'Invalid or expired preview token',
  });
}
```

Keep detailed error code in server logs for debugging, but don't expose to client.

### Option B: Limited Error Categories

**Effort:** Small (15 min)
**Risk:** Low

Collapse error types into two categories:

```typescript
const isExpired = tokenResult.error === 'expired';
return res.status(401).json({
  error: isExpired ? 'Preview token has expired' : 'Invalid preview token',
});
```

This is slightly more user-friendly while still limiting information disclosure.

## Recommended Action

<!-- Filled during triage -->

## Technical Details

**Affected Files:**

- `server/src/routes/public-tenant.routes.ts`

**Components:**

- Preview endpoint token validation response

## Acceptance Criteria

- [ ] Error response doesn't reveal specific failure reason
- [ ] Detailed error logged server-side for debugging
- [ ] Frontend handles generic error appropriately
- [ ] Existing tests updated if they check specific error codes

## Work Log

| Date       | Action                   | Learnings                                           |
| ---------- | ------------------------ | --------------------------------------------------- |
| 2026-01-10 | Created from code review | Security-sentinel identified information disclosure |

## Resources

- OWASP Authentication Cheat Sheet
- Security review agent findings
