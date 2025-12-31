# P2: Duplicate Tenant Type Definitions

## Status

- **Priority:** P2 (Medium - Code Quality)
- **Status:** ready
- **Created:** 2025-12-30
- **Source:** `/workflows:review` - TypeScript Reviewer, Architecture Strategist

## Problem

The `Tenant` interface is duplicated in multiple files:

**Locations:**

- `apps/web/src/app/(protected)/admin/tenants/page.tsx` (lines 11-19)
- `apps/web/src/app/(protected)/admin/tenants/TenantsList.tsx` (lines 12-20)
- `apps/web/src/app/(protected)/admin/tenants/[id]/page.tsx` (lines 11-24 as `TenantDetail`)
- `apps/web/src/app/(protected)/admin/tenants/[id]/EditTenantForm.tsx` (partial)

## Impact

- DRY violation
- Changes require updates in multiple locations
- Risk of type drift between files

## Solution

Extract to shared types file:

```typescript
// apps/web/src/app/(protected)/admin/tenants/types.ts
export interface Tenant {
  id: string;
  slug: string;
  name: string;
  email: string;
  createdAt: string;
  stripeConnected: boolean;
  packageCount: number;
}

export interface TenantDetail extends Tenant {
  commission: number;
  isActive: boolean;
  apiKeyPublic: string;
  bookingCount: number;
  updatedAt: string;
}
```

Or even better, derive from contracts package if admin tenant contracts exist.

## Tags

`typescript`, `types`, `dry`, `code-quality`
