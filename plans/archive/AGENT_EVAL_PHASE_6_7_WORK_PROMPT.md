# Agent Evaluation Remediation - Phase 6-7 Work Prompt

Copy this entire prompt to a new Claude Code window to continue the work.

---

## Context

We're completing the **Agent Evaluation System Remediation Plan**. Phases 1-5 are done. Phase 6-7 remain.

**Recent commits:**

- `fcf6004c`: P2 remediation - tenantId defense, UUID validation, test visibility, DI cleanup
- `a93a2a9e`: P1 route ordering and auth fallback
- `b2cab182`: Phase 4-5 remediation

**Plan file:** `plans/agent-eval-remediation-plan.md`

---

## Task: Complete Phase 6-7 (~5 hours)

Execute `/workflows:work` with this specification:

### Phase 6: Code Quality (P2) - 2.5 hours

#### 1. Rename Completed Todo Files (10 min)

```bash
cd todos
mv 603-open-p2-cli-missing-tenantid-flagged-count.md 603-done-p2-cli-missing-tenantid-flagged-count.md
mv 605-open-p2-di-evaluation-services-duplicated.md 605-done-p2-di-evaluation-services-duplicated.md
mv 607-open-p2-test-silent-skip-ci-false-positive.md 607-done-p2-test-silent-skip-ci-false-positive.md
mv 608-open-p2-cli-tenant-id-validation.md 608-done-p2-cli-tenant-id-validation.md
```

#### 2. Add Orphaned Feedback Cleanup (15 min)

**File:** `server/src/jobs/cleanup.ts`

Add after `cleanupExpiredTraces()`:

```typescript
/**
 * Clean up orphaned user feedback records
 * Feedback without associated traces older than 30 days
 */
export async function cleanupOrphanedFeedback(prisma: PrismaClient): Promise<number> {
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

  const result = await prisma.userFeedback.deleteMany({
    where: {
      traceId: null,
      createdAt: { lt: thirtyDaysAgo },
    },
  });

  logger.info({ deletedCount: result.count }, 'Cleaned up orphaned feedback');
  return result.count;
}
```

Update `runAllCleanupJobs()` to include feedback cleanup.

#### 3. Extract PII Redactor (30 min)

**Create:** `server/src/lib/pii-redactor.ts`

Extract PII patterns from:

- `server/src/agent/evals/pipeline.ts` (lines ~120-140)
- `server/src/agent/feedback/review-queue.ts` (lines ~80-100)

```typescript
// server/src/lib/pii-redactor.ts

const PATTERNS = {
  email: /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g,
  phone: /\b(?:\+1[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}\b/g,
  ssn: /\b\d{3}[-\s]?\d{2}[-\s]?\d{4}\b/g,
  card: /\b\d{4}[-\s]?\d{4}[-\s]?\d{4}[-\s]?\d{4}\b/g,
  address:
    /\b\d+\s+[\w\s]+(?:street|st|avenue|ave|road|rd|boulevard|blvd|drive|dr|lane|ln|way|court|ct)\b/gi,
} as const;

const REPLACEMENTS = {
  email: '[EMAIL]',
  phone: '[PHONE]',
  ssn: '[SSN]',
  card: '[CARD]',
  address: '[ADDRESS]',
} as const;

export function redactPII(text: string): string {
  let result = text;
  for (const [key, pattern] of Object.entries(PATTERNS)) {
    result = result.replace(pattern, REPLACEMENTS[key as keyof typeof REPLACEMENTS]);
  }
  return result;
}

export function redactMessages<T extends { content: string }>(messages: readonly T[]): T[] {
  return messages.map((m) => ({ ...m, content: redactPII(m.content) }));
}
```

Update pipeline.ts and review-queue.ts to import from this module.

#### 4. Fix N+1 Queries in Review Queue (30 min)

**File:** `server/src/agent/feedback/review-queue.ts`

Replace separate find + update with single `updateMany`:

```typescript
async submitReview(tenantId: string, traceId: string, review: ReviewInput): Promise<void> {
  await this.prisma.$transaction(async (tx) => {
    // Single updateMany with ownership check
    const updated = await tx.conversationTrace.updateMany({
      where: { id: traceId, tenantId },
      data: {
        reviewStatus: 'reviewed',
        reviewedAt: new Date(),
        reviewedBy: review.reviewedBy,
        reviewNotes: review.notes,
        ...(review.correctEvalScore && { evalScore: review.correctEvalScore }),
      },
    });

    if (updated.count === 0) {
      throw new TenantAccessDeniedError('trace');
    }

    if (review.actionTaken !== 'none') {
      await tx.reviewAction.create({
        data: {
          tenantId,
          traceId,
          action: review.actionTaken,
          notes: review.notes,
          correctedScore: review.correctEvalScore,
          performedBy: review.reviewedBy,
        },
      });
    }
  });
}
```

#### 5. Replace console.log in Tests (30 min)

Search and replace in test files:

```bash
grep -r "console.log" server/test/agent-eval/ --include="*.ts"
```

Replace with `logger.info()` or remove if just debugging.

#### 6. Sanitize Error Messages (15 min)

**File:** `server/src/agent/evals/pipeline.ts`

Ensure error messages don't leak:

- API keys
- Full stack traces to users
- Internal paths

Use `sanitizeError()` from `lib/core/error-sanitizer.ts`.

#### 7. Fix Test Mocks with mockDeep (30 min)

**Files:** `server/test/agent-eval/*.test.ts`

Replace:

```typescript
const mockPrisma = {} as any;
```

With:

```typescript
import { mockDeep } from 'vitest-mock-extended';
const mockPrisma = mockDeep<PrismaClient>();
```

### Phase 7: Minor Issues (P3) - 2 hours

#### 8. Extract Magic Numbers (15 min)

**File:** `server/src/agent/evals/pipeline.ts` or new config file

```typescript
export const IMPLICIT_FEEDBACK_CONFIG = {
  bookingCompletedWeight: 0.8,
  returnVisitWeight: 0.6,
  abandonedConversationWeight: -0.3,
  explicitFeedbackMultiplier: 1.5,
} as const;
```

#### 9. Make Evaluation Model Configurable (15 min)

**File:** `server/src/agent/evals/evaluator.ts`

```typescript
const EVAL_MODEL = process.env.EVAL_MODEL || 'claude-haiku-35-20241022';
```

#### 10. Add Readonly Arrays (15 min)

Search for mutable array types and add `as const` or `readonly`:

```typescript
// Before
const dimensions: string[] = ['helpfulness', 'safety', 'accuracy'];

// After
const DIMENSIONS = ['helpfulness', 'safety', 'accuracy'] as const;
type Dimension = (typeof DIMENSIONS)[number];
```

#### 11. Add Adversarial Test Scenarios (1 hour)

**File:** `server/test/agent-eval/adversarial.test.ts` (NEW)

Test cases:

- Conversation with prompt injection attempts
- Very long conversations (>100 messages)
- Unicode edge cases
- Empty/null message content
- Malformed JSON in tool calls

### Final Steps

#### 12. Apply Database Migration (5 min)

```bash
cd server
npx prisma migrate dev --name add_eval_batch_partial_index
```

#### 13. Run Tests

```bash
cd server && npm test
npm run typecheck
```

#### 14. Commit

```bash
git add -A && git commit -m "$(cat <<'EOF'
feat(agent-eval): complete Phase 6-7 remediation

Phase 6 (Code Quality):
- Extract PII redactor to lib/pii-redactor.ts (DRY)
- Fix N+1 queries in review-queue.ts with updateMany
- Replace console.log with logger in tests
- Sanitize error messages in pipeline
- Replace test mocks with mockDeep<T>()
- Add cleanupOrphanedFeedback() job

Phase 7 (Minor Issues):
- Extract magic numbers to IMPLICIT_FEEDBACK_CONFIG
- Make EVAL_MODEL configurable via env var
- Add readonly arrays with as const
- Add adversarial test scenarios

Closes: #587, #589, #591, #593, #594, #595, #596, #598, #599, #600

🤖 Generated with [Claude Code](https://claude.com/claude-code)

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>
EOF
)"
```

---

## Files to Modify

| File                                         | Changes                              |
| -------------------------------------------- | ------------------------------------ |
| `server/src/lib/pii-redactor.ts`             | NEW - extracted PII patterns         |
| `server/src/agent/evals/pipeline.ts`         | Import pii-redactor, sanitize errors |
| `server/src/agent/feedback/review-queue.ts`  | Import pii-redactor, fix N+1         |
| `server/src/agent/evals/evaluator.ts`        | EVAL_MODEL env var                   |
| `server/src/jobs/cleanup.ts`                 | Add cleanupOrphanedFeedback          |
| `server/test/agent-eval/*.test.ts`           | mockDeep, remove console.log         |
| `server/test/agent-eval/adversarial.test.ts` | NEW - edge case tests                |
| `todos/603-*.md` through `todos/608-*.md`    | Rename open→done                     |

---

## Success Criteria

- [ ] All P2 todos (587-595) resolved
- [ ] All P3 todos (596-600) resolved
- [ ] No duplicate PII patterns
- [ ] N+1 queries eliminated
- [ ] No console.log in test files
- [ ] Error messages sanitized
- [ ] Test mocks type-safe
- [ ] EVAL_MODEL configurable
- [ ] Adversarial tests passing
- [ ] All 2126+ tests passing
- [ ] Typecheck clean

---

## Reference Docs

- `plans/agent-eval-remediation-plan.md` - Full plan with code snippets
- `docs/solutions/patterns/mais-critical-patterns.md` - MAIS patterns
- `CLAUDE.md` - Project conventions
