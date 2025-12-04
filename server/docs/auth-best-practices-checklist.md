# Authentication Best Practices Checklist

Quick reference guide for implementing and maintaining authentication features safely.

---

## Pre-Development Checklist

Before implementing any authentication feature:

### Email Handling

- [ ] **Normalize emails to lowercase** at every layer (repository, service, route)
- [ ] **Include `.toLowerCase().trim()`** on all email input
- [ ] **Document email normalization** in code comments
- [ ] **Write test cases** for mixed-case email login
- [ ] **Test duplicate prevention** with different cases
- [ ] **Verify Prisma schema** has email as `@unique`

### Password Management

- [ ] **Use centralized credential configuration** (`config/dev-credentials.ts`)
- [ ] **Never hardcode passwords** in code or tests
- [ ] **Use bcryptjs** with minimum 10 rounds (OWASP 2024 recommendation)
- [ ] **Hash passwords before storage** in all code paths
- [ ] **Never log passwords** even in debug mode
- [ ] **Validate password length** minimum 8 characters

### Credential Synchronization

- [ ] **Single source of truth** for dev credentials
- [ ] **Import from shared config** in all places
- [ ] **Generate frontend credentials** from backend config
- [ ] **Update seed script** when credentials change
- [ ] **Run validation tests** after credential changes
- [ ] **Document how to update** dev credentials

### Security

- [ ] **Prevent timing attacks** by using consistent error messages
- [ ] **Rate limit** authentication endpoints (5 attempts/15 min recommended)
- [ ] **Log auth attempts** for security monitoring
- [ ] **Use HTTPS only** in production
- [ ] **Set secure JWT expiration** (7-30 days recommended)
- [ ] **Validate token algorithm** explicitly (not none)

---

## Code Review Checklist

When reviewing authentication code:

### Email Operations

```typescript
// ✅ GOOD: Normalize email
const normalized = email.toLowerCase().trim();
const tenant = await repo.findByEmail(normalized);

// ❌ BAD: Forget to normalize
const tenant = await repo.findByEmail(email); // Case sensitive!
```

- [ ] Email normalized in routes
- [ ] Email normalized in services
- [ ] Email normalized in repositories
- [ ] Email trimmed of whitespace
- [ ] Unique constraint verified in schema

### Password Hashing

```typescript
// ✅ GOOD: Hash password
const hash = await bcrypt.hash(password, 12);
await repo.update({ passwordHash: hash });

// ❌ BAD: Store plaintext
await repo.update({ password: password }); // SECURITY ISSUE!
```

- [ ] Password hashed before storage
- [ ] Bcrypt rounds >= 10
- [ ] Password never logged
- [ ] Password comparison uses `bcrypt.compare()`
- [ ] No password in error messages

### Credential Configuration

```typescript
// ✅ GOOD: Centralized credentials
import { DEV_CREDENTIALS } from '../config/dev-credentials';
const cred = DEV_CREDENTIALS.platformAdmin;

// ❌ BAD: Hardcoded credentials scattered
const email = 'admin@test.com'; // Different value elsewhere
```

- [ ] Dev credentials in `config/dev-credentials.ts`
- [ ] All tests import from same config
- [ ] Seed script uses same config
- [ ] Frontend imports generated credentials
- [ ] No hardcoded credentials in code

### JWT Handling

```typescript
// ✅ GOOD: Explicit algorithm
const token = jwt.sign(payload, secret, {
  algorithm: 'HS256',
  expiresIn: '7d',
});

// ❌ BAD: Forgetting algorithm validation
const payload = jwt.verify(token, secret); // Could accept 'none' algorithm
```

- [ ] Algorithm specified explicitly (HS256)
- [ ] Algorithm verified (not 'none')
- [ ] Expiration set and checked
- [ ] Token payload includes type field
- [ ] Sensitive data not in JWT payload

### Error Handling

```typescript
// ✅ GOOD: Generic error messages
throw new UnauthorizedError('Invalid credentials');

// ❌ BAD: Leak user information
throw new Error('User not found'); // Reveals if email exists
```

- [ ] Generic error messages (don't reveal which field is wrong)
- [ ] Consistent error messages for all failures
- [ ] No sensitive data in error responses
- [ ] Errors logged for monitoring (server-side only)
- [ ] User-friendly error messages

### Testing

```typescript
// ✅ GOOD: Test case variations
it('should login with mixed-case email', async () => {
  await request(app)
    .post('/login')
    .send({ email: 'User@Example.COM', password: 'pass' })
    .expect(200);
});

// ❌ BAD: Only test lowercase
it('should login', async () => {
  await request(app)
    .post('/login')
    .send({ email: 'user@example.com', password: 'pass' }) // Only lowercase
    .expect(200);
});
```

- [ ] Test uppercase email
- [ ] Test mixed-case email
- [ ] Test email with whitespace
- [ ] Test wrong password rejection
- [ ] Test nonexistent user rejection
- [ ] Test inactive user rejection

---

## Implementation Checklist

When implementing authentication features:

### Step 1: Define Credentials

```typescript
// File: server/config/dev-credentials.ts
export const DEV_CREDENTIALS = {
  newUser: {
    email: 'new@example.com',
    password: 'NewPassword123!',
    name: 'New User',
    description: 'Description of user',
  },
} as const;
```

- [ ] Create/update `config/dev-credentials.ts`
- [ ] Include email, password, and description
- [ ] Password meets minimum requirements
- [ ] Email in valid format
- [ ] Export as const for type safety

### Step 2: Update Seed Script

```typescript
// File: server/prisma/seed.ts
import { DEV_CREDENTIALS } from '../config/dev-credentials';

const cred = DEV_CREDENTIALS.newUser;
const passwordHash = await bcrypt.hash(cred.password, 12);

await prisma.tenant.create({
  data: {
    email: cred.email.toLowerCase(),
    passwordHash,
    name: cred.name,
    // ... other fields
  },
});
```

- [ ] Import credentials from `config/dev-credentials.ts`
- [ ] Normalize email to lowercase before storage
- [ ] Hash password with >= 10 rounds
- [ ] Create/upsert with all required fields
- [ ] Log success message

### Step 3: Create Test Fixtures

```typescript
// File: server/test/helpers/dev-credentials.ts
import { DEV_CREDENTIALS } from '../../config/dev-credentials';

export function getNewUserCredentials() {
  return DEV_CREDENTIALS.newUser;
}

export async function loginAsNewUser(request: any) {
  const cred = DEV_CREDENTIALS.newUser;
  return request
    .post('/v1/auth/login')
    .send({ email: cred.email, password: cred.password })
    .expect(200);
}
```

- [ ] Create test helper file
- [ ] Export getter functions
- [ ] Create login helper
- [ ] Use in test files

### Step 4: Write Integration Tests

```typescript
// File: server/test/integration/new-feature.spec.ts
import { getNewUserCredentials } from '../helpers/dev-credentials';

describe('New Feature', () => {
  it('should work with seeded user', async () => {
    const response = await request(app)
      .post('/v1/auth/login')
      .send(getNewUserCredentials())
      .expect(200);

    expect(response.body.token).toBeDefined();
  });

  it('should handle mixed-case email', async () => {
    const cred = getNewUserCredentials();
    const response = await request(app)
      .post('/v1/auth/login')
      .send({
        email: cred.email.toUpperCase(),
        password: cred.password,
      })
      .expect(200);

    expect(response.body.token).toBeDefined();
  });
});
```

- [ ] Write test with seeded credentials
- [ ] Write test with uppercase email
- [ ] Write test with wrong password
- [ ] Write test with nonexistent user
- [ ] Test error messages are generic

### Step 5: Update Seed Data

```bash
# Run to create/update seed data
npm run seed

# Verify success
npm test -- auth-prevention-tests.spec.ts
```

- [ ] Run seed script
- [ ] Verify no errors
- [ ] Run auth tests
- [ ] All tests pass

### Step 6: Generate Frontend Credentials

```bash
# Run build to regenerate frontend credentials
npm run build

# Or run dev script if it auto-generates
npm run dev:api
```

- [ ] Frontend credentials generated
- [ ] Frontend can import and use them
- [ ] Check `.gitignore` for generated files

---

## Testing Checklist

For each authentication feature:

### Unit Tests

```typescript
describe('AuthService', () => {
  it('should hash password with bcrypt', async () => {
    const hash = await service.hashPassword('password');
    expect(hash).toMatch(/^\$2[aby]\$\d+\$/);
  });

  it('should normalize email on login', async () => {
    // Test that service normalizes email
  });

  it('should reject wrong password', async () => {
    // Test password verification
  });
});
```

- [ ] Test password hashing
- [ ] Test email normalization
- [ ] Test password verification
- [ ] Test error handling
- [ ] Test token generation
- [ ] Test token verification

### Integration Tests

```typescript
describe('Auth API', () => {
  it('should signup with mixed-case email', async () => {
    await request(app)
      .post('/signup')
      .send({
        email: 'User@Example.COM',
        password: 'password123',
        businessName: 'Test',
      })
      .expect(201);
  });

  it('should prevent duplicate email signup', async () => {
    // First signup succeeds
    // Second signup with different case fails
  });

  it('should authenticate with mixed-case email', async () => {
    // Signup creates email in lowercase
    // Login with uppercase succeeds
  });
});
```

- [ ] Signup with uppercase email
- [ ] Signup with mixed-case email
- [ ] Signup with whitespace
- [ ] Duplicate prevention (case-insensitive)
- [ ] Login with different case
- [ ] Wrong password rejection
- [ ] Inactive user rejection
- [ ] Password reset flow
- [ ] Token verification

### E2E Tests

```typescript
test('should complete auth flow', async ({ page }) => {
  // Navigate to signup
  await page.goto('/signup');

  // Fill form with dev credentials
  // (Should be auto-filled from generated file)

  // Submit
  // Verify success
});
```

- [ ] Signup flow end-to-end
- [ ] Login flow end-to-end
- [ ] Password reset flow
- [ ] Token storage and usage
- [ ] Logout flow
- [ ] Session persistence
- [ ] Redirect on unauthorized

---

## Maintenance Checklist

Regular maintenance tasks:

### Weekly

- [ ] Review auth-related logs for failures
- [ ] Check for unusual login patterns
- [ ] Verify rate limiting is working

### Monthly

- [ ] Review password requirements
- [ ] Audit JWT expiration times
- [ ] Check for deprecated auth libraries
- [ ] Review OWASP guidance for updates

### Quarterly

- [ ] Update bcrypt rounds if needed
- [ ] Review token expiration policies
- [ ] Audit test coverage
- [ ] Security audit of auth code

### On Dependency Update

- [ ] Check for auth-related security patches
- [ ] Update bcryptjs version
- [ ] Update jsonwebtoken version
- [ ] Verify compatibility
- [ ] Run full auth test suite

### When Changing Dev Credentials

- [ ] Update `config/dev-credentials.ts`
- [ ] Run `npm run seed`
- [ ] Run `npm run build` (to regenerate frontend)
- [ ] Run `npm test -- auth-prevention-tests.spec.ts`
- [ ] Verify frontend credentials auto-filled
- [ ] Document change in commit message

---

## Security Audit Checklist

Perform before deploying auth changes:

### Cryptography

- [ ] Password hashing uses bcryptjs
- [ ] JWT signing uses HS256
- [ ] Random token generation uses crypto.randomBytes
- [ ] No hardcoded secrets in code
- [ ] Secrets use environment variables

### Input Validation

- [ ] Email format validated
- [ ] Email normalized to lowercase
- [ ] Email whitespace trimmed
- [ ] Password length validated
- [ ] Business name length validated
- [ ] No SQL injection possible
- [ ] No XSS in error messages

### Output Encoding

- [ ] No passwords in logs
- [ ] No tokens in logs (except hashed)
- [ ] Error messages generic
- [ ] No sensitive data in API responses
- [ ] JSON responses properly typed

### Access Control

- [ ] JWT verification mandatory
- [ ] Algorithm explicitly checked
- [ ] Token type verified
- [ ] Expiration checked
- [ ] Rate limiting active
- [ ] Inactive users rejected

### Data Protection

- [ ] Passwords hashed
- [ ] Reset tokens hashed
- [ ] API keys hashed
- [ ] Email unique per system
- [ ] Multi-tenant isolation maintained
- [ ] No cross-tenant data access

### Monitoring

- [ ] Failed logins logged
- [ ] Failed password resets logged
- [ ] Unusual patterns detectable
- [ ] Rate limit breaches logged
- [ ] Admin impersonation logged
- [ ] Alerts configured

---

## Common Mistakes and Fixes

### Mistake 1: Case-Sensitive Email Lookup

```typescript
// ❌ BAD
const tenant = await db.findUnique({
  where: { email: email }, // Case sensitive!
});

// ✅ GOOD
const tenant = await db.findUnique({
  where: { email: email.toLowerCase() }, // Case insensitive
});
```

### Mistake 2: Storing Plaintext Password

```typescript
// ❌ BAD
await db.update({
  password: password, // NEVER!
});

// ✅ GOOD
const hash = await bcrypt.hash(password, 12);
await db.update({
  passwordHash: hash,
});
```

### Mistake 3: Hardcoded Credentials in Tests

```typescript
// ❌ BAD
const email = 'admin@test.com';
const password = 'admin123';
// (Different from seed data!)

// ✅ GOOD
import { DEV_CREDENTIALS } from '../config/dev-credentials';
const { email, password } = DEV_CREDENTIALS.platformAdmin;
```

### Mistake 4: Revealing User Information in Errors

```typescript
// ❌ BAD
if (!user) throw new Error('User not found'); // Reveals email exists

// ✅ GOOD
throw new UnauthorizedError('Invalid credentials'); // Generic message
```

### Mistake 5: Accepting 'none' Algorithm in JWT

```typescript
// ❌ BAD
const payload = jwt.verify(token, secret);

// ✅ GOOD
const payload = jwt.verify(token, secret, {
  algorithms: ['HS256'], // Only allow specific algorithm
});
```

### Mistake 6: Not Validating Email Format

```typescript
// ❌ BAD
if (email && password) {
  // Only checks existence
  // Login
}

// ✅ GOOD
const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
if (!emailRegex.test(email)) {
  throw new ValidationError('Invalid email format');
}
```

---

## Troubleshooting Guide

### Issue: Login fails with correct credentials

1. Check if email is stored in lowercase
2. Check if password hash was created with bcryptjs
3. Verify `bcrypt.compare()` is being used
4. Check seed script actually ran
5. Verify database contains the user

### Issue: Signup fails with "Email already exists"

1. Check email case normalization
2. Check for whitespace in email
3. Verify unique constraint in schema
4. Check for duplicate entries in database
5. Confirm email lookup normalizes input

### Issue: Tests use different credentials than seed

1. Check credentials defined in `config/dev-credentials.ts`
2. Verify seed script imports from config
3. Verify tests import from config
4. Run seed script: `npm run seed`
5. Run tests: `npm test`

### Issue: Frontend autofill shows wrong credentials

1. Check if build script generates credentials
2. Verify frontend imports generated file
3. Check `node_modules` for generated file
4. Run build: `npm run build`
5. Verify `.env` doesn't override credentials

### Issue: Mixed-case email login fails

1. Check email normalized in service layer
2. Check email normalized in repository layer
3. Check email normalized in route layer
4. Add test case for mixed-case email
5. Run test to verify fix

---

## Quick Start Commands

```bash
# Create new dev user type
1. Edit server/config/dev-credentials.ts
2. npm run seed
3. npm test -- auth-prevention-tests.spec.ts

# Update dev credentials
1. Edit server/config/dev-credentials.ts
2. npm run seed
3. npm run build (to regenerate frontend)
4. npm test

# Verify all auth tests pass
npm test -- auth-prevention-tests.spec.ts

# Run full auth test suite
npm test -- --grep auth

# Reset test database if corrupted
cd server && npm exec prisma migrate reset
```

---

## Resources

- **OWASP Authentication Cheat Sheet**: https://cheatsheetseries.owasp.org/cheatsheets/Authentication_Cheat_Sheet.html
- **Bcryptjs Docs**: https://github.com/dcodeIO/bcrypt.js
- **JWT Best Practices**: https://tools.ietf.org/html/rfc8949
- **NIST Password Guidelines**: https://pages.nist.gov/800-63-3/sp800-63b.html

---

## Sign-Off

Use this checklist as a template for pull request reviews:

- [ ] Email normalization at all layers
- [ ] Password hashing with sufficient rounds
- [ ] Centralized credential configuration
- [ ] Comprehensive test coverage
- [ ] Generic error messages
- [ ] No sensitive data in logs
- [ ] Rate limiting configured
- [ ] JWT algorithm verified
- [ ] Case-insensitive duplicate prevention
- [ ] All tests passing
- [ ] Security audit completed

**Reviewed by:** ******\_\_\_******
**Date:** ******\_\_\_******
**Status:** ✅ Ready to merge / ❌ Needs changes
