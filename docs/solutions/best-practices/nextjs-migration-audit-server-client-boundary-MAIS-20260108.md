---
title: Next.js Migration Audit - Server/Client Import Boundary Pattern
slug: nextjs-migration-audit-server-client-boundary
category: best-practices
severity: medium
component: apps/web
symptoms:
  - Uncertainty about migration completeness after Vite→Next.js
  - Duplicate code that appears to be dead code but isn't
  - Client components failing to import from files with server-only imports
root_cause: Server/client import boundary pattern not understood - files importing next/headers are "tainted" and cannot be imported by client components
date_solved: 2026-01-08
tags:
  - nextjs
  - migration
  - audit
  - server-components
  - client-components
  - code-review
  - multi-reviewer
related_issues: []
---

# Next.js Migration Audit - Server/Client Import Boundary Pattern

## Problem

After migrating from Vite to Next.js App Router, needed to audit the codebase to ensure:

1. No Vite remnants left behind
2. Proper Next.js patterns being used
3. No functionality gaps from the migration

## Investigation Steps

### 1. Parallel Exploration Agents (6 agents)

Launched 6 exploration agents simultaneously to audit different areas:

| Agent            | Focus Area            | Key Findings                           |
| ---------------- | --------------------- | -------------------------------------- |
| Storefront Pages | SSR/ISR patterns      | ✅ Proper revalidate:60, React cache() |
| Admin Pages      | Auth patterns         | ✅ NextAuth v5 consistent              |
| Legacy Patterns  | Vite remnants         | ✅ Zero found                          |
| Components       | next/image, next/link | ✅ 100% adoption                       |
| Lib/Hooks        | Utilities             | ⚠️ DRY violations, console.\*          |
| Config           | next.config.js        | ✅ Proper setup                        |

### 2. Multi-Reviewer Plan Validation (3 agents)

Used three different reviewer personas to evaluate the remediation plan:

| Reviewer            | Focus                 | Key Insight                                  |
| ------------------- | --------------------- | -------------------------------------------- |
| DHH                 | Simplicity, YAGNI     | "Do P1, reject P3 as premature optimization" |
| Kieran (TypeScript) | Patterns, type safety | "api.client.ts is NOT dead code!"            |
| Code Simplicity     | DRY, maintenance      | "Verify imports before deleting"             |

## Root Cause

### The Server/Client Import Boundary Pattern

**Critical insight that prevented a breaking change:**

```
api.ts imports `next/headers` at line 14
                    ↓
This "taints" the entire file as server-only
                    ↓
Client components CANNOT import from api.ts
                    ↓
api.client.ts exists as a client-safe alternative
```

**Why this matters:**

- `api.ts` has `import { cookies } from 'next/headers'` at the top level
- Even though `createClientApiClient()` doesn't use `cookies`, the module-level import runs
- Client components importing from `api.ts` will fail at build time
- `api.client.ts` provides the same function WITHOUT server-only imports

**The duplicate code is INTENTIONAL, not dead code.**

## Solution

### P1 Fixes Applied (~25 min)

1. **Consolidated API_URL constant** to `config.ts`
   - Was duplicated in 4 files
   - Now single source of truth

2. **Removed duplicate function from api.ts** (lines 108-140)
   - Kept `api.client.ts` intact (it's the client-safe version)
   - Added comment explaining the pattern

3. **Replaced console.log/warn with logger**
   - `assistant/page.tsx` - logger.debug/info
   - `protocol.ts` - logger.warn
   - `useLocalStorage.ts` - logger.debug

### P2 Fixes Applied (~10 min)

4. **Added missing loading.tsx files**
   - `/t/[slug]/book/success/loading.tsx`
   - `/(protected)/tenant/pages/[pageType]/loading.tsx`

### P3 Items Rejected (per reviewer consensus)

- ❌ Suspense boundaries - premature optimization
- ❌ Server Actions migration - works fine as-is
- ❌ manifest.json - YAGNI, no user need
- ❌ ESLint core-web-vitals - adds noise

## Code Changes

### api.ts - Remove duplicate, add explanation

```typescript
// Before: Duplicate function at lines 108-140
export function createClientApiClient() { ... }

// After: Comment explaining the pattern
// NOTE: For client components, use createClientApiClient from '@/lib/api.client'
// This file imports next/headers which is server-only and cannot be used in 'use client' components
```

### config.ts - Single source of truth

```typescript
// apps/web/src/lib/config.ts
export const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
```

### All files now import from config

```typescript
// api.ts, api.client.ts, tenant.ts, auth.ts
import { API_URL } from '@/lib/config';
```

## Prevention Strategies

### 1. Server/Client Boundary Checklist

Before deleting "duplicate" code in Next.js App Router:

- [ ] Check if either file imports server-only modules (`next/headers`, `cookies`, etc.)
- [ ] Verify what components import from each file
- [ ] Search for `'use client'` components that depend on the "duplicate"
- [ ] If server-only imports exist, the duplication is likely intentional

### 2. Multi-Reviewer Pattern for Large Changes

For significant refactoring or audits, use multiple reviewer personas:

```
/plan_review with:
- DHH reviewer (simplicity, YAGNI)
- TypeScript reviewer (patterns, type safety)
- Code Simplicity reviewer (DRY, maintenance)
```

Different perspectives catch different issues.

### 3. Migration Audit Methodology

When auditing a framework migration:

1. **Parallel exploration** - Launch focused agents for each area
2. **Pattern matching** - Search for old framework patterns (import.meta.env, react-router)
3. **New framework patterns** - Verify new patterns adopted (next/image, next/link)
4. **Priority filtering** - Not all "issues" need fixing (distinguish P1 from P3)

## Quick Reference

### Server-Only Imports (Taint the File)

```typescript
// These imports make a file server-only:
import { cookies, headers } from 'next/headers';
import { redirect } from 'next/navigation'; // Only in Server Components
import 'server-only'; // Explicit marker
```

### Client-Safe Alternative Pattern

```
├── api.ts           # Server-side (imports next/headers)
├── api.client.ts    # Client-side (no server imports)
└── config.ts        # Shared constants (both can import)
```

### Migration Audit Grade Scale

| Grade      | Meaning                                   |
| ---------- | ----------------------------------------- |
| A (90-100) | Clean migration, only housekeeping needed |
| B (80-89)  | Good migration, minor pattern issues      |
| C (70-79)  | Acceptable, some legacy patterns remain   |
| D (60-69)  | Incomplete, significant gaps              |
| F (<60)    | Failed, major functionality missing       |

**This audit: A (93/100)** - Housekeeping fixes only, zero migration gaps.

## Related Documentation

- `docs/solutions/patterns/mais-critical-patterns.md` - Core patterns
- `docs/solutions/code-review-patterns/nextjs-migration-lessons-learned-MAIS-20251225.md` - Migration lessons
- `apps/web/README.md` - Next.js app patterns
