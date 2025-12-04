# Environment Variables Reference

## Quick Reference Matrix

| Variable                        | Tier | Dev      | CI Unit | CI Int | CI E2E | Staging | Prod | Purpose                        | Default               |
| ------------------------------- | ---- | -------- | ------- | ------ | ------ | ------- | ---- | ------------------------------ | --------------------- |
| `NODE_ENV`                      | 1    | ✓        | ✓       | ✓      | ✓      | ✓       | ✓    | Environment mode               | development           |
| `ADAPTERS_PRESET`               | 1    | ✓        | ✓       | ✓      | ✓      | ✓       | ✓    | Adapter mode (mock/real)       | mock                  |
| `API_PORT`                      | 1    | ✓        | ✓       | ✓      | ✓      | ✓       | ✓    | API server port                | 3001                  |
| `JWT_SECRET`                    | 1    | ✓        | ✓       | ✓      | ✓      | ✓       | ✓    | JWT signing key (64 hex chars) | (required)            |
| `TENANT_SECRETS_ENCRYPTION_KEY` | 1    | ✓        | ✓       | ✓      | ✓      | ✓       | ✓    | Encryption key (64 hex chars)  | (required)            |
| `CORS_ORIGIN`                   | 1    | ✓        | ✓       | ✓      | ✓      | ✓       | ✓    | CORS origin URL                | http://localhost:5173 |
| `DATABASE_URL`                  | 1    | ✓ (mock) | ✓       | ✓      | ✗      | ✓       | ✓    | PostgreSQL pooler URL          | (conditional)         |
| `DIRECT_URL`                    | 1    | ✗        | ✗       | ✓      | ✗      | ✓       | ✓    | Direct DB URL (for migrations) | (conditional)         |
| `STRIPE_SECRET_KEY`             | 2    | ✗        | ✗       | ✗      | ✗      | ✓       | ✓    | Stripe API key                 | (optional)            |
| `STRIPE_WEBHOOK_SECRET`         | 2    | ✗        | ✗       | ✗      | ✗      | ✓       | ✓    | Stripe webhook secret          | (optional)            |
| `POSTMARK_SERVER_TOKEN`         | 2    | ✗        | ✗       | ✗      | ✗      | ✓       | ✓    | Email API token                | (fallback)            |
| `POSTMARK_FROM_EMAIL`           | 2    | ✗        | ✗       | ✗      | ✗      | ✓       | ✓    | Email sender address           | (optional)            |
| `GOOGLE_CALENDAR_ID`            | 3    | ✗        | ✗       | ✗      | ✗      | ✓       | ✓    | Calendar ID                    | (fallback)            |

**Legend:**

- ✓ = Required
- ✗ = Not required (uses default/fallback)
- Tier 1 = Core (always)
- Tier 2 = Production-critical
- Tier 3 = Optional with graceful fallbacks

## Environment-Specific Requirements

### Development (Local)

```bash
# Minimum for mock mode
ADAPTERS_PRESET=mock
JWT_SECRET=dev-jwt-secret-change-in-production
TENANT_SECRETS_ENCRYPTION_KEY=0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef

# For real mode (Supabase)
DATABASE_URL=postgresql://user:pass@host:5432/mais
DIRECT_URL=postgresql://user:pass@host:5432/mais
STRIPE_SECRET_KEY=sk_test_...
POSTMARK_SERVER_TOKEN=your-token
```

### CI: Unit Tests Job

```yaml
# Required in GitHub Actions secret
JWT_SECRET: xxxx
TENANT_SECRETS_ENCRYPTION_KEY: xxxx

# Set in workflow step
NODE_ENV: test
ADAPTERS_PRESET: mock
```

### CI: Integration Tests Job

```yaml
# Required in GitHub Actions secret
JWT_SECRET: xxxx
TENANT_SECRETS_ENCRYPTION_KEY: xxxx

# Set in workflow step (PostgreSQL service container)
NODE_ENV: test
DATABASE_URL: postgresql://postgres:postgres@localhost:5432/mais_test?connection_limit=10
DIRECT_URL: postgresql://postgres:postgres@localhost:5432/mais_test
```

**CRITICAL:** Both `DATABASE_URL` and `DIRECT_URL` must be set for Prisma migrations!

### CI: E2E Tests Job

```yaml
# Required in GitHub Actions secret
JWT_SECRET: xxxx

# Set in workflow step (mock mode)
ADAPTERS_PRESET: mock
API_PORT: 3001
CORS_ORIGIN: http://localhost:5173
```

### Staging Deployment

```bash
# All Tier 1 variables (change values for staging)
ADAPTERS_PRESET=real
JWT_SECRET=<staging-key>
TENANT_SECRETS_ENCRYPTION_KEY=<staging-key>

# Database (Supabase staging)
DATABASE_URL=postgresql://staging-user:pass@staging-host:5432/mais_staging
DIRECT_URL=postgresql://staging-user:pass@staging-host:5432/mais_staging

# Stripe (test mode)
STRIPE_SECRET_KEY=sk_test_...
STRIPE_WEBHOOK_SECRET=whsec_test_...

# Email (optional - Postmark test)
POSTMARK_SERVER_TOKEN=your-test-token
```

### Production Deployment

```bash
# All Tier 1 + Tier 2 variables (secure values only)
ADAPTERS_PRESET=real
JWT_SECRET=<production-key>  # Rotate every 90 days
TENANT_SECRETS_ENCRYPTION_KEY=<production-key>

# Database (Supabase production)
DATABASE_URL=postgresql://prod-user:pass@prod-host:5432/mais
DIRECT_URL=postgresql://prod-user:pass@prod-host:5432/mais

# Stripe (live mode)
STRIPE_SECRET_KEY=sk_live_...
STRIPE_WEBHOOK_SECRET=whsec_live_...

# Email
POSTMARK_SERVER_TOKEN=your-production-token

# Google Calendar
GOOGLE_CALENDAR_ID=your-calendar-id
GOOGLE_SERVICE_ACCOUNT_JSON_BASE64=base64-encoded-json
```

## Per-Job Detailed Requirements

### main-pipeline.yml Jobs

#### Job: docs-validation

- Required: None
- Runs: On all commits

#### Job: pattern-validation

- Required: None
- Runs: On all commits

#### Job: lint

- Required: None
- Runs: On all commits

#### Job: typecheck

- Required: None
- Runs: On all commits

#### Job: unit-tests

- Required (set in step):
  - `NODE_ENV=test`
  - `JWT_SECRET` (GitHub secret)
  - `TENANT_SECRETS_ENCRYPTION_KEY` (GitHub secret)
- Runs: On all commits

#### Job: integration-tests

- Required (set in step):
  - `NODE_ENV=test`
  - `DATABASE_URL=postgresql://postgres:postgres@localhost:5432/mais_test?connection_limit=10&pool_timeout=20`
  - `DIRECT_URL=postgresql://postgres:postgres@localhost:5432/mais_test`
  - `JWT_SECRET` (GitHub secret)
  - `TENANT_SECRETS_ENCRYPTION_KEY` (GitHub secret)
- Service: PostgreSQL 16
- Runs: On all commits

#### Job: migration-validation

- Required (set in step):
  - `DATABASE_URL=postgresql://postgres:postgres@localhost:5432/mais_migration_test?connection_limit=10&pool_timeout=20`
  - `DIRECT_URL=postgresql://postgres:postgres@localhost:5432/mais_migration_test`
- Service: PostgreSQL 16
- Runs: Pull requests only
- **Critical:** Both URLs required for `prisma migrate deploy`

#### Job: e2e-tests

- Required (set in step):
  - `ADAPTERS_PRESET=mock`
  - `JWT_SECRET` (GitHub secret)
  - `API_PORT=3001`
  - `CORS_ORIGIN=http://localhost:5173`
  - `CI=true`
- Runs: On all commits

#### Job: build

- Required: None (inherits from lint/typecheck)
- Runs: On all commits

### deploy-production.yml Jobs

#### Job: pre-deployment-checks

- Required: None
- Runs: Manual trigger or main push

#### Job: test-before-deploy

- Required (set in step):
  - `NODE_ENV=test`
  - `DATABASE_URL=postgresql://postgres:postgres@localhost:5432/mais_test?connection_limit=10&pool_timeout=20`
  - `DIRECT_URL=postgresql://postgres:postgres@localhost:5432/mais_test`
  - `JWT_SECRET` (GitHub secret)
  - `TENANT_SECRETS_ENCRYPTION_KEY` (GitHub secret)
- Service: PostgreSQL 16
- Runs: On deployment (unless skip_tests=true)
- **Critical:** DIRECT_URL required for migrations

#### Job: build-production

- Required (env):
  - `NODE_ENV=production`
- Runs: After test-before-deploy

#### Job: migrate-database-production

- Required (GitHub secrets):
  - `PRODUCTION_DATABASE_URL`
  - `PRODUCTION_DIRECT_URL`
- **Critical:** Both DATABASE_URL and DIRECT_URL required
- **Why:** Supabase uses connection pooler (DATABASE_URL) for app connections and direct URL for migrations
- Runs: If run_migrations != 'false'

#### Job: deploy-api-production

- Required (env):
  - `PRODUCTION_API_URL` (GitHub environment variable)
  - `RENDER_PRODUCTION_API_DEPLOY_HOOK` (GitHub secret)
- Runs: After migrate-database-production

#### Job: deploy-client-production

- Required (env):
  - `PRODUCTION_CLIENT_URL` (GitHub environment variable)
  - `VERCEL_TOKEN` (GitHub secret)
  - `VERCEL_ORG_ID` (GitHub secret)
  - `VERCEL_PROJECT_ID` (GitHub secret)
- Runs: After deploy-api-production

#### Job: post-deployment-validation

- Required:
  - `PRODUCTION_CLIENT_URL` (GitHub environment variable)
  - `PRODUCTION_API_URL` (GitHub environment variable)
- Runs: After deploy-client-production

## Configuration Sources

| Variable                  | Source                                 | Security                             |
| ------------------------- | -------------------------------------- | ------------------------------------ |
| Local development         | `.env` file                            | Local only, never committed          |
| CI unit/integration tests | GitHub Secrets + workflow steps        | Encrypted secrets + masked logs      |
| CI E2E tests              | GitHub Secrets                         | Masked logs only                     |
| Production                | GitHub Secrets + Environment variables | Restricted to production environment |

## Validation Checklist

Before deploying, verify:

- [ ] All TIER 1 variables are set (no empty values)
- [ ] DATABASE_URL and DIRECT_URL both present when using migrations
- [ ] JWT_SECRET is 64 hex characters
- [ ] TENANT_SECRETS_ENCRYPTION_KEY is 64 hex characters
- [ ] STRIPE\_\* variables match account type (test vs live)
- [ ] Environment-specific URLs are correct
- [ ] No hardcoded values in code (all come from env)
- [ ] No secrets logged in CI output

## Troubleshooting

### Missing DIRECT_URL Error

```
Error: could not find the DIRECT_URL environment variable
```

**Fix:**

```bash
# In workflow step:
env:
  DATABASE_URL: postgresql://...
  DIRECT_URL: postgresql://...  # <- Add this

# In local .env:
DIRECT_URL=postgresql://...
```

### Wrong Stripe Key

```
Error: Invalid API Key provided: sk_test_... (live mode detected)
```

**Fix:**

- Use `sk_test_*` keys in staging
- Use `sk_live_*` keys in production
- Never mix test and live keys

### Email Not Sending

```
# Default: Writes to ./tmp/emails/ (file-sink adapter)
# Optional: Set POSTMARK_SERVER_TOKEN to enable real email
```

**Fix:**

```bash
# Option 1: Enable Postmark
POSTMARK_SERVER_TOKEN=your-token

# Option 2: Check file-sink output
cat ./tmp/emails/*.eml
```

### Type Generation Issues

```
Error: Cannot find module '@macon/contracts'
```

**Fix:**

```bash
# Generate types before running
npm run build --workspace=packages/contracts
npm run typecheck -- --noEmit
```

## Best Practices

1. **Never hardcode** - All config from environment
2. **Use .env.example** - Document all variables with examples
3. **Tier-based validation** - Run doctor script before CI
4. **Rotate secrets** - Every 90 days for TIER 1, 180 days for TIER 2
5. **Mask in logs** - GitHub Actions automatically masks secrets
6. **Document in code** - Reference this guide in comments
7. **Test locally** - Verify .env works before pushing

## Generation Commands

Generate secure random values:

```bash
# 64-character hex strings (for JWT and encryption keys)
openssl rand -hex 32

# Generate multiple at once
echo "JWT_SECRET=$(openssl rand -hex 32)" >> .env
echo "TENANT_SECRETS_ENCRYPTION_KEY=$(openssl rand -hex 32)" >> .env
```
