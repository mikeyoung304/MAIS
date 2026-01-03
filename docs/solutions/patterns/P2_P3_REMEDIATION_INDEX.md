# P2/P3 Remediation Prevention - Complete Index

**Commit:** 0ce7eac1 (P2/P3 remediation - validation, tests, lazy config, mock helper, index)
**Date:** 2026-01-02
**Status:** Complete - 5 issues fixed with prevention strategies

---

## Overview

This index organizes comprehensive prevention strategies for the 5 P2/P3 issues fixed in commit 0ce7eac1. Each issue now has:

- **Problem description** with code examples
- **Code review checklist** with specific items to verify
- **ESLint rules** to catch issues automatically
- **Test patterns** to validate prevention
- **Implementation guide** for rolling out to your team

---

## The 5 Issues Fixed

| Issue | Title                         | Severity | Prevention                            |
| ----- | ----------------------------- | -------- | ------------------------------------- |
| #612  | Missing Input Validation      | P2       | Zod schemas + boundary tests          |
| #613  | Test Coverage Gaps            | P2       | Exported function test requirement    |
| #614  | Env Variable Load-Time Issues | P2       | Lazy evaluation via factory functions |
| #615  | Inconsistent Mock Patterns    | P3       | `createMockPrisma()` shared helper    |
| #616  | Missing Database Indexes      | P3       | Index comments + mapping docs         |

---

## Quick Start (5 minutes)

1. **For Code Reviews:** Read [Quick Reference](./P2_P3_REMEDIATION_QUICK_REFERENCE.md) (print-friendly, 2 pages)
2. **For Developers:** Bookmark [Quick Reference](./P2_P3_REMEDIATION_QUICK_REFERENCE.md) for daily use
3. **For Team Leads:** See [Implementation Guide](./P2_P3_IMPLEMENTATION_GUIDE.md) (6-phase rollout plan)
4. **For DevOps:** Use [ESLint Rules](./P2_P3_ESLINT_RULES.md) in CI/CD pipelines

---

## Document Guide

### 1. P2_P3_REMEDIATION_QUICK_REFERENCE.md (7.6 KB)

**Best for:** Code reviews, print-friendly, quick lookup

**Contents:**

- 5-issue overview with code examples
- What to check for each issue
- Common mistakes to avoid
- Prevention checklist (single page)

**Use when:**

- Reviewing PRs (print it, keep on desk)
- Onboarding team members (1-page reference)
- Quick lookup during coding (bookmark it)

**Key sections:**

- Issue 1-5 quick guides
- Danger signs to watch for
- Common mistake table
- 30-second decision tree for each issue

### 2. P2_P3_REMEDIATION_PREVENTION_STRATEGIES.md (46 KB)

**Best for:** Deep understanding, implementation patterns, testing

**Contents:**

- Detailed explanation of each issue
- Real code examples (before/after)
- Complete code review checklists
- ESLint rule concepts
- Test pattern implementations with full code

**Use when:**

- Building the prevention system
- Creating test patterns
- Training team members on why issues matter
- Writing documentation for your team
- Understanding specific code examples

**Key sections:**

- Issue #1: Input validation (Zod patterns, boundary tests)
- Issue #2: Test coverage (coverage templates, integration tests)
- Issue #3: Env variables (lazy evaluation, test isolation)
- Issue #4: Mocking (shared helper, type safety)
- Issue #5: Database indexes (query mapping, EXPLAIN ANALYZE)
- Summary checklist
- Resource links

### 3. P2_P3_ESLINT_RULES.md (17 KB)

**Best for:** Developers implementing automated checks, CI/CD engineers

**Contents:**

- 5 complete ESLint rule implementations (copy-paste ready)
- Integration instructions
- GitHub Actions workflow
- Usage examples
- Configuration templates

**Use when:**

- Setting up automated linting
- Integrating prevention into CI/CD
- Customizing rules for your team
- Troubleshooting lint configuration

**Key sections:**

- Rule 1: no-module-scope-env (Issue #3)
- Rule 2: require-zod-validation (Issue #1)
- Rule 3: require-mock-helper (Issue #4)
- Rule 4: require-index-comment (Issue #5)
- Rule 5: require-test-file (Issue #2)
- Complete ESLint config
- GitHub Actions integration

### 4. P2_P3_IMPLEMENTATION_GUIDE.md (14 KB)

**Best for:** Team leads, implementing the prevention system systematically

**Contents:**

- 6-phase implementation plan
- Timeline (1-4 weeks)
- Onboarding strategy
- Success metrics
- Troubleshooting
- Migration path for existing code

**Use when:**

- Rolling out prevention to your team
- Planning the implementation
- Training team members
- Measuring success
- Fixing common issues

**Key sections:**

- Phase 1: Code review checklists (30 min)
- Phase 2: ESLint rules (1 hour)
- Phase 3: Test patterns (1-2 hours)
- Phase 4: Index documentation (30 min)
- Phase 5: CI/CD integration (30 min)
- Phase 6: Team onboarding (ongoing)
- Success metrics & KPIs
- Troubleshooting guide
- Migration path for large codebases

---

## How to Use This Index

### I'm a Code Reviewer

1. **First time:** Read [Quick Reference](./P2_P3_REMEDIATION_QUICK_REFERENCE.md) (5 min)
2. **Daily use:** Print quick reference and keep at desk
3. **Deep dive:** Read [Prevention Strategies](./P2_P3_REMEDIATION_PREVENTION_STRATEGIES.md) section for issue you're reviewing
4. **Implementation:** Reference [Implementation Guide](./P2_P3_IMPLEMENTATION_GUIDE.md) phase 1 (code review checklists)

**Typical review workflow:**

```
PR comes in → Check quick reference → Look for danger signs → Reference full guide if complex
```

### I'm a Developer

1. **Setup:** Read [Quick Reference](./P2_P3_REMEDIATION_QUICK_REFERENCE.md)
2. **Daily coding:** Bookmark quick reference, refer when writing code
3. **Learning:** Read relevant sections in [Prevention Strategies](./P2_P3_REMEDIATION_PREVENTION_STRATEGIES.md)
4. **When tests fail:** Check test patterns in [Prevention Strategies](./P2_P3_REMEDIATION_PREVENTION_STRATEGIES.md) → Pattern 1-4

**Typical development workflow:**

```
Write code → Check quick reference → Run linter → Review test patterns → Submit PR
```

### I'm a Team Lead

1. **Week 1:**
   - Read [Implementation Guide](./P2_P3_IMPLEMENTATION_GUIDE.md) fully
   - Review [Quick Reference](./P2_P3_REMEDIATION_QUICK_REFERENCE.md) with team
   - Share [ESLint Rules](./P2_P3_ESLINT_RULES.md) with DevOps

2. **Week 2-4:**
   - Execute Phase 1-3 from [Implementation Guide](./P2_P3_IMPLEMENTATION_GUIDE.md)
   - Fix existing violations
   - Train team on new patterns

3. **Ongoing:**
   - Monitor metrics from [Implementation Guide](./P2_P3_IMPLEMENTATION_GUIDE.md) section "Measuring Success"
   - Adjust rules as needed
   - Share learnings with team

**Typical leadership workflow:**

```
Review implementation guide → Assign phases → Coordinate implementation → Monitor metrics → Adjust rules
```

### I'm a DevOps Engineer

1. **Setup:** Read [ESLint Rules](./P2_P3_ESLINT_RULES.md)
2. **Implementation:** Copy rule files and config template
3. **CI/CD:** Add GitHub Actions workflow from [Implementation Guide](./P2_P3_IMPLEMENTATION_GUIDE.md) Phase 5
4. **Monitoring:** Track metrics from [Implementation Guide](./P2_P3_IMPLEMENTATION_GUIDE.md)

**Typical DevOps workflow:**

```
Copy ESLint rules → Add to CI/CD → Configure GitHub Actions → Monitor violations → Adjust thresholds
```

---

## Issue-by-Issue Guide

### Issue #612: Missing Input Validation

**Quick Lookup:**

- Quick Reference: "Issue 1: Missing Input Validation"
- Prevention Strategies: "Issue #1: Missing Input Validation"
- ESLint Rule: `require-zod-validation`

**Key Points:**

- All user inputs need Zod schemas with constraints
- String fields need `.min()` and `.max()`
- Number fields need `.min()` and `.max()`
- Tests must cover boundary cases

**Implementation Steps:**

1. Add Zod schema to contracts
2. Create validation boundary tests
3. Enable `require-zod-validation` ESLint rule
4. Test with invalid inputs

**Reference Code:**

```typescript
// From review-queue.ts (commit 0ce7eac1)
export const ReviewSubmissionSchema = z.object({
  reviewedBy: z.string().min(1).max(100),
  notes: z.string().max(2000),
  correctEvalScore: z.number().min(0).max(10).optional(),
  actionTaken: z.enum(['none', 'approve', 'reject', 'escalate', 'retrain']),
});
```

---

### Issue #613: Test Coverage Gaps

**Quick Lookup:**

- Quick Reference: "Issue 2: Test Coverage Gaps"
- Prevention Strategies: "Issue #2: Test Coverage Gaps"
- ESLint Rule: `require-test-file`

**Key Points:**

- Every exported function needs tests
- All branches must be tested (if/else/try/catch)
- Async error paths must be tested
- Coverage should be >80%

**Implementation Steps:**

1. Generate coverage report: `npm run test:coverage`
2. Add tests for untested functions
3. Test all branches using coverage report as guide
4. Enable `require-test-file` ESLint rule

**Reference Code:**

```typescript
// From pipeline.test.ts (commit 0ce7eac1)
describe('cleanupPendingEvaluations', () => {
  it('should trigger drain when pending > 50', async () => {
    mockPrisma.conversationTrace.count.mockResolvedValue(51);
    const drainSpy = vi.spyOn(pipeline, 'drainCompleted');
    await cleanupPendingEvaluations(mockPrisma);
    expect(drainSpy).toHaveBeenCalled();
  });

  it('should not drain when pending <= 50', async () => {
    mockPrisma.conversationTrace.count.mockResolvedValue(50);
    const drainSpy = vi.spyOn(pipeline, 'drainCompleted');
    await cleanupPendingEvaluations(mockPrisma);
    expect(drainSpy).not.toHaveBeenCalled();
  });
});
```

---

### Issue #614: Environment Variable Load-Time Issues

**Quick Lookup:**

- Quick Reference: "Issue 3: Environment Variable Load-Time Issues"
- Prevention Strategies: "Issue #3: Environment Variable Load-Time Issues"
- ESLint Rule: `no-module-scope-env`

**Key Points:**

- Never read `process.env` at module scope
- Read env in functions/constructors (at call time)
- Tests use `vi.stubEnv()` for isolation
- Each test can override env independently

**Implementation Steps:**

1. Find all module-scope `process.env` reads
2. Move to factory functions
3. Update constructors to use factory functions
4. Update tests to use `vi.stubEnv()`
5. Enable `no-module-scope-env` ESLint rule

**Reference Code:**

```typescript
// From evaluator.ts (commit 0ce7eac1)
// BEFORE
const DEFAULT_CONFIG = {
  model: process.env.EVAL_MODEL || 'default',
};

// AFTER
function getDefaultConfig(): EvaluatorConfig {
  return {
    model: process.env.EVAL_MODEL || DEFAULT_EVAL_MODEL,
    maxTokens: 2048,
    temperature: 0.1,
    timeoutMs: 30000,
  };
}
```

---

### Issue #615: Inconsistent Mock Patterns

**Quick Lookup:**

- Quick Reference: "Issue 4: Inconsistent Mock Patterns"
- Prevention Strategies: "Issue #4: Inconsistent Mock Patterns"
- ESLint Rule: `require-mock-helper`

**Key Points:**

- Use `createMockPrisma()` helper for all tests
- Never use `as any` casts for mocks
- All mocks should use `mockDeep<PrismaClient>()`
- `$transaction` must be pre-configured

**Implementation Steps:**

1. Create `test/helpers/mock-prisma.ts` (provided in Prevention Strategies)
2. Update all test files to import from helper
3. Replace manual mocks with `createMockPrisma()`
4. Enable `require-mock-helper` ESLint rule

**Reference Code:**

```typescript
// From mock-prisma.ts (commit 0ce7eac1)
export function createMockPrisma(): DeepMockProxy<PrismaClient> {
  const mock = mockDeep<PrismaClient>();
  mock.$transaction.mockImplementation(async (callback) => {
    if (typeof callback === 'function') {
      return callback(mock as unknown as Parameters<typeof callback>[0]);
    }
    return [];
  });
  return mock;
}

// Usage in tests
const mockPrisma = createMockPrisma();
mockPrisma.conversationTrace.findMany.mockResolvedValue([]);
```

---

### Issue #616: Missing Database Indexes

**Quick Lookup:**

- Quick Reference: "Issue 5: Missing Database Indexes"
- Prevention Strategies: "Issue #5: Missing Database Indexes"
- ESLint Rule: `require-index-comment`

**Key Points:**

- Complex queries (2+ WHERE conditions) need index comments
- Indexes must exist in Prisma schema
- EXPLAIN ANALYZE should verify index usage
- Index comments should explain which queries use them

**Implementation Steps:**

1. Document all indexes in `schema.prisma` with comments
2. Add `// Uses index: [columns]` comments above queries
3. Run EXPLAIN ANALYZE on new queries
4. Add integration tests for index performance
5. Enable `require-index-comment` ESLint rule

**Reference Code:**

```typescript
// From schema.prisma (commit 0ce7eac1)
model AgentProposal {
  // ... fields ...

  // Used by: cleanup.ts drainCompleted() - status=EXPIRED + expiresAt < now
  @@index([expiresAt])
  @@index([status, expiresAt])

  // Used by: cleanup.ts orphanedProposals() - status=CONFIRMED + updatedAt < now
  // P3-616: Added this index for orphan recovery performance
  @@index([status, updatedAt])

  @@index([tenantId])
  @@index([customerId])
}

// In code:
// Uses index: [status, updatedAt]
const orphaned = await prisma.agentProposal.findMany({
  where: {
    status: 'CONFIRMED',
    updatedAt: { lt: orphanCutoff },
  },
  take: 100,
});
```

---

## Related Documentation

### In This Project

- `server/src/agent/feedback/review-queue.ts` - Issue #612 fix
- `server/test/agent-eval/pipeline.test.ts` - Issue #613 fix
- `server/src/agent/evals/evaluator.ts` - Issue #614 fix
- `server/test/helpers/mock-prisma.ts` - Issue #615 fix
- `server/prisma/schema.prisma` - Issue #616 fix

### In Docs

- [MAIS Prevention Strategies Index](./PREVENTION_STRATEGIES_INDEX.md) - All prevention docs
- [MAIS Critical Patterns](./MAIS_CRITICAL_PATTERNS.md) - 10 critical patterns to follow
- [ts-rest Any Type Library Limitations](../best-practices/ts-rest-any-type-library-limitations-MAIS-20251204.md) - When `as any` is OK

### External

- [Zod Documentation](https://zod.dev) - Input validation
- [Vitest Documentation](https://vitest.dev) - Testing patterns
- [vitest-mock-extended](https://github.com/eratio08/vitest-mock-extended) - Type-safe mocking
- [Prisma Indexes](https://www.prisma.io/docs/concepts/components/prisma-schema/indexes) - Database indexing
- [ESLint Custom Rules](https://eslint.org/docs/rules/) - ESLint rule creation

---

## Checklists

### Code Review Checklist (for all 5 issues)

```
VALIDATION (Issue #612)
- [ ] POST/PUT endpoints have Zod schemas
- [ ] String fields have .min() and .max()
- [ ] Number fields have .min() and .max()
- [ ] Enum fields use z.enum()
- [ ] Tests cover boundary cases (min, max, invalid)

TEST COVERAGE (Issue #613)
- [ ] npm run test:coverage shows >80%
- [ ] All exported functions have tests
- [ ] All branches tested (if/else, try/catch)
- [ ] Async error paths tested
- [ ] Test names describe behavior

ENV VARIABLES (Issue #614)
- [ ] No process.env at module scope
- [ ] Config in functions/constructors
- [ ] Tests use vi.stubEnv() for isolation
- [ ] Each test can override env independently
- [ ] No global config mutations

MOCKING (Issue #615)
- [ ] All mocks use createMockPrisma()
- [ ] No as any casts for Prisma mocks
- [ ] mockDeep<PrismaClient>() used consistently
- [ ] $transaction callback configured
- [ ] Mocks reset between tests

DATABASE INDEXES (Issue #616)
- [ ] Complex queries have // Uses index: [columns] comments
- [ ] Composite indexes exist in schema.prisma
- [ ] Composite indexes listed in correct order
- [ ] EXPLAIN ANALYZE run for new queries
- [ ] Integration tests verify index performance
```

### Implementation Checklist (for team leads)

```
PHASE 1: Code Review Checklists (30 min)
- [ ] Print and post Quick Reference
- [ ] Update PR template with checklist
- [ ] Share code review instructions with team

PHASE 2: ESLint Rules (1 hour)
- [ ] Copy 5 rule files from ESLint Rules doc
- [ ] Update .eslintrc.json
- [ ] Run npm run lint to test
- [ ] Fix existing violations

PHASE 3: Test Patterns (1-2 hours)
- [ ] Create test/helpers/mock-prisma.ts
- [ ] Update all tests to use helper
- [ ] Set coverage threshold to >80%
- [ ] Add coverage check to CI/CD

PHASE 4: Index Documentation (30 min)
- [ ] Document all indexes in schema.prisma
- [ ] Create QUERY_INDEX_MAPPING.md
- [ ] Create checklist for new queries

PHASE 5: CI/CD Integration (30 min)
- [ ] Create GitHub Actions workflow
- [ ] Add required status checks
- [ ] Test workflow with sample PR

PHASE 6: Team Onboarding (ongoing)
- [ ] Share all 4 documents with team
- [ ] Create example PRs for each issue
- [ ] Weekly reminders in standup
- [ ] Monthly review of metrics
```

---

## Quick Command Reference

```bash
# Check for violations
npm run lint
npm run lint -- --rule 'no-module-scope-env: error'
npm run test:coverage

# Check specific issue
npm run lint -- --rule 'require-zod-validation: warn'

# Generate coverage report
npm run test:coverage -- --reporter=coverage-report

# Database query analysis
# EXPLAIN ANALYZE SELECT * FROM "AgentProposal" WHERE status='CONFIRMED' AND "updatedAt" < now() LIMIT 100;

# Check for untested exports
grep -r "export" src/ | grep -v ".test.ts"
```

---

## Success Stories from the Fix

The original fixes in commit 0ce7eac1:

- **454 new test lines** added for pipeline.test.ts (Issue #613)
- **100 character limit** enforced on `reviewedBy` field (Issue #612)
- **2000 character limit** enforced on `notes` field (Issue #612)
- **Lazy evaluation** implemented for EVAL_MODEL (Issue #614)
- **Type-safe mock helper** created for 100% test consistency (Issue #615)
- **Index added** for 30-minute orphan recovery performance (Issue #616)

---

## Still Have Questions?

1. **Quick lookup:** Check [Quick Reference](./P2_P3_REMEDIATION_QUICK_REFERENCE.md)
2. **Detailed info:** Check [Prevention Strategies](./P2_P3_REMEDIATION_PREVENTION_STRATEGIES.md)
3. **Implementation:** Check [Implementation Guide](./P2_P3_IMPLEMENTATION_GUIDE.md)
4. **Technical details:** Check [ESLint Rules](./P2_P3_ESLINT_RULES.md)

---

## Version History

| Date       | Update  | Details                                                    |
| ---------- | ------- | ---------------------------------------------------------- |
| 2026-01-02 | Initial | Created all 5 prevention strategy documents + ESLint rules |

---

## Document Statistics

| Document              | Size      | Pages  | Read Time  |
| --------------------- | --------- | ------ | ---------- |
| Quick Reference       | 7.6 KB    | 2      | 5 min      |
| Prevention Strategies | 46 KB     | 15     | 20 min     |
| ESLint Rules          | 17 KB     | 8      | 10 min     |
| Implementation Guide  | 14 KB     | 7      | 15 min     |
| **Total**             | **85 KB** | **32** | **50 min** |

---

**Last Updated:** 2026-01-02 | **Status:** Complete | **Compliance:** 5/5 issues covered
