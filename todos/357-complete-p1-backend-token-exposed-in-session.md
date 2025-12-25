---
status: complete
priority: p1
issue_id: "357"
tags: [code-review, security, nextauth]
dependencies: []
---

# Backend Token Exposed in Client-Side Session

## Problem Statement

The `backendToken` (Express JWT) is stored in the NextAuth session object and sent to the browser. This exposes the token to XSS attacks and JavaScript access.

**Why it matters:** If any XSS vulnerability exists anywhere in the app, the attacker can steal the backend token and make authenticated API calls as the user.

## Findings

**File:** `apps/web/src/lib/auth.ts` (lines 71-72, 192)
**File:** `apps/web/src/types/next-auth.d.ts` (lines 21, 47, 61)

```typescript
// VULNERABLE - backendToken exposed to client
interface MAISSession extends Session {
  user: { ... };
  backendToken: string;  // ← EXPOSED TO BROWSER
}
```

**Evidence:**
- Token visible in browser devtools
- Token stored in sessionStorage/localStorage
- Client-side pages use `Authorization: Bearer ${backendToken}` in fetch calls

**Impact:** P1 - Complete authentication bypass for any XSS vulnerability

## Proposed Solutions

### Option 1: HTTP-Only Cookies (Recommended)
- **Description:** Store backend token in HTTP-only cookie set by Express API
- **Pros:** Token not accessible to JavaScript, XSS-safe
- **Cons:** Requires backend changes to set cookies on login
- **Effort:** Medium
- **Risk:** Low - standard security practice

### Option 2: Server-Side Proxy
- **Description:** Create Next.js API routes that proxy to Express with token stored server-side
- **Pros:** Token never leaves server, works with current architecture
- **Cons:** Adds latency, more code to maintain
- **Effort:** High
- **Risk:** Low

## Recommended Action

**FIX NOW - SECURITY CRITICAL** - Token accessible via JavaScript is a foundational security vulnerability. XSS → full account compromise. Implement HTTP-only cookies set by Express API during login. This is non-negotiable for quality code.

## Technical Details

**Affected Files:**
- `apps/web/src/lib/auth.ts`
- `apps/web/src/types/next-auth.d.ts`
- All components using `backendToken` from session

**Database Changes:** None

## Acceptance Criteria

- [ ] Backend token is NOT accessible via JavaScript in browser
- [ ] Token is stored in HTTP-only cookie OR server-side only
- [ ] All authenticated API calls still work
- [ ] Session refresh continues to work

## Work Log

| Date | Action | Learnings |
|------|--------|-----------|
| 2025-12-25 | Created during code review | Security issue found in auth.ts |

## Resources

- PR: feat/nextjs-migration
- Similar: OWASP Token Storage Guidelines
