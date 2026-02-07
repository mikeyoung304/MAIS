# P1: ContentArea & Layout Performance

**Source:** Dashboard Rebuild Review (PR #39, 2026-02-07)
**Files:** `apps/web/src/components/dashboard/ContentArea.tsx`, `apps/web/src/app/(protected)/tenant/layout.tsx`

## Findings

1. **ContentArea broad selector**: Uses a selector that returns an object, causing re-renders on every store update (Pitfall #87). Use primitive selectors or `useShallow`.

2. **Layout 6+ store subscriptions**: Root layout subscribes to multiple stores — any update re-renders the entire tree. Extract child components or memoize.

3. **ComingSoonDisplay eager framer-motion import** (~35KB): Should lazy-load with `React.lazy()` since this component is only shown during onboarding.

## Fix

- Split ContentArea selector into primitive selectors: `useAgentUIStore(s => s.view.status)`
- Extract layout subscriptions into isolated child components
- `const ComingSoonDisplay = React.lazy(() => import('./ComingSoonDisplay'))`
