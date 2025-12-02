---
title: "Render Deployment Failure: Supabase Client vs Prisma for Database Verification"
category: deployment-issues
tags: [prisma, supabase, database, render, startup, permissions, postgresql]
severity: critical
component: server/startup
date_solved: 2025-12-01
related_docs:
  - docs/setup/SUPABASE.md
  - docs/setup/SUPABASE_INTEGRATION_COMPLETE.md
  - docs/solutions/database-issues/prisma-hybrid-migration-schema-drift.md
---

# Render Deployment Failure: Supabase Client vs Prisma for Database Verification

## Problem

Render deployment failed during server startup with error:

```
"errorMessage": "permission denied for schema public (code: 42501)"
```

The error occurred in `verifyDatabaseConnection()` when attempting to verify database connectivity.

### Symptoms

- Server fails to start on Render
- Error code `42501` (PostgreSQL permission denied)
- Works locally but fails in production
- Error occurs BEFORE the application serves any requests

### Error Log (Render)

```json
{
  "level": 50,
  "time": 1733090823456,
  "msg": "❌ Database connection verification failed",
  "errorCode": "42501",
  "errorMessage": "permission denied for schema public"
}
```

## Root Cause

The `verifyDatabaseConnection()` function in `server/src/config/database.ts` was using the **Supabase JS client** to verify database connectivity:

```typescript
// ❌ WRONG - Uses Supabase REST API
const supabase = getSupabaseClient();
const { data, error } = await supabase
  .from('Tenant')
  .select('id')
  .limit(1);
```

**Why this fails:**

1. Supabase JS client queries via **REST API**, not direct PostgreSQL
2. The `Tenant` table is not exposed via Supabase API (only specific tables are)
3. REST API enforces Row-Level Security (RLS) and table exposure policies
4. Even with `SERVICE_ROLE_KEY`, the table must be exposed in Supabase dashboard

**Architecture mismatch:**
- MAIS uses **Prisma** for all database queries (direct PostgreSQL connection)
- Supabase JS client is only for **Storage** and **Auth** APIs
- Mixing these patterns caused the deployment failure

## Solution

### 1. Move verification after DI container build

The DI container creates the Prisma client. Verification must happen AFTER this:

**Before (broken):**
```typescript
// server/src/index.ts
await verifyDatabaseConnection();  // Uses Supabase client
const container = buildContainer(config);  // Creates Prisma
```

**After (fixed):**
```typescript
// server/src/index.ts
const container = buildContainer(config);  // Creates Prisma FIRST
await verifyDatabaseWithPrisma(container.prisma);  // Uses Prisma
```

### 2. New Prisma-based verification function

Added to `server/src/index.ts`:

```typescript
import type { PrismaClient } from './generated/prisma';

/**
 * Verify database connection using Prisma
 * Tests connection by running a simple query on the Tenant table
 */
async function verifyDatabaseWithPrisma(prisma: PrismaClient): Promise<void> {
  try {
    logger.info('🔍 Verifying database connection via Prisma...');

    // Simple query to verify connection - use raw query for fastest execution
    const result = await prisma.$queryRaw<{ count: bigint }[]>`
      SELECT COUNT(*) as count FROM "Tenant" LIMIT 1
    `;
    const tenantCount = Number(result[0]?.count ?? 0);

    logger.info('✅ Database connection verified successfully');
    logger.info(`📊 Database contains ${tenantCount} tenant(s)`);
  } catch (error) {
    const err = error as Error & { code?: string };
    logger.error({
      errorName: err.name,
      errorMessage: err.message,
      errorCode: err.code,
      errorStack: err.stack,
    }, '❌ Database connection verification failed');
    throw error;
  }
}
```

### 3. Deprecate old function

Updated `server/src/config/database.ts`:

```typescript
/**
 * @deprecated Use Prisma for database verification instead.
 * This function used the Supabase JS client which queries via REST API,
 * but the Tenant table is not exposed via Supabase API.
 *
 * Database verification now happens in index.ts using Prisma directly
 * after the DI container is built.
 */
export async function verifyDatabaseConnection(): Promise<void> {
  logger.warn('⚠️  verifyDatabaseConnection() is deprecated.');
  // No-op - kept for backwards compatibility
}
```

### 4. Update documentation

Added clarifying comment at top of `database.ts`:

```typescript
/**
 * Supabase Client Configuration
 *
 * NOTE: Supabase clients are ONLY used for:
 * - Storage uploads (segment hero images)
 * - Auth flows (if using Supabase Auth)
 *
 * Database queries use PRISMA, not Supabase JS client.
 * See: docs/setup/SUPABASE.md
 */
```

## Files Changed

| File | Change |
|------|--------|
| `server/src/index.ts` | Added `verifyDatabaseWithPrisma()`, moved verification after DI build |
| `server/src/config/database.ts` | Deprecated old function, added clarifying docs |

## Verification

After deploying the fix:

```
✅ Database connection verified successfully
📊 Database contains 34 tenant(s)
🚀 API listening on :3001
```

## Prevention Strategies

### 1. Code Review Checklist

When reviewing database-related code, verify:

- [ ] Database queries use **Prisma**, not Supabase JS client
- [ ] Supabase client only used for Storage or Auth
- [ ] No `supabase.from('TableName')` calls for business data

### 2. Quick Self-Check Command

```bash
# Find any Supabase client usage for database queries (should return nothing)
grep -r "supabase\.from(" server/src | grep -v storage | grep -v test
```

### 3. Client Usage Matrix

| Operation | Use This | NOT This |
|-----------|----------|----------|
| Database queries | `prisma.table.findMany()` | `supabase.from('table')` |
| File uploads | `supabase.storage.from()` | N/A |
| Authentication | `supabase.auth.*` | N/A |
| Raw SQL | `prisma.$queryRaw` | `supabase.rpc()` |

### 4. Architecture Rule

```
┌─────────────────────────────────────────────────────────┐
│                    MAIS Architecture                     │
├─────────────────────────────────────────────────────────┤
│  Prisma Client          │  Supabase JS Client           │
│  ───────────────────    │  ─────────────────────────    │
│  ✅ All DB queries      │  ✅ Storage (images)          │
│  ✅ Transactions        │  ✅ Auth (if used)            │
│  ✅ Raw SQL             │  ❌ Database queries          │
│  ✅ Migrations          │  ❌ Business data             │
└─────────────────────────────────────────────────────────┘
```

## Related Issues

- Rate limiter IPv6 validation error (`ERR_ERL_KEY_GEN_IPV6`) - Fixed in same deployment
- See: `server/src/middleware/rateLimiter.ts` - Added `validate: false` and `normalizeIp()`

## Commits

- `386dcdb` - fix(startup): use Prisma for database verification instead of Supabase client

## Related Documentation

- [Supabase Integration Guide](../../setup/SUPABASE.md)
- [Supabase Integration Complete Report](../../setup/SUPABASE_INTEGRATION_COMPLETE.md)
- [Prisma Hybrid Migration Pattern](../database-issues/prisma-hybrid-migration-schema-drift.md)
- [CI/CD Deployment Failures](../build-errors/ci-eslint-prisma-deploy-failures.md)
