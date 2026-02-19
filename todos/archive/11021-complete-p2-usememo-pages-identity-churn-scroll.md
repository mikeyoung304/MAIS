---
status: pending
priority: p2
issue_id: '11021'
tags: [code-review, frontend, performance, react, usememo, tenant-nav]
---

# P2-07 — `useMemo` Churn on Scroll Due to `pages` Object Identity in TenantNav

## Problem Statement

`useMemo([basePath, pages])` in `TenantNav` invalidates when `pages` object reference changes. On soft navigations or router refreshes, React may recreate the RSC tree and pass a new `pages` object even with identical data. Since `TenantNav` re-renders on every scroll event (via `useActiveSection` IntersectionObserver), `getNavItemsFromHomeSections(pages)` — which iterates all sections for each page in `PAGE_ORDER` — runs on every scroll frame when `pages` reference is unstable.

## Findings

- **File:** `apps/web/src/components/tenant/TenantNav.tsx:49-56`
- **Agents:** julik-frontend-races-reviewer (P2-02), kieran-typescript-reviewer (P3-2 — escalated)

## Proposed Solution

Hoist `getNavItemsFromHomeSections(pages)` to the Server Component and pass the derived `navItems` array directly to `TenantNav`:

```tsx
// In TenantSiteShell.tsx (server component):
const navItems = getNavItemsFromHomeSections(pages);

// Pass to TenantNav:
<TenantNav tenant={tenant} navItems={navItems} basePath={basePath} />;
```

```tsx
// TenantNav: replace useMemo with direct prop
interface TenantNavProps {
  // ...
  navItems: NavItem[]; // replaces pages prop
}
```

- The `navItems` array is stable when content is stable (primitives)
- Avoids object-identity problem entirely
- Simplifies TenantNav (removes `useMemo`, removes `pages` import)

## Acceptance Criteria

- [ ] `TenantNav` receives `navItems` array directly (not `pages` object)
- [ ] No `useMemo` for nav items in `TenantNav`
- [ ] `TenantSiteShell` computes `navItems` once at render time
- [ ] Nav still updates correctly when sections change (verify in dev)

## Work Log

- 2026-02-18: Created from 2-agent convergence
