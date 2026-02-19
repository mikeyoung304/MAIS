# Supabase Integration Guide

**Last Updated:** February 18, 2026
**Status:** Production Ready
**Plan:** Pro (Build2 org)
**Project:** MAIS — Multi-Tenant Membership Platform

---

## Overview

MAIS uses **Supabase Pro** as its production PostgreSQL database with connection pooling, automatic backups, storage, and high availability.

**Integration Type:** Database + Storage

- PostgreSQL database with PgBouncer connection pooling (200 pooler connections)
- Automatic daily backups (7-day point-in-time recovery)
- SSL/TLS encryption enforced
- Storage: `images` bucket for tenant storefront assets
- Not using Supabase Auth (keeping JWT)
- Not using Supabase Realtime

---

## Configuration

### Environment Variables

```bash
# Supabase Database (Transaction Mode pooler — port 5432)
DATABASE_URL="postgresql://postgres.[REF]:[PASSWORD]@aws-1-us-east-2.pooler.supabase.com:5432/postgres?pgbouncer=true&connection_limit=5"

# Direct connection (for Prisma migrations — requires IPv4 add-on or network with IPv6)
DIRECT_URL="postgresql://postgres:[PASSWORD]@db.[REF].supabase.co:5432/postgres"

# Supabase API
SUPABASE_URL="https://[REF].supabase.co"
SUPABASE_ANON_KEY="eyJhbGc..."
SUPABASE_SERVICE_ROLE_KEY="eyJhbGc..."

# Connection limit per Prisma instance (default: 5)
DATABASE_CONNECTION_LIMIT=5
```

**Important:**

- Password special characters must be URL-encoded (@ = %40)
- `DATABASE_URL` uses the Transaction Mode pooler (port 5432, `?pgbouncer=true`)
- `DIRECT_URL` uses the direct connection (for migrations only)
- Never commit `.env` file to git

### Prisma Configuration

```prisma
datasource db {
  provider  = "postgresql"
  url       = env("DATABASE_URL")
  directUrl = env("DIRECT_URL")
}
```

The `directUrl` is required for migrations — Prisma uses it to bypass the connection pooler for DDL operations.

---

## Connection Pooling

### Supabase Pro Limits

| Connection Type           | Limit   | Port | Use Case                          |
| ------------------------- | ------- | ---- | --------------------------------- |
| Pooler (Transaction Mode) | **200** | 5432 | Application queries via Prisma    |
| Pooler (Session Mode)     | 200     | 6543 | Long-lived connections (not used) |
| Direct                    | **60**  | 5432 | Migrations, `prisma db push`      |

### Application Configuration

```
DATABASE_CONNECTION_LIMIT=5  (per Prisma instance)
```

With 200 pooler connections available, even 10 Render instances x 5 connections = 50, well within limits. Increase to 10 for high-concurrency workloads.

**Monitoring:** Dashboard > Reports > Database to check active connection counts.

---

## Storage

### `images` Bucket

Used for tenant storefront images (hero photos, about section, gallery).

**Access pattern:**

- **Uploads:** Server-side only via `SUPABASE_SERVICE_ROLE_KEY` in `upload.adapter.ts`
- **Reads:** Public via signed URLs (1-year expiry)
- **File size limit:** 5 MB (increase to 10 MB for high-res hero images via Dashboard)

### RLS Policies (apply via SQL Editor)

```sql
-- Only service_role can INSERT (server-side uploads only)
CREATE POLICY "Service role uploads only"
ON storage.objects FOR INSERT
TO service_role
WITH CHECK (bucket_id = 'images');

-- Only service_role can DELETE
CREATE POLICY "Service role deletes only"
ON storage.objects FOR DELETE
TO service_role
USING (bucket_id = 'images');

-- Public read (signed URLs handle time-limited auth)
CREATE POLICY "Public read via signed URLs"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'images');
```

---

## Schema Deployment

### Prisma Migrate (preferred)

```bash
cd server
npx prisma migrate deploy    # Apply pending migrations
npm run db:seed              # Seed initial data
```

Requires `DIRECT_URL` to be accessible (IPv4 add-on or IPv6-capable network).

### Manual (SQL Editor fallback)

1. Go to Supabase Dashboard > SQL Editor
2. Run the migration SQL files in order from `server/prisma/migrations/`

---

## Database Access

### From Application

```typescript
import { PrismaClient } from '@/generated/prisma';
const prisma = new PrismaClient();

// All queries go through Supabase PgBouncer pooling
// CRITICAL: Always filter by tenantId (multi-tenant isolation)
const tiers = await prisma.tier.findMany({
  where: { tenantId, active: true },
  take: 100,
});
```

### From Supabase Dashboard

- **SQL Editor:** Ad-hoc queries, manual migrations
- **Table Editor:** Visual data browsing (use cautiously in production)

---

## Backups

- **Automatic:** Daily full backups, 7-day point-in-time recovery (Pro plan)
- **Manual:** Dashboard > Database > Backups, or `pg_dump $DIRECT_URL > backup.sql`

---

## Migrations

### Creating New Migrations

```bash
# Standard — generates and applies migration
npx prisma migrate dev --name descriptive_name --schema server/prisma/schema.prisma

# Custom SQL — generates migration file for manual editing
npx prisma migrate dev --create-only --name descriptive_name --schema server/prisma/schema.prisma
```

### Migration Best Practices

```sql
-- Always use IF EXISTS / IF NOT EXISTS for idempotency
ALTER TABLE "Booking" ADD COLUMN IF NOT EXISTS "newField" TEXT;

-- Use transactions for multi-step changes
BEGIN;
  -- changes here
COMMIT;

-- Add indexes concurrently for zero-downtime on large tables
CREATE INDEX CONCURRENTLY IF NOT EXISTS "idx_name" ON "Table"("column");
```

---

## Security

### Credentials

- Never hardcode credentials — use environment variables only
- Rotate passwords quarterly
- Separate credentials per environment (dev/staging/prod)

### Access Control

- Supabase enforces SSL/TLS on all connections
- Prisma queries run as `postgres` role
- Multi-tenant isolation enforced at application layer (all queries scoped by `tenantId`)
- Storage bucket protected by RLS policies (service_role only for writes)

---

## Monitoring

**Supabase Dashboard provides:**

- Query performance metrics (Dashboard > Reports)
- Connection pool usage
- Database size tracking
- Active queries view
- Performance Advisor (index recommendations)
- Security Advisor (extension placement, RLS gaps)

---

## Troubleshooting

### "Can't reach database server" / P1001

1. Check Supabase project status (paused?)
2. Verify password URL-encoding (@ = %40)
3. Test connection in SQL Editor first
4. If using direct connection: ensure IPv4 add-on is enabled or network supports IPv6

### "Too many connections"

- Check `DATABASE_CONNECTION_LIMIT` in `.env` (default: 5)
- Monitor pool usage in Dashboard > Reports > Database
- Ensure `prisma.$disconnect()` is called on shutdown

### Migration Issues

- Prisma tracks migrations in `_prisma_migrations` table
- If CLI can't connect, apply via SQL Editor manually
- Use `--skip-seed` if data already exists

---

## Performance Tuning

### Recommended Compute

| Setting   | Value                        | Notes                       |
| --------- | ---------------------------- | --------------------------- |
| Compute   | Micro (1 GB RAM, 2-core ARM) | Included in Pro             |
| IPv4      | Dedicated ($4/mo)            | Eliminates IPv6 workarounds |
| Spend Cap | User's choice                | Enables disk auto-scaling   |

### Indexes

FK indexes are maintained in `schema.prisma`. The Performance Advisor may flag additional opportunities — always add indexes via Prisma migrations (not raw SQL) to keep schema in sync.

---

## Project Details

**Supabase Project:**

- **Organization:** Build2
- **Plan:** Pro
- **Region:** US East (N. Virginia)
- **Database:** PostgreSQL 15+
- **Compute:** Micro (1 GB RAM, 2-core ARM) — upgrade via Settings > Compute and Disk
- **Pooler Connections:** 200 (Transaction Mode)
- **Direct Connections:** 60

**Dashboard:** https://supabase.com/dashboard/project/gpyvdknhmevcfdbgtqir

---

## Vector Extension

The `vector` extension (pgvector) is used for vocabulary embeddings (semantic phrase matching to BlockType). The Security Advisor recommends moving it from `public` to `extensions` schema:

```sql
CREATE SCHEMA IF NOT EXISTS extensions;
DROP EXTENSION IF EXISTS vector;
CREATE EXTENSION vector SCHEMA extensions;
GRANT USAGE ON SCHEMA extensions TO postgres;
```

**Impact:** If any queries reference `vector` types without schema qualification, they'll need updating. Check `VocabularyEmbedding` model usage before applying.

---

## Support

- **Supabase Docs:** https://supabase.com/docs
- **Prisma + Supabase:** https://www.prisma.io/docs/guides/database/supabase
- **Internal:** `DEVELOPING.md`, `ARCHITECTURE.md`
