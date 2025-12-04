# Environment Variables Reference

This document describes all environment variables used in the Elope API server.

## Quick Start

Copy `.env.example` to `.env` and update the values:

```bash
cp .env.example .env
```

## Required Variables

### Adapter Mode

```bash
ADAPTERS_PRESET=mock
```

**Values:**

- `mock` - Development mode with in-memory storage (no external dependencies)
- `real` - Production mode with PostgreSQL, Stripe, email, calendar

**When to use:**

- Development: `mock` (fastest setup)
- Testing: `real` (integration tests)
- Production: `real` (live system)

### Server Configuration

```bash
API_PORT=3001
CORS_ORIGIN=http://localhost:3000
```

**API_PORT** - Port for the API server (default: 3001)
**CORS_ORIGIN** - Allowed origin for CORS (frontend URL)

**Production example:**

```bash
API_PORT=3001
CORS_ORIGIN=https://yourdomain.com
```

### JWT Authentication

```bash
JWT_SECRET=change-me
```

**JWT_SECRET** - Secret key for signing JWT tokens

**Security:**

- MUST be at least 32 characters in production
- Use a cryptographically random string
- Never commit to version control
- Rotate periodically

**Generate secure secret:**

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

## Database Configuration

### PostgreSQL

```bash
DATABASE_URL=postgresql://user:pass@host:5432/db?sslmode=require
```

**Required when:** `ADAPTERS_PRESET=real`

**Format:** `postgresql://[user]:[password]@[host]:[port]/[database]?sslmode=require`

**Example (local):**

```bash
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/elope_dev?sslmode=disable
```

**Example (production - Supabase):**

```bash
DATABASE_URL=postgresql://postgres.xxxxx:password@aws-0-us-east-1.pooler.supabase.com:5432/postgres?sslmode=require
```

**Security:**

- Always use SSL in production (`sslmode=require`)
- Use connection pooling for better performance
- Rotate passwords regularly
- Never expose credentials

## Stripe Configuration

### API Keys

```bash
STRIPE_SECRET_KEY=sk_test_xxx
STRIPE_PUBLISHABLE_KEY=pk_test_xxx
```

**STRIPE_SECRET_KEY** - Server-side API key (required)
**STRIPE_PUBLISHABLE_KEY** - Client-side API key (optional, for reference)

**Get your keys:**

1. Go to https://dashboard.stripe.com/apikeys
2. Test mode: Use keys starting with `sk_test_` and `pk_test_`
3. Live mode: Use keys starting with `sk_live_` and `pk_live_`

**Security:**

- NEVER commit secret keys to version control
- NEVER expose secret keys to client-side code
- Use test keys for development
- Use live keys only in production

**Test mode example:**

```bash
STRIPE_SECRET_KEY=sk_test_51ABC123...
STRIPE_PUBLISHABLE_KEY=pk_test_51ABC123...
```

**Production example:**

```bash
STRIPE_SECRET_KEY=sk_live_51ABC123...
STRIPE_PUBLISHABLE_KEY=pk_live_51ABC123...
```

### Webhook Configuration

```bash
STRIPE_WEBHOOK_SECRET=whsec_xxx
```

**STRIPE_WEBHOOK_SECRET** - Webhook signing secret for verifying webhook events

**Get your webhook secret:**

**Option 1: Stripe CLI (Development)**

```bash
# Install Stripe CLI
brew install stripe/stripe-cli/stripe

# Login
stripe login

# Forward webhooks to local server
stripe listen --forward-to localhost:3001/api/webhooks/stripe

# Copy the webhook signing secret (whsec_...)
```

**Option 2: Stripe Dashboard (Production)**

1. Go to https://dashboard.stripe.com/webhooks
2. Click "Add endpoint"
3. URL: `https://yourdomain.com/api/webhooks/stripe`
4. Events: Select all `payment_intent.*`, `charge.refunded`, `account.updated`
5. Copy the "Signing secret"

**Important:**

- Test and production have different webhook secrets
- Webhook signature verification is REQUIRED for security
- Never skip webhook verification in production

### Checkout URLs

```bash
STRIPE_SUCCESS_URL=http://localhost:3000/success
STRIPE_CANCEL_URL=http://localhost:3000
```

**STRIPE_SUCCESS_URL** - Redirect URL after successful payment
**STRIPE_CANCEL_URL** - Redirect URL if user cancels payment

**Production example:**

```bash
STRIPE_SUCCESS_URL=https://yourdomain.com/booking-confirmed
STRIPE_CANCEL_URL=https://yourdomain.com/booking
```

**Session ID parameter:**
The success URL will receive a `session_id` query parameter:

```
https://yourdomain.com/success?session_id=cs_test_xxx
```

## Email Configuration (Optional)

### Postmark

```bash
POSTMARK_SERVER_TOKEN=
POSTMARK_FROM_EMAIL=bookings@example.com
```

**Required when:** `ADAPTERS_PRESET=real` and sending emails

**POSTMARK_SERVER_TOKEN** - API token from Postmark
**POSTMARK_FROM_EMAIL** - Sender email address (must be verified in Postmark)

**Get Postmark token:**

1. Sign up at https://postmarkapp.com
2. Create a server
3. Copy the "Server API Token"
4. Verify your sender signature/domain

**Example:**

```bash
POSTMARK_SERVER_TOKEN=abc123-def456-ghi789
POSTMARK_FROM_EMAIL=noreply@yourdomain.com
```

**Fallback behavior:**
If `POSTMARK_SERVER_TOKEN` is empty, emails will be written to:

```
/tmp/emails/email-{timestamp}.json
```

## Google Calendar Configuration (Optional)

```bash
GOOGLE_CALENDAR_ID=
GOOGLE_SERVICE_ACCOUNT_JSON_BASE64=
```

**Required when:** `ADAPTERS_PRESET=real` and syncing calendar

**GOOGLE_CALENDAR_ID** - Calendar ID (usually your email)
**GOOGLE_SERVICE_ACCOUNT_JSON_BASE64** - Base64-encoded service account JSON

**Setup instructions:**

**Step 1: Create Service Account**

1. Go to https://console.cloud.google.com/iam-admin/serviceaccounts
2. Create project (if needed)
3. Create service account
4. Download JSON key file

**Step 2: Encode JSON**

```bash
# Base64 encode the JSON file
cat service-account.json | base64
```

**Step 3: Share Calendar**

1. Open Google Calendar
2. Settings → Calendar settings
3. Share with the service account email
4. Grant "Make changes to events" permission

**Example:**

```bash
GOOGLE_CALENDAR_ID=you@gmail.com
GOOGLE_SERVICE_ACCOUNT_JSON_BASE64=ewogICJ0eXBlIjog...
```

**Fallback behavior:**
If empty, a mock calendar adapter is used (in-memory only).

## Admin Configuration

### Default Password

```bash
ADMIN_DEFAULT_PASSWORD=ChangeThisToAStrongPassword123!
```

**ADMIN_DEFAULT_PASSWORD** - Default password for admin user (created during seed)

**Requirements:**

- Minimum 12 characters
- Must include uppercase, lowercase, numbers, special characters

**Security:**

- ALWAYS change this before deploying
- Use a password manager to generate
- Rotate regularly
- Never use common passwords

**Generate strong password:**

```bash
node -e "console.log(require('crypto').randomBytes(16).toString('base64'))"
```

## Environment-Specific Examples

### Development (Mock Mode)

```bash
# Minimal setup - no external dependencies
ADAPTERS_PRESET=mock
API_PORT=3001
CORS_ORIGIN=http://localhost:3000
JWT_SECRET=dev-secret-key-change-in-production
ADMIN_DEFAULT_PASSWORD=DevPassword123!
```

### Development (Real Mode)

```bash
# Full setup with external services
ADAPTERS_PRESET=real
API_PORT=3001
CORS_ORIGIN=http://localhost:3000

# JWT
JWT_SECRET=change-me

# Database
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/elope_dev?sslmode=disable

# Stripe (test mode)
STRIPE_SECRET_KEY=sk_test_51ABC123...
STRIPE_PUBLISHABLE_KEY=pk_test_51ABC123...
STRIPE_WEBHOOK_SECRET=whsec_123...
STRIPE_SUCCESS_URL=http://localhost:3000/success
STRIPE_CANCEL_URL=http://localhost:3000

# Email (optional)
POSTMARK_SERVER_TOKEN=
POSTMARK_FROM_EMAIL=dev@example.com

# Calendar (optional)
GOOGLE_CALENDAR_ID=
GOOGLE_SERVICE_ACCOUNT_JSON_BASE64=

# Admin
ADMIN_DEFAULT_PASSWORD=DevPassword123!
```

### Production

```bash
# Production configuration
ADAPTERS_PRESET=real
API_PORT=3001
CORS_ORIGIN=https://yourdomain.com

# JWT (MUST be strong random key)
JWT_SECRET=<64-character-random-hex-string>

# Database (with SSL)
DATABASE_URL=postgresql://user:password@host:5432/db?sslmode=require

# Stripe (LIVE mode - be careful!)
STRIPE_SECRET_KEY=sk_live_51ABC123...
STRIPE_PUBLISHABLE_KEY=pk_live_51ABC123...
STRIPE_WEBHOOK_SECRET=whsec_live_123...
STRIPE_SUCCESS_URL=https://yourdomain.com/booking-confirmed
STRIPE_CANCEL_URL=https://yourdomain.com/booking

# Email
POSTMARK_SERVER_TOKEN=abc-def-ghi
POSTMARK_FROM_EMAIL=noreply@yourdomain.com

# Calendar
GOOGLE_CALENDAR_ID=team@yourdomain.com
GOOGLE_SERVICE_ACCOUNT_JSON_BASE64=ewogICJ0...

# Admin (MUST be strong password)
ADMIN_DEFAULT_PASSWORD=<strong-random-password>
```

## Security Checklist

Before deploying to production, verify:

- [ ] All secrets are cryptographically random
- [ ] JWT_SECRET is at least 32 characters
- [ ] ADMIN_DEFAULT_PASSWORD is strong (12+ chars)
- [ ] DATABASE_URL uses SSL (`sslmode=require`)
- [ ] Stripe uses LIVE keys (not test keys)
- [ ] STRIPE_WEBHOOK_SECRET matches production webhook
- [ ] CORS_ORIGIN matches production domain (no wildcards)
- [ ] No secrets committed to version control
- [ ] .env file is in .gitignore
- [ ] Environment variables set in hosting platform (Vercel, Heroku, etc.)

## Troubleshooting

### "STRIPE_SECRET_KEY not found"

**Solution:** Add `STRIPE_SECRET_KEY=sk_test_...` to your `.env` file

### "Webhook signature verification failed"

**Solution:** Update `STRIPE_WEBHOOK_SECRET` with value from `stripe listen` or Stripe Dashboard

### "Database connection failed"

**Solution:** Verify `DATABASE_URL` is correct and database is running

### "CORS error"

**Solution:** Update `CORS_ORIGIN` to match your frontend URL

### "JWT token invalid"

**Solution:** Ensure `JWT_SECRET` is the same across all server instances

## Next Steps

1. Copy `.env.example` to `.env`
2. Update required variables for your environment
3. Run `npm run doctor` to verify configuration
4. Start development: `npm run dev`
5. Test Stripe integration: `npm run test:stripe-connect`

## Support

- Stripe: https://stripe.com/docs
- Postmark: https://postmarkapp.com/support
- Google Calendar API: https://developers.google.com/calendar
- PostgreSQL: https://www.postgresql.org/docs/
