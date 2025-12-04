---
status: complete
priority: p2
issue_id: '111'
tags: [code-review, architecture, duplication, ui-redesign]
dependencies: []
---

# Mobile Action Dropdown Duplicated 100% in List Components

## Problem Statement

Identical mobile dropdown implementation (31 lines) duplicated 100% in PackageList and SegmentsList.

**Why it matters:** 62 lines of duplicated code, maintenance nightmare.

## Findings

### From pattern-recognition agent:

**Files with duplication:**

- `client/src/features/tenant-admin/packages/PackageList.tsx` (lines 169-192)
- `client/src/features/admin/segments/SegmentsList.tsx` (lines 122-143)

**Duplicated pattern (31 lines each):**

```tsx
<div className="sm:hidden">
  <DropdownMenu>
    <DropdownMenuTrigger asChild>
      <Button variant="ghost" size="sm" className="text-text-muted">
        <MoreVertical className="w-4 h-4" />
      </Button>
    </DropdownMenuTrigger>
    <DropdownMenuContent align="end" className="bg-white border-sage-light/20">
      <DropdownMenuItem onClick={() => onEdit(item)}>
        <Edit className="w-4 h-4 mr-2" />
        Edit
      </DropdownMenuItem>
      <DropdownMenuItem onClick={() => onDelete(item.id)} className="text-danger-600">
        <Trash2 className="w-4 h-4 mr-2" />
        Delete
      </DropdownMenuItem>
    </DropdownMenuContent>
  </DropdownMenu>
</div>
```

## Proposed Solutions

### Solution 1: Create ActionMenu Component (Recommended)

**Pros:** Reusable, DRY
**Cons:** Slight abstraction overhead
**Effort:** Small (1 hour)
**Risk:** Low

```typescript
// components/ui/ActionMenu.tsx
interface ActionMenuItem {
  label: string;
  icon: LucideIcon;
  onClick: () => void;
  variant?: "default" | "danger";
}

interface ActionMenuProps {
  items: ActionMenuItem[];
  ariaLabel?: string;
}

export function ActionMenu({ items, ariaLabel }: ActionMenuProps) {
  return (
    <div className="sm:hidden">
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="sm" aria-label={ariaLabel}>
            <MoreVertical className="w-4 h-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          {items.map(item => (
            <DropdownMenuItem
              key={item.label}
              onClick={item.onClick}
              className={item.variant === "danger" ? "text-danger-600" : ""}
            >
              <item.icon className="w-4 h-4 mr-2" />
              {item.label}
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
```

## Acceptance Criteria

- [ ] ActionMenu component created
- [ ] Supports configurable items with icons
- [ ] Supports danger variant for delete
- [ ] Includes aria-label prop for accessibility
- [ ] Both list components refactored to use it

## Work Log

| Date       | Action                   | Learnings                 |
| ---------- | ------------------------ | ------------------------- |
| 2025-11-30 | Created from code review | Pattern duplication found |
