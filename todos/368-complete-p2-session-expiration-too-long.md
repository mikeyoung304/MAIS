---
status: complete
priority: p2
issue_id: "368"
tags: [code-review, security, nextauth]
dependencies: []
---

# Session Expiration Too Long (7 Days)

## Problem Statement

NextAuth session maxAge is set to 7 days, which is excessive for an admin interface with access to sensitive tenant data.

**Why it matters:** Compromised token remains valid for 7 days, increasing attack window.

## Findings

**File:** `apps/web/src/lib/auth.ts:144`

```typescript
session: {
  strategy: 'jwt',
  maxAge: 7 * 24 * 60 * 60, // 7 days - TOO LONG for admin accounts
}
```

**Security Best Practices:**
- Tenant admins: 1-4 hours
- Platform admins: 30 minutes
- Public pages: Can be longer

**Impact:** P2 - Extended attack window if token compromised

## Proposed Solutions

### Option 1: Reduce Session Duration (Recommended)
- **Description:** Set maxAge to 4 hours for tenant admins
- **Pros:** Smaller attack window
- **Cons:** Users need to re-login more often
- **Effort:** Small (5 min)
- **Risk:** Low

### Option 2: Role-Based Session Duration
- **Description:** Different session lengths for different roles
- **Pros:** Optimal security per role
- **Cons:** More complex implementation
- **Effort:** Medium
- **Risk:** Low

## Recommended Action

**FIX NOW** - 7-day admin sessions violate security best practices. If a device is compromised, attackers have a week of access. Set to 24 hours (or 4 hours for platform admins). This is a 5-minute config change.

## Acceptance Criteria

- [ ] Session maxAge reduced to 4 hours or less
- [ ] Login flow continues to work
- [ ] Session refresh works correctly

## Work Log

| Date | Action | Learnings |
|------|--------|-----------|
| 2025-12-25 | Created during code review | Security concern |

## Resources

- OWASP Session Management: https://cheatsheetseries.owasp.org/cheatsheets/Session_Management_Cheat_Sheet.html
