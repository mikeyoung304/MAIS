# Prevention Strategies Index - Agent Evaluation System

**Scope:** Complete prevention strategy for Agent Evaluation System remediation (Phases 1-4)
**Status:** MANDATORY reading before implementing similar features
**Created:** 2026-01-02

---

## Reading Path

### For Code Review (5 minutes)

1. **Print & Pin:** `AGENT_EVAL_PREVENTION_QUICK_REFERENCE.md`
2. Use checklist on every PR that touches agent evaluation code
3. Resolve checklist items before approving

### For Implementation (30 minutes)

1. **Full Patterns:** `agent-evaluation-remediation-prevention-MAIS-20260102.md`
2. Read section for each pattern you'll implement
3. Keep open while coding (use browser find)

### For Deep Dive (60 minutes)

1. **Code Examples:** `AGENT_EVAL_CODE_EXAMPLES.md`
2. Copy patterns and adapt to your use case
3. Follow test patterns exactly

---

## 6 Critical Patterns to Prevent

### Pattern 1: DI Constructor Ordering (P1-583)

**Risk Level:** HIGH - Makes testing impossible
**File:** `agent-evaluation-remediation-prevention-MAIS-20260102.md#pattern-1`
**Quick Reference:** `AGENT_EVAL_PREVENTION_QUICK_REFERENCE.md` Section 1
**Code Example:** `AGENT_EVAL_CODE_EXAMPLES.md#example-1`

**Key Principle:** Dependencies BEFORE config parameters

```typescript
// ✅ constructor(dependency?: HttpClient, config: Config = {})
// ❌ constructor(config: Config, dependency?: HttpClient)
```

**When to Check:**

- Creating service constructors
- Adding external client dependencies
- Code review of any `constructor(` line

---

### Pattern 2: Promise Cleanup (P1-581)

**Risk Level:** CRITICAL - Memory leak, production outage
**File:** `agent-evaluation-remediation-prevention-MAIS-20260102.md#pattern-2`
**Quick Reference:** `AGENT_EVAL_PREVENTION_QUICK_REFERENCE.md` Section 2
**Code Example:** `AGENT_EVAL_CODE_EXAMPLES.md#example-2`

**Key Principle:** Settle-and-clear, never filter()

```typescript
// ✅ await Promise.allSettled(promises); promises = [];
// ❌ promises = promises.filter(p => /* condition */);
```

**When to Check:**

- Services with fire-and-forget operations
- Long-running orchestrators
- Any `.push()` on promise arrays

---

### Pattern 3: Tenant Scoping (P1-580)

**Risk Level:** CRITICAL - Security vulnerability, data leakage
**File:** `agent-evaluation-remediation-prevention-MAIS-20260102.md#pattern-3`
**Quick Reference:** `AGENT_EVAL_PREVENTION_QUICK_REFERENCE.md` Section 3
**Code Example:** `AGENT_EVAL_CODE_EXAMPLES.md#example-3`

**Key Principle:** tenantId as first parameter + filter in every query

```typescript
// ✅ async getTraces(tenantId: string) { where: { tenantId, ... } }
// ❌ async getTraces(traceId: string) { where: { traceId } }
```

**When to Check:**

- EVERY database method
- EVERY Prisma query
- During code review: search for `.findMany(` and `.findFirst(`

---

### Pattern 4: Type Guards (P1-585)

**Risk Level:** MEDIUM - Runtime errors, type safety bypass
**File:** `agent-evaluation-remediation-prevention-MAIS-20260102.md#pattern-4`
**Quick Reference:** `AGENT_EVAL_PREVENTION_QUICK_REFERENCE.md` Section 4
**Code Example:** `AGENT_EVAL_CODE_EXAMPLES.md#example-4`

**Key Principle:** Type predicates (is T), never ! assertions

```typescript
// ✅ filter(isDefined) or filter((x) => x != null) with type narrowing
// ❌ filter(x => x != null)! or as ApprovedAction[]
```

**When to Check:**

- Array.filter() operations
- Promise.allSettled() result handling
- Type assertions in filter/find results

---

### Pattern 5: Database Indexes (P1-582)

**Risk Level:** HIGH - Performance bottleneck, production slowdown
**File:** `agent-evaluation-remediation-prevention-MAIS-20260102.md#pattern-5`
**Quick Reference:** `AGENT_EVAL_PREVENTION_QUICK_REFERENCE.md` Section 5
**Code Example:** `AGENT_EVAL_CODE_EXAMPLES.md#example-5`

**Key Principle:** Index query patterns in schema.prisma

```typescript
// ✅ @@index([tenantId, evalScore])
// ❌ No indexes, queries scan full table
```

**When to Check:**

- New database queries added
- Before commit: verify migration includes indexes
- Performance tests should verify <100ms

---

### Pattern 6: Infrastructure Cleanup (P1-584)

**Risk Level:** HIGH - Database bloat, compliance failures
**File:** `agent-evaluation-remediation-prevention-MAIS-20260102.md#pattern-6`
**Quick Reference:** `AGENT_EVAL_PREVENTION_QUICK_REFERENCE.md` Section 6
**Code Example:** `AGENT_EVAL_CODE_EXAMPLES.md#example-6`

**Key Principle:** Cleanup old data regularly, run on shutdown

```typescript
// ✅ Daily cleanup job + shutdown hook
// ❌ Data accumulates indefinitely
```

**When to Check:**

- Long-running services
- Data retention requirements
- Shutdown/cleanup code paths

---

## Prevention Checklist by Development Stage

### Planning Phase

- [ ] Review all 6 patterns before architecture design
- [ ] Plan DI structure with dependencies first
- [ ] Identify promise-based operations (need cleanup)
- [ ] Define tenant scoping strategy
- [ ] Plan type-safe filtering
- [ ] Identify data retention requirements

### Implementation Phase

- [ ] Follow constructor pattern (dependencies first)
- [ ] Implement settle-and-clear for async operations
- [ ] Add tenantId to every database method
- [ ] Use type predicates instead of assertions
- [ ] Add indexes for all query patterns
- [ ] Implement cleanup job with retention policy

### Code Review Phase

- [ ] Use quick reference checklist (5 min per PR)
- [ ] Search for violation patterns (grep)
- [ ] Verify tenant isolation with cross-tenant test
- [ ] Check performance (query <100ms)
- [ ] Verify cleanup runs on shutdown

### Testing Phase

- [ ] Unit tests for DI (inject mocks)
- [ ] Integration tests for tenant isolation
- [ ] Performance tests for queries
- [ ] Memory leak tests for promise cleanup
- [ ] Cleanup tests for data retention

---

## Integration with Existing Prevention Strategies

These 6 patterns complement MAIS's existing prevention strategies:

| MAIS Pattern                                                                                         | Agent Eval Pattern               | Interaction                         |
| ---------------------------------------------------------------------------------------------------- | -------------------------------- | ----------------------------------- |
| [Multi-Tenant Isolation](CLAUDE.md#multi-tenant-data-isolation)                                      | Pattern 3 (Tenant Scoping)       | Core security pattern, must combine |
| [DI Container Pattern](CLAUDE.md#dependency-injection)                                               | Pattern 1 (Constructor Ordering) | Applies Kieran's rule to DI         |
| [Type Safety](CLAUDE.md#critical-security-rules)                                                     | Pattern 4 (Type Guards)          | TS strict mode enforcement          |
| [Service Layer](docs/solutions/best-practices/service-layer-patterns-MAIS-20251204.md)               | Pattern 2 (Promise Cleanup)      | Services own async operations       |
| [Performance](CLAUDE.md#test-strategy)                                                               | Pattern 5 (Indexes)              | Query optimization                  |
| [Graceful Shutdown](docs/solutions/patterns/phase-5-testing-and-caching-prevention-MAIS-20251231.md) | Pattern 6 (Cleanup)              | Shutdown coordination               |

---

## Common Violations and Fixes

### Violation 1: Config Before Dependencies

```typescript
// ❌ Wrong
class Service {
  constructor(config: Config, httpClient?: HttpClient) {}
}

// ✅ Fix
class Service {
  constructor(httpClient?: HttpClient, config: Partial<Config> = {}) {}
}
```

**Patterns:** 1
**Impact:** P0 - Testing impossible
**Effort:** Swap parameter order

---

### Violation 2: Promise Memory Leak

```typescript
// ❌ Wrong
promises = promises.filter(p => /* condition */);

// ✅ Fix
await Promise.allSettled(promises);
promises = [];
```

**Patterns:** 2
**Impact:** P0 - Memory leak, production outage
**Effort:** Rewrite cleanup logic

---

### Violation 3: Cross-Tenant Data Leakage

```typescript
// ❌ Wrong
async getThing(thingId: string) {
  return this.prisma.thing.findFirst({ where: { id: thingId } });
}

// ✅ Fix
async getThing(tenantId: string, thingId: string) {
  return this.prisma.thing.findFirst({
    where: { id: thingId, tenantId }
  });
}
```

**Patterns:** 3
**Impact:** P0 - Security vulnerability
**Effort:** Add parameter + filter to all queries

---

### Violation 4: Type Assertion in Filter

```typescript
// ❌ Wrong
const approved = items.filter((x) => x.status === 'approved')!;

// ✅ Fix
function isApproved(x: Item): x is ApprovedItem {
  return x.status === 'approved';
}
const approved = items.filter(isApproved);
```

**Patterns:** 4
**Impact:** P2 - Type safety bypass
**Effort:** Create predicate function

---

### Violation 5: Missing Database Indexes

```prisma
// ❌ Wrong
model Trace {
  tenantId String
  evalScore Int?
  // No indexes
}

// ✅ Fix
model Trace {
  tenantId String
  evalScore Int?
  @@index([tenantId, evalScore])
}
```

**Patterns:** 5
**Impact:** P1 - Performance regression
**Effort:** Add @@index + migration

---

### Violation 6: Unbounded Data Growth

```typescript
// ❌ Wrong - No cleanup
await prisma.trace.create({ data: trace });

// ✅ Fix
// Add to cleanup job:
await prisma.trace.deleteMany({
  where: { createdAt: { lt: cutoffDate } },
});
```

**Patterns:** 6
**Impact:** P1 - Database bloat
**Effort:** Implement cleanup job + scheduling

---

## Risk Matrix

```
Impact
  │
  ├─ P0 (Crash/Outage)   │ Pattern 2 (Memory) │ Pattern 3 (Security) │
  │
  ├─ P1 (Performance)    │ Pattern 5 (Index)  │ Pattern 6 (Bloat)   │
  │
  └─ P2 (Type Safety)    │ Pattern 1 (Testing)│ Pattern 4 (Guards)  │
    └─────────────────────┴────────────────────┴─────────────────────
      Testing   Security   Performance
      Difficulty
```

---

## Automation Opportunities

### Pre-commit Hook

```bash
# Detect pattern violations
npm run lint -- --rule="no-assertions-in-filter"
npm run lint -- --rule="require-tenantid-first"
npm run lint -- --rule="type-guards-not-assertions"
```

### CI/CD Checks

```bash
# Performance tests
npm run test:performance -- --threshold=100ms

# Tenant isolation tests
npm run test:isolation

# Type safety checks
npm run typecheck --strict
```

---

## Document Navigation

### Current Document

- **File:** `PREVENTION_STRATEGIES_INDEX_AGENT_EVAL.md`
- **Purpose:** Navigation and integration guide
- **Read Time:** 10 minutes
- **Use:** Before reading other docs, understand structure

### Quick Reference

- **File:** `AGENT_EVAL_PREVENTION_QUICK_REFERENCE.md`
- **Purpose:** 5-minute code review checklist
- **Read Time:** 2 minutes
- **Use:** During code review

### Full Prevention Guide

- **File:** `agent-evaluation-remediation-prevention-MAIS-20260102.md`
- **Purpose:** Detailed explanation of each pattern
- **Read Time:** 30 minutes
- **Use:** Before implementing similar features

### Code Examples

- **File:** `AGENT_EVAL_CODE_EXAMPLES.md`
- **Purpose:** Copy-paste implementation patterns
- **Read Time:** 30 minutes
- **Use:** During implementation

---

## FAQ

### Q: Which pattern is most critical?

**A:** Pattern 3 (Tenant Scoping) - it's a P0 security vulnerability. Pattern 2 (Promise Cleanup) is P0 for production outages.

### Q: Do I need to read all 4 documents?

**A:** Depends on your role:

- **Code Reviewer:** Quick Reference (2 min)
- **Implementation:** Full Prevention + Code Examples (60 min)
- **Architecture:** All 4 documents (120 min)

### Q: Which patterns apply to my code?

**A:** Ask: Does my code have...

- Constructors? → Pattern 1
- Async operations? → Pattern 2
- Database queries? → Patterns 3 & 5
- Array filtering? → Pattern 4
- Data retention? → Pattern 6

### Q: How do I add these to linting?

**A:** See `Automation Opportunities` section. ESLint rules needed:

- no-assertions-in-filters (Pattern 4)
- require-tenantid-first-param (Pattern 3)
- promise-cleanup-required (Pattern 2)

---

## Version History

| Date       | Version | Changes                                   |
| ---------- | ------- | ----------------------------------------- |
| 2026-01-02 | 1.0     | Initial release - 6 patterns, 4 documents |

---

## Related Reading

- [MEHR Checklist](/CLAUDE.md#common-pitfalls) - Critical patterns in CLAUDE.md
- [Multi-Tenant Isolation](/CLAUDE.md#multi-tenant-data-isolation) - Foundation for Pattern 3
- [DI Container Pattern](/CLAUDE.md#dependency-injection) - Foundation for Pattern 1
- [Prevention Strategies Index](/docs/solutions/PREVENTION-STRATEGIES-INDEX.md) - Other P0/P1 patterns
- [Phase 5 Prevention](/docs/solutions/patterns/phase-5-testing-and-caching-prevention-MAIS-20251231.md) - Complementary patterns

---

**Last Updated:** 2026-01-02
**Maintainer:** Claude Code + community
**Source:** Agent Evaluation System Phases 1-4 Remediation (commits: face869, 458702e, c072136)
