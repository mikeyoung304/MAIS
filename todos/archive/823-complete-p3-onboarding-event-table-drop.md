---
status: pending
priority: p3
issue_id: 823
tags: [code-review, tech-debt, database, schema]
dependencies: []
---

# Tech Debt: Drop Deprecated OnboardingEvent Table

## Problem Statement

The `OnboardingEvent` table exists in the Prisma schema but is no longer used by application code. The event-sourced onboarding system was replaced by state-based `tenant.branding.discoveryFacts` storage.

**Why it matters:**

- Dead schema pollutes database
- Generated Prisma code includes unused models (~1000 lines)
- New developers may think event-sourcing is active

## Findings

**From tech-debt-validator agent:**

**Schema (server/prisma/schema.prisma:1040):**

```prisma
model OnboardingEvent {
  id        String   @id @default(cuid())
  tenantId  String
  eventType String
  payload   Json
  timestamp DateTime @default(now())
  version   Int

  tenant Tenant @relation(fields: [tenantId], references: [id], onDelete: Cascade)

  @@index([tenantId, timestamp])
  @@index([tenantId, version])
}

enum OnboardingPhase {
  NOT_STARTED
  DISCOVERY
  MARKET_RESEARCH
  SERVICES
  MARKETING
  COMPLETED
  SKIPPED
}
```

**Code references (all generated Prisma files - no application code):**

- `server/src/generated/prisma/internal/class.ts`
- `server/src/generated/prisma/models/OnboardingEvent.ts`
- `server/src/generated/prisma/client.ts`

**Current system uses:**

```typescript
// context-builder.service.ts Line 10
const discoveryFacts = (branding.discoveryFacts as KnownFacts) || {};
```

## Proposed Solutions

### Option A: Drop Table After Data Verification (Recommended)

**Pros:** Clean schema, reduced generated code
**Cons:** Requires production data check
**Effort:** Medium (30 minutes verification + migration)
**Risk:** Low (after verification)

**Steps:**

1. Check production: `SELECT COUNT(*) FROM "OnboardingEvent"`
2. If 0 rows: Create migration to drop table
3. If >0 rows: Export data, verify redundant with `discoveryFacts`, then drop

```sql
-- Migration
DROP TABLE IF EXISTS "OnboardingEvent";
DROP TYPE IF EXISTS "OnboardingPhase";
```

### Option B: Mark as Deprecated, Drop Later

**Pros:** No immediate risk
**Cons:** Technical debt lingers
**Effort:** Small (5 minutes)
**Risk:** None

Add comment to schema: `/// @deprecated - To be dropped after Phase 5`

## Recommended Action

Implement Option A after verifying production has no data.

## Technical Details

**Affected files:**

- `server/prisma/schema.prisma` (remove model + enum)
- Prisma client regenerates (~1000 lines removed from generated)

**Pre-drop verification:**

```sql
-- Run in production database
SELECT COUNT(*) FROM "OnboardingEvent";
SELECT "tenantId", COUNT(*)
FROM "OnboardingEvent"
GROUP BY "tenantId"
ORDER BY COUNT(*) DESC
LIMIT 10;
```

## Acceptance Criteria

- [ ] Verify production OnboardingEvent table is empty
- [ ] Create Prisma migration to drop table
- [ ] Remove OnboardingPhase enum
- [ ] Run `npx prisma generate` - no errors
- [ ] Application starts successfully

## Work Log

| Date       | Action                        | Learnings                                             |
| ---------- | ----------------------------- | ----------------------------------------------------- |
| 2026-02-04 | Verified table unused in code | Event-sourcing replaced by state-based discoveryFacts |

## Resources

- `docs/architecture/DELETION_MANIFEST.md` - Phase 1 OnboardingEvent cleanup
- `server/src/services/context-builder.service.ts` - Current facts storage
