---
module: MAIS
date: 2026-01-09
type: index
problem_types: [memory-leak, race-condition, capability-mismatch, async-timing, documentation]
severity: P1-P2
---

# Phase 5 Code Review Prevention Index

**Master index for all Phase 5 prevention strategies**

---

## Quick Navigation

### For Code Review (Next 5 Minutes)

1. **Print & pin:** `PHASE_5_QUICK_REFERENCE.md` (2 min read)
2. **During review:** Use the 30-second checklist
3. **Need detail?** Jump to specific section in `PHASE_5_CODE_REVIEW_PREVENTION_STRATEGIES.md`

### For Implementation (Before Coding)

1. Read the relevant **Prevention Checklist** section
2. Use the **Decision Tree** to assess if you need the pattern
3. Copy the **Code Example** into your PR
4. Test with the provided **Acceptance Criteria**

### For Teaching/Onboarding

1. Share `PHASE_5_QUICK_REFERENCE.md` first
2. Then deep-dive on specific patterns with full guide
3. Reference real examples from code review (todos 677-690)

---

## The 5 Critical Patterns

| #   | Pattern                                               | Severity | Quick Fix                   | Time to Fix |
| --- | ----------------------------------------------------- | -------- | --------------------------- | ----------- |
| 1   | [Unbounded Arrays](#1-unbounded-array-growth)         | P1       | Add MAX\_\*\_SIZE + shift() | 5 min       |
| 2   | [Debounce Races](#2-debounce-race-conditions)         | P1       | Export cancel method        | 10 min      |
| 3   | [Capability Mismatch](#3-capabilitytool-mismatch)     | P1       | Rename to match tool name   | 5 min       |
| 4   | [Dialog Async Timing](#4-dialog-async-timing)         | P2       | Await before closing        | 5 min       |
| 5   | [Undocumented Singletons](#5-undocumented-singletons) | P3       | Add module JSDoc            | 2 min       |

---

## 1. Unbounded Array Growth

**Problem:** Arrays grow infinitely, causing memory leaks in long sessions

**Where it's found:** `agent-ui-store.ts` and other store files

**Impact:** Memory usage grows over time, browser slowdowns in 8+ hour sessions

**Prevention Checklist:**

- [ ] All arrays that grow based on events have MAX\_\*\_SIZE constant
- [ ] FIFO cleanup (shift/pop) when limit exceeded
- [ ] Tests verify memory stays bounded
- [ ] Comment explains why that specific size

**Decision Tree:**

```
Does array grow based on user actions?
├─ YES → Add MAX_*_SIZE + FIFO cleanup
└─ NO → Can skip (bounded by design)
```

**Files:** `PHASE_5_CODE_REVIEW_PREVENTION_STRATEGIES.md#1-unbounded-array-growth`

---

## 2. Debounce Race Conditions

**Problem:** Pending debounced saves fire AFTER publish/discard, overwriting data

**Where it's found:** `useDraftAutosave.ts` + `useDraftConfig.ts`

**Impact:** Silent data corruption (draft persists after discard, stale data after publish)

**Prevention Checklist:**

- [ ] Debounce hooks export cancel method
- [ ] Destructive operations call cancel first
- [ ] Dialog/UI stays open until async completes
- [ ] Tests verify race condition doesn't occur

**Decision Tree:**

```
Does hook A have debounced operations?
├─ YES: Can hook B call destructive ops?
│   ├─ YES → Cancel A's pending ops before B runs
│   └─ NO → Can skip coordination
└─ NO → Standard async/await
```

**Files:** `PHASE_5_CODE_REVIEW_PREVENTION_STRATEGIES.md#2-debounce-race-conditions`

---

## 3. Capability/Tool Mismatch

**Problem:** Capability IDs don't match backend tool names, breaking agent discovery/execution

**Where it's found:** `agent-capabilities.ts` + `storefront-tools.ts`

**Impact:** Agent can't execute discovered capabilities (UX failure)

**Prevention Checklist:**

- [ ] Every capability ID matches an actual backend tool
- [ ] Run audit script: grep + comm to find mismatches
- [ ] Write tools are in REQUIRED_EXECUTOR_TOOLS
- [ ] Agent can successfully discover and execute

**Decision Tree:**

```
Adding new capability or tool?
├─ YES: Tool already exists?
│   ├─ YES → Does capability ID match tool name exactly?
│   └─ NO → Create tool first, then capability
└─ NO: Still audit every 2 weeks
```

**Audit Script:**

```bash
grep "id: '" apps/web/src/lib/agent-capabilities.ts | cut -d"'" -f2 | sort > /tmp/caps
grep "name: '" server/src/agent/tools/ -r | cut -d"'" -f2 | sort > /tmp/tools
comm -23 /tmp/caps /tmp/tools  # Capabilities without tools
comm -13 /tmp/caps /tmp/tools  # Tools without capabilities
```

**Files:** `PHASE_5_CODE_REVIEW_PREVENTION_STRATEGIES.md#3-capabilitytool-mismatch`

---

## 4. Dialog Async Timing

**Problem:** Dialog closes before async operation completes, leaving errors without context

**Where it's found:** `ConfirmDialog.tsx` + `PreviewPanel.tsx`

**Impact:** UX failure (user thinks operation succeeded when it failed)

**Prevention Checklist:**

- [ ] Dialog waits for async callback to complete
- [ ] Loading state shown during operation
- [ ] Dialog only closes on success
- [ ] Errors displayed in context (not dismissed with dialog)
- [ ] Tests verify with network throttling

**Decision Tree:**

```
Dialog callback is async?
├─ YES → Await completion before closing
│   ├─ Show loading state
│   ├─ Close only on success
│   └─ Keep dialog open if error
└─ NO → Can close immediately
```

**Files:** `PHASE_5_CODE_REVIEW_PREVENTION_STRATEGIES.md#4-dialog-async-timing`

---

## 5. Undocumented Singletons

**Problem:** Utility modules export functions that are never used or unclear purpose

**Where it's found:** `agent-capabilities.ts` (425 lines, 10+ unused functions)

**Impact:** Confusion about what's production-ready vs. scaffolding

**Prevention Checklist:**

- [ ] Module-level JSDoc explains purpose
- [ ] Scaffolding marked with @internal/@deprecated
- [ ] Link to feature plan if scaffolding
- [ ] All functions have @example JSDoc
- [ ] Unused functions grepped to verify they're truly unused

**Decision Tree:**

```
Is this utility module?
├─ YES: Is it actually used in production?
│   ├─ YES → Document usage in JSDoc
│   ├─ PARTIAL → Split into used + scaffolding
│   └─ NO → Mark @internal with timeline to implementation
└─ NO → Document as constants/helpers
```

**Files:** `PHASE_5_CODE_REVIEW_PREVENTION_STRATEGIES.md#5-undocumented-singletons`

---

## Related Code Review Findings

These 5 patterns cover P1 issues. Related P2 findings (not detailed here):

- Trust tier mismatches (`discard_draft`)
- Missing capabilities (UI features with no tool)
- QueryClient ref staleness
- Untyped AgentAction payloads
- Stale iframe after publish
- Suboptimal selectors

See todos `681-690` for full list.

---

## Integration Points

### CI/CD Pipeline

**Add these checks to pre-commit or CI:**

```bash
# 1. Find unbounded arrays
grep -r "\.push(" apps/web/src --include="*.tsx" | grep -v MAX_ | wc -l

# 2. Audit capabilities vs tools
grep "id: '" apps/web/src/lib/agent-capabilities.ts | cut -d"'" -f2 > /tmp/caps
grep "name: '" server/src/agent/tools/ -r | cut -d"'" -f2 > /tmp/tools
if [ $(comm -23 /tmp/caps /tmp/tools | wc -l) -gt 0 ]; then
  echo "ERROR: Capability/tool mismatch"
  comm -23 /tmp/caps /tmp/tools
  exit 1
fi

# 3. Find unused exports (per CLAUDE.md strictness)
npm run lint --include="no-unused-exports"
```

### Code Review Template

**Add to PR review checklist:**

```markdown
### Prevention Patterns (Phase 5)

- [ ] Arrays have size limits (MAX\_\*\_SIZE)?
- [ ] Debounced ops cancelled before destructive operations?
- [ ] Capability IDs match tool names?
- [ ] Dialogs await async before closing?
- [ ] Unused functions marked @internal or documented as scaffolding?

See: docs/solutions/patterns/PHASE_5_QUICK_REFERENCE.md
```

### Documentation

**Link in CLAUDE.md under "Prevention Strategies":**

```markdown
- **[phase-5-code-review-prevention](docs/solutions/patterns/PHASE_5_CODE_REVIEW_PREVENTION_STRATEGIES.md)** - 5 critical patterns from Phase 5 code review (memory leaks, race conditions, capability mismatches, async timing, documentation)
  - Quick reference: [PHASE_5_QUICK_REFERENCE.md](docs/solutions/patterns/PHASE_5_QUICK_REFERENCE.md) - Print & pin (2 min read)
```

---

## Success Criteria

After implementing these prevention strategies:

- [ ] All PRs pass unbounded array check
- [ ] All PRs pass capability/tool audit
- [ ] Code reviews reference specific prevention patterns
- [ ] Team can explain 5 patterns in 5 minutes
- [ ] Zero regressions on these 5 issue types

---

## Timeline

| Date       | Milestone                         |
| ---------- | --------------------------------- |
| 2026-01-09 | Prevention strategies created     |
| 2026-01-10 | Integrate into CI/CD              |
| 2026-01-15 | Team training session             |
| 2026-01-31 | First full sprint with prevention |
| 2026-02-28 | Retrospective: any regressions?   |

---

## Team Onboarding

### New team member (30 minutes)

1. Read `PHASE_5_QUICK_REFERENCE.md` (2 min)
2. Read specific section of full guide relevant to your task (15 min)
3. Ask questions (10 min)
4. Look up pattern during code review (on-demand)

### Code reviewer (5 minutes)

1. Open `PHASE_5_QUICK_REFERENCE.md`
2. Use 30-second checklist on each PR
3. Reference specific prevention pattern if issue found

### Tech lead (15 minutes)

1. Review full guide
2. Run integration scripts in CI/CD
3. Add to team documentation
4. Schedule training session

---

## Resources

**Full Prevention Strategy Guide:**

- File: `docs/solutions/patterns/PHASE_5_CODE_REVIEW_PREVENTION_STRATEGIES.md`
- Sections: 5 detailed patterns, decision trees, code examples, checklists

**Quick Reference (Print & Pin):**

- File: `docs/solutions/patterns/PHASE_5_QUICK_REFERENCE.md`
- Length: 2 min read, 5 bash scripts, 30-second checklist

**Original Code Review Findings:**

- Todos: `677-690` in `/todos/`
- 4 P1 issues, 9 P2 issues, 3 P3 issues
- Files affected: agent-ui-store, hooks, capabilities, dialog

**Related Prevention Strategies:**

- `docs/solutions/patterns/ATOMIC_TENANT_PROVISIONING_DEFENSE_IN_DEPTH.md` (transaction coordination)
- `docs/solutions/patterns/BUILD_MODE_STOREFRONT_EDITOR_PATTERNS.md` (state management)
- `docs/solutions/patterns/CIRCULAR_DEPENDENCY_EXECUTOR_REGISTRY.md` (module organization)

---

## Summary

The Phase 5 code review found 5 critical patterns that repeat across the codebase:

1. **Unbounded Arrays** → Always add MAX\_\*\_SIZE
2. **Debounce Races** → Export cancel methods
3. **Capability Mismatch** → Verify IDs match tools
4. **Dialog Async Timing** → Await before closing
5. **Undocumented Singletons** → Document purpose clearly

Using these prevention strategies eliminates similar issues in future development.

**Next action:** Print `PHASE_5_QUICK_REFERENCE.md` and share with team.
