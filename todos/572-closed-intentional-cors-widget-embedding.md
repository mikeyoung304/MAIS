---
status: pending
priority: p1
issue_id: '572'
tags: [code-review, security, cors, api]
dependencies: []
---

# P1: CORS Allows All HTTPS Origins in Production

## Problem Statement

The production CORS configuration allows **any HTTPS origin** to make authenticated cross-origin requests:

```typescript
} else if (process.env.NODE_ENV === 'production' && origin.startsWith('https://')) {
  // Allow all HTTPS origins in production (widget embedding on customer sites)
  callback(null, true);
}
```

While intentional for widget embedding, this creates a **significant security risk**:

- Any malicious HTTPS site can make authenticated requests
- CSRF-style attacks possible if user is logged in
- Session hijacking via cross-origin requests

## Findings

**Location:** `/Users/mikeyoung/CODING/MAIS/server/src/app.ts:139-141`

**Identified by:** Security Sentinel agent, DevOps Harmony agent (both flagged as P1)

**Current Behavior:**

- Any `https://*` origin is allowed in production
- No domain validation against tenant registrations
- Credentials included in cross-origin requests

## Proposed Solutions

### Option A: Tenant Domain Allowlist (Recommended)

**Pros:** Secure, still allows widget embedding on registered domains
**Cons:** Requires domain registration flow
**Effort:** Medium (2-3 days)
**Risk:** Low

Validate origin against `TenantDomain` table:

```typescript
const domain = new URL(origin).hostname;
const registeredDomain = await prisma.tenantDomain.findFirst({
  where: { domain, verified: true },
});
if (registeredDomain) {
  callback(null, true);
} else {
  callback(new Error('CORS not allowed'), false);
}
```

### Option B: Wildcard Subdomains Only

**Pros:** Limits to controlled subdomain pattern
**Cons:** May not work for all customer sites
**Effort:** Small
**Risk:** Medium

```typescript
if (origin.endsWith('.gethandled.ai') || origin.endsWith('.maconai.com')) {
  callback(null, true);
}
```

### Option C: Add CSRF Protection Layer

**Pros:** Defense in depth even with permissive CORS
**Cons:** Doesn't fix the root cause
**Effort:** Medium
**Risk:** Low

## Recommended Action

**Choose Option A** - Implement tenant domain allowlist

## Technical Details

**Affected files:**

- `server/src/app.ts` - CORS configuration
- May need to add domain verification to tenant onboarding

**Database changes:** Uses existing `TenantDomain` table

## Acceptance Criteria

- [ ] CORS only allows verified tenant domains
- [ ] Widget embedding still works for registered domains
- [ ] Unregistered domains receive CORS errors
- [ ] No security test failures
- [ ] Documentation updated for domain registration

## Work Log

| Date       | Action  | Notes                                  |
| ---------- | ------- | -------------------------------------- |
| 2026-01-01 | Created | Found during comprehensive code review |

## Resources

- `server/src/app.ts` - Current CORS implementation
- `server/prisma/schema.prisma` - TenantDomain model
