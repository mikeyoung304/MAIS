---
status: resolved
priority: p1
issue_id: '679'
tags: [code-review, agent-first-architecture, performance, bundle-size]
dependencies: []
---

# P1: Missing Lazy Loading Despite Comment

## Problem Statement

The `ContentArea.tsx` file has a comment saying "Lazy load PreviewPanel to reduce initial bundle size" but uses a synchronous import. The `Suspense` wrapper is pointless without `React.lazy()`.

**Why This Matters:**

- PreviewPanel and all its dependencies (14 lucide-react icons, useDraftConfig, ConfirmDialog, etc.) are bundled in the initial chunk
- Users who never view preview still pay the bundle cost
- Increases Time to Interactive (TTI) unnecessarily
- Comment misleads future developers about actual behavior

## Findings

**Agent:** Performance Oracle

**Location:** `apps/web/src/components/dashboard/ContentArea.tsx` (lines 26-27)

**Current State:**

```typescript
// Lazy load PreviewPanel to reduce initial bundle size
import { PreviewPanel } from '@/components/preview/PreviewPanel';
```

The Suspense wrapper on line 145 does nothing because import is synchronous.

## Proposed Solutions

### Option A: Implement actual lazy loading (Recommended)

```typescript
import { lazy } from 'react';

// Lazy load PreviewPanel to reduce initial bundle size
const PreviewPanel = lazy(() => import('@/components/preview/PreviewPanel'));
```

- **Pros:** Matches intent, reduces initial bundle, Suspense now functional
- **Cons:** Adds loading state on first preview access
- **Effort:** Small (1 line change)
- **Risk:** Low

### Option B: Remove misleading comment

- Keep synchronous import, remove the comment
- **Pros:** Accurate documentation
- **Cons:** Misses optimization opportunity
- **Effort:** Trivial
- **Risk:** None

## Recommended Action

**Option A** - Implement actual lazy loading. The comment indicates this was the intent, and the optimization is worthwhile given PreviewPanel's dependency tree.

## Technical Details

**Affected Files:**

- `apps/web/src/components/dashboard/ContentArea.tsx`

**PreviewPanel Dependencies:**

- 14 lucide-react icons
- useDraftConfig hook
- ConfirmDialog component
- useAuth hook
- Various types from @macon/contracts

**Implementation:**

1. Change import to `lazy(() => import(...))`
2. Verify Suspense fallback displays correctly
3. Test that preview loads on first access

## Acceptance Criteria

- [ ] PreviewPanel is lazy loaded via React.lazy()
- [ ] Initial bundle size reduced (measurable)
- [ ] Suspense fallback shows during load
- [ ] No regression in preview functionality
- [ ] Comment accurately reflects implementation

## Work Log

| Date       | Action                     | Outcome        |
| ---------- | -------------------------- | -------------- |
| 2026-01-09 | Created during code review | Initial filing |

## Resources

- PR: Agent-First Dashboard Architecture (Phases 1-5)
- File: `apps/web/src/components/dashboard/ContentArea.tsx:26-27`
