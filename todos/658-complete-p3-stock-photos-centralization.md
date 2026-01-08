---
status: pending
priority: p3
issue_id: 658
tags: [code-review, architecture, config]
dependencies: []
---

# Stock Photos Hardcoded in Component

## Problem Statement

`SEGMENT_STOCK_PHOTOS` is hardcoded with external Unsplash URLs inside the component. This should be centralized in a shared constants file or made tenant-configurable.

## Findings

**Location:** `/Users/mikeyoung/CODING/MAIS/apps/web/src/components/tenant/SegmentPackagesSection.tsx`

- Lines 28-62

**Issues:**

1. External dependency on Unsplash (could change URLs or rate-limit)
2. No tenant customization for fallback photos
3. Not easily discoverable for updates

**Source:** architecture-strategist agent

## Proposed Solutions

### Option 1: Move to Constants File

```typescript
// apps/web/src/lib/constants/stock-photos.ts
export const SEGMENT_STOCK_PHOTOS: Record<string, string> = {
  corporate: '...',
  wellness: '...',
  // ...
};

export function getSegmentStockPhoto(segment: {
  name: string;
  slug: string;
  description?: string | null;
}): string {
  // ... lookup logic
}
```

**Pros:**

- Centralized
- Reusable
- Easy to update

**Cons:**

- New file

**Effort:** Small (15 min)
**Risk:** Low

### Option 2: Tenant-Configurable Defaults

Add `defaultSegmentPhotos` to tenant branding config in database.

**Pros:**

- Per-tenant customization
- No code changes for new photos

**Cons:**

- Database migration
- Admin UI needed
- More complex

**Effort:** Large (2-4 hours)
**Risk:** Medium

## Recommended Action

Option 1 for now - centralize in constants file. Consider Option 2 as future enhancement.

## Acceptance Criteria

- [ ] Stock photos moved to `lib/constants/stock-photos.ts`
- [ ] Helper function exported
- [ ] Component imports from new location

## Work Log

| Date       | Action                   | Learnings                                |
| ---------- | ------------------------ | ---------------------------------------- |
| 2026-01-08 | Created from code review | Configuration belongs in dedicated files |
