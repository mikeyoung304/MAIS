# Agent-Eval Final Remediation - Continuation Prompt

**Date:** 2026-01-02
**Status:** 4 items remaining (1 P1, 2 P2, 1 P3)
**Estimated Time:** ~2 hours
**Prior Session Commit:** `0ce7eac1` - fix(agent-eval): P2/P3 remediation

---

## Context

We completed a P2/P3 remediation session for the agent-eval system. 10 of 14 items are done. The evaluation pipeline is production-functional. This session completes the final 4 items.

**Compound documentation created:** `docs/solutions/patterns/p2-p3-agent-eval-remediation-patterns-MAIS-20260102.md`

---

## Task: Complete Remaining Agent-Eval Remediation

Execute `/workflows:work` with the following plan:

### Items to Complete

| ID  | Priority | Description                                                | File                             | Est.   |
| --- | -------- | ---------------------------------------------------------- | -------------------------------- | ------ |
| 609 | **P1**   | Add tenantId to proposal update queries (defense-in-depth) | `server/src/jobs/cleanup.ts`     | 20 min |
| 610 | P2       | Add composite index for orphan feedback cleanup            | `server/prisma/schema.prisma`    | 15 min |
| 611 | P2       | Add missing PII patterns (IP, intl phone, DOB)             | `server/src/lib/pii-redactor.ts` | 45 min |
| 600 | P3       | Add `as const` to readonly arrays                          | Multiple files                   | 20 min |

---

## Detailed Implementation

### 609 - P1: tenantId in Cleanup Proposal Updates

**File:** `server/src/jobs/cleanup.ts`
**Lines:** 175-181, 200-206, 221-228, 242-248

**Problem:** `agentProposal.update` calls use only `id` in where clause, violating defense-in-depth.

**Fix Pattern:**

```typescript
// BEFORE
await prisma.agentProposal.update({
  where: { id: proposalId },
  data: { status: 'FAILED', ... },
});

// AFTER - Extract tenantId from proposal object fetched earlier
const tenantId = proposal.tenantId;
await prisma.agentProposal.update({
  where: { id: proposalId, tenantId },
  data: { status: 'FAILED', ... },
});
```

**Acceptance Criteria:**

- [ ] All 4 `agentProposal.update` calls in cleanup.ts include `tenantId` in where clause
- [ ] Add test verifying tenant scoping in proposal updates

---

### 610 - P2: Composite Index for Orphan Feedback

**File:** `server/prisma/schema.prisma`

**Problem:** `cleanupOrphanedFeedback` query filters on `traceId = NULL AND createdAt < date` but no index covers this.

**Fix:** Add composite index to UserFeedback model:

```prisma
model UserFeedback {
  // ... existing fields ...

  @@index([tenantId, sessionId])
  @@index([tenantId, createdAt])
  @@index([traceId])
  @@index([traceId, createdAt])  // NEW: For orphan cleanup query
}
```

**After adding, run:**

```bash
cd server && npm exec prisma migrate dev --name add_user_feedback_orphan_index
```

**Acceptance Criteria:**

- [ ] Index `@@index([traceId, createdAt])` exists on UserFeedback
- [ ] Migration applied successfully

---

### 611 - P2: Missing PII Patterns

**File:** `server/src/lib/pii-redactor.ts`

**Problem:** Missing patterns for IP addresses, international phone numbers, dates of birth.

**Add these patterns to `PII_PATTERNS` array:**

```typescript
// IP addresses (IPv4)
{ pattern: /\b(?:\d{1,3}\.){3}\d{1,3}\b/g, replacement: '[IP]' },

// International phone (E.164 format: +1234567890)
{ pattern: /\+\d{7,15}\b/g, replacement: '[PHONE]' },

// Date of birth patterns (DOB: MM/DD/YYYY or similar)
{ pattern: /\b(?:DOB|Date of Birth|Birthday)[:\s]+\d{1,2}[-/]\d{1,2}[-/]\d{2,4}\b/gi, replacement: '[DOB]' },
```

**Add tests to** `server/test/agent-eval/pipeline.test.ts`:

```typescript
it('should redact IP addresses', () => {
  expect(redactPII('Server at 192.168.1.100')).toBe('Server at [IP]');
});

it('should redact international phone numbers', () => {
  expect(redactPII('Call +447911123456')).toBe('Call [PHONE]');
});

it('should redact date of birth', () => {
  expect(redactPII('DOB: 01/15/1990')).toBe('[DOB]');
});
```

**Acceptance Criteria:**

- [ ] IP addresses redacted as `[IP]`
- [ ] E.164 phone numbers redacted as `[PHONE]`
- [ ] DOB patterns redacted as `[DOB]`
- [ ] Tests pass for new patterns

---

### 600 - P3: Readonly Arrays with `as const`

**Problem:** Arrays that should be readonly lack `as const` assertion.

**Files to check:**

- `server/src/agent/evals/rubrics/index.ts` - DIMENSION_NAMES array
- `server/src/agent/feedback/review-queue.ts` - ACTION_TYPES array (if exists)
- `server/src/lib/pii-redactor.ts` - SENSITIVE_KEYS array

**Pattern:**

```typescript
// BEFORE
const ALLOWED_VALUES = ['a', 'b', 'c'];

// AFTER
const ALLOWED_VALUES = ['a', 'b', 'c'] as const;
```

**Acceptance Criteria:**

- [ ] Constant arrays use `as const`
- [ ] No TypeScript errors introduced

---

## Verification Steps

After all fixes:

```bash
# 1. Type check
npm run typecheck

# 2. Run agent-eval tests
cd server && npx vitest run test/agent-eval/

# 3. Apply migration (if not done)
npm exec prisma migrate dev --name add_user_feedback_orphan_index

# 4. Full test suite (optional - can be slow)
npm test
```

---

## Commit Message

```
fix(agent-eval): final remediation - tenantId defense, PII patterns, indexes

- P1-609: Add tenantId to all proposal updates in cleanup.ts (defense-in-depth)
- P2-610: Add composite index [traceId, createdAt] on UserFeedback
- P2-611: Add IP, intl phone, DOB patterns to PII redactor
- P3-600: Add `as const` to readonly arrays

🤖 Generated with [Claude Code](https://claude.com/claude-code)

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>
```

---

## Post-Completion

1. **Rename todo files:**

   ```bash
   cd /Users/mikeyoung/CODING/MAIS/todos
   mv 609-pending-p1-cleanup-proposal-tenantid.md 609-done-p1-cleanup-proposal-tenantid.md
   mv 610-pending-p2-cleanup-missing-index-orphan-feedback.md 610-done-p2-cleanup-missing-index-orphan-feedback.md
   mv 611-pending-p2-pii-redactor-missing-patterns.md 611-done-p2-pii-redactor-missing-patterns.md
   mv 600-open-p3-inconsistent-readonly-arrays.md 600-done-p3-inconsistent-readonly-arrays.md
   ```

2. **Run `/workflows:compound`** to document any new patterns discovered.

3. **Update continuation-decision.md** status to 100% complete.

---

## Reference Files

- Todo 609: `todos/609-pending-p1-cleanup-proposal-tenantid.md`
- Todo 610: `todos/610-pending-p2-cleanup-missing-index-orphan-feedback.md`
- Todo 611: `todos/611-pending-p2-pii-redactor-missing-patterns.md`
- Todo 600: `todos/600-open-p3-inconsistent-readonly-arrays.md`
- Compound doc: `docs/solutions/patterns/p2-p3-agent-eval-remediation-patterns-MAIS-20260102.md`
- Cleanup job: `server/src/jobs/cleanup.ts`
- PII redactor: `server/src/lib/pii-redactor.ts`
- Pipeline tests: `server/test/agent-eval/pipeline.test.ts`

---

_This prompt enables continuation of the agent-eval remediation in a fresh context._
