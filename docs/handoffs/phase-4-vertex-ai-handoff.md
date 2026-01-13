# Vertex AI Migration - Phase 4 Handoff Prompt

```
/workflows:work plans/VERTEX-AI-IMPLEMENTATION-PLAN.md
```

## Context

**Branch**: `migrate-to-google`
**Phase 1**: COMPLETE (commit 0a30662e) - Core SDK migration
**Phase 2**: COMPLETE (commit ebb9da26) - Prompt engineering & tested contracts
**Phase 3**: COMPLETE (commit 1feb44a3) - Reliability & error handling
**Phase 4**: READY TO START

## Phase 3 Completed (2026-01-13)

Created production-grade error handling:

**New files:**

- `server/src/llm/errors.ts` - 9 error types with user-friendly messages
- `server/src/llm/retry.ts` - Smart retry with exponential backoff + jitter
- `server/test/llm/errors.test.ts` - 46 unit tests
- `server/test/llm/retry.test.ts` - 20 unit tests

**Error types:** RATE_LIMITED, QUOTA_EXCEEDED, CONTENT_BLOCKED, CONTEXT_TOO_LONG, SERVICE_UNAVAILABLE, AUTHENTICATION_ERROR, MODEL_NOT_FOUND, INVALID_REQUEST, UNKNOWN

**Key features:**

- Respects API retry-after hints
- Ops alerting for auth/quota/model errors
- User messages never expose technical details

## Phase 4: Testing & Validation

**Goal**: All tests passing, ready for deployment

**Steps:**

1. Create `server/test/helpers/mock-gemini.ts` - Gemini response mocks
2. Update any remaining test files using Anthropic mocks
3. Run full test suite: `npm test`
4. Run integration tests: `npm run test:integration`
5. Manual smoke testing of orchestrators

**Known issues:**

- 10 failing tests in `landing-page-routes.spec.ts` (pre-existing, unrelated to migration)
- Server workspace typecheck has pre-existing type errors with `@google/genai` SDK

## Verify Setup

```bash
gcloud auth application-default print-access-token  # Should return token
npm run typecheck                                    # Root passes, server has pre-existing issues
npx vitest run test/llm                             # 98 passing, 4 skipped
```

---

_This prompt is also saved at: docs/handoffs/phase-4-vertex-ai-handoff.md_
