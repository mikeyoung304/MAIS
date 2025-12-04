# Login Invalid Credentials - Email Case Sensitivity

```yaml
title: Login Invalid Credentials - Email Case Sensitivity Fix
category: security-issues
severity: medium
date_solved: 2025-11-27
affected_components:
  - client/src/pages/Login.tsx
  - server/src/services/tenant-auth.service.ts
  - server/src/adapters/prisma/tenant.repository.ts
  - server/prisma/seed.ts
symptoms:
  - Login page displays "Invalid credentials" for valid user accounts
  - Users with correct email/password cannot authenticate
  - Email addresses with uppercase letters fail authentication
  - Demo credentials in login form don't work
error_messages:
  - 'Invalid credentials. Please check your email and password.'
  - '401 Unauthorized'
tags:
  - authentication
  - login
  - case-sensitivity
  - email-normalization
  - multi-tenant
  - credentials
```

## Problem Statement

Users reported receiving "Invalid credentials" error when attempting to log in with known-correct credentials. The issue affected both platform admin and tenant admin logins.

## Investigation Steps

1. **Tested login via browser** - Confirmed error message appears
2. **Tested login API directly** - `curl` requests also returned 401
3. **Checked database records** - Found user exists with expected email
4. **Verified password hash** - bcrypt.compare() returned false
5. **Checked API logs** - Found email being lowercased in logs but stored with mixed case
6. **Identified multiple root causes** - See below

## Root Causes Identified

### 1. Password Hash Mismatch (Admin Login)

The admin user's `passwordHash` in the database didn't match what the seed script would generate for `@Nupples8`. The seed script was last run with a different password.

**Evidence:**

```javascript
const isValid = await bcrypt.compare('@Nupples8', user.passwordHash);
console.log('Password valid:', isValid); // false
```

### 2. Case-Sensitive Email Lookup (Tenant Login)

Tenant emails were stored with mixed case (e.g., `Adele502@gmail.com`) but the repository's `findByEmail()` performed case-sensitive lookups. When the frontend or API normalized input to lowercase, no match was found.

**Evidence:**

```javascript
// Database has: Adele502@gmail.com
// Query uses:   adele502@gmail.com
// Result:       NOT FOUND (case-sensitive unique constraint)
```

### 3. Misleading Demo Credentials (UX Issue)

The login form (`Login.tsx`) was pre-filled with `admin@macon.com` / `admin123` which don't exist in the system, causing confusion when users tried to log in.

## Solution

### Fix 1: Re-seed Database

```bash
cd server
npm exec prisma db seed
```

This regenerated the correct bcrypt hash for `@Nupples8`.

### Fix 2: Normalize Emails to Lowercase

**tenant.repository.ts** (line 88-93):

```typescript
async findByEmail(email: string): Promise<Tenant | null> {
  // Normalize email to lowercase for case-insensitive lookup
  return await this.prisma.tenant.findUnique({
    where: { email: email.toLowerCase() },
  });
}
```

**tenant-auth.service.ts** (line 26-28):

```typescript
async login(email: string, password: string): Promise<{ token: string }> {
  // Find tenant by email (normalized to lowercase)
  const tenant = await this.tenantRepo.findByEmail(email.toLowerCase());
  // ...
}
```

**Database cleanup** - Normalize existing emails:

```javascript
const tenants = await prisma.tenant.findMany({ where: { email: { not: null } } });
for (const t of tenants) {
  if (t.email && t.email !== t.email.toLowerCase()) {
    await prisma.tenant.update({
      where: { id: t.id },
      data: { email: t.email.toLowerCase() },
    });
  }
}
```

### Fix 3: Update Demo Credentials

**client/src/pages/Login.tsx** (line 24-28):

```typescript
// Auto-fill for local development - use actual seeded admin credentials
const { values, handleChange } = useForm({
  email: 'mike@maconheadshots.com',
  password: '@Nupples8',
});
```

## Verification

### Admin Login

```bash
curl -s -X POST http://localhost:3001/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"mike@maconheadshots.com","password":"@Nupples8"}'

# Response: {"token":"eyJ...","role":"PLATFORM_ADMIN","email":"mike@maconheadshots.com","userId":"..."}
```

### Tenant Login

```bash
curl -s -X POST http://localhost:3001/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"adele502@gmail.com","password":"@Nupples8"}'

# Response: {"token":"eyJ...","role":"TENANT_ADMIN","tenantId":"...","email":"adele502@gmail.com","slug":"little-bit-farm"}
```

## Prevention Strategies

### 1. Email Normalization Pattern

**Always normalize emails at multiple layers (defense in depth):**

- Repository layer: Lowercase before database queries
- Service layer: Lowercase before passing to repository
- Storage: Store all emails in lowercase

### 2. Credential Synchronization

- Keep demo/dev credentials in sync with seed data
- Consider using environment variables for dev credentials
- Document expected credentials in DEVELOPING.md

### 3. Test Cases to Add

```typescript
describe('Email Case Sensitivity', () => {
  it('should login with lowercase email', async () => {
    await tenantAuthService.login('test@example.com', 'password');
  });

  it('should login with uppercase email', async () => {
    await tenantAuthService.login('TEST@EXAMPLE.COM', 'password');
  });

  it('should login with mixed case email', async () => {
    await tenantAuthService.login('Test@Example.COM', 'password');
  });
});
```

### 4. Pre-Deployment Checklist

- [ ] Run `npm exec prisma db seed` after schema changes
- [ ] Verify demo credentials match seeded data
- [ ] Check for case-sensitive email lookups in new authentication code

## Related Documentation

- [SECURITY.md](/docs/security/SECURITY.md) - Authentication architecture
- [OWASP_COMPLIANCE.md](/docs/security/OWASP_COMPLIANCE.md) - Password hashing standards
- [missing-input-validation-cross-tenant-exposure.md](./missing-input-validation-cross-tenant-exposure.md) - Multi-tenant validation patterns

## Lessons Learned

1. **Case sensitivity matters** - PostgreSQL string comparisons are case-sensitive by default
2. **Defense in depth** - Normalize at multiple layers to prevent regressions
3. **Keep demo data in sync** - Misleading demo credentials waste debugging time
4. **Check the obvious first** - Password hash mismatch was simple but not immediately considered
