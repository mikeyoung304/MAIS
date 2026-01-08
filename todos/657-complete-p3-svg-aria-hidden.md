---
status: pending
priority: p3
issue_id: 657
tags: [code-review, accessibility, quick-win]
dependencies: []
---

# SVG Icons Missing aria-hidden

## Problem Statement

Decorative SVG icons in the component lack `aria-hidden="true"`, causing screen readers to potentially announce them.

## Findings

**Location:** `/Users/mikeyoung/CODING/MAIS/apps/web/src/components/tenant/SegmentPackagesSection.tsx`

**SVGs needing aria-hidden:**

- Lines 149-151: Explore arrow icon
- Lines 397-407: Back button arrow icon

**Current:**

```tsx
<svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
```

**Should be:**

```tsx
<svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
```

**Source:** accessibility-reviewer agent

## Proposed Solutions

### Option 1: Add aria-hidden (Recommended)

Quick fix - add attribute to both SVGs:

```tsx
<svg
  className="h-4 w-4 transition-transform group-hover:-translate-x-1"
  fill="none"
  viewBox="0 0 24 24"
  stroke="currentColor"
  aria-hidden="true"
>
```

**Effort:** Small (5 min)
**Risk:** None

## Recommended Action

Option 1 - Add aria-hidden to decorative SVGs

## Acceptance Criteria

- [ ] Both SVG icons have `aria-hidden="true"`
- [ ] Screen readers skip icon announcements

## Work Log

| Date       | Action                   | Learnings                                 |
| ---------- | ------------------------ | ----------------------------------------- |
| 2026-01-08 | Created from code review | Decorative icons should be hidden from AT |
