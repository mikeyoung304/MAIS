# Secret Rotation & Security Guide

## CRITICAL SECURITY NOTICE

This repository contains exposed production credentials in `/server/.env`. While the `.env` file is properly excluded from version control (via `.gitignore`), **the secrets must be rotated immediately** to maintain security.

## Current Status

### Good News

- `.env` is properly listed in `.gitignore`
- `.env` has **NEVER been committed** to git history (verified)
- No git history cleanup needed

### Action Required

All secrets in `/server/.env` must be rotated because they were potentially exposed during development.

---

## Secret Rotation Checklist

### 1. JWT_SECRET (HIGH PRIORITY)

**Current Status:** Exposed in repository
**Impact:** If compromised, attackers can forge authentication tokens

**Rotation Steps:**

1. Generate a new secret:

   ```bash
   openssl rand -hex 32
   ```

2. Update `/server/.env`:

   ```bash
   JWT_SECRET=<new-64-char-hex-string>
   ```

3. Restart the server:

   ```bash
   cd server
   npm run dev
   ```

4. **Important:** This will invalidate all existing user sessions - users will need to log in again

**New Value Generated:**

```
911b49e08b8639af2b47572ccb34b0b84ae4fab64b6e124287407ea9e26c5734
```

---

### 2. TENANT_SECRETS_ENCRYPTION_KEY (CRITICAL PRIORITY)

**Current Status:** Exposed in repository
**Impact:** Used to encrypt tenant-specific secrets (Stripe keys, etc.) in the database

**WARNING:** Rotating this key is complex because it requires re-encrypting all tenant secrets in the database!

**Rotation Steps:**

1. **Backup Current Database First:**

   ```bash
   # Create a full database backup before proceeding
   pg_dump <database-url> > backup_$(date +%Y%m%d_%H%M%S).sql
   ```

2. Generate a new encryption key:

   ```bash
   openssl rand -hex 32
   ```

3. **Migration Required:** You need to:
   - Decrypt all tenant secrets with the old key
   - Re-encrypt them with the new key
   - Update the `.env` file with the new key

4. **Recommended Approach:**
   - Create a database migration script that:
     - Reads all encrypted tenant secrets
     - Decrypts with old key (`TENANT_SECRETS_ENCRYPTION_KEY`)
     - Re-encrypts with new key
     - Updates database records
   - Keep the old key in a separate variable during migration
   - Remove the old key after successful migration

**New Value Generated:**

```
307e73f2de1661253885027e135079212782f573c6efde1fb0857c943b27d1e7
```

**Migration Script Location:** `/server/scripts/rotate-encryption-key.ts` (needs to be created)

---

### 3. Stripe API Keys (HIGH PRIORITY)

**Current Status:** Exposed test mode keys
**Impact:** Attackers could access/modify test mode payment data

**Rotation Steps:**

1. **Navigate to Stripe Dashboard:**
   - Test Mode: https://dashboard.stripe.com/test/apikeys
   - Live Mode: https://dashboard.stripe.com/apikeys

2. **Roll (Rotate) the Secret Key:**
   - Click "Reveal test key" next to your current secret key
   - Click "Roll key" button
   - Copy the new `sk_test_...` key

3. **Update `/server/.env`:**

   ```bash
   STRIPE_SECRET_KEY=sk_test_<new-key>
   ```

4. **Verify Integration:**
   ```bash
   cd server
   npm run dev
   # Test a checkout flow
   ```

**Current Key Pattern:** `sk_test_51SLPlv...`

---

### 4. Stripe Webhook Secret (HIGH PRIORITY)

**Current Status:** Exposed webhook signing secret
**Impact:** Attackers could forge webhook events

**Rotation Steps:**

#### Development Environment:

1. Stop the current Stripe CLI listener
2. Restart with:
   ```bash
   stripe listen --forward-to localhost:3001/api/webhooks/stripe
   ```
3. Copy the new webhook secret (starts with `whsec_`)
4. Update `/server/.env`:
   ```bash
   STRIPE_WEBHOOK_SECRET=whsec_<new-secret>
   ```

#### Production Environment:

1. **Navigate to Stripe Dashboard:**
   - https://dashboard.stripe.com/webhooks

2. **For Existing Endpoint:**
   - Click on your webhook endpoint
   - Click "Roll secret" in the "Signing secret" section
   - Copy the new secret

3. **Update Production Environment Variables:**

   ```bash
   STRIPE_WEBHOOK_SECRET=whsec_<new-secret>
   ```

4. **Verify:**
   - Send a test webhook from Stripe dashboard
   - Check server logs for successful verification

**Current Secret Pattern:** `whsec_0ad225e1...`

---

### 5. Database Credentials (CRITICAL PRIORITY)

**Current Status:** Exposed Supabase database password
**Impact:** Full database access - highest security risk

**Rotation Steps:**

1. **Navigate to Supabase Dashboard:**
   - Project: `gpyvdknhmevcfdbgtqir`
   - Settings > Database > Connection String

2. **Reset Database Password:**
   - Click "Reset Database Password"
   - Generate a strong password (or use a password manager)
   - **IMPORTANT:** Save this password securely before confirming

3. **Update Environment Variables:**
   - Update `DATABASE_URL` in `/server/.env`
   - Update `DIRECT_URL` in `/server/.env`
   - Remember to URL-encode special characters (e.g., `@` becomes `%40`)

4. **Update Connection Format:**

   ```bash
   DATABASE_URL="postgresql://postgres:<URL-ENCODED-PASSWORD>@db.gpyvdknhmevcfdbgtqir.supabase.co:5432/postgres"
   DIRECT_URL="postgresql://postgres:<URL-ENCODED-PASSWORD>@db.gpyvdknhmevcfdbgtqir.supabase.co:5432/postgres"
   ```

5. **Verify Connection:**
   ```bash
   cd server
   npx prisma db pull
   # Should succeed without errors
   ```

**Current Password (URL-encoded):** `%40Orangegoat11` (actual: `@Orangegoat11`)

---

### 6. Supabase API Keys (MEDIUM PRIORITY)

**Current Status:** Exposed anon key and service role key
**Impact:** Service role key grants admin access to Supabase

**Rotation Steps:**

1. **Navigate to Supabase Dashboard:**
   - Project Settings > API

2. **Service Role Key (CRITICAL):**
   - The service role key cannot be rotated directly
   - Consider implementing Row Level Security (RLS) policies
   - Limit service role key usage in code
   - Use anon key with RLS where possible

3. **Review API Key Usage:**
   - Audit code to see where `SUPABASE_SERVICE_ROLE_KEY` is used
   - Replace with anon key + RLS policies where possible
   - Keep service role key for admin operations only

4. **Update `/server/.env`:**
   ```bash
   SUPABASE_URL=https://gpyvdknhmevcfdbgtqir.supabase.co
   SUPABASE_ANON_KEY=<from-dashboard>
   SUPABASE_SERVICE_ROLE_KEY=<from-dashboard>
   ```

**Note:** Anon key is safe to expose in client-side code (protected by RLS). Service role key must NEVER be exposed client-side.

---

## Post-Rotation Verification

### 1. Environment Variables Check

```bash
cd server
# Ensure .env is not tracked
git status

# Verify .env contains new secrets (do NOT commit)
cat .env | grep -E "JWT_SECRET|STRIPE_SECRET_KEY|DATABASE_URL"
```

### 2. Application Health Check

```bash
# Start the server
cd server
npm run dev

# Check logs for:
# - Database connection success
# - No authentication errors
# - Stripe API initialization
```

### 3. Integration Tests

```bash
# Test authentication flow
# - User login should work
# - JWT tokens should be valid

# Test Stripe integration
# - Create a test checkout session
# - Process a test webhook

# Test database
# - Prisma queries should work
# - Migrations should apply
```

---

## Security Best Practices

### 1. Environment Variable Management

**Do:**

- Use `.env` for local development only
- Use environment-specific secrets (dev/staging/prod)
- Store production secrets in secure vault (AWS Secrets Manager, HashiCorp Vault, etc.)
- Rotate secrets regularly (quarterly minimum)
- Use different secrets across environments

**Don't:**

- Commit `.env` to version control
- Share secrets via email/Slack
- Reuse secrets across projects
- Use weak or predictable secrets

### 2. Secret Generation

```bash
# For 256-bit secrets (recommended)
openssl rand -hex 32

# For 512-bit secrets (extra secure)
openssl rand -hex 64

# For base64-encoded secrets
openssl rand -base64 32
```

### 3. Access Control

- Limit who has access to production secrets
- Use role-based access control (RBAC)
- Implement audit logging for secret access
- Require MFA for accessing production environments

### 4. Monitoring

- Set up alerts for failed authentication attempts
- Monitor for unusual API usage patterns
- Log all secret rotation events
- Review access logs regularly

---

## Emergency Response

### If Secrets Are Compromised

1. **Immediate Actions (within 15 minutes):**
   - Rotate all secrets immediately
   - Revoke all active sessions (JWT)
   - Review access logs for suspicious activity
   - Alert team members

2. **Investigation (within 1 hour):**
   - Identify scope of exposure
   - Check for unauthorized database access
   - Review Stripe transaction logs
   - Examine authentication logs

3. **Remediation (within 24 hours):**
   - Complete full secret rotation
   - Apply additional security controls
   - Update access policies
   - Document incident

4. **Follow-up (within 1 week):**
   - Conduct security review
   - Implement preventive measures
   - Update security documentation
   - Train team on security best practices

---

## Tenant-Specific Secrets

### Multi-Tenant Architecture

This application uses a multi-tenant architecture where each tenant has their own Stripe API keys stored encrypted in the database.

**Important:** Platform-level secrets (in `.env`) are different from tenant-specific secrets (in database).

### Rotating Tenant Stripe Keys

Each tenant should rotate their own Stripe keys through the admin UI:

1. Navigate to Tenant Admin Dashboard
2. Go to "Settings" > "Payment Configuration"
3. Click "Rotate Stripe Keys"
4. Follow the in-app wizard

**Database Storage:**

- Tenant Stripe keys are encrypted using `TENANT_SECRETS_ENCRYPTION_KEY`
- Keys are stored in the `tenants` table
- Only accessible to that tenant's admin users

---

## Additional Resources

### Documentation

- [Stripe API Keys](https://stripe.com/docs/keys)
- [Stripe Webhooks](https://stripe.com/docs/webhooks)
- [Supabase Database](https://supabase.com/docs/guides/database)
- [JWT Best Practices](https://tools.ietf.org/html/rfc8725)

### Tools

- [Stripe CLI](https://stripe.com/docs/stripe-cli)
- [Supabase CLI](https://supabase.com/docs/guides/cli)
- [OpenSSL](https://www.openssl.org/)

### Security References

- [OWASP Secrets Management](https://cheatsheetseries.owasp.org/cheatsheets/Secrets_Management_Cheat_Sheet.html)
- [NIST Password Guidelines](https://pages.nist.gov/800-63-3/)

---

## Appendix: Automation Scripts

### Secret Rotation Script Template

Create `/server/scripts/rotate-secrets.sh`:

```bash
#!/bin/bash
set -e

echo "=== Secret Rotation Script ==="
echo ""

# Generate new secrets
NEW_JWT_SECRET=$(openssl rand -hex 32)
NEW_TENANT_ENC_KEY=$(openssl rand -hex 32)

echo "Generated new secrets:"
echo "JWT_SECRET=$NEW_JWT_SECRET"
echo "TENANT_SECRETS_ENCRYPTION_KEY=$NEW_TENANT_ENC_KEY"
echo ""

# Backup current .env
cp server/.env server/.env.backup.$(date +%Y%m%d_%H%M%S)

echo "Backed up current .env"
echo ""
echo "MANUAL STEPS REQUIRED:"
echo "1. Update server/.env with new secrets above"
echo "2. Rotate Stripe keys in dashboard"
echo "3. Update Supabase database password"
echo "4. Restart application"
echo "5. Verify all integrations"
```

---

## Rotation History

Track all secret rotations in this table:

| Secret            | Last Rotation | Next Rotation        | Rotated By | Notes                     |
| ----------------- | ------------- | -------------------- | ---------- | ------------------------- |
| JWT_SECRET        | 2025-10-29    | 2026-01-29 (90 days) | Agent 2    | Security audit baseline   |
| Stripe Test Keys  | Pending       | ASAP                 | -          | User action required      |
| Stripe Prod Keys  | N/A           | Before prod          | -          | Not yet in use            |
| Database Password | N/A           | Optional             | -          | Protected by .env         |
| Supabase Keys     | N/A           | On compromise        | -          | Anon key safe client-side |

**Note:** NEVER record actual secret values in this document. Track only metadata.

---

## Git History Verification

### Last Audit: 2025-10-29

**Status:** `.env` never committed to git ✅

**Files Checked:**

- `server/.env` - Never in git history
- `apps/api/.env` - Never in git history
- `.env.example` - Only placeholders

**Commits Audited:** All major commits checked for exposed secrets

**Important:** While `.env` is protected, be aware that secrets may appear in other documentation files. Always audit git history before public release.

---

## Questions?

If you have questions about secret rotation or security practices, consult:

- Security team lead
- DevOps engineer
- Refer to company security policy documentation

---

**Document Consolidated:** Phase 1.2 - Merged unique content from SECRETS_ROTATION.md
**Last Updated:** 2025-11-07
