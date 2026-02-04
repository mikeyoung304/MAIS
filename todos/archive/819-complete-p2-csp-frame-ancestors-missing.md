---
status: complete
priority: p2
issue_id: 819
tags: [code-review, security, csp, clickjacking]
dependencies: []
completed: 2026-02-04
---

# Security: Missing frame-ancestors CSP for Next.js Routes

## Problem Statement

The Express backend (port 3001) has `frame-ancestors: 'none'` to prevent clickjacking, but the **Next.js app (port 3000)** which serves the iframe content does NOT set CSP headers.

**Why it matters:**

- Tenant storefronts (`/t/[slug]`) can be embedded in malicious iframes on external sites
- Clickjacking attacks possible (trick users into clicking hidden elements)
- Build Mode preview URLs with stolen preview tokens could be exploited

## Findings

**From security-sentinel agent:**

**Express backend has protection:**

```typescript
// server/src/app.ts Line 96
frameAncestors: ["'none'"], // Prevent clickjacking
```

**Next.js has NO protection:**

`apps/web/next.config.js` only sets CSP for `/sw.js` and `/manifest.json`, NOT for tenant pages.

**Current Protection (partial):**

- Preview tokens are short-lived (expire after use)
- Requires `?edit=true` query param to enter Build Mode
- Handshake requires same-origin PostMessage

**Gap:**
Without `frame-ancestors` on Next.js routes, an attacker could:

1. Embed tenant storefronts in malicious iframes
2. Conduct clickjacking attacks
3. Potentially use Build Mode preview URLs with stolen tokens

## Proposed Solutions

### Option A: Add CSP in Next.js Middleware (Recommended)

**Pros:** Centralized, applies to all tenant routes
**Cons:** Middleware overhead (minimal)
**Effort:** Small (15 minutes)
**Risk:** Low

```typescript
// apps/web/src/middleware.ts
export default auth((request) => {
  const response = NextResponse.next();

  // Add frame-ancestors for tenant routes
  if (request.nextUrl.pathname.startsWith('/t/')) {
    response.headers.set('Content-Security-Policy', "frame-ancestors 'self'");
  }

  return response;
});
```

### Option B: Add CSP in next.config.js Headers

**Pros:** Configuration-based, no runtime code
**Cons:** Less flexible, applies to all routes
**Effort:** Small (10 minutes)
**Risk:** Low

```javascript
// next.config.js
headers: async () => [
  {
    source: '/t/:path*',
    headers: [
      {
        key: 'Content-Security-Policy',
        value: "frame-ancestors 'self'",
      },
    ],
  },
],
```

## Recommended Action

Implement Option A (middleware approach) for flexibility.

## Technical Details

**Affected files:**

- `apps/web/src/middleware.ts` - Add CSP header
- OR `apps/web/next.config.js` - Static headers config

**Routes requiring protection:**

- `/t/[slug]/*` - All tenant storefront routes
- `/api/*` - API routes (already protected by backend)

## Acceptance Criteria

- [x] Tenant pages have `Content-Security-Policy: frame-ancestors 'self'` header
- [x] Build Mode preview still works (same-origin framing allowed)
- [x] External sites cannot iframe tenant storefronts

## Work Log

| Date       | Action                | Learnings                                    |
| ---------- | --------------------- | -------------------------------------------- |
| 2026-02-04 | Security review found | Express protected, Next.js not - defense gap |
| 2026-02-04 | Implemented Option A  | Added CSP in middleware for /t/\* routes     |

## Resources

- OWASP Clickjacking Defense Cheat Sheet
- MDN CSP frame-ancestors documentation
