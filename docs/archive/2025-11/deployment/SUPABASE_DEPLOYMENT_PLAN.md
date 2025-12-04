# MAIS Supabase Deployment Plan (No Docker)

**Status:** Ready for Implementation
**Based On:** rebuild-6.0 cloud-native deployment pattern
**Target:** Vercel (client) + Render (API) + Supabase (DB)

---

## Executive Summary

This plan migrates MAIS from Docker-based deployment to a cloud-native approach matching rebuild-6.0's proven architecture:

- ✅ **No Docker required** - Direct platform deployment
- ✅ **Supabase PostgreSQL** - Managed database with automatic backups
- ✅ **Vercel frontend** - Serverless React deployment
- ✅ **Render backend** - Managed Express API hosting
- ✅ **GitHub Actions CI/CD** - Automated migrations + deployment
- ✅ **Zero secrets in repo** - Platform-managed environment variables

---

## Phase 1: Supabase Database Setup

### 1.1 Supabase Project Configuration

**When you provide credentials**, we'll need:

```bash
# Supabase Dashboard → Settings → API
SUPABASE_URL=https://[project-id].supabase.co
SUPABASE_ANON_KEY=eyJhbGci...  # Public, safe in client
SUPABASE_SERVICE_KEY=eyJhbGci...  # Secret, server-only
SUPABASE_JWT_SECRET=your-jwt-secret  # For token validation

# Supabase Dashboard → Settings → Database
DATABASE_URL=postgresql://postgres.[project-id]:[password]@aws-0-us-west-1.pooler.supabase.com:5432/postgres
DIRECT_URL=postgresql://postgres.[project-id]:[password]@aws-0-us-west-1.pooler.supabase.com:5432/postgres
```

**Supabase Features We'll Enable:**

- ✅ Connection pooling (automatic via Supavisor)
- ✅ Row-Level Security (RLS) for tenant isolation
- ✅ Automatic backups (daily)
- ✅ Point-in-time recovery
- ✅ Database webhooks (for real-time features)

### 1.2 Database Connection Pattern

**Create:** `/server/src/config/database.ts` (similar to rebuild-6.0)

```typescript
import { createClient } from '@supabase/supabase-js';
import { logger } from '../lib/core/logger';

let supabaseServiceClient: ReturnType<typeof createClient> | null = null;
let supabaseAnonClient: ReturnType<typeof createClient> | null = null;

/**
 * Get Supabase client with SERVICE_ROLE key (bypasses RLS)
 * Use for server-side operations that need full access
 */
export function getSupabaseClient() {
  if (!supabaseServiceClient) {
    const url = process.env.SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_KEY;

    if (!url || !key) {
      throw new Error('SUPABASE_URL and SUPABASE_SERVICE_KEY required');
    }

    supabaseServiceClient = createClient(url, key, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });

    logger.info('Supabase service client initialized');
  }

  return supabaseServiceClient;
}

/**
 * Get Supabase client with ANON key (respects RLS)
 * Use for user-facing auth operations
 */
export function getSupabaseAuthClient() {
  if (!supabaseAnonClient) {
    const url = process.env.SUPABASE_URL;
    const key = process.env.SUPABASE_ANON_KEY;

    if (!url || !key) {
      throw new Error('SUPABASE_URL and SUPABASE_ANON_KEY required');
    }

    supabaseAnonClient = createClient(url, key);
    logger.info('Supabase auth client initialized');
  }

  return supabaseAnonClient;
}

/**
 * Verify database connection on startup
 */
export async function verifyDatabaseConnection(): Promise<void> {
  try {
    const { data, error } = await getSupabaseClient().from('Tenant').select('count').limit(1);

    if (error) throw error;

    logger.info('Database connection verified');
  } catch (error) {
    logger.error({ error }, 'Database connection failed');
    throw error;
  }
}
```

### 1.3 Environment Variable Validation

**Create:** `/server/src/config/env.schema.ts`

```typescript
import { z } from 'zod';

/**
 * Three-tier environment variable validation
 * Based on rebuild-6.0 pattern
 */

// TIER 1: Always Required (Development + Production)
const tier1Schema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']),
  PORT: z.coerce.number().default(3001),

  // Database
  DATABASE_URL: z.string().url(),
  DIRECT_URL: z.string().url().optional(),

  // Supabase
  SUPABASE_URL: z.string().url(),
  SUPABASE_ANON_KEY: z.string().startsWith('eyJ'),
  SUPABASE_SERVICE_KEY: z.string().startsWith('eyJ'),
  SUPABASE_JWT_SECRET: z.string().min(32),

  // Security
  JWT_SECRET: z.string().min(32),
  TENANT_SECRETS_ENCRYPTION_KEY: z.string().min(32),
});

// TIER 2: Production-Critical (Required in production only)
const tier2Schema = z.object({
  // Stripe
  STRIPE_SECRET_KEY: z.string().startsWith('sk_').optional(),
  STRIPE_WEBHOOK_SECRET: z.string().startsWith('whsec_').optional(),

  // Email
  POSTMARK_SERVER_TOKEN: z.string().optional(),
  POSTMARK_FROM_EMAIL: z.string().email().optional(),

  // CORS
  CORS_ORIGIN: z.string().url().optional(),
});

// TIER 3: Optional (Feature Flags)
const tier3Schema = z.object({
  // Monitoring
  SENTRY_DSN: z.string().url().optional(),

  // Calendar
  GOOGLE_CALENDAR_ID: z.string().optional(),
  GOOGLE_SERVICE_ACCOUNT_JSON_BASE64: z.string().optional(),
});

export const envSchema = tier1Schema.merge(tier2Schema).merge(tier3Schema);

export type Env = z.infer<typeof envSchema>;

/**
 * Validate environment variables at startup
 * Fail fast if critical variables missing
 */
export function validateEnv(): Env {
  const result = envSchema.safeParse(process.env);

  if (!result.success) {
    console.error('❌ Environment validation failed:');
    console.error(result.error.format());
    process.exit(1);
  }

  // Production-specific validation
  if (result.data.NODE_ENV === 'production') {
    const prodRequired = [
      'STRIPE_SECRET_KEY',
      'STRIPE_WEBHOOK_SECRET',
      'POSTMARK_SERVER_TOKEN',
      'CORS_ORIGIN',
    ];

    const missing = prodRequired.filter((key) => !result.data[key as keyof Env]);

    if (missing.length > 0) {
      console.error('❌ Production environment missing required variables:');
      console.error(missing);
      process.exit(1);
    }
  }

  return result.data;
}
```

### 1.4 Migration Strategy: Remote-First

**Key Difference from Current Approach:**

- Current: Local Prisma schema → Generate migration → Push to DB
- New: Remote Supabase DB → Pull schema → Generate Prisma client

**Migration Workflow:**

```bash
# 1. Create migration in Supabase SQL Editor or local SQL file
# File: /supabase/migrations/20251120000000_add_commission_tracking.sql

-- Idempotent pattern (safe to run multiple times)
CREATE TABLE IF NOT EXISTS "CommissionLog" (
  "id" TEXT PRIMARY KEY,
  "tenantId" TEXT NOT NULL,
  "bookingId" TEXT NOT NULL,
  "amount" INTEGER NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "CommissionLog_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE,
  CONSTRAINT "CommissionLog_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES "Booking"("id") ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS "CommissionLog_tenantId_idx" ON "CommissionLog"("tenantId");
CREATE INDEX IF NOT EXISTS "CommissionLog_bookingId_idx" ON "CommissionLog"("bookingId");

-- 2. Sync Prisma schema from remote DB
# npx prisma db pull

-- 3. Regenerate Prisma client
# npx prisma generate

-- 4. Commit schema.prisma (now matches remote)
# git add prisma/schema.prisma
# git commit -m "sync: pull CommissionLog table from Supabase"
```

**Migration File Naming Convention:**

```
supabase/migrations/
├── 20251120000000_add_commission_tracking.sql
├── 20251120000100_add_segment_tables.sql
├── 20251120000200_add_rls_policies.sql
```

**Idempotent SQL Patterns:**

```sql
-- Table creation
CREATE TABLE IF NOT EXISTS "TableName" (...);

-- Index creation
CREATE INDEX IF NOT EXISTS "idx_name" ON "Table"("column");

-- Column addition
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name='Table' AND column_name='newColumn'
  ) THEN
    ALTER TABLE "Table" ADD COLUMN "newColumn" TEXT;
  END IF;
END $$;

-- Data insertion
INSERT INTO "Table" (id, name)
VALUES ('id1', 'name1')
ON CONFLICT (id) DO NOTHING;
```

---

## Phase 2: Render Backend Deployment

### 2.1 Render Configuration

**Create:** `/render.yaml` (Infrastructure as Code)

```yaml
services:
  - type: web
    name: mais-api
    runtime: node
    env: node
    region: oregon
    plan: starter # $7/month (upgrade to standard for production)

    buildCommand: npm install && npm run build --workspace=server
    startCommand: npm run start --workspace=server

    healthCheckPath: /health/ready

    envVars:
      - key: NODE_ENV
        value: production

      - key: PORT
        value: 3001

      # Database (from Render dashboard)
      - key: DATABASE_URL
        sync: false # Set in Render dashboard

      - key: DIRECT_URL
        sync: false

      # Supabase (from Render dashboard)
      - key: SUPABASE_URL
        sync: false

      - key: SUPABASE_ANON_KEY
        sync: false

      - key: SUPABASE_SERVICE_KEY
        sync: false

      - key: SUPABASE_JWT_SECRET
        sync: false

      # Security (generate with openssl rand -hex 32)
      - key: JWT_SECRET
        sync: false

      - key: TENANT_SECRETS_ENCRYPTION_KEY
        sync: false

      # Stripe (from Render dashboard)
      - key: STRIPE_SECRET_KEY
        sync: false

      - key: STRIPE_WEBHOOK_SECRET
        sync: false

      - key: STRIPE_SUCCESS_URL
        value: https://mais.app/success

      - key: STRIPE_CANCEL_URL
        value: https://mais.app

      # Email
      - key: POSTMARK_SERVER_TOKEN
        sync: false

      - key: POSTMARK_FROM_EMAIL
        value: bookings@mais.app

      # CORS
      - key: CORS_ORIGIN
        value: https://mais.app

      # Monitoring (optional)
      - key: SENTRY_DSN
        sync: false

    autoDeploy: true # Deploy on git push to main
```

### 2.2 Package.json Scripts

**Update:** `/package.json` and `/server/package.json`

```json
{
  "scripts": {
    "build:render": "npm run build --workspace=server",
    "start": "npm run start --workspace=server",
    "deploy:render": "git push render main"
  }
}
```

```json
{
  "name": "@macon/api",
  "scripts": {
    "build": "tsc && npx prisma generate",
    "start": "node dist/index.js",
    "dev": "tsx watch src/index.ts",
    "test": "vitest run",
    "test:watch": "vitest"
  }
}
```

### 2.3 Deployment Process

```bash
# 1. Connect Render to GitHub repo
# Dashboard → New Web Service → Connect Repository

# 2. Set environment variables in Render dashboard
# Dashboard → Environment → Add all variables from render.yaml

# 3. Deploy
git push origin main  # Automatic deployment via Render

# 4. Verify deployment
curl https://mais-api.onrender.com/health/ready

# 5. Check logs
# Dashboard → Logs → View real-time logs
```

---

## Phase 3: Vercel Frontend Deployment

### 3.1 Vercel Configuration

**Create:** `/vercel.json`

```json
{
  "version": 2,
  "builds": [
    {
      "src": "client/package.json",
      "use": "@vercel/node"
    }
  ],
  "routes": [
    {
      "src": "/widget.html",
      "dest": "/client/dist/widget.html"
    },
    {
      "src": "/(.*)",
      "dest": "/client/dist/$1"
    }
  ],
  "env": {
    "VITE_API_BASE_URL": "https://mais-api.onrender.com",
    "VITE_SUPABASE_URL": "@supabase-url",
    "VITE_SUPABASE_ANON_KEY": "@supabase-anon-key"
  },
  "build": {
    "env": {
      "VITE_API_BASE_URL": "https://mais-api.onrender.com",
      "VITE_SUPABASE_URL": "@supabase-url",
      "VITE_SUPABASE_ANON_KEY": "@supabase-anon-key"
    }
  },
  "regions": ["sfo1"],
  "framework": "vite"
}
```

### 3.2 Client Environment Variables

**Update:** `/client/.env.production`

```bash
# Public variables (safe to expose in browser)
VITE_API_BASE_URL=https://mais-api.onrender.com
VITE_SUPABASE_URL=https://[project-id].supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGci...

# Feature flags
VITE_ENABLE_SENTRY=true
VITE_SENTRY_DSN=https://...@sentry.io/...
```

### 3.3 Package.json Scripts

**Update:** `/client/package.json`

```json
{
  "scripts": {
    "build": "vite build",
    "build:vercel": "vite build",
    "preview": "vite preview",
    "deploy:vercel": "vercel --prod"
  }
}
```

### 3.4 Deployment Process

```bash
# 1. Install Vercel CLI
npm install -g vercel

# 2. Link project to Vercel
cd /Users/mikeyoung/CODING/MAIS
vercel link

# 3. Set environment variables
vercel env add VITE_API_BASE_URL production
vercel env add VITE_SUPABASE_URL production
vercel env add VITE_SUPABASE_ANON_KEY production

# 4. Deploy
vercel --prod

# Or automatic deployment:
git push origin main  # Auto-deploy via Vercel GitHub integration
```

---

## Phase 4: GitHub Actions CI/CD

### 4.1 Migration Deployment Workflow

**Create:** `/.github/workflows/deploy-migrations.yml`

```yaml
name: Deploy Database Migrations

on:
  push:
    branches: [main]
    paths:
      - 'supabase/migrations/**'
  workflow_dispatch:

jobs:
  deploy-migrations:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: 20

      - name: Install Supabase CLI
        run: |
          curl -fsSL https://deb.supabase.com/supabase.gpg | sudo apt-key add -
          echo "deb https://deb.supabase.com stable main" | sudo tee /etc/apt/sources.list.d/supabase.list
          sudo apt-get update
          sudo apt-get install supabase

      - name: Run Migrations
        env:
          SUPABASE_ACCESS_TOKEN: ${{ secrets.SUPABASE_ACCESS_TOKEN }}
          SUPABASE_DB_PASSWORD: ${{ secrets.SUPABASE_DB_PASSWORD }}
        run: |
          supabase link --project-ref ${{ secrets.SUPABASE_PROJECT_ID }}
          supabase db push

      - name: Sync Prisma Schema
        run: |
          npm install
          npx prisma db pull
          npx prisma generate

      - name: Commit Schema Changes
        run: |
          git config user.name "GitHub Actions"
          git config user.email "actions@github.com"
          git add prisma/schema.prisma
          git commit -m "sync: pull schema from Supabase after migration" || echo "No changes"
          git push
```

### 4.2 Main Deployment Workflow

**Update:** `/.github/workflows/deploy-production.yml`

```yaml
name: Deploy to Production

on:
  push:
    branches: [main]
  workflow_dispatch:

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20

      - name: Install dependencies
        run: npm ci

      - name: Run tests
        run: npm test

      - name: Type check
        run: npm run typecheck

  deploy-backend:
    needs: test
    runs-on: ubuntu-latest
    steps:
      - name: Trigger Render Deployment
        run: |
          curl -X POST ${{ secrets.RENDER_DEPLOY_HOOK_URL }}

  deploy-frontend:
    needs: test
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Deploy to Vercel
        uses: amondnet/vercel-action@v25
        with:
          vercel-token: ${{ secrets.VERCEL_TOKEN }}
          vercel-org-id: ${{ secrets.VERCEL_ORG_ID }}
          vercel-project-id: ${{ secrets.VERCEL_PROJECT_ID }}
          vercel-args: '--prod'

  smoke-test:
    needs: [deploy-backend, deploy-frontend]
    runs-on: ubuntu-latest
    steps:
      - name: Health Check API
        run: |
          curl -f https://mais-api.onrender.com/health/ready || exit 1

      - name: Health Check Client
        run: |
          curl -f https://mais.vercel.app || exit 1
```

---

## Phase 5: Environment Variable Management

### 5.1 Local Development (.env)

**Create:** `/.env` (never commit)

```bash
# ============================================================================
# LOCAL DEVELOPMENT ENVIRONMENT VARIABLES
# ============================================================================
# This file is for local development only - NEVER commit to git
# Copy from .env.example and fill in your values
# ============================================================================

# Application
NODE_ENV=development
PORT=3001
CORS_ORIGIN=http://localhost:5173

# Database (Supabase)
DATABASE_URL=postgresql://postgres.[project-id]:[password]@aws-0-us-west-1.pooler.supabase.com:5432/postgres
DIRECT_URL=postgresql://postgres.[project-id]:[password]@aws-0-us-west-1.pooler.supabase.com:5432/postgres

# Supabase
SUPABASE_URL=https://[project-id].supabase.co
SUPABASE_ANON_KEY=eyJhbGci...
SUPABASE_SERVICE_KEY=eyJhbGci...
SUPABASE_JWT_SECRET=your-jwt-secret

# Security (generate with: openssl rand -hex 32)
JWT_SECRET=your-64-character-hex-string
TENANT_SECRETS_ENCRYPTION_KEY=your-64-character-hex-string

# Stripe (test mode)
STRIPE_SECRET_KEY=sk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...
STRIPE_SUCCESS_URL=http://localhost:5173/success
STRIPE_CANCEL_URL=http://localhost:5173

# Email (optional - uses file-sink fallback)
POSTMARK_SERVER_TOKEN=
POSTMARK_FROM_EMAIL=dev@mais.local

# Calendar (optional - uses mock fallback)
GOOGLE_CALENDAR_ID=
GOOGLE_SERVICE_ACCOUNT_JSON_BASE64=

# Monitoring (optional)
SENTRY_DSN=
```

### 5.2 Environment Template

**Update:** `/.env.example`

```bash
# ============================================================================
# ENVIRONMENT VARIABLES TEMPLATE
# ============================================================================
# Copy this file to .env and fill in your values
# NEVER commit .env to version control
# ============================================================================

# See documentation for how to obtain each value
# Docs: /docs/ENVIRONMENT_VARIABLES.md

NODE_ENV=development
PORT=3001

# Supabase (get from Supabase Dashboard → Settings → API)
DATABASE_URL=
SUPABASE_URL=
SUPABASE_ANON_KEY=
SUPABASE_SERVICE_KEY=
SUPABASE_JWT_SECRET=

# Security (generate with: openssl rand -hex 32)
JWT_SECRET=
TENANT_SECRETS_ENCRYPTION_KEY=

# Stripe (get from Stripe Dashboard)
STRIPE_SECRET_KEY=
STRIPE_WEBHOOK_SECRET=

# ... etc
```

### 5.3 Platform Secret Management

**Render Dashboard Setup:**

```bash
# 1. Navigate to: Dashboard → mais-api → Environment
# 2. Add each secret individually:
#    - Click "Add Environment Variable"
#    - Key: SUPABASE_SERVICE_KEY
#    - Value: eyJhbGci... (paste from Supabase dashboard)
#    - Save changes
# 3. Redeploy to apply changes
```

**Vercel Dashboard Setup:**

```bash
# 1. Navigate to: Project Settings → Environment Variables
# 2. Add production variables:
#    - VITE_API_BASE_URL: https://mais-api.onrender.com
#    - VITE_SUPABASE_URL: https://[project-id].supabase.co
#    - VITE_SUPABASE_ANON_KEY: eyJhbGci...
# 3. Redeploy to apply
```

---

## Implementation Checklist

### Prerequisites

- [ ] User provides Supabase credentials
- [ ] Create Supabase project (or use existing)
- [ ] Create Render account
- [ ] Create Vercel account
- [ ] Set up GitHub repository access

### Phase 1: Database Setup

- [ ] Copy credentials to `.env` file
- [ ] Create `/server/src/config/database.ts`
- [ ] Create `/server/src/config/env.schema.ts`
- [ ] Install `@supabase/supabase-js` and `zod`
- [ ] Test Supabase connection locally
- [ ] Create `/supabase/migrations/` directory
- [ ] Migrate existing Prisma migrations to SQL format

### Phase 2: Render Backend

- [ ] Create `/render.yaml`
- [ ] Update package.json scripts
- [ ] Connect Render to GitHub
- [ ] Set environment variables in Render dashboard
- [ ] Deploy and verify health checks

### Phase 3: Vercel Frontend

- [ ] Create `/vercel.json`
- [ ] Update client package.json
- [ ] Connect Vercel to GitHub
- [ ] Set environment variables in Vercel dashboard
- [ ] Deploy and verify functionality

### Phase 4: CI/CD

- [ ] Create migration deployment workflow
- [ ] Update production deployment workflow
- [ ] Set GitHub secrets
- [ ] Test automated deployments

### Phase 5: Cleanup

- [ ] Remove Docker files (Dockerfile, docker-compose.yml)
- [ ] Update CLAUDE.md with new deployment instructions
- [ ] Create DEPLOYMENT.md documentation
- [ ] Test complete deployment flow
- [ ] Document rollback procedures

---

## Success Criteria

- ✅ API deployed on Render with health checks passing
- ✅ Client deployed on Vercel with correct API connection
- ✅ Database migrations automated via GitHub Actions
- ✅ Zero secrets in repository
- ✅ Environment validation enforced at startup
- ✅ 100% test pass rate maintained
- ✅ Automatic deployments on git push
- ✅ Rollback procedure documented

---

## Next Steps

**Ready when you provide Supabase credentials:**

1. I'll update `.env.example` with placeholders
2. Create database configuration files
3. Set up environment validation
4. Create deployment configuration files
5. Test locally with your Supabase instance
6. Set up Render and Vercel
7. Configure CI/CD workflows
8. Document complete deployment process

**Please provide when ready:**

- SUPABASE_URL
- SUPABASE_ANON_KEY
- SUPABASE_SERVICE_KEY
- SUPABASE_JWT_SECRET
- DATABASE_URL
- DIRECT_URL (if different from DATABASE_URL)

---

**Generated:** November 19, 2025
**Based On:** rebuild-6.0 v6.0.14 deployment pattern
**Target Completion:** 2-3 days after credentials provided
