---
status: complete
priority: p3
issue_id: '5234'
tags: [code-review, frontend, performance]
dependencies: []
---

# P3: Four Suspense+EditModeGate wrappers could consolidate

## Problem Statement

Four identical `<Suspense><EditModeGate>` wrapper pairs exist in `layout.tsx:36-71` for TenantNav, TenantFooter, TenantChatWidget, and StickyMobileCTA. Each creates a separate client component instance with its own `useSearchParams()` subscription.

A single wrapper around all four would reduce overhead and improve clarity, since all four share the same gate condition and should mount/unmount together.

## Proposed Solutions

### Option A: Single `<SuspendedEditModeGate>` wrapping all four (Recommended)

- **Effort:** Small
- **Risk:** Low — verify progressive loading is not affected

## Technical Details

- **Affected files:** `apps/web/src/app/t/[slug]/(site)/layout.tsx`

## Acceptance Criteria

- [ ] Single EditModeGate instance gates all 4 chrome elements
- [ ] No hydration mismatch
- [ ] Preview iframe still suppresses chrome correctly

## Work Log

| Date       | Action                                      | Learnings                                 |
| ---------- | ------------------------------------------- | ----------------------------------------- |
| 2026-02-07 | Created from code review of commit 8c091544 | 4 identical wrappers = code clarity issue |
