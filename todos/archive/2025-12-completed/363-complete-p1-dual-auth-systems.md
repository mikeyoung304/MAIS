---
status: complete
priority: p2
issue_id: '363'
tags: [code-review, architecture, authentication]
dependencies: []
---

# Dual Authentication Systems Conflict

## Problem Statement

Two competing auth systems exist in the Next.js app: custom AuthContext and NextAuth.js. They don't share state, causing potential desync and confusion.

**Why it matters:** Inconsistent auth state, maintenance burden, and potential security gaps from mixed approaches.

## Findings

**System 1: Custom AuthContext** (`apps/web/src/contexts/AuthContext/`)

- Uses custom cookie management (setCookie, getCookie)
- Manual JWT decoding
- Client-side only token restoration

**System 2: NextAuth.js** (`apps/web/src/lib/auth.ts`, middleware.ts)

- Session-based auth with JWT strategy
- Server-side session management
- Middleware integration

**Conflict Example:**

```typescript
// AuthProvider tries to restore from cookies
const tenantToken = getCookie(AUTH_COOKIES.TENANT_TOKEN);

// But NextAuth stores in its own session - these are different!
```

**Impact:** P1 - Auth state can desync between systems

## Proposed Solutions

### Option 1: Remove AuthContext, Use NextAuth Only (Recommended)

- **Description:** Delete custom AuthContext, rely on NextAuth + middleware
- **Pros:** Single source of truth, simpler architecture, server-side security
- **Cons:** Migration work required
- **Effort:** Medium (2-3 hours)
- **Risk:** Low - NextAuth is well-tested

### Option 2: Remove NextAuth, Keep AuthContext

- **Description:** Keep custom auth for full control
- **Pros:** More flexibility
- **Cons:** Less secure, more code to maintain, no middleware integration
- **Effort:** Medium
- **Risk:** Higher - custom auth has more edge cases

## Recommended Action

**FIX NOW** - Two competing auth systems is a recipe for subtle bugs (token sync issues, double-login flows, session expiry handled differently). Pick NextAuth (the standard for Next.js), remove AuthContext entirely. Architectural cleanliness matters.

## Technical Details

**Files to Remove (Option 1):**

- `apps/web/src/contexts/AuthContext/` (entire folder)
- `apps/web/src/contexts/AuthContext/AuthProvider.tsx`
- `apps/web/src/contexts/AuthContext/auth-utils.ts`
- `apps/web/src/contexts/AuthContext/types.ts`

**Files to Update (Option 1):**

- `apps/web/src/components/auth/ProtectedRoute.tsx` - Use useSession()
- `apps/web/src/app/providers.tsx` - Remove AuthProvider
- Any component using useAuth() hook

**Keep:**

- `apps/web/src/lib/auth.ts` (NextAuth config)
- `apps/web/src/lib/auth-client.ts` (NextAuth hooks)

## Acceptance Criteria

- [ ] Only one auth system remains
- [ ] All protected routes work correctly
- [ ] Login/logout flow works
- [ ] Session persists across page loads
- [ ] Middleware auth checks work

## Work Log

| Date       | Action                     | Learnings               |
| ---------- | -------------------------- | ----------------------- |
| 2025-12-25 | Created during code review | Dual auth systems found |

## Resources

- NextAuth.js v5: https://authjs.dev/
- Current AuthContext: apps/web/src/contexts/AuthContext/
