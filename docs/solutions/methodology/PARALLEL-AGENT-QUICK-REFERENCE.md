---
title: 'Parallel Agent TODO Resolution - Quick Reference'
category: methodology
priority: P1
status: reference
last_updated: 2026-02-03
tags:
  - workflow
  - quick-reference
  - todo-resolution
  - parallel-processing
---

# Parallel Agent TODO Resolution - Quick Reference

**Print this and pin it to your monitor before starting parallel resolution work.**

---

## The 5-Phase Workflow (30 Second Overview)

```
PHASE 1: Inventory          PHASE 2: Planning           PHASE 3: Execution
├─ List all pending TODOs   ├─ Build dependency graph   ├─ Spawn agents
├─ Extract metadata         ├─ Identify waves           ├─ Monitor progress
└─ Count/categorize by P1/P2/P3  └─ Create agent prompts   └─ Each agent: code → test → archive

                           PHASE 4: Validation         PHASE 5: Integration
                           ├─ Wait for completion      ├─ Review all changes
                           ├─ Verify tests pass        ├─ Create summary commit
                           └─ Check typecheck          └─ Push to main/feature branch
```

---

## Pre-Execution Checklist

- [ ] Current branch is clean (`git status` shows no uncommitted changes)
- [ ] Main branch is up to date (`git pull origin main`)
- [ ] Tests pass locally (`npm test` completes with 0 failures)
- [ ] TypeScript compiles (`npm run typecheck` with no errors)
- [ ] 4+ TODOs to resolve (worth the parallelization overhead)

---

## Phase 1: Quick Commands

```bash
# Find all pending TODOs
find todos/ -name "*-pending-*.md" | wc -l

# List by priority
echo "=== P1 TODOS ===" && ls todos/*-p1-*.md | wc -l
echo "=== P2 TODOS ===" && ls todos/*-p2-*.md | wc -l
echo "=== P3 TODOS ===" && ls todos/*-p3-*.md | wc -l

# Extract TODO IDs for quick reference
grep -h "^ID:" todos/*-pending-*.md | awk '{print $2}' | head -15
```

---

## Phase 2: Dependency Analysis

**Pattern 1: Identify Independent TODOs**

```bash
# These can run in parallel (no dependencies):
grep -L "dependencies:" todos/*-pending-*.md | head -8

# Create groups of 3-4 for each agent
# Example:
#   Agent 1: TODOs 5209, 5212, 5214
#   Agent 2: TODOs 5210, 5213, 5215
#   Agent 3: TODOs 5211, 5220
```

**Pattern 2: Find Blocking Dependencies**

```bash
# This TODO blocks others:
grep "blocking:" todos/5206-pending-*.md

# These depend on something:
grep "dependencies:" todos/5208-pending-*.md

# Mark as Wave 2 (run after Wave 1 completes)
```

**Decision Tree**:

```
Independent? (no blocking dependencies)
├─ YES → Add to Wave 1 for parallel execution
└─ NO → Track dependency, mark for Wave 2+
```

---

## Phase 3: Launching Agents

### Quick Start Template

For each independent TODO, create agent prompt:

```
[COPY THIS TEMPLATE]

TODO #{ID}: {TITLE}

PROBLEM:
{2-3 sentence summary of what's broken}

LOCATION:
- {file1.ts}:{line_range}
- {file2.ts}:{function_name}

SOLUTION APPROACH:
{Specific pattern to implement, with example if complex}

ACCEPTANCE CRITERIA:
- npm test passes (all tests)
- npm run typecheck passes (no errors)
- No console.log statements (use logger)
- Verify tenant scoping in queries (if database-related)

DEFINITION OF DONE:
1. Make changes to files above
2. Create test cases if applicable
3. Run: npm test
4. Run: npm run typecheck
5. Archive: mv todos/{ID}-pending-*.md todos/archive/{ID}-complete-*.md
6. Stage: git add <files>
7. Ready for Phase 4
```

### Execution Command

```bash
# Launch all Wave 1 agents (one message with N invocations)
# Each agent uses template above with their specific TODO filled in

# Expected: ~5-7 minutes for agents to complete work
```

---

## Phase 4: Validation Checklist

**For each resolved TODO**:

```bash
# 1. TODO archived?
ls todos/archive/{ID}-complete-*.md && echo "✓ Archived"

# 2. Tests passing?
npm test -- --testNamePattern="{ID}" && echo "✓ Tests pass"

# 3. TypeScript clean?
npm run typecheck && echo "✓ TypeScript clean"

# 4. Files staged?
git status | grep "modified:" | wc -l

# 5. Commit message has TODO ID?
git log -1 --format=%B | grep -E "#{ID}|TODO-{ID}" && echo "✓ Commit tagged"
```

**Quick Validation Script**:

```bash
#!/bin/bash
echo "Validating parallel TODO resolution..."

# Count archived TODOs
archived=$(ls todos/archive/*-complete-*.md 2>/dev/null | wc -l)
pending=$(ls todos/*-pending-*.md 2>/dev/null | wc -l)

echo "Archived: $archived, Still Pending: $pending"

# Run full validation
npm run typecheck || { echo "❌ TypeScript errors"; exit 1; }
npm test || { echo "❌ Test failures"; exit 1; }

echo "✓ All validations passed"
```

---

## Phase 5: Committing

**Good Commit Message Template**:

```
fix(multiple): resolve 11 code-quality TODOs

RESOLVED:
- TODO-5206: XSS sanitization
- TODO-5207: JSON-LD safety
- TODO-5208: N+1 query optimization
- ... (list all)

STATS:
- {N} TODOs resolved
- {X} files modified
- {Y} tests added
- 0 breaking changes

METHOD: Parallel agent execution with dependency analysis

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>
```

**Command**:

```bash
git commit -m "$(cat <<'EOF'
fix(multiple): resolve 11 code-quality TODOs

RESOLVED:
- TODO-5206: XSS sanitization (P1)
- TODO-5207: JSON-LD safety (P1)
... etc ...

METHOD: Parallel execution in 3 waves

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>
EOF
)"
```

---

## Common Failure Patterns & Recovery

| Symptom                   | Cause                         | Recovery                                                           |
| ------------------------- | ----------------------------- | ------------------------------------------------------------------ |
| `npm test` fails          | Agent missed test case        | Re-run agent for that TODO, or manually add test                   |
| `npm run typecheck` fails | Missing imports/types         | Check error message, add type guards/imports                       |
| Agent incomplete          | Ran out of time or hit error  | Check logs, retry with simplified prompt                           |
| File conflicts            | Two agents modified same file | Should not happen if dependency analysis correct; resolve manually |
| TODO still pending        | Agent didn't archive TODO     | Rename manually: `mv todos/ID-pending todos/archive/ID-complete`   |

---

## Performance Expectations

| Metric   | Baseline               | Improvement          |
| -------- | ---------------------- | -------------------- |
| 8 TODOs  | 45-50 min (sequential) | 8-12 min (parallel)  |
| 11 TODOs | 55-60 min (sequential) | 12-18 min (parallel) |
| 15 TODOs | 70-80 min (sequential) | 18-25 min (parallel) |

**Time Savings: 60-75%**

---

## Common Mistakes to Avoid

1. ❌ **Launching all TODOs simultaneously** → Can cause file conflicts
   - ✓ Do dependency analysis first, then parallel within waves

2. ❌ **Not verifying existing implementation** → Create stale TODOs
   - ✓ Grep for existing code before marking as TODO

3. ❌ **Skipping test validation** → Broken code merges to main
   - ✓ Always run `npm test` after each batch

4. ❌ **Forgetting to archive TODOs** → TODO list becomes stale
   - ✓ Rename `pending` → `complete` and move to archive

5. ❌ **Mixing verified + incomplete work in one commit** → Makes rollback hard
   - ✓ Only commit when all agents complete successfully

6. ❌ **Using generic commit message** → Hard to trace which TODOs were resolved
   - ✓ List all TODO IDs in commit message

---

## Files to Check After Resolution

```bash
# Files modified (should see expected files)
git status --short

# Changes in each area
git diff --stat server/
git diff --stat apps/web/

# Sample actual changes
git diff HEAD~20 -- server/src/services/section-content.service.ts | head -50

# Verify no accidental deletions
git log --oneline -1 -- server/src/routes/
```

---

## Integration with Compound Engineering

After completing parallel resolution:

```bash
# 1. Verify everything is clean
npm run typecheck && npm test

# 2. Document the solution
/workflows:compound

# This creates docs/solutions/methodology/parallel-agent-todo-resolution-[date].md
# with learnings, patterns, and metrics from this session

# 3. The compound document becomes reference for future sessions
```

---

## When to Use Parallel Resolution

✓ **Use parallel if:**

- 4+ independent TODOs
- Well-defined, non-overlapping scope
- Clear success criteria

✗ **Don't use parallel if:**

- 2-3 TODOs (overhead not worth it)
- Tightly interdependent (many blocking dependencies)
- Unclear requirements (need more analysis first)

---

## Quick Links

- **Full Pattern**: `docs/solutions/methodology/PARALLEL-AGENT-TODO-RESOLUTION-PATTERN.md`
- **Best Practices**: `docs/solutions/PARALLEL-AGENT-WORKFLOW-BEST-PRACTICES.md`
- **Previous Session Examples**: `docs/solutions/code-review-patterns/parallel-todo-resolution-*.md`
- **CLAUDE.md Workflows Section**: `CLAUDE.md` → Keywords: `/workflows:`, `resolve_todo_parallel`

---

## Metrics to Track

After completing a parallel resolution batch, note:

```yaml
session:
  date: 2026-02-03
  todos_resolved: 11
  time_spent: 18 minutes
  parallel_waves: 3
  time_savings: ~60%
  p1_ratio: 2/11
  p2_ratio: 6/11
  p3_ratio: 3/11
  all_tests_passed: true
  typecheck_clean: true
```

This data helps improve future estimates.

---

## Pro Tips

1. **Pre-write agent prompts** before launching any agents - saves time mid-session
2. **Use grep for verification** before marking TODOs as needing implementation
3. **Monitor one agent's output** while others work - helps catch patterns early
4. **Commit immediately after validation** - reduces chance of conflicts
5. **Update CLAUDE.md** if new patterns emerge from this session

---

## Emergency: Rollback (If Something Goes Wrong)

```bash
# If you need to undo all parallel work:
git reset --hard HEAD~1

# If you need to undo just one agent's work:
git revert {commit-hash}

# Then manually complete that TODO or mark it for later
```

But prevent this with Phase 4 validation - don't commit until everything passes!
