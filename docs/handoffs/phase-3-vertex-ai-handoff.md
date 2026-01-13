# Vertex AI Migration - Phase 3 Handoff Prompt

Copy this to start the next session:

---

## Context

```
/workflows:work plans/VERTEX-AI-IMPLEMENTATION-PLAN.md
```

## Current State

**Branch**: `migrate-to-google`
**Phase 1**: COMPLETE (commit `0a30662e`) - Core SDK migration
**Phase 2**: COMPLETE (commit `ebb9da26`) - Prompt engineering & tested contracts
**Phase 3**: READY TO START

## Phase 2 Completed (2026-01-13)

Created tool calling test suite as tested contracts:

- `server/test/llm/tool-calling-golden.test.ts` - 31 unit tests
- `server/test/llm/tool-calling-live.integration.test.ts` - 4 live tests

Updated system prompts for Gemini's tool calling behavior:

- Onboarding: T1 batching OK, T2/T3 sequential with confirmation
- Customer: Tool usage order (get_services → check_availability → book_service)

**Live test verified**: `role: 'user'` for function responses works with Vertex AI

## Phase 3: Reliability & Error Handling

**Goal**: Production-grade error handling and retry logic

### Files to Create

1. **`server/src/llm/errors.ts`** - Error classification
   - Map Vertex AI error codes to actionable categories
   - Determine retry strategy per error type
   - User-friendly error messages

2. **`server/src/llm/retry.ts`** - Retry logic
   - Exponential backoff with jitter
   - Integration with error classification
   - Context for observability logging

### Key Error Types to Handle

| Error                     | Retryable | Action           |
| ------------------------- | --------- | ---------------- |
| RESOURCE_EXHAUSTED (429)  | Yes       | Backoff 60s      |
| QUOTA_EXCEEDED            | No        | User message     |
| CONTENT_BLOCKED           | No        | Rephrase request |
| SERVICE_UNAVAILABLE (503) | Yes       | Backoff 5s       |
| AUTHENTICATION_ERROR      | No        | Config error     |

### Integration Point

Update `server/src/agent/orchestrator/base-orchestrator.ts` to use:

- `withGeminiRetry()` wrapper for API calls
- `classifyGeminiError()` for error handling
- Idempotency for T2/T3 tool executions

## Verify Setup

```bash
gcloud auth application-default print-access-token  # Should return token
npm run typecheck                                    # Should pass
npm run --workspace=server test                      # ~2440 passing
```

## Run Live Tests

```bash
VERTEX_LIVE_TEST=true npm run --workspace=server test -- tool-calling-live
```

---
