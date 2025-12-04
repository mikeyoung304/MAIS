---
status: complete
priority: p2
issue_id: '110'
tags: [code-review, architecture, duplication, ui-redesign]
dependencies: []
---

# Status Badge Pattern Duplicated Across List Components

## Problem Statement

Identical status badge implementation (Active/Inactive) duplicated in PackageList and SegmentsList.

**Why it matters:** Code duplication, inconsistent if one changes without the other.

## Findings

### From pattern-recognition agent:

**Files with duplication:**

- `client/src/features/tenant-admin/packages/PackageList.tsx` (lines 121-129)
- `client/src/features/admin/segments/SegmentsList.tsx` (lines 77-85)

**Duplicated pattern:**

```tsx
<span
  className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
    isActive ? 'bg-sage/10 text-sage' : 'bg-text-muted/10 text-text-muted'
  }`}
>
  {isActive ? 'Active' : 'Inactive'}
</span>
```

## Proposed Solutions

### Solution 1: Create StatusBadge Component (Recommended)

**Pros:** Reusable, consistent
**Cons:** New component
**Effort:** Small (30 min)
**Risk:** Low

```typescript
// components/ui/StatusBadge.tsx
interface StatusBadgeProps {
  status: "active" | "inactive" | "pending" | "confirmed" | "cancelled";
}

export function StatusBadge({ status }: StatusBadgeProps) {
  const styles = {
    active: "bg-sage/10 text-sage",
    inactive: "bg-text-muted/10 text-text-muted",
    confirmed: "bg-green-100 text-green-800",
    // ...
  };
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${styles[status]}`}>
      {status.charAt(0).toUpperCase() + status.slice(1)}
    </span>
  );
}
```

## Acceptance Criteria

- [ ] StatusBadge component created
- [ ] Supports active, inactive, pending, confirmed, cancelled
- [ ] All duplicated instances replaced
- [ ] Visual appearance unchanged

## Work Log

| Date       | Action                   | Learnings                 |
| ---------- | ------------------------ | ------------------------- |
| 2025-11-30 | Created from code review | Pattern duplication found |
