# MAIS Deployment & Operations Guide

**Date:** 2025-12-28
**Environments:** Development, Staging, Production

---

## 1. Environment Architecture

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                              PRODUCTION                                          │
├─────────────────────────────────────────────────────────────────────────────────┤
│                                                                                  │
│  ┌───────────────────┐    ┌───────────────────┐    ┌───────────────────┐        │
│  │   VERCEL          │    │   RENDER          │    │   SUPABASE        │        │
│  │                   │    │                   │    │                   │        │
│  │ - Next.js SSR     │    │ - Express API     │    │ - PostgreSQL      │        │
│  │ - Edge Functions  │    │ - Background Jobs │    │ - Storage (S3)    │        │
│  │ - Static Assets   │    │ - Health Checks   │    │ - Auth (unused)   │        │
│  │                   │    │                   │    │                   │        │
│  └───────────────────┘    └───────────────────┘    └───────────────────┘        │
│                                                                                  │
│  ┌───────────────────┐    ┌───────────────────┐    ┌───────────────────┐        │
│  │   UPSTASH         │    │   STRIPE          │    │   POSTMARK        │        │
│  │                   │    │                   │    │                   │        │
│  │ - Redis Cache     │    │ - Payments        │    │ - Transactional   │        │
│  │ - BullMQ Queue    │    │ - Connect         │    │   Email           │        │
│  │                   │    │ - Webhooks        │    │                   │        │
│  └───────────────────┘    └───────────────────┘    └───────────────────┘        │
│                                                                                  │
└─────────────────────────────────────────────────────────────────────────────────┘
```

---

## 2. Environment Variables

### Required for All Environments

| Variable               | Description                   | Example                |
| ---------------------- | ----------------------------- | ---------------------- |
| `NODE_ENV`             | Environment mode              | `production`           |
| `DATABASE_URL`         | PostgreSQL connection         | `postgresql://...`     |
| `JWT_SECRET`           | JWT signing key (32+ chars)   | `openssl rand -hex 32` |
| `BOOKING_TOKEN_SECRET` | Booking token key (32+ chars) | `openssl rand -hex 32` |

### Production-Only Required

| Variable                        | Description                | Example                     |
| ------------------------------- | -------------------------- | --------------------------- |
| `STRIPE_SECRET_KEY`             | Stripe API key             | `sk_live_...`               |
| `STRIPE_WEBHOOK_SECRET`         | Webhook signing secret     | `whsec_...`                 |
| `POSTMARK_SERVER_TOKEN`         | Email API token            | `...`                       |
| `TENANT_SECRETS_ENCRYPTION_KEY` | AES-256 key (64 hex chars) | `openssl rand -hex 32`      |
| `SENTRY_DSN`                    | Error tracking             | `https://...@sentry.io/...` |

### Optional (with Defaults)

| Variable             | Default                 | Description      |
| -------------------- | ----------------------- | ---------------- |
| `ADAPTERS_PRESET`    | `mock`                  | `mock` or `real` |
| `API_PORT`           | `3001`                  | Express port     |
| `DATABASE_POOL_SIZE` | `5`                     | Connection pool  |
| `CORS_ORIGIN`        | `http://localhost:5173` | CORS origin      |
| `LOG_LEVEL`          | `info`                  | Pino log level   |

---

## 3. Secrets Management

### Current State: CRITICAL ISSUE

**Problem:** Secrets stored in `.env` files

**Location:**

- `/Users/mikeyoung/CODING/MAIS/.env` (contains live credentials)
- `/Users/mikeyoung/CODING/MAIS/apps/web/.env.local`

### Required Actions

1. **Rotate All Credentials Immediately**

   ```bash
   # Supabase
   - Change database password in Supabase Console
   - Regenerate API keys

   # Stripe
   - Rotate webhook secret in Stripe Dashboard

   # JWT
   openssl rand -hex 32  # Generate new JWT_SECRET
   openssl rand -hex 32  # Generate new BOOKING_TOKEN_SECRET
   ```

2. **Move to Secrets Manager**

   ```
   Production:   Vercel Environment Variables (encrypted)
   Staging:      Vercel Environment Variables
   Development:  .env.local (gitignored)
   ```

3. **Verify .gitignore**
   ```bash
   # Must include:
   .env
   .env.*
   !.env.example
   ```

---

## 4. Deployment Pipeline

### Frontend (Next.js) - Vercel

```
GitHub Push → Vercel Build → Preview/Production
                   │
                   ├── npm install (workspace)
                   ├── npm run build (apps/web)
                   ├── Serverless Functions
                   └── Edge Functions (middleware)

Configuration:
- Root Directory: / (NOT apps/web - monorepo!)
- Build Command: npm run build
- Output Directory: apps/web/.next
- Node Version: 18.x
```

### Backend (Express) - Render

```
GitHub Push → Render Build → Deploy
                   │
                   ├── npm install
                   ├── npm run build (TypeScript)
                   └── npm start (Node.js)

Configuration:
- Root Directory: server/
- Build Command: npm install && npm run build
- Start Command: npm start
- Health Check Path: /health
```

### Database (Prisma) - Supabase

```
Local Development:
  npm exec prisma migrate dev --name migration_name

Production Deployment:
  npm exec prisma migrate deploy

Schema Changes:
  1. Edit schema.prisma
  2. Generate migration
  3. Test locally
  4. Deploy to staging
  5. Deploy to production
```

---

## 5. Rollback Strategy

### Frontend Rollback (Vercel)

```bash
# Via Vercel Dashboard
1. Go to Deployments
2. Find previous successful deployment
3. Click "..." → "Promote to Production"

# Via CLI
vercel rollback [deployment-url]
```

### Backend Rollback (Render)

```bash
# Via Render Dashboard
1. Go to Service → Deploys
2. Find previous deployment
3. Click "Rollback"

# Zero-downtime rollback
- New deployment starts
- Health check passes
- Traffic switches
- Old instance terminates
```

### Database Rollback

```bash
# Prisma migration rollback (DESTRUCTIVE)
npm exec prisma migrate resolve --rolled-back migration_name

# Preferred: Forward migration to fix
npm exec prisma migrate dev --name fix_migration_name
```

---

## 6. CI/CD Configuration

### GitHub Actions (Recommended)

```yaml
# .github/workflows/deploy.yml
name: Deploy

on:
  push:
    branches: [main]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '18'
          cache: 'npm'
      - run: npm ci
      - run: npm run typecheck
      - run: npm run lint
      - run: npm test

  deploy-api:
    needs: test
    runs-on: ubuntu-latest
    steps:
      - name: Deploy to Render
        uses: johnbeynon/render-deploy-action@v0.0.8
        with:
          service-id: ${{ secrets.RENDER_SERVICE_ID }}
          api-key: ${{ secrets.RENDER_API_KEY }}

  deploy-web:
    needs: test
    runs-on: ubuntu-latest
    steps:
      - name: Deploy to Vercel
        uses: amondnet/vercel-action@v25
        with:
          vercel-token: ${{ secrets.VERCEL_TOKEN }}
          vercel-org-id: ${{ secrets.VERCEL_ORG_ID }}
          vercel-project-id: ${{ secrets.VERCEL_PROJECT_ID }}
```

---

## 7. Health Monitoring

### Health Check Endpoints

| Endpoint            | Purpose   | Expected Response            |
| ------------------- | --------- | ---------------------------- |
| `GET /health`       | Liveness  | `200 OK`                     |
| `GET /health/ready` | Readiness | `200 OK` with service status |

### Health Check Response

```json
{
  "status": "healthy",
  "services": {
    "stripe": { "status": "healthy", "latency": 150 },
    "postmark": { "status": "healthy", "latency": 80 },
    "googleCalendar": { "status": "healthy" }
  },
  "timestamp": "2025-12-28T10:00:00Z"
}
```

### Uptime Monitoring

```
Recommended Services:
- UptimeRobot (free tier available)
- Pingdom
- Datadog Synthetics

Check Frequency: 1 minute
Alert Channels: Slack, Email, PagerDuty
```

---

## 8. Scaling Configuration

### Express API (Render)

```
Current: Single instance
Scaling: Horizontal (add instances)

Render Configuration:
- Instance Type: Standard (512 MB, 0.5 CPU)
- Auto-scaling: Based on CPU/memory
- Health Check Interval: 30s
- Health Check Timeout: 5s
```

### Database (Supabase)

```
Current: Shared instance (free tier)
Scaling: Upgrade plan for:
- Dedicated CPU
- More connections
- Point-in-time recovery
```

### Redis (Upstash)

```
Current: Serverless
Scaling: Automatic (pay per request)
Limits: Check for rate limits at scale
```

---

## 9. Backup & Recovery

### Database Backups

```
Supabase Automatic Backups:
- Free tier: Daily (7-day retention)
- Pro tier: Point-in-time recovery

Manual Backup:
pg_dump $DATABASE_URL > backup_$(date +%Y%m%d).sql

Restore:
psql $DATABASE_URL < backup_20251228.sql
```

### File Storage Backups

```
Supabase Storage:
- Files stored in S3-compatible storage
- Replication handled by Supabase
- Consider versioning for critical assets
```

---

## 10. Monitoring & Alerting

### Current Setup

| Service  | Purpose        | Status     |
| -------- | -------------- | ---------- |
| Sentry   | Error tracking | Configured |
| Render   | Infrastructure | Built-in   |
| Vercel   | Frontend       | Built-in   |
| Supabase | Database       | Built-in   |

### Recommended Additions

1. **Application Metrics (Prometheus + Grafana)**
   - Request rate, latency, errors
   - Database query performance
   - Cache hit rates

2. **Log Aggregation (Datadog or ELK)**
   - Centralized log search
   - Log-based alerting
   - Correlation with metrics

3. **Uptime Monitoring**
   - External health checks
   - SSL certificate monitoring
   - DNS monitoring

---

## 11. Security Hardening Checklist

### Pre-Production

- [ ] All secrets rotated from development
- [ ] `.env` files not in repository
- [ ] `NODE_ENV=production` set
- [ ] `ADAPTERS_PRESET=real` set
- [ ] HTTPS only (HSTS enabled)
- [ ] CORS restricted to production domains
- [ ] Rate limiting thresholds verified
- [ ] Sentry DSN configured
- [ ] Database backups enabled

### Post-Production

- [ ] Vulnerability scanning enabled (Dependabot)
- [ ] Uptime monitoring active
- [ ] Alert channels configured
- [ ] Runbooks documented
- [ ] Incident response plan in place
- [ ] Penetration test scheduled (quarterly)

---

## 12. Operational Runbooks

### Runbook 1: High Error Rate

```
Symptoms:
- Sentry alert: Error rate > 1%
- 5xx responses increasing

Diagnosis:
1. Check Sentry for error pattern
2. Check database connections (pool exhaustion)
3. Check external service health

Resolution:
1. If DB: Restart service, increase pool
2. If external: Enable degraded mode
3. If code: Hotfix and deploy
```

### Runbook 2: Webhook Processing Backlog

```
Symptoms:
- BullMQ queue depth > 100
- Webhook events delayed

Diagnosis:
1. Check Redis connectivity
2. Check worker process health
3. Check for slow database queries

Resolution:
1. Scale workers (add instances)
2. Clear stuck jobs if necessary
3. Investigate and fix root cause
```

### Runbook 3: Database Connection Issues

```
Symptoms:
- Connection timeout errors
- Pool exhausted warnings

Diagnosis:
1. Check connection count: SELECT count(*) FROM pg_stat_activity
2. Check for long-running queries
3. Verify pool configuration

Resolution:
1. Kill long-running queries
2. Restart affected service
3. Increase pool size if needed
```

---

## 13. Deployment Checklist

### Pre-Deployment

- [ ] All tests passing (`npm test`)
- [ ] TypeScript compiles (`npm run typecheck`)
- [ ] ESLint passes (`npm run lint`)
- [ ] Migrations tested locally
- [ ] Environment variables verified
- [ ] Changelog updated

### Deployment

- [ ] Deploy to staging first
- [ ] Smoke test staging
- [ ] Run E2E tests on staging
- [ ] Deploy to production
- [ ] Monitor error rates (15 min)
- [ ] Verify health checks

### Post-Deployment

- [ ] Check Sentry for new errors
- [ ] Verify critical flows (login, booking)
- [ ] Monitor performance metrics
- [ ] Update status page if applicable

---

_Deployment guide maintained by DevOps team. Review on significant infrastructure changes._
