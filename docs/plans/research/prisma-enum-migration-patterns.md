# Prisma Enum Migration: Boolean to OnboardingStatus

## 1. Enum Definition (schema.prisma)

Follow existing codebase pattern (see `OnboardingPhase`, `BookingStatus`). SCREAMING_CASE values, doc comments per value.

```prisma
enum OnboardingStatus {
  PENDING_PAYMENT  // Account created, awaiting payment
  PENDING_INTAKE   // Paid, awaiting intake form
  BUILDING         // Background build in progress
  SETUP            // Checklist phase
  COMPLETE         // Published, full access
}
```

Use `@default(PENDING_PAYMENT)` on the field. Prisma 7 maps this to PostgreSQL `CREATE TYPE` + `DEFAULT`.

## 2. Migration Strategy: Expand and Contract (3 Migrations)

**Migration 1 — Expand:** Add new enum + nullable column (no default yet, avoids PG "uncommitted enum" error).

```sql
CREATE TYPE "OnboardingStatus" AS ENUM ('PENDING_PAYMENT', 'PENDING_INTAKE', 'BUILDING', 'SETUP', 'COMPLETE');
ALTER TABLE "Tenant" ADD COLUMN "onboardingStatus" "OnboardingStatus";
```

**Migration 2 — Backfill + default:** Data migration in same SQL file, then set NOT NULL + default.

```sql
-- Backfill from existing onboardingPhase
UPDATE "Tenant" SET "onboardingStatus" = CASE
  WHEN "onboardingPhase" = 'COMPLETED' THEN 'COMPLETE'::"OnboardingStatus"
  WHEN "onboardingPhase" = 'SKIPPED' THEN 'COMPLETE'::"OnboardingStatus"
  WHEN "onboardingPhase" = 'BUILDING' THEN 'BUILDING'::"OnboardingStatus"
  ELSE 'SETUP'::"OnboardingStatus"
END;
ALTER TABLE "Tenant" ALTER COLUMN "onboardingStatus" SET NOT NULL;
ALTER TABLE "Tenant" ALTER COLUMN "onboardingStatus" SET DEFAULT 'PENDING_PAYMENT'::"OnboardingStatus";
```

**Migration 3 — Contract:** Drop old columns after code no longer reads them.

```sql
ALTER TABLE "Tenant" DROP COLUMN "onboardingPhase";
-- Keep onboardingCompletedAt (still useful for analytics)
```

## 3. Zero-Downtime Deployment Order

1. **Deploy code** that reads BOTH old + new fields (dual-read). Write to BOTH.
2. **Run Migration 1 + 2** (expand + backfill). Old code ignores new column.
3. **Deploy code** that reads ONLY new field. Old column becomes dead.
4. **Run Migration 3** (contract). Drop old column.

Key: new column is nullable initially so old code (pre-deploy) doesn't break on INSERT.

## 4. PostgreSQL Enum vs String + CHECK

**Use native enum** (this codebase's pattern). 4 bytes vs variable-length string. The codebase already has 20+ enums. Consistency > flexibility. Adding values is `ALTER TYPE ADD VALUE` (append-only, no downtime). Removing values requires type recreation (see `20260219` migration for the pattern).

## 5. Prisma `@default` Gotcha

PostgreSQL requires enum values to be committed before use as DEFAULT. Split into two migrations: (1) create enum + add column, (2) set default. Prisma `migrate dev --create-only` lets you edit SQL before applying.

## 6. Testing in CI

```typescript
// In vitest setup: test the backfill logic
it('migrates onboardingPhase COMPLETED to OnboardingStatus COMPLETE', async () => {
  await prisma.$executeRaw`UPDATE "Tenant" SET "onboardingPhase" = 'COMPLETED' WHERE id = ${id}`;
  // Run migration SQL
  const tenant = await prisma.tenant.findUniqueOrThrow({ where: { id } });
  expect(tenant.onboardingStatus).toBe('COMPLETE');
});
```

For CI: `prisma migrate reset --force` runs all migrations on a fresh DB. Catches SQL errors.

## 7. Route Guard Pattern (Middleware)

```typescript
function requireOnboardingStatus(...allowed: OnboardingStatus[]) {
  return async (req: Request, res: Response, next: NextFunction) => {
    const { tenantId } = res.locals.tenantAuth;
    const tenant = await prisma.tenant.findUniqueOrThrow({
      where: { id: tenantId },
      select: { onboardingStatus: true },
    });
    if (!allowed.includes(tenant.onboardingStatus)) {
      return res.status(403).json({
        error: 'onboarding_required',
        currentStatus: tenant.onboardingStatus,
        redirectTo: REDIRECT_MAP[tenant.onboardingStatus],
      });
    }
    next();
  };
}
// Usage: router.use('/api/dashboard/*', requireOnboardingStatus('SETUP', 'COMPLETE'));
```

## 8. MAIS-Specific Notes

- Existing `OnboardingPhase` enum has the rename-and-recreate pattern in `20260219` migration. Reuse that approach.
- `onboardingComplete` is a **derived boolean** in `context-builder.service.ts` (line 506), not a DB column. No DB migration needed for it--just update the derivation logic.
- The `onboardingCompletedAt` DateTime field should be preserved (analytics + the reveal guard).
- During dual-read phase, derive `onboardingComplete` from: `status === 'COMPLETE'`.
