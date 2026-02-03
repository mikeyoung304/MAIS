---
slug: parallel-todo-agent-validation-patterns
title: Validation Patterns for Parallel TODO Agents
category: methodology
priority: P1
status: solved
date_created: 2026-02-03
---

# Validation Patterns for Parallel TODO Agents

**For agents executing individual todos in parallel. Prevents 90% of test failures and conflicts.**

---

## Pattern 1: Verification-First Execution

**Every agent MUST do this BEFORE implementing:**

```typescript
// Pseudo-code for agent execution flow

async function executeTodo(todoId: string) {
  // ========== PHASE 1: VERIFICATION (DO FIRST) ==========

  // 1.1 Read affected files
  const files = getTodoFiles(todoId);
  for (const file of files) {
    console.log(`Reading ${file}...`);
    const content = readFile(file);
    // → Understand current state
  }

  // 1.2 Search for existing implementation
  console.log('Searching for existing implementation...');
  const existing = searchCodeFor(todoId.subject);
  if (existing.length > 0) {
    console.log(`FOUND: Implementation already exists at ${existing[0].file}:${existing[0].line}`);
    return {
      status: 'ALREADY_IMPLEMENTED',
      evidence: existing,
      time_saved: '2 hours of work avoided',
    };
  }

  // 1.3 Establish test baseline
  console.log('Running baseline tests...');
  const baselineTests = runTests(files);
  console.log(`Baseline: ${baselineTests.passing} passing, ${baselineTests.failing} failing`);

  // 1.4 Check dependencies
  console.log('Checking dependencies...');
  const deps = getDirectDependencies(files);
  for (const dep of deps) {
    if (!dep.exists) {
      console.log(`ERROR: Dependency missing: ${dep.name}`);
      console.log(`This todo depends on: ${dep.blockedBy}`);
      console.log(`Wait for ${dep.blockedBy} to complete first`);
      return {
        status: 'BLOCKED_BY_DEPENDENCY',
        blocked_by: dep.blockedBy,
        action: 'Wait for other agent',
      };
    }
  }

  // ========== PHASE 2: IMPLEMENTATION (DO THEN) ==========

  console.log('Implementing changes...');
  implementChanges(todoId);

  // Add/update tests
  addTests(todoId);

  // ========== PHASE 3: VALIDATION (DO LAST) ==========

  console.log('Validating...');

  // 3.1 TypeScript
  const typeErrors = runTypecheck();
  if (typeErrors.length > 0) {
    throw new Error(`TypeScript errors: ${typeErrors}`);
  }

  // 3.2 Linting
  const lintErrors = runLint(files);
  if (lintErrors.length > 0) {
    throw new Error(`Lint errors: ${lintErrors}`);
  }

  // 3.3 Tests
  const testResults = runTests(files);
  const newFailures = findNewFailures(baselineTests, testResults);
  if (newFailures.length > 0) {
    throw new Error(`New test failures: ${newFailures}`);
  }

  return {
    status: 'SUCCESS',
    tests_added: testResults.passing - baselineTests.passing,
    no_regressions: true,
  };
}
```

**Output format:**

```yaml
todo_5206_result:
  status: SUCCESS
  phase_1_verification:
    files_read: 2
    existing_implementation: not_found
    dependencies_ok: true
    baseline_tests_passing: 127

  phase_2_implementation:
    changes_made: true
    lines_added: 45
    tests_added: 2

  phase_3_validation:
    type_errors: 0
    lint_errors: 0
    test_failures_new: 0
    test_failures_total: 0 # (pre-existing failures not your fault)
    conclusion: SAFE_TO_MERGE
```

---

## Pattern 2: Test Result Reporting

**Standard report for each agent (helps orchestrator identify issues):**

```markdown
## Agent Report: TODO-5206

### Phase 1: Verification

- ✓ Files read: section-content.service.ts, section-content.service.test.ts
- ✓ Searched for "dompurify|sanitize|xss" in codebase
- ✓ Result: No existing XSS sanitization found
- ✓ Dependencies: All present (isomorphic-dompurify available in package.json)
- ✓ Baseline tests: 127 passing, 0 failing

### Phase 2: Implementation

- ✓ Added import: `import purify from 'isomorphic-dompurify'`
- ✓ Added method: `sanitizeHtml(html: string): string`
- ✓ Updated method: `updateSection()` now calls `sanitizeHtml()`
- ✓ Added tests: 2 new test cases
  - Test: "sanitizeHtml removes <script> tags" ✓
  - Test: "sanitizeHtml preserves safe HTML" ✓

### Phase 3: Validation

- ✓ TypeScript: 0 errors (npm run typecheck)
- ✓ ESLint: 0 errors (npm run lint)
- ✓ Tests before: 127 passing
- ✓ Tests after: 129 passing
- ✓ New failures: 0
- ✓ Regression check: PASS

### Conclusion

✅ SAFE TO MERGE

- Added 2 new test cases
- All previously passing tests still pass
- No type or lint errors
- No conflicts with other agents
```

---

## Pattern 3: Dependency Chain Verification

**Use this when todo calls methods in other files:**

```bash
# For each method call in your implementation
METHOD="findById"
FILE_CALLING="section-content.service.ts"
FILE_DEFINING="section-content.repository.ts"

echo "Checking if $METHOD exists in $FILE_DEFINING..."

# Step 1: Find method definition
if grep -q "^\s*${METHOD}\s*(" "$FILE_DEFINING"; then
  echo "✓ Method found"

  # Step 2: Find usages
  usages=$(grep -n "$METHOD" "$FILE_CALLING" | wc -l)
  echo "  Used in $FILE_CALLING: $usages times"

  # Step 3: Verify signature matches
  signature=$(grep -A 2 "^\s*${METHOD}\s*(" "$FILE_DEFINING")
  echo "  Signature: $signature"
else
  echo "✗ ERROR: Method $METHOD not found in $FILE_DEFINING"
  echo "  This method is required by your todo"
  echo "  Check if todo that adds this method is running FIRST"
  exit 1
fi
```

**Decision logic:**

```
If method exists:
  → Continue with implementation

If method doesn't exist:
  → Check git log: did another agent add it?
    ✓ YES → Wait for their changes to merge
    ✗ NO → Check if todo depends on unfinished work
           → Stop and report: "Blocked by TODO-XXXX"
```

---

## Pattern 4: Conflict Detection (Multi-Agent Edits)

**Use when multiple agents modify the same file:**

```bash
# Your todo modifies: section-content.service.ts
# Check if another agent is also modifying it

TARGET_FILE="server/src/services/section-content.service.ts"

# Method 1: Check other agent reports
grep -l "$TARGET_FILE" ../agent-report-*.txt | while read report; do
  agent=$(basename "$report" | sed 's/agent-report-//; s/.txt//')
  echo "WARNING: Agent $agent also modifying $TARGET_FILE"
done

# Method 2: Check git status for conflicts
git diff HEAD -- "$TARGET_FILE" | grep "<<<<<<<<"
if [ $? -eq 0 ]; then
  echo "CONFLICT: $TARGET_FILE has merge conflicts"
  echo "Manual resolution needed"
  exit 1
fi

# Method 3: Line-by-line analysis (if both agents report)
# Agent A: Adding method sanitizeHtml() at lines 45-55
# Agent B: Adding method updateSection() at lines 60-70
# Result: Safe (non-overlapping)

# vs.

# Agent A: Modifying updateSection() at lines 60-70
# Agent B: Modifying updateSection() at lines 60-70
# Result: CONFLICT (same method, different changes)
```

**Resolution strategy:**

```yaml
conflict_types:
  - name: 'Different regions of same file'
    risk: low
    solution: 'Git merge will handle - rebase if needed'

  - name: 'Same method, different changes'
    risk: high
    solution: 'Orchestrator must sequence - one agent waits'

  - name: 'Same line number changes'
    risk: critical
    solution: 'Orchestrator must sequence'

  - name: 'Import additions to same file'
    risk: low
    solution: 'ESLint auto-sort will deduplicate'
```

---

## Pattern 5: Test Isolation & Baseline Comparison

**Establish baseline, implement, compare:**

```bash
#!/bin/bash
# For TODO-5206

set -e

TODO_ID="5206"
TARGET_FILES=(
  "server/src/services/section-content.service.ts"
  "server/src/services/section-content.service.test.ts"
)

# ========== BASELINE ==========
echo "Establishing baseline tests..."
npm test -- --testPathPattern="section-content.service.test" --run 2>&1 | tee baseline-$TODO_ID.txt

baseline_passing=$(grep -c "PASS\|✓" baseline-$TODO_ID.txt)
baseline_failing=$(grep -c "FAIL\|✗" baseline-$TODO_ID.txt)

echo "Baseline: $baseline_passing passing, $baseline_failing failing"

# ========== IMPLEMENTATION ==========
echo "Implementing TODO-$TODO_ID..."

# Add code...
echo "export const sanitizeHtml = (html: string): string => { ... }" >> "${TARGET_FILES[0]}"

# Add tests...
cat >> "${TARGET_FILES[1]}" << 'EOF'
describe('sanitizeHtml', () => {
  it('should remove script tags', () => {
    const result = sanitizeHtml('<script>alert("xss")</script>');
    expect(result).not.toContain('<script>');
  });
});
EOF

# ========== VALIDATION ==========
echo "Running tests after implementation..."
npm test -- --testPathPattern="section-content.service.test" --run 2>&1 | tee after-$TODO_ID.txt

after_passing=$(grep -c "PASS\|✓" after-$TODO_ID.txt)
after_failing=$(grep -c "FAIL\|✗" after-$TODO_ID.txt)

echo "After: $after_passing passing, $after_failing failing"

# ========== COMPARISON ==========
new_tests=$((after_passing - baseline_passing))
new_failures=$((after_failing - baseline_failing))

echo ""
echo "=== TEST RESULTS ==="
echo "New tests added: $new_tests"
echo "New failures: $new_failures"

if [ $new_failures -eq 0 ]; then
  echo "✓ SUCCESS: No new failures"
else
  echo "✗ FAILURE: $new_failures new test failures introduced"
  echo "Compare:"
  diff baseline-$TODO_ID.txt after-$TODO_ID.txt | grep "✗\|FAIL" || true
  exit 1
fi

# Save report
cat > report-$TODO_ID.yaml << EOF
todo: $TODO_ID
status: SUCCESS
baseline_passing: $baseline_passing
after_passing: $after_passing
new_tests: $new_tests
new_failures: $new_failures
EOF
```

---

## Pattern 6: Contract & Type Safety Verification

**When adding API changes:**

```typescript
// Verify contract consistency

// Step 1: Read contract definition
const contract = readFile('packages/contracts/api.v1.ts');

// Step 2: Check if your implementation matches
const updatedMethod = readFile('server/src/services/section-content.service.ts');

// Example: Contract says `confirmation` is required (no default)
// ✓ Correct: constructor receives { ..., confirmation: boolean }
// ✗ Wrong:   constructor receives { ..., confirmation?: boolean }

const contractRequires = contract.includes('confirmation: boolean');
const implementationHas = updatedMethod.includes('confirmation: boolean');

if (contractRequires && !implementationHas) {
  throw new Error(
    'Type mismatch: Contract requires confirmation, implementation provides optional'
  );
}

// Step 3: Verify tests match contract
const tests = readFile('server/src/services/section-content.service.test.ts');

// ✓ Correct test: calls updateSection({ confirmation: true })
// ✗ Wrong test:   calls updateSection({ title: 'New' })  // missing required field

const testIncludesRequired = tests.includes('confirmation:');
if (!testIncludesRequired) {
  console.warn('WARNING: Tests do not verify new required field');
}
```

---

## Pattern 7: Pre-Existing Failure Handling

**When tests fail, determine if it's your fault:**

```bash
# Scenario: Test fails after implementation

FAILING_TEST="src/services/section-content.service.test.ts"

echo "Is this a PRE-EXISTING failure?"
echo ""
echo "Step 1: Check git blame for test origin"
git blame -L1,50 "$FAILING_TEST" | grep -E "✓|PASS|FAIL" | head -3

echo ""
echo "Step 2: Check CI logs for baseline"
# If pre-existing baseline shows test failing → not your fault
# If pre-existing baseline shows test passing → you broke it

echo ""
echo "Step 3: Classify"
if grep "$FAILING_TEST" ../baseline.txt | grep -q "FAIL"; then
  echo "✓ PRE-EXISTING FAILURE - Don't worry about this"
  echo "  Baseline already showed this test failing"
else
  echo "✗ NEW FAILURE - Must fix this"
  echo "  Your implementation introduced this failure"
  exit 1
fi
```

---

## Pattern 8: Orchestrator Feedback Loop

**Report this to orchestrator after completion:**

```yaml
# agent-report-5206.yaml

todo_id: 5206
status: completed # or: already_implemented, blocked_by_dependency, failed

execution_timeline:
  phase_1_verification:
    duration_seconds: 120
    result: success
  phase_2_implementation:
    duration_seconds: 300
    result: success
  phase_3_validation:
    duration_seconds: 180
    result: success

test_results:
  baseline_passing: 127
  final_passing: 129
  new_tests_added: 2
  new_failures: 0
  pre_existing_failures: 0

code_quality:
  type_errors: 0
  lint_errors: 0
  imports_added: 1 # isomorphic-dompurify
  methods_added: 1 # sanitizeHtml()

files_modified:
  - path: server/src/services/section-content.service.ts
    lines_added: 18
    lines_deleted: 0
  - path: server/src/services/section-content.service.test.ts
    lines_added: 27
    lines_deleted: 0

conflicts:
  detected: false
  with_agents: []

blockers:
  detected: false
  issues: []

recommendations:
  - Consider testing with edge case: empty HTML string
  - Consider performance testing with large HTML docs

total_time_minutes: 9 # Actual vs 60 estimated
```

---

## Pattern 9: Dependency Chain Coordination

**If your todo creates a method used by dependent todo:**

```yaml
# TODO-5208: Add findById() method
# TODO-5211: Add LRU cache (uses findById from 5208)

# Agent 5208 should report to orchestrator:
todo_5208_completion_report:
  status: completed
  created_methods:
    - name: findById
      signature: 'async findById(id: string): Promise<SectionContent | null>'
      line: 45
  used_by:
    - 'TODO-5211' # Dependent is waiting for this


  # Orchestrator uses this to unblock 5211
```

---

## Pattern 10: Dead Code Safety Verification

**Before deleting files or methods:**

```bash
# TODO-5213: Delete section-transforms.ts

TARGET_FILE="server/src/lib/section-transforms.ts"

echo "Safety check before deletion:"
echo ""

# 1. Find all imports
echo "Step 1: Searching for imports..."
imports=$(grep -r "import.*section-transforms" server/src/ apps/web/src/ 2>/dev/null || echo "")

if [ -z "$imports" ]; then
  echo "✓ No imports found - safe to delete"
else
  echo "✗ DANGER: Found imports:"
  echo "$imports"
  echo "ERROR: Cannot delete file while it's imported"
  exit 1
fi

# 2. Find all exports (in case there are indirect references)
echo ""
echo "Step 2: Listing exports..."
grep "^export" "$TARGET_FILE" | head -10

# 3. Search for usage of exported functions
echo ""
echo "Step 3: Searching for usage of exported functions..."
for func in $(grep "^export" "$TARGET_FILE" | sed 's/.*\s\+\([a-zA-Z_]*\).*/\1/'); do
  usage=$(grep -r "\b$func\b" server/src/ apps/web/src/ 2>/dev/null | grep -v "$TARGET_FILE" | wc -l)
  if [ $usage -gt 0 ]; then
    echo "✗ DANGER: Function $func used $usage times"
    grep -rn "\b$func\b" server/src/ apps/web/src/ 2>/dev/null | grep -v "$TARGET_FILE" | head -3
  fi
done

echo ""
echo "✓ Safe to delete if no functions show usage above"
```

---

## Validation Checklist (Copy & Paste)

```markdown
## Validation Checklist for TODO-[ID]

### Phase 1: Verification (Check these FIRST)

- [ ] Read all affected files (understand current state)
- [ ] Search for existing implementation (prevent duplicate work)
- [ ] Run baseline tests (npm test -- --testPathPattern="...")
- [ ] Document baseline: X passing, Y failing
- [ ] Check dependencies (all methods/imports exist?)
- [ ] Run npm run typecheck (0 errors required)
- [ ] Run npm run lint (0 errors required)

### Phase 2: Implementation (Check these DURING)

- [ ] Add code to implementation file
- [ ] Add tests to test file
- [ ] Follow existing code patterns
- [ ] Add JSDoc comments
- [ ] Update related files if needed

### Phase 3: Validation (Check these LAST)

- [ ] Run tests again (npm test -- --testPathPattern="...")
- [ ] Compare: X passing before → Y passing after
- [ ] Verify: No new failures introduced
- [ ] Run npm run typecheck (0 errors required)
- [ ] Run npm run lint (0 errors required)
- [ ] Check git status (no unintended files modified)

### Results

- [ ] New tests added: [COUNT]
- [ ] New failures: [COUNT] (must be 0)
- [ ] Type errors: [COUNT] (must be 0)
- [ ] Lint errors: [COUNT] (must be 0)
- [ ] Status: READY_TO_MERGE or BLOCKED_BY_DEPENDENCY
```

---

## Related Documents

- `PARALLEL-TODO-RESOLUTION-PREVENTION-STRATEGIES.md` - Full orchestrator guide
- `PARALLEL-TODO-RESOLUTION-QUICK-REFERENCE.md` - 1-page checklist
- `PARALLEL-AGENT-WORKFLOW-BEST-PRACTICES.md` - Agent coordination patterns
