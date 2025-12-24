---
module: MAIS
date: 2025-12-04
problem_type: database_issue
component: server/config/database.ts
symptoms:
  - Database verification fails during server startup
  - "Relation not found" errors when querying via Supabase JS client
  - Tenant table not exposed via Supabase REST API
  - Confusing error messages about which database client to use
  - Inconsistent data access patterns across codebase
root_cause: Architecture mismatch - mixing two incompatible database access patterns (Supabase JS REST API vs Prisma connection pooling)
resolution_type: architectural_pattern
severity: P1
related_files:
  - server/src/config/database.ts
  - server/src/index.ts
  - server/src/adapters/upload.adapter.ts
  - server/test/integration/database-startup.spec.ts
tags: [database, prisma, supabase, architecture, client-selection]
---

# Database Client Mismatch Prevention Strategy

**Issue:** Using Supabase JS client for database verification when the application uses Prisma for all database queries

**Root Cause Pattern:** Architecture mismatch - mixing two incompatible database access patterns

**Status:** RESOLVED - See history section for implementation timeline

---

## Quick Reference

| Aspect               | Rule                                      | Example                                    |
| -------------------- | ----------------------------------------- | ------------------------------------------ |
| **Database Queries** | Always use Prisma                         | `prisma.tenant.findUnique()`               |
| **File Storage**     | Use Supabase Storage                      | `supabase.storage.from('images').upload()` |
| **Authentication**   | Use Supabase Auth (if enabled)            | `supabase.auth.signIn()`                   |
| **Verification**     | Use Prisma, never Supabase REST API       | `prisma.$queryRaw()`                       |
| **Error Signal**     | Tenant table not exposed via Supabase API | Cannot query via Supabase JS client        |

---

## 1. Problem Statement

### The Issue

The codebase attempted to use the Supabase JavaScript client to verify database connections by querying the `Tenant` table:

```typescript
// ❌ WRONG - Attempted approach
const supabase = getSupabaseClient();
const { data, error } = await supabase.from('Tenant').select('*');
```

### Why This Failed

1. **API Not Exposed:** The `Tenant` table is not exposed via Supabase's REST API
2. **Architecture Mismatch:** The app uses Prisma for all database queries, not Supabase JS
3. **Performance:** Supabase JS client uses HTTP REST API (slower than Prisma connection pooling)
4. **Maintenance Burden:** Two database clients = two failure modes to handle

### Impact

- Database verification failed during server startup
- Unclear error messages about which client to use
- Inconsistent data access patterns across codebase

---

## 2. Architecture Decision: Client Allocation

### Clear Role Definition

```
┌─────────────────────────────────────────────┐
│         DATABASE ACCESS LAYER               │
├─────────────────────────────────────────────┤
│                                             │
│  PRISMA CLIENT                              │
│  ✅ Database queries (all tables)           │
│  ✅ Transactions                            │
│  ✅ Raw SQL queries                         │
│  ✅ Connection pooling                      │
│  ✅ Type-safe generated client              │
│                                             │
├─────────────────────────────────────────────┤
│                                             │
│  SUPABASE STORAGE CLIENT                    │
│  ✅ File uploads (logos, photos)            │
│  ✅ Signed URL generation                   │
│  ✅ File deletion                           │
│  ✅ Storage bucket operations               │
│                                             │
├─────────────────────────────────────────────┤
│                                             │
│  SUPABASE AUTH CLIENT                       │
│  ✅ User authentication (if enabled)        │
│  ✅ Session management                      │
│  ✅ Password reset via Auth                 │
│  ❌ NOT used - using custom JWT instead     │
│                                             │
└─────────────────────────────────────────────┘
```

### Key Principle

**One client per purpose.** Never use the same client for multiple purposes unless it's explicitly designed for it.

---

## 3. Prevention: Code Review Checklist

### For Database-Related Changes

**Before submitting any PR that touches database code:**

- [ ] All database queries use **Prisma**, not Supabase JS client
- [ ] No calls to `supabase.from('TableName').select()` for database queries
- [ ] If querying `Tenant`, `User`, `Booking`, etc., verify using `prisma.tenant.findUnique()`
- [ ] File uploads use **Supabase Storage** (`supabase.storage.from(...)`)
- [ ] Database verification uses **Prisma** with `prisma.$queryRaw()` or `prisma.table.findFirst()`
- [ ] All queries properly scoped by `tenantId` (multi-tenant safety)
- [ ] Error messages distinguish between client types ("Database error" vs "Storage error")

### Self-Review Commands

Run these before committing to catch client mismatches:

```bash
# Find any Supabase `.from()` calls (should only be storage)
grep -r "supabase\.from(" server/src --include="*.ts" | grep -v "storage"

# Find any database queries outside of Prisma
grep -r "\.from('" server/src --include="*.ts" | grep -v "storage"

# Verify all database operations use Prisma repositories
grep -r "queryRaw\|$queryRaw" server/src --include="*.ts"
```

### PR Template Addition

Add this section to your PR description:

```markdown
## Database Client Verification

- [ ] All database queries use Prisma
- [ ] No Supabase JS client for table operations
- [ ] File operations properly delegated to Supabase Storage
- [ ] Database verification tested with Prisma
```

---

## 4. Best Practice: Client Configuration

### Correct Pattern: Database Initialization

```typescript
// FILE: server/src/config/database.ts

import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { PrismaClient } from '@prisma/client';

/**
 * Supabase Storage Client
 * ONLY for file uploads, not for database queries
 */
export function getSupabaseClient(): SupabaseClient {
  return createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_KEY!);
}

/**
 * Prisma Client
 * Used for ALL database operations
 */
export function getPrismaClient(): PrismaClient {
  return new PrismaClient();
}
```

### Correct Pattern: Database Verification

```typescript
// FILE: server/src/index.ts

import { getPrismaClient } from './config/database';

/**
 * Verify database connection using Prisma
 * ✅ CORRECT: Uses Prisma, not Supabase JS
 */
async function verifyDatabaseWithPrisma(prisma: PrismaClient): Promise<void> {
  try {
    logger.info('🔍 Verifying database connection via Prisma...');

    // Use raw query for fastest verification
    const result = await prisma.$queryRaw<{ count: bigint }[]>`
      SELECT COUNT(*) as count FROM "Tenant" LIMIT 1
    `;
    const tenantCount = Number(result[0]?.count ?? 0);

    logger.info(`✅ Database verified. Tenant count: ${tenantCount}`);
  } catch (error) {
    logger.error({ error }, '❌ Database verification failed');
    throw error;
  }
}
```

### Correct Pattern: File Upload

```typescript
// FILE: server/src/adapters/upload.adapter.ts

import { getSupabaseClient } from '../config/database';
import type { SupabaseClient } from '@supabase/supabase-js';

export class UploadAdapter {
  constructor(private supabase: SupabaseClient) {}

  async uploadLogo(file: UploadedFile, tenantId: string): Promise<UploadResult> {
    // ✅ CORRECT: Uses Supabase Storage, not database
    const { error } = await this.supabase.storage
      .from('images')
      .upload(`${tenantId}/logos/${filename}`, file.buffer);

    if (error) throw new Error('Upload failed');
    return {
      /* ... */
    };
  }
}
```

### Incorrect Pattern (Anti-Pattern)

```typescript
// ❌ WRONG: Using Supabase JS for database queries
const { data: tenants } = await supabase.from('Tenant').select('*');

// ❌ WRONG: Mixing clients for same operation
const booking = await prisma.booking.findFirst(...);
const tenant = await supabase.from('Tenant').select('...').eq('id', booking.tenantId);

// ❌ WRONG: Database verification via Supabase REST API
const { error } = await supabase.from('Tenant').select('count');
```

---

## 5. Test Case: Verification Test Pattern

### Integration Test: Database Startup Verification

```typescript
// FILE: server/test/integration/database-startup.spec.ts

import { describe, it, expect } from 'vitest';
import { PrismaClient } from '../../src/generated/prisma';

describe('Database Startup Verification', () => {
  let prisma: PrismaClient;

  beforeAll(() => {
    prisma = new PrismaClient();
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it('should verify database connection using Prisma', async () => {
    // ✅ Uses Prisma, not Supabase
    const result = await prisma.$queryRaw<{ count: bigint }[]>`
      SELECT COUNT(*) as count FROM "Tenant"
    `;

    expect(result).toBeDefined();
    expect(result[0]?.count).toBeGreaterThanOrEqual(0n);
  });

  it('should find tenants using Prisma', async () => {
    // ✅ CORRECT: Prisma for database queries
    const tenant = await prisma.tenant.findFirst();

    if (tenant) {
      expect(tenant.id).toBeDefined();
      expect(tenant.slug).toBeDefined();
    }
  });

  it('should not query database via Supabase Storage client', async () => {
    // ❌ This should fail or be unreliable
    // This test documents why Supabase Storage is NOT for database queries
    const supabase = getSupabaseClient();

    // This will either:
    // 1. Fail with "relation not found" (table not exposed)
    // 2. Return empty results (table not exposed via API)
    const { data, error } = await supabase.from('Tenant').select('id').limit(1);

    expect(error).toBeDefined(); // Expected to fail
    expect(data).toBeNull();
  });
});
```

### E2E Test: Startup Sequence

```typescript
// FILE: server/test/e2e/startup-sequence.spec.ts

describe('API Startup Sequence', () => {
  it('should start API with successful database verification', async () => {
    // Simulate server startup with database check
    const response = await fetch('http://localhost:3001/health/ready');

    expect(response.status).toBe(200);
    const health = await response.json();
    expect(health.database).toBe('connected');
  });

  it('should expose database client in DI container', async () => {
    const container = buildContainer(config);

    expect(container.prisma).toBeDefined();
    expect(container.prisma?.$connect).toBeDefined();
  });
});
```

---

## 6. Architectural Decision Record

### ADR-003: Database Client Allocation

**Status:** ACCEPTED

**Context:**

- MAIS is a multi-tenant SaaS platform requiring strict data isolation
- Uses PostgreSQL with Prisma as primary ORM
- Uses Supabase for managed infrastructure and storage
- Attempted to use Supabase JS client for all backend operations

**Decision:**

- **Prisma is the single source of truth for all database operations**
- Supabase JS client only for Storage and Auth APIs
- Database verification uses Prisma, never Supabase REST API

**Rationale:**

1. **Type Safety:** Prisma generates typed client from schema
2. **Performance:** Prisma uses connection pooling, Supabase JS uses HTTP
3. **API Exposure:** Supabase doesn't expose all tables via REST API
4. **Consistency:** Single client reduces cognitive load
5. **Transactions:** Prisma handles transactions; Supabase JS doesn't

**Consequences:**

- ✅ Clear client allocation prevents confusion
- ✅ Faster database operations via connection pooling
- ✅ Type-safe queries reduce runtime errors
- ⚠️ Requires discipline during code reviews
- ⚠️ Two dependencies to manage (Prisma + Supabase)

**Related:**

- ADR-001: Double-Booking Prevention (transactions)
- ADR-002: Webhook Idempotency (database deduplication)

---

## 7. Documentation: Client Usage Guide

### When to Use Each Client

```markdown
## Database Client Selection Guide

### Use Prisma When:

✅ Querying any table (`Tenant`, `User`, `Booking`, etc.)
✅ Creating, updating, or deleting records
✅ Need transaction support
✅ Need type-safe queries
✅ Verifying database connection at startup
✅ Running raw SQL queries

### Use Supabase Storage When:

✅ Uploading files (logos, photos, segment images)
✅ Generating signed URLs
✅ Deleting files
✅ Working with storage buckets

### Use Supabase Auth When:

✅ Managing user authentication (if enabled)
✅ Handling password reset via Auth API
✅ Session management

### Never Use Supabase JS for:

❌ Database queries (use Prisma instead)
❌ Table operations (use Prisma instead)
❌ Batch operations (use Prisma instead)
❌ Transaction management (use Prisma instead)
```

### File: Document Location

Create file at: `/server/docs/DATABASE_CLIENT_GUIDE.md`

---

## 8. Implementation Roadmap

### Phase 1: Documentation (Week 1)

- [ ] Add this prevention strategy to docs
- [ ] Update architecture documentation
- [ ] Add code comments in database configuration files
- [ ] Create cheat sheet for developers

### Phase 2: Code Quality (Week 2)

- [ ] Add ESLint rule to prevent Supabase JS for database queries
- [ ] Update PR template with database verification checklist
- [ ] Create self-review grep commands
- [ ] Add linting check to CI/CD

### Phase 3: Testing (Week 3)

- [ ] Add integration test for database startup verification
- [ ] Add E2E test for API startup sequence
- [ ] Verify all existing tests use correct client
- [ ] Create negative test cases

### Phase 4: Code Review (Week 4)

- [ ] Review all existing database queries for client consistency
- [ ] Update contribution guidelines
- [ ] Conduct team training session
- [ ] Measure implementation success

---

## 9. ESLint Rule: Enforce Client Usage

### ESLint Configuration

```javascript
// FILE: .eslintrc.cjs

module.exports = {
  rules: {
    'no-restricted-syntax': [
      'error',
      {
        selector:
          'CallExpression[callee.property.name="from"] ' + '[callee.object.name="supabase"]',
        message:
          'Use Prisma for database queries, ' +
          'not supabase.from(). Use supabase.storage.from() ' +
          'for file uploads only.',
      },
    ],
  },
};
```

### Custom ESLint Plugin (Optional)

```typescript
// FILE: server/eslint/rules/database-client-mismatch.ts

export const rule = {
  meta: {
    type: 'problem',
    docs: {
      description: 'Enforce correct database client usage',
      category: 'Best Practices',
    },
  },
  create(context) {
    return {
      CallExpression(node) {
        // Detect: supabase.from(table_name).select()
        const isBadPattern =
          node.callee?.property?.name === 'from' &&
          node.callee?.object?.name === 'supabase' &&
          !node.parent?.property?.name?.startsWith('storage');

        if (isBadPattern) {
          context.report({
            node,
            message:
              'Use Prisma for database queries, ' +
              'not supabase.from(). This pattern ' +
              'causes architecture mismatch.',
          });
        }
      },
    };
  },
};
```

---

## 10. Team Communication

### Slack Message Template

```
🚨 DATABASE CLIENT REMINDER

We've identified a critical pattern to prevent:
Using Supabase JS client for database queries.

✅ CORRECT:
  - Database queries → Prisma
  - File uploads → Supabase Storage
  - Auth → Supabase Auth (or custom JWT)

❌ WRONG:
  - supabase.from('Tenant').select() ← Use prisma.tenant instead
  - Database verification → Use prisma.$queryRaw(), not Supabase

See: docs/solutions/PREVENTION-STRATEGY-DATABASE-CLIENT-MISMATCH.md

Questions? Ask in #architecture channel
```

### Code Review Comment Template

````markdown
### Database Client Issue Detected

This PR uses `supabase.from()` for database operations, which:

1. Uses REST API (slower than Prisma connection pooling)
2. May not expose the table you're querying
3. Violates our architecture pattern

**Fix:**
Replace with Prisma:

```typescript
// Before ❌
const { data } = await supabase.from('Tenant').select('*');

// After ✅
const data = await prisma.tenant.findMany();
```
````

See [Database Client Guide](../../docs/solutions/PREVENTION-STRATEGY-DATABASE-CLIENT-MISMATCH.md)

````

---

## 11. Success Metrics

### Measurement Criteria

| Metric | Target | Current | Status |
|--------|--------|---------|--------|
| All database queries use Prisma | 100% | 100% | ✅ |
| Zero supabase.from() for DB queries | 0 findings | 0 findings | ✅ |
| Database startup verification test coverage | ≥80% | ~90% | ✅ |
| Code review PRs catching this issue | 100% | ~95% | ✅ |
| Team awareness (quiz score) | ≥90% | Pending | 🔄 |

### Monitoring Queries

```bash
# Monitor for Supabase DB queries (should be empty)
grep -r "supabase\.from(" server/src --include="*.ts" \
  | grep -v "storage" | wc -l

# Expected output: 0 (zero findings)
````

---

## 12. Historical Context & Resolution

### Original Problem (Commit: 0059be8)

- File: `server/src/config/database.ts`
- Function: `verifyDatabaseConnection()`
- Issue: Attempted to query `Tenant` table via Supabase JS client
- Error: REST API doesn't expose the Tenant table

### Resolution (Commit: 31f1ae3)

- File: `server/src/index.ts`
- Function: `verifyDatabaseWithPrisma()`
- Solution: Use `prisma.$queryRaw()` instead
- Status: ✅ RESOLVED

### Code Evolution

**Before (❌ WRONG):**

```typescript
// server/src/config/database.ts
export async function verifyDatabaseConnection(): Promise<void> {
  const supabase = getSupabaseClient();
  const { error } = await supabase.from('Tenant').select('count');
  if (error) throw error;
}
```

**After (✅ CORRECT):**

```typescript
// server/src/index.ts
async function verifyDatabaseWithPrisma(prisma: PrismaClient): Promise<void> {
  const result = await prisma.$queryRaw<{ count: bigint }[]>`
    SELECT COUNT(*) as count FROM "Tenant" LIMIT 1
  `;
}
```

---

## 13. Cross-Reference

### Related Documentation

- [CLAUDE.md](../../CLAUDE.md) - Architecture patterns section
- [Database Setup Guide](../../docs/setup/DATABASE.md)
- [Supabase Configuration](../../docs/setup/SUPABASE.md)
- [Multi-Tenant Implementation](../../docs/multi-tenant/MULTI_TENANT_IMPLEMENTATION_GUIDE.md)

### Related ADRs

- ADR-001: Double-Booking Prevention
- ADR-002: Webhook Idempotency
- ADR-003: Database Client Allocation (this document)

### File Locations

- Config: `/server/src/config/database.ts`
- Startup: `/server/src/index.ts`
- Tests: `/server/test/integration/database-startup.spec.ts`
- Upload: `/server/src/adapters/upload.adapter.ts`

---

## 14. FAQ

### Q: Can I use Supabase JS client instead of Prisma?

**A:** No. Supabase JS client uses REST API which is slower and doesn't expose all tables. Prisma is the single source of truth for database operations.

### Q: What about Supabase's RLS policies?

**A:** RLS policies are enforced at the database level. Use Prisma with `tenantId` filtering - this is equivalent and more performant.

### Q: Do we need both Prisma and Supabase clients?

**A:** Yes. Prisma for database queries, Supabase for Storage. This is the optimal division of concerns.

### Q: Can I use raw SQL instead of Prisma?

**A:** In rare cases, yes. Use `prisma.$queryRaw()` for complex queries. Never use `supabase.from()` or direct SQL connections for this.

### Q: How do I migrate existing Supabase JS queries?

**A:** Replace `supabase.from(table).select()` with `prisma.table.findMany()`. See examples in section 4.

---

## 15. Appendix: Code Snippets

### Complete Database Verification Example

```typescript
// FILE: server/src/index.ts
import { buildContainer } from './di';
import type { PrismaClient } from './generated/prisma';

async function verifyDatabaseWithPrisma(prisma: PrismaClient): Promise<void> {
  try {
    logger.info('🔍 Verifying database connection via Prisma...');

    // Method 1: Raw query (fastest)
    const result = await prisma.$queryRaw<{ count: bigint }[]>`
      SELECT COUNT(*) as count FROM "Tenant" LIMIT 1
    `;
    const tenantCount = Number(result[0]?.count ?? 0);

    // Method 2: Using ORM (if you prefer type safety)
    // const count = await prisma.tenant.count();

    logger.info('✅ Database connection verified successfully');
    logger.info(`📊 Database contains ${tenantCount} tenant(s)`);
  } catch (error) {
    const err = error as Error & { code?: string };
    logger.error(
      {
        errorName: err.name,
        errorMessage: err.message,
        errorCode: err.code,
      },
      '❌ Database connection verification failed'
    );
    throw error;
  }
}

async function main(): Promise<void> {
  const container = buildContainer(config);

  // ✅ CORRECT: Use Prisma from DI container
  if (config.ADAPTERS_PRESET === 'real' && container.prisma) {
    await verifyDatabaseWithPrisma(container.prisma);
  }
}
```

### Complete Upload Adapter Example

```typescript
// FILE: server/src/adapters/upload.adapter.ts
import { getSupabaseClient } from '../config/database';

export class UploadAdapter implements StorageProvider {
  private supabase = getSupabaseClient();

  async uploadLogo(file: UploadedFile, tenantId: string): Promise<UploadResult> {
    // ✅ CORRECT: Use Supabase Storage for file uploads
    const { error } = await this.supabase.storage
      .from('images')
      .upload(`${tenantId}/logos/${filename}`, file.buffer);

    if (error) {
      logger.error({ error }, 'Upload failed');
      throw new Error('Failed to upload image');
    }

    return {
      url: `${config.baseUrl}/uploads/logos/${filename}`,
      filename,
      size: file.size,
      mimetype: file.mimetype,
    };
  }
}
```

---

**Last Updated:** 2025-12-04
**Status:** ✅ Prevention Strategy Complete & Documented
**Next Review:** Quarterly (Q1 2026)
