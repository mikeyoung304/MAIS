# Vertex AI Migration: Executive Report & Strategic Recommendation

**Date**: January 13, 2026
**Project**: MAIS (gethandled.ai)
**Scope**: AI Agent System Migration Strategy
**Status**: ⚠️ **STRATEGIC RECOMMENDATION BELOW**

---

## Executive Summary

After comprehensive analysis of your current agent architecture and 2026 Google Vertex AI capabilities, I have an important strategic recommendation:

### 🎯 **Recommended Strategy: Multi-Provider Orchestration (Not Migration)**

**Don't replace Anthropic with Google—use both simultaneously.**

Vertex AI in 2026 offers **both Claude and Gemini models** through a unified platform. This enables a multi-provider strategy that gives you:

✅ **Reliability**: If one provider has an outage, your app stays online
✅ **Best-of-Breed**: Use Claude for code generation, Gemini for multimodal/cost optimization
✅ **Future-Ready**: Access to Google's ecosystem (UCP for agent-to-agent commerce, Imagen/Veo for media generation)
✅ **Cost Optimization**: 40-60% savings by intelligently routing to cheaper models
✅ **Gradual Evolution**: No risky "big bang" migration

---

## Critical Findings

### 1. Your Current Architecture is Production-Ready

**Agent System Overview**:

- **3 Orchestrators**: Customer Chat, Onboarding Advisor, Admin Assistant
- **~24,163 lines** of TypeScript agent code
- **40+ tools** with sophisticated Trust Tier system (T1/T2/T3)
- **Multi-tenant data isolation** (critical security pattern)
- **Comprehensive guardrails**: Circuit breakers, rate limiters, prompt injection defense
- **LLM-as-Judge evaluation** system with tracing infrastructure

**Current Models**:

- Primary: `claude-sonnet-4-20250514`
- Evaluation: `claude-haiku-4-5`

**Architecture Strengths**:

- Template Method pattern for orchestrator extensibility
- Dependency injection for swappable components
- Fire-and-forget tracing (non-blocking)
- Proposal-based execution system (security by design)

### 2. Vertex AI 2026 Landscape

**⚠️ CRITICAL SDK UPDATE**:

- Old SDK `@google-cloud/vertexai` **deprecated** (removed June 24, 2026)
- New SDK: `@google/genai` v1.35.0 (GA, production-ready)

**Available Models on Vertex AI**:

| Model                 | Input ($/1M)  | Output ($/1M) | Best For                  |
| --------------------- | ------------- | ------------- | ------------------------- |
| **Gemini 2.5 Flash**  | $0.075        | $0.30         | High-volume, simple tasks |
| **Gemini 2.5 Pro**    | $1.25         | $5.00         | Complex reasoning         |
| **Claude Sonnet 4.5** | $3.00         | $15.00        | Code generation, agents   |
| **Claude Haiku 4.5**  | (pricing TBD) | (pricing TBD) | Fast, cost-effective      |

**Key Features**:

- **Context Caching**: 90% cost reduction on cached tokens
- **Grounding with Google Search**: Real-time web data (1M queries/day free tier)
- **Multimodal Generation**: Imagen 4 (images), Veo 3.1 (video), Lyria 2 (audio)
- **Google UCP Integration**: Agent-to-agent commerce (announced Jan 11, 2026)
- **FedRAMP High Compliance**: Enterprise security + Private Service Connect

### 3. The Anthropic vs Vertex AI Tradeoff

**Direct Anthropic API Advantages**:

- ✅ Faster feature access (new models launch days-weeks earlier)
- ✅ Lower cost (no Google Cloud premium)
- ✅ Simpler setup (just API key)
- ✅ Multi-cloud flexibility

**Vertex AI Advantages**:

- ✅ Unified billing across all Google Cloud services
- ✅ Access to both Claude AND Gemini models
- ✅ FedRAMP High compliance (if needed)
- ✅ Private networking (VPC Service Connect)
- ✅ Centralized governance and audit logging

**My Assessment**: For MAIS specifically, **keep using Anthropic's direct API** as your primary provider, and **add Vertex AI for specific use cases** where you need:

- Cost optimization (Gemini Flash is 50x cheaper than Claude)
- Multimodal capabilities (photo/video generation for your vision)
- Google ecosystem integration (UCP for future agent-to-agent commerce)

---

## Strategic Recommendation: Hybrid Multi-Provider Architecture

### Phase 1: Add Vertex AI Alongside Anthropic (Recommended)

Instead of migrating, **augment** your current system:

```typescript
// Proposed architecture
interface LLMProvider {
  generateContent(request: AIRequest): Promise<AIResponse>;
}

class AnthropicProvider implements LLMProvider {
  /* existing */
}
class VertexGeminiProvider implements LLMProvider {
  /* new */
}
class VertexClaudeProvider implements LLMProvider {
  /* new, for failover */
}

// Intelligent routing
function selectProvider(task: TaskContext): LLMProvider {
  if (task.requiresMultimodal) return vertexGeminiProvider;
  if (task.budgetPriority === 'cost') return vertexGeminiProvider;
  if (task.domainType === 'code') return anthropicProvider;
  return anthropicProvider; // Default to current setup
}
```

**Benefits**:

- ✅ **Zero disruption**: Existing agents continue using Anthropic
- ✅ **Gradual adoption**: Test Gemini on low-risk workloads first
- ✅ **Reliability**: Automatic failover if one provider has issues
- ✅ **Cost optimization**: Route simple queries to Gemini Flash (50x cheaper)
- ✅ **Future-ready**: Foundation for multimodal features

### Phase 2: Implement Specific Use Cases on Vertex AI

**Use Case A: Cost Optimization**

- Customer chatbot simple queries → Gemini 2.5 Flash
- Estimated savings: 40-60% on customer chat costs
- Risk: Low (non-critical responses)

**Use Case B: Multimodal Generation**

- Photo generation for client proposals → Imagen 4
- Video generation for marketing → Veo 3.1
- Unlocks your vision: "agents able to generate photo and video for our clients"

**Use Case C: Google UCP Integration**

- Agent-to-agent shopping for future features
- Early adopter advantage in commerce agent space

### Phase 3 (Optional): Evaluate Full Migration

Only consider full migration if:

- [ ] Vertex AI feature lag no longer an issue
- [ ] Cost savings proven in production (>30% reduction)
- [ ] Response quality matches or exceeds Anthropic
- [ ] Your team comfortable with GCP ecosystem

---

## Technical Migration Path (If You Proceed)

### Migration Complexity Assessment

| Component                | Complexity | Effort                      | Risk       |
| ------------------------ | ---------- | --------------------------- | ---------- |
| **Message Formatting**   | HIGH       | 24h                         | MEDIUM     |
| **Tool Calling**         | HIGH       | 32h                         | HIGH       |
| **Response Parsing**     | MEDIUM     | 16h                         | MEDIUM     |
| **Retry Logic**          | MEDIUM     | 8h                          | LOW        |
| **Dependency Injection** | LOW        | 8h                          | LOW        |
| **Testing/Mocks**        | MEDIUM     | 24h                         | MEDIUM     |
| **Evaluation System**    | LOW        | 8h                          | LOW        |
| **Documentation**        | LOW        | 8h                          | LOW        |
| **Total**                |            | **~128 hours** (~3-4 weeks) | **MEDIUM** |

### Critical Architecture Changes Required

**1. Message Format Conversion**

**Current (Anthropic)**:

```typescript
{
  model: 'claude-sonnet-4-20250514',
  system: 'You are a helpful assistant',
  messages: [
    { role: 'user', content: 'Hello' },
    { role: 'assistant', content: 'Hi!' }
  ],
  tools: [...]
}
```

**New (Vertex AI Gemini)**:

```typescript
{
  model: 'gemini-2.5-pro',
  systemInstruction: { parts: [{ text: 'You are a helpful assistant' }] },
  contents: [
    { role: 'user', parts: [{ text: 'Hello' }] },
    { role: 'model', parts: [{ text: 'Hi!' }] }
  ],
  tools: { functionDeclarations: [...] }
}
```

**Key Differences**:

- `messages` → `contents`
- `assistant` role → `model` role
- `system` → `systemInstruction`
- `tools` → `tools.functionDeclarations`
- Tool results go in `model` role (not `user`)

**2. Tool Schema Translation**

**Anthropic Format**:

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

**Vertex AI Format**:

```typescript
{
  name: 'get_services',
  description: 'Get available services',
  parameters: {
    type: FunctionDeclarationSchemaType.OBJECT,
    properties: { tenantId: { type: FunctionDeclarationSchemaType.STRING } },
    required: ['tenantId']
  }
}
```

**3. SDK Changes**

```bash
# Remove
npm uninstall @anthropic-ai/sdk

# Add
npm install @google/genai
```

```typescript
// Old
import Anthropic from '@anthropic-ai/sdk';
const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

// New
import { GoogleGenerativeAI } from '@google/genai';
const genai = new GoogleGenerativeAI({
  vertexai: true,
  project: process.env.GOOGLE_VERTEX_PROJECT,
  location: process.env.GOOGLE_VERTEX_LOCATION,
});
```

**4. Cost Calculation Updates**

```typescript
// Update pricing constants
const MODEL_PRICING = {
  // Old
  'claude-sonnet-4-20250514': { input: 0.003, output: 0.015 },
  'claude-haiku-4-5': { input: 0.00025, output: 0.00125 },

  // New
  'gemini-2.5-pro': { input: 0.00125, output: 0.005 },
  'gemini-2.5-flash': { input: 0.000075, output: 0.0003 },
  'claude-sonnet-4.5': { input: 0.003, output: 0.015 }, // Via Vertex AI
};
```

### Files Requiring Modification

**Core Agent Files (High Priority)**:

- `server/src/agent/orchestrator/base-orchestrator.ts` (1,513 lines) - Main chat loop
- `server/src/agent/evals/evaluator.ts` (406 lines) - LLM-as-Judge
- `server/src/agent/utils/retry.ts` (186 lines) - Add Vertex AI error patterns
- `server/src/agent/tracing/types.ts` (210 lines) - Add Gemini model types
- `server/src/di.ts` (150+ lines) - Update DI for new LLM client

**Testing Files**:

- `server/test/helpers/mock-anthropic.ts` (207 lines) - Replace with Vertex AI mock
- All integration test files (3 files) - Update mock imports

**Configuration**:

- `server/.env.example` - Add Vertex AI environment variables
- `server/package.json` - Update dependencies

**Documentation**:

- `CLAUDE.md` - Update AI agent references
- `docs/architecture/BUILD_MODE_VISION.md` - Update vision docs

### Patterns to Preserve (CRITICAL)

**1. Multi-Tenant Data Isolation**

```typescript
// CRITICAL: ALL queries must filter by tenantId
const packages = await prisma.package.findMany({
  where: { tenantId, active: true }, // ✅ Tenant-scoped
});
```

**2. Trust Tier Enforcement**

- T1: Auto-execute (reads, toggles)
- T2: Soft-confirm (proceeds after next message)
- T3: Hard-confirm (requires explicit "yes")

**3. Proposal-Based Execution**

- Write tools return `proposalId`
- Proposals stored in database
- Execution happens via separate executor system

**4. Context Cache Invalidation**

```typescript
// TOCTOU prevention
if (WRITE_TOOLS.has(toolUse.name)) {
  this.cache.invalidate(tenantId);
}
```

---

## Cost Analysis

### Current Costs (Anthropic Direct)

**Customer Chat** (50K tokens/session max):

- Sonnet 4: $3/MTok input + $15/MTok output
- Avg session: ~10K input + 5K output = **$0.105/session**
- 1,000 sessions/month = **$105/month**

**Onboarding Advisor** (200K tokens/session max):

- Avg session: ~50K input + 20K output = **$0.45/session**
- 200 sessions/month = **$90/month**

**Evaluation** (Haiku 4.5):

- ~1K sessions/month = **$5/month**

**Total Current**: ~**$200/month** (at modest scale)

### Projected Costs (Hybrid Strategy)

**Scenario A: 50% Customer Chat → Gemini Flash**

- Gemini Flash: $0.075/MTok input + $0.30/MTok output
- Avg session: 10K input + 5K output = **$0.0023/session** (96% cheaper!)
- 500 sessions Gemini + 500 sessions Claude = **$53.65/month**
- **Savings**: $51.35/month (48% reduction on customer chat)

**Scenario B: All Simple Queries → Gemini Flash**

- Estimate 70% of customer queries are simple
- **Savings**: ~$73/month (70% reduction on customer chat)

**Scenario C: Add Multimodal Features**

- Imagen 4 generation: $0.02/image (1K images/month = $20)
- Veo video: $0.10/minute (100 videos/month = $10)
- **Net Cost**: +$30/month, but unlocks new capabilities

### Context Caching Impact

**Current**: No context caching (Anthropic charges full price)

**With Vertex AI**:

- 90% discount on cached tokens
- Your system prompts are ~2K-5K tokens
- Reused across all conversations in session

**Example**:

- 5K token system prompt
- 10 messages in conversation
- Without cache: 50K tokens charged
- With cache: 5K (first) + 9×500 (90% off) = **9.5K tokens charged**
- **Savings**: 81% on input tokens

**Estimated Monthly Savings**: $50-$80/month at current scale

---

## Risk Assessment

### High-Risk Areas

| Risk                             | Impact                            | Probability | Mitigation                                                       |
| -------------------------------- | --------------------------------- | ----------- | ---------------------------------------------------------------- |
| **Tool calling format mismatch** | Agents fail to execute actions    | HIGH        | Comprehensive integration tests, gradual rollout                 |
| **Response quality degradation** | User experience suffers           | MEDIUM      | A/B testing, conversation quality metrics, fallback to Anthropic |
| **Cost overruns**                | Budget exceeded                   | LOW         | Per-tenant budgets, real-time monitoring, circuit breakers       |
| **Multi-tenant data leak**       | Security breach                   | LOW         | Preserve existing tenantId scoping patterns, audit all queries   |
| **SDK deprecation impact**       | Production outage after June 2026 | HIGH        | Must migrate to `@google/genai` before June 24, 2026             |

### Mitigation Strategies

**1. Gradual Rollout with Feature Flags**

```typescript
USE_VERTEX_AI_CUSTOMER = false; // Start with false
USE_VERTEX_AI_ONBOARDING = false;
USE_VERTEX_AI_ADMIN = false;
```

**2. A/B Testing Framework**

- 10% traffic → Vertex AI (measure quality, latency, cost)
- If successful: 25% → 50% → 100%
- Maintain Anthropic fallback for 30 days

**3. Automatic Failover**

```typescript
try {
  return await vertexProvider.generate(request);
} catch (error) {
  logger.warn('Vertex AI failed, falling back to Anthropic');
  return await anthropicProvider.generate(request);
}
```

**4. Monitoring Dashboard**

- Track: Success rate, P95 latency, cost per conversation, tool call success
- Alert: Error rate >5%, latency spike >2x, cost anomaly >150% of average

---

## Questions Before Proceeding

### Business Questions

1. **What is your monthly AI spend target for 2026?**
   - Current trajectory: $200/month at low scale
   - At 10K sessions/month: $2,000-$3,000/month
   - With Vertex AI optimization: $800-$1,200/month

2. **Do you need FedRAMP High or other compliance certifications?**
   - If yes → Vertex AI required
   - If no → Anthropic direct API is simpler

3. **What's your timeline for multimodal features?**
   - Q1 2026 → Start with Vertex AI now
   - Q3+ 2026 → Can defer migration

4. **How important is reliability vs cost vs feature velocity?**
   - Reliability → Multi-provider strategy
   - Cost → Migrate to Gemini Flash
   - Feature velocity → Stay with Anthropic direct API

### Technical Questions

1. **Do you have existing GCP infrastructure?**
   - If yes → Easier to add Vertex AI
   - If no → Consider multi-cloud complexity

2. **What's your team's comfort level with Google Cloud?**
   - High → Proceed with confidence
   - Low → Budget time for learning curve

3. **Do you have metrics on current agent performance?**
   - Need baseline: Success rate, latency, cost per conversation
   - Used for comparison after migration

---

## Recommended Next Steps

### Option A: Hybrid Multi-Provider (Recommended)

**Effort**: 80 hours (~2 weeks)
**Risk**: Low
**Benefit**: Best of both worlds

**Steps**:

1. Create `LLMProvider` interface abstraction
2. Implement `VertexGeminiProvider` alongside existing `AnthropicProvider`
3. Add model routing logic (simple queries → Gemini, complex → Claude)
4. Deploy with feature flag (`USE_VERTEX_AI_CUSTOMER=false` initially)
5. Test on staging with 10% traffic
6. Gradually increase to 50% for simple queries
7. Monitor and optimize

**Success Criteria**:

- No degradation in conversation quality
- 30-50% cost reduction
- <5% error rate
- Failover works automatically

### Option B: Full Migration to Vertex AI

**Effort**: 128 hours (~3-4 weeks)
**Risk**: Medium
**Benefit**: Unified platform, 40-60% cost savings

**Steps**:

1. Phase 1: Create adapter layer (1 week)
2. Phase 2: Implement Vertex AI provider (1 week)
3. Phase 3: Migrate evaluation system (3 days)
4. Phase 4: Migrate customer agent with A/B testing (1 week)
5. Phase 5: Migrate remaining agents (3 days)
6. Phase 6: Remove Anthropic dependency (1 day)

**Success Criteria**:

- All agents running on Vertex AI
- Quality metrics within ±5% of baseline
- Cost reduced by 40%+
- No security regressions

### Option C: Stay with Anthropic (Valid Choice)

**If**:

- Current costs are acceptable
- Feature velocity matters more than cost
- Team capacity is limited
- Multi-cloud complexity not desired

**Defer Vertex AI until**:

- You need multimodal capabilities
- Cost becomes a problem
- You need FedRAMP High compliance
- Google UCP integration is required

---

## My Recommendation

Based on your stated priorities ("quality and end user experience" over time), I recommend:

### 🎯 **Phased Hybrid Approach**

**Phase 1 (Now)**: Implement multi-provider architecture

- Keep Anthropic as primary for quality
- Add Vertex AI Gemini for specific use cases
- Start with evaluation system (low risk)

**Phase 2 (Q2 2026)**: Add multimodal capabilities

- Integrate Imagen 4 for photo generation
- Test Veo for video generation
- This aligns with your vision of agents generating media for clients

**Phase 3 (Q3 2026)**: Optimize costs

- Route simple queries to Gemini Flash
- Keep complex reasoning on Claude
- Measure and iterate

**Phase 4 (Q4 2026)**: Evaluate full migration

- If quality + cost metrics are good → complete migration
- If not → maintain hybrid (best of both worlds)

**Why This Approach**:

- ✅ **Low Risk**: Existing agents unchanged initially
- ✅ **Future-Ready**: Foundation for multimodal + UCP
- ✅ **Quality First**: Can always fall back to Claude
- ✅ **Cost-Conscious**: Gradual optimization without compromise
- ✅ **User Experience**: Unlocks new capabilities (photo/video generation)

---

## Appendix: Additional Resources

### Research Documents Created

1. **Current Architecture Analysis**: Detailed in agent research output
2. **Vertex AI 2026 Capabilities**: `/Users/mikeyoung/CODING/MAIS/docs/research/vertex-ai-2026-research.md`
3. **Production Best Practices**: See best practices research output

### Key Documentation Links

- [Google Gen AI SDK (new)](https://github.com/googleapis/js-genai)
- [Anthropic Claude on Vertex AI](https://docs.cloud.google.com/vertex-ai/generative-ai/docs/partner-models/claude)
- [Context Caching Overview](https://docs.cloud.google.com/vertex-ai/generative-ai/docs/context-cache/context-cache-overview)
- [Google UCP Announcement](https://blog.google/products/shopping/google-universal-commerce-protocol-ucp/)

### Internal Files to Review

- `server/src/agent/orchestrator/base-orchestrator.ts` - Core chat loop
- `server/src/agent/tools/` - All 40+ tool implementations
- `server/src/agent/proposals/` - Proposal execution system
- `server/src/agent/evals/` - Evaluation infrastructure

---

**Report Prepared By**: Claude Sonnet 4.5 (via Claude Code CLI)
**Date**: January 13, 2026
**Next Step**: Review this report, then decide on Option A, B, or C above
