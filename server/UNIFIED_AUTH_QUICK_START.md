# Unified Authentication - Quick Start Guide

## Overview

Single login endpoint that handles **both** platform admins and tenant admins with automatic role detection.

## Endpoint

```
POST /v1/auth/login
```

## Test Credentials

### Platform Admin (MOCK Mode)

```
Email:    admin@elope.com
Password: admin123
```

### Tenant Admin (Database Mode)

```
Email:    test-tenant@example.com
Password: Test123456
```

## Usage Example

### cURL

```bash
# Login (works for both admin types)
curl -X POST http://localhost:3001/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@elope.com","password":"admin123"}'

# Response for Platform Admin:
{
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "role": "PLATFORM_ADMIN",
  "email": "admin@elope.com",
  "userId": "user_admin"
}

# Response for Tenant Admin:
{
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "role": "TENANT_ADMIN",
  "email": "test-tenant@example.com",
  "tenantId": "cmhp91lct0000p0i3hi347g0v",
  "slug": "test-tenant"
}
```

### JavaScript/TypeScript

```typescript
// Universal login function
async function login(email: string, password: string) {
  const response = await fetch('http://localhost:3001/v1/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });

  const data = await response.json();

  // Check role to determine user type
  if (data.role === 'PLATFORM_ADMIN') {
    // Platform admin - has userId
    console.log('Admin:', data.userId, data.email);
    return { ...data, userType: 'admin' };
  } else if (data.role === 'TENANT_ADMIN') {
    // Tenant admin - has tenantId and slug
    console.log('Tenant:', data.tenantId, data.slug);
    return { ...data, userType: 'tenant' };
  }

  throw new Error('Unknown role');
}

// Usage
const result = await login('admin@elope.com', 'admin123');
localStorage.setItem('authToken', result.token);
```

## Verify Token

```bash
# Verify any token (admin or tenant)
curl -X GET http://localhost:3001/v1/auth/verify \
  -H "Authorization: Bearer ${TOKEN}"

# Response includes role and user info
{
  "role": "PLATFORM_ADMIN" | "TENANT_ADMIN",
  "email": "user@example.com",
  "userId": "...",      // Only for PLATFORM_ADMIN
  "tenantId": "...",    // Only for TENANT_ADMIN
  "slug": "..."         // Only for TENANT_ADMIN
}
```

## Running Tests

```bash
cd server
./test-unified-auth.sh
```

## JWT Token Structure

### Platform Admin Token Payload

```json
{
  "userId": "user_admin",
  "email": "admin@elope.com",
  "role": "admin",
  "iat": 1699372800,
  "exp": 1699977600
}
```

### Tenant Admin Token Payload

```json
{
  "tenantId": "cmhp91lct0000p0i3hi347g0v",
  "slug": "test-tenant",
  "email": "test-tenant@example.com",
  "type": "tenant",
  "iat": 1699372800,
  "exp": 1699977600
}
```

## Error Handling

| HTTP Code | Error                           | Cause                              |
| --------- | ------------------------------- | ---------------------------------- |
| 400       | Email and password are required | Missing fields                     |
| 401       | Invalid credentials             | Wrong email/password               |
| 401       | Invalid or expired token        | Token expired or invalid signature |
| 429       | Too Many Requests               | Rate limit (5 attempts/15min)      |

## Legacy Endpoints (Still Supported)

The original endpoints continue to work:

- `/v1/admin/login` - Platform admin only
- `/v1/tenant-auth/login` - Tenant admin only

**Recommendation:** Use `/v1/auth/login` for all new code.

## Files Created/Modified

### New Files

- `/server/src/routes/auth.routes.ts` - Unified auth controller
- `/server/docs/archive/implementation-reports/UNIFIED_AUTH_IMPLEMENTATION_REPORT.md` - Full documentation
- `/server/test-unified-auth.sh` - Test script

### Modified Files

- `/server/src/routes/index.ts` - Added unified auth routes
- `/server/src/lib/ports.ts` - Added UserRole type

## Next Steps

1. **Test the endpoint:** Run `./test-unified-auth.sh`
2. **Update frontend:** Migrate to `/v1/auth/login`
3. **Check response:** Use `role` field to route users appropriately

## Support

For detailed information, see:

- [Full Implementation Report](./docs/archive/implementation-reports/UNIFIED_AUTH_IMPLEMENTATION_REPORT.md)
- [Auth Quick Reference](../client/AUTH_QUICK_REFERENCE.md)
