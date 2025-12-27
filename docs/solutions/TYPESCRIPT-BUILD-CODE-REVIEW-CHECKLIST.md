# TypeScript Build & Seed Configuration - Code Review Checklist

**Use this checklist when reviewing pull requests**

---

## PR Review Checklist for Schema Changes

When reviewing a PR that modifies `server/prisma/schema.prisma`:

### Schema Modifications

- [ ] **Schema change is documented** in commit message
- [ ] **Prisma migration created** (not just schema.prisma edited)
  ```bash
  # Should exist in server/prisma/migrations/
  ls -la server/prisma/migrations | tail -1
  ```
- [ ] **Migration is idempotent** (safe to run multiple times)
  - Check for `IF NOT EXISTS`, `IF EXISTS`, `DO $$...$$` blocks in raw SQL
- [ ] **schema.prisma reflects current database state** after running migration

### Generated Code

- [ ] **Prisma Client regenerated** (`npm exec prisma generate`)
  - Look for changes in `server/src/generated/prisma/index.d.ts`
- [ ] **Generated types committed** to git
  ```bash
  # Should see modified files in generated/prisma/
  git diff --name-only | grep generated/prisma
  ```

### Code References Updated

- [ ] **All property references updated** in:
  ```bash
  # Search for old property name
  rg "oldPropertyName" server/src/
  ```
  - [ ] Service files (`*.service.ts`)
  - [ ] Route files (`*.routes.ts`)
  - [ ] Repository implementations (`*.repository.ts`)
  - [ ] Mock adapters (`adapters/mock/*.ts`)
  - [ ] Type contracts (`packages/contracts/src/`)
  - [ ] Tests (`server/test/`)

- [ ] **No references to renamed field** in codebase
  ```bash
  # Should return no results
  rg "oldPropertyName" server/ packages/
  ```

### Type Safety

- [ ] **No new `as any` type assertions** (without justification)
  ```bash
  # Check diffs for new 'as any'
  git diff | grep "as any"
  ```

- [ ] **Type assertions explained** if necessary
  ```typescript
  // ✅ Good: With explanation
  const mock = {...} as unknown as ServiceType;  // Stub for testing

  // ❌ Bad: No explanation
  const mock = {...} as ServiceType;
  ```

- [ ] **Type narrowing used** for comparisons
  ```typescript
  // ❌ Bad: Direct assertion
  const key = value as keyof typeof obj;

  // ✅ Good: Type guard first
  if (value in obj) {
    const key = value as keyof typeof obj;
  }
  ```

### TypeScript Checks Pass

- [ ] **TypeScript compiles** without errors
  ```bash
  npm run typecheck
  # Should output: "✓ No errors"
  ```

- [ ] **No unused parameters** added
  ```bash
  npm run lint
  # Should report no "unused parameter" errors
  ```

- [ ] **No implicit any** types
  ```bash
  npm run typecheck
  # Should report no "implicitly has an 'any' type"
  ```

---

## PR Review Checklist for Seed Changes

When reviewing a PR that modifies seed files:

### Environment Variables

- [ ] **All required env vars documented** in seed file header
  ```typescript
  /**
   * Requires: ADMIN_EMAIL, ADMIN_DEFAULT_PASSWORD
   */
  ```

- [ ] **Validation exists** for required variables
  ```typescript
  if (!adminEmail) {
    throw new Error('ADMIN_EMAIL is required');
  }
  ```

- [ ] **Validation exists** for variable format
  ```typescript
  if (!adminEmail.includes('@')) {
    throw new Error(`Invalid ADMIN_EMAIL format: ${adminEmail}`);
  }
  ```

- [ ] **`.env.example` updated** with new variables
  ```bash
  # Check .env.example matches seed requirements
  grep "ADMIN_EMAIL" .env.example
  ```

### Seed Logic

- [ ] **Idempotency checks exist**
  ```typescript
  // ✅ Good: Check before creating
  const existing = await db.findUnique({ where: { email } });
  if (existing) return;  // Skip if already exists

  // ❌ Bad: Always creates (will error on re-run)
  const user = await db.create({ data });
  ```

- [ ] **Transaction wrapping** for multi-step operations
  ```typescript
  // ✅ Good: All-or-nothing
  await prisma.$transaction(async (tx) => {
    await tx.user.create(...);
    await tx.admin.create(...);
  });

  // ❌ Bad: Can partially succeed
  await db.user.create(...);
  await db.admin.create(...);  // If this fails, user is created
  ```

- [ ] **Post-seed verification** (if critical data)
  ```typescript
  // ✅ Good: Verify expected state
  const admin = await db.findUnique({ where: { email: adminEmail } });
  if (!admin) throw new Error('Admin not created');

  // ❌ Bad: No verification
  await db.user.create({...});
  logger.info('Done');
  ```

### Tests

- [ ] **Seed has unit tests** checking:
  - [ ] Missing required env vars throws error
  - [ ] Invalid env var format throws error
  - [ ] Successful seed creates expected records
  - [ ] Re-running seed doesn't duplicate data

- [ ] **Test file location** exists
  ```bash
  # Should exist
  test -f server/test/seeds/platform-seed.test.ts
  ```

### Logging

- [ ] **Uses `logger` not `console.log`**
  ```bash
  # Should be no console.log in seed files
  rg "console\.log" server/prisma/seeds/
  ```

- [ ] **Logs include context** (tenantId, operation, etc.)
  ```typescript
  // ✅ Good
  logger.info({ tenantId, count: users.length }, 'Created users');

  // ❌ Bad
  console.log('Done');
  ```

---

## Code Quality Checks

### Build and Test

- [ ] **TypeScript builds** without errors
  ```bash
  npm run typecheck
  npm run build
  ```

- [ ] **Existing tests still pass**
  ```bash
  npm test
  ```

- [ ] **Lint passes**
  ```bash
  npm run lint
  ```

### Consistency

- [ ] **Follows MAIS patterns** from CLAUDE.md
  ```bash
  # Spot check against these patterns:
  # - Tenant scoping (all queries filter by tenantId)
  # - Error handling (services throw, routes catch)
  # - Repository pattern (methods require tenantId param)
  ```

- [ ] **Naming conventions** followed
  ```bash
  # Files: *.service.ts, *.repository.ts, *.routes.ts
  # Functions: camelCase
  # Constants: UPPER_CASE
  # Classes: PascalCase
  ```

### Documentation

- [ ] **Complex logic has comments**
- [ ] **Why, not what** (explain the intention)
  ```typescript
  // ❌ Bad: Explains what code does
  // Increment count
  count++;

  // ✅ Good: Explains why
  // Advisory lock ensures only one booking per date per tenant
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(${lockId})`;
  ```

---

## Red Flags & When to Request Changes

### Must Request Changes

- [ ] Property referenced that doesn't exist in schema
  ```typescript
  // ❌ Schema has 'heroImage', code uses 'heroImageUrl'
  segment.heroImageUrl
  ```

- [ ] Type assertion bypasses safety without explanation
  ```typescript
  // ❌ No justification
  const value = unknown as Type;
  ```

- [ ] Unused parameters (TypeScript should catch, but verify)
  ```typescript
  // ❌ Parameter named but never used
  function process(_id: string) { }  // Lint error
  ```

- [ ] Seed file missing env var validation
  ```typescript
  // ❌ No check for ADMIN_EMAIL
  const email = process.env.ADMIN_EMAIL;
  const user = await db.create({ data: { email } });
  ```

- [ ] Seed file missing documentation
  ```typescript
  // ❌ No comment about ADMIN_EMAIL requirement
  export async function seedPlatform(db) { }
  ```

### Request Changes If

- [ ] TypeScript has warnings (strict mode)
- [ ] Lint has any errors
- [ ] Build fails
- [ ] Tests fail
- [ ] `npm run typecheck` reports issues
- [ ] No test coverage for new seed logic
- [ ] `.env.example` not updated
- [ ] Schema migration not created (just schema.prisma edited)

### Nice-to-Have

- [ ] Unit tests for validation logic
- [ ] Integration tests for seed execution
- [ ] Comments explaining non-obvious logic
- [ ] Error messages guide user to solution

---

## PR Approval Criteria

**Approve ONLY if:**

- [ ] All red flags resolved
- [ ] All "Request Changes If" items addressed
- [ ] TypeScript strict mode: ✅ PASS
- [ ] Lint: ✅ PASS
- [ ] Build: ✅ PASS
- [ ] Tests: ✅ PASS
- [ ] Code review checklist: ✅ ALL ITEMS CHECKED
- [ ] Commits follow convention (e.g., "fix: ...", "feat: ...")

---

## Example Review Comments

### Property Name Mismatch

```markdown
**Issue:** Property name mismatch

The schema defines `heroImage` but the code references `heroImageUrl`.

**Suggestion:**
```typescript
- if (segment.heroImageUrl) {
-   images.push({ url: segment.heroImageUrl });
+ if (segment.heroImage) {
+   images.push({ url: segment.heroImage });
```

**Why:** Must match schema exactly (no inheritance or computed properties)
```

### Type Assertion Without Justification

```markdown
**Issue:** Type assertion without explanation

Using `as Type` bypasses TypeScript type safety. This should use a type guard instead.

**Suggestion:**
```typescript
// Before
const status = booking.status.toLowerCase() as keyof typeof statuses;

// After
const normalizedStatus = booking.status.toLowerCase();
if (normalizedStatus in statuses) {
  const status = normalizedStatus as keyof typeof statuses;
  // Now safe to use
}
```

**Why:** Type guards provide runtime safety and prevent runtime errors
```

### Missing Environment Variable Validation

```markdown
**Issue:** Missing ADMIN_EMAIL validation

The seed uses `process.env.ADMIN_EMAIL` but doesn't validate it:
- May be undefined
- May be invalid format
- Error message is unclear

**Suggestion:**
```typescript
const adminEmail = process.env.ADMIN_EMAIL;

// Add validation
if (!adminEmail) {
  throw new Error(
    'ADMIN_EMAIL environment variable required for platform seed. ' +
    'Set it to the admin email address (e.g., support@mais.com)'
  );
}

if (!adminEmail.includes('@')) {
  throw new Error(`Invalid ADMIN_EMAIL format: "${adminEmail}". Must be valid email.`);
}
```

**Why:** Clear error messages help developers fix configuration faster
```

### Seed Not Documented

```markdown
**Issue:** Seed file missing documentation

The seed file should document:
1. When to use it
2. Required environment variables
3. What data it creates

**Suggestion:**
Add header comment:
```typescript
/**
 * Platform seed - Creates platform admin user only
 *
 * Use for: Production, staging
 * Requires: ADMIN_EMAIL, ADMIN_DEFAULT_PASSWORD
 *
 * Environment Variables:
 *   ADMIN_EMAIL: Platform admin email (e.g., support@mais.com)
 *   ADMIN_DEFAULT_PASSWORD: Initial password, min 12 chars
 */
```

**Why:** Helps other developers understand seed purpose and requirements
```

---

## Quick Command Reference for Reviews

```bash
# Check TypeScript compilation
npm run typecheck

# Check for unused parameters
npm run lint

# See all property references for a field
rg "propertyName" server/ packages/

# Find type assertions in diffs
git diff | grep "as "

# Check migration exists
ls -la server/prisma/migrations | tail -1

# Verify Prisma types generated
git diff --name-only | grep "generated/prisma"

# Search for console.log in seeds
rg "console\.log" server/prisma/seeds/

# Check .env.example updated
git diff .env.example
```

---

## Reviewer Workflow

1. **Check for schema changes**
   - If yes, verify migration created and types regenerated

2. **Check for seed changes**
   - If yes, verify env vars documented and validated

3. **Run the checklist**
   - Go through each item systematically
   - Take notes on any issues found

4. **Request changes or approve**
   - If issues found: Request specific changes with comments
   - If no issues: Approve with comment (e.g., "Looks good! Checking all boxes.")

5. **Follow up**
   - Verify fixes when author pushes changes
   - Approve when all items resolved

