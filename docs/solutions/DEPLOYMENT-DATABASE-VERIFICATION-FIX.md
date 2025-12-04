---
title: 'Fix Render Deployment Database Verification: Supabase Client vs Prisma'
category: deployment-issues
tags: [prisma, supabase, database, render, startup, permissions]
severity: critical
component: server/startup
date_solved: 2025-12-01
related_issues: [P1-075]
---

## Problem

**Error:** `permission denied for schema public (code: 42501)` during server startup on Render deployment

**Root Cause:** The server was attempting to verify the database connection using the Supabase JS client, which queries the database via REST API. However, the `Tenant` table was not exposed via Supabase's API layer, causing a permission denied error.

### Why This Happened

In `/server/src/config/database.ts`, the `verifyDatabaseConnection()` function used:

```typescript
const { data, error } = await supabase
  .from('Tenant') // ❌ Not exposed via Supabase API
  .select('id')
  .limit(1);
```

The Supabase JS client bypasses Prisma and makes direct REST API calls. The `Tenant` table may be restricted in the Supabase API configuration, causing authentication failures on deployment.

## Solution

**Move database verification to occur AFTER the DI container is built**, where Prisma is already initialized. Use Prisma's raw query capability instead of the Supabase client.

### Implementation Changes

#### 1. Deprecate Supabase-based verification

`/server/src/config/database.ts`:

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
  logger.warn('⚠️  verifyDatabaseConnection() is deprecated. Use Prisma for DB verification.');
  // No-op - kept for backwards compatibility
}
```

#### 2. Create Prisma-based verification

`/server/src/index.ts`:

```typescript
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
    logger.error(
      {
        errorName: err.name,
        errorMessage: err.message,
        errorCode: err.code,
        errorStack: err.stack,
      },
      '❌ Database connection verification failed'
    );
    throw error;
  }
}
```

#### 3. Call verification after DI container initialization

`/server/src/index.ts` main() function:

```typescript
// Build DI container (creates Prisma client in real mode)
const container = buildContainer(config);

// Verify database connection using Prisma (real mode only)
if (config.ADAPTERS_PRESET === 'real' && container.prisma) {
  await verifyDatabaseWithPrisma(container.prisma);
} else {
  logger.info('⏭️  Skipping database verification (mock mode)');
}
```

### Key Differences

| Aspect                | Supabase Client (Before)                | Prisma (After)                        |
| --------------------- | --------------------------------------- | ------------------------------------- |
| **Connection Type**   | REST API via Supabase                   | Direct PostgreSQL via connection pool |
| **Table Exposure**    | Requires table in Supabase API settings | Direct access to all tables           |
| **Permission Errors** | Common due to API restrictions          | Uses direct DB credentials            |
| **When Available**    | Must be initialized early               | Available after DI container built    |
| **Performance**       | Network request overhead                | Direct DB connection                  |

## Why This Fix Works

1. **Supabase JS client** is intended for:
   - Storage operations (uploads/downloads)
   - Auth flows (if using Supabase Auth)
   - Frontend queries (with RLS enforcement)

2. **Prisma** is the correct choice for:
   - Server-side database verification
   - Any table access beyond API exposure
   - Direct PostgreSQL queries with full credentials

3. **DI Container Order** ensures:
   - Prisma client is already initialized
   - Config and secrets are loaded
   - We have proper error handling infrastructure

## Deployment Impact

- **Render deployment:** Now successfully verifies database connection
- **Local development:** No changes (verification skipped in mock mode)
- **Real mode:** Uses Prisma instead of Supabase client

## Prevention Strategy

When accessing database tables:

1. **Server-side queries:** Always use Prisma or direct queries
2. **API-layer queries:** Use Supabase client only for exposed tables
3. **Startup verification:** Must occur after DI container initialization

## References

- **Commit:** `386dcdb` - "fix(startup): use Prisma for database verification instead of Supabase client"
- **Related P1 Fix:** `31f1ae3` - "fix(p1): resolve 6 P1 issues - React hooks, accessibility, DB verification"
- **Files Modified:**
  - `/server/src/config/database.ts`
  - `/server/src/index.ts`

## Testing

Verify the fix on deployment:

```bash
# Local testing in real mode
DATABASE_URL="postgresql://..." ADAPTERS_PRESET=real npm run dev:api

# Check logs for
# ✅ "Database connection verified successfully"
# ✅ "Database contains N tenant(s)"
```

If you see the old error:

```
❌ Database connection verification failed
permission denied for schema public (code: 42501)
```

This indicates the fix hasn't been applied. Ensure you're running the fixed version from commit `386dcdb` or later.
