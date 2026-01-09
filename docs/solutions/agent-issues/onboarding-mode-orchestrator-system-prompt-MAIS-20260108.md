---
title: Onboarding Mode Orchestrator Uses Wrong System Prompt
date: 2026-01-08
category: agent-issues
severity: P1
tags: [agent, onboarding, orchestrator, system-prompt, dual-mode]
component: AdminOrchestrator
symptoms:
  - Agent immediately suggests Stripe Connect instead of discovery phase
  - New tenant says "I'm a wedding photographer" → agent responds with Stripe setup
  - Onboarding phases (DISCOVERY, MARKET_RESEARCH, SERVICES, MARKETING) all skipped
root_cause: buildSystemPrompt() always returned admin template without checking isOnboardingMode
resolution: Check mode in buildSystemPrompt(), getGreeting(), and use API greeting in frontend
todos_resolved: ['667', '668', '669', '670']
---

# Onboarding Mode Orchestrator Uses Wrong System Prompt

## Problem Statement

The onboarding system was completely broken. When a new tenant started chatting with the agent, instead of guiding them through the discovery phase ("Tell me about your business"), the agent immediately jumped to Stripe Connect setup ("Let's get your payments set up").

**Expected flow:** DISCOVERY → MARKET_RESEARCH → SERVICES → MARKETING → COMPLETED
**Actual flow:** Immediately suggests Stripe (admin mode behavior)

## Symptoms Observed

1. User: "I'm a wedding photographer based in Austin, Texas"
2. Agent: Calls `initiate_stripe_onboarding` tool immediately
3. Greeting: Generic "Salutations. Are you ready to get handled?" instead of phase-aware greeting
4. "Growth Assistant" terminology still used (outdated)

## Investigation

### Code Review with 4 Parallel Agents

Launched parallel review agents:

- `security-sentinel`
- `architecture-strategist`
- `code-simplicity-reviewer`
- `agent-native-architecture`

### Root Cause Discovery

The `agent-native-architecture` reviewer found the smoking gun:

```typescript
// server/src/agent/orchestrator/admin-orchestrator.ts lines 202-207

protected async buildSystemPrompt(context: PromptContext): Promise<string> {
  const sessionContext = await this.buildCachedContext(context.tenantId, context.sessionId);
  return SYSTEM_PROMPT_TEMPLATE.replace('{BUSINESS_CONTEXT}', sessionContext.contextPrompt);
  // ^^^ ALWAYS uses admin template! Never checks isOnboardingMode
}
```

**The admin template says:** "Help them connect Stripe first. It's the foundation."

**Contrast with getTools()** which correctly switches:

```typescript
protected getTools(): AgentTool[] {
  const ctx = getRequestContext();
  return ctx?.isOnboardingMode ? getAllToolsWithOnboarding() : getAllTools();
  // ^^^ Correctly switches based on mode
}
```

**The bug:** Tools switched correctly, but the prompt never switched. The agent had onboarding tools but admin instructions!

## Three Cascading Bugs

| #   | Location              | Bug                                                        | Impact                               |
| --- | --------------------- | ---------------------------------------------------------- | ------------------------------------ |
| 1   | `buildSystemPrompt()` | Always returns admin template                              | Agent follows "connect Stripe first" |
| 2   | `getGreeting()`       | Calls `getHandledGreeting()` not `getOnboardingGreeting()` | Wrong greeting even if prompt fixed  |
| 3   | `PanelAgentChat.tsx`  | Hardcodes `welcomeMessage` prop                            | Ignores API greeting, masks backend  |

All three must be fixed - fixing only 1-2 leaves the bug partially present.

## Solution

### Fix 1: buildSystemPrompt() - Check Onboarding Mode

```typescript
// server/src/agent/orchestrator/admin-orchestrator.ts

protected async buildSystemPrompt(context: PromptContext): Promise<string> {
  const requestCtx = getRequestContext();

  if (requestCtx?.isOnboardingMode) {
    const tenant = context.tenant;
    const currentPhase = parseOnboardingPhase(tenant?.onboardingPhase);
    const businessName = tenant?.name || 'Your Business';
    const onboardingCtx = await this.advisorMemoryService.getOnboardingContext(context.tenantId);

    return buildOnboardingSystemPrompt({
      businessName,
      currentPhase,
      advisorMemory: onboardingCtx.memory ?? undefined,
      isResume: onboardingCtx.isReturning,
    });
  }

  // Regular admin mode
  const sessionContext = await this.buildCachedContext(context.tenantId, context.sessionId);
  return SYSTEM_PROMPT_TEMPLATE.replace('{BUSINESS_CONTEXT}', sessionContext.contextPrompt);
}
```

### Fix 2: getGreeting() - Check Onboarding Mode

```typescript
async getGreeting(tenantId: string, sessionId: string): Promise<string> {
  const session = await this.getAdminSession(tenantId, sessionId);
  if (!session) {
    return 'What should we knock out today?';
  }

  if (session.isOnboardingMode && session.onboardingPhase) {
    const tenant = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
      select: { name: true },
    });
    const businessName = tenant?.name || 'Your Business';
    const onboardingCtx = await this.advisorMemoryService.getOnboardingContext(tenantId);

    return getOnboardingGreeting({
      businessName,
      currentPhase: session.onboardingPhase,
      advisorMemory: onboardingCtx.memory ?? undefined,
      isResume: onboardingCtx.isReturning,
    });
  }

  return getHandledGreeting(session.context);
}
```

### Fix 3: PanelAgentChat.tsx - Use API Greeting

```typescript
// apps/web/src/components/agent/PanelAgentChat.tsx line 137

content: data.greeting || welcomeMessage,  // Use API greeting, fallback to prop
```

## Prevention Strategies

### 1. DRY Mode Checking Pattern

When an orchestrator has dual modes, extract mode detection to ONE method:

```typescript
// Anti-pattern (what caused #667)
getTools() { if (isOnboardingMode) ... }      // ✓ checks
buildSystemPrompt() { return ADMIN_TEMPLATE } // ✗ doesn't check!

// Correct DRY pattern
protected isOnboardingActive(): boolean {
  const ctx = getRequestContext();
  return ctx?.isOnboardingMode === true;
}

getTools() { if (this.isOnboardingActive()) ... }
buildSystemPrompt() { if (this.isOnboardingActive()) ... }
getGreeting() { if (this.isOnboardingActive()) ... }
```

### 2. Code Review Checklist

When reviewing orchestrator changes:

- [ ] If ANY method checks mode, do ALL related methods check?
- [ ] Are `getTools()`, `buildSystemPrompt()`, `getGreeting()` consistent?
- [ ] Do tests cover both mode branches?

### 3. Required Test

```typescript
describe('AdminOrchestrator dual-mode', () => {
  it('uses onboarding prompt when onboarding active', async () => {
    // Setup: tenant with onboardingPhase = DISCOVERY
    const prompt = await orchestrator.buildSystemPrompt(context);
    expect(prompt).toContain('Getting Started'); // Onboarding content
    expect(prompt).not.toContain('connect Stripe first'); // Not admin
  });

  it('uses admin prompt when onboarding complete', async () => {
    // Setup: tenant with onboardingPhase = COMPLETED
    const prompt = await orchestrator.buildSystemPrompt(context);
    expect(prompt).toContain('business assistant'); // Admin content
  });
});
```

### 4. CLAUDE.md Update

Add to Common Pitfalls:

> **Dual-mode orchestrator methods must be consistent:** If `getTools()` checks `isOnboardingMode`, then `buildSystemPrompt()` and `getGreeting()` MUST also check. Inconsistency causes agent to have wrong tools OR wrong instructions.

## Files Changed

| File                                                            | Change                                                        |
| --------------------------------------------------------------- | ------------------------------------------------------------- |
| `server/src/agent/orchestrator/admin-orchestrator.ts`           | Added mode check to `buildSystemPrompt()` and `getGreeting()` |
| `apps/web/src/components/agent/PanelAgentChat.tsx`              | Use `data.greeting \|\| welcomeMessage`                       |
| `server/test/agent/onboarding/onboarding-system-prompt.test.ts` | Updated expectation from "Marketing" to "Website Setup"       |

## Related Documentation

- [Agent Phase 3 System Prompt Injection](../patterns/agent-phase-3-onboarding-system-prompt-injection-MAIS-20251231.md)
- [Circular Dependency Executor Registry Pattern](../patterns/circular-dependency-executor-registry-MAIS-20251229.md)
- CLAUDE.md: Business Advisor (Onboarding Agent) section

## Verification

Tests run: 2342 passed (1 unrelated failure in tenant-admin-scheduling.test.ts FK constraint)

Onboarding prompt tests: 14/14 passed
