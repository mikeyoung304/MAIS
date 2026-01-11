---
module: MAIS
date: 2025-12-29
component: code-review-process
type: implementation-guide
related_docs:
  - MULTI-AGENT-CODE-REVIEW-PREVENTION-STRATEGIES-MAIS-20251229.md
  - MULTI-AGENT-CODE-REVIEW-QUICK-REFERENCE-MAIS-20251229.md
tags: [multi-agent-review, implementation, integration, ci-cd, quality-gates]
---

# Multi-Agent Code Review: Implementation Guide

How to integrate multi-agent code review into your development workflow.

---

## Phase 1: Setup (1 hour)

### Step 1.1: Add to PR Template

**File:** `.github/pull_request_template.md`

```markdown
## PR Description

<!-- Summarize your changes here -->

## Type of Change

- [ ] New feature
- [ ] Bug fix
- [ ] Refactor
- [ ] Documentation

## Special Notes

- [ ] Agent/chatbot feature (requires multi-agent review)
- [ ] Database schema change
- [ ] Security-sensitive code
- [ ] Performance-critical code

## Pre-submission Checklist

- [ ] `npx madge --circular --extensions ts server/src` passes
- [ ] `npm run typecheck` passes
- [ ] `npm test` passes
- [ ] `npm run lint` passes
- [ ] New tests added for new code
- [ ] Tenant isolation verified
- [ ] Error messages are generic (no ID/internal leakage)

## For Multi-Agent Review

If this PR involves agent features, request:
```

/workflows:review --agents architecture-strategist,security-sentinel,typescript-reviewer

```

---
```

### Step 1.2: Add Pre-commit Hook

**File:** `.husky/pre-commit`

```bash
#!/bin/sh
. "$(dirname "$0")/_/husky.sh"

# Check for circular dependencies in agent code
echo "Checking for circular dependencies..."
npx madge --circular --extensions ts server/src || {
  echo "❌ Circular dependencies detected"
  exit 1
}

# Run TypeScript check
echo "Type checking..."
npm run typecheck || {
  echo "❌ TypeScript errors found"
  exit 1
}

# Run lint
echo "Linting..."
npm run lint || {
  echo "❌ Lint errors found"
  exit 1
}

echo "✅ All pre-commit checks passed"
```

### Step 1.3: Configure ESLint for Quality Gates

**File:** `.eslintrc.cjs`

Add rules that prevent common anti-patterns:

```javascript
module.exports = {
  // ... existing config
  rules: {
    // No unused variables (prevents stale code)
    'no-unused-vars': ['error', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],

    // Prevent console.log (use logger instead)
    'no-console': 'error',

    // Prevent any types (type safety)
    '@typescript-eslint/no-explicit-any': [
      'warn',
      {
        fixToUnknown: false,
        ignoreRestArgs: false,
      },
    ],

    // Prevent circular complexity
    complexity: ['warn', 20],

    // Enforce imports organization
    'import/order': [
      'error',
      {
        groups: ['builtin', 'external', 'internal', 'parent', 'sibling', 'index'],
      },
    ],

    // Prevent async without error handling
    '@typescript-eslint/no-floating-promises': 'warn',
  },
};
```

### Step 1.4: Add Quality Gate Script

**File:** `scripts/quality-gate.sh`

```bash
#!/bin/bash
set -e

echo "🔍 Quality Gate Checks"
echo "====================="

# 1. Circular dependencies
echo "✓ Checking for circular dependencies..."
npx madge --circular --extensions ts server/src

# 2. TypeScript
echo "✓ Type checking..."
npm run typecheck

# 3. Lint
echo "✓ Linting..."
npm run lint

# 4. Tests
echo "✓ Running tests..."
npm test

# 5. Coverage
echo "✓ Checking coverage..."
npm run test:coverage

# 6. Build
echo "✓ Building..."
npm run build

echo ""
echo "✅ All quality gates passed!"
```

Make it executable:

```bash
chmod +x scripts/quality-gate.sh
```

---

## Phase 2: CI/CD Integration (1 hour)

### Step 2.1: Update GitHub Actions

**File:** `.github/workflows/main-pipeline.yml`

```yaml
name: Main Pipeline

on:
  push:
    branches: [main, develop]
  pull_request:
    branches: [main, develop]

jobs:
  quality-gates:
    runs-on: ubuntu-latest
    name: Quality Gates
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '20'

      # Circular dependencies
      - name: Check Circular Dependencies
        run: npx madge --circular --extensions ts server/src || exit 1

      # TypeScript
      - name: Type Check
        run: npm run typecheck

      # Lint
      - name: Lint
        run: npm run lint

      # Tests
      - name: Run Tests
        run: npm test

      # Coverage
      - name: Check Coverage
        run: npm run test:coverage

  build:
    runs-on: ubuntu-latest
    needs: quality-gates
    name: Build
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '20'

      - name: Build
        run: npm run build

  agent-specific-checks:
    runs-on: ubuntu-latest
    if: contains(github.event.pull_request.files, 'server/src/agent/')
    name: Agent PR Checks
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '20'

      # Verify executors registered
      - name: Verify Executors
        run: |
          echo "Checking executor registrations..."
          # Count registered executors
          REGISTERED=$(grep -c "registerProposalExecutor" server/src/agent/executors/index.ts || true)
          echo "Found $REGISTERED executor registrations"

      # Check tenant isolation in agent code
      - name: Verify Tenant Isolation
        run: |
          echo "Checking for tenant scoping in agent code..."
          # Find all database queries and verify tenantId filtering
          UNSCOPED=$(rg "findMany|findUnique|update|delete" server/src/agent --type ts -A 2 | grep -v "tenantId" | grep -c "where:" || true)
          if [ "$UNSCOPED" -gt 0 ]; then
            echo "❌ Found database queries without tenant scoping"
            exit 1
          fi
          echo "✅ All database queries are tenant-scoped"

      # Check error message safety
      - name: Check Error Messages
        run: |
          echo "Checking for information leakage in errors..."
          # Look for potential leakage patterns
          LEAKS=$(rg "throw new.*Error\(\`.*\$" server/src/agent --type ts | wc -l)
          if [ "$LEAKS" -gt 0 ]; then
            echo "⚠️  Found $LEAKS potential error message leaks - review manually"
          fi
```

### Step 2.2: Add Pre-submission Automation

**File:** `scripts/pre-submission-check.sh`

```bash
#!/bin/bash
set -e

echo "🚀 Pre-submission Quality Check"
echo "==============================="
echo ""

FAILED=0

# 1. Circular dependencies
echo "1️⃣  Checking circular dependencies..."
if ! npx madge --circular --extensions ts server/src 2>&1 | grep -q "No circular"; then
  echo "❌ Circular dependencies detected"
  FAILED=1
else
  echo "✅ No circular dependencies"
fi
echo ""

# 2. TypeScript
echo "2️⃣  Type checking..."
if ! npm run typecheck 2>&1 | tail -5 | grep -q "error TS"; then
  echo "✅ TypeScript clean"
else
  echo "❌ TypeScript errors"
  FAILED=1
fi
echo ""

# 3. Lint
echo "3️⃣  Linting..."
if npm run lint > /dev/null 2>&1; then
  echo "✅ No lint errors"
else
  echo "❌ Lint errors found"
  FAILED=1
fi
echo ""

# 4. Tests
echo "4️⃣  Running tests..."
if npm test 2>&1 | tail -10 | grep -q "passed"; then
  echo "✅ Tests passing"
else
  echo "❌ Tests failing"
  FAILED=1
fi
echo ""

# 5. Agent-specific checks (if agent files modified)
if git diff --name-only HEAD | grep -q "server/src/agent/"; then
  echo "5️⃣  Agent-specific checks..."

  # Check tenant isolation
  if rg "findMany|findUnique" server/src/agent --type ts -A 2 | grep -v "tenantId" | grep -q "where:"; then
    echo "❌ Found tenant scoping issues"
    FAILED=1
  else
    echo "✅ Tenant isolation verified"
  fi

  # Check executor registrations
  EXECUTORS=$(grep -c "registerProposalExecutor" server/src/agent/executors/index.ts || echo "0")
  echo "   Found $EXECUTORS executor registrations"
fi
echo ""

if [ $FAILED -eq 0 ]; then
  echo "✅ All checks passed - ready to submit!"
  exit 0
else
  echo "❌ Some checks failed - fix before submitting"
  exit 1
fi
```

---

## Phase 3: Developer Workflow (Ongoing)

### Step 3.1: Daily Development Checklist

Every day before pushing code:

```bash
# Run this command
./scripts/pre-submission-check.sh

# If all checks pass, continue with:
git push origin feature-branch

# Then request multi-agent review if needed
# (See Step 3.3 below)
```

### Step 3.2: Per-Commit Verification

After each commit:

```bash
# Test just your changes
npm test -- --changed

# Type check
npm run typecheck

# Lint your files
npm run lint server/src/agent/customer/your-file.ts
```

### Step 3.3: Request Multi-Agent Review

For agent/chatbot PRs, after opening PR:

```markdown
## Multi-Agent Review Request

This PR involves agent chatbot features. Requesting specialized review:
```

/workflows:review --agents architecture-strategist,security-sentinel,typescript-reviewer,performance-oracle

```

**Focus areas:**
- [ ] Circular dependencies
- [ ] Tenant isolation in execution path
- [ ] Error message safety
- [ ] Database performance (indexes, N+1 queries)
```

### Step 3.4: Code Review Synthesis

When you receive multi-agent feedback:

1. **Categorize by severity:**

   ```
   P1 (Blockers): Fix before merge
   P2 (Should Fix): Fix before merge (unless timeline constraint)
   P3 (Nice to Have): Consider for follow-up PR
   ```

2. **Create implementation tasks:**

   ```
   - [ ] Fix circular dependency in executor registry
   - [ ] Add composite index for tenant+date queries
   - [ ] Update error messages to use ErrorMessages enum
   - [ ] Add test for tenant isolation in recovery path
   ```

3. **Verify fixes:**

   ```bash
   # For each fix, run:
   ./scripts/pre-submission-check.sh

   # Then re-request specific agent review:
   /workflows:review --agents security-sentinel
   ```

---

## Phase 4: Ongoing Maintenance (Weekly)

### Step 4.1: Weekly Quality Report

**File:** `scripts/weekly-quality-report.sh`

```bash
#!/bin/bash

echo "📊 Weekly Quality Report"
echo "======================="
echo ""

# Circular dependencies trend
echo "Circular Dependencies:"
npx madge --circular --extensions ts server/src 2>&1 | grep -i "circular" || echo "✅ None"
echo ""

# Test coverage trend
echo "Test Coverage:"
npm run test:coverage 2>&1 | grep -E "Statements|Branches|Functions" | tail -4
echo ""

# Lint warnings trend
echo "ESLint Warnings:"
npm run lint 2>&1 | grep -E "warning|error" | wc -l
echo ""

# Build status
echo "Build Status:"
npm run build > /dev/null 2>&1 && echo "✅ Builds successfully" || echo "❌ Build failing"
echo ""

echo "Run this weekly to track quality trends"
```

### Step 4.2: Agent Feature Audit

**Monthly:** Review all agent code for:

```bash
# 1. Verify all executors registered
echo "Executor Registration Audit:"
rg "registerProposalExecutor" server/src/agent/executors/index.ts | wc -l

# 2. Check tenant isolation in all agent routes
echo "Tenant Isolation Audit:"
rg "tenantId" server/src/routes/agent.routes.ts | wc -l

# 3. Review error handling patterns
echo "Error Handling Audit:"
rg "throw new.*Error" server/src/agent --type ts | wc -l
rg "ErrorMessages" server/src/agent --type ts | wc -l
```

---

## Phase 5: Scaling (Team Integration)

### Step 5.1: Team Guidelines

Add to `CLAUDE.md` or `CONTRIBUTING.md`:

```markdown
## Multi-Agent Code Review

### When to Request Multi-Agent Review

**Always use multi-agent review for:**

- Agent/chatbot feature changes
- Circular dependency refactors
- Security-sensitive code
- Database schema changes
- Performance-critical operations

**Command:**
```

/workflows:review --agents architecture-strategist,security-sentinel,typescript-reviewer,performance-oracle

````

### Pre-submission Checklist

Before opening PR:

```bash
./scripts/pre-submission-check.sh
````

Must pass all checks.

### Code Review Standards

- P1 findings: Fix before merge
- P2 findings: Fix before merge (unless timeline-critical)
- P3 findings: Consider for follow-up PR
- Document all fixes with commit messages

### Assignment Rules

| Scenario      | Primary Agent           | Secondary               |
| ------------- | ----------------------- | ----------------------- |
| Circular deps | architecture-strategist | typescript-reviewer     |
| Type safety   | typescript-reviewer     | code-simplicity         |
| Security      | security-sentinel       | devops-harmony          |
| Performance   | performance-oracle      | architecture-strategist |

````

### Step 5.2: Onboarding New Engineers

Share this template:

```markdown
## Code Review Workflow Onboarding

1. **Setup (30 min)**
   - [ ] Read MULTI-AGENT-CODE-REVIEW-QUICK-REFERENCE.md (5 min)
   - [ ] Run pre-submission script: `./scripts/pre-submission-check.sh`
   - [ ] Make a small change and request review

2. **First PR (1 hour)**
   - [ ] Read PREVENTION-QUICK-REFERENCE.md (10 min)
   - [ ] Implement your feature
   - [ ] Run quality checks before submitting
   - [ ] Request multi-agent review if applicable

3. **First Code Review (30 min)**
   - [ ] Review 2-3 PRs with checklist from QUICK-REFERENCE
   - [ ] Practice identifying P1/P2/P3 issues
   - [ ] Ask questions on findings

4. **Ongoing**
   - [ ] Read 1 prevention strategy doc per week
   - [ ] Run weekly quality report to track trends
   - [ ] Submit improvements to checklists
````

---

## Troubleshooting

### Issue: Circular Dependency False Positive

**Problem:** madge reports circular dependency that doesn't exist

**Solution:**

```bash
# Verify with detailed output
npx madge --circular --extensions ts --graph server/src/agent
# Look at the mermaid diagram to see actual import paths

# If false positive, verify import structure:
# 1. Check for re-exports in index.ts
# 2. Verify no cross-imports between modules
# 3. Try: npx madge --list server/src/agent/
```

### Issue: Type Safety Error with Middleware

**Problem:** TypeScript complains about `req.tenantId` not existing

**Solution:**

1. Verify `server/src/types/express.d.ts` exists:

```typescript
declare global {
  namespace Express {
    interface Request {
      tenantId: string;
      tenantAuth?: any; // or more specific type
    }
  }
}
```

2. Verify file is imported in `tsconfig.json`:

```json
{
  "compilerOptions": {
    "typeRoots": ["./node_modules/@types", "./server/src/types"]
  }
}
```

### Issue: Test Pool Exhaustion

**Problem:** Tests fail with "too many connections" error

**Solution:**

```typescript
// Use test isolation helper
import { createTestTenant } from '../helpers/test-tenant';

test('should work', async () => {
  const { tenantId, cleanup } = await createTestTenant();
  try {
    // Your test
  } finally {
    await cleanup(); // CRITICAL: Cleans up connections
  }
});
```

### Issue: Circular Dependency in Agent Module

**Problem:** Import cycles between orchestrator and routes

**Solution:**

```typescript
// WRONG: Direct imports create cycle
// routes/agent.routes.ts imports orchestrator.ts
// orchestrator.ts imports routes

// RIGHT: Use registry module
// Create: server/src/agent/proposals/executor-registry.ts
// Routes import from registry
// Orchestrator imports from registry
// NO imports between routes and orchestrator
```

---

## Success Metrics

Track these over time:

```
Weekly Metrics:
- Circular dependencies: 0 (target)
- TypeScript errors: 0 (target)
- Lint errors: 0 (target)
- Test pass rate: >95% (target)
- Coverage: >70% (target)

Monthly Metrics:
- P1 issues in PRs: <5 (target)
- P2 issues in PRs: <10 (target)
- Build failures: 0 (target)
- Security issues: 0 (target)

Quarterly Review:
- Time spent on code review: Track and optimize
- Developer satisfaction: Survey team
- Bug escape rate: Track production issues
```

---

## Quick Rollout Plan

| Week | Activity                       | Owner     | Duration       |
| ---- | ------------------------------ | --------- | -------------- |
| 1    | Add PR template + ESLint rules | Tech Lead | 1 hour         |
| 1    | Setup pre-commit hook          | Tech Lead | 30 min         |
| 1    | Configure CI/CD pipeline       | DevOps    | 1 hour         |
| 2    | Train team on checklist        | Tech Lead | 1 hour meeting |
| 2    | Run 2-3 multi-agent reviews    | Tech Lead | 3 hours        |
| 3+   | Use in all PRs                 | All       | ongoing        |

---

## Summary

You now have:

1. ✅ **PR Template** - Guides developers through checklist
2. ✅ **Pre-commit Hook** - Prevents bad commits
3. ✅ **CI/CD Pipeline** - Enforces quality gates
4. ✅ **Scripts** - Automate checks
5. ✅ **Team Guidelines** - Clear expectations
6. ✅ **Onboarding** - New engineer training

**Next Steps:**

1. Implement Phase 1 & 2 this week
2. Train team with Phase 3 guidelines
3. Run Phase 4 weekly quality reports
4. Scale with Phase 5 team integration

For questions, refer to the full [Prevention Strategies Guide](./MULTI-AGENT-CODE-REVIEW-PREVENTION-STRATEGIES-MAIS-20251229.md).
