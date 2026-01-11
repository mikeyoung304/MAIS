---
module: MAIS
date: 2026-01-10
problem_type: architecture_mismatch
component: apps/web/src/lib
symptoms:
  - Client component fails to import utility function
  - Build error mentioning "server-only" but function doesn't use server APIs
  - Pure functions inaccessible from 'use client' components
  - Turbopack HMR issues with module resolution
root_cause: Server-only imports (cache(), cookies(), headers()) taint entire file
resolution_type: prevention_strategy
severity: P1
tags: [next.js, server-components, client-components, import-boundary, module-split]
related_docs:
  - NEXTJS_IMPORT_TAINTING_BEST_PRACTICES.md
  - NEXTJS_AUDIT_PREVENTION_STRATEGIES.md
  - NEXTJS_SERVER_CLIENT_BOUNDARY_QUICK_REFERENCE.md
---

# Server/Client Module Split Prevention Strategies

**Prevention strategies for module splitting when files import server-only code**

This document captures the critical pattern: when a file imports server-only modules (`cache()` from React, `cookies()` or `headers()` from `next/headers`), that file becomes "tainted" - client components CANNOT import ANYTHING from it, even pure functions that don't use the server import.

---

## Executive Summary

| Pattern                        | Risk     | Impact                                        |
| ------------------------------ | -------- | --------------------------------------------- |
| Importing server-only module   | High     | Taints entire file, breaks all client imports |
| Pure functions in tainted file | Critical | Build failures when client tries to import    |
| Missing companion client file  | Medium   | Forced to duplicate code or refactor          |

**Key Insight:** The `api.ts` / `api.client.ts` pattern in this codebase is INTENTIONAL, not code duplication. Same for `tenant.ts` / `tenant.client.ts`.

---

## The Problem

### What Happens

```typescript
// apps/web/src/lib/tenant.ts
import { cache } from 'react'; // <-- Server-only! Taints entire file
import { API_URL } from './config';

// This function uses cache() - must be server-only
export const getTenantBySlug = cache(async (slug: string) => {
  const response = await fetch(`${API_URL}/v1/public/tenants/${slug}`);
  return response.json();
});

// This is a PURE function - no server APIs!
export function normalizeToPages(config: LandingPageConfig): PagesConfig {
  if (config?.pages) return config.pages;
  return structuredClone(DEFAULT_PAGES_CONFIG);
}
```

```typescript
// apps/web/src/components/TenantEditor.tsx
'use client';

// ERROR: Cannot import from tenant.ts - file is tainted!
import { normalizeToPages } from '@/lib/tenant';
```

### Why It Breaks

1. `cache()` from React is server-only (creates request-level memoization)
2. `cookies()` and `headers()` from `next/headers` are server-only
3. Next.js marks the ENTIRE file as server-only when any import is server-only
4. Client components cannot import from server-only files - even for pure utilities

---

## Prevention Checklist

Before adding server-only imports to a file, complete this checklist:

### 1. Check if file has client imports

```bash
# Find all client components importing from this file
grep -r "from '@/lib/tenant'" apps/web/src --include="*.tsx" | \
  xargs grep -l "'use client'" 2>/dev/null
```

If results found, you CANNOT add server-only imports to this file.

### 2. Identify pure functions

Before importing `cache()`, `cookies()`, or `headers()`:

- [ ] List all exports from the file
- [ ] Mark which functions use the new server-only import
- [ ] Mark which functions are pure (no server APIs)
- [ ] Plan to split if any pure functions exist

### 3. Create companion client file if needed

If file will have both server-only and pure functions:

- [ ] Create `*.client.ts` companion file
- [ ] Move pure functions to client file
- [ ] Add explicit comment explaining the split
- [ ] Update all client component imports

### 4. Verify build passes

```bash
npm run build
# If you see "marked with 'server-only'" errors, the split wasn't complete
```

### 5. Add file documentation

Both files should have header comments:

```typescript
// tenant.ts
/**
 * Tenant API Service (SERVER COMPONENTS ONLY)
 *
 * For client components, import from '@/lib/tenant.client' instead.
 * This file uses React's cache() which is server-only.
 */

// tenant.client.ts
/**
 * Tenant Client-Safe Utilities
 *
 * Safe to import in 'use client' components.
 * Does NOT import any server-only APIs.
 */
```

---

## Decision Tree: When to Split Modules

```
Does the file need to import cache(), cookies(), or headers()?
│
├── NO → Keep as single file (no split needed)
│
└── YES → Check current imports
          │
          ├── No client components import from this file?
          │   └── OK to add server-only import (no split needed)
          │
          └── Client components DO import from this file?
              │
              ├── Client imports ONLY constants/types?
              │   └── Extract to config.ts or types.ts, then add server import
              │
              └── Client imports functions?
                  │
                  ├── Functions are pure (no side effects, no async)?
                  │   └── Create *.client.ts, move pure functions there
                  │
                  └── Functions need server APIs?
                      └── Client must call via API route (not direct import)
```

### Quick Decision

```
Q: Will adding this import break client components?
A: Run this command first:

grep -rE "from ['\"]@/lib/${filename}['\"]" apps/web/src --include="*.tsx" | \
  xargs grep -l "use client" 2>/dev/null

If results → You need to split
If empty → Safe to add server import
```

---

## Quick Reference (Add to CLAUDE.md)

```markdown
**Key insight from Server/Client Module Split:** Files importing server-only
modules (`cache()` from React, `cookies()`/`headers()` from `next/headers`)
taint the entire file - client components cannot import ANYTHING from it,
even pure functions. The `api.ts`/`api.client.ts` and `tenant.ts`/`tenant.client.ts`
patterns are INTENTIONAL, not duplication. Before adding server imports,
check if client components import from the file. If yes, split into
`*.ts` (server) and `*.client.ts` (pure functions).
```

---

## Test Strategy

### 1. Verify client file has no server imports

```typescript
// apps/web/src/lib/tenant.client.test.ts
import * as tenantClient from '@/lib/tenant.client';

describe('tenant.client.ts', () => {
  it('should not contain server-only imports', async () => {
    // This test file would fail to compile if tenant.client.ts
    // had server-only imports, because test files run in Node
    // but the linter/bundler checks for 'use client' compatibility
    expect(tenantClient.normalizeToPages).toBeDefined();
    expect(tenantClient.isPageEnabled).toBeDefined();
  });

  it('should be importable in simulated client context', () => {
    // If this file compiles as a client component test, the imports are safe
    const pages = tenantClient.normalizeToPages(null);
    expect(pages).toBeDefined();
  });
});
```

### 2. Verify server file works

```typescript
// apps/web/src/lib/tenant.test.ts
import { getTenantBySlug, getTenantStorefrontData } from '@/lib/tenant';

describe('tenant.ts (server)', () => {
  it('should provide cached data fetching functions', () => {
    expect(typeof getTenantBySlug).toBe('function');
    expect(typeof getTenantStorefrontData).toBe('function');
  });
});
```

### 3. Build verification (most important)

```bash
# The ultimate test - if this passes, the split is correct
npm run build

# Expected: No errors about "marked with 'server-only'"
# Expected: All client components compile successfully
```

### 4. Pattern validation script

```bash
#!/bin/bash
# scripts/check-server-client-split.sh

echo "Checking for potential server/client boundary issues..."

# Find files with server-only imports
SERVER_FILES=$(grep -rl "from 'next/headers'\|from 'react'.*cache" apps/web/src/lib --include="*.ts")

for file in $SERVER_FILES; do
  base=$(basename "$file" .ts)

  # Check if any client components import from this file
  client_imports=$(grep -rE "from ['\"]@/lib/${base}['\"]" apps/web/src --include="*.tsx" | \
    xargs grep -l "'use client'" 2>/dev/null)

  if [ -n "$client_imports" ]; then
    # Check if companion client file exists
    client_file="${file%.ts}.client.ts"
    if [ ! -f "$client_file" ]; then
      echo "WARNING: $file has server imports but no .client.ts companion"
      echo "  Client components that import from it:"
      echo "$client_imports" | sed 's/^/    /'
    fi
  fi
done

echo "Check complete."
```

---

## Existing Examples in Codebase

### Example 1: api.ts / api.client.ts

```
apps/web/src/lib/
├── api.ts          # Server: imports next/headers for cookies
│   └── createServerApiClient() - reads auth cookies
│   └── createApiClientWithAuth() - injects auth headers
│
└── api.client.ts   # Client: NO server imports
    └── createClientApiClient() - uses relative URLs, no auth
```

**Why split:** `api.ts` needs `cookies()` from `next/headers` for SSR auth. Client components can't read httpOnly cookies anyway, so they use the proxy pattern via `api.client.ts`.

### Example 2: tenant.ts / tenant.client.ts

```
apps/web/src/lib/
├── tenant.ts           # Server: imports cache() from React
│   └── getTenantBySlug() - cached data fetching
│   └── getTenantStorefrontData() - parallel fetching
│
└── tenant.client.ts    # Client: NO server imports
    └── normalizeToPages() - pure config transformation
    └── isPageEnabled() - pure boolean check
    └── validateDomain() - pure validation
    └── TenantNotFoundError - error class
```

**Why split:** `tenant.ts` uses React's `cache()` for request-level memoization. Pure utility functions like `normalizeToPages()` needed by client editors live in `tenant.client.ts`.

---

## Common Mistakes

### Mistake 1: Deleting "duplicate" client file

```typescript
// DO NOT DELETE - this is INTENTIONAL duplication
// apps/web/src/lib/tenant.client.ts

// The function looks identical to one in tenant.ts but:
// 1. tenant.ts imports cache() - server-only
// 2. Client components NEED tenant.client.ts
// 3. This is not dead code!
```

### Mistake 2: Adding cache() without checking imports

```typescript
// WRONG: Adding cache() to file with client imports
import { cache } from 'react';  // Breaks all client imports!

export const getData = cache(async () => { ... });
export function pureUtil() { ... }  // Now inaccessible to clients
```

### Mistake 3: Re-exporting from server file

```typescript
// tenant.client.ts
// WRONG: Re-exporting from server file taints this file too!
export * from './tenant'; // Imports cache() transitively!
```

---

## Related Documentation

- **[NEXTJS_IMPORT_TAINTING_BEST_PRACTICES.md](NEXTJS_IMPORT_TAINTING_BEST_PRACTICES.md)** - Detailed tainting mechanics
- **[NEXTJS_AUDIT_PREVENTION_STRATEGIES.md](NEXTJS_AUDIT_PREVENTION_STRATEGIES.md)** - Full audit methodology
- **[NEXTJS_SERVER_CLIENT_BOUNDARY_QUICK_REFERENCE.md](../best-practices/NEXTJS_SERVER_CLIENT_BOUNDARY_QUICK_REFERENCE.md)** - 2-minute reference
- **[ADR-014: Next.js App Router Migration](../../adrs/ADR-014-nextjs-app-router-migration.md)** - Architecture decisions

---

## Document Maintenance

**Created:** 2026-01-10
**Source:** Turbopack HMR module resolution issues, server/client boundary patterns
**Status:** Active prevention strategy

Update this document when:

- New server-only APIs are introduced by Next.js
- New module pairs are created in the codebase
- Build failures related to import tainting occur
