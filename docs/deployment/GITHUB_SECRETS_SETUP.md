# GitHub Actions Secrets Configuration

## Overview

This guide covers setting up GitHub Actions secrets and environment variables for CI/CD deployment. Secrets are encrypted and only exposed to authorized workflows.

## Required Secrets by Environment

### Development & Testing (Optional for Local Work)

- None required for local mock mode
- Optional: Set in `.env` for real mode testing

### CI/CD Pipeline (Always Required)

These secrets must be configured for the GitHub Actions pipeline to run:

```
JWT_SECRET
TENANT_SECRETS_ENCRYPTION_KEY
```

### Production Deployment (Required for deploy-production.yml)

These secrets enable production deployment:

```
PRODUCTION_DATABASE_URL
PRODUCTION_DIRECT_URL
STRIPE_SECRET_KEY
STRIPE_WEBHOOK_SECRET
PRODUCTION_API_URL
PRODUCTION_CLIENT_URL
RENDER_PRODUCTION_API_DEPLOY_HOOK
VERCEL_TOKEN
VERCEL_ORG_ID
VERCEL_PROJECT_ID
CODECOV_TOKEN
```

## Step-by-Step Setup

### Step 1: Generate Security Keys

Generate secure random values for TIER 1 variables:

```bash
# Generate JWT_SECRET (64 hex characters)
openssl rand -hex 32
# Output: a1b2c3d4e5f6... (save this)

# Generate TENANT_SECRETS_ENCRYPTION_KEY (64 hex characters)
openssl rand -hex 32
# Output: x9y8z7w6v5u4... (save this)
```

Store these securely (password manager, secure note, etc.).

### Step 2: Configure GitHub Repository Secrets

1. **Navigate to Settings:**
   - Go to your GitHub repository
   - Settings → Secrets and Variables → Actions

2. **Add Core Secrets (TIER 1):**
   - Click "New repository secret"
   - Name: `JWT_SECRET`
   - Value: (paste the value from Step 1)
   - Click "Add secret"

   Repeat for:
   - `TENANT_SECRETS_ENCRYPTION_KEY`

3. **Verify Secrets Created:**
   ```bash
   gh secret list --repo myorg/MAIS
   ```

### Step 3: Configure Production Environment Secrets

1. **Create Production Environment:**
   - Go to Settings → Environments
   - Click "New environment"
   - Name: `production`
   - Click "Configure environment"

2. **Add Production Secrets:**
   For each secret below:
   - Click "Add secret"
   - Name: (variable name)
   - Value: (from infrastructure provider)

### Step 4: Obtain Production Values

#### Database (Supabase)

1. **Login to Supabase Dashboard:**
   - Go to https://supabase.com/dashboard
   - Select your MAIS project

2. **Get Database URLs:**
   - Settings → Database → Connection String
   - Under "Connection Pooler" tab:
     - Copy `postgresql://user:pass@...` (for DATABASE_URL/PRODUCTION_DATABASE_URL)
   - Under "Direct Connection" tab:
     - Copy `postgresql://user:pass@...` (for DIRECT_URL/PRODUCTION_DIRECT_URL)

3. **Add Secrets:**

   ```
   Secret Name: PRODUCTION_DATABASE_URL
   Value: postgresql://...

   Secret Name: PRODUCTION_DIRECT_URL
   Value: postgresql://...
   ```

#### Stripe (Production)

1. **Login to Stripe Dashboard:**
   - Go to https://dashboard.stripe.com
   - Developers → API Keys

2. **Get Stripe Keys:**
   - Under "Live Keys" section:
     - Copy Secret Key (starts with `sk_live_`)
     - Copy Webhook Signing Secret from Webhooks section

3. **Add Secrets:**

   ```
   Secret Name: STRIPE_SECRET_KEY
   Value: sk_live_...

   Secret Name: STRIPE_WEBHOOK_SECRET
   Value: whsec_live_...
   ```

#### Render (API Hosting)

1. **Login to Render Dashboard:**
   - Go to https://dashboard.render.com
   - Select MAIS API service

2. **Get Deploy Hook:**
   - Settings → Deploy Hooks
   - Copy the webhook URL

3. **Add Secret:**
   ```
   Secret Name: RENDER_PRODUCTION_API_DEPLOY_HOOK
   Value: https://api.render.com/deploy/...
   ```

#### Vercel (Client Hosting)

1. **Login to Vercel Dashboard:**
   - Go to https://vercel.com/dashboard

2. **Get Project Details:**
   - Select MAIS project
   - Settings → General
   - Copy Project ID, Org ID
   - Go to Settings → Tokens
   - Create new token (scopes: `deployments`, `project.read`)

3. **Add Secrets:**

   ```
   Secret Name: VERCEL_TOKEN
   Value: <token from step 2>

   Secret Name: VERCEL_ORG_ID
   Value: <org id from project settings>

   Secret Name: VERCEL_PROJECT_ID
   Value: <project id from project settings>
   ```

#### Codecov (Coverage Reporting)

1. **Login to Codecov:**
   - Go to https://codecov.io
   - Select MAIS repository

2. **Get Token:**
   - Settings → Tokens
   - Copy "Upload Token"

3. **Add Secret:**
   ```
   Secret Name: CODECOV_TOKEN
   Value: <upload token>
   ```

### Step 5: Configure Environment Variables

1. **Navigate to Environments:**
   - Settings → Environments → production

2. **Add Environment Variables:**

   ```
   Name: PRODUCTION_API_URL
   Value: https://api.maconaisolutions.com

   Name: PRODUCTION_CLIENT_URL
   Value: https://app.maconaisolutions.com
   ```

## Validation Checklist

Run this to verify all secrets are configured:

```bash
#!/bin/bash

REQUIRED_SECRETS=(
  "JWT_SECRET"
  "TENANT_SECRETS_ENCRYPTION_KEY"
  "PRODUCTION_DATABASE_URL"
  "PRODUCTION_DIRECT_URL"
  "STRIPE_SECRET_KEY"
  "STRIPE_WEBHOOK_SECRET"
  "RENDER_PRODUCTION_API_DEPLOY_HOOK"
  "VERCEL_TOKEN"
  "VERCEL_ORG_ID"
  "VERCEL_PROJECT_ID"
  "CODECOV_TOKEN"
)

echo "Checking GitHub secrets..."
for secret in "${REQUIRED_SECRETS[@]}"; do
  if gh secret list --repo myorg/MAIS | grep -q "^$secret"; then
    echo "✓ $secret"
  else
    echo "✗ $secret (MISSING)"
  fi
done
```

## Secret Security Best Practices

### Do's

- ✓ Store in encrypted GitHub Actions secrets
- ✓ Use separate secrets for each environment
- ✓ Rotate TIER 1 secrets every 90 days
- ✓ Rotate integration keys every 180 days
- ✓ Mask secrets in workflow logs (GitHub does this automatically)
- ✓ Use least-privilege scopes (e.g., Vercel tokens limited to specific projects)
- ✓ Store backup of secrets in secure password manager
- ✓ Document secret rotation schedule

### Don'ts

- ✗ Don't commit `.env` files to Git
- ✗ Don't paste secrets in issues/PRs
- ✗ Don't log secrets in output
- ✗ Don't share secrets over unencrypted channels
- ✗ Don't use same secret across multiple environments
- ✗ Don't hardcode secrets in code (use env variables)
- ✗ Don't store secrets in version control
- ✗ Don't grant unnecessary scopes to API tokens

## Secret Rotation Schedule

| Secret                              | Rotation        | Reason                                        |
| ----------------------------------- | --------------- | --------------------------------------------- |
| `JWT_SECRET`                        | 90 days         | Cryptographic key compromise detection window |
| `TENANT_SECRETS_ENCRYPTION_KEY`     | 90 days         | Encryption key security                       |
| `STRIPE_SECRET_KEY`                 | 180 days        | PCI compliance recommendation                 |
| `STRIPE_WEBHOOK_SECRET`             | 180 days        | PCI compliance recommendation                 |
| `POSTMARK_SERVER_TOKEN`             | 180 days        | Email service security                        |
| `PRODUCTION_DATABASE_URL`           | On team changes | Only if credentials change                    |
| `PRODUCTION_DIRECT_URL`             | On team changes | Only if credentials change                    |
| `RENDER_PRODUCTION_API_DEPLOY_HOOK` | 180 days        | Deploy hook security                          |
| `VERCEL_TOKEN`                      | 180 days        | Hosting provider security                     |
| `CODECOV_TOKEN`                     | 365 days        | Low-privilege reporting token                 |

### Rotation Procedure

```bash
# 1. Generate new secret
NEW_SECRET=$(openssl rand -hex 32)
echo $NEW_SECRET

# 2. Update in GitHub (Settings → Secrets)
# - Click secret to update
# - Paste new value
# - Click "Update secret"

# 3. For production keys (Stripe, Render, etc.)
# - Generate in provider's dashboard
# - Update GitHub secret
# - Update local .env for testing

# 4. Document rotation
# - Add entry to ROTATION_LOG.md
# - Record date and who performed rotation
```

## Troubleshooting

### Secret Not Available in Workflow

**Error:** Workflow fails with "variable not set"

**Check:**

1. Secret name matches exactly (case-sensitive)
2. Secret is available to the workflow's environment
3. Workflow can access secrets (not in schedule events by default)

**Fix:**

```yaml
# Correct syntax
env:
  MY_SECRET: ${{ secrets.MY_SECRET }}

# Wrong (secret won't be available)
env:
  MY_SECRET: ${{ secrets.my_secret }}  # Case mismatch
```

### Secret Accidentally Exposed

**If secret is leaked:**

1. **Immediately rotate the secret:**

   ```bash
   # 1. Generate new value
   NEW=$(openssl rand -hex 32)

   # 2. Update GitHub secret
   gh secret set SECRET_NAME --body "$NEW"

   # 3. Notify team
   ```

2. **Check for exposure:**

   ```bash
   # Search commit history for secret
   git log -p | grep -i "sk_test_\|sk_live_"

   # Search for credentials in files
   grep -r "sk_test_\|sk_live_" . --exclude-dir=.git
   ```

3. **Document incident:**
   - Record in security log
   - Review who had access
   - Plan to prevent in future

### Workflow Can't Access Production Secrets

**Problem:** Pull request workflow can't access production secrets

**This is intentional!** Production secrets are only available to:

- Push to main branch
- Manual workflow dispatch
- Tagged releases

**Solution:** Use repository secrets for CI, environment secrets for production

### Database Connection Fails in CI

**Error:** "could not connect to server"

**Check:**

1. DATABASE_URL format is correct (with pooler suffix)
2. DIRECT_URL is set (required for migrations)
3. Database allows connections from GitHub Actions IPs
4. Connection pooler is active in Supabase

**Fix:**

```yaml
env:
  DATABASE_URL: postgresql://user:pass@host:port/db?poolingMode=transaction
  DIRECT_URL: postgresql://user:pass@host:port/db
```

## References

- GitHub Docs: [Encrypted secrets](https://docs.github.com/en/actions/security-guides/encrypted-secrets)
- GitHub Docs: [Environment variables](https://docs.github.com/en/actions/learn-github-actions/variables)
- Supabase Docs: [Connection pooling](https://supabase.com/docs/guides/database/connecting-to-postgres#connection-pooler)
- Stripe Docs: [API keys](https://stripe.com/docs/keys)
- Vercel Docs: [Tokens](https://vercel.com/docs/rest-api#authentication/api-tokens)
