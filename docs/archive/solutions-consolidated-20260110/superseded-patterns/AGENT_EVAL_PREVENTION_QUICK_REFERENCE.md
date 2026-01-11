# Agent Evaluation Remediation - Quick Reference Checklist

**Print this and pin it on your monitor!**

---

## Pattern 1: DI Constructor Ordering (P1-583)

```typescript
// ALWAYS: Dependencies BEFORE Config
constructor(
  anthropic?: Anthropic,           // ✅ Dependencies first
  config: Partial<Config> = {}     // ✅ Config second
)
```

**Validation:** Can I inject a mock without calling the constructor side effects?

---

## Pattern 2: Promise Cleanup (P1-581)

```typescript
// ALWAYS: settle-and-clear pattern
const results = await Promise.allSettled(this.promises);
// Log rejections if needed
this.promises = []; // Clear completely, don't filter()
```

**Validation:** Is the array empty after cleanup?

---

## Pattern 3: Tenant Scoping (P1-580)

```typescript
// ALWAYS: tenantId as FIRST parameter
async getTraces(tenantId: string, ...rest): Promise<Trace[]> {
  if (!tenantId) throw new Error('tenantId required');
  return prisma.trace.findMany({
    where: { tenantId, ...filters } // Tenant in EVERY where clause
  });
}
```

**Validation:** Can another tenant see this data?

---

## Pattern 4: Type Guards (P1-585)

```typescript
// NEVER: Don't use ! for narrowing
const filtered = items.filter((x) => x != null)!; // ❌

// ALWAYS: Use type predicates
function isDefined<T>(x: T | null): x is T {
  return x != null;
}
const filtered = items.filter(isDefined); // ✅
```

**Validation:** Does the result type show as narrowed? (hover check)

---

## Pattern 5: Database Indexes (P1-582)

```prisma
// ALWAYS: Add indexes for query patterns
@@index([tenantId, evalScore])  // For findMany where tenantId + evalScore
@@index([tenantId, createdAt])  // For time-based queries
```

**Validation:** Does the query execute in <100ms?

---

## Pattern 6: Cleanup Jobs (P1-584)

```typescript
// ALWAYS: Cleanup old data regularly
export async function cleanupExpiredTraces(prisma, retentionDays = 90) {
  const cutoff = new Date(Date.now() - retentionDays * 24 * 60 * 60 * 1000);
  await prisma.trace.deleteMany({
    where: { createdAt: { lt: cutoff }, evalScore: { not: null } },
  });
}

// Wire to shutdown
container.cleanup = async () => {
  await runAllCleanupJobs(prisma);
  await prisma.$disconnect();
};
```

**Validation:** Does cleanup run on shutdown?

---

## Code Review Checklist (5 min)

Copy this into every PR comment:

```
DEPENDENCY INJECTION
☐ Dependencies before config params
☐ Optional deps typed with ?
☐ API keys only in defaults

ASYNC OPERATIONS
☐ Promise.allSettled() not filter()
☐ Array cleared with = []
☐ Results logged

DATABASE
☐ tenantId first parameter
☐ if (!tenantId) throw Error()
☐ WHERE includes tenantId
☐ Compound queries verify ownership

TYPES
☐ No ! for narrowing
☐ Type predicates (is T) instead
☐ Results have narrowed type

PERFORMANCE
☐ Indexed columns used
☐ New queries <100ms

INFRA
☐ Cleanup job exists
☐ Scheduled daily
☐ Runs on shutdown
```

---

## Failure Patterns (What To Look For)

| Red Flag                          | Fix                                  |
| --------------------------------- | ------------------------------------ |
| `constructor(config, anthropic)`  | Reverse order: `(anthropic, config)` |
| `filter(x => x != null)!`         | Use type guard: `filter(isDefined)`  |
| `.findMany({ where: { field } })` | Add: `tenantId` to where clause      |
| `this.promises = []` missing      | Add settle-and-clear before shutdown |
| Query is slow (>500ms)            | Add `@@index([tenantId, field])`     |
| Database keeps growing            | Add cleanup job with retention date  |

---

## Test Command

Before commit:

```bash
# Type safety
npm run typecheck

# DI tests
npm test -- evaluator-di.test.ts

# Isolation tests
npm run test:integration -- --grep "isolation|tenant"

# Performance tests
npm run test:integration -- --grep "performance|<100ms"

# All tests
npm test
```

---

## Prevention in 3 Steps

### Step 1: Constructor (5 seconds)

```typescript
// Is the first param a dependency, not config?
constructor(client?: HttpClient, config: Config = {}) ✅
constructor(config: Config, client?: HttpClient) ❌
```

### Step 2: Database (10 seconds)

```typescript
// Does every where clause have tenantId?
where: { tenantId, ...filters } ✅
where: { field } ❌
```

### Step 3: Cleanup (15 seconds)

```typescript
// Are promises cleared with settle-and-clear?
await Promise.allSettled(promises); promises = [] ✅
promises = promises.filter(...) ❌
```

---

## Files Changed (Common Locations)

| Pattern         | File Path                                       |
| --------------- | ----------------------------------------------- |
| DI violations   | `src/**/*.service.ts`, `src/**/*.repository.ts` |
| Promise leaks   | `src/agent/**/*.ts`, `src/jobs/*.ts`            |
| Tenant issues   | `src/adapters/prisma/*.ts`, `src/lib/ports.ts`  |
| Type safety     | `src/**/*filter*.ts`, `src/**/*find*.ts`        |
| Missing indexes | `server/prisma/schema.prisma`                   |
| Cleanup gaps    | `src/jobs/cleanup.ts`, `src/lib/shutdown.ts`    |

---

## Status Codes (For Git Commit Messages)

- P1-580: Tenant scoping validation
- P1-581: Promise cleanup with settle-and-clear
- P1-582: Database index optimization
- P1-583: DI constructor ordering
- P1-584: Infrastructure cleanup jobs
- P1-585: Type guard replacements for assertions

Use in commit: `Resolves: P1-580, P1-581` etc.

---

**Created:** 2026-01-02
**Source:** Agent Evaluation System Phases 1-4 Remediation
**Last Updated:** 2026-01-02
