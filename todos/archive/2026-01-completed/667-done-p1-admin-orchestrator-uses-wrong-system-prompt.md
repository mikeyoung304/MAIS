---
status: complete
priority: p1
issue_id: '667'
tags:
  - code-review
  - onboarding
  - agent
  - root-cause
dependencies: []
---

# AdminOrchestrator Uses Wrong System Prompt for Onboarding

## Problem Statement

The `AdminOrchestrator.buildSystemPrompt()` method ALWAYS uses the admin prompt template, even when the tenant is in active onboarding. This causes the agent to skip the onboarding discovery phases and immediately suggest Stripe setup because the admin prompt says "help them connect Stripe first."

**Why it matters:** This is the ROOT CAUSE of the broken onboarding flow. Users receive advice to connect Stripe immediately instead of going through the proper discovery → market research → services → marketing flow.

## Findings

**Location:** `server/src/agent/orchestrator/admin-orchestrator.ts` lines 202-207

**Current Code:**

```typescript
protected async buildSystemPrompt(context: PromptContext): Promise<string> {
  // Build session context with caching
  const sessionContext = await this.buildCachedContext(context.tenantId, context.sessionId);

  return SYSTEM_PROMPT_TEMPLATE.replace('{BUSINESS_CONTEXT}', sessionContext.contextPrompt);
  // ^^^ ALWAYS uses admin template, never checks onboarding mode!
}
```

**Expected Behavior:**

- When `isOnboardingActive(onboardingPhase)` returns true, use `buildOnboardingSystemPrompt(phase, advisorMemory)`
- When onboarding is complete/skipped, use the admin template

**Contrast with `getTools()`:**

```typescript
protected getTools(): AgentTool[] {
  const ctx = getRequestContext();
  return ctx?.isOnboardingMode ? getAllToolsWithOnboarding() : getAllTools();
  // ^^^ Correctly switches tools based on mode
}
```

The tools are correctly switched, but the prompt is not!

## Proposed Solutions

### Option A: Mirror getTools() Pattern (Recommended)

**Pros:** Consistent pattern, minimal code change
**Cons:** Need to import onboarding prompt builder
**Effort:** Small (30 min)
**Risk:** Low

```typescript
protected async buildSystemPrompt(context: PromptContext): Promise<string> {
  const ctx = getRequestContext();

  if (ctx?.isOnboardingMode) {
    // Get onboarding phase and advisor memory
    const tenant = await this.prisma.tenant.findUnique({
      where: { id: context.tenantId },
      select: { onboardingPhase: true },
    });
    const phase = parseOnboardingPhase(tenant?.onboardingPhase);
    const memory = await advisorMemoryRepo.projectFromEvents(context.tenantId);
    return buildOnboardingSystemPrompt(phase, memory);
  }

  // Regular admin mode
  const sessionContext = await this.buildCachedContext(context.tenantId, context.sessionId);
  return SYSTEM_PROMPT_TEMPLATE.replace('{BUSINESS_CONTEXT}', sessionContext.contextPrompt);
}
```

### Option B: Store Phase in Request Context

**Pros:** Avoids duplicate DB query
**Cons:** More refactoring of runInRequestContext
**Effort:** Medium (1 hour)
**Risk:** Low

Extend `RequestContext` to include `onboardingPhase` so it's available in `buildSystemPrompt()`.

## Recommended Action

**Option A** - Mirror the getTools() pattern. The code already correctly detects onboarding mode in `chat()` and stores it in request context. Just need to check it in `buildSystemPrompt()` and use the appropriate prompt builder.

## Technical Details

**Affected Files:**

- `server/src/agent/orchestrator/admin-orchestrator.ts` - Add conditional in buildSystemPrompt()
- May need to import from `server/src/agent/prompts/onboarding-system-prompt.ts`

**Dependencies:**

- `buildOnboardingSystemPrompt()` from onboarding-system-prompt.ts
- `advisorMemoryRepo.projectFromEvents()` for memory context
- `parseOnboardingPhase()` from contracts

## Acceptance Criteria

- [ ] When tenant.onboardingPhase is NOT_STARTED, DISCOVERY, MARKET_RESEARCH, SERVICES, or MARKETING, use onboarding prompt
- [ ] When tenant.onboardingPhase is COMPLETED or SKIPPED (or null), use admin prompt
- [ ] Agent provides phase-appropriate guidance (e.g., "Tell me about your business" in DISCOVERY)
- [ ] Agent does NOT jump to Stripe setup during discovery phase
- [ ] Existing tests pass
- [ ] Add test for prompt switching based on onboarding phase

## Work Log

| Date       | Action                   | Learnings                                                                           |
| ---------- | ------------------------ | ----------------------------------------------------------------------------------- |
| 2026-01-08 | Created from code review | Identified by agent-native-architecture reviewer as ROOT CAUSE of broken onboarding |

## Resources

- Onboarding prompt builder: `server/src/agent/prompts/onboarding-system-prompt.ts`
- Phase machine: `server/src/agent/onboarding/state-machine.ts`
- Related: #668 (getGreeting also uses wrong function)
