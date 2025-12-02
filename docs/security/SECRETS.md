# Secrets Matrix

This document lists every environment variable used in the MAIS API, organized by feature. Use the `npm run doctor` script to validate your configuration.

---

## Core Configuration

### `ADAPTERS_PRESET`
- **Mode**: Both (mock/real)
- **Required**: Yes (defaults to `mock`)
- **Used in**: `server/src/core/config.ts:11`, `server/src/di.ts:51`
- **Purpose**: Controls whether to use mock or real adapters (database, payments, email, calendar)
- **Valid values**: `mock`, `real`

### `NODE_ENV`
- **Mode**: Both
- **Required**: No (defaults to development)
- **Used in**: `server/src/core/logger.ts:7`
- **Purpose**: Sets the Node.js environment (affects logging behavior)
- **Valid values**: `development`, `production`

### `LOG_LEVEL`
- **Mode**: Both
- **Required**: No (defaults to `info`)
- **Used in**: `server/src/core/logger.ts:10`
- **Purpose**: Controls log verbosity
- **Valid values**: `trace`, `debug`, `info`, `warn`, `error`, `fatal`

### `API_PORT`
- **Mode**: Both
- **Required**: No (defaults to `3001`)
- **Used in**: `server/src/core/config.ts:12`, `server/src/index.ts`
- **Purpose**: Port for the API server to listen on
- **Example**: `3001`

### `CORS_ORIGIN`
- **Mode**: Both
- **Required**: No (defaults to `http://localhost:5173`)
- **Used in**: `server/src/core/config.ts:13`, `server/src/index.ts`
- **Purpose**: Allowed origin for CORS requests (typically the frontend URL)
- **Example**: `http://localhost:5173`, `https://yourdomain.com`

---

## Authentication

### `JWT_SECRET`
- **Mode**: Both (mock/real)
- **Required**: ✅ **Yes**
- **Used in**: `server/src/core/config.ts:14`, `server/src/di.ts:69,148`
- **Purpose**: Secret key for signing and verifying JWT tokens for admin authentication
- **Example**: `your-super-secret-jwt-key-change-me-in-production`
- **Security**: MUST be changed from default in production; use a strong random string

---

## Database (PostgreSQL + Prisma)

### `DATABASE_URL`
- **Mode**: Real only
- **Required**: ✅ **Yes in real mode** (mock mode uses in-memory storage)
- **Used in**: `server/src/core/config.ts:16`, `server/src/di.ts:93-94`
- **Purpose**: PostgreSQL connection string for Prisma
- **Example**: `postgresql://username:password@localhost:5432/elope_dev?schema=public`
- **Format**: `postgresql://USER:PASSWORD@HOST:PORT/DATABASE?schema=SCHEMA`
- **Error if missing (real mode)**: `DATABASE_URL required for real adapters mode`

---

## Payment Processing (Stripe)

### `STRIPE_SECRET_KEY`
- **Mode**: Real only
- **Required**: ✅ **Yes in real mode**
- **Used in**: `server/src/core/config.ts:17`, `server/src/di.ts:109-110`, `server/src/adapters/stripe.adapter.ts`
- **Purpose**: Stripe API secret key for creating checkout sessions and processing payments
- **Example**: `sk_test_51ABC...` (test) or `sk_live_51ABC...` (production)
- **Where to get**: [Stripe Dashboard → API Keys](https://dashboard.stripe.com/test/apikeys)
- **Error if missing (real mode)**: `STRIPE_SECRET_KEY and STRIPE_WEBHOOK_SECRET required for real adapters mode`

### `STRIPE_WEBHOOK_SECRET`
- **Mode**: Real only
- **Required**: ✅ **Yes in real mode**
- **Used in**: `server/src/core/config.ts:18`, `server/src/di.ts:109-110`, `server/src/adapters/stripe.adapter.ts`
- **Purpose**: Webhook signing secret for verifying Stripe webhook events
- **Example**: `whsec_ABC123...`
- **Where to get**: [Stripe Dashboard → Webhooks](https://dashboard.stripe.com/test/webhooks) (create endpoint for `/api/v1/webhooks/stripe`)
- **Error if missing (real mode)**: `STRIPE_SECRET_KEY and STRIPE_WEBHOOK_SECRET required for real adapters mode`

### `STRIPE_SUCCESS_URL`
- **Mode**: Real only
- **Required**: No (defaults to `http://localhost:5173/success`)
- **Used in**: `server/src/core/config.ts:19`, `server/src/di.ts:116`
- **Purpose**: URL to redirect customers after successful payment
- **Example**: `http://localhost:5173/success`, `https://yourdomain.com/booking-confirmed`

### `STRIPE_CANCEL_URL`
- **Mode**: Real only
- **Required**: No (defaults to `http://localhost:5173`)
- **Used in**: `server/src/core/config.ts:20`, `server/src/di.ts:117`
- **Purpose**: URL to redirect customers if they cancel payment
- **Example**: `http://localhost:5173`, `https://yourdomain.com/booking-cancelled`

---

## Email (Postmark)

### `POSTMARK_SERVER_TOKEN`
- **Mode**: Real only
- **Required**: ⚠️ **No** (falls back to file-sink in `tmp/emails/`)
- **Used in**: `server/src/core/config.ts:21`, `server/src/di.ts:122`, `server/src/adapters/postmark.adapter.ts`
- **Purpose**: Postmark API token for sending transactional emails
- **Example**: `abc123-your-postmark-token-here`
- **Where to get**: [Postmark → API Tokens](https://account.postmarkapp.com/api_tokens)
- **Fallback behavior**: If missing, emails are written to `tmp/emails/*.json` (file-sink mode)

### `POSTMARK_FROM_EMAIL`
- **Mode**: Real only
- **Required**: No (defaults to `bookings@example.com`)
- **Used in**: `server/src/core/config.ts:22`, `server/src/di.ts:123`, `server/src/adapters/postmark.adapter.ts`
- **Purpose**: The "From" email address for booking confirmation emails
- **Example**: `bookings@yourdomain.com`
- **Note**: Must be a verified sender in Postmark

---

## Calendar Integration (Google Calendar)

### `GOOGLE_CALENDAR_ID`
- **Mode**: Real only
- **Required**: ⚠️ **No** (falls back to mock calendar with all dates available)
- **Used in**: `server/src/core/config.ts:23`, `server/src/di.ts:128`, `server/src/adapters/gcal.adapter.ts`
- **Purpose**: The Google Calendar ID to check for availability (freeBusy API)
- **Example**: `your-email@gmail.com` or `c_abc123@group.calendar.google.com`
- **Setup**: Share your calendar with the service account email
- **Fallback behavior**: If missing, all dates are marked as available (mock calendar)

### `GOOGLE_SERVICE_ACCOUNT_JSON_BASE64`
- **Mode**: Real only
- **Required**: ⚠️ **No** (falls back to mock calendar)
- **Used in**: `server/src/core/config.ts:24`, `server/src/di.ts:128`, `server/src/adapters/gcal.adapter.ts`
- **Purpose**: Base64-encoded service account credentials JSON for Google Calendar API
- **Example**: `eyJhbGciOiJSUzI1NiIsInR5cC...` (base64)
- **Where to get**: [Google Cloud Console → IAM & Admin → Service Accounts](https://console.cloud.google.com/iam-admin/serviceaccounts)
- **Encoding**: `base64 -i service-account.json | tr -d '\n'`
- **Fallback behavior**: If missing, all dates are marked as available (mock calendar)

---

## Quick Reference

### Mock Mode (`ADAPTERS_PRESET=mock`)
**Required:**
- `JWT_SECRET` ✅

**Optional:**
- `API_PORT`, `CORS_ORIGIN`, `NODE_ENV`, `LOG_LEVEL`

**Ignored:**
- All database, Stripe, Postmark, and Google Calendar variables

---

### Real Mode (`ADAPTERS_PRESET=real`)
**Required:**
- `JWT_SECRET` ✅
- `DATABASE_URL` ✅
- `STRIPE_SECRET_KEY` ✅
- `STRIPE_WEBHOOK_SECRET` ✅

**Optional (with graceful fallbacks):**
- `POSTMARK_SERVER_TOKEN` (→ file-sink)
- `POSTMARK_FROM_EMAIL`
- `GOOGLE_CALENDAR_ID` (→ mock calendar)
- `GOOGLE_SERVICE_ACCOUNT_JSON_BASE64` (→ mock calendar)
- `STRIPE_SUCCESS_URL`, `STRIPE_CANCEL_URL`
- `API_PORT`, `CORS_ORIGIN`, `NODE_ENV`, `LOG_LEVEL`

---

## Validation

Run the doctor script to validate your environment configuration:

```bash
npm run doctor
```

The script will:
- Check if `.env` exists
- Validate required variables per mode
- Warn about missing optional variables
- Exit with code 1 if critical variables are missing in real mode
- Exit with code 0 in mock mode (warnings only)

See `RUNBOOK.md` for example output and troubleshooting.

---

## Secret Rotation Procedure

### When to Rotate Secrets

**Immediate Rotation Required:**
- Secret exposed in git history
- Secret exposed in logs or error messages
- Suspected security breach or unauthorized access
- Employee with secret access leaves company
- Secret shared via insecure channel (email, Slack, etc.)

**Regular Rotation Schedule:**
- **JWT_SECRET**: Every 90 days
- **Stripe keys**: Only if compromised (Stripe manages rotation)
- **Database credentials**: Every 180 days (coordinate with Supabase)
- **Postmark token**: Only if compromised
- **Google service account**: Every 365 days

### Rotation Steps

#### 1. JWT_SECRET Rotation

```bash
# 1. Generate new secret
NEW_SECRET=$(openssl rand -base64 32)

# 2. Update environment variable (server/.env)
# OLD: JWT_SECRET=old_secret_here
# NEW: JWT_SECRET=new_secret_here

# 3. Deploy new secret to production
# (All existing tokens become invalid)

# 4. Verify application still works
npm run dev:api

# 5. Test admin login creates new valid token
curl -X POST http://localhost:3001/v1/admin/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@example.com","password":"admin"}'
```

**Impact:** All users will be logged out (must re-login).

#### 2. Stripe Keys Rotation

```bash
# 1. Generate new keys in Stripe Dashboard
# Navigate to: https://dashboard.stripe.com/test/apikeys
# Click "Create restricted key" or "Reveal test key token"

# 2. Update environment variables (server/.env)
# STRIPE_SECRET_KEY=sk_test_NEW_KEY
# STRIPE_WEBHOOK_SECRET=whsec_NEW_SECRET

# 3. Update webhook endpoint in Stripe Dashboard
# Navigate to: https://dashboard.stripe.com/test/webhooks
# Update endpoint with new signing secret

# 4. Deploy to production
# (All in-flight checkout sessions may fail)

# 5. Test end-to-end booking flow
npm run dev:api
# Complete test booking in frontend
```

**Impact:** In-flight checkout sessions may fail (customers must restart booking).

#### 3. Database Credentials Rotation

```bash
# WARNING: Coordinate with Supabase to avoid downtime

# 1. Create new database password in Supabase Dashboard
# Navigate to: Settings > Database > Connection string
# Click "Reset database password"

# 2. Update DATABASE_URL and DIRECT_URL in server/.env
# NEW_PASSWORD="new_password_here"
# DATABASE_URL="postgresql://postgres:NEW_PASSWORD@db.supabase.co:5432/postgres"
# DIRECT_URL="postgresql://postgres:NEW_PASSWORD@db.supabase.co:5432/postgres"

# 3. URL-encode password if it contains special characters
# @ becomes %40, ! becomes %21, etc.

# 4. Deploy to production IMMEDIATELY
# (Old password becomes invalid)

# 5. Verify database connection
npm run dev:api
# Check logs for database connection errors
```

**Impact:** Application downtime until new credentials deployed.

#### 4. Postmark Token Rotation

```bash
# 1. Generate new server token in Postmark
# Navigate to: https://account.postmarkapp.com/api_tokens
# Click "Create a new Server API Token"

# 2. Update environment variable (server/.env)
# POSTMARK_SERVER_TOKEN=new_token_here

# 3. Deploy to production
# (Old token becomes invalid)

# 4. Test email sending
npm run dev:api
# Trigger test booking confirmation email
```

**Impact:** Emails may fail until new token deployed.

### Secret Rotation Log

| Secret | Last Rotated | Next Rotation Due | Rotated By |
|--------|--------------|-------------------|------------|
| JWT_SECRET | 2025-10-29 | 2026-01-27 (90 days) | Initial setup |
| STRIPE_SECRET_KEY | Never | On compromise | N/A |
| STRIPE_WEBHOOK_SECRET | Never | On compromise | N/A |
| DATABASE_URL | 2025-10-29 | 2026-04-27 (180 days) | Supabase setup |
| POSTMARK_SERVER_TOKEN | Never | On compromise | N/A |
| GOOGLE_SERVICE_ACCOUNT | Never | 2026-10-29 (365 days) | N/A |

**Update this table after each rotation.**

---

## Git History Sanitization

### Problem

During development, several secrets were accidentally committed to git history:
- Default JWT_SECRET in `.env.example`
- Stripe test keys in code comments
- Database credentials in early setup commits

**Risk Level:**
- **High**: Database credentials (production access)
- **Medium**: Stripe test keys (limited damage, but possible abuse)
- **Low**: Default JWT_SECRET (should be changed anyway)

### Decision

**Status**: DOCUMENTED (Not executed yet)
**Priority**: P1 (Should fix before public repository)
**See**: DECISIONS.md ADR-003 (Git History Rewrite)

### Sanitization Procedure

**IMPORTANT: This rewrites git history. All developers must re-clone repository.**

```bash
# 1. Backup repository
git clone --mirror . ../elope-backup

# 2. Install git-filter-repo
pip install git-filter-repo

# 3. Create file with secrets to remove
cat > secrets-to-remove.txt <<EOF
jwt_secret_exposed_value
sk_test_stripe_key_here
postgresql://postgres:PASSWORD@db.supabase.co
whsec_webhook_secret_here
EOF

# 4. Run filter-repo to remove secrets (DRY RUN)
git filter-repo --replace-text secrets-to-remove.txt --dry-run

# 5. Review changes (check no false positives)
git log --all --oneline | head -20

# 6. Run filter-repo for real (WARNING: Destructive)
git filter-repo --replace-text secrets-to-remove.txt --force

# 7. Force push to remote (WARNING: Rewrites history)
git push --force --all origin
git push --force --tags origin

# 8. Notify all developers to re-clone
# Send email with re-clone instructions

# 9. Rotate all exposed secrets immediately
# See "Secret Rotation Procedure" above
```

### Post-Sanitization Checklist

After history rewrite:
- [ ] Backup created and verified
- [ ] All secrets removed from history
- [ ] All developers notified
- [ ] All developers have re-cloned
- [ ] CI/CD pipelines updated (if needed)
- [ ] All exposed secrets rotated
- [ ] Git-secrets pre-commit hook installed
- [ ] Documentation updated with new commit SHAs

### Prevention: Git-Secrets Pre-Commit Hook

**Install git-secrets** (prevents future secret commits):

```bash
# 1. Install git-secrets
brew install git-secrets  # macOS
# OR
sudo apt-get install git-secrets  # Linux

# 2. Configure for repository
cd /Users/mikeyoung/CODING/MAIS
git secrets --install
git secrets --register-aws  # Built-in patterns

# 3. Add custom patterns
git secrets --add 'jwt_secret|JWT_SECRET'
git secrets --add 'sk_test_|sk_live_'
git secrets --add 'whsec_'
git secrets --add 'postgresql://.*:.*@'

# 4. Test (should fail)
echo "JWT_SECRET=test123" > test.txt
git add test.txt
git commit -m "Test commit"
# Should fail with: "test.txt:1:JWT_SECRET=test123"

# 5. Clean up test
git reset HEAD test.txt
rm test.txt
```

### Best Practices

**DO:**
- Use `.env` files (never committed)
- Use environment variables in production
- Use secrets management service (AWS Secrets Manager, HashiCorp Vault)
- Rotate secrets on schedule
- Audit git history regularly
- Use git-secrets or similar tools

**DON'T:**
- Commit secrets to git (even in private repos)
- Share secrets via email or Slack
- Use same secret across multiple environments
- Use default/example secrets in production
- Store secrets in code comments
- Hardcode secrets in source files

---

## Emergency Secret Exposure Response

If a secret is exposed publicly:

1. **Immediate (Within 1 hour):**
   - Rotate exposed secret immediately
   - Deploy new secret to production
   - Verify application still works

2. **Short-term (Within 24 hours):**
   - Audit logs for unauthorized access
   - Notify security team
   - Document incident

3. **Long-term (Within 1 week):**
   - Sanitize git history (if exposed in commits)
   - Implement prevention measures (git-secrets)
   - Review secret management practices
   - Update team training

**Emergency Contacts:**
- Engineering Lead: [Contact Info]
- Security Team: [Contact Info]
- Supabase Support: https://supabase.com/support
- Stripe Support: https://support.stripe.com

---

## References

- OWASP: [Secrets Management Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Secrets_Management_Cheat_Sheet.html)
- GitHub: [Removing Sensitive Data](https://docs.github.com/en/authentication/keeping-your-account-and-data-secure/removing-sensitive-data-from-a-repository)
- Git-Secrets: [Documentation](https://github.com/awslabs/git-secrets)
- DECISIONS.md: ADR-003 (Git History Rewrite)
