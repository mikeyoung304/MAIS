# AI Hygiene Report - MAIS Platform

**Agent:** B4 - AI Bloat & AI Hygiene
**Date:** 2025-12-26
**Repository:** /Users/mikeyoung/CODING/MAIS
**Status:** Production (main branch)

---

## Executive Summary

**Finding:** MAIS currently has **NO production AI/LLM integration**. The platform does not include any OpenAI, Anthropic, or other AI SDK dependencies. However, a comprehensive AI integration plan exists as a **DEFERRED feature** (`docs/archive/2025-12/2025-12-03_feat-ai-powered-storefront-configuration-DEFERRED.md`).

**Risk Level:** LOW (no current AI exposure)

**Recommendation:** The existing security infrastructure (input sanitization, rate limiting, logging) provides a solid foundation for future AI integration. When AI features are implemented, follow the security patterns already documented in the deferred feature specification.

---

## 1. AI Surfaces Inventory

### 1.1 Current AI/LLM Dependencies

**NONE FOUND** - No AI-related packages in any `package.json`:

| Package              | server | apps/web | client | contracts | shared |
| -------------------- | ------ | -------- | ------ | --------- | ------ |
| `openai`             | -      | -        | -      | -         | -      |
| `@anthropic-ai/sdk`  | -      | -        | -      | -         | -      |
| `langchain`          | -      | -        | -      | -         | -      |
| `ai` (Vercel AI SDK) | -      | -        | -      | -         | -      |
| `cohere-ai`          | -      | -        | -      | -         | -      |
| `replicate`          | -      | -        | -      | -         | -      |

### 1.2 AI-Related Code Patterns

**Search Results:**

| Pattern                               | Files Found | Notes                                       |
| ------------------------------------- | ----------- | ------------------------------------------- |
| `openai\|anthropic\|claude\|gpt\|llm` | 547         | Documentation only (CLAUDE.md, plans, docs) |
| `prompt\|system.*message`             | 1           | Seed file only (`little-bit-horse-farm.ts`) |
| `agent\|assistant\|chat\|model`       | 29          | UI components (chat UX), not AI agents      |

**Conclusion:** All AI-related string matches are in documentation files, seed data, or UI component naming (e.g., "chat" for messaging UX, not AI chatbots).

### 1.3 Deferred AI Feature Specification

**File:** `/Users/mikeyoung/CODING/MAIS/docs/archive/2025-12/2025-12-03_feat-ai-powered-storefront-configuration-DEFERRED.md`

**Status:** DEFERRED (documented but not implemented)

**Planned Features:**

1. Developer-facing Claude Code CLI integration
2. Customer-facing tenant chatbot for storefront configuration
3. Semantic naming system for AI-driven editing
4. Tool definitions for Claude (get_storefront_config, update_branding, bulk_update_packages)

**Planned Dependencies:**

- `@anthropic-ai/sdk` - Claude API client
- `ai` (Vercel AI SDK) - React hooks for streaming chat

---

## 2. Prompt Engineering Issues

**N/A** - No prompts exist in the codebase.

### 2.1 Deferred Feature Analysis

The deferred specification includes well-documented prompt patterns:

```typescript
// From deferred spec - good pattern
const buildPrompt = (userMessage: string, context: StorefrontContext) => `
<system_prompt>
You are a storefront configuration assistant for MAIS platform.
</system_prompt>

<user_message>
${userMessage}
</user_message>
`;
```

**Issues in Deferred Spec:**

- Prompt versioning not addressed
- No prompt registry or centralized management
- Missing prompt testing strategy

**Recommendations for Future:**

1. Create `server/src/prompts/` directory with versioned prompt files
2. Add prompt templates to contracts package for type safety
3. Include prompt unit tests in test suite

---

## 3. Token Waste Analysis

**N/A** - No AI calls to analyze.

### 3.1 Potential Token Waste Surfaces (Future Risk)

When AI integration is added, monitor these areas:

| Surface                       | Risk   | Mitigation Strategy                              |
| ----------------------------- | ------ | ------------------------------------------------ |
| Full tenant config in context | HIGH   | Use `include` filters (already in deferred spec) |
| Package descriptions          | MEDIUM | Truncate to 500 chars for AI context             |
| Audit log history             | MEDIUM | Limit to last 10 entries                         |
| Conversation memory           | HIGH   | Implement sliding window (not in deferred spec)  |

---

## 4. Missing AI Infrastructure

Since no AI integration exists, this section documents what infrastructure ALREADY EXISTS that would support AI:

### 4.1 Existing Infrastructure (Reusable for AI)

| Infrastructure     | Status | Location                                  |
| ------------------ | ------ | ----------------------------------------- |
| Rate Limiting      | EXISTS | `server/src/middleware/rateLimiter.ts`    |
| Input Sanitization | EXISTS | `server/src/lib/sanitization.ts`          |
| Request Logging    | EXISTS | `server/src/middleware/request-logger.ts` |
| Error Handling     | EXISTS | `server/src/middleware/error-handler.ts`  |
| Audit Trail        | EXISTS | `server/src/services/audit.service.ts`    |
| Redis/Cache        | EXISTS | BullMQ, ioredis (for webhook queue)       |
| Zod Validation     | EXISTS | `packages/contracts/`                     |

### 4.2 Missing Infrastructure (Needed for AI)

| Infrastructure                 | Priority | Recommendation                            |
| ------------------------------ | -------- | ----------------------------------------- |
| AI Response Caching            | HIGH     | Add TTL-based cache for identical prompts |
| Token Budget Tracking          | HIGH     | Implement per-tenant token counters       |
| AI-specific Rate Limiting      | MEDIUM   | Extend rateLimiter.ts for AI endpoints    |
| Retry with Exponential Backoff | MEDIUM   | Use existing BullMQ patterns              |
| Cost Monitoring                | HIGH     | Add billing.service.ts for token costs    |
| Circuit Breaker                | MEDIUM   | Implement for AI provider outages         |

### 4.3 Infrastructure Gaps Analysis

```
Current State                 AI-Ready State
--------------                ---------------
Rate limit: 5/15min (auth)    Need: 10/min (AI commands)
Cache: Application-level      Need: + Semantic cache for prompts
Logging: Request/response     Need: + Token usage, model, latency
Retry: None for external      Need: Exponential backoff for AI APIs
Cost: N/A                     Need: Per-tenant token budgets
```

---

## 5. Missing Observability

### 5.1 Current Observability Stack

| Component      | Status | Notes                            |
| -------------- | ------ | -------------------------------- |
| Sentry         | EXISTS | `@sentry/node`, `@sentry/react`  |
| Pino Logger    | EXISTS | Structured logging throughout    |
| Request Logger | EXISTS | Logs HTTP method, path, duration |
| Audit Service  | EXISTS | Tracks config changes            |

### 5.2 AI-Specific Observability Gaps

| Gap                      | Priority | Recommendation                               |
| ------------------------ | -------- | -------------------------------------------- |
| AI interaction logging   | HIGH     | Log prompt hash, token count, model, latency |
| PII redaction in logs    | CRITICAL | Already handled by sanitization.ts           |
| Token usage telemetry    | HIGH     | Add OpenTelemetry counters                   |
| Model version tracking   | MEDIUM   | Include in audit trail                       |
| Response quality metrics | LOW      | Track user confirmations vs rejections       |

### 5.3 Recommended Logging Schema

```typescript
// server/src/services/ai-telemetry.service.ts (future)
interface AIInteractionLog {
  tenantId: string;
  sessionId: string;
  promptHash: string; // SHA-256 of prompt (not content)
  model: string; // 'claude-3-opus', etc.
  inputTokens: number;
  outputTokens: number;
  latencyMs: number;
  toolsUsed: string[];
  status: 'success' | 'error' | 'timeout';
  estimatedCostUsd: number;
  // NO prompt content, NO user input, NO PII
}
```

---

## 6. Prompt Injection Surfaces

### 6.1 Current Security Posture

**Existing Defenses:**

| Defense                  | Location              | Coverage               |
| ------------------------ | --------------------- | ---------------------- |
| XSS Sanitization         | `sanitization.ts`     | HTML, plain text, URLs |
| Zod Schema Validation    | `contracts/`          | All API inputs         |
| Input Escaping           | `sanitizePlainText()` | Text fields            |
| SQL Injection Prevention | Prisma ORM            | All queries            |

### 6.2 Prompt Injection Readiness

When AI is added, these patterns provide defense-in-depth:

**Good Pattern (from deferred spec):**

```typescript
// Tool use with strict schemas - protects against injection
const AGENT_TOOLS: Tool[] = [
  {
    name: 'update_branding',
    input_schema: {
      type: 'object',
      properties: {
        primaryColor: { type: 'string', pattern: '^#[0-9A-Fa-f]{6}$' },
      },
    },
    strict: true, // Claude rejects invalid input
  },
];
```

**Missing Patterns:**

1. No output validation after AI responses
2. No allowlist for AI-generated content types
3. No sandbox for AI-generated code execution

### 6.3 Prompt Injection Checklist (Future)

| Checkpoint                               | Status  | Notes                     |
| ---------------------------------------- | ------- | ------------------------- |
| Use tool/function calling, not freeform  | PLANNED | In deferred spec          |
| Strict Zod schemas for tool inputs       | EXISTS  | Pattern available         |
| XML tags to separate system/user prompts | PLANNED | In deferred spec          |
| Validate AI outputs before persistence   | MISSING | Add output schemas        |
| Sanitize AI outputs before rendering     | EXISTS  | XSS sanitization          |
| No eval/exec of AI-generated code        | N/A     | No code execution planned |

---

## 7. Standardization Plan

### 7.1 Recommended AI Integration Standards

When AI features are implemented, adopt these standards:

#### 7.1.1 Input/Output Schemas

```typescript
// packages/contracts/src/ai.contracts.ts (future)
import { z } from 'zod';

export const AICommandInputSchema = z.object({
  tenantId: z.string().cuid(),
  sessionId: z.string().uuid(),
  command: z.string().max(2000),
  dryRun: z.boolean().default(true),
  maxTokens: z.number().min(100).max(4000).default(1000),
});

export const AICommandOutputSchema = z.object({
  success: z.boolean(),
  toolsExecuted: z.array(z.string()),
  preview: z.string().optional(),
  changes: z.array(
    z.object({
      entityType: z.enum(['Package', 'Segment', 'Branding']),
      entityId: z.string(),
      field: z.string(),
      oldValue: z.unknown(),
      newValue: z.unknown(),
    })
  ),
});
```

#### 7.1.2 Caching Strategy

```typescript
// server/src/services/ai-cache.service.ts (future)
interface AICacheStrategy {
  // Cache key: tenant + prompt_hash + tool
  keyPattern: 'ai:${tenantId}:${promptHash}:${tool}';

  // TTL by response type
  ttlByType: {
    read_only: '1 hour'; // get_storefront_config
    write_preview: '5 minutes'; // dryRun=true
    write_execute: 'never'; // Mutations not cached
  };

  // Invalidation triggers
  invalidateOn: ['config.updated', 'package.created', 'branding.changed'];
}
```

#### 7.1.3 Retry/Backoff Standards

```typescript
// server/src/adapters/ai.adapter.ts (future)
const AI_RETRY_CONFIG = {
  maxRetries: 3,
  initialDelayMs: 1000,
  maxDelayMs: 30000,
  backoffMultiplier: 2,
  retryableErrors: ['rate_limit', 'overloaded', 'timeout'],
  nonRetryableErrors: ['invalid_api_key', 'content_policy'],
};
```

#### 7.1.4 Tracing Conventions

```typescript
// OpenTelemetry spans for AI calls
const span = tracer.startSpan('ai.claude.completion', {
  attributes: {
    'ai.model': 'claude-3-opus',
    'ai.tenant_id': tenantId,
    'ai.prompt_hash': sha256(prompt),
    'ai.max_tokens': maxTokens,
    // Never log: prompt content, user input, PII
  },
});
```

#### 7.1.5 Cost Monitoring Approach

```typescript
// server/src/services/ai-billing.service.ts (future)
interface TokenBudget {
  tenantId: string;
  monthlyLimit: number; // e.g., 1_000_000 tokens
  dailyLimit: number; // e.g., 50_000 tokens
  currentMonthUsage: number;
  currentDayUsage: number;
  alertThreshold: 0.8; // Alert at 80%
}

// Pricing (Claude Opus 4.5 estimate)
const TOKEN_PRICING = {
  input: 0.015 / 1000, // $0.015 per 1K input tokens
  output: 0.075 / 1000, // $0.075 per 1K output tokens
};
```

---

## 8. Beneficial AI Additions vs Over-Engineering

### 8.1 High-Value AI Opportunities

| Opportunity                       | Value  | Effort | Recommendation                |
| --------------------------------- | ------ | ------ | ----------------------------- |
| Storefront config assistant       | HIGH   | HIGH   | IMPLEMENT (per deferred spec) |
| Bulk package price updates        | HIGH   | MEDIUM | IMPLEMENT                     |
| Semantic search for packages      | MEDIUM | MEDIUM | DEFER                         |
| AI-generated package descriptions | MEDIUM | LOW    | DEFER                         |
| Smart booking time suggestions    | LOW    | HIGH   | SKIP                          |

### 8.2 Over-Engineering Risks

| Anti-Pattern                | Risk     | Why to Avoid          |
| --------------------------- | -------- | --------------------- |
| AI for simple CRUD          | HIGH     | Existing UI is faster |
| AI-generated code execution | CRITICAL | Security nightmare    |
| Real-time AI suggestions    | MEDIUM   | Latency kills UX      |
| Multi-agent orchestration   | HIGH     | Complexity vs value   |

### 8.3 Implementation Priority

```
Phase 1 (Q1 2026): Developer-facing CLI integration
  - Lower risk, faster iteration
  - Validates tool definitions
  - Builds team AI expertise

Phase 2 (Q2 2026): Read-only chatbot
  - Answers tenant questions
  - No write operations
  - Safe experimentation

Phase 3 (Q3 2026): Write-enabled chatbot
  - Requires robust testing
  - Full audit trail
  - Production guardrails
```

---

## 9. File References

### 9.1 Existing Security Infrastructure

| File                                                                   | Purpose                            |
| ---------------------------------------------------------------------- | ---------------------------------- |
| `/Users/mikeyoung/CODING/MAIS/server/src/lib/sanitization.ts`          | XSS prevention, input sanitization |
| `/Users/mikeyoung/CODING/MAIS/server/src/middleware/rateLimiter.ts`    | Rate limiting middleware           |
| `/Users/mikeyoung/CODING/MAIS/server/src/middleware/request-logger.ts` | Request/response logging           |
| `/Users/mikeyoung/CODING/MAIS/server/src/services/audit.service.ts`    | Config change audit trail          |
| `/Users/mikeyoung/CODING/MAIS/server/src/lib/ports.ts`                 | Repository interfaces              |

### 9.2 Deferred AI Documentation

| File                                                                                                                | Purpose                           |
| ------------------------------------------------------------------------------------------------------------------- | --------------------------------- |
| `/Users/mikeyoung/CODING/MAIS/docs/archive/2025-12/2025-12-03_feat-ai-powered-storefront-configuration-DEFERRED.md` | Full AI integration specification |

### 9.3 Package Dependencies (No AI)

| File                                                           | AI Dependencies |
| -------------------------------------------------------------- | --------------- |
| `/Users/mikeyoung/CODING/MAIS/package.json`                    | None            |
| `/Users/mikeyoung/CODING/MAIS/server/package.json`             | None            |
| `/Users/mikeyoung/CODING/MAIS/apps/web/package.json`           | None            |
| `/Users/mikeyoung/CODING/MAIS/client/package.json`             | None            |
| `/Users/mikeyoung/CODING/MAIS/packages/contracts/package.json` | None            |

---

## 10. Conclusion

### 10.1 Key Findings

1. **No Current AI Integration:** MAIS has zero AI/LLM dependencies or code.
2. **Strong Security Foundation:** Existing sanitization, rate limiting, and audit infrastructure is production-ready.
3. **Well-Documented Future Plan:** The deferred AI feature spec includes security-conscious patterns (tool use, strict schemas, audit trails).
4. **Infrastructure Gaps Identified:** Missing AI-specific caching, token budgets, and observability.

### 10.2 Recommendations

| Priority | Action                                              | Owner    |
| -------- | --------------------------------------------------- | -------- |
| P0       | When adding AI, implement token budget tracking     | Backend  |
| P0       | Add output validation for AI responses              | Backend  |
| P1       | Create AI-specific rate limiter (10/min/tenant)     | Backend  |
| P1       | Add OpenTelemetry spans for AI calls                | Platform |
| P2       | Implement semantic caching for read-only AI queries | Backend  |
| P2       | Build cost monitoring dashboard                     | Frontend |

### 10.3 Risk Summary

| Category         | Current Risk | Future Risk (with AI) | Mitigation                |
| ---------------- | ------------ | --------------------- | ------------------------- |
| Prompt Injection | N/A          | MEDIUM                | Tool use + Zod schemas    |
| Token Waste      | N/A          | HIGH                  | Caching + budgets         |
| Cost Overrun     | N/A          | HIGH                  | Per-tenant limits         |
| Data Leakage     | LOW          | MEDIUM                | Tenant scoping in prompts |
| Observability    | LOW          | MEDIUM                | Add AI telemetry          |

---

**Report Generated By:** Agent B4 - AI Bloat & AI Hygiene
**Reviewed By:** Pending
**Next Review:** When AI integration begins
