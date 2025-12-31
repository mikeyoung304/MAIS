---
status: complete
priority: p2
issue_id: '402'
tags:
  - security
  - cors
  - code-review
dependencies: []
---

# CORS Configuration and Missing CSRF Protection

## Problem Statement

Two security concerns identified in the API layer:

1. CORS allows all HTTPS origins in production
2. No CSRF protection for state-changing operations

## Findings

**Found by:** Security Sentinel agent

### Issue 1: Permissive CORS in Production

**Location:** `server/src/app.ts:107-146`

```typescript
} else if (process.env.NODE_ENV === 'production' && origin.startsWith('https://')) {
  // Allow all HTTPS origins in production (widget embedding on customer sites)
  callback(null, true);
}
```

**Risk:** While documented as intentional for widget embedding, this weakens origin-based security and could enable cross-origin attacks from any HTTPS site.

### Issue 2: No CSRF Protection

**Location:** Throughout Express API

The API uses Bearer token authentication but lacks CSRF protection for state-changing operations. While Bearer tokens aren't automatically sent like cookies, the architecture could be vulnerable if:

- JWT is stored in localStorage (XSS can steal it)
- Session tokens are added via cookies in future

**Current Mitigations:**

- JWT-based auth (not cookie-based)
- SameSite cookies for NextAuth session
- Rate limiting on sensitive endpoints

## Proposed Solutions

### For CORS:

#### Option 1: Tenant-based CORS allowlist (Recommended)

- Each tenant registers their embedding domains
- Dynamic CORS validation against tenant domain list

**Pros:** Precise control, security + flexibility
**Cons:** Requires domain management feature
**Effort:** Medium
**Risk:** Low

#### Option 2: Pattern-based CORS

- Allow specific domain patterns (e.g., `*.maconaisolutions.com`)
- More restrictive than current

**Pros:** Better than current
**Cons:** Still somewhat permissive
**Effort:** Small
**Risk:** Low

### For CSRF:

#### Option 1: Document current strategy (Recommended for now)

- Formally document that JWT Bearer tokens provide CSRF protection
- Add CSRF tokens for most sensitive operations (password change, payment)

**Pros:** Minimal change, addresses real risk
**Cons:** Partial protection
**Effort:** Small
**Risk:** Low

#### Option 2: Full CSRF token implementation

- Add CSRF middleware
- Include tokens in all state-changing forms

**Pros:** Complete protection
**Cons:** Significant effort
**Effort:** Large
**Risk:** Medium

## Recommended Action

Document CSRF strategy, implement tenant-based CORS when domain management feature is built.

## Technical Details

**Files to modify:**

- `server/src/app.ts` - CORS configuration
- Create `docs/security/CSRF_STRATEGY.md` - Document current approach

## Acceptance Criteria

- [ ] CSRF protection strategy documented
- [ ] CORS behavior documented with security rationale
- [ ] Consider tenant domain allowlist for future sprint

## Work Log

| Date       | Action                                | Learnings                                           |
| ---------- | ------------------------------------- | --------------------------------------------------- |
| 2025-12-25 | Created from security audit           | Balance between security and widget embedding needs |
| 2025-12-25 | **Approved for work** - Status: ready | P2 - Documentation task                             |

## Resources

- Security Sentinel report
- OWASP CORS guidance
- OWASP CSRF prevention cheat sheet
