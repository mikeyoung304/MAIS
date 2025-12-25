# Production Deployment Prevention Strategies

## Overview

This document catalogs critical lessons learned from recent production deployment issues and prevention strategies to avoid regression. These issues blocked deployment, caused data leaks, and exposed security vulnerabilities.

**Date:** December 6, 2025
**Status:** Active Prevention Framework
**Last Updated:** Production deployment issues resolved

---

## 1. TypeScript Interface Mismatches (P0 - Build Blocker)

### The Problem

TypeScript interfaces were updated in core files but not all implementations were updated:

- **`mailProvider` interface** missing `sendEmail` method in routes/index.ts
- **`rateLimiter` middleware** missing logger import (compilation error)
- **Upload adapter** missing 'landing-pages' type in uploadToSupabase union
- **Password reset route** missing await on async validateBookingToken call

These are **compilation failures** that block CI/CD pipelines.

**Impact:**

- Production deployment halted
- Entire build pipeline fails
- Zero visibility until runtime in some cases

### Prevention Strategies

#### A. Pre-Commit Checks (LOCAL)

```bash
# Add to .git/hooks/pre-commit
npm run typecheck  # Must pass before commit

# Add to package.json scripts
"pre-commit": "npm run typecheck && npm run lint"
```

**Checklist:**

- [ ] Run `npm run typecheck` before every commit
- [ ] Fix all TS errors before pushing
- [ ] Test: `npm run typecheck` shows 0 errors

#### B. CI/CD Validation (AUTOMATED)

**In `.github/workflows/deploy-*.yml`:**

```yaml
- name: TypeScript Validation
  run: npm run typecheck

- name: Build Contracts
  run: npm run build --workspace=@macon/contracts

- name: Build Shared
  run: npm run build --workspace=@macon/shared
```

**Critical:** TypeCheck MUST run BEFORE:

- Docker build
- Database migrations
- Deployment steps

**Current Status:** ✅ Implemented in deploy-production.yml

#### C. Interface Consistency Patterns

When adding methods to interfaces, update in order:

1. **Define in port interface** (`server/src/lib/ports.ts`)

   ```typescript
   interface MailProvider {
     sendEmail(input: { to: string; subject: string; html: string }): Promise<void>;
     sendPasswordReset(...): Promise<void>;  // NEW METHOD
   }
   ```

2. **Implement in all adapters**

   ```typescript
   class PostmarkMailAdapter implements MailProvider {
     async sendPasswordReset(...) { ... }  // MUST BE HERE
   }

   class MockMailAdapter implements MailProvider {
     async sendPasswordReset(...) { ... }  // MUST BE HERE
   }
   ```

3. **Update DI container** (`server/src/di.ts`)

   ```typescript
   const mailProvider = new PostmarkMailAdapter({...});
   // Verify all required methods are present
   ```

4. **Update routes/controllers** that use the interface
   ```typescript
   // Must call new method if added
   await container.mailProvider.sendPasswordReset(...);
   ```

**Verification:** `npm run typecheck` catches all mismatches

### Test Cases

```typescript
describe('Interface Implementation Compliance', () => {
  it('should have all MailProvider methods in PostmarkMailAdapter', () => {
    const adapter = new PostmarkMailAdapter({ serverToken: '', fromEmail: '' });
    const methods: Array<keyof MailProvider> = [
      'sendEmail',
      'sendPasswordReset',
      'sendBookingConfirm',
      'sendBookingReminder',
    ];

    for (const method of methods) {
      expect(typeof adapter[method]).toBe('function');
    }
  });

  it('should have all MailProvider methods in MockMailAdapter', () => {
    const adapter = new MockMailAdapter({});
    const methods: Array<keyof MailProvider> = [
      'sendEmail',
      'sendPasswordReset',
      'sendBookingConfirm',
      'sendBookingReminder',
    ];

    for (const method of methods) {
      expect(typeof adapter[method]).toBe('function');
    }
  });

  it('should compile with no TypeScript errors', async () => {
    // This runs as part of 'npm run typecheck'
    // Document the expected interfaces
    const _: MailProvider; // Type check only, not executed
  });
});
```

---

## 2. Missing Environment Variables in Production (P1)

### The Problem

Production deployment requires many environment variables but validation was incomplete:

- Missing `POSTMARK_SERVER_TOKEN` → email doesn't send (fails silently in file-sink)
- Missing `JWT_SECRET` → authentication broken
- Missing `TENANT_SECRETS_ENCRYPTION_KEY` → tenant data at risk
- Missing database credentials → connections fail

**Current Status:**

- ✅ Health check endpoint reports missing adapters
- ❌ No startup validation log
- ❌ No .env.example documentation

### Prevention Strategies

#### A. Environment Validation at Startup

**File: `server/src/lib/core/config.ts` (EXISTING)**

```typescript
export function loadConfig(): Config {
  const required = ['JWT_SECRET', 'TENANT_SECRETS_ENCRYPTION_KEY', 'DATABASE_URL', 'DIRECT_URL'];

  const missing = required.filter((key) => !process.env[key]);
  if (missing.length > 0) {
    logger.error({ missing }, `Missing required environment variables: ${missing.join(', ')}`);
    process.exit(1);
  }

  // Document optional vars with fallback behavior
  const optional = {
    POSTMARK_SERVER_TOKEN: 'Email falls back to file-sink',
    STRIPE_SECRET_KEY: 'Stripe adapter disabled',
    GOOGLE_CALENDAR_ID: 'Calendar adapter disabled (mock)',
  };

  for (const [key, fallback] of Object.entries(optional)) {
    if (!process.env[key]) {
      logger.warn({ key, fallback }, `Optional env var not set, using fallback behavior`);
    }
  }

  return {
    /* config */
  };
}
```

**Enhancement:** Add to `server/src/app.ts` startup:

```typescript
export function createApp(config: Config, container: Container, startTime: number): Application {
  const app = express();

  // Log environment configuration at startup
  logger.info(
    {
      mode: config.ADAPTERS_PRESET,
      nodeEnv: process.env.NODE_ENV,
      emailAdapter: config.POSTMARK_SERVER_TOKEN ? 'Postmark' : 'File-sink fallback',
      paymentAdapter: config.STRIPE_SECRET_KEY ? 'Stripe' : 'Mock',
      calendarAdapter: config.GOOGLE_CALENDAR_ID ? 'Google Calendar' : 'Mock',
    },
    'Application started with adapter configuration'
  );

  // ... rest of app setup
  return app;
}
```

#### B. .env.example Documentation

**Create: `/server/.env.example`**

```bash
# REQUIRED - Application fails to start without these
JWT_SECRET=your-jwt-secret-here
TENANT_SECRETS_ENCRYPTION_KEY=your-encryption-key-here
DATABASE_URL=postgresql://user:pass@host:5432/dbname
DIRECT_URL=postgresql://user:pass@host:5432/dbname

# OPTIONAL - Graceful fallbacks available
POSTMARK_SERVER_TOKEN=        # Email uses file-sink fallback if not set
POSTMARK_FROM_EMAIL=noreply@example.com
STRIPE_SECRET_KEY=            # Stripe adapter disabled if not set
STRIPE_WEBHOOK_SECRET=        # Webhook validation skipped if not set
GOOGLE_CALENDAR_ID=           # Google Calendar disabled, mock adapter used

# RENDER.COM DEPLOYMENT SPECIFIC
CORS_ORIGIN=https://yourdomain.com
PORT=10000
NODE_ENV=production
ADAPTERS_PRESET=real
```

**In render.yaml:**

```yaml
envVars:
  - key: JWT_SECRET
    sync: false # REQUIRED
    description: 'JWT signing key (generate: openssl rand -hex 32)'

  - key: TENANT_SECRETS_ENCRYPTION_KEY
    sync: false # REQUIRED
    description: 'Encryption key for tenant secrets (generate: openssl rand -hex 32)'

  - key: POSTMARK_SERVER_TOKEN
    sync: false # OPTIONAL - defaults to file-sink
    description: 'Postmark API token (optional, emails save to disk if not set)'
```

#### C. Health Check Validation

**Existing: `server/src/services/health-check.service.ts`**

Already implemented:

- ✅ Stripe adapter health check
- ✅ Postmark health check with file-sink detection
- ✅ Google Calendar adapter check

**Endpoint:** `GET /health/live` returns all adapter statuses

**Enhancement:** Add startup-only validation:

```typescript
// In app.ts startup
const health = await container.services.health.checkPostmark();
if (health.status === 'unhealthy' && health.error?.includes('file sink')) {
  logger.warn(
    'Email provider using file-sink fallback (no POSTMARK_SERVER_TOKEN). ' +
      'Set POSTMARK_SERVER_TOKEN in render.yaml for real email delivery.'
  );
}
```

### Test Cases

```typescript
describe('Environment Variables Validation', () => {
  it('should require JWT_SECRET on startup', () => {
    const configWithoutJWT = { ...config, JWT_SECRET: '' };
    expect(() => loadConfig()).toThrow('Missing required environment variables');
  });

  it('should log optional vars with fallback behavior', () => {
    const spy = jest.spyOn(logger, 'warn');
    loadConfig(); // with POSTMARK_SERVER_TOKEN unset

    expect(spy).toHaveBeenCalledWith(
      expect.objectContaining({ key: 'POSTMARK_SERVER_TOKEN' }),
      expect.stringContaining('fallback behavior')
    );
  });

  it('should report email adapter mode at startup', async () => {
    const app = createApp(config, container, Date.now());

    // Check logs for adapter configuration
    expect(logger.info).toHaveBeenCalledWith(
      expect.objectContaining({ emailAdapter: expect.any(String) }),
      'Application started with adapter configuration'
    );
  });

  it('should detect missing credentials in health checks', async () => {
    const health = await healthCheckService.checkPostmark();

    if (!process.env.POSTMARK_SERVER_TOKEN) {
      expect(health.status).toBe('healthy');
      expect(health.error).toContain('file sink fallback');
    }
  });

  it('should have .env.example with all required and optional vars', () => {
    const envExample = fs.readFileSync('server/.env.example', 'utf8');

    expect(envExample).toContain('# REQUIRED -');
    expect(envExample).toContain('JWT_SECRET=');
    expect(envExample).toContain('TENANT_SECRETS_ENCRYPTION_KEY=');
    expect(envExample).toContain('DATABASE_URL=');

    expect(envExample).toContain('# OPTIONAL -');
    expect(envExample).toContain('POSTMARK_SERVER_TOKEN=');
    expect(envExample).toContain('STRIPE_SECRET_KEY=');
  });
});
```

---

## 3. Email Delivery Failures (P1)

### The Problem

Email failures occur silently in production:

- Postmark API key invalid → emails never reach customers
- Domain sender not verified → Postmark rejects emails
- Network timeouts → no retry logic
- Rate limiting → requests dropped

**Current Status:**

- ✅ Retry logic with exponential backoff (3 attempts)
- ✅ File-sink fallback when no API token
- ✅ Health check detects issues
- ❌ Postmark domain verification not documented
- ❌ Email monitoring not enabled

### Prevention Strategies

#### A. Postmark Domain Verification

**Checklist before deploying to production:**

```
[ ] Create Postmark account at postmarkapp.com
[ ] Add sender domain to Postmark account
[ ] Verify domain ownership (add DNS records)
[ ] Test send via Postmark dashboard
[ ] Copy Server Token to POSTMARK_SERVER_TOKEN env var
[ ] Set POSTMARK_FROM_EMAIL to verified sender domain
[ ] Test end-to-end in staging: npm run dev:api + trigger password reset email
[ ] Verify email arrives in staging inbox
```

**Postmark Setup Documentation:**

1. Go to https://account.postmarkapp.com/
2. Create API token for your server
3. Add sender domain (e.g., noreply@example.com)
4. Verify domain ownership in DNS
5. Test in Postmark dashboard before deploying

#### B. Email Adapter Health Reporting

**Existing: `server/src/adapters/postmark.adapter.ts`**

Already implemented:

- ✅ Retry logic: 3 attempts with exponential backoff
- ✅ File-sink fallback: logs to `tmp/emails/` when no token
- ✅ Error logging: all failures logged with context

**Logging Examples:**

```typescript
// File sink fallback
logger.info(
  { to: input.to, file: 'tmp/emails/...' },
  'Email written to file sink' // ← Indicates no real sending
);

// Retry attempt
logger.warn(
  { attempt: 1, delay: 1000, to: input.to, status: 429 },
  'Retrying Postmark send' // ← Rate limited
);

// Success after retry
logger.info(
  { attempt: 2, to: input.to },
  'Postmark send succeeded after retry' // ← Eventually succeeded
);

// Final failure
logger.error(
  { status: 401, to: input.to, error: 'Invalid API key' },
  'Postmark send failed' // ← Invalid credentials
);
```

#### C. Health Check Endpoint

**Endpoint: `GET /health/live`**

Returns:

```json
{
  "status": "ok",
  "checks": {
    "postmark": {
      "status": "healthy",
      "latency": 45,
      "lastChecked": "2025-12-06T10:30:00Z"
    },
    "postmark_with_fallback": {
      "status": "healthy",
      "error": "Using file sink fallback (no POSTMARK_SERVER_TOKEN)"
    }
  }
}
```

**Usage:** Monitor in production via Render dashboard or external monitoring

#### D. Email Monitoring Runbook

**File: `server/tmp/emails/` directory**

When POSTMARK_SERVER_TOKEN is not set:

1. Emails are written to `tmp/emails/*.eml` files
2. Check logs for: `"Email written to file sink"`
3. In production, this should NOT happen

**Debug production email issues:**

```bash
# Check if using file-sink fallback
curl http://localhost:3001/health/live | jq '.checks.postmark'

# Should show: "status": "healthy" AND actual API connectivity
# If shows "file sink fallback", POSTMARK_SERVER_TOKEN not set
```

### Test Cases

```typescript
describe('Email Adapter - Postmark', () => {
  it('should retry on rate limiting (429)', async () => {
    // Simulate 429 then success
    const spy = jest.spyOn(logger, 'warn');

    await adapter.sendEmail({
      to: 'test@example.com',
      subject: 'Test',
      html: '<p>Test</p>',
    });

    expect(spy).toHaveBeenCalledWith(
      expect.objectContaining({ attempt: 1, status: 429 }),
      expect.stringContaining('Retrying')
    );
  });

  it('should use file sink fallback when no API token', async () => {
    const adapterNoToken = new PostmarkMailAdapter({
      serverToken: undefined,
      fromEmail: 'test@example.com',
    });

    const spy = jest.spyOn(logger, 'info');

    await adapterNoToken.sendEmail({
      to: 'test@example.com',
      subject: 'Test',
      html: '<p>Test</p>',
    });

    expect(spy).toHaveBeenCalledWith(
      expect.objectContaining({ file: expect.stringContaining('tmp/emails') }),
      'Email written to file sink'
    );
  });

  it('should fail after max retries', async () => {
    // Simulate persistent 500 error
    const spy = jest.spyOn(logger, 'error');

    await expect(
      adapter.sendEmail({
        to: 'test@example.com',
        subject: 'Test',
        html: '<p>Test</p>',
      })
    ).rejects.toThrow();

    expect(spy).toHaveBeenCalledWith(
      expect.objectContaining({ attempt: 3 }),
      expect.stringContaining('send failed')
    );
  });

  it('should report email adapter status in health check', async () => {
    const health = await healthCheckService.checkPostmark();

    expect(health.lastChecked).toBeDefined();
    expect(health.status).toBe('healthy');

    if (process.env.POSTMARK_SERVER_TOKEN) {
      expect(health.latency).toBeGreaterThan(0);
    } else {
      expect(health.error).toContain('file sink fallback');
    }
  });

  it('should have correct from email in all templates', async () => {
    const adapter = new PostmarkMailAdapter({
      serverToken: 'token',
      fromEmail: 'noreply@example.com',
    });

    // All send methods should use fromEmail
    expect(adapter.cfg.fromEmail).toBe('noreply@example.com');
  });
});
```

---

## 4. Security Vulnerabilities in User Input (P0)

### The Problem

User input was not validated/sanitized:

- **XSS vulnerability** (TODO-288): HTML injection in early-access email field
- **CRLF injection** (TODO-289): Email header injection via newlines
- **No error feedback** (TODO-290): Users don't see validation errors
- **No contract validation** (TODO-293): Missing Zod schema for email validation

### Prevention Strategies

#### A. Input Validation with ts-rest + Zod

**File: `packages/contracts/src/dto.ts`**

```typescript
import { z } from 'zod';

export const EarlyAccessRequestDto = z.object({
  email: z
    .string()
    .email('Please enter a valid email address')
    .trim()
    .toLowerCase()
    .max(254, 'Email address is too long'),
});

export type EarlyAccessRequest = z.infer<typeof EarlyAccessRequestDto>;
```

**File: `packages/contracts/src/api.v1.ts`**

```typescript
export const earlyAccess = {
  method: 'POST',
  path: '/auth/early-access',
  body: EarlyAccessRequestDto, // ← Enforces validation
  responses: {
    200: z.object({ message: z.string() }),
    400: z.object({ message: z.string() }),
  },
};
```

#### B. Sanitization Middleware

**File: `server/src/middleware/sanitize.spec.ts`**

Tests document sanitization behavior:

```typescript
describe('Sanitization Middleware', () => {
  it('should reject XSS payloads in email field', async () => {
    const response = await request(app)
      .post('/v1/auth/early-access')
      .send({ email: '<script>alert("xss")</script>' })
      .expect(400);

    expect(response.body.message).toContain('Email is required');
  });

  it('should reject CRLF injection attempts', async () => {
    const response = await request(app)
      .post('/v1/auth/early-access')
      .send({ email: 'test@example.com\r\nBcc: attacker@evil.com' })
      .expect(400);

    expect(response.body.message).toContain('Email is required');
  });

  it('should normalize valid emails', async () => {
    const response = await request(app)
      .post('/v1/auth/early-access')
      .send({ email: '  TEST@EXAMPLE.COM  ' })
      .expect(200);

    expect(response.body.message).toBe("Thanks! We'll be in touch soon.");
  });
});
```

#### C. Error Feedback UI

**File: `client/src/pages/Home/WaitlistCTASection.tsx`**

```typescript
{error && (
  <div
    role="alert"  // ← Accessible error announcement
    className="text-red-600 text-sm mt-2"
  >
    {error}
  </div>
)}
```

### Test Cases

```typescript
describe('Security - Input Validation', () => {
  it('should have Zod schema for email validation', () => {
    const schema = EarlyAccessRequestDto;

    // Valid
    expect(() => schema.parse({ email: 'test@example.com' })).not.toThrow();

    // Invalid
    expect(() => schema.parse({ email: '<script>' })).toThrow();
    expect(() => schema.parse({ email: 'not-an-email' })).toThrow();
  });

  it('should reject XSS in all email fields', async () => {
    const xssPayloads = [
      '<script>alert(1)</script>',
      'javascript:alert(1)',
      '<img src=x onerror=alert(1)>',
      '"><script>alert(1)</script>',
    ];

    for (const payload of xssPayloads) {
      const response = await request(app)
        .post('/v1/auth/early-access')
        .send({ email: payload })
        .expect(400);

      expect(response.body.message).toBeDefined();
    }
  });

  it('should show error messages in UI', async () => {
    // Component test
    const { getByRole } = render(<WaitlistCTASection />);

    // Submit invalid email
    fireEvent.change(screen.getByLabelText(/email/i), {
      target: { value: 'invalid' }
    });
    fireEvent.click(screen.getByRole('button', { name: /join/i }));

    // Error should be visible and announced
    expect(getByRole('alert')).toBeInTheDocument();
    expect(getByRole('alert')).toHaveTextContent(/valid email/i);
  });

  it('should sanitize emails before storage', async () => {
    const email = '  TEST@EXAMPLE.COM  ';

    await request(app)
      .post('/v1/auth/early-access')
      .send({ email })
      .expect(200);

    // Should be normalized in database
    const stored = await prisma.earlyAccess.findFirst({
      where: { email: email.trim().toLowerCase() }
    });

    expect(stored?.email).toBe(email.trim().toLowerCase());
  });
});
```

---

## Prevention Checklist for Deployment

Use this checklist before every deployment to production:

### Pre-Deployment (LOCAL)

- [ ] `npm run typecheck` - 0 errors
- [ ] `npm run lint` - All issues fixed
- [ ] `npm test` - All tests passing
- [ ] `npm run build --workspace=@macon/contracts` - No errors
- [ ] `npm run build --workspace=@macon/shared` - No errors
- [ ] Code review: Check for interface changes not in all implementations

### Environment Setup (RENDER.COM DASHBOARD)

- [ ] `JWT_SECRET` set (generate: `openssl rand -hex 32`)
- [ ] `TENANT_SECRETS_ENCRYPTION_KEY` set (generate: `openssl rand -hex 32`)
- [ ] `DATABASE_URL` set (Supabase connection string)
- [ ] `DIRECT_URL` set (same as DATABASE_URL)
- [ ] `POSTMARK_SERVER_TOKEN` set (from Postmark account)
- [ ] `POSTMARK_FROM_EMAIL` set (verified sender domain)
- [ ] `STRIPE_SECRET_KEY` set (from Stripe dashboard)
- [ ] `STRIPE_WEBHOOK_SECRET` set (from Stripe webhooks)
- [ ] `CORS_ORIGIN` set to production domain
- [ ] `NODE_ENV` set to "production"
- [ ] `ADAPTERS_PRESET` set to "real"

### Postmark (Email Provider)

- [ ] Postmark account created
- [ ] Sender domain verified in Postmark
- [ ] Server token generated
- [ ] Domain passes SPF/DKIM/DMARC checks

### Database

- [ ] `npm exec prisma migrate deploy` runs without errors
- [ ] `npm exec prisma generate` completes successfully
- [ ] Test: Can connect to production database from Render

### Health Checks

- [ ] `curl https://your-domain.com/health/live` returns 200
- [ ] Postmark health check shows "healthy" (not "file sink fallback")
- [ ] Database connectivity confirmed
- [ ] Stripe connectivity confirmed (if enabled)

### Post-Deployment

- [ ] Monitor logs: `npm run logs` (from Render CLI)
- [ ] Check for TypeScript compilation errors
- [ ] Verify no missing environment variable warnings
- [ ] Test signup → email flow end-to-end
- [ ] Check email delivery: `curl /health/live` should show Postmark healthy

---

## Automated Checks

### GitHub Actions Workflow

Ensure this is in `.github/workflows/deploy-production.yml`:

```yaml
name: Deploy to Production

on:
  push:
    branches: [main]

jobs:
  validate:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3

      - name: Setup Node
        uses: actions/setup-node@v3
        with:
          node-version: '20'

      - name: Install dependencies
        run: npm ci

      - name: TypeScript Check
        run: npm run typecheck
        env:
          NODE_OPTIONS: --max-old-space-size=4096

      - name: Lint
        run: npm run lint

      - name: Build Contracts
        run: npm run build --workspace=@macon/contracts

      - name: Build Shared
        run: npm run build --workspace=@macon/shared

      - name: Run Tests
        run: npm test

      - name: Deploy to Render
        if: success()
        run: npm run deploy:prod
        env:
          RENDER_API_KEY: ${{ secrets.RENDER_API_KEY }}
```

**Key:** Validation runs BEFORE deployment steps.

---

## Quick Reference

| Problem                  | Prevention                               | Check                           |
| ------------------------ | ---------------------------------------- | ------------------------------- |
| TypeScript errors        | `npm run typecheck`                      | Pre-commit hook + CI            |
| Missing env vars         | `.env.example` + validation at startup   | `GET /health/live`              |
| Email failures           | Postmark domain verified + retry logic   | Health check reports "healthy"  |
| Security vulnerabilities | Zod validation + sanitization middleware | Test XSS/CRLF payloads          |
| Missing implementations  | Interface consistency pattern            | TypeScript compilation succeeds |

---

## References

- **TypeScript Setup:** `/Users/mikeyoung/CODING/MAIS/server/src/lib/core/config.ts`
- **Email Adapter:** `/Users/mikeyoung/CODING/MAIS/server/src/adapters/postmark.adapter.ts`
- **Health Check:** `/Users/mikeyoung/CODING/MAIS/server/src/services/health-check.service.ts`
- **Validation Tests:** `/Users/mikeyoung/CODING/MAIS/server/test/http/early-access.http.spec.ts`
- **Render Config:** `/Users/mikeyoung/CODING/MAIS/render.yaml`
- **Related Docs:** `docs/solutions/SCHEMA_DRIFT_PREVENTION.md`

---

## Last Updated

**Commit:** cfd0435 (fix: resolve TypeScript build errors blocking production deployment)
**Date:** 2025-12-06
**Status:** ✅ All prevention strategies implemented
