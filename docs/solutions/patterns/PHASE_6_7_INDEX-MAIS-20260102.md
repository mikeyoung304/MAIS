---
module: MAIS
type: index
date: 2026-01-02
read_time: 3 minutes
---

# Phase 6-7 Prevention Strategies - Complete Index

**Navigate the Phase 6-7 remediation documentation. All 6 P2 issues fixed. 4 core patterns documented.**

---

## Quick Navigation

### I Have 30 Seconds

**Read this:** Quick Reference

- File: `PHASE_6_7_QUICK_REFERENCE-MAIS-20260102.md`
- Time: 3 minutes
- Use: During code reviews

### I'm Reviewing a PR

**Follow this:** 2-Minute Code Review Checklist

- File: `PHASE_6_7_QUICK_REFERENCE-MAIS-20260102.md` (Checklist section)
- Pattern detection tools included
- Common review comments provided

### I'm Writing Similar Code

**Study this:** Full Prevention Strategies

- File: `PHASE_6_7_PREVENTION_STRATEGIES-MAIS-20260102.md`
- Time: 25 minutes
- Content: Detailed explanations, examples, testing patterns
- Best for: Understanding when and why to apply each pattern

### I'm Setting Up Automation

**Follow this:** ESLint Rules & CI Integration

- File: `PHASE_6_7_ESLINT_RULES-MAIS-20260102.md`
- Time: 15 minutes (advanced)
- Difficulty: ⭐⭐⭐ (not required, optional automation)
- Rollout: Week 1-3 phased approach

---

## The 4 Patterns

### Pattern 1: Missing tenantId in Queries

**Severity:** P0 Security

**What It Is:**
Database queries missing tenant ID filter, creating data isolation vulnerability

**Where It Happens:**

- Multi-tenant queries (count, find, update operations)
- Any Prisma query without WHERE clause scoping

**How to Spot It:**

```typescript
where: { id: { in: [...] }, flagged: true }  // ❌ Missing tenantId
```

**How to Fix It:**

```typescript
where: { tenantId, id: { in: [...] }, flagged: true }  // ✅
```

**Read More:**

- Quick: `PHASE_6_7_QUICK_REFERENCE-MAIS-20260102.md#pattern-1`
- Full: `PHASE_6_7_PREVENTION_STRATEGIES-MAIS-20260102.md#pattern-1`
- Example: `server/scripts/run-eval-batch.ts:214`

**Issue:** 603

---

### Pattern 2: Invalid CLI Input Without Validation

**Severity:** P1 Security

**What It Is:**
CLI arguments parsed manually without validation, allowing invalid input

**Where It Happens:**

- CLI scripts with custom argument parsing
- Scripts without Zod or similar validation

**How to Spot It:**

```typescript
options.tenantId = arg.split('=')[1]?.trim(); // ❌ No validation
```

**How to Fix It:**

```typescript
const schema = z.string().uuid();
const result = schema.safeParse(value);
if (!result.success) process.exit(1); // ✅
```

**Read More:**

- Quick: `PHASE_6_7_QUICK_REFERENCE-MAIS-20260102.md#pattern-2`
- Full: `PHASE_6_7_PREVENTION_STRATEGIES-MAIS-20260102.md#pattern-2`
- Example: `server/scripts/run-eval-batch.ts:90-96`

**Issues:** 606, 608

---

### Pattern 3: Duplicated DI Initialization Code

**Severity:** P2 Code Quality

**What It Is:**
Same initialization code repeated in mock and real mode (or multiple places)

**Where It Happens:**

- `server/src/di.ts` (especially mock vs real sections)
- Any initialization code appearing 2+ times

**How to Spot It:**

```typescript
// Mock mode (lines 304-310)
if (process.env.ANTHROPIC_API_KEY) {
  const evaluator = createEvaluator();
  // ... 12 identical lines ...
}

// Real mode (lines 735-746) - SAME CODE
if (process.env.ANTHROPIC_API_KEY) {
  const evaluator = createEvaluator(); // Duplicate
  // ... 12 identical lines ...
}
```

**How to Fix It:**

```typescript
function buildEvaluationServices(prisma, mode) {
  const evaluator = createEvaluator();
  // ... all logic here ...
  return { evaluator, pipeline, reviewQueue, reviewActions };
}

const evaluation = buildEvaluationServices(mockPrisma, 'mock');
const evaluation = buildEvaluationServices(prisma, 'real');
```

**Read More:**

- Quick: `PHASE_6_7_QUICK_REFERENCE-MAIS-20260102.md#pattern-3`
- Full: `PHASE_6_7_PREVENTION_STRATEGIES-MAIS-20260102.md#pattern-3`
- Example: `server/src/di.ts:92-112`

**Issue:** 605

---

### Pattern 4: Silent Test Skips

**Severity:** P2 Testing Reliability

**What It Is:**
Tests silently pass when they should skip, hiding test failures

**Where It Happens:**

- Conditional test bodies with early returns
- Tests that depend on database state/migrations

**How to Spot It:**

```typescript
it('should isolate', async () => {
  if (!tableExists) return; // ❌ Silent skip - test passes!
});
```

**How to Fix It:**

```typescript
it.skipIf(!tableExists)('should isolate', async () => {
  // Visible skip in test output ✅
});
```

**Read More:**

- Quick: `PHASE_6_7_QUICK_REFERENCE-MAIS-20260102.md#pattern-4`
- Full: `PHASE_6_7_PREVENTION_STRATEGIES-MAIS-20260102.md#pattern-4`
- Example: `server/test/agent-eval/tenant-isolation.test.ts:36-50`

**Issue:** 607

---

## Document Map

```
PHASE_6_7_INDEX-MAIS-20260102.md (you are here)
├─ Quick navigation
├─ Pattern overview
├─ Document map
└─ Status & references

PHASE_6_7_QUICK_REFERENCE-MAIS-20260102.md (30 sec read)
├─ 4 patterns in 30 seconds each
├─ 2-minute code review checklist
├─ Detection tools
├─ File locations
└─ Common review comments

PHASE_6_7_PREVENTION_STRATEGIES-MAIS-20260102.md (25 min read)
├─ Pattern 1: tenantId in queries (detailed)
├─ Pattern 2: CLI validation (detailed)
├─ Pattern 3: DI duplication (detailed)
├─ Pattern 4: Test skips (detailed)
├─ Testing patterns
├─ Implementation checklist
└─ References

PHASE_6_7_ESLINT_RULES-MAIS-20260102.md (advanced, optional)
├─ Rule 4: no-silent-test-skips (easy, recommended Week 1)
├─ Rule 3: no-duplicated-di-initialization (medium, Week 2)
├─ Rule 1: require-tenant-id-in-queries (hard, Week 3)
├─ Rule 2: cli-args-with-zod-validation (hard, Week 3)
├─ CI configuration
├─ Pre-commit hooks
└─ Rollout schedule
```

---

## What's Included

### Documentation Files

| File                                               | Size | Purpose               | Read Time |
| -------------------------------------------------- | ---- | --------------------- | --------- |
| `PHASE_6_7_QUICK_REFERENCE-MAIS-20260102.md`       | 3KB  | Code review checklist | 3 min     |
| `PHASE_6_7_PREVENTION_STRATEGIES-MAIS-20260102.md` | 15KB | Detailed guide        | 25 min    |
| `PHASE_6_7_ESLINT_RULES-MAIS-20260102.md`          | 10KB | Automation (optional) | 15 min    |
| `PHASE_6_7_INDEX-MAIS-20260102.md`                 | 5KB  | This file             | 3 min     |

**Total:** 33KB comprehensive coverage

### Working Code Examples

- `server/scripts/run-eval-batch.ts:214` - Pattern 1 example
- `server/scripts/run-eval-batch.ts:90-96` - Pattern 2 example
- `server/src/di.ts:92-112` - Pattern 3 example
- `server/test/agent-eval/tenant-isolation.test.ts:36-50` - Pattern 4 example

---

## Issues Fixed (Status: All Complete)

| Issue | Pattern                    | Category        | Status   |
| ----- | -------------------------- | --------------- | -------- |
| 603   | 1: Missing tenantId        | Data Integrity  | ✅ Fixed |
| 606   | 2: Hand-rolled parsing     | Code Quality    | ✅ Fixed |
| 608   | 2: Missing UUID validation | Security        | ✅ Fixed |
| 605   | 3: DI duplication          | Maintainability | ✅ Fixed |
| 607   | 4: Silent test skips       | Testing         | ✅ Fixed |
| 604   | Sequential processing      | Performance     | ✅ Fixed |

**Commit:** fcf6004c
**Date Fixed:** 2026-01-02

---

## How to Use This Documentation

### For Code Authors

**Before submitting a PR:**

1. Read quick reference (3 min)
2. Check 4-point prevention checklist
3. Verify your code doesn't contain patterns
4. Reference working examples if unsure

### For Code Reviewers

**During code review:**

1. Use quick reference checklist (2 min)
2. Check for each of 4 patterns
3. Use detection tools if reviewing large files
4. Link to full documentation if issue found

### For DevOps/Tooling

**To set up automation:**

1. Read ESLint rules doc (15 min)
2. Start with Rule 4 (Week 1)
3. Add Rules 3, 1, 2 gradually (Weeks 2-3)
4. Integrate into CI/pre-commit

### For Team Leads

**To roll out across team:**

1. Share quick reference
2. Add to PR template
3. Mention in team meeting (show examples)
4. Review team PRs for patterns (first 2 weeks)
5. Optional: Enable ESLint rules gradually

---

## Key Takeaways

### The 4 Patterns Will Reappear

These aren't one-off bugs—they're recurring patterns that will appear in:

- New team members' code
- Similar features in different domains
- Copy-paste errors
- Under time pressure

### Code Review Is Your First Defense

All 4 patterns are **easy to spot in code review**:

- Pattern 1: Grep for missing tenantId
- Pattern 2: Spot manual arg parsing
- Pattern 3: Find identical blocks
- Pattern 4: Scan for silent returns

### Prevention Happens at Three Levels

1. **Code Review** (immediate, most important)
2. **ESLint Rules** (optional but helpful)
3. **Testing** (catch regressions)

### Start Small

Don't try to fix everything at once:

- **Week 1:** Focus on Pattern 4 (easiest)
- **Week 2:** Add Pattern 3
- **Week 3:** Add Patterns 1 & 2
- **Month 2+:** ESLint automation

---

## Related Documentation

### Phase 1-4 Remediation

- **File:** `agent-evaluation-remediation-prevention-MAIS-20260102.md`
- **Scope:** P1 issues (DI ordering, promise cleanup, tenant scoping, indexes)
- **Status:** Complete

### Multi-Tenant Patterns (Foundational)

- **File:** `mais-critical-patterns.md`
- **Scope:** 10 critical patterns for multi-tenant systems
- **Essential Reading:** Before working on any multi-tenant feature

### Project Guidelines

- **File:** `/CLAUDE.md` (project root)
- **Scope:** Architecture patterns, commands, conventions
- **Key Patterns:** DI ordering, infrastructure, security rules

---

## Quick Commands

```bash
# Find missing tenantId
grep -rn "where: {" server/src/ | grep -v tenantId

# Find hand-rolled arg parsing
grep -rn "split.*\=" server/scripts/ | head -10

# Find duplicated code
npx jscpd server/src/di.ts --min-lines 5

# Find silent test returns
grep -rn "if (.*) return;" server/test/**/*.test.ts
```

---

## FAQ

**Q: Do I need to read all these documents?**
A: No. Read quick reference (3 min). Read full guide only when implementing similar patterns.

**Q: Are all issues already fixed?**
A: Yes. These docs prevent recurrence.

**Q: Which pattern is most important?**
A: Pattern 1 (missing tenantId) - it's P0 security.

**Q: Can I use these patterns in other projects?**
A: Yes. All 4 apply to multi-tenant systems and general code quality.

**Q: How do I get started?**
A: Read `PHASE_6_7_QUICK_REFERENCE-MAIS-20260102.md` (3 min). Bookmark it.

**Q: What if I find another instance of these patterns?**
A: Ref this doc in your code review comment. Eventually these will be patterns everyone knows.

---

## Document Maintenance

**Last Updated:** 2026-01-02
**Maintained By:** Prevention Strategist
**Status:** Complete and maintained

**If you find:**

- Unclear explanations → Add an issue
- Better examples → Suggest edits
- New patterns → Create P1 issue + doc

---

## Compound Engineering Note

This documentation follows the compound engineering loop:

1. **Fix:** All 6 issues resolved (commit fcf6004c) ✅
2. **Learn:** Prevention strategies documented (this package) ✅
3. **Compound:** Future work builds on foundation (ongoing)
4. **Repeat:** Prevents issues from recurring (achieved)

**Next time similar issues appear, refer back to this documentation instead of rediscovering solutions.**

---

**Start here:** Read quick reference → Use during code review → Refer as needed

**Files:**

- Quick reference: `PHASE_6_7_QUICK_REFERENCE-MAIS-20260102.md`
- Full guide: `PHASE_6_7_PREVENTION_STRATEGIES-MAIS-20260102.md`
- ESLint rules: `PHASE_6_7_ESLINT_RULES-MAIS-20260102.md` (optional)

---

**End of Index**

⏱️ Total read time for all docs: 25-30 minutes
📌 Bookmark quick reference for every code review
🚀 Start with Phase 1 prevention if new to project
