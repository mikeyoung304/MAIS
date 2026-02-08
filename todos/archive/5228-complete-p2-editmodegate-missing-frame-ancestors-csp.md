---
status: pending
priority: p2
issue_id: '5228'
tags: [code-review, security, frontend]
dependencies: []
---

# P2: EditModeGate missing frame-ancestors CSP — iframe embedding attack

## Problem Statement

The `EditModeGate` checks `!!searchParams.get('token')` — any non-empty string passes. While the actual data security is handled server-side (token validated by backend), an attacker CAN degrade any tenant's public storefront by embedding it in an iframe with `?edit=true&token=x`. The nav, footer, chat widget, and sticky CTA all disappear, making the storefront look broken.

The `window.parent !== window` iframe check only works if the tenant sets `X-Frame-Options: DENY` or `Content-Security-Policy: frame-ancestors 'self'`, which is NOT currently enforced.

## Findings

- **Security Sentinel (P2):** Confirmed attack vector — cosmetic denial-of-service via iframe embedding
- **Architecture Strategist (P3):** Noted SSR payload cost of rendering then unmounting gated elements

## Proposed Solutions

### Option A: Add frame-ancestors CSP header (Recommended)

Add `Content-Security-Policy: frame-ancestors 'self' *.gethandled.ai` to the tenant site layout middleware, so only the legitimate dashboard can embed the storefront.

- **Pros:** Prevents unauthorized iframe embedding entirely
- **Cons:** Must whitelist all legitimate dashboard domains
- **Effort:** Small
- **Risk:** Low — need to ensure dashboard preview iframe still works

### Option B: Server-side token validation in middleware

Validate the token server-side in middleware, set a secure cookie, and have EditModeGate check the cookie instead of URL params.

- **Pros:** Stronger security, no client-side URL manipulation
- **Cons:** More complex, middleware changes needed
- **Effort:** Medium
- **Risk:** Medium

## Technical Details

- **Affected files:** `apps/web/src/app/t/[slug]/(site)/layout.tsx` or Next.js middleware
- **Related:** `apps/web/src/components/tenant/EditModeGate.tsx`

## Acceptance Criteria

- [ ] `frame-ancestors` CSP header set on tenant site routes
- [ ] Dashboard preview iframe still works (whitelisted)
- [ ] External iframe embedding blocked
- [ ] No hydration mismatch introduced

## Work Log

| Date       | Action                                      | Learnings                                                          |
| ---------- | ------------------------------------------- | ------------------------------------------------------------------ |
| 2026-02-07 | Created from code review of commit 8c091544 | Cosmetic gates without frame protection = denial-of-service vector |

## Resources

- Commit: 8c091544
