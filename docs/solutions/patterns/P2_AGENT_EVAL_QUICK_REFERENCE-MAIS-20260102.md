---
module: MAIS
type: quick_reference
date: 2026-01-02
tags: [quick-reference, agent-eval, checklist]
---

# P2 Agent Evaluation Issues - Quick Reference (30 seconds)

## 4 Patterns to Remember

### 1️⃣ Missing tenantId in Queries (603)

**Rule:** Every database query must include `tenantId` in WHERE clause.

```typescript
// ❌ Wrong
where: { id: { in: traceIds }, flagged: true }

// ✅ Right
where: { tenantId, id: { in: traceIds }, flagged: true }
```

**Checklist:** Does every query start with `tenantId` in WHERE?

---

### 2️⃣ Invalid CLI Input (606, 608)

**Rule:** Validate all CLI arguments upfront with Zod schema.

```typescript
// ❌ Wrong
} else if (arg.startsWith('--tenant-id=')) {
  options.tenantId = arg.split('=')[1];  // No validation
}

// ✅ Right
const schema = z.object({ tenantId: z.string().uuid() });
const result = schema.safeParse(values);
if (!result.success) { console.error(...); process.exit(1); }
```

**Checklist:**

- [ ] Use `node:util` parseArgs(), not hand-rolled loop
- [ ] Define Zod schema for all options
- [ ] Invalid input exits with error message

---

### 3️⃣ Duplicated DI Code (605)

**Rule:** Extract repeated initialization blocks into helper functions.

```typescript
// ❌ Wrong: Same code in mock and real mode
if (process.env.ANTHROPIC_API_KEY) {
  const evaluator = createEvaluator();
  const pipeline = createEvalPipeline(prisma, evaluator);
  // ...
}

// ✅ Right: Extract helper
function buildEvaluationServices(prisma, mode) {
  // Single implementation
}
```

**Checklist:**

- [ ] Same code in 2+ places → extract function
- [ ] Function parameterized (prisma instance, etc.)
- [ ] No logic repeated between mock/real

---

### 4️⃣ Silent Test Skips (607)

**Rule:** Use `skipIf()` not early returns for conditional tests.

```typescript
// ❌ Wrong: Test silently passes
it('should not leak traces', async () => {
  if (!tableExists) return; // Silent skip!
});

// ✅ Right: Visible skip
it.skipIf(!tableExists)('should not leak traces', async () => {
  // Test skipped visibly in CI
});
```

**Checklist:**

- [ ] No early returns in test bodies
- [ ] Use `it.skipIf()` or `describe.skipIf()`
- [ ] CI shows "X skipped" not hidden tests

---

## Code Review Checklist (2 minutes)

```
BEFORE APPROVING AGENT-EVAL PR:

□ DATABASE
  □ Every query has tenantId in WHERE
  □ No exceptions without comment
  □ Compound queries verify ownership

□ CLI (if adding new script/flags)
  □ parseArgs() from node:util
  □ Zod schema validates all options
  □ Invalid input → error message + exit 1
  □ --help shows all options

□ DI
  □ No identical blocks in di.ts
  □ Extracted functions used for common patterns
  □ Both mock and real mode use same logic

□ TESTS
  □ Grep for "if (!.*) return;" - should be empty
  □ All skips use skipIf()
  □ Test count = executed count
```

---

## File Locations

| Issue   | File                                               | Pattern                         |
| ------- | -------------------------------------------------- | ------------------------------- |
| 603     | server/scripts/run-eval-batch.ts:200-220           | Add tenantId to count query     |
| 606,608 | server/scripts/run-eval-batch.ts:67-100            | Use Zod + parseArgs             |
| 605     | server/src/di.ts:92-112                            | Extract buildEvaluationServices |
| 607     | server/test/agent-eval/tenant-isolation.test.ts:36 | Use itIfTableExists wrapper     |

---

## Before Committing

```bash
# Catch issues early
npm run typecheck        # Type safety
npm test                 # All tests run/skip visibly
npm run lint             # Code style
grep "tenantId" server/src/agent/evals/pipeline.ts | head -5  # Check queries
```

---

## Anti-Patterns to Avoid

| ❌ Don't                             | ✅ Do                                |
| ------------------------------------ | ------------------------------------ |
| `count({ where: { id } })`           | `count({ where: { tenantId, id } })` |
| `arg.split('=')[1]`                  | `z.string().uuid().parse(value)`     |
| Hand-rolled `parseArgs()`            | `node:util parseArgs()`              |
| Duplicate `if (process.env.API_KEY)` | Extract to `buildServices()`         |
| `if (!exists) return;`               | `it.skipIf(!exists)()`               |

---

## When in Doubt

1. Check `mais-critical-patterns.md` - Pattern 1 (Multi-Tenant Query Isolation)
2. Check existing code in `run-eval-batch.ts` - working examples
3. Check `di.ts` lines 92-112 - DI extraction pattern
4. Check `tenant-isolation.test.ts` lines 36-50 - test skip pattern

---

**Full Reference:** See `P2_AGENT_EVAL_PREVENTION_STRATEGIES-MAIS-20260102.md`
