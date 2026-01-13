# Vertex AI Migration - Phase 4 Manual Testing Handoff

## Context

**Branch**: `migrate-to-google`
**Phase 4 Status**: Automated tests complete, manual smoke testing pending

### Completed in Phase 4

- ✅ TypeScript passes
- ✅ Unit tests: 2505 passed, 10 pre-existing failures (unrelated to migration)
- ✅ LLM tests: 98 passed, 4 skipped (live tests)
- ✅ E2E tests: 55 passed, 35 skipped, 0 failed

## Task: Manual Smoke Testing

Start the development servers and verify each orchestrator works correctly with live Vertex AI.

### Step 1: Start Development Environment

```bash
# Terminal 1: Start all services
npm run dev:all

# Wait for services to be ready:
# - API: http://localhost:3001
# - Web: http://localhost:3000
# - Stripe webhooks: forwarding
```

### Step 2: Verify Google Auth

```bash
# Ensure ADC is configured
gcloud auth application-default print-access-token
# Should return a token, not an error
```

### Step 3: Smoke Test Cases

Test each orchestrator via the appropriate interface:

| Test Case              | Steps                         | Expected Result                 |
| ---------------------- | ----------------------------- | ------------------------------- |
| **Customer greeting**  | Send "Hi!" to customer chat   | Short, friendly response        |
| **Availability check** | "Are you free next Tuesday?"  | Tool call to check_availability |
| **Service inquiry**    | "What services do you offer?" | Lists services from database    |
| **Booking flow**       | Complete a booking            | Booking created successfully    |
| **Onboarding start**   | "Help me set up my business"  | Onboarding flow begins          |
| **Admin query**        | "Show me my bookings"         | Returns booking list            |

### Step 4: Check for Console Errors

Open browser DevTools (F12) and verify:

- No JavaScript errors
- No network failures (except expected 4xx for auth)
- No Vertex AI errors in server logs

### Step 5: Mark Phase 4 Complete

If all smoke tests pass:

1. Update `plans/VERTEX-AI-IMPLEMENTATION-PLAN.md` - mark remaining checklist items
2. Commit with message: `test: complete Phase 4 manual smoke testing`
3. Proceed to Phase 5 (cleanup)

## Quick Commands

```bash
# Start all services
npm run dev:all

# Run live integration tests (optional, costs money)
VERTEX_LIVE_TEST=true npm run --workspace=server test -- tool-calling-live

# Check server logs for Vertex AI calls
tail -f server/logs/combined.log | grep -i "gemini\|vertex\|llm"
```

## Files Changed in Migration

For reference, these files were modified/created during the migration:

**New (LLM module)**:

- `server/src/llm/vertex-client.ts`
- `server/src/llm/message-adapter.ts`
- `server/src/llm/pricing.ts`
- `server/src/llm/errors.ts`
- `server/src/llm/retry.ts`
- `server/src/llm/index.ts`
- `server/test/helpers/mock-gemini.ts`

**Modified**:

- `server/src/agent/orchestrator/base-orchestrator.ts`
- `server/src/agent/orchestrator/types.ts`
- Various system prompts

---

**Created**: January 13, 2026
**For**: Phase 4 manual testing continuation
