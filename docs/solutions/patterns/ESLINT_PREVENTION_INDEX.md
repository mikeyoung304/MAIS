---
title: ESLint Dead Code Prevention - Complete Index
date: 2026-01-05
category: patterns
severity: P1
component: Code Quality, Linting
tags: [eslint, dead-code, prevention, index]
---

# ESLint Dead Code Prevention - Complete Index

**Jump to:** [Quick Start](#quick-start) | [All Documents](#all-documents) | [Decision Trees](#decision-trees) | [Checklists](#checklists)

## Executive Summary

This index provides comprehensive prevention strategies for the dead code patterns discovered during lint fixes (commit 764b9132, 25 ESLint errors fixed).

**Root Problem:** ESLint catches syntax patterns but misses semantic issues. Combined with human tendency to keep code "for future use", dead code accumulates.

**Solution:** Multi-layer prevention combining pre-commit hooks, code review, decision trees, and IDE configuration.

## Quick Start (5 minutes)

### For Developers (Right Now)

1. **Read:** [ESLINT_DEAD_CODE_QUICK_REFERENCE.md](./ESLINT_DEAD_CODE_QUICK_REFERENCE.md) (2 min)
2. **Remember:** The decision tree (when to delete vs prefix with `_`)
3. **Always:** Run `npm run lint -- --fix` before committing
4. **Know:** Pre-commit hook will block commits with ESLint errors

### For Team Leads (30 minutes)

1. **Implement:** [ESLINT_PRE_COMMIT_IMPLEMENTATION_GUIDE.md](./ESLINT_PRE_COMMIT_IMPLEMENTATION_GUIDE.md)
2. **Update:** CLAUDE.md and PR template
3. **Communicate:** Share with team (use Slack template in guide)
4. **Verify:** Run test cases to confirm hook works

### For Code Reviewers (Ongoing)

1. **Use:** Dead code checklist in [ESLINT_DEAD_CODE_PREVENTION_STRATEGY.md](./ESLINT_DEAD_CODE_PREVENTION_STRATEGY-MAIS-20260105.md#prevention-strategy-3-code-review-checklist)
2. **Flag:** Anti-patterns (fake functions, future-use code)
3. **Reference:** Link to quick reference when rejecting dead code
4. **Enforce:** YAGNI principle (You Aren't Gonna Need It)

## All Documents

### 1. ESLINT_DEAD_CODE_PREVENTION_STRATEGY-MAIS-20260105.md

**Type:** Complete Prevention Guide
**Audience:** Technical leads, architects, implementers
**Time:** 20 minutes

**Contains:**

- Problem analysis (25 ESLint errors broken down)
- 7 comprehensive prevention strategies
- Configuration examples (ESLint, TypeScript, IDE)
- Decision tree for delete vs underscore
- Code review checklist
- Automated detection scripts
- Common fixes with before/after examples

**When to Read:**

- Understanding root causes and full scope
- Implementing pre-commit hooks
- Setting up team standards
- Architecture decisions around code quality

### 2. ESLINT_DEAD_CODE_QUICK_REFERENCE.md

**Type:** Quick Reference (Print & Pin)
**Audience:** All developers
**Time:** 2 minutes per issue

**Contains:**

- 4 types of dead code with examples
- 30-second decision tree
- 3-second fixes cheat sheet
- ESLint rule reference
- Error → Fix mapping
- Pre-commit checklist
- Golden rule: Delete > Prefix > Keep

**When to Use:**

- Every time you hit an ESLint error
- Onboarding new developers
- Quick decision-making in code
- Print and pin next to monitor

### 3. ESLINT_PRE_COMMIT_IMPLEMENTATION_GUIDE.md

**Type:** Implementation Walkthrough
**Audience:** Team leads, DevOps, implementers
**Time:** 30 minutes to implement

**Contains:**

- Step-by-step implementation
- Enhanced `.husky/pre-commit` hook
- Test cases to verify functionality
- Troubleshooting guide
- Team communication template
- Performance impact analysis
- Verification checklist

**When to Use:**

- Rolling out pre-commit checking
- Debugging hook failures
- Communicating with team
- Troubleshooting developer issues

## Decision Trees

### Tree 1: Should I Delete This Code?

```
Does any other code depend on this?
│
├─ YES (other functions call it, tests use it, exports are imported)
│   └─ KEEP IT
│
└─ NO (nothing references it)
    │
    ├─ Is it a required function parameter? (callback signature)
    │   ├─ YES → Prefix with _: (_param) => { }
    │   └─ NO → DELETE IT
    │
    └─ Is it a function you wrote "just in case"?
        ├─ YES → DELETE IT (git has history)
        └─ NO → Investigate - might be a bug
```

### Tree 2: Type Import or Value Import?

```
Used in:
│
├─ Type annotations only? (const x: MyType)
│   └─ import type { MyType } from '...'
│
├─ Runtime code? (new MyType(), MyType.method())
│   └─ import { MyType } from '...'
│
└─ Both?
    └─ Split them:
        import type { MyType } from '...';
        import { MyType } from '...';
```

### Tree 3: ESLint Error Response

```
"X is defined but never used"
│
├─ Import statement?
│   └─ Delete the import line
│
├─ Variable declaration?
│   └─ Delete the variable (unless it's a side-effect)
│
├─ Function parameter?
│   └─ Prefix with _: (_param) => { ... }
│
└─ Function declaration?
    └─ Delete the entire function
```

## Checklists

### Pre-Commit Checklist (30 seconds)

Before running `git commit`:

```
□ Did I run: npm run lint
□ Did I run: npm run lint -- --fix
□ Did I run: npm run typecheck
□ Are there zero new ESLint warnings?
□ Are all imports necessary?
□ Did I convert type-only imports to import type?
□ Did I delete dead code instead of keeping it?
□ Would a reviewer approve this code quality?
```

### Code Review Checklist

When reviewing PRs:

```
ESLint & Type Safety:
□ All imports are used (not dead imports)
□ Type-only imports use import type
□ No unused variables
□ No unused parameters (or prefixed with _)
□ No functions without callers

Code Quality (YAGNI):
□ Code implements current requirements only
□ No placeholder functions for future use
□ No "just in case" parameters
□ No code waiting to be enabled
□ Removed code, not commented-out code

Pattern Match (Anti-patterns):
□ NOT flagged: function _unused() { ... }
□ NOT flagged: imported but never used
□ NOT flagged: // TODO: use this later
□ NOT flagged: const x = expensive(); // unused
```

### Team Implementation Checklist

To roll out prevention strategies:

```
Immediate (Day 1):
□ Read ESLINT_DEAD_CODE_QUICK_REFERENCE.md
□ Share quick reference with team
□ Review 5 recent ESLint violations (understand patterns)

Short-term (Week 1):
□ Update .husky/pre-commit hook
□ Test pre-commit implementation (3 test cases)
□ Update CLAUDE.md with Prevention Strategies
□ Create/update PR template with ESLint checklist
□ Announce to team (use template in implementation guide)

Medium-term (Week 2-4):
□ Monitor CI success rates (should improve)
□ Address any hook false positives
□ Track code review comments about dead code
□ Gather developer feedback
□ Refine as needed

Long-term (Ongoing):
□ Maintain ESLint configuration
□ Update rules as codebase evolves
□ Document new dead code patterns
□ Keep prevention docs current
```

## Key Metrics (After Implementation)

Track these to measure success:

| Metric                               | Before              | Target          | How to Measure   |
| ------------------------------------ | ------------------- | --------------- | ---------------- |
| ESLint errors in CI                  | 5-10/week           | 0-1/week        | CI logs          |
| Pre-commit hook usage                | 0%                  | 100%            | Hook output logs |
| Code review "remove import" comments | 2-3/week            | 0/week          | Review comments  |
| Dead code accumulation               | 1-2 functions/month | 0/month         | Code inspection  |
| Developer time on lint fixes         | 1-2 hours/week      | 0.25 hours/week | Estimate         |

## Related Documentation

### In This Index

- **[ESLINT_DEAD_CODE_PREVENTION_STRATEGY-MAIS-20260105.md](./ESLINT_DEAD_CODE_PREVENTION_STRATEGY-MAIS-20260105.md)** - Complete prevention guide
- **[ESLINT_DEAD_CODE_QUICK_REFERENCE.md](./ESLINT_DEAD_CODE_QUICK_REFERENCE.md)** - Quick reference (print & pin)
- **[ESLINT_PRE_COMMIT_IMPLEMENTATION_GUIDE.md](./ESLINT_PRE_COMMIT_IMPLEMENTATION_GUIDE.md)** - Implementation walkthrough

### Related Prevention Strategies

- **[typescript-unused-variables-build-failure-MAIS-20251227.md](../build-errors/typescript-unused-variables-build-failure-MAIS-20251227.md)** - TypeScript strictness configuration
- **[import-name-mismatch-onboarding-tools-MAIS-20251231.md](../build-errors/import-name-mismatch-onboarding-tools-MAIS-20251231.md)** - Import validation patterns
- **[ATOMIC_TENANT_PROVISIONING_PREVENTION.md](./ATOMIC_TENANT_PROVISIONING_PREVENTION.md)** - Multi-entity creation patterns (related to code organization)

### In CLAUDE.md

- Common Pitfalls section (link to this index)
- Prevention Strategies section (link to this index)

## Real Examples

### Example 1: Type-Only Import (From Commit 764b9132)

**File:** `server/src/agent/orchestrator/base-orchestrator.ts`

```typescript
// BEFORE (ESLint error)
import { ContextCache, defaultContextCache } from '../context/context-cache';

// AFTER (Fixed)
import type { ContextCache } from '../context/context-cache';
import { defaultContextCache } from '../context/context-cache';

// Why: ContextCache used only in type annotations, not instantiated
```

### Example 2: Unused Import (From Commit 764b9132)

**File:** `server/src/agent/orchestrator/base-orchestrator.ts`

```typescript
// BEFORE (ESLint error)
import { DEFAULT_TIER_BUDGETS, createBudgetTracker, SOFT_CONFIRM_WINDOWS } from './types';

// AFTER (Fixed)
import { DEFAULT_TIER_BUDGETS, createBudgetTracker } from './types';

// Why: SOFT_CONFIRM_WINDOWS was imported but never used (code refactored)
```

### Example 3: Dead Code Function (From Commit 764b9132)

**File:** `server/src/agent/tools/onboarding-tools.ts`

```typescript
// BEFORE (Function never called)
function getMachineEventForPhase(
  phase: OnboardingPhase,
  data?: unknown
): OnboardingMachineEvent | null {
  // 25 lines of switch statement logic
  // But nothing in the codebase calls this function
}

// AFTER (Removed with comment)
// Note: getMachineEventForPhase and getStartedEventType were removed
// Events are now handled in state-machine.ts; these functions were unused

// Why: YAGNI - Code was written for a feature path that was never implemented
```

## Common Questions

### Q: Should I delete or keep the code "just in case"?

**A:** Delete it. Git preserves history. If you need it later:

```bash
git log -p --follow -- filename | grep -A 20 "function name"
```

You'll find the exact implementation instantly.

### Q: How do I fix ESLint errors in pre-commit?

**A:** Three options:

1. **Auto-fix:** `npx eslint --fix <file>`
2. **Manual fix:** Follow the quick reference for common patterns
3. **Read docs:** `docs/solutions/patterns/ESLINT_DEAD_CODE_QUICK_REFERENCE.md`

### Q: What if I genuinely need to keep unused code temporarily?

**A:** Mark it with a TODO ticket:

```typescript
// TODO #123: Remove after feature X is implemented
function _temporaryHelper() {
  // code
}
```

This makes it clear it's intentional and trackable.

### Q: Should I prefix with `_` or delete?

**A:** Use the decision tree in quick reference. Rule of thumb:

- **Function parameter you can't avoid:** `_prefix`
- **Variable you created:** Delete
- **Function nobody calls:** Delete
- **Imported but unused:** Delete

## Implementation Path

### For Immediate Impact (This Week)

1. **Today:** Developers read quick reference (5 min each)
2. **Tomorrow:** Implement pre-commit hook (1 hour)
3. **This week:** Test and verify (30 min + feedback loop)

### For Long-term Success (This Month)

1. **Update documentation** (2 hours)
2. **Train team** (1 hour meeting)
3. **Monitor metrics** (daily 5-min check)
4. **Gather feedback** (weekly 15-min retro)
5. **Refine approach** (iterative improvements)

## Success Stories (After Implementation)

### Week 1

- 2-3 developers discover hook catches their violations
- Auto-fix saves 5-10 minutes per developer
- CI build time improves slightly (fewer re-runs)

### Week 2

- Team gets accustomed to pre-commit checks
- Code review comments shift from "remove import" to architecture
- Zero linting errors in CI

### Week 4

- Dead code accumulation stops
- Developers naturally think about code quality
- Estimated 2-3 hours saved per week on lint issues

## Support & Questions

### If Hook Fails

1. Read error message carefully
2. Check quick reference for solution
3. Run `npx eslint --fix <file>` to auto-correct
4. Re-stage and commit
5. If stuck, see troubleshooting section in implementation guide

### If You Disagree With a Rule

1. Check CLAUDE.md Prevention Strategies (rules come from there)
2. Check ADRs in `docs/adrs/` (architectural decisions)
3. Discuss with team leads
4. Update rule if consensus agrees

### If Pre-commit Hook Has Issues

1. See troubleshooting section in implementation guide
2. Report issue with: `npm version`, `node version`, `git version`
3. Check `.husky/pre-commit` file hasn't been modified
4. Try: `rm -rf .husky && npm install` to reinstall

## Next Steps

1. **Developers:** Read `ESLINT_DEAD_CODE_QUICK_REFERENCE.md`
2. **Team Lead:** Follow `ESLINT_PRE_COMMIT_IMPLEMENTATION_GUIDE.md`
3. **Reviewers:** Use checklist from `ESLINT_DEAD_CODE_PREVENTION_STRATEGY.md`
4. **Everyone:** Reference quick guide as needed

---

**Questions?** Check the specific document for your role above, then reach out to your tech lead.

**Found a better approach?** Update this index and the strategy docs.

**Lessons learned?** Add them to the compounds section via `/workflows:compound`.
