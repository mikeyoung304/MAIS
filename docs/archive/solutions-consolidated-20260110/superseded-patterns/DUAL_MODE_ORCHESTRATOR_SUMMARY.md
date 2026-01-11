# Dual-Mode Orchestrator Prevention: Complete Summary

**Developed by:** Prevention Strategist
**Based on:** Bug #667 (admin orchestrator uses wrong system prompt)
**Created:** 2026-01-08

---

## What Happened

The `AdminOrchestrator` is designed to run in TWO modes:

1. **Onboarding Mode** — When tenant.onboardingPhase is active (NOT_STARTED through MARKETING)
2. **Admin/Business Assistant Mode** — When onboarding is complete or skipped

The bug: `getTools()` correctly checked mode and returned different tools, but `buildSystemPrompt()` ignored the mode and ALWAYS returned the admin prompt.

**Result:** Agent had onboarding tools but admin instructions. User saw "connect Stripe first" when they should see "let me learn about your business."

---

## Prevention Documents Created

### 1. Full Prevention Strategy

**File:** `docs/solutions/patterns/DUAL_MODE_ORCHESTRATOR_PREVENTION.md`

**Contains:**

- Problem summary with code examples
- Code review checklist item (8-point review process)
- Complete test suite template (covers all phases)
- Architectural pattern: How to structure dual-mode orchestrators
- Implementation checklist

**Use When:** Deep dive on prevention or writing comprehensive code review feedback

---

### 2. Quick Reference (2-minute read)

**File:** `docs/solutions/patterns/DUAL_MODE_ORCHESTRATOR_QUICK_REFERENCE.md`

**Contains:**

- 1-page summary of the bug
- 5-point prevention checklist
- The DRY pattern
- Test template
- Common mistakes table

**Use When:** Quick reminder during code review, or pinning on wall

---

### 3. Code Review Checklist

**File:** `docs/solutions/patterns/DUAL_MODE_ORCHESTRATOR_CODE_REVIEW_CHECKLIST.md`

**Contains:**

- 8-phase review workflow
- Specific questions to ask
- Red flags table
- Approval template
- Edge cases to check

**Use When:** Reviewing a PR that touches orchestrator methods

---

### 4. CLAUDE.md Addition

**Location:** `CLAUDE.md` → "Business Advisor (Onboarding Agent)" section

**Added:**

- 2-3 line code pattern example
- List of methods to watch
- Links to full strategy documents

**Use When:** Working on any onboarding-related code (instant context)

---

## The 3-Point Prevention Strategy

### 1. Code Review Checklist Item

**What reviewers check when modifying orchestrators:**

```
□ Mode Check Consistency: If one method checks isOnboardingMode, ALL related methods must
□ Prompt Builder Choice: Verify correct builder called for each mode
□ Tools vs Prompt Alignment: Both from same mode for same request
□ Phase Validation: Phase value validated before use
□ Test Coverage: Tests cover BOTH branches (onboarding AND admin) + alignment
```

### 2. Testing Gap: What Should Exist

**Test:** `buildSystemPrompt() returns correct prompt based on onboarding phase`

**Covers:**

- DISCOVERY phase → onboarding prompt with "Getting Started"
- SERVICES phase → onboarding prompt with "Three-Tier Framework"
- COMPLETED phase → admin prompt with "business assistant"
- Tool/prompt alignment: Same mode for both

**Why:** Catches silent regressions when phase logic changes

### 3. Architectural Pattern: DRY Mode Checking

**The Pattern:**

```typescript
// Extract mode check to ONE reusable method
protected async isOnboardingActive(): Promise<boolean> {
  const ctx = getRequestContext();
  return ctx?.isOnboardingMode && ACTIVE_PHASES.includes(tenant.phase);
}

// Every method checks mode FIRST
protected async buildSystemPrompt(): Promise<string> {
  if (await this.isOnboardingActive()) {
    return buildOnboardingSystemPrompt(...); // Onboarding branch
  }
  return buildAdminSystemPrompt(...); // Admin branch
}

protected getTools(): AgentTool[] {
  const ctx = getRequestContext();
  return ctx?.isOnboardingMode ? onboardingTools : adminTools;
}

protected async getGreeting(): Promise<string> {
  if (await this.isOnboardingActive()) {
    return getOnboardingGreeting(...);
  }
  return getAdminGreeting(...);
}
```

**Why This Works:**

- One source of truth for mode detection
- All methods use same check
- Pattern is obvious to reviewers
- Easy to test both branches

---

## Quick Reference for CLAUDE.md

Added to **Business Advisor (Onboarding Agent)** section:

````markdown
**Dual-Mode Consistency (P1 Prevention Strategy):**

When ALL methods that vary by onboarding phase must check mode consistently:

```typescript
// Extract mode check to one reusable method
protected async isOnboardingActive(): Promise<boolean> {
  const ctx = getRequestContext();
  return ctx?.isOnboardingMode && ACTIVE_ONBOARDING_PHASES.includes(tenant.onboardingPhase);
}

// Every mode-aware method calls it FIRST
protected async buildSystemPrompt(): Promise<string> {
  if (await this.isOnboardingActive()) {
    return buildOnboardingSystemPrompt(...);
  }
  return buildAdminSystemPrompt(...);
}
```
````

**Watch These Methods:** `getTools()`, `buildSystemPrompt()`, `getGreeting()`, `buildContext()`
— if one checks mode, ALL must.

**Test:** buildSystemPrompt() must return different content for DISCOVERY phase vs COMPLETED phase,
and tools/prompt must align.

**Reference:** `docs/solutions/patterns/DUAL_MODE_ORCHESTRATOR_PREVENTION.md` (full strategy),
`docs/solutions/patterns/DUAL_MODE_ORCHESTRATOR_QUICK_REFERENCE.md` (2 min cheat sheet)

```

---

## How to Use These Documents

| Situation | Use This |
|-----------|----------|
| "Quick, what's the pattern?" | Quick Reference (2 min) |
| "Reviewing a PR on orchestrators" | Code Review Checklist |
| "Need to understand why this matters" | Prevention Strategy (full) |
| "Adding onboarding to a new method" | CLAUDE.md section + Quick Reference |
| "Writing tests for orchestrator" | Prevention Strategy → Testing Gap section |
| "Teaching someone about dual-mode" | All three (start with Quick Ref) |

---

## Implementation Checklist

When applying this to existing code:

- [ ] **Extract mode check:** Create `isOnboardingActive()` method
- [ ] **Audit methods:** List all methods that should vary by mode
  - [ ] getTools()
  - [ ] buildSystemPrompt()
  - [ ] getGreeting()
  - [ ] buildContext()
  - [ ] Any other?
- [ ] **Add consistency check:** Each method calls `isOnboardingActive()`
- [ ] **Add tests:** For each method, test both branches
- [ ] **Update code review process:** Add checklist item
- [ ] **Document:** Add to CLAUDE.md and relevant PRs

---

## Key Insights

### Why The Bug Happened

1. **Mode detection was successful** — `getTools()` correctly checked and switched tools
2. **But not everywhere** — `buildSystemPrompt()` didn't check mode
3. **Different functions, different logic** — Each method had its own implementation
4. **No single source of truth** — No shared pattern to follow

### Why The Prevention Works

1. **One method to check mode** — `isOnboardingActive()` is the single source of truth
2. **All methods use it** — Consistent pattern, easy to spot violations
3. **Tests verify both branches** — Can't accidentally skip a mode
4. **Self-documenting** — Pattern is obvious in code review

---

## Related Issues

- **#667:** AdminOrchestrator uses wrong system prompt (ROOT CAUSE)
- **#668:** getGreeting() also uses wrong function (SAME PATTERN)
- **#670:** RequestContext should cache onboardingPhase (OPTIMIZATION)

---

## Questions This Prevention Answers

**Q: When should I use `buildOnboardingSystemPrompt()` vs `buildAdminSystemPrompt()`?**
A: Check `isOnboardingActive()` first. If true, use onboarding. If false, use admin. Never assume.

**Q: What if `getTools()` and `buildSystemPrompt()` return different modes?**
A: That's the original bug. Test should catch it immediately (consistency test).

**Q: What if I need different behavior for each phase (DISCOVERY vs SERVICES)?**
A: That's handled inside `buildOnboardingSystemPrompt()` via `PHASE_GUIDANCE` map. Don't duplicate it.

**Q: Should I store phase in RequestContext to avoid repeated DB fetches?**
A: Yes, if fetching it multiple times. See #670 optimization.

---

## Related Architecture

- **State Machine:** `server/src/agent/onboarding/state-machine.ts` — Phase transitions
- **Prompt Builders:** `server/src/agent/prompts/onboarding-system-prompt.ts` — Phase-specific guidance
- **Memory Projection:** `server/src/agent/onboarding/advisor-memory.service.ts` — Session context
- **Request Context:** Wherever `getRequestContext()` is used — Stores `isOnboardingMode`

---

## For Future Prevention Strategies

This pattern (dual-mode with inconsistent checks) could happen in:

- Customer chat orchestrator (if it ever gets onboarding + assistant modes)
- Admin panel orchestrator (if adding phase-based features)
- Any agent with context-dependent behavior

**Application:** Use same pattern — extract mode check to one method, call consistently.

---

## Success Criteria

✅ This prevention strategy succeeds when:

1. All dual-mode orchestrators use `isOnboardingActive()` pattern
2. Code reviews catch mode mismatches immediately (via checklist)
3. Tests exist for both branches of every mode-aware method
4. No silent regressions where tools/prompt go out of sync
5. New developers can understand pattern from CLAUDE.md + Quick Reference
```
