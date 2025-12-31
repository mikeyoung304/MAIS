---
title: 'Prisma db execute for Supabase Manual Migrations'
category: database-issues
tags:
  - prisma
  - supabase
  - migrations
  - ipv6
  - pattern-b
  - manual-sql
severity: high
component: server/database
date_solved: '2025-12-31'
symptoms:
  - 'psql command hangs when applying manual SQL migrations'
  - 'Connection timeout when running Pattern B migrations'
  - 'prisma migrate dev times out on Supabase'
  - 'ENETUNREACH or ETIMEDOUT errors during migration'
root_cause: 'psql connects directly to DATABASE_URL hostname which may be IPv6-only on Supabase'
resolution_type: command_substitution
related_docs:
  - docs/solutions/database-issues/supabase-ipv6-session-pooler-connection.md
  - docs/solutions/database-issues/prisma-hybrid-migration-schema-drift.md
  - docs/solutions/SCHEMA_DRIFT_PREVENTION.md
affected_files:
  - server/prisma/migrations/*.sql
---

# Prisma db execute for Supabase Manual Migrations

## Problem Statement

When applying **Pattern B manual SQL migrations** to a Supabase database, the documented command hangs or times out:

```bash
# CLAUDE.md Pattern B Step 4 - This hangs on Supabase!
psql $DATABASE_URL < migrations/NN_name.sql
```

This blocks development when you need to create enums, indexes, RLS policies, or other PostgreSQL-specific features that require raw SQL.

## Symptoms

```bash
# psql hangs indefinitely
$ psql "$DATABASE_URL" -f prisma/migrations/20_add_onboarding_event_sourcing.sql
# ... no output, hangs forever

# Or times out
$ psql "$DATABASE_URL" -c "SELECT 1"
psql: error: connection to server at "db.xxx.supabase.co" (2600:...) port 5432 failed: Connection timed out
```

**Key indicator:** Prisma commands (`prisma generate`, `prisma db pull`) work fine, but raw `psql` fails.

## Root Cause

Supabase direct database hostnames (`db.[PROJECT-REF].supabase.co`) resolve to **IPv6 addresses only**. Many networks (home, corporate, VPN) don't support IPv6.

- `psql` connects directly to the hostname in DATABASE_URL
- Prisma uses its own connection handling which respects pooler configuration
- If your DATABASE_URL uses the Session Pooler (`*.pooler.supabase.com`), Prisma connects via IPv4

## Solution

Use `npx prisma db execute` instead of `psql`:

```bash
# Instead of:
psql "$DATABASE_URL" -f prisma/migrations/20_add_onboarding_event_sourcing.sql

# Use:
npx prisma db execute --file prisma/migrations/20_add_onboarding_event_sourcing.sql
```

### Updated Pattern B Workflow

```bash
# 1. Edit schema.prisma
# 2. Find next migration number
ls server/prisma/migrations/ | grep '^[0-9]' | tail -1

# 3. Create idempotent SQL file
# server/prisma/migrations/NN_name.sql

# 4. Apply via Prisma (NOT psql!)
cd server
npx prisma db execute --file prisma/migrations/NN_name.sql

# 5. Regenerate Prisma Client
npx prisma generate

# 6. Verify
npm test
```

## Why This Works

| Command | Connection Method | IPv6 Support | Pooler Aware |
|---------|-------------------|--------------|--------------|
| `psql` | Direct to hostname | Requires IPv6 | No |
| `prisma db execute` | Through Prisma engine | Uses configured URL | Yes |
| `prisma migrate dev` | Through Prisma engine | Uses configured URL | Yes |

`prisma db execute` reads your `DATABASE_URL` from `.env` and connects through Prisma's connection handling, which:
1. Respects `?pgbouncer=true` parameter
2. Uses the Session Pooler hostname (IPv4 + IPv6)
3. Handles connection retries gracefully

## Example: Real Migration Applied

```bash
# Migration file created
$ cat server/prisma/migrations/20_add_onboarding_event_sourcing.sql
-- Create OnboardingPhase enum
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'OnboardingPhase') THEN
    CREATE TYPE "OnboardingPhase" AS ENUM ('NOT_STARTED', 'DISCOVERY', ...);
  END IF;
END $$;
...

# Applied successfully via Prisma
$ npx prisma db execute --file prisma/migrations/20_add_onboarding_event_sourcing.sql
Script executed successfully.
```

## Caveats

### 1. Deprecation Warning

You may see a deprecation warning about `package.json#prisma`:

```
warn The configuration property `package.json#prisma` is deprecated and will be removed in Prisma 7.
```

This is informational only - the command still works.

### 2. No Transaction Wrapper

Unlike `prisma migrate dev`, `prisma db execute` runs the SQL directly without wrapping in a transaction. Ensure your SQL file is **idempotent** with proper guards:

```sql
-- Good: Idempotent
CREATE TABLE IF NOT EXISTS "MyTable" (...);
ALTER TABLE "MyTable" ADD COLUMN IF NOT EXISTS "newCol" TEXT;
DO $$ BEGIN IF NOT EXISTS (...) THEN ... END IF; END $$;

-- Bad: Will fail on re-run
CREATE TABLE "MyTable" (...);  -- Error if exists
ALTER TABLE "MyTable" ADD COLUMN "newCol" TEXT;  -- Error if exists
```

### 3. Specify Schema Path If Not in server/

```bash
# If running from project root
npx prisma db execute --file prisma/migrations/NN_name.sql --schema server/prisma/schema.prisma
```

## Prevention

### Update CLAUDE.md Pattern B

The Pattern B documentation should be updated to use `prisma db execute`:

```markdown
**Pattern B: Manual Raw SQL** (for enums, indexes, extensions, RLS)
1. Edit server/prisma/schema.prisma
2. Find next migration number: ls server/prisma/migrations/ | grep '^[0-9]' | tail -1
3. Create: server/prisma/migrations/NN_name.sql (idempotent SQL)
4. Apply: npx prisma db execute --file prisma/migrations/NN_name.sql  # Changed!
5. npm exec prisma generate
6. npm test to verify
```

### Add Alias for Convenience

```bash
# In ~/.zshrc or ~/.bashrc
alias prisma-migrate-sql='npx prisma db execute --file'

# Usage
prisma-migrate-sql prisma/migrations/20_add_feature.sql
```

## Quick Reference

| Scenario | Command |
|----------|---------|
| Apply Pattern B migration | `npx prisma db execute --file migrations/NN_name.sql` |
| Test SQL syntax (dry run) | `psql "$DATABASE_URL" -f migrations/NN_name.sql` (if IPv4 available) |
| Check migration applied | `npx prisma db pull --print \| grep "TableName"` |
| Verify enum exists | `npx prisma db execute --stdin <<< "SELECT typname FROM pg_type WHERE typname = 'MyEnum';"` |

## Related Documentation

- [Supabase IPv6 Session Pooler Connection](./supabase-ipv6-session-pooler-connection.md) - Why IPv6 causes issues
- [Prisma Hybrid Migration Schema Drift](./prisma-hybrid-migration-schema-drift.md) - Pattern A vs B decision guide
- [Schema Drift Prevention](../SCHEMA_DRIFT_PREVENTION.md) - Comprehensive migration safety
