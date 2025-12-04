# GitHub Actions Secrets Configuration Template

Complete secrets configuration guide for MAIS CI/CD pipelines.

## 🔐 Security Principles

1. **Never commit secrets to version control**
2. **Use environment-specific secrets** (staging vs production)
3. **Rotate secrets quarterly** or after team member changes
4. **Use least privilege access** - only grant necessary permissions
5. **Monitor secret usage** in GitHub Actions logs

## Required Secrets Checklist

Use this checklist when setting up a new environment.

### Core Application Secrets

- [ ] `JWT_SECRET` - JWT signing key (64-character hex string)
- [ ] `TENANT_SECRETS_ENCRYPTION_KEY` - Tenant data encryption (64-character hex)

**Generate with:**

```bash
openssl rand -hex 32
```

### Database Secrets

- [ ] `STAGING_DATABASE_URL` - Staging PostgreSQL connection string
- [ ] `STAGING_DIRECT_URL` - Staging direct connection (for migrations)
- [ ] `PRODUCTION_DATABASE_URL` - Production PostgreSQL connection string
- [ ] `PRODUCTION_DIRECT_URL` - Production direct connection (for migrations)
- [ ] `SUPABASE_PROJECT_ID` - Supabase project identifier

**Format:**

```bash
# Transaction mode (for app runtime)
DATABASE_URL=postgresql://postgres:PASSWORD@HOST:5432/postgres?sslmode=require&pgbouncer=true

# Direct mode (for migrations)
DIRECT_URL=postgresql://postgres:PASSWORD@HOST:6543/postgres?sslmode=require

# URL-encode special characters in password:
# @ becomes %40
# # becomes %23
# ! becomes %21
```

**Get from Supabase:**

1. Navigate to: Project Settings → Database
2. Connection String → Transaction Mode (port 5432)
3. Connection String → Direct Connection (port 6543)

### Deployment Platform Secrets

#### Vercel (Frontend)

- [ ] `VERCEL_TOKEN` - Vercel authentication token
- [ ] `VERCEL_ORG_ID` - Vercel organization ID
- [ ] `VERCEL_PROJECT_ID` - Vercel project ID

**How to get:**

```bash
# 1. Install Vercel CLI
npm install -g vercel

# 2. Login
vercel login

# 3. Link project
cd client
vercel link

# 4. Get IDs from .vercel/project.json
cat .vercel/project.json
# {
#   "orgId": "team_...",
#   "projectId": "prj_..."
# }

# 5. Generate token at:
# https://vercel.com/account/tokens
```

#### Render (Backend)

- [ ] `RENDER_STAGING_API_DEPLOY_HOOK` - Staging deploy webhook
- [ ] `RENDER_PRODUCTION_API_DEPLOY_HOOK` - Production deploy webhook

**How to get:**

```bash
# 1. Navigate to Render Dashboard
# 2. Select your service
# 3. Settings → Deploy Hook
# 4. Click "Create Deploy Hook"
# 5. Copy the URL (format: https://api.render.com/deploy/srv-...)
```

### Application URLs

- [ ] `STAGING_API_URL` - Staging backend URL
- [ ] `STAGING_CLIENT_URL` - Staging frontend URL
- [ ] `PRODUCTION_API_URL` - Production backend URL
- [ ] `PRODUCTION_CLIENT_URL` - Production frontend URL

**Examples:**

```bash
STAGING_API_URL=https://staging-api.mais.app
STAGING_CLIENT_URL=https://staging.mais.app
PRODUCTION_API_URL=https://api.mais.app
PRODUCTION_CLIENT_URL=https://mais.app
```

### Optional Secrets (Recommended)

- [ ] `CODECOV_TOKEN` - Code coverage reporting
- [ ] `SNYK_TOKEN` - Security vulnerability scanning
- [ ] `SLACK_WEBHOOK_URL` - Deployment notifications
- [ ] `DISCORD_WEBHOOK_URL` - Alternative notifications

**Codecov Token:**

```bash
# 1. Sign up at https://codecov.io
# 2. Add your GitHub repository
# 3. Copy repository token
# 4. Add to GitHub Secrets as CODECOV_TOKEN
```

**Snyk Token:**

```bash
# 1. Sign up at https://snyk.io
# 2. Account Settings → API Token
# 3. Generate new token
# 4. Add to GitHub Secrets as SNYK_TOKEN
```

## How to Add Secrets to GitHub

### Via GitHub Web Interface

1. Navigate to your repository on GitHub
2. Click **Settings** → **Secrets and variables** → **Actions**
3. Click **New repository secret**
4. Enter:
   - **Name:** Secret name (e.g., `STAGING_DATABASE_URL`)
   - **Value:** Secret value
5. Click **Add secret**

### Via GitHub CLI

```bash
# Install GitHub CLI
brew install gh  # macOS
# or download from: https://cli.github.com

# Authenticate
gh auth login

# Add secret
gh secret set STAGING_DATABASE_URL
# Paste value when prompted

# Add secret from file
gh secret set JWT_SECRET < jwt_secret.txt

# List all secrets (values are hidden)
gh secret list
```

### Via Terraform (for DevOps teams)

```hcl
resource "github_actions_secret" "staging_database_url" {
  repository       = "MAIS"
  secret_name      = "STAGING_DATABASE_URL"
  plaintext_value  = var.staging_database_url
}

resource "github_actions_secret" "production_database_url" {
  repository       = "MAIS"
  secret_name      = "PRODUCTION_DATABASE_URL"
  plaintext_value  = var.production_database_url
}
```

## Environment-Specific Secrets

GitHub Environments provide scoped secrets with approval workflows.

### Create Environment

1. Navigate to: **Settings** → **Environments**
2. Click **New environment**
3. Enter environment name (e.g., `production`)
4. Configure protection rules:
   - **Required reviewers:** Add team members
   - **Wait timer:** Delay before deployment (minutes)
   - **Deployment branches:** Restrict to specific branches

### Add Environment Secrets

1. Navigate to environment (e.g., `production`)
2. Click **Add secret**
3. Secrets are only available to jobs using that environment

**Example Environment Structure:**

```yaml
Environments:
  staging:
    Secrets:
      - DATABASE_URL
      - API_URL
    Protection: None

  production:
    Secrets:
      - DATABASE_URL
      - API_URL
    Protection:
      - Required reviewers: 2
      - Wait timer: 5 minutes

  production-migrations:
    Secrets:
      - DATABASE_URL
      - DIRECT_URL
    Protection:
      - Required reviewers: 2
      - Wait timer: 5 minutes
```

## Secret Naming Conventions

### Prefixes

- `STAGING_*` - Staging environment secrets
- `PRODUCTION_*` - Production environment secrets
- No prefix - Shared across environments (e.g., `CODECOV_TOKEN`)

### Examples

```bash
# Database
STAGING_DATABASE_URL
STAGING_DIRECT_URL
PRODUCTION_DATABASE_URL
PRODUCTION_DIRECT_URL

# Application URLs
STAGING_API_URL
STAGING_CLIENT_URL
PRODUCTION_API_URL
PRODUCTION_CLIENT_URL

# Platform-specific
RENDER_STAGING_API_DEPLOY_HOOK
RENDER_PRODUCTION_API_DEPLOY_HOOK

# Shared services
CODECOV_TOKEN
SNYK_TOKEN
VERCEL_TOKEN
```

## Secret Rotation Guide

### When to Rotate

- **Immediately:**
  - Team member with access leaves
  - Secret accidentally exposed (committed to repo, logged)
  - Security breach or suspected compromise

- **Quarterly:**
  - Database passwords
  - JWT secrets
  - Encryption keys
  - API tokens

- **Annually:**
  - Service account credentials
  - OAuth client secrets

### Rotation Procedure

#### 1. Database Passwords

```bash
# Supabase
# 1. Generate new password
NEW_PASSWORD=$(openssl rand -base64 32)

# 2. Update in Supabase Dashboard
# Project Settings → Database → Reset Database Password

# 3. Update GitHub Secrets
gh secret set PRODUCTION_DATABASE_URL
# Enter new connection string with new password

# 4. Trigger redeployment
git tag -a v1.2.3 -m "chore: rotate database credentials"
git push origin v1.2.3
```

#### 2. JWT Secrets

```bash
# Generate new secret
openssl rand -hex 32 > new_jwt_secret.txt

# Update in GitHub Secrets
gh secret set JWT_SECRET < new_jwt_secret.txt

# Deploy with new secret
# Note: This will invalidate all existing JWTs
# Plan for user re-authentication
```

#### 3. Vercel Token

```bash
# 1. Revoke old token at:
# https://vercel.com/account/tokens

# 2. Generate new token
# Click "Create" → Name: "GitHub Actions" → Create

# 3. Update GitHub Secret
gh secret set VERCEL_TOKEN
# Paste new token when prompted

# 4. Verify next deployment succeeds
```

#### 4. Render Deploy Hooks

```bash
# 1. Delete old deploy hook in Render Dashboard
# Service → Settings → Deploy Hook → Delete

# 2. Create new deploy hook
# Click "Create Deploy Hook"

# 3. Update GitHub Secret
gh secret set RENDER_PRODUCTION_API_DEPLOY_HOOK
# Paste new hook URL
```

## Secret Validation

### Test Secrets Locally (Safely)

```bash
# Create temporary .env.test file (NEVER COMMIT)
cat > .env.test << 'EOF'
DATABASE_URL=your-test-database-url
JWT_SECRET=your-test-jwt-secret
EOF

# Test database connection
npm run --workspace=server test:integration

# Clean up immediately
rm .env.test
```

### Verify Secrets in CI

Add validation step to workflows:

```yaml
- name: Validate secrets
  run: |
    # Check secret is not empty
    if [ -z "${{ secrets.PRODUCTION_DATABASE_URL }}" ]; then
      echo "❌ PRODUCTION_DATABASE_URL is not set"
      exit 1
    fi

    # Check secret format (without exposing value)
    if [[ ! "${{ secrets.PRODUCTION_DATABASE_URL }}" =~ ^postgresql:// ]]; then
      echo "❌ PRODUCTION_DATABASE_URL has invalid format"
      exit 1
    fi

    echo "✅ Secrets validation passed"
```

## Security Best Practices

### DO

- ✅ Use GitHub Secrets for all sensitive data
- ✅ Rotate secrets regularly
- ✅ Use environment-specific secrets
- ✅ Require approvals for production deployments
- ✅ Monitor GitHub Actions audit log
- ✅ Use least privilege access (read-only when possible)
- ✅ Document secret purposes and rotation schedule
- ✅ Backup secrets securely (password manager, vault)

### DON'T

- ❌ Commit secrets to version control
- ❌ Echo/print secrets in workflow logs
- ❌ Share secrets via unencrypted channels (email, Slack DM)
- ❌ Use production secrets in staging/development
- ❌ Store secrets in code comments
- ❌ Grant repository write access unnecessarily
- ❌ Skip secret rotation after team changes

### Secrets in Workflow Logs

```yaml
# ❌ BAD - Exposes secret in logs
- name: Test database
  run: echo "Database: ${{ secrets.DATABASE_URL }}"

# ✅ GOOD - Uses secret without exposing
- name: Test database
  run: npm run test:integration
  env:
    DATABASE_URL: ${{ secrets.DATABASE_URL }}

# ✅ GOOD - Masked output
- name: Debug (safe)
  run: |
    echo "Database host: $(echo $DATABASE_URL | cut -d@ -f2)"
  env:
    DATABASE_URL: ${{ secrets.DATABASE_URL }}
```

## Emergency Procedures

### Secret Leaked in Commit

```bash
# 1. Immediately rotate the compromised secret
# (See rotation procedures above)

# 2. Remove from Git history (if recent)
git filter-branch --force --index-filter \
  "git rm --cached --ignore-unmatch path/to/file" \
  --prune-empty --tag-name-filter cat -- --all

# 3. Force push (WARNING: Coordinate with team)
git push origin --force --all

# 4. Notify team and stakeholders

# 5. Monitor for unauthorized access

# 6. Consider repository as compromised
# Generate new secrets for everything
```

### Secret Exposed in Logs

```bash
# 1. Delete workflow run containing exposed secret
# GitHub → Actions → Workflow run → Delete workflow run

# 2. Rotate compromised secret immediately

# 3. Review other workflow runs for similar exposure

# 4. Update workflows to prevent future exposure
```

### Bulk Secret Rotation (Team Member Departure)

```bash
# Create rotation checklist
SECRETS_TO_ROTATE=(
  "JWT_SECRET"
  "TENANT_SECRETS_ENCRYPTION_KEY"
  "STAGING_DATABASE_URL"
  "PRODUCTION_DATABASE_URL"
  "VERCEL_TOKEN"
  "RENDER_STAGING_API_DEPLOY_HOOK"
  "RENDER_PRODUCTION_API_DEPLOY_HOOK"
)

# Rotate each secret
for secret in "${SECRETS_TO_ROTATE[@]}"; do
  echo "Rotating $secret..."
  # Follow specific rotation procedure for each secret type
done

# Verify all rotations completed
gh secret list

# Test deployment with new secrets
git tag -a v1.2.3 -m "chore: rotate all secrets"
git push origin v1.2.3
```

## Monitoring & Auditing

### GitHub Actions Audit Log

1. Navigate to: **Settings** → **Actions** → **General**
2. Enable audit logging
3. Review regularly for:
   - Secret access patterns
   - Unauthorized workflow modifications
   - Failed authentication attempts

### Secret Usage Tracking

```bash
# Track which workflows use which secrets
# Review workflow files:
grep -r "secrets\." .github/workflows/

# Output shows all secret references
# Verify each is necessary and properly used
```

### Automated Alerts

Set up GitHub Actions for secret monitoring:

```yaml
name: Secret Monitoring

on:
  schedule:
    - cron: '0 0 * * 0' # Weekly

jobs:
  check-secrets:
    runs-on: ubuntu-latest
    steps:
      - name: List secrets
        run: gh secret list

      - name: Check secret age
        run: |
          # Implement secret age checking
          # Alert if secrets haven't been rotated in 90+ days
```

## Troubleshooting

### "Secret not found" Error

**Cause:** Secret name mismatch or not set

**Solution:**

```bash
# List all secrets
gh secret list

# Check spelling in workflow file
grep "secrets\." .github/workflows/your-workflow.yml

# Add missing secret
gh secret set SECRET_NAME
```

### "Invalid secret value" Error

**Cause:** Incorrect format or encoding

**Solution:**

```bash
# Check format requirements:
# - Database URL: Must start with postgresql://
# - JWT Secret: Must be valid hex string
# - URLs: Must be valid HTTP/HTTPS

# Regenerate and re-add secret
```

### Environment Secret Not Available

**Cause:** Job not using correct environment

**Solution:**

```yaml
jobs:
  deploy:
    environment: production # Must match environment name
    steps:
      - name: Use secret
        run: echo "Using production database"
        env:
          DATABASE_URL: ${{ secrets.DATABASE_URL }}
```

---

**Security Contact:** devops@mais.app
**Last Updated:** 2025-11-19
**Version:** 1.0.0
