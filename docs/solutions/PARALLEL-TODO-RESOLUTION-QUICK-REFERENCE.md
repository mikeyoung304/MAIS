---
slug: parallel-todo-resolution-quick-reference
title: Parallel TODO Resolution Quick Reference (1-Page Checklist)
category: methodology
priority: P1
status: solved
date_created: 2026-02-03
---

# Parallel TODO Resolution Quick Reference

**Use this before every parallel todo execution. Full guide: `PARALLEL-TODO-RESOLUTION-PREVENTION-STRATEGIES.md`**

## 5-Minute Setup (MUST DO)

```bash
# 1. Baseline tests (establishes pre-existing failures)
npm test 2>&1 | tee baseline.txt

# 2. Record passing count
passing_before=$(grep -c "✓\|PASS" baseline.txt)
failing_before=$(grep -c "✗\|FAIL" baseline.txt)
echo "Baseline: $passing_before passing, $failing_before failing"

# 3. Verify clean state
npm run typecheck >/dev/null && npm run lint >/dev/null && echo "✓ TypeScript & ESLint clean"

# 4. Create dependency graph (see template below)
cat > parallel-todo-dependencies.yaml << 'EOF'
todo_1234:
  subject: 'Add feature X'
  blocking: []
  depends_on: []
  can_parallel: true

todo_1235:
  subject: 'Add feature Y (needs X from 1234)'
  blocking: []
  depends_on: [1234]  # MUST RUN AFTER 1234
  can_parallel: false

# TODO: Add all your todos here
EOF
```

---

## Per-Agent Checklist

**Give this to each agent:**

```markdown
## Your TODO Context

- **Todo ID**: [FILL IN]
- **Subject**: [FILL IN]
- **Status**: Can run in parallel with: [TODO_IDS]
- **Test Baseline**: $passing_before passing / $failing_before failing
- **Files You Modify**: [PATH/TO/FILE]

### DO FIRST (Verification)

- [ ] Read all affected files
- [ ] Search for existing implementation (prevent duplicate work)
- [ ] Run `npm test` locally to establish baseline
- [ ] Note any files that import your changes (dependency check)

### DO THEN (Implementation)

- [ ] Make your changes
- [ ] Add/update tests
- [ ] Run `npm run typecheck` locally (0 errors required)
- [ ] Run `npm run lint` locally (0 errors required)

### DO LAST (Report)

- [ ] Run `npm test` and compare to baseline
- [ ] Report: "X new tests added, Y tests still passing, Z new failures"
- [ ] If new test failures: STOP and report which tests
- [ ] Copy results to `agent-report-[TODOID].txt`

### Conflict Avoidance

- Only modify: $FILES_FOR_THIS_TODO
- Don't touch: [OTHER FILES]
- If you see conflicts: STOP, don't commit
```

---

## Dependency Detection (2-Minute Scan)

```bash
# Find which todos modify same files
for f in todos/*.md; do
  grep -h "## Files\|^- \[.*\].*:" "$f" 2>/dev/null
done | sort | uniq -c | sort -rn

# OUTPUT INTERPRETATION:
#   2 server/src/services/foo.service.ts
#   1 server/src/services/foo.service.test.ts
# → Run these 2 sequentially, not in parallel

# Find method calls that might be prerequisites
grep -h "this\..*\.\|db\." todos/*.md | \
  sed 's/.*\(this\.\|db\.\)\([a-zA-Z]*\).*/\2/' | sort | uniq -c
```

---

## Test Failure Triage (When Things Break)

```bash
# 1. Get new vs pre-existing
passing_after=$(grep -c "✓\|PASS" after.txt)
grep "✗\|FAIL" after.txt > new-failures.txt

# 2. Check if pre-existing
while read line; do
  if grep -q "$line" baseline.txt; then
    echo "PRE-EXISTING: $line"
  else
    echo "NEW (NEEDS FIX): $line"
  fi
done < new-failures.txt

# 3. If new failures, identify agent
git log -1 --format="%ai %s" -- affected-test-file.ts
```

---

## Pre-Commit Validation (5-Minute Check)

```bash
# Must all pass before committing
npm test -- --run 2>&1 | grep -E "Tests:|failed" | head -5
npm run typecheck 2>&1 | grep -E "error|Error" | wc -l
npm run lint 2>&1 | grep -E "error|Error" | wc -l

# Example output (must be like this):
# Tests: 1290 passed
# 0
# 0
```

**If any check fails:** Don't commit, have agents fix issues first.

---

## Commit Message Template

```bash
git commit -m "fix: resolve [N] todos in parallel

[CATEGORY] (P[1-3]):
- [TODO_ID]: Brief description
- [TODO_ID]: Brief description

Summary:
- X tests added
- Y lines of code removed
- Z type/lint errors fixed

Baseline: $passing_before tests passing
Result: $passing_after tests passing (+$(($passing_after - $passing_before)) new tests)

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>"
```

---

## Red Flags (Stop & Report)

| Flag                   | Action                                          |
| ---------------------- | ----------------------------------------------- |
| New test failures      | Stop. Agent reports failure. Don't merge.       |
| TypeScript errors      | Stop. Check what changed. Don't merge.          |
| Conflicting file edits | Stop. Identify which agents conflict. Sequence. |
| Pre-existing test used | Verify if agent was supposed to modify it.      |
| Method doesn't exist   | Check if dependency todo is complete first.     |
| Import errors          | Use `npm run typecheck` to identify orphans.    |

---

## Real Example: 11 Todos (Feb 2026)

```bash
# Setup
npm test >/dev/null 2>&1  # Baseline: 1288 passing
cat > baseline.txt << EOF
passing_tests: 1288
failing_tests: 1  # deployment-prevention.test.ts (pre-existing)
EOF

# Dependency Graph
# Wave 1 (parallel):  5206, 5207, 5208, 5209, 5210, 5212, 816, 5213, 5214, 5215
# Wave 2 (sequential): 5211 (AFTER 5208: needs findById method)

# After completion
npm test >/dev/null 2>&1  # Result: 1290 passing (+2 new tests added)
# ✓ No new failures
# ✓ No type errors
# ✓ No lint errors

# Commit
git commit -m "fix: resolve 11 code review todos in parallel

Security (P1):
- 5206: XSS sanitization
- 5207: JSON-LD escaping

Performance (P2):
- 5208: Add findById() method
- 5210: Replace O(n) loop
- 5211: LRU cache (depends on 5208)

Quality (P2):
- 5209: Remove confirmation defaults
- 5212: Add hasPublished() tests
- 816: Tenant ownership verification

Dead Code (P3):
- 5213: Delete section-transforms.ts
- 5214: Remove unused version history
- 5215: Remove block-type-mapper

Tests: 1288 → 1290 passing (+2 new tests, +0 regressions)"
```

---

## When To Use Parallel vs Sequential

| Scenario                                 | Decision       | Why                      |
| ---------------------------------------- | -------------- | ------------------------ |
| Todos add independent features           | **Parallel**   | No dependencies          |
| Todo A adds method, Todo B calls it      | **Sequential** | B depends on A           |
| Todos modify different files             | **Parallel**   | No conflicts             |
| Todos modify same file (>10 lines apart) | **Parallel**   | Likely safe              |
| Todos modify same method                 | **Sequential** | Risk of conflict         |
| Todos add tests + update contracts       | **Sequential** | Tests depend on contract |
| Dead code deletion + no imports          | **Parallel**   | Safe to delete           |
| Dead code deletion + has imports         | **Sequential** | Fix imports first        |

---

## File: `parallel-todo-dependencies.yaml` Template

```yaml
# Use this to track ALL todos for parallel execution
# Before running agents, fill this out completely

metadata:
  created_at: 2026-02-03T15:30:00Z
  total_todos: 11
  parallel_waves: 2
  estimated_hours: 7.5
  actual_hours: null # Fill after completion

todos:
  5206:
    subject: Add XSS sanitization
    file_modified: [server/src/services/section-content.service.ts]
    blocking: []
    depends_on: []
    wave: 1
    status: pending

  5211:
    subject: Add LRU cache for sections
    file_modified: [server/src/services/section-content.service.ts]
    blocking: []
    depends_on: [5208] # Needs findById method
    wave: 2 # Runs AFTER 5208 completes
    status: pending

  # TODO: Add all 11 todos...

parallel_waves:
  wave_1:
    todos: [5206, 5207, 5208, 5209, 5210, 5212, 816, 5213, 5214, 5215]
    start_order: any
    estimated_duration: 3.5h

  wave_2:
    todos: [5211]
    dependencies: wave_1 must complete
    estimated_duration: 2h
```

---

## Session Metrics to Track

```yaml
# Record these after completing parallel resolution

session:
  date: 2026-02-03
  todos_planned: 11
  todos_completed: 11
  todos_already_done: 0
  todos_failed: 0

tests:
  baseline_passing: 1288
  final_passing: 1290
  new_tests: 2
  new_failures: 0
  regressions: 0

code_quality:
  typecheck_errors_before: 0
  typecheck_errors_after: 0
  lint_errors_before: 0
  lint_errors_after: 0

files_changed: 8
lines_added: 437
lines_deleted: 936

time_analysis:
  estimated_sequential_hours: 7.5
  actual_parallel_hours: 4.2
  speedup_factor: 1.78x

lessons_learned:
  - Dependencies properly sequenced
  - Test isolation worked well
  - One todo was pre-implemented (saved time)
```

---

## Links

- **Full guide**: `PARALLEL-TODO-RESOLUTION-PREVENTION-STRATEGIES.md`
- **Workflows**: `/CLAUDE.md` → `workflows:work`
- **Previous pattern**: `parallel-todo-resolution-workflow.md`
- **Agent patterns**: `PARALLEL-AGENT-WORKFLOW-BEST-PRACTICES.md`
