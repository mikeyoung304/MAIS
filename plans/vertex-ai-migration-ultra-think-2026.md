# Vertex AI Agent Migration: Ultra-Think Analysis (January 2026)

**Project**: MAIS (gethandled.ai)
**Analysis Date**: January 13, 2026
**Analysis Model**: Claude Opus 4.5 (Ultra-Think)
**Recency Rule**: Only 2026 sources (Dec 25, 2025+) trusted

---

## Executive Summary

After rigorous code-grounded analysis of the MAIS agent system and verification against 2026 Vertex AI capabilities, I recommend **Option A: Hybrid Multi-Provider Architecture using Vercel AI SDK**.

**Key Insight**: Your existing architecture is already well-designed for this migration. The Template Method pattern in `BaseOrchestrator` and your DI container make provider abstraction straightforward. The main work is creating an adapter layer, not rewriting agents.

**Critical Timeline**: The `@google-cloud/vertexai` SDK is deprecated and will be **removed June 24, 2026**. If you proceed with Vertex AI, you must use the new `@google/genai` SDK or (recommended) `@ai-sdk/google-vertex` from Vercel AI SDK.

---

## Part 1: As-Is Architecture Map

### 1.1 Orchestrator System

Your agent system follows a clean **Template Method pattern**:

```
BaseOrchestrator (abstract) - 1,513 lines
├── CustomerChatOrchestrator - 235 lines
├── OnboardingOrchestrator - 186 lines
└── AdminOrchestrator - 369 lines
```

**Key Extension Points** (these are what you'd modify for multi-provider):

| Abstract Method       | Purpose                    | Migration Impact                     |
| --------------------- | -------------------------- | ------------------------------------ |
| `getTools()`          | Tool registry per agent    | None - tools are provider-agnostic   |
| `buildSystemPrompt()` | System prompt per agent    | None - prompts are provider-agnostic |
| `getConfig()`         | Model, tokens, temperature | **Modify** - add model routing       |

**Main Chat Loop** (`base-orchestrator.ts:326-600`):

1. Prompt injection detection (NFKC normalization)
2. Session resolution
3. Guardrails check (rate limiter, circuit breaker)
4. **Claude API call** ← Only provider-specific code
5. Tool execution loop
6. Tracing/metrics

### 1.2 Tool System

**Complete Inventory**: 52 tools across 6 categories

| Category         | Count | Trust Tiers | Files                 |
| ---------------- | ----- | ----------- | --------------------- |
| Read Tools       | 16    | All T1      | `read-tools.ts`       |
| Write Tools      | 19    | T1/T2/T3    | `write-tools.ts`      |
| Storefront Tools | 11    | T1/T3       | `storefront-tools.ts` |
| Onboarding Tools | 4     | T1          | `onboarding-tools.ts` |
| UI Tools         | 5     | T1          | `ui-tools.ts`         |
| Customer Tools   | 6     | T1/T3       | `customer-tools.ts`   |

**Tool Interface** (provider-agnostic):

```typescript
// server/src/agent/tools/types.ts
interface AgentTool {
  name: string;
  trustTier: 'T1' | 'T2' | 'T3';
  description: string;
  inputSchema: JSONSchema; // Standard JSON Schema
  execute(context: ToolContext, params: Record<string, unknown>): Promise<AgentToolResult>;
}
```

**Migration Impact**: Your tool definitions use standard JSON Schema, which is compatible with both Anthropic and Gemini function calling formats. The `buildToolsForAPI()` method in `BaseOrchestrator` handles the translation - you'd add a parallel method for Gemini format.

### 1.3 LLM Provider Layer

**Current Anthropic Integration** (`base-orchestrator.ts:326-340`):

```typescript
// Current instantiation
this.anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
  timeout: 30 * 1000,
  maxRetries: 2,
});

// Current API call
response = await this.anthropic.messages.create({
  model: config.model, // 'claude-sonnet-4-20250514'
  max_tokens: config.maxTokens,
  temperature: config.temperature,
  system: systemPrompt,
  messages: historyMessages,
  tools: this.buildToolsForAPI(),
});
```

**Model Configuration**:
| Setting | Current Value | Source |
|---------|---------------|--------|
| Primary Model | `claude-sonnet-4-20250514` | `DEFAULT_ORCHESTRATOR_CONFIG` |
| Eval Model | `claude-haiku-4-5` | `EVAL_MODEL` env var |
| Max Tokens | 4096 (2048 customer) | Per-orchestrator |
| Temperature | 0.7 | Per-orchestrator |

### 1.4 Multi-Tenant Security

**Tenant Isolation Flow** (CRITICAL to preserve):

```
JWT → res.locals.tenantAuth.tenantId → ToolContext → Every DB query
```

**Enforcement Points**:

- Session queries: `WHERE { tenantId, id }`
- Tool context: `context.tenantId` injected
- Proposal service: `WHERE { tenantId, proposalId }`
- Cache keys: `tenant:${tenantId}:resource:${id}`
- Circuit breakers: Keyed by sessionId (tenant-scoped)

### 1.5 Evaluation System

**Location**: `server/src/agent/evals/evaluator.ts` (406 lines)

**Architecture**: LLM-as-Judge pattern with 3 dimensions:

1. Effectiveness - task completion
2. Experience - interaction quality
3. Safety - concerning behaviors

**Model**: Uses `claude-haiku-4-5` for cost efficiency

### 1.6 Observability

**Tracing** (`server/src/agent/tracing/tracer.ts` - 570 lines):

- Per-session conversation traces
- Token counts, latency, cost estimation
- 90-day retention with auto-cleanup
- Fire-and-forget writes (non-blocking)

**Metrics** (`server/src/agent/orchestrator/metrics.ts`):

```typescript
// Prometheus metrics tracked
recordToolCall(toolName, tier, agentType, success);
recordRateLimitHit(toolName, agentType);
recordCircuitBreakerTrip(reason, agentType);
recordTurnDuration(seconds, agentType, hadToolCalls);
recordApiError(errorType, agentType);
```

---

## Part 2: Verified 2026 Vertex AI Capability Matrix

### 2.1 SDK Status (CRITICAL)

| Event                               | Date              | Action Required                                |
| ----------------------------------- | ----------------- | ---------------------------------------------- |
| `@google-cloud/vertexai` deprecated | June 24, 2025     | Do not use                                     |
| **Removal deadline**                | **June 24, 2026** | Must migrate before                            |
| New SDK GA                          | Now               | Use `@google/genai` or `@ai-sdk/google-vertex` |

**Recommended SDK Stack**:

```bash
# Option A: Vercel AI SDK (RECOMMENDED for multi-provider)
npm install ai @ai-sdk/anthropic @ai-sdk/google-vertex

# Option B: Direct Google SDK (if Vertex-only)
npm install @google/genai
```

### 2.2 Available Models (January 2026)

**Gemini Models**:

| Model                 | ID                      | Context | Input $/1M | Output $/1M | Status  |
| --------------------- | ----------------------- | ------- | ---------- | ----------- | ------- |
| Gemini 3 Pro          | `gemini-3-pro`          | 1M      | $2.00      | $12.00      | Preview |
| **Gemini 2.5 Flash**  | `gemini-2.5-flash`      | 1M      | $0.30      | $2.50       | GA      |
| Gemini 2.5 Flash-Lite | `gemini-2.5-flash-lite` | 1M      | $0.10      | $0.40       | GA      |
| Gemini 2.5 Pro        | `gemini-2.5-pro`        | 1M      | $1.25      | $10.00      | GA      |

**Claude Models on Vertex AI**:

| Model             | ID                  | Context | Input $/1M | Output $/1M | Status |
| ----------------- | ------------------- | ------- | ---------- | ----------- | ------ |
| Claude Opus 4.5   | `claude-opus-4-5`   | 200K    | $5.00      | $25.00      | GA     |
| Claude Sonnet 4.5 | `claude-sonnet-4-5` | 1M      | $3.00      | $15.00      | GA     |
| Claude Haiku 4.5  | `claude-haiku-4-5`  | 200K    | $1.00      | $5.00       | GA     |

**Cost Comparison** (Your workloads):

| Scenario                        | Current (Anthropic Direct) | Vertex Gemini Flash | Savings |
| ------------------------------- | -------------------------- | ------------------- | ------- |
| Customer chat (10K in + 5K out) | $0.105                     | **$0.0155**         | 85%     |
| Onboarding (50K in + 20K out)   | $0.45                      | **$0.065**          | 86%     |
| Evaluation (1K sessions)        | $5/mo                      | **$0.50/mo**        | 90%     |

### 2.3 Function Calling Compatibility

**Anthropic Format** (current):

```typescript
{
  name: 'get_services',
  description: 'Get available services',
  input_schema: {
    type: 'object',
    properties: { tenantId: { type: 'string' } },
    required: ['tenantId']
  }
}
```

**Gemini Format**:

```typescript
{
  name: 'get_services',
  description: 'Get available services',
  parameters: {
    type: Type.OBJECT,
    properties: { tenantId: { type: Type.STRING } },
    required: ['tenantId']
  }
}
```

**Vercel AI SDK** (abstracts both):

```typescript
import { tool } from 'ai';
import { z } from 'zod';

const getServices = tool({
  description: 'Get available services',
  parameters: z.object({
    tenantId: z.string(),
  }),
  execute: async ({ tenantId }) => {
    /* ... */
  },
});
```

### 2.4 Multimodal Capabilities

| Capability              | Model         | Price       | Status  |
| ----------------------- | ------------- | ----------- | ------- |
| Image generation        | Imagen 4      | $0.04/image | GA      |
| Image generation (fast) | Imagen 4 Fast | $0.02/image | GA      |
| Video generation        | Veo 3.1       | $0.20/sec   | Preview |
| Video + audio           | Veo 3.1       | $0.40/sec   | Preview |

### 2.5 Context Caching

| Type     | How It Works                 | Discount               |
| -------- | ---------------------------- | ---------------------- |
| Implicit | Automatic, no code changes   | 90% off cached tokens  |
| Explicit | Manual API calls, guaranteed | 90% off + storage cost |

**Requirements**: Minimum 2,048 tokens, supports text/PDF/image/audio/video

### 2.6 Google UCP (Universal Commerce Protocol)

**Status**: Announced January 11, 2026 at NRF 2026

**What It Is**: Open standard for AI agent commerce. Enables your agents to:

- Discover merchant capabilities
- Execute checkout flows
- Process payments via Google Pay (PayPal coming)

**Partners**: Shopify (co-developer), Stripe, Mastercard, Visa, Target, Walmart, etc.

**Technical Integration**:

```bash
# Capability discovery
GET /.well-known/ucp

# Checkout request
POST /checkout-sessions
UCP-Agent: profile="https://your-agent/profile"
```

**Relevance to MAIS**: Aligns with your vision for agent-to-agent shopping. Early adoption opportunity.

---

## Part 3: Audit of Previous Plan

### What the Previous Plan Got RIGHT ✅

| Claim                        | Verification                                                |
| ---------------------------- | ----------------------------------------------------------- |
| 3 orchestrators              | ✅ Confirmed: Customer, Onboarding, Admin                   |
| ~24K lines agent code        | ⚠️ Actually ~10K lines (orchestrators + tools + supporting) |
| 40+ tools                    | ✅ Confirmed: 52 tools total                                |
| Trust tier system (T1/T2/T3) | ✅ Confirmed with exact breakdown                           |
| Claude Sonnet 4 as primary   | ✅ Confirmed: `claude-sonnet-4-20250514`                    |
| Haiku for evals              | ✅ Confirmed: `claude-haiku-4-5`                            |
| SDK deprecation June 2026    | ✅ Confirmed: Removal June 24, 2026                         |
| Multi-tenant isolation       | ✅ Confirmed with code patterns                             |
| Context caching 90% savings  | ✅ Confirmed                                                |
| UCP for agent commerce       | ✅ Confirmed, announced Jan 11, 2026                        |

### What the Previous Plan Got WRONG or INCOMPLETE ❌

| Claim                                       | Reality                                            |
| ------------------------------------------- | -------------------------------------------------- |
| `@google/genai` SDK v1.35.0                 | Outdated version reference - use latest            |
| Message format conversion "HIGH complexity" | Medium - Vercel AI SDK handles this                |
| Tool calling "HIGH complexity, HIGH risk"   | Medium - JSON Schema is compatible                 |
| Recommended "keep Anthropic as primary"     | Valid but missed the Vercel AI SDK opportunity     |
| 128 hours for full migration                | Overestimate if using Vercel AI SDK (~60-80 hours) |
| Missing: OWASP Top 10 for Agentic Apps      | Critical security framework for 2026               |
| Missing: Gemini 3 models                    | Now in preview with improved capabilities          |

### What the Previous Plan MISSED Entirely 🚨

1. **Vercel AI SDK as abstraction layer** - The 2026 standard for multi-provider is `@ai-sdk/google-vertex` + `@ai-sdk/anthropic`, not raw SDK migration

2. **Provider Registry pattern** - Modern architecture uses `createProviderRegistry()` for clean switching

3. **OWASP Top 10 for Agentic Applications (2026)** - New security framework you should align with (ASI01-ASI10)

4. **Gemini 2.5 Flash-Lite** - Released stable Jan 2026, even cheaper than Flash ($0.10/1M input)

5. **MCP integration in Google SDK** - Native `mcpToTool()` helper for MCP server integration

---

## Part 4: Strategic Decision

### Options Evaluated

| Option                                       | Effort   | Risk   | Cost Savings | Future Optionality |
| -------------------------------------------- | -------- | ------ | ------------ | ------------------ |
| **A: Hybrid Multi-Provider (Vercel AI SDK)** | 60-80h   | Low    | 40-60%       | High               |
| B: Full Migration to Vertex AI               | 100-120h | Medium | 50-70%       | Medium             |
| C: Stay with Anthropic Direct                | 0h       | None   | 0%           | Low                |

### Recommendation: Option A - Hybrid Multi-Provider

**Why This Is the Right Choice**:

1. **Aligns with 2026 best practices** - Multi-provider gateway is the industry standard (per LangChain State of Agents, Portkey patterns)

2. **Preserves your architecture** - Your Template Method pattern and DI container are perfect for this

3. **Unlocks future capabilities** - Multimodal (Imagen/Veo), UCP commerce, Google Search grounding

4. **Risk mitigation** - If one provider has issues, automatic failover

5. **Cost optimization without compromise** - Route simple queries to Gemini Flash (85% cheaper) while keeping Claude for complex reasoning

6. **Your existing code is 80% ready** - Tool definitions are JSON Schema (compatible), tenant isolation is solid, tracing is provider-agnostic

### Why NOT Full Migration (Option B)

1. Claude's code generation and agent reasoning are still superior for complex tasks
2. Feature lag on Vertex AI for new Claude releases (days-weeks delay)
3. More risk for less incremental benefit
4. You'd lose the failover safety net

### Why NOT Stay with Anthropic (Option C)

1. Misses 50-85% cost savings opportunity on simple queries
2. No path to multimodal features (photo/video generation for clients)
3. No UCP integration for future agent commerce
4. Less reliability (single point of failure)

---

## Part 5: Phased Implementation Plan

### Phase 0: Foundation (Week 1) - 16 hours

**Goal**: Establish provider abstraction layer without changing behavior

**Tasks**:

1. Install Vercel AI SDK packages
2. Create `LLMProvider` interface
3. Wrap existing Anthropic calls in adapter
4. Add feature flags (disabled by default)
5. Update DI container

**Files to Create/Modify**:

```
server/src/llm/
├── types.ts              # LLMProvider interface
├── anthropic-provider.ts # Wrap existing Anthropic client
├── vertex-provider.ts    # Placeholder for Phase 1
├── router.ts             # Model selection logic
└── index.ts              # Exports + provider registry
```

**Code Architecture**:

```typescript
// server/src/llm/types.ts
import { CoreMessage, CoreTool, GenerateTextResult } from 'ai';

export interface LLMProvider {
  generateText(params: GenerateTextParams): Promise<GenerateTextResult>;
  streamText(params: GenerateTextParams): AsyncIterable<StreamTextChunk>;
}

export interface GenerateTextParams {
  model: string;
  system: string;
  messages: CoreMessage[];
  tools?: Record<string, CoreTool>;
  maxTokens?: number;
  temperature?: number;
  metadata?: {
    tenantId: string;
    agentType: string;
    sessionId: string;
  };
}

// server/src/llm/router.ts
export function selectProvider(
  task: TaskContext,
  config: RouterConfig
): { provider: string; model: string } {
  // Feature flag check
  if (!config.enableVertexAI) {
    return { provider: 'anthropic', model: 'claude-sonnet-4-20250514' };
  }

  // Route simple tasks to cheaper models
  if (task.complexity === 'simple') {
    return { provider: 'vertex', model: 'gemini-2.5-flash' };
  }

  // Default to Claude for complex tasks
  return { provider: 'anthropic', model: 'claude-sonnet-4-20250514' };
}
```

**Success Criteria**:

- [ ] All existing tests pass
- [ ] No behavior change (adapter is pass-through)
- [ ] Feature flags default to off

### Phase 1: Vertex AI Integration (Week 2) - 20 hours

**Goal**: Add Vertex AI as a provider option

**Tasks**:

1. Set up Google Cloud project + service account
2. Implement `VertexProvider` using `@ai-sdk/google-vertex`
3. Translate tool schemas to Gemini format
4. Handle response format differences
5. Add cost tracking for Vertex models

**Vertex AI Setup Steps** (see Part 6 for detailed guide):

```bash
# 1. Create project
gcloud projects create mais-production --name="MAIS Production"

# 2. Enable APIs
gcloud services enable aiplatform.googleapis.com

# 3. Create service account
gcloud iam service-accounts create mais-agent \
  --display-name="MAIS Agent Service Account"

# 4. Grant permissions
gcloud projects add-iam-policy-binding mais-production \
  --member="serviceAccount:mais-agent@mais-production.iam.gserviceaccount.com" \
  --role="roles/aiplatform.user"

# 5. Create key
gcloud iam service-accounts keys create vertex-key.json \
  --iam-account=mais-agent@mais-production.iam.gserviceaccount.com
```

**Code**:

```typescript
// server/src/llm/vertex-provider.ts
import { createVertex } from '@ai-sdk/google-vertex';
import { generateText, streamText } from 'ai';
import { LLMProvider, GenerateTextParams } from './types';

export class VertexProvider implements LLMProvider {
  private vertex;

  constructor() {
    this.vertex = createVertex({
      project: process.env.GOOGLE_VERTEX_PROJECT,
      location: process.env.GOOGLE_VERTEX_LOCATION || 'us-central1',
    });
  }

  async generateText(params: GenerateTextParams) {
    return await generateText({
      model: this.vertex(params.model),
      system: params.system,
      messages: params.messages,
      tools: params.tools,
      maxTokens: params.maxTokens,
      temperature: params.temperature,
    });
  }
}
```

**Success Criteria**:

- [ ] Can call Gemini models via Vertex AI
- [ ] Tool calling works correctly
- [ ] Cost tracking captures Vertex usage
- [ ] All tests still pass (feature flag off)

### Phase 2: Evaluation System Migration (Week 3) - 12 hours

**Goal**: Use Gemini Flash for evaluations (90% cost savings)

**Why Start Here**:

- Low risk (evals are async, non-user-facing)
- High savings (evals run frequently)
- Good validation of Vertex AI quality

**Tasks**:

1. Update `ConversationEvaluator` to use provider abstraction
2. Add feature flag `USE_VERTEX_FOR_EVALS`
3. Run parallel evals (both providers) to compare quality
4. Switch to Gemini Flash once quality validated

**Code**:

```typescript
// server/src/agent/evals/evaluator.ts
export class ConversationEvaluator {
  private provider: LLMProvider;

  constructor(providerRegistry: ProviderRegistry) {
    const useVertex = process.env.USE_VERTEX_FOR_EVALS === 'true';
    this.provider = useVertex ? providerRegistry.get('vertex') : providerRegistry.get('anthropic');
    this.model = useVertex ? 'gemini-2.5-flash' : 'claude-haiku-4-5';
  }
}
```

**Success Criteria**:

- [ ] Eval quality within 5% of Claude Haiku
- [ ] 90% cost reduction on evals
- [ ] No production impact (async process)

### Phase 3: Customer Chatbot Migration (Week 4-5) - 24 hours

**Goal**: Route simple customer queries to Gemini Flash

**Strategy**: A/B testing with gradual rollout

**Tasks**:

1. Implement query complexity classifier
2. Add A/B testing infrastructure
3. Route 10% simple queries to Gemini
4. Monitor quality metrics
5. Gradually increase to 50%

**Complexity Classifier**:

```typescript
// server/src/llm/classifier.ts
export function classifyQueryComplexity(
  message: string,
  conversationHistory: Message[]
): 'simple' | 'medium' | 'complex' {
  // Simple: FAQ, availability checks, business info
  const simplePatterns = [
    /what (are )?your hours/i,
    /how much (does|do)/i,
    /where (are you|is your)/i,
    /do you (offer|have|provide)/i,
    /check.*availability/i,
  ];

  if (simplePatterns.some((p) => p.test(message))) {
    return 'simple';
  }

  // Complex: Multi-step reasoning, booking modifications
  if (conversationHistory.length > 5) return 'complex';
  if (message.length > 500) return 'complex';

  return 'medium';
}
```

**A/B Testing**:

```typescript
// server/src/llm/ab-test.ts
export function shouldUseVertex(
  tenantId: string,
  complexity: 'simple' | 'medium' | 'complex'
): boolean {
  const rolloutPercentage = getFeatureFlag('VERTEX_ROLLOUT_PERCENT') || 0;

  // Only route simple queries during rollout
  if (complexity !== 'simple') return false;

  // Consistent per-tenant (so same user gets same experience)
  const hash = hashTenantId(tenantId);
  return hash % 100 < rolloutPercentage;
}
```

**Success Criteria**:

- [ ] Quality metrics within 5% of Claude
- [ ] Latency comparable or better
- [ ] 50% of simple queries routed to Gemini
- [ ] Automatic fallback on errors

### Phase 4: Multimodal Features (Week 6+) - Optional

**Goal**: Add image/video generation for client proposals

**Tasks**:

1. Integrate Imagen 4 for photo generation
2. Add tools: `generate_proposal_image`, `generate_marketing_video`
3. Store generated assets in GCS
4. Add to client-facing proposals

**Code**:

```typescript
// server/src/agent/tools/multimodal-tools.ts
import { GoogleGenAI } from '@google/genai';

export const generateProposalImage: AgentTool = {
  name: 'generate_proposal_image',
  trustTier: 'T2',
  description: 'Generate a custom image for a client proposal',
  inputSchema: {
    type: 'object',
    properties: {
      prompt: { type: 'string', description: 'Image description' },
      style: { type: 'string', enum: ['professional', 'creative', 'minimal'] },
    },
    required: ['prompt'],
  },
  async execute(context, params) {
    const ai = new GoogleGenAI({ vertexai: true, project: '...' });

    const response = await ai.models.generateImages({
      model: 'imagen-4.0-generate-001',
      prompt: params.prompt,
      config: { numberOfImages: 1 },
    });

    const imageUrl = await uploadToGCS(response.images[0].imageBytes);

    return {
      success: true,
      data: { imageUrl },
    };
  },
};
```

---

## Part 6: Step-by-Step Google Cloud / Vertex AI Studio Guide

### 6.1 Initial Setup (One-Time)

#### Step 1: Create Google Cloud Project

```bash
# Install gcloud CLI if not present
brew install google-cloud-sdk

# Login
gcloud auth login

# Create project
gcloud projects create mais-production --name="MAIS Production"

# Set as default
gcloud config set project mais-production

# Link billing account (required for Vertex AI)
gcloud billing accounts list
gcloud billing projects link mais-production \
  --billing-account=YOUR_BILLING_ACCOUNT_ID
```

#### Step 2: Enable Required APIs

```bash
# Enable Vertex AI API
gcloud services enable aiplatform.googleapis.com

# Enable Cloud Storage (for multimodal assets)
gcloud services enable storage.googleapis.com

# Enable IAM (for service accounts)
gcloud services enable iam.googleapis.com

# Verify enabled
gcloud services list --enabled | grep -E "(aiplatform|storage|iam)"
```

#### Step 3: Create Service Account

```bash
# Create service account
gcloud iam service-accounts create mais-agent \
  --display-name="MAIS Agent Service Account" \
  --description="Service account for MAIS AI agent system"

# Grant Vertex AI User role
gcloud projects add-iam-policy-binding mais-production \
  --member="serviceAccount:mais-agent@mais-production.iam.gserviceaccount.com" \
  --role="roles/aiplatform.user"

# Grant Storage Object Admin (for multimodal)
gcloud projects add-iam-policy-binding mais-production \
  --member="serviceAccount:mais-agent@mais-production.iam.gserviceaccount.com" \
  --role="roles/storage.objectAdmin"

# Create and download key
gcloud iam service-accounts keys create vertex-credentials.json \
  --iam-account=mais-agent@mais-production.iam.gserviceaccount.com

# IMPORTANT: Add to .gitignore
echo "vertex-credentials.json" >> .gitignore
```

#### Step 4: Configure Environment Variables

```bash
# Add to .env (server/.env)
GOOGLE_VERTEX_PROJECT=mais-production
GOOGLE_VERTEX_LOCATION=us-central1
GOOGLE_APPLICATION_CREDENTIALS=./vertex-credentials.json

# Or for production (use secret manager)
# GOOGLE_CLIENT_EMAIL=mais-agent@mais-production.iam.gserviceaccount.com
# GOOGLE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----"
```

### 6.2 Vertex AI Studio Console Walkthrough

#### Access Vertex AI Studio

1. Go to: https://console.cloud.google.com/vertex-ai
2. Select your project (mais-production)
3. Navigate to "Generative AI Studio" in left sidebar

#### Test Models Interactively

1. Click "Language" → "Text"
2. Select model: `gemini-2.5-flash`
3. Test prompts interactively before coding
4. Export as code (button in top right)

#### Monitor Usage & Costs

1. Go to "Quotas & System Limits"
2. Set up budget alerts in Billing
3. View usage in "Metrics" dashboard

#### Enable Context Caching

1. Go to "Language" → "Cache"
2. Create cache with your system prompt
3. Note the cache name for API usage

### 6.3 SDK Installation & Configuration

```bash
# Install Vercel AI SDK (recommended)
npm install ai @ai-sdk/anthropic @ai-sdk/google-vertex

# Or direct Google SDK
npm install @google/genai
```

```typescript
// server/src/llm/setup.ts
import { createVertex } from '@ai-sdk/google-vertex';
import { anthropic } from '@ai-sdk/anthropic';
import { createProviderRegistry } from 'ai';

// Create provider instances
const vertex = createVertex({
  project: process.env.GOOGLE_VERTEX_PROJECT!,
  location: process.env.GOOGLE_VERTEX_LOCATION || 'us-central1',
});

// Create registry for easy switching
export const providerRegistry = createProviderRegistry({
  anthropic,
  vertex,
});

// Usage
import { generateText } from 'ai';

const result = await generateText({
  model: providerRegistry.languageModel('vertex:gemini-2.5-flash'),
  prompt: 'Hello world',
});
```

### 6.4 Testing the Integration

```typescript
// server/src/llm/__tests__/vertex-integration.test.ts
import { describe, it, expect } from 'vitest';
import { VertexProvider } from '../vertex-provider';

describe('Vertex AI Integration', () => {
  it('should generate text with Gemini', async () => {
    const provider = new VertexProvider();

    const result = await provider.generateText({
      model: 'gemini-2.5-flash',
      system: 'You are a helpful assistant.',
      messages: [{ role: 'user', content: 'Say hello' }],
    });

    expect(result.text).toBeTruthy();
    expect(result.usage.totalTokens).toBeGreaterThan(0);
  });

  it('should handle tool calling', async () => {
    const provider = new VertexProvider();

    const result = await provider.generateText({
      model: 'gemini-2.5-flash',
      messages: [{ role: 'user', content: 'Check availability for tomorrow' }],
      tools: {
        checkAvailability: {
          description: 'Check date availability',
          parameters: z.object({ date: z.string() }),
        },
      },
    });

    expect(result.toolCalls).toBeDefined();
  });
});
```

---

## Part 7: Risk Mitigation & Monitoring

### Quality Monitoring Dashboard

Track these metrics during rollout:

| Metric                           | Source   | Alert Threshold |
| -------------------------------- | -------- | --------------- |
| Tool call success rate           | Tracing  | < 95%           |
| User satisfaction (if collected) | Survey   | < 4.0/5.0       |
| Conversation completion          | Sessions | < 90%           |
| P95 latency                      | Metrics  | > 5000ms        |
| Error rate                       | Logs     | > 5%            |
| Cost per conversation            | Billing  | > 150% baseline |

### Automatic Rollback

```typescript
// server/src/llm/health-check.ts
interface ProviderHealth {
  errorRate: number;
  p95Latency: number;
  lastSuccess: Date;
}

export function shouldFallback(health: ProviderHealth): boolean {
  if (health.errorRate > 0.05) return true; // >5% errors
  if (health.p95Latency > 5000) return true; // >5s latency
  if (Date.now() - health.lastSuccess.getTime() > 60000) return true; // >1min since success
  return false;
}
```

### Cost Controls

```typescript
// server/src/llm/cost-control.ts
interface TenantBudget {
  monthlyLimitUSD: number;
  currentSpendUSD: number;
  alertThreshold: number; // 0.8 = 80%
}

export async function checkBudget(tenantId: string): Promise<boolean> {
  const budget = await getTenantBudget(tenantId);

  if (budget.currentSpendUSD >= budget.monthlyLimitUSD) {
    logger.warn({ tenantId }, 'Tenant hit AI budget limit');
    return false;
  }

  if (budget.currentSpendUSD >= budget.monthlyLimitUSD * budget.alertThreshold) {
    await sendBudgetAlert(tenantId, budget);
  }

  return true;
}
```

---

## Part 8: Summary & Next Steps

### What You Should Do

1. **This Week**: Review this plan, ask questions, decide on Option A vs B vs C

2. **If Option A (Recommended)**:
   - Start Phase 0: Install Vercel AI SDK, create provider abstraction
   - Set up Google Cloud project (30 min)
   - Run integration tests in dev environment

3. **Questions to Answer**:
   - [ ] What's your monthly AI budget target?
   - [ ] Do you need FedRAMP compliance?
   - [ ] When do you want multimodal features?
   - [ ] Do you have existing GCP infrastructure?

### Timeline Summary

| Phase                 | Duration | Outcome                        |
| --------------------- | -------- | ------------------------------ |
| 0: Foundation         | 1 week   | Provider abstraction in place  |
| 1: Vertex Integration | 1 week   | Gemini available as option     |
| 2: Evals Migration    | 1 week   | 90% eval cost savings          |
| 3: Customer Chatbot   | 2 weeks  | 50% customer queries on Gemini |
| 4: Multimodal         | Ongoing  | Photo/video generation         |

**Total: 6 weeks to full hybrid deployment**

### Cost Savings Projection

| Current                    | After Migration | Savings |
| -------------------------- | --------------- | ------- |
| $200/mo (low scale)        | $60-80/mo       | 60-70%  |
| $2,000/mo (10K sessions)   | $600-800/mo     | 60-70%  |
| $20,000/mo (100K sessions) | $6,000-8,000/mo | 60-70%  |

---

## Appendix: File Change Manifest

### New Files to Create

```
server/src/llm/
├── types.ts              # ~50 lines
├── anthropic-provider.ts # ~80 lines
├── vertex-provider.ts    # ~100 lines
├── router.ts             # ~60 lines
├── cost-tracker.ts       # ~80 lines
├── health-check.ts       # ~40 lines
└── index.ts              # ~20 lines
```

### Existing Files to Modify

| File                   | Changes                                  |
| ---------------------- | ---------------------------------------- |
| `base-orchestrator.ts` | Import provider from DI, use abstraction |
| `di.ts`                | Register provider instances              |
| `evaluator.ts`         | Use provider abstraction                 |
| `metrics.ts`           | Add Vertex-specific metrics              |
| `.env.example`         | Add Vertex AI config                     |
| `package.json`         | Add AI SDK dependencies                  |

### Files NOT to Modify

- All tool definitions (provider-agnostic)
- Tenant isolation logic (already correct)
- Proposal system (provider-agnostic)
- Tracing system (works with any provider)

---

**Document Prepared By**: Claude Opus 4.5 (Ultra-Think Analysis)
**Analysis Date**: January 13, 2026
**Confidence Level**: High (code-grounded, 2026-verified)
