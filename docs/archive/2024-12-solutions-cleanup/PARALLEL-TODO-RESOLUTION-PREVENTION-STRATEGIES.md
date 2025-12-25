---
title: 'Prevention Strategies for Parallel TODO Resolution Workflow'
category: 'workflow'
severity: ['critical', 'p0']
tags:
  - 'todo-resolution'
  - 'parallel-workflow'
  - 'prevention-strategies'
  - 'dependency-management'
  - 'quality-assurance'
date: '2025-12-23'
related_sessions:
  - '2025-12-05: Todo Parallel Resolution (246-265)'
  - '2025-12-06: Early Access Security Fix'
---

# Prevention Strategies for Parallel TODO Resolution Workflow

## Executive Summary

This document codifies prevention strategies to maintain quality and reliability when using parallel agents to resolve multiple TODOs simultaneously. Parallel resolution offers significant speed improvements (4-6 hours saved per session) but introduces risks:

- **Dependency misses:** Agent A assumes Agent B completed their work
- **Stale status markings:** Closed as resolved when actually still pending
- **Conflict accumulation:** Multiple agents modifying same files in unexpected ways
- **Test suite regression:** Batch changes introduce subtle failures not caught individually

**Document Purpose:** Prevent parallel TODO resolution from creating more problems than it solves.

---

## Problem Categories

### Category 1: Dependency Analysis Failures

**Risk:** Agent A resolves TODO-X assuming TODO-Y is complete, but TODO-Y is deferred.

**Real Example:**

```
TODO-234: EditableImage component (requires TODO-235)
TODO-235: Image upload endpoints (deferred to next sprint)
→ Agent resolves 234 assuming 235 exists → breaks at runtime
```

**Prevention Impact:** Eliminate 15-30 min per session debugging missed dependencies.

### Category 2: False Status Closures

**Risk:** Mark TODO complete when code review incomplete or tests failing.

**Real Example:**

```
TODO-264: Create ErrorAlert component
→ Agent marks complete before running tests
→ Component exists but TypeScript compilation fails
→ Tests not updated for new component imports
```

**Prevention Impact:** Eliminate regression test failures during batch commit phase.

### Category 3: Stale Code State

**Risk:** Agent marks TODO resolved based on outdated code inspection.

**Real Example:**

```
TODO-246: Verify backend endpoints
→ Agent checks routes.ts, finds endpoints
→ But commit 1647a40 is from 30 seconds ago
→ Verification happens 19 hours later when code has changed
```

**Prevention Impact:** Catch timing issues before creating false evidence.

### Category 4: Conflict Cascade

**Risk:** Multiple agents modifying shared files (index.ts, package.json) simultaneously.

**Real Example:**

```
Agent-A updates client/src/components/index.ts (add ErrorAlert)
Agent-B updates client/src/components/index.ts (add StatusBadge)
→ Git merge conflict on same file
→ Manual resolution required (10-20 min)
```

**Prevention Impact:** Coordinate file changes, use smart export strategies.

### Category 5: Test Suite Gaps

**Risk:** Code changes pass individual unit tests but E2E fails due to integration issues.

**Real Example:**

```
TODO-265: Add React.memo to StatusBadge
TODO-264: Create ErrorAlert component
→ Both pass unit tests
→ E2E fails because StatusBadge now memoized but receives new callback from ErrorAlert
```

**Prevention Impact:** Run full test suite before final batch commit, not after.

---

## Prevention Strategy 1: Dependency Analysis First

### Problem Being Prevented

- Agent assumes dependency already resolved
- Missing dependencies cause cascading failures
- Incomplete dependency documentation
- Circular dependency detection missed

### Implementation

#### Step 1a: Create Dependency Map (Upfront)

**When:** Before starting parallel work

**Do This:**

```bash
# Extract all "dependencies" fields from todos
grep -r "dependencies:" todos/ -A 5 > /tmp/dep-map.txt

# Manually create mermaid diagram
cat > /tmp/dependency-diagram.md << 'EOF'
# TODO Dependency Map

## Critical Path (Must Complete First)
TODO-246 (backend)
  ├─ TODO-247 (contracts)
  └─ TODO-248 (routes)

## Parallel Group A (Independent)
TODO-264 (ErrorAlert)
TODO-265 (React.memo StatusBadge)
TODO-253 (localStorage recovery)

## Deferred (Not in this batch)
TODO-234 (EditableImage - blocked by 235)
TODO-235 (Image upload - deferred)
TODO-260 (React Query refactor - large scope)

## Metadata
- Total TODOs: 15
- Critical path: 3 (must be sequential)
- Parallel safe: 8 (can work simultaneously)
- Deferred: 4 (not in this batch)
- Estimated parallel time: 90 min
- Estimated sequential: 240 min
- Savings: 150 min (60% faster)
EOF

# Validate diagram
```

#### Step 1b: Dependency Rules

**RULE 1: No backward dependencies**

Before any agent starts work, verify:

```bash
for todo in ${TODOS[@]}; do
  deps=$(grep "dependencies:" todos/${todo}.md | grep -o '\[.*\]')

  # Check that all dependencies are either:
  # A) Already complete (status: complete)
  # B) In critical path (will complete before this todo)
  # C) Independent (can run in parallel)

  for dep in ${deps[@]}; do
    status=$(grep "status:" todos/${dep}.md | head -1)
    if [[ "$status" == *"pending"* ]]; then
      echo "ERROR: ${todo} depends on pending ${dep}"
      exit 1
    fi
  done
done
```

**RULE 2: Document hard dependencies**

Mark dependencies in todo metadata explicitly:

```yaml
---
status: pending
priority: p2
issue_id: '234'
dependencies: # NEW: Hard requirement
  - '235: Image upload endpoints must exist first'
blockers: # NEW: Will block other work
  - '236: Editable gallery feature depends on this'
can_parallel: false
---
```

**RULE 3: Circular dependency detection**

```bash
# Before parallel work, check for cycles
function check_cycles() {
  visited=()
  rec_stack=()

  for todo in todos/*.md; do
    if ! in_array "$todo" "${visited[@]}"; then
      if dfs_has_cycle "$todo" visited rec_stack; then
        echo "CIRCULAR DEPENDENCY FOUND: $todo"
        exit 1
      fi
    fi
  done
}
```

#### Step 1c: Dependency Groups

**Organize todos into execution groups:**

```yaml
# Critical Path Group (Sequential)
group: critical_path
max_parallel: 1  # Run one at a time
todos: [246, 247, 248]
duration: 45 min
notes: "Backend foundation - others depend on this"

# Quick Wins Group A (Parallel)
group: quick_wins_a
max_parallel: 4  # Run up to 4 simultaneously
todos: [264, 265, 253, 254]
duration: 30 min
notes: "UI components - independent of each other"

# Quick Wins Group B (Parallel)
group: quick_wins_b
max_parallel: 3
todos: [255, 261, 262]
duration: 20 min
notes: "Styling/config - independent"

# Deferred (Hold for Next Sprint)
group: deferred
max_parallel: 0  # Don't work on these
todos: [234, 235, 260]
duration: 20+ hours
notes: "Larger features - schedule separately"
```

### Success Criteria

- ✅ Zero circular dependencies
- ✅ All hard dependencies documented
- ✅ Dependency map matches actual code state
- ✅ Critical path identified (can be completed in first group)

---

## Prevention Strategy 2: Pre-Resolution Verification

### Problem Being Prevented

- Marking TODOs complete without checking code
- Using outdated code state as evidence
- Missing test failures before batch commit
- False positive "already implemented" closures

### Implementation

#### Step 2a: Verification Checklist

**For Each TODO Before Work Starts:**

```bash
#!/bin/bash
# verify-todos.sh - Run before starting any parallel work

TODO_ID=$1
TODO_FILE="todos/${TODO_ID}.md"

echo "Verifying TODO-${TODO_ID}..."

# Check 1: Evidence validation
echo "  [1] Checking evidence paths..."
evidence_paths=$(grep -A 20 "evidence_paths:" "$TODO_FILE" | grep "- " | cut -d' ' -f3-)
for path in $evidence_paths; do
  if [ ! -f "$path" ]; then
    echo "    ❌ MISSING: $path"
    exit 1
  fi
done

# Check 2: Commit validation
echo "  [2] Checking commit timestamp..."
commit=$(grep "commit_where_implemented:" "$TODO_FILE" | cut -d: -f2)
commit_time=$(git log -1 --format=%aI "$commit" 2>/dev/null)
if [ -z "$commit_time" ]; then
  echo "    ❌ INVALID commit: $commit"
  exit 1
fi

# Check 3: Status consistency
echo "  [3] Checking status..."
status=$(grep "^status:" "$TODO_FILE" | head -1 | cut -d: -f2)
if [[ ! "$status" =~ (pending|ready|complete|deferred) ]]; then
  echo "    ❌ INVALID status: $status"
  exit 1
fi

# Check 4: Dependency resolution
echo "  [4] Checking dependencies..."
dependencies=$(grep -A 10 "dependencies:" "$TODO_FILE" | grep "- " | wc -l)
if [ "$dependencies" -gt 0 ]; then
  # Verify all dependencies are complete
  grep -A 10 "dependencies:" "$TODO_FILE" | grep "- " | while read -r dep; do
    dep_id=$(echo "$dep" | grep -o "[0-9]\+")
    dep_status=$(grep "^status:" "todos/${dep_id}.md" 2>/dev/null | cut -d: -f2)
    if [[ ! "$dep_status" =~ "complete" ]]; then
      echo "    ❌ UNRESOLVED dependency: TODO-${dep_id} (status: ${dep_status})"
      exit 1
    fi
  done
fi

echo "  ✅ Verification passed"
```

**Before Parallel Work Starts:**

```bash
# Run verification on ALL todos in batch
for todo_id in 246 247 248 249 250 252 253; do
  verify-todos.sh "$todo_id" || exit 1
done

echo "All TODOs verified. Safe to start parallel work."
```

#### Step 2b: Evidence Freshness Check

**Prevent using stale evidence:**

```yaml
---
status: complete
issue_id: '246'
verification: 'Parallel agent review confirmed routes, contracts exist'
# NEW FIELDS:
verification_timestamp: '2025-12-05T17:30:00Z' # When verified
verification_git_state: '62f54ab' # What commit was current
current_git_state: '9c807a5' # What commit is now
evidence_paths:
  - 'server/src/routes/tenant-admin-landing-page.routes.ts:168-304'
  - 'packages/contracts/src/tenant-admin/landing-page.contract.ts:146-227'

# VALIDATION RULE:
# If (current_git_state != verification_git_state):
#   Re-verify evidence paths exist in current code
#   Update verification_timestamp and verification_git_state
---
```

**Implementation:**

```bash
# Before committing batch, re-validate completed todos
function validate_evidence() {
  for todo in todos/*-complete.md; do
    verification_git=$(grep "verification_git_state:" "$todo" | cut -d: -f2)
    current_git=$(git rev-parse HEAD)

    if [ "$verification_git" != "$current_git" ]; then
      echo "⚠️  TODO $(basename $todo) evidence may be stale"
      echo "   Verified at: $verification_git"
      echo "   Current HEAD: $current_git"

      # Re-validate evidence paths exist
      evidence=$(grep -A 5 "evidence_paths:" "$todo" | grep "- " | cut -d: -f1 | cut -d- -f2)
      for path in $evidence; do
        if [ ! -f "$path" ]; then
          echo "   ❌ EVIDENCE MISSING: $path"
          exit 1
        fi
      done

      # Update metadata
      sed -i.bak "s/verification_git_state: .*/verification_git_state: '$current_git'/" "$todo"
      sed -i.bak "s/verification_timestamp: .*/verification_timestamp: '$(date -u +%Y-%m-%dT%H:%M:%SZ)'/" "$todo"
    fi
  done
}

validate_evidence
```

#### Step 2c: Test Compliance Verification

**Before marking any TODO complete:**

```bash
# For implementation TODOs, verify tests exist and pass
function verify_tests() {
  TODO_ID=$1
  TODO_FILE="todos/${TODO_ID}.md"

  # Get files changed
  files=$(grep -A 20 "changes:" "$TODO_FILE" | grep "- " | cut -d- -f2)

  for file in $files; do
    # Check for corresponding test
    test_file=$(echo "$file" | sed 's/\.tsx\?$/.test.ts/' | sed 's/src\//src\/__tests__\//')

    if [ -f "$test_file" ]; then
      # Run test
      npm test -- "$test_file" || {
        echo "❌ Tests failed for $file"
        return 1
      }
    fi
  done

  return 0
}

# Verify all implementation TODOs
for todo in todos/*-p*.md; do
  status=$(grep "^status:" "$todo" | head -1)
  if [[ "$status" == *"complete"* ]]; then
    verify_tests "$(basename $todo .md)" || exit 1
  fi
done
```

### Success Criteria

- ✅ All evidence paths validated (files exist)
- ✅ All commit references valid (git objects exist)
- ✅ Evidence freshness verified (re-validated after HEAD moves)
- ✅ Tests pass for implementation todos
- ✅ Dependencies resolved before marking complete

---

## Prevention Strategy 3: Merge Conflict Avoidance

### Problem Being Prevented

- Multiple agents modifying same files (index.ts, package.json)
- Merge conflicts requiring manual resolution
- Loss of changes during conflict resolution
- Batch commit failures due to git state corruption

### Implementation

#### Step 3a: File Lock Strategy

**Assign "owners" for shared files:**

```yaml
# .claude/todo-resolution-file-locks.yaml
shared_files:
  client/src/components/index.ts:
    risk: HIGH
    max_concurrent_editors: 1
    owner_rotation: true
    strategy: 'one_agent_per_file'

  server/src/di.ts:
    risk: HIGH
    max_concurrent_editors: 1
    owner_rotation: true
    strategy: 'one_agent_per_file'

  package.json:
    risk: CRITICAL
    max_concurrent_editors: 0
    owner_rotation: false
    strategy: 'no_edits_during_parallel'

  .eslintignore:
    risk: MEDIUM
    max_concurrent_editors: 1
    owner_rotation: true
    strategy: 'one_agent_per_file'

# Assignment logic:
assignments:
  - agent: architecture-strategist
    owns:
      - server/src/di.ts
      - server/src/routes/

  - agent: performance-oracle
    owns:
      - client/src/components/index.ts
      - client/src/lib/

  - agent: code-simplicity-reviewer
    owns:
      - server/src/services/
      - client/src/features/
# Fallback:
# If agent needs to edit someone else's owned file,
# must declare it explicitly in TODO and coordinate
```

#### Step 3b: Smart Export Aggregation

**Prevent manual merge conflicts:**

```typescript
// client/src/components/index.ts - Pattern

// ✅ GOOD: Each component in separate section
// Category: Error & Status
export { ErrorAlert } from './shared/ErrorAlert';
export { StatusBadge } from './shared/StatusBadge';

// Category: Empty States
export { EmptyState } from './shared/EmptyState';

// ✅ TOOL-FRIENDLY approach:
// 1. Each agent adds their own section with comment header
// 2. Sections are alphabetically ordered
// 3. Merge conflicts resolve to "keep both" (no manual editing)

// Agent A adds:
// <!-- AGENT-A: ErrorAlert Component -->
// export { ErrorAlert } from './shared/ErrorAlert';

// Agent B adds:
// <!-- AGENT-B: StatusBadge Component -->
// export { StatusBadge } from './shared/StatusBadge';

// Git automatically merges as:
// <!-- AGENT-A: ErrorAlert Component -->
// export { ErrorAlert } from './shared/ErrorAlert';
// <!-- AGENT-B: StatusBadge Component -->
// export { StatusBadge } from './shared/StatusBadge';

// No manual conflict resolution needed!
```

**Implementation:**

```bash
# During parallel work, each agent should ADD to index files like this:

# client/src/components/index.ts
cat >> client/src/components/index.ts << 'EOF'

// Agent: $AGENT_NAME | TODO: $TODO_ID | Component: $COMPONENT_NAME
export { $ComponentName } from './$ComponentPath';
EOF
```

#### Step 3c: Dependency Lock File Strategy

**Prevent package.json conflicts:**

```bash
# Rule: NO agent modifies package.json during parallel work

# Instead:
# 1. Document all npm install/update needs in shared file
UPDATES_NEEDED="/tmp/npm-updates-needed.txt"

# Agent adds to shared file (NOT package.json)
echo "npm install @library/package@version  # TODO-264 (Agent A)" >> "$UPDATES_NEEDED"

# After all parallel work completes:
# Single agent runs all updates atomically
npm install $(cat "$UPDATES_NEEDED" | awk '{print $3}')
```

#### Step 3d: Pre-Commit Conflict Detection

```bash
#!/bin/bash
# detect-merge-conflicts.sh

echo "Scanning for merge conflict markers..."
git diff --cached | grep -E "^[+>].*(<{7}|={7}|>{7})" && {
  echo "❌ ERROR: Merge conflict markers found in staged changes"
  exit 1
}

echo "✅ No conflict markers detected"
```

### Success Criteria

- ✅ No merge conflicts during batch commit
- ✅ All file ownership respected
- ✅ Shared files modified by single agent only
- ✅ Package.json unchanged during parallel phase

---

## Prevention Strategy 4: Quality Gates Before Final Commit

### Problem Being Prevented

- Individual TODO completions succeed but batch integration fails
- Tests pass individually but fail in batch
- TypeScript compiles for single files but fails project-wide
- E2E tests catch integration issues too late

### Implementation

#### Step 4a: Pre-Commit Test Suite (Mandatory)

**Run BEFORE batch git commit:**

```bash
#!/bin/bash
# pre-commit-quality-gates.sh - Must pass 100%

set -e  # Exit on any failure

echo "Running Pre-Commit Quality Gates..."
echo "===================================="

# Gate 1: Unit Tests
echo "[1/6] Running unit tests..."
npm test -- --coverage --bail || {
  echo "❌ Unit tests failed - fix before committing"
  exit 1
}

# Gate 2: TypeScript Compilation
echo "[2/6] TypeScript compilation..."
npm run typecheck || {
  echo "❌ TypeScript errors - fix before committing"
  exit 1
}

# Gate 3: ESLint
echo "[3/6] ESLint check..."
npm run lint || {
  echo "❌ Linting errors - run 'npm run format' to fix"
  exit 1
}

# Gate 4: Code Formatting
echo "[4/6] Code formatting..."
npm run format:check || {
  echo "❌ Formatting issues - run 'npm run format'"
  exit 1
}

# Gate 5: E2E Tests
echo "[5/6] E2E tests (critical path)..."
npm run test:e2e -- --grep "critical|essential" || {
  echo "❌ Critical E2E tests failed - investigate"
  exit 1
}

# Gate 6: Build Verification
echo "[6/6] Build verification..."
npm run build || {
  echo "❌ Build failed - fix before committing"
  exit 1
}

echo ""
echo "✅ All quality gates passed!"
echo "Safe to commit."
```

**Usage:**

```bash
# Before running: git add .
./pre-commit-quality-gates.sh || exit 1
git commit -m "chore(todos): resolve batch..."
```

#### Step 4b: Integration Test for Changed Files

```bash
# Generate list of changed files
CHANGED_FILES=$(git diff --cached --name-only)

# For each changed file, find related tests
for file in $CHANGED_FILES; do
  # Find test files that import from changed file
  test_files=$(grep -r "from.*$file" --include="*.test.ts" --include="*.spec.ts" 2>/dev/null)

  if [ -n "$test_files" ]; then
    echo "Running tests for $file:"
    npm test -- $test_files --bail
  fi
done
```

#### Step 4c: Coverage Regression Detection

```bash
# Ensure test coverage doesn't decrease
BASELINE_COVERAGE=$(cat .coverage-baseline.json | jq '.total.lines.pct')
CURRENT_COVERAGE=$(npm test -- --coverage 2>/dev/null | grep "Statements" | awk '{print $NF}' | tr -d '%')

if (( $(echo "$CURRENT_COVERAGE < $BASELINE_COVERAGE" | bc -l) )); then
  echo "❌ Coverage decreased: $BASELINE_COVERAGE% → $CURRENT_COVERAGE%"
  exit 1
fi

echo "✅ Coverage maintained: $CURRENT_COVERAGE%"
```

### Success Criteria

- ✅ All unit tests pass
- ✅ TypeScript compilation succeeds
- ✅ ESLint passes
- ✅ Code formatting correct
- ✅ E2E tests pass (critical paths)
- ✅ Build succeeds
- ✅ Test coverage maintained/improved

---

## Prevention Strategy 5: Documentation & Audit Trail

### Problem Being Prevented

- Unclear why TODO was marked complete
- Evidence not reproducible in future sessions
- Decisions not documented for code review
- Merge conflicts cause loss of decision rationale

### Implementation

#### Step 5a: Structured TODO Status Updates

```yaml
---
status: complete
issue_id: '246'
priority: p1
date_solved: '2025-12-05'

# NEW: Audit trail fields
resolution_type: 'verification' # implementation, verification, deferral, already_complete
resolved_by: 'architecture-strategist' # Which agent
resolution_time: '15 minutes'

# Evidence of resolution
evidence:
  - type: 'code_location'
    file: 'server/src/routes/tenant-admin-landing-page.routes.ts'
    lines: '168-304'
    commit: '1647a40'
    notes: 'Backend endpoints created in Phase 1'

  - type: 'test_validation'
    file: 'server/src/routes/__tests__/tenant-admin-landing-page.test.ts'
    test_count: 12
    status: 'all passing'

  - type: 'contract_definition'
    file: 'packages/contracts/src/tenant-admin/landing-page.contract.ts'
    lines: '146-227'

  - type: 'timestamp_verification'
    implementation_timestamp: '2025-12-04T22:59:24Z'
    todo_created_timestamp: '2025-12-04T22:59:54Z'
    gap_seconds: -30
    note: 'TODO created 30 seconds after implementation'

# Batch information
batch_id: 'batch-2025-12-05-session1'
batch_commit: '62f54ab'

# Sign-off
verified_by: 'code-review-team'
verification_timestamp: '2025-12-05T17:41:47Z'
---
# Backend Already Exists

[Original content]
```

#### Step 5b: Batch Resolution Log

**Create during parallel work:**

```markdown
# Batch Resolution Log: 2025-12-05-session1

## Session Metadata

- Start Time: 2025-12-05 14:00:00 UTC
- End Time: 2025-12-05 15:30:00 UTC
- Duration: 90 minutes
- Agent Count: 4
- TODO Count: 15

## Resolution Summary

### Group A: Already Implemented (9 TODOs) - 30 min

| TODO | Type         | Evidence           | Verified | Time  |
| ---- | ------------ | ------------------ | -------- | ----- |
| 246  | Verification | routes:168-304     | ✅       | 5 min |
| 247  | Verification | hooks exist        | ✅       | 5 min |
| 248  | Verification | section components | ✅       | 5 min |
| 249  | Verification | rate limiting      | ✅       | 5 min |
| 250  | Verification | monitoring         | ✅       | 3 min |
| 253  | Verification | localStorage       | ✅       | 2 min |
| 254  | Verification | tab blur           | ✅       | 2 min |
| 255  | Verification | layout shift       | ✅       | 2 min |
| 261  | Verification | hooks extracted    | ✅       | 2 min |

### Group B: Quick Wins (3 TODOs) - 45 min

| TODO | Type           | Change                            | Tests      | Time   |
| ---- | -------------- | --------------------------------- | ---------- | ------ |
| 264  | Implementation | ErrorAlert component (52 lines)   | ✅ 4 tests | 20 min |
| 265  | Implementation | React.memo StatusBadge (15 lines) | ✅ 2 tests | 10 min |
| 252  | Implementation | Transaction wrapper (18 lines)    | ✅ 3 tests | 15 min |

### Group C: Deferred (4 TODOs) - Not worked

| TODO | Reason                            | Estimate | Sprint     |
| ---- | --------------------------------- | -------- | ---------- |
| 234  | EditableImage (4-6 hours)         | 4-6 hr   | 2025-12-12 |
| 235  | Image upload endpoints (deferred) | 6-8 hr   | 2025-12-12 |
| 260  | React Query refactor (large)      | 8-12 hr  | 2026-Q1    |

## Quality Gate Results

- Unit Tests: ✅ PASS (771 tests)
- TypeScript: ✅ PASS
- ESLint: ✅ PASS
- E2E Tests: ✅ PASS (21 tests)
- Build: ✅ PASS
- Coverage: ✅ MAINTAINED (85%)

## Files Modified

- Created: 1 (ErrorAlert.tsx)
- Modified: 3 (StatusBadge, EmptyState, tenant.repository.ts)
- Updated: 2 (index.ts, README.md)

## Merge Conflict Prevention

- Conflicts: 0
- File locks respected: ✅
- Smart export strategy: ✅

## Learnings

1. 60% of TODOs were already implemented - plan review verification improved
2. Parallel verification saved ~4 hours vs serial review
3. Evidence freshness check caught outdated commit references
4. Pre-commit quality gates caught E2E flakiness before final commit

## Next Session Recommendations

1. Implement verification BEFORE creating todos (prevents stale todos)
2. Continue using parallel agents for code review todos
3. Batch similar work types (verification, quick wins, defer)
4. Document defer reason in todo for future sprint planning
```

#### Step 5c: Code Review Checklist Template

```markdown
# Code Review: Batch TODO Resolution (PR #XXX)

## Pre-Merge Verification

- [ ] All 15 TODOs in scope accounted for (9 verified, 3 implemented, 3 deferred)
- [ ] Dependency map shows no circular dependencies
- [ ] Evidence validation passed (all code paths exist)
- [ ] Test coverage maintained or improved
- [ ] No merge conflicts in final commit
- [ ] Batch log documentation complete

## Per-TODO Verification

### Already Implemented Group

- [ ] Evidence paths validated (files exist at cited lines)
- [ ] Commit timestamps reasonable (implementation predates todo)
- [ ] Tests exist and pass for cited code
- [ ] No changes needed to existing code

### Quick Wins Group

- [ ] Code follows project conventions
- [ ] Test coverage for new code (>80%)
- [ ] No regression in existing tests
- [ ] ESLint and formatting pass

### Deferred Group

- [ ] Deferral reason documented
- [ ] Dependencies identified
- [ ] Effort estimates reasonable
- [ ] Scheduled for appropriate sprint

## Quality Gates

- [ ] All unit tests passing
- [ ] TypeScript compilation successful
- [ ] E2E tests passing (critical path)
- [ ] Build successful
- [ ] No dead code or unused imports

## Sign-Off

- Reviewed by: [Name]
- Date: [YYYY-MM-DD]
- Approved: ✅ / ❌
- Comments: [Any concerns]
```

### Success Criteria

- ✅ Every TODO has complete audit trail
- ✅ Evidence is reproducible and verifiable
- ✅ Batch resolution log documents decisions
- ✅ Code review checklist completed
- ✅ Future sessions can understand rationale

---

## Prevention Strategy 6: Regular Status Health Checks

### Problem Being Prevented

- TODO count creeping up (death by a thousand TODOs)
- Stale pending items never addressed
- Status inconsistencies across batches
- Abandoned TODOs from failed sessions

### Implementation

#### Step 6a: Weekly TODO Audit

```bash
#!/bin/bash
# weekly-todo-audit.sh

REPORT_DATE=$(date +%Y-%m-%d)
REPORT_FILE="docs/audit/weekly-todo-audit-${REPORT_DATE}.md"

echo "# Weekly TODO Audit - $REPORT_DATE" > "$REPORT_FILE"

# Count by status
echo "## Status Distribution" >> "$REPORT_FILE"
echo "| Status | Count | Trend |" >> "$REPORT_FILE"
echo "|--------|-------|-------|" >> "$REPORT_FILE"
grep "^status:" todos/*.md | cut -d: -f2 | sort | uniq -c | while read count status; do
  echo "| $status | $count | ? |" >> "$REPORT_FILE"
done

# Identify stale items (pending > 7 days)
echo "## Stale TODOs (Pending > 7 Days)" >> "$REPORT_FILE"
find todos -name "*.md" -exec grep -l "^status: pending" {} \; | while read file; do
  created=$(grep "date_created:" "$file" | cut -d: -f2)
  days_old=$(( ($(date +%s) - $(date -d "$created" +%s)) / 86400 ))

  if [ "$days_old" -gt 7 ]; then
    echo "- TODO-$(basename $file .md): $days_old days old" >> "$REPORT_FILE"
  fi
done

# Alert on high count
pending_count=$(grep -l "^status: pending" todos/*.md | wc -l)
if [ "$pending_count" -gt 20 ]; then
  echo "⚠️  WARNING: High pending TODO count ($pending_count > 20)" >> "$REPORT_FILE"
fi

echo "✅ Audit complete: $REPORT_FILE"
```

**Run:** `./weekly-todo-audit.sh` every Monday

#### Step 6b: TODO Staleness Definition

```yaml
# .claude/todo-staleness-rules.yaml

staleness_levels:
  fresh:
    pending_days: 0-2
    action: 'Normal processing'

  aging:
    pending_days: 3-7
    action: 'Review status, may need prioritization'
    risk: 'Medium'

  stale:
    pending_days: 8-14
    action: 'Investigate - why unresolved?'
    risk: 'High'

  abandoned:
    pending_days: '>14'
    action: 'Close or reschedule, mark as abandoned'
    risk: 'Critical'

# Automatic alerts
alerts:
  - if: pending_days > 14
    then: 'Create issue for team discussion'

  - if: pending_days > 21
    then: 'Close as abandoned with rationale'

  - if: pending_days > 7 AND no_recent_comments
    then: 'Tag with @team for status update'
```

#### Step 6c: Batch Completion Metrics

```bash
# Track metrics across batches
function record_batch_metrics() {
  BATCH_ID=$1

  cat >> .metrics/batch-history.json << EOF
{
  "batch_id": "$BATCH_ID",
  "date": "$(date -u +%Y-%m-%dT%H:%M:%SZ)",
  "todos_verified": $(grep -l "resolution_type: verification" todos/*.md | wc -l),
  "todos_implemented": $(grep -l "resolution_type: implementation" todos/*.md | wc -l),
  "todos_deferred": $(grep -l "resolution_type: deferral" todos/*.md | wc -l),
  "total_time_minutes": 90,
  "test_coverage": 85,
  "zero_conflicts": true,
  "zero_regressions": true,
  "success": true
}
EOF
}
```

### Success Criteria

- ✅ Weekly audit shows TODO count trend
- ✅ Zero abandoned TODOs (pending > 21 days)
- ✅ Stale items identified and addressed
- ✅ Metrics tracked across sessions for pattern recognition

---

## Prevention Strategy 7: Parallel Agent Communication Protocol

### Problem Being Prevented

- Agent A doesn't know what Agent B is doing
- Duplicate work (two agents resolve same TODO)
- Missed coordination on shared file changes
- Status updates not communicated to other agents

### Implementation

#### Step 7a: Agent Status Channel

**Create during parallel work:**

```yaml
# .claude/agent-status-log.yaml
# Updated continuously during parallel resolution

session: batch-2025-12-05-session1
start_time: 2025-12-05T14:00:00Z

agents:
  architecture-strategist:
    status: in_progress
    current_todo: '246'
    time_elapsed: 5 minutes
    estimated_completion: 2025-12-05T14:05:00Z
    files_touched: []
    blockers: none

  code-simplicity-reviewer:
    status: in_progress
    current_todo: '264'
    time_elapsed: 8 minutes
    estimated_completion: 2025-12-05T14:20:00Z
    files_touched:
      - client/src/components/shared/ErrorAlert.tsx
      - client/src/components/index.ts
    blockers: none

  performance-oracle:
    status: queued
    current_todo: null
    waiting_for: 'code-simplicity-reviewer to finish with index.ts'
    estimated_start: 2025-12-05T14:20:00Z

  security-sentinel:
    status: in_progress
    current_todo: '249'
    time_elapsed: 10 minutes
    estimated_completion: 2025-12-05T14:15:00Z
    files_touched: []
    blockers: none
# Communication rules:
# 1. Each agent updates status every 10 minutes
# 2. If touching shared file, declare it
# 3. If blocked, post to this log immediately
# 4. Complete ASAP - other agents waiting
```

#### Step 7b: Shared File Declaration

**Before modifying shared files:**

```bash
# Before editing client/src/components/index.ts:

# 1. Check status log
grep "files_touched:" .claude/agent-status-log.yaml | grep "index.ts"

# 2. If another agent has it, wait or coordinate
# 3. If clear, declare ownership:
echo "    files_touched:
      - client/src/components/index.ts  # Owned by $(whoami) until 14:15" >> .claude/agent-status-log.yaml

# 4. Make minimal change
# 5. Release ownership:
sed -i '/client\/src\/components\/index.ts/d' .claude/agent-status-log.yaml
```

#### Step 7c: Blocker Escalation

```bash
# If blocked, immediately escalate
function report_blocker() {
  AGENT_NAME=$1
  BLOCKER_REASON=$2
  BLOCKED_UNTIL=$3

  cat >> .claude/blockers-log.yaml << EOF
- agent: $AGENT_NAME
  reason: "$BLOCKER_REASON"
  reported_at: $(date -u +%Y-%m-%dT%H:%M:%SZ)
  estimated_resolution: $BLOCKED_UNTIL
  severity: high
EOF

  echo "⚠️  BLOCKER REPORTED: $BLOCKER_REASON (Agent: $AGENT_NAME)"
  exit 1  # Stop work until resolved
}
```

### Success Criteria

- ✅ No duplicate work (same TODO resolved twice)
- ✅ Shared file conflicts prevented (one agent at a time)
- ✅ Blockers communicated immediately
- ✅ Status updates shared continuously

---

## Prevention Strategy 8: Automatic Rollback on Critical Failures

### Problem Being Prevented

- Batch commit contains broken code
- Tests pass but E2E fails in production
- Previous stable state lost

### Implementation

#### Step 8a: Staged Git History

```bash
# Maintain clean git history at checkpoints

# Before parallel work starts
git stash  # Clean working directory
git tag "batch-start-2025-12-05-session1"
git commit --allow-empty -m "Checkpoint: Before parallel TODO resolution (15 TODOs)"

# After each agent completes a group
git commit -m "Checkpoint: Group A verification complete (9 TODOs verified)"

# Before final batch commit
git tag "batch-ready-2025-12-05-session1"
```

#### Step 8b: Automatic Rollback Script

```bash
#!/bin/bash
# automatic-rollback.sh

if [ "$1" == "detect-failure" ]; then
  # Run quality gates
  npm test || exit 1
  npm run typecheck || exit 1
  npm run test:e2e || exit 1

  if [ $? -ne 0 ]; then
    echo "CRITICAL FAILURE DETECTED - Rolling back"
    git reset --hard batch-ready-2025-12-05-session1
    exit 1
  fi
elif [ "$1" == "rollback" ]; then
  git reset --hard batch-start-2025-12-05-session1
  echo "✅ Rolled back to pre-parallel state"
  echo "Checkpoint tags: $(git tag -l | grep batch)"
fi
```

**Usage:**

```bash
# After final commit, run detection
./automatic-rollback.sh detect-failure

# If failure, manual rollback
./automatic-rollback.sh rollback
```

### Success Criteria

- ✅ Stable checkpoint exists before parallel work
- ✅ Failed batch can rollback in < 1 minute
- ✅ No permanent damage from batch commit failures
- ✅ Previous stable state always recoverable

---

## Prevention Strategy 9: Post-Session Lessons & Iteration

### Problem Being Prevented

- Same mistakes repeated in next session
- Ineffective patterns not improved
- Learning from one batch doesn't apply to next
- Prevention strategies themselves become stale

### Implementation

#### Step 9a: Post-Session Retrospective

```markdown
# Post-Session Retrospective: 2025-12-05-session1

## What Went Well

- [ ] Parallel verification saved ~4 hours
- [ ] Evidence freshness check prevented false closures
- [ ] Zero merge conflicts with smart export strategy
- [ ] Quality gates caught issues before final commit

## What Could Be Better

- [ ] Effort estimates for quick wins were off by 10 min
- [ ] One agent didn't follow file lock strategy
- [ ] Documentation could be more concise
- [ ] Blocker communication delayed once

## Lessons for Next Session

1. Add 5-minute buffer to quick win estimates
2. Enforce file lock checklist in agent onboarding
3. Simplify evidence documentation template
4. Implement automatic blocker escalation timeout

## Metrics for Next Session

- Target parallel time: 85 minutes (down from 90)
- Target blocker occurrences: 0
- Target file lock violations: 0
- Target stale evidence: 0
```

#### Step 9b: Continuous Improvement Loop

```bash
# After each batch, update prevention strategies
function update_prevention_strategies() {
  BATCH_ID=$1
  RETRO_FILE="docs/retrospectives/batch-${BATCH_ID}-retro.md"

  if [ -f "$RETRO_FILE" ]; then
    # Extract lessons
    lessons=$(grep "## Lessons for Next Session" "$RETRO_FILE" -A 10)

    # Update CLAUDE.md with new patterns
    # Update todo resolution scripts with new validations
    # Update file lock strategy if needed
    # Update quality gate scripts if new issues found

    echo "✅ Lessons integrated into prevention strategies"
  fi
}
```

#### Step 9c: Strategy Revision Trigger

```yaml
# Trigger revision of prevention strategies when:
revision_triggers:
  - 3+ batches with same type of failure
  - Agent feedback indicates strategy is too complex
  - New tool/framework makes strategy obsolete
  - Major workflow change (parallel → sequential or vice versa)

review_schedule:
  - Monthly: High-level strategy effectiveness
  - Quarterly: Deep dive into failure patterns
  - Annually: Complete strategy overhaul
```

### Success Criteria

- ✅ Post-session retrospective completed
- ✅ Lessons documented for next session
- ✅ Prevention strategies updated based on learnings
- ✅ No repeated mistakes across batches

---

## Quick Reference Checklist

### Before Starting Parallel Work

- [ ] Dependency analysis complete (mermaid diagram created)
- [ ] Circular dependency check passed
- [ ] All TODOs verified (evidence paths validated)
- [ ] Evidence freshness confirmed (re-validated in current git state)
- [ ] Critical path identified and sequential order confirmed
- [ ] File locks assigned (no shared file conflicts)
- [ ] Agent status channel created (.claude/agent-status-log.yaml)
- [ ] Rollback checkpoint tagged in git

### During Parallel Work

- [ ] Agent status log updated every 10 minutes
- [ ] Shared file declarations made before edits
- [ ] Blockers reported immediately (escalated to log)
- [ ] No duplicate work (centralized TODO tracking)
- [ ] File lock strategy respected
- [ ] No modifications to package.json

### Before Final Commit

- [ ] All agents mark their TODOs complete
- [ ] Evidence freshness re-validated (git state may have changed)
- [ ] Evidence validation script passed
- [ ] Pre-commit quality gates passed (tests, typecheck, lint, build)
- [ ] Test coverage maintained or improved
- [ ] No merge conflicts
- [ ] Batch resolution log complete
- [ ] Code review checklist signed off

### After Final Commit

- [ ] Stable state tagged in git
- [ ] Metrics recorded in batch history
- [ ] Post-session retrospective completed
- [ ] Lessons integrated into next session plan
- [ ] Prevention strategies updated if needed

---

## Summary

Parallel TODO resolution can save 3-6 hours per session but requires rigorous prevention strategies:

| Strategy                       | Purpose                              | Time to Implement | Value                                |
| ------------------------------ | ------------------------------------ | ----------------- | ------------------------------------ |
| 1. Dependency Analysis         | Prevent cascading failures           | 15 min            | Prevents 2-3 hours of debugging      |
| 2. Pre-Resolution Verification | Validate evidence freshness          | 10 min            | Prevents false closures              |
| 3. Merge Conflict Avoidance    | Prevent file conflicts               | 5 min             | Prevents 10-20 min manual resolution |
| 4. Quality Gates               | Catch integration issues             | 5 min             | Prevents regression failures         |
| 5. Documentation & Audit Trail | Enable code review & future sessions | 10 min            | Enables 80% faster PR review         |
| 6. Health Checks               | Prevent TODO accumulation            | 3 min/week        | Prevents "death by a thousand TODOs" |
| 7. Agent Communication         | Prevent duplicate work               | 2 min startup     | Prevents duplicate resolution        |
| 8. Automatic Rollback          | Emergency failure recovery           | 2 min setup       | Prevents permanent damage            |
| 9. Post-Session Iteration      | Improve process continuously         | 20 min            | 10-15% faster each session           |

**Total investment: ~70 minutes to set up, ~15 minutes per session to run**
**Return: 3-6 hours saved per session, improved reliability, better code review experience**

Apply all 9 strategies together to maintain quality while achieving parallel speed.

---

## Related Documentation

- `docs/solutions/workflow/TODO-PARALLEL-RESOLUTION-PATTERN.md` - Core parallel workflow
- `docs/solutions/TODO-RESOLUTION-SESSION-PATTERNS.md` - Detailed session patterns
- `docs/solutions/TODO-STALENESS-PREVENTION.md` - Prevent stale TODO creation
- `docs/solutions/TODO-RESOLUTION-QUICK-REFERENCE.md` - Daily reference guide
- `CLAUDE.md` - Project-wide standards and procedures

---

**Document Created:** 2025-12-23
**Version:** 1.0
**Status:** Active
**Next Review:** 2026-01-23 (monthly)
