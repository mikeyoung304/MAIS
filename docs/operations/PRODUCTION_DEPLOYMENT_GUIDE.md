# Production Deployment Guide - MAIS Platform

**Last Updated:** February 2026
**Status:** Production Live

## Production URLs

| Service      | URL                           |
| ------------ | ----------------------------- |
| **Frontend** | https://maconaisolutions.com  |
| **API**      | https://mais-api.onrender.com |

---

## Architecture Overview

```
┌─────────────────────┐     ┌─────────────────────┐
│   Vercel (Client)   │────▶│   Render (API)      │
│  maconaisolutions.com│     │  mais-api.onrender  │
└─────────────────────┘     └──────────┬──────────┘
                                       │
                            ┌──────────▼──────────┐
                            │   Supabase (DB)     │
                            │   PostgreSQL        │
                            └─────────────────────┘
```

---

## Vercel Configuration (Frontend)

### Build Settings

| Setting              | Value                                                                                                                           |
| -------------------- | ------------------------------------------------------------------------------------------------------------------------------- |
| **Root Directory**   | _(empty - repo root)_                                                                                                           |
| **Framework Preset** | Next.js                                                                                                                         |
| **Build Command**    | `npm run build --workspace=@macon/contracts && npm run build --workspace=@macon/shared && npm run build --workspace=@macon/web` |
| **Output Directory** | `apps/web/.next`                                                                                                                |
| **Install Command**  | `npm ci --workspaces --include-workspace-root`                                                                                  |

### Environment Variables

| Key                       | Value                           |
| ------------------------- | ------------------------------- |
| `NEXT_PUBLIC_API_URL`     | `https://mais-api.onrender.com` |
| `NEXT_PUBLIC_APP_MODE`    | `real`                          |
| `NEXT_PUBLIC_ENVIRONMENT` | `production`                    |

### Custom Domain

- Domain: `maconaisolutions.com`
- DNS Provider: Squarespace
- SSL: Auto-provisioned by Vercel

---

## Render Configuration (API)

### Build Settings

| Setting            | Value                                      |
| ------------------ | ------------------------------------------ |
| **Root Directory** | `server`                                   |
| **Build Command**  | `npm ci && npx prisma generate && npx tsc` |
| **Start Command**  | `npx tsx src/index.ts`                     |

### Environment Variables

> **IMPORTANT:** Never commit secrets. All values below are stored in Render dashboard only.

| Key                             | Description                                               |
| ------------------------------- | --------------------------------------------------------- |
| `NODE_ENV`                      | `production`                                              |
| `ADAPTERS_PRESET`               | `real`                                                    |
| `API_PORT`                      | `3001`                                                    |
| `DATABASE_URL`                  | PostgreSQL connection string (from Supabase)              |
| `DIRECT_URL`                    | Same as DATABASE_URL                                      |
| `JWT_SECRET`                    | 64-char hex secret (generate with `openssl rand -hex 32`) |
| `TENANT_SECRETS_ENCRYPTION_KEY` | 64-char hex secret                                        |
| `CORS_ORIGIN`                   | `https://maconaisolutions.com`                            |
| `STRIPE_SECRET_KEY`             | From Stripe dashboard                                     |
| `STRIPE_WEBHOOK_SECRET`         | From Stripe webhook settings                              |
| `POSTMARK_SERVER_TOKEN`         | From Postmark dashboard                                   |

---

## Deployment Process

### Automatic Deployments

Both Vercel and Render are configured for automatic deployments on push to `main`:

```bash
git push origin main
# Vercel: Auto-deploys client in ~1-2 minutes
# Render: Auto-deploys API in ~3-5 minutes
```

### Manual Deployment

**Vercel:**

```bash
npx vercel --prod
```

**Render:**

- Go to Render Dashboard → mais-api → Manual Deploy

---

## Database Migrations

Run migrations before deploying schema changes:

```bash
cd server
DATABASE_URL="$PRODUCTION_DATABASE_URL" npx prisma migrate deploy
```

Or run via Render shell if available.

---

## Monitoring

### Health Checks

```bash
# API Health
curl https://mais-api.onrender.com/health

# Test packages endpoint
curl https://mais-api.onrender.com/v1/packages
```

### Logs

- **Vercel:** Dashboard → Project → Deployments → Logs
- **Render:** Dashboard → mais-api → Logs

---

## Troubleshooting

### Cold Starts (Render Free Tier)

Render free tier spins down after 15 minutes of inactivity. First request takes 30-60s.

**Solutions:**

1. Upgrade to Render Starter ($7/mo) for always-on
2. Use a cron job to ping the health endpoint every 10 minutes

### CORS Errors

Ensure `CORS_ORIGIN` in Render matches exactly:

- Must include `https://`
- No trailing slash
- Must match domain (not Vercel preview URL)

### Build Failures

**Vercel:** Check that workspace names match (`@macon/web`, not `client`)

**Render:** Ensure `prisma generate` runs before `tsc`

---

## Security Notes

1. **Never commit secrets** - All credentials in environment variables only
2. **Rotate secrets quarterly** - See `/docs/security/SECRET_ROTATION_GUIDE.md`
3. **Use HTTPS only** - Both Vercel and Render enforce this automatically

---

## Related Documentation

- [ARCHITECTURE.md](/ARCHITECTURE.md) - System design
- [DEVELOPING.md](/DEVELOPING.md) - Local development
- [SECRET_ROTATION_GUIDE.md](/docs/security/SECRET_ROTATION_GUIDE.md) - Secret management
