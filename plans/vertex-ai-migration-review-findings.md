# Vertex AI Migration: Enterprise Review Findings

**Review Date**: January 13, 2026
**Reviewers**: 5 Specialized Agents (Architecture, Security, Data Integrity, Performance, Agent-Native)
**Review Mandate**: Enterprise quality only. No debt. No shortcuts.

---

## Executive Summary

The migration plan received **strong marks for infrastructure design** but requires **significant hardening** before implementation. All five reviewers identified gaps that, if unaddressed, could cause production incidents.

| Reviewer                | Grade | Key Finding                                                                     |
| ----------------------- | ----- | ------------------------------------------------------------------------------- |
| Architecture Strategist | B+    | Solid Template Method, but missing error taxonomy & message normalization       |
| Security Sentinel       | B     | Good tenant isolation, but credential management and prompt injection gaps      |
| Data Integrity Guardian | B-    | Critical gaps in message format normalization and trace attribution             |
| Performance Oracle      | A-    | Viable performance profile, but needs lazy init and health check implementation |
| Agent-Native Reviewer   | B     | Good tool portability, but ignores cognitive implications of provider switching |

**Consensus Verdict**: The plan is **NOT READY** for Phase 1. Insert a **Phase 0.5 (Data & Security Foundation)** to address blocking issues.

---

## Blocking Issues (Must Fix Before Phase 1)

### 1. Message Format Normalization (Data Integrity)

**Problem**: Session messages stored in `AgentSession.messages` are Anthropic-formatted. Mid-conversation provider switches will corrupt context.

**Required Fix**:

```typescript
// server/src/llm/types.ts
interface CanonicalMessage {
  role: 'user' | 'assistant';
  content: string;
  toolCalls?: CanonicalToolCall[];
  provider: 'anthropic' | 'vertex';
  model: string;
  timestamp: string;
}
```

**Effort**: 8-12 hours

### 2. Provider Field in Traces (Data Integrity)

**Problem**: `ConversationTrace` doesn't capture which provider handled each message. Cannot debug issues or attribute costs.

**Required Fix**: Add `provider` and `providerHistory` fields to trace schema.

**Effort**: 4-6 hours

### 3. Credential Management (Security)

**Problem**: Plan recommends downloading service account key files. This creates high-risk credential sprawl.

**Required Fix**: Use Workload Identity Federation (production) or Application Default Credentials (development). Never write key files.

**Effort**: 4-6 hours (if WIF already configured) or 12-16 hours (new setup)

### 4. Idempotency Keys for T2/T3 Tools (Data Integrity)

**Problem**: Provider failover mid-tool-execution could cause duplicate bookings or payments.

**Required Fix**:

```typescript
interface ToolContext {
  idempotencyKey: string; // hash(sessionId + turnNumber + toolName)
}
```

**Effort**: 6-8 hours

### 5. Provider-Specific Prompt Injection Patterns (Security)

**Problem**: Existing `INJECTION_PATTERNS` are Claude-tuned. Gemini may have different vulnerabilities.

**Required Fix**: Add Gemini-specific patterns and test against both providers.

**Effort**: 4-6 hours

---

## High Priority Issues (Fix Before Phase 3)

### 6. Unified Error Taxonomy (Architecture)

**Problem**: Anthropic and Vertex return different error codes. Health check cannot make informed decisions.

**Required Fix**:

```typescript
enum ProviderErrorCategory {
  RATE_LIMITED,
  UNAVAILABLE,
  INVALID_REQUEST,
  CONTENT_POLICY,
  CONTEXT_TOO_LONG,
  UNKNOWN,
}
```

**Effort**: 6-8 hours

### 7. Provider-Sticky Sessions (Agent-Native)

**Problem**: Routing at query level causes personality shifts mid-conversation.

**Required Fix**: Select provider at session start, maintain affinity throughout.

**Effort**: 4-6 hours

### 8. Hierarchical Circuit Breakers (Architecture)

**Problem**: Current circuit breakers are per-session. Need per-provider global breakers too.

**Required Fix**: Three-layer circuit breakers (global, tenant, session).

**Effort**: 8-10 hours

### 9. Cost Table Extension (Data Integrity)

**Problem**: `COST_PER_1K_TOKENS` only has Claude models. Vertex costs not tracked.

**Required Fix**: Add Gemini models to cost table.

**Effort**: 2-3 hours

### 10. Lazy SDK Initialization (Performance)

**Problem**: Dual SDK cold start adds 80-120ms to first request.

**Required Fix**: Initialize Vertex SDK on first use, not in constructor.

**Effort**: 2-3 hours

### 11. Provider-Aware Prompt Builders (Agent-Native)

**Problem**: Prompts are Claude-optimized. "2-3 sentences" means different things to different models.

**Required Fix**: Abstract `SystemPromptBuilder` interface with provider-specific implementations.

**Effort**: 12-16 hours

---

## Medium Priority Issues (Fix Before Production)

### 12. Health Check Implementation (Performance)

The plan shows the interface but not the collector. Need sliding-window implementation.

### 13. Degradation Mode Configuration (Architecture)

What happens when ALL providers are down? No strategy defined.

### 14. Rate Limit Coordination (Performance)

Provider-level rate limiting to prevent cascading failures during failover.

### 15. Same-Provider Evaluation Default (Agent-Native)

Claude should evaluate Claude. Gemini should evaluate Gemini. Cross-evaluation introduces bias.

### 16. Trust Tier Regression Tests (Agent-Native)

Explicit tests validating T1/T2/T3 behavior is identical across providers.

### 17. Data Residency Documentation (Security)

GDPR/CCPA implications with multi-provider not addressed.

---

## Revised Effort Estimate

| Phase                    | Original Estimate | Revised Estimate  | Delta            |
| ------------------------ | ----------------- | ----------------- | ---------------- |
| 0: Foundation            | 16 hours          | 16 hours          | —                |
| **0.5: Data & Security** | —                 | **28-36 hours**   | **NEW**          |
| 1: Vertex Integration    | 20 hours          | 24-28 hours       | +4-8 hours       |
| 2: Evals Migration       | 12 hours          | 16-20 hours       | +4-8 hours       |
| 3: Customer Chatbot      | 24 hours          | 32-40 hours       | +8-16 hours      |
| 4: Multimodal            | TBD               | TBD               | —                |
| **Total**                | **60-80 hours**   | **116-140 hours** | **+56-60 hours** |

**Note**: The additional effort is not "overhead" — it's the difference between a demo and a production system.

---

## Revised Phase Structure

### Phase 0: Foundation (Week 1) — 16 hours

_No changes from original_

### Phase 0.5: Data & Security Foundation (Week 2) — NEW

**Goal**: Enterprise-grade foundation before any provider integration

**Tasks**:

1. Message normalization layer (`CanonicalMessage`)
2. Provider field in traces
3. Workload Identity Federation setup (or ADC for dev)
4. Idempotency key infrastructure for T2/T3 tools
5. Unified error taxonomy
6. Extended `INJECTION_PATTERNS` for Gemini
7. Cost table extension

**Success Criteria**:

- [ ] All existing tests pass with normalization layer
- [ ] Traces include provider attribution
- [ ] No service account key files in codebase
- [ ] Idempotency keys generated for all T2/T3 tool calls

### Phase 1: Vertex Integration (Week 3) — 24-28 hours

_Original + additions_

**Additional Tasks**:

1. Lazy SDK initialization
2. Provider-aware circuit breakers (global + tenant layers)
3. Gemini safety settings configuration
4. Provider selection audit logging

### Phase 2: Evals Migration (Week 4) — 16-20 hours

_Original + additions_

**Additional Tasks**:

1. Same-provider evaluation by default
2. Calibration baseline (1000 traces, both judges)
3. `evalVersion` tracking in results

### Phase 3: Customer Chatbot (Week 5-6) — 32-40 hours

_Original + additions_

**Additional Tasks**:

1. Provider-sticky sessions (select at session start)
2. Provider-aware prompt builders
3. Trust tier regression test suite
4. A/B testing with shadow mode

### Phase 4: Multimodal (Week 7+) — TBD

_Unchanged_

---

## Security Hardening Checklist

Before any production traffic:

- [ ] Workload Identity Federation configured (no key files)
- [ ] Service account has minimum permissions (`roles/aiplatform.user` only)
- [ ] Gemini safety settings at `BLOCK_MEDIUM_AND_ABOVE`
- [ ] Provider selection audit logging enabled
- [ ] `INJECTION_PATTERNS` includes Gemini-specific vectors
- [ ] Data residency requirements documented per tenant
- [ ] DPA signed with Google Cloud

---

## Performance Validation Requirements

Before Phase 3 rollout:

- [ ] Baseline test: 100 concurrent sessions, current system
- [ ] Router overhead test: <20ms P95 from abstraction
- [ ] Failover chaos test: <1% errors during provider switch
- [ ] Cold start test: <3 seconds to first response

---

## Agent Behavior Validation Requirements

Before any customer traffic:

- [ ] Side-by-side response comparison (same input, both providers)
- [ ] Trust tier execution audit (same operations, both providers)
- [ ] Personality consistency test (multi-turn conversations)
- [ ] Prompt injection red-team testing per provider

---

## Reviewer Recommendations Summary

### Architecture Strategist

1. Replace regex classifier with heuristic-enhanced classification
2. Create unified error taxonomy
3. Add message format normalization layer
4. Implement hierarchical circuit breakers
5. Add degradation mode configuration
6. Consider shadow mode testing before rollout

### Security Sentinel

1. Use Workload Identity Federation, never key files
2. Configure Gemini safety settings
3. Extend injection patterns for Gemini
4. Add provider selection audit logging
5. Document data residency requirements
6. Update OWASP compliance documentation

### Data Integrity Guardian

1. Add message normalization layer (MANDATORY)
2. Add provider field to traces (MANDATORY)
3. Implement idempotency keys (MANDATORY)
4. Extend cost table with Vertex models
5. Add provider-aware circuit breakers
6. Maintain dual evaluation for 60 days

### Performance Oracle

1. Lazy SDK initialization
2. Health tracker implementation with sliding window
3. Rate limit coordination at provider level
4. Session provider affinity
5. Tool schema precompilation
6. Background health checks

### Agent-Native Reviewer

1. Provider-sticky sessions (no mid-conversation switching)
2. Provider-aware prompt builders
3. Same-provider evaluation by default
4. Trust tier regression tests
5. Add provider dimension to tracing
6. Document conversation context transfer on failover

---

## Final Verdict

**The plan demonstrates strong understanding of the existing architecture and proposes a reasonable migration path. However, it is not yet enterprise-ready.**

**Proceed to Phase 0 only after committing to the Phase 0.5 addition.**

The additional 56-60 hours of effort ensures:

- No data loss during provider switches
- No security regressions
- No silent cost tracking errors
- Consistent agent personality
- Production-grade reliability

**This is the difference between "it works" and "it works in production at scale."**

---

**Review Compiled**: January 13, 2026
**Review Model**: Claude Opus 4.5
**Total Review Effort**: 5 specialized agents, comprehensive analysis
