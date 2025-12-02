---
title: Database Client Quick Reference
category: cheat-sheet
tags: [database, prisma, supabase, quick-reference, one-pager]
priority: P1
---

# Database Client Quick Reference

**One-page cheat sheet for database client selection**

---

## Client Allocation Matrix

```
NEED                         CLIENT           EXAMPLE
─────────────────────────────────────────────────────────────────────
Query Tenant table           Prisma           prisma.tenant.findUnique()
Query Booking table          Prisma           prisma.booking.findMany()
Query any other table        Prisma           prisma.package.findFirst()
Create record                Prisma           prisma.booking.create()
Update record                Prisma           prisma.tenant.update()
Delete record                Prisma           prisma.booking.delete()
Raw SQL query                Prisma           prisma.$queryRaw()
Transaction                  Prisma           prisma.$transaction()

Upload logo                  Supabase         supabase.storage.from()
Upload photo                 Supabase         supabase.storage.from()
Delete file                  Supabase         supabase.storage.remove()
Generate signed URL          Supabase         supabase.storage.createSignedUrl()

Verify DB at startup         Prisma           prisma.$queryRaw<...>()
Health check                 Prisma           prisma.tenant.count()
```

---

## Pattern Matching

### ✅ CORRECT Patterns

```typescript
// Database queries use Prisma
const tenant = await prisma.tenant.findUnique({ where: { id } });
const bookings = await prisma.booking.findMany({ where: { tenantId } });
const count = await prisma.$queryRaw`SELECT COUNT(*) FROM "Booking"`;

// File operations use Supabase Storage
await supabase.storage.from('images').upload(path, buffer);
const { signedUrl } = await supabase.storage.from('images').createSignedUrl(path, 3600);
await supabase.storage.from('images').remove([path]);

// Transactions use Prisma
await prisma.$transaction(async (tx) => {
  await tx.booking.create({ data: { /* ... */ } });
  await tx.audit.create({ data: { /* ... */ } });
});
```

### ❌ WRONG Patterns (Anti-Patterns)

```typescript
// ❌ WRONG: Using Supabase for database queries
const { data } = await supabase.from('Tenant').select('*');
const bookings = await supabase.from('Booking').select('*').eq('tenantId', id);
await supabase.from('Tenant').update({ slug: 'new' }).eq('id', id);

// ❌ WRONG: Mixing clients for same operation
const booking = await prisma.booking.findFirst(...);
const tenant = await supabase.from('Tenant').select('*').eq('id', booking.tenantId);

// ❌ WRONG: Database verification via Supabase REST API
const { error } = await supabase.from('Tenant').select('count');
if (error) console.log('DB down');
```

---

## Code Review Checklist

When reviewing database code, verify:

- [ ] All table operations use **Prisma** (not Supabase)
- [ ] File uploads use **Supabase Storage** (not database)
- [ ] No `supabase.from('TableName')` in database code
- [ ] Transactions properly wrapped in `prisma.$transaction()`
- [ ] All queries filtered by `tenantId` (multi-tenant safety)
- [ ] Error messages appropriate for client type
- [ ] Type-safe imports from generated Prisma client

---

## Self-Review Commands

Run before committing:

```bash
# Find Supabase .from() calls (should only be storage)
grep -n "supabase\.from(" server/src --include="*.ts" -r | grep -v storage

# Expected output: empty (no findings)

# Verify database queries use Prisma
grep -n "prisma\." server/src --include="*.ts" -r | head -20

# Should see many matches
```

---

## Troubleshooting

### Error: "relation does not exist" or "not found"
**Cause:** Trying to query via Supabase REST API
**Fix:** Use Prisma instead
```typescript
// ❌ Fails
const { data, error } = await supabase.from('Tenant').select('*');

// ✅ Works
const data = await prisma.tenant.findMany();
```

### Error: "Toast table not exposed"
**Cause:** Table not exposed via Supabase REST API
**Fix:** Always use Prisma for database operations
```typescript
// Use Prisma for any table:
await prisma.customTable.findMany();
```

### Performance issue during startup
**Cause:** Using Supabase HTTP client instead of Prisma connection pool
**Fix:** Migrate to Prisma for database verification
```typescript
// ❌ Slow: REST API call
await supabase.from('Tenant').select('count');

// ✅ Fast: Connection pool
await prisma.$queryRaw`SELECT COUNT(*) FROM "Tenant"`;
```

---

## Decision Tree

```
Do you need to work with:

├─ Database tables (Tenant, Booking, Package, etc.)?
│  └─→ Use PRISMA ✅
│
├─ File storage (logos, photos, documents)?
│  └─→ Use SUPABASE STORAGE ✅
│
├─ User authentication?
│  └─→ Use SUPABASE AUTH (if enabled)
│      OR custom JWT with Prisma ✅
│
└─ Anything else?
   └─→ Ask in #architecture channel
```

---

## File Locations

| Component | File |
|-----------|------|
| Prisma Config | `server/src/config/database.ts` (import only) |
| Supabase Config | `server/src/config/database.ts` (getSupabaseClient) |
| DI Container | `server/src/di.ts` |
| Database Startup | `server/src/index.ts` (verifyDatabaseWithPrisma) |
| Upload Adapter | `server/src/adapters/upload.adapter.ts` |
| Repositories | `server/src/adapters/prisma/*.ts` |

---

## Documentation

- Full guide: [PREVENTION-STRATEGY-DATABASE-CLIENT-MISMATCH.md](./PREVENTION-STRATEGY-DATABASE-CLIENT-MISMATCH.md)
- Architecture: [CLAUDE.md](../../CLAUDE.md)
- Setup: [docs/setup/DATABASE.md](../../docs/setup/DATABASE.md)

---

## Print & Pin!

```
┌────────────────────────────────────┐
│  DATABASE CLIENT QUICK REFERENCE   │
├────────────────────────────────────┤
│                                    │
│  Database Queries  → PRISMA        │
│  File Uploads      → SUPABASE      │
│  Authentication    → SUPABASE      │
│                                    │
│  NEVER use Supabase.from() for DB! │
│                                    │
│  Self-review before commit:        │
│  $ grep -r "supabase.from(" .     │
│  Expected: 0 matches              │
│                                    │
│  Questions? #architecture channel  │
└────────────────────────────────────┘
```

---

**Keep this cheat sheet handy during development!**
