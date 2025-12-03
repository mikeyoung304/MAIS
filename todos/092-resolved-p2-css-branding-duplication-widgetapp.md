# TODO: Extract shared CSS branding logic from TenantStorefrontLayout and WidgetApp

**Priority:** P2 (Medium)
**Category:** Code Quality (DRY)
**Source:** Code Review - Code Simplicity Reviewer Agent
**Created:** 2025-11-29

## Problem

CSS branding application logic is duplicated between `TenantStorefrontLayout.tsx` and `WidgetApp.tsx`. Both components:
1. Apply CSS custom properties from branding object
2. Clean up CSS variables on unmount
3. Map the same branding fields to the same CSS variables

This violates DRY principle and risks divergence if one is updated without the other.

## Location

- `client/src/app/TenantStorefrontLayout.tsx:95-127` (branding useEffect)
- `client/src/app/WidgetApp.tsx` (similar branding logic)

## Impact

- Bug fixes need to be applied in multiple places
- Inconsistent branding behavior between storefront and widget
- More code to maintain
- Risk of divergence over time

## Solution

Create a shared `useTenantBranding` hook:

```typescript
// client/src/hooks/useTenantBranding.ts
import { useEffect } from 'react';

interface TenantBranding {
  primaryColor?: string;
  secondaryColor?: string;
  accentColor?: string;
  backgroundColor?: string;
  fontFamily?: string;
  logoUrl?: string;
}

const CSS_VARIABLE_MAP: Record<keyof Omit<TenantBranding, 'logoUrl'>, string> = {
  primaryColor: '--color-primary',
  secondaryColor: '--color-secondary',
  accentColor: '--color-accent',
  backgroundColor: '--color-background',
  fontFamily: '--font-family',
};

export function useTenantBranding(branding?: TenantBranding) {
  useEffect(() => {
    if (!branding) return;

    const root = document.documentElement;
    const appliedVariables: string[] = [];

    // Apply branding CSS variables
    Object.entries(CSS_VARIABLE_MAP).forEach(([key, cssVar]) => {
      const value = branding[key as keyof TenantBranding];
      if (typeof value === 'string' && value) {
        root.style.setProperty(cssVar, value);
        appliedVariables.push(cssVar);
      }
    });

    // Cleanup on unmount or branding change
    return () => {
      appliedVariables.forEach(cssVar => {
        root.style.removeProperty(cssVar);
      });
    };
  }, [branding]);
}
```

Then use in both components:
```typescript
// TenantStorefrontLayout.tsx
useTenantBranding(tenant?.branding);

// WidgetApp.tsx
useTenantBranding(config?.branding);
```

## Acceptance Criteria

- [ ] Create `useTenantBranding` hook in shared location
- [ ] Refactor TenantStorefrontLayout to use hook
- [ ] Refactor WidgetApp to use hook
- [ ] Both components have identical branding behavior
- [ ] Hook has proper TypeScript types
- [ ] Unit tests for the hook

## Related Files

- `client/src/app/TenantStorefrontLayout.tsx`
- `client/src/app/WidgetApp.tsx`
- `client/src/hooks/useTenantBranding.ts` (to create)
