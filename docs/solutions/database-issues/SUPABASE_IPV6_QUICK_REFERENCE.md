---
title: Supabase IPv6 Quick Reference
category: cheat-sheet
tags: [database, supabase, ipv6, network, quick-reference, one-pager]
priority: P2
---

# Supabase IPv6 Connection Quick Reference

**One-page cheat sheet for debugging database connection issues**

---

## Symptom Recognition

| Error Message | Likely Cause | Quick Fix |
|--------------|--------------|-----------|
| `ENETUNREACH 2607:...` | IPv6 network not available | Use connection pooler |
| `ETIMEDOUT [...]:5432` | IPv6 timeout | Use connection pooler |
| `ENOTFOUND db.xxx.supabase.co` | DNS resolution failed | Check internet/VPN |
| `connection refused` | Database not running | Check Supabase dashboard |
| `authentication failed` | Wrong credentials | Check DATABASE_URL password |

---

## 30-Second Fix

**If you see IPv6 errors, change your DATABASE_URL:**

```diff
- DATABASE_URL="postgresql://postgres.xxx:pass@db.xxx.supabase.co:5432/postgres"
+ DATABASE_URL="postgresql://postgres.xxx:pass@aws-0-us-east-1.pooler.supabase.com:6543/postgres?pgbouncer=true"
```

Find your connection pooler URL in Supabase Dashboard > Settings > Database > Connection String > URI (with pool mode)

---

## Diagnostic Commands

```bash
# Full diagnostic (recommended first step)
npm run db:diagnose

# Quick DNS check
dig db.xxx.supabase.co A      # IPv4 records
dig db.xxx.supabase.co AAAA   # IPv6 records

# Test connection manually
psql "$DATABASE_URL" -c "SELECT 1;"

# Check your IPv6 support
curl -6 https://ipv6.google.com/ --max-time 5
```

---

## Correct DATABASE_URL Format

```bash
# RECOMMENDED: Supabase Connection Pooler
DATABASE_URL="postgresql://postgres.[ref]:[pass]@aws-0-[region].pooler.supabase.com:6543/postgres?sslmode=require&pgbouncer=true&connect_timeout=10"

# Alternative: Direct connection (may have IPv6 issues)
DATABASE_URL="postgresql://postgres.[ref]:[pass]@db.[ref].supabase.co:5432/postgres?sslmode=require&connect_timeout=10"

# Local fallback (always works)
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/mais_dev"
```

---

## Environment-Specific Settings

| Environment | Host | Port | Extra Params |
|------------|------|------|--------------|
| CI | `localhost` | 5432 | None needed |
| Local Dev | `pooler.supabase.com` | 6543 | `pgbouncer=true` |
| Production | `pooler.supabase.com` | 6543 | `pgbouncer=true&sslmode=require` |

---

## Decision Tree

```
Connection failing?
├── Error contains IPv6 address?
│   └─→ Use connection pooler (port 6543)
├── ENOTFOUND error?
│   └─→ Check DNS/VPN/internet
├── Authentication error?
│   └─→ Verify password in DATABASE_URL
├── Timeout error?
│   └─→ Add connect_timeout=10
└── Connection refused?
    └─→ Check Supabase project status
```

---

## Local Development Fallback

If remote connections are unreliable, use local PostgreSQL:

```bash
# macOS: Install and start PostgreSQL
brew install postgresql@16
brew services start postgresql@16

# Create database
createdb mais_dev

# Update .env
DATABASE_URL="postgresql://localhost/mais_dev"
DIRECT_URL="postgresql://localhost/mais_dev"

# Run migrations
cd server && npm exec prisma migrate dev
```

---

## CI vs Local Environment Differences

**CI (GitHub Actions):**
- Uses containerized PostgreSQL
- Always localhost:5432
- No network/DNS issues
- IPv4 only

**Local Development:**
- Uses remote Supabase
- May resolve to IPv6
- Network-dependent
- Use connection pooler!

**Why CI works but local fails:**
- CI bypasses DNS resolution (localhost)
- CI bypasses network routing (same container network)
- Local must traverse real network (IPv6 may fail)

---

## Print & Pin!

```
┌─────────────────────────────────────────┐
│   SUPABASE CONNECTION QUICK FIX         │
├─────────────────────────────────────────┤
│                                         │
│  IPv6 Error? → Use Connection Pooler    │
│                                         │
│  Change: db.xxx.supabase.co:5432        │
│  To:     pooler.supabase.com:6543       │
│                                         │
│  Add: ?pgbouncer=true&connect_timeout=10│
│                                         │
│  Still broken? Use local PostgreSQL     │
│  DATABASE_URL=postgresql://localhost/db │
│                                         │
│  Diagnose: npm run db:diagnose          │
│                                         │
└─────────────────────────────────────────┘
```

---

## Related Documentation

- Full prevention strategy: `SUPABASE_IPV6_CONNECTION_PREVENTION.md`
- Database client selection: `DATABASE-CLIENT-QUICK-REFERENCE.md`
- Schema drift prevention: `SCHEMA_DRIFT_PREVENTION.md`

---

**Last Updated:** 2025-12-23
