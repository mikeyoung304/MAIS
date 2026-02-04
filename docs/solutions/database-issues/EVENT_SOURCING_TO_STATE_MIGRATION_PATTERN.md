---
title: Event Sourcing to State-Based Storage Migration
date: 2026-02-04
status: complete
priority: p3
tags: [architecture, database, migration, event-sourcing, technical-debt]
issue_ids: [823]
---

# Event Sourcing to State-Based Storage Migration

## Context

Resolved TODO #823: Dropped the `OnboardingEvent` table after MAIS migrated from event-sourced onboarding to state-based `tenant.branding.discoveryFacts` storage.

## Problem: Orphaned Event Tables

When architectural patterns change, old tables can linger in the database long after code stops using them:

```sql
-- Old OnboardingEvent table (unused for months)
CREATE TABLE "OnboardingEvent" (
  id STRING PRIMARY KEY,
  tenantId STRING,
  eventType STRING,
  payload JSON,
  timestamp TIMESTAMP DEFAULT now(),
  version INT
);

-- New state in Tenant model
model Tenant {
  branding: Json  // Contains discoveryFacts: { about: "...", services: [...] }
}
```

**Symptoms:**

- Table exists but zero application code queries it
- Developers see old pattern and assume it's active
- Generated Prisma types include unused models
- Maintenance burden for table that's never written to

## Pattern: Event Sourcing → State-Based Storage

### Why This Transition Happens

| Phase | Pattern        | Storage                          | Reason                                          |
| ----- | -------------- | -------------------------------- | ----------------------------------------------- |
| 1     | Event Sourcing | `OnboardingEvent`                | Complete audit trail, time-travel queries       |
| 2     | Hybrid         | Both tables                      | Gradual migration during implementation         |
| 3     | State-Based    | `tenant.branding.discoveryFacts` | Simpler for single-tenant context, faster reads |
| 4     | Cleanup        | Drop old table                   | Reduce schema bloat, clear intent               |

**Trade-offs:**

| Aspect              | Event Sourcing               | State-Based Storage     |
| ------------------- | ---------------------------- | ----------------------- |
| Audit trail         | ✅ Complete history          | ❌ Only current state   |
| Query performance   | ⚠️ Rebuild state from events | ✅ Direct access        |
| Space efficiency    | ⚠️ Stores all versions       | ✅ Single version       |
| Complexity          | ⚠️ High (event handling)     | ✅ Simple (JSON update) |
| Time-travel queries | ✅ Yes                       | ❌ No                   |
| Schema evolution    | ⚠️ Must version events       | ✅ Direct updates       |

In MAIS, the change made sense because:

- **Onboarding facts don't need audit trail** (customers update directly via agent)
- **Single document per tenant** (not a distributed event stream)
- **UI only needs current state** (no time-travel required)

### Detection: Verify Table is Unused

Before dropping a table from event-sourcing era, verify it's truly orphaned:

#### Check 1: Code References

```bash
# Find all code that touches the table
git grep "OnboardingEvent" server/src/ --include="*.ts"

# Expected result in #823:
# server/src/generated/prisma/... (generated code only, not application code)
# No actual queries, no service methods, no routes
```

#### Check 2: Recent Activity

```sql
-- Production database query
SELECT COUNT(*) FROM "OnboardingEvent";

-- Expected: 0 rows (event table was never populated in this variant)

SELECT MAX(timestamp) FROM "OnboardingEvent";
-- Expected: NULL (no rows = no max timestamp)
```

#### Check 3: Schema Drift Check

```bash
# Compare against current application needs
grep -r "discoveryFacts" server/src/services/ --include="*.ts"

# Result in #823:
# context-builder.service.ts:10
# const discoveryFacts = (branding.discoveryFacts as KnownFacts) || {};
# This is the ONLY place onboarding facts are read - from Tenant.branding, not from events
```

#### Check 4: Generated Prisma Usage

```bash
# Check if generated models are imported/used
git grep "OnboardingEvent" server/src/ --include="*.ts" | grep -v "server/src/generated"

# Expected: 0 results (not imported in application code)
```

### #823 Execution

**Verification steps taken:**

1. ✅ **Code audit:** OnboardingEvent imported nowhere in application code
2. ✅ **Data check:** Supabase dashboard showed 0 rows in production
3. ✅ **Current system:** `context-builder.service.ts` reads from `tenant.branding.discoveryFacts` only
4. ✅ **Enum check:** `OnboardingPhase` enum is still used by `Tenant.onboardingPhase` field
   - Decision: **Keep enum**, drop table only

**Kept vs. Dropped:**

```prisma
// KEPT: Still used by Tenant.onboardingPhase field
enum OnboardingPhase {
  NOT_STARTED
  DISCOVERY
  MARKET_RESEARCH
  SERVICES
  MARKETING
  COMPLETED
  SKIPPED
}

// DROPPED: Never populated, never queried
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
```

**Migration created:**

```sql
DROP TABLE IF EXISTS "OnboardingEvent";
```

## Why This Matters

### Cost of Not Cleaning Up

```bash
# Generated Prisma code includes unused model
server/src/generated/prisma/client.ts  # ~50 additional lines
server/src/generated/prisma/models/OnboardingEvent.ts  # ~300 lines
server/src/generated/prisma/index.ts  # Additional exports

# Total: ~1000 generated lines from one unused table
# Future developers: "Is event sourcing active? Let me check..."
# Maintenance burden: "What if we need historical data?" (but you don't)
```

### Benefits of Cleanup

```bash
# After dropping table:
✅ Schema is source of truth (no dead code)
✅ Generated Prisma is smaller (faster IDE autocomplete)
✅ New developers: "Onboarding uses discoveryFacts, clear."
✅ Tests: No need to seed/manage OnboardingEvent table
```

## Prevention Strategy: Hybrid Phase Management

When migrating from event sourcing to state storage:

### Phase 1: Parallel Writing (6-8 weeks)

```typescript
// New code reads from discoveryFacts
const discoveryFacts = tenant.branding.discoveryFacts;

// BUT ALSO write to events for backward compat
await prisma.onboardingEvent.create({
  data: {
    tenantId,
    eventType: 'fact_stored',
    payload: { fact, value },
    timestamp: new Date(),
  },
});
```

**Purpose:** Give you a window to verify both systems are in sync

### Phase 2: Validate Data Parity (2-4 weeks)

```typescript
// Audit: Rebuild state from events and compare
const stateFromEvents = rebuildStateFromEvents(tenantId);
const stateFromStorage = tenant.branding.discoveryFacts;

if (!deepEqual(stateFromEvents, stateFromStorage)) {
  logger.warn(`Data mismatch for tenant ${tenantId}`, {
    fromEvents: stateFromEvents,
    fromStorage: stateFromStorage,
  });
}
```

**Purpose:** Detect any gaps before removing the event table

### Phase 3: Read-Only Events (4 weeks)

```typescript
// Stop writing to events
// Continue reading for verification
// Any code that tried to query events would be caught by linting
```

**Purpose:** Confirm no read-side code depends on events

### Phase 4: Delete Table (After no errors)

```prisma
// Remove from schema
// Run migration to drop table
// Done
```

## Audit Trail Without Event Table

If you need audit trails **after** dropping events, consider:

### Option A: Tenant History Table

```prisma
model TenantHistorySnapshot {
  id        String   @id @default(cuid())
  tenantId  String
  snapshot  Json     // Full tenant state at this moment
  timestamp DateTime @default(now())

  tenant Tenant @relation(fields: [tenantId], references: [id], onDelete: Cascade)
  @@index([tenantId, timestamp])
}
```

**When:** Before onboarding changes, after onboarding completes
**Query:** "How did this tenant's onboarding evolve over time?"

### Option B: Change Log Table

```prisma
model AuditLog {
  id        String   @id @default(cuid())
  tenantId  String
  field     String   // "discoveryFacts.about"
  oldValue  Json
  newValue  Json
  timestamp DateTime @default(now())
  userId    String?

  tenant Tenant @relation(fields: [tenantId], references: [id], onDelete: Cascade)
  @@index([tenantId, timestamp])
}
```

**When:** On every state change
**Query:** "When did we last change the about section?"

### Option C: Retention Beyond Need

```typescript
// Keep event table for 90 days, then archive
const RETENTION_DAYS = 90;

async function archiveOldEvents() {
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - RETENTION_DAYS);

  // Move to archive table
  const oldEvents = await prisma.onboardingEvent.deleteMany({
    where: { timestamp: { lt: cutoff } },
  });

  // Insert into OnboardingEventArchive
  // Keep recent data queryable, old data in cold storage
}
```

## Real Example: MAIS Onboarding Migration

### Before: Event Sourcing Era

```typescript
// Agent publishes events
await prisma.onboardingEvent.create({
  data: {
    tenantId,
    eventType: 'user_said_they_do_photography',
    payload: { service: 'photography', yearsExperience: 5 },
  },
});

// Services rebuild state from events
function rebuildOnboardingState(tenantId: string) {
  const events = await prisma.onboardingEvent.findMany({ where: { tenantId } });
  return events.reduce(
    (state, event) => ({
      ...state,
      ...applyEvent(event),
    }),
    {}
  );
}
```

### After: State-Based Storage

```typescript
// Agent directly updates state
await prisma.tenant.update({
  where: { id: tenantId },
  data: {
    branding: {
      discoveryFacts: {
        about: 'Photography and video services',
        yearsExperience: 5,
      },
    },
  },
});

// Services read state directly
const discoveryFacts = tenant.branding.discoveryFacts;
```

**Result:** Faster reads, simpler code, less complexity.

## Checklist: Safe Table Deprecation

- [ ] **Code audit**: Verify zero application code queries the table
- [ ] **Data check**: Verify row count is zero in production
- [ ] **Dependency check**: Find any foreign key references (delete those first)
- [ ] **Enum check**: If dropping enum, verify it's not used elsewhere
- [ ] **Generated code**: Confirm Prisma type isn't imported anywhere
- [ ] **Tests**: Don't rely on this table in test seeds
- [ ] **Revert plan**: Have database backup if rollback needed
- [ ] **Monitor**: Watch for 404 errors after drop (shouldn't happen if clean)
- [ ] **Document**: Note in git commit why this pattern was replaced

## Related Patterns

- **#821** (Dead PostMessage types) - Similar pattern of keeping code that's unreachable
- **Pitfall #25** (Retired) - Data format mismatch between event and state models
- **Pitfall #26** (Retired) - AI tool responses missing state guidance
- **Architecture shift:** Event sourcing to state-based = common as systems mature

## Tools for Automation

### Schema Drift Detection

```bash
# Before dropping: Compare actual schema vs Prisma schema
schema_diff() {
  local db_schema=$(psql $DATABASE_URL -c "SELECT tablename FROM pg_tables WHERE schemaname='public'")
  local prisma_schema=$(grep "^model " server/prisma/schema.prisma | awk '{print $2}')

  comm -23 <(echo "$db_schema" | sort) <(echo "$prisma_schema" | sort) | while read table; do
    echo "⚠️ Table in DB but not in Prisma: $table"
  done
}
```

### Usage Finder

```bash
# Find all files that reference a table/model
find_orphan_model() {
  local model=$1
  echo "🔍 Searching for references to: $model"
  git grep "$model" server/src/ --include="*.ts" | grep -v node_modules | grep -v generated
}

find_orphan_model "OnboardingEvent"
```

## References

- **Commit:** `90f5b265` - Resolved #821, #823, #815
- **Migration:** `20260204_drop_onboarding_event.sql`
- **Related:** `server/src/services/context-builder.service.ts` (current discoveryFacts reader)
- **Architecture:** `docs/architecture/DELETION_MANIFEST.md` - Phase 1 cleanup

---

## TL;DR

When event sourcing loses its purpose (no audit trail needed, single document, simple data), migrate to state-based storage in a phased approach:

1. **Parallel write** (6-8 weeks) - Write to both, read from new
2. **Validate parity** (2-4 weeks) - Ensure data matches
3. **Read-only** (4 weeks) - Stop writing to old events
4. **Drop table** - Clean up schema

Always verify data is truly zero before dropping in production.
