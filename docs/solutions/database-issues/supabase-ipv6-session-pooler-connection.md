---
title: Supabase IPv6 Connection Failure - Session Pooler Workaround
category: database-issues
tags: [supabase, ipv6, connection-pooler, prisma, postgresql, dns, networking]
severity: critical
component: server/database
date_solved: 2025-12-23
related_docs:
  - docs/setup/SUPABASE.md
  - docs/setup/SUPABASE_INTEGRATION_COMPLETE.md
  - docs/solutions/deployment-issues/render-supabase-client-database-verification.md
symptoms:
  - "P1001: Can't reach database server"
  - "ENETUNREACH" or "ETIMEDOUT" errors
  - "ping6: No route to host"
  - Local development fails while CI passes
  - DNS resolution returns only IPv6 (AAAA) records
root_cause: Supabase direct database connections (db.*.supabase.co) only provide IPv6 DNS records; local network lacks IPv6 support
resolution_type: configuration_change
affected_files:
  - server/.env
---

# Supabase IPv6 Connection Failure - Session Pooler Workaround

## Problem Statement

**What's happening:** Supabase direct database connections fail with "Can't reach database server" or timeout errors on networks without IPv6 support.

**Why it matters:** This blocks all local development that requires database access (integration tests, migrations, seeding), while CI pipelines pass because they use local PostgreSQL containers.

**Who is affected:** Any developer whose network (home, corporate, VPN) doesn't support IPv6.

## Symptoms

```bash
# Prisma error
Error: P1001: Can't reach database server at `db.gpyvdknhmevcfdbgtqir.supabase.co:5432`

# Network error
Error: connect ENETUNREACH 2600:1f16:1cd0:3321:e1af:c9eb:c339:186:5432

# ping6 test
$ ping6 db.gpyvdknhmevcfdbgtqir.supabase.co
ping6: UDP connect: No route to host
```

**Key indicator:** CI tests pass but local integration tests fail.

## Root Cause Analysis

### Technical Explanation

Supabase's direct connection hostnames (`db.[PROJECT-REF].supabase.co`) resolve to **IPv6 addresses only**:

```bash
# Check DNS records
$ dig AAAA db.gpyvdknhmevcfdbgtqir.supabase.co +short
2600:1f16:1cd0:3321:e1af:c9eb:c339:186

$ dig A db.gpyvdknhmevcfdbgtqir.supabase.co +short
# (empty - no IPv4 records)
```

Many networks don't support IPv6:
- Corporate firewalls often block IPv6
- Home ISPs may not provide IPv6
- Some VPNs tunnel IPv4 only

### Why CI Passed

Our CI pipeline (`main-pipeline.yml`) uses **local PostgreSQL containers**, not Supabase:

```yaml
services:
  postgres:
    image: postgres:16
    env:
      POSTGRES_DB: mais_test
    ports:
      - 5432:5432
env:
  DATABASE_URL: postgresql://postgres:postgres@localhost:5432/mais_test
```

This created a silent divergence - CI always passes, but local development fails.

## Solution

### Step 1: Get Session Pooler Connection String

1. Go to [Supabase Dashboard](https://supabase.com/dashboard/project/gpyvdknhmevcfdbgtqir)
2. Click **Connect** (top right)
3. Change **Method** from "Direct connection" to **"Session pooler"**
4. Copy the connection string

The Session Pooler has **both IPv4 and IPv6** addresses:

```bash
$ dig A aws-1-us-east-2.pooler.supabase.com +short
13.59.95.192
3.139.14.59
```

### Step 2: Update Environment Variables

**Before (IPv6-only, fails on many networks):**
```bash
DATABASE_URL=postgresql://postgres:%40Orangegoat11@db.gpyvdknhmevcfdbgtqir.supabase.co:5432/postgres
DIRECT_URL=postgresql://postgres:%40Orangegoat11@db.gpyvdknhmevcfdbgtqir.supabase.co:5432/postgres
```

**After (IPv4 + IPv6, works everywhere):**
```bash
# Session Pooler for application connections
DATABASE_URL=postgresql://postgres.gpyvdknhmevcfdbgtqir:%40Orangegoat11@aws-1-us-east-2.pooler.supabase.com:5432/postgres?pgbouncer=true&connection_limit=5

# Keep direct URL for migrations (if you have IPv6)
# Or use pooler for everything
DIRECT_URL=postgresql://postgres:%40Orangegoat11@db.gpyvdknhmevcfdbgtqir.supabase.co:5432/postgres
```

### Step 3: Key Configuration Differences

| Setting | Direct Connection | Session Pooler |
|---------|-------------------|----------------|
| Hostname | `db.[REF].supabase.co` | `aws-1-[REGION].pooler.supabase.com` |
| Username | `postgres` | `postgres.[REF]` |
| IPv4 Support | No | Yes |
| IPv6 Support | Yes | Yes |
| Prisma Flag | Not needed | `?pgbouncer=true` |

### Step 4: Verify Connection

```bash
# Test with psql
psql "postgresql://postgres.gpyvdknhmevcfdbgtqir:%40Orangegoat11@aws-1-us-east-2.pooler.supabase.com:5432/postgres" -c "SELECT COUNT(*) FROM \"Tenant\";"

# Test with Prisma
cd server && npx prisma db pull
```

## Gotchas and Caveats

### 1. Free Tier Connection Limits

Supabase free tier has strict pool limits. When running many parallel integration tests:

```
FATAL: MaxClientsInSessionMode: max clients reached
```

**Solution:** Add `connection_limit=5` to prevent exhaustion:
```bash
DATABASE_URL=...?pgbouncer=true&connection_limit=5
```

### 2. Password URL Encoding

Special characters must be URL-encoded:
- `@` → `%40`
- `#` → `%23`
- `%` → `%25`

### 3. Region-Specific Hostnames

The pooler hostname includes your project's region:

| Region | Pooler Hostname |
|--------|-----------------|
| US East 1 | `aws-1-us-east-1.pooler.supabase.com` |
| US East 2 | `aws-1-us-east-2.pooler.supabase.com` |
| US West 1 | `aws-1-us-west-1.pooler.supabase.com` |

Check your project region in Dashboard → Settings → General.

### 4. Prisma Requires pgbouncer Flag

When using any Supabase pooler, Prisma needs `?pgbouncer=true`:

```bash
# Without flag - prepared statement errors
DATABASE_URL=postgresql://...@pooler.supabase.com:5432/postgres

# With flag - works correctly
DATABASE_URL=postgresql://...@pooler.supabase.com:5432/postgres?pgbouncer=true
```

## Prevention Strategies

### 1. Document in CLAUDE.md

Add to the Environment Setup section:
```markdown
**Supabase Connection:** If you can't connect to Supabase, your network may not support IPv6.
Use Session Pooler URL instead of Direct Connection. See docs/solutions/database-issues/supabase-ipv6-session-pooler-connection.md
```

### 2. Add Diagnostic to Doctor Script

The `npm run doctor` command should check:
- DNS resolution for DATABASE_URL hostname
- IPv4 vs IPv6 availability
- Actual database connectivity

### 3. Use Local PostgreSQL for Development

Match CI behavior by using local PostgreSQL:
```bash
# Install
brew install postgresql@16
brew services start postgresql@16

# Create database
createdb macon_dev

# Update .env
DATABASE_URL=postgresql://localhost/macon_dev
```

### 4. Add .env.example with Session Pooler

```bash
# .env.example
# Use Session Pooler for IPv4 compatibility
# Get your connection string from: Supabase Dashboard → Connect → Session Pooler
DATABASE_URL=postgresql://postgres.[PROJECT-REF]:[PASSWORD]@aws-1-[REGION].pooler.supabase.com:5432/postgres?pgbouncer=true&connection_limit=5
```

## Quick Diagnostic Commands

```bash
# Check if you have IPv6 connectivity
ping6 -c 1 google.com

# Check Supabase direct connection DNS (IPv6 only)
dig AAAA db.gpyvdknhmevcfdbgtqir.supabase.co +short

# Check Supabase pooler DNS (has IPv4)
dig A aws-1-us-east-2.pooler.supabase.com +short

# Test connection with verbose output
psql "$DATABASE_URL" -c "SELECT 1;"
```

## References

- [Supabase IPv4/IPv6 Troubleshooting](https://supabase.com/docs/guides/troubleshooting/supabase--your-network-ipv4-and-ipv6-compatibility-cHe3BP)
- [Supabase Dedicated IPv4 Address](https://supabase.com/docs/guides/platform/ipv4-address)
- [Prisma + Supabase Guide](https://www.prisma.io/docs/guides/database/supabase)
- Internal: [docs/setup/SUPABASE.md](../../setup/SUPABASE.md)

## Resolution Summary

| Before | After |
|--------|-------|
| Direct connection: `db.*.supabase.co` | Session Pooler: `*.pooler.supabase.com` |
| IPv6 only | IPv4 + IPv6 |
| Fails on many networks | Works everywhere |
| Username: `postgres` | Username: `postgres.[PROJECT-REF]` |
