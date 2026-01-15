# Vertex AI Migration: Continue Phase 1

## Context

We are migrating MAIS from Anthropic to Google Vertex AI (Gemini-native).

**Branch**: `migrate-to-google`
**Phase 0**: ✅ Complete (committed)
**Phase 1**: 🔄 Ready to start

## Current State

- `@google/genai@1.35.0` installed
- `@anthropic-ai/sdk` removed (causes expected test failures)
- Environment configured: `GOOGLE_VERTEX_PROJECT=handled-484216`, `GOOGLE_VERTEX_LOCATION=global`
- ADC configured with quota project

## Files Needing Migration

Two files still import `@anthropic-ai/sdk` and cause test failures:

1. `server/src/agent/orchestrator/base-orchestrator.ts:18`
2. `server/src/agent/evals/evaluator.ts:11`

## Phase 1 Deliverables

Create the thin LLM abstraction layer (3 modules):

| File                                | Purpose                                    |
| ----------------------------------- | ------------------------------------------ |
| `server/src/llm/vertex-client.ts`   | Auth (ADC), model selection, safety config |
| `server/src/llm/message-adapter.ts` | ChatMessage → Gemini Content, tool schemas |
| `server/src/llm/pricing.ts`         | Cost calculation, usage logging            |
| `server/src/llm/index.ts`           | Module exports                             |

Then update:

- `base-orchestrator.ts` → Use LLM module instead of Anthropic
- `evaluator.ts` → Use LLM module instead of Anthropic
- `server/src/agent/orchestrator/types.ts` → Update model types
- `server/src/agent/tracing/types.ts` → Update cost tracking

## Model IDs (Canonical from Vertex AI docs)

```typescript
GEMINI_MODELS = {
  FLASH: 'gemini-3-flash-preview', // Primary
  FLASH_STABLE: 'gemini-2.5-flash', // Fallback (GA)
  PRO: 'gemini-3-pro-preview', // Premium
};
```

## Key API Difference

Gemini uses `role: 'user'` for function responses, NOT a dedicated `'tool'` role:

```typescript
// Vertex AI function response format
{
  role: 'user',  // NOT 'tool'!
  parts: [{
    functionResponse: {
      name: 'tool_name',
      response: { result: data }
    }
  }]
}
```

## Command to Start

```
git checkout migrate-to-google
/workflows:work plans/VERTEX-AI-IMPLEMENTATION-PLAN.md
```

Focus on Phase 1 section. The plan has complete code examples for each module.

## Success Criteria

- [ ] All 4 LLM module files created
- [ ] `base-orchestrator.ts` updated to use LLM module
- [ ] `evaluator.ts` updated to use LLM module
- [ ] `npm run typecheck` passes
- [ ] `npm test` passes (all 87 test suites)
- [ ] Phase 1 checklist in plan updated

## Rules

- Enterprise quality only — no shortcuts
- Use ADC for auth (never key files)
- Follow existing MAIS patterns (logger, DI, etc.)
- Run typecheck and tests before marking complete
