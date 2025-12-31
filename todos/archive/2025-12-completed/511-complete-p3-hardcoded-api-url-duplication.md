# P3: Hardcoded API_URL Repeated in Multiple Files

## Status

- **Priority:** P3 (Low - DRY)
- **Status:** ready
- **Created:** 2025-12-30
- **Source:** `/workflows:review` - TypeScript Reviewer, Architecture Strategist

## Problem

The `API_URL` constant is defined identically in 4+ files:

```typescript
const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
```

**Files:**

- `apps/web/src/app/(protected)/admin/tenants/page.tsx`
- `apps/web/src/app/(protected)/admin/tenants/actions.ts`
- `apps/web/src/app/(protected)/admin/tenants/new/actions.ts`
- `apps/web/src/app/(protected)/admin/tenants/[id]/actions.ts`
- `apps/web/src/app/(protected)/admin/tenants/[id]/page.tsx`

## Impact

DRY violation. If default port changes, multiple files need updates.

## Solution

Extract to shared config:

```typescript
// apps/web/src/lib/config.ts
export const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

// Usage
import { API_URL } from '@/lib/config';
```

## Tags

`dry`, `config`, `refactor`
