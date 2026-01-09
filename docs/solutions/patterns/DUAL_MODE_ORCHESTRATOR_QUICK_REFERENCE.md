# Dual-Mode Orchestrator: Quick Reference

**Print & Pin This** — 2 min read

---

## The Bug

Orchestrator had `getTools()` checking `isOnboardingMode` but `buildSystemPrompt()` didn't:

```typescript
// ✅ getTools() checks mode
if (ctx?.isOnboardingMode) return onboardingTools;

// ❌ buildSystemPrompt() ignored mode
return ADMIN_PROMPT; // Always! Even during onboarding!
```

**Result:** Agent had onboarding tools but admin prompt. Chaos.

---

## Prevention Checklist (5 items)

When reviewing orchestrator changes:

| Check                   | What                                                                                       | Why                               |
| ----------------------- | ------------------------------------------------------------------------------------------ | --------------------------------- |
| **1. Consistency**      | If one method checks `isOnboardingMode`, ALL related methods must                          | Prevent drift                     |
| **2. Prompt Picker**    | `isOnboardingMode` → `buildOnboardingSystemPrompt()` \| admin → `buildAdminSystemPrompt()` | Wrong prompt = wrong instructions |
| **3. Tool-Prompt Pair** | If tools are onboarding tools, prompt must be onboarding prompt                            | Mismatch breaks agent             |
| **4. Phase Access**     | Fetch `tenant.onboardingPhase` fresh in each method (don't assume context)                 | Context stale across calls        |
| **5. Test Both Paths**  | Test DISCOVERY phase AND COMPLETED phase AND tool/prompt consistency                       | Catch all regressions             |

---

## The Pattern

```typescript
// EXTRACT: One place to check mode
protected async isOnboardingActive(): Promise<boolean> {
  const ctx = getRequestContext();
  return ctx?.isOnboardingMode && ACTIVE_PHASES.includes(tenant.phase);
}

// APPLY: Every method checks FIRST
protected async buildSystemPrompt(): Promise<string> {
  if (await this.isOnboardingActive()) {
    return buildOnboardingSystemPrompt(...); // Onboarding variant
  }
  return buildAdminSystemPrompt(...); // Admin variant
}
```

**Why:** One source of truth prevents drift.

---

## Mode-Aware Methods to Watch

These are THE methods that should vary by phase:

- `getTools()` — Must return onboarding tools when phase is active
- `buildSystemPrompt()` — Must return onboarding prompt when phase is active
- `getGreeting()` — Must return onboarding greeting when phase is active
- `buildContext()` — May need different context for onboarding

**Rule:** If you modify one, check all four.

---

## Test Template

```typescript
it('buildSystemPrompt returns onboarding prompt for DISCOVERY phase', async () => {
  const tenant = { onboardingPhase: 'DISCOVERY' };
  setRequestContext({ isOnboardingMode: true });

  const prompt = await orchestrator.buildSystemPrompt({...});

  expect(prompt).toContain('Discovery'); // Onboarding guidance
  expect(prompt).not.toContain('Stripe'); // NOT admin guidance
});

it('buildSystemPrompt returns admin prompt when onboarding complete', async () => {
  const tenant = { onboardingPhase: 'COMPLETED' };
  setRequestContext({ isOnboardingMode: false });

  const prompt = await orchestrator.buildSystemPrompt({...});

  expect(prompt).toContain('business assistant');
});
```

---

## Common Mistakes

| Mistake                                                   | Fix                                                                                    |
| --------------------------------------------------------- | -------------------------------------------------------------------------------------- |
| Checking `isOnboardingMode` in one method but not another | Extract check to `isOnboardingActive()`, call it consistently                          |
| Assuming `tenant.onboardingPhase` is in context           | Fetch fresh from DB in each method                                                     |
| Forgetting to test BOTH branches                          | Test DISCOVERY + COMPLETED + tool/prompt alignment                                     |
| Returning tools from one mode but prompt from another     | Always pair them: `if (isOnboarding) { tools + prompt both onboarding }`               |
| Using wrong builder function                              | `isOnboarding` → `buildOnboardingSystemPrompt()` \| admin → `buildAdminSystemPrompt()` |

---

## Impact

**Without This:** Silent mode mismatches. Tools say "do X" but prompt says "do Y".

**With This:** Consistent behavior across all orchestrator methods.

---

## Related Files

- **Full Strategy:** `docs/solutions/patterns/DUAL_MODE_ORCHESTRATOR_PREVENTION.md`
- **Bug Report:** `todos/667-done-p1-admin-orchestrator-uses-wrong-system-prompt.md`
- **Code:** `server/src/agent/orchestrator/admin-orchestrator.ts`
