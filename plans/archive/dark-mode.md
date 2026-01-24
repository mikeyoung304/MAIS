# feat: Dark Mode for HANDLED Platform

## Overview

Add dark mode to Next.js storefronts (apps/web). Users can toggle between light/dark or follow system preference, with choice persisted via localStorage.

**Why:** Service professionals work late. Dark mode reduces eye strain and matches modern OS behavior.

---

## Technical Approach

### Step 1: Install & Configure (~5 min)

```bash
cd apps/web && npm install next-themes
```

```javascript
// apps/web/tailwind.config.js - Add at top level
module.exports = {
  darkMode: 'selector',
  // ... rest unchanged
};
```

### Step 2: Add Dark Tokens (~20 min)

```css
/* apps/web/src/styles/design-tokens.css - Add at end */

.dark {
  /* Surfaces */
  --surface-primary: #0f0f0f;
  --surface-secondary: #1a1a1a;
  --surface-tertiary: #262626;
  --surface-elevated: #2a2a2a;

  /* Text */
  --text-primary: #f4f4f5;
  --text-secondary: #a1a1aa;
  --text-tertiary: #71717a;
  --text-muted: #52525b;

  /* Brand colors - lighter for dark backgrounds */
  --sage: #8fb59a;
  --sage-hover: #a3c4ad;
  --macon-navy: #4a7fd4;
  --macon-orange: #fb923c;
  --macon-teal: #2dd4bf;

  /* Borders */
  --border-default: #2a2a2a;
  --border-subtle: #1f1f1f;
}
```

### Step 3: Wire Up Provider (~10 min)

```tsx
// apps/web/src/components/theme-provider.tsx (NEW FILE)
'use client';

import { ThemeProvider as NextThemesProvider } from 'next-themes';

type Props = React.ComponentProps<typeof NextThemesProvider>;

export function ThemeProvider({ children, ...props }: Props) {
  return <NextThemesProvider {...props}>{children}</NextThemesProvider>;
}
```

Update existing providers:

```tsx
// apps/web/src/app/providers.tsx - Add ThemeProvider
import { ThemeProvider } from '@/components/theme-provider';

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <SessionProvider>
      <QueryClientProvider client={queryClient}>
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange
        >
          {children}
        </ThemeProvider>
      </QueryClientProvider>
    </SessionProvider>
  );
}
```

```tsx
// apps/web/src/app/layout.tsx - Add suppressHydrationWarning
<html lang="en" suppressHydrationWarning className={...}>
```

### Step 4: Create Toggle (~15 min)

```tsx
// apps/web/src/components/ui/theme-toggle.tsx (NEW FILE)
'use client';

import { useState, useEffect } from 'react';
import { useTheme } from 'next-themes';
import { Moon, Sun } from 'lucide-react';

export function ThemeToggle() {
  const [mounted, setMounted] = useState(false);
  const { setTheme, resolvedTheme } = useTheme();

  useEffect(() => setMounted(true), []);

  if (!mounted) {
    return <div className="h-9 w-9 rounded-full p-2" aria-hidden="true" />;
  }

  return (
    <button
      onClick={() => setTheme(resolvedTheme === 'dark' ? 'light' : 'dark')}
      className="rounded-full p-2 hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors"
      aria-label={`Switch to ${resolvedTheme === 'dark' ? 'light' : 'dark'} mode`}
    >
      {resolvedTheme === 'dark' ? (
        <Sun className="h-5 w-5 text-amber-400" />
      ) : (
        <Moon className="h-5 w-5 text-slate-700" />
      )}
    </button>
  );
}
```

Add to nav:

```tsx
// apps/web/src/components/tenant/TenantNav.tsx
import { ThemeToggle } from '@/components/ui/theme-toggle';

// In the nav JSX, add:
<ThemeToggle />;
```

### Step 5: Fix Hard-coded Colors (~30 min)

Run grep to find components with hard-coded colors:

```bash
grep -r "bg-white\|text-neutral-900\|border-neutral-200" apps/web/src/components --include="*.tsx"
```

For each match, add dark variants:

```tsx
// Before
className = 'bg-white text-neutral-900 border-neutral-200';

// After
className =
  'bg-white dark:bg-neutral-900 text-neutral-900 dark:text-neutral-100 border-neutral-200 dark:border-neutral-700';
```

**Priority files (if they have hard-coded colors):**

- `components/ui/card.tsx`
- `components/tenant/TenantNav.tsx`
- `components/tenant/TenantFooter.tsx`
- Section components that don't use CSS variables

---

## Files Summary

### Create (2 files)

| File                                          | Lines |
| --------------------------------------------- | ----- |
| `apps/web/src/components/theme-provider.tsx`  | ~10   |
| `apps/web/src/components/ui/theme-toggle.tsx` | ~25   |

### Modify (4 files)

| File                                    | Change                         |
| --------------------------------------- | ------------------------------ |
| `apps/web/tailwind.config.js`           | Add `darkMode: 'selector'`     |
| `apps/web/src/app/layout.tsx`           | Add `suppressHydrationWarning` |
| `apps/web/src/app/providers.tsx`        | Wrap with ThemeProvider        |
| `apps/web/src/styles/design-tokens.css` | Add `.dark {}` block           |

### Maybe Modify (grep first)

- Components with hard-coded `bg-white`, `text-neutral-*`, `border-neutral-*`
- If components use CSS variables, they work automatically

---

## Acceptance Criteria

- [ ] Toggle switches between light/dark
- [ ] Theme persists on refresh
- [ ] Respects system preference by default
- [ ] No flash of wrong theme on load
- [ ] No hydration mismatch console warnings

---

## Manual Testing (~10 min)

- [ ] Toggle light → dark → light
- [ ] Refresh page, theme persists
- [ ] Change OS theme while on "system", app follows
- [ ] Test in incognito (no localStorage errors)

---

## Out of Scope (v1)

- Legacy Vite admin (client/)
- Print mode overrides
- Themed images / logo inversion
- Smooth transitions CSS
- Unit tests (library is tested)
- E2E tests (manual QA sufficient)
- Per-tenant dark mode settings
- Success metrics tracking

---

## References

- [next-themes](https://github.com/pacocoursey/next-themes)
- [Tailwind Dark Mode](https://tailwindcss.com/docs/dark-mode)

---

**Estimated time: ~90 minutes**

_Generated with [Claude Code](https://claude.com/claude-code)_
