---
status: resolved
priority: p1
issue_id: '5231'
tags: [code-review, security, project-hub, authentication]
dependencies: []
created_at: 2026-01-21
pr: 31
---

# P1: Weak Access Control in Public Project Routes - Email Parameter Not Cryptographically Verified

> **Security Review:** Customer project access relies on guessable email addresses, not cryptographic tokens.

## Problem Statement

The public project endpoint uses simple email comparison for access control, which is vulnerable to enumeration attacks. An attacker who knows a customer's email can access their project details by guessing project IDs.

**File:** `server/src/routes/public-project.routes.ts`
**Lines:** 121-128

**Evidence:**

```typescript
// Verify access via email (simple magic link pattern)
// In production, this should use a signed token
const customerEmail = project.booking.customer?.email ?? project.booking.customerEmail;
if (email && email !== customerEmail) {
  res.status(403).json({ error: 'Access denied' });
  return;
}
```

**Security Issues:**

1. Email addresses are not secrets - they can be guessed or obtained through phishing
2. If no email is provided in the query, access check is bypassed entirely (the `if (email && ...)` pattern)
3. Project IDs (CUIDs) are pseudo-random but potentially predictable

**Risk:** Unauthorized access to customer project data, potential GDPR/privacy violations.

## Findings

| Reviewer          | Finding                                                      |
| ----------------- | ------------------------------------------------------------ |
| Security Sentinel | P1: Weak access control using email instead of signed tokens |
| Architecture      | P2: Inconsistent with existing magic link patterns           |

## Proposed Solutions

### Option A: Signed Access Token (Recommended)

Generate a cryptographically signed JWT or HMAC token containing projectId + customerId + expiry.

```typescript
// Generate token when sending email
const token = signProjectAccessToken({
  projectId,
  customerId,
  exp: Date.now() + 7 * 24 * 60 * 60 * 1000, // 7 days
});

// Verify token in route
const { token } = req.query;
if (!token) {
  res.status(401).json({ error: 'Access token required' });
  return;
}
const payload = verifyProjectAccessToken(token);
if (!payload || payload.projectId !== projectId) {
  res.status(403).json({ error: 'Invalid or expired access token' });
  return;
}
```

**Pros:** Cryptographically secure, time-limited, follows existing magic link patterns
**Cons:** Requires token generation in email flow, slight implementation complexity
**Effort:** Medium (4-6 hours)
**Risk:** Low

### Option B: Always Require Email (Minimal Fix)

Remove the optional check - always require email match.

```typescript
if (!email || email !== customerEmail) {
  res.status(403).json({ error: 'Access denied' });
  return;
}
```

**Pros:** Simple fix, reduces attack surface
**Cons:** Still relies on non-secret (email), vulnerable to phishing
**Effort:** Small (15 minutes)
**Risk:** Medium (still weak security)

## Recommended Action

**Option A** - Implement signed access tokens. This matches the existing magic link pattern used elsewhere in MAIS and provides proper security.

## Technical Details

**Affected Files:**

- `server/src/routes/public-project.routes.ts` (route handler)
- `apps/web/src/lib/tenant.ts` (client calls)
- Email templates (to include signed token in links)

**Acceptance Criteria:**

- [ ] Access tokens are cryptographically signed with HMAC or JWT
- [ ] Tokens include projectId, customerId, and expiry
- [ ] Invalid/expired tokens return 401/403
- [ ] Existing email links updated to include token parameter
- [ ] Token verification happens before any data access

## Work Log

| Date       | Action                          | Learnings                                           |
| ---------- | ------------------------------- | --------------------------------------------------- |
| 2026-01-21 | Created from PR #31 code review | Email-based auth is insufficient for sensitive data |

## Resources

- PR: https://github.com/mikeyoung304/MAIS/pull/31
- OWASP Access Control: https://owasp.org/www-community/Access_Control
- Existing magic link implementation: `server/src/services/auth.service.ts`
