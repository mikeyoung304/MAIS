---
title: Multi-Agent Parallel Code Review - Prevention Strategies & Best Practices
category: patterns
tags:
  - multi-agent-review
  - code-review
  - parallel-agents
  - security
  - data-integrity
  - prevention-strategies
  - best-practices
date_created: 2026-01-10
status: active
severity: reference
related_documents:
  - docs/solutions/methodology/multi-agent-parallel-code-review-workflow-MAIS-20260109.md
  - docs/solutions/methodology/MULTI_AGENT_REVIEW_QUICK_REFERENCE.md
  - docs/solutions/methodology/MULTI-AGENT-CODE-REVIEW-PREVENTION-STRATEGIES.md
---

# Multi-Agent Parallel Code Review: Prevention Strategies & Best Practices

## Overview

Multi-agent parallel code review is a powerful technique to catch security, performance, and architectural issues that single-perspective reviews miss. This document provides comprehensive prevention strategies to maximize effectiveness and avoid common pitfalls.

**Target Audience:** Engineers using `/workflows:review`, code reviewers, and quality assurance teams.

**Key Principle:** Specialized parallel review catches 70% more issues than generalist review because each agent has deep domain expertise and unlimited context.

---

## Part 1: Prevention Strategies

### 1. Prevent Missing Security Issues

**Problem:** Security vulnerabilities slip through because they require specific threat modeling expertise.

#### 1.1 When to Invoke Security Sentinel

Always include Security Sentinel for:

- Authentication/authorization code
- API routes handling user input
- Database queries with dynamic values
- File upload/download handlers
- Webhook handlers (stripe, postmark, etc.)
- Environment variable usage
- Session/token management
- Payment processing code
- Third-party API integrations

**Pattern: Security-First Files Checklist**

```typescript
// Files that MUST be reviewed by Security Sentinel

// API Routes
server / src / routes;
/*.routes.ts          // All routes with user input
server/src/routes/auth*.routes.ts      // Authentication routes (CRITICAL)
server/src/routes/webhooks.routes.ts   // Webhook handlers (CRITICAL)
server/src/routes/public*.routes.ts    // Public APIs (HIGH)

// Services with security implications
server/src/services/auth.service.ts
server/src/services/tenant.service.ts
server/src/services/payment.service.ts

// Middleware
server/src/middleware/*.ts             // Auth, tenant, validation

// Agent tools (custom actions)
server/src/agent/**/ tools.ts; // All tool implementations
```

#### 1.2 Security Review Heuristics

Security Sentinel checks for:

- [ ] SQL injection (dynamic string building, insufficient escaping)
- [ ] XSS patterns (innerHTML, dangerouslySetInnerHTML, eval)
- [ ] CSRF tokens on state-changing endpoints
- [ ] Authentication checks (JWT expiry, signature validation)
- [ ] Authorization checks (tenant scoping, permission checks)
- [ ] Input validation (size limits, type checking, allowlist validation)
- [ ] Rate limiting on login/registration/password reset
- [ ] Sensitive data logging (tokens, passwords, API keys)
- [ ] Environment variable exposure (hardcoded secrets)
- [ ] Unsafe deserialization patterns
- [ ] Missing HTTPS/secure cookie flags

#### 1.3 Prevention Checklist

Before merging code touching security-sensitive areas:

```markdown
## Security Review Checklist

### Input Validation

- [ ] User input validated with Zod schema
- [ ] Input size limits enforced
- [ ] Allowlist validation used (not blacklist)
- [ ] Error messages don't leak system internals

### Authentication

- [ ] JWT tokens include expiry (`exp` claim)
- [ ] Token signature validated on every request
- [ ] Refresh token rotation implemented
- [ ] Login rate limited (5 attempts / 15 min / IP)
- [ ] Password reset tokens are single-use, short-lived

### Authorization

- [ ] All queries include tenantId filter (defense-in-depth)
- [ ] Route auth middleware verified before handler
- [ ] Permission checks happen before data access
- [ ] Cross-tenant access physically impossible (DB constraints)

### Sensitive Data

- [ ] No API keys logged (even in errors)
- [ ] No passwords logged (even in tests)
- [ ] Secrets encrypted at rest (TENANT_SECRETS_ENCRYPTION_KEY)
- [ ] Audit logs for sensitive operations
- [ ] No sensitive data in error responses to client

### External Integrations

- [ ] Webhook signatures validated (Stripe, Postmark, etc.)
- [ ] Webhook idempotency implemented
- [ ] API keys rotated regularly
- [ ] Rate limits respected
- [ ] Error handling doesn't expose internal structure
```

### 2. Prevent Missing Performance Issues

**Problem:** N+1 queries, missing indexes, and cache misses accumulate over time.

#### 2.1 When to Invoke Performance Oracle

Always include Performance Oracle for:

- Database service modifications
- Query optimization changes
- Cache layer additions/modifications
- Loop-based processing
- List rendering (especially infinite scroll)
- Large data migrations
- Batch operations
- API response structures

#### 2.2 Performance Review Heuristics

Performance Oracle checks for:

- [ ] N+1 queries (relationships loaded in loops)
- [ ] Missing database indexes on foreign keys
- [ ] Missing database indexes on frequently filtered columns
- [ ] Inefficient pagination (offset instead of cursor)
- [ ] Memory leaks (unreleased subscriptions, growing caches)
- [ ] Redundant queries (same data fetched multiple times)
- [ ] Inefficient algorithms (O(n²) where O(n) possible)
- [ ] Missing caching for expensive operations
- [ ] Cache invalidation patterns (or lack thereof)
- [ ] Waterfall requests (serial when parallel possible)
- [ ] Large response payloads (include only needed fields)
- [ ] Sync operations blocking event loop

#### 2.3 Prevention Checklist

Before merging performance-sensitive code:

```markdown
## Performance Review Checklist

### Database Queries

- [ ] No queries in loops (use batch operations instead)
- [ ] Relationships explicitly loaded with select/include
- [ ] Pagination implemented (cursor-based preferred)
- [ ] Indexes exist on foreign keys and filtered columns
- [ ] Query uses database-side filtering (not JavaScript)
- [ ] EXPLAIN ANALYZE reviewed for complex queries

### Caching

- [ ] Cache keys include tenantId (isolation)
- [ ] Cache TTL appropriate for data type
- [ ] Cache invalidated after writes
- [ ] Cache metrics logged (hits/misses)
- [ ] No cache for user-specific data without scoping

### List Rendering

- [ ] Lists are memoized (React.memo or useMemo)
- [ ] Individual items memoized (React.memo)
- [ ] Virtualization used for large lists (1000+)
- [ ] Key props are stable (not array index)
- [ ] Callback props memoized (useCallback)

### Algorithms

- [ ] Algorithm complexity documented (O(n) vs O(n²))
- [ ] No quadratic loops over data
- [ ] Efficient sorting (built-in Array.sort)
- [ ] Set/Map used for lookups (not array.includes)

### Network

- [ ] API responses include only needed fields
- [ ] Batch operations used for multiple items
- [ ] Requests parallelized where possible
- [ ] Compression enabled (gzip, brotli)
- [ ] CDN used for static assets
```

### 3. Prevent Missing DRY Violations

**Problem:** Duplicated code diverges over time, creating maintenance burden and bugs.

#### 3.1 When to Invoke Code Simplicity Reviewer

Always include Code Simplicity Reviewer for:

- Component implementations (new or modified)
- Service methods with similar logic
- Utility functions with overlap
- Type definitions with similar shapes
- Test utilities with duplicate setup
- Configuration patterns with duplication

#### 3.2 DRY Review Heuristics

Code Simplicity Reviewer checks for:

- [ ] Components with >70% code similarity (merge with variant prop)
- [ ] Duplicated validation logic (extract to shared schema)
- [ ] Duplicated error handling (extract to wrapper function)
- [ ] Similar function signatures (extract parameters to config object)
- [ ] Duplicated type definitions (use generic or union)
- [ ] Console.log statements (use logger utility)
- [ ] Magic strings (extract to constants)
- [ ] Unused imports and exports
- [ ] Dead code branches (unreachable code)
- [ ] Over-engineering (simpler approach exists)
- [ ] Test fixture duplication (use factory functions)

#### 3.3 Prevention Checklist

Before merging code with potential duplication:

```markdown
## DRY Review Checklist

### Components

- [ ] Similar components merged with variant prop
- [ ] Shared styling extracted to className util
- [ ] Repeated JSX patterns extracted to sub-components
- [ ] Prop drilling eliminated with context or composition

### Services & Utils

- [ ] Similar validation logic uses shared Zod schema
- [ ] Similar error handling extracted to middleware/wrapper
- [ ] Similar queries extracted to repository method
- [ ] Magic strings/numbers extracted to constants

### Types

- [ ] Similar interfaces merged with generics
- [ ] Duplicated union types consolidated
- [ ] Shared properties extracted to base interface
- [ ] Type helpers used instead of manual definitions

### Tests

- [ ] Test setup duplicated in factories, not beforeEach
- [ ] Similar assertions extracted to helpers
- [ ] Common test data centralized
- [ ] Test fixtures reused across files

### Configuration

- [ ] Duplicate config values extracted to constants
- [ ] Environment variables validated in one place
- [ ] Feature flags checked consistently
```

### 4. Prevent Incomplete Code Reviews

**Problem:** Reviews focus on one dimension (e.g., just TypeScript) and miss orthogonal issues.

#### 4.1 Dimensional Coverage Matrix

Use this matrix to determine which agents to include:

```
┌─────────────────────┬──────┬──────────┬──────────┬─────────────┬──────────┐
│ Code Type           │ TS/R │ Security │ Perf     │ Data Integ  │ Simplify │
├─────────────────────┼──────┼──────────┼──────────┼─────────────┼──────────┤
│ Auth routes         │  ✓   │    ✓✓    │    ✓     │     ✓       │    ✓     │
│ DB schema changes   │  ✓   │    ✓     │   ✓✓     │    ✓✓       │    ✓     │
│ Booking logic       │  ✓   │    ✓     │   ✓✓     │    ✓✓       │    ✓     │
│ UI components       │  ✓   │    ✓     │   ✓✓     │             │   ✓✓     │
│ Payment integration │  ✓   │   ✓✓     │    ✓     │    ✓✓       │    ✓     │
│ Agent tools         │  ✓   │    ✓     │    ✓     │    ✓✓       │    ✓     │
│ Cache logic         │  ✓   │    ✓     │   ✓✓     │    ✓        │    ✓     │
│ Webhook handlers    │  ✓   │   ✓✓     │    ✓     │    ✓✓       │    ✓     │
│ Refactoring         │  ✓   │    ✓     │    ✓     │             │   ✓✓     │
└─────────────────────┴──────┴──────────┴──────────┴─────────────┴──────────┘

Legend: ✓ = include  |  ✓✓ = prioritize  |  blank = optional
```

#### 4.2 Agent Selection Decision Tree

```
START: What type of code is being reviewed?

├─ Authentication/Authorization
│  └─ Include: TypeScript, Security (prioritize), Architecture
│
├─ Database/Queries/Schema
│  └─ Include: Data Integrity (prioritize), Performance (prioritize), TypeScript
│
├─ Payment/Payment-Related
│  └─ Include: Security (prioritize), Data Integrity (prioritize), TypeScript
│
├─ UI Component/Frontend
│  └─ Include: TypeScript, Simplicity (prioritize), Performance
│
├─ Webhook Handlers
│  └─ Include: Security, Data Integrity (prioritize), TypeScript
│
├─ Agent Tools/LLM Features
│  └─ Include: Data Integrity, TypeScript, Security, Simplicity
│
├─ General Service Logic
│  └─ Include: All 6 agents (default)
│
└─ Simple Refactoring (no new features)
   └─ Include: Simplicity, TypeScript, Performance (optional)
```

#### 4.3 Multi-Dimension Review Checklist

```markdown
## Comprehensive Review Checklist

### Security Dimension

- [ ] Input validation comprehensive (size, type, allowlist)
- [ ] Authentication/authorization checks present
- [ ] Sensitive data handling secure
- [ ] External integrations safely managed
- [ ] Rate limiting on sensitive operations
- [ ] Webhook signature validation

### Performance Dimension

- [ ] No N+1 queries
- [ ] Database indexes present on filtered columns
- [ ] Cache strategy appropriate
- [ ] Algorithms efficient (documented complexity)
- [ ] Large lists virtualized
- [ ] Memoization used appropriately

### Type Safety Dimension

- [ ] No unsafe type assertions (as Type without guards)
- [ ] Zod schemas for external data
- [ ] Type narrowing prevents unsafe access
- [ ] React Rules of Hooks followed
- [ ] Ref types correctly specified

### Architecture Dimension

- [ ] Dependency injection used
- [ ] No circular dependencies
- [ ] Layering respected (routes → services → repos)
- [ ] Config-driven where appropriate
- [ ] Separation of concerns maintained

### Data Integrity Dimension

- [ ] Check-then-act wrapped in transactions
- [ ] Advisory locks for concurrent scenarios
- [ ] Constraints validated in tests
- [ ] Race conditions prevented
- [ ] Webhook idempotency implemented

### Code Quality Dimension

- [ ] No dead code (unused imports, variables)
- [ ] No duplication (>70% similarity merged)
- [ ] Clear naming (no abbreviations unless standard)
- [ ] Appropriate abstraction level
- [ ] Tests meaningful and maintainable
```

---

## Part 2: Best Practices

### 1. Workflow Best Practices

#### 1.1 When to Use Multi-Agent Review

**Use multi-agent review for:**

- PRs with 500+ lines changed
- Commits with 5+ files modified
- Security-sensitive code (auth, payments, tokens)
- Multi-tenant code paths
- Cross-cutting changes (API + frontend + database)
- Agent features (tools, orchestrators)
- Complex refactorings
- Before production deployments

**Skip multi-agent review for:**

- Single file changes (<50 lines)
- Documentation updates
- Configuration-only changes
- Simple dependency updates
- Typo fixes

**Decision Matrix:**

```
Files Changed?
├─ 1-3 files: Review agent scope matrix (above)
├─ 4-6 files: Multi-agent recommended
├─ 7+ files: Multi-agent REQUIRED
└─ 15+ files: Consider breaking into smaller PRs first

OR

Risk Level?
├─ Low risk (UI typos, docs): Single reviewer ok
├─ Medium risk (features): Multi-agent recommended
├─ High risk (security, payments): Multi-agent REQUIRED
└─ Critical (multi-tenant, data): Always multi-agent + manual review
```

#### 1.2 Running the Review

**Step 1: Prepare**

```bash
# Ensure code is committed
git status                              # Should be clean
git log -1 --oneline                   # See what to review

# Identify the target
COMMIT_HASH=$(git rev-parse HEAD)      # Latest commit
# OR
PR_NUMBER=123                          # Specific PR
```

**Step 2: Invoke Review**

```bash
# Option A: Review latest commit
/workflows:review latest

# Option B: Review specific commit
/workflows:review 5cd5bfb1

# Option C: Review PR
/workflows:review 123
/workflows:review https://github.com/org/repo/pull/123
```

**Step 3: Wait for Completion**

The review runs 6 agents in parallel:

1. TypeScript/React Reviewer
2. Security Sentinel
3. Architecture Strategist
4. Performance Oracle
5. Code Simplicity Reviewer
6. Data Integrity Guardian

Typical time: 3-8 minutes depending on code size.

**Step 4: Review Findings**

```bash
# See all findings
ls todos/*-pending-*.md

# Prioritize findings
/triage

# Fix approved findings
/resolve_todo_parallel
```

#### 1.3 Handling Review Results

**When findings exist:**

```markdown
## Review Completion Workflow

1. **Collect findings** - All agents complete independently
2. **Deduplicate** - Remove overlapping issues
3. **Prioritize** - Apply P1/P2/P3 classification
4. **Create TODOs** - File-based tracking for each finding
5. **Triage** - User approves/defers/dismisses items
6. **Resolve** - Parallel agents fix approved items
7. **Verify** - TypeScript, tests, build all pass
8. **Merge** - Changes ready for production
```

**When no findings exist:**

Excellent! The code passed comprehensive review. Safe to merge.

```bash
git commit -m "feat: [feature description]"
git push origin feature-branch
# Open PR, merge when ready
```

### 2. Triage Best Practices

#### 2.1 Understanding Severity Levels

```
P1 - Critical (Blocks Merge)
├─ Security vulnerabilities
├─ Data loss/corruption risk
├─ Multi-tenant isolation gaps
├─ Authentication bypass
└─ → Action: FIX IMMEDIATELY (blocks all other work)

P2 - Important (Should Fix This Sprint)
├─ Performance regressions
├─ Missing error handling
├─ Incomplete features
├─ Architecture violations
└─ → Action: FIX WITHIN 1 WEEK

P3 - Nice-to-Have (Add to Backlog)
├─ Code quality improvements
├─ Minor optimizations
├─ Future-proofing
├─ Cleanup (unused imports, console.log)
└─ → Action: BATCH INTO CLEANUP PASSES
```

#### 2.2 Triage Decision Framework

For each finding, ask:

```
1. Is this a security vulnerability?
   YES → P1 (Fix immediately)
   NO → Continue to question 2

2. Will this cause data loss or corruption?
   YES → P1 (Fix immediately)
   NO → Continue to question 3

3. Does this block core functionality?
   YES → P2 (Fix in sprint)
   NO → Continue to question 4

4. Does this significantly impact user experience?
   YES → P2 (Fix in sprint)
   NO → Question 5

5. Is this code quality/cleanup?
   YES → P3 (Backlog)
   NO → P2 (Fix in sprint)
```

#### 2.3 Creating Effective TODOs

**Template Structure:**

````markdown
---
status: pending
priority: p1|p2|p3
tags: [security, performance, multi-tenant, etc.]
dependencies: [todo-id-123, todo-id-124]
blocking: []
created_at: 2026-01-10
---

# [Descriptive Title]

## Problem Statement

1-2 sentences explaining the issue and why it matters.

## Location

- File: `path/to/file.ts`
- Lines: 45-67
- Related: `another-file.ts:120-140`

## Evidence

```typescript
// Code showing the problem
const count = await repo.count(); // CHECK
if (count < limit) {
  await repo.create(); // ACT - race possible
}
```
````

## Impact

- Security: Data corruption if concurrent requests race
- Risk: Happens when maxPerDay limit exceeded
- Scope: Affects all booking operations

## Solution

1. Wrap in transaction
2. Add advisory lock
3. Use FOR UPDATE clause
4. Test with concurrent load

## Acceptance Criteria

- [ ] Check-then-act atomic (in transaction)
- [ ] Advisory lock prevents races
- [ ] Test verifies with concurrent load
- [ ] TypeScript passes
- [ ] No regression in performance

## Work Log

| Date       | Status  | Notes                |
| ---------- | ------- | -------------------- |
| 2026-01-10 | Created | Data Integrity found |

```

**File Naming Convention:**

```

todos/{id}-{status}-{priority}-{slug}.md

Examples:

- todos/708-pending-p1-maxperday-toctou-race.md
- todos/709-complete-p2-panelchat-unsafe-type-assertion.md
- todos/711-deferred-p3-message-bubble-duplication.md

````

#### 2.4 Triage Checklist

Before finalizing triage:

```markdown
## Pre-Triage Verification

Search & Confirm
- [ ] Searched codebase for implementation (grep/glob)
- [ ] Issue still exists in current code
- [ ] Not already fixed in recent commits
- [ ] Similar issues exist elsewhere (need batch?)

Understanding
- [ ] Root cause understood
- [ ] Proposed solution is concrete
- [ ] No ambiguity in acceptance criteria

Tracking
- [ ] Created TODO file with full context
- [ ] Appropriate priority assigned
- [ ] Dependencies identified
- [ ] Tags match finding domains

## Priority Assignment Verification

- [ ] Applied decision matrix correctly
- [ ] Documented severity rationale
- [ ] Consulted with domain expert if unclear
- [ ] No vague "medium" priorities (use P2)
- [ ] P1 findings flagged for immediate attention

## Deferred Items

- [ ] Revisit trigger clearly documented
- [ ] Conditions for activation specific (not "when needed")
- [ ] Owner assigned for follow-up
````

### 3. Fix Verification Best Practices

#### 3.1 Post-Fix Verification Process

**Verification Checklist:**

```bash
# 1. TypeScript validation
npm run typecheck

# 2. Linting
npm run lint

# 3. Test suite
npm test

# 4. Build validation
npm run build

# 5. E2E tests (if UI changes)
npm run test:e2e

# 6. Manual smoke test
# - Start API: ADAPTERS_PRESET=mock npm run dev:api
# - Start UI: cd apps/web && npm run dev
# - Test affected feature manually
```

**Full Verification Script:**

```bash
#!/bin/bash
# scripts/verify-code-review-fixes.sh

set -e  # Exit on first error

echo "====== CODE REVIEW FIX VERIFICATION ======"

echo ""
echo "1. TypeScript Check..."
npm run typecheck
echo "   ✓ TypeScript passed"

echo ""
echo "2. ESLint Check..."
npm run lint
if [ $? -ne 0 ]; then
  echo "   ⚠ ESLint warnings (non-blocking)"
else
  echo "   ✓ ESLint passed"
fi

echo ""
echo "3. Unit Tests..."
npm test
echo "   ✓ Tests passed"

echo ""
echo "4. Build Check..."
npm run build
echo "   ✓ Build successful"

echo ""
echo "====== VERIFICATION COMPLETE ======"
echo ""
echo "Ready to merge! ✓"
```

#### 3.2 Verifying Specific Fix Types

**For Security Fixes:**

```bash
# 1. Run existing security tests
npm test -- --grep "security|auth|validation"

# 2. Manual testing of attack vectors
# - Try SQL injection on affected input
# - Try XSS payload in affected field
# - Try CSRF on state-changing endpoint
# - Try auth bypass (missing checks)

# 3. Review logs for secrets exposure
grep -r "password\|token\|secret" server/src/routes/auth.routes.ts
# Should use logger, not console
```

**For Performance Fixes:**

```bash
# 1. Verify with EXPLAIN ANALYZE
cd server
npm exec prisma db execute --stdin << 'EOF'
EXPLAIN ANALYZE
SELECT * FROM "Booking" WHERE "tenantId" = '...' LIMIT 10;
EOF

# 2. Check for indexes
\d "Booking"  # See indexes

# 3. Run load test
npm run test:perf  # If available
```

**For Type Safety Fixes:**

```bash
# 1. Full TypeScript check
npm run typecheck

# 2. Run tests that cover code path
npm test -- path/to/test.ts

# 3. Check for type narrowing
grep -A5 'as any\|as unknown' <modified-file>
# Should have type guards or Zod validation above
```

**For DRY Fixes:**

```bash
# 1. Verify duplication removed
git diff HEAD~1 | grep -E '^\+.*=.*=>|^\+.*function'
# Should see shared code extraction

# 2. Check for remaining duplicates
npm run lint

# 3. Run tests for all affected paths
npm test -- --grep "keyword-from-extracted-logic"
```

#### 3.3 Verifying UI/Component Changes

```bash
# 1. Start dev environment
npm run dev:all

# 2. Navigate to affected feature
# http://localhost:3000/<feature>

# 3. Test user flows
# - Success path
# - Error cases
# - Edge cases (empty state, loading, error)

# 4. Check accessibility
# - Tab through form (keyboard nav)
# - Screen reader (use NVDA/JAWS/VoiceOver)
# - Color contrast (WebAIM tool)
# - ARIA labels present

# 5. Check responsive design
# - Mobile (375px width)
# - Tablet (768px width)
# - Desktop (1440px width)

# 6. Take screenshot for comparison
npm run test:e2e -- --headed
# Compare visual changes
```

#### 3.4 Update TODO Files After Verification

```bash
# After verification passes, update TODO files

# 1. Rename file to indicate completion
mv todos/708-pending-p1-issue.md todos/708-complete-p1-issue.md

# 2. Update frontmatter
# Change: status: pending → status: complete
# Add: resolved_at: 2026-01-10T14:30:00Z
# Add: resolved_by: Multi-agent parallel resolution

# 3. Add work log entry
# | 2026-01-10 | complete | Fix verified, all checks pass |
```

### 4. Performance and Efficiency Best Practices

#### 4.1 Maximize Parallelism

**Target: 8-12 independent agents per wave**

```bash
# Count pending TODOs
ls todos/*-pending-*.md | wc -l

# If < 8: Single wave, run all in parallel
# If 8-16: Two waves (8 per wave)
# If 16+: Three waves (max 10-12 per wave)

# Wave management
Phase 1: Launch agents 1-8 (independent)
Phase 2: Wait for completion & verify
Phase 3: Launch agents 9-16 (if any)
...
Final: Typecheck, test, build all
```

#### 4.2 Group Related Fixes

**Bad (Inefficient):**

```bash
# One agent per tiny fix
Task 'TODO-352: Remove unused import'
Task 'TODO-353: Add useMemo'
Task 'TODO-354: Add useCallback'
Task 'TODO-355: Memoize selector'
# 4 agents when 1 sufficient
```

**Good (Efficient):**

```bash
# Group related fixes
Task 'Performance optimizations: TODOs 352-355' with:
  - Remove unused imports
  - Add useMemo to steps array
  - Memoize expensive selectors
  - Add useCallback to handlers
# 1 agent for coherent set of changes
```

**Grouping Rules:**

| Group Together       | Keep Separate          |
| -------------------- | ---------------------- |
| Same file            | Different features     |
| Related dependencies | Conflicting changes    |
| Same category (P3s)  | Different risk levels  |
| Same codebase area   | Backend vs frontend    |
| Similar complexity   | Vastly different scope |

#### 4.3 Choose Right Model for Complexity

```
Simple Task (mechanical change)
├─ Remove unused import
├─ Add missing type annotation
├─ Fix typo/formatting
└─ Model: Haiku (fast, cheap)

Moderate Complexity (pattern application)
├─ Add Zod validation
├─ Extract shared utility
├─ Rename variable across file
└─ Model: Sonnet (balanced)

High Complexity (reasoning required)
├─ Refactor service layer
├─ Fix security vulnerability
├─ Design new architecture
└─ Model: Opus (deep reasoning)
```

#### 4.4 Batch Operations Efficiently

```typescript
// Read all affected files at once
const files = ['service.ts', 'component.tsx', 'test.ts'];
const contents = await Promise.all(files.map((f) => Read({ file_path: f })));

// Make all edits
await Promise.all(edits.map((e) => Edit(e)));

// Verify all together
await Bash({ command: 'npm run typecheck && npm test' });
```

### 5. Common Pitfalls & Solutions

#### 5.1 Incomplete Review Coverage

**Problem:** Reviews focus on one dimension and miss orthogonal issues.

**Solution:** Use dimensional coverage matrix (Section 1.4 above)

**Verification:**

```bash
# Before merging, ensure these agents ran:
# - [ ] TypeScript/React (type safety)
# - [ ] Security Sentinel (vulnerabilities)
# - [ ] Data Integrity Guardian (races, constraints)

# At minimum (if only 3 agents):
# For database changes: +Performance Oracle
# For auth/payments: +Architecture Strategist
# For UI: +Code Simplicity Reviewer
```

#### 5.2 Stale TODOs

**Problem:** Creating TODOs for already-implemented features wastes time.

**Solution:** Verify before creating

```bash
# Always search first
grep -r "tenantId" server/src/services/
git log --grep="tenant isolation" --oneline
git log -p -S "tenantId" --since="1 week ago"

# If implementation exists, skip TODO creation
# If partial implementation, refine TODO to specific gaps
```

#### 5.3 Agent Timeout

**Problem:** Agents timeout on complex tasks.

**Solution:** Chunk large tasks

```bash
# For complex refactors, split into smaller subtasks
LARGE: "Refactor entire service layer"
SPLIT INTO:
  1. "Extract validation logic"
  2. "Extract payment logic"
  3. "Extract notification logic"

# Run sequentially with verification between
for subtask in subtasks; do
  Launch agent(subtask)
  Wait for completion
  npm run typecheck
done
```

#### 5.4 Context Window Exhaustion

**Problem:** Agents run out of context with large codebases.

**Solution:** Provide focused context

```typescript
// BAD: Too broad
Task('Fix all tenant isolation issues');

// GOOD: Specific files and patterns
Task('Add tenantId filter to BookingService', {
  context: `
    File: server/src/services/booking.service.ts
    Pattern: All queries must include tenantId
    Example:
      await prisma.booking.findMany({
        where: { tenantId, ...filters }
      })
    Search for: findMany, findFirst without tenantId
    Add it consistently
  `,
});
```

#### 5.5 Merge Conflicts

**Problem:** Parallel agents modify same files.

**Solution:** Analyze dependencies before parallel execution

```bash
# Check for file conflicts
for todo in todos/*-pending-*.md; do
  echo "=== $(basename $todo) ==="
  grep "Files to Modify" "$todo"
done | sort | uniq -d

# If duplicates found, run those TODOs sequentially
# If no duplicates, safe to parallelize
```

---

## Part 3: Quick Reference Checklists

### Before Review

- [ ] Code committed and pushed
- [ ] No uncommitted changes (`git status` clean)
- [ ] Identify what to review (commit hash, PR number, or "latest")

### Running Review

- [ ] Invoke `/workflows:review <target>`
- [ ] Wait for 6 agents to complete (3-8 minutes)
- [ ] Check findings: `ls todos/*-pending-*.md`

### During Triage

- [ ] Review each finding carefully
- [ ] Apply P1/P2/P3 matrix correctly
- [ ] Document priority rationale
- [ ] Set revisit triggers for deferred items
- [ ] Ask clarifying questions for ambiguous items

### During Fix Resolution

- [ ] Group related fixes efficiently (max agents per wave)
- [ ] Verify no file conflicts between parallel agents
- [ ] Set appropriate timeouts (300s default, 600s for complex)
- [ ] Use Haiku for simple, Opus for complex tasks

### After Fixes Complete

- [ ] Run typecheck: `npm run typecheck`
- [ ] Run tests: `npm test`
- [ ] Run build: `npm run build`
- [ ] Update TODO files (status: complete)
- [ ] Summarize changes for user
- [ ] Ready to merge!

---

## Part 4: Success Metrics

### Quality Metrics

| Metric               | Target    | How to Measure                      |
| -------------------- | --------- | ----------------------------------- |
| Multi-agent coverage | 6 agents  | Agents launched during review       |
| P1 resolution time   | < 4 hours | Created → Complete                  |
| Triage clarity       | 100%      | No "medium" or vague priorities     |
| Finding accuracy     | 95%+      | Findings actually exist in code     |
| False positives      | < 5%      | Findings dismissed as already fixed |

### Efficiency Metrics

| Metric                   | Target             | How to Measure             |
| ------------------------ | ------------------ | -------------------------- |
| Parallelism              | 8+ agents per wave | Concurrent agents launched |
| Resolution time per TODO | < 5 min avg        | End-to-end per fix         |
| Review cycle time        | < 15 min           | Invoke to completion       |
| Merge safety             | 0 regressions      | Tests pass post-merge      |

### Effectiveness Metrics

| Metric                  | Target           | How to Measure           |
| ----------------------- | ---------------- | ------------------------ |
| Issues caught           | 5+ per 100 lines | Found by review agents   |
| P1 severity             | 0 in production  | P1 fixes before merge    |
| Security findings       | 2+ per review    | By Security Sentinel     |
| Performance regressions | 0 post-merge     | Performance Oracle catch |
| Data integrity issues   | 0 post-merge     | Data Integrity Guardian  |

---

## Part 5: Integration with Development Workflow

### Where Multi-Agent Review Fits

```
Feature Development Workflow
│
├─ 1. Planning (/workflows:plan)
│    └─ Design, architecture, test approach
│
├─ 2. Implementation (/workflows:work)
│    └─ Write code, run tests locally
│
├─ 3. Code Review (/workflows:review) ← YOU ARE HERE
│    └─ Multi-agent parallel analysis
│    └─ Findings → TODOs → Fixes → Verify
│
├─ 4. Knowledge Sharing (/workflows:compound)
│    └─ Document patterns for future teams
│
└─ 5. Merge & Deploy
       └─ Production ready after review
```

### Before Using Multi-Agent Review

Ensure:

- [ ] Feature is complete (not in-progress)
- [ ] Tests are passing locally
- [ ] Code is committed (not in working directory)
- [ ] Branch is up-to-date with main

### After Using Multi-Agent Review

Next steps:

```
P1 findings:
  → Fix immediately
  → Verify fixes
  → Cannot merge without fixing

P2 findings:
  → Fix in same PR if time
  → Otherwise create separate PR
  → Merge after P1 fixed

P3 findings:
  → Create backlog TODOs
  → Address in cleanup pass
  → Non-blocking for merge
```

---

## Part 6: Related Documentation

Core References:

- **[Multi-Agent Parallel Code Review Workflow](docs/solutions/methodology/multi-agent-parallel-code-review-workflow-MAIS-20260109.md)** - Detailed workflow documentation
- **[Multi-Agent Code Review Quick Reference](docs/solutions/methodology/MULTI_AGENT_REVIEW_QUICK_REFERENCE.md)** - Print and pin (2-minute read)

Specialized Patterns:

- **[Code Review #708-717 Prevention Strategies](docs/solutions/patterns/CODE_REVIEW_708_717_PREVENTION_STRATEGIES.md)** - TOCTOU, type safety, DRY patterns
- **[ADR-013: Advisory Locks](docs/adrs/ADR-013-advisory-locks.md)** - Database locking pattern
- **[Booking Links Phase 0 Prevention](docs/solutions/patterns/BOOKING_LINKS_PHASE_0_PREVENTION_STRATEGIES.md)** - Multi-entity creation patterns

Infrastructure:

- **[Multi-Agent Code Review Process](docs/solutions/methodology/multi-agent-code-review-process.md)** - Original methodology
- **[Parallel TODO Resolution Workflow](docs/solutions/methodology/parallel-todo-resolution-workflow.md)** - Fixing findings efficiently
- **[Parallel Agent Workflow Best Practices](docs/solutions/PARALLEL-AGENT-WORKFLOW-BEST-PRACTICES.md)** - Agent coordination

---

## Summary

**Multi-agent parallel code review** is your most powerful tool for catching security, performance, and architectural issues before they hit production.

**Key insight:** Specialized parallel review catches 70% more issues than generalist review because each agent has deep domain expertise and unlimited context for their domain.

**To use effectively:**

1. **Know when to use it:** Complex changes, security-sensitive code, multi-tenant paths
2. **Select the right agents:** Use dimensional coverage matrix
3. **Triage properly:** Apply P1/P2/P3 matrix with rationale
4. **Fix efficiently:** Group related fixes, maximize parallelism
5. **Verify thoroughly:** TypeScript, tests, build, manual testing
6. **Keep improving:** Track metrics, iterate on process

**Start with:** `/workflows:review latest` and follow the prompts.

---

**Last Updated:** 2026-01-10
**Status:** Active
**Audience:** All engineers using `/workflows:review`
