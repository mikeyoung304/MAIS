---
issue_id: 11045
status: pending
priority: p2
tags: [frontend, nextjs, react, build]
effort: Small
---

# P2: useSearchParams Missing Suspense Boundary (Build-Breaking)

## Problem Statement

`useSearchParams` is used without a wrapping `Suspense` boundary in the billing and revenue pages. In Next.js App Router with static analysis enabled, this is build-breaking — the production build will fail or emit a hard warning that degrades to a runtime error. This must be fixed before the next production deployment that touches these pages.

## Findings

- Affected files:
  - `apps/web/src/app/(protected)/tenant/billing/page.tsx`
  - `apps/web/src/app/(protected)/tenant/revenue/page.tsx` (or equivalent revenue page)
- Next.js requires that any component using `useSearchParams` be wrapped in `<Suspense>` because the hook opts the component into client-side dynamic rendering, which is incompatible with static prerendering without a boundary.
- The error surfaces as a build error or a Next.js static generation bailout warning.

## Proposed Solutions

Wrap the component that calls `useSearchParams` in a `<Suspense fallback={...}>` boundary. The most maintainable pattern is to extract the part of the component that reads search params into a child component, then wrap that child in `<Suspense>` from the parent page.

```tsx
// Pattern
export default function BillingPage() {
  return (
    <Suspense fallback={<LoadingSpinner />}>
      <BillingPageInner />
    </Suspense>
  );
}

function BillingPageInner() {
  const searchParams = useSearchParams(); // safe inside Suspense
  // ...
}
```

## Acceptance Criteria

- [ ] Both affected pages have a `<Suspense>` boundary wrapping the `useSearchParams` consumer.
- [ ] `next build` completes without errors or warnings related to `useSearchParams`.
- [ ] The fallback UI is appropriate (spinner or skeleton, not blank).
- [ ] TypeScript typecheck passes for both files.

## Work Log

_(empty)_
