---
status: complete
priority: p1
issue_id: "360"
tags: [code-review, build, typescript]
dependencies: []
---

# Missing Badge Component - Build Blocker

## Problem Statement

The tenant domains page imports a `Badge` component that does not exist. This causes TypeScript compilation to fail, blocking the build.

**Why it matters:** Next.js build will fail - cannot deploy to production.

## Findings

**File:** `apps/web/src/app/(protected)/tenant/domains/page.tsx:15`
```typescript
import { Badge } from '@/components/ui/badge';  // ❌ Module not found
```

**Error:**
```
error TS2307: Cannot find module '@/components/ui/badge' or its corresponding type declarations.
```

**Available UI Components:**
- button, card, input, label, dialog, alert, input-enhanced, stepper

**Impact:** P1 - Build fails, blocks deployment

## Proposed Solutions

### Option 1: Create Badge Component (Recommended)
- **Description:** Create minimal Badge component matching shadcn/ui pattern
- **Pros:** Proper component library completion
- **Cons:** Small development effort
- **Effort:** Small (15 min)
- **Risk:** Low

### Option 2: Replace with Label/Alert
- **Description:** Use existing Label or Alert component instead
- **Pros:** No new component needed
- **Cons:** May not match design intent
- **Effort:** Small (5 min)
- **Risk:** Low

## Recommended Action

**FIX NOW - HIGHEST PRIORITY** - Build blocker. Create the Badge component using the template provided. This is blocking all builds.

## Technical Details

**File to Create:** `apps/web/src/components/ui/badge.tsx`

```typescript
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';

const badgeVariants = cva(
  'inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors',
  {
    variants: {
      variant: {
        default: 'border-transparent bg-primary text-primary-foreground',
        secondary: 'border-transparent bg-secondary text-secondary-foreground',
        destructive: 'border-transparent bg-destructive text-destructive-foreground',
        outline: 'text-foreground',
        success: 'border-transparent bg-green-100 text-green-800',
      },
    },
    defaultVariants: { variant: 'default' },
  }
);

interface BadgeProps extends React.HTMLAttributes<HTMLDivElement>,
  VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return <div className={cn(badgeVariants({ variant }), className)} {...props} />;
}

export { Badge, badgeVariants };
```

## Acceptance Criteria

- [ ] Badge component created and exported
- [ ] `npm run typecheck --workspace=@macon/web-next` passes
- [ ] `npm run build --workspace=@macon/web-next` succeeds
- [ ] Domains page renders correctly

## Work Log

| Date | Action | Learnings |
|------|--------|-----------|
| 2025-12-25 | Created during code review | Build blocker found |

## Resources

- shadcn/ui Badge: https://ui.shadcn.com/docs/components/badge
