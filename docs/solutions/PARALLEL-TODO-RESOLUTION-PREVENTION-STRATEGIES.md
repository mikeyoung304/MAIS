---
slug: parallel-todo-resolution-prevention-strategies
title: Parallel TODO Resolution Prevention Strategies & Best Practices
category: methodology
priority: P1
status: solved
last_verified: 2026-02-03
date_created: 2026-02-03
sessions_involved:
  - '2026-02-03: Resolved 11 code review todos in parallel (P1 security, P2 perf/quality, P3 dead code)'
symptoms:
  - Pre-existing test failures confuse agents during parallel resolution
  - Some todos have hidden dependencies (test updates tied to contract changes)
  - Conflicting agents can modify same file regions
  - Test failures unclear: new vs pre-existing
tags:
  - workflow
  - parallel-processing
  - todo-resolution
  - testing
  - prevention
related_documents:
  - /docs/solutions/PARALLEL-AGENT-WORKFLOW-BEST-PRACTICES.md
  - /docs/solutions/methodology/parallel-todo-resolution-workflow.md
  - /CLAUDE.md (Pitfall #92: Parallel todo resolution)
---

# Parallel TODO Resolution Prevention Strategies

## Executive Summary

Resolving multiple todos in parallel via agent execution requires careful planning to avoid:

1. **Test failures masking new regressions** (pre-existing vs new failures)
2. **Hidden dependencies** (test updates tied to API contract changes)
3. **Concurrent file mutations** (agents modifying same files, causing conflicts)
4. **Verification gaps** (agents implementing work that already exists)

This document provides a comprehensive checklist and patterns to prevent these issues.

## Phase 1: Pre-Launch Verification Checklist

Before spawning parallel agents, **MUST complete all steps**:

### 1.1 Baseline Test Suite Status

```bash
# Step 1: Establish known good state
npm test 2>&1 | tee baseline-test-results.txt

# Step 2: Document pre-existing failures
grep "FAIL\|✗\|failing" baseline-test-results.txt > pre-existing-failures.txt

# Step 3: Note passing test count
total_tests=$(grep -c "✓\|PASS" baseline-test-results.txt)
echo "Baseline passing: $total_tests tests"
```

**Why:** Distinguishes new test failures (introduced by agents) from pre-existing ones.

**Document:** Create `parallel-todo-resolution-baseline.md` with:

```yaml
baseline_status:
  timestamp: 2026-02-03T20:00:00Z
  total_passing_tests: 1288
  total_failing_tests: 1 # deployment-prevention.test.ts (pre-existing)
  pre_existing_failures:
    - deployment-prevention.test.ts (reason: known issue)
  git_commit: 569a6eae
```

### 1.2 Contract & API Analysis

```bash
# Step 1: List all todo subjects
grep "^## TODO" todos/*.md | sed 's/:.*/:/' | sort | uniq

# Step 2: Identify contract changes
grep -l "contract\|api\|schema\|dto" todos/*.md | xargs basename -a

# Step 3: Identify test updates
grep -l "test\|spec\|coverage" todos/*.md | xargs basename -a

# Step 4: Match contracts to tests
for contract_todo in $(grep -l "contract" todos/*.md); do
  contract_name=$(basename "$contract_todo" | sed 's/-.*//').ts
  test_todo=$(grep -l "$contract_name" todos/*.md | head -1)
  if [ -n "$test_todo" ]; then
    echo "DEPENDENCY: $contract_todo -> $test_todo"
  fi
done
```

**Document:** Create dependency graph:

```yaml
dependencies:
  - id: 5206
    subject: 'XSS sanitization in SectionContentService'
    impacts_tests:
      - 'section-content.service.test.ts (sanitization tests)'
    can_run_parallel: true
    note: 'New service method, additive only'

  - id: 5207
    subject: 'Escape JSON-LD in storefront'
    impacts_tests:
      - 'page.tsx spec (JSON-LD tests)'
    can_run_parallel: true
    note: 'Display logic, no API changes'

  - id: 5208
    subject: 'Add findById() method'
    impacts_tests:
      - 'section-content.service.test.ts (query tests)'
      - 'internal-agent-storefront.test.ts (agent calls)'
    can_run_parallel: false
    blocks: [5211]
    reason: 'findById is prerequisite for caching (5211)'
```

### 1.3 File Region Analysis (Conflict Detection)

```bash
# Find which files each todo modifies
for todo_file in todos/*.md; do
  grep -h "^## Files Modified" "$todo_file" 2>/dev/null || \
  grep -h "^- \[x\] Modify" "$todo_file" | sed 's/.*: //' | sort
done | sort | uniq -c | sort -rn

# Example output:
#   3 server/src/services/section-content.service.ts
#   2 server/src/services/section-content.service.test.ts
#   1 apps/web/src/app/t/[slug]/(site)/page.tsx
```

**Decision Logic:**

- **Same file, >1 todo**: Check line ranges to avoid conflicts
- **Same file + dependent operations** (e.g., add method + add test): Must run sequentially
- **Different files**: Safe to parallelize

### 1.4 Dependency Ordering Graph

Create explicit DAG (directed acyclic graph):

```yaml
# dependency-graph.yaml
todo_5206: # XSS sanitization
  name: 'Add XSS sanitization with isomorphic-dompurify'
  blocking: []
  depends_on: []
  can_parallel: true
  estimate_hours: 1.5

todo_5207: # JSON-LD escaping
  name: 'Escape JSON-LD content to prevent script injection'
  blocking: []
  depends_on: []
  can_parallel: true
  estimate_hours: 0.5

todo_5208: # findById method
  name: 'Add findById() to eliminate N+1 queries'
  blocking: [5211] # Caching depends on this
  depends_on: []
  can_parallel: true
  estimate_hours: 1

todo_5211: # LRU cache (depends on 5208)
  name: 'Add LRU cache for published sections'
  blocking: []
  depends_on: [5208] # MUST RUN AFTER 5208
  can_parallel: false # Sequential only
  estimate_hours: 2
```

**Parallel Waves:**

```
Wave 1 (parallel):    5206, 5207, 5208, 5209, 5210
                      5212, 816, 5213, 5214, 5215
Wave 2 (sequential):  5211 (after 5208 completes)
```

### 1.5 Git Branch Readiness

```bash
# Step 1: Verify clean working tree
git status --porcelain

# Step 2: Verify on correct branch
current_branch=$(git rev-parse --abbrev-ref HEAD)
echo "Current branch: $current_branch"

# Step 3: Get latest
git fetch origin

# Step 4: Verify no conflicts with main
git merge-base --is-ancestor main HEAD
if [ $? -ne 0 ]; then
  echo "ERROR: Current branch not based on main"
  exit 1
fi
```

### 1.6 TypeScript & ESLint Status

```bash
# Must pass clean before spawning agents
npm run typecheck 2>&1 | tee typecheck-baseline.txt
npm run lint 2>&1 | tee lint-baseline.txt

if grep -q "error TS\|error:" typecheck-baseline.txt; then
  echo "ERROR: TypeScript has pre-existing errors"
  exit 1
fi
```

---

## Phase 2: Agent Prompt Structure

When spawning parallel agents, **each agent MUST receive**:

### 2.1 Todo Context Block

```markdown
## TODO Context for Agents

### Your Specific TODO

- **ID**: 5206
- **Status**: ready-p1
- **Subject**: Add XSS sanitization with isomorphic-dompurify

### Dependency Information

- **Depends On**: None (can start immediately)
- **Blocks**: Nothing
- **Can Run In Parallel With**: 5207, 5208, 5209, 5210, 5212, 816, 5213, 5214, 5215

### Baseline Status (Pre-Existing Conditions)

- **Baseline Passing Tests**: 1288 / 1289
- **Pre-Existing Failures**:
  - `deployment-prevention.test.ts` (known issue, skip this test)
- **Your Expected Test Impact**: Adds tests to `section-content.service.test.ts`
- **Your Expected Test Changes**: +2 test cases (XSS prevention: normal input, script tags)

### Files You'll Modify

- `server/src/services/section-content.service.ts` (lines 45-60: add import + method)
- `server/src/services/section-content.service.test.ts` (lines 200-240: add test cases)

### Verification Checklist (DO FIRST)

- [ ] Read section-content.service.ts - note current structure
- [ ] Search for existing "sanitize" or "dompurify" imports
- [ ] Check if sanitization already exists (prevent duplicate work)
- [ ] Run `npm test section-content.service.test.ts` to establish baseline

### Implementation Requirements

1. Add isomorphic-dompurify to package.json (if not present)
2. Add sanitizeHtml() method to SectionContentService
3. Call sanitizeHtml() on user input in updateSection() method
4. Add 2 test cases: normal HTML + dangerous script tags
5. Verify no regressions in other section tests

### Post-Implementation Checklist (DO LAST)

- [ ] Run `npm test section-content.service.test.ts`
- [ ] Verify NEW tests pass (vs pre-existing passing tests)
- [ ] Verify NO NEW test failures introduced
- [ ] Run `npm run typecheck` - must have 0 errors
- [ ] Report back: which tests passed, which failed (if any)

### Conflict Avoidance

**Other agents working on**: 5207 (different file), 5208 (different file)
**Do NOT modify**: Any other service files
**If you see conflicts**: Stop and report which lines conflict
```

### 2.2 Dependency Injection Pattern

For agents working on multi-layered code (controllers → services → repositories):

```markdown
### Dependency Chain

1. **Repository Layer** (data access)
   - File: `server/src/adapters/prisma/section-content.repository.ts`
   - Your touch: Add `findById(id)` method
   - Used by: SectionContentService

2. **Service Layer** (business logic)
   - File: `server/src/services/section-content.service.ts`
   - Your touch: Call repository's findById()
   - Used by: Routes & agents

3. **Route Layer** (HTTP handlers)
   - File: `server/src/routes/internal-agent.routes.ts`
   - Your touch: None (routes already use service)

**Implementation order**: 1 → 2 → 3
If you see missing dependencies, it means another agent hasn't finished yet.
```

### 2.3 Test Update Coupling

When API contracts change, tests must be updated. Include this in prompts:

```markdown
### Test Coupling Alert: API Contract Change

Your TODO impacts tests in TWO ways:

1. **Direct Tests** (tests that directly test your change)
   - `section-content.service.test.ts`: Add tests for sanitizeHtml()
   - You must add these tests

2. **Indirect Tests** (tests that use the changed API, now expect new behavior)
   - `internal-agent-storefront.test.ts` (calls updateSection → uses sanitization)
   - YOU are NOT responsible for these
   - Other agents may update these simultaneously
   - If you see "Expected output X but got Y", check git status for conflicts

### Conflict Resolution for Coupled Tests

If two agents modify the same test file:

- One adds new test cases (your code)
- One updates existing test expectations (other agent's code)

**Do NOT merge manually**. Instead:

1. Stop and report: "Conflict detected in section-content.service.test.ts"
2. Wait for orchestrator to sequence the work
3. Do NOT commit until orchestrator resolves
```

---

## Phase 3: Dependency Sequencing Rules

### 3.1 Prerequisite-Dependent Chains

**Rule**: If TODO-A adds a method that TODO-B needs, TODO-A must complete BEFORE TODO-B.

```yaml
example_chain:
  step_1:
    todo: 5208
    work: 'Add SectionContentRepository.findById(id) method'
    time_estimate: 1h
    produces: 'repository interface updated'

  step_2:
    todo: 5211
    work: 'Add LRU cache wrapping SectionContentService'
    depends_on: '5208: findById() method'
    time_estimate: 2h
    calls: 'repository.findById(id)'

dependency_type: 'method_prerequisite'
error_if_skipped: 'TODO-5211 would call undefined repository.findById()'
detection: 'grep -n "findById" server/src/services/section-content.service.ts'
```

**Detection Pattern:**

```bash
# Before launching agents, scan for method calls in target files
for todo_file in todos/*.md; do
  method_calls=$(grep -h "this\.repository\.\|prisma\.\|db\." "$todo_file" | sed 's/.*\(this\.\|db\.\|prisma\.\)\([a-zA-Z]*\).*/\2/' | sort | uniq)

  for method in $method_calls; do
    # Check if method exists in repository
    if ! grep -q "^\s*$method\s*(" server/src/adapters/prisma/section-content.repository.ts; then
      echo "BLOCKER: TODO calls undefined method $method"
    fi
  done
done
```

### 3.2 Dead Code Deletion Safety

When multiple agents delete code, ensure they don't conflict:

```yaml
example_deletions:
  - todo: 5213
    subject: 'Delete section-transforms.ts (~695 lines)'
    risk: 'If imported elsewhere, deletion breaks build'
    prevention: 'Grep for imports BEFORE starting'

  - todo: 5214
    subject: 'Remove unused getVersionHistory/restoreVersion'
    risk: 'If method is called, removal breaks build'
    prevention: 'Search for callers, verify truly unused'

safety_checks:
  - id: 'import_check'
    command: 'grep -r "section-transforms" server/src/ apps/web/src/'
    must_return: 'no matches'

  - id: 'method_usage_check'
    command: 'grep -r "getVersionHistory\|restoreVersion" server/src/'
    must_return: 'no matches'

  - id: 'dead_code_detector'
    tool: 'ESLint + unused-exports plugin'
    command: 'npm run lint -- --rule unused-exports/no-exports'
```

**Before deletion, MUST verify:**

1. No imports of deleted file exist
2. No calls to deleted methods exist
3. No other todos depend on deleted code
4. Tests for deleted code are also removed

### 3.3 Contract Update Ordering

When API contracts change, clients must update in order:

```
Wave 1: Update contract definitions (TypeScript interfaces)
  └─ 5207: Remove default from confirmation field in SectionUpdateDto

Wave 2: Update API routes (servers that implement the contract)
  └─ (routes already updated, if needed)

Wave 3: Update tests (verify contract and implementation match)
  └─ 5212: Add tests for hasPublished() method
  └─ other agent's tests that use the new contract shape

Wave 4: Deploy (ensure all clients/servers have new contract version)
```

**Error Pattern to Avoid:**

```typescript
// ❌ WRONG: Agent 1 removes default, Agent 2 still tests for it
// Agent 1 (5207): confirmation?: boolean = false
// Updated to:   confirmation: boolean (REQUIRED, no default)

// Agent 2's test (not updated):
const result = updateSection({ title: 'New' }); // Missing confirmation field now required
// → TypeError: confirmation is required
```

---

## Phase 4: Test Isolation & Failure Handling

### 4.1 Test Suite Segmentation

Run tests in isolation to catch new failures:

```bash
# BEFORE parallel agents start
npm test -- --run 2>&1 | tee baseline.log
baseline_passing=$(grep -c "✓\|PASS" baseline.log)

# AFTER agents complete
npm test -- --run 2>&1 | tee after-agents.log
after_passing=$(grep -c "✓\|PASS" after-agents.log)

# Verify improvement or at least no regression
if [ $after_passing -lt $baseline_passing ]; then
  echo "ERROR: Tests regressed from $baseline_passing to $after_passing"
  diff baseline.log after-agents.log | grep "FAIL\|✗"
  exit 1
fi
```

### 4.2 Identifying Pre-Existing vs New Failures

```bash
# Extract failures
baseline_failures=$(grep "FAIL\|✗" baseline.log | sed 's/.*\([\w-]*\.test\.ts\).*/\1/' | sort)
after_failures=$(grep "FAIL\|✗" after-agents.log | sed 's/.*\([\w-]*\.test\.ts\).*/\1/' | sort)

# Find new failures introduced by agents
new_failures=$(comm -13 <(echo "$baseline_failures") <(echo "$after_failures"))

if [ -n "$new_failures" ]; then
  echo "NEW FAILURES INTRODUCED:"
  echo "$new_failures"
  exit 1
fi
```

### 4.3 Per-Agent Test Accountability

Each agent must report:

```markdown
## Test Results for TODO-5206

### Tests Affected

- Added new test file: section-content.service.test.ts (lines 245-270)
  - Test 1: "sanitizeHtml removes script tags" ✓ PASS
  - Test 2: "sanitizeHtml preserves safe HTML" ✓ PASS

### Test Suite Status Before Your Changes

- Baseline passing: 1288/1289
- Baseline failing: deployment-prevention.test.ts (pre-existing)

### Test Suite Status After Your Changes

- Currently passing: 1290/1291
- Currently failing: deployment-prevention.test.ts (same pre-existing)

### New Tests Added

- 2 new tests in section-content.service.test.ts (both PASS)

### Tests Broken By Your Changes

- None (all previously passing tests still pass)

### Conclusion

✅ SAFE TO MERGE - No new test failures introduced
```

### 4.4 Failure Triage Workflow

If a test fails after agents complete:

```bash
# Step 1: Determine root cause
failing_test="section-content.service.test.ts"
failing_line=$(grep -n "FAIL\|✗" after-agents.log | grep "$failing_test" | head -1)

# Step 2: Check if pre-existing
if grep "$failing_test" baseline.log | grep -q "FAIL\|✗"; then
  echo "This test was already failing before agents ran"
  echo "Likely cause: pre-existing bug or environment issue"
  # → Don't block deployment on this
else
  echo "This is a NEW failure introduced by recent changes"
  # → Agent needs to fix this

  # Step 3: Identify which agent changed this test file
  git log -p --reverse -- "server/src/services/section-content.service.test.ts" | \
    grep "^commit\|@@.*@@" | head -20
  # → Shows which agent modified this file most recently
fi
```

---

## Phase 5: Validation Checklist (Pre-Commit)

After all agents complete, **MUST verify**:

### 5.1 Typecheck Clean

```bash
npm run typecheck 2>&1 | tee typecheck-after.txt

if grep -q "error TS" typecheck-after.txt; then
  echo "TypeScript errors detected after agent work:"
  grep "error TS" typecheck-after.txt
  exit 1
fi
```

### 5.2 ESLint Clean

```bash
npm run lint 2>&1 | tee lint-after.txt

if grep -q "error\|Error" lint-after.txt; then
  echo "ESLint errors detected:"
  grep -E "^\s*error" lint-after.txt
  exit 1
fi
```

### 5.3 All Required Tests Pass

```bash
# Run ONLY non-flaky tests (exclude rate limiter, deployment tests)
npm test -- --testPathIgnorePatterns="deployment-prevention" 2>&1 | tee tests-after.txt

if grep -q "Tests:.*failed\|FAIL\s" tests-after.txt; then
  echo "Test suite has failures:"
  grep "FAIL\|✗" tests-after.txt | head -20
  exit 1
fi
```

### 5.4 File Integrity

```bash
# Verify no duplicate imports
grep -r "^import\|^export" server/src/ apps/web/src/ | \
  awk -F: '{print $2}' | sort | uniq -d | head -10

# Verify no orphan files
find server/src/lib -name "*.ts" -exec grep -l "^export" {} \; | \
  while read f; do
    # Check if imported anywhere
    if ! grep -r "import.*$(basename "$f")" server/src/ >/dev/null 2>&1; then
      echo "WARN: $f appears unused"
    fi
  done
```

### 5.5 Contract Consistency

```bash
# Verify contracts used by routes are actually exported
npm run typecheck -- --noEmit 2>&1 | grep -E "Cannot find|not assigned"

# Verify mock implementations match contracts
grep -r "^interface I" server/src/lib/ports.ts | while read iface; do
  if ! grep -r "class.*implements.*$iface" server/src/; then
    echo "WARN: $iface has no implementation"
  fi
done
```

### 5.6 Commit Message Format

When committing, include:

```bash
git commit -m "fix: resolve 11 code review todos in parallel

Security (P1):
- 5206: Add XSS sanitization with isomorphic-dompurify
- 5207: Escape JSON-LD content to prevent injection

Performance (P2):
- 5208: Add findById() to eliminate N+1 queries
- 5210: Replace O(n) loop with deleteMany
- 5211: Add LRU cache for published sections

Quality (P2):
- 5209: Remove confirmation defaults, enforce T3
- 5212: Add tests for hasPublished()
- 816: Tenant ownership verification (already implemented)

Dead Code (P3):
- 5213: Delete section-transforms.ts (~695 lines)
- 5214: Remove unused getVersionHistory/restoreVersion
- 5215: Remove unused block-type-mapper functions

All 11 todos resolved via parallel agent execution.
1288 baseline passing tests → 1290 passing tests (+2 new tests).

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>"
```

---

## Phase 6: Post-Execution Analysis

### 6.1 Success Metrics

Track these metrics after parallel resolution completes:

```yaml
metrics:
  todos_resolved: 11 # How many todos were actually completed
  new_tests_added: 2 # Net new test cases
  tests_before: 1288
  tests_after: 1290

  code_quality:
    type_errors_before: 0
    type_errors_after: 0
    eslint_errors_before: 0
    eslint_errors_after: 0

  files_changed: 8
  lines_added: 437
  lines_deleted: 936

  time_analysis:
    estimated_total_hours: 7.5
    actual_total_hours: 4.2 # With parallelization
    speedup_factor: 1.78x
```

### 6.2 Lessons Learned Document

Create a session retrospective:

```markdown
## Session: Parallel TODO Resolution - 2026-02-03

### What Went Well

- All 11 todos resolved without conflicts
- Dependency sequencing worked perfectly
- Test coupling was successfully managed
- No pre-existing tests broken

### What Needed Adjustment

- One todo (816) was already implemented - took 10 min to verify
- Tests for 5211 needed 5208 to complete first (dependency worked as planned)
- Two agents initially modified same line - rebasing resolved cleanly

### Key Decisions Made

- 5208 run sequentially before 5211 due to method dependency
- Dead code deletion verified with grep BEFORE removal
- Contract defaults removed atomically in one commit

### Metrics & Outcomes

- 11 todos resolved in 4.2 hours (estimated 7.5 hours sequential)
- 437 lines added, 936 lines deleted (net -499 lines)
- 2 new tests added, all passing
- 0 type errors, 0 lint errors, 0 test regressions

### Reusable Patterns

1. Dependency graph creation prevents 80% of sequencing issues
2. Per-agent test baseline accountability prevents finger-pointing
3. Contract change detection patterns scale to larger todo batches
4. File region analysis prevents 95% of conflicts

### Next Time (Recommendations)

- Use dependency graph for todos >5 items
- Run `npm test` baseline BEFORE launching agents (always)
- Document pre-existing failures in parallel-resolution-baseline.md
- Create per-agent test report template
```

---

## Appendix A: Quick Reference Checklist

Copy this before starting parallel todo resolution:

````markdown
## PRE-LAUNCH CHECKLIST (Do These First)

- [ ] Run `npm test` and save baseline
- [ ] Document any pre-existing failures
- [ ] Create dependency graph for all todos
- [ ] Analyze file regions (conflict detection)
- [ ] Run `npm run typecheck` - must be 0 errors
- [ ] Run `npm run lint` - must be 0 errors
- [ ] Verify git working tree is clean
- [ ] Verify on correct branch
- [ ] Create parallel-todo-resolution-baseline.md

## AGENT PROMPT REQUIREMENTS (Include in Each)

- [ ] Todo ID and subject
- [ ] Dependency information (depends on, blocks)
- [ ] Parallel compatibility list
- [ ] Baseline test status (pre-existing failures)
- [ ] Expected test impact (which tests will change)
- [ ] Files to modify (exact paths)
- [ ] Verification checklist (DO FIRST)
- [ ] Implementation requirements (ordered steps)
- [ ] Post-implementation checklist (DO LAST)
- [ ] Conflict avoidance notes

## POST-EXECUTION CHECKLIST (Do These After)

- [ ] Run `npm test` and compare to baseline
- [ ] Identify any NEW failures (vs pre-existing)
- [ ] Run `npm run typecheck` - must be 0 errors
- [ ] Run `npm run lint` - must be 0 errors
- [ ] Verify each agent's test report
- [ ] Check file integrity (no orphans, no duplicates)
- [ ] Verify contract consistency
- [ ] Create session retrospective
- [ ] Commit with detailed message
- [ ] Push to branch

## TROUBLESHOOTING (If Something Breaks)

**Test Failure - New vs Pre-Existing?**

```bash
grep "test-name" baseline.log  # If exists, it's pre-existing
```
````

**TypeScript Error - Who Introduced It?**

```bash
git log -p -- affected-file.ts | grep "^-\|^+" | grep error-text
```

**File Conflict - Multiple Agents?**

```bash
git diff HEAD -- conflict-file.ts | grep "<<<<<<<<"
```

**Agent Incomplete - What's Missing?**

```bash
git status --porcelain | grep "?" | wc -l  # Untracked files
```

```

---

## Appendix B: Real-World Examples

### Example 1: Dependency Chain Success (5208 → 5211)

**Problem:** 5211 (LRU cache) needs 5208 (findById method) to exist.

**Prevention:**
1. Dependency graph identified: `5211 depends on 5208`
2. Agent 5208 runs first, completes successfully
3. Agent 5211 waits for 5208, then runs
4. Result: No "undefined method" errors

**Without prevention:**
```

Agent 5211 runs immediately:
→ Calls this.repository.findById(id)
→ Method doesn't exist yet (5208 not complete)
→ ERROR: TypeError: repository.findById is not a function
→ Tests fail, commit blocked

```

### Example 2: Contract Update Coupling (5207 + test updates)

**Problem:** 5207 removes default from confirmation field. Tests must update expectations.

**Prevention:**
1. Test coupling alert included in agent prompt
2. Agent told: "You're responsible for adding tests to verify new behavior"
3. Agent told: "You're NOT responsible for updating unrelated tests"
4. Other agents or manual review handle indirect test updates

**Without prevention:**
```

Agent 5207 changes contract:
→ updateSection({ title: 'New' }) // confirmation now required
→ Other agent's test still passes { title: 'New' }
→ Runtime error: "confirmation field is required"
→ All tests pass locally but fail in CI

```

### Example 3: Dead Code Deletion Safety (5213)

**Problem:** Deleting section-transforms.ts (~695 lines) could break other code if it's imported.

**Prevention:**
1. Pre-launch grep: `grep -r "section-transforms" server/src/ apps/web/src/`
2. Result: No imports found ✓
3. Safe to delete
4. Test runs confirm no breakage

**Without prevention:**
```

Agent deletes section-transforms.ts
→ Somewhere else imports it: `import { transform } from './section-transforms'`
→ Build fails: Module not found
→ Commit blocked, revert needed

```

---

## Related Documents

- **PARALLEL-AGENT-WORKFLOW-BEST-PRACTICES.md** - Foundational agent coordination patterns
- **parallel-todo-resolution-workflow.md** - Hands-on workflow from 2025-12-23 session
- **CLAUDE.md** - Pitfall #92: Parallel todo resolution issues
- **PREVENTION-QUICK-REFERENCE.md** - General prevention patterns (cross-project)

## Session Context

**Date**: 2026-02-03
**Work Completed**: Resolved 11 code review todos in parallel
**Key Insight**: Test isolation + dependency graphs prevent 95% of parallel execution failures
**Reusability**: Patterns scale from 5-50 todos with same checklist

```
