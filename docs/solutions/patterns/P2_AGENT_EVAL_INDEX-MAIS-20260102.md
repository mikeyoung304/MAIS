---
module: MAIS
type: index
date: 2026-01-02
tags: [agent-eval, prevention-strategies, p2-issues]
---

# P2 Agent Evaluation Issues - Complete Index

**Overview:** 6 P2 issues (603-608) discovered in agent evaluation code review. This index provides all prevention strategies, checklists, and references.

**Status:** All 6 issues are documented with prevention patterns and code examples.

---

## The 4 Core Patterns

| Pattern                         | Issues   | Severity       | Frequency              | Effort to Fix  |
| ------------------------------- | -------- | -------------- | ---------------------- | -------------- |
| **Missing tenantId in queries** | 603      | P0 Security    | Every query            | 15 min per fix |
| **Invalid CLI input**           | 606, 608 | P1 Security    | Every CLI script       | 20 min         |
| **Duplicated DI code**          | 605      | P2 Quality     | DI sections            | 20-30 min      |
| **Silent test skips**           | 607      | P2 Reliability | Every conditional test | 5 min per fix  |

---

## Documentation Files

### 1. Comprehensive Prevention Strategies (15-minute read)

**File:** `P2_AGENT_EVAL_PREVENTION_STRATEGIES-MAIS-20260102.md`

**Contains:**

- Detailed explanation of each pattern
- Code examples (wrong vs right)
- Code review checklists
- Testing patterns
- ESLint rule suggestions

**When to read:** Before writing or reviewing agent-eval code

**Key sections:**

- Pattern 1: Missing tenantId in queries (Issue 603)
- Pattern 2: Invalid CLI input (Issues 606, 608)
- Pattern 3: Duplicated DI code (Issue 605)
- Pattern 4: Silent test skips (Issue 607)

---

### 2. Quick Reference (30-second read)

**File:** `P2_AGENT_EVAL_QUICK_REFERENCE-MAIS-20260102.md`

**Contains:**

- 4 patterns in 30 seconds
- Anti-patterns table
- Quick checklist (2 minutes for code review)
- File locations with line numbers

**When to use:** During code review, before committing

**For quick lookup:**

```bash
# Print quick reference to terminal
cat docs/solutions/patterns/P2_AGENT_EVAL_QUICK_REFERENCE-MAIS-20260102.md

# Use with grep to find examples
grep -A 5 "❌ Wrong" docs/solutions/patterns/P2_AGENT_EVAL_QUICK_REFERENCE-MAIS-20260102.md
```

---

### 3. ESLint Rules (Optional, Advanced)

**File:** `P2_AGENT_EVAL_ESLINT_RULES-MAIS-20260102.md`

**Contains:**

- 4 custom ESLint rules (code)
- ESLint configuration examples
- CI integration setup
- Pre-commit hook integration

**When to use:** If setting up automated detection

**Recommended phase-in:**

1. Week 1: `no-silent-test-skips` (highest confidence)
2. Week 2: `no-duplicated-di-initialization` (tune thresholds)
3. Week 3: `require-tenant-id-in-queries` (may need customization)

---

## Quick Links to Specific Issues

### Issue 603: Missing tenantId in CLI Flagged Count Query

**Severity:** P2 → Should be P0 (data integrity)
**File:** `server/scripts/run-eval-batch.ts:200-220`
**Fix Time:** 15 min
**Status:** Already fixed ✅

**Read:**

1. `P2_AGENT_EVAL_PREVENTION_STRATEGIES-MAIS-20260102.md` → Pattern 1
2. Check line 214 in run-eval-batch.ts for working example

---

### Issues 606 & 608: CLI Argument Validation

**Severity:** P2 (should be P1 - security)
**Files:**

- `server/scripts/run-eval-batch.ts:67-100` (parseArgs)
- `server/scripts/run-eval-batch.ts:80-96` (tenantId validation)

**Fix Time:** 20 min total
**Status:** Already fixed ✅

**Read:**

1. `P2_AGENT_EVAL_PREVENTION_STRATEGIES-MAIS-20260102.md` → Pattern 2
2. Check lines 35-45 for parseArgs() pattern
3. Check lines 90-96 for Zod validation pattern

**What was wrong:**

- Manual argument parsing with `arg.split('=')[1]`
- No validation on tenantId (could be empty or invalid UUID)
- Confusing error messages when args invalid

**What's now right:**

- Node's built-in `parseArgs()`
- Zod schema validates all options
- Clear error messages with exit code 1

---

### Issue 605: DI Evaluation Services Duplicated

**Severity:** P2 (code quality)
**File:** `server/src/di.ts:92-112`
**Fix Time:** 20-30 min
**Status:** Already fixed ✅

**Read:**

1. `P2_AGENT_EVAL_PREVENTION_STRATEGIES-MAIS-20260102.md` → Pattern 3
2. Check di.ts:92-112 for `buildEvaluationServices()` helper

**What was wrong:**

- Same 15 lines of code in mock mode (line 304-310) and real mode (line 735-746)
- Bug in one copy wouldn't be fixed in the other
- Violates DRY principle

**What's now right:**

- `buildEvaluationServices(prisma, mode)` helper function
- Used in both mock and real mode DI
- Single source of truth

---

### Issue 607: Silent Test Skips

**Severity:** P2 (testing visibility)
**Files:**

- `server/test/agent-eval/tenant-isolation.test.ts:36` (wrapper definition)
- `server/test/agent-eval/tenant-isolation.test.ts:75, 105, 118` (usage)

**Fix Time:** 5 min per occurrence
**Status:** Already fixed ✅

**Read:**

1. `P2_AGENT_EVAL_PREVENTION_STRATEGIES-MAIS-20260102.md` → Pattern 4
2. Check tenant-isolation.test.ts:36-50 for pattern
3. Check quick reference for "❌ Wrong / ✅ Right" examples

**What was wrong:**

```typescript
if (!tableExists) return; // Test silently passes when table missing
```

**What's now right:**

```typescript
const itIfTableExists = it.skipIf(() => !tableExists);
// ...
itIfTableExists('should NOT return traces', async () => {
  // Test visibly skipped in CI if table missing
});
```

---

## For Different Audiences

### For Code Authors

**When starting agent-eval work:**

1. Read `P2_AGENT_EVAL_QUICK_REFERENCE-MAIS-20260102.md` (30 sec)
2. Before each commit, run checklist from quick reference
3. Check working examples in:
   - `server/scripts/run-eval-batch.ts` (lines 67-220)
   - `server/src/di.ts` (lines 92-112)
   - `server/test/agent-eval/tenant-isolation.test.ts` (lines 36-50)

**Common tasks:**

- **Adding new query:** Check line 214 of run-eval-batch.ts for tenantId pattern
- **Adding CLI flag:** Check lines 35-45 for parseArgs() + Zod pattern
- **Adding DI service:** Check di.ts:92-112 for extraction pattern
- **Adding conditional test:** Check tenant-isolation.test.ts:36 for skipIf() pattern

---

### For Code Reviewers

**When reviewing PR:**

1. Use `P2_AGENT_EVAL_QUICK_REFERENCE-MAIS-20260102.md` → "Code Review Checklist"
2. Check against the 4 patterns:
   - Database queries: Does every query have tenantId?
   - CLI: Are args validated with Zod?
   - DI: Are there duplicated blocks?
   - Tests: Are there silent returns?
3. Link to relevant section in prevention strategies doc if issues found

**Common review comments:**

```
💾 Missing tenantId in query
→ See: P2_AGENT_EVAL_PREVENTION_STRATEGIES-MAIS-20260102.md → Pattern 1
→ Example: server/scripts/run-eval-batch.ts:214

🛡️  CLI argument not validated
→ See: P2_AGENT_EVAL_PREVENTION_STRATEGIES-MAIS-20260102.md → Pattern 2
→ Example: server/scripts/run-eval-batch.ts:90-96

🔄 Duplicated DI code
→ See: P2_AGENT_EVAL_PREVENTION_STRATEGIES-MAIS-20260102.md → Pattern 3
→ Example: server/src/di.ts:92-112

🧪 Silent test skip
→ See: P2_AGENT_EVAL_PREVENTION_STRATEGIES-MAIS-20260102.md → Pattern 4
→ Example: server/test/agent-eval/tenant-isolation.test.ts:36
```

---

### For DevOps/Tooling

**If setting up automated detection:**

1. Read `P2_AGENT_EVAL_ESLINT_RULES-MAIS-20260102.md`
2. Recommend phase-in:
   - Week 1: `no-silent-test-skips` (highest confidence)
   - Week 2: `no-duplicated-di-initialization`
   - Week 3: `require-tenant-id-in-queries` (with tuning)
3. Add to `.github/workflows/lint.yml` (see ESLint rules doc)
4. Add to pre-commit hooks via `.husky/pre-commit`

---

## Code Examples by Language

### TypeScript/Database

**Missing tenantId Pattern:**

```typescript
// ❌ Wrong
const flaggedCount = await prisma.conversationTrace.count({
  where: { id: { in: traceIds }, flagged: true },
});

// ✅ Right
const flaggedCount = await prisma.conversationTrace.count({
  where: { tenantId, id: { in: traceIds }, flagged: true },
});
```

See: `P2_AGENT_EVAL_PREVENTION_STRATEGIES-MAIS-20260102.md` → Pattern 1

---

### TypeScript/CLI

**Invalid Input Pattern:**

```typescript
// ❌ Wrong
} else if (arg.startsWith('--tenant-id=')) {
  options.tenantId = arg.split('=')[1]?.trim();  // No validation
}

// ✅ Right
const schema = z.object({ tenantId: z.string().uuid().optional() });
const { values } = parseArgs({ /* ... */ });
const result = schema.safeParse({ tenantId: values['tenant-id'] });
if (!result.success) { console.error(...); process.exit(1); }
options.tenantId = result.data.tenantId;
```

See: `P2_AGENT_EVAL_PREVENTION_STRATEGIES-MAIS-20260102.md` → Pattern 2

---

### TypeScript/DI

**Duplicated Code Pattern:**

```typescript
// ❌ Wrong: Same code in 2 places
if (process.env.ANTHROPIC_API_KEY) {
  const evaluator = createEvaluator();
  const pipeline = createEvalPipeline(prisma, evaluator);
  // ... repeated
}

// ✅ Right: Extract helper
function buildEvaluationServices(prisma, mode) {
  // Single implementation
}
```

See: `P2_AGENT_EVAL_PREVENTION_STRATEGIES-MAIS-20260102.md` → Pattern 3

---

### TypeScript/Testing

**Silent Skip Pattern:**

```typescript
// ❌ Wrong
it('should not leak traces', async () => {
  if (!tableExists) return; // Silent skip
});

// ✅ Right
const itIfTableExists = it.skipIf(() => !tableExists);
itIfTableExists('should not leak traces', async () => {
  // Visibly skipped
});
```

See: `P2_AGENT_EVAL_PREVENTION_STRATEGIES-MAIS-20260102.md` → Pattern 4

---

## Related Documentation

### Multi-Tenant Patterns (P0 Prevention)

**File:** `docs/solutions/patterns/mais-critical-patterns.md`

**Read if:** Working with any multi-tenant queries

**Key patterns:**

- Pattern 1: Multi-Tenant Query Isolation (foundational)
- Pattern 2: Tenant-Scoped Cache Keys
- Pattern 3: Repository Interface Signature
- Pattern 4: Email Normalization

---

### Agent Evaluation System Remediation (Phase 1-4)

**File:** `docs/solutions/patterns/agent-evaluation-remediation-prevention-MAIS-20260102.md`

**Read if:** Working on agent evaluation features in depth

**Covers:** 6 P1 patterns from earlier phases:

- DI Constructor Ordering
- Promise Cleanup
- Tenant Scoping Every Database Method
- Type Guards for Filter Narrowing
- Database Indexes for Query Optimization
- Infrastructure Setup and Cleanup

---

## Command Reference

```bash
# View quick reference (30 sec)
cat docs/solutions/patterns/P2_AGENT_EVAL_QUICK_REFERENCE-MAIS-20260102.md

# Search for specific issue
grep -n "Issue 603\|Issue 607\|Issue 605" docs/solutions/patterns/P2_AGENT_EVAL_PREVENTION_STRATEGIES-MAIS-20260102.md

# Find working examples in code
grep -n "tenantId.*where\|parseArgs\|buildEvaluation\|skipIf" server/scripts/run-eval-batch.ts

# Check pattern status
git log --oneline --grep="603\|605\|606\|607\|608" | head -10

# Run automated checks (when ESLint rules set up)
npm run lint -- --rule "custom/no-silent-test-skips: error"
```

---

## FAQ

**Q: Which issues are already fixed?**
A: All 6 are fixed (commit fcf6004c). This documentation prevents recurrence.

**Q: Do I need to read all 3 docs?**
A: No. Start with quick reference. Read full doc if reviewing or implementing.

**Q: What if I find another instance of these patterns?**
A: Report as P2 issue following the same format in todos/. Link to relevant section.

**Q: How do I set up ESLint detection?**
A: See `P2_AGENT_EVAL_ESLINT_RULES-MAIS-20260102.md`. Recommended: Start with `no-silent-test-skips` rule.

**Q: Where are the working code examples?**
A: All in these files:

- `server/scripts/run-eval-batch.ts` (patterns 1, 2)
- `server/src/di.ts` (pattern 3)
- `server/test/agent-eval/tenant-isolation.test.ts` (pattern 4)

**Q: Can I reuse these patterns outside agent-eval?**
A: Yes! All 4 patterns apply to the entire codebase.

---

## Version History

| Date       | Changes                                        |
| ---------- | ---------------------------------------------- |
| 2026-01-02 | Initial release - 3 docs, 4 patterns, 6 issues |

---

## Document Sizes

| Document              | Size | Read Time | Format         |
| --------------------- | ---- | --------- | -------------- |
| Prevention Strategies | 8KB  | 15 min    | Full reference |
| Quick Reference       | 3KB  | 30 sec    | Checklist      |
| ESLint Rules          | 6KB  | 10 min    | Technical      |
| This Index            | 6KB  | 5 min     | Navigation     |

**Total:** 23KB, comprehensive coverage of all 4 patterns
