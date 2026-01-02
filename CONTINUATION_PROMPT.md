# Agent Evaluation System - Continuation Prompt

Copy this prompt to your next Claude Code session to continue the remediation work.

---

## Context

We are implementing the Agent Evaluation System remediation plan. The plan addresses 21 code review findings (todos 580-600) identified by DHH, Kieran, and code-simplicity reviewers.

**Plan File:** `plans/agent-eval-remediation-plan.md`
**Related Commits:** face869, 346ee79, 458702e

## Current Progress

### Completed (Sessions 1-2)

**Phase 1: DI & Testability** - COMPLETE
- Container interface updated with evaluation services
- ConversationEvaluator DI fixed (dependencies before config per Kieran)
- EvalPipeline requires evaluator in constructor
- mock-evaluator.ts helper using mockDeep<T>()
- 11 DI unit tests in evaluator-di.test.ts

**Phase 2: Security & Tenant Isolation** - PARTIAL
- Tenant scoping added to EvalPipeline (submit, processBatch, getUnevaluatedTraces)
- Domain error classes created (TraceNotFoundError, TenantAccessDeniedError)
- Type guards replace unsafe type assertions in review-actions.ts
- **PENDING:** tenant-isolation.test.ts integration tests

**Phase 3: Memory & Performance** - COMPLETE
- Promise cleanup uses settle-and-clear pattern (DHH)
- drainPendingWrites()/drainCompleted() methods added
- Database index added: @@index([tenantId, evalScore, startedAt])
- **PENDING:** Run `prisma migrate dev` to apply index

**Phase 4: Integration & Wiring** - PARTIAL
- cleanupExpiredTraces() added to cleanup.ts
- platform-admin-traces.routes.ts created
- **PENDING:** Wire routes in routes/index.ts
- **PENDING:** Create CLI command run-eval-batch.ts
- **PENDING:** Wire DI container with evaluation services

### Not Started

- **Phase 5:** Data Integrity (transactions in platform admin routes)
- **Phase 6:** Code Quality (PII redactor, N+1 queries, Zod inference)
- **Phase 7:** Minor P3 Issues (magic numbers, model config, adversarial tests)

## Immediate Next Steps

1. **Fix Pre-commit Hook Issue:**
   The test setup has a Prisma client path resolution issue. Check `server/test/helpers/global-prisma.ts` import path.

2. **Apply Database Migration:**
   ```bash
   cd server && npx prisma migrate dev --name add_eval_batch_index
   ```

3. **Complete Phase 4 (Integration & Wiring):**
   - Wire platform-admin-traces.routes.ts in routes/index.ts
   - Create CLI command `server/src/cli/run-eval-batch.ts`
   - Wire DI container with evaluation services in di.ts

4. **Complete Phase 2 Tests:**
   - Create `server/test/agent-eval/tenant-isolation.test.ts`
   - Test trace isolation between tenants
   - Test rejection of cross-tenant submissions

5. **Proceed with Phases 5-7:**
   Follow the detailed implementation steps in `plans/agent-eval-remediation-plan.md`

## Key Files to Reference

- `plans/agent-eval-remediation-plan.md` - Full implementation plan with code snippets
- `server/src/agent/evals/pipeline.ts` - Evaluation pipeline (tenant scoping done)
- `server/src/agent/evals/evaluator.ts` - LLM-as-judge evaluator (DI fixed)
- `server/src/agent/feedback/review-queue.ts` - Review queue service
- `server/src/agent/feedback/review-actions.ts` - Review actions (type guards added)
- `server/src/routes/platform-admin-traces.routes.ts` - Platform admin routes (new)
- `todos/580-600*.md` - All 21 code review findings

## Reviewer Feedback (Key Points)

**DHH:**
- Use settle-and-clear for promise cleanup (no WeakSet)
- Replace in-process scheduler with CLI command + external cron
- Add migration safety checks

**Kieran:**
- DI constructor order: dependencies before config
- Use mockDeep<T>() instead of `as unknown as Type`
- Make evaluator required in EvalPipeline constructor
- Use type predicates for filter narrowing

## Quality Gates

Before considering complete:
- [ ] All 21 todos marked complete
- [ ] No new TypeScript errors (`npm run typecheck`)
- [ ] All tests pass (`npm test`)
- [ ] No circular dependencies (`npx madge --circular server/src/`)
- [ ] Tenant isolation tests pass (3 tests)
- [ ] Memory leak test passes

---

**Start command:**
```
Continue implementing the Agent Evaluation System remediation plan. Read plans/agent-eval-remediation-plan.md for full context and pick up from Phase 4.2 (wire platform admin routes).
```
