# P2/P3 Prevention - Implementation Guide

**Timeline:** Can be implemented incrementally (each issue independently)
**Effort:** 4-6 hours total setup + ongoing enforcement
**Expected ROI:** Prevents recurring issues, catches bugs early

---

## Phase 1: Code Review Checklists (30 min)

**Goal:** Immediate human-in-the-loop prevention

### Step 1: Print the Quick Reference

Print [P2_P3_REMEDIATION_QUICK_REFERENCE.md](./P2_P3_REMEDIATION_QUICK_REFERENCE.md) and post in Slack/wiki.

### Step 2: Update PR template

**File:** `.github/pull_request_template.md`

Add this section:

```markdown
## P2/P3 Prevention Checklist

- [ ] **Validation:** All POST/PUT endpoints have Zod schemas
- [ ] **Test Coverage:** New functions have tests (>80% coverage)
- [ ] **Env Variables:** No `process.env` reads at module scope
- [ ] **Mocking:** Tests use `createMockPrisma()` helper
- [ ] **Indexes:** Complex queries have `// Uses index:` comments

For details, see [P2/P3 Prevention Guide](docs/solutions/patterns/P2_P3_REMEDIATION_PREVENTION_STRATEGIES.md)
```

### Step 3: Add code review instructions

In your team wiki or CONTRIBUTING.md:

```markdown
### P2/P3 Prevention Review

When reviewing PRs, check for these issues (commit 0ce7eac1 fixed these):

1. **Missing Validation (Issue #612):** Check that inputs have Zod schemas
2. **Test Gaps (Issue #613):** Verify coverage >80% for modified files
3. **Env Load-Time (Issue #614):** No process.env at module scope
4. **Mock Inconsistency (Issue #615):** Tests use createMockPrisma()
5. **Missing Indexes (Issue #616):** Complex queries documented

See [Detailed Prevention Guide](docs/solutions/patterns/P2_P3_REMEDIATION_PREVENTION_STRATEGIES.md)
```

---

## Phase 2: ESLint Rules (1 hour)

**Goal:** Automated detection during development

### Step 1: Copy rule files

Copy the 5 rule files from [P2_P3_ESLINT_RULES.md](./P2_P3_ESLINT_RULES.md) to:

```
scripts/eslint-rules/
  ├── no-module-scope-env.js
  ├── require-zod-validation.js
  ├── require-mock-helper.js
  ├── require-index-comment.js
  └── require-test-file.js
```

### Step 2: Update .eslintrc.json

```json
{
  "extends": ["eslint:recommended"],
  "overrides": [
    {
      "files": ["src/**/*.ts", "test/**/*.test.ts"],
      "rules": {
        "no-module-scope-env": "error",
        "require-zod-validation": "warn",
        "require-mock-helper": "error",
        "require-index-comment": "warn",
        "require-test-file": "warn"
      }
    }
  ]
}
```

### Step 3: Test the rules

```bash
npm run lint
```

You should see warnings for any code that violates the rules.

### Step 4: Fix existing violations

```bash
npm run lint -- --max-warnings 0
```

This will report all violations. Address each one:

```typescript
// BEFORE: Module-level env
const API_KEY = process.env.API_KEY;

// AFTER: Function-level env
function getApiKey() {
  return process.env.API_KEY;
}
```

---

## Phase 3: Test Patterns (1-2 hours)

**Goal:** Ensure new tests follow prevention patterns

### Step 1: Update test setup helpers

Copy `test/helpers/mock-prisma.ts` patterns from this repo. Ensure all tests import from helpers:

```typescript
// test/agent-eval/pipeline.test.ts
import { createMockPrisma, type DeepMockProxy } from '../helpers/mock-prisma';

let mockPrisma: DeepMockProxy<PrismaClient>;

beforeEach(() => {
  mockPrisma = createMockPrisma();
});
```

### Step 2: Create test coverage baseline

```bash
npm run test:coverage
```

Set a minimum threshold:

```json
// package.json
{
  "jest": {
    "collectCoverageFrom": ["src/**/*.ts"],
    "coverageThresholds": {
      "global": {
        "branches": 75,
        "functions": 75,
        "lines": 75,
        "statements": 75
      }
    }
  }
}
```

### Step 3: Add coverage check to CI

**.github/workflows/test.yml**

```yaml
- name: Check coverage thresholds
  run: npm run test:coverage -- --coverage-threshold=75
```

---

## Phase 4: Database Index Documentation (30 min)

**Goal:** Prevent missing indexes on new queries

### Step 1: Document all indexes in schema

**server/prisma/schema.prisma**

Add comments for all indexes:

```prisma
model AgentProposal {
  // ... fields ...

  // INDEXES - Keep in sync with actual queries!
  // Used by: cleanup.ts drainCompleted() - status=EXPIRED + expiresAt < now
  @@index([expiresAt])
  @@index([status, expiresAt])

  // Used by: cleanup.ts findOrphanedProposals() - status=CONFIRMED + updatedAt < cutoff
  // P3-616: Added for orphan recovery performance
  @@index([status, updatedAt])

  // Used by: all tenant-scoped queries (CRITICAL)
  @@index([tenantId])

  // Used by: customer chat queries
  @@index([customerId])
}
```

### Step 2: Create a query/index mapping document

**docs/database/QUERY_INDEX_MAPPING.md**

```markdown
# Query to Index Mapping

## AgentProposal

| Query                | File           | Where Clause       | Index               |
| -------------------- | -------------- | ------------------ | ------------------- |
| drainCompleted       | cleanup.ts:185 | status + expiresAt | [status, expiresAt] |
| orphanedProposals    | cleanup.ts:200 | status + updatedAt | [status, updatedAt] |
| byTenant (all)       | various        | tenantId           | [tenantId]          |
| getCustomerProposals | chat.ts        | customerId         | [customerId]        |
```

### Step 3: When adding new queries

1. Add the query to the mapping
2. Add index comment in schema
3. Create migration: `npm exec prisma migrate dev --name add_index_name`
4. Verify with EXPLAIN ANALYZE
5. Add integration test

---

## Phase 5: GitHub Actions Integration (30 min)

**Goal:** Automated prevention in CI/CD

### Step 1: Create P2/P3 prevention workflow

**.github/workflows/p2-p3-prevention.yml**

```yaml
name: P2/P3 Prevention Checks

on: [pull_request]

jobs:
  validation:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '20'

      - run: npm ci

      # Check: No module-level env
      - name: Check env variable usage
        run: |
          npx eslint . --rule 'no-module-scope-env: error'

      # Check: Test coverage
      - name: Check test coverage
        run: npm run test:coverage -- --coverage-threshold=75

      # Check: Zod validation
      - name: Check input validation schemas
        run: |
          npx eslint . --rule 'require-zod-validation: warn'

      # Check: Mock consistency
      - name: Check mock patterns
        run: |
          npx eslint . --rule 'require-mock-helper: error'

      # Check: Index documentation
      - name: Check index documentation
        run: |
          npx eslint . --rule 'require-index-comment: warn'

  comment:
    runs-on: ubuntu-latest
    needs: validation
    if: failure()
    steps:
      - uses: actions/github-script@v7
        with:
          script: |
            github.rest.issues.createComment({
              issue_number: context.issue.number,
              owner: context.repo.owner,
              repo: context.repo.repo,
              body: '⚠️ P2/P3 prevention checks failed.\n\n' +
                    'See [Prevention Guide](docs/solutions/patterns/P2_P3_REMEDIATION_PREVENTION_STRATEGIES.md) and ' +
                    '[Quick Reference](docs/solutions/patterns/P2_P3_REMEDIATION_QUICK_REFERENCE.md)'
            })
```

### Step 2: Required status checks

Go to GitHub repo settings → Branches → Branch protection rules:

Add required status checks:

- `P2/P3 Prevention Checks`
- Existing test/lint checks

---

## Phase 6: Team Onboarding (ongoing)

### Step 1: Share documentation

Share these files with your team:

1. **Quick Reference** (print-friendly): `P2_P3_REMEDIATION_QUICK_REFERENCE.md`
2. **Full Guide** (detailed): `P2_P3_REMEDIATION_PREVENTION_STRATEGIES.md`
3. **ESLint Rules** (technical): `P2_P3_ESLINT_RULES.md`

### Step 2: Example PRs

Create example PRs showing correct patterns:

**Example: Validation**

```typescript
// reviews/example-validation-pr.md

## Example: Adding Input Validation

The ReviewSubmissionSchema (Issue #612) shows the right pattern:

1. Define Zod schema with constraints
2. Infer TypeScript type from schema
3. Use schema in route handler
4. Test boundary cases
```

**Example: Tests**

```typescript
// reviews/example-test-pr.md

## Example: Test Coverage

The pipeline.test.ts file (Issue #613) shows:

1. Use createMockPrisma() helper
2. Test all branches
3. Test error paths
4. Test boundary conditions
```

### Step 3: Regular reminders

In your weekly standup or Slack:

```
🛡️ P2/P3 Prevention Reminder

This week's focus: Validation (Issue #612)
Make sure new POST/PUT endpoints have Zod schemas!

See: docs/solutions/patterns/P2_P3_REMEDIATION_QUICK_REFERENCE.md
```

---

## Implementation Timeline

```
Week 1:
  Day 1-2: Phase 1 (Code review checklists) - 30 min
  Day 3-4: Phase 2 (ESLint rules) - 1 hour
           Fix existing violations

Week 2:
  Day 1-2: Phase 3 (Test patterns) - 1-2 hours
  Day 3-4: Phase 4 (Index documentation) - 30 min
  Day 5: Phase 5 (CI/CD integration) - 30 min

Week 3:
  Day 1-5: Phase 6 (Team onboarding)
           - Share docs
           - Example PRs
           - Slack reminders
           - Train team on patterns

Ongoing:
  - Monitor PR violations via GitHub Actions
  - Adjust rule severity based on team feedback
  - Update documentation with new learnings
```

---

## Measuring Success

Track these metrics:

### Before Prevention Implementation

```
npm run test:coverage
# Example output: Statements: 75% | Branches: 60% | Lines: 75%

npx eslint . --rule 'no-module-scope-env: error'
# Example output: 12 violations found
```

### After Prevention Implementation

```
npm run test:coverage
# Expected: Statements: >85% | Branches: >75% | Lines: >85%

npx eslint . --rule 'no-module-scope-env: error'
# Expected: 0 violations (all fixed)

# Fewer P2/P3-type bugs in code reviews
# Faster review cycles
# Fewer production issues from these categories
```

### KPIs to Track

| Metric                   | Target      | Frequency |
| ------------------------ | ----------- | --------- |
| Test coverage (%)        | >85         | Per PR    |
| Linting violations       | 0           | Per PR    |
| Code review time (hours) | <2          | Per PR    |
| P2/P3-type bugs filed    | 0 per month | Monthly   |
| Team compliance          | >95%        | Weekly    |

---

## Troubleshooting

### Issue: Too many ESLint violations

**Solution:** Implement in phases, disable rules initially:

```json
{
  "rules": {
    "no-module-scope-env": "warn", // Phase 1: warn
    "require-zod-validation": "warn", // Phase 2: warn
    "require-mock-helper": "warn", // Phase 2: warn
    "require-index-comment": "off", // Phase 3: off
    "require-test-file": "warn" // Phase 3: warn
  }
}
```

Then upgrade to "error" as you fix violations.

### Issue: Test coverage not increasing

**Solution:** Add specific test patterns:

```bash
# Generate coverage report with uncovered lines
npm run test:coverage -- --reporter=coverage-report

# Find untested functions
grep -r "export" src/ | grep -v ".test.ts" | while read line; do
  func=$(echo $line | cut -d: -f2-)
  if ! grep -q "$func" test/; then
    echo "Untested: $func"
  fi
done
```

### Issue: Mock tests still failing

**Solution:** Verify $transaction configuration:

```typescript
// Ensure this is in createMockPrisma():
mock.$transaction.mockImplementation(async (callback) => {
  if (typeof callback === 'function') {
    return callback(mock as unknown as Parameters<typeof callback>[0]);
  }
  return [];
});
```

---

## Advanced: Customizing Rules

### Adjust rule severity per file type

```json
{
  "overrides": [
    {
      "files": ["src/routes/**/*.ts"],
      "rules": {
        "require-zod-validation": "error" // Stricter for routes
      }
    },
    {
      "files": ["test/**/*.ts"],
      "rules": {
        "no-module-scope-env": "off", // Less strict for tests
        "require-mock-helper": "error"
      }
    }
  ]
}
```

### Add custom rules for your team

After implementing these 5 rules, add more based on your findings:

```javascript
// scripts/eslint-rules/no-string-status.js
// Prevent using string literals for status instead of enums
// "status = 'PENDING'" → "status = ProposalStatus.PENDING"

module.exports = {
  meta: { type: 'problem' },
  create(context) {
    return {
      Literal(node) {
        // Check for literal strings used as status
        if (
          typeof node.value === 'string' &&
          ['PENDING', 'CONFIRMED', 'EXECUTED'].includes(node.value)
        ) {
          context.report({
            node,
            message: `Use enum constant instead of string literal: '${node.value}'`,
          });
        }
      },
    };
  },
};
```

---

## Migration Path for Existing Code

### Large codebases with many violations

**Strategy:** Implement prevention incrementally

```
Phase 1: New code only (rules in "warn" mode)
Phase 2: New code + critical modules (upgrade to "error")
Phase 3: All code (strict enforcement)

Timeline: 2-4 weeks depending on codebase size
```

**Workflow:**

```bash
# Week 1: Baseline
npm run lint -- --rule 'no-module-scope-env: warn' --report-unused-disable-directives

# Week 2: Fix violations in new code
# Update rules to "error" for src/ (not legacy/)

# Week 3: Fix violations in critical modules
# Focus on high-impact areas

# Week 4: Full enforcement
# Enable rules for entire codebase
```

---

## Resources

- [Full Prevention Guide](./P2_P3_REMEDIATION_PREVENTION_STRATEGIES.md) - Detailed strategies with code examples
- [Quick Reference](./P2_P3_REMEDIATION_QUICK_REFERENCE.md) - Print-friendly checklist
- [ESLint Rules](./P2_P3_ESLINT_RULES.md) - Complete rule implementations
- [Original Commit](https://github.com/your-repo/commit/0ce7eac1) - See actual fixes

---

## Questions?

For implementation help:

1. Check [Troubleshooting](#troubleshooting) section
2. Review [P2_P3_REMEDIATION_PREVENTION_STRATEGIES.md](./P2_P3_REMEDIATION_PREVENTION_STRATEGIES.md) for detailed patterns
3. Look at example code in [P2_P3_REMEDIATION_QUICK_REFERENCE.md](./P2_P3_REMEDIATION_QUICK_REFERENCE.md)
4. Run `npm run lint -- --help` to understand ESLint options

---

## Next Steps

1. **Immediate:** Print and post the Quick Reference
2. **Today:** Update your PR template
3. **This week:** Implement Phase 1-3 (checklists, ESLint, test patterns)
4. **Next week:** Add CI/CD integration and team onboarding
5. **Ongoing:** Monitor and refine based on team feedback

Good luck! You're preventing critical issues before they happen. 🎯
