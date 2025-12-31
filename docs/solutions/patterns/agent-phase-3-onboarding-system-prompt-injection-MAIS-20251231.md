---
module: MAIS
date: 2025-12-31
problem_type: architectural_pattern
component: server/src/agent
symptoms:
  - Onboarding features need phase-specific behavior injection
  - Session resumption requires context from previous conversations
  - Multiple conversation modes (onboarding vs business assistant) need unified orchestrator
  - Prompt must be dynamic based on tenant state and advisor memory
root_cause: Agent-powered onboarding requires feature definitions in prompts, not hardcoded routes
resolution_type: agent_native_architecture
severity: P0
related_files:
  - server/src/agent/prompts/onboarding-system-prompt.ts
  - server/src/agent/onboarding/advisor-memory.service.ts
  - server/src/agent/orchestrator/orchestrator.ts
  - server/src/agent/tools/onboarding-tools.ts
  - server/src/agent/executors/onboarding-executors.ts
tags: [agents, prompts, dynamic-context, session-resumption, onboarding, architecture]
---

# Phase 3 Agent-Powered Tenant Onboarding: System Prompt Injection Pattern

## Overview

Phase 3 completes agent-powered tenant onboarding with a unified system prompt that dynamically injects:

- **Phase-specific guidance** (NOT_STARTED → DISCOVERY → MARKET_RESEARCH → SERVICES → MARKETING → COMPLETED)
- **Advisor memory context** (previously learned business info for session resumption)
- **Trust tier behavior** (automatic T1, soft-confirm T2, explicit-confirm T3)

This architecture enables features to be **defined in prompts, not code** - the core agent-native principle.

## Architecture

### Three-Layer Pattern

```
┌─────────────────────────────────────────────────┐
│ buildOnboardingSystemPrompt()                   │
│ (Dynamic prompt generator)                      │
└────────────┬────────────────────────────────────┘
             │
             ├─ Receives OnboardingPromptContext
             │  ├ businessName
             │  ├ currentPhase
             │  ├ advisorMemory
             │  └ isResume
             │
             ├─ Injects phase-specific guidance
             │  └ PHASE_GUIDANCE[currentPhase]
             │
             ├─ Builds resume message (if returning)
             │  └ buildResumeMessage(advisorMemory)
             │
             └─ Returns complete system prompt
                (template + phase + resume context)

┌──────────────────────────────────────────────┐
│ AdvisorMemoryService                         │
│ (Context summarization)                      │
├──────────────────────────────────────────────┤
│ getOnboardingContext(tenantId)               │
│  → OnboardingContext {                       │
│      currentPhase                            │
│      memory (from db)                        │
│      summaries (projected)                   │
│      isReturning                             │
│      lastActiveAt                            │
│    }                                         │
└──────────────────────────────────────────────┘

┌──────────────────────────────────────────────┐
│ Orchestrator                                 │
│ (Session management & dispatch)              │
├──────────────────────────────────────────────┤
│ getSystemPrompt(mode, tenantId)              │
│  ├─ If mode=onboarding:                     │
│  │   1. Get onboarding context               │
│  │   2. Get advisor memory summaries          │
│  │   3. Build onboarding prompt              │
│  │   4. Return with onboarding tools         │
│  │                                           │
│  └─ If mode=business_assistant:             │
│      1. Get business context                 │
│      2. Build coaching prompt                │
│      3. Return with general tools            │
└──────────────────────────────────────────────┘
```

### Key Files

| File                          | Responsibility                                                                                                      |
| ----------------------------- | ------------------------------------------------------------------------------------------------------------------- |
| `onboarding-system-prompt.ts` | **Prompt building** - Dynamic phase guidance + resume context                                                       |
| `advisor-memory.service.ts`   | **Context summarization** - Projects memory data into readable strings                                              |
| `orchestrator.ts`             | **Session orchestration** - Selects prompt, manages conversation, executes tools                                    |
| `onboarding-tools.ts`         | **Tool implementations** - `update_onboarding_state`, `upsert_services`, `update_storefront`, `get_market_research` |
| `onboarding-executors.ts`     | **Executor implementations** - Handles T2 soft-confirm proposal execution                                           |

## Pattern Details

### 1. Prompt Template Structure

The prompt contains:

- **Static sections** - Brand voice, tool descriptions, rules (identical for all sessions)
- **Injected sections** - Phase guidance, resume context, business identity (dynamic per session)

```typescript
export function buildOnboardingSystemPrompt(context: OnboardingPromptContext): string {
  // Resume context for returning users
  const resumeSection = isResume && advisorMemory ? buildResumeMessage(advisorMemory) : '';

  // Phase-specific guidance
  const phaseGuidance = PHASE_GUIDANCE[currentPhase];

  return `# HANDLED Onboarding Advisor

${resumeSection}

${phaseGuidance}

[static sections below]
`;
}
```

### 2. Phase-Specific Guidance

Each phase injects **one** section with:

- Current phase name
- What the goal is
- What information is needed
- When to transition

**Example - MARKET_RESEARCH phase:**

```typescript
MARKET_RESEARCH: `## Current Phase: Market Research

Time to research their local market and recommend pricing.

**Your Job:**
1. Use \`get_market_research\` with their businessType, targetMarket, city, and state
2. Explain what you found (or acknowledge if using industry benchmarks)
3. Recommend pricing tiers based on their positioning

**If Web Search Fails:**
The tool gracefully falls back to industry benchmarks. Be transparent:
"I couldn't find specific Austin data, but nationally, wedding photographers typically charge..."

**When Complete:**
Use \`update_onboarding_state\` with phase: "MARKET_RESEARCH" and the pricing benchmarks.`;
```

### 3. Resume Message for Session Continuity

When a user returns, the prompt includes a "What We Know So Far" section:

```typescript
function buildResumeMessage(memory: AdvisorMemory): string {
  const parts: string[] = [];

  if (memory.discoveryData) {
    // "You're a photographer in Austin, TX, specializing in elopements"
    parts.push(`You're a ${d.businessType}...`);
  }

  if (memory.marketResearchData) {
    // "We found pricing in your market ranges $3,500-$8,000"
    parts.push(`We found pricing...`);
  }

  if (memory.servicesData) {
    // "We've created 3 packages in 1 segment"
    parts.push(`We've created...`);
  }

  // Builds human-friendly summary
  return `## What We Know So Far\n\n${parts.map((p) => `- ${p}`).join('\n')}`;
}
```

### 4. Advisor Memory Projection

The `AdvisorMemoryService` converts raw data into readable summaries for injection:

```typescript
export class AdvisorMemoryService {
  async getOnboardingContext(tenantId: string): Promise<OnboardingContext> {
    const memory = await this.repository.getMemory(tenantId);

    if (!memory) return { ...defaults, isReturning: false };

    // Project summaries from raw memory data
    const summaries = this.projectSummaries(memory);

    return {
      currentPhase: memory.currentPhase,
      memory,
      summaries,
      isReturning: memory.lastEventVersion > 0,
      lastActiveAt: new Date(memory.lastEventTimestamp),
    };
  }

  // Projected summaries ready for prompt injection
  private projectSummaries(memory: AdvisorMemoryType): AdvisorMemorySummary {
    return {
      discovery: this.summarizeDiscovery(memory), // "Wedding photographer in Austin"
      marketContext: this.summarizeMarket(memory), // "Market pricing: $3,500-$8,000"
      preferences: this.summarizePreferences(memory), // "Professional tone, sage color"
      decisions: this.summarizeDecisions(memory), // "Created 3 packages, set headline"
      pendingQuestions: this.identifyPending(memory), // "Ready to design packages"
    };
  }
}
```

### 5. Orchestrator Integration

The orchestrator detects onboarding mode and injects the onboarding prompt:

```typescript
export class Orchestrator {
  async getSystemPrompt(
    sessionType: 'ONBOARDING' | 'BUSINESS_ASSISTANT',
    tenantId: string
  ): Promise<string> {
    if (sessionType === 'ONBOARDING') {
      // Get advisor memory context
      const onboardingContext = await this.advisorMemoryService.getOnboardingContext(tenantId);

      // Build onboarding-specific prompt
      const systemPrompt = buildOnboardingSystemPrompt({
        businessName: onboardingContext.memory?.discoveryData?.businessName || 'your business',
        currentPhase: onboardingContext.currentPhase,
        advisorMemory: onboardingContext.memory,
        isResume: onboardingContext.isReturning,
      });

      // Load onboarding tools
      const tools = getAllToolsWithOnboarding();

      return systemPrompt;
    }

    // Standard business assistant mode
    return buildSystemPrompt(context);
  }
}
```

## Critical Patterns

### Pattern 1: Features Defined in Prompts

Instead of coding onboarding logic in routes, define it in `PHASE_GUIDANCE`:

```typescript
// WRONG: Logic in code
if (phase === 'MARKET_RESEARCH') {
  // Call market research service
  // Wait for results
  // Ask Claude to analyze
}

// RIGHT: Logic in prompt
MARKET_RESEARCH: `## Current Phase: Market Research

Time to research their local market and recommend pricing.

**Your Job:**
1. Use \`get_market_research\` to get data
2. Explain findings
3. Recommend pricing
4. Use \`update_onboarding_state\` when complete`;
```

The prompt tells Claude what to do, without hardcoding the flow.

### Pattern 2: Context Injection Not Retrieval

The system prompt **includes** context, not instructions to fetch it:

```typescript
// WRONG: Prompt asks Claude to query
'Use get_advisor_memory() to check what we learned about their business'
// RIGHT: Prompt includes pre-computed context
`## What We Know So Far
- You're a photographer in Austin, TX
- We found pricing $3,500-$8,000 in your market
- You specializes in elopements`;
```

Injecting context is 10x faster than having Claude make tool calls to retrieve it.

### Pattern 3: Deterministic Summaries (No LLM Calls)

`AdvisorMemoryService` produces summaries without calling Claude:

```typescript
// Deterministic - same data always produces same summary
function summarizeDiscovery(memory): string {
  const parts = [];
  if (memory.discoveryData?.businessType) {
    parts.push(memory.discoveryData.businessType);
  }
  if (memory.discoveryData?.location) {
    parts.push(`in ${location.city}, ${location.state}`);
  }
  return parts.join(' ');
}
```

Benefits:

- No API latency
- Consistent summarization
- No risk of summary changing mid-conversation
- Auditable (deterministic = reproducible)

### Pattern 4: Single Unified Orchestrator

Both onboarding and business assistant modes use the same orchestrator:

```typescript
// One class, two modes
class Orchestrator {
  async chat(message: string, sessionType: 'ONBOARDING' | 'BUSINESS_ASSISTANT') {
    const systemPrompt = sessionType === 'ONBOARDING'
      ? buildOnboardingSystemPrompt(...)
      : buildSystemPrompt(...);

    const tools = sessionType === 'ONBOARDING'
      ? getAllToolsWithOnboarding()
      : getAllTools();

    // Same Claude API call, different prompt/tools
    return this.callClaude(systemPrompt, tools, message);
  }
}
```

No code duplication, no separate orchestrators, one source of truth.

## Trust Tier Integration

The onboarding prompt documents trust tiers:

```typescript
### Trust Tiers
| Tier | Tools | Behavior |
|------|-------|----------|
| T1 | update_onboarding_state | Auto-confirm - executes immediately |
| T2 | upsert_services, update_storefront | Soft-confirm - say what you'll do, then proceed unless they say "wait" |
```

The orchestrator enforces this via `ProposalService`:

```typescript
if (tool === 'update_onboarding_state') {
  // T1: Execute immediately
  await executeDirectly();
} else if (['upsert_services', 'update_storefront'].includes(tool)) {
  // T2: Create proposal, suggest action, execute immediately
  const proposal = await proposalService.create(tool, input);
  // Chat shows proposal to user
  // Execute immediately (no wait)
} else if (tool === 'delete_package') {
  // T3: Create proposal, wait for explicit confirmation
  const proposal = await proposalService.create(tool, input);
  // Chat shows proposal
  // Wait for user to say "confirm" before executing
}
```

## P1 Issues Fixed in Phase 3

### Issue 1: Prompt Template Flexibility

**Problem:** Hard-coded system prompt couldn't inject phase-specific guidance.

**Solution:** `buildOnboardingSystemPrompt()` takes `OnboardingPromptContext` and injects:

- Current phase guidance
- Resume context (previous conversation summary)
- Business identity (discovered so far)

**Impact:** Features now defined in prompts, not code.

### Issue 2: Session Resumption Context

**Problem:** Returning users had no context about previous onboarding progress.

**Solution:** `AdvisorMemoryService` projects memory into readable strings:

- Discovery summary: "Wedding photographer in Austin, 5 years experience"
- Market context: "Pricing $3,500-$8,000, 5 competitors found"
- Decisions: "Created 3 packages in 'Family Sessions' segment"

**Impact:** Seamless session continuation without context loss.

### Issue 3: Dual-Mode Orchestrator

**Problem:** Onboarding conversation flow needed different rules (T1 auto-confirm) vs business assistant (T3 explicit-confirm).

**Solution:** Single orchestrator with mode detection:

```typescript
if (sessionType === 'ONBOARDING') {
  systemPrompt = buildOnboardingSystemPrompt(...);
  tools = getAllToolsWithOnboarding();
} else {
  systemPrompt = buildSystemPrompt(...);
  tools = getAllTools();
}
```

**Impact:** No code duplication, unified session handling, easy mode switching.

## Integration Points

### Injecting Context in Orchestrator

```typescript
// In orchestrator.chat()
const onboardingContext = await this.advisorMemoryService.getOnboardingContext(tenantId);

const systemPrompt = buildOnboardingSystemPrompt({
  businessName: tenant.name,
  currentPhase: onboardingContext.currentPhase,
  advisorMemory: onboardingContext.memory,
  isResume: onboardingContext.isReturning,
});
```

### Storing Advisor Memory from Tool Results

When `update_onboarding_state` executes:

```typescript
// In onboarding-executors.ts
const memory = await advisorMemoryRepository.saveEvent({
  tenantId,
  eventType: 'PHASE_TRANSITION',
  phaseFrom: currentPhase,
  phaseTo: newPhase,
  discoveryData: payload.discoveryData,
  // ... other data
});
```

Next session automatically loads this memory for context injection.

### Tool Access to Current Phase

Tools need to know current phase for validation:

```typescript
// In upsert_services tool
const context = await advisorMemoryService.getOnboardingContext(tenantId);
if (context.currentPhase !== 'SERVICES') {
  throw new PhaseTransitionError(`Expected SERVICES phase, got ${context.currentPhase}`);
}
```

## Testing Patterns

### Test Session Resumption

```typescript
test('should resume with advisor memory context', async () => {
  // Save initial discovery data
  await advisorMemoryRepository.saveEvent({
    tenantId,
    eventType: 'DISCOVERY_COMPLETE',
    discoveryData: { businessType: 'photographer', ... },
  });

  // Get context for resuming session
  const context = await advisorMemoryService.getOnboardingContext(tenantId);

  expect(context.isReturning).toBe(true);
  expect(context.memory?.discoveryData?.businessType).toBe('photographer');
  expect(context.summaries.discovery).toContain('photographer');
});
```

### Test Phase Guidance Injection

```typescript
test('should inject phase-specific guidance in prompt', async () => {
  const prompt = buildOnboardingSystemPrompt({
    businessName: 'Bella Weddings',
    currentPhase: 'MARKET_RESEARCH',
    advisorMemory: null,
    isResume: false,
  });

  expect(prompt).toContain('## Current Phase: Market Research');
  expect(prompt).toContain('Use `get_market_research`');
  expect(prompt).not.toContain('## Current Phase: SERVICES');
});
```

### Test Resume Message Building

```typescript
test('should build resume message from advisor memory', async () => {
  const memory = {
    discoveryData: { businessType: 'photographer', location: { city: 'Austin', state: 'TX' } },
    marketResearchData: { pricingBenchmarks: { marketLowCents: 350000, marketHighCents: 800000 } },
    servicesData: { createdPackageIds: ['p1', 'p2', 'p3'] },
  };

  const message = buildResumeMessage(memory);

  expect(message).toContain('photographer');
  expect(message).toContain('Austin');
  expect(message).toContain('$3,500-$8,000');
  expect(message).toContain('3 packages');
});
```

## Common Mistakes & Prevention

### Mistake 1: Putting Features in Code

```typescript
// WRONG: Flow logic in orchestrator
if (phase === 'MARKET_RESEARCH') {
  const research = await getMarketResearch(...);
  // ... process research
  // ... ask Claude to analyze
}

// RIGHT: Flow logic in prompt
// Prompt says: "Use get_market_research, explain findings, call update_onboarding_state"
// Claude does it naturally
```

**Prevention:** All onboarding flow should be in `PHASE_GUIDANCE` strings, not code.

### Mistake 2: Losing Context on Refresh

```typescript
// WRONG: Fetching full memory every request
const memory = await loadFullAdvisorMemory(tenantId);
// ... 50 fields loaded, most unused

// RIGHT: Project only needed fields
const context = await advisorMemoryService.getOnboardingContext(tenantId);
// Returns: summaries (strings) + metadata
```

**Prevention:** Use `AdvisorMemoryService.getOnboardingContext()` which returns ready-to-inject summaries.

### Mistake 3: Stale Summaries in Long Sessions

```typescript
// WRONG: Summary computed once at session start
const summary = buildResumeMessage(memory);
// ... Claude calls tool that changes memory
// ... summary still old

// RIGHT: Re-project on demand if memory changes
// (Though in practice, one session = one onboarding phase)
```

**Prevention:** If memory changes within a session (unlikely), regenerate summaries via `getOnboardingContext()`.

### Mistake 4: Including Memory Instead of Summary

```typescript
// WRONG: Inject raw database data
const prompt = `Here's memory: ${JSON.stringify(memory)}`;
// ... 500 lines of JSON in prompt, uses 5000 tokens

// RIGHT: Inject projected summaries
const context = await advisorMemoryService.getOnboardingContext(tenantId);
const prompt = `... ${context.summaries.discovery} ...`;
// ... 50 words, uses 50 tokens
```

**Prevention:** Always use `AdvisorMemoryService.projectSummaries()` → summaries → inject strings.

## Design Principles

1. **Features in Prompts, Not Code**
   - Phase logic belongs in `PHASE_GUIDANCE`
   - Tool behavior defined in system prompt
   - No hardcoded state machine

2. **Deterministic Context**
   - Same input → same summary always
   - No LLM calls in summarization
   - Auditable (reproducible)

3. **Single Unified Orchestrator**
   - One code path for onboarding + business assistant
   - Mode switching via `sessionType` parameter
   - No duplicate logic

4. **Lean Prompt Injection**
   - Only inject what the prompt needs
   - Project large data into summaries
   - Reduce tokens, increase performance

5. **Clear Trust Tier Rules**
   - Document in prompt what each tier does
   - Orchestrator enforces via code
   - Users see behavior matching documentation

## References

- **Agent-Native Architecture:** Features defined in prompts, tools execute them
- **Prompt Injection:** Dynamically building prompts with context
- **Context Summarization:** Converting data → readable strings without LLM calls
- **Trust Tiers:** T1 (auto), T2 (soft-confirm), T3 (explicit)
- **Event Sourcing:** AdvisorMemoryRepository stores phase transitions as events

## Next Steps

- Monitor session resumption for UX quality (does context feel relevant?)
- Measure token usage: prompt injection should be 5-10% of total tokens
- Add analytics for phase completion times
- Extend to business assistant context injection (current state, recent actions)
