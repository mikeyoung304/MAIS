# Vertex AI Migration: Google-Native Architecture

**Project**: MAIS (gethandled.ai)
**Strategy**: Full Google Ecosystem Migration
**Date**: January 13, 2026
**Status**: APPROVED FOR IMPLEMENTATION

---

## Executive Summary

**Decision**: Full migration to Google Vertex AI with Gemini models. No hybrid approach. No Anthropic fallback.

**Rationale**:

- No production data requiring migration
- All current tenants are test/demo (can wipe)
- Strategic commitment to Google ecosystem
- Simpler architecture = fewer bugs
- Access to multimodal (Imagen, Veo) and UCP for future

**Effort**: 60-74 hours (4-5 weeks)
**Cost Savings**: 70-85% vs current Anthropic usage

---

## Architecture: Before & After

### Before (Current)

```
User → Express API → BaseOrchestrator → Anthropic SDK → Claude
```

### After (Google-Native)

```
User → Express API → BaseOrchestrator → @google/genai SDK → Gemini
```

**Key Change**: Replace `@anthropic-ai/sdk` with `@google/genai`. No abstraction layer needed.

---

## Phase 0: Google Cloud Setup (Day 1-2) — 8 hours

### Step 1: Create Project & Enable APIs

```bash
# Create project (or use existing)
gcloud projects create mais-production --name="MAIS Production"
gcloud config set project mais-production

# Link billing
gcloud billing projects link mais-production \
  --billing-account=YOUR_BILLING_ACCOUNT_ID

# Enable Vertex AI
gcloud services enable aiplatform.googleapis.com

# Enable other services for future phases
gcloud services enable storage.googleapis.com      # For multimodal assets
gcloud services enable secretmanager.googleapis.com # For production secrets
```

### Step 2: Create Service Account

```bash
# Create service account
gcloud iam service-accounts create mais-agent \
  --display-name="MAIS Agent Service Account" \
  --description="Service account for AI agent operations"

# Grant minimum permissions
gcloud projects add-iam-policy-binding mais-production \
  --member="serviceAccount:mais-agent@mais-production.iam.gserviceaccount.com" \
  --role="roles/aiplatform.user"

# For local development only - use Application Default Credentials
gcloud auth application-default login
```

### Step 3: Configure Environment

```bash
# server/.env
GOOGLE_VERTEX_PROJECT=mais-production
GOOGLE_VERTEX_LOCATION=us-central1

# Local dev uses ADC automatically
# Production uses Workload Identity (no env vars needed)
```

### Step 4: Install SDK

```bash
npm uninstall @anthropic-ai/sdk
npm install @google/genai
```

**Success Criteria**:

- [ ] Can run `gcloud auth application-default print-access-token`
- [ ] Project has `aiplatform.googleapis.com` enabled
- [ ] No service account key files in codebase

---

## Phase 1: Core Migration (Week 1) — 16-20 hours

### 1.1 Create Gemini Client

```typescript
// server/src/llm/gemini-client.ts
import { GoogleGenAI } from '@google/genai';

export function createGeminiClient(): GoogleGenAI {
  return new GoogleGenAI({
    vertexai: true,
    project: process.env.GOOGLE_VERTEX_PROJECT!,
    location: process.env.GOOGLE_VERTEX_LOCATION || 'us-central1',
  });
}

// Singleton for the application
let client: GoogleGenAI | null = null;

export function getGeminiClient(): GoogleGenAI {
  if (!client) {
    client = createGeminiClient();
  }
  return client;
}
```

### 1.2 Update Base Orchestrator

```typescript
// server/src/agent/orchestrator/base-orchestrator.ts

// Remove
import Anthropic from '@anthropic-ai/sdk';

// Add
import { getGeminiClient } from '../../llm/gemini-client';
import { GenerateContentRequest, Content, Part, Tool } from '@google/genai';

export abstract class BaseOrchestrator {
  protected readonly gemini: GoogleGenAI;

  constructor(
    protected readonly prisma: PrismaClient,
    cache: ContextCache = defaultContextCache
  ) {
    this.cache = cache;
    this.gemini = getGeminiClient();
  }

  // Update chat method
  protected async callLLM(
    systemPrompt: string,
    messages: ChatMessage[],
    tools: AgentTool[]
  ): Promise<GenerateContentResponse> {
    const config = this.getConfig();

    const contents = this.formatMessagesForGemini(messages);
    const geminiTools = this.formatToolsForGemini(tools);

    const response = await this.gemini.models.generateContent({
      model: config.model, // 'gemini-2.5-flash'
      systemInstruction: { parts: [{ text: systemPrompt }] },
      contents,
      config: {
        maxOutputTokens: config.maxTokens,
        temperature: config.temperature,
        tools: geminiTools.length > 0 ? [{ functionDeclarations: geminiTools }] : undefined,
      },
    });

    return response;
  }
}
```

### 1.3 Message Format Translation

```typescript
// server/src/llm/format.ts

export function formatMessagesForGemini(messages: ChatMessage[]): Content[] {
  return messages.map((msg) => ({
    role: msg.role === 'assistant' ? 'model' : 'user',
    parts: [{ text: msg.content }],
  }));
}

export function formatToolsForGemini(tools: AgentTool[]): FunctionDeclaration[] {
  return tools.map((tool) => ({
    name: tool.name,
    description: tool.description,
    parameters: convertJsonSchemaToGemini(tool.inputSchema),
  }));
}

function convertJsonSchemaToGemini(schema: JSONSchema): Schema {
  // JSON Schema is compatible - just need to map types
  return {
    type: mapType(schema.type),
    properties: schema.properties
      ? Object.fromEntries(
          Object.entries(schema.properties).map(([k, v]) => [k, convertJsonSchemaToGemini(v)])
        )
      : undefined,
    required: schema.required,
    description: schema.description,
  };
}

function mapType(type: string): Type {
  const typeMap: Record<string, Type> = {
    string: Type.STRING,
    number: Type.NUMBER,
    integer: Type.INTEGER,
    boolean: Type.BOOLEAN,
    array: Type.ARRAY,
    object: Type.OBJECT,
  };
  return typeMap[type] || Type.STRING;
}
```

### 1.4 Tool Call Response Handling

```typescript
// server/src/llm/response.ts

export function extractToolCalls(response: GenerateContentResponse): ToolCall[] {
  const toolCalls: ToolCall[] = [];

  for (const candidate of response.candidates || []) {
    for (const part of candidate.content?.parts || []) {
      if (part.functionCall) {
        toolCalls.push({
          id: crypto.randomUUID(), // Gemini doesn't provide IDs
          name: part.functionCall.name,
          input: part.functionCall.args,
        });
      }
    }
  }

  return toolCalls;
}

export function formatToolResultForGemini(toolCall: ToolCall, result: AgentToolResult): Content {
  return {
    role: 'user', // Tool results go in user role for Gemini
    parts: [
      {
        functionResponse: {
          name: toolCall.name,
          response: { result: result.data || result.error },
        },
      },
    ],
  };
}
```

### 1.5 Update Model Configuration

```typescript
// server/src/agent/orchestrator/config.ts

export const DEFAULT_ORCHESTRATOR_CONFIG: OrchestratorConfig = {
  model: 'gemini-2.5-flash', // Was: claude-sonnet-4-20250514
  maxTokens: 4096,
  temperature: 0.7,
  maxHistoryMessages: 20,
  maxRecursionDepth: 19,
};

export const CUSTOMER_CONFIG: OrchestratorConfig = {
  model: 'gemini-2.5-flash', // Fast, cheap for customer queries
  maxTokens: 2048,
  temperature: 0.7,
  maxHistoryMessages: 10,
  maxRecursionDepth: 10,
};

export const EVAL_MODEL = 'gemini-2.5-flash'; // Was: claude-haiku-4-5
```

### 1.6 Update Cost Tracking

```typescript
// server/src/agent/tracing/types.ts

export const COST_PER_1K_TOKENS: Record<string, { input: number; output: number }> = {
  // Gemini models (Vertex AI pricing, January 2026)
  'gemini-2.5-flash': { input: 0.0003, output: 0.0025 },
  'gemini-2.5-flash-lite': { input: 0.0001, output: 0.0004 },
  'gemini-2.5-pro': { input: 0.00125, output: 0.01 },
  'gemini-3-pro': { input: 0.002, output: 0.012 },

  // Remove Claude models (optional: keep for historical traces)
};
```

**Success Criteria**:

- [ ] `npm run typecheck` passes
- [ ] Basic chat works with Gemini
- [ ] Tool calling works with Gemini
- [ ] Existing tests pass (may need mock updates)

---

## Phase 2: Prompt Engineering for Gemini (Week 2) — 12-16 hours

### 2.1 Audit Current Prompts

Gemini responds differently to prompt patterns. Review and update:

| Prompt File                   | Changes Needed                                           |
| ----------------------------- | -------------------------------------------------------- |
| `onboarding-system-prompt.ts` | Remove Claude-specific constraints ("Never say: Great!") |
| `customer-system-prompt.ts`   | Adjust verbosity targets                                 |
| `admin-system-prompt.ts`      | Review tool usage instructions                           |

### 2.2 Gemini Prompt Best Practices

```typescript
// Gemini-optimized prompt patterns

// DO: Be explicit about output format
const systemPrompt = `
You are a business assistant for ${businessName}.

## Response Format
- Keep responses to 2-3 sentences
- Use bullet points for lists
- Always confirm before taking actions

## Tool Usage
When the user asks about availability, call check_availability first.
When the user wants to book, call book_service with the confirmed details.

## Personality
Friendly and professional. Direct answers without excessive pleasantries.
`;

// DON'T: Use Claude-specific meta-instructions
// - "Never say 'I'd be happy to'" (Gemini doesn't naturally say this)
// - "Use these confirmations: bet, done, got it" (May confuse Gemini)
```

### 2.3 Test Prompt Quality

Create a prompt test suite:

```typescript
// server/src/agent/__tests__/prompt-quality.test.ts

describe('Gemini Prompt Quality', () => {
  it('should respond concisely to simple queries', async () => {
    const response = await orchestrator.chat(tenantId, 'What are your hours?');
    expect(response.length).toBeLessThan(500); // Characters
  });

  it('should call correct tool for availability check', async () => {
    const response = await orchestrator.chat(tenantId, 'Are you free next Tuesday?');
    expect(response.toolCalls).toContainEqual(
      expect.objectContaining({ name: 'check_availability' })
    );
  });

  it('should maintain professional tone', async () => {
    const response = await orchestrator.chat(tenantId, 'Thanks!');
    expect(response.text).not.toMatch(/No problem!|You're welcome!/i);
    // Should be more professional
  });
});
```

### 2.4 Safety Settings

```typescript
// server/src/llm/gemini-client.ts

import { HarmCategory, HarmBlockThreshold } from '@google/genai';

const SAFETY_SETTINGS = [
  {
    category: HarmCategory.HARM_CATEGORY_HATE_SPEECH,
    threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE,
  },
  {
    category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT,
    threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE,
  },
  {
    category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT,
    threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE,
  },
  {
    category: HarmCategory.HARM_CATEGORY_HARASSMENT,
    threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE,
  },
];

// Include in all generateContent calls
config: {
  safetySettings: SAFETY_SETTINGS,
  // ... other config
}
```

**Success Criteria**:

- [ ] All 3 orchestrators produce quality responses
- [ ] Tool calling accuracy matches or exceeds Claude baseline
- [ ] No safety filter false positives in testing
- [ ] Response length within acceptable bounds

---

## Phase 3: Reliability & Observability (Week 3) — 12-16 hours

### 3.1 Error Handling

```typescript
// server/src/llm/errors.ts

export enum GeminiErrorType {
  RATE_LIMITED = 'RATE_LIMITED',
  CONTENT_BLOCKED = 'CONTENT_BLOCKED',
  CONTEXT_TOO_LONG = 'CONTEXT_TOO_LONG',
  SERVICE_UNAVAILABLE = 'SERVICE_UNAVAILABLE',
  UNKNOWN = 'UNKNOWN',
}

export function classifyGeminiError(error: unknown): GeminiErrorType {
  if (error instanceof Error) {
    const message = error.message.toLowerCase();

    if (message.includes('resource_exhausted') || message.includes('quota')) {
      return GeminiErrorType.RATE_LIMITED;
    }
    if (message.includes('safety') || message.includes('blocked')) {
      return GeminiErrorType.CONTENT_BLOCKED;
    }
    if (message.includes('context') || message.includes('token')) {
      return GeminiErrorType.CONTEXT_TOO_LONG;
    }
    if (message.includes('unavailable') || message.includes('deadline')) {
      return GeminiErrorType.SERVICE_UNAVAILABLE;
    }
  }
  return GeminiErrorType.UNKNOWN;
}
```

### 3.2 Retry Logic

```typescript
// server/src/agent/utils/retry.ts

export const GEMINI_RETRY_CONFIG = {
  maxRetries: 3,
  baseDelayMs: 1000,
  maxDelayMs: 10000,
  backoffMultiplier: 2,
  retryableErrors: [GeminiErrorType.RATE_LIMITED, GeminiErrorType.SERVICE_UNAVAILABLE],
};

export async function withGeminiRetry<T>(
  operation: () => Promise<T>,
  config = GEMINI_RETRY_CONFIG
): Promise<T> {
  let lastError: Error | undefined;

  for (let attempt = 0; attempt < config.maxRetries; attempt++) {
    try {
      return await operation();
    } catch (error) {
      lastError = error as Error;
      const errorType = classifyGeminiError(error);

      if (!config.retryableErrors.includes(errorType)) {
        throw error; // Non-retryable
      }

      const delay = Math.min(
        config.baseDelayMs * Math.pow(config.backoffMultiplier, attempt),
        config.maxDelayMs
      );

      await sleep(delay);
    }
  }

  throw lastError;
}
```

### 3.3 Idempotency for T2/T3 Tools

```typescript
// server/src/agent/tools/idempotency.ts

export function generateIdempotencyKey(
  sessionId: string,
  turnNumber: number,
  toolName: string
): string {
  return `idempotent:${sessionId}:${turnNumber}:${toolName}`;
}

export async function executeWithIdempotency<T>(
  key: string,
  operation: () => Promise<T>,
  ttlSeconds: number = 3600
): Promise<{ result: T; cached: boolean }> {
  // Check cache first
  const cached = await redis.get(key);
  if (cached) {
    return { result: JSON.parse(cached), cached: true };
  }

  // Execute operation
  const result = await operation();

  // Cache result
  await redis.setex(key, ttlSeconds, JSON.stringify(result));

  return { result, cached: false };
}
```

### 3.4 Update Tracing

```typescript
// server/src/agent/tracing/tracer.ts

// Add provider field to all traces
interface TraceContext {
  tenantId: string;
  sessionId: string;
  agentType: string;
  provider: 'vertex';  // Always vertex now
  model: string;       // e.g., 'gemini-2.5-flash'
}

// Update metrics
recordLLMCall(model: string, latencyMs: number, tokensIn: number, tokensOut: number);
```

**Success Criteria**:

- [ ] Errors are properly classified and logged
- [ ] Retries work for transient failures
- [ ] T2/T3 tools are idempotent
- [ ] Traces include model information

---

## Phase 4: Testing & Wipeout (Week 4) — 8-12 hours

### 4.1 Update Test Mocks

```typescript
// server/test/helpers/mock-gemini.ts

import { vi } from 'vitest';

export function createMockGeminiClient() {
  return {
    models: {
      generateContent: vi.fn().mockResolvedValue({
        candidates: [
          {
            content: {
              parts: [{ text: 'Mock response' }],
            },
          },
        ],
        usageMetadata: {
          promptTokenCount: 100,
          candidatesTokenCount: 50,
        },
      }),
    },
  };
}
```

### 4.2 Run Full Test Suite

```bash
# Type checking
npm run typecheck

# Unit tests
npm test

# Integration tests
npm run test:integration

# E2E tests
npm run test:e2e
```

### 4.3 Data Cleanup (Optional)

Since all tenants are test data, optionally wipe for fresh start:

```sql
-- WARNING: Only run in development!
-- This deletes ALL tenant data

TRUNCATE TABLE "AgentSession" CASCADE;
TRUNCATE TABLE "AgentProposal" CASCADE;
TRUNCATE TABLE "ConversationTrace" CASCADE;
TRUNCATE TABLE "Booking" CASCADE;
TRUNCATE TABLE "Customer" CASCADE;
-- Add other tables as needed

-- Or reset entire database
-- npm run db:reset
```

### 4.4 Smoke Test Checklist

- [ ] Onboarding flow works end-to-end
- [ ] Customer chat can check availability
- [ ] Customer chat can book a service
- [ ] Admin dashboard functions properly
- [ ] Tool calls execute correctly
- [ ] Proposals create and confirm properly

**Success Criteria**:

- [ ] All tests pass
- [ ] Smoke tests pass
- [ ] No console errors in browser
- [ ] Costs are tracking correctly

---

## Phase 5: Future Capabilities (Week 5+) — Optional

### 5.1 Context Caching

```typescript
// Enable implicit caching (automatic, 90% discount)
// No code changes needed - Vertex AI handles this

// For explicit caching (large static content):
const cache = await gemini.caches.create({
  model: 'gemini-2.5-flash',
  contents: [{ text: STATIC_SYSTEM_PROMPT }],
  ttl: '3600s',
});
```

### 5.2 Image Generation (Imagen 4)

```typescript
// server/src/agent/tools/multimodal-tools.ts

export const generateImage: AgentTool = {
  name: 'generate_proposal_image',
  trustTier: 'T2',
  description: 'Generate a custom image for proposals',
  inputSchema: {
    type: 'object',
    properties: {
      prompt: { type: 'string' },
      style: { type: 'string', enum: ['professional', 'creative'] },
    },
    required: ['prompt'],
  },
  async execute(context, params) {
    const response = await gemini.models.generateImages({
      model: 'imagen-4.0-generate-001',
      prompt: params.prompt as string,
      config: { numberOfImages: 1 },
    });

    // Upload to GCS and return URL
    const imageUrl = await uploadToGCS(response.images[0].imageBytes);
    return { success: true, data: { imageUrl } };
  },
};
```

### 5.3 Google UCP Integration

When ready for agent-to-agent commerce:

```typescript
// Expose MAIS as a UCP merchant
// GET /.well-known/ucp
{
  "name": "dev.ucp.shopping.checkout",
  "version": "2026-01-11",
  "capabilities": ["check_availability", "create_booking"]
}
```

---

## Migration Checklist

### Pre-Migration

- [ ] Google Cloud project created
- [ ] Vertex AI API enabled
- [ ] Service account created with `roles/aiplatform.user`
- [ ] Local dev uses Application Default Credentials
- [ ] `@google/genai` installed

### Core Migration

- [ ] `BaseOrchestrator` updated to use Gemini
- [ ] Message formatting implemented
- [ ] Tool schema translation implemented
- [ ] Tool result handling implemented
- [ ] Model configuration updated
- [ ] Cost tracking updated

### Prompt Engineering

- [ ] Onboarding prompts updated for Gemini
- [ ] Customer prompts updated for Gemini
- [ ] Admin prompts updated for Gemini
- [ ] Safety settings configured
- [ ] Prompt quality tests pass

### Reliability

- [ ] Error handling implemented
- [ ] Retry logic implemented
- [ ] Idempotency for T2/T3 tools
- [ ] Tracing updated

### Testing

- [ ] Test mocks updated
- [ ] Unit tests pass
- [ ] Integration tests pass
- [ ] E2E tests pass
- [ ] Smoke tests pass

### Production Ready

- [ ] No service account key files
- [ ] Workload Identity configured (for Cloud Run/GKE)
- [ ] Cost alerts configured
- [ ] Monitoring dashboards updated

---

## Cost Projection (Google-Native)

| Workload                | Current (Anthropic) | After (Gemini Flash) | Savings |
| ----------------------- | ------------------- | -------------------- | ------- |
| Customer Chat           | $0.105/session      | $0.015/session       | 86%     |
| Onboarding              | $0.45/session       | $0.065/session       | 86%     |
| Evaluations             | $5/month            | $0.50/month          | 90%     |
| **Total (1K sessions)** | **$200/month**      | **$25-30/month**     | **85%** |

---

## Summary

**Total Effort**: 60-74 hours (4-5 weeks)
**Cost Savings**: 85% reduction
**Architecture**: Simpler (single provider)
**Risk**: Low (no production data to migrate)

**The simplest solution is often the best.** By going all-in on Google, you avoid the complexity of multi-provider orchestration while still achieving enterprise quality.

---

**Document Prepared**: January 13, 2026
**Strategy**: Full Google-Native Migration
**Status**: Ready for Implementation
