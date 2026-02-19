---
status: pending
priority: p1
issue_id: '11014'
tags: [code-review, frontend, hydration, next-js, isr]
---

# P1-01 — Hydration Mismatch: `new Date().getFullYear()` in TenantFooter

## Problem Statement

`new Date().getFullYear()` in `TenantFooter.tsx:27` is evaluated at request time on the server. If the page is ISR-cached across a year boundary, or if `TenantFooter` is ever converted to a `'use client'` component, the server-computed year diverges from the client-computed year — triggering React's hydration error and white-screening the footer.

## Findings

- **File:** `apps/web/src/components/tenant/TenantFooter.tsx:27`
- **Agent:** julik-frontend-races-reviewer (P1 primary)
- **Context:** Component rendered inside a `<Suspense>` boundary wrapping `<EditModeGate>` — a Client Component — which increases future risk surface.

## Proposed Solutions

### Option A — `suppressHydrationWarning` (Recommended)

```tsx
<time suppressHydrationWarning>{new Date().getFullYear()}</time>
```

- **Pros:** Idiomatic React pattern for dynamic-but-harmless values; allows live year display
- **Cons:** Slightly less strict
- **Effort:** Small
- **Risk:** Low

### Option B — Build-time constant

```tsx
const CURRENT_YEAR = new Date().getFullYear();
// ...
<span>{CURRENT_YEAR}</span>;
```

- **Pros:** Zero hydration concern
- **Cons:** Year only updates on redeploy (fine for most cases)
- **Effort:** Small
- **Risk:** None

## Acceptance Criteria

- [ ] `TenantFooter` renders footer year without hydration warnings in both slug and domain routes
- [ ] No React hydration error in ISR scenario (simulate by calling `new Date()` in a consistent test)
- [ ] Tests pass

## Work Log

- 2026-02-18: Created from 5-agent code review of nav/footer/section cleanup commits
