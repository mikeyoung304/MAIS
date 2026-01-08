# Next.js Server/Client Import Boundary - Quick Reference

**Print this. Pin it. 2-minute read.**

## The Golden Rule

> Files that import server-only modules CANNOT be imported by client components - even for functions that don't use the server import.

## Server-Only Imports (Taint the Whole File)

```typescript
import { cookies, headers } from 'next/headers'; // ❌ Server-only
import { redirect } from 'next/navigation'; // ⚠️ Server Components only
import 'server-only'; // ❌ Explicit marker
```

## The Pattern

```
api.ts           → imports next/headers → SERVER-ONLY
api.client.ts    → no server imports    → CLIENT-SAFE
config.ts        → constants only       → BOTH
```

## Before Deleting "Duplicate" Code

```
□ Does file A import next/headers or similar?
□ Does file B have no server imports?
□ Do any 'use client' components import from file B?

If all YES → Duplication is INTENTIONAL, not dead code
```

## Quick Test

```bash
# Find server-only imports in a file
grep -E "from 'next/headers'|from 'server-only'" apps/web/src/lib/*.ts
```

## Common Mistake

```typescript
// ❌ WRONG: Deleting api.client.ts because it "duplicates" api.ts
// api.ts has server imports, client components NEED api.client.ts

// ✅ RIGHT: Keep both files, document the pattern
// api.ts = server components
// api.client.ts = client components ('use client')
```

## See Also

- Full doc: `docs/solutions/best-practices/nextjs-migration-audit-server-client-boundary-MAIS-20260108.md`
- Next.js docs: https://nextjs.org/docs/app/building-your-application/rendering/composition-patterns
