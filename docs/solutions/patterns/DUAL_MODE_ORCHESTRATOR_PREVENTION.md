# Dual-Mode Orchestrator Prevention Strategy

> **⚠️ LEGACY NOTICE (2026-01-26):** This document describes the **AdminOrchestrator** which was **deleted** during the Vertex AI Cloud Run migration. The pattern lessons (mode-checking consistency) remain valuable for any dual-mode component design. Actual implementation is now in Cloud Run agents (`server/src/agent-v2/`).

**Issue ID:** #667
**Category:** Orchestrator pattern, agent architecture (LEGACY)
**Severity:** P1 (affects core onboarding flow)
**Prevention Goal:** Ensure all methods in dual-mode orchestrators check mode consistently

---

## Problem Summary

The `AdminOrchestrator` has a **dual-mode design** where it handles BOTH onboarding mode (when `tenant.onboardingPhase` is active) AND business assistant mode (when onboarding is complete).

**The Bug:** `buildSystemPrompt()` checked getTools() but NOT the system prompt builder, causing:

- Onboarding mode activated in request context ✅
- Tools switched to onboarding tools ✅
- System prompt still used admin template ❌

**Result:** Agent had onboarding tools but admin prompt telling it to "skip discovery and connect Stripe first"

**Root Cause:** Mode check was INCONSISTENT across methods. Some methods checked mode, others didn't.

---

## Code Review Checklist Item

When reviewing changes to dual-mode orchestrators, use this checklist:

### Dual-Mode Orchestrator Review Checklist

**When a method touches request context or phase-aware logic:**

- [ ] **Mode Check Consistency:** If method checks `isOnboardingMode`, verify ALL related methods do too
  - Example: If `getTools()` checks mode, `buildSystemPrompt()` must also check
  - Pattern: Methods should be in pairs (read methods) or triplets (read + write + flow)

- [ ] **Context Dependency:** Identify what context the method needs:
  - Does it need `onboardingPhase`? Must fetch it in each method or store in RequestContext
  - Does it need `advisorMemory`? Must project from events in each method or cache it
  - Don't assume context from one method call carries to another

- [ ] **Prompt Builder Choice:** If building prompts, verify correct builder is called:
  - `buildOnboardingSystemPrompt()` → for active onboarding phases
  - `buildAdminSystemPrompt()` → for completed/skipped phases
  - Check: Is the condition correct? Is phase validation needed?

- [ ] **Tools vs Prompt Alignment:** Verify tools and prompt are from same mode:
  - If returning onboarding tools, prompt must be onboarding prompt
  - If returning admin tools, prompt must be admin prompt
  - Mismatch = agent has tools from one mode but instructions from another

- [ ] **Test Coverage:** Verify tests cover ALL mode transitions:
  - Starting onboarding (NOT_STARTED → DISCOVERY)
  - Mid-onboarding (DISCOVERY → MARKET_RESEARCH)
  - Completing onboarding (MARKETING → COMPLETED)
  - Returning to onboarding (NOT_STARTED session resumption)
  - Skipped onboarding (NOT_STARTED → SKIPPED)

- [ ] **Database Queries:** If fetching phase or memory:
  - Don't assume it's in request context from previous call
  - Fetch fresh or verify it was stored in RequestContext
  - Cache with 5-min TTL to avoid repeated DB hits

---

## Testing Gap: What Should Exist

**Test Name:** `buildSystemPrompt() returns correct prompt based on onboarding phase`

**Test Location:** `server/test/agent/orchestrator/admin-orchestrator.spec.ts`

**What It Should Test:**

```typescript
describe('buildSystemPrompt()', () => {
  describe('when onboarding is active', () => {
    it('returns onboarding prompt for DISCOVERY phase', async () => {
      const tenant = await createTestTenant({
        onboardingPhase: 'DISCOVERY',
      });
      const orchestrator = createOrchestrator(tenant.id);

      // Set up request context as if in onboarding mode
      setRequestContext({
        tenantId: tenant.id,
        isOnboardingMode: true,
      });

      const prompt = await orchestrator.buildSystemPrompt({
        tenantId: tenant.id,
        sessionId: 'test-session',
      });

      // Should contain DISCOVERY phase guidance
      expect(prompt).toContain('Getting Started');
      expect(prompt).toContain('Your Goal: Learn who they are');
      expect(prompt).not.toContain('Connect Stripe');
    });

    it('returns different prompt for SERVICES phase', async () => {
      const tenant = await createTestTenant({
        onboardingPhase: 'SERVICES',
      });
      const orchestrator = createOrchestrator(tenant.id);

      setRequestContext({
        tenantId: tenant.id,
        isOnboardingMode: true,
      });

      const prompt = await orchestrator.buildSystemPrompt({
        tenantId: tenant.id,
        sessionId: 'test-session',
      });

      // Should contain SERVICES phase guidance
      expect(prompt).toContain('Service Design');
      expect(prompt).toContain('Three-Tier Framework');
    });

    it('returns onboarding prompt even for COMPLETED phase if session is resuming', async () => {
      // Edge case: user manually switches back during session
      const tenant = await createTestTenant({
        onboardingPhase: 'COMPLETED',
      });
      const orchestrator = createOrchestrator(tenant.id);

      // But context says we're in onboarding mode (shouldn't happen, but test defensive behavior)
      setRequestContext({
        tenantId: tenant.id,
        isOnboardingMode: true,
      });

      const prompt = await orchestrator.buildSystemPrompt({
        tenantId: tenant.id,
        sessionId: 'test-session',
      });

      // Should still use admin prompt because phase is COMPLETED
      // (isOnboardingMode checks for active phases only)
      expect(prompt).toContain('business assistant');
    });
  });

  describe('when onboarding is not active', () => {
    it('returns admin prompt for COMPLETED phase', async () => {
      const tenant = await createTestTenant({
        onboardingPhase: 'COMPLETED',
      });
      const orchestrator = createOrchestrator(tenant.id);

      setRequestContext({
        tenantId: tenant.id,
        isOnboardingMode: false,
      });

      const prompt = await orchestrator.buildSystemPrompt({
        tenantId: tenant.id,
        sessionId: 'test-session',
      });

      expect(prompt).toContain('business assistant');
      expect(prompt).not.toContain('onboarding');
    });

    it('returns admin prompt for SKIPPED phase', async () => {
      const tenant = await createTestTenant({
        onboardingPhase: 'SKIPPED',
      });
      const orchestrator = createOrchestrator(tenant.id);

      setRequestContext({
        tenantId: tenant.id,
        isOnboardingMode: false,
      });

      const prompt = await orchestrator.buildSystemPrompt({
        tenantId: tenant.id,
        sessionId: 'test-session',
      });

      expect(prompt).toContain('business assistant');
    });

    it('returns admin prompt when onboardingPhase is null', async () => {
      const tenant = await createTestTenant({
        onboardingPhase: null, // Legacy tenant
      });
      const orchestrator = createOrchestrator(tenant.id);

      setRequestContext({
        tenantId: tenant.id,
        isOnboardingMode: false,
      });

      const prompt = await orchestrator.buildSystemPrompt({
        tenantId: tenant.id,
        sessionId: 'test-session',
      });

      expect(prompt).toContain('business assistant');
    });
  });

  describe('consistency between getTools() and buildSystemPrompt()', () => {
    it('returns matching tool set and prompt for DISCOVERY phase', async () => {
      const tenant = await createTestTenant({
        onboardingPhase: 'DISCOVERY',
      });
      const orchestrator = createOrchestrator(tenant.id);

      setRequestContext({
        tenantId: tenant.id,
        isOnboardingMode: true,
      });

      const tools = orchestrator.getTools();
      const prompt = await orchestrator.buildSystemPrompt({
        tenantId: tenant.id,
        sessionId: 'test-session',
      });

      // Both should be in onboarding mode
      expect(tools).toContain(expect.objectContaining({ name: 'update_onboarding_state' }));
      expect(prompt).toContain('Discovery');
    });

    it('returns matching tool set and prompt for admin mode', async () => {
      const tenant = await createTestTenant({
        onboardingPhase: 'COMPLETED',
      });
      const orchestrator = createOrchestrator(tenant.id);

      setRequestContext({
        tenantId: tenant.id,
        isOnboardingMode: false,
      });

      const tools = orchestrator.getTools();
      const prompt = await orchestrator.buildSystemPrompt({
        tenantId: tenant.id,
        sessionId: 'test-session',
      });

      // Both should be in admin mode
      expect(tools).not.toContain(expect.objectContaining({ name: 'update_onboarding_state' }));
      expect(prompt).toContain('business assistant');
    });
  });
});
```

**Why This Test Matters:**

- Catches prompt/tool mismatches immediately
- Documents expected behavior for each phase
- Prevents silent regressions when phase logic changes

---

## Architectural Pattern: DRY Mode Checking

**The Anti-Pattern (what #667 had):**

```typescript
class AdminOrchestrator {
  protected getTools(): AgentTool[] {
    const ctx = getRequestContext();
    return ctx?.isOnboardingMode ? onboardingTools : adminTools;
  }

  protected async buildSystemPrompt(context): Promise<string> {
    // NO mode check - always builds admin prompt!
    return this.buildCachedContext(...).then(buildAdminSystemPrompt);
  }

  protected async getGreeting(context): Promise<string> {
    // Different greeting function - also doesn't check mode
    return getAdminGreeting();
  }
}
```

**The Pattern (what it should be):**

```typescript
class AdminOrchestrator {
  /**
   * Detect if orchestrator is in active onboarding mode
   */
  protected async isOnboardingActive(): Promise<boolean> {
    const ctx = getRequestContext();
    if (!ctx?.isOnboardingMode) return false;

    // Double-check: phase is valid onboarding phase
    const tenant = await this.getTenant(ctx.tenantId);
    return ACTIVE_ONBOARDING_PHASES.includes(tenant.onboardingPhase);
  }

  /**
   * Get active onboarding phase (only valid if isOnboardingActive() = true)
   */
  protected async getActiveOnboardingPhase(): Promise<OnboardingPhase> {
    const tenant = await this.getTenant(
      getRequestContext()!.tenantId
    );
    return tenant.onboardingPhase as OnboardingPhase;
  }

  /**
   * Get advisor memory for session context (only valid if isOnboardingActive() = true)
   */
  protected async getAdvisorMemory(tenantId: string): Promise<AdvisorMemory> {
    return this.advisorMemoryRepo.projectFromEvents(tenantId);
  }

  // NOW all methods check mode consistently
  protected getTools(): AgentTool[] {
    const ctx = getRequestContext();
    return ctx?.isOnboardingMode ? onboardingTools : adminTools;
  }

  protected async buildSystemPrompt(context): Promise<string> {
    if (await this.isOnboardingActive()) {
      const phase = await this.getActiveOnboardingPhase();
      const memory = await this.getAdvisorMemory(context.tenantId);
      return buildOnboardingSystemPrompt({ currentPhase: phase, advisorMemory: memory });
    }

    return this.buildCachedContext(...).then(buildAdminSystemPrompt);
  }

  protected async getGreeting(context): Promise<string> {
    if (await this.isOnboardingActive()) {
      const phase = await this.getActiveOnboardingPhase();
      const memory = await this.getAdvisorMemory(context.tenantId);
      return getOnboardingGreeting({ currentPhase: phase, advisorMemory: memory });
    }

    return getAdminGreeting();
  }
}
```

**Key Principles:**

1. **Extract mode check to named method** (`isOnboardingActive()`) — reusable, testable, self-documenting
2. **Extract data access to named methods** (`getActiveOnboardingPhase()`, `getAdvisorMemory()`) — consistent data loading pattern
3. **Every method using those calls must use the same check first** — prevents drift
4. **Document dependencies in docstrings** — "only valid if isOnboardingActive() = true"

**Why This Works:**

- Mode check happens in ONE place (`isOnboardingActive()`)
- Methods that depend on onboarding state all call it before accessing data
- Reviewers can see the pattern and catch deviations
- Tests can mock the mode check method to force both paths

---

## Quick Reference for CLAUDE.md

Add to the **Dual-Mode Orchestrator** section:

````markdown
### Dual-Mode Orchestrator Consistency

**CRITICAL:** In `AdminOrchestrator`, ALL methods that vary by onboarding phase must check phase CONSISTENTLY.

**Pattern:**

```typescript
// Extract mode check to reusable method
protected async isOnboardingActive(): Promise<boolean> {
  const ctx = getRequestContext();
  return ctx?.isOnboardingMode && ACTIVE_ONBOARDING_PHASES.includes(tenant.onboardingPhase);
}

// Every method checks FIRST
protected async buildSystemPrompt(context): Promise<string> {
  if (await this.isOnboardingActive()) {
    return buildOnboardingSystemPrompt(...);
  }
  return buildAdminSystemPrompt(...);
}
```
````

**Common Drift Points:** getTools(), buildSystemPrompt(), getGreeting(), buildContext()

**Prevention:** Code review checklist (see docs/solutions/patterns/DUAL_MODE_ORCHESTRATOR_PREVENTION.md)

**Test:** buildSystemPrompt() must return different content for each onboarding phase AND for admin mode

```

---

## Implementation Checklist

When applying this prevention strategy to existing code:

- [ ] **Extract mode check:** Create `isOnboardingActive()` method if not exists
- [ ] **Audit all mode-aware methods:** List all methods that should vary by mode
  - [ ] getTools()
  - [ ] buildSystemPrompt()
  - [ ] getGreeting()
  - [ ] buildContext()
  - [ ] Any other method that mentions onboarding/phase?
- [ ] **Add consistency check:** Each method must call `isOnboardingActive()` OR be explicitly documented as mode-agnostic
- [ ] **Add tests:** For each mode-aware method, test both branches
- [ ] **Update code review checklist:** Document in pull request template or shared checklist
- [ ] **Document in CLAUDE.md:** Add to Dual-Mode Orchestrator section

---

## Related Issues

- **#668:** getGreeting() also needs mode check
- **#670:** RequestContext should include onboardingPhase to avoid repeated DB fetches

---

## References

- **Bug Report:** `/Users/mikeyoung/CODING/MAIS/todos/667-done-p1-admin-orchestrator-uses-wrong-system-prompt.md`
- **Onboarding Architecture:** `CLAUDE.md` → "Business Advisor (Onboarding Agent)"
- **State Machine:** `server/src/agent/onboarding/state-machine.ts`
- **Prompt Builders:** `server/src/agent/prompts/onboarding-system-prompt.ts`
```
