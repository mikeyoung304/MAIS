---
module: MAIS
type: quick_reference
date: 2026-01-02
read_time: 3 minutes
---

# Phase 6-7 Prevention Strategies - Quick Reference

**Use this during code reviews. Full explanations: `PHASE_6_7_PREVENTION_STRATEGIES-MAIS-20260102.md`**

---

## 4 Patterns (30 Seconds Each)

### Pattern 1: Missing tenantId in Queries (P0 Security)

```
WRONG:  where: { id: { in: [...] }, flagged: true }
RIGHT:  where: { tenantId, id: { in: [...] }, flagged: true }

RULE: Every query includes tenantId in WHERE clause
WHY: Defense-in-depth, even with pre-filtered IDs
```

### Pattern 2: Invalid CLI Input (P1 Security)

```
WRONG:  const tenantId = arg.split('=')[1]?.trim();
RIGHT:  const schema = z.string().uuid();
        const result = schema.safeParse(value);
        if (!result.success) process.exit(1);

RULE: Use Node parseArgs() + Zod validation
WHY: Catch errors upfront, clear messages
```

### Pattern 3: Duplicated DI Code (P2 Quality)

```
WRONG:  if (mode === 'mock') { const evaluator = ...; }
        if (mode === 'real') { const evaluator = ...; }  // Duplicate

RIGHT:  function buildServices(prisma, mode) { const evaluator = ...; }
        const svc = buildServices(mockPrisma, 'mock');
        const svc = buildServices(prisma, 'real');

RULE: Extract repeated logic to helpers
WHY: Single source of truth, avoid duplicate bugs
```

### Pattern 4: Silent Test Skips (P2 Reliability)

```
WRONG:  it('should isolate', async () => {
          if (!tableExists) return;  // Silent skip!
        });

RIGHT:  it.skipIf(!tableExists)('should isolate', async () => {
          // Visible skip in test output
        });

RULE: Use skipIf() not silent returns
WHY: Tests can't silently pass when they don't run
```

---

## 2-Minute Code Review Checklist

```
BEFORE APPROVING:

Pattern 1: DATABASE QUERIES
□ Grep: grep "where: {" in diff
□ Every where clause has tenantId
□ No exceptions without comment
□ Ownership verified before operations

Pattern 2: CLI / SCRIPTS
□ Arguments use parseArgs() not hand-rolled
□ All options have Zod validation
□ UUIDs validated with z.string().uuid()
□ Numeric options have constraints (.positive(), .max())
□ Error message clear, exit code 1

Pattern 3: DI CONTAINER (server/src/di.ts)
□ No identical blocks between mock/real
□ If code repeats 2+x, extract to helper
□ Helper has clear return type (not any)

Pattern 4: TESTS (server/test/**)
□ No "if (condition) return;" in test bodies
□ Conditionals use skipIf() or describe.skipIf()
□ Skip reason visible in test output

BONUS: ENVIRONMENT VARIABLES
□ No reading env vars at module import time
□ Reading happens lazily in functions
```

---

## Detection Tools

```bash
# Find missing tenantId
grep -rn "where: {" server/src/ | grep -v tenantId | head -10

# Find hand-rolled arg parsing (40+ lines)
wc -l server/scripts/*.ts | grep -E "\s(4[0-9]|[5-9][0-9])\s"

# Find duplicated code
npx jscpd server/src/di.ts --min-lines 5

# Find silent test returns
grep -rn "if (.*) return;" server/test/ | grep -i "\.test\.ts"
```

---

## File Locations (Working Examples)

| Pattern           | File                                              | Lines  |
| ----------------- | ------------------------------------------------- | ------ |
| 1: tenantId       | `server/scripts/run-eval-batch.ts`                | 214    |
| 2: CLI validation | `server/scripts/run-eval-batch.ts`                | 90-96  |
| 3: DI extraction  | `server/src/di.ts`                                | 92-112 |
| 4: skipIf()       | `server/test/agent-eval/tenant-isolation.test.ts` | 36-50  |

---

## Common Review Comments

```markdown
### Pattern 1 Violation

Check P0 security pattern:
→ docs/solutions/patterns/PHASE_6_7_PREVENTION_STRATEGIES-MAIS-20260102.md#pattern-1

Every query needs tenantId in WHERE clause.

Example: server/scripts/run-eval-batch.ts:214

### Pattern 2 Violation

Check P1 security pattern:
→ docs/solutions/patterns/PHASE_6_7_PREVENTION_STRATEGIES-MAIS-20260102.md#pattern-2

Use Node parseArgs() + Zod validation, not hand-rolled parsing.

Example: server/scripts/run-eval-batch.ts:90-96

### Pattern 3 Violation

Check P2 quality pattern:
→ docs/solutions/patterns/PHASE_6_7_PREVENTION_STRATEGIES-MAIS-20260102.md#pattern-3

Extract duplicated DI initialization to helper function.

Example: server/src/di.ts:92-112

### Pattern 4 Violation

Check P2 reliability pattern:
→ docs/solutions/patterns/PHASE_6_7_PREVENTION_STRATEGIES-MAIS-20260102.md#pattern-4

Use it.skipIf() instead of silent returns in tests.

Example: server/test/agent-eval/tenant-isolation.test.ts:36
```

---

## Pattern Checklist (Copy & Paste)

```markdown
- [ ] Pattern 1: All queries include tenantId
- [ ] Pattern 2: CLI args validated with Zod + parseArgs()
- [ ] Pattern 3: No duplicated DI code
- [ ] Pattern 4: Tests use skipIf() not silent returns
```

---

## Red Flags (Automatic Request for Changes)

| Red Flag                         | Severity | Action           |
| -------------------------------- | -------- | ---------------- |
| tenantId missing from WHERE      | P0 ⛔    | Request change   |
| Manual arg parsing without Zod   | P1 ⚠️    | Request change   |
| Identical code blocks 2+ places  | P2       | Suggest refactor |
| "if (condition) return;" in test | P2       | Suggest skipIf() |

---

## Issues Fixed (Reference)

| Issue | Pattern                 | Status  |
| ----- | ----------------------- | ------- |
| 603   | Missing tenantId        | ✓ Fixed |
| 606   | Hand-rolled parsing     | ✓ Fixed |
| 608   | Missing UUID validation | ✓ Fixed |
| 605   | DI duplication          | ✓ Fixed |
| 607   | Silent test skips       | ✓ Fixed |

---

## Related Docs

- **Full guide:** `PHASE_6_7_PREVENTION_STRATEGIES-MAIS-20260102.md`
- **Phase 1-4:** `agent-evaluation-remediation-prevention-MAIS-20260102.md`
- **Multi-tenant:** `mais-critical-patterns.md`
- **Project guide:** `/CLAUDE.md`

---

**Bookmark this page. Use during all code reviews on agent-eval, CLI, and DI code.**
