# TypeScript Build Errors & Seed Configuration Drift Prevention

**Document:** TypeScript Build Errors & Seed Configuration Drift Prevention
**Created:** 2025-12-27
**Status:** Active Prevention Strategy
**Severity:** Critical (blocks deployment)

---

## Executive Summary

This document prevents two recurring issues:

1. **TypeScript Build Errors from Property/Type Mismatches**
   - Property name drift (e.g., `heroImageUrl` vs `heroImage`)
   - Type comparison mismatches (e.g., `depositPaid` vs `DEPOSIT_PAID`)
   - Unused parameter naming (e.g., `_tenantId` referenced but unused)
   - Type assertions for stub objects

2. **Seed File Configuration Drift**
   - Admin email mismatches between seed file and `.env` variables
   - Required manual database updates + code updates
   - Inconsistent seed mode handling

Both issues share a root cause: **disconnected sources of truth** (schema changes, type definitions, seed files, environment variables).

---

## Problem Analysis

### Issue #1: TypeScript Build Errors (Commit 1c9972f)

**Recent Failures:**

```typescript
// BEFORE: Property name mismatch
if (segment.heroImageUrl) {
  // ❌ Property doesn't exist
  images.push({ url: segment.heroImageUrl });
}

// AFTER: Property name matches schema
if (segment.heroImage) {
  // ✅ Correct property name
  images.push({ url: segment.heroImage });
}
```

**Root Cause:** Schema change (`heroImage`) not synchronized with all code references.

```typescript
// BEFORE: Type comparison mismatch
const statusKey = booking.status.toLowerCase().replace('_', '') as keyof typeof bookingsByStatus;
if (statusKey === 'depositpaid') {
  // ❌ Type assertion bypass
  bookingsByStatus.depositPaid++;
} else if (bookingsByStatus[statusKey] !== undefined) {
  // ❌ Runtime error if statusKey invalid
  bookingsByStatus[statusKey]++;
}

// AFTER: Proper type-safe comparison
const normalizedStatus = booking.status.toLowerCase().replace('_', '');
if (normalizedStatus === 'depositpaid') {
  // ✅ Safe string comparison
  bookingsByStatus.depositPaid++;
} else if (normalizedStatus in bookingsByStatus) {
  // ✅ Type guard before cast
  const statusKey = normalizedStatus as keyof typeof bookingsByStatus;
  bookingsByStatus[statusKey]++;
}
```

**Root Cause:** Type assertion used to bypass safety checks instead of proper type narrowing.

```typescript
// BEFORE: Unused parameter reference
async findBookingsNeedingReminders(tenantId: string): Promise<Booking[]> {
  // ... logic ...
  logger.debug({ tenantId, count: result.length }); // ❌ Uses tenantId but parameter named _tenantId
}

// AFTER: Parameter name matches usage
async findBookingsNeedingReminders(_tenantId: string): Promise<Booking[]> {
  // ... logic ...
  logger.debug({ tenantId: _tenantId, count: result.length }); // ✅ Consistent naming
}
```

**Root Cause:** Refactoring renamed parameter without updating all references.

### Issue #2: Seed Configuration Drift

**Scenario:** Platform seed expects `ADMIN_EMAIL` environment variable, but actual admin user created with different email.

```typescript
// seed.ts
const adminEmail = process.env.ADMIN_EMAIL;  // e.g., 'admin@mais.local'
const admin = await tx.user.create({
  data: { email: adminEmail, ... }
});

// .env or CI environment
ADMIN_EMAIL=support@mais.com  // Different from above!

// Result: Email verification, password reset, and auth flows fail
```

**Root Cause:** Environment variable naming mismatch + no validation that seed matches actual database state.

---

## Prevention Strategies

### Strategy 1: Automated Schema Validation

**Goal:** Catch property name mismatches immediately when schema changes.

#### 1.1 TypeScript Strict Configuration (Already Enabled)

File: `/Users/mikeyoung/CODING/MAIS/server/tsconfig.json`

```json
{
  "compilerOptions": {
    "strict": true,
    "noImplicitAny": true,
    "strictNullChecks": true,
    "strictFunctionTypes": true,
    "strictBindCallApply": true,
    "strictPropertyInitialization": true,
    "noImplicitThis": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "noImplicitReturns": true
  }
}
```

**How it helps:**

- `noUnusedParameters: true` catches `_tenantId` used when renamed
- `strictNullChecks: true` requires explicit null checking
- `noImplicitAny: true` prevents type assertion bypasses

#### 1.2 Generate Types From Schema (Prisma)

Every time schema changes, regenerate types:

```bash
cd server
npm exec prisma generate  # Regenerates Prisma Client types
```

**Add to pre-commit hook:** Automatically regenerate after schema edits.

#### 1.3 Full-Page TypeScript Compilation Check

Run before every commit:

```bash
npm run typecheck  # Root command runs across all workspaces
```

**Output shows:**

- Property mismatches
- Type assertion issues
- Unused parameters
- Missing type definitions

### Strategy 2: Code Review Checklist for Schema Changes

**When reviewing PRs that modify database schema:**

```markdown
## Schema Changes Code Review Checklist

- [ ] Schema change documented in commit message
- [ ] Prisma migration created (`prisma migrate dev --name description`)
- [ ] Prisma Client regenerated (`prisma generate`)
- [ ] All property references updated:
  - [ ] Service methods (\*.service.ts)
  - [ ] Route handlers (\*.routes.ts)
  - [ ] Repository implementations (\*.repository.ts)
  - [ ] Type contracts (packages/contracts/\*)
- [ ] Type assertions checked:
  - [ ] No new `as any` or `as Type` without justification
  - [ ] Type narrowing used instead of assertions
- [ ] Tests updated:
  - [ ] Mock adapters reflect schema changes
  - [ ] Unit tests use correct property names
  - [ ] Integration tests run successfully
- [ ] Full typecheck passes: `npm run typecheck`
- [ ] Build passes: `npm run build`
```

**Red flags to investigate:**

- Multiple `as any` in same file (often indicates type mismatch)
- Property name prefixed with `is`, `has`, `get` but schema field doesn't match
- Status/enum comparisons using string literals instead of type-safe enums
- Logic that modifies object properties by key without type guards

### Strategy 3: Runtime Property Validation

**Goal:** Catch property mismatches at runtime in development.

#### 3.1 Validation Wrapper for Service Methods

```typescript
// In service that accesses model properties
import { logger } from '@/lib/core/logger';

export class SegmentService {
  async getSegments(tenantId: string): Promise<Segment[]> {
    const segments = await this.segmentRepo.findAll(tenantId);

    // Development-only validation
    if (process.env.NODE_ENV !== 'production') {
      segments.forEach((segment) => {
        // Validate expected properties exist
        if (!('heroImage' in segment)) {
          logger.warn({ segment }, 'Segment missing heroImage property - schema mismatch detected');
        }
      });
    }

    return segments;
  }
}
```

#### 3.2 Enum Type Guards for Status Comparisons

**Never use string literals for enum comparisons.**

```typescript
// ❌ WRONG: String literal comparison
if (booking.status === 'depositpaid') {
}

// ✅ CORRECT: Type-safe enum comparison
if (booking.status === BookingStatus.DEPOSIT_PAID) {
}

// ✅ ALSO CORRECT: Normalized string with type guard
const normalizedStatus = booking.status.toLowerCase().replace('_', '');
if (normalizedStatus === 'depositpaid' && normalizedStatus in expectedStatuses) {
  // Now safe to use as type
}
```

**Define enum for reference:**

```typescript
// In server/src/lib/entities.ts
export enum BookingStatus {
  PENDING = 'PENDING',
  DEPOSIT_PAID = 'DEPOSIT_PAID',
  PAID = 'PAID',
  CONFIRMED = 'CONFIRMED',
  CANCELED = 'CANCELED',
  REFUNDED = 'REFUNDED',
  FULFILLED = 'FULFILLED',
}
```

---

## Strategy 4: Seed Configuration Validation

**Goal:** Ensure seed files match environment variables and database state.

### 4.1 Environment Variable Validation

**File:** `server/prisma/seeds/platform.ts`

```typescript
const adminEmail = process.env.ADMIN_EMAIL;
const adminPassword = process.env.ADMIN_DEFAULT_PASSWORD;
const adminName = process.env.ADMIN_NAME || 'Platform Admin';

// Existing validation - good!
if (!adminEmail) {
  throw new Error(
    'ADMIN_EMAIL environment variable is required for platform seed.\n' +
      'Set it to the platform admin email address.'
  );
}

if (!adminPassword || adminPassword.length < 12) {
  throw new Error('ADMIN_DEFAULT_PASSWORD must be at least 12 characters');
}

// ADD: Validate email format
if (!adminEmail.includes('@')) {
  throw new Error(`Invalid ADMIN_EMAIL format: "${adminEmail}". Must be a valid email address.`);
}

// ADD: Normalize to lowercase (email is case-insensitive)
const normalizedEmail = adminEmail.toLowerCase();
```

### 4.2 Seed Output Validation

**After seed completes, verify expected state:**

```typescript
async function seedPlatform(prisma: PrismaClient): Promise<void> {
  const adminEmail = process.env.ADMIN_EMAIL?.toLowerCase();

  // ... existing seed logic ...

  // ADD: Post-seed verification
  const verifyAdmin = await prisma.user.findUnique({
    where: { email: adminEmail },
  });

  if (!verifyAdmin || verifyAdmin.role !== 'PLATFORM_ADMIN') {
    throw new Error(`Seed verification failed: Admin user not created correctly at ${adminEmail}`);
  }

  logger.info({ email: adminEmail, role: verifyAdmin.role }, 'Seed verification successful');
}
```

### 4.3 Seed File Documentation

**Add comments linking seed file to required environment variables:**

```typescript
/**
 * Platform seed - Creates platform admin user only
 *
 * Use for: Production, staging
 * Requires: ADMIN_EMAIL and ADMIN_DEFAULT_PASSWORD environment variables
 *
 * Environment Variables:
 *   ADMIN_EMAIL: Platform admin email address (e.g., support@mais.com)
 *                Required for: Creating/updating platform admin user
 *                Validation: Must be valid email format
 *                Normalization: Automatically lowercased for consistency
 *
 *   ADMIN_DEFAULT_PASSWORD: Initial admin password (min 12 chars)
 *                          Required for: Creating new admin user
 *                          Validation: >= 12 characters, OWASP 2023 standard
 *                          Security: Bcrypted with 12 rounds before storage
 *
 *   ADMIN_NAME: Display name for admin user (optional)
 *              Default: "Platform Admin"
 *              Used in: Admin dashboard, email notifications
 *
 * Example:
 *   export ADMIN_EMAIL=support@mais.com
 *   export ADMIN_DEFAULT_PASSWORD=$(openssl rand -base64 32)
 *   npm exec prisma db seed
 */
```

### 4.4 Seed Mode Validation

**File:** `server/prisma/seed.ts`

```typescript
function getSeedMode(): SeedMode {
  const explicitMode = process.env.SEED_MODE as SeedMode | undefined;

  // Validate mode is in allowed list
  const validModes: readonly SeedMode[] = [
    'production',
    'e2e',
    'demo',
    'dev',
    'all',
    'la-petit-mariage',
    'little-bit-farm',
    'plate',
    'mais',
    'upgrade-tenant-pages',
  ];

  if (explicitMode && !validModes.includes(explicitMode)) {
    throw new Error(
      `Invalid SEED_MODE: "${explicitMode}"\n` + `Valid modes: ${validModes.join(', ')}`
    );
  }

  // ... existing logic ...
}
```

---

## Strategy 5: Pre-Commit Hooks

**Goal:** Catch errors before they reach git history.

### 5.1 Husky + Lint-Staged Configuration

**File:** `package.json` (root)

```json
{
  "husky": {
    "hooks": {
      "pre-commit": "lint-staged"
    }
  },
  "lint-staged": {
    "server/prisma/schema.prisma": [
      "npm exec prisma generate",
      "git add server/src/generated/prisma"
    ],
    "server/**/*.ts": ["npm run lint --workspace=server", "npm run typecheck --workspace=server"],
    "server/prisma/seeds/**/*.ts": [
      "npm run lint --workspace=server",
      "npm run typecheck --workspace=server"
    ]
  }
}
```

### 5.2 Schema Change Hook

**File:** `.husky/pre-commit`

```bash
#!/bin/sh

# Detect schema.prisma changes
if git diff --cached server/prisma/schema.prisma > /dev/null; then
  echo "Schema changes detected. Regenerating Prisma Client..."
  cd server && npm exec prisma generate
  git add src/generated/prisma
fi

# Run typecheck for TypeScript files
echo "Running typecheck..."
npm run typecheck

if [ $? -ne 0 ]; then
  echo "TypeScript errors detected. Fix and re-commit."
  exit 1
fi

exit 0
```

---

## Strategy 6: CI/CD Validation

**Goal:** Prevent broken code from reaching main branch.

### 6.1 GitHub Actions Workflow

**File:** `.github/workflows/validate.yml`

```yaml
name: TypeScript & Schema Validation

on: [pull_request]

jobs:
  validate:
    runs-on: ubuntu-latest

    steps:
      - uses: actions/checkout@v3

      - uses: actions/setup-node@v3
        with:
          node-version: '18'
          cache: 'npm'

      - name: Install dependencies
        run: npm ci

      - name: Check schema consistency
        run: |
          cd server
          npm exec prisma generate
          git diff --exit-code src/generated/prisma || {
            echo "Schema mismatch: Prisma types out of sync"
            echo "Run: npm exec prisma generate"
            exit 1
          }

      - name: TypeScript check
        run: npm run typecheck

      - name: Lint
        run: npm run lint

      - name: Build
        run: npm run build

      - name: Seed validation
        run: |
          # Verify seed files have required documentation
          grep -q "ADMIN_EMAIL" server/prisma/seeds/platform.ts || {
            echo "platform.ts missing ADMIN_EMAIL documentation"
            exit 1
          }
          npm run lint server/prisma/seeds
```

### 6.2 Environment Variable Documentation Check

**File:** `.github/workflows/env-validation.yml`

```yaml
name: Environment Variables Check

on: [pull_request]

jobs:
  env-check:
    runs-on: ubuntu-latest

    steps:
      - uses: actions/checkout@v3

      - name: Check .env.example exists
        run: |
          test -f .env.example || {
            echo "Missing .env.example"
            exit 1
          }

      - name: Verify seed file env vars match docs
        run: |
          cd server
          # Extract env vars required by seeds
          grep -h "process.env\." prisma/seeds/*.ts | \
            sed 's/.*process\.env\.\([A-Z_]*\).*/\1/' | \
            sort -u > /tmp/required_vars.txt

          # Check they're documented in README or seed files
          while read var; do
            if ! grep -q "$var" README.md prisma/seeds/*.ts 2>/dev/null; then
              echo "Environment variable $var used but not documented"
              exit 1
            fi
          done < /tmp/required_vars.txt
```

---

## Strategy 7: Testing Strategy

### 7.1 Unit Tests for Seed Configuration

**File:** `server/test/seeds/platform-seed.test.ts`

```typescript
import { seedPlatform } from '../../prisma/seeds/platform';

describe('Platform Seed', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  describe('Environment Variable Validation', () => {
    it('throws error if ADMIN_EMAIL not set', async () => {
      delete process.env.ADMIN_EMAIL;

      await expect(seedPlatform(prisma)).rejects.toThrow(
        'ADMIN_EMAIL environment variable is required'
      );
    });

    it('throws error if ADMIN_DEFAULT_PASSWORD not set', async () => {
      process.env.ADMIN_EMAIL = 'admin@test.com';
      delete process.env.ADMIN_DEFAULT_PASSWORD;

      await expect(seedPlatform(prisma)).rejects.toThrow(
        'ADMIN_DEFAULT_PASSWORD environment variable is required'
      );
    });

    it('throws error if password < 12 characters', async () => {
      process.env.ADMIN_EMAIL = 'admin@test.com';
      process.env.ADMIN_DEFAULT_PASSWORD = 'short';

      await expect(seedPlatform(prisma)).rejects.toThrow('must be at least 12 characters');
    });

    it('normalizes email to lowercase', async () => {
      process.env.ADMIN_EMAIL = 'ADMIN@TEST.COM';
      process.env.ADMIN_DEFAULT_PASSWORD = 'ValidPassword123!@#';

      await seedPlatform(prisma);

      const user = await prisma.user.findUnique({
        where: { email: 'admin@test.com' }, // ✅ Lowercase
      });

      expect(user?.email).toBe('admin@test.com');
    });
  });

  describe('Seed Verification', () => {
    it('verifies admin user created with correct role', async () => {
      process.env.ADMIN_EMAIL = 'admin@test.com';
      process.env.ADMIN_DEFAULT_PASSWORD = 'ValidPassword123!@#';
      process.env.ADMIN_NAME = 'Test Admin';

      await seedPlatform(prisma);

      const user = await prisma.user.findUnique({
        where: { email: 'admin@test.com' },
      });

      expect(user).toBeDefined();
      expect(user?.role).toBe('PLATFORM_ADMIN');
      expect(user?.name).toBe('Test Admin');
    });
  });
});
```

### 7.2 Property Name Tests

**File:** `server/test/services/segment.service.test.ts`

```typescript
describe('SegmentService', () => {
  it('accesses heroImage property correctly', async () => {
    const segment = await segmentService.getSegmentBySlug(tenantId, 'wellness-retreat');

    // ✅ Property name matches schema
    if (segment.heroImage) {
      expect(segment.heroImage).toMatch(/^https?:\/\//);
    }

    // ❌ This would fail in strict TypeScript
    // expect(segment.heroImageUrl).toBeDefined();
  });
});
```

---

## Quick Reference Checklist

### Before Making Schema Changes

- [ ] Document the property name change in commit message
- [ ] Update all references across:
  - [ ] Service methods
  - [ ] Route handlers
  - [ ] Repository implementations
  - [ ] API contracts
  - [ ] Tests
- [ ] Run `npm exec prisma generate` after schema edit
- [ ] Run `npm run typecheck` to catch mismatches
- [ ] Run `npm run lint` to catch unused parameters
- [ ] Update `.env.example` if adding new configuration

### Before Adding Environment Variables to Seeds

- [ ] Add validation to seed file (non-empty, correct format)
- [ ] Document in seed file header comments
- [ ] Update `.env.example` with example value
- [ ] Add test case for missing/invalid variable
- [ ] Add CI/CD check to verify env var usage

### Before Committing

- [ ] TypeScript strict mode passes: `npm run typecheck`
- [ ] Lint passes: `npm run lint`
- [ ] Build passes: `npm run build`
- [ ] Schema consistency verified: `npm exec prisma generate && git diff --exit-code`
- [ ] Tests pass: `npm test`

### Code Review Red Flags

When reviewing PRs, watch for:

- [ ] Direct string literals in enum comparisons (use `as const` instead)
- [ ] Type assertions (`as Type`) without explanation comment
- [ ] Properties accessed that don't exist in schema
- [ ] Seed files without environment variable documentation
- [ ] Changed schema properties not reflected in tests
- [ ] Unused parameters (lint should catch, but double-check)

---

## Related Documentation

- **SCHEMA_DRIFT_PREVENTION.md** - Schema change procedures
- **PREVENTION-STRATEGIES-INDEX.md** - Full index of prevention strategies
- **QUALITY-GATES-IMPLEMENTATION.md** - CI/CD quality gates
- **PRISMA-TYPESCRIPT-BUILD-PREVENTION.md** - TypeScript + Prisma patterns

---

## Examples from MAIS Codebase

### Example 1: Property Name Mismatch (Fixed)

**File:** `/Users/mikeyoung/CODING/MAIS/server/src/routes/tenant-admin.routes.ts`

```typescript
// BEFORE (Commit 1c9972f parent)
const segments = await segmentService.getSegments(tenantId);
for (const segment of segments) {
  if (segment.heroImageUrl) {
    // ❌ Property doesn't exist
    images.push({
      url: segment.heroImageUrl, // ❌ References non-existent property
    });
  }
}

// AFTER (Commit 1c9972f)
const segments = await segmentService.getSegments(tenantId);
for (const segment of segments) {
  if (segment.heroImage) {
    // ✅ Correct property name
    images.push({
      url: segment.heroImage, // ✅ Matches schema
    });
  }
}
```

**Schema Definition:**

```prisma
model Segment {
  // ...
  heroImage String?  // ✅ Property name in schema
}
```

### Example 2: Type Comparison Mismatch (Fixed)

**File:** `/Users/mikeyoung/CODING/MAIS/server/src/routes/tenant-admin.routes.ts` (dashboard endpoint)

```typescript
// BEFORE: Unsafe type assertion + comparison
const statusKey = booking.status.toLowerCase().replace('_', '') as keyof typeof bookingsByStatus;
if (statusKey === 'depositpaid') {
  bookingsByStatus.depositPaid++;
} else if (bookingsByStatus[statusKey] !== undefined) {
  // ❌ Might be undefined
  bookingsByStatus[statusKey]++;
}

// AFTER: Type-safe comparison with type guard
const normalizedStatus = booking.status.toLowerCase().replace('_', '');
if (normalizedStatus === 'depositpaid') {
  bookingsByStatus.depositPaid++;
} else if (normalizedStatus in bookingsByStatus) {
  // ✅ Type guard before casting
  const statusKey = normalizedStatus as keyof typeof bookingsByStatus;
  bookingsByStatus[statusKey]++;
}
```

### Example 3: Unused Parameter (Fixed)

**File:** `/Users/mikeyoung/CODING/MAIS/server/src/adapters/mock/index.ts`

```typescript
// BEFORE: Parameter named _tenantId but actually used as tenantId
async findBookingsNeedingReminders(_tenantId: string): Promise<Booking[]> {
  // ...
  logger.debug({ tenantId, count: result.length }, 'findBookingsNeedingReminders called');  // ❌ Using undefined tenantId
}

// AFTER: Parameter reference matches name
async findBookingsNeedingReminders(_tenantId: string): Promise<Booking[]> {
  // ...
  logger.debug({ tenantId: _tenantId, count: result.length }, 'findBookingsNeedingReminders called');  // ✅ References parameter
}
```

---

## Implementation Priority

| Priority | Action                                       | Effort | Impact |
| -------- | -------------------------------------------- | ------ | ------ |
| P0       | Enable TypeScript strict mode (already done) | 0      | High   |
| P0       | Add pre-commit hook for `prisma generate`    | Low    | High   |
| P0       | Add seed environment variable validation     | Low    | High   |
| P1       | Add CI/CD schema consistency check           | Medium | High   |
| P1       | Add seed configuration unit tests            | Medium | Medium |
| P2       | Add runtime property validation              | Low    | Low    |
| P2       | Create code review checklist                 | Low    | Medium |

---

## Testing Validation

Run this before committing to verify prevention strategy:

```bash
# 1. TypeScript check
npm run typecheck

# 2. Lint check (catches unused parameters)
npm run lint

# 3. Schema generation (detect drift)
cd server && npm exec prisma generate && git diff --exit-code src/generated/prisma

# 4. Seed validation (with test env vars)
export ADMIN_EMAIL=test@test.com
export ADMIN_DEFAULT_PASSWORD=TestPassword123!@#
cd server && npm exec prisma db seed

# 5. Full test suite
npm test

# 6. Build
npm run build
```

**Expected output:** All commands succeed with no errors.
