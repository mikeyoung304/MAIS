# Supabase Integration Guide

**Last Updated:** October 29, 2025
**Status:** ✅ Production Ready
**Project:** MAIS Wedding Booking Platform

---

## Overview

MAIS uses **Supabase** as its production PostgreSQL database with built-in connection pooling, automatic backups, and high availability.

**Integration Type:** Database Only (Simple)

- ✅ PostgreSQL database with connection pooling
- ✅ Automatic backups (7-day point-in-time recovery)
- ✅ SSL/TLS encryption enforced
- ❌ Not using Supabase Auth (keeping JWT)
- ❌ Not using Supabase Storage (future enhancement)
- ❌ Not using Supabase Realtime (future enhancement)

---

## Configuration

### Environment Variables

```bash
# Supabase Database
DATABASE_URL="postgresql://postgres:[PASSWORD]@db.gpyvdknhmevcfdbgtqir.supabase.co:5432/postgres"
DIRECT_URL="postgresql://postgres:[PASSWORD]@db.gpyvdknhmevcfdbgtqir.supabase.co:5432/postgres"

# Supabase API (optional - for future features)
SUPABASE_URL="https://gpyvdknhmevcfdbgtqir.supabase.co"
SUPABASE_ANON_KEY="eyJhbGc..."
SUPABASE_SERVICE_ROLE_KEY="eyJhbGc..."
```

**Important:**

- Password special characters must be URL-encoded (@ = %40)
- Both DATABASE_URL and DIRECT_URL use port 5432 (transaction mode)
- Never commit `.env` file to git

### Prisma Configuration

```prisma
datasource db {
  provider  = "postgresql"
  url       = env("DATABASE_URL")
  directUrl = env("DIRECT_URL")
}
```

The `directUrl` is required for migrations to work correctly with Supabase's connection pooling.

---

## Schema Deployment

### Initial Setup

**Method 1: Manual (SQL Editor)**

1. Go to Supabase Dashboard → SQL Editor
2. Run `/server/prisma/migrations/00_supabase_reset.sql`
3. Run `/server/prisma/seed.sql`

**Method 2: Prisma Migrate (when CLI access works)**

```bash
cd server
npx prisma migrate deploy
npm run db:seed
```

### Schema Features

**Critical Constraints:**

- ✅ `Booking.date` - **UNIQUE** constraint prevents double-booking
- ✅ `Payment.processorId` - **UNIQUE** constraint prevents duplicate webhook processing
- ✅ `User.passwordHash` - **NOT NULL** for admin authentication

**Performance Indexes:**

- `Booking.date` - Fast availability lookups
- `Payment.processorId` - Fast Stripe webhook verification
- `BlackoutDate.date` - Fast blackout checking

---

## Database Access

### From Application

The app connects via Prisma Client:

```typescript
import { PrismaClient } from '@/generated/prisma';
const prisma = new PrismaClient();

// All queries go through Supabase connection pooling
const packages = await prisma.package.findMany();
```

### From Supabase Dashboard

**SQL Editor:**

- Run ad-hoc queries
- View data directly
- Execute migrations manually

**Table Editor:**

- Visual data browsing
- Quick edits (use cautiously)
- Export data as CSV

---

## Seeded Data

The seed script creates:

| Resource            | Count | Details                                            |
| ------------------- | ----- | -------------------------------------------------- |
| Admin User          | 1     | `admin@example.com` / `admin`                      |
| Packages            | 3     | Classic ($2,500), Garden ($3,500), Luxury ($5,500) |
| Add-Ons             | 4     | Photography, Officiant, Bouquet, Violinist         |
| Package-AddOn Links | 8     | All addons linked to Classic & Garden              |
| Blackout Dates      | 1     | Christmas 2025                                     |

---

## Connection Pooling

**Supabase provides:**

- **Transaction Mode** (port 5432) - Used by default
- **Session Mode** (port 6543) - Available but not used

**Current Setup:**

- Uses port 5432 (transaction mode)
- Supports up to 100 concurrent connections (free tier)
- No additional pgBouncer setup required

---

## Backups

**Automatic Backups:**

- Daily full backups
- 7-day retention (free tier)
- Point-in-time recovery available

**Manual Backup:**

```bash
# Via Supabase Dashboard → Database → Backups
# Or via pg_dump:
pg_dump $DATABASE_URL > backup.sql
```

---

## Monitoring

**Supabase Dashboard provides:**

- ✅ Query performance metrics
- ✅ Connection pool usage
- ✅ Database size tracking
- ✅ Active queries view

**Access:** Project Dashboard → Reports

---

## Migrations

### Creating New Migrations

**Manual Method (Recommended for Supabase):**

1. Create SQL file: `server/prisma/migrations/YYYYMMDD_description.sql`
2. Test in Supabase SQL Editor
3. Deploy via SQL Editor
4. Update Prisma schema to match
5. Run `npx prisma generate`

**Prisma Method (when CLI works):**

```bash
npx prisma migrate dev --name add_feature
npx prisma migrate deploy
```

### Migration Best Practices

```sql
-- Always use IF EXISTS / IF NOT EXISTS
ALTER TABLE "Booking"
  ADD COLUMN IF NOT EXISTS "newField" TEXT;

-- Use transactions for multiple changes
BEGIN;
  -- changes here
COMMIT;

-- Add indexes after table creation
CREATE INDEX IF NOT EXISTS "idx_name" ON "Table"("column");
```

---

## Security

### Credentials Management

**Production:**

- ❌ Never hardcode credentials
- ✅ Use environment variables only
- ✅ Rotate passwords quarterly
- ✅ Use separate credentials per environment

**Local Development:**

- Keep separate `.env` file (not committed)
- Use Supabase test project (not production)

### Access Control

**Database Level:**

- Supabase enforces SSL/TLS
- IP restrictions available (paid tiers)
- Role-based access via Supabase dashboard

**Application Level:**

- Prisma queries run as postgres role
- No Row-Level Security (RLS) used (single-tenant app)
- JWT authentication in app layer

---

## Troubleshooting

### Connection Issues

**"Can't reach database server" / P1001 Error**

- Check Supabase project status (paused?)
- Verify password URL-encoding (@ = %40)
- Test connection in SQL Editor first
- **Most common cause: IPv6 not supported on your network**

**IPv6 Connection Fix (RECOMMENDED):**

Supabase direct connections (`db.*.supabase.co`) are **IPv6-only**. If your network doesn't support IPv6, use the **Session Pooler** instead:

1. Go to Supabase Dashboard → Connect → Session Pooler
2. Update your `.env`:

```bash
# Before (IPv6-only - fails on many networks)
DATABASE_URL=postgresql://postgres:[PASS]@db.[REF].supabase.co:5432/postgres

# After (IPv4 + IPv6 - works everywhere)
DATABASE_URL=postgresql://postgres.[REF]:[PASS]@aws-1-us-east-2.pooler.supabase.com:5432/postgres?pgbouncer=true&connection_limit=5
```

**Key differences:**
- Hostname: `db.[REF].supabase.co` → `aws-1-[REGION].pooler.supabase.com`
- Username: `postgres` → `postgres.[REF]`
- Add: `?pgbouncer=true&connection_limit=5`

See full guide: [docs/solutions/database-issues/supabase-ipv6-session-pooler-connection.md](../solutions/database-issues/supabase-ipv6-session-pooler-connection.md)

**"Too many connections"**

- Increase connection pool limit in DATABASE_URL
- Check for connection leaks in code
- Use `prisma.$disconnect()` properly

### Migration Issues

**"Migration already applied"**

- Supabase tracks migrations in `_prisma_migrations` table
- Use `--skip-seed` if data already exists
- Run migrations via SQL Editor manually

---

## Future Enhancements

### Phase 3: Storage Integration

```typescript
// Photo uploads for wedding packages
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

await supabase.storage.from('package-photos').upload(`${packageId}/hero.jpg`, file);
```

### Phase 4: Realtime (Optional)

```typescript
// Live booking updates for admin dashboard
supabase
  .channel('bookings')
  .on(
    'postgres_changes',
    {
      event: 'INSERT',
      schema: 'public',
      table: 'Booking',
    },
    (payload) => {
      console.log('New booking!', payload);
    }
  )
  .subscribe();
```

---

## Support

**Supabase Documentation:** https://supabase.com/docs
**Prisma + Supabase Guide:** https://www.prisma.io/docs/guides/database/supabase

**Internal Docs:**

- `ENVIRONMENT.md` - Environment variables
- `ARCHITECTURE.md` - System architecture
- `DEVELOPING.md` - Development workflow

---

## Project Details

**Supabase Project:**

- **Project Ref:** `gpyvdknhmevcfdbgtqir`
- **Region:** US East (N. Virginia)
- **Database:** PostgreSQL 15
- **Plan:** Free Tier (500MB, upgradeable)

**Dashboard:** https://supabase.com/dashboard/project/gpyvdknhmevcfdbgtqir
