# Server/Client Module Split - Quick Reference

**Print this. Pin it. 2-minute read.**

## The Golden Rule

> Files importing server-only modules (`cache()`, `cookies()`, `headers()`) CANNOT be imported by client components - even for pure utility functions.

## Server-Only Imports (Taint the Whole File)

```typescript
import { cache } from 'react'; // Server-only (request memoization)
import { cookies } from 'next/headers'; // Server-only (reads httpOnly cookies)
import { headers } from 'next/headers'; // Server-only (reads request headers)
import 'server-only'; // Explicit marker
```

## The Pattern

```
tenant.ts           -> imports cache()   -> SERVER-ONLY
tenant.client.ts    -> no server imports -> CLIENT-SAFE
config.ts           -> constants only    -> BOTH
```

## Before Adding Server Imports

```bash
# Check if client components import from this file
grep -rE "from ['\"]@/lib/filename['\"]" apps/web/src --include="*.tsx" | \
  xargs grep -l "'use client'" 2>/dev/null

# If results -> Split into *.ts and *.client.ts
# If empty -> Safe to add server import
```

## Quick Decision

```
Need cache()/cookies()/headers()?
├── NO  -> Single file, no split
└── YES -> Client imports exist?
           ├── NO  -> Add import (safe)
           └── YES -> Split into:
                      *.ts (server functions)
                      *.client.ts (pure functions)
```

## Common Mistake

```typescript
// DO NOT DELETE tenant.client.ts because it "duplicates" tenant.ts!
// tenant.ts has server imports, client components NEED tenant.client.ts

// tenant.ts - server-only (uses cache())
// tenant.client.ts - pure utilities (normalizeToPages, isPageEnabled)
```

## Test: Build Verification

```bash
npm run build
# If error mentions "marked with 'server-only'" -> Split wasn't complete
```

## Existing Pairs in Codebase

| Server File | Client File        | Why Split                 |
| ----------- | ------------------ | ------------------------- |
| `api.ts`    | `api.client.ts`    | cookies() for SSR auth    |
| `tenant.ts` | `tenant.client.ts` | cache() for data fetching |

## See Also

- Full doc: `docs/solutions/patterns/SERVER_CLIENT_MODULE_SPLIT_PREVENTION_STRATEGIES.md`
- Tainting details: `docs/solutions/patterns/NEXTJS_IMPORT_TAINTING_BEST_PRACTICES.md`
- Next.js docs: https://nextjs.org/docs/app/building-your-application/rendering/composition-patterns
