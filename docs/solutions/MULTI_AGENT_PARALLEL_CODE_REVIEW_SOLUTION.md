---
title: Multi-Agent Parallel Code Review Solution
category: methodology
tags:
  [
    multi-agent-review,
    code-review,
    parallel-agents,
    security,
    performance,
    architecture,
    compound-engineering,
  ]
date_extracted: 2026-01-10
source_commits: [5cd5bfb1]
---

# Multi-Agent Parallel Code Review Solution

## Executive Summary

The multi-agent parallel code review methodology performs thorough code reviews by deploying six specialized agents in parallel, each with domain-specific expertise. This approach catches issues that generalist reviews miss—for example, in commit 5cd5bfb1, the Data Integrity Guardian found a P1 TOCTOU race condition that five other specialized reviewers overlooked.

## The Problem Being Solved

Traditional code reviews struggle with comprehensive coverage across multiple dimensions:

- **Security reviews** miss performance issues
- **Performance audits** miss architectural violations
- **Generalist reviews** lack domain-specific expertise in specialized areas
- **Single-threaded reviews** are slow and miss issues through cognitive load

The solution is parallel specialization: Deploy agents with deep domain expertise simultaneously, each applying hundreds of domain-specific heuristics.

## The Solution: Multi-Agent Parallel Architecture

### Phase 1: Code Review Command

Invoke the workflow with a single command:

```bash
/workflows:review <commit-hash|PR-number|branch|latest>
```

Examples:

```bash
/workflows:review 5cd5bfb1              # Specific commit
/workflows:review 123                   # GitHub PR number
/workflows:review https://github.com/org/repo/pull/123  # Full PR URL
/workflows:review latest                # Current branch
```

### Phase 2: Parallel Agent Deployment (6 Specialized Reviewers)

Six agents launch simultaneously with distinct focus areas:

| Agent                         | Domain           | Key Heuristics                               | Catches                                            |
| ----------------------------- | ---------------- | -------------------------------------------- | -------------------------------------------------- |
| **TypeScript/React Reviewer** | Type Safety      | "All `as Type` needs runtime guard"          | Unsafe assertions, missing guards, hook violations |
| **Security Sentinel**         | Auth & Injection | "All inputs are hostile"                     | XSS, CSRF, auth bypass, injection vectors          |
| **Architecture Strategist**   | System Design    | "Routes never call Prisma directly"          | DI violations, circular deps, layer boundaries     |
| **Performance Oracle**        | DB & Caching     | "Every loop is O(n) database calls"          | N+1 queries, missing indexes, cache misses         |
| **Code Simplicity Reviewer**  | Maintainability  | ">70% similar = consolidate"                 | Duplication, dead code, over-engineering           |
| **Data Integrity Guardian**   | Transactions     | "Check-then-act needs transaction with lock" | TOCTOU races, constraint gaps, unsafe operations   |

### Phase 3: Independent Analysis

Each agent performs targeted codebase analysis:

```
Agent Workflow:
├─ Search codebase using domain-specific grep/glob patterns
├─ Read identified source files
├─ Apply 50-200 domain heuristics
├─ Document findings with file paths, line numbers, severity
└─ Propose concrete solutions with acceptance criteria
```

**Example: Data Integrity Guardian Analysis**

```typescript
// Searches for check-then-act patterns
grep -r "findMany.*where.*{" server/src/
grep -r "\.count()" server/src/
grep -r "\.create(" server/src/
grep -r "booking\|booking\|payment" server/src/

// Applies heuristic: "Check-then-act without transaction = TOCTOU race"
// Finds in appointment-booking.service.ts:

const count = await this.repo.countByDate(tenantId, date); // CHECK
if (count >= this.maxPerDay) {
  throw new BookingLimitError();
}
await this.repo.create({ tenantId, date, ... }); // ACT - GAP HERE

// Severity: P1 (concurrent requests can exceed limit)
// Solution: Wrap in transaction with advisory lock
```

### Phase 4: Findings Synthesis & Deduplication

Results are consolidated using these operations:

```
Raw Findings (6 agents × 5-20 findings each)
│
├─ Collect all findings into unified set
├─ Deduplicate overlapping issues
│  (e.g., same bug found by 2 agents from different angles)
├─ Assign severity: P1 (blocks merge) | P2 (should fix) | P3 (nice-to-have)
├─ Categorize by tags: security, performance, data-integrity, architecture
└─ Produce canonical finding list
```

### Phase 5: Todo File Creation

Each finding becomes a actionable todo file:

**File Naming Convention:**

```
todos/{id}-pending-{priority}-{description}.md
```

**Examples from commit 5cd5bfb1:**

```
708-pending-p1-maxperday-toctou-race-condition.md
709-pending-p2-panelchat-unsafe-type-assertion.md
710-pending-p2-missingzod-validation-caching.md
711-pending-p2-messagebubble-component-duplication.md
712-pending-p2-proposalcard-duplication.md
714-pending-p3-xss-bypass-patterns-review.md
715-pending-p3-unused-type-exports-cleanup.md
```

**Todo File Structure:**

````markdown
---
status: pending
priority: p1 | p2 | p3
issue_id: '708'
tags: [data-integrity, transaction, booking]
dependencies: []
---

# maxPerDay TOCTOU Race Condition

## Problem Statement

The maxPerDay enforcement checks availability then creates booking without
atomic transaction. Concurrent requests bypass limit.

## Findings

- **File:** `server/src/services/appointment-booking.service.ts`
- **Lines:** 89-95
- **Evidence:**
  ```typescript
  const count = await this.repo.countByDate(tenantId, date);
  if (count >= this.maxPerDay) throw new BookingLimitError();
  await this.repo.create({ ... }); // Race window here
  ```
````

## Proposed Solution

Wrap in transaction with advisory lock:

```typescript
await prisma.$transaction(async (tx) => {
  const lockId = hashTenantDate(tenantId, date);
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(${lockId})`;

  const count = await tx.booking.count({
    where: { tenantId, date }
  });
  if (count >= this.maxPerDay) {
    throw new BookingLimitError();
  }
  await tx.booking.create({ data: { ... } });
});
```

## Acceptance Criteria

- [ ] Transaction wraps check + create
- [ ] Advisory lock acquired before count
- [ ] Lock held until commit
- [ ] Tests verify concurrent requests respected
- [ ] Typecheck passes

````

### Phase 6: Post-Review Actions

```bash
# 1. View all findings
ls todos/*-pending-*.md

# 2. Interactive triage (review, prioritize, approve)
/triage

# 3. Fix approved todos in parallel
/resolve_todo_parallel

# 4. Verify changes
npm run typecheck
npm test
````

## Why This Works: Key Insights

### 1. Specialized Domain Expertise

Each agent applies hundreds of domain-specific heuristics that a generalist would miss:

**Data Integrity Guardian Example:**

```typescript
// Heuristics: Check-then-act patterns
const patterns = [
  'count().then(create)', // Race condition
  'findUnique().then(create)', // Race condition
  'exists().then(delete)', // Race condition
  'check if true.then(update)', // Race condition without transaction
];

// Each pattern tested with: "Is it wrapped in transaction with lock?"
```

**Security Sentinel Example:**

```typescript
// Tests 7+ XSS bypass techniques
const xssPatterns = [
  htmlEncode('alert(1)'), // XSS via HTML entities
  String.fromCharCode(97, 108, 101), // Char code bypass
  String.raw`\u{61}\u{6c}\u{65}`, // Unicode bypass
  // ... 4 more variants
];
```

### 2. No Cognitive Load Sharing

Each agent has full context window dedicated to single domain, not split across all concerns.

### 3. Speed Through Parallelism

6 agents analyzing simultaneously = 6x speed of serial analysis.

### 4. Non-Overlapping Coverage

Agents designed to complement, not duplicate:

```
Security Sentinel          │ Focus: Auth, injection, XSS
Data Integrity Guardian    │ Focus: TOCTOU, constraints, transactions
Architecture Strategist    │ Focus: Layering, DI, patterns
TypeScript Reviewer        │ Focus: Type safety, assertions
Performance Oracle         │ Focus: N+1, caching, indexes
Code Simplicity Reviewer   │ Focus: Duplication, dead code
                           │
                           ↓ No overlap = comprehensive coverage
```

## Real-World Results

### Commit 5cd5bfb1 Review Session

**Input:** Complex feature branch with changes across booking, proposals, UI

**Findings Generated:**

| Priority | Count | Examples                                    | Found By                |
| -------- | ----- | ------------------------------------------- | ----------------------- |
| P1       | 1     | TOCTOU race in maxPerDay limit              | Data Integrity Guardian |
| P2       | 4     | Type assertion safety, duplication, caching | Multiple agents         |
| P3       | 3     | Unused exports, XSS patterns, optimization  | Multiple agents         |

**Key Discovery:**

The P1 TOCTOU race (critical data corruption risk) was found **only by Data Integrity Guardian**. Five other specialized agents (TypeScript, Security, Architecture, Performance, Simplicity) did not flag it. This demonstrates why parallel specialization is essential.

## Prevention Checklist

After multi-agent review completes, verify these patterns:

### TOCTOU Prevention

```markdown
- [ ] Check-then-act patterns wrapped in transaction?
- [ ] Advisory lock acquired for concurrent scenarios?
- [ ] Unique constraint as fallback for races?
```

### Type Safety

```markdown
- [ ] All `as Type` assertions have runtime validation?
- [ ] Zod schemas used for external data?
- [ ] Type guards used for discriminated unions?
```

### DRY / Architecture

```markdown
- [ ] Similar components abstracted with variants?
- [ ] Shared logic extracted to utils/hooks?
- [ ] Near-duplicate code consolidated?
- [ ] Routes don't call Prisma directly?
```

### Security

```markdown
- [ ] All inputs validated/escaped?
- [ ] Multi-tenant queries filter by tenantId?
- [ ] Rate limiting applied to auth endpoints?
- [ ] No sensitive data in logs?
```

## Integration with Compound Engineering

This workflow fits the compound engineering loop:

```
Plan → Work → Review ← YOU ARE HERE → Compound → Repeat
       ↑_______↓
    /workflows:review
   (6 parallel agents)
```

After fixing reviewed items:

```bash
# Capture learnings to prevent recurring issues
/workflows:compound

# Creates: docs/solutions/patterns/learned-prevention-strategy.md
```

## Quick Reference Commands

```bash
# Run review on specific commit
/workflows:review 5cd5bfb1

# Run review on PR
/workflows:review 123

# View all pending findings
ls todos/*-pending-*.md

# Triage findings (interactive)
/triage

# Fix all approved todos in parallel
/resolve_todo_parallel

# Verify fixes
npm run typecheck && npm test
```

## When to Use Multi-Agent Review

**USE THIS WORKFLOW FOR:**

- [x] Complex PRs with changes across 5+ files
- [x] Security-sensitive changes
- [x] Performance-critical paths
- [x] Multi-tenant features
- [x] Large refactors
- [x] Before production deploys
- [x] Monthly hygiene passes on main branch

**USE SIMPLER REVIEW FOR:**

- [ ] Single-file changes (1-2 files)
- [ ] Documentation updates
- [ ] Test additions
- [ ] Configuration changes
- [ ] Copy/content updates

## Agent Specialization Details

### TypeScript/React Reviewer

**Heuristics:**

- All `as Type` casts need runtime guard with type predicate
- React hooks must be called unconditionally at top level
- Never pass object spread `{...obj}` to Zod—causes type inference loss
- Missing error boundaries in async routes

**Catches:**

```typescript
// BAD: Unsafe cast
const data = response.data as User[]; // What if it's not an array?

// GOOD: Type guard
function isUserArray(data: unknown): data is User[] {
  return Array.isArray(data) && data.every(isUser);
}
const data = response.data;
if (!isUserArray(data)) throw new Error('Invalid response');
```

### Security Sentinel

**Heuristics:**

- All user inputs are hostile until proven safe
- SQL injection possible in raw queries
- XSS possible in innerHTML/dangerouslySetInnerHTML
- CSRF tokens missing from state-changing requests
- Rate limiting missing on auth endpoints

**Catches:**

```typescript
// BAD: Direct input to HTML
<div dangerouslySetInnerHTML={{ __html: userInput }} />

// GOOD: Sanitize or use text content
<div>{userInput}</div>  // Text always safe
// OR sanitize: DOMPurify.sanitize(userInput)
```

### Architecture Strategist

**Heuristics:**

- Repository interfaces required; no direct Prisma in routes
- Dependency injection container mandatory
- No circular imports (check with: `npx madge --circular`)
- Layer violation: Routes shouldn't import services from other routes
- Configuration hardcoded = architectural debt

**Catches:**

```typescript
// BAD: Route calls Prisma directly
router.get('/packages', async (req, res) => {
  const packages = await prisma.package.findMany(); // WRONG LAYER
});

// GOOD: Route calls service
router.get('/packages', async (req, res) => {
  const packages = await catalogService.getPackages(req.tenantId);
});
```

### Performance Oracle

**Heuristics:**

- Every database loop is O(n) until proven otherwise
- Missing indexes on frequently queried columns
- Cache invalidation scope too broad (invalidates entire cache vs. specific keys)
- N+1 queries in GraphQL-like scenarios
- Rendering lists without React.memo

**Catches:**

```typescript
// BAD: N+1 query pattern
const packages = await repo.findBySegment(segmentId);
for (const pkg of packages) {
  pkg.pricing = await repo.getPricing(pkg.id); // N queries
}

// GOOD: Single query with join
const packages = await repo.findBySegmentWithPricing(segmentId);
```

### Code Simplicity Reviewer

**Heuristics:**

- Components >70% similar = consolidate with variant
- Dead code (unused imports, functions, exports) removed
- Complexity >10 = extract to helper
- Copy-paste detected = extract to shared location
- Magic numbers replaced with named constants

**Catches:**

```typescript
// BAD: Duplicated button logic
<button className="px-4 py-2 bg-blue rounded">Save</button>
// ... later
<button className="px-4 py-2 bg-blue rounded">Create</button>

// GOOD: Single Button component
<Button>Save</Button>
<Button>Create</Button>
```

### Data Integrity Guardian

**Heuristics:**

- Check-then-act ALWAYS needs transaction + lock
- Unique constraints alone aren't sufficient for races
- Webhook deduplication must be database-based
- JSON field mutations need pessimistic locking
- Email/IDs must be normalized (case-insensitive)

**Catches:**

```typescript
// BAD: Race condition possible
const count = await repo.count({ where: { tenantId, date } });
if (count < limit) {
  await repo.create({ ... }); // Race window
}

// GOOD: Atomic transaction with lock
await prisma.$transaction(async (tx) => {
  const lock = await tx.$executeRaw`SELECT pg_advisory_xact_lock(${id})`;
  const count = await tx.count({ where: { tenantId, date } });
  if (count >= limit) throw new Error('Limit exceeded');
  await tx.create({ ... }); // Atomic
});
```

## Related Documentation

- **Full Workflow:** `docs/solutions/methodology/multi-agent-parallel-code-review-workflow-MAIS-20260109.md`
- **Quick Reference:** `docs/solutions/methodology/MULTI_AGENT_REVIEW_QUICK_REFERENCE.md` (2 min read—print & pin)
- **Prevention Strategies:** `docs/solutions/methodology/MULTI-AGENT-CODE-REVIEW-PREVENTION-STRATEGIES.md`
- **Parallel Todo Resolution:** `docs/solutions/methodology/parallel-todo-resolution-workflow.md`

## Conclusion

Multi-agent parallel code review combines **specialization, parallelism, and domain expertise** to catch issues that single-perspective reviews miss. The key insight: experts in different domains find completely different issues in the same code.

**Use before any significant merge to prevent technical debt accumulation.**

---

**Last Updated:** 2026-01-10
**Source Commits:** 5cd5bfb1
**Status:** Active, Proven Effective
