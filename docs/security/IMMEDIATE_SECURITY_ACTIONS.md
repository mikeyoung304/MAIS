# IMMEDIATE Security Actions Required

## Status: ATTENTION REQUIRED

The `/server/.env` file contains exposed production secrets that need rotation.

## Good News

- `.env` is properly gitignored
- **`.env` was NEVER committed to git history** (verified)
- No git history cleanup needed
- All secrets are still only in your local environment

## Critical Actions (Do These Now)

### 1. Update JWT_SECRET (5 minutes)

Open `/server/.env` and replace the current `JWT_SECRET` with this new one:

```bash
JWT_SECRET=911b49e08b8639af2b47572ccb34b0b84ae4fab64b6e124287407ea9e26c5734
```

**Impact:** All users will need to log in again (sessions invalidated)

### 2. Rotate Stripe Keys (10 minutes)

1. Go to: https://dashboard.stripe.com/test/apikeys
2. Click "Roll key" for your Secret Key
3. Copy the new `sk_test_...` key
4. Update in `/server/.env`: `STRIPE_SECRET_KEY=<new-key>`

### 3. Rotate Stripe Webhook Secret (5 minutes)

For local development:

```bash
# Stop current listener, then restart:
stripe listen --forward-to localhost:3001/api/webhooks/stripe
# Copy the new whsec_... secret
# Update in /server/.env: STRIPE_WEBHOOK_SECRET=<new-secret>
```

### 4. Change Database Password (15 minutes)

1. Go to: https://supabase.com/dashboard/project/gpyvdknhmevcfdbgtqir/settings/database
2. Click "Reset Database Password"
3. Generate a strong password and SAVE IT SECURELY
4. Update in `/server/.env`:
   ```bash
   DATABASE_URL="postgresql://postgres:<URL-ENCODED-PASSWORD>@db.gpyvdknhmevcfdbgtqir.supabase.co:5432/postgres"
   DIRECT_URL="postgresql://postgres:<URL-ENCODED-PASSWORD>@db.gpyvdknhmevcfdbgtqir.supabase.co:5432/postgres"
   ```
   Remember: URL-encode special characters (@ becomes %40)

### 5. Restart Application

```bash
cd server
npm run dev
```

Test that everything works:

- Database connection
- User authentication
- Stripe checkout

## What About TENANT_SECRETS_ENCRYPTION_KEY?

This is **CRITICAL** but requires a migration script because it encrypts tenant data in the database.

**New value generated:**

```
307e73f2de1661253885027e135079212782f573c6efde1fb0857c943b27d1e7
```

**DO NOT** just replace it in `.env` - you need to:

1. Create a migration script to re-encrypt tenant secrets
2. See full instructions in `SECRET_ROTATION_GUIDE.md`

## Verification Checklist

After completing the above steps:

- [ ] JWT_SECRET updated
- [ ] Stripe Secret Key rotated
- [ ] Stripe Webhook Secret rotated
- [ ] Database password changed
- [ ] Application restarts successfully
- [ ] Can log in with test user
- [ ] Can create test Stripe checkout
- [ ] Database queries work

## Next Steps

1. Read `SECRET_ROTATION_GUIDE.md` for detailed rotation procedures
2. Plan migration for `TENANT_SECRETS_ENCRYPTION_KEY` rotation
3. Set up quarterly secret rotation schedule
4. Consider using a secrets management service (AWS Secrets Manager, etc.)

## Security Reminders

**DO:**

- Keep `.env` local only
- Use strong, unique secrets for each environment
- Store production secrets in a secure vault

**DON'T:**

- Commit `.env` to git (already protected by .gitignore)
- Share secrets via email/Slack
- Reuse secrets across projects

## Questions?

Refer to `SECRET_ROTATION_GUIDE.md` for comprehensive documentation.

**Priority:** HIGH
**Timeline:** Complete within 24 hours
**Last Updated:** 2025-11-06
