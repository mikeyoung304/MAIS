# Dual-Mode Orchestrator: Code Review Checklist

**Use This Checklist For:** Pull requests modifying `AdminOrchestrator` or any dual-mode orchestrator

**Related Bug:** Issue #667 (orchestrator always using admin prompt even in onboarding mode)

---

## Reviewer Checklist

### Phase 1: Identify Scope

- [ ] **Does this PR touch mode-aware methods?**
  - [ ] `getTools()`
  - [ ] `buildSystemPrompt()`
  - [ ] `getGreeting()`
  - [ ] `buildContext()`
  - [ ] Any method checking `isOnboardingMode` or `onboardingPhase`?

- [ ] **If YES, proceed with full checklist. If NO, skip to "Edge Cases" section.**

---

### Phase 2: Mode Check Consistency

- [ ] **For EACH modified method, verify it checks mode correctly:**

  ```typescript
  // If method touches mode-aware logic, it MUST check:
  const isOnboarding = await this.isOnboardingActive();

  // OR
  const ctx = getRequestContext();
  if (ctx?.isOnboardingMode) {
    /* onboarding branch */
  }
  ```

- [ ] **If method checks mode, verify ALL related methods do too:**
  - [ ] Modified `getTools()` → Must also check `buildSystemPrompt()`, `getGreeting()`
  - [ ] Modified `buildSystemPrompt()` → Must also check `getTools()`, `getGreeting()`
  - [ ] Modified `getGreeting()` → Must also check `getTools()`, `buildSystemPrompt()`

- [ ] **For each data access, verify it's fetched fresh:**
  - [ ] Does it fetch `tenant.onboardingPhase` directly, or assume it from context?
  - [ ] If fetching from DB, check it's not stale (multiple calls in same flow)
  - [ ] If getting from context, verify context was populated in `chat()` route

---

### Phase 3: Prompt/Tool Alignment

- [ ] **When mode is onboarding:**
  - [ ] `getTools()` returns onboarding tools ✅
  - [ ] `buildSystemPrompt()` calls `buildOnboardingSystemPrompt()` ✅
  - [ ] Both use same phase from `tenant.onboardingPhase` ✅

- [ ] **When mode is admin:**
  - [ ] `getTools()` returns admin tools ✅
  - [ ] `buildSystemPrompt()` calls `buildAdminSystemPrompt()` ✅
  - [ ] Both omit onboarding-specific guidance ✅

- [ ] **Common Alignment Errors to Catch:**
  - [ ] ❌ Returns onboarding tools but admin prompt
  - [ ] ❌ Returns admin tools but onboarding prompt
  - [ ] ❌ Uses wrong prompt builder: `buildAdminSystemPrompt()` during DISCOVERY phase
  - [ ] ❌ Hardcodes phase instead of fetching from `tenant.onboardingPhase`

---

### Phase 4: Phase Validation

- [ ] **Check phase values are validated:**

  ```typescript
  // GOOD: Phase comes from Prisma or contract schema (pre-validated)
  const phase = tenant.onboardingPhase as OnboardingPhase;

  // GOOD: Explicit validation
  if (!ACTIVE_ONBOARDING_PHASES.includes(phase)) return false;

  // BAD: Unvalidated string used
  const phase = req.body.phase; // ❌ Could be 'INVALID_PHASE'
  ```

- [ ] **Active vs Inactive phases are distinguished:**

  ```typescript
  const ACTIVE_ONBOARDING_PHASES = [
    'NOT_STARTED',
    'DISCOVERY',
    'MARKET_RESEARCH',
    'SERVICES',
    'MARKETING',
  ] as const;

  // NOT in active list:
  // 'COMPLETED', 'SKIPPED', null
  ```

---

### Phase 5: Test Coverage

- [ ] **Tests exist for BOTH branches:**
  - [ ] One test with `isOnboardingMode: true` and phase = 'DISCOVERY'
  - [ ] One test with `isOnboardingMode: false` and phase = 'COMPLETED'
  - [ ] Test verifies prompt content differs between branches
  - [ ] Test verifies tools differ between branches

- [ ] **Consistency test exists:**

  ```typescript
  // This test catches tool/prompt mismatches immediately
  it('getTools and buildSystemPrompt align for onboarding mode', async () => {
    setRequestContext({ isOnboardingMode: true });

    const tools = orchestrator.getTools();
    const prompt = await orchestrator.buildSystemPrompt({...});

    // Both must be in onboarding mode
    expect(tools).toContain(expect.objectContaining({ name: 'update_onboarding_state' }));
    expect(prompt).toContain('Discovery'); // Or relevant phase
  });
  ```

- [ ] **Edge cases tested:**
  - [ ] Phase = 'NOT_STARTED' (first time)
  - [ ] Phase = 'DISCOVERY' (mid-onboarding)
  - [ ] Phase = 'COMPLETED' (done)
  - [ ] Phase = 'SKIPPED' (opted out)
  - [ ] Phase = null (legacy tenant)
  - [ ] `isOnboardingMode: false` (should always use admin)

---

### Phase 6: Data Fetching

- [ ] **Avoid repeated DB fetches for same data:**

  ```typescript
  // AVOID: Fetching phase twice
  const phase1 = await db.tenant.findUnique(...).then(t => t.onboardingPhase);
  const phase2 = await db.tenant.findUnique(...).then(t => t.onboardingPhase);

  // PREFER: Cache in RequestContext
  const phase = getRequestContext()?.onboardingPhase;

  // FALLBACK: Fetch once, reuse
  const tenant = await this.getTenant(tenantId);
  const phase = tenant.onboardingPhase;
  return { phase, isActive: ACTIVE_PHASES.includes(phase) };
  ```

- [ ] **RequestContext populated correctly:**
  - [ ] In `chat()` route, does `setRequestContext()` populate `isOnboardingMode`?
  - [ ] Does `isOnboardingMode` value match actual phase?
  - [ ] Is context cleared properly between requests?

---

### Phase 7: Code Review Comments

- [ ] **Ask clarifying questions if:**
  - "Why does this method check mode but that one doesn't?"
  - "Is phase validation happening here?" (If you're unsure)
  - "Could this data be stale?" (If fetching in different methods)
  - "What's the expected prompt for SERVICES phase?" (Verify understanding)

- [ ] **Approve only if:**
  - All related methods check mode consistently
  - Prompt/tool pairs align for both branches
  - Tests cover both branches + alignment
  - No stale data issues
  - Phase validation is present

---

### Phase 8: Edge Cases

**Even if NOT modifying mode-aware methods, check:**

- [ ] **Session resumption:** When user returns to incomplete onboarding, does mode detection work?
- [ ] **Manual phase changes:** If tenant.onboardingPhase changes mid-request, does orchestrator update?
- [ ] **Concurrent requests:** If user opens two chat windows, can mode mismatch happen?
- [ ] **Error handling:** If phase fetch fails, does orchestrator gracefully fall back to admin?

---

## Red Flags (Immediate Feedback)

| Flag                                                     | Action                                                                     |
| -------------------------------------------------------- | -------------------------------------------------------------------------- |
| One method checks `isOnboardingMode`, another doesn't    | Ask: "Why does X check mode but Y doesn't?"                                |
| Prompt builder hardcoded instead of chosen based on mode | Needs to be: `if (isOnboarding) buildOnboarding(...) else buildAdmin(...)` |
| Tests only cover one branch                              | Needs tests for BOTH onboarding AND admin modes                            |
| Phase fetched twice in same flow                         | Should be cached in method or RequestContext                               |
| No validation on phase value before use                  | Add `if (!ACTIVE_PHASES.includes(phase))` or similar                       |
| Onboarding tools with admin prompt (or vice versa)       | Tool/prompt mismatch - this is the original bug!                           |

---

## Approval Template

**For Reviewers:** Use this template in PR comment:

```markdown
## Dual-Mode Orchestrator Review

- [x] Mode check consistency verified (_list methods checked_)
- [x] Prompt/tool alignment verified (both branches tested)
- [x] Phase validation present
- [x] Tests cover both branches + alignment
- [x] No data freshness issues

✅ Approved - Dual-mode orchestrator pattern correct
```

**For Authors:** Include this checklist in PR description:

```markdown
## Dual-Mode Orchestrator Checklist

- [ ] All modified methods check `isOnboardingMode` or `onboardingPhase`
- [ ] If one method checks mode, verified all related methods do too
- [ ] Prompt and tools align for both onboarding and admin branches
- [ ] Tests cover BOTH branches (DISCOVERY phase AND COMPLETED phase)
- [ ] Phase validation present before use
- [ ] No repeated DB fetches for same phase data
```

---

## References

- **Full Prevention Strategy:** `docs/solutions/patterns/DUAL_MODE_ORCHESTRATOR_PREVENTION.md`
- **Quick Reference:** `docs/solutions/patterns/DUAL_MODE_ORCHESTRATOR_QUICK_REFERENCE.md`
- **Original Bug:** `todos/667-done-p1-admin-orchestrator-uses-wrong-system-prompt.md`
- **Related Bug:** `todos/668-p1-getonboarding-greeting-uses-wrong-function.md`
