---
title: Multi-Agent Parallel Code Review Guide
category: methodology
tags:
  - multi-agent-review
  - code-review
  - parallel-agents
  - security
  - data-integrity
  - compound-engineering
date_created: 2026-01-10
consolidated_from: 25 original documents
status: active
---

# Multi-Agent Parallel Code Review Guide

**Comprehensive guide for running effective multi-agent code reviews.**

---

## Table of Contents

1. [Overview](#overview)
2. [The 6 Specialized Agents](#the-6-specialized-agents)
3. [When to Use Multi-Agent Review](#when-to-use-multi-agent-review)
4. [Running a Review](#running-a-review)
5. [Agent Selection Matrix](#agent-selection-matrix)
6. [Triage & Priority Classification](#triage--priority-classification)
7. [Fix Verification](#fix-verification)
8. [Prevention Strategies](#prevention-strategies)
9. [Common Mistakes to Avoid](#common-mistakes-to-avoid)
10. [Performance Optimization](#performance-optimization)
11. [Integration with Compound Engineering](#integration-with-compound-engineering)

---

## Overview

Multi-agent parallel code review deploys **6 specialized review agents simultaneously**, each with deep domain expertise. This approach catches issues that single-perspective reviews miss.

### The Key Insight

**Specialized parallel review catches 70% more issues than generalist review** because each agent applies domain-specific heuristics that a generalist would miss or deprioritize.

**Example:** In commit 5cd5bfb1, the Data Integrity Guardian found a P1 TOCTOU race condition that five other specialized agents (TypeScript, Security, Architecture, Performance, Simplicity) did not flag.

### Why It Works

1. **Domain Expertise Depth** - Each agent applies 50-200 domain-specific heuristics
2. **No Cognitive Load Sharing** - Each agent has full context window for their domain
3. **Speed Through Parallelism** - 6 agents = 6x faster than serial analysis
4. **Non-Overlapping Coverage** - Agents designed to complement, not duplicate

---

## The 6 Specialized Agents

| Agent                         | Domain           | Key Heuristic                                | Catches                                            |
| ----------------------------- | ---------------- | -------------------------------------------- | -------------------------------------------------- |
| **TypeScript/React Reviewer** | Type Safety      | "All `as Type` needs runtime guard"          | Unsafe assertions, missing guards, hook violations |
| **Security Sentinel**         | Auth & Injection | "All inputs are hostile"                     | XSS, CSRF, auth bypass, injection vectors          |
| **Architecture Strategist**   | System Design    | "Routes never call Prisma directly"          | DI violations, circular deps, layer boundaries     |
| **Performance Oracle**        | DB & Caching     | "Every loop is O(n) database calls"          | N+1 queries, missing indexes, cache misses         |
| **Code Simplicity Reviewer**  | Maintainability  | ">70% similar = consolidate"                 | Duplication, dead code, over-engineering           |
| **Data Integrity Guardian**   | Transactions     | "Check-then-act needs transaction with lock" | TOCTOU races, constraint gaps, unsafe operations   |

### Agent Details

#### TypeScript/React Reviewer

**Heuristics:**

- All `as Type` casts need runtime guard with type predicate
- React hooks must be called unconditionally at top level
- Never pass object spread `{...obj}` to Zod - causes type inference loss
- Missing error boundaries in async routes

**Example issue:**

```typescript
// BAD: Unsafe cast
const data = response.data as User[];

// GOOD: Type guard
function isUserArray(data: unknown): data is User[] {
  return Array.isArray(data) && data.every(isUser);
}
const data = response.data;
if (!isUserArray(data)) throw new Error('Invalid response');
```

#### Security Sentinel

**Heuristics:**

- All user inputs are hostile until proven safe
- SQL injection possible in raw queries
- XSS possible in innerHTML/dangerouslySetInnerHTML
- CSRF tokens missing from state-changing requests
- Rate limiting missing on auth endpoints
- Sensitive data in logs (tokens, passwords, API keys)

**Example issue:**

```typescript
// BAD: Direct input to HTML
<div dangerouslySetInnerHTML={{ __html: userInput }} />

// GOOD: Sanitize or use text content
<div>{userInput}</div>
```

#### Architecture Strategist

**Heuristics:**

- Repository interfaces required; no direct Prisma in routes
- Dependency injection container mandatory
- No circular imports (check with `npx madge --circular`)
- Layer violations: Routes shouldn't import services from other routes
- Configuration hardcoded = architectural debt

**Example issue:**

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

#### Performance Oracle

**Heuristics:**

- Every database loop is O(n) until proven otherwise
- Missing indexes on frequently queried columns
- Cache invalidation scope too broad
- N+1 queries in relationship loading
- Rendering lists without React.memo

**Example issue:**

```typescript
// BAD: N+1 query pattern
const packages = await repo.findBySegment(segmentId);
for (const pkg of packages) {
  pkg.pricing = await repo.getPricing(pkg.id); // N queries
}

// GOOD: Single query with join
const packages = await repo.findBySegmentWithPricing(segmentId);
```

#### Code Simplicity Reviewer

**Heuristics:**

- Components >70% similar = consolidate with variant
- Dead code (unused imports, functions, exports) removed
- Complexity >10 = extract to helper
- Copy-paste detected = extract to shared location
- Magic numbers replaced with named constants

#### Data Integrity Guardian

**Heuristics:**

- Check-then-act ALWAYS needs transaction + lock
- Unique constraints alone aren't sufficient for races
- Webhook deduplication must be database-based
- JSON field mutations need pessimistic locking
- Email/IDs must be normalized (case-insensitive)

**Example issue:**

```typescript
// BAD: Race condition possible
const count = await repo.count({ where: { tenantId, date } });
if (count < limit) {
  await repo.create({ ... }); // Race window
}

// GOOD: Atomic transaction with lock
await prisma.$transaction(async (tx) => {
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(${lockId})`;
  const count = await tx.count({ where: { tenantId, date } });
  if (count >= limit) throw new Error('Limit exceeded');
  await tx.create({ ... }); // Atomic
});
```

---

## When to Use Multi-Agent Review

### Use For

- PRs with 500+ lines changed
- Commits with 5+ files modified
- Security-sensitive code (auth, payments, tokens)
- Multi-tenant code paths
- Cross-cutting changes (API + frontend + database)
- Agent features (tools, orchestrators)
- Complex refactorings
- Before production deployments
- Monthly hygiene passes on main branch

### Skip For

- Single file changes (<50 lines)
- Documentation updates
- Configuration-only changes
- Simple dependency updates
- Typo fixes

### Decision Matrix

```
Files Changed?
├─ 1-3 files: Review agent scope matrix
├─ 4-6 files: Multi-agent recommended
├─ 7+ files: Multi-agent REQUIRED
└─ 15+ files: Consider breaking into smaller PRs first

Risk Level?
├─ Low risk (UI typos, docs): Single reviewer ok
├─ Medium risk (features): Multi-agent recommended
├─ High risk (security, payments): Multi-agent REQUIRED
└─ Critical (multi-tenant, data): Multi-agent + manual review
```

---

## Running a Review

### Step 1: Prepare

```bash
# Ensure code is committed
git status                    # Should be clean
git log -1 --oneline         # See what to review
```

### Step 2: Invoke

```bash
/workflows:review latest              # Current branch
/workflows:review 5cd5bfb1            # Specific commit
/workflows:review 123                 # PR number
/workflows:review https://github.com/org/repo/pull/123  # Full URL
```

### Step 3: Wait (3-8 minutes)

6 agents analyze in parallel. Each agent:

1. Searches codebase using targeted grep/glob patterns
2. Reads identified source files
3. Applies domain-specific heuristics
4. Documents findings with file paths, line numbers, severity
5. Proposes concrete solutions with acceptance criteria

### Step 4: Review Findings

```bash
ls todos/*-pending-*.md     # View all findings
/triage                     # Prioritize them
```

### Step 5: Fix & Verify

```bash
/resolve_todo_parallel      # Parallel fix agents
npm run typecheck && npm test  # Verify fixes
```

---

## Agent Selection Matrix

Use this matrix to determine which agents to include:

```
Code Type                 → Required Agents
─────────────────────────────────────────────
Auth routes               → Security ✓✓, TypeScript ✓, Architecture ✓
DB schema changes         → Data Integrity ✓✓, Performance ✓✓, TypeScript ✓
Booking logic             → Data Integrity ✓✓, Performance ✓✓, Security ✓
Payment code              → Security ✓✓, Data Integrity ✓✓, TypeScript ✓
UI components             → TypeScript ✓, Simplicity ✓✓, Performance ✓
Agent tools               → Data Integrity ✓, TypeScript ✓, Security ✓
Cache/queries             → Performance ✓✓, Data Integrity ✓, TypeScript ✓
Webhook handlers          → Security ✓✓, Data Integrity ✓✓, TypeScript ✓
Refactoring               → Simplicity ✓✓, TypeScript ✓, Performance ✓

Legend: ✓ = include  |  ✓✓ = prioritize
```

### Agent Selection Decision Tree

```
START: What type of code is being reviewed?

├─ Authentication/Authorization
│  └─ Include: TypeScript, Security (prioritize), Architecture

├─ Database/Queries/Schema
│  └─ Include: Data Integrity (prioritize), Performance (prioritize), TypeScript

├─ Payment/Payment-Related
│  └─ Include: Security (prioritize), Data Integrity (prioritize), TypeScript

├─ UI Component/Frontend
│  └─ Include: TypeScript, Simplicity (prioritize), Performance

├─ Webhook Handlers
│  └─ Include: Security, Data Integrity (prioritize), TypeScript

├─ Agent Tools/LLM Features
│  └─ Include: Data Integrity, TypeScript, Security, Simplicity

├─ General Service Logic
│  └─ Include: All 6 agents (default)

└─ Simple Refactoring
   └─ Include: Simplicity, TypeScript, Performance (optional)
```

---

## Triage & Priority Classification

### Priority Levels

| Priority | Definition                               | SLA       | Action                     |
| -------- | ---------------------------------------- | --------- | -------------------------- |
| **P1**   | Security vuln, data corruption, critical | < 4 hours | **BLOCKS MERGE** - Fix now |
| **P2**   | Performance, UX gaps, architecture       | < 1 week  | Should fix this sprint     |
| **P3**   | Code quality, optimization               | Backlog   | Batch into cleanup pass    |

### Priority Decision Tree

```
Is it a security vulnerability?
  YES → P1

Does it cause data loss or corruption?
  YES → P1

Does it block core functionality?
  YES → P2

Does it significantly impact user experience?
  YES → P2

Is it code quality/cleanup?
  YES → P3

Otherwise → P2
```

### TODO File Template

**File Naming Convention:**

```
todos/{id}-{status}-{priority}-{description}.md
```

**Template:**

````markdown
---
status: pending
priority: p1 | p2 | p3
issue_id: 'XXX'
tags: [security, performance, data-integrity, etc.]
dependencies: []
created_at: 2026-01-10
---

# [Descriptive Title]

## Problem Statement

1-2 sentences explaining the issue and why it matters.

## Location

- File: `path/to/file.ts`
- Lines: 45-67

## Evidence

```typescript
// Code showing the problem
```
````

## Impact

- What breaks if not fixed

## Solution

1. Step-by-step fix

## Acceptance Criteria

- [ ] Criterion 1
- [ ] Tests pass
- [ ] TypeScript passes

````

### Triage Checklist

Before finalizing triage:

```markdown
## Pre-Triage Verification
- [ ] Searched codebase for existing implementation
- [ ] Verified issue still exists in current code
- [ ] Not already fixed in recent commits
- [ ] Root cause understood
- [ ] Proposed solution is concrete

## Priority Assignment
- [ ] Applied P1/P2/P3 decision matrix correctly
- [ ] Documented severity rationale
- [ ] Created TODO file with full context
- [ ] Dependencies identified
````

---

## Fix Verification

### Post-Fix Verification Checklist

```bash
npm run typecheck      # TypeScript validation
npm run lint          # Code style
npm test              # Unit & integration tests
npm run build         # Production build
# Manual smoke test   # Use the feature
```

### Verification Script

```bash
#!/bin/bash
set -e

echo "=== CODE REVIEW FIX VERIFICATION ==="

echo "1. TypeScript Check..."
npm run typecheck

echo "2. ESLint Check..."
npm run lint

echo "3. Unit Tests..."
npm test

echo "4. Build Check..."
npm run build

echo "=== VERIFICATION COMPLETE ==="
echo "Ready to merge!"
```

### Specific Fix Type Verification

**For Security Fixes:**

```bash
npm test -- --grep "security|auth|validation"
# Manual: Try attack vectors (SQL injection, XSS, CSRF)
```

**For Performance Fixes:**

```bash
# Verify with EXPLAIN ANALYZE
cd server
npm exec prisma db execute --stdin << 'EOF'
EXPLAIN ANALYZE SELECT * FROM "Booking" WHERE "tenantId" = '...' LIMIT 10;
EOF
```

**For Type Safety Fixes:**

```bash
npm run typecheck
grep -A5 'as any\|as unknown' <modified-file>
# Should have type guards or Zod validation above
```

### Update TODO Files After Verification

```bash
# Rename file to indicate completion
mv todos/708-pending-p1-issue.md todos/708-complete-p1-issue.md

# Update frontmatter: status: pending → status: complete
# Add: resolved_at: 2026-01-10T14:30:00Z
# Add work log entry
```

---

## Prevention Strategies

### TOCTOU Prevention Checklist

```markdown
- [ ] Check-then-act patterns wrapped in transaction?
- [ ] Advisory lock acquired for concurrent scenarios?
- [ ] Unique constraint as fallback for races?
```

**Pattern:**

```typescript
await prisma.$transaction(async (tx) => {
  const lockId = hashTenantDate(tenantId, date);
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(${lockId})`;

  const count = await tx.booking.count({ where: { tenantId, date } });
  if (count >= this.maxPerDay) throw new BookingLimitError();

  await tx.booking.create({ data: { ... } });
});
```

### Type Safety Checklist

```markdown
- [ ] All `as Type` assertions have runtime validation?
- [ ] Zod schemas used for external data?
- [ ] Type guards used for discriminated unions?
```

### Security Checklist

```markdown
- [ ] All inputs validated/escaped?
- [ ] Multi-tenant queries filter by tenantId?
- [ ] Rate limiting applied to auth endpoints?
- [ ] No sensitive data in logs?
- [ ] Webhook signatures validated?
```

### DRY Checklist

```markdown
- [ ] Similar components abstracted with variants?
- [ ] Shared logic extracted to utils/hooks?
- [ ] Near-duplicate code consolidated?
- [ ] Routes don't call Prisma directly?
```

### Tenant Isolation Verification

For each query, ask:

```
1. Does this query filter by tenantId? → YES or add it
2. Are all foreign keys verified? → YES or add verifyOwnership()
3. Are errors generic (no IDs leaked)? → YES or use ErrorMessages
```

**Pattern:**

```typescript
// ALWAYS include tenantId in mutations
await tx.service.updateMany({
  where: { id: serviceId, tenantId }, // Defense-in-depth
  data: updateData,
});
```

---

## Common Mistakes to Avoid

### Mistake 1: Incomplete Dimensional Coverage

**Problem:** Review focuses on one dimension (just TypeScript) and misses orthogonal issues.

**Solution:** Use agent selection matrix. Before merging, verify these agents ran:

- TypeScript/React (always)
- Security Sentinel (if auth, input, external API)
- Data Integrity Guardian (if database, check-then-act)
- Performance Oracle (if queries, loops, caching)
- Code Simplicity (always)

### Mistake 2: Skipping P1 Findings

**Problem:** P1 findings get treated as "nice-to-have" or deferred.

**Solution:** P1 = Blocks Merge. Full stop. Fix before merging.

### Mistake 3: Running Review on Incomplete Code

**Problem:** Half-finished code, failing tests, running review anyway.

**Solution:** Pre-review checklist:

```bash
npm test           # All tests pass
npm run typecheck  # No errors
git status         # Clean (nothing uncommitted)
```

### Mistake 4: Not Grouping Related Fixes

**Problem:** Each finding becomes separate agent task = inefficiency.

**Bad:**

```bash
Task 'TODO-352: Remove unused import'
Task 'TODO-353: Add useMemo'
Task 'TODO-354: Add useCallback'
# 3 agents when 1 sufficient
```

**Good:**

```bash
Task 'Performance optimizations (TODOs 352-354)' with:
  - Remove unused imports
  - Add useMemo to steps
  - Add useCallback to handlers
# 1 agent, coherent changes
```

### Mistake 5: Creating Stale TODOs

**Problem:** Creating findings for already-implemented features.

**Solution:** Always search before creating:

```bash
grep -r "tenantId" server/src/services/booking.service.ts
git log --grep="tenant isolation" --oneline
```

### Mistake 6: Merging Without Smoke Test

**Problem:** Code passes typecheck and tests but breaks in actual usage.

**Solution:** 3-5 minute manual smoke test:

- Happy path works
- Error handling works
- Related features not broken

### Mistake 7: Not Updating TODO Status

**Problem:** Fixes implemented but TODO files still show "pending".

**Solution:** After verification:

```bash
mv todos/708-pending-p1-issue.md todos/708-complete-p1-issue.md
git commit -m "Update TODO statuses"
```

---

## Performance Optimization

### Maximize Parallelism

**Target: 8-12 independent agents per wave**

```bash
# Count pending TODOs
ls todos/*-pending-*.md | wc -l

# If < 8: Single wave, run all in parallel
# If 8-16: Two waves
# If 16+: Three waves
```

### Group Related Fixes

| Group Together          | Keep Separate         |
| ----------------------- | --------------------- |
| Same file               | Different features    |
| Same component/service  | Conflicting changes   |
| Same category (all P3s) | Different risk levels |
| Related dependencies    | Backend vs frontend   |

### Choose Right Model

```
Simple Task (remove import, fix typo)
└─ Model: Haiku (fast, cheap)

Moderate Complexity (add validation, extract utility)
└─ Model: Sonnet (balanced)

High Complexity (refactor service, fix security vuln)
└─ Model: Opus (deep reasoning)
```

### Batch Operations

```typescript
// Read all affected files at once
const files = ['service.ts', 'component.tsx', 'test.ts'];
const contents = await Promise.all(files.map((f) => Read({ file_path: f })));

// Make all edits
await Promise.all(edits.map((e) => Edit(e)));

// Verify all together
await Bash({ command: 'npm run typecheck && npm test' });
```

---

## Integration with Compound Engineering

This workflow fits the compound engineering loop:

```
Plan → Work → Review → Compound → Repeat
              ↑
         YOU ARE HERE
```

### After Review Completes

```bash
# 1. Fix all P1 findings (blocks merge)
/resolve_todo_parallel

# 2. Verify fixes
npm run typecheck && npm test

# 3. Capture learnings for future
/workflows:compound

# 4. Merge
git push
```

---

## Quick Reference Commands

```bash
# Run review
/workflows:review latest
/workflows:review 5cd5bfb1
/workflows:review 123

# View findings
ls todos/*-pending-*.md

# Triage findings
/triage

# Fix approved todos
/resolve_todo_parallel

# Verify fixes
npm run typecheck && npm test && npm run build
```

---

## Success Metrics

### Quality Metrics

| Metric               | Target    |
| -------------------- | --------- |
| Multi-agent coverage | 6 agents  |
| P1 resolution time   | < 4 hours |
| Finding accuracy     | 95%+      |
| False positives      | < 5%      |

### Efficiency Metrics

| Metric              | Target    |
| ------------------- | --------- |
| Parallelism         | 8+ agents |
| Resolution per TODO | < 5 min   |
| Review cycle time   | < 15 min  |
| Merge safety        | 0 regress |

---

## Related Documentation

- **Quick Reference:** `docs/solutions/methodology/MULTI_AGENT_REVIEW_QUICK_REFERENCE.md` (print & pin)
- **ADR-013:** `docs/adrs/ADR-013-advisory-locks.md` - TOCTOU locking pattern
- **Code Review Patterns:** `docs/solutions/patterns/CODE_REVIEW_708_717_PREVENTION_STRATEGIES.md`

---

**Last Updated:** 2026-01-10
**Consolidated from:** 25 original multi-agent review documents
**Status:** Active
