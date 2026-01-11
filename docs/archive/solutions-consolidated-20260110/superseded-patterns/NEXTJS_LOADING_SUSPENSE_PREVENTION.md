# Next.js loading.tsx Suspense Boundaries - Prevention Strategies

**Status:** Complete Prevention Pattern
**Severity:** P2 (Code Quality)
**Last Updated:** 2026-01-05
**Related:** P2 Fix #639

## Problem Statement

Next.js App Router pages missing `loading.tsx` files create inconsistent user experience:

- Flash of unstyled content (FOUC) during navigation
- Layout shift as loading states appear
- Inconsistent behavior across routes
- Screen readers may announce content before it loads

Pattern identified in `/tenant/scheduling/*` routes which lack loading states while other routes (`/tenant/pages/`, `/tenant/build/`) have them.

## Prevention Strategies

### 1. Route Audit Checklist (Code Review)

**When:** Every code review, new route creation
**How:** Check each route systematically

```markdown
- [ ] Route has page.tsx (or is a layout-only route)
- [ ] Route has loading.tsx (required if page fetches data)
- [ ] Layout-only routes (no page.tsx) don't need loading.tsx
- [ ] Dynamic routes have error.tsx boundary
- [ ] Loading spinner uses theme colors (e.g., text-sage, not hardcoded colors)
```

**Failing examples:**

```
apps/web/src/app/(protected)/tenant/scheduling/               ❌ Missing loading.tsx
apps/web/src/app/(protected)/tenant/scheduling/page.tsx       ✓ Has loading.tsx
apps/web/src/app/(protected)/tenant/scheduling/appointments/  ❌ Missing loading.tsx
```

### 2. Standard Loading Pattern

**Use this template for all routes:**

```tsx
// apps/web/src/app/(protected)/tenant/scheduling/loading.tsx

import { Loader2 } from 'lucide-react';

export default function Loading() {
  return (
    <div className="flex min-h-[50vh] items-center justify-center">
      <Loader2 className="h-8 w-8 animate-spin text-sage" />
    </div>
  );
}
```

**Key attributes:**

- `min-h-[50vh]` - Prevent content jump above/below
- `text-sage` - Consistent with brand color
- `animate-spin` - Tailwind built-in, no custom CSS needed
- `Loader2` icon - Standard across MAIS

### 3. File Structure Validation

**Detect missing loading.tsx systematically:**

```bash
# Find all page.tsx files without corresponding loading.tsx
find apps/web/src/app -name "page.tsx" -type f | while read page; do
  dir=$(dirname "$page")
  if [ ! -f "$dir/loading.tsx" ]; then
    echo "Missing loading.tsx: $dir"
  fi
done
```

**One-liner for CI/CD:**

```bash
npm run check:missing-loading-tsx
```

**Add to package.json:**

```json
{
  "scripts": {
    "check:missing-loading-tsx": "find apps/web/src/app -name page.tsx | while read p; do d=$(dirname \"$p\"); [ ! -f \"$d/loading.tsx\" ] && echo \"Missing: $d\"; done"
  }
}
```

### 4. Exceptions to the Rule

**When loading.tsx is NOT needed:**

```tsx
// ❌ Layout-only routes (no data fetching, no page.tsx)
apps/web/src/app/(protected)/tenant/
  ├── layout.tsx          ← No loading.tsx needed
  └── scheduling/
      ├── layout.tsx      ← No loading.tsx needed
      └── page.tsx        ← HAS loading.tsx ✓

// ❌ Static pages with no data fetching
export const preloadQuery = true;  // Skip loading state
export default function StaticPage() { ... }

// ✓ Dynamic routes with data fetching
export default async function DynamicPage() {
  const data = await fetchData();  // Requires loading.tsx
  return ...
}
```

**Decision tree:**

```
Does the route have a page.tsx?
  ├─ NO → No loading.tsx needed (layout-only)
  ├─ YES → Does the page fetch data?
      ├─ NO → No loading.tsx needed
      └─ YES → MUST have loading.tsx ✓
```

### 5. Testing the Pattern

**Manual QA checklist:**

```markdown
1. [ ] Navigate to the route
2. [ ] Verify spinner appears before content
3. [ ] Spinner uses correct color (sage)
4. [ ] No content flashing before spinner
5. [ ] Spinner disappears when content loads
6. [ ] Works on slow network (Chrome DevTools throttle)
```

**E2E Test:**

```typescript
test('shows loading spinner before content loads', async ({ page }) => {
  await page.goto('/tenant/scheduling/appointments');

  // Spinner visible before content
  const spinner = page.locator('svg.animate-spin');
  await expect(spinner).toBeVisible();

  // Content loads and spinner disappears
  await expect(page.locator('text=Appointments')).toBeVisible();
  await expect(spinner).not.toBeVisible();
});
```

### 6. Build-Time Validation

**TypeScript check for missing loading.tsx:**

```typescript
// scripts/validate-loading-tsx.ts

import { glob } from 'glob';
import { existsSync } from 'fs';
import { dirname } from 'path';

async function validateLoadingFiles() {
  const pageFiles = await glob('apps/web/src/app/**/page.tsx');
  const missing: string[] = [];

  for (const page of pageFiles) {
    const dir = dirname(page);
    const loadingFile = `${dir}/loading.tsx`;

    // Skip dynamic routes with preloadQuery
    if (!existsSync(loadingFile)) {
      missing.push(dir);
    }
  }

  if (missing.length > 0) {
    console.error('Missing loading.tsx files:');
    missing.forEach((m) => console.error(`  ${m}`));
    process.exit(1);
  }
}

validateLoadingFiles();
```

**Add to build script:**

```json
{
  "scripts": {
    "build": "npm run validate:loading-tsx && next build"
  }
}
```

## Code Review Checklist

When reviewing Next.js changes:

```markdown
File changes in apps/web/src/app/
├─ New page.tsx added?
│ └─ [ ] Check if corresponding loading.tsx exists
│
├─ New page.tsx modified?
│ └─ [ ] Check if loading.tsx matches data fetching pattern
│
├─ Removed page.tsx?
│ └─ [ ] Check if orphaned loading.tsx should be deleted
│
└─ New route created?
└─ [ ] loading.tsx added in same directory
```

## Related Files

- **Pattern reference:** `/Users/mikeyoung/CODING/MAIS/apps/web/src/app/(protected)/tenant/pages/loading.tsx`
- **Example implementation:** `/Users/mikeyoung/CODING/MAIS/apps/web/src/app/(protected)/tenant/scheduling/loading.tsx` (all 5 scheduling sub-routes)
- **Next.js docs:** https://nextjs.org/docs/app/building-your-application/routing/loading-ui-and-streaming

## Key Takeaways

1. **Every data-fetching page needs loading.tsx** - No exceptions for consistency
2. **Use standard pattern** - Copy spinner pattern from existing files, not custom designs
3. **Theme color required** - Always use `text-sage` for consistency
4. **Minimum height prevents jump** - `min-h-[50vh]` is minimum (increase for larger content areas)
5. **Test on slow networks** - DevTools throttling reveals real issues

## FAQ

**Q: Can I skip loading.tsx for fast endpoints?**
A: No. Users on slow networks deserve consistent UX. Let Next.js Suspense optimize.

**Q: What if the page is server-rendered without async data?**
A: Then it doesn't need loading.tsx. But if ANY async operation occurs, add it.

**Q: Should loading.tsx be different per route?**
A: No. Standard spinner ensures consistent, recognizable pattern. Custom spinners create UX confusion.

**Q: Can I use a skeleton instead of spinner?**
A: Yes, but only if the skeleton matches the actual content layout (prevents layout shift).
