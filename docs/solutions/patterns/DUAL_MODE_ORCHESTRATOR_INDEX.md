# Dual-Mode Orchestrator Prevention Strategy: Complete Index

**Issue:** #667 - AdminOrchestrator uses wrong system prompt for onboarding
**Status:** Completed prevention strategy (4 documents + CLAUDE.md update)
**Last Updated:** 2026-01-08

---

## Document Map

### 1. DUAL_MODE_ORCHESTRATOR_SUMMARY.md (Best Starting Point)

**Purpose:** Overview of everything, high-level strategy, how documents fit together
**Read Time:** 5 minutes
**Audience:** Anyone needing overview or teaching others

**Covers:**

- What happened (the bug, in plain English)
- 3-point prevention strategy (code review, testing, architecture)
- How to use all documents
- Implementation checklist
- FAQ section

**Start Here If:** You're new to this pattern or need to explain it to someone

---

### 2. DUAL_MODE_ORCHESTRATOR_QUICK_REFERENCE.md (Daily Reference)

**Purpose:** 2-minute checklist to pin on wall or bookmark
**Read Time:** 2 minutes
**Audience:** Code reviewers, developers writing orchestrators

**Covers:**

- The bug (tl;dr)
- 5-point prevention checklist
- The DRY pattern (short version)
- Test template
- Common mistakes table

**Start Here If:** You're about to review a PR or modify orchestrator code

---

### 3. DUAL_MODE_ORCHESTRATOR_PREVENTION.md (Deep Dive)

**Purpose:** Comprehensive strategy with examples and decision trees
**Read Time:** 15 minutes
**Audience:** Architects, experienced reviewers, people implementing the pattern

**Covers:**

- Problem summary (detailed)
- Code review checklist item (8 points)
- Complete test suite template (copy-paste ready)
- Architectural pattern (anti-pattern vs pattern)
- Implementation checklist
- Related issues

**Start Here If:** You're implementing this pattern in a new orchestrator or want full context

---

### 4. DUAL_MODE_ORCHESTRATOR_CODE_REVIEW_CHECKLIST.md (Review Tool)

**Purpose:** Step-by-step checklist for PR reviewers
**Read Time:** 10 minutes for full checklist, 1 minute per review
**Audience:** Pull request reviewers

**Covers:**

- 8-phase review workflow
- Specific questions to ask for each phase
- Red flags table
- Approval templates
- Edge cases

**Start Here If:** You're actively reviewing a PR that touches orchestrator code

---

### 5. CLAUDE.md Addition

**Location:** `/Users/mikeyoung/CODING/MAIS/CLAUDE.md` (Business Advisor section)
**Read Time:** 1 minute
**Audience:** All developers (always available)

**Covers:**

- Code pattern for dual-mode consistency
- List of methods to watch
- Links to full strategy

**Start Here If:** You're working on onboarding and need instant context

---

## Quick Navigation by Role

### Code Reviewer (Reviewing PR)

1. Read: Quick Reference (2 min)
2. Use: Code Review Checklist (during review)
3. Reference: Prevention Strategy (if questions arise)

### Developer (Implementing Feature)

1. Read: CLAUDE.md section (1 min)
2. Read: Quick Reference (2 min)
3. Reference: Prevention Strategy (for test template)
4. Code: Follow pattern from Prevention Strategy

### Architect (Designing New Orchestrator)

1. Read: Summary (5 min)
2. Read: Prevention Strategy (15 min)
3. Reference: Code Review Checklist (for review process)

### New Team Member (Learning Pattern)

1. Read: Summary (5 min)
2. Read: Quick Reference (2 min)
3. Skim: Prevention Strategy (get familiar)
4. Watch: A code review using the checklist

### Future Prevention Agent (Applying to New System)

1. Read: Summary (understand why this matters)
2. Read: Prevention Strategy (understand the pattern)
3. Copy: Code Review Checklist
4. Adapt: To your new system (same principles, different methods)

---

## The Pattern in 30 Seconds

```typescript
// 1. Extract mode check to ONE method
protected async isOnboardingActive(): Promise<boolean> {
  return ctx?.isOnboardingMode && ACTIVE_PHASES.includes(tenant.phase);
}

// 2. Every mode-aware method uses it
protected async buildSystemPrompt(): Promise<string> {
  if (await this.isOnboardingActive()) {
    return buildOnboardingSystemPrompt(...);
  }
  return buildAdminSystemPrompt(...);
}

// 3. Test both branches
it('returns onboarding prompt for DISCOVERY phase', async () => {
  expect(prompt).toContain('Discovery');
  expect(tools).toContain(expect.objectContaining({ name: 'update_onboarding_state' }));
});
```

---

## The 5-Point Prevention Checklist

When reviewing code that touches mode-aware methods:

1. ✓ **Consistency:** If one method checks mode, all related methods do too
2. ✓ **Prompt Builder:** Correct builder called for each mode (onboarding vs admin)
3. ✓ **Tool-Prompt Pair:** Both from same mode for same request
4. ✓ **Phase Validation:** Phase value validated before use
5. ✓ **Test Coverage:** Tests cover BOTH branches + alignment

---

## Common Questions

**Q: Which document should I read first?**
A: DUAL_MODE_ORCHESTRATOR_SUMMARY.md (5 min overview)

**Q: I'm reviewing a PR, what do I do?**
A: Read Quick Reference (2 min), then use Code Review Checklist

**Q: Where's the code pattern I should follow?**
A: CLAUDE.md (Business Advisor section), or Prevention Strategy (full example)

**Q: What test should exist?**
A: See Prevention Strategy → Testing Gap section (copy-paste ready)

**Q: Can I apply this to other orchestrators?**
A: Yes! Same pattern works for any dual-mode system (customer chat, etc.)

---

## Related Issues

| Issue | Type        | Cause                                 | Prevention                            |
| ----- | ----------- | ------------------------------------- | ------------------------------------- |
| #667  | Bug         | buildSystemPrompt() didn't check mode | Extract check to isOnboardingActive() |
| #668  | Bug         | getGreeting() didn't check mode       | Same pattern as #667 fix              |
| #670  | Enhancement | Repeated DB fetches for phase         | Cache in RequestContext               |

---

## File Locations

```
/Users/mikeyoung/CODING/MAIS/docs/solutions/patterns/
├── DUAL_MODE_ORCHESTRATOR_INDEX.md              ← You are here
├── DUAL_MODE_ORCHESTRATOR_SUMMARY.md            ← Start here (overview)
├── DUAL_MODE_ORCHESTRATOR_QUICK_REFERENCE.md    ← Review checklist (2 min)
├── DUAL_MODE_ORCHESTRATOR_PREVENTION.md         ← Deep dive (15 min)
└── DUAL_MODE_ORCHESTRATOR_CODE_REVIEW_CHECKLIST.md ← During review (use as tool)

/Users/mikeyoung/CODING/MAIS/
└── CLAUDE.md                                    ← Quick ref always available
    (Business Advisor section, ~10 lines)

/Users/mikeyoung/CODING/MAIS/todos/
└── 667-done-p1-admin-orchestrator-uses-wrong-system-prompt.md ← Original bug
```

---

## Implementation Timeline

**Phase 1:** Fix existing orchestrators (in-flight)

- Apply pattern to `AdminOrchestrator`
- Apply pattern to `CustomerOrchestrator` (if dual-mode)
- Add tests for both branches

**Phase 2:** Code review process (next reviews)

- Use Code Review Checklist in PR reviews
- Add checklist item to PR template
- Train reviewers on pattern

**Phase 3:** Documentation (ongoing)

- Keep CLAUDE.md up to date
- Link to quick reference in relevant areas
- Archive old documents when superseded

---

## Success Indicators

✅ Prevention strategy is working when:

- [ ] No PRs merge with tools/prompt mismatches
- [ ] Code reviewers use checklist consistently
- [ ] New methods follow the pattern automatically
- [ ] Tests catch both branches of mode-aware methods
- [ ] Developers reference CLAUDE.md when modifying orchestrators
- [ ] No regression of issue #667 or #668

---

## Document Statistics

| Document     | Size      | Read Time  | Purpose               |
| ------------ | --------- | ---------- | --------------------- |
| Summary      | 9.0 KB    | 5 min      | Overview + how to use |
| Prevention   | 14 KB     | 15 min     | Deep dive + templates |
| Quick Ref    | 3.9 KB    | 2 min      | Daily checklist       |
| Checklist    | 7.9 KB    | 10 min     | PR review tool        |
| Index (this) | 5.0 KB    | 3 min      | Navigation            |
| **Total**    | **40 KB** | **35 min** | **All strategy**      |

---

## How to Reference These Documents

**In PRs:**

```markdown
Per [Dual-Mode Orchestrator Prevention](docs/solutions/patterns/DUAL_MODE_ORCHESTRATOR_PREVENTION.md),
need to verify tools/prompt alignment...
```

**In Code Comments:**

```typescript
// See CLAUDE.md "Dual-Mode Consistency" section
// Extract mode check to one reusable method
```

**In Code Reviews:**

```markdown
Per the Dual-Mode Orchestrator Code Review Checklist (Phase 2),
please verify all related methods check isOnboardingMode consistently.
```

---

## Maintenance

**Last Updated:** 2026-01-08
**Next Review:** After next orchestrator modification
**Owner:** Prevention Strategist
**Feedback:** Link to original issue #667 if improvements found

---

## Appendix: One-Sentence Rule

**For any orchestrator with modes (onboarding + admin, etc.):**

> If one method checks mode, ALL related methods must check mode the same way.

That's it. That's the prevention strategy. Everything else is just making sure reviewers catch violations.
