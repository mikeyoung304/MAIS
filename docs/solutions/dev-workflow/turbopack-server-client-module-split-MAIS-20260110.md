---
title: Turbopack HMR Server-Client Module Split Pattern
date: 2026-01-10
category: dev-workflow
severity: P1
project: MAIS
component:
  - apps/web/src/lib/tenant.ts
  - apps/web/src/lib/tenant.client.ts
symptoms:
  - "config.ts module instantiation error" during client-side navigation
  - Client components fail after importing from server-tainted files
  - Build passes but Turbopack dev server crashes on navigation
tags:
  - turbopack
  - hmr
  - module-resolution
  - server-client-boundary
  - next.js
---

# Turbopack HMR Server-Client Module Split Pattern

## Problem

After signup, client-side navigation triggered a module instantiation error:

```
Error: Cannot find module 'config.ts'
Module instantiation failed during client-side navigation
```

**Symptom**: Build passed, but Turbopack HMR crashed when loading client components that imported from `tenant.ts`.

## Root Cause

`tenant.ts` imported server-only code:

```typescript
import { cache } from 'react'; // Server-only RSC feature
import { API_URL } from '@/lib/config'; // Uses process.env
```

When client components imported **anything** from `tenant.ts` (even pure functions like `normalizeToPages`), Turbopack tried to bundle the entire file, causing module resolution failures.

**Key Insight**: A file importing server-only modules becomes "tainted" - client components cannot import ANYTHING from it.

## Solution

Split into server/client files:

### `tenant.client.ts` (Client-safe)

```typescript
// Pure functions, types, error classes - NO server imports

export function normalizeToPages(config: LandingPageConfig | null): PagesConfig {
  // Pure transformation logic
}

export function isPageEnabled(config: LandingPageConfig, page: PageName): boolean {
  return config?.pages?.[page]?.enabled !== false;
}

export class TenantNotFoundError extends Error {}
export class TenantApiError extends Error {}

export type { PackageData, SegmentData, TenantStorefrontData };
```

### `tenant.ts` (Server-only)

```typescript
import { cache } from 'react';
import { API_URL } from '@/lib/config';

// Import for LOCAL use within this file
import { TenantNotFoundError, TenantApiError } from './tenant.client';

// Re-export for EXTERNAL consumers (backward compatibility)
export * from './tenant.client';

export const getTenantBySlug = cache(async (slug: string) => {
  // Server-side fetch with caching
});
```

### Import Pattern

```typescript
// Server components - use main file
import { getTenantBySlug, normalizeToPages } from '@/lib/tenant';

// Client components - use .client file
import { normalizeToPages, isPageEnabled } from '@/lib/tenant.client';
```

## Key Gotcha: Re-exports Don't Bind Locally

```typescript
// WRONG - TenantNotFoundError NOT available for local use
export * from './tenant.client';
throw new TenantNotFoundError(slug); // Error!

// CORRECT - Import for local use AND re-export
import { TenantNotFoundError } from './tenant.client';
export * from './tenant.client';
throw new TenantNotFoundError(slug); // Works!
```

## Prevention Checklist

- [ ] Check if file imports `cache`, `cookies`, `headers`, or `'server-only'`
- [ ] If yes, create `.client.ts` sibling with pure functions/types
- [ ] Client components import from `.client.ts` only
- [ ] Server file both imports (local use) AND re-exports (external use)
- [ ] Run `npm run build` to verify no module resolution errors

## Quick Reference

```
Symptom: Module error during client navigation
Check: Does imported file use cache(), cookies(), headers()?
Fix: Split into .ts (server) and .client.ts (pure)
Pattern: Import locally + re-export for backward compat
```

## Related Documentation

- [Server/Client Boundary Pattern](../best-practices/nextjs-migration-audit-server-client-boundary-MAIS-20260108.md)
- [Turbopack HMR Cache Prevention](./TURBOPACK_HMR_MODULE_CACHE_STALENESS_PREVENTION.md)
- [Next.js Import Tainting Best Practices](../patterns/NEXTJS_IMPORT_TAINTING_BEST_PRACTICES.md)

## Bonus: Dead Code Cleanup

This fix also removed ~1,300 lines of legacy build mode code:

- `BuildModeChat.tsx`, `BuildModePreview.tsx`, `PageSelector.tsx`
- `EditableText.tsx`, `RichTextEditor.tsx`, `AgentChat.tsx`
- `useDraftAutosave.ts`, `useUnsavedChangesWarning.ts`
- Orphaned `/tenant/assistant` page

See `docs/architecture/BUILD_MODE_LEGACY_CLEANUP.md` for full list.
