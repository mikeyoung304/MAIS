# Runbook

## Secrets & Doctor

Before starting development, validate your environment configuration using the doctor script:

```bash
npm run doctor
# or from the api directory:
npm run doctor
```

### Doctor Output Examples

**Mock mode (all good):**

```
🏥 Environment Configuration Doctor

Checking environment variables...

Mode: MOCK

Core Configuration:
  ✓ ADAPTERS_PRESET [optional]
    Adapter mode (mock or real)
  ✓ JWT_SECRET [optional]
    JWT signing secret (MUST change in production)
  ✓ API_PORT [optional]
    API server port (default: 3001)
  ✓ CORS_ORIGIN [optional]
    CORS origin (default: http://localhost:3000)

📝 Mock mode active - database, Stripe, Postmark, and Google Calendar not required

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

✅ All required variables are set!

💡 Run `npm run dev:api` to start the API server
   See RUNBOOK.md for more troubleshooting help.
```

**Real mode (missing required vars):**

```
🏥 Environment Configuration Doctor

Mode: REAL

Core Configuration:
  ✓ ADAPTERS_PRESET [optional]
  ✓ JWT_SECRET [optional]
  ✓ API_PORT [optional]
  ✓ CORS_ORIGIN [optional]

Database (PostgreSQL):
  ✗ DATABASE_URL [REQUIRED]
    PostgreSQL connection string
    Not set

Payment Processing (Stripe):
  ✗ STRIPE_SECRET_KEY [REQUIRED]
    Stripe API secret key
    Not set
  ✗ STRIPE_WEBHOOK_SECRET [REQUIRED]
    Stripe webhook signing secret
    Not set
  ✓ STRIPE_SUCCESS_URL [optional]
  ✓ STRIPE_CANCEL_URL [optional]

Email (Postmark):
  ⚠ POSTMARK_SERVER_TOKEN [optional]
    Email API token (fallback: file-sink)
    Not set
  ⚠ POSTMARK_FROM_EMAIL [optional]
    From email address
    Not set

Calendar Integration (Google Calendar):
  ⚠ GOOGLE_CALENDAR_ID [optional]
    Calendar ID (fallback: mock calendar)
    Not set
  ⚠ GOOGLE_SERVICE_ACCOUNT_JSON_BASE64 [optional]
    Base64 service account JSON
    Not set

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

❌ 3 required variable(s) missing:
   - DATABASE_URL
   - STRIPE_SECRET_KEY
   - STRIPE_WEBHOOK_SECRET

Fix these issues before running in real mode.
See SECRETS.md for details on each variable.

⚠️  4 optional variable(s) missing (graceful fallbacks active):
   - POSTMARK_SERVER_TOKEN
   - POSTMARK_FROM_EMAIL
   - GOOGLE_CALENDAR_ID
   - GOOGLE_SERVICE_ACCOUNT_JSON_BASE64
```

### Fixing Missing Variables

1. **Copy the example env file:**

   ```bash
   cp server/.env.example server/.env
   ```

2. **Edit `server/.env` with your values:**
   - See `SECRETS.md` for detailed documentation on each variable
   - For mock mode: only `JWT_SECRET` is required (already set in example)
   - For real mode: you'll need database, Stripe, and optionally Postmark/GCal credentials

3. **Re-run the doctor to verify:**

   ```bash
   npm run doctor
   ```

4. **Common issues:**
   - **JWT_SECRET not set**: Add a secure random string (e.g., `openssl rand -hex 32`)
   - **Real mode missing DB**: See "Database Setup" section below
   - **Real mode missing Stripe**: See "Stripe Local Testing" section below
   - **Optional services**: Postmark and Google Calendar are optional in real mode (graceful fallbacks)

See `SECRETS.md` for the complete environment variable reference.

## Local dev

```bash
# Mock mode default
npm run dev:api
npm run dev:client
```

### Dev simulators (mock mode only)

- `POST /v1/dev/simulate-checkout-completed` — mark a session as paid
- `GET /v1/dev/debug-state` — inspect in‑memory data

## Switching to real mode ✅ COMPLETE

Real mode is now fully operational with:

- **PostgreSQL**: Prisma ORM with migrations + seed data
- **Stripe**: Test mode with webhook support
- **Email**: File-sink fallback (Postmark optional)
- **Calendar**: Mock fallback (Google Calendar optional)

### Setup Steps:

1. Set `ADAPTERS_PRESET=real` in `server/.env`
2. Configure `DATABASE_URL` and run migrations
3. Seed database: creates admin (`admin@example.com` / `admin`)
4. Add Stripe test keys (`STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`)
5. Start Stripe webhook forwarder: `stripe listen --forward-to localhost:3001/v1/webhooks/stripe`
6. (Optional) Configure Postmark for real email delivery
7. (Optional) Share Google Calendar with service account

## Stripe Local Testing

### Prerequisites

1. **Get Stripe test keys:**
   - Go to https://dashboard.stripe.com/test/apikeys
   - Copy your **Secret key** (starts with `sk_test_`)
   - Add it to `server/.env`:
     ```
     STRIPE_SECRET_KEY=sk_test_xxx
     ```

2. **Install Stripe CLI:**

   ```bash
   brew install stripe/stripe-cli/stripe
   # or download from https://stripe.com/docs/stripe-cli
   ```

3. **Login to Stripe:**
   ```bash
   stripe login
   ```

### Testing Webhooks Locally

1. **Start the webhook forwarder:**

   ```bash
   stripe listen --forward-to localhost:3001/v1/webhooks/stripe
   ```

   This will output a webhook signing secret like `whsec_xxx...`

2. **Update your `.env`:**

   ```
   STRIPE_WEBHOOK_SECRET=whsec_xxx...
   ```

3. **Restart the API:**

   ```bash
   npm run dev:api:real
   ```

4. **Test a checkout:**
   - Use Stripe test card: `4242 4242 4242 4242`
   - Any future date, any CVC, any ZIP
   - Complete the payment flow
   - The webhook will be forwarded to your local API

5. **Verify the booking:**
   ```bash
   curl http://localhost:3001/v1/admin/bookings
   ```

### Stripe CLI Webhook Testing

You can also trigger test webhooks manually:

```bash
# Simulate a successful checkout
stripe trigger checkout.session.completed
```

**Note:** Manual triggers won't include real booking metadata. Use the full checkout flow for realistic testing.

## Email (Postmark)

### Setup for Production

1. **Sign up for Postmark:**
   - Create an account at https://postmarkapp.com
   - Create a new server or use the default one

2. **Verify your sender domain:**
   - Go to **Sender Signatures** in your Postmark dashboard
   - Add and verify your sending email address or domain
   - Follow DNS verification steps (SPF, DKIM, Return-Path)

3. **Get your Server API Token:**
   - Go to your server settings
   - Copy the **Server API Token** (format: `xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx`)
   - Add it to `server/.env`:
     ```
     POSTMARK_SERVER_TOKEN=your-token-here
     POSTMARK_FROM_EMAIL=bookings@yourdomain.com
     ```

### Dev Mode - File Sink Fallback

**In real mode without Postmark credentials**, emails are written to `server/tmp/emails/` as `.eml` files:

```bash
# Leave POSTMARK_SERVER_TOKEN empty for file-sink mode
POSTMARK_SERVER_TOKEN=
POSTMARK_FROM_EMAIL=bookings@example.com
```

Each email is saved with a timestamp and recipient filename. Check the API logs for file paths.

### Testing Email Flow

1. **With file sink (no token):**
   - Complete a booking in real mode
   - Check `server/tmp/emails/` for the confirmation email file
   - View the raw email content

2. **With Postmark (token set):**
   - Complete a booking
   - Check your Postmark dashboard → Activity for sent emails
   - Verify delivery to the customer email

## Google Calendar Integration

### Setup for Production

The API uses Google Calendar's **freeBusy API** to check date availability. Results are cached for 60 seconds to minimize API calls.

**Requirements:**

- Google Cloud project with Calendar API enabled
- Service account with calendar read access
- Calendar shared with the service account

### Step-by-Step Setup

1. **Create a Google Cloud Project:**
   - Go to https://console.cloud.google.com/
   - Create a new project (or use an existing one)

2. **Enable the Google Calendar API:**
   - In the Cloud Console, go to **APIs & Services** → **Library**
   - Search for "Google Calendar API"
   - Click **Enable**

3. **Create a Service Account:**
   - Go to **IAM & Admin** → **Service Accounts**
   - Click **Create Service Account**
   - Give it a name (e.g., "MAIS Calendar Reader")
   - Click **Create and Continue**
   - Skip the optional permissions
   - Click **Done**

4. **Generate Service Account Key:**
   - Click on your newly created service account
   - Go to the **Keys** tab
   - Click **Add Key** → **Create new key**
   - Choose **JSON** format
   - Download the JSON file (keep it secure!)

5. **Encode the Service Account JSON:**

   ```bash
   # macOS/Linux:
   cat service-account.json | base64

   # Copy the output and add to .env:
   GOOGLE_SERVICE_ACCOUNT_JSON_BASE64=<base64-encoded-json>
   ```

6. **Share Your Calendar:**
   - Open Google Calendar (https://calendar.google.com)
   - Find the calendar you want to integrate
   - Click the three dots → **Settings and sharing**
   - Scroll to **Share with specific people**
   - Click **Add people**
   - Paste the service account email (from the JSON file, looks like: `xxx@xxx.iam.gserviceaccount.com`)
   - Set permission to **See only free/busy (hide details)**
   - Click **Send**

7. **Get Your Calendar ID:**
   - In the same calendar settings page
   - Scroll to **Integrate calendar**
   - Copy the **Calendar ID** (usually looks like: `your-email@gmail.com` or `xxxxx@group.calendar.google.com`)
   - Add it to `server/.env`:
     ```
     GOOGLE_CALENDAR_ID=your-calendar-id@gmail.com
     ```

### Dev Mode - Mock Calendar Fallback

**In real mode without Google Calendar credentials**, a mock calendar adapter is used (all dates return as available):

```bash
# Leave credentials empty for mock fallback
GOOGLE_CALENDAR_ID=
GOOGLE_SERVICE_ACCOUNT_JSON_BASE64=
```

The API will log a warning on startup and gracefully degrade to the mock behavior.

### Testing Calendar Integration

1. **With mock calendar (no credentials):**
   - All dates will show as available
   - API logs: `⚠️  Google Calendar credentials not configured; using mock calendar`

2. **With Google Calendar (credentials set):**
   - Create an event in your Google Calendar
   - Query the availability API for that date:
     ```bash
     curl http://localhost:3001/v1/availability/check/2025-10-20
     # Should return available: false if the date has events
     ```
   - Check API logs for successful freeBusy API calls
   - Results are cached for 60 seconds

### Troubleshooting

- **401 Unauthorized:** Check service account JSON is valid and base64 encoded correctly
- **403 Forbidden:** Ensure Calendar API is enabled in Google Cloud Console
- **404 Not Found:** Verify calendar is shared with the service account email
- **All dates showing available:** Check GOOGLE_CALENDAR_ID matches the shared calendar

## Production checks

### Health endpoints

**Liveness check** — Always returns 200 OK:

```bash
curl http://localhost:3001/health
# {"ok":true}
```

**Readiness check** — Verifies configuration:

```bash
# Mock mode — always ready
curl http://localhost:3001/ready
# {"ok":true,"mode":"mock"}

# Real mode — checks required env vars
curl http://localhost:3001/ready
# Success: {"ok":true,"mode":"real"}
# Missing keys: {"ok":false,"missing":["DATABASE_URL","STRIPE_SECRET_KEY",...]}
```

If `/ready` returns `ok: false`, check your `.env` file and ensure all required keys are set:

- `DATABASE_URL`
- `STRIPE_SECRET_KEY`
- `STRIPE_WEBHOOK_SECRET`
- `POSTMARK_FROM_EMAIL` (POSTMARK_SERVER_TOKEN optional; uses file sink if empty)
- `GOOGLE_CALENDAR_ID`
- `GOOGLE_SERVICE_ACCOUNT_JSON_BASE64`

### Logging & Monitoring

- **Logging:** pino JSON with `requestId` on every request
- **Monitoring:** attach Sentry or log drain

---

## Security Monitoring ✅ COMPLETE

### Login Rate Limiting

**Status:** ✅ Implemented (2025-11-07)

All login endpoints are protected with automatic rate limiting:

**Configuration:**

- **Limit:** 5 failed attempts per 15-minute window
- **Scope:** Per IP address
- **Endpoints:**
  - `POST /v1/admin/login`
  - `POST /v1/tenant-auth/login`

**Testing Rate Limiting:**

```bash
cd server
./test-login-rate-limit.sh

# Or test manually
curl -X POST http://localhost:3000/v1/tenant-auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"wrong"}'
```

**Expected Results:**

- Attempts 1-5: HTTP 401 (Invalid credentials)
- Attempt 6+: HTTP 429 (Too many requests)

### Security Logging

All security events are logged with structured data for monitoring and alerting.

**Failed Login Attempts:**

```bash
# View failed login attempts
grep "login_failed" server/logs/*.log

# Example log entry:
{
  "level": "warn",
  "event": "tenant_login_failed",
  "endpoint": "/v1/tenant-auth/login",
  "email": "test@example.com",
  "ipAddress": "192.168.1.1",
  "timestamp": "2025-11-07T10:30:00.000Z",
  "error": "Invalid credentials"
}
```

**Rate Limit Hits:**

```bash
# Monitor for potential attacks
grep "429" server/logs/*.log
grep "too_many_login_attempts" server/logs/*.log
```

### Security Monitoring Checklist

**Daily Monitoring:**

- [ ] Check for unusual spike in failed login attempts
- [ ] Review rate limit hits (429 responses)
- [ ] Monitor for distributed attacks (multiple IPs targeting same email)
- [ ] Check for geographic anomalies in failed attempts

**Weekly Reviews:**

- [ ] Analyze failed login patterns
- [ ] Review security logs for suspicious activity
- [ ] Verify rate limiting effectiveness
- [ ] Check for credential stuffing attempts

**Monthly Tasks:**

- [ ] Review and rotate JWT_SECRET if needed
- [ ] Audit tenant API keys
- [ ] Review Stripe webhook logs
- [ ] Update security documentation

### Setting Up Alerts

**Recommended Alerting Rules:**

1. **High Volume of Failed Logins:**
   - Alert: More than 20 failed logins in 5 minutes
   - Action: Investigate for coordinated attack

2. **Rate Limit Threshold:**
   - Alert: More than 10 rate limit hits (429) in 10 minutes
   - Action: Review source IPs and patterns

3. **Targeted Email Attacks:**
   - Alert: Same email attempted from 5+ different IPs
   - Action: Possible credential stuffing attack

4. **Webhook Failures:**
   - Alert: Stripe webhook signature verification failures
   - Action: Verify webhook secret is current

**Example Alert Configuration (Datadog/Sentry/CloudWatch):**

```
Alert: security-failed-logins-spike
Metric: count(log.event:login_failed)
Threshold: > 20 in 5 minutes
Notification: security-team-channel
```

### Responding to Security Events

**Brute Force Attack Detected:**

1. Verify rate limiting is active (check logs)
2. Identify attacking IP addresses
3. Consider temporary IP blocking if severe
4. Review logs for successful compromises
5. Document incident and response

**Credential Stuffing Detected:**

1. Identify targeted email accounts
2. Force password reset for affected accounts
3. Notify affected users if any successful logins
4. Enhance monitoring on affected accounts
5. Consider implementing CAPTCHA

**Rate Limit Bypass Attempt:**

1. Verify distributed attack pattern
2. Check for proxy/VPN usage
3. Consider implementing additional protections
4. Review rate limiting effectiveness
5. Update security policies if needed

### Production Security Considerations

**Multi-Server Deployments:**

For production with multiple servers, rate limiting requires shared storage:

**Option 1: Redis (Recommended)**

```bash
# Install Redis
brew install redis  # or use cloud provider

# Configure rate limiter
REDIS_URL=redis://localhost:6379
```

**Option 2: Sticky Sessions**

- Configure load balancer for IP-based session affinity
- Ensures same IP always routes to same server

**Security Documentation:**

- [SECURITY.md](../security/SECURITY.md) - Complete security documentation
- [SECRET_ROTATION_GUIDE.md](../security/SECRET_ROTATION_GUIDE.md) - Secret rotation procedures
- [IMMEDIATE_SECURITY_ACTIONS.md](../security/IMMEDIATE_SECURITY_ACTIONS.md) - Urgent action items
- [server/LOGIN_RATE_LIMITING.md](../../server/LOGIN_RATE_LIMITING.md) - Rate limiting implementation

---

## Multi-Tenant Operations

### Current Feature Availability

**Phase 4 (Current Production):**

- Tenant branding customization (logo, colors, fonts)
- Package CRUD operations
- Blackout date management
- Read-only booking views
- CSV export for bookings

**Phase 5 (Coming Soon):**

- Add-on management
- Package photo uploads
- Email template customization

### Tenant Support Common Issues

**Issue: "Tenant can't see their packages"**

```bash
# Check if tenant exists and has packages
psql $DATABASE_URL -c "SELECT id, name, slug FROM tenants WHERE slug = 'tenant-slug';"
psql $DATABASE_URL -c "SELECT id, title, \"isActive\" FROM packages WHERE \"tenantId\" = 'tenant-id';"
```

**Issue: "Tenant login not working"**

```bash
# Check tenant admin exists
psql $DATABASE_URL -c "SELECT id, email FROM users WHERE email = 'admin@example.com' AND \"isTenantAdmin\" = true;"

# Check rate limiting (may be blocked after 5 failed attempts)
# Rate limits reset after 15 minutes
```

**Issue: "Branding not applying"**

```bash
# Check branding configuration
psql $DATABASE_URL -c "SELECT branding FROM tenants WHERE id = 'tenant-id';"

# Should return JSON: {"primaryColor": "#...", "secondaryColor": "#...", "fontFamily": "...", "logo": "..."}
```

**Issue: "Uploaded logo not displaying"**

```bash
# Verify file exists
ls -lh server/uploads/logos/

# Check file is served correctly
curl http://localhost:3001/uploads/logos/logo-filename.png
```

### Operational Limits (Phase 4)

- **Packages per tenant**: Unlimited (recommended max 20 for UX)
- **Blackout dates per tenant**: Unlimited
- **Logo file size**: 2MB max
- **Bookings per tenant**: Unlimited
- **Admin users per tenant**: 1 (currently, will expand in Phase 6)

### Phase 5 Operational Notes

**When Phase 5 deploys:**

- Add-ons will become tenant-scoped (existing global add-ons need migration)
- Package photo upload will increase storage requirements (monitor disk usage)
- Email templates stored in database (backup strategy critical)

**Pre-Phase 5 Checklist:**

- [ ] Backup database before migration
- [ ] Ensure adequate disk space for package photos (estimate 5MB × packages × 5 photos)
- [ ] Configure email service (SendGrid/SES) for template rendering
- [ ] Set up cloud storage if migrating from local filesystem

**Monitoring Phase 5 Features:**

```bash
# Check add-on counts per tenant
psql $DATABASE_URL -c "SELECT \"tenantId\", COUNT(*) FROM add_ons GROUP BY \"tenantId\";"

# Check package photo storage usage
du -sh server/uploads/packages/

# Check email template customization rate
psql $DATABASE_URL -c "SELECT type, COUNT(*) FROM email_templates GROUP BY type;"
```

---
