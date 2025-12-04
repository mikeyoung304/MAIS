# Authentication Issues Prevention Strategies

## Overview

This document outlines prevention strategies for three critical authentication issues that were discovered and fixed:

1. **Password hash not matching seeded credentials** - Mismatch between seed password and authentication attempt
2. **Case-sensitive email lookups causing tenant login failures** - Email normalization not enforced consistently
3. **Hardcoded demo credentials that don't exist** - Stale demo credentials without sync mechanism

---

## Issue 1: Password Hash Synchronization

### The Problem

The seed script hashed the password `@Nupples8` but authentication attempts were failing because:

- The seed password was hardcoded in `seed.ts`
- Manual changes to seed passwords weren't reflected in test code
- No single source of truth for development credentials
- Different teams might use different demo passwords

### Prevention Strategy: Centralized Credential Management

#### 1.1 Create a Development Credentials Configuration File

**File:** `server/config/dev-credentials.ts`

```typescript
/**
 * Development/Test Credentials Configuration
 * IMPORTANT: This file is for DEVELOPMENT only
 * DO NOT commit actual user passwords
 * DO NOT use in production
 */

export const DEV_CREDENTIALS = {
  platformAdmin: {
    email: 'mike@maconheadshots.com',
    password: '@Nupples8',
    name: 'Mike Young',
    description: 'Platform admin for local development',
  },
  testTenant: {
    email: 'test@mais-e2e.com',
    password: 'TestPassword123!',
    slug: 'mais-e2e',
    name: 'MAIS E2E Test Tenant',
    description: 'Automated test tenant for E2E testing',
  },
  // Add more development users as needed
} as const;

// Type-safe access to credential constants
export type DevCredentialKey = keyof typeof DEV_CREDENTIALS;

// Validation function
export function validateDevCredentials() {
  Object.entries(DEV_CREDENTIALS).forEach(([key, cred]) => {
    if (!cred.email || !cred.password) {
      throw new Error(`Invalid dev credentials for ${key}: missing email or password`);
    }
    if (cred.password.length < 8) {
      throw new Error(`Password for ${key} must be at least 8 characters`);
    }
  });
}
```

#### 1.2 Update Seed Script to Use Configuration

**File:** `server/prisma/seed.ts` (modified)

```typescript
import bcrypt from 'bcryptjs';
import { DEV_CREDENTIALS, validateDevCredentials } from '../config/dev-credentials';

const BCRYPT_ROUNDS = 12;

async function main() {
  // Validate dev credentials before proceeding
  validateDevCredentials();

  // Create admin user from centralized config
  const adminCred = DEV_CREDENTIALS.platformAdmin;
  const adminHash = await bcrypt.hash(adminCred.password, BCRYPT_ROUNDS);

  await prisma.user.upsert({
    where: { email: adminCred.email },
    update: { passwordHash: adminHash, role: 'PLATFORM_ADMIN' },
    create: {
      email: adminCred.email,
      name: adminCred.name,
      role: 'PLATFORM_ADMIN',
      passwordHash: adminHash,
    },
  });

  // Create test tenant from centralized config
  const tenantCred = DEV_CREDENTIALS.testTenant;
  const tenantHash = await bcrypt.hash(tenantCred.password, BCRYPT_ROUNDS);

  const tenant = await prisma.tenant.upsert({
    where: { slug: tenantCred.slug },
    update: {
      passwordHash: tenantHash,
      email: tenantCred.email,
      // ... other fields
    },
    create: {
      slug: tenantCred.slug,
      name: tenantCred.name,
      email: tenantCred.email,
      passwordHash: tenantHash,
      // ... other fields
    },
  });
}
```

#### 1.3 Update Tests to Use Configuration

**File:** `server/test/helpers/dev-credentials.ts`

```typescript
import { DEV_CREDENTIALS } from '../../config/dev-credentials';

/**
 * Test helper: Use centralized dev credentials
 * Ensures tests always use the same credentials as seed data
 */
export function getPlatformAdminCredentials() {
  return DEV_CREDENTIALS.platformAdmin;
}

export function getTestTenantCredentials() {
  return DEV_CREDENTIALS.testTenant;
}

export async function loginWithDevCredentials(
  request: any,
  credentialKey: 'platformAdmin' | 'testTenant'
) {
  const cred = DEV_CREDENTIALS[credentialKey];
  return request
    .post('/v1/auth/login')
    .send({ email: cred.email, password: cred.password })
    .expect(200);
}
```

#### 1.4 Documentation

Create a `.env.example` with credential guidelines:

```bash
# Development Credentials
# For local development, use the credentials defined in config/dev-credentials.ts
# DO NOT modify the seed password without updating dev-credentials.ts
# DO NOT commit actual production passwords

# The actual credentials are centralized in:
# server/config/dev-credentials.ts
```

### Best Practices Checklist

- [ ] **Single Source of Truth**: All dev credentials defined in `config/dev-credentials.ts`
- [ ] **Validation**: Run `validateDevCredentials()` before seeding
- [ ] **Test Alignment**: Tests import from the same config file
- [ ] **Documentation**: `.env.example` directs developers to the config file
- [ ] **Environment Separation**: Dev credentials never mixed with production secrets
- [ ] **Type Safety**: Use TypeScript types to prevent credential typos
- [ ] **Code Review**: Changes to dev credentials require review (affects all tests)

---

## Issue 2: Case-Insensitive Email Handling

### The Problem

Email lookups were case-sensitive at the database level:

- User logged in with `Mike@Example.com` but tenant created with `mike@example.com`
- Database query `WHERE email = 'Mike@Example.com'` found nothing
- Authentication failed despite correct password

### Prevention Strategy: Enforce Email Normalization at Multiple Layers

#### 2.1 Prisma Schema Constraints

**File:** `server/prisma/schema.prisma` (verified)

Current implementation has email marked as `@unique` but NOT enforced as lowercase:

```prisma
model Tenant {
  // CURRENT (has case sensitivity issue):
  email String? @unique

  // BEST PRACTICE (add comment documenting normalization requirement):
  email String? @unique // MUST be stored in lowercase - see tenant.repository.ts
}
```

#### 2.2 Repository Layer: Enforce Lowercase on All Operations

**File:** `server/src/adapters/prisma/tenant.repository.ts` (verified correct)

```typescript
export class PrismaTenantRepository {
  /**
   * Find tenant by email
   * CRITICAL: Email must be normalized to lowercase before lookup
   * This prevents case-sensitive lookup failures
   *
   * @param email - Tenant admin email (will be normalized to lowercase)
   * @returns Tenant or null if not found
   */
  async findByEmail(email: string): Promise<Tenant | null> {
    // Always normalize to lowercase - prevents case sensitivity issues
    return await this.prisma.tenant.findUnique({
      where: { email: email.toLowerCase() },
    });
  }

  /**
   * Create new tenant with email
   * CRITICAL: Email is normalized to lowercase before storage
   */
  async create(data: CreateTenantInput): Promise<Tenant> {
    return await this.prisma.tenant.create({
      data: {
        // ... other fields
        email: data.email ? data.email.toLowerCase() : undefined,
      },
    });
  }

  /**
   * Update tenant
   * CRITICAL: Email is normalized to lowercase if provided
   */
  async update(id: string, data: UpdateTenantInput): Promise<Tenant> {
    return await this.prisma.tenant.update({
      where: { id },
      data: {
        // ... other fields
        email: data.email ? data.email.toLowerCase() : undefined,
      },
    });
  }
}
```

#### 2.3 Service Layer: Additional Normalization

**File:** `server/src/services/tenant-auth.service.ts` (verified correct)

```typescript
export class TenantAuthService {
  /**
   * Login with email normalization
   * CRITICAL: Email is normalized before lookup
   */
  async login(email: string, password: string): Promise<{ token: string }> {
    // Normalize email to lowercase at service layer
    // This provides defense-in-depth against case sensitivity
    const tenant = await this.tenantRepo.findByEmail(email.toLowerCase());

    if (!tenant) {
      throw new UnauthorizedError('Invalid credentials');
    }
    // ... password verification
  }
}
```

#### 2.4 Route Layer: Consistent Normalization

**File:** `server/src/routes/auth.routes.ts` (verified correct)

```typescript
// In signup endpoint
const normalizedEmail = email.toLowerCase().trim();

// Check uniqueness with normalized email
const existingTenant = await tenantRepo.findByEmail(normalizedEmail);
if (existingTenant) {
  throw new ConflictError('Email already registered');
}

// Store with normalized email
const tenant = await tenantRepo.create({
  // ... other fields
  email: normalizedEmail,
});
```

#### 2.5 Test Cases for Email Normalization

**File:** `server/test/integration/email-normalization.spec.ts` (NEW)

```typescript
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { PrismaTenantRepository } from '../../src/adapters/prisma/tenant.repository';
import { PrismaClient } from '../../src/generated/prisma';
import { TenantAuthService } from '../../src/services/tenant-auth.service';

describe('Email Normalization Integration Tests', () => {
  let repository: PrismaTenantRepository;
  let authService: TenantAuthService;
  let prisma: PrismaClient;
  const testEmail = 'TestUser@Example.COM';
  const normalizedEmail = 'testuser@example.com';
  let testTenantId: string;

  beforeEach(async () => {
    prisma = new PrismaClient();
    repository = new PrismaTenantRepository(prisma);
    authService = new TenantAuthService(repository, 'test-secret');
  });

  afterEach(async () => {
    // Cleanup
    if (testTenantId) {
      await prisma.tenant.delete({ where: { id: testTenantId } });
    }
    await prisma.$disconnect();
  });

  describe('Repository Layer Email Normalization', () => {
    it('should store email in lowercase', async () => {
      // This test would fail if repository doesn't normalize
      const tenant = await repository.create({
        slug: `test-${Date.now()}`,
        name: 'Test Tenant',
        email: testEmail, // UPPERCASE email
        apiKeyPublic: 'pk_live_test_0000000000000000',
        apiKeySecret: 'hashed_secret',
        commissionPercent: 10,
      });
      testTenantId = tenant.id;

      // Verify stored as lowercase
      expect(tenant.email).toBe(normalizedEmail);
    });

    it('should find tenant by email regardless of case', async () => {
      // Create tenant with lowercase email
      const created = await repository.create({
        slug: `test-${Date.now()}`,
        name: 'Test Tenant',
        email: normalizedEmail,
        apiKeyPublic: 'pk_live_test_0000000000000000',
        apiKeySecret: 'hashed_secret',
        commissionPercent: 10,
      });
      testTenantId = created.id;

      // Find with UPPERCASE email
      const found = await repository.findByEmail(testEmail);

      // Should find the tenant despite case mismatch
      expect(found).not.toBeNull();
      expect(found?.id).toBe(created.id);
      expect(found?.email).toBe(normalizedEmail);
    });

    it('should prevent duplicate emails with different cases', async () => {
      // Create tenant with lowercase email
      const tenant1 = await repository.create({
        slug: `test-1-${Date.now()}`,
        name: 'Test Tenant 1',
        email: normalizedEmail,
        apiKeyPublic: 'pk_live_test1_0000000000000000',
        apiKeySecret: 'hashed_secret1',
        commissionPercent: 10,
      });
      testTenantId = tenant1.id;

      // Attempt to create with uppercase email (should fail due to unique constraint)
      try {
        await repository.create({
          slug: `test-2-${Date.now()}`,
          name: 'Test Tenant 2',
          email: testEmail, // UPPERCASE version
          apiKeyPublic: 'pk_live_test2_0000000000000000',
          apiKeySecret: 'hashed_secret2',
          commissionPercent: 10,
        });
        expect.fail('Should have thrown unique constraint error');
      } catch (error: any) {
        // Expected: unique constraint violation
        expect(error.code).toBe('P2002');
        expect(error.meta.target).toContain('email');
      }
    });
  });

  describe('Service Layer Email Normalization', () => {
    it('should authenticate tenant with mixed-case email', async () => {
      const password = 'SecurePass123';
      const hashedPassword = await authService.hashPassword(password);

      // Create tenant with lowercase email
      const tenant = await repository.create({
        slug: `test-${Date.now()}`,
        name: 'Test Tenant',
        email: normalizedEmail,
        passwordHash: hashedPassword,
        apiKeyPublic: 'pk_live_test_0000000000000000',
        apiKeySecret: 'hashed_secret',
        commissionPercent: 10,
      });
      testTenantId = tenant.id;

      // Authenticate with mixed-case email
      const result = await authService.login(testEmail, password);

      expect(result).toHaveProperty('token');
      expect(typeof result.token).toBe('string');
    });
  });

  describe('Route Layer Email Normalization', () => {
    it('should reject duplicate signup with different case', async () => {
      // First signup with lowercase
      const res1 = await request(app)
        .post('/v1/auth/signup')
        .send({
          email: normalizedEmail,
          password: 'SecurePass123',
          businessName: 'Test Business',
        })
        .expect(201);

      testTenantId = res1.body.tenantId;

      // Second signup with uppercase (should fail)
      const res2 = await request(app)
        .post('/v1/auth/signup')
        .send({
          email: testEmail, // UPPERCASE
          password: 'DifferentPass123',
          businessName: 'Another Business',
        })
        .expect(409);

      expect(res2.body.error).toBe('CONFLICT');
      expect(res2.body.message).toContain('Email already registered');
    });
  });
});
```

### Best Practices Checklist

- [ ] **Repository Layer Normalization**: All email lookups use `.toLowerCase()`
- [ ] **Repository Layer Storage**: All email inserts/updates normalize to lowercase
- [ ] **Service Layer Defense-in-Depth**: Services also call `.toLowerCase()` on email input
- [ ] **Route Layer Consistency**: Routes normalize email before passing to repositories/services
- [ ] **Comprehensive Tests**: Test cases verify case-insensitive lookups and duplicate prevention
- [ ] **Documentation**: Code comments explain WHY normalization is critical
- [ ] **Schema Documentation**: Prisma schema includes comments about lowercase requirement
- [ ] **Trim Whitespace**: Also trim whitespace: `email.toLowerCase().trim()`

---

## Issue 3: Demo/Dev Credentials Sync

### The Problem

Hardcoded demo credentials in code weren't synchronized with seed data:

- Frontend might have `Email: demo@test.com` but seed script created `test@example.com`
- E2E tests hardcoded different credentials than signup tests
- When seed data changed, frontend autofill became invalid
- No mechanism to keep credentials synchronized across multiple files

### Prevention Strategy: Centralized Credential Distribution

#### 3.1 Create Shared Credentials Module

**File:** `server/config/dev-credentials.ts` (same as Issue 1)

Already created above - reused for this issue.

#### 3.2 Export to Frontend at Build Time

**File:** `server/scripts/generate-dev-credentials.ts` (NEW)

```typescript
/**
 * Script to generate dev credentials for frontend
 * Run during build to ensure frontend always has sync'd credentials
 */

import fs from 'node:fs';
import path from 'node:path';
import { DEV_CREDENTIALS } from '../config/dev-credentials';

const outputPath = path.join(__dirname, '../../client/src/lib/dev-credentials.ts');

const content = `// AUTO-GENERATED: Do not edit manually
// Generated by: server/scripts/generate-dev-credentials.ts
// This file is regenerated on each build to sync with server dev-credentials.ts

export const DEV_CREDENTIALS = ${JSON.stringify(DEV_CREDENTIALS, null, 2)} as const;

export type DevCredentialKey = keyof typeof DEV_CREDENTIALS;

/**
 * Get development credentials for specific user type
 * Only used in development mode (VITE_MODE=development)
 */
export function getDevCredentials(key: DevCredentialKey) {
  return DEV_CREDENTIALS[key];
}

/**
 * Check if we're in development mode
 */
export function isDevelopmentMode() {
  return import.meta.env.MODE === 'development';
}
`;

fs.writeFileSync(outputPath, content);
console.log(`✅ Generated dev credentials at ${outputPath}`);
```

#### 3.3 Update Build Scripts

**File:** `server/package.json`

```json
{
  "scripts": {
    "dev:api": "node scripts/generate-dev-credentials.ts && vite-node src/server.ts",
    "build": "npm run typecheck && node scripts/generate-dev-credentials.ts && tsc",
    "seed": "node scripts/generate-dev-credentials.ts && prisma db seed"
  }
}
```

#### 3.4 Frontend Usage Pattern

**File:** `client/src/components/LoginForm.tsx` (example usage)

```typescript
import { isDevelopmentMode, getDevCredentials } from '../lib/dev-credentials';

export function LoginForm() {
  const [email, setEmail] = React.useState('');
  const [password, setPassword] = React.useState('');

  // Auto-fill with dev credentials in development
  React.useEffect(() => {
    if (isDevelopmentMode()) {
      const devCred = getDevCredentials('platformAdmin');
      setEmail(devCred.email);
      setPassword(devCred.password);
    }
  }, []);

  // ... form rendering
}
```

#### 3.5 Environment Variable Integration

**File:** `.env.development.local` (documentation)

```bash
# Development Mode - Auto-filled Credentials
# The following credentials are auto-populated from server/config/dev-credentials.ts
#
# Platform Admin:
# Email: mike@maconheadshots.com
# Password: @Nupples8
#
# Test Tenant:
# Email: test@mais-e2e.com
# Password: TestPassword123!
#
# To change dev credentials:
# 1. Edit server/config/dev-credentials.ts
# 2. Run: npm run seed
# 3. Restart frontend (credentials auto-generated during build)
#
# DO NOT hardcode credentials anywhere else - they must come from dev-credentials.ts
```

#### 3.6 E2E Tests with Generated Credentials

**File:** `e2e/fixtures/test-data.ts` (NEW)

```typescript
/**
 * Test data fixtures auto-generated from server credentials
 * Ensures E2E tests always use correct dev credentials
 */

import type { DEV_CREDENTIALS } from '../../server/config/dev-credentials';

// Import types (credentials are generated at build time)
declare const DEV_CREDENTIALS: {
  platformAdmin: { email: string; password: string };
  testTenant: { email: string; password: string };
};

export function getPlatformAdminTestCredentials() {
  return {
    email: 'mike@maconheadshots.com', // Fallback during dev
    password: '@Nupples8',
  };
}

export function getTestTenantTestCredentials() {
  return {
    email: 'test@mais-e2e.com', // Fallback during dev
    password: 'TestPassword123!',
  };
}

/**
 * In CI/CD environment, these should be injected from environment
 */
export function getTestCredentialsFromEnv() {
  return {
    platformAdmin: {
      email: process.env.TEST_ADMIN_EMAIL || 'mike@maconheadshots.com',
      password: process.env.TEST_ADMIN_PASSWORD || '@Nupples8',
    },
    testTenant: {
      email: process.env.TEST_TENANT_EMAIL || 'test@mais-e2e.com',
      password: process.env.TEST_TENANT_PASSWORD || 'TestPassword123!',
    },
  };
}
```

#### 3.7 CI/CD Credential Injection

**File:** `.github/workflows/test.yml` (example)

```yaml
name: Test

on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3

      - name: Setup Node
        uses: actions/setup-node@v3
        with:
          node-version: '18'

      - name: Install dependencies
        run: npm ci

      - name: Seed test database
        env:
          DATABASE_URL: ${{ secrets.TEST_DATABASE_URL }}
          ADMIN_DEFAULT_PASSWORD: ${{ secrets.TEST_ADMIN_PASSWORD }}
        run: npm run seed

      - name: Run E2E tests
        env:
          TEST_ADMIN_EMAIL: ${{ secrets.TEST_ADMIN_EMAIL }}
          TEST_ADMIN_PASSWORD: ${{ secrets.TEST_ADMIN_PASSWORD }}
          TEST_TENANT_EMAIL: ${{ secrets.TEST_TENANT_EMAIL }}
          TEST_TENANT_PASSWORD: ${{ secrets.TEST_TENANT_PASSWORD }}
        run: npm run test:e2e
```

### Best Practices Checklist

- [ ] **Single Source of Truth**: Credentials in `config/dev-credentials.ts` only
- [ ] **Auto-Generation**: Build script generates client credentials from server
- [ ] **Sync Verification**: Tests verify generated credentials match seed data
- [ ] **Environment Separation**: Dev credentials isolated from production secrets
- [ ] **CI/CD Integration**: Environment variables used for test credentials in CI
- [ ] **Documentation**: `.env.example` explains how credentials are managed
- [ ] **Fallback Pattern**: Frontend has sensible fallbacks if generation fails
- [ ] **Type Safety**: TypeScript enforces correct credential usage
- [ ] **No Hardcoding**: No credentials hardcoded in frontend code

---

## Testing Strategy

### Unit Tests for Credential Management

```typescript
// test/services/credential-validation.spec.ts

import { describe, it, expect } from 'vitest';
import { DEV_CREDENTIALS, validateDevCredentials } from '../../config/dev-credentials';

describe('Dev Credentials Validation', () => {
  it('should have valid email format for all credentials', () => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

    Object.entries(DEV_CREDENTIALS).forEach(([key, cred]) => {
      expect(emailRegex.test(cred.email)).toBe(true, `Invalid email for ${key}`);
    });
  });

  it('should have passwords meeting minimum security requirements', () => {
    Object.entries(DEV_CREDENTIALS).forEach(([key, cred]) => {
      expect(cred.password.length).toBeGreaterThanOrEqual(8);
      // Could add more password requirements
    });
  });

  it('should validate all credentials without throwing', () => {
    expect(() => validateDevCredentials()).not.toThrow();
  });
});
```

### Integration Tests for Sync

```typescript
// test/integration/dev-credentials-sync.spec.ts

describe('Dev Credentials Sync', () => {
  it('should seed data with correct credentials from config', async () => {
    const adminCred = DEV_CREDENTIALS.platformAdmin;

    // Attempt login with seeded credentials
    const response = await request(app)
      .post('/v1/auth/login')
      .send({
        email: adminCred.email,
        password: adminCred.password,
      })
      .expect(200);

    expect(response.body).toHaveProperty('token');
  });

  it('should have test tenant available with correct credentials', async () => {
    const tenantCred = DEV_CREDENTIALS.testTenant;

    const response = await request(app)
      .post('/v1/auth/login')
      .send({
        email: tenantCred.email,
        password: tenantCred.password,
      })
      .expect(200);

    expect(response.body.tenantId).toBeDefined();
    expect(response.body.role).toBe('TENANT_ADMIN');
  });
});
```

---

## Comprehensive Prevention Checklist

### Password Hash Synchronization

- [ ] Centralized credentials in `config/dev-credentials.ts`
- [ ] Seed script imports from configuration
- [ ] All tests import from same configuration
- [ ] Pre-seed validation (`validateDevCredentials()`)
- [ ] Type-safe credential access
- [ ] Documentation in `.env.example`
- [ ] CI/CD uses environment variables
- [ ] Unit test: credential format validation
- [ ] Integration test: login with seeded credentials

### Case-Insensitive Email Handling

- [ ] Repository layer: All queries use `.toLowerCase()`
- [ ] Repository layer: All inserts/updates normalize to lowercase
- [ ] Service layer: Additional `.toLowerCase()` call
- [ ] Route layer: Consistent normalization before storage
- [ ] Whitespace trimming: `.toLowerCase().trim()`
- [ ] Prisma schema: Comments document lowercase requirement
- [ ] Test case: Uppercase login succeeds
- [ ] Test case: Case-insensitive duplicate prevention
- [ ] Test case: Mixed case email retrieval
- [ ] Integration test: End-to-end case normalization

### Demo/Dev Credentials Sync

- [ ] Single credentials file: `config/dev-credentials.ts`
- [ ] Build script generates frontend credentials
- [ ] Frontend autofill uses generated credentials
- [ ] E2E tests import from centralized location
- [ ] CI/CD injects credentials via environment variables
- [ ] `.env.example` documents credential management
- [ ] Fallback pattern for missing generated file
- [ ] Type-safe credential access
- [ ] Integration test: Generated credentials work with API
- [ ] Sync test: Seed data matches generated credentials

---

## Quick Reference: Where Credentials Are Used

### Server-Side

- **Seed Script**: `server/prisma/seed.ts` → imports from `config/dev-credentials.ts`
- **Auth Service**: `src/services/tenant-auth.service.ts` → normalizes email
- **Repository**: `src/adapters/prisma/tenant.repository.ts` → normalizes on lookup/storage
- **Routes**: `src/routes/auth.routes.ts` → normalizes before operations

### Client-Side

- **Login Form**: `client/src/components/LoginForm.tsx` → uses generated credentials
- **Signup Form**: `client/src/components/SignupForm.tsx` → for test data

### Tests

- **Auth Service Tests**: `test/services/tenant-auth.service.spec.ts`
- **Integration Tests**: `test/http/auth-signup.test.ts`
- **Sync Tests**: `test/integration/dev-credentials-sync.spec.ts`

### Configuration

- **Dev Credentials**: `server/config/dev-credentials.ts` (SINGLE SOURCE OF TRUTH)
- **Environment**: `.env.example` (documentation only)
- **Build Script**: `server/scripts/generate-dev-credentials.ts`

---

## Common Pitfalls to Avoid

### Pitfall 1: Forgetting to Normalize in One Layer

**Bad:** Repository normalizes but service doesn't

```typescript
// Repository (good)
async findByEmail(email: string) {
  return this.prisma.tenant.findUnique({
    where: { email: email.toLowerCase() }
  });
}

// Service (bad - doesn't normalize, defeats purpose)
async login(email: string, password: string) {
  const tenant = await this.repo.findByEmail(email); // Passing raw email!
}
```

**Good:** Normalize at multiple layers (defense-in-depth)

```typescript
// Service normalizes
async login(email: string, password: string) {
  const tenant = await this.repo.findByEmail(email.toLowerCase());
}

// Repository also normalizes (in case called directly elsewhere)
async findByEmail(email: string) {
  return this.prisma.tenant.findUnique({
    where: { email: email.toLowerCase() }
  });
}
```

### Pitfall 2: Hardcoding Credentials in Multiple Places

**Bad:**

```typescript
// In LoginForm.tsx
const testEmail = 'demo@example.com';

// In E2E test
const testEmail = 'test@example.com';

// In seed.ts
await createUser({ email: 'admin@test.com' });
```

**Good:**

```typescript
// Single source of truth
// server/config/dev-credentials.ts
export const DEV_CREDENTIALS = {
  platformAdmin: { email: 'demo@example.com', password: '...' },
};

// Used everywhere
import { DEV_CREDENTIALS } from 'config/dev-credentials';
const { email, password } = DEV_CREDENTIALS.platformAdmin;
```

### Pitfall 3: Not Testing Case Sensitivity

**Bad:** Tests only use lowercase emails

```typescript
it('should login', async () => {
  await request(app)
    .post('/login')
    .send({ email: 'user@example.com' }) // Only lowercase tested
    .expect(200);
});
```

**Good:** Tests verify case-insensitive lookup

```typescript
it('should login with mixed case email', async () => {
  const response = await request(app)
    .post('/login')
    .send({ email: 'User@Example.COM' })
    .expect(200);
});

it('should prevent duplicate signup with different case', async () => {
  // First signup
  await request(app)
    .post('/signup')
    .send({ email: 'user@example.com', ... })
    .expect(201);

  // Second signup with different case should fail
  await request(app)
    .post('/signup')
    .send({ email: 'USER@EXAMPLE.COM', ... })
    .expect(409);
});
```

---

## Maintenance Guide

### When to Update Dev Credentials

You should update credentials in `config/dev-credentials.ts` when:

1. Password security requirements change
2. You want to use different test credentials
3. Email format needs to change
4. New development user types are added

### How to Update

1. Edit `server/config/dev-credentials.ts`
2. Run `npm run seed` (regenerates seed data AND frontend credentials)
3. Restart development server
4. Verify credentials work:
   ```bash
   npm test -- tenant-auth.service.spec.ts
   npm run test:e2e
   ```

### How to Add New Dev User Type

```typescript
// server/config/dev-credentials.ts
export const DEV_CREDENTIALS = {
  platformAdmin: {
    /* ... */
  },
  testTenant: {
    /* ... */
  },

  // NEW USER TYPE:
  teamMember: {
    email: 'team@example.com',
    password: 'TeamPassword123!',
    name: 'Team Member',
    description: 'Test team member account',
  },
} as const;
```

Then update:

1. Seed script to create this user
2. Tests to use this credential
3. Frontend autofill (if needed)
4. E2E fixtures

---

## Monitoring and Alerts

### Pre-Commit Hook to Validate Credentials

**File:** `.git/hooks/pre-commit` (or use husky)

```bash
#!/bin/bash
# Validate dev credentials before commit

if ! npm run validate:credentials; then
  echo "❌ Dev credentials validation failed"
  exit 1
fi

echo "✅ Dev credentials valid"
```

### Health Check Endpoint

**File:** `server/src/routes/health.routes.ts`

```typescript
router.get('/health/dev-credentials', async (req, res) => {
  try {
    validateDevCredentials();

    // Verify seed data exists
    const adminExists = await tenantRepo.findByEmail(DEV_CREDENTIALS.platformAdmin.email);

    const tenantExists = await tenantRepo.findBySlug(DEV_CREDENTIALS.testTenant.slug);

    if (!adminExists || !tenantExists) {
      return res.status(503).json({
        status: 'unhealthy',
        message: 'Seed data missing',
        hint: 'Run: npm run seed',
      });
    }

    return res.json({
      status: 'healthy',
      credentialsValidated: true,
      seedDataExists: true,
    });
  } catch (error) {
    return res.status(503).json({
      status: 'unhealthy',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});
```

---

## Summary

These three prevention strategies work together to ensure robust authentication:

1. **Password Hash Synchronization** - Centralized credentials prevent mismatch
2. **Case-Insensitive Email Handling** - Normalization at multiple layers ensures reliability
3. **Demo/Dev Credentials Sync** - Generated credentials keep dev data in sync

By implementing these patterns:

- Developers spend less time debugging auth issues
- Tests are more reliable and maintainable
- Onboarding new team members is easier
- Production bugs are prevented through comprehensive testing
