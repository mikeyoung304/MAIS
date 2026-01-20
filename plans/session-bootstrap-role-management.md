# Session Bootstrap & Onboarding Protocol (Simplified)

> **Validated by:** 6 reviewers (DHH, Kieran, Simplicity, Agent Architecture, Agent-Native Skill, Best-Practices v2.26.5)
> **Compound Engineering:** Plugin v2.26.5, all principles validated
> **Status:** Ready for `/workflows:work`

---

## Overview

Transform MAIS agent system to deliver a "Handled" onboarding experience where new users get a complete web presence in 15-20 minutes.

**Problem:** Users don't want to spend hours building a website. They want it **handled**.

**Solution:** Goal-based onboarding via Concierge agent with bootstrap context injection.

---

## Architecture (Simplified)

```
┌─────────────────────────────────────────────────────────────────────────┐
│                           MAIS Backend                                   │
│  ┌─────────────────────────────────────────────────────────────────────┐ │
│  │  /v1/internal/agent/bootstrap                                        │ │
│  │  Returns: { tenantId, businessName, industry, tier, onboardingDone } │ │
│  │  Cache: 30-min TTL, backend only (no dual caching)                   │ │
│  └─────────────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────────────┘
                                      │
                                      ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                         CONCIERGE (Cloud Run)                            │
│                                                                          │
│  Mode Detection: if (!bootstrap.onboardingDone) → ONBOARDING MODE       │
│                                                                          │
│  ┌─────────────────────────────────────────────────────────────────────┐ │
│  │  GOAL-BASED PROMPT (not phase-based)                                 │ │
│  │  - Mission: Get business online in 15-20 min                         │ │
│  │  - Agent decides the path                                            │ │
│  │  - "Generate, Then Ask" principle                                    │ │
│  └─────────────────────────────────────────────────────────────────────┘ │
│                                                                          │
│  Tools: Existing specialists + complete_onboarding                       │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## What We're Building

### Phase 1: Bootstrap Endpoint (2-3 days)

- [x] Add `/v1/internal/agent/bootstrap` endpoint
- [x] Return tenant context (id, name, industry, tier, onboardingDone)
- [x] Cache with 30-min TTL (backend only)
- [x] Use existing `advisorMemory` table for persistence

### Phase 2: Concierge Onboarding Mode (3-4 days)

- [x] Add `needsOnboarding()` check (single boolean)
- [x] Inject goal-based system prompt when in onboarding mode
- [x] Add `complete_onboarding` tool for explicit completion signal
- [x] Add `store_discovery_fact` tool for active memory management
- [x] Generate resume greeting from `advisorMemory`

### Phase 3: Integration & Polish (2-3 days)

- [x] Wire draft generation to Storefront specialist
- [x] Add T3 confirmation for publish action
- [x] Test multi-session resume flow (via unit tests)
- [ ] Add completion rate tracking (deferred to observability phase)

---

## Implementation Details

### Bootstrap Endpoint

**File:** `server/src/routes/internal-agent.routes.ts`

```typescript
// Simplified bootstrap - just what the agent needs
const BootstrapResponseSchema = z.object({
  tenantId: z.string(),
  businessName: z.string(),
  industry: z.string().nullable(),
  tier: z.enum(['free', 'starter', 'pro', 'enterprise']),
  onboardingDone: z.boolean(),
  // From existing advisorMemory table
  discoveryData: z.record(z.unknown()).nullable(),
});

// Single cache layer (backend only)
const bootstrapCache = new Map<string, { data: BootstrapResponse; expiresAt: number }>();
const CACHE_TTL_MS = 30 * 60 * 1000; // 30 minutes

router.post('/bootstrap', async (req, res) => {
  const { tenantId } = req.body;

  // Check cache
  const cached = bootstrapCache.get(tenantId);
  if (cached && cached.expiresAt > Date.now()) {
    return res.json(cached.data);
  }

  // Fetch from database
  const tenant = await prisma.tenant.findUnique({
    where: { id: tenantId },
    select: { id: true, name: true, subscriptionTier: true, onboardingPhase: true },
  });

  const advisorMemory = await prisma.advisorMemory.findUnique({
    where: { tenantId },
    select: { discoveryData: true },
  });

  const response = {
    tenantId: tenant.id,
    businessName: tenant.name,
    industry: advisorMemory?.discoveryData?.businessType ?? null,
    tier: tenant.subscriptionTier ?? 'free',
    onboardingDone: tenant.onboardingPhase === 'COMPLETED',
    discoveryData: advisorMemory?.discoveryData ?? null,
  };

  // Cache and return
  bootstrapCache.set(tenantId, { data: response, expiresAt: Date.now() + CACHE_TTL_MS });
  res.json(response);
});
```

### Mode Detection (Simplified)

**File:** `server/src/agent-v2/deploy/concierge/src/onboarding-mode.ts`

```typescript
/**
 * Single boolean check - no complex conditions
 */
export function needsOnboarding(bootstrap: BootstrapResponse): boolean {
  return !bootstrap.onboardingDone;
}

/**
 * Generate resume greeting from existing advisorMemory
 */
export function getResumeGreeting(discoveryData: Record<string, unknown> | null): string {
  if (!discoveryData?.businessType) return '';

  const parts = [`Welcome back! I remember you're a ${discoveryData.businessType}`];

  if (discoveryData.location) {
    const loc = discoveryData.location as { city?: string; state?: string };
    if (loc.city) parts.push(`in ${loc.city}`);
  }

  return parts.join(' ') + '. Ready to continue?';
}
```

### Goal-Based System Prompt

**File:** `server/src/agent-v2/deploy/concierge/src/prompts/onboarding.ts`

```typescript
export const ONBOARDING_PROMPT = `
## Onboarding Mode Active

You are helping a new user get their business "handled."

### Your Mission
Get this business online with a complete storefront in 15-20 minutes.

### What "Done" Looks Like
- Service packages created (typically 3: Good/Better/Best)
- Pricing validated against local market
- Homepage copy that matches their brand voice
- They clicked publish and have a live link

### How You Get There
You decide. Start with open questions, fill gaps as you notice them,
research when you need market data, generate content when you have enough context.

### Your Personality
- Friendly expert - you know your stuff but you're not stuffy
- Cheeky and efficient - respect their time
- Funny but concise - a quip here and there, not a standup routine

### Key Behaviors
1. **Listen first** - Let them tell you about their business
2. **Extract as they go** - Note businessType, location, pricing as mentioned
3. **Fill gaps naturally** - Don't interrogate, weave questions into conversation
4. **Research to validate** - Use web search to verify pricing against market
5. **Generate complete drafts** - Never ask "what should your headline be?"
6. **Show, then ask** - "Here's what I've got - what feels off?"

### Memory
You have access to stored discovery data. Use it to:
→ Resume naturally: "Last time we were working on your pricing..."
→ Avoid re-asking: Check what you already know before asking
→ Store new facts: Call store_discovery_fact when you learn something

### Tools Available
→ store_discovery_fact - Save facts as you learn them
→ delegate to Storefront - Create packages, update sections
→ delegate to Research - Get market pricing data
→ complete_onboarding - Call when they publish (explicit signal)

### Never Do
- Ask checklist questions ("What's your name? Business type?")
- Leave generation to them ("What would you like your headline to say?")
- Over-explain ("Let me tell you about the importance of pricing...")
- Be generic ("Your business is great!" - be specific to THEIR business)
`;
```

### Completion Signal Tool

```typescript
/**
 * Explicit completion signal - no heuristic detection
 * (Required by agent-native-architecture principle)
 */
export const completeOnboardingTool = new FunctionTool({
  name: 'complete_onboarding',
  description: 'Mark onboarding as complete. Call this AFTER user has published their storefront.',
  parameters: z.object({
    publishedUrl: z.string().describe('The live storefront URL'),
    packagesCreated: z.number().describe('Number of packages created'),
    summary: z.string().describe('Brief summary of what was set up'),
  }),
  execute: async (params, ctx) => {
    const tenantId = getTenantId(ctx);
    if (!tenantId) return { error: 'No tenant context' };

    // Update tenant onboarding status
    await updateOnboardingStatus(tenantId, 'COMPLETED', params);

    // Invalidate bootstrap cache
    bootstrapCache.delete(tenantId);

    return {
      success: true,
      message: `Onboarding complete! Live at ${params.publishedUrl}`,
    };
  },
});
```

### Active Memory Tool

```typescript
/**
 * Active memory management - agent controls when to store
 * (Not passive PreloadMemoryTool - agent decides what's important)
 */
export const storeDiscoveryFactTool = new FunctionTool({
  name: 'store_discovery_fact',
  description: 'Store a fact about the business. Call when you learn something important.',
  parameters: z.object({
    key: z.enum([
      'businessType',
      'businessName',
      'location',
      'targetMarket',
      'priceRange',
      'yearsInBusiness',
      'teamSize',
      'uniqueValue',
    ]),
    value: z.unknown().describe('The value to store'),
  }),
  execute: async (params, ctx) => {
    const tenantId = getTenantId(ctx);
    if (!tenantId) return { error: 'No tenant context' };

    // Update advisorMemory.discoveryData
    await prisma.advisorMemory.upsert({
      where: { tenantId },
      create: {
        tenantId,
        discoveryData: { [params.key]: params.value },
      },
      update: {
        discoveryData: {
          ...existing.discoveryData,
          [params.key]: params.value,
        },
      },
    });

    return { stored: true, key: params.key };
  },
});
```

---

## Success Metrics

| Metric                   | Target   | Measurement                                |
| ------------------------ | -------- | ------------------------------------------ |
| **Completion Rate**      | > 70%    | Users who start → call complete_onboarding |
| Time to First Draft      | < 10 min | Session start → drafts shown               |
| Time to Publish          | < 20 min | Session start → publish                    |
| Multi-Session Completion | > 50%    | Users who leave → return and complete      |

---

## What We Cut (350+ lines)

| Component                     | Why Cut                                 | Reviewer           |
| ----------------------------- | --------------------------------------- | ------------------ |
| Vertex AI Memory Bank         | Postgres `advisorMemory` already exists | DHH, Simplicity    |
| `getPhaseGuidance()` function | Cardinal sin: bundles judgment in code  | Agent-Native       |
| OnboardingMemoryService class | Over-engineering                        | Simplicity         |
| Three memory scopes           | One tenant scope is enough              | Simplicity         |
| Agent Role Schema (120 lines) | Premature abstraction                   | DHH                |
| Dual caching                  | Backend-only is sufficient              | Simplicity         |
| Phase-specific prompts        | LLMs infer from goals                   | Agent Architecture |

---

## Acceptance Criteria

### Functional

- [ ] Bootstrap endpoint returns tenant context in < 200ms (cached)
- [ ] Concierge detects onboarding mode from single boolean
- [ ] Resume greeting shows relevant stored facts
- [ ] `complete_onboarding` tool marks tenant as done
- [ ] Cache invalidates on completion

### Non-Functional

- [ ] No cross-tenant data leakage (all queries scoped by tenantId)
- [ ] Bootstrap cache: 30-min TTL, 1000 max entries
- [ ] Graceful degradation if bootstrap fails (continue with tenantId only)

### Quality Gates

- [ ] Unit tests for bootstrap endpoint
- [ ] Integration test for onboarding flow
- [ ] Multi-session resume test
- [ ] Run `/workflows:compound` after implementation

---

## References

### Compound Engineering (Skills-Based)

- `agent-native-architecture` SKILL.md - 5 core principles
- `system-prompt-design.md` - Features as prompts, judgment criteria
- `refactoring-to-prompt-native.md` - Remove workflow-shaped tools
- `dynamic-context-injection.md` - Bootstrap pattern

### Internal

- `server/src/agent/onboarding/advisor-memory.service.ts` - Memory patterns
- `server/src/agent-v2/deploy/concierge/src/agent.ts` - Current implementation
- `docs/solutions/patterns/ADK_A2A_PREVENTION_INDEX.md` - A2A pitfalls

### Review History

- 4-reviewer consensus: DHH, Kieran, Simplicity, Agent Architecture
- Agent-Native Skill: Approved 82% (41/50)
- Best-Practices v2.26.5: Validated (skills-first)

---

## Post-Implementation

After completing this work:

1. Run `/workflows:compound` to document the goal-based onboarding pattern
2. Track completion rate for 2 weeks
3. Iterate on prompts based on where users get stuck
