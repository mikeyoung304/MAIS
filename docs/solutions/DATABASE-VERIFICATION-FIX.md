# Database Verification Fix: Render Deployment Permission Error

**Date:** December 1, 2025
**Status:** RESOLVED
**Severity:** Critical (P1)
**Impact:** Render production deployment, staging environments

---

## Problem Statement

Database verification failed on Render deployment with the following error:

```
❌ Database connection verification failed
error: permission denied for schema public (code: 42501)
```

This error occurred during server startup in real mode (PostgreSQL) but worked perfectly in local development and mock mode.

### Root Cause Analysis

The issue stemmed from a fundamental mismatch in how database verification was implemented:

1. **Original Implementation:** `verifyDatabaseConnection()` in `server/src/config/database.ts` used the **Supabase JS client**
2. **Supabase JS Client Limitation:** Queries via REST API, not direct PostgreSQL connections
3. **API Restriction:** The `Tenant` table was not exposed through Supabase's API layer
4. **Local vs. Remote:** This worked locally due to direct PostgreSQL access but failed on Render where Supabase API restrictions were enforced
5. **Permission Model:** Supabase enforces Row-Level Security (RLS) and table exposure policies at the API level, blocking direct table queries

The error `permission denied for schema public (code: 42501)` indicates that the Supabase REST API endpoint was rejecting the request because:

- The `Tenant` table might not have been exposed as an RPC endpoint
- Or RLS policies prevented direct table access via the API

---

## Solution Implemented

### Key Architectural Change

Move database verification **from initialization time** to **after the DI container is built** (where Prisma client exists). This enables using Prisma's direct PostgreSQL connection instead of relying on Supabase's REST API.

### Changes Made

#### 1. New Function: `verifyDatabaseWithPrisma()`

**File:** `/Users/mikeyoung/CODING/MAIS/server/src/index.ts` (lines 19-39)

```typescript
/**
 * Verify database connection using Prisma
 * Tests connection by running a simple query on the Tenant table
 */
async function verifyDatabaseWithPrisma(prisma: PrismaClient): Promise<void> {
  try {
    logger.info('🔍 Verifying database connection via Prisma...');

    // Simple query to verify connection - use raw query for fastest execution
    const result = await prisma.$queryRaw<
      { count: bigint }[]
    >`SELECT COUNT(*) as count FROM "Tenant" LIMIT 1`;
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

**Why `$queryRaw`?**

- Executes **direct SQL** via Prisma's PostgreSQL connection pool
- Bypasses Supabase REST API entirely
- Fastest and most reliable verification method
- Works with any PostgreSQL database (Render, Supabase, local, etc.)

#### 2. Updated Main Function Flow

**File:** `/Users/mikeyoung/CODING/MAIS/server/src/index.ts` (lines 41-92)

**Before:** Verification happened during early initialization

**After:** Verification happens after DI container is built (lines 54-62)

```typescript
async function main(): Promise<void> {
  const startTime = Date.now();

  try {
    // 1. Validate environment variables first (fail-fast)
    validateEnv();

    // 2. Load configuration
    const config = loadConfig();
    logger.info('Configuration loaded');

    // 3. Initialize error tracking
    initSentry();

    // 4. BUILD DI CONTAINER (creates Prisma client in real mode)
    const container = buildContainer(config);

    // 5. VERIFY DATABASE using Prisma (real mode only)
    if (config.ADAPTERS_PRESET === 'real' && container.prisma) {
      await verifyDatabaseWithPrisma(container.prisma);
    } else {
      logger.info('⏭️  Skipping database verification (mock mode)');
    }

    // 6. Create Express app
    const app = createApp(config, container, startTime);

    // 7. Start server and register shutdown handlers
    const server = app.listen(config.API_PORT, () => {
      logger.info(`🚀 API listening on :${config.API_PORT}`);
    });

    registerGracefulShutdown({
      server,
      cleanup: container.cleanup,
      onShutdown: async () => {
        await closeSupabaseConnections();
      },
    });
  } catch (error) {
    logger.error({ error }, 'Failed to start server');
    process.exit(1);
  }
}
```

**Execution Order:**

1. Environment validation (fail-fast)
2. Config loading
3. DI container initialization (includes Prisma)
4. Database verification using Prisma
5. Express app creation
6. Server startup
7. Graceful shutdown registration

#### 3. Deprecated Old Function

**File:** `/Users/mikeyoung/CODING/MAIS/server/src/config/database.ts` (lines 80-91)

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

**Backwards Compatibility:** The function is kept as a no-op to prevent breaking any code that might still reference it.

#### 4. Documentation Update

**File:** `/Users/mikeyoung/CODING/MAIS/server/src/config/database.ts` (lines 1-10)

Updated file header to clarify role of Supabase client:

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

---

## Why This Works

### Problem with Supabase JS Client Approach

The Supabase JS client makes HTTP REST API calls to Supabase's backend. When you try to query a table:

```typescript
// This goes over HTTP/REST, not direct PostgreSQL
const { data } = await supabaseClient.from('Tenant').select('*');
```

Supabase enforces:

- Row-Level Security (RLS) policies at the API layer
- Table exposure configuration (which tables are accessible via REST)
- API rate limits and authentication

If the `Tenant` table isn't exposed as an RPC endpoint or RLS policies block the query, you get a 403 Forbidden (which manifests as "permission denied for schema public").

### Solution: Prisma Direct Connection

Prisma connects **directly to PostgreSQL** using a connection pool:

```typescript
// This is direct PostgreSQL via Prisma's connection pool
const result = await prisma.$queryRaw<
  { count: bigint }[]
>`SELECT COUNT(*) as count FROM "Tenant" LIMIT 1`;
```

Benefits:

- **No REST API layer:** Bypasses Supabase API restrictions entirely
- **Direct authentication:** Uses DATABASE_URL credentials
- **Works everywhere:** Local PostgreSQL, Render PostgreSQL, Supabase PostgreSQL, AWS RDS, etc.
- **Consistent:** Same mechanism used by all Prisma queries throughout the app
- **Reliable:** Not affected by Supabase API configuration changes

---

## Deployment Impact

### Before Fix

```
Server startup fails immediately on Render
Logs show: "permission denied for schema public (code: 42501)"
Production deployment blocked
```

### After Fix

```
Server verifies database connection via Prisma
Logs show: "✅ Database connection verified successfully"
Server starts normally
All routes work (database connection confirmed)
```

### Testing Checklist

- [x] Verify database connection in real mode (PostgreSQL)
- [x] Skip database verification in mock mode (in-memory)
- [x] Handle connection errors with detailed logging
- [x] Maintain backwards compatibility (deprecated function)
- [x] Update documentation

---

## Technical Details

### Prisma $queryRaw Behavior

```typescript
const result = await prisma.$queryRaw<
  { count: bigint }[]
>`SELECT COUNT(*) as count FROM "Tenant" LIMIT 1`;
```

- **Returns:** Array of objects typed as `{ count: bigint }[]`
- **Converts:** BigInt results to JavaScript Number
- **Fast:** Single COUNT query, minimal overhead
- **Safe:** Parameterized query (template literal), immune to SQL injection

### Error Handling

```typescript
catch (error) {
  const err = error as Error & { code?: string };
  logger.error({
    errorName: err.name,
    errorMessage: err.message,
    errorCode: err.code,        // PostgreSQL error code (e.g., "42501")
    errorStack: err.stack,
  }, '❌ Database connection verification failed');
  throw error;                   // Fail server startup
}
```

**Error codes you might see:**

- `42501` - Permission denied (schema/table access)
- `P1000` - Prisma connection error
- `P1001` - Can't reach database server
- `P1002` - Database server timed out

---

## Related Files

### Modified Files

- `/Users/mikeyoung/CODING/MAIS/server/src/index.ts` - Added verifyDatabaseWithPrisma(), moved verification after DI container
- `/Users/mikeyoung/CODING/MAIS/server/src/config/database.ts` - Deprecated old function, updated comments

### Related Documentation

- `server/IDEMPOTENCY_IMPLEMENTATION.md` - Database integration patterns
- `CLAUDE.md` - Project setup and environment configuration
- `.claude/ADVANCED_MCP_SETUP.md` - Development environment

---

## Lessons Learned

### Key Insight

When building features that interact with multiple systems:

1. **Understand each system's constraints** - Supabase JS client uses REST API with RLS policies
2. **Avoid unnecessary layers** - Use direct connections when available (Prisma)
3. **Test in realistic environments** - Works locally ≠ works on Render
4. **Separate concerns** - Supabase = storage/auth, Prisma = database queries

### Prevention Strategies

1. **Use Prisma for all database queries** - Consistent, tested, works everywhere
2. **Test on staging that matches production** - Render environment in this case
3. **Log detailed errors** - Include error codes and stack traces
4. **Fail fast on startup** - Don't let the server run with bad database connection
5. **Document system boundaries** - Clarify which tool does what

---

## Verification Steps

To verify this fix works in your environment:

```bash
# 1. Test in real mode with actual PostgreSQL
ADAPTERS_PRESET=real npm run dev:api

# Expected output:
# 🔍 Verifying database connection via Prisma...
# ✅ Database connection verified successfully
# 📊 Database contains X tenant(s)
# 🚀 API listening on :3001

# 2. Test in mock mode (skips verification)
ADAPTERS_PRESET=mock npm run dev:api

# Expected output:
# ⏭️  Skipping database verification (mock mode)
# 🚀 API listening on :3001

# 3. Test with invalid database URL (verify error handling)
DATABASE_URL=postgresql://invalid npm run dev:api

# Expected output:
# ❌ Database connection verification failed
# Error details logged
# Process exits with code 1
```

---

## Summary

This fix resolves a critical deployment blocker by:

1. **Using the right tool for the job** - Prisma (direct PostgreSQL) instead of Supabase JS client (REST API)
2. **Proper initialization order** - Verify database after DI container is built
3. **Detailed error handling** - Log error codes for debugging
4. **Environment agnostic** - Works with any PostgreSQL provider (Supabase, Render, local, etc.)

The solution is minimal, focused, and maintains backwards compatibility while fixing the root cause.
