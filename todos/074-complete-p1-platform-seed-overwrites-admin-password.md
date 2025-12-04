---
status: complete
priority: p1
issue_id: "074"
tags: [security, code-review, seed, production-safety]
dependencies: []
---

# P1: Platform Seed Overwrites Admin Password on Re-run

## Problem Statement

The production platform seed uses `upsert()` which **unconditionally updates the password hash** on every seed run. This can lock out legitimate admins who have changed their password after initial setup.

**Why it matters:**
- Running `db:seed:production` resets the admin password unexpectedly
- No audit trail for password changes
- Security risk: allows password reset via CI/CD access
- Violates principle of idempotency (seeds should be safe to re-run)

## Findings

**Location:** `server/prisma/seeds/platform.ts:39-48`

```typescript
const admin = await prisma.user.upsert({
  where: { email: adminEmail },
  update: { passwordHash, role: 'PLATFORM_ADMIN', name: adminName },  // OVERWRITES PASSWORD!
  create: { ... },
});
```

**Attack Scenario:**
1. Attacker gains CI/CD access or production server SSH
2. Runs `ADMIN_EMAIL=admin@company.com ADMIN_DEFAULT_PASSWORD=hacked123 npm run db:seed:production`
3. Admin password is reset to `hacked123`
4. Attacker logs in as platform admin

**Production Scenario:**
1. Deploy v1.0 → seed runs → admin logs in with password `XYZ`
2. Admin changes password to `ABC` via admin panel
3. Deploy v1.1 → seed runs again → password reset to `XYZ`
4. Admin can no longer log in

## Proposed Solutions

### Solution A: Create-only seed (Recommended)
**Pros:** Safe for re-runs, no password overwrites
**Cons:** Requires manual password update if needed
**Effort:** Small (15 min)
**Risk:** Low

```typescript
const existingAdmin = await prisma.user.findUnique({
  where: { email: adminEmail }
});

if (existingAdmin) {
  console.log(`ℹ️  Platform admin already exists: ${adminEmail} (skipping)`);
  return;
}

// Only create if doesn't exist
const admin = await prisma.user.create({
  data: {
    email: adminEmail,
    name: adminName,
    role: 'PLATFORM_ADMIN',
    passwordHash,
  },
});
```

### Solution B: Explicit flag for password reset
**Pros:** Flexible, supports intentional resets
**Cons:** More complex, risk of accidental flag usage
**Effort:** Medium (30 min)
**Risk:** Medium

```typescript
const shouldResetPassword = process.env.FORCE_PASSWORD_RESET === 'true';

const admin = await prisma.user.upsert({
  where: { email: adminEmail },
  update: {
    role: 'PLATFORM_ADMIN',
    name: adminName,
    ...(shouldResetPassword && { passwordHash }),
  },
  create: { ... },
});

if (shouldResetPassword) {
  logger.warn('Platform admin password was reset');
}
```

### Solution C: Update only non-sensitive fields
**Pros:** Maintains name/role updates
**Cons:** Still uses upsert pattern
**Effort:** Small (10 min)
**Risk:** Low

```typescript
update: {
  role: 'PLATFORM_ADMIN',  // Update role only
  name: adminName,         // Update name only
  // Explicitly DO NOT update passwordHash
},
```

## Recommended Action

<!-- To be filled during triage -->

## Technical Details

**Affected Files:**
- `server/prisma/seeds/platform.ts`

**Components:**
- Platform seed function
- User model

**Database Changes:** None

## Acceptance Criteria

- [ ] Running `db:seed:production` twice does not change existing admin password
- [ ] First run creates admin with correct password
- [ ] Subsequent runs log "already exists" and skip creation
- [ ] Password can still be reset via admin panel (not seed)
- [ ] Audit log captures any password changes

## Work Log

| Date | Action | Learnings |
|------|--------|-----------|
| 2025-11-29 | Created from code review | upsert update clause should never include sensitive fields |

## Resources

- **Code Review:** Seed system refactoring review
- **File:** `server/prisma/seeds/platform.ts`
