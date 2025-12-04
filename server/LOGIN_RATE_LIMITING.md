# Login Rate Limiting - Security Implementation

## Overview

Implemented strict rate limiting on login endpoints to prevent brute force attacks. This critical security measure limits login attempts to 5 per 15-minute window per IP address.

## Implementation Details

### 1. Rate Limiter Configuration

**File**: `/Users/mikeyoung/CODING/Elope/server/src/middleware/rateLimiter.ts`

Added new `loginLimiter` export with the following settings:

```typescript
export const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // Only 5 login attempts per window
  standardHeaders: true, // Return rate limit info in headers
  legacyHeaders: false, // Don't use X-RateLimit-* headers
  skipSuccessfulRequests: true, // Only count failed login attempts
  handler: (_req, res) =>
    res.status(429).json({
      error: 'too_many_login_attempts',
      message: 'Too many login attempts. Please try again in 15 minutes.',
    }),
});
```

**Key Features**:

- **5 attempts per 15 minutes**: Strict limit to prevent brute force
- **Skip successful requests**: Only failed login attempts count toward the limit
- **Custom error message**: Clear user feedback with specific error code
- **Standard headers**: Returns `RateLimit-*` headers for transparency

### 2. Tenant Login Protection

**File**: `/Users/mikeyoung/CODING/Elope/server/src/routes/tenant-auth.routes.ts`

Applied rate limiting to the tenant login endpoint:

- **Endpoint**: `POST /v1/tenant-auth/login`
- **Middleware**: Applied `loginLimiter` before route handler
- **Logging**: Added failed login attempt logging with:
  - Event type: `tenant_login_failed`
  - Email attempted
  - IP address
  - Timestamp
  - Error details

### 3. Admin Login Protection

**File**: `/Users/mikeyoung/CODING/Elope/server/src/routes/index.ts`

Applied rate limiting to the admin login endpoint:

- **Endpoint**: `POST /v1/admin/login`
- **Middleware**: Applied `loginLimiter` in global middleware chain
- **Logging**: Added failed login attempt logging with:
  - Event type: `admin_login_failed`
  - Email attempted
  - IP address
  - Timestamp
  - Error details

Implementation uses ts-rest's `globalMiddleware` to apply rate limiting before the route handler executes.

## Security Best Practices

### Why 5 Attempts?

- Strict enough to prevent brute force attacks
- Lenient enough for legitimate users with typos
- Industry standard for authentication rate limiting

### Why Skip Successful Requests?

- `skipSuccessfulRequests: true` ensures only failed login attempts count
- Prevents locking out legitimate users who log in successfully
- Focuses protection on actual attack attempts

### Why 15-Minute Window?

- Matches existing rate limiter patterns in the application
- Long enough to deter automated attacks
- Short enough to not permanently lock out users

### IP-Based Tracking

Rate limiting is applied per IP address, so:

- Each unique IP gets 5 attempts per window
- Distributed attacks are mitigated (each IP limited separately)
- Legitimate users on same network don't interfere with each other

## Failed Login Logging

All failed login attempts are logged with structured data:

```json
{
  "level": "warn",
  "event": "tenant_login_failed" | "admin_login_failed",
  "endpoint": "/v1/tenant-auth/login" | "/v1/admin/login",
  "email": "attempted@email.com",
  "ipAddress": "192.168.1.1",
  "timestamp": "2025-11-06T10:30:00.000Z",
  "error": "Invalid credentials"
}
```

### Log Monitoring

Monitor logs for:

- **Repeated failures** from same IP (potential attack)
- **Distributed failures** across IPs targeting same email (credential stuffing)
- **Pattern analysis** to identify attack vectors

## Testing

### Manual Testing

Use the provided test script:

```bash
cd /Users/mikeyoung/CODING/Elope/server
./test-login-rate-limit.sh
```

### Expected Behavior

1. **Attempts 1-5**: Return `401 Unauthorized` (authentication error)
2. **Attempt 6+**: Return `429 Too Many Requests` (rate limit exceeded)

### Test with curl

**Tenant Login**:

```bash
curl -X POST http://localhost:3000/v1/tenant-auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"wrong"}'
```

**Admin Login**:

```bash
curl -X POST http://localhost:3000/v1/admin/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@example.com","password":"wrong"}'
```

### Response Headers

Rate limit information is included in response headers:

```
RateLimit-Limit: 5
RateLimit-Remaining: 4
RateLimit-Reset: 1699282800
```

## Files Modified

1. **`/Users/mikeyoung/CODING/Elope/server/src/middleware/rateLimiter.ts`**
   - Added `loginLimiter` export

2. **`/Users/mikeyoung/CODING/Elope/server/src/routes/tenant-auth.routes.ts`**
   - Imported `loginLimiter` and `logger`
   - Applied rate limiting to login route
   - Added failed login logging

3. **`/Users/mikeyoung/CODING/Elope/server/src/routes/index.ts`**
   - Imported `loginLimiter` and `logger`
   - Applied rate limiting in global middleware for admin login
   - Added failed login logging to admin login handler

## Verification

### TypeScript Compilation

```bash
pnpm --filter @elope/api exec tsc --noEmit
```

✓ No TypeScript errors in modified files

### Test Suite

```bash
pnpm --filter @elope/api test
```

✓ All auth middleware tests pass

### Runtime Verification

1. Start the server
2. Run test script (see above)
3. Verify attempt #6 returns 429 status
4. Check server logs for failed login warnings

## Production Considerations

### Rate Limit Storage

Current implementation uses in-memory storage. For production with multiple server instances:

**Option 1: Redis Store** (Recommended)

```typescript
import RedisStore from 'rate-limit-redis';
import { createClient } from 'redis';

const client = createClient({ url: process.env.REDIS_URL });

export const loginLimiter = rateLimit({
  store: new RedisStore({
    client,
    prefix: 'login_limit:',
  }),
  // ... other config
});
```

**Option 2: Sticky Sessions**
Configure load balancer for session affinity based on IP

### Monitoring & Alerts

Set up alerts for:

- High rate of 429 responses (potential attack in progress)
- Failed login patterns (credential stuffing detection)
- Unusual geographic distribution of failed attempts

### False Positive Mitigation

Consider implementing:

- **CAPTCHA** after 3 failed attempts
- **Email verification** for password reset
- **Account lockout** after repeated rate limit hits
- **Whitelist** for known good IPs (office networks, etc.)

## Security Impact

### Attack Mitigation

- **Brute Force**: Limits attacker to 5 attempts per 15 minutes
- **Credential Stuffing**: Slows down automated attacks significantly
- **Dictionary Attacks**: Makes them impractical due to time constraints

### User Experience

- **Legitimate users**: Minimal impact (5 attempts is generous)
- **Clear feedback**: Error message explains the lockout
- **Time-based**: Automatic unlock after 15 minutes
- **No permanent lockout**: Users can retry after window expires

## Compliance

This implementation helps meet compliance requirements for:

- **PCI DSS**: Requirement 8.1.6 (limit repeated access attempts)
- **OWASP**: Top 10 - Broken Authentication prevention
- **NIST**: SP 800-63B Authentication guidelines

## Future Enhancements

1. **Adaptive Rate Limiting**: Adjust limits based on threat level
2. **Geographic Blocking**: Block login attempts from high-risk countries
3. **Device Fingerprinting**: Track devices in addition to IP addresses
4. **Progressive Delays**: Increase delay between attempts exponentially
5. **Security Events Dashboard**: Visualize failed login patterns
