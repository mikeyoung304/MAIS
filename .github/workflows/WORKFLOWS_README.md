# GitHub Actions CI/CD Workflows - MAIS Platform

Complete CI/CD pipeline for the MAIS multi-tenant business growth platform.

## 📋 Table of Contents

- [Workflow Overview](#workflow-overview)
- [Quick Start](#quick-start)
- [Workflows](#workflows)
- [Secrets Configuration](#secrets-configuration)
- [Environment Configuration](#environment-configuration)
- [Deployment Architecture](#deployment-architecture)
- [Troubleshooting](#troubleshooting)
- [Best Practices](#best-practices)

## Workflow Overview

| Workflow                 | Trigger                             | Purpose                            | Duration   |
| ------------------------ | ----------------------------------- | ---------------------------------- | ---------- |
| **PR Validation**        | Pull requests to `main`/`develop`   | Comprehensive testing & validation | ~8-12 min  |
| **Deploy Staging**       | Push to `develop`                   | Deploy to staging environment      | ~15-20 min |
| **Deploy Production**    | Push to `main` or version tags      | Deploy to production               | ~20-30 min |
| **Cache Warmup**         | Daily schedule / dependency changes | Pre-build dependencies             | ~10-15 min |
| **Database Maintenance** | Manual trigger                      | Database operations & migrations   | Varies     |

## Quick Start

### Prerequisites

1. **GitHub Repository Settings**
   - Enable GitHub Actions in repository settings
   - Configure branch protection rules for `main` branch

2. **Required Accounts**
   - Vercel account for frontend deployment
   - Render account for backend deployment
   - Supabase database (PostgreSQL)
   - Codecov account (optional, for coverage reporting)

3. **Configure Secrets** (see [Secrets Configuration](#secrets-configuration))

### Initial Setup

1. **Configure GitHub Secrets:**

   ```bash
   # Navigate to: Settings → Secrets and variables → Actions
   # Add all required secrets (see section below)
   ```

2. **Set up Environments:**

   ```bash
   # Navigate to: Settings → Environments
   # Create: staging, production, production-migrations
   # Configure protection rules for production environments
   ```

3. **Enable Workflows:**

   ```bash
   # Push workflow files to repository
   git add .github/workflows/
   git commit -m "ci: add GitHub Actions workflows"
   git push origin main
   ```

4. **Verify First Run:**
   - Go to Actions tab in GitHub
   - Verify `pr-validation.yml` runs on next PR
   - Check for any configuration errors

## Workflows

### 1. PR Validation (`pr-validation.yml`)

**Triggers:**

- Pull requests to `main` or `develop` branches
- Manual workflow dispatch

**Jobs:**

1. **Code Quality** - ESLint + Prettier (5 min)
2. **TypeScript Check** - Full type validation (5 min)
3. **Security Audit** - npm audit + Snyk (5 min)
4. **Unit Tests** - Vitest with coverage (10 min)
5. **Integration Tests** - PostgreSQL + Prisma (15 min)
6. **E2E Tests** - Playwright mock mode (20 min)
7. **Build Validation** - All workspace packages (10 min)
8. **Migration Validation** - Prisma schema & migrations (10 min)

**Branch Protection:**

```yaml
Required status checks:
  - code-quality
  - typecheck
  - unit-tests
  - integration-tests
  - e2e-tests
  - build-validation
  - migration-validation
```

**Features:**

- Automatic PR comments on failure
- Coverage reports uploaded to Codecov
- Parallel job execution for speed
- Comprehensive artifact uploads

### 2. Deploy Staging (`deploy-staging.yml`)

**Triggers:**

- Push to `develop` branch
- Manual workflow dispatch (with options)

**Deployment Flow:**

```mermaid
graph LR
    A[Tests] --> B[Build]
    B --> C[DB Migrations]
    C --> D[Deploy API - Render]
    D --> E[Deploy Client - Vercel]
    E --> F[E2E Validation]
```

**Manual Trigger Options:**

- `skip_tests`: Emergency deploy without tests (use with caution)

**Jobs:**

1. **Pre-Deployment Tests** - Full test suite (15 min)
2. **Build** - Production builds for all packages (10 min)
3. **Migrate Database** - Run Prisma migrations on staging DB (10 min)
4. **Deploy API** - Render deployment with health checks (15 min)
5. **Deploy Client** - Vercel deployment (15 min)
6. **E2E Staging** - Validate deployment with E2E tests (20 min)

**Features:**

- Health check retries with exponential backoff
- Automatic rollback on failure
- Smoke tests after deployment
- Deployment notifications

### 3. Deploy Production (`deploy-production.yml`)

**Triggers:**

- Push to `main` branch
- Version tags (e.g., `v1.2.3`)
- Manual workflow dispatch (with approvals)

**Manual Trigger Options:**

- `environment`: Target environment (default: production)
- `skip_tests`: Emergency hotfix mode (default: false)
- `run_migrations`: Run database migrations (default: true)

**Jobs:**

1. **Pre-Deployment Checks** - Version validation, breaking change detection (5 min)
2. **Comprehensive Tests** - Full test suite including coverage (20 min)
3. **Build Production** - Production-optimized builds (10 min)
4. **Migrate Database** - **Requires approval** in GitHub Environments (15 min)
5. **Deploy API** - Render with extensive health checks (15 min)
6. **Deploy Client** - Vercel production with custom domains (15 min)
7. **Post-Deployment Validation** - E2E tests against production (25 min)

**Protection:**

- **Environment approval required** for `production-migrations`
- Breaking change detection in commits
- Pre-migration backup verification
- Comprehensive rollback instructions on failure

**Features:**

- Automatic GitHub Release creation on version tags
- Rollback instructions artifact on failure
- 30-day artifact retention
- Production smoke tests with retries

### 4. Cache Warmup (`cache-warmup.yml`)

**Triggers:**

- Daily at 2 AM UTC (cron schedule)
- Push to `main`/`develop` that changes dependencies
- Manual workflow dispatch

**Purpose:**

- Pre-build and cache npm dependencies
- Install and cache Playwright browsers
- Speed up subsequent workflow runs by 50-70%

**What Gets Cached:**

- npm dependencies (node_modules)
- Prisma Client generation
- Playwright browser binaries
- Build artifacts for shared packages

### 5. Database Maintenance (`database-maintenance.yml`)

**Trigger:** Manual workflow dispatch only

**Available Actions:**

1. **Validate Migrations**
   - Validates Prisma schema
   - Tests migrations on fresh PostgreSQL instance
   - Verifies Prisma Client generation
   - No database changes

2. **Generate Migration**
   - Creates instructions for local migration generation
   - Validates migration name format
   - Provides step-by-step guide
   - Uploads instructions as artifact

3. **Seed Staging**
   - Runs database seed script on staging environment
   - Requires staging environment approval
   - Verifies seeded data

4. **Backup Production**
   - Generates comprehensive backup instructions
   - Links to Supabase backup dashboard
   - Provides CLI commands for manual backup

5. **Rollback Migration**
   - Creates detailed rollback instructions
   - **Does not execute rollback automatically** (safety measure)
   - Provides step-by-step recovery plan

**Safety Features:**

- All destructive operations require manual execution
- Comprehensive documentation generated
- Environment-specific protections
- Backup verification steps

## Secrets Configuration

### Required Secrets

Configure in: `Settings → Secrets and variables → Actions`

#### Database Secrets

```bash
# Staging Environment
STAGING_DATABASE_URL=postgresql://user:pass@host:5432/db_staging
STAGING_DIRECT_URL=postgresql://user:pass@host:5432/db_staging

# Production Environment
PRODUCTION_DATABASE_URL=postgresql://user:pass@host:5432/db_production
PRODUCTION_DIRECT_URL=postgresql://user:pass@host:5432/db_production

# Supabase Project ID (for backup links)
SUPABASE_PROJECT_ID=your-project-id
```

#### Deployment Secrets

```bash
# Vercel
VERCEL_TOKEN=your-vercel-token
VERCEL_ORG_ID=your-org-id
VERCEL_PROJECT_ID=your-project-id

# Render
RENDER_STAGING_API_DEPLOY_HOOK=https://api.render.com/deploy/srv-xxx
RENDER_PRODUCTION_API_DEPLOY_HOOK=https://api.render.com/deploy/srv-yyy
```

#### Application URLs

```bash
# Staging
STAGING_API_URL=https://staging-api.mais.app
STAGING_CLIENT_URL=https://staging.mais.app

# Production
PRODUCTION_API_URL=https://api.mais.app
PRODUCTION_CLIENT_URL=https://mais.app
```

#### Optional Secrets

```bash
# Code Coverage
CODECOV_TOKEN=your-codecov-token

# Security Scanning
SNYK_TOKEN=your-snyk-token

# Notifications (add in workflow)
SLACK_WEBHOOK_URL=your-slack-webhook
DISCORD_WEBHOOK_URL=your-discord-webhook
```

### How to Generate Secrets

#### Vercel Token

```bash
# Login to Vercel
npx vercel login

# Generate token at:
# https://vercel.com/account/tokens

# Get org and project IDs:
npx vercel link
# Copy .vercel/project.json values
```

#### Render Deploy Hook

```bash
# Navigate to: Render Dashboard → Your Service → Settings
# Scroll to: Deploy Hook
# Click: Create Deploy Hook
# Copy the URL
```

#### Database URLs (Supabase)

```bash
# Navigate to: Supabase Dashboard → Project Settings → Database
# Connection String → Transaction Mode (for DATABASE_URL)
# Connection String → Session Mode (for DIRECT_URL)

# Format: postgresql://postgres:[PASSWORD]@[HOST]:5432/postgres
# NOTE: URL-encode special characters in password (@ becomes %40)
```

## Environment Configuration

### GitHub Environments

Create three environments in: `Settings → Environments`

#### 1. Staging Environment

```yaml
Name: staging
Protection rules:
  - Wait timer: 0 minutes
  - Required reviewers: 0
  - Allow administrators to bypass: Yes
Deployment branches:
  - develop
```

#### 2. Production Environment

```yaml
Name: production
Protection rules:
  - Wait timer: 0 minutes
  - Required reviewers: 1+ (recommended)
  - Allow administrators to bypass: No
Deployment branches:
  - main
  - Protected branches only
```

#### 3. Production Migrations Environment

```yaml
Name: production-migrations
Protection rules:
  - Wait timer: 5 minutes (safety delay)
  - Required reviewers: 2+ (recommended)
  - Allow administrators to bypass: No
Deployment branches:
  - main
  - Protected branches only
```

**Why separate migration environment?**

- Database migrations are high-risk operations
- Requires explicit approval from team members
- Provides time to verify backup status
- Prevents accidental schema changes

## Deployment Architecture

### Infrastructure Overview

```
┌─────────────────────────────────────────────────┐
│                GitHub Actions                    │
│  ┌──────────────┐      ┌──────────────┐        │
│  │ PR Validation│      │  Deployment  │        │
│  │   Workflow   │      │   Workflow   │        │
│  └──────┬───────┘      └──────┬───────┘        │
└─────────┼──────────────────────┼────────────────┘
          │                      │
          ├──────────┬───────────┴──────────┬─────
          │          │                      │
    ┌─────▼────┐ ┌──▼──────────┐    ┌─────▼─────┐
    │PostgreSQL│ │    Render   │    │  Vercel   │
    │(Supabase)│ │ (API Server)│    │ (Client)  │
    └──────────┘ └─────────────┘    └───────────┘
    Migrations   Node.js Express    React + Vite
```

### Deployment Sequence

1. **Code Push** → GitHub repository
2. **Tests Run** → GitHub Actions runners
3. **Builds Created** → Artifacts uploaded
4. **Database Migrated** → Supabase PostgreSQL
5. **API Deployed** → Render (Node.js)
6. **Client Deployed** → Vercel (Static)
7. **Validation** → E2E tests against live environment

### Environment Differences

| Aspect            | Staging                  | Production                  |
| ----------------- | ------------------------ | --------------------------- |
| Database          | Supabase staging project | Supabase production project |
| API Domain        | staging-api.mais.app     | api.mais.app                |
| Client Domain     | staging.mais.app         | mais.app, www.mais.app      |
| Approval Required | No                       | Yes (for migrations)        |
| Branch            | develop                  | main                        |
| Test Data         | Seeded test data         | Real customer data          |
| Monitoring        | Basic logging            | Full monitoring + alerts    |

## Troubleshooting

### Common Issues

#### 1. "Database connection failed" in Integration Tests

**Cause:** PostgreSQL service container not ready

**Solution:**

```yaml
# Workflow already includes health checks
options: >-
  --health-cmd pg_isready
  --health-interval 10s
  --health-timeout 5s
  --health-retries 5
```

If issue persists:

- Check DATABASE_URL format in workflow
- Verify connection pool limits: `?connection_limit=10&pool_timeout=20`
- Review test cleanup (connection leaks)

#### 2. "Prisma Client out of sync" Error

**Cause:** Schema changed but client not regenerated

**Solution:**

```bash
# Always run after schema changes:
npm run --workspace=server prisma:generate

# In CI, this is automatic in workflows
```

#### 3. "Vercel deployment failed - Invalid token"

**Cause:** Expired or incorrect Vercel token

**Solution:**

```bash
# Generate new token at:
https://vercel.com/account/tokens

# Update GitHub secret: VERCEL_TOKEN
```

#### 4. "Render deployment timeout"

**Cause:** Deploy hook not responding or service down

**Solution:**

```bash
# Check Render status:
https://status.render.com

# Verify deploy hook URL in secrets
# Check Render dashboard for service health
```

#### 5. "E2E tests timeout waiting for API"

**Cause:** API server failed to start in mock mode

**Solution:**

```yaml
# Check API startup logs in workflow
# Verify JWT_SECRET is set
# Check port 3001 availability
# Increase wait-on timeout if needed:
npx wait-on http://localhost:3001/health --timeout 60000
```

#### 6. "Migration validation failed"

**Cause:** Schema conflicts or invalid migration files

**Solution:**

```bash
# Locally test migrations:
cd server
npx prisma validate
npx prisma migrate dev --name test_migration

# Check migration files in server/prisma/migrations/
# Ensure no manual edits to migration history
```

### Debugging Workflows

#### View Detailed Logs

1. Navigate to Actions tab in GitHub
2. Click on failed workflow run
3. Click on failed job
4. Expand step to view full logs

#### Download Artifacts

```bash
# Failed E2E tests create artifacts:
- playwright-report/ (HTML report with screenshots)
- test-results/ (traces and videos)

# Download from workflow run page
# Extract and open index.html
```

#### Re-run Failed Jobs

1. Click "Re-run failed jobs" button in workflow run
2. Or "Re-run all jobs" to start fresh
3. Check if transient issue or real failure

#### Manual Testing

```bash
# Run same commands locally:

# Install dependencies
npm ci

# Run tests
npm run test:unit
npm run test:integration
npm run test:e2e

# Build
npm run build --workspaces --if-present

# Migrations
cd server && npx prisma migrate deploy
```

## Best Practices

### For Developers

1. **Test Locally First**

   ```bash
   # Before pushing:
   npm run lint
   npm run typecheck
   npm run test
   npm run build --workspaces --if-present
   ```

2. **Meaningful Commit Messages**

   ```bash
   # Use conventional commits:
   feat(api): add package photo upload endpoint
   fix(auth): resolve JWT expiration edge case
   chore(deps): update Prisma to v6.17.1
   ```

3. **Keep PRs Small**
   - Focus on single feature/fix
   - Easier to review and test
   - Faster CI execution

4. **Monitor Workflow Runs**
   - Check Actions tab after push
   - Fix failures promptly
   - Don't ignore flaky tests

### For DevOps

1. **Secrets Rotation**

   ```bash
   # Rotate sensitive secrets quarterly:
   - Database passwords
   - API tokens (Vercel, Render)
   - JWT secrets
   - Encryption keys

   # Update in GitHub Secrets immediately
   ```

2. **Monitor Workflow Performance**
   - Track average execution time
   - Optimize slow jobs (caching, parallelization)
   - Remove unnecessary steps

3. **Review Failed Deployments**
   - Investigate all production failures
   - Update runbooks with solutions
   - Improve rollback procedures

4. **Database Migration Safety**
   - Always test migrations on staging first
   - Verify backup before production migrations
   - Have rollback plan ready
   - Coordinate with team for downtime

5. **Cost Optimization**
   ```bash
   # Reduce GitHub Actions minutes:
   - Use caching (cache-warmup.yml)
   - Parallel job execution
   - Skip redundant steps
   - Use self-hosted runners for large projects
   ```

### For Team Leads

1. **Branch Protection Rules**

   ```yaml
   # Recommended settings for main branch:
   - Require pull request reviews: 1+
   - Require status checks: All from pr-validation.yml
   - Require branches to be up to date
   - Include administrators: Yes
   - Require linear history: Yes
   ```

2. **Approval Workflows**
   - Production deployments: 1+ approver
   - Database migrations: 2+ approvers
   - Emergency hotfixes: Document exception process

3. **Incident Response**
   - Monitor production deployments
   - Have rollback procedure ready
   - Establish communication channels
   - Post-mortem for failures

4. **Documentation**
   - Keep this README updated
   - Document new workflows
   - Update secrets list
   - Maintain runbooks

## Additional Resources

### Documentation

- [CLAUDE.md](../../CLAUDE.md) - Project overview and development guide
- [TESTING.md](../../docs/TESTING.md) - Testing strategy and patterns
- [DEVELOPING.md](../../DEVELOPING.md) - Local development setup
- [Multi-Tenant Guide](../../docs/multi-tenant/MULTI_TENANT_IMPLEMENTATION_GUIDE.md)

### External Links

- [GitHub Actions Documentation](https://docs.github.com/en/actions)
- [Prisma Migrations](https://www.prisma.io/docs/guides/migrate)
- [Vercel Deployment](https://vercel.com/docs/deployments)
- [Render Documentation](https://render.com/docs)
- [Supabase Backups](https://supabase.com/docs/guides/database/backups)
- [Playwright CI](https://playwright.dev/docs/ci)

### Support

- **Internal Team:** Check #devops Slack channel
- **GitHub Issues:** Report workflow problems
- **External Services:**
  - Vercel: https://vercel.com/support
  - Render: https://render.com/support
  - Supabase: https://supabase.com/support

---

**Last Updated:** 2025-11-19
**Maintained By:** MAIS DevOps Team
**Version:** 1.0.0
