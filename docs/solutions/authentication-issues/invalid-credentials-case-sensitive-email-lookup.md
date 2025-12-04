---
title: Invalid Credentials Error on Login - Case-Sensitive Email Lookup
category: authentication-issues
tags: [authentication, email-lookup, case-sensitivity, tenant-login, usability]
severity: medium
affected_components: [Login.tsx, TenantAuthService, TenantRepository]
symptoms:
  - Login page displays "Invalid credentials" error for valid user accounts
  - Users with correct email and password cannot authenticate
  - Email addresses with uppercase letters fail to match database records
  - Multiple root causes: misleading demo credentials, case-sensitive lookups
error_messages:
  - 'Invalid credentials. Please check your email and password.'
  - 'Tenant account not configured for login'
  - 'Tenant account is inactive'
date_solved: 2025-11-27
related_prs: []
---

# Invalid Credentials Error on Login - Case-Sensitive Email Lookup

## Problem Statement

Users attempting to log in to the MAIS platform were receiving "Invalid credentials" errors even when providing correct email addresses and passwords. The issue had multiple root causes:

1. **Misleading Demo Credentials**: The login page's auto-fill fields contained non-existent credentials (`admin@macon.com` / `admin123`) that would never succeed.

2. **Case-Sensitive Email Lookup**: Email addresses stored in the database (e.g., `mike@maconheadshots.com`) failed to match when users entered uppercase variants (e.g., `Mike@maconheadshots.com`) because the lookup was case-sensitive.

3. **No Email Normalization**: Neither the authentication service nor the repository normalized email addresses before querying the database.

These issues violated UX best practices (emails should be case-insensitive) and prevented legitimate users from accessing their accounts.

## Root Cause Analysis

### Root Cause 1: Misleading Demo Credentials

**Location**: `client/src/pages/Login.tsx` (lines 24-27)

```typescript
// BEFORE: Non-existent credentials
const { values, handleChange } = useForm({
  email: 'admin@macon.com', // Not a real user account
  password: 'admin123', // Doesn't match any real password
});
```

**Problem**: When new developers or users opened the login page, they would see pre-filled credentials. Attempting to log in with these credentials would fail with "Invalid credentials," making it unclear whether the issue was with the demo data or the authentication system itself.

### Root Cause 2: Case-Sensitive Email Lookup

**Location**: `server/src/adapters/prisma/tenant.repository.ts` (line 89)

```typescript
// BEFORE: Case-sensitive lookup
async findByEmail(email: string): Promise<Tenant | null> {
  return await this.prisma.tenant.findUnique({
    where: { email },  // Case-sensitive comparison
  });
}
```

**Problem**: Email addresses should be case-insensitive per RFC 5321 (SMTP standard). Users entering `Mike@maconheadshots.com` would not match the database record `mike@maconheadshots.com`.

**Database Impact**: Prisma's `findUnique()` uses exact string matching. PostgreSQL also performs case-sensitive comparisons by default (unless using `CITEXT` type).

### Root Cause 3: No Email Normalization in Authentication Service

**Location**: `server/src/services/tenant-auth.service.ts` (line 28)

```typescript
// BEFORE: No normalization
async login(email: string, password: string): Promise<{ token: string }> {
  const tenant = await this.tenantRepo.findByEmail(email);  // Raw input
  if (!tenant) {
    throw new UnauthorizedError('Invalid credentials');
  }
  // ...
}
```

**Problem**: Even if the repository implemented normalization, the service wasn't normalizing user input before calling the repository.

## Solution Overview

Implemented a two-layer fix:

1. **Update Demo Credentials**: Changed auto-fill to use actual seeded test credentials
2. **Normalize Email Addresses**: Added lowercase normalization at both service and repository layers

## Step-by-Step Implementation

### Step 1: Fix Demo Credentials in Login Page

**File**: `client/src/pages/Login.tsx`

**Changes**:

```typescript
// AFTER: Use actual seeded test credentials
const { values, handleChange } = useForm({
  email: 'mike@maconheadshots.com', // Actual seeded test user
  password: '@Nupples8', // Actual user password
});
```

**Why This Was Necessary**:

- **User Experience**: New developers and testers see working credentials immediately
- **Onboarding**: Reduces friction when setting up local development environment
- **Clarity**: Pre-filled form indicates the authentication system is working
- **Documentation**: Serves as an example of valid credentials in the codebase

### Step 2: Normalize Email in Authentication Service

**File**: `server/src/services/tenant-auth.service.ts`

**Changes**:

```typescript
// AFTER: Normalize email before lookup
async login(email: string, password: string): Promise<{ token: string }> {
  // Find tenant by email (normalized to lowercase)
  const tenant = await this.tenantRepo.findByEmail(email.toLowerCase());
  if (!tenant) {
    throw new UnauthorizedError('Invalid credentials');
  }
  // ... rest of authentication logic
}
```

**Why This Was Necessary**:

- **Standards Compliance**: RFC 5321 requires email addresses to be case-insensitive for SMTP
- **User Expectations**: Users expect their email addresses to work regardless of case
- **Defense in Depth**: Normalizes at the service layer before repository call
- **Consistent Behavior**: Service layer enforces a single normalization point

### Step 3: Normalize Email in Repository

**File**: `server/src/adapters/prisma/tenant.repository.ts`

**Changes**:

```typescript
// AFTER: Normalize email in repository method
async findByEmail(email: string): Promise<Tenant | null> {
  // Normalize email to lowercase for case-insensitive lookup
  return await this.prisma.tenant.findUnique({
    where: { email: email.toLowerCase() },
  });
}
```

**Why This Was Necessary**:

- **Data Layer Consistency**: Repository method handles normalization independently
- **Defensive Programming**: Doesn't depend on callers to normalize correctly
- **Documentation**: Comment clarifies the intent of the operation
- **Future-Proof**: Repository method is safe to call from other code paths

## Security Considerations

### Why Double Normalization is Safe

Having normalization in both the service and repository might seem redundant, but it follows the defensive programming principle:

1. **Service Layer**: `email.toLowerCase()` - Normalizes application input
2. **Repository Layer**: `email.toLowerCase()` - Guards against normalized strings being used incorrectly

**No Security Risk**: Both operations are idempotent (calling lowercase on an already-lowercase string is safe).

### No Additional Vulnerabilities Introduced

The email normalization does not:

- Create timing attack vectors (comparison is still done by Prisma)
- Bypass password validation (bcrypt comparison is unchanged)
- Introduce new injection risks (email is normalized before database query)
- Leak tenant information (error message remains generic "Invalid credentials")

## Testing Verification

### Manual Test Cases

**Before Fix**:

- Email: `mike@maconheadshots.com`, Password: `@Nupples8` → Success
- Email: `Mike@maconheadshots.com`, Password: `@Nupples8` → **Failed** (case mismatch)
- Email: `MIKE@MACONHEADSHOTS.COM`, Password: `@Nupples8` → **Failed** (case mismatch)

**After Fix**:

- Email: `mike@maconheadshots.com`, Password: `@Nupples8` → Success
- Email: `Mike@maconheadshots.com`, Password: `@Nupples8` → Success
- Email: `MIKE@MACONHEADSHOTS.COM`, Password: `@Nupples8` → Success
- Email: `mike@maconheadshots.com`, Password: `wrong` → Fails as expected
- Pre-filled credentials → Work immediately

### Affected Test Files

All existing authentication tests continue to pass because:

- Test fixtures normalize emails consistently
- Bcrypt comparison is unchanged
- Error handling remains the same
- Token generation is unaffected

## Prevention Strategies

### Checklist for Authentication Features

**For all email-based authentication:**

- [ ] Normalize email to lowercase in service layer
- [ ] Normalize email to lowercase in repository layer
- [ ] Document why normalization is performed
- [ ] Test with uppercase, mixed-case, and lowercase variants
- [ ] Verify error messages don't reveal whether email exists or not

### Email Normalization Pattern

**STANDARD PATTERN**: Apply at both service and repository layers:

```typescript
// Service layer - entry point normalization
const normalizedEmail = email.toLowerCase();
const tenant = await tenantRepo.findByEmail(normalizedEmail);

// Repository layer - defensive normalization
async findByEmail(email: string): Promise<Tenant | null> {
  return await db.findUnique({
    where: { email: email.toLowerCase() }
  });
}
```

### Demo Data Best Practices

**When updating demo credentials:**

- [ ] Use credentials that actually exist in test data
- [ ] Verify the account has a password set (`passwordHash !== null`)
- [ ] Confirm the account is active (`isActive === true`)
- [ ] Test the credentials work before committing
- [ ] Update comments to indicate these are real test credentials

## Related Documentation

- **Security Best Practices**: [docs/security/SECURITY.md](/Users/mikeyoung/CODING/MAIS/docs/security/SECURITY.md) - General authentication security
- **Multi-Tenant Implementation**: [docs/multi-tenant/MULTI_TENANT_IMPLEMENTATION_GUIDE.md](/Users/mikeyoung/CODING/MAIS/docs/multi-tenant/MULTI_TENANT_IMPLEMENTATION_GUIDE.md) - Tenant isolation patterns
- **Missing Route Handler Fix**: [docs/archive/2025-11/analysis/LOGIN_FIX_REPORT.md](/Users/mikeyoung/CODING/MAIS/docs/archive/2025-11/analysis/LOGIN_FIX_REPORT.md) - Related routing issue
- **CLAUDE.md - Authentication**: [/CLAUDE.md](/Users/mikeyoung/CODING/MAIS/CLAUDE.md) - Architecture and patterns

## Lessons Learned

1. **Email normalization should be automatic**: Don't rely on callers to handle case-sensitivity
2. **Demo credentials must be real**: Test with actual seeded data, not made-up credentials
3. **Defense in depth applies to data access**: Normalize at multiple layers to prevent bugs
4. **User expectations matter**: Users expect email addresses to be case-insensitive per standards
5. **Test case variations**: Always test with uppercase, lowercase, and mixed-case email addresses

## Code Changes Summary

| File                                              | Change                   | Lines | Purpose                                     |
| ------------------------------------------------- | ------------------------ | ----- | ------------------------------------------- |
| `client/src/pages/Login.tsx`                      | Update demo credentials  | 26-27 | Use real seeded test account                |
| `server/src/services/tenant-auth.service.ts`      | Normalize email input    | 28    | Apply lowercase normalization before lookup |
| `server/src/adapters/prisma/tenant.repository.ts` | Normalize email in query | 89-91 | Defensive normalization in repository       |

---

**Status**: Resolved
**Date Resolved**: 2025-11-27
**Impact**: Improves login experience, fixes case-sensitivity issues, improves developer onboarding
**Testing**: All existing tests pass, manual verification successful
