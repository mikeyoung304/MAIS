# P3: Missing loading.tsx for Tenant CRUD Routes

## Status

- **Priority:** P3 (Low - UX)
- **Status:** ready
- **Created:** 2025-12-30
- **Source:** `/workflows:review` - TypeScript Reviewer, Architecture Strategist

## Problem

The admin tenant CRUD routes lack `loading.tsx` files for explicit loading states.

**Missing files:**

- `apps/web/src/app/(protected)/admin/tenants/loading.tsx`
- `apps/web/src/app/(protected)/admin/tenants/new/loading.tsx`
- `apps/web/src/app/(protected)/admin/tenants/[id]/loading.tsx`

## Impact

Users see nothing during server-side data fetching. While Next.js streaming provides implicit loading, explicit loading skeletons improve perceived performance.

## Solution

Add loading.tsx files with appropriate skeletons:

```tsx
// apps/web/src/app/(protected)/admin/tenants/loading.tsx
import { Card, CardContent } from '@/components/ui/card';

export default function TenantsLoading() {
  return (
    <div>
      <div className="mb-8 flex items-start justify-between">
        <div className="space-y-2">
          <div className="h-8 w-32 bg-neutral-700 rounded animate-pulse" />
          <div className="h-4 w-48 bg-neutral-700 rounded animate-pulse" />
        </div>
      </div>
      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {[1, 2, 3].map((i) => (
          <Card key={i} colorScheme="dark">
            <CardContent className="p-6 space-y-4">
              <div className="h-6 w-32 bg-neutral-700 rounded animate-pulse" />
              <div className="h-4 w-48 bg-neutral-700 rounded animate-pulse" />
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
```

## Tags

`ux`, `loading-states`, `nextjs`
