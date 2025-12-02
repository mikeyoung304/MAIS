---
title: Database Client Code Review Guide
category: code-review
tags: [code-review, database, prisma, checklist, pull-requests]
priority: P1
---

# Database Client Code Review Guide

**How to review PRs for database client correctness**

---

## Code Review Checklist

Use this checklist when reviewing any PR that touches database code.

### Pre-Review: Automated Checks

- [ ] ESLint passes (includes database-client-mismatch rule)
- [ ] All tests pass (unit, integration, E2E)
- [ ] No `grep` findings for anti-patterns:
  ```bash
  grep -r "supabase\.from(" server/src | grep -v storage
  # Should return: (empty)
  ```

### Manual Review: Database Operations

#### For each database query in the PR:

- [ ] **Client Type**
  - [ ] Uses `prisma.table.*` (not `supabase.from()`)
  - [ ] No Supabase JS client for table operations
  - [ ] No raw HTTP API calls for database

- [ ] **Tenant Scoping**
  - [ ] Query filtered by `tenantId` parameter
  - [ ] Cannot retrieve data from other tenants
  - [ ] Cache keys include `tenantId` if used

- [ ] **Type Safety**
  - [ ] Uses generated Prisma types
  - [ ] No `any` type assertions on query results
  - [ ] Request.tenantId properly typed

- [ ] **Error Handling**
  - [ ] Catches Prisma-specific errors
  - [ ] Distinguishes from storage errors
  - [ ] Appropriate error messages for client type

- [ ] **Performance**
  - [ ] No N+1 query patterns
  - [ ] Uses `select()` to limit fields if appropriate
  - [ ] No duplicate queries

#### Example Review Comment

```markdown
### Database Query Issue

I notice this PR adds a database query, but I have a concern:

```typescript
// Line 42
const { data } = await supabase.from('Tenant').select('*')
  .eq('id', tenantId);
```

**Issue:** This uses Supabase JS client for database queries, which:
1. Uses slower HTTP REST API
2. Tenant table may not be exposed
3. Violates our architecture pattern

**Fix:**
```typescript
const data = await prisma.tenant.findUnique({
  where: { id: tenantId }
});
```

See: [Database Client Guide](../DATABASE-CLIENT-QUICK-REFERENCE.md)
```

### Manual Review: File Operations

#### For each file upload/storage operation:

- [ ] **Storage Client**
  - [ ] Uses `supabase.storage.from()` (not `supabase.from()`)
  - [ ] Not attempting to store files in database
  - [ ] Correct bucket name ('images' for most cases)

- [ ] **Tenant Isolation**
  - [ ] File paths prefixed with `tenantId/`
  - [ ] Cannot access other tenant's files
  - [ ] Access control validated before operation

- [ ] **Error Handling**
  - [ ] Catches storage-specific errors
  - [ ] Distinguishes from database errors
  - [ ] User-friendly error messages

#### Example Review Comment

```markdown
### File Upload Implementation

Good use of Supabase Storage! Quick note:

```typescript
// Line 156
const storagePath = `${tenantId}/${folder}/${filename}`;
```

✅ Looks good - proper tenant isolation in path

Consider adding validation that `tenantId` matches authenticated tenant:

```typescript
if (storagePath.startsWith(`${req.tenantId}/`)) {
  // Safe - tenant owns this file
}
```
```

---

## Common Patterns to Check

### Pattern 1: Startup Database Verification

**Good:**
```typescript
async function verifyDatabaseWithPrisma(prisma: PrismaClient) {
  const result = await prisma.$queryRaw`SELECT COUNT(*) FROM "Tenant"`;
  logger.info('Database verified');
}
```

**Bad:**
```typescript
async function verifyDatabase() {
  const { error } = await supabase.from('Tenant').select('count');
  if (error) throw error;
}
```

**Review Comment:**
```markdown
Startup verification should use Prisma, not Supabase JS.

The Tenant table isn't exposed via Supabase REST API, so this
will fail in production.

Use: `prisma.$queryRaw<...>()` instead
```

### Pattern 2: Tenant Lookup by ID

**Good:**
```typescript
const tenant = await prisma.tenant.findUnique({
  where: { id },
  select: { id: true, slug: true, stripeAccountId: true }
});
```

**Bad:**
```typescript
const { data: [tenant] } = await supabase
  .from('Tenant')
  .select('*')
  .eq('id', id);
```

**Review Comment:**
```markdown
Use Prisma for database queries.

Supabase JS client is for file storage and auth, not database queries.
This also attempts to select all fields - consider using `select()`
to limit to needed columns.

Fix:
```typescript
const tenant = await prisma.tenant.findUnique({
  where: { id },
  select: { id: true, slug: true }
});
```
```

### Pattern 3: Transaction

**Good:**
```typescript
await prisma.$transaction(async (tx) => {
  await tx.booking.create({ data: { /* ... */ } });
  await tx.audit.create({ data: { /* ... */ } });
});
```

**Bad:**
```typescript
// Supabase doesn't support transactions
const booking = await supabase.from('Booking').insert([data]);
const audit = await supabase.from('Audit').insert([logData]);
```

**Review Comment:**
```markdown
For operations that need consistency guarantees (like booking + audit
logging), use Prisma transactions:

```typescript
await prisma.$transaction(async (tx) => {
  // Both operations succeed or both rollback
});
```

This ensures data consistency.
```

### Pattern 4: File Upload

**Good:**
```typescript
const { error } = await supabase.storage
  .from('images')
  .upload(`${tenantId}/logos/${filename}`, buffer);
```

**Bad:**
```typescript
const { error } = await supabase.storage
  .from('tenant_logos')
  .upload(`${filename}`, buffer); // Missing tenantId!
```

**Review Comment:**
```markdown
Files should be organized by tenant in the path.

Current: `${filename}` - doesn't prevent cross-tenant access
Better: `${tenantId}/logos/${filename}` - clearly scoped

Also consider: Can a malicious user manipulate tenantId parameter?
Validate that `tenantId` matches `req.tenantId` first.
```

---

## Anti-Pattern Detection

### Quick Grep Checks

Run these during review:

```bash
# Find supabase.from() that aren't for storage
git show HEAD | grep -n "supabase\.from(" | grep -v "storage"

# Find any remaining deprecated database verification
git show HEAD | grep -n "verifyDatabaseConnection\|verifyDatabase"

# Find potential transaction missing scenarios
git show HEAD | grep -n "create\|update\|delete" | grep -v "transaction"
```

### Red Flags

🚩 **Stop review if you see:**

1. `supabase.from('TableName')` for any table operation
2. Database verification via Supabase HTTP API
3. File stored as JSON in database instead of Supabase Storage
4. Transaction missing when multiple records modified
5. No `tenantId` filtering on queries
6. No `tenantId` prefix on storage paths

---

## PR Template Addition

Add this to your PR template:

```markdown
## Database Client Verification

- [ ] All database queries use **Prisma** (not Supabase JS)
- [ ] All file operations use **Supabase Storage** (not database)
- [ ] All queries properly scoped by `tenantId`
- [ ] No calls to deprecated `verifyDatabaseConnection()`
- [ ] Database verification tested with Prisma if added

### Self-Review Checklist
```bash
grep -r "supabase\.from(" server/src | grep -v storage
# Expected: (empty)
```
```

---

## Code Review Examples

### Example 1: Good Review with Approval

```
✅ Code Review Approved

This PR correctly implements database client selection:

+ Uses `prisma.tenant.findUnique()` for queries ✓
+ Uses `supabase.storage.from('images')` for uploads ✓
+ All queries filtered by `tenantId` ✓
+ Proper error handling for both clients ✓
+ New tests verify client usage ✓

No changes requested. Good work!
```

### Example 2: Review with Database Client Issues

```
⚠️ Code Review - Changes Requested

I found a few database client issues:

**Issue 1: Wrong Client for Database Query**
Line 45:
```typescript
const { data } = await supabase.from('Booking').select('*');
```

Fix: Use Prisma instead
```typescript
const data = await prisma.booking.findMany();
```

**Issue 2: Missing Tenant Scoping**
The above query doesn't filter by `tenantId`. This is a
multi-tenant security issue. Fix:
```typescript
const data = await prisma.booking.findMany({
  where: { tenantId: req.tenantId }
});
```

**Issue 3: File Upload Organization**
Lines 78-80: File path should include tenant prefix
```typescript
// Before
const path = `logos/${filename}`;

// After
const path = `${tenantId}/logos/${filename}`;
```

Please address these before resubmitting.
```

### Example 3: Review with Minor Suggestions

```
✅ Code Review Approved (with suggestions)

The database client usage looks correct!

Minor suggestions for next PR:

1. **Performance**: You're selecting all columns with `select(*)`.
   Consider limiting to needed fields:
   ```typescript
   const data = await prisma.booking.findMany({
     where: { tenantId },
     select: { id: true, date: true, status: true }
   });
   ```

2. **Type Safety**: The response type is inferred. Consider
   explicitly typing for clarity:
   ```typescript
   const data: BookingDto[] = await prisma.booking.findMany(...);
   ```

Approving as-is - these are optimizations for future PRs.
```

---

## Training Session Outline

When onboarding team members, use this structure:

### 15-Minute Session: Database Clients

1. **5 min:** Architecture overview
   - One client per purpose
   - Prisma: database queries
   - Supabase: storage only
   - Why: performance, API exposure, type safety

2. **5 min:** Anti-pattern demonstration
   - Show the problem (Supabase.from() for database)
   - Show the solution (Prisma query)
   - Explain consequences of wrong choice

3. **5 min:** Hands-on practice
   - Review a sample PR together
   - Identify 2-3 database client issues
   - Apply the checklist

### Follow-Up: Quiz

Create a quick quiz to verify understanding:

1. **Question:** When should you use `supabase.from()`?
   - A) For all table queries ❌
   - B) Only for file uploads with `.storage` ✅
   - C) Never, use Prisma instead ❌

2. **Question:** How to verify database at startup?
   - A) `supabase.from('Tenant').select('count')` ❌
   - B) `prisma.$queryRaw\`SELECT COUNT(*) FROM "Tenant"\`` ✅
   - C) Check health endpoint only ❌

3. **Question:** What's the security risk?
   - A) Supabase tables might be exposed ❌
   - B) Missing tenantId filtering ✅
   - C) No encryption ❌

---

## Escalation Path

### When to Ask for Guidance

If during review you find:

1. **Pattern not covered in this guide:** Ask in #architecture channel
2. **Conflicting guidance:** Discuss with tech lead
3. **New anti-pattern discovered:** Document and add to guide
4. **Security concern:** Escalate immediately to security team

---

## Resources

- [Database Client Quick Reference](./DATABASE-CLIENT-QUICK-REFERENCE.md)
- [Prevention Strategy (Full)](./PREVENTION-STRATEGY-DATABASE-CLIENT-MISMATCH.md)
- [Testing Guide](./DATABASE-CLIENT-TESTING-GUIDE.md)
- [CLAUDE.md Architecture](../../CLAUDE.md#architecture-patterns)

---

## Integration with CI/CD

### GitHub Actions Check

```yaml
# .github/workflows/database-client-check.yml
name: Database Client Verification

on: [pull_request]

jobs:
  verify:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3

      - name: Check for anti-patterns
        run: |
          # Fail if Supabase.from() used for database queries
          if grep -r "supabase\.from(" server/src --include="*.ts" | grep -v storage; then
            echo "❌ Found supabase.from() for database queries (use Prisma instead)"
            exit 1
          fi
          echo "✅ No database client anti-patterns found"

      - name: Run database client tests
        run: npm test -- --grep "Database|Client"
```

---

**Code Review Guide Status:** ✅ Ready to use
**Last Updated:** 2025-12-01
